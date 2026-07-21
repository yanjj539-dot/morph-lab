# MORPH//LAB Round 3 audit

Date: 2026-07-21

## Scope

Round 3 refines the existing four-stage journey. It preserves the Round 2 loading boundary, mobile and Reduced Motion fallbacks, real project textures, Draco delivery, semantic DOM, local ScrollTrigger ownership, and explicit GPU cleanup.

The change is not a redesign. The required improvement is concentrated in authored geometry, material separation, lighting, scroll-scrubbed Blender clips, camera direction, render stability, and restrained interaction continuity after the 3D section.

## Baseline evidence

- Source branch started clean from `main` at `fee360e`.
- Blender `5.1.2` is available at `D:\blender.exe`.
- ESLint and TypeScript pass before Round 3 edits.
- Rendered-page tests pass `5/5`.
- The Round 2 contract suite initially passes `7/8`; its only failure is a CRLF-sensitive Markdown row assertion, not a product regression. Round 3 normalizes that assertion before using the suite as a gate.
- Existing browser evidence records four desktop GLB requests and zero GLB requests on mobile and Reduced Motion paths.

## Asset audit

The four Round 2 GLBs total `749,212` bytes and contain `227` nodes and `217` meshes. They contain no animation clips, skins, embedded textures, or exported custom extras.

### Confirmed strengths

- Four independently recognizable workstations exist.
- Draco delivery is already small and reliable.
- Named control groups exist for each stage.
- Real project imagery is applied externally at runtime.
- Review plates and lightweight fallback images come from the same Blender scenes.

### Confirmed asset defects

- Rounded boxes use a narrow family of repeated bevels, so paper, plastic, furniture, and device frames share the same edge language.
- Materials are primarily base color, roughness, metallic, and alpha. Acrylic is alpha-blended rather than transmissive, and exported materials are broadly double-sided.
- The per-stage route geometry duplicates the continuous runtime route.
- `OBS_output_card` imagery, the Release laptop screen, Release project images, and QR cells have detached or doubled child transforms after export/re-import.
- Several stage objects intersect beyond intentional contact. Observe, Prototype, and Release require explicit collision exclusions and geometry corrections before animation.
- No Blender Action is exported, so all visible events are currently runtime transform edits.

## Runtime audit

### Camera

`createCameraRig()` already exists, and the live render path samples `yaw` and `pitch` before calling `cameraRig.setPose()`. The prompt's claim that the live runtime ignores both values is therefore only partly correct.

The remaining defects are:

- `cameraTimeline.applyToCamera()` is a second public path that discards yaw and pitch.
- Position and target use one whole-curve index mapping, which weakens the authored keyframe timing.
- The rig applies a local look-at quaternion and then small pivot rotations. The result is technically active but visually under-directed.
- There is no authored camera safety corridor or proxy-based path check.

### Animation and rendering

- `loadModels.ts` discards `gltf.animations`.
- There is no `AnimationMixer` controller or scroll-normalized clip time.
- `stageTimelines.ts` reveals every mesh under `STR_connectors` using raw index draw ranges. Imported triangle order is not semantic path order.
- Cross-faded materials become transparent but retain depth writes, so faded stages can occlude the active stage.
- The continuous route is the only geometry where controlled draw range is appropriate.
- Renderer configuration uses ACES Filmic and basic PCF shadows. Round 3 requires AgX and soft PCF shadows.

## Page interaction audit

- The header already hides downward and returns upward, and the mobile menu already traps focus.
- A hidden header can still receive keyboard focus.
- Reduced Motion stage selection still requests smooth scrolling.
- Practice has no visual proof layer and is flatter than the Journey and Selected Work sections.
- Selected Work already has a cursor-follow overlay and scroll zoom, but mobile crops real website screenshots aggressively.
- About metrics use excessive vertical spacing on small screens.
- The final CTA is visually strong and should receive one deliberate path-convergence gesture, not a new decorative system.

## Round 3 implementation boundaries

1. Geometry and static review plates must pass before clip integration.
2. Blender actions must be scrubbed by normalized scroll time, never free-running.
3. Ordinary complex meshes must never use draw range as a reveal effect.
4. Transparent materials must have explicit depth and render-order policy.
5. Mobile, Reduced Motion, missing WebGL, and load-error paths must continue to request zero GLBs.
6. Detail growth must stay within the prompt's four-GLB and texture budgets.
7. UI motion must use transform and opacity, with keyboard and Reduced Motion equivalents.

## Acceptance evidence to produce

- Four Round 3 Draco GLBs with exported actions.
- Four matching Round 3 fallback plates.
- Geometry and BVH reports with zero high and zero medium unresolved intersections.
- At least 30 deterministic progress captures.
- Four static review plates and four requested recordings.
- Desktop and mobile Lighthouse reports.
- Fresh lint, typecheck, Round 2 regression, Round 3 contracts, production build, and browser QA.
