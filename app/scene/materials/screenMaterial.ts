import {
  Color,
  Material,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Texture,
} from "three";

export type ProjectSurfaceKind = "screen" | "print";

function firstMaterial(source: Mesh["material"]): Material {
  return Array.isArray(source) ? source[0] : source;
}

export function buildProjectSurfaceMaterial(
  source: Mesh["material"],
  texture: Texture,
  kind: ProjectSurfaceKind,
): MeshStandardMaterial {
  const previous = firstMaterial(source);
  const material = new MeshStandardMaterial({
    color: new Color("#ffffff"),
    map: texture,
    roughness: kind === "screen" ? 0.31 : 0.9,
    metalness: 0,
    emissive: new Color("#ffffff"),
    emissiveMap: kind === "screen" ? texture : null,
    emissiveIntensity: kind === "screen" ? 0.16 : 0,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });

  material.name = kind === "screen" ? "MAT_RuntimeScreenContent" : "MAT_RuntimePrint";
  material.opacity = previous.opacity;
  material.transparent = previous.transparent;
  material.side = previous.side;
  material.depthWrite = true;
  return material;
}

export function configureProjectSurface(
  mesh: Mesh,
  texture: Texture,
  kind: ProjectSurfaceKind,
): Mesh["material"] {
  const previous = mesh.material;
  mesh.material = buildProjectSurfaceMaterial(previous, texture, kind);
  mesh.renderOrder = kind === "screen" ? 2 : 1;
  if (kind === "screen") {
    mesh.castShadow = false;
    mesh.receiveShadow = false;
  }
  return previous;
}

export function configureScreenGlass(mesh: Mesh): void {
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  let configured = false;

  for (const material of materials) {
    if (!(material instanceof MeshPhysicalMaterial)) continue;
    material.roughness = 0.14;
    material.metalness = 0;
    material.transmission = Math.max(material.transmission, 0.12);
    material.ior = 1.46;
    material.thickness = Math.max(material.thickness, 0.006);
    material.transparent = true;
    material.depthWrite = false;
    material.depthTest = true;
    configured = true;
  }

  if (configured) {
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.renderOrder = 2;
  }
}
