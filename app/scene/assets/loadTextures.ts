import {
  Color,
  Material,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  SRGBColorSpace,
  Texture,
  TextureLoader,
} from "three";

import { type JourneyStageId } from "../../data/journey";
import { ROUND2_TEXTURE_BINDINGS, type TextureBinding } from "./assetManifest";
import { type Round2ModelMap } from "./loadModels";

type TextureRuntimeOptions = {
  maxAnisotropy?: number;
  signal?: AbortSignal;
};

function findMeshByName(root: Object3D, meshName: string): Mesh | null {
  const object = root.getObjectByName(meshName);
  return object instanceof Mesh ? object : null;
}

function disposeLoadedTextures(textures: Iterable<Texture>): void {
  for (const texture of textures) {
    texture.dispose();
  }
}

function buildScreenMaterial(source: Mesh["material"], texture: Texture): MeshStandardMaterial {
  const sourceMaterial = Array.isArray(source) ? source[0] : source;
  const material = new MeshStandardMaterial();

  if (sourceMaterial instanceof MeshStandardMaterial) {
    material.color.copy(sourceMaterial.color);
    material.roughness = sourceMaterial.roughness;
    material.metalness = sourceMaterial.metalness;
    material.opacity = sourceMaterial.opacity;
    material.transparent = sourceMaterial.transparent;
    material.side = sourceMaterial.side;
  } else {
    material.color = new Color("#ffffff");
    material.roughness = 0.38;
    material.metalness = 0.02;
  }

  material.map = texture;
  material.emissive = new Color("#ffffff");
  material.emissiveMap = texture;
  material.emissiveIntensity = 0.16;
  material.needsUpdate = true;

  return material;
}

function disposeReplacedMaterial(material: Mesh["material"]): void {
  const materials = Array.isArray(material) ? material : [material];
  for (const entry of materials) {
    entry.dispose();
  }
}

function disposeDetachedMaterials(
  models: Round2ModelMap,
  replacements: readonly { previous: Mesh["material"] }[],
): void {
  const activeMaterials = new Set<Material>();
  for (const root of Object.values(models)) {
    root.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) activeMaterials.add(material);
    });
  }

  const disposedMaterials = new Set<Material>();
  for (const { previous } of replacements) {
    const materials = Array.isArray(previous) ? previous : [previous];
    for (const material of materials) {
      if (activeMaterials.has(material) || disposedMaterials.has(material)) continue;
      disposedMaterials.add(material);
      material.dispose();
    }
  }
}

async function loadBindingTexture(
  loader: TextureLoader,
  binding: TextureBinding,
  maxAnisotropy: number,
  loadedTextures: Texture[],
  texturePromises: Map<string, Promise<Texture>>,
  signal?: AbortSignal,
): Promise<[TextureBinding, Texture]> {
  signal?.throwIfAborted();
  let texturePromise = texturePromises.get(binding.textureUrl);
  if (!texturePromise) {
    texturePromise = loader.loadAsync(binding.textureUrl).then((texture) => {
      loadedTextures.push(texture);
      texture.colorSpace = SRGBColorSpace;
      texture.flipY = false;
      texture.anisotropy = Math.min(maxAnisotropy, 8);
      texture.needsUpdate = true;
      return texture;
    });
    texturePromises.set(binding.textureUrl, texturePromise);
  }
  const texture = await texturePromise;
  signal?.throwIfAborted();
  return [binding, texture];
}

export async function applyRound2Textures(
  models: Round2ModelMap,
  options: TextureRuntimeOptions = {},
): Promise<readonly Texture[]> {
  const textureLoader = new TextureLoader();
  const loadedTextures: Texture[] = [];
  const texturePromises = new Map<string, Promise<Texture>>();
  const replacedMaterials: Array<{ mesh: Mesh; previous: Mesh["material"] }> = [];
  const maxAnisotropy = Math.max(1, options.maxAnisotropy ?? 4);

  try {
    const results = await Promise.allSettled(
      ROUND2_TEXTURE_BINDINGS.map((binding) =>
        loadBindingTexture(
          textureLoader,
          binding,
          maxAnisotropy,
          loadedTextures,
          texturePromises,
          options.signal,
        ),
      ),
    );
    options.signal?.throwIfAborted();
    const rejected = results.find((result) => result.status === "rejected");
    if (rejected) throw rejected.reason;
    const loadedBindings = results.map((result) => {
      if (result.status === "rejected") throw result.reason;
      return result.value;
    });

    for (const [binding, texture] of loadedBindings) {
      const stageRoot = models[binding.stage as JourneyStageId];
      const mesh = findMeshByName(stageRoot, binding.meshName);

      if (!mesh) {
        throw new Error(
          `Round 2 texture target "${binding.meshName}" was not found in ${binding.stage}.`,
        );
      }

      const previous = mesh.material;
      const material = buildScreenMaterial(previous, texture);
      replacedMaterials.push({ mesh, previous });
      mesh.material = material;
    }

    disposeDetachedMaterials(models, replacedMaterials);

    return loadedTextures;
  } catch (error) {
    for (const { mesh, previous } of replacedMaterials) {
      disposeReplacedMaterial(mesh.material);
      mesh.material = previous;
    }
    disposeLoadedTextures(loadedTextures);
    throw error;
  }
}
