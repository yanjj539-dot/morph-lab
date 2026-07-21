import { CatmullRomCurve3, PerspectiveCamera, Vector3 } from "three";

import { clamp01, lerp, smoothstep } from "./progressMath";

export type CameraKeyframe = {
  t: number;
  shot: string;
  position: readonly [number, number, number];
  target: readonly [number, number, number];
  fov: number;
  yaw: number;
  pitch: number;
};

export type CameraTimelineSample = {
  position: Vector3;
  target: Vector3;
  fov: number;
  yaw: number;
  pitch: number;
};

export const CAMERA_KEYFRAMES: readonly CameraKeyframe[] = [
  {
    t: 0,
    shot: "Observe wide",
    position: [-7.35, 4.25, 7.6],
    target: [-6, 0.45, -1.55],
    fov: 36,
    yaw: -0.03,
    pitch: -0.04,
  },
  {
    t: 0.2,
    shot: "Observe push",
    position: [-6.35, 3.55, 6.2],
    target: [-5.7, 0.38, -1.55],
    fov: 33,
    yaw: 0.02,
    pitch: -0.02,
  },
  {
    t: 0.29,
    shot: "Paper occlusion",
    position: [-4.65, 3.1, 5.55],
    target: [-3.95, 0.72, -1.75],
    fov: 34,
    yaw: 0.06,
    pitch: 0,
  },
  {
    t: 0.45,
    shot: "Structure board",
    position: [-2.35, 2.65, 5.15],
    target: [-2.05, 1.05, -2],
    fov: 31,
    yaw: -0.02,
    pitch: 0.03,
  },
  {
    t: 0.54,
    shot: "Rail handoff",
    position: [-0.2, 2.45, 4.75],
    target: [0.25, 0.72, -1.7],
    fov: 32,
    yaw: 0.05,
    pitch: 0.01,
  },
  {
    t: 0.68,
    shot: "Prototype close",
    position: [2, 2.12, 4.1],
    target: [2.25, 0.82, -1.72],
    fov: 29,
    yaw: -0.04,
    pitch: 0.04,
  },
  {
    t: 0.77,
    shot: "Cable handoff",
    position: [3.75, 2.48, 4.8],
    target: [4.15, 0.58, -1.45],
    fov: 32,
    yaw: 0.04,
    pitch: 0,
  },
  {
    t: 0.93,
    shot: "Release wide",
    position: [6.05, 3.35, 6.35],
    target: [6.1, 0.65, -1.52],
    fov: 37,
    yaw: -0.02,
    pitch: -0.02,
  },
  {
    t: 1,
    shot: "Final lock",
    position: [6.35, 3.55, 6.75],
    target: [6.3, 0.62, -1.45],
    fov: 38,
    yaw: 0,
    pitch: 0,
  },
] as const;

export type CameraTimeline = {
  sample: (progress: number, output: CameraTimelineSample) => CameraTimelineSample;
  applyToCamera: (
    progress: number,
    camera: PerspectiveCamera,
    output: CameraTimelineSample,
  ) => CameraTimelineSample;
};

function makeVector(tuple: readonly [number, number, number]): Vector3 {
  return new Vector3(tuple[0], tuple[1], tuple[2]);
}

function findSegment(progress: number): number {
  let index = 0;

  while (
    index < CAMERA_KEYFRAMES.length - 2 &&
    progress > CAMERA_KEYFRAMES[index + 1].t
  ) {
    index += 1;
  }

  return index;
}

export function createCameraTimeline(): CameraTimeline {
  const positionCurve = new CatmullRomCurve3(
    CAMERA_KEYFRAMES.map((keyframe) => makeVector(keyframe.position)),
    false,
    "catmullrom",
    0.34,
  );
  const targetCurve = new CatmullRomCurve3(
    CAMERA_KEYFRAMES.map((keyframe) => makeVector(keyframe.target)),
    false,
    "catmullrom",
    0.34,
  );

  return {
    sample(progress, output) {
      const t = clamp01(progress);
      const index = findSegment(t);
      const from = CAMERA_KEYFRAMES[index];
      const to = CAMERA_KEYFRAMES[index + 1];
      const localProgress = (t - from.t) / (to.t - from.t);
      const eased = smoothstep(localProgress);
      const curveProgress = (index + eased) / (CAMERA_KEYFRAMES.length - 1);

      positionCurve.getPoint(curveProgress, output.position);
      targetCurve.getPoint(curveProgress, output.target);

      output.fov = lerp(from.fov, to.fov, eased);
      output.yaw = lerp(from.yaw, to.yaw, eased);
      output.pitch = lerp(from.pitch, to.pitch, eased);

      return output;
    },

    applyToCamera(progress, camera, output) {
      this.sample(progress, output);
      camera.position.copy(output.position);
      camera.fov = output.fov;
      camera.lookAt(output.target);
      camera.updateProjectionMatrix();
      return output;
    },
  };
}

export function createCameraTimelineSample(): CameraTimelineSample {
  return {
    position: new Vector3(),
    target: new Vector3(),
    fov: CAMERA_KEYFRAMES[0].fov,
    yaw: CAMERA_KEYFRAMES[0].yaw,
    pitch: CAMERA_KEYFRAMES[0].pitch,
  };
}
