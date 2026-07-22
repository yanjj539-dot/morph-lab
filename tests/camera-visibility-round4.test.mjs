import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { extname } from "node:path";
import { registerHooks } from "node:module";
import test from "node:test";
import {
  BoxGeometry,
  DoubleSide,
  FrontSide,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
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

const { createCameraVisibilityInspector } = await import(
  "../app/scene/debug/cameraVisibilityInspector.ts"
);

const TEST_MANIFEST = [
  {
    id: "test",
    progressRange: [0, 1],
    focusMeshNames: ["FOCUS"],
    allowedForegroundMeshNames: [],
  },
];

function createCamera({ near = 0.1, z = 5 } = {}) {
  const camera = new PerspectiveCamera(50, 1, near, 100);
  camera.position.set(0, 0, z);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
  return camera;
}

function addBox(scene, name, z, size = 2, options = {}) {
  const mesh = new Mesh(
    new BoxGeometry(size, size, size),
    new MeshBasicMaterial({ side: options.side ?? FrontSide }),
  );
  mesh.name = name;
  mesh.position.z = z;
  if (options.surfaceRole) mesh.userData.surfaceRole = options.surfaceRole;
  scene.add(mesh);
  return mesh;
}

function addPlane(scene, name, z, options = {}) {
  const mesh = new Mesh(
    new PlaneGeometry(options.size ?? 8, options.size ?? 8),
    new MeshBasicMaterial({ side: options.side ?? FrontSide }),
  );
  mesh.name = name;
  mesh.position.z = z;
  if (options.flip) mesh.rotation.y = Math.PI;
  if (options.surfaceRole) mesh.userData.surfaceRole = options.surfaceRole;
  scene.add(mesh);
  return mesh;
}

function inspect(scene, camera = createCamera(), manifest = TEST_MANIFEST) {
  scene.updateMatrixWorld(true);
  const sample = createCameraVisibilityInspector(manifest).inspect(
    scene,
    camera,
    0.5,
  );
  assert.doesNotThrow(() => JSON.stringify(sample));
  return sample;
}

test("five real focus rays report an unobstructed focus", () => {
  const scene = new Scene();
  addBox(scene, "FOCUS", 0);
  const contentLayer = addPlane(scene, "FOCUS_CONTENT_LAYER", 1.01, { size: 1.5 });
  contentLayer.userData.surfaceTarget = "FOCUS";

  const sample = inspect(scene);

  assert.equal(sample.rays.length, 5);
  assert.deepEqual(
    sample.rays.map((ray) => ray.id),
    ["center", "top-left", "top-right", "bottom-left", "bottom-right"],
  );
  assert.equal(sample.focusHitRayCount, 5);
  assert.deepEqual(sample.unexpectedOccluderMeshNames, []);
  assert.equal(sample.externalOcclusionSafe, true);
  assert.equal(sample.safe, true);
});

test("configured foreground is recorded without becoming an unexpected occluder", () => {
  const scene = new Scene();
  addBox(scene, "FOCUS", 0);
  addPlane(scene, "AUTHORED_PAPER", 2);
  const manifest = [
    {
      ...TEST_MANIFEST[0],
      allowedForegroundMeshNames: ["AUTHORED_PAPER"],
    },
  ];

  const sample = inspect(scene, createCamera(), manifest);

  assert.deepEqual(sample.allowedForegroundHitMeshNames, ["AUTHORED_PAPER"]);
  assert.deepEqual(sample.unexpectedOccluderMeshNames, []);
  assert.equal(sample.externalOcclusionSafe, true);
});

test("a non-allowlisted mesh in front of focus is an unexpected occluder", () => {
  const scene = new Scene();
  addBox(scene, "FOCUS", 0);
  addPlane(scene, "UNEXPECTED_PANEL", 2);

  const sample = inspect(scene);

  assert.deepEqual(sample.unexpectedOccluderMeshNames, ["UNEXPECTED_PANEL"]);
  assert.equal(sample.externalOcclusionSafe, false);
  assert.equal(sample.safe, false);
  assert.ok(
    sample.rays.every((ray) =>
      ray.unexpectedOccluderMeshNames.includes("UNEXPECTED_PANEL")
    ),
  );
});

test("a mesh behind the first focus hit is not reported as an occluder", () => {
  const scene = new Scene();
  addBox(scene, "FOCUS", 0);
  addPlane(scene, "BACKGROUND_PANEL", -2);

  const sample = inspect(scene);

  assert.deepEqual(sample.unexpectedOccluderMeshNames, []);
  assert.ok(
    sample.rays.every((ray) =>
      !ray.unexpectedOccluderMeshNames.includes("BACKGROUND_PANEL")
    ),
  );
});

test("multi-direction parity detects a camera inside a closed mesh and excludes surfaceRole planes", () => {
  const scene = new Scene();
  addBox(scene, "CAMERA_CONTAINER", 0, 4);
  addBox(scene, "FOCUS", -5, 2);
  addPlane(scene, "SCREEN_CONTENT", 0, {
    side: DoubleSide,
    surfaceRole: "content",
  });
  const camera = createCamera({ z: 0 });

  const sample = inspect(scene, camera);

  assert.deepEqual(sample.cameraInsideMeshNames, ["CAMERA_CONTAINER"]);
  assert.ok(!sample.cameraInsideMeshNames.includes("SCREEN_CONTENT"));
  assert.equal(sample.internalExposureSafe, false);
  assert.equal(sample.safe, false);
});

test("visible backfaces and geometry before the camera near plane are serialized", () => {
  const scene = new Scene();
  addBox(scene, "FOCUS", -2, 1);
  addPlane(scene, "NEAR_CARD", -0.05, { size: 4 });
  addPlane(scene, "VISIBLE_BACKFACE", -0.7, {
    size: 4,
    side: DoubleSide,
    flip: true,
  });
  const manifest = [
    {
      ...TEST_MANIFEST[0],
      allowedForegroundMeshNames: ["NEAR_CARD", "VISIBLE_BACKFACE"],
    },
  ];

  const sample = inspect(scene, createCamera({ z: 0, near: 0.1 }), manifest);

  assert.deepEqual(sample.nearPlaneViolationMeshNames, ["NEAR_CARD"]);
  assert.deepEqual(sample.visibleBackfaceMeshNames, ["VISIBLE_BACKFACE"]);
  assert.equal(sample.nearPlaneSafe, false);
  assert.equal(sample.visibleBackfaceSafe, false);
  assert.equal(sample.internalExposureSafe, false);
  assert.equal(sample.safe, false);
});
