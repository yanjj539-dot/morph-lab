import {
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Object3D,
} from "three";

import type { SceneQualitySettings } from "../core/qualityManager";
import { configureAcrylicObject, isAcrylicMaterial } from "./acrylicMaterial";
import type { Round3TextureSet } from "./loadCompressedTextures";
import {
  isMicroNormalEligible,
  normalPolicyFor,
  type NormalDistanceTier,
} from "./normalMapPolicy.ts";

export type Round4MaterialProfile = Readonly<{
  color: `#${string}`;
  roughness: number;
  metalness: number;
  ior: number;
  transmission: number;
  normalScale: number;
  aoMapIntensity: number;
  emissiveIntensity: number;
  depthWrite: boolean;
  renderOrder: number;
  thickness?: number;
  fallbackOpacity?: number;
}>;

export type Round4MaterialRuntimeOptions = Readonly<{
  normalMapsEnabled?: boolean;
  normalDistanceTier?: NormalDistanceTier;
}>;

export const ROUND4_RENDER_ORDER_POLICY = Object.freeze({
  printedSurface: 1,
  screenContent: 2,
  glass: 3,
  acrylic: 3,
});

export const ROUND4_SCREEN_CONTENT_POLICY = Object.freeze({
  depthWrite: true,
  emissiveIntensity: 0.16,
  renderOrder: ROUND4_RENDER_ORDER_POLICY.screenContent,
});

export const ROUND4_MATERIAL_PROFILES = Object.freeze({
  warmWhitePlastic: {
    color: "#ede9df", roughness: 0.58, metalness: 0, ior: 1.46, transmission: 0,
    normalScale: 0.01, aoMapIntensity: 0.1, emissiveIntensity: 0, depthWrite: true, renderOrder: 0,
  },
  coolWhiteCeramic: {
    color: "#e6ecef", roughness: 0.34, metalness: 0, ior: 1.52, transmission: 0,
    normalScale: 0.006, aoMapIntensity: 0, emissiveIntensity: 0, depthWrite: true, renderOrder: 0,
  },
  paper: {
    color: "#eeeae1", roughness: 0.92, metalness: 0, ior: 1.45, transmission: 0,
    normalScale: 0.012, aoMapIntensity: 0.12, emissiveIntensity: 0, depthWrite: true, renderOrder: 0,
  },
  softGreyMetal: {
    color: "#a7adb2", roughness: 0.64, metalness: 0.68, ior: 1.5, transmission: 0,
    normalScale: 0.014, aoMapIntensity: 0, emissiveIntensity: 0, depthWrite: true, renderOrder: 0,
  },
  blackRubber: {
    color: "#17191d", roughness: 0.88, metalness: 0, ior: 1.46, transmission: 0,
    normalScale: 0.018, aoMapIntensity: 0, emissiveIntensity: 0, depthWrite: true, renderOrder: 0,
  },
  screenGlass: {
    color: "#d7e2ec", roughness: 0.12, metalness: 0, ior: 1.46, transmission: 0.16,
    normalScale: 0, aoMapIntensity: 0, emissiveIntensity: 0, depthWrite: false,
    renderOrder: ROUND4_RENDER_ORDER_POLICY.glass, thickness: 0.006, fallbackOpacity: 0.88,
  },
  frostedAcrylic: {
    color: "#dbe6ec", roughness: 0.3, metalness: 0, ior: 1.49, transmission: 0.48,
    normalScale: 0, aoMapIntensity: 0, emissiveIntensity: 0, depthWrite: false,
    renderOrder: ROUND4_RENDER_ORDER_POLICY.acrylic, thickness: 0.018, fallbackOpacity: 0.68,
  },
  coralAccent: {
    color: "#ff6b5f", roughness: 0.48, metalness: 0, ior: 1.46, transmission: 0,
    normalScale: 0, aoMapIntensity: 0, emissiveIntensity: 0, depthWrite: true, renderOrder: 0,
  },
  signalBlue: {
    color: "#3158d4", roughness: 0.42, metalness: 0, ior: 1.46, transmission: 0,
    normalScale: 0, aoMapIntensity: 0, emissiveIntensity: 0, depthWrite: true, renderOrder: 0,
  },
  printedPaper: {
    color: "#ffffff", roughness: 0.9, metalness: 0, ior: 1.45, transmission: 0,
    normalScale: 0, aoMapIntensity: 0, emissiveIntensity: 0, depthWrite: true,
    renderOrder: ROUND4_RENDER_ORDER_POLICY.printedSurface,
  },
}) satisfies Readonly<Record<string, Round4MaterialProfile>>;

