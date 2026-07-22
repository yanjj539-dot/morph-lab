import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { extname } from "node:path";
import { registerHooks } from "node:module";
import test from "node:test";
import {
  BoxGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  Quaternion,
  Vector3,
} from "three";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith(".") && !extname(specifier)) {
      const candidate = new URL(`${specifier}.ts`, context.parentURL);
      if (existsSync(candidate)) return nextResolve(candidate.href, context);
    }
    return nextResolve(specifier, context);
  },
});

const { CAMERA_KEYFRAMES, createCameraTimeline, createCameraTimelineSample } =
  await import("../app/scene/animation/cameraTimeline.ts");
const { createStageTimelines } = await import("../app/scene/animation/stageTimelines.ts");
const { createCameraRig } = await import("../app/scene/core/createCameraRig.ts");
const { inspectCameraTimeline } = await import("../app/scene/debug/cameraPathInspector.ts");

function updateWorld(rig) {
  rig.rig.updateMatrixWorld(true);
}

function worldDirection(camera) {
  return camera.getWorldDirection(new Vector3());
}

function makeStageRoot() {
  const root = new Group();
  root.add(new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial()));
  return root;
}

function stageOpacity(root) {
  return root.children[0].material.opacity;
}

test("round 4 camera rig nests dolly after yaw and pitch while retaining cameraRoot", () => {
  const rig = createCameraRig();

  assert.equal(rig.cameraRoot, rig.rig, "legacy cameraRoot aliases the rig root");
  assert.equal(rig.rig.name, "CameraRigRoot");
  assert.equal(rig.yawPivot.parent, rig.rig);
  assert.equal(rig.pitchPivot.parent, rig.yawPivot);
  assert.equal(rig.cameraDolly.parent, rig.pitchPivot);
  assert.equal(rig.camera.parent, rig.cameraDolly);
  assert.equal(rig.cameraDolly.name, "CameraDolly");
});

test("dolly changes world position while yaw, pitch, and roll continue looking at the authored target", () => {
  const rig = createCameraRig();
  const position = new Vector3(-4.65, 3.1, 5.55);
  const target = new Vector3(-3.95, 0.72, -1.75);
  const basePose = { position, target, fov: 34, yaw: 0.06, pitch: 0.02 };

  rig.setPose({ ...basePose, dollyDistance: 0, roll: 0 }, 1);
  updateWorld(rig);
  const baselinePosition = rig.camera.getWorldPosition(new Vector3());
  const baselineDirection = worldDirection(rig.camera);

  rig.setPose({ ...basePose, dollyDistance: 0.24, roll: 0.018 }, 1);
  updateWorld(rig);
  const dollyPosition = rig.camera.getWorldPosition(new Vector3());
  const dollyDirection = worldDirection(rig.camera);
  const expectedDirection = target.clone().sub(dollyPosition).normalize();

  assert.ok(dollyPosition.distanceTo(baselinePosition) > 0.23);
  assert.ok(dollyDirection.dot(expectedDirection) > 0.999999);
  assert.ok(dollyDirection.dot(baselineDirection) > 0.999999);
});

test("authored yaw and pitch change world camera composition without losing target alignment", () => {
  const rig = createCameraRig();
  const position = new Vector3(-4.65, 3.1, 5.55);
  const target = new Vector3(-3.95, 0.72, -1.75);
  const pose = { position, target, dollyDistance: 0.08, roll: -0.012 };

  rig.setPose({ ...pose, yaw: 0, pitch: 0 }, 1);
  updateWorld(rig);
  const neutralPosition = rig.camera.getWorldPosition(new Vector3());

  rig.setPose({ ...pose, yaw: 0.12, pitch: -0.08 }, 1);
  updateWorld(rig);
  const authoredPosition = rig.camera.getWorldPosition(new Vector3());
  const authoredDirection = worldDirection(rig.camera);

  assert.ok(
    authoredPosition.distanceTo(neutralPosition) > 0.5,
    "yaw/pitch pivots visibly recompose the shot",
  );
  assert.ok(
    authoredDirection.dot(target.clone().sub(authoredPosition).normalize()) > 0.999999,
    "pivoted camera still looks at the authored target",
  );
});

test("roll is quaternion-interpolated, clamped, and does not turn the camera away from its target", () => {
  const rig = createCameraRig();
  const position = new Vector3(2, 2.12, 4.1);
  const target = new Vector3(2.25, 0.82, -1.72);
  const pose = { position, target, yaw: -0.04, pitch: 0.04, dollyDistance: -0.3 };

  rig.setPose({ ...pose, roll: 0 }, 1);
  updateWorld(rig);
  const directionBefore = worldDirection(rig.camera);
  const upBefore = new Vector3(0, 1, 0).applyQuaternion(rig.camera.getWorldQuaternion(rig.camera.quaternion.clone()));

  rig.setPose({ ...pose, roll: 2 }, 1);
  updateWorld(rig);
  const directionAfter = worldDirection(rig.camera);
  const upAfter = new Vector3(0, 1, 0).applyQuaternion(rig.camera.getWorldQuaternion(rig.camera.quaternion.clone()));
  const worldPosition = rig.camera.getWorldPosition(new Vector3());

  assert.ok(Math.abs(rig.camera.rotation.z) <= 0.026 + Number.EPSILON);
  assert.ok(directionBefore.dot(directionAfter) > 0.999999);
  assert.ok(directionAfter.dot(target.clone().sub(worldPosition).normalize()) > 0.999999);
  assert.ok(upBefore.dot(upAfter) < 0.9999, "roll changes the camera frame around its view axis");
});

