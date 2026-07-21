# MORPH//LAB Round 3 delivery

Date: 2026-07-21

Status: implementation and local acceptance complete on `codex/round-3-scene-refinement`. This round has not been deployed.

## Delivered scope

- Four refined Blender workstations for Observe, Structure, Prototype, and Release.
- Draco-compressed GLBs with named primary and secondary Blender clips.
- Six UASTC KTX2 micro-surface, ORM, and environment textures.
- Scroll-scrubbed `AnimationMixer` playback and timed, arc-length camera segments.
- Quaternion Camera Rig with authored yaw, pitch, FOV, stage overlap, and collision inspection.
- AgX tone mapping, PCF soft shadows, stage light states, and explicit screen/acrylic depth policy.
- Removal of arbitrary draw ranges from complex meshes; only the authored route reveal remains controlled.
- Round 3 fallback plates for mobile, Reduced Motion, WebGL failure, and load error paths.
- Practice, Selected Work, About, CTA, header, and mobile-menu interaction refinements.
- Desktop viewport-gated Three.js loading and a static mobile/Reduced Motion motion policy.

## Asset budget

| Stage | GLB bytes | Nodes | Meshes | Materials | Triangles | Clips |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Observe | 232,152 | 63 | 58 | 13 | 15,294 | 4 |
| Structure | 293,140 | 89 | 84 | 11 | 17,782 | 7 |
| Prototype | 316,512 | 90 | 88 | 12 | 19,570 | 5 |
| Release | 209,204 | 68 | 65 | 13 | 11,782 | 5 |

The four GLBs total 1,051,008 bytes. The six KTX2 files total 614,720 bytes. Both are below the Round 3 delivery budgets.

## Geometry and render evidence

- `artifacts/qa-round3/intersections.json`: High `0`, Medium `0`, Low accepted contacts `211`.
- 21 animation samples per stage and 289 mesh objects audited.
- Negative scale `0`, zero-area faces `0`, and loose vertices `0` in every stage.
- Four 1600x1000 Review Plates inspected with no confirmed missing faces, Z-fighting, broken normals, or transparent-order failures.
- 30 deterministic progress captures cover 5% steps plus all requested transition points.
- Canvas pixel checks confirm nonblank output in all four desktop stage captures.

## Browser and performance evidence

The final `scripts/qa-round3.mjs` run produced:

| Mode | Performance | Accessibility | Best Practices | SEO |
| --- | ---: | ---: | ---: | ---: |
| Desktop | 96 | 96 | 96 | 100 |
| Mobile | 78 | 96 | 96 | 100 |

The load-policy smoke check proves:

- Desktop first viewport: `0` GLBs and no Canvas while only the Journey preview edge is visible.
- Desktop after Journey entry: exactly `4` GLBs, one Canvas, and `ready` state.
- Mobile: `fallback`, `0` GLBs, and no Canvas.
- Reduced Motion: `fallback`, `0` GLBs, and no Canvas.
- No console, page, HTTP, or failed-request errors in the checked paths.

## Recordings

- `desktop-1920-scroll.mp4`: 33.48 seconds.
- `desktop-1440-scroll.mp4`: 24.36 seconds.
- `mobile-390-scroll.mp4`: 9.72 seconds.
- `reduced-motion.mp4`: 9.88 seconds.

## Final gates

- `npm run lint`: pass.
- `npx tsc --noEmit`: pass.
- `npm run test:round2`: 8/8 pass.
- `npm run test:round3`: 5/5 pass.
- `npm test`: 5/5 rendered product tests pass after a fresh vinext build.
- `npm run geometry:round3`: pass, High/Medium `0`.
- GitHub Pages static export: pass, 109 files generated with repository-prefixed Round 3 assets.

## Accepted constraints

- Stage transitions intentionally retain a short low-opacity overlap to preserve spatial continuity; the transition samples show no confirmed depth-order defect.
- The Three.js scene chunk remains larger than 500 KB, but it is excluded from the first viewport and from mobile/Reduced Motion network paths.
- Mobile uses the authored static sequence and skips GSAP/ScrollTrigger initialization. This preserves content, interaction semantics, and the required performance budget.
- Deployment is intentionally excluded from this delivery. Publish only after the branch is reviewed and explicitly requested.
