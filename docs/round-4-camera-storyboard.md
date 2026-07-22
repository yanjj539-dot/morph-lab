# MORPH//LAB Round 4 camera storyboard

Round 4 uses one continuous desktop camera path for the Hero handoff and Journey. The authored path keeps the stable Round 3 rig, then adds `CameraDolly` travel and small roll accents so close-up moments feel designed without creating constant tilt.

## Rig contract

`CameraRigRoot -> YawPivot -> PitchPivot -> CameraDolly -> PerspectiveCamera`

- Sample count: 41 normalized progress values, `0.000` through `1.000` at `0.025` increments.
- Roll limit: `0.026` radians.
- Adjacent stage overlap target: 8%-12%.
- Near plane must remain below the reported minimum clearance.
- Foreground occlusion is external-only and cannot expose internal surfaces.

## Story beats

| Progress | Shot | Intent | Camera behavior |
| ---: | --- | --- | --- |
| 0.000 | Observe wide | Hero and Journey share the opening material table. | Stable wide angle, no roll, generous text-safe area. |
| 0.200 | Observe push | Scanner and output card become the first close read. | Dolly pushes in, FOV narrows, tiny positive roll. |
| 0.290 | Paper occlusion | Structure starts to enter through a physical edge. | Lateral move with allowed paper foreground. |
| 0.450 | Structure board | System cards and rails become the main surface. | Lower angle, narrowed FOV, negative dolly. |
| 0.540 | Rail handoff | The route leaves Structure and prepares Prototype. | Short positive dolly, small counter-roll. |
| 0.680 | Prototype close | Monitor, phone, and tablet surfaces dominate. | Tightest FOV, near-field lateral pass, max roll below limit. |
| 0.770 | Cable handoff | Prototype resolves into Release objects. | Pulls away from close geometry before the final station. |
| 0.930 | Release wide | Delivery station and QA panel settle. | Wider FOV, external view, negative roll accent. |
| 1.000 | Final lock | The journey lands in a stable release pose. | Roll returns to zero and dolly settles outward. |

## QA evidence

`npm run qa:round4` writes:

- `artifacts/qa-round4/camera-collisions.json` with 41 per-sample camera poses, clearance, near-plane safety, occlusion, and exposure fields.
- `artifacts/qa-round4/journey-progress/progress-00-000.png` through `progress-40-100.png`.
- `artifacts/qa-round4/ui-states/hero-journey-handoff-desktop.png` for the Hero/Journey composition handoff.

## Verified Round 4 result

The authoritative 2026-07-22 run sampled every `0.025` step and reported:

- Camera samples: 41; High: 0; Medium: 0.
- Minimum clearance: `3.491962`; near-plane safe at every sample.
- External occlusions: 0; internal surface exposures: 0.
- Authored roll stays within the `0.026` radian limit and returns to zero at the final lock.
- Visual checkpoints at progress `0.000`, `0.500`, and `1.000` preserve readable copy while moving from Observe wide, through the Prototype close pass, to the Release lock.

The desktop contact sheet confirms a continuous push/transition/pull-back rhythm. Mobile and Reduced Motion use the four authored static plates with no canvas or GLB requests, so the story order remains intact without camera motion.
