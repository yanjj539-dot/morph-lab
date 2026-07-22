import { Group } from "three";

import type { JourneyStageId } from "../../data/journey.ts";
import { STAGE_ORDER } from "./stageResidency.ts";
import { sampleStageSwitch } from "./stageSwitchPolicy.ts";

export type StageTimelineController = {
  update(progress: number, elapsedSeconds?: number): void;
  addStage(stage: JourneyStageId, root: Group): void;
  removeStage(stage: JourneyStageId): void;
  reset(): void;
};

// These nodes are animated by the exported Blender Actions in Round 3/4.
export const BLENDER_AUTHORED_STAGE_CONTROLS = [
  "OBS_scan_beam",
  "OBS_papers",
  "OBS_output_card",
  "OBS_crop_frame",
  "STR_connectors",
  "STR_panels",
  "STR_tokens",
  "PRO_light_ring",
  "PRO_cursor",
  "REL_qa_rows",
  "REL_package_lid",
] as const;

export function createStageTimelines(
  initialRoots: Partial<Record<JourneyStageId, Group>> = {},
): StageTimelineController {
  const roots = new Map<JourneyStageId, Group>();
  const initialVisibility = new Map<JourneyStageId, boolean>();
  let progress = 0;

  function applyVisibility(): void {
    const current = sampleStageSwitch(progress).current;
    for (const [stage, root] of roots) root.visible = stage === current;
  }

  function addStage(stage: JourneyStageId, root: Group): void {
    roots.set(stage, root);
    if (!initialVisibility.has(stage)) initialVisibility.set(stage, root.visible);
    applyVisibility();
  }

  for (const stage of STAGE_ORDER) {
    const root = initialRoots[stage];
    if (root) addStage(stage, root);
  }

  return {
    update(nextProgress) {
      progress = Math.max(0, Math.min(1, nextProgress));
      applyVisibility();
    },
    addStage,
    removeStage(stage) {
      roots.delete(stage);
    },
    reset() {
      for (const [stage, root] of roots) {
        root.visible = initialVisibility.get(stage) ?? true;
      }
    },
  };
}
