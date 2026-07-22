# MORPH//LAB Round 4 baseline audit

Date: 2026-07-21

Baseline commit: `10861b7`

## Evidence captured before implementation

- Reference recording: `artifacts/qa-round4/reference-vectr-desktop.mp4` — 1920x1080, 30fps, 14.03 seconds.
- Current recording: `artifacts/qa-round4/current-before-desktop.mp4` — 1920x1080, 33.48 seconds.
- Current representative captures: `current-before-hero.png`, `current-before-observe.png`, `current-before-structure.png`, `current-before-prototype.png`, `current-before-release.png`, `current-before-mobile.png`, and `current-before-reduced-motion.png`.
- Reference representative captures: `reference-hero.png`, `reference-features.png`, `reference-standards.png`, and `reference-cta.png`.

The current-before recording and stage screenshots were copied from the fresh Round 3 QA run generated at `2026-07-21T11:36:13.568Z`. No product code changed between that run and the Round 4 baseline capture.

A second direct baseline inspection ran before any Round 4 product edit at `2026-07-21T13:06:30.538Z` against `http://127.0.0.1:57118` with Playwright Chromium `149.0.7827.55`, a 1920x1080 viewport, and a 1920x11,628 document. The browser scrolled to and captured Hero, Practice, Selected Work, About, and CTA into `artifacts/qa-round4/ui-before/`. The run logged zero console errors, page errors, and failed requests. Exact viewport, element bounds, browser version, timestamp, and event telemetry are stored in `current-before-browser.json`.

## Preserved strengths

- Observe / Structure / Prototype / Release and the continuous coral path are already implemented.
- Four Draco-compressed animated GLBs total about 1.05MB.
- Desktop Three.js is viewport-gated; mobile and Reduced Motion request zero GLBs.
- KTX2 materials, AgX tone mapping, PCF soft shadows, Blender AnimationMixer scrubbing, camera collision checks, and cleanup are present.
- Round 3 geometry audit has High 0 and Medium 0 across 21 samples and 289 meshes.
- Desktop performance is 96, mobile performance 78, accessibility 96, and SEO 100.
- Semantic DOM, fallback content, focus recovery, and GitHub Pages base paths are already stable.

## Root causes confirmed in source

1. `screenMaterial.ts` applies content by mesh naming but has no image-to-surface aspect-ratio contract, safe area, rotation, or contain/cover calculation.
2. `CameraRigPose` supports position, target, yaw, pitch, and FOV but has no authored dolly distance or roll.
3. The hero uses the Observe fallback as a large background plate while the Journey initializes a separate runtime scene, creating a visible composition change.
4. The Round 3 QA script focuses on Journey progress, layouts, and fallbacks; it does not capture dedicated Practice, Selected Work, About, CTA, hover, focus, and page-transition states.
5. The current route entry motion is component-level reveal behavior, not a shared 500–750ms page transition system.

## Technical strategy decision

### Chosen: incremental WebGL upgrade

Keep the proven Three.js WebGL main path and add an explicit screen/printed-surface contract, Round 4 Blender assets, authored dolly/roll camera poses, a matching hero composition, a shared transition layer, and expanded QA. This preserves the strongest Round 3 performance and accessibility guarantees while directly addressing the visible gaps.

### Rejected for this round: immediate WebGPU/worker rewrite

OffscreenCanvas and worker rendering conflict with the current DOM projection, ScrollTrigger ownership, KTX2 loader lifecycle, and failure-state handling. No measured bottleneck requires a rewrite: the current desktop score is 96 and mobile never loads Three.js. The evaluation will be documented as a known limitation, and the stable WebGL path remains authoritative.

### Rejected: pre-rendered-only journey

Static plates would simplify rendering but fail the required authored stage motion, screen/device alignment, camera choreography, and interactive desktop experience.

## Acceptance baseline

Round 4 is complete only when:

- UV fit tests prove contain/cover, alignment, safe area, and quarter-turn rotation without stretching.
- All screen/print content is parented to the intended device surface with separated base, content, and glass layers.
- Camera pose sampling applies position, target, yaw, pitch, FOV, dolly distance, and limited roll.
- Geometry and camera inspection sample 41 states and report High 0 / Medium 0.
- Hero and Journey share the same opening composition or a verified matching plate.
- Mobile and Reduced Motion continue requesting zero GLBs.
- Dedicated UI-state evidence covers all named sections and interactions.
- Desktop performance is at least 90, mobile at least 75, accessibility at least 95, and SEO at least 95.
