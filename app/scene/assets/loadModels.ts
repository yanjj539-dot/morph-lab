import {
  AnimationClip,
  BufferGeometry,
  Group,
  Material,
  Mesh,
  Object3D,
  Texture,
} from "three";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

import { type JourneyStageId } from "../../data/journey";
import {
  DRACO_DECODER_PATH,
  ROUND2_STAGE_ASSETS,
  ROUND2_STAGE_ORDER,
  ROUND3_STAGE_ASSETS,
  ROUND3_STAGE_ORDER,
  ROUND4_STAGE_ASSETS,
  ROUND4_STAGE_ORDER,
  type StageAssetManifest,
} from "./assetManifest";
import {
  createGltfAssetCache,
  type InstantiatedStageAsset,
} from "./gltfAssetCache.ts";
import { loadModelBytes } from "./modelByteCache";

export type LoadedStageModel = {
  root: Group;
  animations: AnimationClip[];
  expectedClipName?: string;
  sharedGeometries?: ReadonlySet<BufferGeometry>;
  sharedTextures?: ReadonlySet<Texture>;
  release?: () => void;
};

export type Round2ModelMap = Record<JourneyStageId, Group>;
export type Round3ModelMap = Record<JourneyStageId, LoadedStageModel>;
export type Round4ModelMap = Record<JourneyStageId, LoadedStageModel>;

export type StageModelLoadOptions = {
  signal?: AbortSignal;
};

export type Round2ModelLoadOptions = StageModelLoadOptions;

function createConfiguredGltfLoader(): {
  gltfLoader: GLTFLoader;
  dracoLoader: DRACOLoader;
} {
  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath(DRACO_DECODER_PATH);
  dracoLoader.setDecoderConfig({ type: "wasm" });
  const gltfLoader = new GLTFLoader();
  gltfLoader.setDRACOLoader(dracoLoader);
  return { gltfLoader, dracoLoader };
}

function disposeMaterial(material: Material): void {
  for (const value of Object.values(material)) {
    if (value instanceof Texture) value.dispose();
  }
  material.dispose();
}

function disposeObject(object: Object3D): void {
  const geometries = new Set<Mesh["geometry"]>();
  const materials = new Set<Material>();

  object.traverse((node) => {
    if (!(node instanceof Mesh)) return;
    geometries.add(node.geometry);
    const nodeMaterials = Array.isArray(node.material)
      ? node.material
      : [node.material];
    for (const material of nodeMaterials) materials.add(material);
  });

  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) disposeMaterial(material);
}

export function disposeLoadedStageModels(models: Round3ModelMap): void {
  for (const model of Object.values(models)) {
    if (model.release) model.release();
    else disposeObject(model.root);
  }
}

async function loadLegacyStageModels(
  assets: Record<JourneyStageId, StageAssetManifest>,
  order: readonly JourneyStageId[],
  rootPrefix: string,
  options: StageModelLoadOptions,
): Promise<Round3ModelMap> {
  options.signal?.throwIfAborted();
  const { gltfLoader, dracoLoader } = createConfiguredGltfLoader();
  const loadedRoots: Group[] = [];

  try {
    const results = await Promise.allSettled(
      order.map(async (stage) => {
        options.signal?.throwIfAborted();
        const asset = assets[stage];
        const modelBytes = await loadModelBytes(asset.modelUrl);
        options.signal?.throwIfAborted();
        const resourcePath = asset.modelUrl.slice(
          0,
          Math.max(0, asset.modelUrl.lastIndexOf("/") + 1),
        );
        const gltf = await gltfLoader.parseAsync(modelBytes, resourcePath);
        const root = gltf.scene;
        loadedRoots.push(root);
        options.signal?.throwIfAborted();
        configureStageRoot(root, asset, `${rootPrefix}_${stage}`);
        return [
          stage,
          {
            root,
            animations: gltf.animations,
            expectedClipName: asset.expectedClipName,
          },
        ] as const;
      }),
    );

    options.signal?.throwIfAborted();
    const rejected = results.find((result) => result.status === "rejected");
    if (rejected) throw rejected.reason;
    return Object.fromEntries(
      results.map((result) => {
        if (result.status === "rejected") throw result.reason;
        return result.value;
      }),
    ) as Round3ModelMap;
  } catch (error) {
    for (const root of loadedRoots) disposeObject(root);
    throw error;
  } finally {
    dracoLoader.dispose();
  }
}

