# MORPH//LAB Round 2 camera storyboard

## Rig

```text
CameraRig
└─ CameraRoot
   └─ YawPivot
      └─ PitchPivot
         └─ PerspectiveCamera
```

The timeline interpolates authored position and target curves, then applies restrained yaw/pitch offsets and FOV changes. The camera never uses a single linear X formula.

## Progress windows

| Chapter | Range | Overlap |
| --- | --- | --- |
| Observe | 0.00-0.24 | overlaps Transition A at 0.20-0.30 |
| Structure | 0.25-0.49 | overlaps Transition B at 0.45-0.55 |
| Prototype | 0.50-0.74 | overlaps Transition C at 0.70-0.80 |
| Release | 0.75-1.00 | settles from 0.92-1.00 |

## Keyframes

| t | Shot | Position | Target | FOV | Yaw | Pitch |
| ---: | --- | --- | --- | ---: | ---: | ---: |
| 0.00 | Observe wide | `[-7.35, 4.25, 7.60]` | `[-6.00, 0.45, -1.55]` | 36 | -0.03 | -0.04 |
| 0.20 | Observe push | `[-6.35, 3.55, 6.20]` | `[-5.70, 0.38, -1.55]` | 33 | 0.02 | -0.02 |
| 0.29 | Paper occlusion | `[-4.65, 3.10, 5.55]` | `[-3.95, 0.72, -1.75]` | 34 | 0.06 | 0.00 |
| 0.45 | Structure board | `[-2.35, 2.65, 5.15]` | `[-2.05, 1.05, -2.00]` | 31 | -0.02 | 0.03 |
| 0.54 | Rail handoff | `[-0.20, 2.45, 4.75]` | `[0.25, 0.72, -1.70]` | 32 | 0.05 | 0.01 |
| 0.68 | Prototype close | `[2.00, 2.12, 4.10]` | `[2.25, 0.82, -1.72]` | 29 | -0.04 | 0.04 |
| 0.77 | Cable handoff | `[3.75, 2.48, 4.80]` | `[4.15, 0.58, -1.45]` | 32 | 0.04 | 0.00 |
| 0.93 | Release wide | `[6.05, 3.35, 6.35]` | `[6.10, 0.65, -1.52]` | 37 | -0.02 | -0.02 |
| 1.00 | Final lock | `[6.35, 3.55, 6.75]` | `[6.30, 0.62, -1.45]` | 38 | 0.00 | 0.00 |

## Transition language

### Observe to Structure

A large foreground source sheet crosses the lower-right frame while the camera lowers. The coral route remains visible through the handoff and the target shifts from scanner bed to grid board center.

### Structure to Prototype

The camera passes the edge of the vertical board and a thin calibration rail. FOV narrows as the monitor becomes the next focus. Token movement completes before the screen wakes.

### Prototype to Release

A black cable and the coral route lead out of the close device shot. The camera pulls back, the target moves to the multi-device center, and FOV widens for the final complete tableau.

## Motion constraints

- Camera interpolation uses cached curves and scalar lerps with no per-frame allocations.
- Look target and FOV have their own curves; `lookAt` is not derived from camera X.
- No fast rotation, large pointer following, or camera roll.
- Scroll controls authored progress with `scrub` smoothing; it never starts an independent camera tween.
- Reduced motion and mobile do not initialize this rig.
- Query parameter `qaStage=observe|structure|prototype|release` freezes the camera at deterministic review progress.
