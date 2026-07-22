# MORPH//LAB Round 5 performance audit

Date: 2026-07-22

Status: pre-change baseline frozen before Round 5 production edits.

## Baseline sources

Two baselines are retained because they answer different questions:

1. `artifacts/qa-round4/qa-summary.json` is the authoritative throttled Round 4 product baseline from Chromium 149. It measured Hero time-to-scene at `423 ms`, Journey time-to-scene at `4338 ms`, desktop DPR `1`, four unique GLBs (`1,703,808` encoded bytes), mobile/reduced-motion GLBs `0`, desktop Lighthouse `97`, and mobile Lighthouse `79`.
2. `artifacts/qa-round5/performance-before.json` is a fresh unthrottled diagnostic capture from the unchanged Round 4 runtime at `1440×900`. It instruments raw WebGL submissions and RAF activity. Its isolated headless browser reports ANGLE SwiftShader rather than a hardware GPU, so its FPS values are a relative regression baseline, not the final hardware-acceleration acceptance result.

The diagnostic browser environment was Chromium `149.0.7827.55`, `deviceMemory=16`, `hardwareConcurrency=32`, DPR `1`, WebGL 2, maximum anisotropy `16`, and two active canvases.

## Measured pre-change behavior

| Metric | Round 4 / pre-change result |
| --- | ---: |
| Throttled Journey time-to-scene | 4338 ms |
| Unthrottled QA-mode Journey ready | 849 ms |
| Active canvases at Journey | 2 |
| GLBs requested before Journey ready | 4 in parallel |
| KTX2 public texture request groups | 2 complete groups (Hero + Journey) |
| Static three-second RAF callbacks | 50 |
| Static three-second WebGL draw submissions | 1760 |
| Static three-second submitted triangles | 406,180 |
| Diagnostic SwiftShader average FPS | 2.99 |
| Diagnostic SwiftShader 1% low | 2.31 |
| Diagnostic long frames over 50 ms | 8 |

The fresh waterfall shows Observe, Structure, Prototype, and Release beginning within the same one-millisecond window. Six public KTX2 textures load once for the first scene and again when the second scene initializes. This confirms that the raw GLB byte cache prevents duplicate network requests but does not prevent duplicate GLTF parse, texture construction/transcode, material setup, or GPU upload work.

## Root causes verified in code and runtime

### Journey readiness is coupled to all stages

`loadRound4Models()` calls the shared loader with all four stage IDs, and that loader uses `Promise.allSettled`. `createJourneyScene()` cannot construct its stage roots, texture maps, mixers, camera inspectors, and labels until every result resolves. The authored fallback keeps content visible, but the live Observe stage inherits the slowest stage's work.

### Observe is parsed and textured twice

Hero calls `loadRound4StageModel("observe")`; Journey later calls `loadRound4Models()`. Both receive cached raw Observe bytes, but each invokes `GLTFLoader.parseAsync` and the texture application path independently. The fresh waterfall's repeated KTX2 group and the two live canvases make the duplicated runtime boundary visible.

### Stable scenes continue drawing

Hero and Journey both schedule the next `requestAnimationFrame` unconditionally at the end of `renderFrame`. Visibility can stop the loop only when the complete canvas leaves its observer boundary. Pointer, animation, scroll, and camera state can be fully stable while rendering continues. The three-second idle diagnostic still recorded 1760 WebGL draw submissions.

### Whole-stage transparency multiplies work and creates ghosting

`stageTimelines.ts` snapshots every material, then changes every main material's `opacity`, `transparent`, and `depthWrite` during overlapping stage ranges. Two complete roots are visible during each handoff. Besides transparent overdraw and depth-order instability, toggling `transparent` changes program state and allows pale stages, screens, acrylic, and the floor to visually accumulate into a grey ghost image.

### Material detail is above the useful screen frequency

Round 4 applies shared micro-normal textures broadly with repeats up to `6×6` and normal scales around `0.05` for paper/rubber-class materials. At Journey camera distances these frequencies approach or exceed screen pixel frequency, which produces compressed-normal shimmer, grey dot patterns, and moire rather than readable material identity.

### Static clarity is tied directly to physical DPR

The existing quality manager caps device DPR but does not assign a distinct Balanced desktop target or restore a high-quality idle frame. A desktop environment reporting DPR 1 therefore remains at DPR 1 even when it has enough frame budget to render a sharper settled image.

## Round 5 measurement rules

- `performance-before.json` and `loading-waterfall-before.json` remain immutable.
- Final `performance-after.json` uses the same viewport, instrumentation, capture window, and query mode for relative comparison.
- Hardware FPS acceptance is reported separately with the actual GPU renderer; SwiftShader evidence cannot satisfy the High/Balanced FPS gates.
- Journey readiness is measured when Observe first produces a live frame, not when all four stages finish preloading.
- Draw-call budgets use renderer/frame evidence for active and transition samples, not a source-code estimate.
- Mobile and Reduced Motion continue to require zero desktop GLBs and zero desktop scene runtime imports.
