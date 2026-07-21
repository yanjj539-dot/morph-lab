import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("round 2 exports modular journey data and asset build commands", async () => {
  const journey = await readFile(new URL("../app/data/journey.ts", import.meta.url), "utf8");
  assert.match(journey, /export const JOURNEY_STAGES/);
  const packageJson = await readFile(new URL("../package.json", import.meta.url), "utf8");
  assert.match(packageJson, /"assets:round2"/);
});
