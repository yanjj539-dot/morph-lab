import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";
import {
  AnimationClip,
  BoxGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  NumberKeyframeTrack,
} from "three";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (
      (specifier.startsWith("./") || specifier.startsWith("../")) &&
      !specifier.match(/\.[a-z]+$/i)
    ) {
      return nextResolve(`${specifier}.ts`, context);
    }
    return nextResolve(specifier, context);
  },
});

const optimizerUrl = new URL(
  "../app/scene/core/staticBatchOptimizer.ts",
  import.meta.url,
);

test("batches only compatible static meshes and preserves animated or authored anchors", async () => {
  const { optimizeStaticStageMeshes } = await import(optimizerUrl.href);
  const root = new Group();
  for (const name of ["detail_a", "detail_b", "detail_c", "animated_key", "SCREEN_monitor"]) {
    const material = new MeshStandardMaterial();
    material.name = "MAT_WarmWhitePlastic";
    const mesh = new Mesh(new BoxGeometry(1, 1, 1), material);
    mesh.name = name;
    mesh.position.x = root.children.length * 2;
    root.add(mesh);
  }
  const clips = [
    new AnimationClip("test", 1, [
      new NumberKeyframeTrack("animated_key.position[x]", [0, 1], [0, 1]),
    ]),
  ];

  const report = optimizeStaticStageMeshes(root, clips, {
    preserveNames: new Set(["SCREEN_monitor"]),
  });

  assert.equal(report.sourceMeshes, 3);
  assert.equal(report.batchedMeshes, 1);
  assert.equal(report.drawCallsSaved, 2);
  assert.ok(root.getObjectByName("animated_key"));
  assert.ok(root.getObjectByName("SCREEN_monitor"));
  assert.equal(root.children.filter((child) => child.name.startsWith("ROUND5_BATCH_")).length, 1);
});

test("does not batch transparent, child-bearing, or incompatible geometry", async () => {
  const { optimizeStaticStageMeshes } = await import(optimizerUrl.href);
  const root = new Group();
  const transparent = new MeshStandardMaterial({ transparent: true, opacity: 0.5 });
  transparent.name = "MAT_Glass";
  const a = new Mesh(new BoxGeometry(), transparent);
  const b = new Mesh(new BoxGeometry(), transparent.clone());
  a.name = "glass_a";
  b.name = "glass_b";
  root.add(a, b);
  const report = optimizeStaticStageMeshes(root, []);
  assert.equal(report.batchedMeshes, 0);
  assert.equal(report.drawCallsSaved, 0);
});

test("batches distinct authored material names that resolve to one runtime profile", async () => {
  const { optimizeStaticStageMeshes } = await import(optimizerUrl.href);
  const root = new Group();
  for (const materialName of ["MAT_WarmWhitePlastic_A", "MAT_Plastic_Detail_B"]) {
    const material = new MeshStandardMaterial();
    material.name = materialName;
    const mesh = new Mesh(new BoxGeometry(), material);
    mesh.name = `mesh_${materialName}`;
    root.add(mesh);
  }
  const report = optimizeStaticStageMeshes(root, []);
  assert.equal(report.sourceMeshes, 2);
  assert.equal(report.drawCallsSaved, 1);
});
