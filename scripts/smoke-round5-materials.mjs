import assert from "node:assert/strict";

import { chromium } from "@playwright/test";

const baseUrl = process.env.ROUND5_BASE_URL ?? "http://127.0.0.1:5196";
const browser = await chromium.launch({ headless: true });

try {
  for (const mode of ["enabled", "disabled"]) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(error.message));
    const query = mode === "disabled" ? "&materialNormals=0" : "&materialNormals=1";
    await page.goto(`${baseUrl}/?qaStage=observe${query}`, {
      waitUntil: "domcontentloaded",
    });
    await page.locator('.scroll-journey[data-state="ready"]').waitFor({ timeout: 15_000 });
    const canvas = page.locator(".scroll-journey__canvas");
    await page.waitForFunction(() => {
      const node = document.querySelector(".scroll-journey__canvas");
      return node?.dataset.materialsState === "ready";
    });
    assert.equal(await canvas.getAttribute("data-normal-distance-tier"), "near");
    assert.equal(
      await canvas.getAttribute("data-material-normals"),
      mode === "disabled" ? "false" : "true",
    );
    assert.deepEqual(errors, []);
    await page.close();
  }
  process.stdout.write("Round 5 material override smoke passed.\n");
} finally {
  await browser.close();
}
