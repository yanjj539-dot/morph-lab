# MORPH//LAB Round 4 implementation plan

Date: 2026-07-21

## Task 1: Lock the Round 4 contract

Files:

- Create `tests/round4-contract.test.mjs`.
- Update `package.json`.

Steps:

1. Add failing assertions for required scripts, material modules, camera fields, 41-sample reports, UI-state evidence, videos, and performance floors.
2. Run `node --test tests/round4-contract.test.mjs` and confirm it fails for missing Round 4 implementation.
3. Add only the package-script surface required to expose `assets:round4`, `geometry:round4`, `test:round4`, and `qa:round4` as implementation tasks reach them.
4. Make `qa:round4` the authoritative orchestrator: build, Playwright, network/console/resource policies, visual evidence, videos, Lighthouse, geometry report, and camera safety must all run or be freshly validated by this command.

## Task 2: Build the UV fit and screen contract test-first

Files:

- Create `app/scene/materials/uvFit.ts`.
- Create `app/scene/materials/screenManifest.ts`.
- Create `app/scene/materials/createScreenMaterial.ts`.
- Create `app/scene/materials/createPrintedSurface.ts`.
- Update `app/scene/materials/materialFactory.ts` and `app/scene/assets/loadTextures.ts`.
- Create `tests/uv-fit.test.mjs`.

Steps:

1. Write failing tests for contain, cover, center/edge alignment, safe area, scale, and 0/90/180/270 rotation.
2. Implement a pure UV-fit function and make the tests pass.
3. Implement screen and print factories with explicit layer/depth/render-order policy.
4. Connect the manifest by exact mesh names; retain fallback behavior for unmatched surfaces.
5. Run unit, contract, lint, and TypeScript checks.

## Task 3: Extend the camera rig test-first

Files:

- Update `app/scene/animation/cameraTimeline.ts`.
- Update `app/scene/core/createCameraRig.ts`.
- Update `app/scene/createJourneyScene.ts`.
- Update `app/scene/debug/cameraPathInspector.ts`.
- Create `tests/camera-rig-round4.test.mjs`.

Steps:

1. Add failing tests for dolly distance, roll, limited roll range, quaternion continuity, and 8%–12% overlap.
2. Extend pose types and sampling.
3. Apply dolly and roll in the actual rig hierarchy.
4. Extend the inspector output and run TypeScript plus targeted tests.

## Task 4: Author the Round 4 Blender asset and geometry pipeline

Files:

- Create `scripts/blender/build_round4_assets.py`.
- Create `scripts/blender/check_round4_geometry.py`.
- Create `scripts/blender/render_round4_review.py`.
- Create `scripts/blender/export_round4_glb.py`.
- Create/update `public/models/round-4/*`, `public/fallback/round-4/*`, and `artifacts/qa-round4/review-*`.
- Update `app/scene/assets/assetManifest.ts`.

Steps:

1. Derive from Round 3, retaining scene names, Draco export, actions, and collision metadata.
2. Add support/attachment/detail geometry and screen layer meshes for every named surface.
3. Emit a stage inventory proving 1–2 primary, 4–8 secondary, and 10–20 purposeful tertiary details per stage.
4. Add named `OBSERVE_ACTION`, `STRUCTURE_ACTION`, `PROTOTYPE_ACTION`, and `RELEASE_ACTION` clips. Emit an animation manifest for the required per-stage events, clip durations, and 100–200ms offsets.
5. Run Blender build/export and perform Apply Rotation/Scale, negative-scale removal, merge by distance, outward-normal recalculation, loose/internal/zero-area/nonmanifold/coplanar/duplicate-slot checks, triangulation, and mesh validation.
6. Use BVHTree on static and animated meshes across 41 states. Report object, stage, progress, severity, collision proxy, and allow-list reason. Accept High 0, Medium 0, and only allow-listed physical contacts as Low.
7. Include camera near-plane, monitor/panel/workbench proxy, external-occlusion, and internal-surface exposure checks in the machine reports.
8. Render and visually inspect four 1600x1000 review plates, including normals and transparent/Z-fighting checks.

