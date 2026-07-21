import {
  Material,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Scene,
  SRGBColorSpace,
  Texture,
  TextureLoader,
  WebGLRenderer,
} from "three";

import { type JourneyStageId } from "../../data/journey";
import type { SceneQualitySettings } from "../core/qualityManager";
import { applyRound3MaterialSystem } from "../materials/materialFactory";
import { loadRound3CompressedTextures } from "../materials/loadCompressedTextures";
import {
  configureProjectSurface,
  type ProjectSurfaceKind,
} from "../materials/screenMaterial";
import { createPrintedSurface } from "../materials/createPrintedSurface";
import { createScreenMaterial } from "../materials/createScreenMaterial";
import {
  findScreenConfig,
  type ScreenConfig,
} from "../materials/screenManifest";
import {
  ROUND2_TEXTURE_BINDINGS,
  ROUND3_TEXTURE_BINDINGS,
  type TextureBinding,
} from "./assetManifest";
import { type Round2ModelMap } from "./loadModels";

type TextureRuntimeOptions = {
  maxAnisotropy?: number;
  signal?: AbortSignal;
};

export type Round3TextureRuntimeOptions = TextureRuntimeOptions & {
  quality: SceneQualitySettings;
  renderer: WebGLRenderer;
  scene: Scene;
};

function findMeshByName(root: Object3D, meshName: string): Mesh | null {
  const object = root.getObjectByName(meshName);
  return object instanceof Mesh ? object : null;
}

function disposeLoadedTextures(textures: Iterable<Texture>): void {
  for (const texture of textures) texture.dispose();
}

function disposeReplacedMaterial(material: Mesh["material"]): void {
  const materials = Array.isArray(material) ? material : [material];
  for (const entry of materials) entry.dispose();
}

function disposeDetachedMaterials(
  models: Round2ModelMap,
  replacements: readonly { previous: Mesh["material"] }[],
): void {
  const activeMaterials = new Set<Material>();
  const activeTextures = new Set<Texture>();
  for (const root of Object.values(models)) {
    root.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        activeMaterials.add(material);
        for (const value of Object.values(material)) {
          if (value instanceof Texture) activeTextures.add(value);
        }
      }
    });
  }

  const disposedMaterials = new Set<Material>();
  const disposedTextures = new Set<Texture>();
  for (const { previous } of replacements) {
    const materials = Array.isArray(previous) ? previous : [previous];
    for (const material of materials) {
      if (activeMaterials.has(material) || disposedMaterials.has(material)) continue;
      disposedMaterials.add(material);
      for (const value of Object.values(material)) {
        if (
          value instanceof Texture &&
          !activeTextures.has(value) &&
          !disposedTextures.has(value)
        ) {
          disposedTextures.add(value);
          value.dispose();
        }
      }
      material.dispose();
    }
  }
}

async function loadBindingTexture(
  loader: TextureLoader,
  binding: TextureBinding,
  textureUrl: string,
  maxAnisotropy: number,
  loadedTextures: Texture[],
  texturePromises: Map<string, Promise<Texture>>,
  signal?: AbortSignal,
): Promise<[TextureBinding, Texture]> {
  signal?.throwIfAborted();
  let texturePromise = texturePromises.get(textureUrl);

  if (!texturePromise) {
    texturePromise = loader.loadAsync(textureUrl).then((texture) => {
      loadedTextures.push(texture);
      texture.colorSpace = SRGBColorSpace;
      texture.flipY = false;
      texture.anisotropy = Math.min(maxAnisotropy, 8);
      texture.needsUpdate = true;
      return texture;
    });
    texturePromises.set(textureUrl, texturePromise);
  }

  const texture = await texturePromise;
  signal?.throwIfAborted();
  return [binding, texture];
}

function projectSurfaceKind(meshName: string): ProjectSurfaceKind {
  return /^(?:PRINT_|REL_project_image_)/.test(meshName) ? "print" : "screen";
}

type SurfaceReplacement = {
  mesh: Mesh;
  previous: Mesh["material"];
  overlay?: Mesh;
  contentTexture?: Texture;
};

function firstMaterial(source: Mesh["material"]): Material {
  return Array.isArray(source) ? source[0] : source;
}

