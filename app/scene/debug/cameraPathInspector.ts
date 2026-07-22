import { Vector3 } from "three";

import type { CameraTimeline } from "../animation/cameraTimeline";
import { createCameraTimelineSample } from "../animation/cameraTimeline";
import {
  reportCameraPathIntersections,
  type CameraPathCollisionReport,
} from "../collision/intersectionReport";
import { createCameraRig } from "../core/createCameraRig";

export type CameraPathInspectorSample = {
  progress: number;
  position: Vector3;
  target: Vector3;
  fov: number;
  yaw: number;
  pitch: number;
  dollyDistance: number;
  roll: number;
  nearPlane: number;
  finite: boolean;
};

export type CameraTimelineInspection = CameraPathCollisionReport & {
  samples: readonly CameraPathInspectorSample[];
};

export function inspectCameraTimeline(
  timeline: CameraTimeline,
  sampleCount = 41,
): CameraTimelineInspection {
  const sample = createCameraTimelineSample();
  const rig = createCameraRig();
  const samples = Array.from({ length: sampleCount }, (_, index) => {
    const progress = index / Math.max(1, sampleCount - 1);
    timeline.sample(progress, sample);
    rig.setPose(sample, 1);
    rig.rig.updateMatrixWorld(true);
    const position = rig.camera.getWorldPosition(new Vector3());
    const target = sample.target.clone();
    const values = [
      progress,
      position.x,
      position.y,
      position.z,
      target.x,
      target.y,
      target.z,
      sample.fov,
      sample.yaw,
      sample.pitch,
      sample.dollyDistance,
      sample.roll,
      rig.camera.near,
    ];
    return {
      progress,
      position,
      target,
      fov: sample.fov,
      yaw: sample.yaw,
      pitch: sample.pitch,
      dollyDistance: sample.dollyDistance,
      roll: sample.roll,
      nearPlane: rig.camera.near,
      finite: values.every(Number.isFinite),
    };
  });
  return {
    ...reportCameraPathIntersections(samples),
    samples,
  };
}
