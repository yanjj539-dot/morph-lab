# MORPH//LAB Round 5 Performance and Clarity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Journey's Observe stage usable in about one second, remove idle rendering and whole-stage transparency, and improve material/screen clarity while preserving the Round 4 experience and zero-GLB fallback contract.

**Architecture:** Keep independent Hero and Journey canvases, but share canonical parsed stage resources through reference-counted leases. Journey progressively acquires only the current/next stage, changes main stages through occlusion-timed visibility switches, and renders through an invalidation scheduler with adaptive DPR. Pure policy modules carry the loading, residency, quality, and material decisions so they can be proven in Node tests before browser QA.

**Tech Stack:** Next.js/Vinext, React 19, TypeScript, Three.js 0.185, GSAP ScrollTrigger, Playwright Chromium, Node test runner, Lighthouse, Blender-authored Draco GLB and KTX2 assets.

## Global Constraints

- Mobile and Reduced Motion request zero desktop GLBs and do not import the desktop scene runtime.
- No new dependencies, no static-image replacement of desktop WebGL, no DPR above 1.5, and no deployment in this round.
- Observe must make Journey ready without waiting for Structure, Prototype, or Release.
- Main stage materials never enter a global opacity/transparent/depth-write crossfade.
- Active draw calls are at most 100 and transition draw calls at most 140 in the authoritative QA environment.
- Failed asset promises are evicted and retryable; shared resources are disposed only after their last lease releases.
- Manual edits use `apply_patch`; every behavior change follows a witnessed failing test.

---

### Task 1: Freeze the Round 4 baseline and Round 5 contract

**Files:**
- Create: `tests/round5-contract.test.mjs`
- Create: `scripts/lib/round5Metrics.mjs`
- Create: `docs/round-5-performance-audit.md`
- Create: `artifacts/qa-round5/performance-before.json`
- Create: `artifacts/qa-round5/loading-waterfall-before.json`
- Modify: `package.json`

**Interfaces:**
- Produces: `summarizeFrameSamples(samples)`, `percentileLowFps(samples, fraction)`, and the `test:round5`/`qa:round5` script entry points.
- Consumes: Round 4 Resource Timing, renderer info, and existing QA server conventions.

- [ ] **Step 1: Write failing metric and contract tests**

```js
test("summarizeFrameSamples reports average FPS, 1% low, and long frames", () => {
  const summary = summarizeFrameSamples([16, 16, 20, 55]);
  assert.equal(summary.sampleCount, 4);
  assert.ok(summary.averageFps > 45);
  assert.ok(summary.onePercentLowFps > 17);
  assert.equal(summary.longFrameCount, 1);
});

test("Round 5 runtime exposes progressive loading and never crossfades main materials", async () => {
  assert.match(await read("app/scene/assets/stagePreloader.ts"), /0\.08[\s\S]*0\.32[\s\S]*0\.58/);
  assert.doesNotMatch(await read("app/scene/animation/stageTimelines.ts"), /material\.opacity\s*=/);
});
```

- [ ] **Step 2: Run `node --test tests/round5-contract.test.mjs` and confirm failure because the Round 5 modules/scripts do not exist.**
- [ ] **Step 3: Implement only the pure metric helpers and package script names required for the first assertions.**
- [ ] **Step 4: Build the current main-derived branch, run the pre-change browser capture, and save immutable loading/frame/draw-call/normal evidence.**
- [ ] **Step 5: Write `docs/round-5-performance-audit.md` from measured evidence, including the 4.3-second Round 4 Journey baseline and environment identity.**
- [ ] **Step 6: Re-run the metric subset and commit the baseline evidence and tests.**

### Task 2: Add reference-counted parsed asset leases

**Files:**
- Create: `app/scene/assets/gpuResourceRefCount.ts`
- Create: `app/scene/assets/gltfAssetCache.ts`
- Create: `app/scene/assets/textureAssetCache.ts`
- Modify: `app/scene/assets/loadModels.ts`
- Modify: `app/scene/assets/loadTextures.ts`
- Modify: `app/scene/assets/modelByteCache.ts`
- Test: `tests/asset-cache-round5.test.mjs`