function createSurfaceBaseMaterial(
  previous: Mesh["material"],
  kind: ProjectSurfaceKind,
): MeshStandardMaterial {
  const source = firstMaterial(previous);
  const material = new MeshStandardMaterial({
    color: kind === "screen" ? "#101116" : "#eeeae1",
    roughness: kind === "screen" ? 0.5 : 0.91,
    metalness: 0,
  });
  material.name = kind === "screen" ? "MAT_RuntimeScreenBase" : "MAT_RuntimePrintBase";
  material.opacity = source.opacity;
  material.transparent = source.transparent;
  material.side = source.side;
  material.depthWrite = true;
  return material;
}

function installConfiguredSurface(
  mesh: Mesh,
  texture: Texture,
  config: ScreenConfig,
): SurfaceReplacement {
  const previous = mesh.material;
  const contentTexture = texture.clone();
  const created = config.kind === "screen"
    ? createScreenMaterial(contentTexture, config)
    : createPrintedSurface(contentTexture, config);
  const contentMaterial = created.material;
  contentMaterial.polygonOffsetUnits = -Math.max(1, Math.round(config.contentDepthOffset * 1000));

  mesh.material = createSurfaceBaseMaterial(previous, config.kind);
  mesh.renderOrder = 1;
  const overlay = mesh.clone(false) as Mesh;
  overlay.name = `${mesh.name}__content`;
  overlay.material = contentMaterial;
  overlay.renderOrder = config.renderOrder;
  overlay.castShadow = false;
  overlay.receiveShadow = false;
  mesh.parent?.add(overlay);

  if (config.kind === "screen") {
    mesh.castShadow = false;
    mesh.receiveShadow = false;
  }

  return { mesh, previous, overlay, contentTexture };
}

async function applyProjectTextures(
  models: Round2ModelMap,
  bindings: readonly TextureBinding[],
  options: TextureRuntimeOptions,
): Promise<readonly Texture[]> {
  const textureLoader = new TextureLoader();
  const loadedTextures: Texture[] = [];
  const texturePromises = new Map<string, Promise<Texture>>();
  const replacedMaterials: SurfaceReplacement[] = [];
  const maxAnisotropy = Math.max(1, options.maxAnisotropy ?? 4);

  try {
    const results = await Promise.allSettled(
      bindings.map((binding) =>
        loadBindingTexture(
          textureLoader,
          binding,
          findScreenConfig(binding.stage as JourneyStageId, binding.meshName)?.source ?? binding.textureUrl,
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
          `Round 3 texture target "${binding.meshName}" was not found in ${binding.stage}.`,
        );
      }

      const config = findScreenConfig(binding.stage as JourneyStageId, binding.meshName);
      if (config) {
        const replacement = installConfiguredSurface(mesh, texture, config);
        if (replacement.contentTexture) loadedTextures.push(replacement.contentTexture);
        replacedMaterials.push(replacement);
      } else {
        const previous = configureProjectSurface(
          mesh,
          texture,
          projectSurfaceKind(binding.meshName),
        );
        replacedMaterials.push({ mesh, previous });
      }
    }

    disposeDetachedMaterials(models, replacedMaterials);
    return loadedTextures;
  } catch (error) {
    for (const { mesh, previous, overlay } of replacedMaterials) {
      disposeReplacedMaterial(mesh.material);
      mesh.material = previous;
      if (overlay) {
        overlay.removeFromParent();
        disposeReplacedMaterial(overlay.material);
      }
    }
    disposeLoadedTextures(loadedTextures);
    throw error;
  }
}

export function applyRound2Textures(
  models: Round2ModelMap,
  options: TextureRuntimeOptions = {},
): Promise<readonly Texture[]> {
  return applyProjectTextures(models, ROUND2_TEXTURE_BINDINGS, options);
}

export async function applyRound3Textures(
  models: Round2ModelMap,
  options: Round3TextureRuntimeOptions,
): Promise<readonly Texture[]> {
  const maxAnisotropy = Math.max(1, options.maxAnisotropy ?? 4);
  const compressed = await loadRound3CompressedTextures(options.renderer, {
    maxAnisotropy,
    signal: options.signal,
  });

  try {
    for (const root of Object.values(models)) {
      applyRound3MaterialSystem(root, compressed, options.quality);
    }

    options.scene.environment = compressed.neutralStudioEnv;
    options.scene.environmentIntensity = options.quality.tier === "high" ? 0.78 : 0.62;
    const projectTextures = await applyProjectTextures(
      models,
      ROUND3_TEXTURE_BINDINGS,
      options,
    );

    return [...Object.values(compressed), ...projectTextures];
  } catch (error) {
    options.scene.environment = null;
    disposeLoadedTextures(Object.values(compressed));
    throw error;
  }
}
