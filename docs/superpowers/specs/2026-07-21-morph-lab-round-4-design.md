# MORPH//LAB Round 4 design specification

Date: 2026-07-21

Status: approved by the user-supplied Round 4 brief; implementation may proceed.

## Outcome

Upgrade the existing Round 3 website to a high-fidelity, continuous design-laboratory experience inspired by the completion quality of Vectr while remaining visibly and structurally MORPH//LAB. The work is an incremental refinement, not a rebuild.

## Non-negotiable preservation boundary

- Keep Observe / Structure / Prototype / Release in that order.
- Keep the coral continuous route and real project content.
- Keep semantic DOM content independent of WebGL.
- Keep viewport-gated desktop Three.js loading.
- Keep mobile, Reduced Motion, and WebGL-failure paths at zero GLB requests.
- Keep Draco, KTX2, AgX, PCF soft shadows, resource cleanup, collision inspection, and GitHub Pages path support.
- Do not introduce purple gradients, particles, robots, AI-brain imagery, generic glassmorphism, or copied Vectr brand assets.

## Experience architecture

### Hero

The hero becomes a quiet opening state of Observe. Typography moves into a deliberate clear area and uses the approved direction `DESIGN SYSTEMS / MADE TO MOVE.` with supporting Chinese copy. Desktop upgrades from its nonblocking opening plate to the same live Observe composition after the first content paint/idle boundary; the camera and object state match the Journey's first pose exactly. The plate is never treated as a full-screen wallpaper and remains only as the load, mobile, Reduced Motion, or WebGL-failure fallback. Pointer movement is limited to 1–2 degrees; the primary CTA produces a local Observe response and the scroll cue draws its line. A visual and browser assertion compares the Hero exit and Journey entry for a composition-safe handoff. Mobile uses an authored crop and content order rather than a shrunken desktop composition.

### Journey

The Journey remains a long desktop sticky sequence. Camera, Blender clips, light state, coral route, projected labels, and text are sampled from the same normalized progress. Each stage overlaps the next by 8%–12%. Copy has explicit safe zones and yields to screen close-ups.

### Remaining sections

- Practice: editorial index with responsive line, label, and media interactions rather than four equal cards.
- Selected Work: project-specific reveal, crop, and cursor response with keyboard-equivalent focus states.
- About: process fragments and image evidence, not only metrics.
- Final CTA: route and UI elements converge toward a single action without decorative particles.
- Header: section-aware contrast and state, robust mobile focus management.
- Routes: one reusable 500–750ms transition overlay, history-safe and reduced under `prefers-reduced-motion`.

## Screen and printed-surface system

Create:

- `app/scene/materials/uvFit.ts`
- `app/scene/materials/screenManifest.ts`
- `app/scene/materials/createScreenMaterial.ts`
- `app/scene/materials/createPrintedSurface.ts`

Every surface declares mesh name, source, source pixel dimensions, measured target aspect, contain/cover fit, normalized alignment, scale, quarter-turn rotation, flip/orientation policy, border radius, safe area, alpha/corner clipping, and layer/depth/render-order policy. UV scale and offset are derived from source and target aspect ratios. The runtime must never scale the image independently on X and Y to force a fit.

Screen structure is: device shell, dark base, content, glass, optional reflection. Content and glass use a controlled depth gap and render order. Printed surfaces use a paper-appropriate roughness path without emission or glass. Close-up evidence for all four stages proves sRGB, orientation, no stretch, no moire, correct corner clipping, parent-following during animation, and stable layer order.

## Model and material refinement

Round 4 scripts derive from the stable Round 3 Blender pipeline. Every stage reports 1–2 recognizable primary objects, 4–8 supported secondary devices, and 10–20 purposeful tertiary details. Primary devices receive authored housings, supports, seams, interfaces, thickness, and contact geometry. Secondary props receive believable attachment and scale. Tertiary details are instanced where possible.

The material inventory is explicit: Warm White Plastic, Cool White Ceramic, Paper, Soft Grey Metal, Black Rubber, Screen Glass, Frosted Acrylic, Coral Accent, Signal Blue, Printed Paper, and Soft Fabric/Felt only where justified. `round-4-material-system.md` records roughness, normal scale/source, AO, metallic, IOR, transmission, and surface variation for each material. Review plates verify the table and the no-bloom/no-universal-noise constraints.

The real-time material path must remove the visible wire/grid impression while preserving micro-surface information. Screen emission remains low enough to retain content. Transparent ordering remains explicit.

## Animation and camera

Blender Actions remain the source of device motion, with 100–200ms event offsets inside each stage. The named clips are `OBSERVE_ACTION`, `STRUCTURE_ACTION`, `PROTOTYPE_ACTION`, and `RELEASE_ACTION`. An animation manifest reports clip duration and covers scanner/card/marking, grid/token/wireframe, display/phone/sensor/ring, and QA/Draft-to-Live/package/panel events. Every stage contains one primary and 3–6 secondary motions with nonuniform timing.

Camera rig hierarchy is:

`CameraRigRoot -> YawPivot -> PitchPivot -> CameraDolly -> PerspectiveCamera`.

Pose sampling applies position, target, yaw, pitch, FOV, dolly distance, limited roll, and a named time/easing curve. Roll is a small authored accent, not a constant effect. The storyboard requires Observe push/hold, Structure edge occlusion and lower angle, Prototype narrowed FOV and lateral near-field pass, and Release pullback/settle. Every adjacent stage overlaps 8%–12%. The 41-sample inspector checks near-plane safety, collision proxies, external-only foreground occlusion, and internal-surface exposure.

## Technology decision

WebGL remains the production renderer. `round-4-technology-evaluation.md` records WebGPU detection/fallback, OffscreenCanvas and worker lifecycle compatibility, desktop/mobile asset variants, Draco/Meshopt/KTX2, instancing and LOD applicability, decoded/load size, and measured performance. WebGPU/worker adoption is deferred unless the validation produces a stable, measurable improvement. No new rendering dependency is added without that evidence.

## Failure and fallback behavior

- A model, texture, or WebGL failure reveals the authored static sequence and keeps all content usable.
- Mobile and Reduced Motion never import the scene runtime or request GLBs.
- Page transitions never block browser back, direct route refresh, or keyboard activation.
- Scene and route transition resources clean up on unmount.

## Verification contract

- Contract and unit tests precede production edits.
- Geometry/camera audit samples 41 progress points and reports High 0 / Medium 0.
- Browser QA captures 41 Journey states and dedicated UI states.
- Required videos are emitted under `artifacts/qa-round4/`.
- Playwright proves header hide/show, section and contrast state, mobile focus trap; four exact Practice rows and links; Selected Work year/type/status, distinct compositions, zoom <= 1.025 and working routes; About wireframe/process/ESP32/workbench/real data; and the single final CTA convergence with button text swap.
- `qa:round4` is the single orchestration command: it builds, runs browser QA, validates/produces screenshots and videos, runs Lighthouse, invokes or validates the 41-sample geometry/camera audit, and fails if any required report is missing or out of bounds.
- QA reports four-GLB, texture, decoded, initial critical-resource, and DPR budgets. Mobile remains zero-GLB and desktop DPR never exceeds 1.5.
- Desktop performance >= 90; mobile >= 75; accessibility >= 95; SEO >= 95.
- Lint, TypeScript, Round 2, Round 3, Round 4, rendered HTML, vinext build, and GitHub Pages build all pass.
