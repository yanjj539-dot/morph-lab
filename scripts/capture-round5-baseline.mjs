import { mkdir, writeFile } from "node:fs/promises";

import { chromium } from "@playwright/test";

import { summarizeFrameSamples } from "./lib/round5Metrics.mjs";

const baseUrl = process.env.ROUND5_BASE_URL ?? "http://127.0.0.1:5195";
const outputDirectory = new URL("../artifacts/qa-round5/", import.meta.url);

const browser = await chromium.launch({ headless: true });

try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });
  await context.addInitScript(() => {
    globalThis.__round5Baseline = {
      draws: 0,
      triangles: 0,
      rafCallbacks: 0,
      longTasks: [],
    };

    const patchContext = (prototype) => {
      if (!prototype || prototype.__round5Patched) return;
      Object.defineProperty(prototype, "__round5Patched", { value: true });

      for (const methodName of [
        "drawArrays",
        "drawElements",
        "drawArraysInstanced",
        "drawElementsInstanced",
      ]) {
        const original = prototype[methodName];
        if (typeof original !== "function") continue;

        prototype[methodName] = function patchedDraw(...args) {
          globalThis.__round5Baseline.draws += 1;
          const count = methodName.includes("Elements") ? args[1] : args[2];
          const instances = methodName.includes("Instanced")
            ? args.at(-1)
            : 1;
          if (args[0] === this.TRIANGLES && Number.isFinite(count)) {
            globalThis.__round5Baseline.triangles += Math.floor(
              (count * instances) / 3,
            );
          }
          return original.apply(this, args);
        };
      }
    };

    patchContext(globalThis.WebGLRenderingContext?.prototype);
    patchContext(globalThis.WebGL2RenderingContext?.prototype);

    const nativeRequestAnimationFrame =
      globalThis.requestAnimationFrame.bind(globalThis);
    globalThis.requestAnimationFrame = (callback) =>
      nativeRequestAnimationFrame((time) => {
        globalThis.__round5Baseline.rafCallbacks += 1;
        callback(time);
      });

    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          globalThis.__round5Baseline.longTasks.push({
            startTime: entry.startTime,
            duration: entry.duration,
          });
        }
      });
      observer.observe({ type: "longtask", buffered: true });
    } catch {
      // Long Task API is optional; the environment report records an empty set.
    }
  });

  const page = await context.newPage();
  const startedAt = Date.now();
  await page.goto(`${baseUrl}/?qaProgress=0`, {
    waitUntil: "domcontentloaded",
  });
  await page
    .locator('.scroll-journey[data-state="ready"]')
    .waitFor({ timeout: 20_000 });
  const journeyTimeToSceneMs = Date.now() - startedAt;

  await page.locator(".scroll-journey").scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  const before = await page.evaluate(() => ({ ...globalThis.__round5Baseline }));
  const frameTimes = await page.evaluate(async () => {
    const samples = [];
    let previous = performance.now();
    const end = previous + 3_000;
    await new Promise((resolve) => {
      function sample(now) {
        samples.push(now - previous);
        previous = now;
        if (now >= end) resolve();
        else requestAnimationFrame(sample);
      }
      requestAnimationFrame(sample);
    });
    return samples;
  });
  const after = await page.evaluate(() => ({ ...globalThis.__round5Baseline }));

  const environment = await page.evaluate(() => {
    const canvas = document.querySelector("canvas");
    const context =
      canvas?.getContext("webgl2") ?? canvas?.getContext("webgl");
    const debug = context?.getExtension("WEBGL_debug_renderer_info");
    const anisotropy = context?.getExtension("EXT_texture_filter_anisotropic");
    return {
      userAgent: navigator.userAgent,
      deviceMemory: navigator.deviceMemory ?? null,
      hardwareConcurrency: navigator.hardwareConcurrency,
      devicePixelRatio,
      activeCanvasCount: document.querySelectorAll("canvas").length,
      webglVersion: context?.getParameter(context.VERSION) ?? null,
      gpuRenderer: debug
        ? context.getParameter(debug.UNMASKED_RENDERER_WEBGL)
        : null,
      maxAnisotropy: anisotropy
        ? context.getParameter(anisotropy.MAX_TEXTURE_MAX_ANISOTROPY_EXT)
        : 1,
    };
  });
  const resources = await page.evaluate(() =>
    performance
      .getEntriesByType("resource")
      .map((entry) => ({
        name: entry.name,
        initiatorType: entry.initiatorType,
        startTime: entry.startTime,
        duration: entry.duration,
        transferSize: entry.transferSize,
        encodedBodySize: entry.encodedBodySize,
        decodedBodySize: entry.decodedBodySize,
      }))
      .filter((entry) => /\.(?:glb|ktx2)(?:$|\?)/.test(entry.name)),
  );

  const report = {
    schemaVersion: 1,
    capturedAt: new Date().toISOString(),
    sourceCommit: "1c2db3c396c8713fa1e5ee75e01baa9d4e5d6be5",
    viewport: { width: 1440, height: 900 },
    journeyTimeToSceneMs,
    frameSummary: summarizeFrameSamples(frameTimes),
    renderActivity: {
      measurementMs: 3_000,
      rafCallbacks: after.rafCallbacks - before.rafCallbacks,
      drawCalls: after.draws - before.draws,
      trianglesSubmitted: after.triangles - before.triangles,
      longTasks: after.longTasks,
    },
    environment,
    resources,
  };

  await mkdir(outputDirectory, { recursive: true });
  await writeFile(
    new URL("performance-before.json", outputDirectory),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  await writeFile(
    new URL("loading-waterfall-before.json", outputDirectory),
    `${JSON.stringify(
      { schemaVersion: 1, capturedAt: report.capturedAt, resources },
      null,
      2,
    )}\n`,
  );
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} finally {
  await browser.close();
}
