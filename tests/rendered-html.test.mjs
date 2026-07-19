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
  assert.match(html, /<title>MORPH\/\/LAB — AI Design and Interactive Systems<\/title>/i);
  assert.match(html, /DESIGNING/);
  assert.match(html, /INTELLIGENCE/);
  assert.match(html, /LIVE GENERATIVE SYSTEM/);
  assert.match(html, /跳到主要内容/);
  assert.match(html, /https:\/\/morph-lab\.test\/og\.png/);
  assert.match(html, /application\/ld\+json/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|Building your site/i);
});

test("server-renders every public route with independent metadata", async () => {
  const routes = [
    ["/work", "Selected Work — MORPH//LAB", "SYSTEMS FOR"],
    ["/studio", "Studio — MORPH//LAB", "A SMALL LAB"],
    ["/contact", "Contact — MORPH//LAB", "BRING A QUESTION"],
  ];

  for (const [pathname, title, marker] of routes) {
    const response = await render(pathname);
    assert.equal(response.status, 200, pathname);
    const html = await response.text();
    assert.match(html, new RegExp(`<title>${title}<\\/title>`, "i"), pathname);
    assert.match(html, new RegExp(marker, "i"), pathname);
  }
});

test("ships project assets and removes starter-only dependencies", async () => {
  const packageJson = await readFile(new URL("../package.json", import.meta.url), "utf8");
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.match(packageJson, /"three"/);
  assert.match(packageJson, /"gsap"/);
  assert.match(packageJson, /"lenis"/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton|drizzle/);
  assert.match(page, /<MorphCore \/>/);
  assert.match(page, /<LiveGenerativeSystem \/>/);

  await Promise.all(
    [
      "../public/og.png",
      "../public/favicon.png",
      "../public/images/project-memory.avif",
      "../public/images/project-species.webp",
      "../public/images/project-operator.jpg",
    ].map((path) => access(new URL(path, import.meta.url))),
  );
});

