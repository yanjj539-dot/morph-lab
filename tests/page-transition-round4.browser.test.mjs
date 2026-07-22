import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import { createServer as createNetServer } from "node:net";
import { once } from "node:events";
import { performance } from "node:perf_hooks";
import { resolve } from "node:path";
import { after, before, test } from "node:test";

import { chromium } from "playwright";

const root = resolve(import.meta.dirname, "..");
const sessionKey = "morph-lab:page-transition";
const stateClasses = [
  "page-transition-leaving",
  "page-transition-incoming",
  "page-transition-entering",
];
const inkColor = "rgb(17, 19, 24)";

let baseUrl;
let browser;
let serverOutput = "";
let serverProcess;

function getFreePort() {
  return new Promise((resolvePort, reject) => {
    const server = createNetServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close((error) => (error ? reject(error) : resolvePort(port)));
    });
  });
}

async function waitForServer(url) {
  const deadline = Date.now() + 20_000;
  let lastError;

  while (Date.now() < deadline) {
    if (serverProcess.exitCode !== null) {
      throw new Error(
        `QA server exited with code ${serverProcess.exitCode}.\n${serverOutput}`,
      );
    }

    try {
      const response = await fetch(url);
      if (response.ok) return;
      lastError = new Error(`QA server returned ${response.status}.`);
    } catch (error) {
      lastError = error;
    }

    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }

  throw lastError ?? new Error("QA server did not become ready.");
}

async function stopServer() {
  if (!serverProcess || serverProcess.exitCode !== null) return;
  const exited = once(serverProcess, "exit");
  serverProcess.kill();
  await Promise.race([
    exited,
    new Promise((resolveWait) => setTimeout(resolveWait, 2_000)),
  ]);
}

function isStateSample(sample, state) {
  return (
    sample.kind === "state" &&
    (sample.state === state || sample.className.includes(`page-transition-${state}`))
  );
}

async function waitForSample(samples, predicate, label, timeout = 5_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const sample = samples.find(predicate);
    if (sample) return sample;
    await new Promise((resolveWait) => setTimeout(resolveWait, 10));
  }
  assert.fail(`${label} was not observed. Samples: ${JSON.stringify(samples, null, 2)}`);
}

async function createObservedContext(options = {}) {
  const samples = [];
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    reducedMotion: "no-preference",
    ...options,
  });

  await context.exposeBinding("__recordPageTransition", (_source, sample) => {
    samples.push({ ...sample, observedAt: performance.now() });
  });
  await context.addInitScript(
    ({ markerKey, trackedClasses }) => {
      const documentId = `${Date.now()}-${Math.random()}`;

      const report = (kind = "state", persisted = false) => {
        const rootElement = document.documentElement;
        if (!rootElement) return;
        const layer = document.querySelector(".page-transition-layer");
        const style = layer ? getComputedStyle(layer) : null;
        const rect = layer?.getBoundingClientRect();
        globalThis
          .__recordPageTransition?.({
            kind,
            persisted,
            documentId,
            clientTime: performance.now(),
            href: location.href,
            className: rootElement.className,
            state: rootElement.dataset.pageTransitionState ?? "",
            marker: sessionStorage.getItem(markerKey),
            activeTag: document.activeElement?.tagName ?? "",
            layer: layer
              ? {
                  ariaHidden: layer.getAttribute("aria-hidden"),
                  backgroundColor: style?.backgroundColor ?? "",
                  opacity: style?.opacity ?? "",
                  pointerEvents: style?.pointerEvents ?? "",
                  transitionDuration: style?.transitionDuration ?? "",
                  visibility: style?.visibility ?? "",
                  width: rect?.width ?? 0,
                  height: rect?.height ?? 0,
                }
              : null,
          })
          ?.catch(() => {});
      };

      const observeRoot = () => {
        const rootElement = document.documentElement;
        if (!rootElement) return false;
        const observer = new MutationObserver(() => {
          report();
          setTimeout(report, 0);
        });
        observer.observe(rootElement, {
          attributes: true,
          attributeFilter: ["class", "data-page-transition-state"],
          childList: true,
          subtree: true,
        });
        report();
        return true;
      };

      if (!observeRoot()) {
        const documentObserver = new MutationObserver(() => {
          if (observeRoot()) documentObserver.disconnect();
        });
        documentObserver.observe(document, { childList: true });
      }

      window.addEventListener("pageshow", (event) => {
        report("pageshow", event.persisted);
      });

      globalThis.__pageTransitionTest = {
        markerKey,
        report,
        trackedClasses,
      };
    },
    { markerKey: sessionKey, trackedClasses: stateClasses },
  );

  return { context, samples };
}

