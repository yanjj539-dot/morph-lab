import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";
import {
  BufferGeometry,
  Group,
  Material,
  Mesh,
  MeshStandardMaterial,
  Texture,
  TextureLoader,
} from "three";

import { fitUv } from "../app/scene/materials/uvFit.ts";

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      if (/^\.{1,2}\//.test(specifier) && !/\.[a-z0-9]+$/i.test(specifier)) {
        return nextResolve(`${specifier}.ts`, context);
      }
      throw error;
    }
  },
});

const [{ createPrintedSurface }, { createScreenMaterial }, { SCREEN_MANIFEST }] =
  await Promise.all([
    import("../app/scene/materials/createPrintedSurface.ts"),
    import("../app/scene/materials/createScreenMaterial.ts"),
    import("../app/scene/materials/screenManifest.ts"),
  ]);

const stages = ["observe", "structure", "prototype", "release"];

function createModels(bindings) {
  const models = Object.fromEntries(stages.map((stage) => [stage, new Group()]));
  for (const binding of bindings) {
    const mesh = new Mesh(new BufferGeometry(), new MeshStandardMaterial());
    mesh.name = binding.meshName;
    models[binding.stage].add(mesh);
  }
  return models;
}

async function withTextureLoaderStub(run) {
  const originalLoadAsync = TextureLoader.prototype.loadAsync;
  TextureLoader.prototype.loadAsync = async function loadNamedTexture(url) {
    const texture = new Texture();
    texture.name = String(url);
    return texture;
  };
  try {
    return await run();
  } finally {
    TextureLoader.prototype.loadAsync = originalLoadAsync;
  }
}

function localDepth(source, layer) {
  return layer.position
    .clone()
    .sub(source.position)
    .applyQuaternion(source.quaternion.clone().invert()).z;
}

const source = { width: 1600, height: 1000 };

test("cover crops the source without stretching and honors center alignment", () => {
  const result = fitUv({
    source,
    surfaceAspect: 1,
    fit: "cover",
    positionX: 0.5,
    positionY: 0.5,
    scale: 1,
    rotation: 0,
    safeArea: 0,
  });

  assert.deepEqual(result.crop, {
    scale: { x: 0.625, y: 1 },
    offset: { x: 0.1875, y: 0 },
  });
  assert.equal(result.content, null);
});

test("cover alignment moves the crop to the requested edge", () => {
  const result = fitUv({
    source,
    surfaceAspect: 1,
    fit: "cover",
    positionX: 0,
    positionY: 1,
    scale: 1,
    rotation: 0,
    safeArea: 0,
  });

  assert.deepEqual(result.crop?.offset, { x: 0, y: 0 });
});

test("cover maps its crop through the safe area", () => {
  const result = fitUv({
    source,
    surfaceAspect: 1,
    fit: "cover",
    positionX: 0.5,
    positionY: 0.5,
    scale: 1,
    rotation: 0,
    safeArea: 0.1,
  });

  assert.deepEqual(result.crop, {
    scale: { x: 0.78125, y: 1.25 },
    offset: { x: 0.109375, y: -0.125 },
  });
  assert.deepEqual(result.safeRect, { x: 0.1, y: 0.1, width: 0.8, height: 0.8 });
});

test("cover scale zooms uniformly without changing sampled aspect", () => {
  const result = fitUv({
    source,
    surfaceAspect: 1,
    fit: "cover",
    positionX: 0.5,
    positionY: 0.5,
    scale: 2,
    rotation: 0,
    safeArea: 0,
  });

  assert.deepEqual(result.crop, {
    scale: { x: 0.3125, y: 0.5 },
    offset: { x: 0.34375, y: 0.25 },
  });
  assert.equal(result.crop.scale.x / result.crop.scale.y, 0.625);
});

