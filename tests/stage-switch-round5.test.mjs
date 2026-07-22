import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";
import { Group, Mesh, MeshStandardMaterial, PlaneGeometry } from "three";

const policyUrl = new URL(
  "../app/scene/animation/stageSwitchPolicy.ts",
  import.meta.url,
);

function makeRoot(name) {
  const root = new Group();
  root.name = name;
  root.add(
    new Mesh(
      new PlaneGeometry(1, 1),
      new MeshStandardMaterial({
        opacity: 0.82,
        transparent: false,
        depthWrite: true,
      }),
    ),
  );
  return root;
}

test("switches main roots at occlusion points without mutating materials", async () => {
  assert.equal(existsSync(policyUrl), true, "stageSwitchPolicy.ts is missing");
  if (!existsSync(policyUrl)) return;
  const [{ createStageTimelines }, { sampleStageSwitch }] = await Promise.all([
    import("../app/scene/animation/stageTimelines.ts"),
    import(policyUrl.href),
  ]);
  const roots = {
    observe: makeRoot("observe"),
    structure: makeRoot("structure"),
    prototype: makeRoot("prototype"),
    release: makeRoot("release"),
  };
  const initialMaterials = Object.fromEntries(
    Object.entries(roots).map(([stage, root]) => {
      const material = root.children[0].material;
      return [stage, {
        opacity: material.opacity,
        transparent: material.transparent,
        depthWrite: material.depthWrite,
      }];
    }),
  );
  const controller = createStageTimelines(roots);

  for (let sample = 0; sample <= 100; sample += 1) {
    const progress = sample / 100;
    controller.update(progress);
    const state = sampleStageSwitch(progress);
    assert.deepEqual(
      Object.entries(roots).filter(([, root]) => root.visible).map(([stage]) => stage),
      [state.current],
    );
    for (const [stage, root] of Object.entries(roots)) {
      const material = root.children[0].material;
      assert.deepEqual(
        {
          opacity: material.opacity,
          transparent: material.transparent,
          depthWrite: material.depthWrite,
        },
        initialMaterials[stage],
      );
    }
  }
});

test("exposes the three camera-occlusion switch points", async () => {
  assert.equal(existsSync(policyUrl), true, "stageSwitchPolicy.ts is missing");
  if (!existsSync(policyUrl)) return;
  const { STAGE_SWITCH_POINTS, sampleStageSwitch } = await import(policyUrl.href);

  assert.deepEqual(STAGE_SWITCH_POINTS, [0.285, 0.535, 0.765]);
  assert.equal(sampleStageSwitch(0.284).current, "observe");
  assert.equal(sampleStageSwitch(0.285).current, "structure");
  assert.equal(sampleStageSwitch(0.535).current, "prototype");
  assert.equal(sampleStageSwitch(0.765).current, "release");
});