function configureStageRoot(
  root: Group,
  asset: StageAssetManifest,
  name: string,
): void {
  root.name = name;
  root.position.set(...asset.rootPosition);
  root.scale.setScalar(asset.rootScale);
  root.updateMatrixWorld(true);
}

const round4Parser = createConfiguredGltfLoader();
const round4AssetCache = createGltfAssetCache<JourneyStageId>(async (stage) => {
  const asset = ROUND4_STAGE_ASSETS[stage];
  const modelBytes = await loadModelBytes(asset.modelUrl);
  const resourcePath = asset.modelUrl.slice(
    0,
    Math.max(0, asset.modelUrl.lastIndexOf("/") + 1),
  );
  const gltf = await round4Parser.gltfLoader.parseAsync(modelBytes, resourcePath);
  return {
    root: gltf.scene,
    animations: gltf.animations,
    expectedClipName: asset.expectedClipName,
  };
});

function modelFromInstance(
  instance: InstantiatedStageAsset,
  release: () => void,
): LoadedStageModel {
  return { ...instance, release };
}

export async function acquireRound4StageAsset(
  stage: JourneyStageId,
  rootPrefix: string,
  options: StageModelLoadOptions = {},
): Promise<LoadedStageModel> {
  options.signal?.throwIfAborted();
  const lease = await round4AssetCache.acquire(stage);
  try {
    options.signal?.throwIfAborted();
    const instance = lease.instantiate(`${rootPrefix}_${stage}`);
    configureStageRoot(instance.root, ROUND4_STAGE_ASSETS[stage], instance.root.name);
    options.signal?.throwIfAborted();
    return modelFromInstance(instance, lease.release);
  } catch (error) {
    lease.release();
    throw error;
  }
}

export function getStageRoots(models: Round3ModelMap): Round2ModelMap {
  return Object.fromEntries(
    ROUND3_STAGE_ORDER.map((stage) => [stage, models[stage].root]),
  ) as Round2ModelMap;
}

export function loadRound3Models(
  options: StageModelLoadOptions = {},
): Promise<Round3ModelMap> {
  return loadLegacyStageModels(
    ROUND3_STAGE_ASSETS,
    ROUND3_STAGE_ORDER,
    "Round3",
    options,
  );
}

export async function loadRound4Models(
  options: StageModelLoadOptions = {},
): Promise<Round4ModelMap> {
  const results = await Promise.allSettled(
    ROUND4_STAGE_ORDER.map(async (stage) => [
      stage,
      await acquireRound4StageAsset(stage, "Round4", options),
    ] as const),
  );
  const rejected = results.find((result) => result.status === "rejected");
  if (rejected) {
    for (const result of results) {
      if (result.status === "fulfilled") result.value[1].release?.();
    }
    throw rejected.reason;
  }
  return Object.fromEntries(
    results.map((result) => {
      if (result.status === "rejected") throw result.reason;
      return result.value;
    }),
  ) as Round4ModelMap;
}

export function loadRound4StageModel(
  stage: JourneyStageId,
  options: StageModelLoadOptions = {},
): Promise<LoadedStageModel> {
  return acquireRound4StageAsset(stage, "Round4Hero", options);
}

// Kept for asset inspection and Round 2 regression tooling.
export async function loadRound2Models(
  options: Round2ModelLoadOptions = {},
): Promise<Round2ModelMap> {
  const models = await loadLegacyStageModels(
    ROUND2_STAGE_ASSETS,
    ROUND2_STAGE_ORDER,
    "Round2",
    options,
  );
  return getStageRoots(models);
}
