import {
  AnimationClip,
  BufferGeometry,
  Group,
  Material,
  Mesh,
  Texture,
} from "three";
import { clone as cloneSkeleton } from "three/addons/utils/SkeletonUtils.js";

import {
  createReferenceCountedCache,
  type ReferenceCountedCache,
} from "./gpuResourceRefCount.ts";

export type ParsedStageAsset = {
  root: Group;
  animations: AnimationClip[];
  expectedClipName?: string;
};

export type InstantiatedStageAsset = ParsedStageAsset & {
  sharedGeometries: ReadonlySet<BufferGeometry>;
  sharedTextures: ReadonlySet<Texture>;
};

export type ParsedStageAssetLease = {
  instantiate(name: string): InstantiatedStageAsset;
  release(): void;
};

export type GltfAssetCache<Key> = {
  acquire(key: Key): Promise<ParsedStageAssetLease>;
  getRefCount(key: Key): number;
  dispose(): void;
};

type CanonicalStageAsset = ParsedStageAsset & {
  geometries: Set<BufferGeometry>;
  materials: Set<Material>;
  textures: Set<Texture>;
};

function materialTextures(material: Material): Texture[] {
  return Object.values(material).filter(
    (value): value is Texture => value instanceof Texture,
  );
}

function collectCanonicalResources(asset: ParsedStageAsset): CanonicalStageAsset {
  const geometries = new Set<BufferGeometry>();
  const materials = new Set<Material>();
  const textures = new Set<Texture>();

  asset.root.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    geometries.add(object.geometry);
    const entries = Array.isArray(object.material)
      ? object.material
      : [object.material];
    for (const material of entries) {
      materials.add(material);
      for (const texture of materialTextures(material)) textures.add(texture);
    }
  });

  return { ...asset, geometries, materials, textures };
}

function disposeCanonical(asset: CanonicalStageAsset): void {
  for (const geometry of asset.geometries) geometry.dispose();
  for (const material of asset.materials) material.dispose();
  for (const texture of asset.textures) texture.dispose();
}

function cloneMutableMaterials(root: Group): void {
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    object.material = Array.isArray(object.material)
      ? object.material.map((material) => material.clone())
      : object.material.clone();
  });
}

export function createGltfAssetCache<Key>(
  loadCanonical: (key: Key) => Promise<ParsedStageAsset>,
): GltfAssetCache<Key> {
  const resources: ReferenceCountedCache<Key, CanonicalStageAsset> =
    createReferenceCountedCache(disposeCanonical);

  return {
    async acquire(key) {
      const lease = await resources.acquire(key, async () =>
        collectCanonicalResources(await loadCanonical(key)),
      );
      let released = false;

      return {
        instantiate(name) {
          if (released) {
            throw new Error("Cannot instantiate a released parsed GLTF lease.");
          }
          const root = cloneSkeleton(lease.resource.root) as Group;
          cloneMutableMaterials(root);
          root.name = name;
          return {
            root,
            animations: lease.resource.animations,
            expectedClipName: lease.resource.expectedClipName,
            sharedGeometries: lease.resource.geometries,
            sharedTextures: lease.resource.textures,
          };
        },
        release() {
          if (released) return;
          released = true;
          lease.release();
        },
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
