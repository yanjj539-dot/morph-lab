import {
  Matrix4,
  Object3D,
  PerspectiveCamera,
  Quaternion,
  Vector3,
} from "three";

export type CameraVector = Vector3 | readonly [number, number, number];

export type CameraRigPose = {
  position: CameraVector;
  target: CameraVector;
  fov?: number;
  yaw?: number;
  pitch?: number;
};

export type CameraRig = {
  rig: Object3D;
  camera: PerspectiveCamera;
  cameraRoot: Object3D;
  yawPivot: Object3D;
  pitchPivot: Object3D;
  setPose: (pose: CameraRigPose, damping?: number) => void;
  resize: (width: number, height: number) => void;
};

const X_AXIS = new Vector3(1, 0, 0);
const Y_AXIS = new Vector3(0, 1, 0);

function copyCameraVector(target: Vector3, source: CameraVector): void {
  if (source instanceof Vector3) {
    target.copy(source);
    return;
  }
  target.set(source[0], source[1], source[2]);
}

export function createCameraRig(width = 1, height = 1): CameraRig {
  const rig = new Object3D();
  rig.name = "CameraRig";

  const cameraRoot = new Object3D();
  cameraRoot.name = "CameraRoot";

  const yawPivot = new Object3D();
  yawPivot.name = "YawPivot";

  const pitchPivot = new Object3D();
  pitchPivot.name = "PitchPivot";

  const camera = new PerspectiveCamera(42, width / Math.max(height, 1), 0.1, 80);
  camera.name = "PerspectiveCamera";

  rig.add(cameraRoot);
  cameraRoot.add(yawPivot);
  yawPivot.add(pitchPivot);
  pitchPivot.add(camera);

  const positionVector = new Vector3();
  const targetVector = new Vector3();
  const localOffsetVector = new Vector3();
  const localTargetVector = new Vector3();
  const lookAtMatrix = new Matrix4();
  const targetYawQuaternion = new Quaternion();
  const targetPitchQuaternion = new Quaternion();
  let initialized = false;

  function setPose(
    {
      position,
      target,
      fov = camera.fov,
      yaw = 0,
      pitch = 0,
    }: CameraRigPose,
    damping = 0.18,
  ): void {
    copyCameraVector(positionVector, position);
    copyCameraVector(targetVector, target);

    cameraRoot.position.copy(targetVector);
    localOffsetVector.subVectors(positionVector, targetVector);
    camera.position.copy(localOffsetVector);

    lookAtMatrix.lookAt(localOffsetVector, localTargetVector, camera.up);
    camera.quaternion.setFromRotationMatrix(lookAtMatrix);

    targetYawQuaternion.setFromAxisAngle(Y_AXIS, yaw);
    targetPitchQuaternion.setFromAxisAngle(X_AXIS, pitch);
    const blend = initialized ? Math.max(0, Math.min(1, damping)) : 1;
    yawPivot.quaternion.slerp(targetYawQuaternion, blend);
    pitchPivot.quaternion.slerp(targetPitchQuaternion, blend);
    initialized = true;

    if (camera.fov !== fov) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
  }

  function resize(nextWidth: number, nextHeight: number): void {
    camera.aspect = nextWidth / Math.max(nextHeight, 1);
    camera.updateProjectionMatrix();
  }

  return {
    rig,
    camera,
    cameraRoot,
    yawPivot,
    pitchPivot,
    setPose,
    resize,
  };
}
