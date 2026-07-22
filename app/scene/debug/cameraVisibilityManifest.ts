import type { JourneyStageId } from "../../data/journey";

export type CameraVisibilityStageManifest<StageId extends string = string> = {
  id: StageId;
  progressRange: readonly [start: number, end: number];
  focusMeshNames: readonly string[];
  allowedForegroundMeshNames: readonly string[];
  ignoredMeshNames?: readonly string[];
};

export const ROUND4_CAMERA_VISIBILITY_MANIFEST = [
  {
    id: "observe",
    progressRange: [0, 0.25],
    focusMeshNames: ["OBS_scanner_body", "OBS_output_assembly"],
    allowedForegroundMeshNames: [
      "OBS_papers",
      "OBS_folder",
      "MORPH_CONTINUOUS_ROUTE",
    ],
  },
  {
    id: "structure",
    progressRange: [0.25, 0.5],
    focusMeshNames: ["STR_grid_board"],
    allowedForegroundMeshNames: [
      "OBS_papers",
      "OBS_output_assembly",
      "STR_panels",
      "STR_type_ruler",
      "STR_booklet",
      "STR_mount_rail_0",
      "STR_mount_rail_1",
      "STR_mount_rail_2",
      "STR_mount_rail_3",
      "STR_mount_rail_4",
      "MORPH_CONTINUOUS_ROUTE",
    ],
  },
  {
    id: "prototype",
    progressRange: [0.5, 0.75],
    focusMeshNames: ["SCREEN_prototype_monitor"],
    allowedForegroundMeshNames: [
      "STR_type_ruler",
      "PRO_phone_frame",
      "PRO_tablet_frame",
      "MORPH_CONTINUOUS_ROUTE",
    ],
  },
  {
    id: "release",
    progressRange: [0.75, 1],
    focusMeshNames: ["REL_qa_rows", "SCREEN_release_monitor"],
    allowedForegroundMeshNames: [
      "PRO_phone_frame",
      "PRO_tablet_frame",
      "REL_cable_channel",
      "MORPH_CONTINUOUS_ROUTE",
    ],
  },
] as const satisfies readonly CameraVisibilityStageManifest<JourneyStageId>[];

export function getCameraVisibilityStage<StageId extends string>(
  manifest: readonly CameraVisibilityStageManifest<StageId>[],
  progress: number,
): CameraVisibilityStageManifest<StageId> {
  if (manifest.length === 0) {
    throw new Error("Camera visibility manifest must contain at least one stage.");
  }

  const finiteProgress = Number.isFinite(progress) ? progress : 0;
  for (let index = manifest.length - 1; index >= 0; index -= 1) {
    const stage = manifest[index];
    if (finiteProgress >= stage.progressRange[0]) return stage;
  }
  return manifest[0];
}
