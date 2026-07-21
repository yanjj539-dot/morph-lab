import {
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Object3D,
} from "three";

import type { SceneQualitySettings } from "../core/qualityManager";
import { configureAcrylicObject, isAcrylicMaterial } from "./acrylicMaterial";
import type { Round3TextureSet } from "./loadCompressedTextures";

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
    normalScale: 0.035, aoMapIntensity: 0.1, emissiveIntensity: 0, depthWrite: true, renderOrder: 0,
  },
  coolWhiteCeramic: {
    color: "#e6ecef", roughness: 0.34, metalness: 0, ior: 1.52, transmission: 0,
    normalScale: 0.015, aoMapIntensity: 0, emissiveIntensity: 0, depthWrite: true, renderOrder: 0,
  },
  paper: {
    color: "#eeeae1", roughness: 0.92, metalness: 0, ior: 1.45, transmission: 0,
    normalScale: 0.05, aoMapIntensity: 0.12, emissiveIntensity: 0, depthWrite: true, renderOrder: 0,
  },
  softGreyMetal: {
    color: "#a7adb2", roughness: 0.64, metalness: 0.68, ior: 1.5, transmission: 0,
    normalScale: 0.035, aoMapIntensity: 0, emissiveIntensity: 0, depthWrite: true, renderOrder: 0,
  },
  blackRubber: {
    color: "#17191d", roughness: 0.88, metalness: 0, ior: 1.46, transmission: 0,
    normalScale: 0.055, aoMapIntensity: 0, emissiveIntensity: 0, depthWrite: true, renderOrder: 0,
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
const METAL_PATTERN = /(?:metal|aluminium|aluminum|steel)/i;
const RUBBER_PATTERN = /(?:rubber|tire|tyre)/i;
const SCREEN_GLASS_PATTERN = /screen.?glass/i;
const SCREEN_CONTENT_PATTERN = /(?:screen.?content|runtime.?screen)/i;
const CORAL_PATTERN = /coral.?accent/i;
const SIGNAL_BLUE_PATTERN = /(?:signal.?blue|cobalt.?accent)/i;

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
): void {
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    configureAcrylicObject(object, ROUND4_MATERIAL_PROFILES.frostedAcrylic);

    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      if (!(material instanceof MeshStandardMaterial)) continue;
      material.envMapIntensity = quality.tier === "high" ? 0.68 : 0.52;

      if (isAcrylicMaterial(material)) continue;
      if (SCREEN_CONTENT_PATTERN.test(material.name)) {
        material.depthWrite = ROUND4_SCREEN_CONTENT_POLICY.depthWrite;
        material.emissiveIntensity = ROUND4_SCREEN_CONTENT_POLICY.emissiveIntensity;
        object.renderOrder = ROUND4_SCREEN_CONTENT_POLICY.renderOrder;
      } else if (SCREEN_GLASS_PATTERN.test(material.name)) {
        applyProfile(object, material, ROUND4_MATERIAL_PROFILES.screenGlass);
        material.polygonOffset = false;
        object.castShadow = false;
        object.receiveShadow = false;
      } else if (PRINTED_PAPER_PATTERN.test(material.name)) {
        applyProfile(object, material, ROUND4_MATERIAL_PROFILES.printedPaper);
      } else if (PAPER_PATTERN.test(material.name)) {
        const profile = ROUND4_MATERIAL_PROFILES.paper;
        applyProfile(object, material, profile);
        material.normalMap = textures.paperNormal;
        material.aoMap = textures.studioOrm;
      } else if (METAL_PATTERN.test(material.name)) {
        const profile = ROUND4_MATERIAL_PROFILES.softGreyMetal;
        applyProfile(object, material, profile);
        material.normalMap = textures.metalBrushedNormal;
        material.roughnessMap = null;
      } else if (RUBBER_PATTERN.test(material.name)) {
        const profile = ROUND4_MATERIAL_PROFILES.blackRubber;
        applyProfile(object, material, profile);
        material.normalMap = textures.rubberNormal;
      } else if (CERAMIC_PATTERN.test(material.name)) {
        const profile = ROUND4_MATERIAL_PROFILES.coolWhiteCeramic;
        applyProfile(object, material, profile);
        material.normalMap = textures.plasticNormal;
      } else if (PLASTIC_PATTERN.test(material.name)) {
        const profile = ROUND4_MATERIAL_PROFILES.warmWhitePlastic;
        applyProfile(object, material, profile);
        material.normalMap = textures.plasticNormal;
        material.aoMap = textures.studioOrm;
      } else if (CORAL_PATTERN.test(material.name)) {
        applyProfile(object, material, ROUND4_MATERIAL_PROFILES.coralAccent);
      } else if (SIGNAL_BLUE_PATTERN.test(material.name)) {
        applyProfile(object, material, ROUND4_MATERIAL_PROFILES.signalBlue);
      }

      material.needsUpdate = true;
    }
  });
}

export function applyRound3MaterialSystem(
  root: Object3D,
  textures: Round3TextureSet,
  quality: SceneQualitySettings,
): void {
  applyRound4MaterialSystem(root, textures, quality);
}
