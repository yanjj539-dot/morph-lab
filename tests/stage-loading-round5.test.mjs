import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";
import { AnimationClip, Group } from "three";

const preloaderUrl = new URL(
  "../app/scene/assets/stagePreloader.ts",
  import.meta.url,
);
const residencyUrl = new URL(
  "../app/scene/animation/stageResidency.ts",
  import.meta.url,
);

test("loads Observe independently and collapses duplicate stage requests", async () => {
  assert.equal(existsSync(preloaderUrl), true, "stagePreloader.ts is missing");
  if (!existsSync(preloaderUrl)) return;
  const { createStagePreloader } = await import(preloaderUrl.href);
  const calls = [];
  const preloader = createStagePreloader({
    loadStage: async (stage) => {
      calls.push(stage);
      return { stage };
    },
    scheduleIdle: (callback) => callback(),
  });

  const [first, second] = await Promise.all([
    preloader.ensure("observe", "critical"),
    preloader.ensure("observe", "critical"),
  ]);

  assert.equal(first, second);
  assert.deepEqual(calls, ["observe"]);
  assert.equal(preloader.getState("observe"), "ready");
  assert.equal(preloader.getState("structure"), "idle");
});

test("schedules Structure at idle and force-prioritizes later stages at thresholds", async () => {
  assert.equal(existsSync(preloaderUrl), true, "stagePreloader.ts is missing");
  if (!existsSync(preloaderUrl)) return;
  const { createStagePreloader, STAGE_PRELOAD_THRESHOLDS } = await import(
    preloaderUrl.href
  );
  const calls = [];
  const idleCallbacks = [];
  const preloader = createStagePreloader({
    loadStage: async (stage) => {
      calls.push(stage);
      return { stage };
    },
    scheduleIdle: (callback) => idleCallbacks.push(callback),
  });

  assert.deepEqual(STAGE_PRELOAD_THRESHOLDS, {
    structure: 0.08,
    prototype: 0.32,
    release: 0.58,
  });
  preloader.schedule("structure");
  assert.deepEqual(calls, []);
  idleCallbacks.shift()();
  await preloader.ensure("structure");
  preloader.preloadForProgress(0.31);
  assert.deepEqual(calls, ["structure"]);
  preloader.preloadForProgress(0.33);
  await preloader.ensure("prototype");
  preloader.preloadForProgress(0.59);
  await preloader.ensure("release");
  assert.deepEqual(calls, ["structure", "prototype", "release"]);
});

test("isolates a failed later stage and allows an explicit retry", async () => {
  assert.equal(existsSync(preloaderUrl), true, "stagePreloader.ts is missing");
  if (!existsSync(preloaderUrl)) return;
  const { createStagePreloader } = await import(preloaderUrl.href);
  let attempts = 0;
  const preloader = createStagePreloader({
    loadStage: async () => {
      attempts += 1;
      if (attempts === 1) throw new Error("prototype failed");
      return { stage: "prototype" };
    },
    scheduleIdle: (callback) => callback(),
  });

  await assert.rejects(preloader.ensure("prototype"), /prototype failed/);
  assert.equal(preloader.getState("prototype"), "error");
  const result = await preloader.retry("prototype");
  assert.equal(result.stage, "prototype");
  assert.equal(preloader.getState("prototype"), "ready");
});

test("supports a synchronous idle fallback without a temporal-dead-zone error", async () => {
  const { createStagePreloader } = await import(preloaderUrl.href);
  const preloader = createStagePreloader({
    loadStage: async (stage) => ({ stage }),
    scheduleIdle: (callback) => callback(),
  });

  assert.doesNotThrow(() => preloader.schedule("structure"));
  assert.equal((await preloader.ensure("structure")).stage, "structure");
});

test("evicts a nonresident stage and makes it loadable again", async () => {
  const { createStagePreloader } = await import(preloaderUrl.href);
  let loads = 0;
  let disposedStage = null;
  const preloader = createStagePreloader({
    loadStage: async (stage) => ({ stage, load: ++loads }),
    scheduleIdle: (callback) => callback(),
  });
  const first = await preloader.ensure("observe");

  preloader.evict("observe", (value) => {
    disposedStage = value.stage;
  });
  const second = await preloader.ensure("observe");

  assert.equal(disposedStage, "observe");
  assert.equal(preloader.getState("observe"), "ready");
  assert.equal(second.load, first.load + 1);
});

test("keeps only the displayed stage and a ready next stage resident", async () => {
  assert.equal(existsSync(residencyUrl), true, "stageResidency.ts is missing");
  if (!existsSync(residencyUrl)) return;
  const { residentStages } = await import(residencyUrl.href);
  const readiness = {
    observe: true,
    structure: true,
    prototype: false,
    release: false,
  };

  assert.deepEqual(residentStages(0.1, readiness), {
    desired: "observe",
    current: "observe",
    next: "structure",
    attached: ["observe", "structure"],
  });
  assert.deepEqual(residentStages(0.6, readiness), {
    desired: "prototype",
    current: "structure",
    next: undefined,
    attached: ["structure"],
  });
});

test("adds Blender clip runtimes one stage at a time", async () => {
  const { createBlenderClipController } = await import(
    "../app/scene/animation/blenderClipController.ts"
  );
  const controller = createBlenderClipController({});
  const model = {
    root: new Group(),
    animations: [new AnimationClip("OBSERVE_ACTION", 1, [])],
    expectedClipName: "OBSERVE_ACTION",
  };

  controller.addStage("observe", model);
  controller.update(0.1);
  assert.deepEqual(controller.clipNames, ["OBSERVE_ACTION"]);
  controller.removeStage("observe");
  assert.deepEqual(controller.clipNames, []);
  controller.dispose();
});