async function waitForTransitionClear(page) {
  await page.waitForFunction(
    (classes) => {
      const rootElement = document.documentElement;
      return (
        classes.every((className) => !rootElement.classList.contains(className)) &&
        !rootElement.dataset.pageTransitionState
      );
    },
    stateClasses,
    { timeout: 5_000 },
  );
}

async function readClearState(page) {
  return page.evaluate(({ markerKey, classes }) => {
    const rootElement = document.documentElement;
    const layer = document.querySelector(".page-transition-layer");
    const style = layer ? getComputedStyle(layer) : null;
    return {
      stateClasses: classes.filter((className) => rootElement.classList.contains(className)),
      state: rootElement.dataset.pageTransitionState ?? "",
      marker: sessionStorage.getItem(markerKey),
      pointerEvents: style?.pointerEvents ?? "",
      visibility: style?.visibility ?? "",
      layerFocusableCount:
        layer?.querySelectorAll(
          'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ).length ?? 0,
    };
  }, { markerKey: sessionKey, classes: stateClasses });
}

function assertSolidLayer(sample, label) {
  assert.ok(sample.layer, `${label}: layer exists`);
  assert.equal(sample.layer.ariaHidden, "true", `${label}: layer is aria-hidden`);
  assert.equal(sample.layer.backgroundColor, inkColor, `${label}: solid ink background`);
  assert.equal(sample.layer.visibility, "visible", `${label}: layer is visible`);
  assert.ok(sample.layer.width >= 1280, `${label}: layer spans viewport width`);
  assert.ok(sample.layer.height >= 800, `${label}: layer spans viewport height`);
}

function durationToMs(value) {
  return Math.max(
    ...value.split(",").map((part) => {
      const duration = part.trim();
      return duration.endsWith("ms")
        ? Number.parseFloat(duration)
        : Number.parseFloat(duration) * 1000;
    }),
  );
}

async function navigateWithPointer(page, samples, pathname = "/work") {
  const selector = `.site-header__desktop-links a[href="${pathname}"]`;
  const startedAt = performance.now();
  const destination = `${baseUrl}${pathname}`;
  await Promise.all([
    page.waitForURL(destination, { waitUntil: "domcontentloaded", timeout: 8_000 }),
    page.locator(selector).click(),
  ]);
  const committedAt = performance.now();
  const leaving = await waitForSample(
    samples,
    (sample) => isStateSample(sample, "leaving"),
    "leaving state",
  );
  const incoming = await waitForSample(
    samples,
    (sample) =>
      sample.href === destination &&
      isStateSample(sample, "incoming") &&
      sample.layer?.backgroundColor === inkColor,
    "solid incoming state",
  );
  const entering = await waitForSample(
    samples,
    (sample) => sample.href === destination && isStateSample(sample, "entering"),
    "entering state",
  );
  await waitForTransitionClear(page);
  return { startedAt, committedAt, leaving, incoming, entering };
}

before(async () => {
  await access(resolve(root, "dist", "server", "index.js"));
  const port = await getFreePort();
  baseUrl = `http://127.0.0.1:${port}`;
  serverProcess = spawn(process.execPath, ["scripts/qa-server.mjs"], {
    cwd: root,
    env: { ...process.env, QA_PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  serverProcess.stdout.on("data", (chunk) => {
    serverOutput += chunk;
  });
  serverProcess.stderr.on("data", (chunk) => {
    serverOutput += chunk;
  });
  await waitForServer(baseUrl);
  browser = await chromium.launch({ headless: true });
}, { timeout: 30_000 });

after(async () => {
  await browser?.close();
  await stopServer();
});

test("pointer navigation renders solid leave/enter states, honors timing, and restores focus flow", { timeout: 20_000 }, async () => {
  const { context, samples } = await createObservedContext();
  try {
    const page = await context.newPage();
    await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
    await waitForTransitionClear(page);
    samples.length = 0;

    const transition = await navigateWithPointer(page, samples);
    assert.ok(
      transition.committedAt - transition.startedAt >= 250,
      `default outbound timing was ${transition.committedAt - transition.startedAt}ms`,
    );
    assert.ok(
      transition.committedAt - transition.startedAt < 2_500,
      "default navigation does not remain blocked",
    );
    assertSolidLayer(transition.leaving, "leaving");
    assert.equal(transition.leaving.layer.pointerEvents, "auto");
    assertSolidLayer(transition.incoming, "incoming");

    const clearState = await readClearState(page);
    assert.deepEqual(clearState.stateClasses, []);
    assert.equal(clearState.state, "");
    assert.equal(clearState.marker, null);
    assert.equal(clearState.pointerEvents, "none");
    assert.equal(clearState.visibility, "hidden");
    assert.equal(clearState.layerFocusableCount, 0);

    await page.keyboard.press("Tab");
    assert.equal(
      await page.evaluate(() => document.activeElement?.classList.contains("skip-link")),
      true,
      "focus proceeds into the destination document instead of being trapped by the layer",
    );
  } finally {
    await context.close();
  }
});

test("keyboard Enter follows the same transition path", { timeout: 15_000 }, async () => {
  const { context, samples } = await createObservedContext();
  try {
    const page = await context.newPage();
    await page.goto(`${baseUrl}/work`, { waitUntil: "domcontentloaded" });
    await waitForTransitionClear(page);
    samples.length = 0;

    await page.locator('.site-header__desktop-links a[href="/studio"]').focus();
    await Promise.all([
      page.waitForURL(`${baseUrl}/studio`, { waitUntil: "domcontentloaded" }),
      page.keyboard.press("Enter"),
    ]);
    await waitForSample(samples, (sample) => isStateSample(sample, "leaving"), "keyboard leaving");
    await waitForSample(
      samples,
      (sample) => sample.href === `${baseUrl}/studio` && isStateSample(sample, "entering"),
      "keyboard entering",
    );
    await waitForTransitionClear(page);
    assert.deepEqual((await readClearState(page)).stateClasses, []);
  } finally {
    await context.close();
  }
});

test("same-page hashes bypass the shared transition", { timeout: 10_000 }, async () => {
  const { context, samples } = await createObservedContext();
  try {
    const page = await context.newPage();
    await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
    await waitForTransitionClear(page);
    samples.length = 0;

    await page.locator('.site-header__desktop-links a[href="/#process"]').click();
    await page.waitForURL(`${baseUrl}/#process`);
    await page.waitForTimeout(50);

    assert.equal(samples.some((sample) => stateClasses.some((name) => sample.className.includes(name))), false);
    assert.equal((await readClearState(page)).marker, null);
  } finally {
    await context.close();
  }
});

test("modifier clicks and target=_blank links bypass interception", { timeout: 15_000 }, async () => {
  const { context, samples } = await createObservedContext();
  try {
    const page = await context.newPage();
    await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
    await waitForTransitionClear(page);
    samples.length = 0;

    const modifierPopupPromise = context.waitForEvent("page");
    await page.locator('.site-header__desktop-links a[href="/work"]').click({
      modifiers: ["Control"],
    });
    const modifierPopup = await modifierPopupPromise;
    await modifierPopup.waitForURL(`${baseUrl}/work`, { waitUntil: "domcontentloaded" });
    assert.equal(page.url(), `${baseUrl}/`);
    assert.equal(modifierPopup.url(), `${baseUrl}/work`);
    await modifierPopup.close();

    await page.evaluate(() => {
      const anchor = document.createElement("a");
      anchor.id = "qa-new-tab-link";
      anchor.href = "/studio";
      anchor.target = "_blank";
      anchor.textContent = "Studio in new tab";
      document.body.append(anchor);
    });
    const targetPopupPromise = context.waitForEvent("page");
    await page.locator("#qa-new-tab-link").click();
    const targetPopup = await targetPopupPromise;
    await targetPopup.waitForURL(`${baseUrl}/studio`, { waitUntil: "domcontentloaded" });
    assert.equal(page.url(), `${baseUrl}/`);
    assert.equal(targetPopup.url(), `${baseUrl}/studio`);
    await targetPopup.close();

    assert.equal(samples.some((sample) => sample.href === `${baseUrl}/` && isStateSample(sample, "leaving")), false);
    assert.equal((await readClearState(page)).marker, null);
  } finally {
    await context.close();
  }
});

test("back, forward, and persisted pageshow restore an interactive clear state", { timeout: 20_000 }, async () => {
  const { context, samples } = await createObservedContext();
  try {
    const page = await context.newPage();
    await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
    await waitForTransitionClear(page);
    samples.length = 0;
    await navigateWithPointer(page, samples);

    samples.length = 0;
    await page.goBack({ waitUntil: "domcontentloaded" });
    await waitForTransitionClear(page);
    assert.equal(page.url(), `${baseUrl}/`);
    assert.deepEqual((await readClearState(page)).stateClasses, []);

    await page.goForward({ waitUntil: "domcontentloaded" });
    await waitForTransitionClear(page);
    assert.equal(page.url(), `${baseUrl}/work`);
    assert.deepEqual((await readClearState(page)).stateClasses, []);

    await page.evaluate(({ markerKey }) => {
      sessionStorage.setItem(markerKey, JSON.stringify({ href: location.href, createdAt: Date.now() }));
      const rootElement = document.documentElement;
      rootElement.classList.add("page-transition-leaving");
      rootElement.dataset.pageTransitionState = "leaving";
      window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }));
    }, { markerKey: sessionKey });
    await waitForTransitionClear(page);
    const clearState = await readClearState(page);
    assert.equal(clearState.marker, null);
    assert.equal(clearState.pointerEvents, "none");
  } finally {
    await context.close();
  }
});

test("direct child-route loads and refreshes remain transition-free", { timeout: 15_000 }, async () => {
  const { context, samples } = await createObservedContext();
  try {
    const page = await context.newPage();
    await page.goto(`${baseUrl}/contact`, { waitUntil: "domcontentloaded" });
    await waitForTransitionClear(page);
    assert.deepEqual((await readClearState(page)).stateClasses, []);
    assert.equal(samples.some((sample) => isStateSample(sample, "incoming")), false);

    samples.length = 0;
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForTransitionClear(page);
    assert.deepEqual((await readClearState(page)).stateClasses, []);
    assert.equal(samples.some((sample) => isStateSample(sample, "incoming")), false);
  } finally {
    await context.close();
  }
});

test("base-path destinations preserve pathname, search, and hash", { timeout: 20_000 }, async () => {
  const { context, samples } = await createObservedContext();
  try {
    const page = await context.newPage();
    await page.route(`${baseUrl}/morph-lab/**`, async (route) => {
      const requested = new URL(route.request().url());
      const strippedPath = requested.pathname.replace(/^\/morph-lab/, "") || "/";
      const upstream = new URL(`${strippedPath}${requested.search}`, baseUrl);
      const response = await route.fetch({ url: upstream.href });
      await route.fulfill({ response });
    });
    await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
    await waitForTransitionClear(page);
    samples.length = 0;

    const destination = `${baseUrl}/morph-lab/work?view=grid#selected`;
    await page.evaluate((href) => {
      const anchor = document.createElement("a");
      anchor.id = "qa-base-path-link";
      anchor.href = href;
      anchor.textContent = "Base path work";
      document.body.append(anchor);
    }, destination);
    await Promise.all([
      page.waitForURL(destination, { waitUntil: "domcontentloaded" }),
      page.locator("#qa-base-path-link").click(),
    ]);
    await waitForSample(
      samples,
      (sample) => sample.href === destination && isStateSample(sample, "incoming"),
      "base-path incoming state",
    );
    await waitForTransitionClear(page);

    assert.equal(page.url(), destination);
    assert.equal((await readClearState(page)).marker, null);
  } finally {
    await context.close();
  }
});

test("boot rejects malformed, mismatched, and stale markers before exposing the layer", { timeout: 20_000 }, async () => {
  const cases = [
    { name: "malformed", marker: "not-json" },
    {
      name: "mismatched",
      marker: JSON.stringify({ href: "https://outside.test/work", createdAt: Date.now() }),
    },
    {
      name: "stale",
      marker: JSON.stringify({ href: "CURRENT", createdAt: Date.now() - 60_000 }),
    },
  ];

  for (const markerCase of cases) {
    const { context, samples } = await createObservedContext();
    try {
      await context.addInitScript(
        ({ markerKey, marker }) => {
          const value = marker.replace("CURRENT", location.href);
          sessionStorage.setItem(markerKey, value);
        },
        { markerKey: sessionKey, marker: markerCase.marker },
      );
      const page = await context.newPage();
      await page.goto(`${baseUrl}/contact?marker=${markerCase.name}`, {
        waitUntil: "domcontentloaded",
      });
      await waitForTransitionClear(page);
      await page.waitForTimeout(50);

      assert.equal(
        samples.some((sample) => isStateSample(sample, "incoming")),
        false,
        `${markerCase.name} marker never exposes incoming state`,
      );
      assert.equal((await readClearState(page)).marker, null, markerCase.name);
    } finally {
      await context.close();
    }
  }
});

test("reveal revalidates a marker that becomes invalid after boot", { timeout: 15_000 }, async () => {
  const { context, samples } = await createObservedContext();
  try {
    await context.addInitScript(({ markerKey }) => {
      sessionStorage.setItem(
        markerKey,
        JSON.stringify({ href: location.href, createdAt: Date.now() }),
      );
      const corruptMarker = () => {
        const rootElement = document.documentElement;
        if (!rootElement?.classList.contains("page-transition-incoming")) return false;
        sessionStorage.setItem(
          markerKey,
          JSON.stringify({ href: `${location.href}mismatch`, createdAt: Date.now() }),
        );
        return true;
      };
      if (!corruptMarker()) {
        const observer = new MutationObserver(() => {
          if (corruptMarker()) observer.disconnect();
        });
        observer.observe(document, { attributes: true, childList: true, subtree: true });
      }
    }, { markerKey: sessionKey });
    const page = await context.newPage();
    await page.goto(`${baseUrl}/studio?marker=revalidate`, { waitUntil: "domcontentloaded" });
    await waitForSample(samples, (sample) => isStateSample(sample, "incoming"), "valid boot incoming");
    await waitForTransitionClear(page);
    await page.waitForTimeout(50);

    assert.equal(samples.some((sample) => isStateSample(sample, "entering")), false);
    assert.equal((await readClearState(page)).marker, null);
  } finally {
    await context.close();
  }
});

test("Reduced Motion completes its reveal within 120ms", { timeout: 15_000 }, async () => {
  const { context, samples } = await createObservedContext({ reducedMotion: "reduce" });
  try {
    const page = await context.newPage();
    await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
    await waitForTransitionClear(page);
    samples.length = 0;
    const transition = await navigateWithPointer(page, samples);
    const clear = await waitForSample(
      samples,
      (sample) =>
        sample.documentId === transition.entering.documentId &&
        sample.clientTime > transition.entering.clientTime &&
        sample.state === "" &&
        stateClasses.every((className) => !sample.className.includes(className)),
      "Reduced Motion clear state",
    );
    const revealDuration = clear.clientTime - transition.entering.clientTime;

    assert.ok(revealDuration <= 120, `Reduced Motion reveal took ${revealDuration}ms`);
    assert.ok(
      durationToMs(transition.entering.layer.transitionDuration) <= 120,
      `Reduced Motion CSS duration was ${transition.entering.layer.transitionDuration}`,
    );
  } finally {
    await context.close();
  }
});