test("contain returns a smaller centered content rect inside the safe area", () => {
  const result = fitUv({
    source,
    surfaceAspect: 1,
    fit: "contain",
    positionX: 0.5,
    positionY: 0.5,
    scale: 1,
    rotation: 0,
    safeArea: 0.1,
  });

  assert.deepEqual(result.safeRect, { x: 0.1, y: 0.1, width: 0.8, height: 0.8 });
  assert.deepEqual(result.content, {
    scale: { x: 0.8, y: 0.5 },
    offset: { x: 0.1, y: 0.25 },
  });
  assert.equal(result.crop, null);
});

test("contain scale reduces content without changing its aspect ratio", () => {
  const result = fitUv({
    source,
    surfaceAspect: 1,
    fit: "contain",
    positionX: 0.5,
    positionY: 0.5,
    scale: 0.5,
    rotation: 0,
    safeArea: 0,
  });

  assert.deepEqual(result.content, {
    scale: { x: 0.5, y: 0.3125 },
    offset: { x: 0.25, y: 0.34375 },
  });
});

test("rounded-corner containment rejects corner pixels but keeps interior pixels", async () => {
  const uvFit = await import("../app/scene/materials/uvFit.ts");
  assert.equal(typeof uvFit.isUvInsideRoundedRect, "function");
  const rect = { x: 0, y: 0, width: 1, height: 1 };

  assert.equal(uvFit.isUvInsideRoundedRect({ x: 0.01, y: 0.01 }, rect, 0.2), false);
  assert.equal(uvFit.isUvInsideRoundedRect({ x: 0.15, y: 0.15 }, rect, 0.2), true);
  assert.equal(uvFit.isUvInsideRoundedRect({ x: 0.5, y: 0.5 }, rect, 0.2), true);
});

test("screen and print shaders consume each surface borderRadius", () => {
  const screenConfig = SCREEN_MANIFEST.find((config) => config.kind === "screen");
  const printConfig = SCREEN_MANIFEST.find((config) => config.kind === "print");
  assert.ok(screenConfig);
  assert.ok(printConfig);

  for (const [created, radius] of [
    [createScreenMaterial(new Texture(), screenConfig), screenConfig.borderRadius],
    [createPrintedSurface(new Texture(), printConfig), printConfig.borderRadius],
  ]) {
    const shader = {
      vertexShader: "#include <uv_vertex>",
      fragmentShader: "#include <map_fragment>",
    };
    created.material.onBeforeCompile(shader);
    assert.match(shader.fragmentShader, /runtimeCornerDistance/);
    assert.match(shader.fragmentShader, new RegExp(radius.toFixed(8)));
  }
});

test("screen emission stays restrained without an untransformed emissive map", () => {
  const screenConfig = SCREEN_MANIFEST.find((config) => config.kind === "screen");
  assert.ok(screenConfig);
  const { material } = createScreenMaterial(new Texture(), screenConfig);

  assert.equal(material.emissiveMap, null);
  assert.ok(material.emissiveIntensity > 0);
  assert.ok(material.emissiveIntensity <= 0.16);
});

test("Round 2 texture loading keeps original binding URLs and legacy single-layer surfaces", async () => {
  const [{ applyRound2Textures }, { ROUND2_TEXTURE_BINDINGS }] = await Promise.all([
    import("../app/scene/assets/loadTextures.ts"),
    import("../app/scene/assets/assetManifest.ts"),
  ]);
  const models = createModels(ROUND2_TEXTURE_BINDINGS);

  await withTextureLoaderStub(() => applyRound2Textures(models));

  for (const binding of ROUND2_TEXTURE_BINDINGS) {
    const mesh = models[binding.stage].getObjectByName(binding.meshName);
    assert.ok(mesh instanceof Mesh);
    assert.ok(mesh.material instanceof MeshStandardMaterial);
    assert.equal(mesh.material.map?.name, binding.textureUrl, `${binding.meshName} URL`);
    assert.equal(
      models[binding.stage].getObjectByName(`${binding.meshName}__content`),
      undefined,
      `${binding.meshName} keeps the Round 2 single-layer path`,
    );
  }
});

