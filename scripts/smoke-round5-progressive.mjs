import assert from "node:assert/strict";

import { chromium } from "@playwright/test";

const baseUrl = process.env.ROUND5_BASE_URL ?? "http://127.0.0.1:5196";
const browser = await chromium.launch({ headless: true });
let activePage = null;
let activeErrors = [];

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  activePage = page;
  const errors = [];
  activeErrors = errors;
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${baseUrl}/?qaProgress=0`, { waitUntil: "domcontentloaded" });
  await page
    .locator('.scroll-journey[data-state="ready"]')
    .waitFor({ timeout: 15_000 });
  const atReady = await page.locator(".scroll-journey__canvas").evaluate((node) => ({
    loadedStages: node.dataset.loadedStages ?? "",
    currentStage: node.dataset.currentStage ?? "",
  }));
  assert.equal(atReady.currentStage, "observe");
  assert.match(atReady.loadedStages, /observe/);
  assert.doesNotMatch(atReady.loadedStages, /prototype|release/);
  await page.waitForFunction(() =>
    document.querySelector(".scroll-journey__canvas")?.dataset.loadedStages?.includes("structure"),
  );
  const resources = await page.evaluate(() =>
    performance
      .getEntriesByType("resource")
      .map((entry) => entry.name)
      .filter((name) => name.endsWith(".glb")),
  );
  assert.equal(new Set(resources).size, 2);
  assert.deepEqual(errors, []);

  const journeyPage = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  activePage = journeyPage;
  const journeyErrors = [];
  activeErrors = journeyErrors;
  journeyPage.on("console", (message) => {
    if (message.type() === "error") journeyErrors.push(message.text());
  });
  journeyPage.on("pageerror", (error) => journeyErrors.push(error.message));
  await journeyPage.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await journeyPage.locator(".scroll-journey").scrollIntoViewIfNeeded();
  await journeyPage
    .locator('.scroll-journey[data-state="ready"]')
    .waitFor({ timeout: 15_000 });

  const setProgress = async (progress) => {
    await journeyPage.evaluate((value) => {
      const section = document.querySelector(".scroll-journey");
      const top = section.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({
        top: top + window.innerHeight * 4.2 * value,
        behavior: "instant",
      });
    }, progress);
    await journeyPage.waitForTimeout(500);
  };

  await setProgress(0.4);
  await journeyPage.waitForFunction(() =>
    document.querySelector(".scroll-journey__canvas")?.dataset.loadedStages?.includes("prototype"),
  );
  const atPrototype = await journeyPage
    .locator(".scroll-journey__canvas")
    .evaluate((node) => node.dataset.loadedStages?.split(",").filter(Boolean) ?? []);
  assert.ok(atPrototype.length <= 2);
  assert.ok(atPrototype.includes("prototype"));

  await setProgress(0.7);
  await journeyPage.waitForFunction(() =>
    document.querySelector(".scroll-journey__canvas")?.dataset.loadedStages?.includes("release"),
  );
  const atRelease = await journeyPage
    .locator(".scroll-journey__canvas")
    .evaluate((node) => node.dataset.loadedStages?.split(",").filter(Boolean) ?? []);
  assert.ok(atRelease.length <= 2);
  assert.ok(atRelease.includes("release"));
  const journeyResources = await journeyPage.evaluate(() =>
    performance
      .getEntriesByType("resource")
      .map((entry) => entry.name)
      .filter((name) => name.endsWith(".glb")),
  );
  assert.equal(new Set(journeyResources).size, 4);
  assert.equal(journeyResources.filter((name) => name.endsWith("/observe.glb")).length, 1);
  assert.deepEqual(journeyErrors, []);

  process.stdout.write(
    `${JSON.stringify(
      { atReady, resources, atPrototype, atRelease, journeyResources, errors },
      null,
      2,
    )}\n`,
  );
} catch (error) {
  const diagnostic = activePage
    ? await activePage.evaluate(() => ({
        journeyState: document.querySelector(".scroll-journey")?.getAttribute("data-state"),
        loadedStages: document.querySelector(".scroll-journey__canvas")?.getAttribute("data-loaded-stages"),
        currentStage: document.querySelector(".scroll-journey__canvas")?.getAttribute("data-current-stage"),
      }))
    : null;
  process.stderr.write(`${JSON.stringify({ diagnostic, errors: activeErrors }, null, 2)}\n`);
  throw error;
} finally {
  await browser.close();
}
