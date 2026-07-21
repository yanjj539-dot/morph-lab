import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createServer as createNetServer } from "node:net";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { chromium } from "playwright";
import sharp from "sharp";

const root = resolve(import.meta.dirname, "..");
const artifactRoot = resolve(root, "artifacts", "qa-round2");
const lighthouseTempRoot = resolve(
  `${process.env.SystemDrive ?? "C:"}\\`,
  "Temp",
  "morph-lab-lighthouse",
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
];
const launchArgs = [
  "--enable-webgl",
  "--ignore-gpu-blocklist",
  "--enable-unsafe-swiftshader",
];

await mkdir(artifactRoot, { recursive: true });
await mkdir(lighthouseTempRoot, { recursive: true });

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

function createTelemetry(page, baseUrl) {
  const glbRequests = new Set();
  const failedRequests = [];
  const failedResponses = [];
  const consoleErrors = [];
  const pageErrors = [];

  page.on("request", (request) => {
    if (request.url().endsWith(".glb")) glbRequests.add(request.url());
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

  return {
    glbRequests,
    failedRequests,
    failedResponses,
    consoleErrors,
    pageErrors,
  };
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
  }

  assert.equal(telemetry.glbRequests.size, 4, "desktop should request all four GLBs");
  assertTelemetry(telemetry, "desktop stages");
  await context.close();
  return { glbCount: telemetry.glbRequests.size, canvasStats };
}

async function verifyProgressButtons(browser, baseUrl) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const telemetry = createTelemetry(page, baseUrl);
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await waitForJourneyState(page, "ready");
  await scrollToJourney(page);
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
  assert.equal(telemetry.glbRequests.size, 0, `${options.name}: no GLB requests`);
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
  return { glbCount: telemetry.glbRequests.size };
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

async function saveVideo(browser, baseUrl, options) {
  const videoDir = resolve(artifactRoot, "video-source");
  await mkdir(videoDir, { recursive: true });
  const context = await browser.newContext({
    viewport: options.viewport,
    recordVideo: { dir: videoDir, size: options.viewport },
    reducedMotion: "no-preference",
  });
  const page = await context.newPage();
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await waitForJourneyState(page, options.mobile ? "fallback" : "ready");
  const video = page.video();

  await page.evaluate(async ({ mobile }) => {
    const section = document.querySelector("#process");
    if (!section) throw new Error("Journey section not found.");
    const start = section.getBoundingClientRect().top + window.scrollY;
    const travel = mobile ? section.scrollHeight : window.innerHeight * 4.2;
    const duration = 5_500;
    const startedAt = performance.now();

    await new Promise((resolveScroll) => {
      const step = (time) => {
        const progress = Math.min(1, (time - startedAt) / duration);
        const eased = progress * progress * (3 - 2 * progress);
        window.scrollTo({ top: start + travel * eased, behavior: "instant" });
        if (progress < 1) requestAnimationFrame(step);
        else resolveScroll();
      };
      requestAnimationFrame(step);
    });
  }, { mobile: options.mobile });

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
    ["-v", "error", "-show_entries", "format=duration:stream=width,height", "-of", "json", mp4Path],
    { encoding: "utf8" },
  );
  assert.equal(probe.status, 0, probe.stderr || "ffprobe failed");
  const metadata = { bytes: file.size, ...JSON.parse(probe.stdout) };
  await rm(webmPath, { force: true });
  return metadata;
}

async function runLighthouse(baseUrl, mode) {
  const outputPath = resolve(artifactRoot, `lighthouse-${mode}.json`);
  const cliPath = resolve(root, "node_modules", "lighthouse", "cli", "index.js");
  const args = [
    cliPath,
    baseUrl,
    "--quiet",
    "--output=json",
    `--output-path=${outputPath}`,
    "--only-categories=performance,accessibility,best-practices,seo",
    "--chrome-flags=--headless --no-sandbox --disable-dev-shm-usage",
  ];
  if (mode === "desktop") args.push("--preset=desktop");

  const result = spawnSync(process.execPath, args, {
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
      /Runtime error encountered: EPERM[\s\S]*lighthouse\./.test(result.stderr);
    assert.ok(windowsCleanupFailure, result.stderr || `Lighthouse ${mode} failed`);
    console.warn(`Lighthouse ${mode} report completed; Windows temp cleanup returned EPERM.`);
  }
  const scores = Object.fromEntries(
    ["performance", "accessibility", "best-practices", "seo"].map((category) => [
      category,
      Math.round((report.categories[category]?.score ?? 0) * 100),
    ]),
  );

  const performanceFloor = mode === "desktop" ? 80 : 65;
  assert.ok(scores.performance >= performanceFloor, `${mode} performance ${scores.performance}`);
  for (const category of ["accessibility", "best-practices", "seo"]) {
    assert.ok(scores[category] >= 90, `${mode} ${category} ${scores[category]}`);
  }
  return scores;
}

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

  const summary = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    desktop: await captureStages(browser, baseUrl),
    progressButtons: await verifyProgressButtons(browser, baseUrl),
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
    videos: {
      desktop: await saveVideo(browser, baseUrl, {
        name: "desktop-scroll",
        viewport: { width: 1440, height: 900 },
        mobile: false,
      }),
      mobile: await saveVideo(browser, baseUrl, {
        name: "mobile-scroll",
        viewport: { width: 390, height: 844 },
        mobile: true,
      }),
    },
  };

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
      "# MORPH//LAB Round 2 QA",
      "",
      `Generated: ${summary.generatedAt}`,
      "",
      `- Desktop GLBs: ${summary.desktop.glbCount}`,
      `- Mobile GLBs: ${summary.mobile.glbCount}`,
      `- Reduced-motion GLBs: ${summary.reducedMotion.glbCount}`,
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
