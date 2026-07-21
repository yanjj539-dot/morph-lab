# MORPH//LAB Round 2 3D asset manifest

## Pipeline

- Authoring: Blender 5.1.2 through `scripts/blender/build_round2_assets.py`.
- Export: one named Draco-compressed GLB per stage under `public/models/round-2`.
- Screen content: existing MORPH//LAB WebP images loaded by Three.js and assigned to named screen meshes.
- Fallback: four 1600x1000 Blender renders under `public/fallback/round-2`.
- Runtime loader: Three.js `GLTFLoader` with `DRACOLoader`; all public URLs pass through `withBasePath()`.
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
| `observe.glb` | Observe | beveled research scanner table | inspection monitor, scanner, papers, folder, lamp, swatches, clips, pencil, crop frame, scale figure | `OBS_papers`, `OBS_scan_beam`, `OBS_output_card`, `OBS_crop_frame` | one optimized web asset | final |
| `structure.glb` | Structure | vertical design-system grid board | console, UI cards, type ruler, token dock, booklet, pins, connectors, scale figure | `STR_panels`, `STR_type_ruler`, `STR_tokens`, `STR_connectors`, `STR_final_panel` | one optimized web asset | final |
| `prototype.glb` | Prototype | monitor and interaction test bench | phone, tablet, keyboard, trackpad, mouse, ESP32 board, sensor, ring, cables, hand cue | `SCREEN_prototype_monitor`, `PRO_ui_layer`, `PRO_cursor`, `SCREEN_prototype_phone`, `PRO_light_ring`, `PRO_sensor` | one optimized web asset | final |
| `release.glb` | Release | multi-device delivery/QA station | laptop, phone, projection frame, QA panel, archive box, release folder, project rack, QR card | `REL_live_state`, `REL_devices`, `REL_qa_rows`, `REL_version`, `REL_package_lid`, `REL_final_panel` | one optimized web asset | final |

## Screen texture mapping

| Mesh name | Texture |
| --- | --- |
| `SCREEN_observe_inspection` | `public/images/persona-result.webp` |
| `PRINT_observe_persona` | `public/images/persona-home.webp` |
| `PRINT_observe_output` | `public/images/persona-result.webp` |
| `SCREEN_structure_system` | `public/images/persona-result.webp` |
| `SCREEN_prototype_monitor` | `public/images/web-aeroform.webp` |
| `SCREEN_prototype_phone` | `public/images/persona-home.webp` |
| `SCREEN_prototype_tablet` | `public/images/web-field-notes.webp` |
| `SCREEN_release_monitor` | `public/images/web-units.webp` |
| `SCREEN_release_laptop` | `public/images/web-smoke-fruit.webp` |
| `SCREEN_release_phone` | `public/images/persona-result.webp` |
| `PRINT_release_device` | `public/images/device-tree-hole.webp` |
| `REL_project_image_0` | `public/images/web-aeroform.webp` |
| `REL_project_image_1` | `public/images/persona-home.webp` |
| `REL_project_image_2` | `public/images/web-field-notes.webp` |

The GLBs retain named neutral screen planes but contain no embedded images. The browser runtime binds these external WebP files by mesh name. KTX2 is intentionally not applied to these screenshot surfaces because they are external sRGB WebP content rather than packaged model textures; any future embedded baked map must use KTX2. Extruded review labels are render-only and are omitted from GLB export because the live scene uses projected semantic DOM labels.

## Final measurements

### `observe.glb` - final

- GLB bytes: 166,464
- Objects: 44
- Triangles: 11,982
- Fallback: `public/fallback/round-2/observe.webp` (36,794 bytes)
- Review plate: `artifacts/01-observe.png` (1600x1000, 1,448,157 bytes)
- Screenshot result: pass; scanner, input papers, crop output, monitor, cobalt folder, coral scan route, and operator scale are distinct.

### `structure.glb` - final

- GLB bytes: 202,388
- Objects: 64
- Triangles: 13,394
- Fallback: `public/fallback/round-2/structure.webp` (46,808 bytes)
- Review plate: `artifacts/02-structure.png` (1600x1000, 1,496,872 bytes)
- Screenshot result: pass; the design-system screen remains visible, with cobalt panels, coral connectors, acrylic layer, token dock, grid, and ruler clearly separated.

### `prototype.glb` - final

- GLB bytes: 241,212
- Objects: 70
- Triangles: 15,834
- Fallback: `public/fallback/round-2/prototype.webp` (49,580 bytes)
- Review plate: `artifacts/03-prototype.png` (1600x1000, 1,485,919 bytes)
- Screenshot result: pass; monitor, phone, tablet, keyboard, embedded board, sensor loop, cables, and synced live content are recognizable.

### `release.glb` - final

- GLB bytes: 139,148
- Objects: 49
- Triangles: 8,426
- Fallback: `public/fallback/round-2/release.webp` (57,082 bytes)
- Review plate: `artifacts/04-release.png` (1600x1000, 1,526,350 bytes)
- Screenshot result: pass; QA board, multi-device output, archive package, version state, project rack, and completion status read as one delivery station.

Combined Round 2 GLB payload is 749,212 bytes after Draco compression. Combined GLB plus fallback payload is 939,476 bytes and remains below the 8 MB delivery budget.

## Size budget

- Each GLB target: under 1.5 MB.
- Four GLBs combined: under 6 MB before screen textures.
- Initial desktop critical scene payload: under 4 MB.
- Fallback WebP: under 350 KB each.
- Total Round 2 models + fallback renders: under 8 MB.
- DPR: maximum 1.5.

## Acceptance record

All four stages passed static visual review and contract validation. Each stage records its actual byte size, object count, triangle count, render path, and screenshot result above; no weak or missing asset was relabeled final.

## Browser acceptance record

- Desktop runtime requested exactly four GLBs and reached the `ready` state without console, page, request, or HTTP errors.
- Mobile `390x844` and desktop Reduced Motion requested zero GLBs and rendered all four static stages without a WebGL canvas.
- Canvas screenshots passed nonblank pixel checks: channel deviation `30.69-64.28`, entropy `3.34-5.05`.
- Seven viewports (`1920x1080`, `1440x900`, `1280x800`, `1024x768`, `768x1024`, `430x932`, `390x844`) had no horizontal overflow.
- Lighthouse: desktop `97 / 100 / 96 / 100`; mobile `73 / 96 / 96 / 100` for performance, accessibility, best practices, and SEO.
- Evidence: `artifacts/qa-round2/qa-summary.md`, four deterministic stage screenshots, two MP4 recordings, and both Lighthouse JSON reports.
