import { Sphere, Vector3 } from "three";

import {
  CAMERA_COLLISION_PROXIES,
  type CameraCollisionProxy,
} from "./objectBounds";

export const CAMERA_SAFETY_RADIUS = 0.3;

export type CameraClearanceSample = {
  safe: boolean;
  nearestProxyId: string | null;
  clearance: number;
};

export type CameraCollisionInspector = {
  inspect(position: Vector3, nearPlane?: number): CameraClearanceSample;
  readonly minimumClearance: number;
  readonly collisionCount: number;
};

const closestPoint = new Vector3();

function clearanceToProxy(
  position: Vector3,
  proxy: CameraCollisionProxy,
  safetyRadius: number,
  nearPlane: number,
): number {
  proxy.bounds.clampPoint(position, closestPoint);
  return position.distanceTo(closestPoint) - safetyRadius - nearPlane;
}

export function createCameraCollisionInspector(
  proxies: readonly CameraCollisionProxy[] = CAMERA_COLLISION_PROXIES,
  safetyRadius = CAMERA_SAFETY_RADIUS,
): CameraCollisionInspector {
  const cameraSphere = new Sphere(new Vector3(), safetyRadius);
  const sample: CameraClearanceSample = {
    safe: true,
    nearestProxyId: null,
    clearance: Number.POSITIVE_INFINITY,
  };
  let minimumClearance = Number.POSITIVE_INFINITY;
  let collisionCount = 0;

  return {
    inspect(position, nearPlane = 0.1) {
      cameraSphere.center.copy(position);
      let clearance = Number.POSITIVE_INFINITY;
      let nearestProxyId: string | null = null;

      for (const proxy of proxies) {
        const candidate = clearanceToProxy(
          cameraSphere.center,
          proxy,
          cameraSphere.radius,
          nearPlane,
        );
        if (candidate >= clearance) continue;
        clearance = candidate;
        nearestProxyId = proxy.id;
      }

      sample.safe = clearance > 0;
      sample.nearestProxyId = nearestProxyId;
      sample.clearance = clearance;
      minimumClearance = Math.min(minimumClearance, clearance);
      if (!sample.safe) collisionCount += 1;
      return sample;
    },
    get minimumClearance() {
      return minimumClearance;
    },
    get collisionCount() {
      return collisionCount;
    },
  };
}
