# MORPH//LAB Round 3 defect list

Date: 2026-07-21

Status values: `open`, `fixed`, `verified`, `accepted-contact`.

| Area / object | Defect | Severity | Progress / state | Planned repair | Verification | Status |
| --- | --- | --- | --- | --- | --- | --- |
| Round 2 contract test | Markdown row assertion retains Windows `\r` | High / engineering | baseline | Normalize the row before matching | `npm run test:round2` | verified |
| Camera timeline helper | `applyToCamera()` discards yaw and pitch | Medium | all | Remove the unsafe public path and apply poses only through Camera Rig | source contract + camera pose test | verified |
| Camera curve | Whole-curve index sampling weakens authored timing | High / visual | transitions | Use timed segments with per-segment easing and arc-length mapping | 30 progress captures + source contract | verified |
| Camera path | No safety corridor or collision proxy check | High | transitions | Author proxy bounds and validate sampled camera sphere distance | camera collision inspection + progress captures | verified |
| Stage crossfade | Transparent faded materials keep depth writes | High | `0.20-0.80` | Cache and disable depth writes while faded; restore deterministically | transition screenshots | verified |
| `STR_connectors` | Raw mesh draw range reveals triangle fragments | High | `0.25-0.44` | Replace with named connector segments driven by clip time / object scale | source contract + progress captures | verified |
| GLTF loader | Animation clips are discarded | High | load | Return root plus animations and bind an `AnimationMixer` | GLB/runtime contract | verified |
| All stage GLBs | No exported Blender actions | High | all | Export named stage actions with primary and delayed secondary motion | GLB JSON animation inspection | verified |
| All materials | Edge language and micro-surface response are too uniform | High / visual | static | Add four bevel tiers and distinct PBR paper, plastic, ceramic, metal, rubber, glass, and acrylic | review plates + texture manifest | verified |
| All materials | Exported surfaces are broadly double-sided | Medium | static | Repair normals and restrict double-sided rendering to intentional thin sheets | GLB material inspection | verified |
| Acrylic | Alpha blend lacks physical depth and causes ghosting | High / visual | transitions | Use transmission in Blender and an explicit web fallback with `depthWrite=false` | review + transition captures | verified |
| Runtime renderer | ACES Filmic and basic PCF do not match Round 3 target | Medium | all | Switch to AgX and PCF soft shadows with bounded exposure | pixel and Lighthouse QA | verified |
| Stage route meshes | Four embedded route pieces duplicate the runtime route | Medium | static | Remove stage route geometry and keep one controlled runtime path | GLB node inspection | verified |
| `OBS_output_card` | Image child transform is detached / doubled | High | Observe | Re-parent with local transform reset and separate paper/glass spacing | Blender re-import + review plate | verified |
| Observe scanner / paper | Scanner, paper layers, and small tools have weak contact hierarchy | Medium | Observe `0.00-0.25` | Correct Z offsets, add guides/hinges/feet, and animate through authored clearance | BVH report + 0.05 samples | verified |
| Structure board | Panels and tokens share repeated box language | Medium | Structure | Add rails, slots, clips, fasteners, and differentiated bevel tiers | review plate | verified |
| Structure connectors | Connectors lack semantic child order | High | Structure | Name and animate discrete connector children | GLB node/action inspection | verified |
| Prototype devices | Phone, monitor, ring, and bench include unallowlisted solid intersections | High | Prototype `0.46-0.78` | Correct stands/cable clearance and author clip-safe motion | BVH animation sampling | verified |
| Prototype screens | Screen content has no distinct glass layer / ordering policy | Medium | Prototype | Separate content and glass with explicit offset and render order | close review capture | verified |
| Release laptop screen | Screen child inherits a doubled transform | High | Release | Reset child local transform under the animated lid | re-import and 21-frame report | verified |
| Release project images | Image planes detach from project cards | High | Release | Rebuild card assemblies with local image offsets | re-import + review plate | verified |
| Release QR cells | QR child transforms detach and create floating cells | High | Release | Re-parent cells with local coordinates and validated clearance | re-import + review plate | verified |
| Header | Hidden header links remain keyboard-focusable offscreen | High / accessibility | scrolled | Reveal header on focus capture / focus-within | keyboard browser QA | verified |
| Stage buttons | Reduced Motion still requests smooth scroll | Medium / accessibility | fallback | Use immediate scrolling for reduced motion | load-policy browser QA | verified |
| Practice | No image/proof feedback and weak interaction continuity | Medium / visual | section | Add real evidence swatches, restrained image shift, and coral index line | viewport captures | verified |
| Selected Work | Mobile crops key screenshot content | Medium / visual | mobile | Add per-asset fit/focus policy and restrained pointer parallax | mobile section captures | verified |
| About | Metrics are too loose and lack real process material | Medium / visual | mobile / section | Add a compact process strip and tighten small-screen rhythm | viewport captures | verified |
| Final CTA | No four-stage visual convergence | Medium / visual | final | Converge four stage marks once with transform-only motion | recording + Reduced Motion check | verified |
| Mobile menu | Short / landscape heights can clip the CTA | Medium / accessibility | menu | Add vertical overflow and safe-area padding | `390x667` and `844x390` QA | verified |
