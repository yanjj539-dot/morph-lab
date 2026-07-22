import { CatmullRomCurve3, Vector3 } from "three";

import { clamp01, lerp, smoothstep } from "./progressMath";

export type CameraKeyframe = {
  t: number;
  shot: string;
  position: readonly [number, number, number];
  target: readonly [number, number, number];
  fov: number;
  yaw: number;
  pitch: number;
  dollyDistance: number;
  roll: number;
};

export type CameraTimelineSample = {
  position: Vector3;
  target: Vector3;
  fov: number;
  yaw: number;
  pitch: number;
  dollyDistance: number;
  roll: number;
};

type TimedCurveSegment = {
  from: CameraKeyframe;
  to: CameraKeyframe;
  positionCurve: CatmullRomCurve3;
  targetCurve: CatmullRomCurve3;
  positionArcLength: number;
  targetArcLength: number;
  easingName: CameraSegmentEasing;
  ease: (progress: number) => number;
};

export const MAX_CAMERA_ROLL = 0.026;

type CameraSegmentEasing =
  | "smoothstep"
  | "smootherstep"
  | "settle"
  | "hold";

const SEGMENT_EASINGS: readonly CameraSegmentEasing[] = [
  "smoothstep",
  "smootherstep",
  "settle",
  "smootherstep",
  "smoothstep",
  "settle",
  "smootherstep",
  "hold",
];

export const CAMERA_KEYFRAMES: readonly CameraKeyframe[] = [
  {
    t: 0,
    shot: "Observe wide",
    position: [-7.35, 4.25, 7.6],
    target: [-6, 0.45, -1.55],
    fov: 36,
    yaw: -0.03,
    pitch: -0.04,
    dollyDistance: 0.24,
    roll: 0,
  },
  {
    t: 0.2,
    shot: "Observe push",
    position: [-6.35, 3.55, 6.2],
    target: [-5.7, 0.38, -1.55],
    fov: 33,
    yaw: 0.02,
    pitch: -0.02,
    dollyDistance: -0.08,
    roll: 0.008,
  },
  {
    t: 0.29,
    shot: "Paper occlusion",
    position: [-4.65, 3.1, 5.55],
    target: [-3.95, 0.72, -1.75],
    fov: 34,
    yaw: 0.06,
    pitch: 0,
    dollyDistance: 0.08,
    roll: -0.012,
  },
  {
    t: 0.45,
    shot: "Structure board",
    position: [-2.35, 2.65, 5.15],
    target: [-2.05, 1.05, -2],
    fov: 31,
    yaw: -0.02,
    pitch: 0.03,
    dollyDistance: -0.12,
    roll: 0.008,
  },
  {
    t: 0.54,
    shot: "Rail handoff",
    position: [-0.2, 2.45, 4.75],
    target: [0.25, 0.72, -1.7],
    fov: 32,
    yaw: 0.05,
    pitch: 0.01,
    dollyDistance: 0.05,
    roll: -0.006,
  },
  {
    t: 0.68,
    shot: "Prototype close",
    position: [2, 2.12, 4.1],
    target: [2.25, 0.82, -1.72],
    fov: 29,
    yaw: -0.04,
    pitch: 0.04,
    dollyDistance: -0.3,
    roll: 0.018,
  },
  {
    t: 0.77,
    shot: "Cable handoff",
    position: [3.75, 2.48, 4.8],
    target: [4.15, 0.58, -1.45],
    fov: 32,
    yaw: 0.04,
    pitch: 0,
    dollyDistance: 0.1,
    roll: 0.006,
  },
  {
    t: 0.93,
    shot: "Release wide",
    position: [6.05, 3.35, 6.35],
    target: [6.1, 0.65, -1.52],
    fov: 37,
    yaw: -0.02,
    pitch: -0.02,
    dollyDistance: 0.28,
    roll: -0.008,
  },
  {
    t: 1,
    shot: "Final lock",
    position: [6.35, 3.55, 6.75],
    target: [6.3, 0.62, -1.45],
    fov: 38,
    yaw: 0,
    pitch: 0,
    dollyDistance: 0.34,
    roll: 0,
  },
] as const;

export type CameraTimeline = {
  sample: (progress: number, output: CameraTimelineSample) => CameraTimelineSample;
  readonly segmentArcLengths: readonly number[];
  readonly segmentEasings: readonly CameraSegmentEasing[];
};

