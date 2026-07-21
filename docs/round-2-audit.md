# MORPH//LAB Round 2 audit

Date: 2026-07-21

## Executive finding

The first-round site is a sound interaction prototype, not a finished 3D art delivery. It already has the right palette, real project content, a four-stage narrative, a desktop ScrollTrigger journey, mobile/reduced-motion fallbacks, cleanup, and GitHub Pages export. Its blocking weakness is the visual layer: the entire desktop world is created inside one 445-line component and the principal objects are raw `BoxGeometry` meshes.

Round 2 will preserve the working stack and replace the grey-box visual system with four original Blender-authored GLB workbench scenes, real project textures, a camera rig, stage timelines, projected labels, accessible progress controls, and Blender-rendered mobile/reduced-motion keyframes.

## Current implementation

| Area | Current state | Round 2 decision |
| --- | --- | --- |
| Hero | Static generated WebP plus three floating cards | Replace with an Observe render made from the same Blender scene as the live journey; remove floating cards |
| 3D scene | Four clusters of `BoxGeometry` in `app/components/ScrollJourney.tsx` | Load four named GLB scenes from `public/models/round-2` |
| Camera | Fixed FOV, linear X travel, single `lookAt` formula | CameraRoot/YawPivot/PitchPivot rig driven by position, target, FOV, yaw, and pitch keyframes |
| Stage motion | Route draw, marker scale/color, slight world rotation | One main event, 2-3 micro-actions, one screen state, and one route response per stage |
| UI sync | Passive list with `aria-current` | Masked stage copy, projected labels, clickable keyboard-operable step buttons |
| Mobile | CSS blocks and text | Four vertical Blender renders with native scroll and a complete coral route |
| Reduced motion | No WebGL, CSS duration clamp | No pin/camera; all four rendered keyframes and full semantic copy visible |
| Performance | DPR 1.5, dispose and context loss | Retain those controls; add visibility/offscreen pause, no per-frame allocation, model budget checks |
| QA | SSR/source tests only | Deterministic stage query state, 7 viewport checks, screenshots, recordings, Lighthouse, console/network checks |

## Reusable foundations

- Next.js 16, React 19, TypeScript, Three.js 0.185, GSAP, ScrollTrigger, and Lenis remain in place.
- `withBasePath()` remains the only way to construct public model, texture, image, and fallback URLs.
- Existing MORPH//LAB screenshots remain the source of screen content. No lorem ipsum or template dashboard content will be introduced.
- The existing WebGL capability check, desktop media query, reduced-motion query, ResizeObserver, route draw range, renderer cleanup, and context loss behavior are retained through smaller modules.
- Mobile continues to avoid heavy WebGL and long pinned scrolling.

## Blocking gaps

1. No GLB assets, model loader, asset manifest, compression path, or fallback render set exists.
2. `ScrollJourney.tsx` owns data, scene construction, renderer, camera, GSAP, animation, UI, fallback, and disposal.
3. Primary objects are not recognizable without the adjacent text.
4. No stage has a complete internal event.
5. The camera never changes focal length or authored composition.
6. The progress UI is not clickable or keyboard operable.
7. No deterministic visual QA state or mandatory artifact set exists.

## Baseline technical evidence

- Repository status at audit: clean `main`, aligned with `origin/main` at `4687580`.
- `app/components/ScrollJourney.tsx`: 445 lines.
- Current desktop journey: `pin`, `scrub: 0.45`, `end: "+=420%"`.
- Current renderer: WebGL, PCF soft shadows, DPR capped at 1.5.
- Current public asset set: raster images only; no `public/models`, `public/textures`, or `public/fallback/round-2`.
- Blender is available locally at `D:\blender.exe`, version 5.1.2. Formal GLB production is therefore feasible in this workspace.
- Chrome and ffmpeg are available. Browser screenshots, recordings, and MP4 conversion are feasible.

## Objective gates

### Static art gate

Animation work may begin only after all four Blender renders:

- contain one recognizable primary object, at least four secondary objects, and at least eight details;
- show stage-specific real MORPH//LAB content;
- have visible bevels/thickness, differentiated materials, soft shadows, and foreground/midground/background separation;
- are visually distinct at a glance;
- pass nonblank pixel checks and manual screenshot review.

### Runtime gate

- No raw `BoxGeometry` is used for a final primary object in the browser scene.
- Every stage has a named main event, micro-actions, screen state, projected label, and route response.
- Camera position, target, FOV, yaw, and pitch vary across the four chapters with three overlap windows.
- React state changes only at stage boundaries; frame updates stay in the Three runtime.

### Delivery gate

- lint, TypeScript, tests, vinext build, and GitHub Pages export pass;
- seven required viewport checks have no overflow or incoherent overlap;
- four scene screenshots, desktop/mobile recordings, and Lighthouse JSON reports exist;
- page errors and failed first-party requests are zero;
- all limitations and asset statuses are stated honestly.

## Scope decisions

- Use Blender-scripted GLBs instead of adding R3F/Drei or relying on raw Three.js boxes.
- Use standard glTF loading through Three examples; compression is applied only if it reduces payload without destabilizing Pages deployment.
- Use Hero option B: a same-scene pre-render that hands off to the live Canvas. This keeps first paint reliable and preserves mobile performance.
- Use Blender renders for mobile, reduced motion, WebGL failure, and load failure.
- Do not add WebGPU, OffscreenCanvas, bloom, particles, or custom cursors in this round.

## Known delivery risk

Blender-scripted assets are formal GLBs with named object hierarchies and authored materials, but they are still procedural asset production rather than hand-sculpted studio modeling. The final self-score must reflect the actual screenshots and runtime behavior; it must not claim 85/100 merely because models and builds exist.
