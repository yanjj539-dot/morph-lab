import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  AnimationClip,
  BoxGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Texture,
} from "three";

const cacheUrl = new URL(
  "../app/scene/assets/gpuResourceRefCount.ts",
  import.meta.url,
);
const gltfCacheUrl = new URL(
  "../app/scene/assets/gltfAssetCache.ts",
  import.meta.url,
);
const textureCacheUrl = new URL(
  "../app/scene/assets/textureAssetCache.ts",
  import.meta.url,
);

async function loadCacheModule() {
  assert.equal(existsSync(cacheUrl), true, "gpuResourceRefCount.ts is missing");
  return import(cacheUrl.href);
}

test("coalesces concurrent resource creation and disposes after the last release", async () => {
  const { createReferenceCountedCache } = await loadCacheModule();
  let createCount = 0;
  let disposeCount = 0;
  const cache = createReferenceCountedCache((resource) => {
    assert.equal(resource.id, "observe");
    disposeCount += 1;
  });
  const factory = async () => {
    createCount += 1;
    return { id: "observe" };
  };

  const [first, second] = await Promise.all([
    cache.acquire("observe", factory),
    cache.acquire("observe", factory),
  ]);

  assert.equal(createCount, 1);
  assert.equal(first.resource, second.resource);
  assert.equal(cache.getRefCount("observe"), 2);
  first.release();
  first.release();
  assert.equal(cache.getRefCount("observe"), 1);
  assert.equal(disposeCount, 0);
  second.release();
  assert.equal(cache.has("observe"), false);
  assert.equal(disposeCount, 1);
});

test("evicts rejected creation so a later acquisition can retry", async () => {
  const { createReferenceCountedCache } = await loadCacheModule();
  const cache = createReferenceCountedCache(() => {});
  let attempts = 0;
  const factory = async () => {
    attempts += 1;
    if (attempts === 1) throw new Error("decode failed");
    return { id: "structure" };
  };

  await assert.rejects(cache.acquire("structure", factory), /decode failed/);
  assert.equal(cache.has("structure"), false);
  const lease = await cache.acquire("structure", factory);

  assert.equal(attempts, 2);
  assert.equal(lease.resource.id, "structure");
  lease.release();
});

test("disposing the cache invalidates outstanding leases without double disposal", async () => {
  const { createReferenceCountedCache } = await loadCacheModule();
  let disposeCount = 0;
  const cache = createReferenceCountedCache(() => {
    disposeCount += 1;
  });
  const lease = await cache.acquire("release", async () => ({ id: "release" }));

  cache.dispose();
  lease.release();

  assert.equal(disposeCount, 1);
  assert.equal(cache.has("release"), false);
  await assert.rejects(
    cache.acquire("release", async () => ({ id: "release" })),
    /disposed/,
  );
});

test("shares parsed geometry and clips while isolating mutable instance materials", async () => {
  assert.equal(existsSync(gltfCacheUrl), true, "gltfAssetCache.ts is missing");
  if (!existsSync(gltfCacheUrl)) return;
  const { createGltfAssetCache } = await import(gltfCacheUrl.href);
  let parseCount = 0;
  let geometryDisposeCount = 0;
  const canonicalRoot = new Group();
  const geometry = new BoxGeometry(1, 1, 1);
  geometry.addEventListener("dispose", () => {
    geometryDisposeCount += 1;
  });
  canonicalRoot.add(
    new Mesh(geometry, new MeshStandardMaterial({ color: "#ffffff" })),
  );
  const animations = [new AnimationClip("OBSERVE_ACTION", 1, [])];
  const cache = createGltfAssetCache(async () => {
    parseCount += 1;
    return { root: canonicalRoot, animations, expectedClipName: "OBSERVE_ACTION" };
  });

  const [firstLease, secondLease] = await Promise.all([
    cache.acquire("observe"),
    cache.acquire("observe"),
  ]);
  const first = firstLease.instantiate("HeroObserve");
  const second = secondLease.instantiate("JourneyObserve");
  const firstMesh = first.root.children[0];
  const secondMesh = second.root.children[0];

  assert.equal(parseCount, 1);
  assert.equal(first.animations, second.animations);
  assert.equal(firstMesh.geometry, secondMesh.geometry);
  assert.notEqual(firstMesh.material, secondMesh.material);
  firstMesh.material.opacity = 0.25;
  assert.equal(secondMesh.material.opacity, 1);
  firstLease.release();
  assert.equal(geometryDisposeCount, 0);
  secondLease.release();
  assert.equal(geometryDisposeCount, 1);
});

test("shares loaded textures and disposes them after the final texture lease", async () => {
  assert.equal(existsSync(textureCacheUrl), true, "textureAssetCache.ts is missing");
  if (!existsSync(textureCacheUrl)) return;
  const { createTextureAssetCache } = await import(textureCacheUrl.href);
  let loadCount = 0;
  let disposeCount = 0;
  const cache = createTextureAssetCache(async () => {
    loadCount += 1;
    const texture = new Texture();
    texture.addEventListener("dispose", () => {
      disposeCount += 1;
    });
    return texture;
  });

  const [first, second] = await Promise.all([
    cache.acquire("paper-normal"),
    cache.acquire("paper-normal"),
  ]);
  assert.equal(loadCount, 1);
  assert.equal(first.texture, second.texture);
  first.release();
  assert.equal(disposeCount, 0);
  second.release();
  assert.equal(disposeCount, 1);
});

test("routes Round 4 stage loading through parsed asset leases", async () => {
  const source = await readFile(
    new URL("../app/scene/assets/loadModels.ts", import.meta.url),
    "utf8",
  );

  assert.match(source, /createGltfAssetCache/);
  assert.match(source, /acquireRound4StageAsset/);
  assert.match(source, /sharedGeometries/);
  assert.match(source, /release/);
});

test("Hero and Journey preserve shared resources until their parsed leases release", async () => {
  const [hero, journey] = await Promise.all([
    readFile(new URL("../app/scene/createHeroScene.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/scene/createJourneyScene.ts", import.meta.url), "utf8"),
  ]);

  assert.match(hero, /preserveGeometries/);
  assert.match(hero, /loadedModel\?\.release/);
  assert.match(journey, /sharedGeometries/);
  assert.match(journey, /runtime\.model\.release/);
});

test("coalesces the shared KTX2 material set behind texture leases", async () => {
  const [compressed, runtime] = await Promise.all([
    readFile(
      new URL(
        "../app/scene/materials/loadCompressedTextures.ts",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(new URL("../app/scene/assets/loadTextures.ts", import.meta.url), "utf8"),
  ]);

  assert.match(compressed, /createTextureAssetCache/);
  assert.match(compressed, /acquireRound3CompressedTextures/);
  assert.match(runtime, /LoadedTextureResources/);
  assert.match(runtime, /compressedLease\.release/);
});