**Interfaces:**
- Produces: `acquireStageAsset(stage, options): Promise<StageAssetLease>`, `StageAssetLease.instantiate(name): LoadedStageModel`, and idempotent `StageAssetLease.release()`.
- Produces: `acquireTexture(url, configure): Promise<TextureLease>` with retryable failures and reference-counted disposal.
- Consumes: the existing Round 4 manifest, Draco decoder path, raw byte cache, material/UV application code, and abort signals.

- [ ] **Step 1: Write failing tests for concurrent acquisition, shared canonical geometry/texture identity, independent material mutation, idempotent release, last-owner disposal, abort isolation, and failed-request retry.**

```js
const first = await acquire(factory);
const second = await acquire(factory);
assert.equal(first.resource, second.resource);
first.release();
assert.equal(disposeCount, 0);
second.release();
assert.equal(disposeCount, 1);
```

- [ ] **Step 2: Run `node --test tests/asset-cache-round5.test.mjs` and confirm expected missing-module failures.**
- [ ] **Step 3: Implement a small keyed reference counter whose lease release is idempotent and whose rejected creation promise is deleted.**
- [ ] **Step 4: Implement canonical GLTF parse caching and safe instance creation: cloned hierarchy, shared geometry/textures, cloned mutable materials, shared animation clips.**
- [ ] **Step 5: Move shared texture acquisition behind texture leases and retain per-surface clones for independent UV transforms.**
- [ ] **Step 6: Update Hero/Journey disposal to release leases instead of disposing shared canonical resources directly.**
- [ ] **Step 7: Run cache tests plus Round 2–4 contract tests and commit.**

### Task 3: Make Journey progressive and residency-aware

**Files:**
- Create: `app/scene/assets/stagePreloader.ts`
- Create: `app/scene/animation/stageResidency.ts`
- Modify: `app/scene/createJourneyScene.ts`
- Modify: `app/scene/createHeroScene.ts`
- Modify: `app/components/ScrollJourney/ScrollJourney.tsx`
- Modify: `app/scene/animation/blenderClipController.ts`
- Modify: `app/scene/interaction/projectedLabels.ts`
- Test: `tests/stage-loading-round5.test.mjs`

**Interfaces:**
- Produces: `createStagePreloader(loadStage, scheduleIdle)` with `ensure(stage, priority)`, `getState(stage)`, `subscribe(listener)`, and `dispose()`.
- Produces: `residentStages(progress, readiness): { current; next?; attached }` with at most two attached stages.
- Extends `JourneySceneController` with `getPerformanceState()` for QA and debug overlay data.

- [ ] **Step 1: Write failing pure tests for Observe-first readiness, idle Structure preload, forced thresholds `0.08/0.32/0.58`, duplicate request collapse, at-most-two residency, and later-stage error isolation.**
- [ ] **Step 2: Run the targeted test and witness the missing behavior.**
- [ ] **Step 3: Implement `stagePreloader.ts` and `stageResidency.ts` without Three.js dependencies.**
- [ ] **Step 4: Refactor Journey initialization so renderer/UI exist first, Observe alone triggers `onReady`, and later loaders attach asynchronously without rebuilding the controller.**
- [ ] **Step 5: Warm decoder infrastructure and Observe/Structure bytes during Hero idle time without creating a second Journey scene.**
- [ ] **Step 6: Ensure a missing later stage retains the authored plate and current live stage, and expose development-only load states.**
- [ ] **Step 7: Run targeted tests, browser network smoke (desktop four unique GLBs eventually; mobile/reduced zero), and commit.**

### Task 4: Replace stage crossfade with occlusion switching and shadow residency

