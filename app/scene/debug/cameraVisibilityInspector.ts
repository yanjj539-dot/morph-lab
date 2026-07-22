import {
  BackSide,
  Box3,
  DoubleSide,
  FrontSide,
  Matrix3,
  Mesh,
  Object3D,
  PerspectiveCamera,
  Raycaster,
  Vector2,
  Vector3,
  type Intersection,
  type Material,
} from "three";

import {
  ROUND4_CAMERA_VISIBILITY_MANIFEST,
  getCameraVisibilityStage,
  type CameraVisibilityStageManifest,
} from "./cameraVisibilityManifest";

export const CAMERA_VISIBILITY_FOCUS_RAY_IDS = [
  "center",
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right",
] as const;

export type CameraVisibilityFocusRayId =
  (typeof CAMERA_VISIBILITY_FOCUS_RAY_IDS)[number];

export type CameraVisibilityRaySample = {
  id: CameraVisibilityFocusRayId;
  ndc: readonly [x: number, y: number];
  focusHit: boolean;
  focusDistance: number | null;
  hitMeshNames: readonly string[];
  allowedForegroundMeshNames: readonly string[];
  unexpectedOccluderMeshNames: readonly string[];
  nearPlaneViolationMeshNames: readonly string[];
  visibleBackfaceMeshNames: readonly string[];
};

export type CameraVisibilitySample<StageId extends string = string> = {
  schemaVersion: 1;
  progress: number;
  stageId: StageId;
  cameraPosition: readonly [x: number, y: number, z: number];
  cameraNear: number;
  renderableMeshCount: number;
  focusMeshNames: readonly string[];
  missingFocusMeshNames: readonly string[];
  configuredAllowedForegroundMeshNames: readonly string[];
  focusHitRayCount: number;
  rays: readonly CameraVisibilityRaySample[];
  allowedForegroundHitMeshNames: readonly string[];
  unexpectedOccluderMeshNames: readonly string[];
  nearPlaneViolationMeshNames: readonly string[];
  cameraInsideMeshNames: readonly string[];
  visibleBackfaceMeshNames: readonly string[];
  focusVisible: boolean;
  externalOcclusionSafe: boolean;
  nearPlaneSafe: boolean;
  visibleBackfaceSafe: boolean;
  internalExposureSafe: boolean;
  safe: boolean;
};

export type CameraVisibilityInspector<StageId extends string = string> = {
  refresh(scene: Object3D): void;
  inspect(
    scene: Object3D,
    camera: PerspectiveCamera,
    progress: number,
  ): CameraVisibilitySample<StageId>;
};

const EPSILON = 1e-5;
const MIN_EFFECTIVE_OPACITY = 0.15;
const BACKFACE_DOT_THRESHOLD = 0.1;
const NEAR_PLANE_MARGIN = 0.02;
const FOCUS_CORNER_INSET = 0.2;
const INSIDE_DIRECTIONS = [
  new Vector3(1, 0.173, 0.317).normalize(),
  new Vector3(-1, 0.239, -0.411).normalize(),
  new Vector3(0.271, 1, 0.139).normalize(),
  new Vector3(-0.193, -1, 0.347).normalize(),
  new Vector3(0.217, -0.283, 1).normalize(),
  new Vector3(-0.331, 0.127, -1).normalize(),
  new Vector3(0.577, 0.613, -0.541).normalize(),
] as const;

function materialList(mesh: Mesh): Material[] {
  return Array.isArray(mesh.material) ? mesh.material : [mesh.material];
}

function isHierarchyVisible(object: Object3D): boolean {
  let current: Object3D | null = object;
  while (current) {
    if (!current.visible) return false;
    current = current.parent;
  }
  return true;
}

function isRenderable(mesh: Mesh): boolean {
  if (!isHierarchyVisible(mesh)) return false;
  return materialList(mesh).some(
    (material) => material.visible && material.opacity >= MIN_EFFECTIVE_OPACITY,
  );
}

function hasSurfaceRole(object: Object3D): boolean {
  let current: Object3D | null = object;
  while (current) {
    if (current.userData.surfaceRole) return true;
    current = current.parent;
  }
  return false;
}

function configuredAncestorName(
  object: Object3D,
  configuredNames: ReadonlySet<string>,
): string | null {
  let current: Object3D | null = object;
  while (current) {
    if (configuredNames.has(current.name)) return current.name;
    const surfaceTarget = current.userData.surfaceTarget;
    if (typeof surfaceTarget === "string" && configuredNames.has(surfaceTarget)) {
      return surfaceTarget;
    }
    current = current.parent;
  }
  return null;
}

