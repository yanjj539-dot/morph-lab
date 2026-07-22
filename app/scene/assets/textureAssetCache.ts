import { Texture } from "three";

import {
  createReferenceCountedCache,
  type ReferenceCountedCache,
} from "./gpuResourceRefCount.ts";

export type TextureAssetLease<T extends Texture = Texture> = {
  readonly texture: T;
  release(): void;
};

export type TextureAssetCache<Key, T extends Texture = Texture> = {
  acquire(key: Key): Promise<TextureAssetLease<T>>;
  getRefCount(key: Key): number;
  dispose(): void;
};

export function createTextureAssetCache<Key, T extends Texture = Texture>(
  loadTexture: (key: Key) => Promise<T>,
): TextureAssetCache<Key, T> {
  const resources: ReferenceCountedCache<Key, T> =
    createReferenceCountedCache((texture) => texture.dispose());

  return {
    async acquire(key) {
      const lease = await resources.acquire(key, () => loadTexture(key));
      return {
        texture: lease.resource,
        release: lease.release,
      };
    },
    getRefCount(key) {
      return resources.getRefCount(key);
    },
    dispose() {
      resources.dispose();
    },
  };
}
