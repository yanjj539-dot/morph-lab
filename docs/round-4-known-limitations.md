# MORPH//LAB Round 4 known limitations

Date: 2026-07-22

These items are accepted constraints, not hidden release failures. The authoritative Round 4 QA run passes its required performance, accessibility, geometry, camera, network, fallback, and browser-error gates.

## Performance and loading

- The texture payload is 614,720 bytes, the initial critical-resource total is 1,072,845 bytes, and the deferred Three.js chunk is 749,776 bytes. They remain advisory budget items even though Lighthouse scores are 97 desktop and 79 mobile.
- Journey time-to-scene was 4,338 ms in the throttled QA path. An authored fallback remains visible while the desktop scene loads, so content is never blank.
- The raw model byte cache intentionally retains 1,703,808 bytes for the page lifetime. This prevents duplicate Hero/Journey downloads but trades a bounded amount of memory for deterministic reuse.
- Round 4 was validated in Chromium 149. Safari, Firefox, older integrated GPUs, and a physical-device performance matrix remain future release work.

## Experience variants

- Mobile and Reduced Motion deliberately use a static four-stage sequence and request zero GLBs. They preserve the narrative and content hierarchy, but do not reproduce the live desktop camera path.
- At central Journey progress states, large editorial copy and near-field objects intentionally compete for attention. All 41 captures remain readable, so defect R4-008 is accepted rather than hidden behind automated cropping.
- Six Structure samples allow `STR_mount_rail_2` to cross the line of sight before the grid board. This is a deliberate external rail-edge transition; unexpected external occlusions and internal surface exposures remain zero.

## Geometry and rendering boundaries

- The geometry audit reports 250 allowlisted Low contacts/proxies across 41 samples. They are intentional support, contact, and proxy relationships; the scene is not a rigid-body or physically simulated assembly.
- WebGPU, OffscreenCanvas/worker rendering, Meshopt, LOD, and broad `InstancedMesh` conversion are not included. Current model size, triangle counts, DPR, and blocking-time measurements do not justify their added fallback and lifecycle complexity.
- DOM-projected labels and GSAP/ScrollTrigger remain synchronized on the main thread. A worker split would require a new tested message, teardown, visibility, and route-transition contract.

## Operational boundary

- The evidence proves a local production build and GitHub Pages build path. It does not prove a new live deployment because Round 4 has not been pushed or published.
