# MORPH//LAB Round 2 high-fidelity design

## Approved input

The user supplied `MORPH_LAB_第一轮审查与第二轮高保真重构提示词.md` as the complete design and delivery brief. This repository specification translates that brief into implementation boundaries without changing its visual target.

## Selected approach

Use Blender 5.1.2 to generate four formal, named GLB scenes and four same-source static renders. Load the GLBs in a modular Three.js runtime for desktop motion-enabled browsers. Use the renders for Hero, mobile, reduced motion, WebGL failure, and asset-load failure.

This approach was selected over a browser-only procedural scene because Blender is installed locally and the brief explicitly requires formal GLB or equivalent high-quality assets. It was selected over AI-generated scene plates because the desktop journey must remain a real continuous 3D world and the user requires any future AI image generation to go through `draw_image.py`.

## Architecture

- React owns semantic stage content, loading/error status, stage-boundary state, accessible controls, and fallback selection.
- A standalone Three runtime owns GLB loading, renderer/camera/lights, frame interpolation, stage animation, route draw, label projection, visibility pause, and disposal.
- Four GLBs expose named object groups that stage timeline adapters update from normalized progress.
- A camera rig samples position and target splines plus FOV/yaw/pitch keyframes.
- The existing real project images are loaded as textures and assigned to named screen meshes.
- Query parameters provide deterministic stage/camera states for artifact capture without affecting normal navigation.

## Component boundaries

```text
app/components/ScrollJourney/
  ScrollJourney.tsx
  JourneyUI.tsx
  JourneyProgress.tsx
  JourneyLabels.tsx
  JourneyFallback.tsx
app/data/journey.ts
app/scene/
  createJourneyScene.ts
  core/{createRenderer,createCameraRig,createLights,disposeScene,qualityManager}.ts
  assets/{assetManifest,loadModels,loadTextures}.ts
  animation/{progressMath,cameraTimeline,stageTimelines}.ts
  interaction/{projectedLabels,visibilityController}.ts
scripts/blender/build_round2_assets.py
```

## Data flow

1. `ScrollJourney` selects desktop 3D or fallback mode from viewport, reduced-motion, and WebGL support.
2. Desktop mode passes the canvas host, label host, and stage callback to `createJourneyScene()`.
3. The runtime loads models/textures, initializes scene adapters, and reports ready or error.
4. ScrollTrigger updates one numeric progress value. The render loop samples it, updates camera/stages/route/labels, and only emits a React callback if the stage index changes.
5. Progress buttons ask the runtime to map a stage index to the corresponding document scroll position.
6. Fallback mode renders the same semantic data with four static Blender plates and no pin/camera.

## Error and fallback behavior

- WebGL unavailable, GLB load failure, reduced motion, or viewport below 1024px selects the static journey.
- A failed desktop load never leaves an empty Canvas; the runtime is disposed and the four plates become visible.
- All model, texture, and fallback URLs use `withBasePath()` so GitHub Pages remains valid.
- Hidden documents and offscreen journey sections stop rendering. Resize and orientation changes update the renderer without reallocating scene assets.

## Testing and evidence

- Node tests lock file boundaries, asset presence, exact base-path construction, no monolithic raw-box scene, progress accessibility, cleanup, and reduced-motion behavior.
- Blender renders are manually inspected before animation integration.
- Browser QA covers the required seven viewports, deterministic stage screenshots, reduced motion, page errors, resource failures, image/model loads, nonblank Canvas pixels, and overflow.
- Playwright records desktop and mobile journeys; ffmpeg converts to MP4.
- Lighthouse JSON records desktop/mobile performance, accessibility, best-practice, and SEO scores.

## Explicit non-goals

- No WebGPU, OffscreenCanvas, bloom, particles, AI spheres, custom cursor, R3F migration, new page hierarchy, or Vectr asset reproduction.
- No claim of 85/100 until the required screenshots, recordings, browser checks, and performance evidence exist.
