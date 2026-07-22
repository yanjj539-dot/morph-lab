# MORPH//LAB Round 4 delivery

Date: 2026-07-22

Status: implementation and local QA complete. The work is committed to the Round 4 feature branch only; no deployment or push is part of this delivery.

## Delivered outcome

Round 4 turns the Hero and four-stage Journey into one continuous desktop workstation story while preserving authored static experiences for mobile and Reduced Motion. The delivery includes refined Blender geometry and materials, stage-specific five-second animation clips, a dolly/roll camera path, live-scene visibility inspection, screen-safe material policies, application-style route transitions, broader UI interaction evidence, and an evidence-producing QA pipeline.

The production renderer remains Three.js `WebGLRenderer`. WebGPU, worker rendering, Meshopt, LOD, and broad instancing were evaluated and deliberately deferred because the measured WebGL path already clears the release gates without adding a second lifecycle or fallback surface.

## Asset inventory

All four models are Draco-compressed GLBs with authored animations. Screen content uses project-owned KTX2 textures.

| Stage | GLB bytes | Nodes | Meshes | Materials | Triangles | Clips | Primary / secondary / tertiary objects |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Observe | 340,720 | 68 | 62 | 14 | 15,302 | 4 | 2 / 5 / 12 |
| Structure | 465,252 | 95 | 89 | 13 | 18,350 | 4 | 2 / 5 / 12 |
| Prototype | 524,688 | 104 | 99 | 13 | 20,522 | 5 | 2 / 6 / 12 |
| Release | 373,148 | 86 | 80 | 14 | 12,742 | 5 | 2 / 6 / 12 |
| Total | 1,703,808 | — | 330 authored entries | — | 66,916 | 18 | — |

Each stage owns a 120-frame, 24 fps, five-second action sequence. Primary actions begin at zero; secondary responses use a four-frame / 167 ms offset. The machine-readable contract is in `artifacts/qa-round4/animation-manifest.json`.

## Runtime and loading policy

- The Hero requests only `observe.glb`; entering Journey on the same page results in exactly four unique GLB requests total, with Observe fetched once.
- Shared raw GLB bytes are cached for the page lifetime, while every scene receives an independently parsed graph so scene disposal cannot corrupt another consumer.
- Mobile and Reduced Motion request zero GLBs and use the four authored static plates.
- The live camera inspector samples the actual rendered scene with Three.js raycasts. Across 41 states it found no unexpected external occlusion, internal exposure, near-plane violation, or insufficient focus evidence.
- WebGL failure and capability fallbacks remain intact; desktop DPR was measured at 1 during the authoritative run.

## Authoritative QA result

Fresh run: `2026-07-22T02:25:24.559Z`, Chromium `149.0.7827.55`.

| Gate | Result |
| --- | --- |
| Geometry | 41 samples, 324 meshes, High 0, Medium 0; topology, surface, and environment failures 0 |
| Camera | 41 live-scene samples, High 0, Medium 0; minimum clearance 3.492548; near-plane safe |
| Occlusion | 6 allowlisted Structure rail-edge passes; unexpected external 0; internal 0 |
| Network | Four unique GLBs, duplicate URLs 0; encoded 1,703,808 bytes; transferred 1,705,008 bytes |
| Fallback | Mobile GLBs 0; Reduced Motion GLBs 0 |
| Browser telemetry | 15 sessions; console, page, request, and HTTP errors all 0 |
| Lighthouse desktop | Performance 97, Accessibility 100, Best Practices 96, SEO 100 |
| Lighthouse mobile | Performance 79, Accessibility 100, Best Practices 96, SEO 100 |
| Layout | Nine target viewports; horizontal overflow 0 |
| Video evidence | Desktop 1440×900, mobile 390×844, Reduced Motion 1440×900; fresh contact sheets generated from each MP4 |

## Evidence map

- `artifacts/qa-round4/qa-summary.json`: authoritative aggregate and gate result.
- `artifacts/qa-round4/camera-collisions.json`: runtime raycast evidence for all 41 camera states.
- `artifacts/qa-round4/intersections.json`: Blender geometry and surface audit.
- `artifacts/qa-round4/network-budget.json`: actual Resource Timing entries, duplicate-request result, and byte totals.
- `artifacts/qa-round4/browser-telemetry.json`: aggregated browser errors across 15 sessions.
- `artifacts/qa-round4/journey-progress/`: 41 progress captures at a real 1920×1080 viewport.
- `artifacts/qa-round4/ui-states/`: Hero/Journey, Practice, Selected Work, About, CTA, focus, hover, and route-transition states.
- `artifacts/qa-round4/current-after-*.mp4` and `video-contact-sheets/`: desktop, mobile, and Reduced Motion recordings with derived visual summaries.
- `artifacts/qa-round4/lighthouse-*.json`: fresh Lighthouse reports.

## Delivery boundary

This round is complete locally on `codex/round-4-vectr-upgrade`. GitHub Pages deployment is intentionally excluded until the user explicitly requests publication of this round.
