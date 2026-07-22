import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

function fileUrl(relativePath) {
  return new URL(relativePath, root);
}

async function read(relativePath) {
  return readFile(fileUrl(relativePath), "utf8");
}

test("declares the Round 5 test and QA entry points", async () => {
  const packageJson = JSON.parse(await read("package.json"));

  assert.equal(
    packageJson.scripts["test:round5"],
    "node --test tests/round5-contract.test.mjs tests/*-round5.test.mjs",
  );
  assert.equal(
    packageJson.scripts["qa:round5"],
    "npm run build && node scripts/qa-round5.mjs",
  );
});

test("creates the Round 5 runtime policy modules", () => {
  const requiredFiles = [
    "app/scene/assets/gpuResourceRefCount.ts",
    "app/scene/assets/gltfAssetCache.ts",
    "app/scene/assets/textureAssetCache.ts",
    "app/scene/assets/stagePreloader.ts",
    "app/scene/animation/stageResidency.ts",
    "app/scene/animation/stageSwitchPolicy.ts",
    "app/scene/core/renderScheduler.ts",
    "app/scene/core/dynamicResolution.ts",
    "app/scene/debug/performanceStore.ts",
    "scripts/lib/round5Metrics.mjs",
    "scripts/qa-round5.mjs",
  ];

  for (const relativePath of requiredFiles) {
    assert.equal(existsSync(fileUrl(relativePath)), true, `${relativePath} is missing`);
  }
});

test("removes full-stage material opacity crossfades", async () => {
  const timeline = await read("app/scene/animation/stageTimelines.ts");

  assert.doesNotMatch(timeline, /material\.opacity\s*=/);
  assert.doesNotMatch(timeline, /material\.transparent\s*=/);
  assert.doesNotMatch(timeline, /material\.depthWrite\s*=/);
});

test("keeps progressive stage thresholds explicit", async () => {
  const relativePath = "app/scene/assets/stagePreloader.ts";
  const source = existsSync(fileUrl(relativePath)) ? await read(relativePath) : "";

  assert.match(source, /0\.08/);
  assert.match(source, /0\.32/);
  assert.match(source, /0\.58/);
});

test("preserves mobile and Reduced Motion zero-GLB gates", async () => {
  const source = await read("app/components/ScrollJourney/ScrollJourney.tsx");
  const runtimeImportIndex = source.indexOf('import("../../scene/createJourneyScene")');
  const desktopGateIndex = source.indexOf("desktopQuery.matches");
  const reducedGateIndex = source.indexOf("reducedMotionQuery.matches");

  assert.ok(runtimeImportIndex > desktopGateIndex);
  assert.ok(runtimeImportIndex > reducedGateIndex);
});
