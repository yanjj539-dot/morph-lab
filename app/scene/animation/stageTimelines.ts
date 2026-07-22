import { Group, Material, Mesh, MeshStandardMaterial } from "three";

import { type JourneyStageId } from "../../data/journey";
import { ROUND3_STAGE_ORDER } from "../assets/assetManifest";
import { clamp01, rangeProgress } from "./progressMath";

type MaterialSnapshot = {
  material: Material;
  opacity: number;
  transparent: boolean;
  depthWrite: boolean;
  emissiveIntensity: number | null;
};

type StageSnapshot = {
  root: Group;
  visible: boolean;
  materials: readonly MaterialSnapshot[];
};

export type StageTimelineController = {
  update: (progress: number, elapsedSeconds?: number) => void;
  reset: () => void;
};

// These nodes are animated by the exported Blender Actions in Round 3.
export const BLENDER_AUTHORED_STAGE_CONTROLS = [
  "OBS_scan_beam",
  "OBS_papers",
  "OBS_output_card",
  "OBS_crop_frame",
  "STR_connectors",
  "STR_panels",
  "STR_tokens",
  "PRO_light_ring",
  "PRO_cursor",
  "REL_qa_rows",
  "REL_package_lid",
] as const;

function collectMaterialSnapshots(root: Group): MaterialSnapshot[] {
  const snapshots: MaterialSnapshot[] = [];
  const seen = new Set<Material>();

  root.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];

    for (const material of materials) {
      if (seen.has(material)) continue;
      seen.add(material);
      snapshots.push({
        material,
        opacity: material.opacity,
        transparent: material.transparent,
        depthWrite: material.depthWrite,
        emissiveIntensity:
          material instanceof MeshStandardMaterial
            ? material.emissiveIntensity
            : null,
      });
    }
  });

  return snapshots;
}

function setOpacity(snapshots: readonly MaterialSnapshot[], opacity: number): void {
  const nextOpacity = clamp01(opacity);
  const isCrossFading = nextOpacity < 0.999;

  for (const snapshot of snapshots) {
    const material = snapshot.material;
    material.opacity = snapshot.opacity * nextOpacity;
    material.depthWrite = isCrossFading ? false : snapshot.depthWrite;

    const transparent = snapshot.transparent || isCrossFading;
    if (material.transparent !== transparent) {
      material.transparent = transparent;
      material.needsUpdate = true;
    }
  }
}

function restoreStage(snapshot: StageSnapshot): void {
  snapshot.root.visible = snapshot.visible;

  for (const materialSnapshot of snapshot.materials) {
    const material = materialSnapshot.material;
    const transparentChanged = material.transparent !== materialSnapshot.transparent;
    material.opacity = materialSnapshot.opacity;
    material.transparent = materialSnapshot.transparent;
    material.depthWrite = materialSnapshot.depthWrite;

    if (
      materialSnapshot.emissiveIntensity !== null &&
      material instanceof MeshStandardMaterial
    ) {
      material.emissiveIntensity = materialSnapshot.emissiveIntensity;
    }
    if (transparentChanged) material.needsUpdate = true;
  }
}

function sampleStageOpacities(
  progress: number,
  output: Record<JourneyStageId, number>,
): void {
  output.observe = 1 - rangeProgress(0.2, 0.3, progress);
  output.structure =
    rangeProgress(0.18, 0.28, progress) *
    (1 - rangeProgress(0.46, 0.56, progress));
  output.prototype =
    rangeProgress(0.44, 0.54, progress) *
    (1 - rangeProgress(0.7, 0.8, progress));
  output.release = rangeProgress(0.69, 0.79, progress);
}

export function createStageTimelines(
  stageRoots: Record<JourneyStageId, Group>,
): StageTimelineController {
  function snapshot(stage: JourneyStageId): StageSnapshot {
    const root = stageRoots[stage];
    return {
      root,
      visible: root.visible,
      materials: collectMaterialSnapshots(root),
    };
  }

  const snapshots: Record<JourneyStageId, StageSnapshot> = {
    observe: snapshot("observe"),
    structure: snapshot("structure"),
    prototype: snapshot("prototype"),
    release: snapshot("release"),
  };
  const opacities: Record<JourneyStageId, number> = {
    observe: 1,
    structure: 0,
    prototype: 0,
    release: 0,
  };

  function reset(): void {
    for (const stage of ROUND3_STAGE_ORDER) restoreStage(snapshots[stage]);
  }

  return {
    update(progress) {
      sampleStageOpacities(clamp01(progress), opacities);

      for (const stage of ROUND3_STAGE_ORDER) {
        const snapshot = snapshots[stage];
        const opacity = opacities[stage];
        snapshot.root.visible = opacity > 0.002;
        setOpacity(snapshot.materials, opacity);
      }
    },
    reset,
  };
}
