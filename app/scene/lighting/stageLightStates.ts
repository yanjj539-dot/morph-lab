import { Color } from "three";

import { JOURNEY_STAGE_PROGRESS, type JourneyStageId } from "../../data/journey";
import { clamp01, lerp, smoothstep } from "../animation/progressMath";

export type StageLightState = {
  ambient: number;
  hemisphere: number;
  key: number;
  fill: number;
  rim: number;
  accent: number;
  accentColor: Color;
  stageCenterX: number;
};

const STAGE_IDS: readonly JourneyStageId[] = [
  "observe",
  "structure",
  "prototype",
  "release",
];

const STAGE_LIGHT_STATES: Record<JourneyStageId, StageLightState> = {
  observe: {
    ambient: 0.22,
    hemisphere: 0.52,
    key: 2.25,
    fill: 1.05,
    rim: 0.92,
    accent: 0.34,
    accentColor: new Color("#ff8b73"),
    stageCenterX: -6,
  },
  structure: {
    ambient: 0.2,
    hemisphere: 0.48,
    key: 2.05,
    fill: 1.32,
    rim: 1.18,
    accent: 0.42,
    accentColor: new Color("#7196ff"),
    stageCenterX: -2,
  },
  prototype: {
    ambient: 0.16,
    hemisphere: 0.42,
    key: 1.86,
    fill: 1.08,
    rim: 1.5,
    accent: 0.72,
    accentColor: new Color("#ff7259"),
    stageCenterX: 2,
  },
  release: {
    ambient: 0.24,
    hemisphere: 0.56,
    key: 2.36,
    fill: 1.42,
    rim: 1.12,
    accent: 0.5,
    accentColor: new Color("#527eff"),
    stageCenterX: 6,
  },
};

function stagePair(progress: number): {
  from: StageLightState;
  to: StageLightState;
  progress: number;
} {
  const t = clamp01(progress);
  let index = 0;
  while (
    index < JOURNEY_STAGE_PROGRESS.length - 2 &&
    t > JOURNEY_STAGE_PROGRESS[index + 1]
  ) {
    index += 1;
  }

  const fromT = JOURNEY_STAGE_PROGRESS[index];
  const toT = JOURNEY_STAGE_PROGRESS[index + 1];
  return {
    from: STAGE_LIGHT_STATES[STAGE_IDS[index]],
    to: STAGE_LIGHT_STATES[STAGE_IDS[index + 1]],
    progress: smoothstep((t - fromT) / Math.max(Number.EPSILON, toT - fromT)),
  };
}

export function createStageLightSample(): StageLightState {
  const initial = STAGE_LIGHT_STATES.observe;
  return {
    ...initial,
    accentColor: initial.accentColor.clone(),
  };
}

export function sampleStageLightState(
  progress: number,
  output: StageLightState,
): StageLightState {
  const pair = stagePair(progress);
  const amount = pair.progress;
  output.ambient = lerp(pair.from.ambient, pair.to.ambient, amount);
  output.hemisphere = lerp(pair.from.hemisphere, pair.to.hemisphere, amount);
  output.key = lerp(pair.from.key, pair.to.key, amount);
  output.fill = lerp(pair.from.fill, pair.to.fill, amount);
  output.rim = lerp(pair.from.rim, pair.to.rim, amount);
  output.accent = lerp(pair.from.accent, pair.to.accent, amount);
  output.stageCenterX = lerp(pair.from.stageCenterX, pair.to.stageCenterX, amount);
  output.accentColor.copy(pair.from.accentColor).lerp(pair.to.accentColor, amount);
  return output;
}
