import {
  BufferGeometry,
  Group,
  Material,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Quaternion,
  Vector3,
} from "three";

import { type JourneyStageId } from "../../data/journey";
import { ROUND2_STAGE_ORDER } from "../assets/assetManifest";
import { clamp01, rangeProgress } from "./progressMath";

type TransformSnapshot = {
  object: Object3D;
  position: Vector3;
  rotation: Quaternion;
  rotationX: number;
  rotationY: number;
  rotationZ: number;
  scale: Vector3;
};

type MaterialSnapshot = {
  material: Material;
  opacity: number;
  transparent: boolean;
  emissiveIntensity: number | null;
};

type DrawRangeSnapshot = {
  geometry: BufferGeometry;
  count: number;
};

export type StageTimelineController = {
  update: (progress: number, elapsedSeconds?: number) => void;
  reset: () => void;
};

function cacheTransform(object: Object3D | undefined): TransformSnapshot | null {
  if (!object) return null;

  return {
    object,
    position: object.position.clone(),
    rotation: object.quaternion.clone(),
    rotationX: object.rotation.x,
    rotationY: object.rotation.y,
    rotationZ: object.rotation.z,
    scale: object.scale.clone(),
  };
}

function restoreTransform(snapshot: TransformSnapshot | null): void {
  if (!snapshot) return;

  snapshot.object.position.copy(snapshot.position);
  snapshot.object.quaternion.copy(snapshot.rotation);
  snapshot.object.scale.copy(snapshot.scale);
  snapshot.object.visible = true;
}

function getObject(root: Object3D, name: string): Object3D | undefined {
  return root.getObjectByName(name);
}

function collectMaterialSnapshots(root: Object3D): MaterialSnapshot[] {
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
        emissiveIntensity:
          material instanceof MeshStandardMaterial ? material.emissiveIntensity : null,
      });
    }
  });

  return snapshots;
}

function setEmissiveIntensity(
  snapshots: readonly MaterialSnapshot[],
  multiplier: number,
): void {
  for (const snapshot of snapshots) {
    if (
      snapshot.emissiveIntensity !== null &&
      snapshot.material instanceof MeshStandardMaterial
    ) {
      snapshot.material.emissiveIntensity = snapshot.emissiveIntensity * multiplier;
    }
  }
}

function setOpacity(snapshots: readonly MaterialSnapshot[], opacity: number): void {
  const nextOpacity = clamp01(opacity);

  for (const snapshot of snapshots) {
    snapshot.material.opacity = snapshot.opacity * nextOpacity;
    const transparent = snapshot.transparent || nextOpacity < 0.999;
    if (snapshot.material.transparent !== transparent) {
      snapshot.material.transparent = transparent;
      snapshot.material.needsUpdate = true;
    }
  }
}

function restoreOpacity(snapshots: readonly MaterialSnapshot[]): void {
  for (const snapshot of snapshots) {
    snapshot.material.opacity = snapshot.opacity;
    snapshot.material.transparent = snapshot.transparent;
    if (
      snapshot.emissiveIntensity !== null &&
      snapshot.material instanceof MeshStandardMaterial
    ) {
      snapshot.material.emissiveIntensity = snapshot.emissiveIntensity;
    }
  }
}

function collectDrawRanges(root: Object3D): DrawRangeSnapshot[] {
  const ranges: DrawRangeSnapshot[] = [];

  root.traverse((object) => {
    if (!(object instanceof Mesh)) return;

    const geometry = object.geometry;
    const count = geometry.index?.count ?? geometry.attributes.position?.count ?? Infinity;
    ranges.push({ geometry, count });
  });

  return ranges;
}

function setDrawRange(snapshots: readonly DrawRangeSnapshot[], progress: number): void {
  const amount = clamp01(progress);

  for (const snapshot of snapshots) {
    const count = Math.floor((snapshot.count * amount) / 3) * 3;
    snapshot.geometry.setDrawRange(0, count);
  }
}

function restoreDrawRange(snapshots: readonly DrawRangeSnapshot[]): void {
  for (const snapshot of snapshots) {
    snapshot.geometry.setDrawRange(0, snapshot.count);
  }
}

function restoreAll(transforms: readonly (TransformSnapshot | null)[]): void {
  for (const transform of transforms) {
    restoreTransform(transform);
  }
}

