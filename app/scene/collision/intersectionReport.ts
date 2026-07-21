import { Vector3 } from "three";

import { createCameraCollisionInspector } from "./cameraCollision";

export type CameraPathCollision = {
  progress: number;
  proxyId: string;
  clearance: number;
};

export type CameraPathCollisionReport = {
  summary: {
    samples: number;
    high: number;
    medium: number;
    minimumClearance: number;
  };
  collisions: CameraPathCollision[];
};

export function reportCameraPathIntersections(
  samples: readonly { progress: number; position: Vector3 }[],
): CameraPathCollisionReport {
  const inspector = createCameraCollisionInspector();
  const collisions: CameraPathCollision[] = [];

  for (const sample of samples) {
    const result = inspector.inspect(sample.position);
    if (result.safe || !result.nearestProxyId) continue;
    collisions.push({
      progress: sample.progress,
      proxyId: result.nearestProxyId,
      clearance: result.clearance,
    });
  }

  return {
    summary: {
      samples: samples.length,
      high: collisions.filter((collision) => collision.clearance < -0.15).length,
      medium: collisions.filter(
        (collision) => collision.clearance >= -0.15 && collision.clearance <= 0,
      ).length,
      minimumClearance: inspector.minimumClearance,
    },
    collisions,
  };
}
