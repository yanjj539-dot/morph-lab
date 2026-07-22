# MORPH//LAB Round 5 delivery

Date: 2026-07-22

Status: implementation and hardware-accelerated QA complete. This branch has not been deployed.

## Outcome

Round 5 replaces the all-at-once Journey runtime with progressive stage residency, shared reference-counted assets, dirty rendering, adaptive DPR, static batching, and restrained material sampling. Observe becomes interactive before optional KTX2 material hydration; later stages preload one step ahead and the runtime keeps only the current and next stage resident.

## Verified results

The authoritative final run is `artifacts/qa-round5/qa-summary.json`, captured from commit `154a53451e616f2df144eb43ab15739a33447dd5` on Chromium 149 with hardware ANGLE/D3D11 rendering on an NVIDIA GeForce RTX 750tiLaptop GPU.

| Metric | Before | Round 5 | Result |
| --- | ---: | ---: | --- |
| Throttled Journey time-to-scene | 4338 ms | 544 ms | 87.5% faster |
| Journey GLBs before ready | 4 | 1 | progressive |
| Sustained scroll average | diagnostic SwiftShader only | 60.16 FPS | pass, target 55 |
| Sustained scroll 1% low | diagnostic SwiftShader only | 44.91 FPS | pass, target 40 |
| Average frame time | diagnostic SwiftShader only | 16.62 ms | pass, target 18 ms |
| Long frames in measured scroll sample | not comparable | 0 | pass |
| Peak active draw calls | unbudgeted | 94 | pass, target 100 |
| High-tier settled DPR | 1 | 1.5 | sharper stationary frame |
| Mobile desktop GLBs | 0 | 0 | preserved |

Per-stage peak draw calls were Observe `76`, Structure `68`, Prototype `67`, and Release `94`. Static batching removed an estimated `36`, `57`, `76`, and `41` submissions respectively while preserving animated nodes, camera anchors, screens, prints, and transparent surfaces.

## Delivered runtime changes

- Parsed GLTF and KTX2 resources use shared reference-counted leases with retryable failures and last-owner disposal.
- Journey loads Observe first, defers its optional material hydration, and preloads only the next stage.
- Whole-root transparency crossfades were removed in favor of opaque, occlusion-timed visibility switching.
- Hero and Journey sleep after stable frames and wake only for explicit invalidation, transient animation, visibility, resize, or interaction.
- High, Balanced, and Low quality tiers expose deterministic QA overrides and adaptive active/idle DPR behavior.
- Compatible static meshes batch by their final runtime material route rather than incidental Blender material suffixes.
- Large and cross-object batched surfaces reject compressed micro normals; small eligible details retain restrained per-material normal scales.
- Screen/project textures use sRGB color space, trilinear mip filtering, linear magnification, mipmaps, and tier/capability anisotropy caps.
- `?debugPerformance=1` exposes live renderer, scheduler, browser frame, Long Task, GPU, memory, DPR, and residency evidence without appearing by default.

## Evidence

Round 5 evidence lives under `artifacts/qa-round5/` and includes six MP4s, four three-way normal-map comparison sets, five viewport screenshots, the debug overlay plate, the Resource Timing waterfall, draw-call and texture reports, browser telemetry, and the final machine-verifiable summary.

All six videos and representative comparison/viewpoint plates were visually inspected after the final run. Desktop stage switching remained opaque and coherent; mobile retained the authored fallback sequence; large-surface normal-map striping found during review was removed by the eligibility gate before the evidence was regenerated.
