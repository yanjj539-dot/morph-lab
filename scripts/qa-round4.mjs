import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createServer as createNetServer } from "node:net";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { registerHooks } from "node:module";
import { extname, resolve } from "node:path";

import { chromium } from "playwright";
import sharp from "sharp";

import { summarizeGlbResources } from "./lib/round4Metrics.mjs";

const root = resolve(import.meta.dirname, "..");
const artifactRoot = resolve(root, "artifacts", "qa-round4");
const progressRoot = resolve(artifactRoot, "journey-progress");
const uiStateRoot = resolve(artifactRoot, "ui-states");
const contactSheetRoot = resolve(artifactRoot, "video-contact-sheets");
const lighthouseTempRoot = resolve(
  `${process.env.SystemDrive ?? "C:"}\\`,
  "Temp",
  `morph-lab-lighthouse-${process.pid}`,
);
const stages = ["observe", "structure", "prototype", "release"];
const viewportMatrix = [
  { width: 1920, height: 1080 },
  { width: 1440, height: 900 },
  { width: 1280, height: 800 },
  { width: 1024, height: 768 },
  { width: 768, height: 1024 },
  { width: 430, height: 932 },
  { width: 390, height: 844 },
  { width: 390, height: 667 },
  { width: 844, height: 390 },
];
const progressSamples = Array.from(
  { length: 41 },
  (_, index) => Number((index * 0.025).toFixed(3)),
);
const launchArgs = [
  "--enable-webgl",
  "--ignore-gpu-blocklist",
  "--enable-unsafe-swiftshader",
];
const browserTelemetrySessions = [];

await mkdir(artifactRoot, { recursive: true });
await rm(progressRoot, { force: true, recursive: true });
await rm(uiStateRoot, { force: true, recursive: true });
await rm(contactSheetRoot, { force: true, recursive: true });
await mkdir(progressRoot, { recursive: true });
await mkdir(uiStateRoot, { recursive: true });
await mkdir(contactSheetRoot, { recursive: true });
await mkdir(lighthouseTempRoot, { recursive: true });

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith(".") && !extname(specifier)) {
      const candidate = new URL(`${specifier}.ts`, context.parentURL);
      if (existsSync(candidate)) return nextResolve(candidate.href, context);
    }
    return nextResolve(specifier, context);
  },
});

function getFreePort() {
  return new Promise((resolvePort, reject) => {
    const server = createNetServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close((error) => (error ? reject(error) : resolvePort(port)));
    });
  });
}

async function waitForServer(url, serverProcess) {
  const deadline = Date.now() + 20_000;
  let lastError;

  while (Date.now() < deadline) {
    if (serverProcess.exitCode !== null) {
      throw new Error(`QA server exited with code ${serverProcess.exitCode}.`);
    }

    try {
      const response = await fetch(url);
      if (response.ok) return;
      lastError = new Error(`QA server returned ${response.status}.`);
    } catch (error) {
      lastError = error;
    }

    await new Promise((resolveWait) => setTimeout(resolveWait, 200));
  }

  throw lastError ?? new Error("QA server did not become ready.");
}

async function runAndValidateGeometry() {
  const startedAt = Date.now();
  const command = process.platform === "win32"
    ? [process.env.ComSpec ?? "C:\\Windows\\System32\\cmd.exe", ["/d", "/s", "/c", "npm run geometry:round4"]]
    : ["npm", ["run", "geometry:round4"]];
  const result = spawnSync(command[0], command[1], {
    cwd: root,
    encoding: "utf8",
    timeout: 600_000,
    windowsHide: true,
  });
  assert.equal(result.status, 0, result.stderr || result.stdout || "Round 4 geometry failed");

  const jsonPath = resolve(artifactRoot, "intersections.json");
  const markdownPath = resolve(artifactRoot, "intersections.md");
  const [jsonStat, markdownStat, report, markdown] = await Promise.all([
    stat(jsonPath),
    stat(markdownPath),
    readFile(jsonPath, "utf8").then(JSON.parse),
    readFile(markdownPath, "utf8"),
  ]);
  assert.ok(jsonStat.mtimeMs >= startedAt - 2_000, "intersections.json must be fresh");
  assert.ok(markdownStat.mtimeMs >= startedAt - 2_000, "intersections.md must be fresh");
  assert.ok(report.summary.samples >= 41, "geometry samples >= 41");
  assert.equal(report.summary.high, 0, "geometry High findings");
  assert.equal(report.summary.medium, 0, "geometry Medium findings");
  assert.equal(report.summary.topologyErrors, 0, "geometry topology errors");
  assert.equal(report.summary.surfaceFailures, 0, "surface contract failures");
  assert.equal(report.summary.environmentFailures, 0, "environment contract failures");
  assert.ok(
    report.acceptedContacts.every((item) => item.severity === "low" && item.allowRule),
    "all Low findings are explicitly allow-listed",
  );
  assert.match(markdown, /High:\s*0/);
  assert.match(markdown, /Medium:\s*0/);
  return { ...report.summary, generatedAt: new Date(jsonStat.mtimeMs).toISOString() };
}

async function writeAndValidateCameraEvidence(runtimeSamples) {
  const [{ createCameraCollisionInspector }, { Vector3 }, geometryReport] = await Promise.all([
    import("../app/scene/collision/cameraCollision.ts"),
    import("three"),
    readFile(resolve(artifactRoot, "intersections.json"), "utf8").then(JSON.parse),
  ]);
  assert.equal(runtimeSamples.length, 41, "runtime camera samples");
  const collisionInspector = createCameraCollisionInspector();
  const geometryEvidence = Object.fromEntries(
    stages.map((stage) => [
      stage,
      {
        externalOcclusion: geometryReport.environmentChecks[stage].externalOcclusion,
        internalSurfaceExposure:
          geometryReport.environmentChecks[stage].internalSurfaceExposure,
      },
    ]),
  );
  for (const [stage, evidence] of Object.entries(geometryEvidence)) {
    assert.equal(evidence.externalOcclusion.status, "pass", `${stage}: external asset hygiene`);
    assert.equal(
      evidence.internalSurfaceExposure.status,
      "pass",
      `${stage}: internal-surface asset hygiene`,
    );
  }

  const samples = runtimeSamples.map((visibility, index) => {
    const expectedProgress = index / Math.max(1, runtimeSamples.length - 1);
    assert.ok(
      Math.abs(visibility.progress - expectedProgress) <= 0.002,
      `camera sample ${index} progress ${visibility.progress}`,
    );
    const position = new Vector3(...visibility.cameraPosition);
    const clearance = collisionInspector.inspect(position, visibility.cameraNear);
    return {
      progress: Number(visibility.progress.toFixed(3)),
      stageId: visibility.stageId,
      position: visibility.cameraPosition.map((value) => Number(value.toFixed(6))),
      nearPlane: visibility.cameraNear,
      renderableMeshCount: visibility.renderableMeshCount,
      clearance: Number(clearance.clearance.toFixed(6)),
      nearestProxyId: clearance.nearestProxyId,
      nearPlaneSafe: clearance.clearance > 0 && visibility.nearPlaneSafe,
      focus: {
        configuredMeshNames: visibility.focusMeshNames,
        missingMeshNames: visibility.missingFocusMeshNames,
        hitRayCount: visibility.focusHitRayCount,
        visible: visibility.focusVisible,
      },
      externalOcclusion: {
        safe: visibility.externalOcclusionSafe,
        allowedMeshNames: visibility.allowedForegroundHitMeshNames,
        unexpectedMeshNames: visibility.unexpectedOccluderMeshNames,
      },
      internalExposure: {
        safe: visibility.internalExposureSafe,
        cameraInsideMeshNames: visibility.cameraInsideMeshNames,
        visibleBackfaceMeshNames: visibility.visibleBackfaceMeshNames,
      },
      rays: visibility.rays,
    };
  });
  const nearPlaneViolations = samples.filter((sample) => !sample.nearPlaneSafe).length;
  const internalExposures = samples.filter((sample) => !sample.internalExposure.safe).length;
  const unexpectedExternalOcclusions = samples.filter(
    (sample) => !sample.externalOcclusion.safe,
  ).length;
  const insufficientFocusEvidence = samples.filter(
    (sample) => !sample.focus.visible || sample.focus.missingMeshNames.length > 0,
  ).length;
  const allowedExternalOcclusions = samples.filter(
    (sample) => sample.externalOcclusion.allowedMeshNames.length > 0,
  ).length;
  const high = nearPlaneViolations + internalExposures;
  const medium = unexpectedExternalOcclusions + insufficientFocusEvidence;
  const report = {
    schemaVersion: 2,
    generatedAt: new Date().toISOString(),
    source: "runtime-raycast",
    viewport: { width: 1280, height: 800, aspect: 1.6 },
    summary: {
      samples: samples.length,
      high,
      medium,
      minimumClearance: Math.min(...samples.map((sample) => sample.clearance)),
      nearPlaneSafe: samples.every((sample) => sample.nearPlaneSafe),
      allowedExternalOcclusions,
      unexpectedExternalOcclusions,
      internalExposures,
      nearPlaneViolations,
      insufficientFocusEvidence,
    },
    geometryEvidence: {
      source: "intersections.json#environmentChecks",
      stages: geometryEvidence,
    },
    samples,
  };
  assert.equal(report.summary.samples, 41, "camera samples");
  assert.equal(report.summary.high, 0, "camera High findings");
  assert.equal(report.summary.medium, 0, "camera Medium findings");
  assert.equal(report.summary.nearPlaneSafe, true, "camera near-plane safety");
  assert.ok(report.summary.allowedExternalOcclusions > 0, "authored external foreground occlusion");
  assert.equal(report.summary.unexpectedExternalOcclusions, 0, "unexpected camera occlusions");
  assert.equal(report.summary.internalExposures, 0, "internal surface exposures");
  await writeFile(
    resolve(artifactRoot, "camera-collisions.json"),
    `${JSON.stringify(report, null, 2)}\n`,
    "utf8",
  );
  return report.summary;
}

