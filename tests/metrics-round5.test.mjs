import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";

const metricsUrl = new URL("../scripts/lib/round5Metrics.mjs", import.meta.url);

test("summarizes frame samples into FPS and long-frame evidence", async () => {
  assert.equal(existsSync(metricsUrl), true, "round5Metrics.mjs is missing");
  if (!existsSync(metricsUrl)) return;

  const { summarizeFrameSamples } = await import(metricsUrl);
  const summary = summarizeFrameSamples([16, 16, 20, 55]);

  assert.equal(summary.sampleCount, 4);
  assert.equal(summary.longFrameCount, 1);
  assert.equal(summary.averageFrameTimeMs, 26.75);
  assert.equal(summary.averageFps, 37.38);
  assert.equal(summary.onePercentLowFps, 18.18);
});

test("returns a zeroed summary for an empty sample set", async () => {
  assert.equal(existsSync(metricsUrl), true, "round5Metrics.mjs is missing");
  if (!existsSync(metricsUrl)) return;

  const { summarizeFrameSamples } = await import(metricsUrl);

  assert.deepEqual(summarizeFrameSamples([]), {
    sampleCount: 0,
    averageFrameTimeMs: 0,
    averageFps: 0,
    onePercentLowFps: 0,
    longFrameCount: 0,
    consecutiveBelow25Fps: 0,
  });
});
