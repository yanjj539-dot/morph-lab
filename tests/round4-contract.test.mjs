import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile, readdir, stat } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

function fileUrl(path) {
  return new URL(path, root);
}

async function readText(path) {
  return readFile(fileUrl(path), "utf8");
}

async function readJson(path) {
  return JSON.parse(await readText(path));
}

test("round 4 exposes a repeatable asset, geometry, and browser-QA pipeline", async () => {
  const pkg = await readJson("package.json");

  assert.match(pkg.scripts["assets:round4"], /build_round4_assets\.py/);
  assert.match(pkg.scripts["geometry:round4"], /check_round4_geometry\.py/);
  assert.equal(pkg.scripts["test:round4"], "node --test tests/round4-contract.test.mjs");
  assert.match(pkg.scripts["qa:round4"], /qa-round4\.mjs/);

  for (const path of [
    "scripts/blender/build_round4_assets.py",
    "scripts/blender/check_round4_geometry.py",
    "scripts/blender/render_round4_review.py",
    "scripts/blender/export_round4_glb.py",
    "scripts/qa-round4.mjs",
  ]) {
    assert.ok(existsSync(fileUrl(path)), `${path} exists`);
  }
});

test("round 4 screen and printed-surface modules express an explicit, non-distorting fit contract", async () => {
  const [uvFit, manifest, screen, print, uvFitTests] = await Promise.all([
    readText("app/scene/materials/uvFit.ts"),
    readText("app/scene/materials/screenManifest.ts"),
    readText("app/scene/materials/createScreenMaterial.ts"),
    readText("app/scene/materials/createPrintedSurface.ts"),
    readText("tests/uv-fit.test.mjs"),
  ]);

  assert.match(uvFit, /export/);
  assert.match(uvFit, /contain/);
  assert.match(uvFit, /cover/);
  assert.match(uvFit, /safeArea/);
  assert.match(uvFit, /rotation/);
  assert.match(manifest, /export/);
  assert.match(manifest, /mesh(Name)?/);
  assert.match(manifest, /fit/);
  assert.match(manifest, /safeArea/);
  assert.match(manifest, /rotation/);
  assert.match(screen, /export/);
  assert.match(screen, /renderOrder|depthWrite|polygonOffset/);
  assert.match(screen, /emissive/);
  assert.match(print, /export/);
  assert.match(print, /roughness/);
  assert.doesNotMatch(print, /emissive/);

  for (const marker of ["contain", "cover", "safeArea", "rotation", "90", "180", "270"]) {
    assert.match(uvFitTests, new RegExp(marker), `UV-fit unit test covers ${marker}`);
  }
});

test("round 4 camera choreography adds authored dolly and limited roll without removing the stable rig", async () => {
  const [timeline, rig, scene, inspector, cameraTests] = await Promise.all([
    readText("app/scene/animation/cameraTimeline.ts"),
    readText("app/scene/core/createCameraRig.ts"),
    readText("app/scene/createJourneyScene.ts"),
    readText("app/scene/debug/cameraPathInspector.ts"),
    readText("tests/camera-rig-round4.test.mjs"),
  ]);

  assert.match(timeline, /dolly/);
  assert.match(timeline, /roll/);
  assert.match(timeline, /arcLength|getUtoTmapping/);
  assert.match(rig, /CameraDolly/);
  assert.match(rig, /roll/);
  assert.match(rig, /Quaternion/);
  assert.match(scene, /dolly/);
  assert.match(inspector, /dolly/);
  assert.match(inspector, /roll/);
  assert.match(cameraTests, /dolly/);
  assert.match(cameraTests, /roll/);
  assert.match(cameraTests, /8|0\.08/);
  assert.match(cameraTests, /12|0\.12/);
});

test("round 4 geometry and camera evidence closes high and medium severity findings across 41 samples", async () => {
  const [intersections, collisions, markdown] = await Promise.all([
    readJson("artifacts/qa-round4/intersections.json"),
    readJson("artifacts/qa-round4/camera-collisions.json"),
    readText("artifacts/qa-round4/intersections.md"),
  ]);

  assert.equal(intersections.summary.high, 0);
  assert.equal(intersections.summary.medium, 0);
  assert.ok(intersections.summary.samples >= 41, "geometry samples every 2.5% of progress");
  assert.ok(Array.isArray(intersections.intersections));
  assert.equal(collisions.summary.high, 0);
  assert.equal(collisions.summary.medium, 0);
  assert.ok(collisions.summary.samples >= 41, "camera collision inspection uses 41 samples");
  assert.match(markdown, /High:\s*0/);
  assert.match(markdown, /Medium:\s*0/);
});

