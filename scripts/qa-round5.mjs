import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { copyFile, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { createServer as createNetServer } from "node:net";
import { resolve } from "node:path";

import { chromium } from "@playwright/test";

import { summarizeFrameSamples } from "./lib/round5Metrics.mjs";

const root = resolve(import.meta.dirname, "..");
const artifactRoot = resolve(root, "artifacts", "qa-round5");
const normalRoot = resolve(artifactRoot, "normal-comparisons");
const viewportRoot = resolve(artifactRoot, "viewports");
const videoSourceRoot = resolve(artifactRoot, "video-source");
const stages = ["observe", "structure", "prototype", "release"];
const stageBeforeIndexes = { observe: "03-008", structure: "14-035", prototype: "25-063", release: "36-090" };
const viewports = [
  { width: 1920, height: 1080 },
  { width: 1440, height: 900 },
  { width: 1280, height: 800 },
  { width: 1024, height: 768 },
  { width: 390, height: 844 },
];
const launchArgs = [
  "--enable-webgl",
  "--enable-gpu",
  "--ignore-gpu-blocklist",
  "--use-angle=d3d11",
];
const fastIteration = process.env.QA_ROUND5_FAST === "1";

await mkdir(artifactRoot, { recursive: true });
if (!fastIteration) {
  await rm(normalRoot, { recursive: true, force: true });
  await rm(viewportRoot, { recursive: true, force: true });
}
await rm(videoSourceRoot, { recursive: true, force: true });
await mkdir(normalRoot, { recursive: true });
await mkdir(viewportRoot, { recursive: true });

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

async function waitForServer(url, process) {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (process.exitCode !== null) throw new Error(`QA server exited: ${process.exitCode}`);
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Retry while Vite binds the selected port.
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 200));
  }
  throw new Error("QA server did not become ready.");
}

function telemetryFor(page, baseUrl) {
  const errors = [];
  const failedResponses = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("requestfailed", (request) => errors.push(`${request.url()}: ${request.failure()?.errorText}`));
  page.on("response", (response) => {
    if (response.url().startsWith(baseUrl) && response.status() >= 400) {
      failedResponses.push({ url: response.url(), status: response.status() });
    }
  });
  return { errors, failedResponses };
}

async function waitForJourneyReady(page) {
  await page.locator('.scroll-journey[data-state="ready"]').waitFor({ timeout: 20_000 });
}

async function waitForJourneyMaterials(page) {
  await page.waitForFunction(() => {
    const canvas = document.querySelector(".scroll-journey__canvas");
    return canvas?.dataset.materialsState === "ready";
  });
}

async function waitForJourney(page) {
  await waitForJourneyReady(page);
  await waitForJourneyMaterials(page);
  await page.waitForFunction(() => {
    const canvas = document.querySelector(".scroll-journey__canvas");
    return canvas?.dataset.schedulerState === "sleeping" || !canvas?.dataset.schedulerState;
  });
}

async function environmentFor(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector("canvas");
    const context = canvas?.getContext("webgl2") ?? canvas?.getContext("webgl");
    const debug = context?.getExtension("WEBGL_debug_renderer_info");
    const anisotropy = context?.getExtension("EXT_texture_filter_anisotropic");
    return {
      userAgent: navigator.userAgent,
      deviceMemory: navigator.deviceMemory ?? null,
      hardwareConcurrency: navigator.hardwareConcurrency,
      devicePixelRatio,
      activeCanvasCount: document.querySelectorAll("canvas").length,
      webglVersion: context?.getParameter(context.VERSION) ?? null,
      gpuRenderer: debug ? context.getParameter(debug.UNMASKED_RENDERER_WEBGL) : null,
      maxAnisotropy: anisotropy
        ? context.getParameter(anisotropy.MAX_TEXTURE_MAX_ANISOTROPY_EXT)
        : 1,
    };
  });
}

async function resourceEntries(page) {
  return page.evaluate(() =>
    performance.getEntriesByType("resource").map((entry) => ({
      name: entry.name,
      initiatorType: entry.initiatorType,
      startTime: Number(entry.startTime.toFixed(2)),
      duration: Number(entry.duration.toFixed(2)),
      transferSize: entry.transferSize,
      encodedBodySize: entry.encodedBodySize,
      decodedBodySize: entry.decodedBodySize,
    })),
  );
}

