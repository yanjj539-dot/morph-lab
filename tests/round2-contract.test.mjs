import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const stages = ["observe", "structure", "prototype", "release"];

function readPngSize(buffer) {
  assert.equal(buffer.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

function readGlbJson(buffer) {
  const jsonLength = buffer.readUInt32LE(12);
  assert.equal(buffer.subarray(16, 20).toString("ascii"), "JSON");
  return JSON.parse(buffer.subarray(20, 20 + jsonLength).toString("utf8").trim());
}

function countGlbTriangles(document) {
  return document.meshes.flatMap((mesh) => mesh.primitives).reduce((total, primitive) => {
    if ((primitive.mode ?? 4) !== 4 || primitive.indices === undefined) return total;
    return total + document.accessors[primitive.indices].count / 3;
  }, 0);
}

test("round 2 exports modular journey data and asset build commands", async () => {
  const journey = await readFile(new URL("../app/data/journey.ts", import.meta.url), "utf8");
  assert.match(journey, /export const JOURNEY_STAGES/);
  const packageJson = await readFile(new URL("../package.json", import.meta.url), "utf8");
  assert.match(packageJson, /"assets:round2"/);
});

test("round 2 blender assets exist and stay inside delivery budgets", async () => {
  for (const stage of stages) {
    const glb = await readFile(new URL(`../public/models/round-2/${stage}.glb`, import.meta.url));
    assert.equal(glb.subarray(0, 4).toString("ascii"), "glTF", `${stage} GLB magic bytes`);
    assert.ok(glb.byteLength > 40_000, `${stage} GLB should contain authored geometry`);
    assert.ok(glb.byteLength < 1_500_000, `${stage} GLB budget`);

    const document = readGlbJson(glb);
    assert.equal(document.images?.length ?? 0, 0, `${stage} screen textures stay external`);
    assert.ok(
      document.extensionsUsed?.includes("KHR_draco_mesh_compression"),
      `${stage} uses Draco mesh compression`,
    );
    const materials = new Map(document.materials.map((material) => [material.name, material]));
    for (const [name, expectedRgb] of [
      ["MAT_CobaltAccent", [36, 86, 255]],
      ["MAT_CoralAccent", [255, 113, 87]],
    ]) {
      const factor = materials.get(name)?.pbrMetallicRoughness?.baseColorFactor;
      assert.ok(factor, `${stage} ${name} exists`);
      assert.deepEqual(
        factor.slice(0, 3).map((value) => Math.round(value * 255)),
        expectedRgb,
        `${stage} ${name} color`,
      );
    }

    const fallback = await readFile(new URL(`../public/fallback/round-2/${stage}.webp`, import.meta.url));
    assert.equal(fallback.subarray(0, 4).toString("ascii"), "RIFF", `${stage} WebP RIFF header`);
    assert.equal(fallback.subarray(8, 12).toString("ascii"), "WEBP", `${stage} WebP magic bytes`);
    assert.ok(fallback.byteLength > 20_000, `${stage} fallback should not be blank`);
    assert.ok(fallback.byteLength < 350_000, `${stage} fallback budget`);
  }
});

test("round 2 visual review plates are full-size Blender renders", async () => {
  const artifactNames = ["01-observe", "02-structure", "03-prototype", "04-release"];

  for (const name of artifactNames) {
    const png = await readFile(new URL(`../artifacts/${name}.png`, import.meta.url));
    const { width, height } = readPngSize(png);
    assert.equal(width, 1600, `${name} width`);
    assert.equal(height, 1000, `${name} height`);
    assert.ok(png.byteLength > 100_000, `${name} should contain visible scene detail`);
  }
});

test("round 2 manifest records final measured assets and animation controls", async () => {
  const manifest = await readFile(new URL("../docs/3d-asset-manifest.md", import.meta.url), "utf8");

  for (const stage of stages) {
    const stageRow = manifest.split("\n").find((line) => line.startsWith(`| \`${stage}.glb\``));
    assert.match(stageRow, /\| final \|$/, `${stage} final table status`);
    const stageCells = stageRow.split("|").map((cell) => cell.trim()).filter(Boolean);
    const listedControls = [...stageCells[4].matchAll(/`([^`]+)`/g)].map((match) => match[1]);
    const heading = `### \`${stage}.glb\` - final`;
    const sectionStart = manifest.indexOf(heading);
    assert.notEqual(sectionStart, -1, `${stage} measurement section`);
    const nextSection = manifest.indexOf("\n### ", sectionStart + heading.length);
    const section = manifest.slice(sectionStart, nextSection === -1 ? undefined : nextSection);
    const glbBytes = section.match(/GLB bytes: ([1-9][0-9,]*)/)?.[1];
    assert.ok(glbBytes, `${stage} scoped GLB bytes`);
    const glb = await readFile(new URL(`../public/models/round-2/${stage}.glb`, import.meta.url));
    assert.equal(Number(glbBytes.replaceAll(",", "")), glb.byteLength, `${stage} measured GLB bytes`);
    const document = readGlbJson(glb);
    const nodeNames = new Set(document.nodes.map((node) => node.name));
    for (const control of listedControls) {
      assert.ok(nodeNames.has(control), `${stage} control ${control} exists in GLB`);
    }
    const objectCount = section.match(/Objects: ([1-9][0-9]*)/)?.[1];
    const triangleCount = section.match(/Triangles: ([1-9][0-9,]*)/)?.[1];
    assert.equal(Number(objectCount), document.nodes.length, `${stage} measured object count`);
    assert.equal(
      Number(triangleCount.replaceAll(",", "")),
      countGlbTriangles(document),
      `${stage} measured triangle count`,
    );

    assert.match(manifest, new RegExp(`\\\`${stage}\\.glb\\\`[\\s\\S]*?final`), `${stage} final status`);
    assert.match(manifest, new RegExp(`${stage}\\.glb[\\s\\S]*?GLB bytes: [1-9][0-9,]*`), `${stage} GLB bytes`);
    assert.match(manifest, new RegExp(`${stage}\\.glb[\\s\\S]*?Objects: [1-9][0-9]*`), `${stage} object count`);
    assert.match(manifest, new RegExp(`${stage}\\.glb[\\s\\S]*?Triangles: [1-9][0-9,]*`), `${stage} triangle count`);
  }

  for (const control of [
    "OBS_scan_beam",
    "STR_connectors",
    "PRO_light_ring",
    "REL_qa_rows",
  ]) {
    assert.match(manifest, new RegExp(control), `${control} listed`);
  }

  const requiredImages = [
    ...manifest.matchAll(/\| `[^`]+` \| `(public\/images\/[^`]+)` \|/g),
  ].map((match) => match[1]);
  assert.equal(requiredImages.length, 14, "all external screen image mappings are recorded");
  for (const imagePath of requiredImages) {
    const image = await readFile(new URL(`../${imagePath}`, import.meta.url));
    assert.ok(image.byteLength > 0, `${imagePath} exists`);
  }
});

test("round 2 ships a modular, pausable, disposable Three.js runtime", async () => {
  const [
    assetManifest,
    modelLoader,
    textureLoader,
    renderer,
    cameraRig,
    cameraTimeline,
    stageTimelines,
    visibility,
    disposal,
    runtime,
  ] = await Promise.all(
    [
      "../app/scene/assets/assetManifest.ts",
      "../app/scene/assets/loadModels.ts",
      "../app/scene/assets/loadTextures.ts",
      "../app/scene/core/createRenderer.ts",
      "../app/scene/core/createCameraRig.ts",
      "../app/scene/animation/cameraTimeline.ts",
      "../app/scene/animation/stageTimelines.ts",
      "../app/scene/interaction/visibilityController.ts",
      "../app/scene/core/disposeScene.ts",
      "../app/scene/createJourneyScene.ts",
    ].map((path) => readFile(new URL(path, import.meta.url), "utf8")),
  );

  for (const stage of stages) {
    assert.match(assetManifest, new RegExp(`withBasePath\\(\"/models/round-2/${stage}\\.glb\"\\)`));
  }
  assert.match(modelLoader, /GLTFLoader/);
  assert.match(modelLoader, /DRACOLoader/);
  assert.match(modelLoader, /setDecoderPath/);
  assert.match(modelLoader, /Promise\.allSettled/);
  assert.match(modelLoader, /AbortSignal/);
  assert.match(textureLoader, /SRGBColorSpace/);
  assert.match(textureLoader, /flipY\s*=\s*false/);
  assert.match(textureLoader, /anisotropy/);
  assert.match(textureLoader, /Map<string, Promise<Texture>>/);
  assert.match(textureLoader, /disposeDetachedMaterials/);
  assert.match(renderer, /Math\.min\([^\n]*1\.5/);
  assert.match(renderer, /PCFShadowMap/);
  for (const rigNode of ["CameraRig", "CameraRoot", "YawPivot", "PitchPivot"]) {
    assert.match(cameraRig, new RegExp(rigNode));
  }
  assert.match(cameraTimeline, /CatmullRomCurve3/);
  assert.match(cameraTimeline, /CAMERA_KEYFRAMES/);
  for (const control of ["OBS_scan_beam", "STR_connectors", "PRO_light_ring", "REL_qa_rows"]) {
    assert.match(stageTimelines, new RegExp(control));
  }
  assert.match(visibility, /visibilitychange/);
  assert.match(visibility, /IntersectionObserver/);
  assert.match(visibility, /document\.hidden/);
  assert.match(disposal, /geometry\.dispose\(\)/);
  assert.match(disposal, /material\.dispose\(\)/);
  assert.match(disposal, /texture\.dispose\(\)/);
  assert.match(disposal, /ImageBitmap/);
  assert.match(disposal, /renderer\.dispose\(\)/);
  assert.match(disposal, /forceContextLoss\(\)/);
  assert.match(runtime, /setProgress/);
  assert.match(runtime, /scrollToStage/);
  assert.match(runtime, /onStageChange/);
  assert.match(runtime, /setDrawRange/);
  assert.match(runtime, /signal\?: AbortSignal/);
  assert.match(runtime, /removeEventListener\("abort"/);
  assert.doesNotMatch(runtime, /BoxGeometry/);

  const cameraRigUrl = new URL(
    "../app/scene/core/createCameraRig.ts",
    import.meta.url,
  ).href;
  const cameraBehaviorScript = `
    const { createCameraRig } = await import(${JSON.stringify(cameraRigUrl)});
    const { Vector3 } = await import("three");
    const rig = createCameraRig();
    const position = new Vector3(-7.35, 4.25, 7.6);
    const target = new Vector3(-6, 0.45, -1.55);
    rig.setPose({ position, target, fov: 36, yaw: 0.06, pitch: 0.04 });
    rig.rig.updateMatrixWorld(true);
    const worldPosition = new Vector3();
    const worldDirection = new Vector3();
    rig.camera.getWorldPosition(worldPosition);
    rig.camera.getWorldDirection(worldDirection);
    const expectedDirection = target.clone().sub(worldPosition).normalize();
    console.log(worldDirection.dot(expectedDirection));
  `;
  const { stdout } = await execFileAsync(
    process.execPath,
    [
      "--no-warnings",
      "--experimental-strip-types",
      "--input-type=module",
      "-e",
      cameraBehaviorScript,
    ],
    { cwd: new URL("..", import.meta.url) },
  );
  assert.ok(Number(stdout.trim()) > 0.999999, "camera rig looks at the authored target");

  await Promise.all(
    [
      "../public/draco/gltf/draco_decoder.js",
      "../public/draco/gltf/draco_decoder.wasm",
      "../public/draco/gltf/draco_wasm_wrapper.js",
    ].map((path) => access(new URL(path, import.meta.url))),
  );
});

test("round 2 wires the split ScrollJourney shell to the Three runtime only on capable desktop motion paths", async () => {
  const [scrollJourney, journeyProgress, journeyLabels, journeyFallback] = await Promise.all(
    [
      "../app/components/ScrollJourney/ScrollJourney.tsx",
      "../app/components/ScrollJourney/JourneyProgress.tsx",
      "../app/components/ScrollJourney/JourneyLabels.tsx",
      "../app/components/ScrollJourney/JourneyFallback.tsx",
    ].map((path) => readFile(new URL(path, import.meta.url), "utf8")),
  );

  assert.match(scrollJourney, /import\(\s*["'][^"']*createJourneyScene["']\s*\)/);
  assert.match(scrollJourney, /matchMedia\(["']\(min-width:\s*1024px\)["']\)/);
  assert.match(scrollJourney, /matchMedia\(["']\(prefers-reduced-motion:\s*reduce\)["']\)/);
  assert.match(scrollJourney, /desktopQuery\.matches\s*&&\s*!reducedMotionQuery\.matches/);
  assert.match(scrollJourney, /canUseWebGL\(\)/);
  assert.match(scrollJourney, /AbortController/);
  assert.match(scrollJourney, /\.abort\(\)/);
  assert.match(scrollJourney, /labelHost/);
  assert.match(scrollJourney, /onReady/);
  assert.match(scrollJourney, /onError/);
  assert.match(scrollJourney, /loading|isLoading/);
  assert.match(scrollJourney, /fallback|isFallback/);
  assert.match(scrollJourney, /error|hasError/);
  assert.match(scrollJourney, /setProgress/);
  assert.doesNotMatch(scrollJourney, /BoxGeometry|PCFSoftShadowMap/);

  assert.match(journeyProgress, /<button\b/);
  assert.match(journeyProgress, /type=["']button["']/);
  assert.match(journeyProgress, /aria-current/);
  assert.match(journeyProgress, /JOURNEY_STAGE_PROGRESS/);
  assert.match(journeyProgress, /scrollToStage|onStageSelect|onSelectStage/);
  assert.match(journeyLabels, /labelHost|round2-projected-label/);
  assert.match(journeyFallback, /JOURNEY_STAGES/);
  assert.match(journeyFallback, /fallbackSrc/);
});

test("round 2 keeps global motion cleanup scoped to MotionController-owned triggers", async () => {
  const motionController = await readFile(
    new URL("../app/components/MotionController.tsx", import.meta.url),
    "utf8",
  );

  assert.match(motionController, /gsap\.context/);
  assert.match(motionController, /context\.revert\(\)/);
  assert.doesNotMatch(motionController, /ScrollTrigger\.getAll\(\)\.forEach\([\s\S]*?kill/);
});

test("round 2 ships a repeatable browser, video, canvas, and Lighthouse QA runner", async () => {
  const [packageJson, qaRunner, qaServer] = await Promise.all([
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../scripts/qa-round2.mjs", import.meta.url), "utf8"),
    readFile(new URL("../scripts/qa-server.mjs", import.meta.url), "utf8"),
  ]);

  assert.match(packageJson, /"qa:round2"/);
  assert.match(packageJson, /"@playwright\/test"/);
  assert.match(packageJson, /"lighthouse"/);
  assert.match(packageJson, /"sharp"/);
  assert.match(qaRunner, /chromium\.launch/);
  assert.match(qaRunner, /\.endsWith\("\.glb"\)/);
  assert.match(qaRunner, /reducedMotion:\s*"reduce"/);
  assert.match(qaRunner, /sharp\(path\)\.stats\(\)/);
  assert.match(qaRunner, /ffmpeg/);
  assert.match(qaRunner, /runLighthouse/);
  assert.match(qaServer, /process\.env\.QA_PORT/);
});