test("roll quaternion approaches its target continuously across damped frames", () => {
  const rig = createCameraRig();
  const position = new Vector3(2, 2.12, 4.1);
  const target = new Vector3(2.25, 0.82, -1.72);
  const pose = {
    position,
    target,
    yaw: -0.04,
    pitch: 0.04,
    dollyDistance: -0.3,
  };
  const targetRoll = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), 0.026);

  rig.setPose({ ...pose, roll: 0 }, 1);
  let previous = rig.camera.quaternion.clone();
  let previousDistance = previous.angleTo(targetRoll);

  for (let frame = 0; frame < 4; frame += 1) {
    rig.setPose({ ...pose, roll: 0.026 }, 0.25);
    updateWorld(rig);
    const next = rig.camera.quaternion.clone();
    const nextDistance = next.angleTo(targetRoll);
    const worldPosition = rig.camera.getWorldPosition(new Vector3());

    assert.ok(nextDistance < previousDistance, "each damped frame approaches authored roll");
    assert.ok(previous.dot(next) > 0, "damped roll quaternion stays on one hemisphere");
    assert.ok(
      worldDirection(rig.camera).dot(target.clone().sub(worldPosition).normalize()) > 0.999999,
      "damped roll preserves target direction",
    );
    previous = next;
    previousDistance = nextDistance;
  }

  assert.ok(previousDistance > 0, "damping does not snap to the final roll in one frame");
});

test("timeline samples authored dolly and roll with nonuniform easing and continuous quaternions", () => {
  const timeline = createCameraTimeline();
  const sample = createCameraTimelineSample();
  const middle = timeline.sample(0.25, sample);
  const linearFov = CAMERA_KEYFRAMES[1].fov +
    (CAMERA_KEYFRAMES[2].fov - CAMERA_KEYFRAMES[1].fov) * ((0.25 - 0.2) / 0.09);

  assert.notEqual(middle.fov, linearFov, "a segment uses eased rather than linear timing");
  assert.ok(middle.dollyDistance !== 0);
  assert.ok(Math.abs(middle.roll) <= 0.026);
  assert.ok(new Set(timeline.segmentEasings).size > 1, "segments use nonuniform easing");

  const rig = createCameraRig();
  let previousQuaternion = null;
  for (let index = 0; index <= 40; index += 1) {
    timeline.sample(index / 40, sample);
    rig.setPose(sample, 1);
    updateWorld(rig);
    const nextQuaternion = rig.camera.getWorldQuaternion(rig.camera.quaternion.clone());
    if (previousQuaternion) assert.ok(previousQuaternion.dot(nextQuaternion) > 0);
    previousQuaternion = nextQuaternion;
  }
});

test("camera inspector returns 41 finite Round 4 states by default", () => {
  const report = inspectCameraTimeline(createCameraTimeline());

  assert.equal(report.summary.samples, 41);
  assert.equal(report.samples.length, 41);
  for (const sample of report.samples) {
    assert.equal(sample.finite, true);
    assert.ok(Number.isFinite(sample.progress));
    assert.ok(Number.isFinite(sample.position.x));
    assert.ok(Number.isFinite(sample.target.y));
    assert.ok(Number.isFinite(sample.fov));
    assert.ok(Number.isFinite(sample.yaw));
    assert.ok(Number.isFinite(sample.pitch));
    assert.ok(Number.isFinite(sample.dollyDistance));
    assert.ok(Number.isFinite(sample.roll));
    assert.ok(Number.isFinite(sample.nearPlane));
  }
});

test("Round 5 preserves the Round 4 camera path while switching opaque stage roots", () => {
  const roots = {
    observe: makeStageRoot(),
    structure: makeStageRoot(),
    prototype: makeStageRoot(),
    release: makeStageRoot(),
  };
  const timeline = createStageTimelines(roots);
  const transitions = [
    { outgoing: "observe", incoming: "structure", switchPoint: 0.285 },
    { outgoing: "structure", incoming: "prototype", switchPoint: 0.535 },
    { outgoing: "prototype", incoming: "release", switchPoint: 0.765 },
  ];

  for (const transition of transitions) {
    const outgoing = roots[transition.outgoing];
    const incoming = roots[transition.incoming];

    timeline.update(transition.switchPoint - 0.001);
    assert.equal(stageOpacity(outgoing), 1);
    assert.equal(stageOpacity(incoming), 1);
    assert.equal(outgoing.visible, true);
    assert.equal(incoming.visible, false);

    timeline.update(transition.switchPoint);
    assert.equal(stageOpacity(outgoing), 1);
    assert.equal(stageOpacity(incoming), 1);
    assert.equal(outgoing.visible, false);
    assert.equal(incoming.visible, true);
    assert.equal(Object.values(roots).filter((root) => root.visible).length, 1);
  }
  timeline.reset();
});
