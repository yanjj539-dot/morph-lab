import type { JourneyStageId } from "../../data/journey.ts";

export const STAGE_ORDER: readonly JourneyStageId[] = [
  "observe",
  "structure",
  "prototype",
  "release",
];

export const STAGE_OCCLUSION_SWITCH_POINTS = [0.285, 0.535, 0.765] as const;

export type StageReadiness = Record<JourneyStageId, boolean>;

export type StageResidency = {
  desired: JourneyStageId;
  current: JourneyStageId;
  next?: JourneyStageId;
  attached: JourneyStageId[];
};

export function desiredStageForProgress(progress: number): JourneyStageId {
  const clamped = Math.max(0, Math.min(1, progress));
  if (clamped < STAGE_OCCLUSION_SWITCH_POINTS[0]) return "observe";
  if (clamped < STAGE_OCCLUSION_SWITCH_POINTS[1]) return "structure";
  if (clamped < STAGE_OCCLUSION_SWITCH_POINTS[2]) return "prototype";
  return "release";
}

export function residentStages(
  progress: number,
  readiness: StageReadiness,
): StageResidency {
  const desired = desiredStageForProgress(progress);
  const desiredIndex = STAGE_ORDER.indexOf(desired);
  let currentIndex = desiredIndex;
  while (currentIndex > 0 && !readiness[STAGE_ORDER[currentIndex]]) {
    currentIndex -= 1;
  }
  const current = STAGE_ORDER[currentIndex];
  const nextCandidate = STAGE_ORDER[currentIndex + 1];
  const next = nextCandidate && readiness[nextCandidate]
    ? nextCandidate
    : undefined;
  return {
    desired,
    current,
    next,
    attached: next ? [current, next] : [current],
  };
}
