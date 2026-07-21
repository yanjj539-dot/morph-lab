# MORPH//LAB Round 2 delivery

Date: 2026-07-21

## Delivered result

Round 2 replaces the placeholder geometry journey with four authored Blender scenes in one continuous Three.js world. The live desktop path uses Draco GLBs, external project textures, a camera rig with spline motion, stage animation adapters, a continuous coral route, projected DOM labels, and stage-boundary React updates.

The same `JOURNEY_STAGES` data drives desktop UI and the four static fallback plates. Viewports below `1024px`, Reduced Motion, missing WebGL, and asset-load errors never initialize the Three runtime.

## Runtime modes

| Mode | Scene | Scrolling | Asset behavior |
| --- | --- | --- | --- |
| Desktop, motion enabled, WebGL available | Four live GLBs | 420% pinned ScrollTrigger journey | Four GLBs + named external WebP textures |
| Mobile/tablet | Four Blender plates | Native vertical flow | Zero GLB requests |
| Reduced Motion | Four Blender plates | Native vertical flow | Zero GLB requests |
| WebGL/load error | Four Blender plates | Native vertical flow | Runtime aborts and disposes owned resources |

## Verification evidence

- `npm run lint`: pass.
- `npx tsc --noEmit`: pass.
- `npm run test:round2`: 7/7 pass.
- `npm test`: 5/5 rendered-page tests pass after a production vinext build.
- GitHub Pages static export: pass; all Round 2 GLBs, fallbacks, and Draco decoder files are present under `out/` with `/morph-lab` URLs.
- `npm run qa:round2`: pass across four deterministic stages and seven viewport sizes.
- Desktop GLB requests: 4. Mobile GLB requests: 0. Reduced Motion GLB requests: 0.
- Canvas pixel deviation: `30.69-64.28`; entropy: `3.34-5.05`.
- Desktop Lighthouse: performance 97, accessibility 100, best practices 96, SEO 100.
- Mobile Lighthouse: performance 73, accessibility 96, best practices 96, SEO 100.
- Desktop video: `1440x900`, 8.16 seconds.
- Mobile video: `390x844`, 7.04 seconds.

Primary evidence is stored in `artifacts/qa-round2/`.

## Honest self-assessment

| Category | Score | Evidence |
| --- | ---: | --- |
| Scene recognizability | 19/20 | Four clearly different workstations with named functional objects and real screens |
| 3D art quality | 18/20 | Bevels, material families, controlled lighting, contact shadows, and authored composition |
| Scroll narrative | 18/20 | Camera rig, spline path, four scene events, continuous route, synchronized copy and labels |
| UI and micro-interaction | 13/15 | Accessible progress controls, loading/error state, scoped motion, restrained labels |
| Originality and brand | 10/10 | MORPH//LAB content, real project textures, independent scene language |
| Responsive and accessibility | 5/5 | Static mobile/reduced paths, keyboard buttons, `aria-current`, 44px targets |
| Performance and stability | 9/10 | Sub-1 MB combined GLBs, DPR cap, visibility pause, disposal, successful QA and build gates |
| **Total** | **92/100** | Exceeds the 85/100 delivery line with browser evidence |

The remaining performance point is reserved because automated QA does not replace profiling on a representative low-end physical Android device.

## Known platform note

Lighthouse 13 produces complete reports on this Windows machine but `chrome-launcher` can return `EPERM` while immediately deleting its temporary profile. The QA runner accepts that condition only when the JSON report exists and parses successfully, then retries cleanup. Other Lighthouse failures remain fatal.

`npm audit --omit=dev` reports two moderate findings from the PostCSS version bundled inside Next 16.2.6. The suggested automatic fix is an invalid major downgrade to Next 9.3.3, so the dependency is left unchanged pending an upstream Next release that updates the embedded PostCSS version.