**Files:**
- Modify: `app/scene/animation/stageTimelines.ts`
- Modify: `app/scene/animation/cameraTimeline.ts`
- Create: `app/scene/animation/stageSwitchPolicy.ts`
- Modify: `app/scene/lighting/stageLightStates.ts`
- Modify: `app/scene/lighting/studioLightRig.ts`
- Modify: `app/scene/createJourneyScene.ts`
- Test: `tests/stage-switch-round5.test.mjs`
- Test: `tests/camera-rig-round4.test.mjs`

**Interfaces:**
- Produces: `sampleStageSwitch(progress): { outgoing; incoming; switchPoint; switched }`.
- Produces: `applyStageResidency(models, state, quality)` that keeps main materials unchanged and enables shadows only for current primary opaque meshes.

- [ ] **Step 1: Write failing tests that snapshot material opacity/transparent/depthWrite, sample every 1%, and assert no main-material mutation while root visibility switches exactly once per transition.**
- [ ] **Step 2: Run the tests and confirm the existing full-material opacity implementation fails them.**
- [ ] **Step 3: Implement named switch windows aligned with Round 4 foreground occlusion segments and update stage roots by visibility/attachment only.**
- [ ] **Step 4: Remove material snapshot/crossfade code and preserve only route/DOM/explicit auxiliary fades.**
- [ ] **Step 5: Disable shadow participation for next/hidden roots and set `renderer.shadowMap.autoUpdate = false`, invalidating shadow maps only on stage/meaningful animation changes.**
- [ ] **Step 6: Re-run Round 4 camera tests, the new 101-sample switch test, and representative screenshots; commit.**

### Task 5: Add Dirty Render and adaptive stationary clarity

**Files:**
- Create: `app/scene/core/renderScheduler.ts`
- Create: `app/scene/core/dynamicResolution.ts`
- Modify: `app/scene/core/qualityManager.ts`
- Modify: `app/scene/core/createRenderer.ts`
- Modify: `app/scene/createHeroScene.ts`
- Modify: `app/scene/createJourneyScene.ts`
- Modify: `app/scene/interaction/visibilityController.ts`
- Test: `tests/render-scheduler-round5.test.mjs`
- Test: `tests/quality-round5.test.mjs`

**Interfaces:**
- Produces: `createRenderScheduler({ render, isVisible, requestFrame, cancelFrame, stableFrames })` implementing the approved scheduler API.
- Produces: `createDynamicResolutionController({ activeDpr, idleDpr, minDpr: 1, maxDpr: 1.5, cooldownMs: 2000 })`.
- Quality settings add `activeDpr`, `idleDpr`, `targetFps`, `transmissionResolutionScale`, and `stableFrameCount`.

- [ ] **Step 1: Write deterministic failing tests with a fake RAF clock for invalidation coalescing, transient settling, hidden/offscreen stop, disposal, DPR down/up thresholds, cooldown, and idle sharp frames.**
- [ ] **Step 2: Run targeted tests and confirm missing APIs fail.**
- [ ] **Step 3: Implement scheduler and dynamic resolution as framework-independent modules.**
- [ ] **Step 4: Replace perpetual Hero/Journey RAF loops with invalidation callbacks and transient windows; invalidate from scroll, pointer, resize, pulse, stage, texture, animation, and visibility events.**
- [ ] **Step 5: Stop unconditional `scene.updateMatrixWorld(true)` and freeze static root transforms while preserving animated descendants/camera updates.**
- [ ] **Step 6: Apply tier DPR `1.5/1.25/1.0`, active adaptation, 180–250ms stationary restoration, and one/two sharp final frames.**
- [ ] **Step 7: Run scheduler/quality tests and a browser idle-RAF assertion; commit.**

### Task 6: Reduce micro-normal aliasing and sharpen screen textures

