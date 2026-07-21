# Round 4 material and studio-light system

## Runtime material inventory

`ROUND4_MATERIAL_PROFILES` is the single source of truth for the ten authored material families. Values are baseline QA values; any later visual adjustment must stay within ±0.08 and preserve the distinctions between plastic, ceramic, paper, metal, rubber, glass, and acrylic.

| Profile | Base color | Roughness | Metalness | IOR | Transmission | Runtime detail |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| Warm White Plastic | `#ede9df` | 0.58 | 0.00 | 1.46 | 0.00 | Subtle plastic normal and low AO |
| Cool White Ceramic | `#e6ecef` | 0.34 | 0.00 | 1.52 | 0.00 | Tighter highlight and very low normal |
| Paper | `#eeeae1` | 0.92 | 0.00 | 1.45 | 0.00 | Paper normal and low AO; no gloss map |
| Soft Grey Metal | `#a7adb2` | 0.64 | 0.68 | 1.50 | 0.00 | Brushed normal; shared ORM roughness is disabled |
| Black Rubber | `#17191d` | 0.88 | 0.00 | 1.46 | 0.00 | Fine normal and a matte silhouette |
| Screen Glass | `#d7e2ec` | 0.12 | 0.00 | 1.46 | 0.16 | Transparent, `depthWrite=false`, explicit thickness |
| Frosted Acrylic | `#dbe6ec` | 0.30 | 0.00 | 1.49 | 0.48 | Transparent, `depthWrite=false`, thickness 0.018 |
| Coral Accent | `#ff6b5f` | 0.48 | 0.00 | 1.46 | 0.00 | Opaque accent |
| Signal Blue | `#3158d4` | 0.42 | 0.00 | 1.46 | 0.00 | Opaque accent; also matches legacy Cobalt names |
| Printed Paper | `#ffffff` | 0.90 | 0.00 | 1.45 | 0.00 | sRGB map, non-emissive |

Normal strength is deliberately restrained: ceramic 0.015, plastic/metal 0.035, paper 0.05, and rubber 0.055. The former metal `studioOrm` roughness assignment was removed because its frequency created a visible grid/wire impression. Real KTX2 normal, AO, printed-image, and environment textures remain in the existing loading/disposal path.

## Surface order and depth policy

| Surface | Render order | Depth write | Emission |
| --- | ---: | --- | ---: |
| Printed surface | 1 | true | 0.00 |
| Screen content | 2 | true | 0.16 |
| Screen glass | 3 | false | 0.00 |
| Frosted acrylic | 3 | false | 0.00 |

The screen content layer is the only emissive surface. Glass and acrylic use physical transmission and real authored geometric separation; neither layer uses a polygon-offset workaround. Shared materials are configured per mesh so every transparent mesh receives the correct render order.

## Studio light rig

The scene owns one fixed-color rig:

- neutral ambient and hemisphere fill;
- broad warm directional key with the existing contact-shadow setup;
- weak cool spot fill;
- restrained cool rim;
- low, screen-local point light with inverse-square decay.

Stage state changes interpolate only light intensity and `stageCenterX`, which moves light targets/positions with the current exhibit. Colors never interpolate. Authored stage intensities are:

| Stage | Ambient | Hemi | Key | Fill | Rim | Screen-local | Center X |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Observe | 0.25 | 0.50 | 1.64 | 0.42 | 0.32 | 0.12 | -6 |
| Structure | 0.23 | 0.48 | 1.56 | 0.46 | 0.38 | 0.14 | -2 |
| Prototype | 0.21 | 0.45 | 1.50 | 0.44 | 0.46 | 0.18 | 2 |
| Release | 0.25 | 0.52 | 1.70 | 0.48 | 0.36 | 0.15 | 6 |

Determinism is checked at progress `0`, `0.25`, `0.5`, `0.75`, and `1`. The focused test also bounds ambient ≤0.35, hemisphere ≤0.65, key ≤1.8, fill ≤0.6, rim ≤0.55, and screen-local ≤0.22.

## Renderer and performance invariants

Round 4 does not replace the renderer or asset lifecycle. The existing renderer remains AgX tone mapped, sRGB output, PCF soft-shadowed, and capped at DPR 1.5. KTX2 texture setup, environment maps, disposal, and quality-tier shadow settings remain intact. No bloom, procedural noise, gray overlay, or new dependency was added.

The executable contract is `tests/material-light-round4.test.mjs`; the broader compatibility contract remains `tests/round3-contract.test.mjs`.
