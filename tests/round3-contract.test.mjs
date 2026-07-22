import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile, readdir, stat } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const stages = ["observe", "structure", "prototype", "release"];

function fileUrl(path) {
  return new URL(path, root);
}

function readGlbJson(buffer) {
  assert.equal(buffer.toString("utf8", 0, 4), "glTF", "GLB magic");
  const jsonLength = buffer.readUInt32LE(12);
  const jsonType = buffer.toString("utf8", 16, 20);
  assert.equal(jsonType, "JSON", "first GLB chunk should be JSON");
  return JSON.parse(buffer.toString("utf8", 20, 20 + jsonLength));
}

function readPngSize(buffer) {
  const signature = buffer.subarray(0, 8).toString("hex");
  assert.equal(signature, "89504e470d0a1a0a", "PNG signature");
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

test("round 3 exposes a repeatable asset, geometry, test, and QA pipeline", async () => {
  const pkg = JSON.parse(await readFile(fileUrl("package.json"), "utf8"));
  assert.equal(pkg.scripts["assets:round3"], '"D:\\\\blender.exe" --background --python scripts/blender/build_round3_assets.py');
  assert.match(pkg.scripts["geometry:round3"], /check_round3_geometry\.py/);
  assert.equal(pkg.scripts["test:round3"], "node --test tests/round3-contract.test.mjs");
  assert.match(pkg.scripts["qa:round3"], /qa-round3\.mjs/);

  for (const path of [
    "scripts/blender/build_round3_assets.py",
    "scripts/blender/check_round3_geometry.py",
    "scripts/blender/bake_round3_maps.py",
    "scripts/blender/render_round3_review.py",
    "scripts/blender/export_round3_glb.py",
    "scripts/qa-round3.mjs",
  ]) {
    assert.ok(existsSync(fileUrl(path)), `${path} exists`);
  }
});

test("round 3 runtime retains Blender clips and removes arbitrary mesh draw ranges", async () => {
  const [loader, clips, stageTimelines, cameraTimeline, cameraRig, renderer, journey, motion] = await Promise.all([
    readFile(fileUrl("app/scene/assets/loadModels.ts"), "utf8"),
    readFile(fileUrl("app/scene/animation/blenderClipController.ts"), "utf8"),
    readFile(fileUrl("app/scene/animation/stageTimelines.ts"), "utf8"),
    readFile(fileUrl("app/scene/animation/cameraTimeline.ts"), "utf8"),
    readFile(fileUrl("app/scene/core/createCameraRig.ts"), "utf8"),
    readFile(fileUrl("app/scene/core/createRenderer.ts"), "utf8"),
    readFile(fileUrl("app/components/ScrollJourney/ScrollJourney.tsx"), "utf8"),
    readFile(fileUrl("app/components/MotionController.tsx"), "utf8"),
  ]);

  assert.match(loader, /animations:\s*gltf\.animations/);
  assert.match(clips, /AnimationMixer/);
  assert.match(clips, /action\.paused\s*=\s*true/);
  assert.match(clips, /action\.time\s*=/);
  assert.doesNotMatch(stageTimelines, /setDrawRange\(/);
  assert.match(stageTimelines, /root\.visible\s*=\s*stage\s*===\s*current/);
  assert.doesNotMatch(stageTimelines, /material\.(?:opacity|transparent|depthWrite)\s*=/);
  assert.doesNotMatch(cameraTimeline, /applyToCamera/);
  assert.match(cameraTimeline, /getUtoTmapping|arcLength/);
  assert.match(cameraRig, /Quaternion/);
  assert.match(cameraRig, /slerp/);
  assert.match(renderer, /AgXToneMapping/);
  assert.match(renderer, /PCFSoftShadowMap/);
  assert.match(journey, /rootMargin:\s*"0px 0px -35% 0px"/);
  assert.match(journey, /import\("\.\.\/\.\.\/scene\/createJourneyScene"\)/);
  assert.match(motion, /if\s*\(\s*!isDesktop\s*\|\|\s*prefersReducedMotion\s*\)/);
});

test("round 3 ships real compressed textures and animated GLBs inside budgets", async () => {
  const ktxSignature = "ab4b5458203230bb0d0a1a0a";
  const textureNames = [
    "paper-normal",
    "plastic-normal",
    "metal-brushed-normal",
    "rubber-normal",
    "studio-orm",
    "neutral-studio-env",
  ];

  for (const texture of textureNames) {
    const buffer = await readFile(fileUrl(`public/textures/round-3/${texture}.ktx2`));
    assert.equal(buffer.subarray(0, 12).toString("hex"), ktxSignature, `${texture} KTX2 signature`);
    assert.ok(buffer.byteLength > 100, `${texture} contains texture payload`);
  }

  let totalBytes = 0;
  for (const stage of stages) {
    const path = `public/models/round-3/${stage}.glb`;
    const buffer = await readFile(fileUrl(path));
    const document = readGlbJson(buffer);
    totalBytes += buffer.byteLength;
    assert.ok(buffer.byteLength < 1_500_000, `${stage} GLB budget`);
    assert.ok((document.nodes?.length ?? 0) >= 45, `${stage} authored node detail`);
    assert.ok((document.materials?.length ?? 0) >= 7, `${stage} material separation`);
    assert.ok((document.animations?.length ?? 0) >= 1, `${stage} exports Blender animation`);
    assert.ok(
      document.animations.some((animation) => animation.name?.includes(`${stage.toUpperCase()}_ACTION`)),
      `${stage} named action`,
    );
    assert.ok(
      document.materials.some((material) => material.doubleSided !== true),
      `${stage} does not force every material double-sided`,
    );
  }
  assert.ok(totalBytes < 4_500_000, "four Round 3 GLBs stay inside aggregate budget");
});

test("round 3 geometry report has no unresolved high or medium intersections", async () => {
  const report = JSON.parse(
    await readFile(fileUrl("artifacts/qa-round3/intersections.json"), "utf8"),
  );
  assert.equal(report.summary.high, 0);
  assert.equal(report.summary.medium, 0);
  assert.ok(report.summary.samples >= 21, "animation sampled from 0 to 100 percent");
  assert.ok(Array.isArray(report.intersections));

  const markdown = await readFile(fileUrl("artifacts/qa-round3/intersections.md"), "utf8");
  assert.match(markdown, /High:\s*0/);
  assert.match(markdown, /Medium:\s*0/);
});

test("round 3 QA evidence includes progress captures, review plates, videos, and Lighthouse", async () => {
  const artifactDirectory = fileUrl("artifacts/qa-round3/");
  const names = await readdir(artifactDirectory);
  assert.ok(names.filter((name) => /^progress-.*\.png$/.test(name)).length >= 30);

  for (const stage of stages) {
    const plate = await readFile(fileUrl(`artifacts/qa-round3/review-${stage}.png`));
    assert.deepEqual(readPngSize(plate), { width: 1600, height: 1000 });
    assert.ok(plate.byteLength > 100_000, `${stage} review plate detail`);
  }

  for (const video of [
    "desktop-1920-scroll.mp4",
    "desktop-1440-scroll.mp4",
    "mobile-390-scroll.mp4",
    "reduced-motion.mp4",
  ]) {
    assert.ok((await stat(fileUrl(`artifacts/qa-round3/${video}`))).size > 100_000, `${video} evidence`);
  }

  for (const mode of ["desktop", "mobile"]) {
    const report = JSON.parse(
      await readFile(fileUrl(`artifacts/qa-round3/lighthouse-${mode}.json`), "utf8"),
    );
    assert.ok(report.categories.performance.score >= (mode === "desktop" ? 0.9 : 0.75));
    assert.ok(report.categories.accessibility.score >= 0.95);
  }
});
