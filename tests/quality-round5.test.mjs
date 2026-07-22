import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";

const resolutionUrl = new URL(
  "../app/scene/core/dynamicResolution.ts",
  import.meta.url,
);
const qualityUrl = new URL(
  "../app/scene/core/qualityManager.ts",
  import.meta.url,
);

test("selects deterministic high, balanced, and low stationary targets", async () => {
  assert.equal(existsSync(qualityUrl), true);
  const { selectQualitySettings } = await import(qualityUrl.href);
  assert.equal(
    selectQualitySettings({ devicePixelRatio: 2, deviceMemory: 16, hardwareConcurrency: 12 }).idleDpr,
    1.5,
  );
  assert.equal(
    selectQualitySettings({ devicePixelRatio: 1, deviceMemory: 8, hardwareConcurrency: 8 }).idleDpr,
    1.25,
  );
  const low = selectQualitySettings({
    devicePixelRatio: 2,
    deviceMemory: 4,
    hardwareConcurrency: 4,
    coarsePointer: true,
  });
  assert.equal(low.tier, "low");
  assert.equal(low.idleDpr, 1);
  assert.equal(low.transmissionResolutionScale, 0.5);
  for (const quality of [
    selectQualitySettings({ devicePixelRatio: 3, deviceMemory: 16, hardwareConcurrency: 16 }),
    low,
  ]) {
    assert.ok(quality.idleDpr >= 1 && quality.idleDpr <= 1.5);
    assert.ok(quality.activeDpr >= 1 && quality.activeDpr <= quality.idleDpr);
    assert.ok(quality.stableFrameCount >= 6 && quality.stableFrameCount <= 12);
  }
});

test("exposes deterministic QA tier overrides without changing production defaults", async () => {
  const { qualitySettingsForTier } = await import(qualityUrl.href);
  assert.equal(qualitySettingsForTier("high").idleDpr, 1.5);
  assert.equal(qualitySettingsForTier("balanced").idleDpr, 1.25);
  assert.equal(qualitySettingsForTier("low").idleDpr, 1);
});

test("drops DPR after 60 slow frames and raises only after cooldown and 120 fast frames", async () => {
  assert.equal(existsSync(resolutionUrl), true, "dynamicResolution.ts is missing");
  if (!existsSync(resolutionUrl)) return;
  const { createDynamicResolutionController } = await import(resolutionUrl.href);
  const changes = [];
  const controller = createDynamicResolutionController({
    activeDpr: 1.5,
    idleDpr: 1.5,
    minDpr: 1,
    maxDpr: 1.5,
    cooldownMs: 2000,
    idleDelayMs: 220,
    onChange: (change) => changes.push(change),
  });

  controller.markActivity(0);
  for (let index = 1; index <= 59; index += 1) controller.recordFrame(25, index * 25);
  assert.equal(controller.getState().currentDpr, 1.5);
  controller.recordFrame(25, 1500);
  assert.equal(controller.getState().currentDpr, 1.4);

  for (let index = 0; index < 120; index += 1) controller.recordFrame(14, 1600 + index * 14);
  assert.equal(controller.getState().currentDpr, 1.4, "cooldown blocks an early upgrade");
  for (let index = 0; index < 120; index += 1) controller.recordFrame(14, 3700 + index * 14);
  assert.equal(controller.getState().currentDpr, 1.5);
  assert.deepEqual(changes.map((change) => change.reason), ["slow-frames", "fast-frames"]);
});

test("restores the stationary DPR after idle and requests a sharp frame once", async () => {
  assert.equal(existsSync(resolutionUrl), true, "dynamicResolution.ts is missing");
  if (!existsSync(resolutionUrl)) return;
  const { createDynamicResolutionController } = await import(resolutionUrl.href);
  const controller = createDynamicResolutionController({
    activeDpr: 1.2,
    idleDpr: 1.5,
    minDpr: 1,
    maxDpr: 1.5,
    cooldownMs: 2000,
    idleDelayMs: 220,
  });

  controller.markActivity(1000);
  assert.equal(controller.getState().currentDpr, 1.2);
  assert.equal(controller.settleIdle(1219).sharpFrame, false);
  const settled = controller.settleIdle(1220);
  assert.equal(settled.changed, true);
  assert.equal(settled.currentDpr, 1.5);
  assert.equal(settled.sharpFrame, true);
  assert.equal(controller.settleIdle(1300).sharpFrame, false);
});
