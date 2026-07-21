import { JOURNEY_STAGE_PROGRESS, type JourneyStageId } from "../../data/journey";
import { clamp01, lerp, smoothstep } from "../animation/progressMath";

export type StageLightState = {
  ambient: number;
  hemisphere: number;
  key: number;
  fill: number;
  rim: number;
  screenLocal: number;
  stageCenterX: number;
};

type StageLightDefinition = Readonly<StageLightState>;

const STAGE_IDS: readonly JourneyStageId[] = [
  "observe",
  "structure",
  "prototype",
  "release",
];

export const ROUND4_STAGE_LIGHT_STATES: Readonly<
  Record<JourneyStageId, StageLightDefinition>
> = Object.freeze({
  observe: Object.freeze({
    ambient: 0.25,
    hemisphere: 0.5,
    key: 1.64,
    fill: 0.42,
    rim: 0.32,
    screenLocal: 0.12,
    stageCenterX: -6,
  }),
  structure: Object.freeze({
    ambient: 0.23,
    hemisphere: 0.48,
    key: 1.56,
    fill: 0.46,
    rim: 0.38,
    screenLocal: 0.14,
    stageCenterX: -2,
  }),
  prototype: Object.freeze({
    ambient: 0.21,
    hemisphere: 0.45,
    key: 1.5,
    fill: 0.44,
    rim: 0.46,
    screenLocal: 0.18,
    stageCenterX: 2,
  }),
  release: Object.freeze({
    ambient: 0.25,
    hemisphere: 0.52,
    key: 1.7,
    fill: 0.48,
    rim: 0.36,
    screenLocal: 0.15,
    stageCenterX: 6,
  }),
});

function stagePair(progress: number): {
  from: StageLightDefinition;
  to: StageLightDefinition;
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
    from: ROUND4_STAGE_LIGHT_STATES[STAGE_IDS[index]],
    to: ROUND4_STAGE_LIGHT_STATES[STAGE_IDS[index + 1]],
    progress: smoothstep((t - fromT) / Math.max(Number.EPSILON, toT - fromT)),
  };
}

export function createStageLightSample(): StageLightState {
  return { ...ROUND4_STAGE_LIGHT_STATES.observe };
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
  output.screenLocal = lerp(pair.from.screenLocal, pair.to.screenLocal, amount);
  output.stageCenterX = lerp(pair.from.stageCenterX, pair.to.stageCenterX, amount);
  return output;
}
