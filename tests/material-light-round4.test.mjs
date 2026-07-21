import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { registerHooks } from "node:module";
import test from "node:test";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (
      (specifier.startsWith("./") || specifier.startsWith("../")) &&
      !specifier.match(/\.[a-z]+$/i)
    ) {
      return nextResolve(`${specifier}.ts`, context);
    }
    return nextResolve(specifier, context);
  },
});

const {
  ROUND4_MATERIAL_PROFILES,
  ROUND4_RENDER_ORDER_POLICY,
  ROUND4_SCREEN_CONTENT_POLICY,
  applyRound4MaterialSystem,
  resolveRound4MaterialRoute,
} = await import("../app/scene/materials/materialFactory.ts");
const { createStageLightSample, sampleStageLightState, ROUND4_STAGE_LIGHT_STATES } =
  await import("../app/scene/lighting/stageLightStates.ts");
const { createStudioLightRig } = await import(
  "../app/scene/lighting/studioLightRig.ts"
);
const {
  Group,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Texture,
} = await import("three");

const EXPECTED_PROFILES = {
  warmWhitePlastic: ["ede9df", 0.58, 0, 1.46, 0],
  coolWhiteCeramic: ["e6ecef", 0.34, 0, 1.52, 0],
  paper: ["eeeae1", 0.92, 0, 1.45, 0],
  softGreyMetal: ["a7adb2", 0.64, 0.68, 1.5, 0],
  blackRubber: ["17191d", 0.88, 0, 1.46, 0],
  screenGlass: ["d7e2ec", 0.12, 0, 1.46, 0.16],
  frostedAcrylic: ["dbe6ec", 0.3, 0, 1.49, 0.48],
  coralAccent: ["ff6b5f", 0.48, 0, 1.46, 0],
  signalBlue: ["3158d4", 0.42, 0, 1.46, 0],
  printedPaper: ["ffffff", 0.9, 0, 1.45, 0],
};

async function readGlbMaterialNames(stage) {
  const buffer = await readFile(
    new URL(`../public/models/round-4/${stage}.glb`, import.meta.url),
  );
  assert.equal(buffer.toString("ascii", 0, 4), "glTF", `${stage} is not a GLB`);
  const jsonLength = buffer.readUInt32LE(12);
  const document = JSON.parse(
    buffer.subarray(20, 20 + jsonLength).toString("utf8").replace(/\0+$/u, ""),
  );
  return [...new Set((document.materials ?? []).map((material) => material.name))];
}

test("Round 4 material inventory is complete, finite, and visually distinct", () => {
  assert.deepEqual(Object.keys(ROUND4_MATERIAL_PROFILES), Object.keys(EXPECTED_PROFILES));

  for (const [id, expected] of Object.entries(EXPECTED_PROFILES)) {
    const profile = ROUND4_MATERIAL_PROFILES[id];
    assert.deepEqual(
      [profile.color.replace("#", ""), profile.roughness, profile.metalness, profile.ior, profile.transmission],
      expected,
      id,
    );
    for (const value of [profile.roughness, profile.metalness, profile.ior, profile.transmission]) {
      assert.equal(Number.isFinite(value), true, `${id} contains a non-finite scalar`);
    }
  }

  assert.notEqual(
    ROUND4_MATERIAL_PROFILES.warmWhitePlastic.roughness,
    ROUND4_MATERIAL_PROFILES.coolWhiteCeramic.roughness,
  );
  assert.ok(ROUND4_MATERIAL_PROFILES.softGreyMetal.metalness > 0.6);
  assert.ok(ROUND4_MATERIAL_PROFILES.blackRubber.roughness > 0.8);
});

test("every authored Round 4 GLB material resolves to an explicit runtime route", async () => {
  for (const stage of ["observe", "structure", "prototype", "release"]) {
    for (const materialName of await readGlbMaterialNames(stage)) {
      assert.notEqual(
        resolveRound4MaterialRoute(materialName),
        null,
        `${stage}:${materialName} bypasses the Round 4 material system`,
      );
    }
  }

  assert.equal(resolveRound4MaterialRoute("MAT_BlackInk"), "blackRubber");
  assert.equal(resolveRound4MaterialRoute("MAT_Passed"), "signalBlue");
  assert.equal(resolveRound4MaterialRoute("MAT_ShadowGrey"), "softGreyMetal");
});