function createTelemetry(page, baseUrl) {
  const glbRequests = [];
  const failedRequests = [];
  const failedResponses = [];
  const consoleErrors = [];
  const pageErrors = [];

  page.on("request", (request) => {
    if (request.url().endsWith(".glb")) glbRequests.push(request.url());
  });
  page.on("requestfailed", (request) => {
    failedRequests.push(`${request.method()} ${request.url()}: ${request.failure()?.errorText}`);
  });
  page.on("response", (response) => {
    if (response.url().startsWith(baseUrl) && response.status() >= 400) {
      failedResponses.push(`${response.status()} ${response.url()}`);
    }
  });
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));

  const telemetry = {
    glbRequests,
    failedRequests,
    failedResponses,
    consoleErrors,
    pageErrors,
  };
  browserTelemetrySessions.push(telemetry);
  return telemetry;
}

function uniqueGlbCount(telemetry) {
  return new Set(telemetry.glbRequests).size;
}

function assertTelemetry(telemetry, label) {
  assert.deepEqual(telemetry.failedRequests, [], `${label}: failed requests`);
  assert.deepEqual(telemetry.failedResponses, [], `${label}: HTTP errors`);
  assert.deepEqual(telemetry.consoleErrors, [], `${label}: console errors`);
  assert.deepEqual(telemetry.pageErrors, [], `${label}: page errors`);
}

async function waitForJourneyState(page, expected) {
  await page.waitForFunction(
    (state) => document.querySelector("#process")?.getAttribute("data-state") === state,
    expected,
    { timeout: 45_000 },
  );
}

async function scrollToJourney(page) {
  await page.evaluate(() => {
    const section = document.querySelector("#process");
    if (!section) throw new Error("Journey section not found.");
    const top = section.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top, behavior: "instant" });
  });
  await page.waitForTimeout(500);
}

async function assertViewportHealth(page, label) {
  const health = await page.evaluate(() => ({
    width: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    title: document.title,
  }));
  assert.ok(
    health.scrollWidth <= health.width + 1,
    `${label}: horizontal overflow ${health.scrollWidth} > ${health.width}`,
  );
  assert.match(health.title, /MORPH\/\/LAB/);
  return health;
}

async function assertVisibleImages(page, selector, label) {
  const failures = await page.locator(selector).evaluateAll((images) =>
    images
      .filter((image) => {
        const style = getComputedStyle(image);
        return style.display !== "none" && style.visibility !== "hidden";
      })
      .filter((image) => !image.complete || image.naturalWidth === 0)
      .map((image) => image.getAttribute("src")),
  );
  assert.deepEqual(failures, [], `${label}: undecoded visible images`);
}

async function decodeAllImages(page, selector = "img") {
  const images = page.locator(selector);
  for (let index = 0; index < await images.count(); index += 1) {
    const image = images.nth(index);
    await image.scrollIntoViewIfNeeded().catch(() => {});
    await image.evaluate(async (element) => {
      if (element.complete && element.naturalWidth > 0) return;
      await element.decode();
    });
  }
}

async function captureCanvasStats(page, name) {
  const path = resolve(artifactRoot, `${name}-canvas.png`);
  const canvas = page.locator("#process canvas");
  await canvas.screenshot({ path });
  const stats = await sharp(path).stats();
  const deviation =
    stats.channels.slice(0, 3).reduce((sum, channel) => sum + channel.stdev, 0) / 3;
  assert.ok(deviation > 4, `${name}: canvas deviation ${deviation.toFixed(2)} is blank`);
  assert.ok(stats.entropy > 1, `${name}: canvas entropy ${stats.entropy.toFixed(2)} is blank`);
  await rm(path, { force: true });
  return {
    deviation: Number(deviation.toFixed(2)),
    entropy: Number(stats.entropy.toFixed(2)),
  };
}

async function captureStages(browser, baseUrl) {
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    reducedMotion: "no-preference",
  });
  const page = await context.newPage();
  const telemetry = createTelemetry(page, baseUrl);
  const canvasStats = {};

  for (const stage of stages) {
    const requestStart = telemetry.glbRequests.length;
    await page.goto(`${baseUrl}/?qaStage=${stage}`, { waitUntil: "networkidle" });
    await waitForJourneyState(page, "ready");
    await scrollToJourney(page);
    await assertViewportHealth(page, `stage ${stage}`);
    await page.screenshot({
      path: resolve(artifactRoot, `stage-${stage}-1920x1080.png`),
      animations: "disabled",
    });
    canvasStats[stage] = await captureCanvasStats(page, `stage-${stage}`);

    const current = await page
      .locator('.journey-progress__button[aria-current="step"]')
      .textContent();
    assert.match(current ?? "", new RegExp(stage, "i"), `${stage}: active progress button`);
    const stageRequests = telemetry.glbRequests.slice(requestStart);
    assert.equal(stageRequests.length, 4, `${stage}: requests each GLB exactly once`);
    assert.equal(new Set(stageRequests).size, 4, `${stage}: requests four unique GLBs`);
  }

  assert.equal(
    telemetry.glbRequests.length,
    stages.length * 4,
    "four independent stage navigations request four GLBs each",
  );
  assertTelemetry(telemetry, "desktop stages");
  await context.close();
  return {
    glbCount: uniqueGlbCount(telemetry),
    glbRequestCount: telemetry.glbRequests.length,
    canvasStats,
  };
}