test("manifest surfaces apply each configured content and glass depth", async () => {
  const [textureRuntime, { ROUND3_TEXTURE_BINDINGS }] = await Promise.all([
    import("../app/scene/assets/loadTextures.ts"),
    import("../app/scene/assets/assetManifest.ts"),
  ]);
  assert.equal(typeof textureRuntime.applyScreenManifestTextures, "function");
  const models = createModels(ROUND3_TEXTURE_BINDINGS);
  for (const root of Object.values(models)) {
    for (const child of root.children) child.rotation.set(0.13, 0.27, -0.09);
  }

  await withTextureLoaderStub(() => textureRuntime.applyScreenManifestTextures(models));

  for (const config of SCREEN_MANIFEST) {
    const root = models[config.stage];
    const sourceMesh = root.getObjectByName(config.meshName);
    const content = root.getObjectByName(`${config.meshName}__content`);
    assert.ok(sourceMesh instanceof Mesh);
    assert.ok(content instanceof Mesh);
    assert.ok(Math.abs(localDepth(sourceMesh, content) - config.contentDepthOffset) < 1e-12);
    assert.equal(content.renderOrder, config.renderOrder);

    const glass = root.getObjectByName(`${config.meshName}__glass`);
    if (config.kind === "screen") {
      assert.ok(glass instanceof Mesh);
      assert.ok(Math.abs(localDepth(sourceMesh, glass) - config.glassDepthOffset) < 1e-12);
      assert.equal(glass.renderOrder, 3);
      assert.equal(glass.material.depthWrite, false);
    } else {
      assert.equal(glass, undefined);
    }
  }
});

test("manifest load failure restores mesh state and disposes all temporary layers", async () => {
  const [textureRuntime, { ROUND3_TEXTURE_BINDINGS }] = await Promise.all([
    import("../app/scene/assets/loadTextures.ts"),
    import("../app/scene/assets/assetManifest.ts"),
  ]);
  assert.equal(typeof textureRuntime.applyScreenManifestTextures, "function");
  const firstBinding = ROUND3_TEXTURE_BINDINGS[0];
  const models = createModels([firstBinding]);
  const mesh = models[firstBinding.stage].getObjectByName(firstBinding.meshName);
  assert.ok(mesh instanceof Mesh);
  const originalMaterial = mesh.material;
  mesh.renderOrder = 7;
  mesh.castShadow = true;
  mesh.receiveShadow = false;
  const disposedNames = [];
  const originalDispose = Material.prototype.dispose;
  Material.prototype.dispose = function recordDispose() {
    disposedNames.push(this.name);
    return originalDispose.call(this);
  };

  try {
    await assert.rejects(
      withTextureLoaderStub(() => textureRuntime.applyScreenManifestTextures(models)),
      /was not found/,
    );
  } finally {
    Material.prototype.dispose = originalDispose;
  }

  assert.equal(mesh.material, originalMaterial);
  assert.equal(mesh.renderOrder, 7);
  assert.equal(mesh.castShadow, true);
  assert.equal(mesh.receiveShadow, false);
  assert.equal(models[firstBinding.stage].getObjectByName(`${mesh.name}__content`), undefined);
  assert.equal(models[firstBinding.stage].getObjectByName(`${mesh.name}__glass`), undefined);
  assert.ok(disposedNames.includes("MAT_RuntimeScreenBase"));
  assert.ok(disposedNames.includes("MAT_RuntimeScreenContent"));
  assert.ok(disposedNames.includes("MAT_RuntimeScreenGlass"));
});

for (const [rotation, radians] of [
  [0, 0],
  [90, Math.PI / 2],
  [180, Math.PI],
  [270, (Math.PI * 3) / 2],
]) {
  test(`rotation ${rotation} exposes radians and swaps the 90-degree fit axis`, () => {
    const result = fitUv({
      source,
      surfaceAspect: 1,
      fit: "cover",
      positionX: 0.5,
      positionY: 0.5,
      scale: 1,
      rotation,
      safeArea: 0,
    });

    assert.equal(result.rotation, radians);
    assert.deepEqual(
      result.crop?.scale,
      rotation === 90 || rotation === 270 ? { x: 1, y: 0.625 } : { x: 0.625, y: 1 },
    );
  });
}
