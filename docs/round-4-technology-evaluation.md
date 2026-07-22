# MORPH//LAB Round 4 technology evaluation

Date: 2026-07-22

Status: measured; WebGL production architecture retained.

## Decision

The production renderer remains Three.js `WebGLRenderer`. The authoritative Chromium 149 run reached Lighthouse 97 desktop / 79 mobile, with 0 ms desktop TBT, 7.5 ms mobile TBT, zero layout shift, and no browser errors. No measured renderer or main-thread bottleneck justifies adding a second renderer, worker protocol, decoder, or level-of-detail lifecycle in this round.

## Measured baseline

| Measurement | Result |
| --- | ---: |
| Four Draco GLBs | 1,703,808 encoded bytes / 1,705,008 transferred bytes |
| KTX2 textures | 614,720 bytes |
| Initial critical resources | 1,072,845 bytes |
| Deferred Three.js chunk | 749,776 bytes |
| Hero time-to-scene | 423 ms |
| Journey time-to-scene | 4,338 ms with authored fallback visible |
| Desktop / mobile GLB requests | Four unique / zero |
| Reduced Motion GLB requests | Zero |
| DPR in QA | 1 |
| Desktop Lighthouse | 97 performance, 100 accessibility |
| Mobile Lighthouse | 79 performance, 100 accessibility |

## Capability matrix

| Capability | Decision | Evidence and trade-off |
| --- | --- | --- |
| WebGLRenderer | Keep | It meets every release gate, retains mature Three.js loaders/materials, and produced 0 ms desktop TBT. |
| WebGPU renderer | Defer | There is no measured renderer bottleneck. Adoption would add parity, fallback, device, shader/material, and cleanup obligations without a demonstrated user benefit. |
| WebGL failure fallback | Keep | Static authored plates preserve content if live rendering is unavailable. This remains required even if WebGPU is reconsidered. |
| OffscreenCanvas + worker | Defer | DOM-projected labels, GSAP/ScrollTrigger progress, KTX2/Draco loading, route teardown, and scene visibility currently share one deterministic lifecycle. TBT does not justify a message bridge. |
| Desktop/mobile variants | Keep | Desktop receives the live scene; mobile and Reduced Motion receive authored plates and request zero GLBs. |
| Draco | Keep | Four animated models total only 1.70 MB and retain the existing decoder path. |
| Meshopt | Defer | Adding another decoder and migration path has no measured transfer or parse win for these assets. |
| KTX2 | Keep | Real project textures total 614,720 bytes and preserve the screen/material system across stages. |
| `InstancedMesh` | Defer broadly | The repeated details are small; most objects belong to unique named, animated, or evidence-inspected hierarchies. Current geometry is manageable. |
| LOD | Defer | Each stage is 12.7k–20.5k triangles, desktop-only, and measured at DPR 1. No sustained distant-object bottleneck was found. |
| Page-lifetime raw-byte cache | Keep | It guarantees Observe is fetched once across Hero and Journey while allowing independent GLTF parses and safe disposal. |

## Reconsideration triggers

Re-run this evaluation when any of these conditions becomes true:

- measured desktop or mobile TBT repeatedly exceeds 200 ms because of scene work;
- the active scene, model payload, texture payload, or target DPR grows materially;
- the product adds persistent multi-scene rendering or computation that can be isolated from DOM labels;
- WebGPU support and Three.js parity are stable across the project’s required browser/device matrix;
- a controlled A/B benchmark demonstrates a meaningful improvement after decoder, fallback, teardown, and visual-parity costs are included.

Until a trigger is met, the smallest reliable production surface is WebGL + Draco + KTX2 + static fallbacks.