export function createStageTimelines(
  stageRoots: Record<JourneyStageId, Group>,
): StageTimelineController {
  const observe = stageRoots.observe;
  const structure = stageRoots.structure;
  const prototype = stageRoots.prototype;
  const release = stageRoots.release;

  const roots = ROUND2_STAGE_ORDER.map((stage) => cacheTransform(stageRoots[stage]));
  const observeRootMaterials = collectMaterialSnapshots(observe);
  const structureRootMaterials = collectMaterialSnapshots(structure);
  const prototypeRootMaterials = collectMaterialSnapshots(prototype);
  const releaseRootMaterials = collectMaterialSnapshots(release);

  const observeBeam = cacheTransform(getObject(observe, "OBS_scan_beam"));
  const observePapers = cacheTransform(getObject(observe, "OBS_papers"));
  const observeOutput = cacheTransform(getObject(observe, "OBS_output_card"));
  const observeCrop = cacheTransform(getObject(observe, "OBS_crop_frame"));

  const structurePanels = cacheTransform(getObject(structure, "STR_panels"));
  const structureTokens = cacheTransform(getObject(structure, "STR_tokens"));
  const structureRuler = cacheTransform(getObject(structure, "STR_type_ruler"));
  const structureConnectors = getObject(structure, "STR_connectors");
  const structureConnectorTransform = cacheTransform(structureConnectors);
  const structureConnectorMaterials = structureConnectors
    ? collectMaterialSnapshots(structureConnectors)
    : [];
  const structureConnectorDrawRanges = structureConnectors ? collectDrawRanges(structureConnectors) : [];
  const structureFinalPanel = cacheTransform(getObject(structure, "STR_final_panel"));

  const prototypeUiLayer = cacheTransform(getObject(prototype, "PRO_ui_layer"));
  const prototypeCursor = cacheTransform(getObject(prototype, "PRO_cursor"));
  const prototypeRing = cacheTransform(getObject(prototype, "PRO_light_ring"));
  const prototypeSensor = cacheTransform(getObject(prototype, "PRO_sensor"));
  const prototypeMonitor = getObject(prototype, "SCREEN_prototype_monitor");
  const prototypePhone = getObject(prototype, "SCREEN_prototype_phone");
  const prototypeMonitorMaterials = prototypeMonitor
    ? collectMaterialSnapshots(prototypeMonitor)
    : [];
  const prototypePhoneMaterials = prototypePhone
    ? collectMaterialSnapshots(prototypePhone)
    : [];

  const releaseLive = cacheTransform(getObject(release, "REL_live_state"));
  const releaseDevices = cacheTransform(getObject(release, "REL_devices"));
  const releaseQaRows = cacheTransform(getObject(release, "REL_qa_rows"));
  const releaseVersion = cacheTransform(getObject(release, "REL_version"));
  const releasePackageLid = cacheTransform(getObject(release, "REL_package_lid"));
  const releaseFinalPanel = cacheTransform(getObject(release, "REL_final_panel"));
  const releaseQaChecks = [0, 1, 2, 3].map((index) =>
    cacheTransform(getObject(release, `REL_qa_check_${index}`)),
  );

  const transformSnapshots = [
    ...roots,
    observeBeam,
    observePapers,
    observeOutput,
    observeCrop,
    structurePanels,
    structureTokens,
    structureRuler,
    structureConnectorTransform,
    structureFinalPanel,
    prototypeUiLayer,
    prototypeCursor,
    prototypeRing,
    prototypeSensor,
    releaseLive,
    releaseDevices,
    releaseQaRows,
    releaseVersion,
    releasePackageLid,
    releaseFinalPanel,
    ...releaseQaChecks,
  ];

  function reset(): void {
    restoreAll(transformSnapshots);
    restoreOpacity(observeRootMaterials);
    restoreOpacity(structureRootMaterials);
    restoreOpacity(prototypeRootMaterials);
    restoreOpacity(releaseRootMaterials);
    restoreOpacity(structureConnectorMaterials);
    restoreOpacity(prototypeMonitorMaterials);
    restoreOpacity(prototypePhoneMaterials);
    restoreDrawRange(structureConnectorDrawRanges);
  }

  return {
    update(progress, elapsedSeconds = 0) {
      const t = clamp01(progress);
      const idle = Math.sin(elapsedSeconds * 1.8);

      const observeIn = 1 - rangeProgress(0.2, 0.3, t);
      const structureIn = rangeProgress(0.2, 0.3, t) * (1 - rangeProgress(0.45, 0.55, t));
      const prototypeIn = rangeProgress(0.45, 0.55, t) * (1 - rangeProgress(0.7, 0.8, t));
      const releaseIn = rangeProgress(0.7, 0.8, t);

      setOpacity(observeRootMaterials, Math.max(0.18, observeIn));
      setOpacity(structureRootMaterials, Math.max(0.12, structureIn));
      setOpacity(prototypeRootMaterials, Math.max(0.12, prototypeIn));
      setOpacity(releaseRootMaterials, Math.max(0.14, releaseIn));

      const scan = rangeProgress(0.03, 0.2, t);
      if (observeBeam) {
        observeBeam.object.position.z = observeBeam.position.z + 0.46 - scan * 0.92;
        observeBeam.object.scale.x = observeBeam.scale.x * (0.34 + scan * 0.66);
      }
      if (observePapers) {
        observePapers.object.position.z = observePapers.position.z + rangeProgress(0, 0.16, t) * 0.08;
      }
      if (observeOutput) {
        const reveal = rangeProgress(0.11, 0.24, t);
        observeOutput.object.scale.set(
          observeOutput.scale.x * (0.82 + reveal * 0.18),
          observeOutput.scale.y * (0.82 + reveal * 0.18),
          observeOutput.scale.z,
        );
      }
      if (observeCrop) {
        observeCrop.object.visible = t > 0.08;
        observeCrop.object.scale.setScalar(0.74 + rangeProgress(0.08, 0.22, t) * 0.26);
      }

      const systemBuild = rangeProgress(0.25, 0.44, t);
      if (structurePanels) {
        structurePanels.object.position.z = structurePanels.position.z + (1 - systemBuild) * 0.14;
      }
      if (structureRuler) {
        structureRuler.object.position.x = structureRuler.position.x - (1 - systemBuild) * 0.22;
      }
      if (structureTokens) {
        structureTokens.object.position.y = structureTokens.position.y + systemBuild * 0.18;
        structureTokens.object.rotation.y = structureTokens.rotationY + systemBuild * 0.16;
      }
      if (structureConnectorTransform) {
        structureConnectorTransform.object.visible = systemBuild > 0.02;
        setOpacity(
          structureConnectorMaterials,
          systemBuild * Math.max(0.12, structureIn),
        );
        setDrawRange(structureConnectorDrawRanges, systemBuild);
      }
      if (structureFinalPanel) {
        structureFinalPanel.object.scale.z =
          structureFinalPanel.scale.z * (0.55 + rangeProgress(0.38, 0.49, t) * 0.45);
      }

      const live = rangeProgress(0.5, 0.68, t);
      const phoneLive = rangeProgress(0.58, 0.72, t);
      setEmissiveIntensity(prototypeMonitorMaterials, 0.08 + live * 0.92);
      setEmissiveIntensity(prototypePhoneMaterials, 0.08 + phoneLive * 0.92);
      if (prototypeUiLayer) {
        prototypeUiLayer.object.position.z = prototypeUiLayer.position.z + live * 0.16;
      }
      if (prototypeCursor) {
        prototypeCursor.object.position.x = prototypeCursor.position.x + live * 0.42;
        prototypeCursor.object.position.z = prototypeCursor.position.z - live * 0.28;
      }
      if (prototypeRing) {
        const pulse = 1 + live * 0.22 + Math.max(0, idle) * live * 0.04;
        prototypeRing.object.scale.set(
          prototypeRing.scale.x * pulse,
          prototypeRing.scale.y * pulse,
          prototypeRing.scale.z * pulse,
        );
        prototypeRing.object.rotation.z = prototypeRing.rotationZ + live * Math.PI * 0.35;
      }
      if (prototypeSensor) {
        prototypeSensor.object.position.z = prototypeSensor.position.z + Math.max(0, idle) * live * 0.03;
      }

      const releaseBuild = rangeProgress(0.76, 0.93, t);
      if (releaseDevices) {
        releaseDevices.object.rotation.x = releaseDevices.rotationX - releaseBuild * 0.12;
      }
      if (releaseQaRows) {
        releaseQaRows.object.position.x = releaseQaRows.position.x + (1 - releaseBuild) * 0.24;
        releaseQaRows.object.scale.x = releaseQaRows.scale.x * (0.72 + releaseBuild * 0.28);
      }
      for (let index = 0; index < releaseQaChecks.length; index += 1) {
        const check = releaseQaChecks[index];
        if (!check) continue;
        const checkProgress = rangeProgress(
          0.78 + index * 0.035,
          0.84 + index * 0.035,
          t,
        );
        check.object.visible = checkProgress > 0.01;
        const scale = 0.52 + checkProgress * 0.48;
        check.object.scale.set(
          check.scale.x * scale,
          check.scale.y * scale,
          check.scale.z * scale,
        );
      }
      if (releaseVersion) {
        releaseVersion.object.position.z = releaseVersion.position.z + rangeProgress(0.84, 0.96, t) * 0.08;
      }
      if (releasePackageLid) {
        releasePackageLid.object.rotation.x = releasePackageLid.rotationX - releaseBuild * 0.24;
      }
      if (releaseLive) {
        releaseLive.object.scale.x = releaseLive.scale.x * (0.82 + releaseBuild * 0.18);
      }
      if (releaseFinalPanel) {
        releaseFinalPanel.object.visible = t > 0.78;
      }
    },
    reset,
  };
}