async function capturePerformance(browser, baseUrl) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const telemetry = telemetryFor(page, baseUrl);
  await page.goto(`${baseUrl}/?qaHero=1&qualityTier=high`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(
    () => document.querySelector(".hero-scene")?.getAttribute("data-state") === "ready",
    null,
    { timeout: 30_000 },
  );
  await page.waitForFunction(() => {
    const hero = document.querySelector(".hero-scene__canvas");
    return hero?.dataset.schedulerState === "sleeping";
  });
  const startedAt = await page.evaluate(() => {
    document.querySelector(".scroll-journey")?.scrollIntoView();
    return performance.now();
  });
  await waitForJourneyReady(page);
  const journeyTimeToSceneMs = Math.round(
    (await page.evaluate(() => performance.now())) - startedAt,
  );
  const initialResources = await resourceEntries(page);
  const initialGlbs = initialResources.filter((entry) => entry.name.endsWith(".glb"));
  await waitForJourneyMaterials(page);
  await page.locator(".scroll-journey").scrollIntoViewIfNeeded();
  const frameTimes = [];
  for (const [index, stage] of [[1, "structure"], [2, "prototype"], [3, "release"]]) {
    await page.waitForFunction(
      (targetStage) => document.querySelector(".scroll-journey__canvas")?.dataset.loadedStages
        ?.split(",")
        .includes(targetStage),
      stage,
    );
    await page.evaluate((targetIndex) => {
      const buttons = [...document.querySelectorAll(".journey-progress__button")];
      buttons[targetIndex]?.click();
    }, index);
    await page.waitForFunction(
      (targetStage) => {
        const canvas = document.querySelector(".scroll-journey__canvas");
        return canvas?.dataset.currentStage === targetStage
          && canvas.dataset.materialsState === "ready"
          && canvas.dataset.schedulerState === "sleeping";
      },
      stage,
    );
    frameTimes.push(...await page.evaluate(async (direction) => {
      const samples = [];
      const origin = window.scrollY;
      const startedAt = performance.now();
      let previous = startedAt;
      const duration = 1_200;
      await new Promise((resolveSample) => {
        function sample(now) {
          samples.push(now - previous);
          previous = now;
          const elapsed = now - startedAt;
          const phase = Math.min(1, elapsed / duration);
          window.scrollTo(0, origin + direction * Math.sin(phase * Math.PI) * 180);
          if (phase >= 1) resolveSample();
          else requestAnimationFrame(sample);
        }
        requestAnimationFrame(sample);
      });
      return samples;
    }, stage === "release" ? -1 : 1));
  }
  await page.waitForFunction(
    () => document.querySelector(".scroll-journey__canvas")?.dataset.schedulerState === "sleeping",
  );
  const canvasMetrics = await page.locator(".scroll-journey__canvas").evaluate((node) => ({
    drawCalls: Number(node.dataset.drawCalls),
    triangles: Number(node.dataset.triangles),
    dpr: Number(node.dataset.dpr),
    loadedStages: node.dataset.loadedStages?.split(",").filter(Boolean) ?? [],
    schedulerState: node.dataset.schedulerState,
  }));
  const resources = await resourceEntries(page);
  const environment = await environmentFor(page);
  await context.close();
  return {
    journeyTimeToSceneMs,
    frameSummary: summarizeFrameSamples(frameTimes),
    canvasMetrics,
    environment,
    initialResources,
    initialGlbs,
    resources,
    telemetry,
  };
}

