import {
  AnimationAction,
  AnimationClip,
  AnimationMixer,
  LoopOnce,
} from "three";

import { type JourneyStageId } from "../../data/journey";
import { ROUND3_STAGE_ORDER } from "../assets/assetManifest";
import { type Round3ModelMap } from "../assets/loadModels";
import { clamp01 } from "./progressMath";

type StageClipWindow = {
  start: number;
  end: number;
};

type StageClipState = {
  stage: JourneyStageId;
  mixer: AnimationMixer;
  actions: readonly { action: AnimationAction; clip: AnimationClip }[];
  window: StageClipWindow;
};

export type BlenderClipController = {
  update(globalProgress: number): void;
  reset(): void;
  dispose(): void;
  readonly clipNames: readonly string[];
};

export const STAGE_CLIP_WINDOWS: Record<JourneyStageId, StageClipWindow> = {
  observe: { start: 0, end: 0.27 },
  structure: { start: 0.2, end: 0.53 },
  prototype: { start: 0.45, end: 0.8 },
  release: { start: 0.72, end: 1 },
};

function selectStageClip(
  stage: JourneyStageId,
  clips: readonly AnimationClip[],
  expectedClipName?: string,
): AnimationClip {
  const expected = expectedClipName
    ? clips.find((clip) => clip.name === expectedClipName)
    : undefined;
  const semantic = clips.find((clip) =>
    clip.name.toUpperCase().includes(`${stage.toUpperCase()}_ACTION`),
  );
  const selected = expected ?? semantic ?? clips[0];

  if (!selected) {
    throw new Error(`Round 3 ${stage} GLB does not contain an animation clip.`);
  }
  if (!(selected.duration > 0)) {
    throw new Error(`Round 3 ${stage} clip "${selected.name}" has no duration.`);
  }

  return selected;
}

function localProgressForWindow(
  progress: number,
  window: StageClipWindow,
): number {
  return clamp01((progress - window.start) / (window.end - window.start));
}

export function createBlenderClipController(
  models: Round3ModelMap,
): BlenderClipController {
  const states: StageClipState[] = ROUND3_STAGE_ORDER.map((stage) => {
    const model = models[stage];
    selectStageClip(stage, model.animations, model.expectedClipName);
    const mixer = new AnimationMixer(model.root);
    const actions = model.animations
      .filter((clip) => clip.duration > 0)
      .map((clip) => {
        const action = mixer.clipAction(clip);
        action.setLoop(LoopOnce, 1);
        action.clampWhenFinished = true;
        action.play();
        action.paused = true;
        action.time = 0;
        return { action, clip };
      });
    mixer.update(0);

    return {
      stage,
      mixer,
      actions,
      window: STAGE_CLIP_WINDOWS[stage],
    };
  });

  let disposed = false;

  function update(globalProgress: number): void {
    if (disposed) return;
    const progress = clamp01(globalProgress);

    for (const state of states) {
      const localProgress = localProgressForWindow(progress, state.window);
      for (const { action, clip } of state.actions) {
        action.time = localProgress * clip.duration;
      }
      state.mixer.update(0);
    }
  }

  function reset(): void {
    if (disposed) return;
    for (const state of states) {
      for (const { action } of state.actions) action.time = 0;
      state.mixer.update(0);
    }
  }

  return {
    update,
    reset,
    dispose() {
      if (disposed) return;
      reset();
      disposed = true;
      for (const state of states) {
        for (const { action, clip } of state.actions) {
          action.stop();
          state.mixer.uncacheClip(clip);
        }
        state.mixer.stopAllAction();
        state.mixer.uncacheRoot(models[state.stage].root);
      }
    },
    clipNames: states.flatMap((state) =>
      state.actions.map(({ clip }) => clip.name),
    ),
  };
}
