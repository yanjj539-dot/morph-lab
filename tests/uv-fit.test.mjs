import assert from "node:assert/strict";
import test from "node:test";

import { fitUv } from "../app/scene/materials/uvFit.ts";

const source = { width: 1600, height: 1000 };

test("cover crops the source without stretching and honors center alignment", () => {
  const result = fitUv({
    source,
    surfaceAspect: 1,
    fit: "cover",
    positionX: 0.5,
    positionY: 0.5,
    scale: 1,
    rotation: 0,
    safeArea: 0,
  });

  assert.deepEqual(result.crop, {
    scale: { x: 0.625, y: 1 },
    offset: { x: 0.1875, y: 0 },
  });
  assert.equal(result.content, null);
});

test("cover alignment moves the crop to the requested edge", () => {
  const result = fitUv({
    source,
    surfaceAspect: 1,
    fit: "cover",
    positionX: 0,
    positionY: 1,
    scale: 1,
    rotation: 0,
    safeArea: 0,
  });

  assert.deepEqual(result.crop?.offset, { x: 0, y: 0 });
});

test("contain returns a smaller centered content rect inside the safe area", () => {
  const result = fitUv({
    source,
    surfaceAspect: 1,
    fit: "contain",
    positionX: 0.5,
    positionY: 0.5,
    scale: 1,
    rotation: 0,
    safeArea: 0.1,
  });

  assert.deepEqual(result.safeRect, { x: 0.1, y: 0.1, width: 0.8, height: 0.8 });
  assert.deepEqual(result.content, {
    scale: { x: 0.8, y: 0.5 },
    offset: { x: 0.1, y: 0.25 },
  });
  assert.equal(result.crop, null);
});

test("contain scale reduces content without changing its aspect ratio", () => {
  const result = fitUv({
    source,
    surfaceAspect: 1,
    fit: "contain",
    positionX: 0.5,
    positionY: 0.5,
    scale: 0.5,
    rotation: 0,
    safeArea: 0,
  });

  assert.deepEqual(result.content, {
    scale: { x: 0.5, y: 0.3125 },
    offset: { x: 0.25, y: 0.34375 },
  });
});

for (const [rotation, radians] of [
  [0, 0],
  [90, Math.PI / 2],
  [180, Math.PI],
  [270, (Math.PI * 3) / 2],
]) {
  test(`rotation ${rotation} exposes radians and swaps the 90-degree fit axis`, () => {
    const result = fitUv({
      source,
      surfaceAspect: 1,
      fit: "cover",
      positionX: 0.5,
      positionY: 0.5,
      scale: 1,
      rotation,
      safeArea: 0,
    });

    assert.equal(result.rotation, radians);
    assert.deepEqual(
      result.crop?.scale,
      rotation === 90 || rotation === 270 ? { x: 1, y: 0.625 } : { x: 0.625, y: 1 },
    );
  });
}