function meshName(mesh: Mesh): string {
  return mesh.name || mesh.uuid;
}

function uniqueSorted(values: Iterable<string>): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function collectMeshes(scene: Object3D): Mesh[] {
  const meshes: Mesh[] = [];
  scene.traverse((object) => {
    if (object instanceof Mesh) meshes.push(object);
  });
  return meshes;
}

function projectFocusBounds(
  meshes: readonly Mesh[],
  camera: PerspectiveCamera,
): readonly Vector2[] {
  const bounds = new Box3();
  for (const mesh of meshes) bounds.expandByObject(mesh, true);

  if (bounds.isEmpty()) {
    return CAMERA_VISIBILITY_FOCUS_RAY_IDS.map(() => new Vector2(0, 0));
  }

  const min = bounds.min;
  const max = bounds.max;
  const corners = [
    new Vector3(min.x, min.y, min.z),
    new Vector3(min.x, min.y, max.z),
    new Vector3(min.x, max.y, min.z),
    new Vector3(min.x, max.y, max.z),
    new Vector3(max.x, min.y, min.z),
    new Vector3(max.x, min.y, max.z),
    new Vector3(max.x, max.y, min.z),
    new Vector3(max.x, max.y, max.z),
  ];

  let minX = 1;
  let maxX = -1;
  let minY = 1;
  let maxY = -1;
  for (const corner of corners) {
    corner.project(camera);
    if (!Number.isFinite(corner.x) || !Number.isFinite(corner.y)) continue;
    minX = Math.min(minX, Math.max(-1, corner.x));
    maxX = Math.max(maxX, Math.min(1, corner.x));
    minY = Math.min(minY, Math.max(-1, corner.y));
    maxY = Math.max(maxY, Math.min(1, corner.y));
  }

  if (minX > maxX || minY > maxY) {
    return CAMERA_VISIBILITY_FOCUS_RAY_IDS.map(() => new Vector2(0, 0));
  }

  const centerX = (minX + maxX) * 0.5;
  const centerY = (minY + maxY) * 0.5;
  const left = minX + (maxX - minX) * FOCUS_CORNER_INSET;
  const right = maxX - (maxX - minX) * FOCUS_CORNER_INSET;
  const bottom = minY + (maxY - minY) * FOCUS_CORNER_INSET;
  const top = maxY - (maxY - minY) * FOCUS_CORNER_INSET;

  return [
    new Vector2(centerX, centerY),
    new Vector2(left, top),
    new Vector2(right, top),
    new Vector2(left, bottom),
    new Vector2(right, bottom),
  ];
}

function materialForIntersection(intersection: Intersection): Material | null {
  const object = intersection.object;
  if (!(object instanceof Mesh)) return null;
  if (!Array.isArray(object.material)) return object.material;
  const materialIndex = intersection.face?.materialIndex ?? 0;
  return object.material[materialIndex] ?? null;
}

function isVisibleBackface(
  intersection: Intersection,
  rayDirection: Vector3,
  normalMatrix: Matrix3,
  worldNormal: Vector3,
): boolean {
  if (!intersection.face) return false;
  const material = materialForIntersection(intersection);
  if (!material || material.side === FrontSide) return false;
  if (material.side === BackSide) return true;

  normalMatrix.getNormalMatrix(intersection.object.matrixWorld);
  worldNormal.copy(intersection.face.normal).applyNormalMatrix(normalMatrix);
  return worldNormal.dot(rayDirection) > BACKFACE_DOT_THRESHOLD;
}

