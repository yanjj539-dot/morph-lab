# MORPH//LAB Round 4 defect list

Date: 2026-07-22

Status values: `open`, `fixed`, `accepted`.

| ID | Severity | Status | Defect | Resolution evidence |
| --- | --- | --- | --- | --- |
| R4-001 | High | fixed | Hero title and dense scene competed for the same focal area. | Responsive Hero composition and nine layout captures; no horizontal overflow or title/object collision at the target viewports. |
| R4-002 | High | fixed | Hero plate and live Journey did not read as one continuous scene. | Shared Observe asset, byte-coalesced same-page load, `hero-journey-handoff-desktop.png`, and desktop after video. |
| R4-003 | High | fixed | Runtime Journey surfaces showed grid/moire artifacts and weak material hierarchy. | Four Round 4 review plates, 41 progress captures, KTX2 material policy, and surface audit failures 0. |
| R4-004 | High | fixed | Screen imagery lacked explicit aspect, safe-area, alignment, and rotation contracts. | UV/screen material tests, named surface metadata, stage close-ups, and 41-state surface audit. |
| R4-005 | High | fixed | Earlier evidence omitted the lower-page UI and route interactions. | `ui-states/` evidence plus UI/route Playwright contracts for Practice, Work, About, CTA, hover, focus, history, and Reduced Motion. |
| R4-006 | Medium | fixed | Models read as clean toy-like primitives with insufficient authored detail. | Round 4 asset inventory, review plates, and staged primary/secondary/tertiary details for all four models. |
| R4-007 | Medium | fixed | Camera movement lacked authored dolly, roll, near-field pass, and occlusion transitions. | Camera storyboard, pose tests, 41 live-scene raycast samples, and desktop recording. |
| R4-008 | Medium | accepted | Journey copy can compete with screens and structures during central progress states. | Editorial near-field competition is intentional; all 41 captures remain readable and the progress/navigation labels meet contrast and accessible-name contracts. |
| R4-009 | Medium | fixed | Release composition was too center-dense and the route did not organize depth. | Refined Release hierarchy, final-state capture, review plate, and settle shot at progress 1.000. |
| R4-010 | Medium | fixed | Mobile and Reduced Motion behaved as an unrelated gallery. | Authored four-stage static sequence, matching stage cues, dedicated recordings, and zero GLB requests in both modes. |
| R4-011 | Medium | fixed | Routes lacked a shared 500–750 ms application transition. | Shared page-transition system and forward/back/refresh/Reduced Motion tests and screenshots. |
| R4-012 | Low | fixed | Mobile menu looked generic relative to the laboratory system. | Refined short-height/landscape treatment plus 390×667 and 844×390 open-state evidence. |
| R4-013 | Low | fixed | Round 4 before/after and 41-sample QA evidence did not exist. | Fresh QA summary, 41 screenshots, three MP4s, derived contact sheets, Lighthouse reports, and telemetry are present. |
| R4-014 | High | fixed | Geometry cleanup was not proven across the full animation. | 41 samples / 324 meshes; High 0, Medium 0; topology, surface, and environment failures 0. |
| R4-015 | High | fixed | Stage-action coverage and secondary timing offsets were not authored or measured. | `animation-manifest.json` records 5 s clips, primary events, and four-frame / 167 ms secondary offsets. |
| R4-016 | High | fixed | Image planes were not proven to remain parented and depth-ordered during animation. | Named parent/surface contracts, screen tests, and 41-state surface failures 0. |
| R4-017 | Medium | fixed | Transparent ordering and screen/glass separation were generic. | Per-surface render order, acrylic/screen policy, one-sided material rules, and visual evidence across every stage. |
| R4-018 | Medium | fixed | There was no proof that `DoubleSide` was not masking invalid normals. | Export/geometry audit validates outward normals and one-sided authored solids; normal/material contract tests pass. |

No Round 4 defect remains open. R4-008 is the single accepted editorial trade-off.