**Files:**
- Modify: `app/scene/materials/normalMapPolicy.ts`
- Modify: `app/scene/materials/materialFactory.ts`
- Modify: `app/scene/materials/loadCompressedTextures.ts`
- Modify: `app/scene/assets/loadTextures.ts`
- Modify: `app/scene/materials/createScreenMaterial.ts`
- Modify: `app/scene/materials/screenMaterial.ts`
- Modify: `app/scene/materials/textureManifest.ts`
- Modify: `app/scene/core/createRenderer.ts`
- Modify: `app/scene/createHeroScene.ts`
- Modify: `app/scene/createJourneyScene.ts`
- Test: `tests/normal-map-policy-round5.test.mjs`
- Test: `tests/texture-clarity-round5.test.mjs`

**Interfaces:**
- Produces: `readMaterialNormalOverride(search)`, `normalPolicyFor(material, distanceTier)`, and `configureScreenTexture(texture, capability, tier)`.
- Consumes: camera/stage changes and existing UV-fit surface clones.

- [ ] **Step 1: Write failing tests for `?materialNormals=0`, approved per-material scales/repeats, near/medium/far behavior, sRGB/trilinear/linear/mipmap screen filtering, and anisotropy tier caps.**
- [ ] **Step 2: Run tests and confirm current scales/repeats fail.**
- [ ] **Step 3: Implement the normal override and lower-frequency profiles; update distance tier only when camera/stage state crosses a boundary.**
- [ ] **Step 4: Configure screen/project textures with correct color space, mip filters, mipmaps, and capability/tier anisotropy while retaining independent UV clones.**
- [ ] **Step 5: Set Balanced transmission scale to `0.5`, reserve physical transmission for near key objects, and move fog start farther without changing the blue-white direction.**
- [ ] **Step 6: Capture each stage before/disabled/optimized at identical camera progress and compare noise/edge metrics plus human-visible plates.**
- [ ] **Step 7: Run material, UV, texture, and historical tests; commit.**

### Task 7: Performance overlay, authoritative QA, documentation, and knowledge capture

**Files:**
- Create: `app/components/PerformanceDebugPanel.tsx`
- Create: `app/scene/debug/performanceStore.ts`
- Create: `scripts/qa-round5.mjs`
- Create: `docs/round-5-delivery.md`
- Create: `docs/round-5-known-limitations.md`
- Modify: `app/page.tsx`
- Modify: `package.json`
- Modify: `C:/Users/严/Documents/知识库/知识库/01_网页设计/01_艺术化网页设计语言/2026年07月19日-MORPH-LAB工业编辑式3D官网实现经验.md`
- Test: `tests/round5-contract.test.mjs`

**Interfaces:**
- Produces: `?debugPerformance=1` overlay and `npm run qa:round5`.
- Produces required `artifacts/qa-round5/*.mp4`, normal comparison images, performance reports, loading waterfall, draw-call report, texture report, telemetry, and `qa-summary.json`.

- [ ] **Step 1: Extend the failing Round 5 contract to require every report/video/image path, live metric source, no hard-coded pass fields, and thresholds from the brief.**
- [ ] **Step 2: Run the contract and confirm missing overlay/QA outputs fail.**
- [ ] **Step 3: Implement a query-gated, non-production-default overlay backed by actual renderer/scheduler/preloader/Long Task measurements.**
- [ ] **Step 4: Implement `qa-round5.mjs` using owned server/Chrome PIDs and fresh resource/frame/render evidence at 1920×1080, 1440×900, 1280×800, 1024×768, and 390×844.**
- [ ] **Step 5: Generate all required videos, comparison plates, JSON reports, and a summary that fails on missing/stale/out-of-budget evidence.**
- [ ] **Step 6: Run fresh `npm run lint`, `npx tsc --noEmit`, `npm run test:round2`, `npm run test:round3`, `npm run test:round4`, `npm run test:round5`, `npm test`, `npm run build`, `npm run build:pages`, and `npm run qa:round5`.**
- [ ] **Step 7: Inspect representative screenshots and all videos, write delivery/limitations with exact before/after data, and append 3–5 reusable lessons to the existing MORPH//LAB Obsidian note without changing the new-note maintenance counter.**
- [ ] **Step 8: Run `git diff --check`, review the final diff/status, and commit the verified Round 5 delivery without pushing or deploying.**
