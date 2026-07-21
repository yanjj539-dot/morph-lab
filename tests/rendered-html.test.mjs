import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function render(pathname = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${pathname}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`https://morph-lab.test${pathname}`, {
      headers: {
        accept: "text/html",
        host: "morph-lab.test",
        "x-forwarded-host": "morph-lab.test",
        "x-forwarded-proto": "https",
      },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the finished MORPH//LAB homepage", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html lang="zh-CN">/i);
  assert.match(
    html,
    /<title>MORPH\/\/LAB — AI Design, Interactive Systems and Digital Experiments<\/title>/i,
  );
  assert.match(html, /DESIGN SYSTEMS/);
  assert.match(html, /MADE TO MOVE\./);
  assert.match(html, /把模型、界面与交互，做成可以真实运行的作品。/);
  assert.match(html, /OBSERVE/);
  assert.match(html, /STRUCTURE/);
  assert.match(html, /PROTOTYPE/);
  assert.match(html, /RELEASE/);
  assert.match(html, /WHAT I ACTUALLY MAKE/);
  assert.match(html, /Abstract Persona System/);
  assert.match(html, /Digital Portfolio Experiments/);
  assert.match(html, /Emotional Interaction Device/);
  assert.match(html, /AI Design Workflow/);
  assert.match(html, /LET&#x27;S MAKE THE NEXT ONE REAL\.|LET'S MAKE THE NEXT ONE REAL\./);
  assert.match(html, /跳到主要内容/);
  assert.match(html, /https:\/\/morph-lab\.test\/og\.png/);
  assert.match(html, /application\/ld\+json/);
  assert.match(html, /\/fallback\/round-4\/hero-observe\.webp/);
  assert.match(html, /\/fallback\/round-4\/observe\.webp/);
  assert.match(html, /media="\(max-width: 1023px\), \(prefers-reduced-motion: reduce\)"/);
  assert.doesNotMatch(html, /MORPH SYSTEM \/ ONLINE/);
  assert.doesNotMatch(html, /AI SHOULD NOT LOOK LIKE AI/);
  assert.doesNotMatch(html, /Synthetic Memory Archive/);
  assert.doesNotMatch(html, /Emotional Species Atlas/);
  assert.doesNotMatch(html, /Autonomous Design Operator/);
  assert.doesNotMatch(html, /LIVE GENERATIVE SYSTEM/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|Building your site/i);
});

test("server-renders every public route with independent metadata", async () => {
  const routes = [
    ["/work", "Selected Work — MORPH//LAB", "SELECTED WORK"],
    ["/studio", "Studio — MORPH//LAB", "INDEPENDENT DESIGN LAB"],
    ["/contact", "Contact — MORPH//LAB", "START A CONVERSATION"],
  ];

  for (const [pathname, title, marker] of routes) {
    const response = await render(pathname);
    assert.equal(response.status, 200, pathname);
    const html = await response.text();
    assert.match(html, new RegExp(`<title>${title}<\\/title>`, "i"), pathname);
    assert.match(html, new RegExp(marker, "i"), pathname);
  }
});

test("ships real project assets and the responsive scroll journey", async () => {
  const packageJson = await readFile(new URL("../package.json", import.meta.url), "utf8");
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const studio = await readFile(new URL("../app/studio/page.tsx", import.meta.url), "utf8");
  const siteData = await readFile(new URL("../app/data/site.ts", import.meta.url), "utf8");
  const journeyData = await readFile(new URL("../app/data/journey.ts", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(packageJson, /"three"/);
  assert.match(packageJson, /"gsap"/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton|drizzle/);
  assert.match(page, /import ScrollJourney from "\.\/components\/ScrollJourney"/);
  assert.match(page, /<ScrollJourney \/>/);
  assert.doesNotMatch(page, /<MorphCore \/>|<LiveGenerativeSystem \/>/);
  assert.match(page, /<HeroScene\b/);
  assert.match(page, /fallbackSrc=\{withBasePath\("\/fallback\/round-4\/hero-observe\.webp"\)\}/);
  assert.match(page, /mobileFallbackSrc=\{withBasePath\("\/fallback\/round-4\/observe\.webp"\)\}/);
  assert.doesNotMatch(page, /hero-card|hero-card--note|hero-card--system|hero-card--release/);
  assert.match(
    studio,
    /src=\{withBasePath\("\/images\/morph-studio-workbench-v1\.webp"\)\}/,
  );
  assert.match(
    siteData,
    /src:\s*withBasePath\("\/images\/morph-workflow-quality-gate-v1\.webp"\)/,
  );
  assert.match(journeyData, /export type JourneyStageId/);
  assert.match(journeyData, /export type JourneyStage/);
  assert.match(journeyData, /export const JOURNEY_STAGE_PROGRESS = \[0\.08, 0\.36, 0\.63, 0\.9\] as const/);
  assert.match(journeyData, /export const JOURNEY_STAGES/);
  assert.match(journeyData, /fallbackSrc:\s*withBasePath\("\/fallback\/round-4\/observe\.webp"\)/);
  assert.match(journeyData, /fallbackSrc:\s*withBasePath\("\/fallback\/round-4\/structure\.webp"\)/);
  assert.match(journeyData, /fallbackSrc:\s*withBasePath\("\/fallback\/round-4\/prototype\.webp"\)/);
  assert.match(journeyData, /fallbackSrc:\s*withBasePath\("\/fallback\/round-4\/release\.webp"\)/);
  assert.match(css, /\.hero-scene__fallback/);

  assert.match(css, /--color-sky:\s*#bfd4f5/i);
  assert.match(css, /--color-paper:\s*#f6f5ef/i);
  assert.match(css, /--color-blue:\s*#2456ff/i);
  assert.match(css, /--color-coral:\s*#ff7157/i);
  assert.match(css, /@media\s*\(max-width:\s*1023px\)/i);

  await Promise.all(
    [
      "../public/og.png",
      "../public/favicon.png",
      "../public/images/persona-home.webp",
      "../public/images/persona-result.webp",
      "../public/images/web-aeroform.webp",
      "../public/images/web-field-notes.webp",
      "../public/images/web-smoke-fruit.webp",
      "../public/images/web-units.webp",
      "../public/images/device-tree-hole.webp",
      "../public/images/morph-studio-workbench-v1.webp",
      "../public/images/morph-workflow-quality-gate-v1.webp",
      "../public/fallback/round-4/hero-observe.webp",
      "../public/fallback/round-4/journey-observe.webp",
      "../public/fallback/round-4/observe.webp",
      "../public/fallback/round-4/structure.webp",
      "../public/fallback/round-4/prototype.webp",
      "../public/fallback/round-4/release.webp",
      "../public/fallback/round-4/wireframe.webp",
    ].map((path) => access(new URL(path, import.meta.url))),
  );
});

test("ships the split ScrollJourney component surface", async () => {
  await assert.rejects(
    access(new URL("../app/components/ScrollJourney.tsx", import.meta.url)),
    /ENOENT/,
  );

  const [
    scrollJourney,
    journeyUi,
    journeyProgress,
    journeyLabels,
    journeyFallback,
    index,
    css,
  ] = await Promise.all(
    [
      "../app/components/ScrollJourney/ScrollJourney.tsx",
      "../app/components/ScrollJourney/JourneyUI.tsx",
      "../app/components/ScrollJourney/JourneyProgress.tsx",
      "../app/components/ScrollJourney/JourneyLabels.tsx",
      "../app/components/ScrollJourney/JourneyFallback.tsx",
      "../app/components/ScrollJourney/index.ts",
      "../app/globals.css",
    ].map((path) => readFile(new URL(path, import.meta.url), "utf8")),
  );

  assert.match(index, /export\s+\{\s*default\s*\}\s+from\s+["']\.\/ScrollJourney["']/);
  assert.match(scrollJourney, /JourneyUI/);
  assert.match(scrollJourney, /JourneyProgress/);
  assert.match(scrollJourney, /JourneyLabels/);
  assert.match(scrollJourney, /JourneyFallback/);
  assert.match(journeyUi, /JOURNEY_STAGES/);
  assert.match(journeyProgress, /<button\b/);
  assert.match(journeyProgress, /type=["']button["']/);
  assert.match(journeyProgress, /aria-current/);
  assert.match(journeyProgress, /JOURNEY_STAGE_PROGRESS/);
  assert.match(journeyLabels, /labelHost|round2-projected-label|aria-hidden/);
  assert.match(journeyFallback, /fallbackSrc/);
  assert.match(journeyFallback, /journey-observe\.webp/);
  assert.match(journeyFallback, /alt=/);
  assert.match(
    css,
    /\.(?:journey-progress|scroll-journey)[^{]*(?:button|__button)[\s\S]*?min-(?:height|width):\s*(?:44px|2\.75rem)/,
  );
});

test("supports a repository-scoped GitHub Pages static export", async () => {
  const [nextConfig, layout, sitemap, siteData, packageJson] = await Promise.all([
      readFile(new URL("../next.config.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/sitemap.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/data/site.ts", import.meta.url), "utf8"),
      readFile(new URL("../package.json", import.meta.url), "utf8"),
    ]);

  assert.match(nextConfig, /GITHUB_PAGES/);
  assert.match(nextConfig, /output:\s*isGitHubPages\s*\?\s*"export"/);
  assert.match(nextConfig, /basePath/);
  assert.match(packageJson, /"build:pages"/);
  assert.doesNotMatch(layout, /next\/headers/);
  assert.doesNotMatch(sitemap, /next\/headers/);
  assert.match(siteData, /withBasePath/);
  for (const componentPath of [
    "../app/components/SiteHeader.tsx",
    "../app/components/SiteFooter.tsx",
    "../app/components/SignalButton.tsx",
    "../app/components/ProjectShowcase.tsx",
  ]) {
    const component = await readFile(new URL(componentPath, import.meta.url), "utf8");
    assert.doesNotMatch(component, /next\/link/);
  }
  await access(new URL("../public/.nojekyll", import.meta.url));
});