function coveredMeshNames(
  rays: readonly CameraVisibilityRaySample[],
  field:
    | "allowedForegroundMeshNames"
    | "unexpectedOccluderMeshNames"
    | "nearPlaneViolationMeshNames"
    | "visibleBackfaceMeshNames",
): string[] {
  const counts = new Map<string, number>();
  for (const ray of rays) {
    for (const name of ray[field]) counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  const centerNames = new Set(rays[0]?.[field] ?? []);
  return uniqueSorted(
    [...counts.entries()]
      .filter(([name, count]) => centerNames.has(name) || count >= 2)
      .map(([name]) => name),
  );
}

function uniqueIntersectionDistances(intersections: readonly Intersection[]): number[] {
  const distances = intersections
    .map((intersection) => intersection.distance)
    .filter((distance) => Number.isFinite(distance) && distance > EPSILON)
    .sort((left, right) => left - right);
  const unique: number[] = [];
  for (const distance of distances) {
    const previous = unique.at(-1);
    if (previous === undefined || Math.abs(distance - previous) > EPSILON) {
      unique.push(distance);
    }
  }
  return unique;
}

function withDoubleSidedMaterials<T>(mesh: Mesh, inspect: () => T): T {
  const materials = materialList(mesh);
  const originalSides = materials.map((material) => material.side);
  for (const material of materials) material.side = DoubleSide;
  try {
    return inspect();
  } finally {
    materials.forEach((material, index) => {
      material.side = originalSides[index];
    });
  }
}

function cameraIsInsideMesh(
  mesh: Mesh,
  cameraPosition: Vector3,
  raycaster: Raycaster,
): boolean {
  if (hasSurfaceRole(mesh)) return false;
  const bounds = new Box3().setFromObject(mesh, true);
  if (bounds.isEmpty() || !bounds.containsPoint(cameraPosition)) return false;

  const oddDirections = withDoubleSidedMaterials(mesh, () => {
    let oddCount = 0;
    for (const direction of INSIDE_DIRECTIONS) {
      raycaster.set(cameraPosition, direction);
      const intersections = raycaster.intersectObject(mesh, false);
      if (uniqueIntersectionDistances(intersections).length % 2 === 1) oddCount += 1;
    }
    return oddCount;
  });

  return oddDirections >= Math.ceil(INSIDE_DIRECTIONS.length * 0.6);
}

export function createCameraVisibilityInspector<StageId extends string = string>(
  manifest: readonly CameraVisibilityStageManifest<StageId>[] =
    ROUND4_CAMERA_VISIBILITY_MANIFEST as unknown as readonly CameraVisibilityStageManifest<StageId>[],
): CameraVisibilityInspector<StageId> {
  let cachedScene: Object3D | null = null;
  let cachedMeshes: Mesh[] = [];

  function refresh(scene: Object3D): void {
    cachedScene = scene;
    cachedMeshes = collectMeshes(scene);
  }

  function inspect(
    scene: Object3D,
    camera: PerspectiveCamera,
    progress: number,
  ): CameraVisibilitySample<StageId> {
    if (scene !== cachedScene) refresh(scene);
    scene.updateMatrixWorld(true);
    camera.updateMatrixWorld(true);

    const stage = getCameraVisibilityStage(manifest, progress);
    const focusNames = new Set(stage.focusMeshNames);
    const allowedNames = new Set(stage.allowedForegroundMeshNames);
    const ignoredNames = new Set(stage.ignoredMeshNames ?? []);
    const renderableMeshes = cachedMeshes.filter(isRenderable);
    const focusMeshes = renderableMeshes.filter(
      (mesh) => configuredAncestorName(mesh, focusNames) !== null,
    );
    const presentFocusNames = new Set(
      focusMeshes
        .map((mesh) => configuredAncestorName(mesh, focusNames))
        .filter((name): name is string => name !== null),
    );
    const missingFocusMeshNames = stage.focusMeshNames.filter(
      (name) => !presentFocusNames.has(name),
    );
    const ndcSamples = projectFocusBounds(focusMeshes, camera);
    const raycaster = new Raycaster();
    raycaster.layers.mask = camera.layers.mask;
    raycaster.near = 0;
    raycaster.far = camera.far;
    const normalMatrix = new Matrix3();
    const worldNormal = new Vector3();

    const rays: CameraVisibilityRaySample[] = ndcSamples.map((ndc, index) => {
      raycaster.setFromCamera(ndc, camera);
      const intersections = raycaster.intersectObjects(renderableMeshes, false);
      const focusIntersection = intersections.find(
        (intersection) =>
          configuredAncestorName(intersection.object, focusNames) !== null,
      );
      const focusDistance = focusIntersection?.distance ?? null;
      const visibleLimit = focusDistance ?? Number.POSITIVE_INFINITY;
      const hitMeshNames: string[] = [];
      const allowedForegroundMeshNames: string[] = [];
      const unexpectedOccluderMeshNames: string[] = [];
      const nearPlaneViolationMeshNames: string[] = [];
      const visibleBackfaceMeshNames: string[] = [];

      for (const intersection of intersections) {
        if (intersection.distance > visibleLimit + EPSILON) break;
        if (!(intersection.object instanceof Mesh)) continue;
        const hitName = meshName(intersection.object);
        hitMeshNames.push(hitName);

        if (intersection.distance <= camera.near + NEAR_PLANE_MARGIN) {
          nearPlaneViolationMeshNames.push(hitName);
        }
        if (
          isVisibleBackface(
            intersection,
            raycaster.ray.direction,
            normalMatrix,
            worldNormal,
          )
        ) {
          visibleBackfaceMeshNames.push(hitName);
        }

        if (focusDistance === null || intersection.distance >= focusDistance - EPSILON) {
          continue;
        }
        if (configuredAncestorName(intersection.object, focusNames)) continue;
        if (configuredAncestorName(intersection.object, ignoredNames)) continue;
        const allowedName = configuredAncestorName(intersection.object, allowedNames);
        if (allowedName) allowedForegroundMeshNames.push(allowedName);
        else unexpectedOccluderMeshNames.push(hitName);
      }

      return {
        id: CAMERA_VISIBILITY_FOCUS_RAY_IDS[index],
        ndc: [ndc.x, ndc.y],
        focusHit: focusIntersection !== undefined,
        focusDistance,
        hitMeshNames: uniqueSorted(hitMeshNames),
        allowedForegroundMeshNames: uniqueSorted(allowedForegroundMeshNames),
        unexpectedOccluderMeshNames: uniqueSorted(unexpectedOccluderMeshNames),
        nearPlaneViolationMeshNames: uniqueSorted(nearPlaneViolationMeshNames),
        visibleBackfaceMeshNames: uniqueSorted(visibleBackfaceMeshNames),
      };
    });

    const cameraPosition = camera.getWorldPosition(new Vector3());
    const insideRaycaster = new Raycaster();
    insideRaycaster.layers.mask = camera.layers.mask;
    insideRaycaster.near = EPSILON;
    insideRaycaster.far = camera.far;
    const cameraInsideMeshNames = uniqueSorted(
      renderableMeshes
        .filter(
          (mesh) =>
            configuredAncestorName(mesh, ignoredNames) === null &&
            cameraIsInsideMesh(mesh, cameraPosition, insideRaycaster),
        )
        .map(meshName),
    );
    const allowedForegroundHitMeshNames = coveredMeshNames(
      rays,
      "allowedForegroundMeshNames",
    );
    const unexpectedOccluderMeshNames = coveredMeshNames(
      rays,
      "unexpectedOccluderMeshNames",
    );
    const nearPlaneViolationMeshNames = coveredMeshNames(
      rays,
      "nearPlaneViolationMeshNames",
    );
    const visibleBackfaceMeshNames = coveredMeshNames(
      rays,
      "visibleBackfaceMeshNames",
    );
    const focusHitRayCount = rays.filter((ray) => ray.focusHit).length;
    const focusVisible = focusHitRayCount >= 3 && missingFocusMeshNames.length === 0;
    const externalOcclusionSafe = unexpectedOccluderMeshNames.length === 0;
    const nearPlaneSafe = nearPlaneViolationMeshNames.length === 0;
    const visibleBackfaceSafe = visibleBackfaceMeshNames.length === 0;
    const internalExposureSafe =
      cameraInsideMeshNames.length === 0 && visibleBackfaceSafe;

    return {
      schemaVersion: 1,
      progress: Number.isFinite(progress) ? progress : 0,
      stageId: stage.id,
      cameraPosition: cameraPosition.toArray(),
      cameraNear: camera.near,
      renderableMeshCount: renderableMeshes.length,
      focusMeshNames: [...stage.focusMeshNames],
      missingFocusMeshNames,
      configuredAllowedForegroundMeshNames: [
        ...stage.allowedForegroundMeshNames,
      ],
      focusHitRayCount,
      rays,
      allowedForegroundHitMeshNames,
      unexpectedOccluderMeshNames,
      nearPlaneViolationMeshNames,
      cameraInsideMeshNames,
      visibleBackfaceMeshNames,
      focusVisible,
      externalOcclusionSafe,
      nearPlaneSafe,
      visibleBackfaceSafe,
      internalExposureSafe,
      safe:
        focusVisible &&
        externalOcclusionSafe &&
        nearPlaneSafe &&
        internalExposureSafe,
    };
  }

  return { refresh, inspect };
}
