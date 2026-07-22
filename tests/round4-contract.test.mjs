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
  const [intersections, collisions, markdown, qaRunner] = await Promise.all([
    readJson("artifacts/qa-round4/intersections.json"),
    readJson("artifacts/qa-round4/camera-collisions.json"),
    readText("artifacts/qa-round4/intersections.md"),
    readText("scripts/qa-round4.mjs"),
  ]);

  assert.equal(intersections.summary.high, 0);
  assert.equal(intersections.summary.medium, 0);
  assert.ok(intersections.summary.samples >= 41, "geometry samples every 2.5% of progress");
  assert.ok(Array.isArray(intersections.intersections));
  assert.equal(collisions.summary.high, 0);
  assert.equal(collisions.summary.medium, 0);
  assert.equal(collisions.schemaVersion, 2);
  assert.equal(collisions.source, "runtime-raycast");
  assert.equal(collisions.summary.samples, 41, "camera collision inspection uses exact 41 samples");
  assert.equal(collisions.summary.unexpectedExternalOcclusions, 0);
  assert.equal(collisions.summary.internalExposures, 0);
  assert.equal(collisions.summary.nearPlaneViolations, 0);
  assert.equal(collisions.summary.insufficientFocusEvidence, 0);
  assert.ok(collisions.summary.allowedExternalOcclusions > 0);
  assert.ok(
    collisions.samples.every(
      (sample) =>
        sample.rays.length === 5 &&
        sample.renderableMeshCount > 0 &&
        typeof sample.externalOcclusion.safe === "boolean" &&
        typeof sample.internalExposure.safe === "boolean",
    ),
    "each camera sample contains measured runtime ray evidence",
  );
  assert.doesNotMatch(qaRunner, /externalOcclusion:\s*false|internalExposure:\s*false/);
  assert.match(markdown, /High:\s*0/);
  assert.match(markdown, /Medium:\s*0/);
});

test("round 4 keeps the mobile Hero LCP plate lightweight", async () => {
  const mobileHero = await stat(fileUrl("public/fallback/round-4/hero-observe-mobile.webp"));

  assert.ok(mobileHero.size <= 16_000, `mobile Hero fallback is ${mobileHero.size} bytes`);
});

test("round 4 delivery includes 41 Journey captures, named UI states, recordings, and Lighthouse floors", async () => {
  const { default: sharp } = await import("sharp");
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

  for (const stage of ["observe", "structure", "prototype", "release"]) {
    const metadata = await sharp(
      await readFile(fileUrl(`artifacts/qa-round4/stage-${stage}-1920x1080.png`)),
    ).metadata();
    assert.equal(metadata.width, 1920, `${stage} stage evidence width`);
    assert.equal(metadata.height, 1080, `${stage} stage evidence height`);
  }

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

  for (const name of [
    "current-after-desktop",
    "current-after-mobile",
    "current-after-reduced-motion",
  ]) {
    const [video, contactSheet] = await Promise.all([
      stat(fileUrl(`artifacts/qa-round4/${name}.mp4`)),
      stat(fileUrl(`artifacts/qa-round4/video-contact-sheets/${name}-contact-sheet.png`)),
    ]);
    assert.ok(contactSheet.size > 10_000, `${name} contact sheet evidence`);
    assert.ok(
      contactSheet.mtimeMs >= video.mtimeMs,
      `${name} contact sheet is generated from the current MP4`,
    );
  }

  for (const mode of ["desktop", "mobile"]) {
    const report = await readJson(`artifacts/qa-round4/lighthouse-${mode}.json`);
    assert.ok(report.categories.performance.score >= (mode === "desktop" ? 0.9 : 0.75));
    assert.ok(report.categories.accessibility.score >= 0.95);
    assert.ok(report.categories.seo.score >= 0.95);
  }

  const [networkBudget, telemetry] = await Promise.all([
    readJson("artifacts/qa-round4/network-budget.json"),
    readJson("artifacts/qa-round4/browser-telemetry.json"),
  ]);
  assert.equal(networkBudget.glb.requestCount, 4);
  assert.equal(networkBudget.glb.uniqueDesktopRequests, 4);
  assert.deepEqual(networkBudget.glb.duplicateUrls, []);
  assert.ok(networkBudget.glb.totalTransferSize > 0);
  assert.ok(telemetry.sessions > 0);
  assert.equal(telemetry.consoleErrors, 0);
  assert.equal(telemetry.pageErrors, 0);
  assert.equal(telemetry.failedRequests, 0);
  assert.equal(telemetry.httpErrors, 0);
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

test("round 4 model bytes coalesce consumers and retry after a failed fetch", async () => {
  const { loadModelBytes } = await import("../app/scene/assets/modelByteCache.ts");
  const calls = [];
  const fetcher = async (url) => {
    calls.push(String(url));
    return new Response(Uint8Array.from([1, 2, 3, 4]));
  };
  const url = `/models/round-4/cache-${Date.now()}.glb`;

  const [first, concurrent] = await Promise.all([
    loadModelBytes(url, fetcher),
    loadModelBytes(url, fetcher),
  ]);
  const sequential = await loadModelBytes(url, fetcher);

  assert.equal(calls.length, 1, "concurrent and later consumers share one byte request");
  assert.equal(first, concurrent);
  assert.equal(first, sequential);

  let attempts = 0;
  const retryUrl = `/models/round-4/retry-${Date.now()}.glb`;
  const retryingFetcher = async () => {
    attempts += 1;
    return attempts === 1
      ? new Response("temporary failure", { status: 503 })
      : new Response(Uint8Array.from([5, 6, 7, 8]));
  };

  await assert.rejects(loadModelBytes(retryUrl, retryingFetcher), /503/);
  assert.deepEqual(
    [...new Uint8Array(await loadModelBytes(retryUrl, retryingFetcher))],
    [5, 6, 7, 8],
  );
  assert.equal(attempts, 2, "a rejected request is removed so the next consumer can retry");
});

test("round 4 network metrics retain duplicate requests and their real bytes", async () => {
  const { summarizeGlbResources } = await import("../scripts/lib/round4Metrics.mjs");
  const observe = "https://morph-lab.test/models/round-4/observe.glb";
  const summary = summarizeGlbResources([
    { name: observe, transferSize: 110, encodedBodySize: 100, decodedBodySize: 100 },
    { name: observe, transferSize: 110, encodedBodySize: 100, decodedBodySize: 100 },
    {
      name: "https://morph-lab.test/models/round-4/structure.glb",
      transferSize: 60,
      encodedBodySize: 50,
      decodedBodySize: 50,
    },
  ]);

  assert.equal(summary.requestCount, 3);
  assert.equal(summary.uniqueRequestCount, 2);
  assert.deepEqual(summary.duplicateUrls, [observe]);
  assert.equal(summary.totalTransferSize, 280);
  assert.equal(summary.totalEncodedBodySize, 250);
  assert.equal(summary.totalDecodedBodySize, 250);
});

test("round 4 documents the reference study, story, material decisions, delivery, and limitations", async () => {
  for (const path of [
    "docs/vectr-reference-study.md",
    "docs/round-4-audit.md",
    "docs/round-4-defect-list.md",
    "docs/round-4-camera-storyboard.md",
    "docs/round-4-material-system.md",
    "docs/round-4-technology-evaluation.md",
    "docs/round-4-delivery.md",
    "docs/round-4-known-limitations.md",
  ]) {
    assert.ok(existsSync(fileUrl(path)), `${path} exists`);
  }
});
