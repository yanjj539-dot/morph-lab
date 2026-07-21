# Vectr reference study for MORPH//LAB Round 4

Date: 2026-07-21

## Sources and evidence

- Live reference: https://www.vectrfl.com/
- Branding and implementation case study: https://www.utsubo.com/blog/vectr-ai-startup-branding-case-study
- Browser evidence: `artifacts/qa-round4/reference-vectr-desktop.mp4`
- Representative captures: `reference-hero.png`, `reference-features.png`, `reference-standards.png`, and `reference-cta.png`

The live site was inspected in a real 1920px Chromium viewport. It exposed one WebGL canvas, a 100svh fixed hero, a 456svh flow region, a 100svh sticky flow viewport, and a 10,715px document. The reference recording contains 30 real browser captures, normalized to a 1920x1080, 30fps MP4.

## Transferable principles

### One scene, one route, one story

Vectr treats the hero and four process states as one spatial narrative. A single canvas remains present while the camera advances through focal points. The route is both progress feedback and a physical scene element. MORPH//LAB should keep its existing coral route as the only cross-stage semantic path and synchronize it with camera, copy, and Blender Actions.

### Composition before spectacle

The reference uses a pale studio environment, restrained matte objects, soft contact shadows, and small signal accents. Text occupies deliberately empty space. The useful lesson is not the exact centered title or industrial miniature world; it is the separation of text and object focal areas, the limited palette, and the absence of decorative visual noise.

### Continuous camera with controlled events

Most motion comes from lateral travel, focal-point changes, mild dolly movement, and route progression. Individual props animate as supporting events rather than competing hero moments. MORPH//LAB should add authored dolly, slight roll, near-field passes, and 8%–12% stage overlaps without introducing constant rotation or cinematic excess.

### Cognitive release after 3D

After the dense flow sequence, Vectr returns to clean white editorial layouts with large typography, thin dividers, and small icons. MORPH//LAB should give Practice, Selected Work, About, and the final CTA distinct interactions, while keeping these sections calmer than the Journey.

### App-like page transition

The reference uses a roughly 0.72 second full-page transition layer and dimmed outgoing page. The transferable pattern is a single reusable transition shell with browser-history safety and a Reduced Motion branch. Taxi.js is not required for the current Next architecture.

## Responsive and engineering findings

- Desktop uses one canvas and a long sticky flow.
- At about 820px, navigation and content structures collapse to mobile variants.
- The case study describes WebGPU, WebGL fallback, OffscreenCanvas, worker rendering, Draco, and device-specific assets.
- The live page requested a roughly 2.19MB decoded environment GLB plus a roughly 421KB workers GLB and Draco support.
- WebGPU and worker rendering are reference capabilities, not requirements to copy. MORPH//LAB currently depends on DOM-projected labels, ScrollTrigger lifecycle ownership, and a proven WebGL fallback path; a rewrite would add risk without proving user value.

## What MORPH//LAB will not copy

- Vectr branding, staffing copy, logo, color tokens, or CTA language.
- The pale-blue nuclear or industrial miniature landscape.
- The exact centered hero typography, four-step staffing sequence, blue electrical route, or red/blue signal combination.
- Proprietary models, textures, layout coordinates, or animation timing.

## Round 4 translation

MORPH//LAB will retain Observe / Structure / Prototype / Release, the coral path, the real project imagery, and its editorial laboratory identity. The reference is translated into a continuous authored workstation journey, precise screen surfaces, differentiated materials, restrained camera movement, a quieter hero composition, and section-specific interactions.