test("print, content, glass, and acrylic keep the explicit transparency order", () => {
  assert.deepEqual(ROUND4_RENDER_ORDER_POLICY, {
    printedSurface: 1,
    screenContent: 2,
    glass: 3,
    acrylic: 3,
  });
  assert.equal(ROUND4_SCREEN_CONTENT_POLICY.depthWrite, true);
  assert.ok(ROUND4_SCREEN_CONTENT_POLICY.emissiveIntensity > 0);
  assert.ok(ROUND4_SCREEN_CONTENT_POLICY.emissiveIntensity <= 0.18);
  assert.equal(ROUND4_MATERIAL_PROFILES.printedPaper.emissiveIntensity, 0);
  assert.equal(ROUND4_MATERIAL_PROFILES.screenGlass.depthWrite, false);
  assert.equal(ROUND4_MATERIAL_PROFILES.frostedAcrylic.depthWrite, false);
});

test("runtime application removes the metal grid source and applies exact acrylic policy", () => {
  const root = new Group();
  const metal = new Mesh(undefined, new MeshStandardMaterial({ name: "MAT_SoftGreyMetal" }));
  const acrylic = new Mesh(undefined, new MeshPhysicalMaterial({ name: "MAT_FrostedAcrylic" }));
  root.add(metal, acrylic);

  const textures = {
    studioNormal: new Texture(),
    studioOrm: new Texture(),
  };
  applyRound4MaterialSystem(root, textures, { tier: "high" });

  assert.equal(metal.material.roughness, 0.64);
  assert.equal(metal.material.metalness, 0.68);
  assert.equal(metal.material.roughnessMap, null, "shared ORM roughness must not create a runtime grid");
  assert.ok(metal.material.normalScale.x <= 0.08);
  assert.equal(acrylic.material.color.getHexString(), "dbe6ec");
  assert.equal(acrylic.material.transmission, 0.48);
  assert.equal(acrylic.material.ior, 1.49);
  assert.ok(acrylic.material.thickness > 0);
  assert.equal(acrylic.material.depthWrite, false);
  assert.equal(acrylic.renderOrder, 3);
});

test("stage light samples are finite, restrained, and deterministic at stable checkpoints", () => {
  assert.deepEqual(Object.keys(ROUND4_STAGE_LIGHT_STATES), [
    "observe",
    "structure",
    "prototype",
    "release",
  ]);

  for (const progress of [0, 0.25, 0.5, 0.75, 1]) {
    const first = sampleStageLightState(progress, createStageLightSample());
    const second = sampleStageLightState(progress, createStageLightSample());
    assert.deepEqual(first, second, `unstable sample at ${progress}`);
    for (const [key, value] of Object.entries(first)) {
      assert.equal(Number.isFinite(value), true, `${key} is not finite at ${progress}`);
    }
    assert.ok(first.ambient >= 0 && first.ambient <= 0.35);
    assert.ok(first.hemisphere >= 0 && first.hemisphere <= 0.65);
    assert.ok(first.key >= 0 && first.key <= 1.8);
    assert.ok(first.fill >= 0 && first.fill <= 0.6);
    assert.ok(first.rim >= 0 && first.rim <= 0.55);
    assert.ok(first.screenLocal >= 0 && first.screenLocal <= 0.22);
  }
});

test("studio rig uses one restrained fixed-color light set", () => {
  const rig = createStudioLightRig({
    tier: "high",
    shadows: true,
    shadowMapSize: 1024,
    antialias: true,
    maxPixelRatio: 1.5,
    textureAnisotropy: 8,
    transmissionResolutionScale: 1,
  });
  const lightNames = rig.group.children
    .filter((child) => child.isLight)
    .map((light) => light.name);
  assert.deepEqual(lightNames, [
    "STUDIO_ambient",
    "STUDIO_hemisphere",
    "STUDIO_soft_key",
    "STUDIO_area_fill",
    "STUDIO_restrained_rim",
    "STUDIO_screen_local",
  ]);

  const colorsBefore = rig.group.children
    .filter((child) => child.isLight)
    .map((light) => light.color.getHexString());
  rig.update(1);
  const colorsAfter = rig.group.children
    .filter((child) => child.isLight)
    .map((light) => light.color.getHexString());
  assert.deepEqual(colorsAfter, colorsBefore, "stage states may not animate light colors");
});
