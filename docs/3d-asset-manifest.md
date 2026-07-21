# MORPH//LAB Round 2 3D asset manifest

## Pipeline

- Authoring: Blender 5.1.2 through `scripts/blender/build_round2_assets.py`.
- Export: one named GLB per stage under `public/models/round-2`.
- Screen content: existing MORPH//LAB WebP images loaded by Three.js and assigned to named screen meshes.
- Fallback: four 1600x1000 Blender renders under `public/fallback/round-2`.
- Runtime loader: Three.js `GLTFLoader`; all public URLs pass through `withBasePath()`.
- Mobile/reduced motion: fallback renders only.

## Material set

| Blender material | Runtime role | Reusable |
| --- | --- | --- |
| `MAT_WarmWhitePlastic` | tables, trays, housings | yes |
| `MAT_CoolWhiteCeramic` | monitors, boards, shells | yes |
| `MAT_Paper` | documents and cards | yes |
| `MAT_FrostedAcrylic` | scanner glass and calibration rails | yes |
| `MAT_SoftGreyMetal` | stands, hinges, tools | yes |
| `MAT_BlackRubber` | cables, feet, bezels | yes |
| `MAT_ScreenGlass` | inactive screens | yes |
| `MAT_CoralAccent` | path response and status | yes |
| `MAT_CobaltAccent` | tokens and calibration | yes |

## Stage assets

| File | Stage | Primary object | Secondary/detail content | Named animation controls | LOD | Status |
| --- | --- | --- | --- | --- | --- | --- |
| `observe.glb` | Observe | beveled research scanner table | inspection monitor, scanner, papers, folder, lamp, swatches, clips, pencil, crop frame, scale figure | `OBS_papers`, `OBS_scan_beam`, `OBS_output_card`, `OBS_crop_frame` | one optimized web asset | planned |
| `structure.glb` | Structure | vertical design-system grid board | console, UI cards, type ruler, token dock, booklet, pins, connectors, scale figure | `STR_panels`, `STR_type_ruler`, `STR_tokens`, `STR_connectors`, `STR_final_panel` | one optimized web asset | planned |
| `prototype.glb` | Prototype | monitor and interaction test bench | phone, tablet, keyboard, trackpad, mouse, ESP32 board, sensor, ring, cables, hand cue | `PRO_monitor_screen`, `PRO_ui_layer`, `PRO_cursor`, `PRO_phone_screen`, `PRO_light_ring`, `PRO_sensor` | one optimized web asset | planned |
| `release.glb` | Release | multi-device delivery/QA station | laptop, phone, projection frame, QA panel, archive box, release folder, project rack, QR card | `REL_live_state`, `REL_devices`, `REL_qa_rows`, `REL_version`, `REL_package_lid`, `REL_final_panel` | one optimized web asset | planned |

## Screen texture mapping

| Mesh name | Texture |
| --- | --- |
| `SCREEN_observe_inspection` | `public/images/persona-result.webp` |
| `PRINT_observe_persona` | `public/images/persona-home.webp` |
| `SCREEN_structure_system` | `public/images/persona-result.webp` |
| `SCREEN_prototype_monitor` | `public/images/web-aeroform.webp` |
| `SCREEN_prototype_phone` | `public/images/persona-home.webp` |
| `SCREEN_prototype_tablet` | `public/images/web-field-notes.webp` |
| `SCREEN_release_monitor` | `public/images/web-units.webp` |
| `SCREEN_release_laptop` | `public/images/web-smoke-fruit.webp` |
| `SCREEN_release_phone` | `public/images/persona-result.webp` |
| `PRINT_release_device` | `public/images/device-tree-hole.webp` |

## Size budget

- Each GLB target: under 1.5 MB.
- Four GLBs combined: under 6 MB before screen textures.
- Initial desktop critical scene payload: under 4 MB.
- Fallback WebP: under 350 KB each.
- Total Round 2 models + fallback renders: under 8 MB.
- DPR: maximum 1.5.

## Acceptance fields to update after generation

The asset build task replaces every `planned` value with `final` or an honest blocker and records actual byte size, object count, triangle count, render path, and screenshot result. A missing or visually weak asset cannot be relabeled final.
