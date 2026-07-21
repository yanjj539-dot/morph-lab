# MORPH//LAB Round 4 technology evaluation

Date: 2026-07-21

Status: validation plan established; measurements will be completed during Round 4 QA.

## Decision boundary

The production renderer remains the proven WebGL path unless an isolated validation demonstrates a stable improvement without breaking DOM-projected labels, ScrollTrigger lifecycle ownership, KTX2/Draco loading, page cleanup, browser history, or fallback behavior.

## Capabilities to record

| Capability | Current state | Round 4 validation | Adoption rule |
| --- | --- | --- | --- |
| WebGPU renderer | Not used | Detect support, test visual parity and fallback | Adopt only with stable parity and measurable benefit. |
| WebGL fallback | Proven | Keep authoritative and test forced failure | Required regardless of WebGPU result. |
| OffscreenCanvas + worker | Not used | Measure lifecycle, message cost, label synchronization, and teardown | Defer if it broadens failure surface or produces no clear main-thread gain. |
| Desktop/mobile variants | Desktop GLB / mobile static fallback | Confirm zero mobile GLBs and authored mobile plates | Required. |
| Draco | Proven | Preserve encoded and decoded-size reporting | Required. |
| Meshopt | Not used | Compare only if it reduces total transfer/parse cost without duplicate decoder cost | Optional. |
| KTX2 | Proven | Preserve real KTX2 textures and loading checks | Required. |
| Instancing | Selective authored reuse | Count repeated tertiary details suitable for instancing | Use where it preserves authored naming and animation. |
| LOD | Not used | Evaluate only for objects that remain distant for meaningful intervals | Optional; no unnecessary complexity. |

## Required measurement table

Final QA will record renderer, browser/GPU capability, four encoded/decoded GLB sizes, texture total, initial critical-resource bytes, time to interactive scene, long-task impact, DPR, desktop/mobile Lighthouse, and fallback result. The final decision and any incompatibility belong in `round-4-known-limitations.md`.