async function captureNormalComparisons(browser, baseUrl) {
  const drawStages = [];
  for (const stage of stages) {
    const stageRoot = resolve(normalRoot, stage);
    await mkdir(stageRoot, { recursive: true });
    const beforeSource = resolve(
      root,
      "artifacts",
      "qa-round4",
      "journey-progress",
      `progress-${stageBeforeIndexes[stage]}.png`,
    );
    if (!fastIteration) {
      await copyFile(beforeSource, resolve(stageRoot, "normal-before.png"));
    }

    const modes = fastIteration
      ? [["optimized", "1"]]
      : [["disabled", "0"], ["optimized", "1"]];
    for (const [label, normalValue] of modes) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await context.newPage();
      const telemetry = telemetryFor(page, baseUrl);
      await page.goto(
        `${baseUrl}/?qaStage=${stage}&materialNormals=${normalValue}&qualityTier=high`,
        { waitUntil: "domcontentloaded" },
      );
      await page.locator(".scroll-journey").scrollIntoViewIfNeeded();
      await waitForJourney(page);
      const canvas = page.locator(".scroll-journey__canvas");
      await page.waitForFunction(() => {
        const node = document.querySelector(".scroll-journey__canvas");
        return Number(node?.dataset.peakDrawCalls ?? 0) > 0;
      });
      assert.equal(await canvas.getAttribute("data-material-normals"), normalValue === "1" ? "true" : "false");
      if (!fastIteration) {
        await page.locator(".scroll-journey__pin").screenshot({
          path: resolve(stageRoot, `normal-${label}.png`),
        });
      }
      if (label === "optimized") {
        drawStages.push(await canvas.evaluate((node) => ({
          stage: node.dataset.currentStage,
          drawCalls: Number(node.dataset.peakDrawCalls ?? node.dataset.drawCalls),
          triangles: Number(node.dataset.triangles),
          dpr: Number(node.dataset.dpr),
          normalDistanceTier: node.dataset.normalDistanceTier,
          batchDrawCallsSaved: Number(node.dataset.batchDrawCallsSaved),
          loadedStages: node.dataset.loadedStages?.split(",").filter(Boolean) ?? [],
        })));
      }
      assert.deepEqual(telemetry.errors, []);
      assert.deepEqual(telemetry.failedResponses, []);
      await context.close();
    }
  }
  return drawStages;
}

async function captureViewports(browser, baseUrl) {
  const reports = [];
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    const telemetry = telemetryFor(page, baseUrl);
    await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
    await page.locator(".scroll-journey").scrollIntoViewIfNeeded();
    const desktop = viewport.width >= 1024;
    await page.locator(`.scroll-journey[data-state="${desktop ? "ready" : "fallback"}"]`).waitFor({ timeout: 20_000 });
    await page.screenshot({ path: resolve(viewportRoot, `${viewport.width}x${viewport.height}.png`) });
    const resources = await resourceEntries(page);
    const glbs = resources.filter((entry) => entry.name.endsWith(".glb"));
    if (!desktop) assert.equal(glbs.length, 0, "mobile fallback requests zero GLBs");
    assert.equal(await page.locator("[data-performance-debug]").count(), 0);
    reports.push({ ...viewport, state: desktop ? "ready" : "fallback", glbCount: glbs.length });
    assert.deepEqual(telemetry.errors, []);
    assert.deepEqual(telemetry.failedResponses, []);
    await context.close();
  }
  return reports;
}

async function captureDebugPanel(browser, baseUrl) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.goto(`${baseUrl}/?qaStage=observe&debugPerformance=1`, { waitUntil: "domcontentloaded" });
  await waitForJourney(page);
  const panel = page.locator("[data-performance-debug]");
  await panel.waitFor();
  await page.waitForTimeout(700);
  const text = await panel.innerText();
  for (const label of ["FPS / 1% LOW", "DRAW CALLS", "GPU", "JOURNEY RAF"]) assert.match(text, new RegExp(label));
  await panel.screenshot({ path: resolve(artifactRoot, "performance-debug-panel.png") });
  await context.close();
}

