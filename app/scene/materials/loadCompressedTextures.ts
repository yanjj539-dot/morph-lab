import {
  EquirectangularReflectionMapping,
  NoColorSpace,
  RepeatWrapping,
  SRGBColorSpace,
  Texture,
  WebGLRenderer,
} from "three";
import { KTX2Loader } from "three/addons/loaders/KTX2Loader.js";

import {
  ROUND3_TEXTURE_MANIFEST,
  type Round3TextureId,
} from "./textureManifest";

export type Round3TextureSet = Record<Round3TextureId, Texture>;

export type CompressedTextureLoadOptions = {
  maxAnisotropy: number;
  signal?: AbortSignal;
};

export async function loadRound3CompressedTextures(
  renderer: WebGLRenderer,
  options: CompressedTextureLoadOptions,
): Promise<Round3TextureSet> {
  options.signal?.throwIfAborted();
  const loader = new KTX2Loader();
  loader.setWorkerLimit(2);
  loader.detectSupport(renderer);
  const loaded: Texture[] = [];

  try {
    const entries = await Promise.all(
      (Object.entries(ROUND3_TEXTURE_MANIFEST) as Array<
        [Round3TextureId, (typeof ROUND3_TEXTURE_MANIFEST)[Round3TextureId]]
      >).map(async ([id, entry]) => {
        const texture = await loader.loadAsync(entry.url);
        loaded.push(texture);
        texture.name = `ROUND3_${id}`;
        texture.colorSpace = entry.environment ? SRGBColorSpace : NoColorSpace;
        texture.anisotropy = Math.min(Math.max(1, options.maxAnisotropy), 8);

        if (entry.environment) {
          texture.mapping = EquirectangularReflectionMapping;
        } else if (entry.repeat) {
          texture.wrapS = RepeatWrapping;
          texture.wrapT = RepeatWrapping;
          texture.repeat.set(entry.repeat[0], entry.repeat[1]);
        }
        texture.needsUpdate = true;
        return [id, texture] as const;
      }),
    );

    options.signal?.throwIfAborted();
    const textures = new Map<Round3TextureId, Texture>(entries);
    const requireTexture = (id: Round3TextureId): Texture => {
      const texture = textures.get(id);
      if (!texture) throw new Error(`Round 3 KTX2 texture "${id}" was not loaded.`);
      return texture;
    };

    return {
      paperNormal: requireTexture("paperNormal"),
      plasticNormal: requireTexture("plasticNormal"),
      metalBrushedNormal: requireTexture("metalBrushedNormal"),
      rubberNormal: requireTexture("rubberNormal"),
      studioOrm: requireTexture("studioOrm"),
      neutralStudioEnv: requireTexture("neutralStudioEnv"),
    };
  } catch (error) {
    for (const texture of loaded) texture.dispose();
    throw error;
  } finally {
    loader.dispose();
  }
}
