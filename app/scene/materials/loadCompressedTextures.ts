import {
  EquirectangularReflectionMapping,
  NoColorSpace,
  RepeatWrapping,
  SRGBColorSpace,
  Texture,
  WebGLRenderer,
} from "three";
import { KTX2Loader } from "three/addons/loaders/KTX2Loader.js";

import { createTextureAssetCache } from "../assets/textureAssetCache.ts";
import {
  ROUND3_TEXTURE_MANIFEST,
  type Round3TextureId,
} from "./textureManifest";

export type Round3TextureSet = Record<Round3TextureId, Texture>;

export type CompressedTextureLoadOptions = {
  maxAnisotropy: number;
  signal?: AbortSignal;
};

export type Round3CompressedTextureLease = {
  readonly textures: Round3TextureSet;
  readonly sharedTextures: ReadonlySet<Texture>;
  release(): void;
};

const TEXTURE_IDS = Object.keys(
  ROUND3_TEXTURE_MANIFEST,
) as Round3TextureId[];

const capabilityCaches = new Map<
  string,
  ReturnType<typeof createTextureAssetCache<Round3TextureId>>
>();

function capabilityKey(renderer: WebGLRenderer): string {
  const extensions = [
    "WEBGL_compressed_texture_astc",
    "WEBGL_compressed_texture_etc",
    "WEBGL_compressed_texture_s3tc",
    "EXT_texture_compression_bptc",
  ]
    .filter((name) => renderer.extensions.has(name))
    .join(",");
  return [
    renderer.capabilities.isWebGL2 ? "webgl2" : "webgl1",
    renderer.capabilities.maxTextureSize,
    extensions,
  ].join(":");
}

function cacheForRenderer(renderer: WebGLRenderer) {
  const key = capabilityKey(renderer);
  const cached = capabilityCaches.get(key);
  if (cached) return cached;

  const loader = new KTX2Loader();
  loader.setWorkerLimit(2);
  loader.detectSupport(renderer);
  const cache = createTextureAssetCache<Round3TextureId>(async (id) => {
    const entry = ROUND3_TEXTURE_MANIFEST[id];
    const texture = await loader.loadAsync(entry.url);
    texture.name = `ROUND3_${id}`;
    texture.colorSpace = entry.environment ? SRGBColorSpace : NoColorSpace;
    if (entry.environment) {
      texture.mapping = EquirectangularReflectionMapping;
    } else if (entry.repeat) {
      texture.wrapS = RepeatWrapping;
      texture.wrapT = RepeatWrapping;
      texture.repeat.set(entry.repeat[0], entry.repeat[1]);
    }
    texture.needsUpdate = true;
    return texture;
  });
  capabilityCaches.set(key, cache);
  return cache;
}

export async function acquireRound3CompressedTextures(
  renderer: WebGLRenderer,
  options: CompressedTextureLoadOptions,
): Promise<Round3CompressedTextureLease> {
  options.signal?.throwIfAborted();
  const cache = cacheForRenderer(renderer);
  const leases = await Promise.all(TEXTURE_IDS.map((id) => cache.acquire(id)));

  try {
    options.signal?.throwIfAborted();
    const entries = TEXTURE_IDS.map((id, index) => {
      const texture = leases[index].texture;
      texture.anisotropy = Math.max(
        texture.anisotropy,
        Math.min(Math.max(1, options.maxAnisotropy), 8),
      );
      texture.needsUpdate = true;
      return [id, texture] as const;
    });
    const textures = Object.fromEntries(entries) as Round3TextureSet;
    let released = false;
    return {
      textures,
      sharedTextures: new Set(Object.values(textures)),
      release() {
        if (released) return;
        released = true;
        for (const lease of leases) lease.release();
      },
    };
  } catch (error) {
    for (const lease of leases) lease.release();
    throw error;
  }
}