test("round 4 keeps the mobile Hero LCP plate lightweight", async () => {
  const mobileHero = await stat(fileUrl("public/fallback/round-4/hero-observe-mobile.webp"));

  assert.ok(mobileHero.size <= 16_000, `mobile Hero fallback is ${mobileHero.size} bytes`);
});

test("round 4 delivery includes 41 Journey captures, named UI states, recordings, and Lighthouse floors", async () => {
  const [progress, uiStates] = await Promise.all([
    readdir(fileUrl("artifacts/qa-round4/journey-progress/")),
    readdir(fileUrl("artifacts/qa-round4/ui-states/")),
  ]);
  const expectedProgressNames = Array.from(
    { length: 41 },
    (_, index) =>
      `progress-${String(index).padStart(2, "0")}-${String(Math.round((index * 100) / 40)).padStart(3, "0")}.png`,
  );
  assert.deepEqual(
    progress.filter((name) => /^progress-.*\.png$/.test(name)).sort(),
    expectedProgressNames,
    "Journey progress evidence uses the exact 41 half-up 2.5% filenames",
  );

  for (const state of [
    "hero",
    "practice",
    "selected-work",
    "about",
    "cta",
    "menu",
    "hover",
    "focus",
    "transition",
  ]) {
    assert.ok(uiStates.some((name) => name.includes(state)), `UI-state evidence includes ${state}`);
  }

  for (const video of [
    "reference-vectr-desktop.mp4",
    "current-before-desktop.mp4",
    "current-after-desktop.mp4",
    "current-after-mobile.mp4",
    "current-after-reduced-motion.mp4",
  ]) {
    assert.ok((await stat(fileUrl(`artifacts/qa-round4/${video}`))).size > 100_000, `${video} evidence`);
  }

  for (const mode of ["desktop", "mobile"]) {
    const report = await readJson(`artifacts/qa-round4/lighthouse-${mode}.json`);
    assert.ok(report.categories.performance.score >= (mode === "desktop" ? 0.9 : 0.75));
    assert.ok(report.categories.accessibility.score >= 0.95);
    assert.ok(report.categories.seo.score >= 0.95);
  }
});

test("round 4 preserves the compressed desktop path, zero-GLB fallbacks, and GitHub Pages-safe URLs", async () => {
  const [models, manifest, motion, journey, textureLoader, paths] = await Promise.all([
    readText("app/scene/assets/loadModels.ts"),
    readText("app/scene/assets/assetManifest.ts"),
    readText("app/components/MotionController.tsx"),
    readText("app/components/ScrollJourney/ScrollJourney.tsx"),
    readText("app/scene/materials/loadCompressedTextures.ts"),
    readText("app/lib/paths.ts"),
  ]);

  assert.match(models, /DRACOLoader/);
  assert.match(models, /setDecoderPath/);
  assert.match(models, /loadRound4Models/);
  assert.match(manifest, /ROUND4_STAGE_ASSETS/);
  assert.match(manifest, /models\/round-4/);
  assert.match(textureLoader, /KTX2Loader/);
  assert.match(motion, /!isDesktop\s*\|\|\s*prefersReducedMotion/);
  assert.match(journey, /!isDesktop\s*\|\|\s*prefersReducedMotion/);
  assert.match(journey, /import\("\.\.\/\.\.\/scene\/createJourneyScene"\)/);
  assert.match(paths, /NEXT_PUBLIC_BASE_PATH/);
  assert.match(paths, /withBasePath/);
});

test("round 4 documents the reference study, story, material decisions, delivery, and limitations", async () => {
  for (const path of [
    "docs/vectr-reference-study.md",
    "docs/round-4-audit.md",
    "docs/round-4-defect-list.md",
    "docs/round-4-camera-storyboard.md",
    "docs/round-4-material-system.md",
    "docs/round-4-delivery.md",
    "docs/round-4-known-limitations.md",
  ]) {
    assert.ok(existsSync(fileUrl(path)), `${path} exists`);
  }
});
