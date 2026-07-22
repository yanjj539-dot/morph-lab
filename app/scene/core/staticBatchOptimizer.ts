import {
  AnimationClip,
  Matrix4,
  Mesh,
  MeshPhysicalMaterial,
  PropertyBinding,
  SkinnedMesh,
  type BufferGeometry,
  type Group,
  type Material,
} from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

import { ROUND4_CAMERA_VISIBILITY_MANIFEST } from "../debug/cameraVisibilityManifest.ts";
import { resolveRound4MaterialRoute } from "../materials/materialFactory.ts";

export type StaticBatchReport = {
  sourceMeshes: number;
  batchedMeshes: number;
  drawCallsSaved: number;
  groups: readonly {
    material: string;
    sources: readonly string[];
  }[];
};

export type StaticBatchOptions = {
  preserveNames?: ReadonlySet<string>;
  minimumGroupSize?: number;
};

const DEFAULT_PRESERVE_NAMES = new Set(
  ROUND4_CAMERA_VISIBILITY_MANIFEST.flatMap((stage) => [
    ...stage.focusMeshNames,
    ...stage.allowedForegroundMeshNames,
  ]),
);

const AUTHORED_SURFACE_PATTERN =
  /(?:^SCREEN_|^PRINT_|project_image|__content$|__glass$|runtime.?screen|runtime.?print)/i;

function animatedNodeNames(clips: readonly AnimationClip[]): Set<string> {
  const names = new Set<string>();
  for (const clip of clips) {
    for (const track of clip.tracks) {
      try {
        const parsed = PropertyBinding.parseTrackName(track.name);
        if (parsed.nodeName) names.add(parsed.nodeName);
      } catch {
        const nodeName = track.name.split(".")[0];
        if (nodeName) names.add(nodeName);
      }
    }
  }
  return names;
}

function hasAnimatedAncestor(mesh: Mesh, animatedNames: ReadonlySet<string>): boolean {
  let current: Mesh["parent"] = mesh;
  while (current) {
    if (animatedNames.has(current.name) || animatedNames.has(current.uuid)) return true;
    current = current.parent;
  }
  return false;
}

function geometrySignature(geometry: BufferGeometry): string {
  const attributes = Object.entries(geometry.attributes)
    .map(([name, attribute]) => `${name}:${attribute.itemSize}:${attribute.normalized}`)
    .sort()
    .join("|");
  return `${geometry.index ? "indexed" : "flat"}:${attributes}`;
}

function materialSignature(mesh: Mesh, material: Material): string {
  const runtimeMaterialKey = resolveRound4MaterialRoute(material.name) ?? material.name;
  return [
    material.type,
    runtimeMaterialKey,
    material.transparent,
    material.opacity,
    material.depthWrite,
    material.depthTest,
    material.side,
    mesh.castShadow,
    mesh.receiveShadow,
    mesh.renderOrder,
    geometrySignature(mesh.geometry),
  ].join(":");
}

function isBatchCandidate(
  mesh: Mesh,
  material: Material,
  animatedNames: ReadonlySet<string>,
  preserveNames: ReadonlySet<string>,
): boolean {
  if (mesh instanceof SkinnedMesh || mesh.children.length > 0) return false;
  if (mesh.morphTargetInfluences || Object.keys(mesh.geometry.morphAttributes).length > 0) return false;
  if (preserveNames.has(mesh.name) || AUTHORED_SURFACE_PATTERN.test(mesh.name)) return false;
  if (hasAnimatedAncestor(mesh, animatedNames)) return false;
  if (material.transparent || material.opacity < 0.999) return false;
  if (material instanceof MeshPhysicalMaterial && material.transmission > 0) return false;
  return true;
}

export function optimizeStaticStageMeshes(
  root: Group,
  clips: readonly AnimationClip[],
  options: StaticBatchOptions = {},
): StaticBatchReport {
  const preserveNames = new Set([
    ...DEFAULT_PRESERVE_NAMES,
    ...(options.preserveNames ?? []),
  ]);
  const animatedNames = animatedNodeNames(clips);
  const minimumGroupSize = Math.max(2, options.minimumGroupSize ?? 2);
  const groups = new Map<string, Mesh[]>();
  const materialReferences = new Map<Material, number>();

  root.updateMatrixWorld(true);
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      materialReferences.set(material, (materialReferences.get(material) ?? 0) + 1);
    }
    if (Array.isArray(object.material)) return;
    if (!isBatchCandidate(object, object.material, animatedNames, preserveNames)) return;
    const signature = materialSignature(object, object.material);
    const entries = groups.get(signature) ?? [];
    entries.push(object);
    groups.set(signature, entries);
  });

  const rootInverse = new Matrix4().copy(root.matrixWorld).invert();
  const reports = [];
  let sourceMeshes = 0;
  let batchedMeshes = 0;

  for (const meshes of groups.values()) {
    if (meshes.length < minimumGroupSize) continue;
    const transformed = meshes.map((mesh) => {
      const geometry = mesh.geometry.clone();
      geometry.applyMatrix4(new Matrix4().multiplyMatrices(rootInverse, mesh.matrixWorld));
      return geometry;
    });
    const geometry = mergeGeometries(transformed, false);
    for (const entry of transformed) entry.dispose();
    if (!geometry) continue;

    const first = meshes[0];
    const material = first.material as Material;
    const batch = new Mesh(geometry, material);
    batch.name = `ROUND5_BATCH_${String(batchedMeshes + 1).padStart(2, "0")}`;
    batch.castShadow = first.castShadow;
    batch.receiveShadow = first.receiveShadow;
    batch.renderOrder = first.renderOrder;
    batch.matrixAutoUpdate = false;
    batch.updateMatrix();
    batch.userData.round5BatchSources = meshes.map((mesh) => mesh.name);
    root.add(batch);

    for (const mesh of meshes) {
      mesh.removeFromParent();
      const sourceMaterial = mesh.material as Material;
      if (
        sourceMaterial !== material &&
        (materialReferences.get(sourceMaterial) ?? 0) <= 1
      ) {
        sourceMaterial.dispose();
      }
    }
    sourceMeshes += meshes.length;
    batchedMeshes += 1;
    reports.push({
      material: material.name || material.type,
      sources: meshes.map((mesh) => mesh.name),
    });
  }

  return {
    sourceMeshes,
    batchedMeshes,
    drawCallsSaved: sourceMeshes - batchedMeshes,
    groups: reports,
  };
}
