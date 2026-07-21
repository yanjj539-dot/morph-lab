# MORPH//LAB Round 4 defect list

Date: 2026-07-21

Status values: `open`, `fixed`, `accepted`.

| ID | Severity | Status | Defect | Evidence | Required verification |
| --- | --- | --- | --- | --- | --- |
| R4-001 | High | open | Hero title and dense scene compete for the same focal area; mobile and landscape crops are especially crowded. | `current-before-hero.png`, Round 3 `layout-390x844.png`, `layout-844x390.png` | Hero desktop/mobile screenshots; text/object bounding boxes do not collide. |
| R4-002 | High | open | Hero plate and live Journey do not read as one continuous scene. | `current-before-hero.png` vs `current-before-observe.png`; before recording | Hero-to-Journey transition recording with no hard composition jump. |
| R4-003 | High | open | Runtime Journey surfaces show a blue-gray wire/grid texture and weaker material hierarchy than the Blender review plates. | Round 3 `progress-00-000.png`, `progress-10-050.png`, `progress-15-075.png`, `progress-20-100.png` | 41 progress captures and four review plates show clean white hierarchy without moire/grid artifacts. |
| R4-004 | High | open | Screen imagery has no explicit aspect-ratio, safe-area, alignment, or rotation system; content can appear undersized or visually detached. | `current-before-structure.png`, `current-before-prototype.png`, `current-before-release.png`; `screenMaterial.ts` | UV unit tests plus screen close-ups at all four stages. |
| R4-005 | High | open | Round 3 evidence does not prove Practice, Selected Work, About, CTA, hover, focus, or page transitions. | `artifacts/qa-round3` inventory | Dedicated `ui-states/` captures and Playwright assertions. |
| R4-006 | Medium | open | Models still read as clean toy-like white primitives in several views; edge, support, interface, and contact detail are insufficient. | Round 3 `review-observe.png`, `review-structure.png`, `review-prototype.png`, `review-release.png` | Round 4 review plates and asset statistics. |
| R4-007 | Medium | open | Camera story is dominated by lateral travel and zoom; no applied dolly, roll, near-field pass, or occlusion transition is encoded. | before recording; `cameraTimeline.ts`, `createCameraRig.ts` | Storyboard contract, pose tests, camera collision report, after recording. |
| R4-008 | Medium | open | Journey copy can compete with screens and structures during central progress states. | Round 3 `progress-10-050.png`, `progress-15-075.png` | Collision-free text safe-zone checks across 41 samples. |
| R4-009 | Medium | open | Release composition is dense at center and the coral route does not sufficiently organize foreground-to-background hierarchy. | `current-before-release.png`, Round 3 `review-release.png` | Release close-up and final-state capture. |
| R4-010 | Medium | open | Mobile and Reduced Motion are stable but visually behave like a gallery, not a condensed version of the continuous workstation story. | `current-before-mobile.png`, `current-before-reduced-motion.png` | Mobile/reduced recordings with continuous stage cues and zero GLBs. |
| R4-011 | Medium | open | The site has reveal motion but no shared 500–750ms application-style route transition. | `MotionController.tsx`; work/contact/studio routes | Forward, back, refresh, and Reduced Motion route tests. |
| R4-012 | Low | open | Mobile menu interaction is usable but visually generic relative to the laboratory system. | Round 3 `mobile-menu-390x667.png` | Mobile menu open/hover/focus captures. |
| R4-013 | Low | open | Round 4 before/after comparison and 41-sample QA pipeline do not yet exist. | Missing Round 4 final artifacts | Required videos, reports, progress folder, and summary all present. |
| R4-014 | High | open | Geometry cleanup is not yet proven at 41 states for normals, nonmanifold edges, zero-area/internal/coplanar faces, loose geometry, duplicate slots, or negative scale. | Round 3 checks and Round 4 prompt | Machine report contains each cleanup counter; all error counters are zero. |
| R4-015 | High | open | Round 4 stage-action event coverage and 100–200ms offsets are not yet authored or measured. | Round 3 clips and Round 4 event brief | Animation manifest lists primary/secondary events, clip duration, offset, and 41-state collision result. |
| R4-016 | High | open | Image planes are not yet proven to remain parented and depth-ordered through every device animation. | Generic Round 3 surface replacement | Animated close-ups and report prove parent identity, base/content/glass order, and no Z-fighting at all samples. |
| R4-017 | Medium | open | Transparent ordering and screen-glass separation are configured generically, with no per-surface depth contract. | `screenMaterial.ts`, review/runtime comparison | Per-surface layer metadata and 41-state transparent-order visual checks. |
| R4-018 | Medium | open | Round 4 has no explicit proof that DoubleSide is not masking bad normals. | GLB/material inspection | Export audit reports correct outward normals and one-sided authored materials for all solid meshes. |
