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
  assert.match(html, /DESIGN, SYSTEMS,/);
  assert.match(html, /DIGITAL EXPERIMENTS/);
  assert.match(html, /把模型、界面与视觉实验/);
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
  const journey = await readFile(
    new URL("../app/components/ScrollJourney.tsx", import.meta.url),
    "utf8",
  );
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(packageJson, /"three"/);
  assert.match(packageJson, /"gsap"/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton|drizzle/);
  assert.match(page, /<ScrollJourney \/>/);
  assert.doesNotMatch(page, /<MorphCore \/>|<LiveGenerativeSystem \/>/);

  assert.match(journey, /prefers-reduced-motion/);
  assert.match(journey, /setDrawRange/);
  assert.match(journey, /Math\.min\([^\n]*1\.5/);
  assert.match(journey, /cancelAnimationFrame/);
  assert.match(journey, /renderer\.dispose\(\)/);
  assert.match(journey, /forceContextLoss\(\)/);
  assert.match(journey, /disconnect\(\)/);
  assert.doesNotMatch(journey, /AdditiveBlending|Math\.random\(/);

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
    ].map((path) => access(new URL(path, import.meta.url))),
  );
});
