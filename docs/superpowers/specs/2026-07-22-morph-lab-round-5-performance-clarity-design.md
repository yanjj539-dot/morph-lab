# MORPH//LAB Round 5 performance and clarity design specification

Date: 2026-07-22

Status: architecture approved by the user; written specification pending final review before implementation.

## Outcome

Reduce Journey time-to-first-live-stage from the Round 4 baseline of roughly 4.3 seconds to about one second, eliminate idle WebGL work and whole-stage transparent ghosting, and improve stationary material and screen clarity without changing the four-stage story, page structure, blue-white art direction, authored mobile fallback, or GitHub Pages deployment model.

## Preservation boundary

- Keep Observe / Structure / Prototype / Release, the coral route, current semantic DOM, authored fallback plates, real project imagery, camera story, and interaction hierarchy.
- Keep desktop-only dynamic Three.js import. Mobile and Reduced Motion must request zero desktop GLBs.
- Keep Draco-compressed GLBs, real KTX2/project textures, AgX output, WebGL failure fallback, base-path-safe assets, route cleanup, and existing geometry/camera inspection.
- Do not replace the desktop experience with static imagery, hide defects with blur/fog, raise DPR above 1.5, add a second rendering dependency, or deploy without a later explicit user request.

## Chosen architecture

Retain separate Hero and Journey canvases to avoid a high-risk page-wide renderer and route lifecycle rewrite. Replace the raw-byte-only reuse boundary with a reference-counted parsed asset layer:

- GLB bytes remain cached by URL and failed promises remain retryable.
- A parsed stage asset owns canonical geometries, textures, animation clips, and immutable metadata.
- Each consumer receives a cloned object hierarchy with shared geometry and textures and consumer-owned material instances where runtime state can differ.
- Reference counts protect shared GPU resources. Hero release must not dispose Observe resources while Journey owns them, and Journey release must dispose them after the final consumer leaves.
- Renderer-specific texture/material configuration is applied through stable templates so cache reuse does not leak scene-local opacity, render order, shadow, or UV state.

This approach removes duplicate Observe parsing and texture creation while preserving independent camera, light, canvas, visibility, and route lifecycles.

## Progressive loading and residency

Journey creates its renderer, camera, base lights, authored fallback, route, and UI first. It then acquires only Observe and its required textures. `onReady()` fires immediately after Observe can render; it never waits for Structure, Prototype, or Release.

The stage preloader uses a small state machine (`idle | fetching | parsing | ready | error`) and these triggers:

- Hero idle time warms Draco/KTX2 infrastructure and prefetches Observe and Structure bytes without uploading every stage to a Journey renderer.
- Journey requests Structure after Observe becomes ready through `requestIdleCallback` with a timeout fallback, and force-prioritizes it by progress `0.08`.
- Prototype preloads at progress `0.32`.
- Release preloads at progress `0.58`.
- A requested but unfinished next stage keeps the matching authored plate visible and does not block navigation or stage copy.
- Only the current and adjacent next stage may be attached to the live scene. More distant parsed assets remain cached but do not participate in draw, shadow, animation, or label work.

Errors are isolated per stage. Observe failure switches Journey to the complete static fallback. Later-stage failure shows that stage's authored plate while leaving already loaded stages usable. Failed cache entries are evicted so a later acquisition can retry.

## Stage transitions

Delete the material-wide opacity mutation path. Main stage roots remain fully opaque with their authored depth policies. Each camera segment defines a deterministic occlusion switch point near a foreground paper, frame, panel, or blue structural surface:

1. Render the outgoing stage until the switch threshold.
2. During the authored foreground occlusion, detach or hide the outgoing root and attach/show the incoming root.
3. Apply the incoming light, shadow, route, animation, and label state.
4. Continue the camera path without changing hundreds of material programs.

Only DOM copy, route indicators, and at most five named auxiliary meshes may use a small opacity transition. Tests must prove the main model materials keep their original `transparent`, `opacity`, and `depthWrite` values across all progress samples.

## Dirty render scheduler

Add a reusable scheduler with `invalidate(reason?)`, `startTransient(durationMs)`, `stop()`, and `dispose()`.

- Scroll, pointer, resize, pulse, animation time, stage attachment, texture completion, shadow update, visibility restoration, and dynamic DPR changes invalidate rendering.
- A transient window renders while damping or authored animation is still changing, then stops after 6–12 stable frames.
- `document.hidden`, an offscreen canvas, disposal, or route teardown stops RAF immediately.
- Hero and Journey expose their scheduler state for QA. The Hero must stop after pointer/exit/pulse settling; Journey must stop after scroll and stage changes settle.
- Static roots disable `matrixAutoUpdate` after their initial transform is committed. Animated descendants and the camera rig remain updateable. The runtime must not force `scene.updateMatrixWorld(true)` on every frame.
- Shadow maps use `autoUpdate = false` and request a refresh only for a stage switch or meaningful animated shadow-caster change.