async function recordVideo(browser, baseUrl, name, viewport, query = "", fallback = false) {
  const dir = resolve(videoSourceRoot, name);
  await mkdir(dir, { recursive: true });
  const context = await browser.newContext({ viewport, recordVideo: { dir, size: viewport } });
  const page = await context.newPage();
  await page.goto(`${baseUrl}/${query}`, { waitUntil: "domcontentloaded" });
  await page.locator(".scroll-journey").scrollIntoViewIfNeeded();
  await page.locator(`.scroll-journey[data-state="${fallback ? "fallback" : "ready"}"]`).waitFor({ timeout: 20_000 });
  const video = page.video();
  if (fallback) {
    await page.waitForTimeout(3_500);
  } else {
    const buttons = page.locator(".journey-progress__button");
    for (const index of [0, 1, 2, 3]) {
      await buttons.nth(index).click();
      await page.waitForTimeout(750);
    }
  }
  await page.close();
  const webm = resolve(artifactRoot, `${name}.webm`);
  await video.saveAs(webm);
  await context.close();
  const mp4 = resolve(artifactRoot, `${name}.mp4`);
  const conversion = spawnSync(
    "ffmpeg",
    ["-y", "-i", webm, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart", mp4],
    { cwd: root, encoding: "utf8" },
  );
  assert.equal(conversion.status, 0, conversion.stderr || `${name}: ffmpeg failed`);
  const file = await stat(mp4);
  assert.ok(file.size > 50_000, `${name}: MP4 is unexpectedly small`);
  await rm(webm, { force: true });
  await rm(dir, { recursive: true, force: true });
  return { file: `${name}.mp4`, bytes: file.size, viewport };
}

async function validateVideo(path) {
  const probe = spawnSync(
    "ffprobe",
    ["-v", "error", "-show_entries", "format=format_name,duration:stream=codec_name,width,height", "-of", "json", path],
    { encoding: "utf8" },
  );
  assert.equal(probe.status, 0, probe.stderr || `${path}: ffprobe failed`);
  const metadata = JSON.parse(probe.stdout);
  assert.match(metadata.format?.format_name ?? "", /mp4/);
  assert.equal(metadata.streams?.[0]?.codec_name, "h264");
  assert.ok(Number(metadata.format?.duration) >= 3);
  return metadata;
}

const port = await getFreePort();
const baseUrl = `http://127.0.0.1:${port}`;
const viteBin = resolve(root, "node_modules", "vite", "bin", "vite.js");
const serverProcess = spawn(
  process.execPath,
  [viteBin, "preview", "--host", "127.0.0.1", "--port", String(port), "--outDir", "dist/client"],
  { cwd: root, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] },
);
let browser;

