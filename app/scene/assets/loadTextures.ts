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

export type TextureRuntimeOptions = {
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
  previousRenderOrder: number;
  previousCastShadow: boolean;
  previousReceiveShadow: boolean;
  overlays: Mesh[];
  contentTextures: Texture[];
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
  const previousRenderOrder = mesh.renderOrder;
  const previousCastShadow = mesh.castShadow;
  const previousReceiveShadow = mesh.receiveShadow;
  const contentTexture = texture.clone();
  let contentMaterial: MeshStandardMaterial;
  let glassMaterial: Material | null = null;
  if (config.kind === "screen") {
    const created = createScreenMaterial(contentTexture, config);
    contentMaterial = created.material;
    glassMaterial = created.glassMaterial;
  } else {
    contentMaterial = createPrintedSurface(contentTexture, config).material;
  }
  contentMaterial.polygonOffsetUnits = -Math.max(1, Math.round(config.contentDepthOffset * 1000));

  mesh.material = createSurfaceBaseMaterial(previous, config.kind);
  mesh.renderOrder = 1;
  const contentOverlay = mesh.clone(false) as Mesh;
  contentOverlay.name = `${mesh.name}__content`;
  contentOverlay.material = contentMaterial;
  contentOverlay.renderOrder = config.renderOrder;
  contentOverlay.castShadow = false;
  contentOverlay.receiveShadow = false;
  contentOverlay.translateZ(config.contentDepthOffset);
  contentOverlay.userData.surfaceDepthOffset = config.contentDepthOffset;
  mesh.parent?.add(contentOverlay);
  const overlays = [contentOverlay];

  if (glassMaterial) {
    const glassOverlay = mesh.clone(false) as Mesh;
    glassOverlay.name = `${mesh.name}__glass`;
    glassOverlay.material = glassMaterial;
    glassOverlay.renderOrder = 3;
    glassOverlay.castShadow = false;
    glassOverlay.receiveShadow = false;
    glassOverlay.translateZ(config.glassDepthOffset);
    glassOverlay.userData.surfaceDepthOffset = config.glassDepthOffset;
    mesh.parent?.add(glassOverlay);
    overlays.push(glassOverlay);
  }

  if (config.kind === "screen") {
    mesh.castShadow = false;
    mesh.receiveShadow = false;
  }

  return {
    mesh,
    previous,
    previousRenderOrder,
    previousCastShadow,
    previousReceiveShadow,
    overlays,
    contentTextures: [contentTexture],
  };
}

function createLegacyReplacement(mesh: Mesh): SurfaceReplacement {
  return {
    mesh,
    previous: mesh.material,
    previousRenderOrder: mesh.renderOrder,
    previousCastShadow: mesh.castShadow,
    previousReceiveShadow: mesh.receiveShadow,
    overlays: [],
    contentTextures: [],
  };
}

function rollbackSurfaceReplacement(replacement: SurfaceReplacement): void {
  const {
    mesh,
    previous,
    previousRenderOrder,
    previousCastShadow,
    previousReceiveShadow,
    overlays,
  } = replacement;
  disposeReplacedMaterial(mesh.material);
  mesh.material = previous;
  mesh.renderOrder = previousRenderOrder;
  mesh.castShadow = previousCastShadow;
  mesh.receiveShadow = previousReceiveShadow;
  for (const overlay of overlays) {
    overlay.removeFromParent();
    disposeReplacedMaterial(overlay.material);
  }
}

async function applyProjectTextures(
  models: Round2ModelMap,
  bindings: readonly TextureBinding[],
  options: TextureRuntimeOptions,
  useScreenManifest: boolean,
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
          (useScreenManifest
            ? findScreenConfig(binding.stage as JourneyStageId, binding.meshName)?.source
            : undefined) ?? binding.textureUrl,
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

      const config = useScreenManifest
        ? findScreenConfig(binding.stage as JourneyStageId, binding.meshName)
        : undefined;
      if (config) {
        const replacement = installConfiguredSurface(mesh, texture, config);
        loadedTextures.push(...replacement.contentTextures);
        replacedMaterials.push(replacement);
      } else {
        const replacement = createLegacyReplacement(mesh);
        const previous = configureProjectSurface(
          mesh,
          texture,
          projectSurfaceKind(binding.meshName),
        );
        replacement.previous = previous;
        replacedMaterials.push(replacement);
      }
    }

    disposeDetachedMaterials(models, replacedMaterials);
    return loadedTextures;
  } catch (error) {
    for (const replacement of replacedMaterials) rollbackSurfaceReplacement(replacement);
    disposeLoadedTextures(loadedTextures);
    throw error;
  }
}

export function applyRound2Textures(
  models: Round2ModelMap,
  options: TextureRuntimeOptions = {},
): Promise<readonly Texture[]> {
  return applyProjectTextures(models, ROUND2_TEXTURE_BINDINGS, options, false);
}

export function applyScreenManifestTextures(
  models: Round2ModelMap,
  options: TextureRuntimeOptions = {},
): Promise<readonly Texture[]> {
  return applyProjectTextures(models, ROUND3_TEXTURE_BINDINGS, options, true);
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
    const projectTextures = await applyScreenManifestTextures(models, options);

    return [...Object.values(compressed), ...projectTextures];
  } catch (error) {
    options.scene.environment = null;
    disposeLoadedTextures(Object.values(compressed));
    throw error;
  }
}
