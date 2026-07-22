import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";

const storeUrl = new URL(
  "../app/scene/debug/performanceStore.ts",
  import.meta.url,
);

test("aggregates live Hero, Journey, and browser metrics without hard-coded pass fields", async () => {
  assert.equal(existsSync(storeUrl), true, "performanceStore.ts is missing");
  if (!existsSync(storeUrl)) return;
  const { createPerformanceStore } = await import(storeUrl.href);
  const store = createPerformanceStore();
  let notifications = 0;
  const unsubscribe = store.subscribe(() => {
    notifications += 1;
  });
  store.update("hero", { schedulerState: "sleeping", drawCalls: 41, dpr: 1.5 });
  store.update("journey", {
    schedulerState: "rendering",
    drawCalls: 88,
    currentStage: "prototype",
    loadedStages: ["prototype", "release"],
  });
  store.update("browser", { fps: 57.2, onePercentLow: 43.1, longTasks: 0 });
  const snapshot = store.getSnapshot();
  assert.equal(snapshot.sources.hero.drawCalls, 41);
  assert.equal(snapshot.sources.journey.currentStage, "prototype");
  assert.equal(snapshot.sources.browser.fps, 57.2);
  assert.equal(notifications, 3);
  store.remove("hero");
  assert.equal(store.getSnapshot().sources.hero, undefined);
  unsubscribe();
});

test("derives average FPS, 1% low, and frame time from measured samples", async () => {
  assert.equal(existsSync(storeUrl), true, "performanceStore.ts is missing");
  if (!existsSync(storeUrl)) return;
  const { calculateFrameMetrics } = await import(storeUrl.href);
  const metrics = calculateFrameMetrics([
    ...Array.from({ length: 99 }, () => 16),
    40,
  ]);
  assert.equal(metrics.sampleCount, 100);
  assert.equal(metrics.averageFrameTime, 16.24);
  assert.equal(metrics.fps, 61.58);
  assert.equal(metrics.onePercentLow, 25);
});