try {
  await waitForServer(baseUrl, serverProcess);
  browser = await chromium.launch({ headless: true, args: launchArgs });
  const performanceReport = await capturePerformance(browser, baseUrl);
  const drawStages = await captureNormalComparisons(browser, baseUrl);
  const viewportReports = fastIteration
    ? JSON.parse(await readFile(resolve(artifactRoot, "viewport-report.json"), "utf8"))
    : await captureViewports(browser, baseUrl);
  if (!fastIteration) await captureDebugPanel(browser, baseUrl);

  const beforeVideoSource = resolve(root, "artifacts", "qa-round4", "current-before-desktop.mp4");
  const beforeVideoTarget = resolve(artifactRoot, "before-performance-1440.mp4");
  await copyFile(beforeVideoSource, beforeVideoTarget);
  const videos = fastIteration
    ? await Promise.all([
        "before-performance-1440.mp4",
        "after-performance-1440.mp4",
        "after-performance-1920.mp4",
        "after-balanced-tier.mp4",
        "after-high-tier.mp4",
        "mobile-fallback.mp4",
      ].map(async (file) => ({ file, bytes: (await stat(resolve(artifactRoot, file))).size })))
    : [
        { file: "before-performance-1440.mp4", bytes: (await stat(beforeVideoTarget)).size },
        await recordVideo(browser, baseUrl, "after-performance-1440", { width: 1440, height: 900 }, "?qualityTier=balanced"),
        await recordVideo(browser, baseUrl, "after-performance-1920", { width: 1920, height: 1080 }, "?qualityTier=high"),
        await recordVideo(browser, baseUrl, "after-balanced-tier", { width: 1440, height: 900 }, "?qualityTier=balanced"),
        await recordVideo(browser, baseUrl, "after-high-tier", { width: 1440, height: 900 }, "?qualityTier=high"),
        await recordVideo(browser, baseUrl, "mobile-fallback", { width: 390, height: 844 }, "", true),
      ];
  for (const video of videos) await validateVideo(resolve(artifactRoot, video.file));

  const capturedAt = new Date().toISOString();
  const sourceCommit = spawnSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).stdout.trim();
  const hardwareAccelerated = !/(?:swiftshader|llvmpipe|software)/i.test(performanceReport.environment.gpuRenderer ?? "");
  const performanceAfter = {
    schemaVersion: 1,
    capturedAt,
    sourceCommit,
    viewport: { width: 1440, height: 900 },
    journeyTimeToSceneMs: performanceReport.journeyTimeToSceneMs,
    frameSummary: performanceReport.frameSummary,
    canvasMetrics: performanceReport.canvasMetrics,
    environment: { ...performanceReport.environment, hardwareAccelerated },
  };
  const loadingWaterfall = {
    schemaVersion: 1,
    capturedAt,
    initialGlbCount: performanceReport.initialGlbs.length,
    resources: performanceReport.resources.filter((entry) => /\.(?:glb|ktx2|webp|png|jpg|jpeg)(?:$|\?)/i.test(entry.name)),
  };
  const drawCallReport = {
    schemaVersion: 1,
    capturedAt,
    activeBudget: 100,
    transitionBudget: 140,
    stages: drawStages,
    maxActiveDrawCalls: Math.max(...drawStages.map((stage) => stage.drawCalls)),
  };
  const textureResources = loadingWaterfall.resources.filter((entry) => /\.(?:ktx2|webp|png|jpg|jpeg)(?:$|\?)/i.test(entry.name));
  const textureReport = {
    schemaVersion: 1,
    capturedAt,
    policy: {
      colorSpace: "sRGB for screen/project color textures; no-color-space for normal/ORM",
      minFilter: "LinearMipmapLinearFilter",
      magFilter: "LinearFilter",
      mipmaps: true,
      anisotropyCaps: { low: 2, balanced: 4, high: 8 },
      normalRepeats: { paper: [2, 2], plastic: [1.5, 1.5], metal: [1, 3], rubber: [2, 2] },
      normalScales: { warmWhitePlastic: 0.01, coolCeramic: 0.006, paper: 0.012, metal: 0.014, rubber: 0.018 },
      distanceMultiplier: { near: 1, medium: 0.4, far: 0 },
    },
    resources: textureResources,
  };
  const checks = {
    journeyReadyWithinOneSecond: performanceAfter.journeyTimeToSceneMs <= 1000,
    initialJourneyRequestsAtMostTwoGlbs: loadingWaterfall.initialGlbCount <= 2,
    averageFpsAtLeast55: performanceAfter.frameSummary.averageFps >= 55,
    onePercentLowAtLeast40: performanceAfter.frameSummary.onePercentLowFps >= 40,
    averageFrameTimeAtMost18: performanceAfter.frameSummary.averageFrameTimeMs <= 18,
    consecutiveBelow25AtMost3: performanceAfter.frameSummary.consecutiveBelow25Fps <= 3,
    activeDrawCallsAtMost100: drawCallReport.maxActiveDrawCalls <= 100,
    allSchedulersSleep: performanceAfter.canvasMetrics.schedulerState === "sleeping",
    noConsoleOrRequestErrors:
      performanceReport.telemetry.errors.length === 0 &&
      performanceReport.telemetry.failedResponses.length === 0,
    mobileRequestsZeroGlbs: viewportReports.find((item) => item.width === 390)?.glbCount === 0,
    allRequiredVideosPresent: videos.length === 6,
    allNormalComparisonsPresent: drawStages.length === 4,
  };
  const summary = {
    schemaVersion: 1,
    capturedAt,
    sourceCommit,
    passed: Object.values(checks).every(Boolean),
    checks,
    performance: performanceAfter,
    drawCalls: drawCallReport,
    viewports: viewportReports,
    videos,
    environmentLimitation: hardwareAccelerated
      ? null
      : "Headless Chromium exposed a software renderer; FPS is retained as reproducible browser evidence but not claimed as physical-GPU certification.",
  };

  await Promise.all([
    writeFile(resolve(artifactRoot, "performance-after.json"), `${JSON.stringify(performanceAfter, null, 2)}\n`),
    writeFile(resolve(artifactRoot, "loading-waterfall.json"), `${JSON.stringify(loadingWaterfall, null, 2)}\n`),
    writeFile(resolve(artifactRoot, "draw-call-report.json"), `${JSON.stringify(drawCallReport, null, 2)}\n`),
    writeFile(resolve(artifactRoot, "texture-report.json"), `${JSON.stringify(textureReport, null, 2)}\n`),
    writeFile(resolve(artifactRoot, "browser-telemetry.json"), `${JSON.stringify(performanceReport.environment, null, 2)}\n`),
    writeFile(resolve(artifactRoot, "viewport-report.json"), `${JSON.stringify(viewportReports, null, 2)}\n`),
    writeFile(resolve(artifactRoot, "qa-summary.json"), `${JSON.stringify(summary, null, 2)}\n`),
  ]);
  assert.equal(summary.passed, true, JSON.stringify(checks, null, 2));
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
} finally {
  await browser?.close();
  if (serverProcess.exitCode === null) serverProcess.kill();
  await Promise.race([
    new Promise((resolveExit) => serverProcess.once("exit", resolveExit)),
    new Promise((resolveWait) => setTimeout(resolveWait, 5_000)),
  ]);
  await rm(videoSourceRoot, { recursive: true, force: true });
}