async function verifyLoadPolicy(browser, baseUrl) {
  const desktopContext = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    reducedMotion: "no-preference",
  });
  const desktopPage = await desktopContext.newPage();
  const desktopTelemetry = createTelemetry(desktopPage, baseUrl);
  await desktopPage.goto(baseUrl, { waitUntil: "networkidle" });
  await assertViewportHealth(desktopPage, "deferred desktop initial page");
  assert.equal(
    await desktopPage.locator("[data-hero-scene]").getAttribute("data-state"),
    "fallback",
    "desktop Hero remains authored fallback before intent",
  );
  assert.equal(
    await desktopPage.locator("#process").getAttribute("data-state"),
    "loading",
    "desktop Journey remains deferred while only its preview edge is visible",
  );
  assert.equal(desktopTelemetry.glbRequests.length, 0, "desktop initial page requests zero GLBs");
  assert.equal(await desktopPage.locator("#process canvas").count(), 0, "desktop initial page has no canvas");

  const initialResources = await desktopPage.evaluate(() =>
    performance.getEntriesByType("resource").map((entry) => ({
      name: entry.name,
      transferSize: entry.transferSize,
      encodedBodySize: entry.encodedBodySize,
      decodedBodySize: entry.decodedBodySize,
      initiatorType: entry.initiatorType,
    })),
  );
  const sceneStartedAt = Date.now();
  await desktopPage.locator("[data-hero-scene]").hover();
  await desktopPage.waitForFunction(
    () => document.querySelector("[data-hero-scene]")?.getAttribute("data-state") === "ready",
    null,
    { timeout: 45_000 },
  );
  const heroTimeToSceneMs = Date.now() - sceneStartedAt;
  assert.equal(desktopTelemetry.glbRequests.length, 1, "Hero requests only Observe GLB after intent");
  assert.equal(await desktopPage.locator("[data-hero-scene] canvas").count(), 1);

  const journeyStartedAt = Date.now();
  await scrollToJourney(desktopPage);
  await waitForJourneyState(desktopPage, "ready");
  const journeyTimeToSceneMs = Date.now() - journeyStartedAt;
  assert.equal(
    desktopTelemetry.glbRequests.length,
    4,
    "Hero and Journey request each GLB exactly once on one page",
  );
  assert.equal(uniqueGlbCount(desktopTelemetry), 4, "desktop Journey requests four unique GLBs");
  assert.equal(
    desktopTelemetry.glbRequests.filter((url) => url.endsWith("/observe.glb")).length,
    1,
    "Observe is shared by Hero and Journey without a duplicate transfer",
  );
  assert.equal(await desktopPage.locator("#process canvas").count(), 1, "desktop Journey creates one canvas");
  const resources = await desktopPage.evaluate(() =>
    performance.getEntriesByType("resource").map((entry) => ({
      name: entry.name,
      transferSize: entry.transferSize,
      encodedBodySize: entry.encodedBodySize,
      decodedBodySize: entry.decodedBodySize,
      initiatorType: entry.initiatorType,
    })),
  );
  const glbResources = resources.filter((entry) => entry.name.endsWith(".glb"));
  const glbMetrics = summarizeGlbResources(glbResources);
  assert.equal(glbMetrics.requestCount, 4, "ResourceTiming records one entry per GLB");
  assert.equal(glbMetrics.uniqueRequestCount, 4, "ResourceTiming records four unique GLBs");
  assert.deepEqual(glbMetrics.duplicateUrls, [], "ResourceTiming contains no duplicate GLB fetch");
  const initialNames = new Set(initialResources.map((entry) => entry.name));
  const deferredScripts = resources.filter(
    (entry) => entry.initiatorType === "script" && !initialNames.has(entry.name),
  );
  const dpr = await desktopPage.locator("#process canvas").evaluate((canvas) =>
    canvas.width / Math.max(1, canvas.getBoundingClientRect().width),
  );
  assert.ok(dpr <= 1.5 + 0.01, `DPR ${dpr} exceeds 1.5`);
  assertTelemetry(desktopTelemetry, "deferred desktop load policy");
  await desktopContext.close();

  const fallbackModes = [
    {
      name: "mobile",
      viewport: { width: 390, height: 844 },
      reducedMotion: "no-preference",
    },
    {
      name: "reduced motion",
      viewport: { width: 1440, height: 900 },
      reducedMotion: "reduce",
    },
  ];
  const fallbackResults = {};

  for (const mode of fallbackModes) {
    const context = await browser.newContext({
      viewport: mode.viewport,
      deviceScaleFactor: 1,
      reducedMotion: mode.reducedMotion,
    });
    const page = await context.newPage();
    const telemetry = createTelemetry(page, baseUrl);
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    assert.equal(await page.locator("[data-hero-scene]").getAttribute("data-state"), "fallback");
    await waitForJourneyState(page, "fallback");
    assert.equal(telemetry.glbRequests.length, 0, `${mode.name} requests zero GLBs`);
    assert.equal(await page.locator("#process canvas").count(), 0, `${mode.name} creates no canvas`);
    assertTelemetry(telemetry, `${mode.name} load policy`);
    fallbackResults[mode.name === "mobile" ? "mobile" : "reducedMotion"] = {
      glbCount: telemetry.glbRequests.length,
      state: "fallback",
    };
    await context.close();
  }

  return {
    desktop: {
      initialGlbCount: 0,
      heroGlbCount: 1,
      enteredGlbCount: 4,
      state: "ready",
      heroTimeToSceneMs,
      journeyTimeToSceneMs,
      dpr: Number(dpr.toFixed(3)),
      initialCriticalBytes: initialResources.reduce(
        (sum, entry) => sum + (entry.transferSize ?? entry.encodedBodySize ?? 0),
        0,
      ),
      threeChunkBytes: deferredScripts.reduce(
        (sum, entry) => sum + (entry.transferSize ?? entry.encodedBodySize ?? 0),
        0,
      ),
      glbResources,
    },
    ...fallbackResults,
  };
}

async function captureProgressFrames(browser, baseUrl) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
    reducedMotion: "no-preference",
  });
  const page = await context.newPage();
  const telemetry = createTelemetry(page, baseUrl);
  await page.goto(`${baseUrl}/?qaCamera=1`, { waitUntil: "networkidle" });
  await scrollToJourney(page);
  await waitForJourneyState(page, "ready");

  const journeyTop = await page.evaluate(() => {
    const section = document.querySelector("#process");
    if (!section) throw new Error("Journey section not found.");
    return section.getBoundingClientRect().top + window.scrollY;
  });

  const captures = [];
  const cameraSamples = [];
  for (const [index, progress] of progressSamples.entries()) {
    await page.evaluate(
      ({ top, value }) => {
        window.scrollTo({
          top: top + window.innerHeight * 4.2 * value,
          behavior: "instant",
        });
      },
      { top: journeyTop, value: progress },
    );
    await page.waitForFunction(
      (expectedProgress) => {
        const raw = document.querySelector(".scroll-journey__canvas")?.getAttribute("data-camera-sample");
        if (!raw) return false;
        try {
          return Math.abs(JSON.parse(raw).progress - expectedProgress) <= 0.002;
        } catch {
          return false;
        }
      },
      progress,
      { timeout: 10_000 },
    );
    const cameraSample = await page.locator(".scroll-journey__canvas").evaluate((element) => {
      const raw = element.getAttribute("data-camera-sample");
      if (!raw) throw new Error("Runtime camera sample is missing.");
      return JSON.parse(raw);
    });
    cameraSamples.push(cameraSample);
    const samplePercent = Math.round((index * 100) / (progressSamples.length - 1));
    const name = `progress-${String(index).padStart(2, "0")}-${String(samplePercent).padStart(3, "0")}.png`;
    const path = resolve(progressRoot, name);
    await page.locator(".scroll-journey__pin").screenshot({
      path,
      animations: "disabled",
    });
    const current = await page.locator('.journey-progress__button[aria-current="step"]').textContent();
    const [file, imageStats] = await Promise.all([stat(path), sharp(path).stats()]);
    const deviation =
      imageStats.channels.slice(0, 3).reduce((sum, channel) => sum + channel.stdev, 0) / 3;
    assert.ok(deviation > 4, `${name}: progress frame is blank`);
    assert.ok(imageStats.entropy > 1, `${name}: progress frame entropy is blank`);
    captures.push({
      progress,
      activeStage: current?.trim() ?? "",
      deviation: Number(deviation.toFixed(2)),
      entropy: Number(imageStats.entropy.toFixed(2)),
      bytes: file.size,
      file: `journey-progress/${name}`,
    });
  }

  assert.equal(captures.length, 41, "forty-one deterministic progress captures");
  assert.equal(cameraSamples.length, 41, "forty-one runtime raycast samples");
  assert.equal(telemetry.glbRequests.length, 4, "progress capture requests four GLBs once");
  assert.equal(uniqueGlbCount(telemetry), 4, "progress capture requests four unique GLBs");
  assertTelemetry(telemetry, "progress captures");
  await context.close();
  return { captures, cameraSamples };
}

