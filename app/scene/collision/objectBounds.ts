import { Box3, Vector3 } from "three";

import { type JourneyStageId } from "../../data/journey";

export type CameraCollisionProxy = {
  id: string;
  stage: JourneyStageId;
  bounds: Box3;
};

function proxy(
  stage: JourneyStageId,
  min: readonly [number, number, number],
  max: readonly [number, number, number],
): CameraCollisionProxy {
  return {
    id: `COLLIDER_${stage.toUpperCase()}_PRIMARY`,
    stage,
    bounds: new Box3(
      new Vector3(min[0], min[1], min[2]),
      new Vector3(max[0], max[1], max[2]),
    ),
  };
}

// These proxies describe the authored camera corridor, not runtime push-back volumes.
export const CAMERA_COLLISION_PROXIES: readonly CameraCollisionProxy[] = [
  proxy("observe", [-7.35, 0.08, -3.05], [-4.65, 2.65, -0.25]),
  proxy("structure", [-3.35, 0.08, -3.15], [-0.65, 3.15, -0.15]),
  proxy("prototype", [0.55, 0.08, -3.15], [3.45, 2.95, -0.05]),
  proxy("release", [4.45, 0.08, -3.2], [7.55, 2.9, -0.05]),
] as const;
