import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";

const schedulerUrl = new URL(
  "../app/scene/core/renderScheduler.ts",
  import.meta.url,
);

function createFakeRaf() {
  let nextId = 1;
  let now = 0;
  const frames = new Map();
  return {
    now: () => now,
    request(callback) {
      const id = nextId++;
      frames.set(id, callback);
      return id;
    },
    cancel(id) {
      frames.delete(id);
    },
    step(ms = 16.67) {
      now += ms;
      const queued = [...frames.values()];
      frames.clear();
      for (const callback of queued) callback(now);
    },
    get pending() {
      return frames.size;
    },
  };
}

test("coalesces invalidations into one frame and sleeps when clean", async () => {
  assert.equal(existsSync(schedulerUrl), true, "renderScheduler.ts is missing");
  if (!existsSync(schedulerUrl)) return;
  const { createRenderScheduler } = await import(schedulerUrl.href);
  const raf = createFakeRaf();
  const renders = [];
  const scheduler = createRenderScheduler({
    render: (time) => renders.push(time),
    isVisible: () => true,
    requestFrame: raf.request,
    cancelFrame: raf.cancel,
    now: raf.now,
    stableFrames: 3,
  });

  scheduler.invalidate("resize");
  scheduler.invalidate("pointer");
  assert.equal(raf.pending, 1);
  raf.step();
  assert.equal(renders.length, 1);
  assert.equal(raf.pending, 0);
  assert.equal(scheduler.getState().status, "sleeping");
});

test("renders through a transient window, settles, then stops", async () => {
  assert.equal(existsSync(schedulerUrl), true, "renderScheduler.ts is missing");
  if (!existsSync(schedulerUrl)) return;
  const { createRenderScheduler } = await import(schedulerUrl.href);
  const raf = createFakeRaf();
  let renders = 0;
  const scheduler = createRenderScheduler({
    render: () => {
      renders += 1;
    },
    isVisible: () => true,
    requestFrame: raf.request,
    cancelFrame: raf.cancel,
    now: raf.now,
    stableFrames: 3,
  });

  scheduler.startTransient(40, "pulse");
  for (let index = 0; index < 12 && raf.pending; index += 1) raf.step(16);
  assert.equal(renders, 5, "2 transient frames plus 3 stable frames");
  assert.equal(raf.pending, 0);
  assert.equal(scheduler.getState().status, "sleeping");
});

test("hidden, stopped, and disposed schedulers never retain RAF work", async () => {
  assert.equal(existsSync(schedulerUrl), true, "renderScheduler.ts is missing");
  if (!existsSync(schedulerUrl)) return;
  const { createRenderScheduler } = await import(schedulerUrl.href);
  const raf = createFakeRaf();
  let visible = false;
  let renders = 0;
  const scheduler = createRenderScheduler({
    render: () => {
      renders += 1;
    },
    isVisible: () => visible,
    requestFrame: raf.request,
    cancelFrame: raf.cancel,
    now: raf.now,
    stableFrames: 2,
  });

  scheduler.invalidate("hidden");
  assert.equal(raf.pending, 0);
  visible = true;
  scheduler.invalidate("visible");
  assert.equal(raf.pending, 1);
  scheduler.stop();
  assert.equal(raf.pending, 0);
  scheduler.invalidate("restart");
  assert.equal(raf.pending, 1);
  scheduler.dispose();
  assert.equal(raf.pending, 0);
  scheduler.invalidate("after-dispose");
  assert.equal(raf.pending, 0);
  raf.step();
  assert.equal(renders, 0);
  assert.equal(scheduler.getState().status, "disposed");
});
