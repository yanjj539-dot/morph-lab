import type { CameraTimeline } from "../animation/cameraTimeline";
import { createCameraTimelineSample } from "../animation/cameraTimeline";
import {
  reportCameraPathIntersections,
  type CameraPathCollisionReport,
} from "../collision/intersectionReport";
import { createCameraRig } from "../core/createCameraRig";

export function inspectCameraTimeline(
  timeline: CameraTimeline,
  sampleCount = 121,
): CameraPathCollisionReport {
  const sample = createCameraTimelineSample();
  const rig = createCameraRig();
  const positions = Array.from({ length: sampleCount }, (_, index) => {
    const progress = index / Math.max(1, sampleCount - 1);
    timeline.sample(progress, sample);
    rig.setPose(sample, 1);
    rig.rig.updateMatrixWorld(true);
    return { progress, position: rig.camera.getWorldPosition(sample.position.clone()) };
  });
  return reportCameraPathIntersections(positions);
}