async function verifyProgressButtons(browser, baseUrl) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const telemetry = createTelemetry(page, baseUrl);
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await scrollToJourney(page);
  await waitForJourneyState(page, "ready");
  const before = await page.evaluate(() => window.scrollY);
  await page.locator(".journey-progress__button").nth(3).click();
  await page.waitForFunction(
    () => document.querySelector('.journey-progress__button[aria-current="step"]')?.textContent?.includes("RELEASE"),
    null,
    { timeout: 10_000 },
  );
  await page.waitForTimeout(800);
  const after = await page.evaluate(() => window.scrollY);
  assert.ok(after > before + 100, "Release button should move through the pinned scroll range");
  assertTelemetry(telemetry, "progress buttons");
  await context.close();
  return { before, after };
}

async function verifyFallbackMode(browser, baseUrl, options) {
  const context = await browser.newContext({
    viewport: options.viewport,
    reducedMotion: options.reducedMotion,
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  const telemetry = createTelemetry(page, baseUrl);
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await waitForJourneyState(page, "fallback");
  await scrollToJourney(page);

  assert.equal(await page.locator("#process canvas").count(), 0, `${options.name}: no canvas`);
  assert.equal(telemetry.glbRequests.length, 0, `${options.name}: no GLB requests`);
  await assertViewportHealth(page, options.name);

  const fallbackStages = page.locator("[data-journey-fallback-stage]");
  assert.equal(await fallbackStages.count(), 4, `${options.name}: four fallback stages`);
  for (let index = 0; index < 4; index += 1) {
    await fallbackStages.nth(index).scrollIntoViewIfNeeded();
    await page.waitForTimeout(120);
  }
  await assertVisibleImages(page, ".journey-fallback__figure img", options.name);
  await fallbackStages.first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(350);
  await page.screenshot({
    path: resolve(artifactRoot, `${options.name}.png`),
    animations: "disabled",
  });
  assertTelemetry(telemetry, options.name);
  await context.close();
  return { glbCount: telemetry.glbRequests.length };
}

async function captureViewportMatrix(browser, baseUrl) {
  const context = await browser.newContext({
    viewport: viewportMatrix[0],
    reducedMotion: "no-preference",
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  const telemetry = createTelemetry(page, baseUrl);
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await scrollToJourney(page);
  await waitForJourneyState(page, "ready");
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.waitForTimeout(200);

  const results = [];
  for (const viewport of viewportMatrix) {
    await page.setViewportSize(viewport);
    await waitForJourneyState(page, viewport.width >= 1024 ? "ready" : "fallback");
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await page.waitForTimeout(350);
    results.push(await assertViewportHealth(page, `${viewport.width}x${viewport.height}`));
    await assertVisibleImages(page, ".hero-art img", `${viewport.width}x${viewport.height}`);
    await page.screenshot({
      path: resolve(artifactRoot, `layout-${viewport.width}x${viewport.height}.png`),
      animations: "disabled",
    });
  }

  assertTelemetry(telemetry, "viewport matrix");
  await context.close();
  return results;
}

async function verifyMobileMenus(browser, baseUrl) {
  const results = [];
  for (const viewport of [
    { width: 390, height: 667 },
    { width: 844, height: 390 },
  ]) {
    const context = await browser.newContext({ viewport, reducedMotion: "no-preference" });
    const page = await context.newPage();
    const telemetry = createTelemetry(page, baseUrl);
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Open navigation menu" }).click();
    const menu = page.locator("#site-mobile-menu");
    await menu.locator(".site-header__mobile-cta").scrollIntoViewIfNeeded();
    const menuHealth = await menu.evaluate((element) => ({
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
    assert.ok(menuHealth.scrollWidth <= menuHealth.clientWidth + 1, "mobile menu has no horizontal overflow");
    assert.ok(await menu.locator(".site-header__mobile-cta").isVisible(), "mobile menu CTA remains reachable");
    await page.screenshot({
      path: resolve(artifactRoot, `mobile-menu-${viewport.width}x${viewport.height}.png`),
      animations: "disabled",
    });
    await page.keyboard.press("Escape");
    assert.equal(await menu.getAttribute("aria-hidden"), "true", "Escape closes mobile menu");
    assertTelemetry(telemetry, `menu ${viewport.width}x${viewport.height}`);
    results.push({ viewport, ...menuHealth });
    await context.close();
  }
  return results;
}

async function verifyHeaderKeyboardRecovery(browser, baseUrl) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const telemetry = createTelemetry(page, baseUrl);
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.evaluate(() => window.scrollTo({ top: 1200, behavior: "instant" }));
  await waitForJourneyState(page, "ready");
  await page.waitForTimeout(300);
  const header = page.locator(".site-header");
  await header.locator("a").first().focus();
  await page.waitForTimeout(80);
  assert.equal(await header.evaluate((element) => element.classList.contains("site-header--hidden")), false);
  assertTelemetry(telemetry, "header keyboard recovery");
  await context.close();
  return { recovered: true };
}

async function captureUiStates(browser, baseUrl) {
  const desktopContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    reducedMotion: "no-preference",
  });
  const page = await desktopContext.newPage();
  const telemetry = createTelemetry(page, baseUrl);
  const shot = async (name, locator = page) => {
    const path = resolve(uiStateRoot, `${name}.png`);
    await locator.screenshot({ path, animations: "disabled" });
    const [imageStats, file] = await Promise.all([sharp(path).stats(), stat(path)]);
    assert.ok(imageStats.entropy > 0.05, `${name}: UI evidence is blank`);
    assert.ok(file.size > 1_000, `${name}: UI evidence is unexpectedly small`);
    return file.size;
  };
  const viewportShot = async (name) => {
    const path = resolve(uiStateRoot, `${name}.png`);
    await page.screenshot({ path, animations: "allow" });
    const [imageStats, file] = await Promise.all([sharp(path).stats(), stat(path)]);
    assert.ok(imageStats.entropy > 0.05, `${name}: UI viewport evidence is blank`);
    assert.ok(file.size > 1_000, `${name}: UI viewport evidence is unexpectedly small`);
    return file.size;
  };
  const waitForVisualSettle = async (durationMs = 900) => {
    await page.evaluate(
      (delay) =>
        new Promise((resolveSettle) => {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              window.setTimeout(resolveSettle, delay);
            });
          });
        }),
      durationMs,
    );
  };
  const scrollToDocumentOffset = async (selector, offset) => {
    await page.evaluate(
      ({ targetSelector, targetOffset }) => {
        const element = document.querySelector(targetSelector);
        if (!(element instanceof HTMLElement)) {
          throw new Error(`Missing scroll target ${targetSelector}`);
        }
        window.scrollTo({
          top: element.offsetTop - targetOffset,
          behavior: "instant",
        });
      },
      { targetSelector: selector, targetOffset: offset },
    );
  };
  const assertRectsInViewport = async (label, selectors, options = {}) => {
    const minimumTop =
      options.minimumTop ??
      (await page.locator(".site-header").evaluate((element) => element.getBoundingClientRect().bottom));
    const rects = await page.evaluate((targetSelectors) => {
      return targetSelectors.map((selector) => {
        const element = document.querySelector(selector);
        if (!(element instanceof HTMLElement)) {
          throw new Error(`Missing visible target ${selector}`);
        }
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return {
          selector,
          top: rect.top,
          bottom: rect.bottom,
          left: rect.left,
          right: rect.right,
          width: rect.width,
          height: rect.height,
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight,
          opacity: Number(style.opacity),
          visibility: style.visibility,
        };
      });
    }, selectors);
    for (const rect of rects) {
      assert.ok(rect.width > 0 && rect.height > 0, `${label}: ${rect.selector} has no visible box`);
      assert.ok(rect.visibility !== "hidden" && rect.opacity > 0.01, `${label}: ${rect.selector} is hidden`);
      assert.ok(rect.top >= minimumTop, `${label}: ${rect.selector} top ${rect.top} is behind header ${minimumTop}`);
      assert.ok(rect.bottom <= rect.viewportHeight, `${label}: ${rect.selector} bottom ${rect.bottom} exceeds viewport ${rect.viewportHeight}`);
      assert.ok(rect.left >= 0 && rect.right <= rect.viewportWidth, `${label}: ${rect.selector} exceeds viewport width`);
    }
    return rects;
  };
  const scrollToCtaEvidence = async () => {
    await scrollToDocumentOffset(".final-cta", 30);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await waitForVisualSettle(attempt === 0 ? 1200 : 350);
      const correction = await page.evaluate(() => {
        const targets = [
          document.querySelector("[data-cta-convergence]"),
          document.querySelector("#cta-title"),
          document.querySelector(".final-cta__button"),
        ].filter((element) => element instanceof HTMLElement);
        if (targets.length !== 3) return 0;
        const rects = targets.map((element) => element.getBoundingClientRect());
        const top = Math.min(...rects.map((rect) => rect.top));
        const bottom = Math.max(...rects.map((rect) => rect.bottom));
        if (top < 12) return top - 12;
        if (bottom > window.innerHeight - 12) return bottom - (window.innerHeight - 12);
        return 0;
      });
      if (Math.abs(correction) <= 1) break;
      await page.evaluate((delta) => window.scrollBy({ top: delta, behavior: "instant" }), correction);
    }
    await assertRectsInViewport("CTA viewport evidence", [
      "[data-cta-convergence]",
      "#cta-title",
      ".final-cta__button",
    ], { minimumTop: 0 });
  };

  await page.goto(`${baseUrl}/?qaHero=1`, { waitUntil: "networkidle" });
  await page.waitForFunction(
    () => document.querySelector("[data-hero-scene]")?.getAttribute("data-state") === "ready",
    null,
    { timeout: 45_000 },
  );
  assert.ok(telemetry.glbRequests.length <= 1, "Hero requests at most the Observe GLB");
  assert.equal(await page.locator("[data-hero-scene] canvas").count(), 1, "Hero creates one canvas");
  await shot("hero-desktop", page.locator(".hero"));
  await page.mouse.move(1200, 240);
  await shot("hero-parallax-desktop", page.locator(".hero"));
  await page.locator("[data-hero-observe-pulse] .signal-button").hover();
  await shot("hero-cta-scene-response", page.locator(".hero"));

  const header = page.locator(".site-header");
  assert.equal(await header.getAttribute("data-current-section"), "index");
  await shot("desktop-header-initial", header);
  await page.evaluate(() => window.scrollTo({ top: 900, behavior: "instant" }));
  await page.waitForFunction(() => document.querySelector(".site-header")?.classList.contains("site-header--hidden"));
  await shot("desktop-header-hidden");
  await page.evaluate(() => window.scrollBy({ top: -180, behavior: "instant" }));
  await page.waitForFunction(() => !document.querySelector(".site-header")?.classList.contains("site-header--hidden"));
  await shot("desktop-header-shown", header);

  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.locator(".scroll-cue").click();
  await page.waitForFunction(() => location.hash === "#process");
  await shot("scroll-cue-process-handoff");
  await scrollToJourney(page);
  await waitForJourneyState(page, "ready");
  await shot("hero-journey-handoff-desktop", page.locator(".scroll-journey__pin"));

  const expectedPractices = [
    ["01", "AI Visual Systems", "AI 视觉系统", "/work#abstract-persona-system"],
    ["02", "Interactive Websites", "交互网站", "/work#digital-portfolio-experiments"],
    ["03", "Physical Prototypes", "实体交互原型", "/work#emotional-interaction-device"],
    ["04", "Agent Workflows", "Agent 辅助工作流", "/work#ai-design-workflow"],
  ];
  const practice = page.locator("#practice");
  await practice.scrollIntoViewIfNeeded();
  const rows = practice.locator(".practice-row");
  assert.equal(await rows.count(), 4, "exactly four Practice rows");
  for (const [index, expected] of expectedPractices.entries()) {
    const row = rows.nth(index);
    assert.equal((await row.locator(".practice-row__index").textContent())?.trim(), expected[0]);
    assert.equal((await row.locator("h3").textContent())?.trim(), expected[1]);
    assert.equal((await row.locator(".practice-row__zh").textContent())?.trim(), expected[2]);
    assert.ok((await row.getAttribute("href"))?.endsWith(expected[3]), `Practice href ${index + 1}`);
    assert.equal(await row.evaluate((element) => element.hasAttribute("data-page-transition")), true);
    assert.equal(await row.getAttribute("aria-label"), null, "visible Practice copy remains the name");
    assert.equal(
      await page.getByRole("link", {
        name: new RegExp(`${expected[1]}\\s+${expected[2]}`),
        includeHidden: true,
      }).count(),
      1,
      `Practice accessible name ${index + 1}`,
    );
  }
  await shot("practice-default", practice);
  await rows.first().hover();
  await shot("practice-hover", practice);
  await rows.first().focus();
  await shot("practice-focus", practice);

  const expectedProjects = [
    ["abstract-persona-system", "01", "System released", "Visual system / UI", "2", "portrait", ["65 personas", "8 families", "result poster system"]],
    ["digital-portfolio-experiments", "02", "Four sites live", "Design / Frontend", "4", "wide", ["Aeroform", "Field Notes", "Smoke Fruit Sauce", "Units"]],
    ["emotional-interaction-device", "03", "Working prototype", "Interaction / Hardware", "1", "landscape", ["ESP32 prototype", "light ring", "sensor input", "sound feedback"]],
    ["ai-design-workflow", "04", "Workflow in use", "System / QA", "1", "wide", ["material intake", "human review", "browser QA", "release"]],
  ];
  for (const [id, index, status, role, galleryCount, ratio, evidence] of expectedProjects) {
    const project = page.locator(`#${id}`);
    await project.scrollIntoViewIfNeeded();
    const text = ((await project.textContent()) ?? "").replace(/\s+/g, " ");
    for (const value of [index, "2026", status, role, ...evidence]) {
      assert.ok(text.includes(value), `${id}: missing ${value}`);
    }
    assert.equal(await project.locator("[data-project-visual]").getAttribute("data-gallery-count"), galleryCount);
    assert.ok((await project.getAttribute("class"))?.includes(`project-item--${ratio}`));
    const zooms = await project.locator("[data-project-image]").evaluateAll((images) =>
      images.map((image) => Number(image.getAttribute("data-project-zoom"))),
    );
    assert.ok(zooms.every((zoom) => zoom <= 1.025), `${id}: zoom budget`);
    const cursor = project.locator(".project-cursor");
    assert.ok((await cursor.getAttribute("href"))?.endsWith(`/work#${id}`));
    assert.equal(await cursor.evaluate((element) => element.hasAttribute("data-page-transition")), true);
    await shot(`selected-work-${id}-default`, project);
    await cursor.hover();
    await shot(`selected-work-${id}-hover`, project);
    await cursor.focus();
    await shot(`selected-work-${id}-focus`, project);
  }

  const about = page.locator("#about");
  await scrollToDocumentOffset("#about", 96);
  await waitForVisualSettle(1400);
  assert.equal(await about.locator(".about-copy p").count(), 3);
  assert.equal(await about.locator(".about-process figure[data-project-mask]").count(), 4);
  assert.deepEqual(
    await about.locator(".lab-metrics dt").allTextContents(),
    ["65", "08", "04", "ESP32"],
  );
  const aboutText = (await about.innerText()).toLowerCase();
  for (const caption of ["authored geometry", "design process", "esp32 prototype", "workbench"]) {
    assert.ok(aboutText.includes(caption), `About caption: ${caption}`);
  }
  await assertRectsInViewport("About viewport evidence", ["#about h2"]);
  await viewportShot("about-evidence");

  const cta = page.locator(".final-cta");
  await scrollToCtaEvidence();
  assert.equal(await cta.getAttribute("data-nav-section"), "contact");
  assert.equal(await cta.getAttribute("data-header-theme"), "dark");
  assert.equal(await cta.locator("[data-cta-convergence]").count(), 1);
  assert.equal(await cta.locator("[data-cta-path]").count(), 4);
  assert.equal((await cta.locator("[data-cta-mark]").textContent())?.trim(), "MORPH//LAB");
  const ctaButton = cta.locator(".final-cta__button.signal-button--swap");
  assert.equal((await ctaButton.locator(".signal-button__label--primary").textContent())?.trim(), "START A CONVERSATION");
  assert.equal((await ctaButton.locator(".signal-button__label--alternate").textContent())?.trim(), "OPEN THE BRIEF");
  assert.equal(await ctaButton.locator(".signal-button__label--alternate").getAttribute("aria-hidden"), "true");
  await viewportShot("cta-before");
  await ctaButton.hover();
  await waitForVisualSettle(700);
  await assertRectsInViewport("CTA hover evidence", ["#cta-title", ".final-cta__button"], { minimumTop: 0 });
  await viewportShot("cta-after-hover");
  await ctaButton.focus();
  await waitForVisualSettle(350);
  await assertRectsInViewport("CTA focus evidence", ["#cta-title", ".final-cta__button"], { minimumTop: 0 });
  await viewportShot("cta-after-focus");

  await page.goto(baseUrl, { waitUntil: "networkidle" });
  const transitionTarget = page.locator('.site-header__desktop-links a[href="/work"]');
  await transitionTarget.evaluate((element) => element.click());
  await page.waitForFunction(() => document.documentElement.classList.contains("page-transition-leaving"));
  const layer = page.locator(".page-transition-layer");
  assert.equal(await layer.getAttribute("aria-hidden"), "true");
  assert.equal(await layer.evaluate((element) => getComputedStyle(element).pointerEvents), "auto");
  await shot("page-transition-leaving", layer);
  await page.waitForURL(`${baseUrl}/work`, { waitUntil: "domcontentloaded", timeout: 10_000 });
  await shot("page-transition-entering");
  await page.waitForFunction(() => !document.documentElement.dataset.pageTransitionState);
  assert.equal(await page.locator(".page-transition-layer").evaluate((element) => getComputedStyle(element).pointerEvents), "none");
  await page.goBack({ waitUntil: "domcontentloaded" });
  await page.reload({ waitUntil: "domcontentloaded" });
  assert.equal(new URL(page.url()).pathname, "/");
  await decodeAllImages(page);
  await assertVisibleImages(page, "img", "desktop decoded images");
  assertTelemetry(telemetry, "desktop UI states");
  await desktopContext.close();

  const fallbackResults = {};
  for (const mode of [
    { name: "mobile", viewport: { width: 390, height: 844 }, reducedMotion: "no-preference" },
    { name: "reduced-motion", viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" },
  ]) {
    const context = await browser.newContext({ viewport: mode.viewport, reducedMotion: mode.reducedMotion });
    const fallbackPage = await context.newPage();
    const fallbackTelemetry = createTelemetry(fallbackPage, baseUrl);
    await fallbackPage.goto(baseUrl, { waitUntil: "networkidle" });
    assert.equal(await fallbackPage.locator("[data-hero-scene]").getAttribute("data-state"), "fallback");
    assert.equal(await fallbackPage.locator("canvas").count(), 0);
    await scrollToJourney(fallbackPage);
    await waitForJourneyState(fallbackPage, "fallback");
    assert.equal(await fallbackPage.locator("[data-journey-fallback-stage]").count(), 4);
    assert.equal(fallbackTelemetry.glbRequests.length, 0);
    assert.equal(await fallbackPage.evaluate(() => Boolean(globalThis.THREE || globalThis.gsap)), false);
    await fallbackPage.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await fallbackPage.waitForFunction(
      () => !document.querySelector(".site-header")?.classList.contains("site-header--hidden"),
    );
    await shot(`${mode.name}-hero`, fallbackPage);
    if (mode.name === "mobile") {
      const menuButton = fallbackPage.getByRole("button", { name: "Open navigation menu" });
      await menuButton.click();
      const menu = fallbackPage.locator("#site-mobile-menu");
      assert.equal(await menu.getAttribute("aria-hidden"), "false");
      assert.equal(await fallbackPage.evaluate(() => document.body.style.overflow), "hidden");
      await fallbackPage.waitForFunction(
        () => document.activeElement?.getAttribute("aria-label") === "Close navigation menu",
      );
      await fallbackPage.evaluate(
        () => new Promise((resolveFrame) => requestAnimationFrame(() => requestAnimationFrame(resolveFrame))),
      );
      await menu.locator(".site-header__mobile-cta").evaluate((element) => element.focus());
      await fallbackPage.waitForFunction(
        () => document.activeElement?.classList.contains("site-header__mobile-cta"),
      );
      await fallbackPage.keyboard.press("Tab");
      await fallbackPage.waitForFunction(
        () => document.activeElement?.getAttribute("aria-label") === "Close navigation menu",
      );
      await fallbackPage.keyboard.press("Shift+Tab");
      await fallbackPage.waitForFunction(
        () => document.activeElement?.classList.contains("site-header__mobile-cta"),
      );
      await shot("menu-mobile-focus-trap", fallbackPage);
      await fallbackPage.keyboard.press("Escape");
      assert.equal(await menu.getAttribute("aria-hidden"), "true");
      assert.equal(await menuButton.evaluate((element) => element === document.activeElement), true);
    }
    assertTelemetry(fallbackTelemetry, mode.name);
    fallbackResults[mode.name] = { glbCount: 0, state: "fallback" };
    await context.close();
  }

  for (const failure of [
    { name: "model-failure", pattern: "**/*.glb" },
    { name: "texture-failure", pattern: "**/*.ktx2" },
  ]) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await context.route(failure.pattern, (route) => route.abort("failed"));
    const failurePage = await context.newPage();
    await failurePage.goto(`${baseUrl}/?qaHero=1`, { waitUntil: "networkidle" });
    await failurePage.waitForFunction(
      () => ["error", "fallback"].includes(document.querySelector("[data-hero-scene]")?.getAttribute("data-state") ?? ""),
      null,
      { timeout: 45_000 },
    );
    assert.ok(await failurePage.getByRole("heading", { name: /DESIGN SYSTEMS/ }).isVisible());
    await shot(`${failure.name}-authored-fallback`, failurePage);
    await context.close();
  }

  const webglContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await webglContext.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function getContext(type, ...args) {
      if (String(type).includes("webgl")) return null;
      return original.call(this, type, ...args);
    };
  });
  const webglPage = await webglContext.newPage();
  await webglPage.goto(`${baseUrl}/?qaHero=1`, { waitUntil: "networkidle" });
  assert.equal(await webglPage.locator("[data-hero-scene]").getAttribute("data-state"), "fallback");
  await scrollToJourney(webglPage);
  await waitForJourneyState(webglPage, "fallback");
  assert.equal(await webglPage.locator("canvas").count(), 0);
  await shot("webgl-failure-authored-fallback", webglPage);
  await webglContext.close();

  return { desktopGlbCount: uniqueGlbCount(telemetry), ...fallbackResults };
}

