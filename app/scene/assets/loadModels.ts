import { Group, Material, Mesh, Object3D, Texture } from "three";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

import { type JourneyStageId } from "../../data/journey";
import {
  DRACO_DECODER_PATH,
  ROUND2_STAGE_ASSETS,
  ROUND2_STAGE_ORDER,
} from "./assetManifest";

export type Round2ModelMap = Record<JourneyStageId, Group>;

export type Round2ModelLoadOptions = {
  signal?: AbortSignal;
};

function disposeMaterial(material: Material): void {
  for (const value of Object.values(material)) {
    if (value instanceof Texture) {
      value.dispose();
    }
  }
  material.dispose();
}

function disposeObject(object: Object3D): void {
  object.traverse((node) => {
    if (!(node instanceof Mesh)) return;

    node.geometry.dispose();
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of materials) {
      disposeMaterial(material);
    }
  });
}

export async function loadRound2Models(
  options: Round2ModelLoadOptions = {},
): Promise<Round2ModelMap> {
  options.signal?.throwIfAborted();
  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath(DRACO_DECODER_PATH);
  dracoLoader.setDecoderConfig({ type: "wasm" });

  const gltfLoader = new GLTFLoader();
  gltfLoader.setDRACOLoader(dracoLoader);

  const loadedGroups: Group[] = [];

  try {
    const results = await Promise.allSettled(
      ROUND2_STAGE_ORDER.map(async (stage) => {
        options.signal?.throwIfAborted();
        const asset = ROUND2_STAGE_ASSETS[stage];
        const gltf = await gltfLoader.loadAsync(asset.modelUrl);
        const root = gltf.scene;
        loadedGroups.push(root);
        options.signal?.throwIfAborted();

        root.name = `Round2_${stage}`;
        root.position.set(...asset.rootPosition);
        root.scale.setScalar(asset.rootScale);
        root.updateMatrixWorld(true);
        return [stage, root] as const;
      }),
    );

    options.signal?.throwIfAborted();
    const rejected = results.find((result) => result.status === "rejected");
    if (rejected) {
      throw rejected.reason;
    }

    const entries = results.map((result) => {
      if (result.status === "rejected") {
        throw result.reason;
      }
      return result.value;
    });

    return Object.fromEntries(entries) as Round2ModelMap;
  } catch (error) {
    for (const group of loadedGroups) {
      disposeObject(group);
    }
    throw error;
  } finally {
    dracoLoader.dispose();
  }
}
