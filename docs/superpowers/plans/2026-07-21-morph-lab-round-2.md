# MORPH//LAB Round 2 High-Fidelity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the MORPH//LAB grey-box journey with four Blender-authored GLB workbench scenes, authored camera and stage motion, accessible synchronized UI, deliberate static fallbacks, and complete visual/performance evidence.

**Architecture:** React remains the semantic/accessibility shell while a standalone Three.js runtime owns models, camera, animation, labels, and cleanup. Blender generates the four named GLBs and matching fallback renders from one source script. Desktop motion-enabled browsers load the live runtime; mobile, reduced-motion, WebGL failure, and load failure use the four static renders.

**Tech Stack:** Next.js 16, React 19, TypeScript 5.9, Three.js 0.185, GSAP 3.15, ScrollTrigger, Lenis, Blender 5.1.2 Python API, Playwright, Lighthouse, ffmpeg, Node test runner.

## Global Constraints

- Preserve current Next/React/Three/GSAP/Lenis and GitHub Pages architecture.
- All public URLs use `withBasePath()`; never hardcode a root-relative model or fallback URL.
- No Vectr assets, copy, models, brand marks, or spatial layouts may be reused.
- No raw `BoxGeometry` may represent a final primary stage object.
- Each stage contains one primary object, 4-8 secondary objects, 8-15 details, one major event, 2-3 micro-actions, one screen state, one label, and one route response.
- Desktop DPR is capped at 1.5; mobile and reduced motion do not load the GLBs.
- React state changes only when stage/loading/error state changes, never once per animation frame.
- Do not enter runtime animation integration until all four static Blender renders pass the visual gate.
- AI image generation is not used for this asset set. If later required, only `C:\Users\严\Desktop\AI项目\draw_image.py` is permitted.
- Final completion requires four screenshots, two MP4 recordings, two Lighthouse JSON reports, seven viewport checks, and honest known limitations.

---

### Task 1: Lock the Round 2 contracts and split semantic journey data

