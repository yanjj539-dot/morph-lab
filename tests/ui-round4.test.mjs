import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function read(path) {
  try {
    return await readFile(new URL(path, root), "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return "";
    throw error;
  }
}

test("Round 4 homepage keeps the exact semantic Hero message", async () => {
  const page = await read("app/page.tsx");

  assert.match(page, /<h1\b[^>]*id=["']hero-title["']/);
  assert.match(page, /<span>DESIGN SYSTEMS<\/span>/);
  assert.match(page, /<span>MADE TO MOVE\.<\/span>/);
  assert.match(page, /把模型、界面与交互，做成可以真实运行的作品。/);
  assert.match(page, /<HeroScene\b/);
  assert.match(page, /fallback\/round-4\/hero-observe\.webp/);
  assert.match(page, /fallback\/round-4\/hero-observe-mobile\.webp/);
  assert.doesNotMatch(page, /DESIGN, SYSTEMS,|AND DIGITAL EXPERIMENTS/);
});

test("Hero loads at most one Observe GLB and hard-gates mobile and Reduced Motion", async () => {
  const [component, scene, models] = await Promise.all([
    read("app/components/HeroScene.tsx"),
    read("app/scene/createHeroScene.ts"),
    read("app/scene/assets/loadModels.ts"),
  ]);

  assert.match(component, /!isDesktop\s*\|\|\s*prefersReducedMotion/);
  assert.match(component, /import\(["']\.\.\/scene\/createHeroScene["']\)/);
  assert.doesNotMatch(component, /from\s+["']\.\.\/scene\/createHeroScene["']/);
  assert.match(scene, /loadRound4StageModel\(["']observe["']/);
  assert.match(scene, /HERO_POINTER_LIMIT_DEGREES\s*=\s*(?:1(?:\.\d+)?|2(?:\.0+)?)/);
  assert.match(scene, /HERO_OPENING_POSE/);
  assert.match(scene, /setExitProgress\(progress:\s*number\)/);
  assert.match(component, /controllerRef\.current\?\.setExitProgress/);
  assert.doesNotMatch(scene, /loadRound4Models\(/);
  assert.match(models, /export\s+(?:async\s+)?function\s+loadRound4StageModel/);
});

test("Journey uses Round 4 scenes while preserving the zero-GLB fallback gate", async () => {
  const [journeyData, journeyScene, journeyComponent, journeyFallback, journeyUi, styles] = await Promise.all([
    read("app/data/journey.ts"),
    read("app/scene/createJourneyScene.ts"),
    read("app/components/ScrollJourney/ScrollJourney.tsx"),
    read("app/components/ScrollJourney/JourneyFallback.tsx"),
    read("app/components/ScrollJourney/JourneyUI.tsx"),
    read("app/globals.css"),
  ]);

  for (const stage of ["observe", "structure", "prototype", "release"]) {
    assert.match(journeyData, new RegExp(`fallback/round-4/${stage}\\.webp`));
  }
  assert.match(journeyScene, /loadRound4Models/);
  assert.doesNotMatch(journeyScene, /loadRound3Models/);
  assert.match(journeyComponent, /!isDesktop\s*\|\|\s*prefersReducedMotion/);
  assert.match(journeyComponent, /import\(["']\.\.\/\.\.\/scene\/createJourneyScene["']\)/);
  assert.match(journeyFallback, /fallback\/round-4\/journey-observe\.webp/);
  assert.match(
    journeyFallback,
    /className=["']journey-fallback__stages["'][\s\S]*?aria-hidden=\{state === ["']ready["'] \|\| state === ["']loading["']\}/,
  );
  assert.match(journeyScene, /searchParams\.get\(["']qaProgress["']\)/);
  assert.match(journeyUi, /state\s*!==\s*["']ready["']\s*&&\s*state\s*!==\s*["']loading["']/);
  assert.match(styles, /scroll-journey\[data-state=["']loading["']\]\s+\.journey-ui__stage-copy/);
  assert.match(styles, /\.journey-fallback__status\.is-live[\s\S]*?clip-path:\s*inset\(50%\)/);
});

test("Practice, Work, About, and CTA expose the authored content contract", async () => {
  const [page, site, showcase] = await Promise.all([
    read("app/page.tsx"),
    read("app/data/site.ts"),
    read("app/components/ProjectShowcase.tsx"),
  ]);

  for (const title of [
    "AI Visual Systems",
    "Interactive Websites",
    "Physical Prototypes",
    "Agent Workflows",
  ]) {
    assert.match(site, new RegExp(`title:\\s*["']${title}["']`));
  }
  assert.match(page, /withBasePath\(`\/work#\$\{item\.projectId\}`\)/);
  assert.match(page, /data-page-transition/);
  assert.match(showcase, /data-page-transition/);
  for (const asset of [
    "/fallback/round-4/wireframe.webp",
    "/images/morph-hero-materials-v1.webp",
    "/images/device-tree-hole.webp",
    "/images/morph-studio-workbench-v1.webp",
  ]) {
    assert.ok(page.includes(asset), `${asset} appears in About`);
  }
  for (const datum of [">65<", ">08<", ">04<", ">ESP32<"]) {
    assert.ok(page.includes(datum), `${datum} remains real static data`);
  }
  assert.match(page, /\["observe", "structure", "prototype", "release"\]/);
  assert.equal((page.match(/data-cta-mark/g) ?? []).length, 1);
});

test("homepage sections retain semantic mobile reading order and bounded project zoom", async () => {
  const [page, showcase, motion] = await Promise.all([
    read("app/page.tsx"),
    read("app/components/ProjectShowcase.tsx"),
    read("app/components/MotionController.tsx"),
  ]);

  const orderedMarkers = [
    'className="hero',
    "<ScrollJourney />",
    'id="practice"',
    'id="selected-work"',
    'id="about"',
    'className="final-cta',
  ];
  let previous = -1;
  for (const marker of orderedMarkers) {
    const index = page.indexOf(marker);
    assert.ok(index > previous, `${marker} follows the previous semantic section`);
    previous = index;
  }
  assert.ok((page.match(/<h2\b/g) ?? []).length >= 4);
  for (const match of showcase.matchAll(/data-project-zoom=\{?[^\n]*?["'](\d+\.\d+)["']/g)) {
    assert.ok(Number(match[1]) <= 1.025, `project zoom ${match[1]} is bounded`);
  }
  assert.match(motion, /Math\.min\(1\.025/);
});

test("homepage does not promote below-fold project imagery over the Hero LCP", async () => {
  const [page, workPage, showcase] = await Promise.all([
    read("app/page.tsx"),
    read("app/work/page.tsx"),
    read("app/components/ProjectShowcase.tsx"),
  ]);

  assert.match(page, /<ProjectShowcase\s+prioritizeFirstImage=\{false\}\s*\/>/);
  assert.match(workPage, /<ProjectShowcase\s*\/>/);
  assert.match(showcase, /prioritizeFirstImage\s*=\s*true/);
  assert.match(
    showcase,
    /const shouldPrioritize\s*=\s*prioritizeFirstImage\s*&&\s*index\s*===\s*0\s*&&\s*assetIndex\s*===\s*0/,
  );
  assert.match(showcase, /loading=\{shouldPrioritize\s*\?\s*["']eager["']\s*:\s*["']lazy["']\}/);
  assert.match(showcase, /fetchPriority=\{shouldPrioritize\s*\?\s*["']high["']\s*:\s*["']auto["']\}/);
});

test("visible Journey and Practice labels remain part of their accessible names", async () => {
  const [page, progress, styles] = await Promise.all([
    read("app/page.tsx"),
    read("app/components/ScrollJourney/JourneyProgress.tsx"),
    read("app/globals.css"),
  ]);

  assert.doesNotMatch(page, /aria-label=\{`\$\{item\.titleZh\}：查看对应项目`\}/);
  assert.doesNotMatch(progress, /aria-label=\{`\$\{stage\.label\}/);
  assert.match(progress, /className=["']sr-only["'][^>]*>\s*:\s*\{stage\.title\}/);
  assert.match(
    styles,
    /\.journey-progress__item\s*\{[\s\S]*?color:\s*rgba\(17,\s*19,\s*24,\s*0\.62\)/,
  );
});

test("Hero and Journey dispose attached and software-fallback textures through one deduplicated path", async () => {
  const [heroScene, journeyScene, disposal] = await Promise.all([
    read("app/scene/createHeroScene.ts"),
    read("app/scene/createJourneyScene.ts"),
    read("app/scene/core/disposeScene.ts"),
  ]);

  assert.match(disposal, /extraTextures:\s*Iterable<Texture>\s*=\s*\[\]/);
  assert.match(disposal, /for\s*\(const texture of extraTextures\)/);
  assert.match(heroScene, /disposeScene\(scene,\s*renderer,\s*loadedTextures\)/);
  assert.doesNotMatch(heroScene, /for\s*\(const texture of loadedTextures\)\s*texture\.dispose/);
  assert.match(journeyScene, /loadedTextures\s*=\s*await applyRound4Textures/);
  assert.match(journeyScene, /disposeScene\(scene,\s*renderer,\s*loadedTextures\)/);
});

test("QA camera inspection publishes its initial frame before progress changes", async () => {
  const journeyScene = await read("app/scene/createJourneyScene.ts");

  assert.match(journeyScene, /!Number\.isFinite\(lastCameraInspectionProgress\)/);
  assert.match(journeyScene, /dataset\.cameraSample\s*=\s*JSON\.stringify/);
});