## Task 5: Refine runtime materials and lighting

Files:

- Update `app/scene/materials/materialFactory.ts`.
- Update `app/scene/materials/acrylicMaterial.ts`.
- Update `app/scene/lighting/studioLightRig.ts` and `stageLightStates.ts`.
- Update `app/scene/core/createRenderer.ts` only if required.
- Create `docs/round-4-material-system.md`.

Steps:

1. Remove the runtime grid/wire impression at its material source.
2. Calibrate paper, plastic, metal, rubber, screen, and acrylic differentiation.
3. Add restrained screen-local light without bloom or clipping.
4. Verify transparent ordering and cleanup.

## Task 6: Recompose Hero and Journey UI

Files:

- Update `app/page.tsx`.
- Update `app/components/ScrollJourney/*`.
- Update `app/data/journey.ts` and `app/data/site.ts`.
- Update `app/globals.css`.

Steps:

1. Add regression assertions for semantic headings, CTA names, and mobile reading order.
2. Implement the quiet Observe opening composition and matching Journey entry.
3. Add stage-safe copy placement and section-specific Practice, Selected Work, About, and CTA interactions.
4. Preserve zero-GLB mobile/Reduced Motion policy.
5. Capture representative desktop/mobile states and correct visual defects.

## Task 7: Add shared page transitions

Files:

- Create `app/components/PageTransitionLayer.tsx`.
- Update `app/components/MotionController.tsx`, `SiteHeader.tsx`, and public route links as needed.
- Update `app/globals.css`.

Steps:

1. Add browser tests for forward navigation, back, direct refresh, focus, and Reduced Motion.
2. Implement a 500–750ms overlay without changing URL semantics.
3. Verify keyboard and pointer activation, cleanup, and no white flash.

## Task 8: Build the complete Round 4 QA pipeline

Files:

- Create `scripts/qa-round4.mjs`.
- Populate `artifacts/qa-round4/journey-progress/` and `ui-states/`.
- Create `docs/round-4-camera-storyboard.md`.

Steps:

1. Extend the Round 3 harness to 41 progress captures.
2. Add dedicated Hero/parallax/CTA-response/scroll-cue/handoff, Practice, each Selected Work project, About, CTA, menu, hover, focus, and transition captures.
3. Assert zero console/HTTP/request failures, no overflow, asset loading, fallback states, and load policy.
4. Assert header hide/show, current section, contrast, focus trap; the exact four Practice rows and working anchors; Selected Work metadata, distinct composition markers, zoom <=1.025 and routes; About evidence/data; and one CTA convergence with label swap.
5. Record current-after desktop, mobile, and Reduced Motion MP4s.
6. Run Lighthouse and enforce all floors. Report four-GLB, texture, decoded, critical-resource and DPR budgets.
7. Invoke `geometry:round4` or validate its fresh timestamp and schema from inside `qa:round4`; fail if the 41-sample geometry/camera reports are absent or invalid.

## Task 9: Final verification and delivery

Files:

- Create `docs/round-4-delivery.md`.
- Create `docs/round-4-known-limitations.md`.
- Create `docs/round-4-technology-evaluation.md` with the renderer/worker/compression/LOD capability benchmark and decision.
- Update `docs/round-4-defect-list.md` statuses.
- Append reusable lessons to the existing MORPH//LAB Obsidian note.

Commands:

1. `npm run lint`
2. `npx tsc --noEmit`
3. `npm run test:round2`
4. `npm run test:round3`
5. `npm run test:round4`
6. `npm test`
7. `npm run build`
8. `npm run build:pages`
9. `npm run geometry:round4`
10. `npm run qa:round4`
11. `git diff --check`

Finish only after all required artifacts exist, High/Medium defects are closed, and remaining limitations are explicit.
