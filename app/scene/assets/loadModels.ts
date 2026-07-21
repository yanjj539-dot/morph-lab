import {
  AnimationClip,
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

export type LoadedStageModel = {
  root: Group;
  animations: AnimationClip[];
  expectedClipName?: string;
};

export type Round2ModelMap = Record<JourneyStageId, Group>;
export type Round3ModelMap = Record<JourneyStageId, LoadedStageModel>;
export type Round4ModelMap = Record<JourneyStageId, LoadedStageModel>;

export type StageModelLoadOptions = {
  signal?: AbortSignal;
};

export type Round2ModelLoadOptions = StageModelLoadOptions;

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
    const nodeMaterials = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of nodeMaterials) materials.add(material);
  });

  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) disposeMaterial(material);
}

export function disposeLoadedStageModels(models: Round3ModelMap): void {
  for (const model of Object.values(models)) disposeObject(model.root);
}

async function loadStageModels(
  assets: Record<JourneyStageId, StageAssetManifest>,
  order: readonly JourneyStageId[],
  rootPrefix: string,
  options: StageModelLoadOptions,
): Promise<Round3ModelMap> {
  options.signal?.throwIfAborted();

  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath(DRACO_DECODER_PATH);
  dracoLoader.setDecoderConfig({ type: "wasm" });

  const gltfLoader = new GLTFLoader();
  gltfLoader.setDRACOLoader(dracoLoader);
  const loadedRoots: Group[] = [];

  try {
    const results = await Promise.allSettled(
      order.map(async (stage) => {
        options.signal?.throwIfAborted();
        const asset = assets[stage];
        const gltf = await gltfLoader.loadAsync(asset.modelUrl);
        const root = gltf.scene;
        loadedRoots.push(root);
        options.signal?.throwIfAborted();

        root.name = `${rootPrefix}_${stage}`;
        root.position.set(...asset.rootPosition);
        root.scale.setScalar(asset.rootScale);
        root.updateMatrixWorld(true);

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

export function getStageRoots(models: Round3ModelMap): Round2ModelMap {
  return Object.fromEntries(
    ROUND3_STAGE_ORDER.map((stage) => [stage, models[stage].root]),
  ) as Round2ModelMap;
}

export function loadRound3Models(
  options: StageModelLoadOptions = {},
): Promise<Round3ModelMap> {
  return loadStageModels(
    ROUND3_STAGE_ASSETS,
    ROUND3_STAGE_ORDER,
    "Round3",
    options,
  );
}

export function loadRound4Models(
  options: StageModelLoadOptions = {},
): Promise<Round4ModelMap> {
  return loadStageModels(
    ROUND4_STAGE_ASSETS,
    ROUND4_STAGE_ORDER,
    "Round4",
    options,
  );
}

// Kept for asset inspection and Round 2 regression tooling.
export async function loadRound2Models(
  options: Round2ModelLoadOptions = {},
): Promise<Round2ModelMap> {
  const models = await loadStageModels(
    ROUND2_STAGE_ASSETS,
    ROUND2_STAGE_ORDER,
    "Round2",
    options,
  );
  return getStageRoots(models);
}
