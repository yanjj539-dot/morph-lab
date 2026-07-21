import {
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Vector2,
} from "three";

import type { SceneQualitySettings } from "../core/qualityManager";
import { configureAcrylicObject, isAcrylicMaterial } from "./acrylicMaterial";
import type { Round3TextureSet } from "./loadCompressedTextures";
import { configureScreenGlass } from "./screenMaterial";

const PAPER_PATTERN = /(?:paper|print|card|label)/i;
const PLASTIC_PATTERN = /(?:plastic|warm.?white)/i;
const CERAMIC_PATTERN = /ceramic/i;
const METAL_PATTERN = /(?:metal|aluminium|aluminum|steel)/i;
const RUBBER_PATTERN = /(?:rubber|tire|tyre)/i;
const SCREEN_GLASS_PATTERN = /screen.?glass/i;

export function applyRound3MaterialSystem(
  root: Object3D,
  textures: Round3TextureSet,
  quality: SceneQualitySettings,
): void {
  const configured = new Set<MeshStandardMaterial>();

  root.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    configureAcrylicObject(object);

    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      if (!(material instanceof MeshStandardMaterial) || configured.has(material)) continue;
      configured.add(material);
      material.envMapIntensity = quality.tier === "high" ? 0.7 : 0.52;

      if (isAcrylicMaterial(material)) continue;
      if (SCREEN_GLASS_PATTERN.test(material.name)) {
        configureScreenGlass(object);
        object.renderOrder = 3;
        material.polygonOffset = true;
        material.polygonOffsetFactor = -2;
        material.polygonOffsetUnits = -2;
        continue;
      }

      if (PAPER_PATTERN.test(material.name)) {
        material.color.set("#eeeae1");
        material.roughness = 0.91;
        material.metalness = 0;
        material.normalMap = textures.paperNormal;
        material.normalScale = new Vector2(0.16, 0.16);
        material.aoMap = textures.studioOrm;
        material.aoMapIntensity = 0.22;
      } else if (METAL_PATTERN.test(material.name)) {
        material.color.set("#a7adb2");
        material.roughness = 0.82;
        material.metalness = 0.78;
        material.normalMap = textures.metalBrushedNormal;
        material.normalScale = new Vector2(0.12, 0.12);
        material.roughnessMap = textures.studioOrm;
      } else if (RUBBER_PATTERN.test(material.name)) {
        material.color.set("#17191d");
        material.roughness = 0.9;
        material.metalness = 0;
        material.normalMap = textures.rubberNormal;
        material.normalScale = new Vector2(0.2, 0.2);
      } else if (CERAMIC_PATTERN.test(material.name)) {
        material.color.set("#e6ecef");
        material.roughness = 0.41;
        material.metalness = 0;
        material.normalMap = textures.plasticNormal;
        material.normalScale = new Vector2(0.05, 0.05);
      } else if (PLASTIC_PATTERN.test(material.name)) {
        material.color.set("#f0ede6");
        material.roughness = 0.63;
        material.metalness = 0;
        material.normalMap = textures.plasticNormal;
        material.normalScale = new Vector2(0.1, 0.1);
        material.aoMap = textures.studioOrm;
        material.aoMapIntensity = 0.18;
      }

      material.needsUpdate = true;
    }
  });
}