const PRINTED_PAPER_PATTERN = /(?:runtime.?print|printed.?paper)/i;
const PAPER_PATTERN = /(?:paper|print|card|label)/i;
const PLASTIC_PATTERN = /(?:plastic|warm.?white)/i;
const CERAMIC_PATTERN = /ceramic/i;
const METAL_PATTERN = /(?:metal|aluminium|aluminum|steel|shadow.?grey)/i;
const RUBBER_PATTERN = /(?:rubber|tire|tyre|black.?ink)/i;
const SCREEN_GLASS_PATTERN = /screen.?glass/i;
const SCREEN_CONTENT_PATTERN = /(?:screen.?content|runtime.?screen)/i;
const CORAL_PATTERN = /coral.?accent/i;
const SIGNAL_BLUE_PATTERN = /(?:signal.?blue|cobalt.?accent|passed)/i;

export type Round4MaterialRoute =
  | keyof typeof ROUND4_MATERIAL_PROFILES
  | "screenContent";

export function resolveRound4MaterialRoute(
  materialName: string,
): Round4MaterialRoute | null {
  if (SCREEN_CONTENT_PATTERN.test(materialName)) return "screenContent";
  if (SCREEN_GLASS_PATTERN.test(materialName)) return "screenGlass";
  if (PRINTED_PAPER_PATTERN.test(materialName)) return "printedPaper";
  if (/(?:frosted.?acrylic|acrylic)/i.test(materialName)) return "frostedAcrylic";
  if (PAPER_PATTERN.test(materialName)) return "paper";
  if (METAL_PATTERN.test(materialName)) return "softGreyMetal";
  if (RUBBER_PATTERN.test(materialName)) return "blackRubber";
  if (CERAMIC_PATTERN.test(materialName)) return "coolWhiteCeramic";
  if (PLASTIC_PATTERN.test(materialName)) return "warmWhitePlastic";
  if (CORAL_PATTERN.test(materialName)) return "coralAccent";
  if (SIGNAL_BLUE_PATTERN.test(materialName)) return "signalBlue";
  return null;
}

function applyProfile(
  mesh: Mesh,
  material: MeshStandardMaterial,
  profile: Round4MaterialProfile,
): void {
  material.color.set(profile.color);
  material.roughness = profile.roughness;
  material.metalness = profile.metalness;
  material.emissiveIntensity = profile.emissiveIntensity;
  material.depthWrite = profile.depthWrite;
  material.normalScale.setScalar(profile.normalScale);
  material.aoMapIntensity = profile.aoMapIntensity;
  material.roughnessMap = null;
  mesh.renderOrder = profile.renderOrder;

  if (material instanceof MeshPhysicalMaterial) {
    material.transmission = profile.transmission;
    material.ior = profile.ior;
    material.thickness = profile.thickness ?? 0;
    material.opacity = 1;
  } else if (profile.transmission > 0) {
    material.opacity = profile.fallbackOpacity ?? 1;
  }
  material.transparent = profile.transmission > 0;
}