async function saveVideo(browser, baseUrl, options) {
  const videoDir = resolve(artifactRoot, "video-source");
  await mkdir(videoDir, { recursive: true });
  const context = await browser.newContext({
    viewport: options.viewport,
    recordVideo: { dir: videoDir, size: options.viewport },
    reducedMotion: options.reducedMotion ?? "no-preference",
  });
  const page = await context.newPage();
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  if (!options.fallback) await scrollToJourney(page);
  await waitForJourneyState(page, options.fallback ? "fallback" : "ready");
  const video = page.video();

  await page.evaluate(async ({ fallback }) => {
    const section = document.querySelector("#process");
    if (!section) throw new Error("Journey section not found.");
    const start = section.getBoundingClientRect().top + window.scrollY;
    const travel = fallback ? Math.max(section.scrollHeight - window.innerHeight, 1) : window.innerHeight * 4.2;
    const targets = [0, 0.25, 0.5, 0.75, 1];

    for (let index = 0; index < targets.length; index += 1) {
      const from = targets[Math.max(0, index - 1)];
      const to = targets[index];
      const duration = index === 0 ? 250 : 900;
      const startedAt = performance.now();
      await new Promise((resolveScroll) => {
        const step = (time) => {
          const progress = Math.min(1, (time - startedAt) / duration);
          const eased = progress * progress * (3 - 2 * progress);
          const value = from + (to - from) * eased;
          window.scrollTo({ top: start + travel * value, behavior: "instant" });
          if (progress < 1) requestAnimationFrame(step);
          else resolveScroll();
        };
        requestAnimationFrame(step);
      });
      await new Promise((resolveHold) => setTimeout(resolveHold, 1_000));
    }
  }, { fallback: options.fallback });

  await page.waitForTimeout(300);
  await page.close();
  const webmPath = resolve(artifactRoot, `${options.name}.webm`);
  await video.saveAs(webmPath);
  await context.close();
  await video.delete();
  await rm(videoDir, { force: true, recursive: true });

  const mp4Path = resolve(artifactRoot, `${options.name}.mp4`);
  const conversion = spawnSync(
    "ffmpeg",
    ["-y", "-i", webmPath, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart", mp4Path],
    { cwd: root, encoding: "utf8" },
  );
  assert.equal(conversion.status, 0, conversion.stderr || "ffmpeg conversion failed");
  const file = await stat(mp4Path);
  assert.ok(file.size > 100_000, `${options.name}: MP4 is unexpectedly small`);

  const probe = spawnSync(
    "ffprobe",
    [
      "-v", "error",
      "-show_entries", "format=format_name,duration:stream=codec_name,codec_type,width,height",
      "-of", "json",
      mp4Path,
    ],
    { encoding: "utf8" },
  );
  assert.equal(probe.status, 0, probe.stderr || "ffprobe failed");
  const metadata = { bytes: file.size, ...JSON.parse(probe.stdout) };
  const videoStream = metadata.streams?.find((stream) => stream.codec_type === "video");
  assert.equal(videoStream?.codec_name, "h264", `${options.name}: H.264 codec`);
  assert.equal(videoStream?.width, options.viewport.width, `${options.name}: width`);
  assert.equal(videoStream?.height, options.viewport.height, `${options.name}: height`);
  assert.match(metadata.format?.format_name ?? "", /mp4/, `${options.name}: MP4 container`);
  const durationSeconds = Number(metadata.format?.duration);
  assert.ok(durationSeconds > 3, `${options.name}: duration`);
  const contactSheetPath = resolve(contactSheetRoot, `${options.name}-contact-sheet.png`);
  const contactSheet = spawnSync(
    "ffmpeg",
    [
      "-y",
      "-i", mp4Path,
      "-vf", `fps=6/${durationSeconds},scale=320:-2:flags=lanczos,tile=3x2`,
      "-frames:v", "1",
      contactSheetPath,
    ],
    { cwd: root, encoding: "utf8" },
  );
  assert.equal(contactSheet.status, 0, contactSheet.stderr || "contact sheet generation failed");
  const contactSheetFile = await stat(contactSheetPath);
  assert.ok(contactSheetFile.size > 10_000, `${options.name}: contact sheet is unexpectedly small`);
  await rm(webmPath, { force: true });
  return {
    ...metadata,
    contactSheet: {
      file: `video-contact-sheets/${options.name}-contact-sheet.png`,
      bytes: contactSheetFile.size,
    },
  };
}

async function runLighthouse(baseUrl, mode) {
  const outputPath = resolve(artifactRoot, `lighthouse-${mode}.json`);
  const cliPath = resolve(root, "node_modules", "lighthouse", "cli", "index.js");
  const chromePort = await getFreePort();
  const chromeProfile = resolve(lighthouseTempRoot, `${mode}-profile`);
  await mkdir(chromeProfile, { recursive: true });
  await rm(outputPath, { force: true });
  const chromeProcess = spawn(
    chromium.executablePath(),
    [
      "--headless=new",
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--remote-debugging-address=127.0.0.1",
      `--remote-debugging-port=${chromePort}`,
      `--user-data-dir=${chromeProfile}`,
      "about:blank",
    ],
    { stdio: "ignore", windowsHide: true },
  );
  await waitForServer(`http://127.0.0.1:${chromePort}/json/version`, chromeProcess);
  const args = [
    cliPath,
    baseUrl,
    "--quiet",
    "--output=json",
    `--output-path=${outputPath}`,
    "--only-categories=performance,accessibility,best-practices,seo",
    `--port=${chromePort}`,
  ];
  if (mode === "desktop") args.push("--preset=desktop");

  let result;
  try {
    result = spawnSync(process.execPath, args, {
      cwd: root,
      encoding: "utf8",
      timeout: 180_000,
      env: {
        ...process.env,
        CHROME_PATH: chromium.executablePath(),
        TEMP: lighthouseTempRoot,
        TMP: lighthouseTempRoot,
        TMPDIR: lighthouseTempRoot,
      },
    });
  } finally {
    if (chromeProcess.exitCode === null) chromeProcess.kill();
  }
  let report;
  try {
    report = JSON.parse(await readFile(outputPath, "utf8"));
  } catch {
    assert.equal(result.status, 0, result.stderr || `Lighthouse ${mode} failed`);
    throw new Error(`Lighthouse ${mode} did not create a readable report.`);
  }

  if (result.status !== 0) {
    const windowsCleanupFailure =
      process.platform === "win32" &&
      /EPERM[\s\S]*(?:morph-lab-lighthouse|lighthouse\.)/i.test(result.stderr);
    assert.ok(windowsCleanupFailure, result.stderr || `Lighthouse ${mode} failed`);
    console.warn(`Lighthouse ${mode} report completed; Windows temp cleanup returned EPERM.`);
  }
  const scores = Object.fromEntries(
    ["performance", "accessibility", "best-practices", "seo"].map((category) => [
      category,
      Math.round((report.categories[category]?.score ?? 0) * 100),
    ]),
  );

  const performanceFloor = mode === "desktop" ? 90 : 75;
  assert.ok(scores.performance >= performanceFloor, `${mode} performance ${scores.performance}`);
  assert.ok(scores.accessibility >= 95, `${mode} accessibility ${scores.accessibility}`);
  assert.ok(scores.seo >= 95, `${mode} SEO ${scores.seo}`);
  return scores;
}

async function writeBudgetReports(loadPolicy, browserVersion) {
  const glbMetrics = summarizeGlbResources(loadPolicy.desktop.glbResources);
  assert.equal(glbMetrics.requestCount, stages.length, "one ResourceTiming entry per GLB");
  assert.equal(glbMetrics.uniqueRequestCount, stages.length, "four unique GLB resources");
  assert.deepEqual(glbMetrics.duplicateUrls, [], "no duplicate GLB transfer is budgeted away");
  const glbResourcesByName = new Map(
    loadPolicy.desktop.glbResources.map((entry) => [new URL(entry.name).pathname.split("/").pop(), entry]),
  );
  const assets = await Promise.all(
    stages.map(async (stage) => {
      const path = resolve(root, "public", "models", "round-4", `${stage}.glb`);
      const file = await stat(path);
      const resource = glbResourcesByName.get(`${stage}.glb`);
      assert.ok(resource, `${stage}.glb has a ResourceTiming entry`);
      return {
        stage,
        path: `public/models/round-4/${stage}.glb`,
        bytes: file.size,
        encodedBodySize: resource.encodedBodySize ?? file.size,
        decodedBodySize: resource.decodedBodySize ?? file.size,
        transferSize: resource.transferSize ?? file.size,
      };
    }),
  );
  const totalBytes = assets.reduce((sum, asset) => sum + asset.bytes, 0);
  const totalEncodedBodySize = glbMetrics.totalEncodedBodySize;
  const totalDecodedBodySize = glbMetrics.totalDecodedBodySize;
  const totalTransferSize = glbMetrics.totalTransferSize;
  assert.ok(assets.every((asset) => asset.bytes < 1_500_000), "each GLB < 1.5MB");
  assert.ok(totalBytes < 5_000_000, "total GLBs < 5MB");
  assert.equal(loadPolicy.mobile.glbCount, 0, "mobile GLB bytes are zero");
  assert.ok(loadPolicy.desktop.dpr <= 1.5, "desktop DPR <= 1.5");

  const textureFiles = [
    "paper-normal.ktx2",
    "plastic-normal.ktx2",
    "metal-brushed-normal.ktx2",
    "rubber-normal.ktx2",
    "studio-orm.ktx2",
    "neutral-studio-env.ktx2",
  ];
  const textureTotalBytes = (
    await Promise.all(
      textureFiles.map((name) => stat(resolve(root, "public", "textures", "round-3", name))),
    )
  ).reduce((sum, file) => sum + file.size, 0);
  const generatedAt = new Date().toISOString();
  const assetStats = {
    schemaVersion: 2,
    generatedAt,
    browserVersion,
    limits: { perAssetBytes: 1_500_000, totalBytes: 5_000_000 },
    totalBytes,
    totalTransferSize,
    totalEncodedBodySize,
    totalDecodedBodySize,
    assets,
    status: "pass",
    failures: [],
  };
  const networkBudget = {
    schemaVersion: 2,
    generatedAt,
    browserVersion,
    glb: {
      uniqueDesktopRequests: loadPolicy.desktop.enteredGlbCount,
      requestCount: glbMetrics.requestCount,
      duplicateUrls: glbMetrics.duplicateUrls,
      heroRequests: loadPolicy.desktop.heroGlbCount,
      totalTransferSize,
      totalEncodedBodySize,
      totalDecodedBodySize,
      mobileBytes: 0,
      reducedMotionBytes: 0,
    },
    textureTotalBytes,
    initialCriticalResourceBytes: loadPolicy.desktop.initialCriticalBytes,
    threeChunkBytes: loadPolicy.desktop.threeChunkBytes,
    dpr: loadPolicy.desktop.dpr,
    heroTimeToSceneMs: loadPolicy.desktop.heroTimeToSceneMs,
    journeyTimeToSceneMs: loadPolicy.desktop.journeyTimeToSceneMs,
    advisory: ["textureTotalBytes", "initialCriticalResourceBytes", "threeChunkBytes"],
    status: "pass",
  };
  await Promise.all([
    writeFile(resolve(artifactRoot, "asset-stats.json"), `${JSON.stringify(assetStats, null, 2)}\n`, "utf8"),
    writeFile(resolve(artifactRoot, "network-budget.json"), `${JSON.stringify(networkBudget, null, 2)}\n`, "utf8"),
  ]);
  return { assetStats, networkBudget };
}

const geometry = await runAndValidateGeometry();
const port = await getFreePort();
const baseUrl = `http://127.0.0.1:${port}`;
const serverProcess = spawn(process.execPath, ["scripts/qa-server.mjs"], {
  cwd: root,
  env: { ...process.env, QA_PORT: String(port) },
  stdio: ["ignore", "pipe", "pipe"],
});
let serverOutput = "";
serverProcess.stdout.on("data", (chunk) => {
  serverOutput += chunk;
});
serverProcess.stderr.on("data", (chunk) => {
  serverOutput += chunk;
});

let browser;
try {
  await waitForServer(baseUrl, serverProcess);
  browser = await chromium.launch({ headless: true, args: launchArgs });
  const browserVersion = await browser.version();
  const loadPolicy = await verifyLoadPolicy(browser, baseUrl);
  const desktop = await captureStages(browser, baseUrl);
  const progressEvidence = await captureProgressFrames(browser, baseUrl);
  const camera = await writeAndValidateCameraEvidence(progressEvidence.cameraSamples);
  const summary = {
    generatedAt: new Date().toISOString(),
    browserVersion,
    baseUrl,
    geometry,
    camera,
    loadPolicy,
    desktop,
    progressCaptures: progressEvidence.captures,
    progressButtons: await verifyProgressButtons(browser, baseUrl),
    uiStates: await captureUiStates(browser, baseUrl),
    mobile: await verifyFallbackMode(browser, baseUrl, {
      name: "mobile-fallback-390x844",
      viewport: { width: 390, height: 844 },
      reducedMotion: "no-preference",
    }),
    reducedMotion: await verifyFallbackMode(browser, baseUrl, {
      name: "reduced-motion-1440x900",
      viewport: { width: 1440, height: 900 },
      reducedMotion: "reduce",
    }),
    viewports: await captureViewportMatrix(browser, baseUrl),
    mobileMenus: await verifyMobileMenus(browser, baseUrl),
    headerKeyboard: await verifyHeaderKeyboardRecovery(browser, baseUrl),
    videos: {
      desktop: await saveVideo(browser, baseUrl, {
        name: "current-after-desktop",
        viewport: { width: 1440, height: 900 },
        fallback: false,
      }),
      mobile: await saveVideo(browser, baseUrl, {
        name: "current-after-mobile",
        viewport: { width: 390, height: 844 },
        fallback: true,
      }),
      reducedMotion: await saveVideo(browser, baseUrl, {
        name: "current-after-reduced-motion",
        viewport: { width: 1440, height: 900 },
        fallback: true,
        reducedMotion: "reduce",
      }),
    },
  };
  summary.budgets = await writeBudgetReports(loadPolicy, browserVersion);
  const telemetryCount = (field) =>
    browserTelemetrySessions.reduce((sum, telemetry) => sum + telemetry[field].length, 0);
  const consoleErrors = telemetryCount("consoleErrors");
  const pageErrors = telemetryCount("pageErrors");
  const failedRequests = telemetryCount("failedRequests");
  const httpErrors = telemetryCount("failedResponses");
  const telemetryErrorCount = consoleErrors + pageErrors + failedRequests + httpErrors;
  assert.equal(telemetryErrorCount, 0, "aggregated browser telemetry remains error-free");
  const browserTelemetry = {
    schemaVersion: 2,
    generatedAt: new Date().toISOString(),
    browserVersion,
    sessions: browserTelemetrySessions.length,
    consoleErrors,
    pageErrors,
    failedRequests,
    httpErrors,
    glbRequestCount: browserTelemetrySessions.reduce(
      (sum, telemetry) => sum + telemetry.glbRequests.length,
      0,
    ),
    viewportCount: viewportMatrix.length,
    progressCaptureCount: summary.progressCaptures.length,
    desktopGlbCount: summary.loadPolicy.desktop.enteredGlbCount,
    mobileGlbCount: summary.loadPolicy.mobile.glbCount,
    reducedMotionGlbCount: summary.loadPolicy.reducedMotion.glbCount,
    status: telemetryErrorCount === 0 ? "pass" : "fail",
  };
  await writeFile(
    resolve(artifactRoot, "browser-telemetry.json"),
    `${JSON.stringify(browserTelemetry, null, 2)}\n`,
    "utf8",
  );
  summary.browserTelemetry = browserTelemetry;
  await browser.close();
  browser = undefined;

  summary.lighthouse = {
    desktop: await runLighthouse(baseUrl, "desktop"),
    mobile: await runLighthouse(baseUrl, "mobile"),
  };

  await writeFile(
    resolve(artifactRoot, "qa-summary.json"),
    `${JSON.stringify(summary, null, 2)}\n`,
    "utf8",
  );
  await writeFile(
    resolve(artifactRoot, "qa-summary.md"),
    [
      "# MORPH//LAB Round 4 QA",
      "",
      `Generated: ${summary.generatedAt}`,
      "",
      `- Desktop GLBs: ${summary.desktop.glbCount}`,
      `- Mobile GLBs: ${summary.mobile.glbCount}`,
      `- Reduced-motion GLBs: ${summary.reducedMotion.glbCount}`,
      `- Progress captures: ${summary.progressCaptures.length}`,
      `- Desktop Lighthouse: ${JSON.stringify(summary.lighthouse.desktop)}`,
      `- Mobile Lighthouse: ${JSON.stringify(summary.lighthouse.mobile)}`,
      `- Viewports checked: ${viewportMatrix.map(({ width, height }) => `${width}x${height}`).join(", ")}`,
      "",
    ].join("\n"),
    "utf8",
  );

  console.log(JSON.stringify(summary, null, 2));
} finally {
  await browser?.close();
  if (serverProcess.exitCode === null) serverProcess.kill();
  await writeFile(resolve(artifactRoot, "qa-server.log"), serverOutput, "utf8");
  try {
    await rm(lighthouseTempRoot, {
      force: true,
      maxRetries: 5,
      recursive: true,
      retryDelay: 250,
    });
  } catch {
    console.warn("Lighthouse temp files are still locked; Windows will release them later.");
  }
}