**Files:**
- Create: `app/data/journey.ts`
- Create: `tests/round2-contract.test.mjs`
- Modify: `tests/rendered-html.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces: `JourneyStage`, `JOURNEY_STAGES`, `JourneyStageId`, `JOURNEY_STAGE_PROGRESS`.
- Consumes: existing public image paths and `withBasePath()`.

- [ ] **Step 1: Write the failing architecture and asset contract test**

```js
test("round 2 exports modular journey data and asset build commands", async () => {
  const journey = await readFile(new URL("../app/data/journey.ts", import.meta.url), "utf8");
  assert.match(journey, /export const JOURNEY_STAGES/);
  const packageJson = await readFile(new URL("../package.json", import.meta.url), "utf8");
  assert.match(packageJson, /"assets:round2"/);
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `node --test tests/round2-contract.test.mjs`

Expected: FAIL because `app/data/journey.ts` and the Round 2 scripts do not exist.

- [ ] **Step 3: Create the typed stage data**

```ts
export type JourneyStageId = "observe" | "structure" | "prototype" | "release";

export type JourneyStage = {
  id: JourneyStageId;
  label: string;
  eyebrow: string;
  title: string;
  body: string;
  details: readonly string[];
  labelText: string;
  fallbackSrc: string;
};

export const JOURNEY_STAGE_PROGRESS = [0.08, 0.36, 0.63, 0.9] as const;
```

- [ ] **Step 4: Add scripts without replacing existing commands**

```json
{
  "assets:round2": "\"D:\\\\blender.exe\" --background --python scripts/blender/build_round2_assets.py",
  "test:round2": "node --test tests/round2-contract.test.mjs",
  "qa:round2": "node scripts/qa-round2.mjs"
}
```

- [ ] **Step 5: Run existing and new contract tests**

Run: `node --test tests/rendered-html.test.mjs tests/round2-contract.test.mjs`

Expected: existing four tests and the new Task 1 contract tests all pass.

### Task 2: Build and visually gate the four Blender scenes

**Files:**
- Create: `scripts/blender/build_round2_assets.py`
- Create: `public/models/round-2/observe.glb`
- Create: `public/models/round-2/structure.glb`
- Create: `public/models/round-2/prototype.glb`
- Create: `public/models/round-2/release.glb`
- Create: `public/fallback/round-2/observe.webp`
- Create: `public/fallback/round-2/structure.webp`
- Create: `public/fallback/round-2/prototype.webp`
- Create: `public/fallback/round-2/release.webp`
- Create: `artifacts/01-observe.png`
- Create: `artifacts/02-structure.png`
- Create: `artifacts/03-prototype.png`
- Create: `artifacts/04-release.png`
- Modify: `docs/3d-asset-manifest.md`
- Test: `tests/round2-contract.test.mjs`

**Interfaces:**
- Produces named mesh groups listed in `docs/3d-asset-manifest.md`.
- Produces four 1600x1000 fallback renders and four GLBs with local origins.
- Consumes real project images under `public/images` for Blender render materials.

- [ ] **Step 1: Extend the failing test with file, magic-byte, and budget checks**

```js
const glb = await readFile(new URL("../public/models/round-2/observe.glb", import.meta.url));
assert.equal(glb.subarray(0, 4).toString("ascii"), "glTF");
assert.ok(glb.byteLength < 1_500_000);
```

- [ ] **Step 2: Implement reusable Blender helpers**

```py
def rounded_box(name, size, location, material, bevel=0.06):
    bpy.ops.mesh.primitive_cube_add(location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = tuple(value / 2 for value in size)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    modifier = obj.modifiers.new("Soft bevel", "BEVEL")
    modifier.width = bevel
    modifier.segments = 3
    obj.data.materials.append(material)
    return obj
```

- [ ] **Step 3: Author the material library, common lighting, and four named collections**

Implement the exact palette/material values in `docs/scene-art-direction.md`. Primary and secondary forms use bevel modifiers, curve cables, device frames, stands, hinges, rails, pins, screen planes, and grounded contact relationships.

- [ ] **Step 4: Export one GLB and render one plate per collection**

```py
bpy.ops.export_scene.gltf(
    filepath=str(model_path),
    export_format="GLB",
    use_selection=True,
    export_apply=True,
)
```

- [ ] **Step 5: Run the asset build**

Run: `npm run assets:round2`

Expected: eight public outputs and four artifact PNGs are generated; every Blender subprocess exits 0.

- [ ] **Step 6: Verify static scene quality before proceeding**

Run pixel checks for 1600x1000 dimensions, file size, channel variance, entropy, and non-background area. Manually inspect all four images. If a scene still reads as a random box pile, edit the Blender source and rebuild; do not start Task 3.

- [ ] **Step 7: Update the asset manifest with actual byte/object/triangle counts and `final` or `blocked` status**

Run: `node --test tests/round2-contract.test.mjs`

Expected: asset contract tests pass.

### Task 3: Implement the standalone Three.js journey runtime

**Files:**
- Create: `app/scene/assets/assetManifest.ts`
- Create: `app/scene/assets/loadModels.ts`
- Create: `app/scene/assets/loadTextures.ts`
- Create: `app/scene/core/createRenderer.ts`
- Create: `app/scene/core/createCameraRig.ts`
- Create: `app/scene/core/createLights.ts`
- Create: `app/scene/core/disposeScene.ts`
- Create: `app/scene/core/qualityManager.ts`
- Create: `app/scene/animation/progressMath.ts`
- Create: `app/scene/animation/cameraTimeline.ts`
- Create: `app/scene/animation/stageTimelines.ts`
- Create: `app/scene/interaction/projectedLabels.ts`
- Create: `app/scene/interaction/visibilityController.ts`
- Create: `app/scene/createJourneyScene.ts`
- Test: `tests/round2-contract.test.mjs`

**Interfaces:**
- Produces:

```ts
export type JourneySceneController = {
  setProgress(progress: number): void;
  scrollToStage(index: number): void;
  resize(): void;
  dispose(): void;
};

export async function createJourneyScene(options: {
  canvasHost: HTMLElement;
  labelHost: HTMLElement;
  onStageChange(index: number): void;
  onReady(): void;
  onError(error: Error): void;
}): Promise<JourneySceneController>;
```

- Consumes: `JOURNEY_STAGES`, `JOURNEY_STAGE_PROGRESS`, asset manifest URLs, named GLB nodes.

- [ ] **Step 1: Write failing source-contract tests for the runtime**

Assert that the camera rig has CameraRoot/YawPivot/PitchPivot, stage ranges overlap, renderer caps DPR at 1.5, visibility pause exists, and disposal includes texture/material/geometry/renderer cleanup.

- [ ] **Step 2: Implement pure progress math and camera sampling first**

```ts
export function rangeProgress(value: number, start: number, end: number) {
  const normalized = Math.min(1, Math.max(0, (value - start) / (end - start)));
  return normalized * normalized * (3 - 2 * normalized);
}
```

Use cached `CatmullRomCurve3` position and target curves plus scalar FOV/yaw/pitch interpolation from `docs/camera-storyboard.md`.

- [ ] **Step 3: Implement loader and texture assignment**

Load four GLBs with `GLTFLoader`, position stage roots in one continuous world, assign project textures to named `SCREEN_*` and `PRINT_*` meshes, configure color space/anisotropy, and fail atomically to fallback.

- [ ] **Step 4: Implement stage adapters**

Each adapter caches named nodes once, records initial transforms once, and updates only numeric transforms/material values. No `new Vector3`, arrays, or React callbacks occur per frame.

- [ ] **Step 5: Implement renderer, route, labels, visibility pause, and disposal**

Use a coral `TubeGeometry` or stable thin geometry for the route, project four DOM labels from cached world positions, pause on `document.hidden` and offscreen intersection, and release every owned WebGL resource.

- [ ] **Step 6: Run static checks**

Run: `npx tsc --noEmit && npm run lint && node --test tests/round2-contract.test.mjs`

Expected: all pass.

### Task 4: Replace the monolith with synchronized React UI and deliberate fallbacks

**Files:**
- Create: `app/components/ScrollJourney/ScrollJourney.tsx`
- Create: `app/components/ScrollJourney/JourneyUI.tsx`
- Create: `app/components/ScrollJourney/JourneyProgress.tsx`
- Create: `app/components/ScrollJourney/JourneyLabels.tsx`
- Create: `app/components/ScrollJourney/JourneyFallback.tsx`
- Create: `app/components/ScrollJourney/index.ts`
- Delete: `app/components/ScrollJourney.tsx`
- Modify: `app/page.tsx`
- Modify: `app/components/MotionController.tsx`
- Modify: `app/globals.css`
- Modify: `tests/rendered-html.test.mjs`

**Interfaces:**
- Consumes `createJourneyScene()` and stage data.
- Progress buttons call `controller.scrollToStage(index)` and set `aria-current="step"` only for the active stage.
- Fallback consumes the exact same `JOURNEY_STAGES` data.

- [ ] **Step 1: Write failing SSR/source tests for semantic behavior**

```js
assert.match(journeyProgress, /<button/);
assert.match(journeyProgress, /aria-current/);
assert.match(journeyFallback, /fallbackSrc/);
assert.doesNotMatch(journeyRoot, /new THREE\.BoxGeometry|function setBox/);
```

- [ ] **Step 2: Build the component split and mode state machine**

States: `fallback`, `loading`, `ready`, `error`. Desktop + motion + WebGL starts loading; every other path stays fallback. Loading/error always keeps fallback plates available under the semantic UI.

- [ ] **Step 3: Implement accessible progress and labels**

Use actual buttons, 44px targets, `aria-current`, keyboard focus, and restrained paper labels. The button scroll target is derived from the pinned section start/end, not a synthetic page reload.

- [ ] **Step 4: Replace Hero art and remove floating cards**

Use `withBasePath("/fallback/round-2/observe.webp")`, fixed dimensions, eager loading, and a caption that states Blender-authored real-time scene plate. Match its crop/background to the opening camera.

- [ ] **Step 5: Upgrade Practice, Selected Work, About, and Final CTA motion without new generic cards**

Use mask/clip reveals, restrained parallax, section-specific rhythm, and one stronger final route convergence. Preserve real project content and links.

- [ ] **Step 6: Implement mobile/reduced-motion CSS**

No pinned section, no Canvas, four 8:5 plates, vertical coral connector, readable type, and no overlap at 390px.

- [ ] **Step 7: Run unit/build checks**

Run: `npm run lint && npx tsc --noEmit && npm test`

Expected: 0 failures.

### Task 5: Add deterministic browser QA, screenshots, recordings, and performance reports

**Files:**
- Create: `playwright.config.ts`
- Create: `tests/browser/round2.spec.ts`
- Create: `scripts/qa-round2.mjs`
- Create: `artifacts/desktop-scroll.mp4`
- Create: `artifacts/mobile-scroll.mp4`
- Create: `artifacts/lighthouse-desktop.json`
- Create: `artifacts/lighthouse-mobile.json`
- Create: `artifacts/qa-summary.md`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Consumes `?qaStage=<id>` deterministic stage state.
- Produces all required artifacts and a machine-readable/Markdown summary.

- [ ] **Step 1: Add `@playwright/test` and `lighthouse` as dev dependencies**

Run: `npm install --save-dev @playwright/test lighthouse`

- [ ] **Step 2: Write failing browser checks**

Test zero page errors/failed first-party requests, no overflow, decoded images, desktop Canvas presence, mobile/reduced Canvas absence, stage progression, clickable keyboard progress, and deterministic QA stages.

- [ ] **Step 3: Capture the seven viewport matrix**

Required: 1920x1080, 1440x900, 1280x800, 1024x768, 768x1024, 430x932, 390x844. Save stage screenshots at 1920x1080 and layout snapshots for failures.

- [ ] **Step 4: Record desktop and mobile journeys**

Use Playwright `recordVideo`, scripted smooth scroll, then ffmpeg to H.264 MP4. Verify duration, dimensions, and minimum file size with `ffprobe`.

- [ ] **Step 5: Run Lighthouse**

Store desktop/mobile JSON and require: desktop performance >=80, mobile performance >=65, accessibility/best-practices/SEO >=90. If a gate fails, optimize and rerun rather than hiding the score.

- [ ] **Step 6: Validate Canvas pixels and artifacts**

Check nonblank variance/entropy, dimensions, file sizes, and exact presence of all required artifacts.

### Task 6: Final optimization, builds, review, and honest scoring

**Files:**
- Modify: `docs/3d-asset-manifest.md`
- Create: `docs/round-2-delivery.md`
- Modify: `README.md`
- Test: all test/build/browser commands.

**Interfaces:**
- Consumes all runtime and QA evidence.
- Produces final file list, metrics, known limitations, and rubric score.

- [ ] **Step 1: Run the full verification sequence**

```text
npm run lint
npx tsc --noEmit
npm test
GITHUB_PAGES=true GITHUB_REPOSITORY=yanjj539-dot/morph-lab NEXT_PUBLIC_SITE_URL=https://yanjj539-dot.github.io/morph-lab npm run build:pages
npm run qa:round2
```

- [ ] **Step 2: Inspect exported Pages paths**

Assert that every GLB, fallback image, texture, script, and route resolves under `/morph-lab/` and that exported HTML contains no test-domain metadata.

- [ ] **Step 3: Run an independent code review and visual review**

Review correctness, cleanup, accessibility, performance, asset honesty, and screenshot composition. Fix all blocking findings and rerun affected checks.

- [ ] **Step 4: Write `docs/round-2-delivery.md`**

Record modified files, actual model/fallback sizes, object/triangle counts, browser matrix, console/network result, Lighthouse scores, known limitations, unfinished assets, and the seven-part rubric score.

- [ ] **Step 5: Commit in reviewable units**

Use scoped commits for design docs, asset pipeline/assets, runtime/UI, and QA evidence. Do not publish or merge until the user explicitly authorizes production deployment.
