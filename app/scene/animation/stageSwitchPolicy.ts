import type { JourneyStageId } from "../../data/journey.ts";
import {
  desiredStageForProgress,
  STAGE_OCCLUSION_SWITCH_POINTS,
  STAGE_ORDER,
} from "./stageResidency.ts";

export const STAGE_SWITCH_POINTS = STAGE_OCCLUSION_SWITCH_POINTS;

export type StageSwitchSample = {
  current: JourneyStageId;
  currentIndex: number;
  previous?: JourneyStageId;
  next?: JourneyStageId;
  switchPoint?: number;
};

export function sampleStageSwitch(progress: number): StageSwitchSample {
  const current = desiredStageForProgress(progress);
  const currentIndex = STAGE_ORDER.indexOf(current);
  return {
    current,
    currentIndex,
    previous: STAGE_ORDER[currentIndex - 1],
    next: STAGE_ORDER[currentIndex + 1],
    switchPoint:
      currentIndex > 0 ? STAGE_SWITCH_POINTS[currentIndex - 1] : undefined,
  };
}
