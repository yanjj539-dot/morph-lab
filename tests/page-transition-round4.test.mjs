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

async function loadPolicy() {
  return import(new URL("../app/lib/pageTransitionPolicy.ts", import.meta.url));
}

test("transition policy handles native forward pointer and keyboard navigation", async () => {
  const { shouldInterceptPageTransition } = await loadPolicy();
  const currentHref = "https://morph.test/morph-lab/";

  assert.equal(
    shouldInterceptPageTransition({
      currentHref,
      targetHref: "https://morph.test/morph-lab/studio/",
      button: 0,
    }),
    true,
  );
  assert.equal(
    shouldInterceptPageTransition({
      currentHref,
      targetHref: "https://morph.test/morph-lab/contact/",
      button: 0,
      detail: 0,
    }),
    true,
    "keyboard-generated click follows the same native-anchor path",
  );
  assert.equal(
    shouldInterceptPageTransition({
      currentHref,
      targetHref: "https://morph.test/morph-lab/work/#ai-visual-systems",
      button: 0,
    }),
    true,
    "a child route with a hash preserves the full static-export URL",
  );
});

test("transition policy bypasses hashes, modifiers, new tabs, downloads, and external URLs", async () => {
  const { shouldInterceptPageTransition } = await loadPolicy();
  const currentHref = "https://morph.test/morph-lab/";
  const baseIntent = {
    currentHref,
    targetHref: "https://morph.test/morph-lab/studio/",
    button: 0,
  };

  assert.equal(
    shouldInterceptPageTransition({ ...baseIntent, targetHref: `${currentHref}#process` }),
    false,
  );
  assert.equal(shouldInterceptPageTransition({ ...baseIntent, metaKey: true }), false);
  assert.equal(shouldInterceptPageTransition({ ...baseIntent, ctrlKey: true }), false);
  assert.equal(shouldInterceptPageTransition({ ...baseIntent, shiftKey: true }), false);
  assert.equal(shouldInterceptPageTransition({ ...baseIntent, altKey: true }), false);
  assert.equal(shouldInterceptPageTransition({ ...baseIntent, button: 1 }), false);
  assert.equal(shouldInterceptPageTransition({ ...baseIntent, target: "_blank" }), false);
  assert.equal(shouldInterceptPageTransition({ ...baseIntent, download: true }), false);
  assert.equal(
    shouldInterceptPageTransition({
      ...baseIntent,
      targetHref: "https://outside.example/studio/",
    }),
    false,
  );
  assert.equal(
    shouldInterceptPageTransition({ ...baseIntent, targetHref: "mailto:hello@morph.test" }),
    false,
  );
  assert.equal(
    shouldInterceptPageTransition({ ...baseIntent, targetHref: currentHref }),
    false,
    "same-document reload remains native",
  );
});

test("transition timing stays within the default and Reduced Motion budgets", async () => {
  const policy = await loadPolicy();

  assert.equal(policy.PAGE_TRANSITION_TOTAL_MS, 620);
  assert.equal(
    policy.PAGE_TRANSITION_OUT_MS + policy.PAGE_TRANSITION_IN_MS,
    policy.PAGE_TRANSITION_TOTAL_MS,
  );
  assert.ok(policy.PAGE_TRANSITION_TOTAL_MS >= 500);
  assert.ok(policy.PAGE_TRANSITION_TOTAL_MS <= 750);
  assert.ok(policy.PAGE_TRANSITION_REDUCED_MS <= 120);
  assert.equal(policy.navigationDelayForMotion(false), policy.PAGE_TRANSITION_OUT_MS);
  assert.equal(policy.navigationDelayForMotion(true), 0);
});

test("shared layer preserves native URL semantics and resets after pageshow", async () => {
  const [component, layout, css] = await Promise.all([
    read("app/components/PageTransitionLayer.tsx"),
    read("app/layout.tsx"),
    read("app/globals.css"),
  ]);

  assert.match(layout, /<PageTransitionLayer\s*\/>/);
  assert.match(layout, /<html\b[^>]*suppressHydrationWarning/);
  assert.ok(
    layout.indexOf("<PageTransitionLayer") < layout.indexOf("<SiteHeader"),
    "the solid layer bootstraps before public page content",
  );
  assert.match(component, /document\.addEventListener\(["']click["'],\s*handleClick,\s*true\)/);
  assert.match(component, /window\.location\.assign\(destination\.href\)/);
  assert.match(component, /sessionStorage/);
  assert.match(component, /window\.addEventListener\(["']pageshow["']/);
  assert.match(component, /clearTransitionState/);
  assert.match(component, /aria-hidden=["']true["']/);
  assert.doesNotMatch(component, /next\/link|Taxi/);
  assert.match(css, /\.page-transition-layer/);
  assert.match(css, /\.page-transition-leaving/);
  assert.match(css, /\.page-transition-incoming/);
  assert.match(css, /\.page-transition-entering/);
  assert.match(css, /background:\s*var\(--color-ink\)/);
  assert.doesNotMatch(css, /@view-transition/);
  assert.match(
    css,
    /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.page-transition-layer/,
  );
});

test("public route surfaces remain static-export-safe native anchors", async () => {
  const sources = await Promise.all([
    read("app/components/SiteHeader.tsx"),
    read("app/components/SiteFooter.tsx"),
    read("app/components/SignalButton.tsx"),
    read("app/components/ProjectShowcase.tsx"),
  ]);
  const combined = sources.join("\n");

  assert.doesNotMatch(combined, /from\s+["']next\/link["']/);
  assert.match(combined, /<a\b/);
  assert.match(combined, /withBasePath\(/);
});

test("Hero intent loading cannot preempt an immediate native route activation", async () => {
  const hero = await read("app/components/HeroScene.tsx");

  assert.match(hero, /const globalIntentEvents = \[["']scroll["']\] as const/);
  assert.match(hero, /root\.addEventListener\(["']pointerenter["'],\s*startFromIntent/);
  assert.match(hero, /root\.addEventListener\(["']touchstart["'],\s*startFromIntent/);
  assert.doesNotMatch(hero, /const intentEvents = \[[^\]]*["']pointermove["']/);
  assert.doesNotMatch(hero, /const intentEvents = \[[^\]]*["']keydown["']/);
});
