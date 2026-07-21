import {
  Color,
  Material,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
} from "three";

const ACRYLIC_PATTERN = /(?:frosted.?acrylic|acrylic)/i;

export function isAcrylicMaterial(material: Material): boolean {
  return ACRYLIC_PATTERN.test(material.name);
}

export function configureAcrylicObject(mesh: Mesh): void {
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  let configured = false;

  for (const material of materials) {
    if (!isAcrylicMaterial(material)) continue;
    material.transparent = true;
    material.depthWrite = false;
    material.depthTest = true;
    material.alphaTest = 0;

    if (material instanceof MeshPhysicalMaterial) {
      material.opacity = 1;
      material.color.set("#dbe9ef");
      material.roughness = 0.32;
      material.metalness = 0;
      material.transmission = Math.max(material.transmission, 0.64);
      material.ior = 1.46;
      material.thickness = Math.max(material.thickness, 0.018);
      material.attenuationColor = new Color("#c6deea");
      material.attenuationDistance = 1.8;
    } else if (material instanceof MeshStandardMaterial) {
      material.opacity = Math.min(material.opacity, 0.62);
      material.color.set("#dbe9ef");
      material.roughness = 0.42;
      material.metalness = 0;
    }

    material.needsUpdate = true;
    configured = true;
  }

  if (configured) {
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.renderOrder = 3;
  }
}
