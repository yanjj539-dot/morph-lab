# MORPH//LAB Round 2 scene art direction

## World statement

MORPH//LAB is a quiet, human-scale digital design workshop. The world is built from paper, warm white polymer, cool ceramic, frosted acrylic, soft grey metal, black rubber, screen glass, cobalt calibration pieces, and a single coral route. It should feel assembled, tested, and handled, not generated or futuristic for its own sake.

The reference to Vectr is limited to experience principles: one coherent world, recognizable objects, controlled density, authored camera movement, and a continuous route. No Vectr model, brand mark, copy, spatial layout, or industrial asset is reproduced.

## Palette and material library

| Material | Color | Principled values | Use |
| --- | --- | --- | --- |
| Warm white plastic | `#F6F5EF` | roughness .78, metalness .02 | tables, trays, housings |
| Cool white ceramic | `#FFFFFF` | roughness .62, metalness .00 | monitors, boards, device shells |
| Paper | `#FBFAF4` | roughness .95, subtle bump | sheets, cards, folders |
| Frosted acrylic | `#BFD4F5` | roughness .35, transmission .2 | rulers, scanner glass, UI layers |
| Soft grey metal | `#AEB7C2` | roughness .52, metalness .38 | stands, hinges, tools |
| Black rubber | `#111318` | roughness .9, metalness .00 | cables, feet, bezels |
| Screen glass | `#15191F` | roughness .24, emission from texture | live displays |
| Coral accent | `#FF7157` | roughness .58 | route, selection, passed state |
| Cobalt accent | `#2456FF` | roughness .5 | calibration, tokens, active UI |

No purple gradients, neon, bloom-led polish, glassmorphism, robots, floating spheres, holograms, or pseudo-text are allowed.

## Lighting

- Pale sky world background with a paper-white floor.
- Large soft key from camera-left/front and a weaker cool fill from camera-right.
- One restrained rim contribution to separate white objects from the background.
- Contact shadows and ambient occlusion establish grounding; micro-details do not all cast expensive shadows at runtime.
- Screen emission is low enough to retain frame and bezel detail.
- All four renders use the same lighting direction and color management.

## Scene 01: Observe

Primary object: a beveled research/scanning table.

Secondary objects: scanner bed, inspection monitor, paper tray, folder, articulated lamp, material rail.

Details: screenshot cards, type specimens, swatch fan, binder clips, pencil, sticky tabs, crop frame, scan beam, operator scale figure, cable, route node.

Composition: elevated three-quarter view. A clipped foreground sheet creates depth, the scanner occupies the visual center, and the inspection monitor closes the rear plane. Negative space remains on camera-left for DOM copy.

Main event: source sheets arrive, the scan beam traverses the bed, and one selected image exits into a coral crop frame.

Real content: `persona-home.webp` and `persona-result.webp` on printed cards and the inspection screen.

## Scene 02: Structure

Primary object: a vertical design-system grid board on a low console.

Secondary objects: UI panel rail, typography ruler, token dock, wireframe booklet, component sample tray, control strip.

Details: grid pins, connector lines, button states, card frames, nav strips, color tokens, type bars, baseline marks, status tab, route node, small scale figure.

Composition: slightly lower camera than Observe. The grid board dominates the midground, while foreground paper and token trays provide a natural transition occlusion.

Main event: loose interface panels travel to named target slots, the type ruler unfolds, tokens dock, and connector lines resolve the system.

Real content: 65 personas, 8 families, project UI crops, and actual MORPH palette tokens.

## Scene 03: Prototype

Primary object: a complete monitor and stand running a live website prototype.

Secondary objects: phone, tablet, keyboard, trackpad, mouse, ESP32 board, sensor, light ring.

Details: keys, ports, screws, board chips, status LEDs, cable clips, cursor path, UI chips, screen frame, route node, operator hand cue.

Composition: closest and most intimate shot. The monitor is central, phone and tablet form a diagonal sync line, and the hardware loop sits in the foreground.

Main event: the monitor wakes, the page UI enters, the phone synchronizes, a cursor moves, and the hardware light ring answers the sensor.

Real content: `web-aeroform.webp`, `web-field-notes.webp`, `persona-home.webp`, and `device-tree-hole.webp`.

## Scene 04: Release

Primary object: a multi-device delivery station with QA panel.

Secondary objects: main display, laptop, phone, projection frame, archive box, release folder, project cover rack.

Details: QA rows, check marks, version strip, QR-style card, performance chips, browser status, packaging latch, thumbnails, route node, completion flag.

Composition: the camera widens and stabilizes. Devices form a balanced but asymmetric final tableau, with the coral endpoint close to the visual center.

Main event: Draft changes to Live, devices synchronize, QA checks pass in sequence, the version tag appears, and the archive package closes.

Real content: existing project images and explicit checks for build, browser QA, mobile, and deploy.

## Hero handoff

Hero uses the Observe Blender render from the same camera/material/lighting system as the live journey. The three floating explanation cards are removed. A restrained plate caption names the scene and its status. At the journey boundary, background color, camera direction, and Observe composition match closely enough that the live Canvas feels like the still image has begun moving.

## Mobile and reduced motion

The same four Blender renders become vertical narrative plates. Each plate keeps a stable 8:5 ratio, visible stage number, concise text, and a vertical coral connector. No high-detail GLB is loaded under 1024px or when reduced motion is requested. All controls remain at least 44px and all semantic content remains in DOM.
