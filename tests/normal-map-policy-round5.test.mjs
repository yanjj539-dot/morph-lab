import assert from "node:assert/strict";
import test from "node:test";

const policyUrl = new URL(
  "../app/scene/materials/normalMapPolicy.ts",
  import.meta.url,
);

test("reads the materialNormals query override without changing the default", async () => {
  const { readMaterialNormalOverride } = await import(policyUrl.href);
  assert.equal(readMaterialNormalOverride("?materialNormals=0"), false);
  assert.equal(readMaterialNormalOverride("materialNormals=1"), true);
  assert.equal(readMaterialNormalOverride("?qaStage=observe"), null);
  assert.equal(readMaterialNormalOverride("?materialNormals=unexpected"), null);
});

test("reduces micro-normal energy by distance and disables it in the far tier", async () => {
  const { normalPolicyFor } = await import(policyUrl.href);
  const nearPaper = normalPolicyFor("paper", "near");
  const mediumPaper = normalPolicyFor("paper", "medium");
  const farPaper = normalPolicyFor("paper", "far");
  assert.equal(nearPaper.enabled, true);
  assert.equal(nearPaper.scale, 0.012);
  assert.equal(mediumPaper.scale, 0.005);
  assert.equal(farPaper.enabled, false);
  assert.equal(farPaper.scale, 0);
  assert.equal(normalPolicyFor("paper", "near", false).enabled, false);
  assert.equal(normalPolicyFor("screenGlass", "near").scale, 0);
});

test("publishes lower-frequency repeat profiles for public normal textures", async () => {
  const { ROUND5_NORMAL_TEXTURE_REPEATS } = await import(policyUrl.href);
  assert.deepEqual(ROUND5_NORMAL_TEXTURE_REPEATS, {
    paperNormal: [2, 2],
    plasticNormal: [1.5, 1.5],
    metalBrushedNormal: [1, 3],
    rubberNormal: [2, 2],
    studioOrm: [2, 2],
  });
});

test("rejects micro normals on large or cross-object batched surfaces", async () => {
  const { isMicroNormalEligible } = await import(policyUrl.href);
  assert.equal(isMicroNormalEligible("detail_knob", 0.4), true);
  assert.equal(isMicroNormalEligible("large_table", 3.2), false);
  assert.equal(isMicroNormalEligible("ROUND5_BATCH_03", 0.8), false);
});