function makeVector(tuple: readonly [number, number, number]): Vector3 {
  return new Vector3(tuple[0], tuple[1], tuple[2]);
}

function findSegment(
  segments: readonly TimedCurveSegment[],
  progress: number,
): TimedCurveSegment {
  let index = 0;
  while (index < segments.length - 1 && progress > segments[index].to.t) {
    index += 1;
  }
  return segments[index];
}

function smootherstep(progress: number): number {
  const t = clamp01(progress);
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function segmentEase(name: CameraSegmentEasing, progress: number): number {
  const t = clamp01(progress);
  switch (name) {
    case "smootherstep":
      return smootherstep(t);
    case "settle":
      return smoothstep(smootherstep(t));
    case "hold":
      return smootherstep(smoothstep(t));
    default:
      return smoothstep(t);
  }
}

function createTimedSegments(): TimedCurveSegment[] {
  const positions = CAMERA_KEYFRAMES.map((keyframe) => makeVector(keyframe.position));
  const targets = CAMERA_KEYFRAMES.map((keyframe) => makeVector(keyframe.target));
  const positionGuide = new CatmullRomCurve3(positions, false, "catmullrom", 0.34);
  const targetGuide = new CatmullRomCurve3(targets, false, "catmullrom", 0.34);
  const segmentCount = CAMERA_KEYFRAMES.length - 1;

  return CAMERA_KEYFRAMES.slice(0, -1).map((from, index) => {
    const to = CAMERA_KEYFRAMES[index + 1];
    const easingName = SEGMENT_EASINGS[index];
    const midpointT = (index + 0.5) / segmentCount;
    const positionCurve = new CatmullRomCurve3(
      [makeVector(from.position), positionGuide.getPoint(midpointT), makeVector(to.position)],
      false,
      "catmullrom",
      0.34,
    );
    const targetCurve = new CatmullRomCurve3(
      [makeVector(from.target), targetGuide.getPoint(midpointT), makeVector(to.target)],
      false,
      "catmullrom",
      0.34,
    );

    return {
      from,
      to,
      positionCurve,
      targetCurve,
      positionArcLength: positionCurve.getLength(),
      targetArcLength: targetCurve.getLength(),
      easingName,
      ease: (progress) => segmentEase(easingName, progress),
    };
  });
}

function sampleByArcLength(
  curve: CatmullRomCurve3,
  arcLength: number,
  progress: number,
  output: Vector3,
): void {
  const distance = arcLength * clamp01(progress);
  const curveT = curve.getUtoTmapping(progress, distance);
  curve.getPoint(curveT, output);
}

export function createCameraTimeline(): CameraTimeline {
  const segments = createTimedSegments();

  return {
    sample(progress, output) {
      const t = clamp01(progress);
      const segment = findSegment(segments, t);
      const duration = Math.max(Number.EPSILON, segment.to.t - segment.from.t);
      const localProgress = clamp01((t - segment.from.t) / duration);
      const eased = segment.ease(localProgress);

      sampleByArcLength(
        segment.positionCurve,
        segment.positionArcLength,
        eased,
        output.position,
      );
      sampleByArcLength(
        segment.targetCurve,
        segment.targetArcLength,
        eased,
        output.target,
      );
      output.fov = lerp(segment.from.fov, segment.to.fov, eased);
      output.yaw = lerp(segment.from.yaw, segment.to.yaw, eased);
      output.pitch = lerp(segment.from.pitch, segment.to.pitch, eased);
      output.dollyDistance = lerp(
        segment.from.dollyDistance,
        segment.to.dollyDistance,
        eased,
      );
      output.roll = Math.max(
        -MAX_CAMERA_ROLL,
        Math.min(MAX_CAMERA_ROLL, lerp(segment.from.roll, segment.to.roll, eased)),
      );
      return output;
    },
    segmentArcLengths: segments.map((segment) => segment.positionArcLength),
    segmentEasings: segments.map((segment) => segment.easingName),
  };
}

export function createCameraTimelineSample(): CameraTimelineSample {
  return {
    position: new Vector3(),
    target: new Vector3(),
    fov: CAMERA_KEYFRAMES[0].fov,
    yaw: CAMERA_KEYFRAMES[0].yaw,
    pitch: CAMERA_KEYFRAMES[0].pitch,
    dollyDistance: CAMERA_KEYFRAMES[0].dollyDistance,
    roll: CAMERA_KEYFRAMES[0].roll,
  };
}