## Adaptive resolution and performance tiers

Quality tiers use static targets of High `1.5`, Balanced `1.25`, and Low `1.0`, capped by renderer/device capability. Desktop is not permanently pinned to DPR 1 solely because the physical display DPR is 1.

During active scrolling, the controller may reduce DPR in `0.1` steps after a 60-frame mean above 24 ms. It may raise DPR in `0.1` steps only after a 120-frame mean below 15 ms and a two-second cooldown. After 180–250 ms of inactivity, the renderer requests one or two sharp frames at the tier's stationary target and then sleeps. Changes are clamped to `1.0–1.5` and must not oscillate visibly.

The performance collector reports FPS, 1% low, frame time, long tasks, draw calls, triangles, geometries, textures, programs, DPR, current/loaded stages, canvas count, GPU identity, and Hero/Journey scheduler state when `?debugPerformance=1`. The overlay is absent by default.

## Material and texture clarity

`?materialNormals=0` disables all public micro-normal maps before material construction and provides a reproducible A/B baseline.

Optimized starting policies are:

| Material | Normal scale | Repeat | Distance policy |
| --- | ---: | --- | --- |
| Warm White Plastic | 0.008 | 1.5 × 1.5 | medium × 0.4, far off |
| Cool White Ceramic | 0.006 | 1.5 × 1.5 | medium × 0.4, far off |
| Paper | 0.012 | 2 × 2 | medium × 0.4, far off |
| Soft Grey Metal | 0.012 | 1 × 3 | medium × 0.4, far off |
| Black Rubber | 0.018 | 2 × 2 | medium × 0.4, far off |

Distance tiers are evaluated on stage or camera changes, not every idle frame. Material identity primarily comes from base color, roughness, metallic response, IOR, bevels, AO, and contact shadows rather than high-frequency noise.

Screen/project textures use sRGB, trilinear mip filtering, linear magnification, generated mipmaps when supported, and anisotropy capped by both device capability and the tier (High up to 8/16 where available, Balanced up to 8, Low up to 4). Surface-specific texture clones preserve independent UV fit. Existing source images are audited against displayed pixel size; undersized sources are replaced only where the audit proves magnification.

## Shadows, transparency, fog, and draw calls

- Only the active stage's primary opaque meshes cast shadows. The next stage preloads with cast/receive shadows disabled; hidden/detached stages never participate.
- Balanced uses a 1024 shadow map and transmission resolution scale `0.5`; High may use 2048 and a higher scale. Distant acrylic uses the existing fake-transparent/frosted path, with physical transmission reserved for near-field key objects.
- Fog begins farther from the camera and uses reduced influence so blue background, pale floor, and white objects remain separable.
- Runtime residency and shadow policy are the first draw-call reduction mechanisms. Blender merge/instancing changes are made only for named repeated/static groups that exceed the active `100` or transition `140` draw-call budgets after measurement; geometry is not blindly merged when animation or screen mapping depends on object identity.

## QA and evidence contract

Tests precede production edits and prove:

- Observe can make Journey ready before later stages resolve.
- Stage thresholds prioritize the correct preload and failed requests can retry.
- Hero and Journey share canonical Observe geometry/textures without double disposal.
- Main model materials never enter whole-scene transparency during transitions.
- Scheduler sleeps when stable and stops for hidden/offscreen/disposed states.
- High/Balanced/Low DPR policies, cooldown, sharp idle frame, normal-map override, distance policy, anisotropy, shadow policy, and stage residency are deterministic.
- Mobile and Reduced Motion import no desktop runtime and request zero GLBs.

`npm run qa:round5` produces the required videos, per-stage normal before/disabled/optimized comparisons, performance before/after reports, loading waterfall, draw-call report, texture report, viewport/browser telemetry, and an aggregate summary under `artifacts/qa-round5/`. Baseline evidence is recorded before implementation and remains immutable for comparison.

Acceptance requires fresh lint, TypeScript, all historical contract tests, Round 5 tests, rendered HTML tests, production build, GitHub Pages build, and Round 5 browser QA. Measured targets are Observe around one second cold, no four-second blank Journey wait, active draw calls at most 100, transition draw calls at most 140, High average FPS at least 55, Balanced at least 45, and no continuous RAF after the scene settles. Any unmet hardware-dependent threshold is reported with the exact environment and evidence rather than hidden.

## Delivery boundary

Round 5 ends with a committed feature branch, audit/delivery documentation, reproducible artifacts, and an appended MORPH//LAB Obsidian lesson section. It does not merge, push, or deploy unless the user explicitly requests those external actions after reviewing the result.
