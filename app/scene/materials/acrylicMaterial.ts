import {
  Color,
  Material,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
} from "three";

import type { Round4MaterialProfile } from "./materialFactory";

const ACRYLIC_PATTERN = /(?:frosted.?acrylic|acrylic)/i;

export function isAcrylicMaterial(material: Material): boolean {
  return ACRYLIC_PATTERN.test(material.name);
}

export function configureAcrylicObject(
  mesh: Mesh,
  profile: Round4MaterialProfile,
): void {
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  let configured = false;

  for (const material of materials) {
    if (!isAcrylicMaterial(material)) continue;
    material.transparent = true;
    material.depthWrite = false;
    material.depthTest = true;
    material.alphaTest = 0;

    if (material instanceof MeshStandardMaterial) {
      material.normalScale.setScalar(profile.normalScale);
      material.roughnessMap = null;
      material.aoMapIntensity = profile.aoMapIntensity;
      material.emissiveIntensity = profile.emissiveIntensity;
    }

    if (material instanceof MeshPhysicalMaterial) {
      material.opacity = 1;
      material.color.set(profile.color);
      material.roughness = profile.roughness;
      material.metalness = profile.metalness;
      material.transmission = profile.transmission;
      material.ior = profile.ior;
      material.thickness = profile.thickness ?? 0.018;
      material.attenuationColor = new Color("#c6deea");
      material.attenuationDistance = 1.8;
    } else if (material instanceof MeshStandardMaterial) {
      material.opacity = profile.fallbackOpacity ?? 0.68;
      material.color.set(profile.color);
      material.roughness = profile.roughness;
      material.metalness = profile.metalness;
    }

    material.needsUpdate = true;
    configured = true;
  }

  if (configured) {
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.renderOrder = profile.renderOrder;
  }
}
