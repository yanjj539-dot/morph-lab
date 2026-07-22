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
  await page.goto(`${baseUrl}/?qaHero=1&qaProgress=0`, { waitUntil: "domcontentloaded" });
  await page.locator('.hero-scene[data-state="ready"]').waitFor({ timeout: 15_000 });
  await page.locator('.scroll-journey[data-state="ready"]').waitFor({ timeout: 15_000 });

  const hero = page.locator(".hero-scene__canvas");
  const journey = page.locator(".scroll-journey__canvas");
  await page.waitForFunction(
    () => document.querySelector(".hero-scene__canvas")?.dataset.schedulerState === "sleeping",
  );
  const heroBefore = await hero.getAttribute("data-scheduler-frames");
  await page.waitForTimeout(800);
  const heroAfter = await hero.getAttribute("data-scheduler-frames");
  assert.equal(heroAfter, heroBefore, "stable Hero must not keep rendering RAF frames");

  await page.locator(".hero-scene").hover({ position: { x: 320, y: 260 } });
  await page.waitForFunction(
    (previous) =>
      Number(document.querySelector(".hero-scene__canvas")?.dataset.schedulerFrames) >
      Number(previous),
    heroBefore,
  );
  await page.waitForFunction(
    () => document.querySelector(".hero-scene__canvas")?.dataset.schedulerState === "sleeping",
  );
  const heroSettled = await hero.getAttribute("data-scheduler-frames");
  await page.waitForTimeout(500);
  assert.equal(await hero.getAttribute("data-scheduler-frames"), heroSettled);

  await page.locator(".scroll-journey").scrollIntoViewIfNeeded();
  await page.waitForFunction(
    () => document.querySelector(".scroll-journey__canvas")?.dataset.schedulerState === "sleeping",
  );
  const journeyBefore = await journey.getAttribute("data-scheduler-frames");
  await page.waitForTimeout(800);
  const journeyAfter = await journey.getAttribute("data-scheduler-frames");
  assert.equal(
    journeyAfter,
    journeyBefore,
    "stable Journey must not keep rendering RAF frames",
  );
  assert.deepEqual(errors, []);

  process.stdout.write(
    `${JSON.stringify(
      { heroBefore, heroAfter, heroSettled, journeyBefore, journeyAfter, errors },
      null,
      2,
    )}\n`,
  );
} catch (error) {
  const diagnostic = activePage
    ? await activePage.evaluate(() => ({
        heroState: document.querySelector(".hero-scene")?.getAttribute("data-state"),
        journeyState: document.querySelector(".scroll-journey")?.getAttribute("data-state"),
        heroScheduler: document.querySelector(".hero-scene__canvas")?.dataset.schedulerState,
        journeyScheduler: document.querySelector(".scroll-journey__canvas")?.dataset.schedulerState,
      }))
    : null;
  process.stderr.write(`${JSON.stringify({ diagnostic, errors: activeErrors }, null, 2)}\n`);
  throw error;
} finally {
  await browser.close();
}