export function applyRound4MaterialSystem(
  root: Object3D,
  textures: Round3TextureSet,
  quality: SceneQualitySettings,
  options: Round4MaterialRuntimeOptions = {},
): void {
  const normalMapsEnabled = options.normalMapsEnabled ?? true;
  const normalDistanceTier = options.normalDistanceTier ?? "near";

  root.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    configureAcrylicObject(object, ROUND4_MATERIAL_PROFILES.frostedAcrylic);

    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      if (!(material instanceof MeshStandardMaterial)) continue;
      material.envMapIntensity = quality.tier === "high" ? 0.68 : 0.52;
      const route = resolveRound4MaterialRoute(material.name);
      object.geometry.computeBoundingSphere();
      const microNormalEligible = isMicroNormalEligible(
        object.name,
        object.geometry.boundingSphere?.radius ?? Number.POSITIVE_INFINITY,
      );
      const normalPolicy = normalPolicyFor(
        route ?? "",
        normalDistanceTier,
        normalMapsEnabled && microNormalEligible,
      );

      if (isAcrylicMaterial(material) || route === "frostedAcrylic") continue;
      if (route === "screenContent") {
        material.depthWrite = ROUND4_SCREEN_CONTENT_POLICY.depthWrite;
        material.emissiveIntensity = ROUND4_SCREEN_CONTENT_POLICY.emissiveIntensity;
        object.renderOrder = ROUND4_SCREEN_CONTENT_POLICY.renderOrder;
      } else if (route === "screenGlass") {
        applyProfile(object, material, ROUND4_MATERIAL_PROFILES.screenGlass);
        material.polygonOffset = false;
        object.castShadow = false;
        object.receiveShadow = false;
      } else if (route === "printedPaper") {
        applyProfile(object, material, ROUND4_MATERIAL_PROFILES.printedPaper);
      } else if (route === "paper") {
        const profile = ROUND4_MATERIAL_PROFILES.paper;
        applyProfile(object, material, profile);
        material.normalMap = normalPolicy.enabled ? textures.paperNormal : null;
        material.aoMap = textures.studioOrm;
      } else if (route === "softGreyMetal") {
        const profile = ROUND4_MATERIAL_PROFILES.softGreyMetal;
        applyProfile(object, material, profile);
        material.normalMap = normalPolicy.enabled ? textures.metalBrushedNormal : null;
        material.roughnessMap = null;
      } else if (route === "blackRubber") {
        const profile = ROUND4_MATERIAL_PROFILES.blackRubber;
        applyProfile(object, material, profile);
        material.normalMap = normalPolicy.enabled ? textures.rubberNormal : null;
      } else if (route === "coolWhiteCeramic") {
        const profile = ROUND4_MATERIAL_PROFILES.coolWhiteCeramic;
        applyProfile(object, material, profile);
        material.normalMap = normalPolicy.enabled ? textures.plasticNormal : null;
      } else if (route === "warmWhitePlastic") {
        const profile = ROUND4_MATERIAL_PROFILES.warmWhitePlastic;
        applyProfile(object, material, profile);
        material.normalMap = normalPolicy.enabled ? textures.plasticNormal : null;
        material.aoMap = textures.studioOrm;
      } else if (route === "coralAccent") {
        applyProfile(object, material, ROUND4_MATERIAL_PROFILES.coralAccent);
      } else if (route === "signalBlue") {
        applyProfile(object, material, ROUND4_MATERIAL_PROFILES.signalBlue);
      }

      material.normalScale.setScalar(normalPolicy.scale);
      material.userData.round5NormalRoute = route;
      material.userData.round5NormalsEnabled =
        normalMapsEnabled && microNormalEligible;
      material.needsUpdate = true;
    }
  });
}

export function applyRound5NormalDistanceTier(
  root: Object3D,
  distanceTier: NormalDistanceTier,
): void {
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    const materials = Array.isArray(object.material)
      ? object.material
      : [object.material];
    for (const material of materials) {
      if (!(material instanceof MeshStandardMaterial)) continue;
      const route = material.userData.round5NormalRoute;
      if (typeof route !== "string") continue;
      const enabled = material.userData.round5NormalsEnabled !== false;
      material.normalScale.setScalar(
        normalPolicyFor(route, distanceTier, enabled).scale,
      );
    }
  });
}

export function applyRound3MaterialSystem(
  root: Object3D,
  textures: Round3TextureSet,
  quality: SceneQualitySettings,
  options: Round4MaterialRuntimeOptions = {},
): void {
  applyRound4MaterialSystem(root, textures, quality, options);
}
