import { type Vector3Tuple } from "three";

import { type JourneyStageId } from "../../data/journey";
import { withBasePath } from "../../lib/paths";

export type StageAssetManifest = {
  id: JourneyStageId;
  modelUrl: string;
  rootPosition: Vector3Tuple;
  rootScale: number;
  expectedClipName?: string;
};

export type TextureBinding = {
  stage: JourneyStageId;
  meshName: string;
  textureUrl: string;
};

export const DRACO_DECODER_PATH = withBasePath("/draco/gltf/");

export const ROUND3_STAGE_ORDER: readonly JourneyStageId[] = [
  "observe",
  "structure",
  "prototype",
  "release",
] as const;

export const ROUND3_STAGE_ASSETS: Record<JourneyStageId, StageAssetManifest> = {
  observe: {
    id: "observe",
    modelUrl: withBasePath("/models/round-3/observe.glb"),
    rootPosition: [-6, 0.08, -1.7],
    rootScale: 0.62,
    expectedClipName: "ML_OBSERVE_ACTION",
  },
  structure: {
    id: "structure",
    modelUrl: withBasePath("/models/round-3/structure.glb"),
    rootPosition: [-2, 0.08, -1.7],
    rootScale: 0.62,
    expectedClipName: "ML_STRUCTURE_ACTION",
  },
  prototype: {
    id: "prototype",
    modelUrl: withBasePath("/models/round-3/prototype.glb"),
    rootPosition: [2, 0.08, -1.7],
    rootScale: 0.62,
    expectedClipName: "ML_PROTOTYPE_ACTION",
  },
  release: {
    id: "release",
    modelUrl: withBasePath("/models/round-3/release.glb"),
    rootPosition: [6, 0.08, -1.7],
    rootScale: 0.62,
    expectedClipName: "ML_RELEASE_ACTION",
  },
};

export const ROUND2_STAGE_ASSETS: Record<JourneyStageId, StageAssetManifest> = {
  observe: {
    id: "observe",
    modelUrl: withBasePath("/models/round-2/observe.glb"),
    rootPosition: [-6, 0.5, -1.7],
    rootScale: 0.62,
  },
  structure: {
    id: "structure",
    modelUrl: withBasePath("/models/round-2/structure.glb"),
    rootPosition: [-2, 0.5, -1.7],
    rootScale: 0.62,
  },
  prototype: {
    id: "prototype",
    modelUrl: withBasePath("/models/round-2/prototype.glb"),
    rootPosition: [2, 0.5, -1.7],
    rootScale: 0.62,
  },
  release: {
    id: "release",
    modelUrl: withBasePath("/models/round-2/release.glb"),
    rootPosition: [6, 0.5, -1.7],
    rootScale: 0.62,
  },
};

export const ROUND2_STAGE_ORDER: readonly JourneyStageId[] = [
  "observe",
  "structure",
  "prototype",
  "release",
] as const;

export const ROUND2_TEXTURE_BINDINGS: readonly TextureBinding[] = [
  {
    stage: "observe",
    meshName: "SCREEN_observe_inspection",
    textureUrl: withBasePath("/images/persona-result.webp"),
  },
  {
    stage: "observe",
    meshName: "PRINT_observe_persona",
    textureUrl: withBasePath("/images/persona-home.webp"),
  },
  {
    stage: "observe",
    meshName: "PRINT_observe_output",
    textureUrl: withBasePath("/images/persona-result.webp"),
  },
  {
    stage: "structure",
    meshName: "SCREEN_structure_system",
    textureUrl: withBasePath("/images/persona-result.webp"),
  },
  {
    stage: "prototype",
    meshName: "SCREEN_prototype_monitor",
    textureUrl: withBasePath("/images/web-aeroform.webp"),
  },
  {
    stage: "prototype",
    meshName: "SCREEN_prototype_phone",
    textureUrl: withBasePath("/images/persona-home.webp"),
  },
  {
    stage: "prototype",
    meshName: "SCREEN_prototype_tablet",
    textureUrl: withBasePath("/images/web-field-notes.webp"),
  },
  {
    stage: "release",
    meshName: "SCREEN_release_monitor",
    textureUrl: withBasePath("/images/web-units.webp"),
  },
  {
    stage: "release",
    meshName: "SCREEN_release_laptop",
    textureUrl: withBasePath("/images/web-smoke-fruit.webp"),
  },
  {
    stage: "release",
    meshName: "SCREEN_release_phone",
    textureUrl: withBasePath("/images/persona-result.webp"),
  },
  {
    stage: "release",
    meshName: "PRINT_release_device",
    textureUrl: withBasePath("/images/device-tree-hole.webp"),
  },
  {
    stage: "release",
    meshName: "REL_project_image_0",
    textureUrl: withBasePath("/images/web-aeroform.webp"),
  },
  {
    stage: "release",
    meshName: "REL_project_image_1",
    textureUrl: withBasePath("/images/persona-home.webp"),
  },
  {
    stage: "release",
    meshName: "REL_project_image_2",
    textureUrl: withBasePath("/images/web-field-notes.webp"),
  },
] as const;

export const ROUND3_TEXTURE_BINDINGS: readonly TextureBinding[] = [
  ...ROUND2_TEXTURE_BINDINGS,
] as const;
