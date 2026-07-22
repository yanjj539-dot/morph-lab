import {
  CatmullRomCurve3,
  Color,
  Fog,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  Scene,
  Texture,
  TubeGeometry,
  Vector3,
} from "three";

import {
  JOURNEY_STAGE_PROGRESS,
  JOURNEY_STAGES,
  type JourneyStageId,
} from "../data/journey";
import {
  disposeLoadedStageModels,
  getStageRoots,
  loadRound4Models,
  type Round2ModelMap,
} from "./assets/loadModels";
import { applyRound4Textures } from "./assets/loadTextures";
import { createBlenderClipController } from "./animation/blenderClipController";
import {
  createCameraTimeline,
  createCameraTimelineSample,
} from "./animation/cameraTimeline";
import { clamp01, stageIndexForProgress } from "./animation/progressMath";
import { createStageTimelines } from "./animation/stageTimelines";
import { createCameraCollisionInspector } from "./collision/cameraCollision";
import { createCameraRig } from "./core/createCameraRig";
import { createRenderer } from "./core/createRenderer";
import { disposeScene } from "./core/disposeScene";
import { getQualitySettings } from "./core/qualityManager";
import { inspectCameraTimeline } from "./debug/cameraPathInspector";
import { createCameraVisibilityInspector } from "./debug/cameraVisibilityInspector";
import { createProjectedLabels } from "./interaction/projectedLabels";
import { createVisibilityController } from "./interaction/visibilityController";
import { createStudioLightRig } from "./lighting/studioLightRig";

export type JourneySceneController = {
  setProgress(progress: number): void;
  scrollToStage(index: number): void;
  resize(): void;
  dispose(): void;
};

export type JourneySceneOptions = {
  canvasHost: HTMLElement;
  labelHost: HTMLElement;
  signal?: AbortSignal;
  onStageChange(index: number): void;
  onReady(): void;
  onError(error: Error): void;
};

const ROUTE_POINTS = [
  new Vector3(-7.1, 0.52, -0.62),
  new Vector3(-5.4, 0.48, -0.82),
  new Vector3(-3.15, 0.5, -0.56),
  new Vector3(-1.2, 0.46, -0.8),
  new Vector3(1.05, 0.5, -0.58),
  new Vector3(3.15, 0.48, -0.82),
  new Vector3(5.1, 0.52, -0.58),
  new Vector3(7.05, 0.5, -0.74),
] as const;

const SHADOW_DETAIL_PATTERN = /(?:key_|pin_|grid_|qr_|clip_|text|screen|print|image)/i;

function configureModelShadows(models: Round2ModelMap, enabled: boolean): void {
  for (const root of Object.values(models)) {
    root.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      const materials = Array.isArray(object.material)
        ? object.material
        : [object.material];
      const isTransmissive = materials.some(
        (material) =>
          material.transparent ||
          material.opacity < 0.999 ||
          (material instanceof MeshPhysicalMaterial && material.transmission > 0),
      );
      object.receiveShadow = enabled && !isTransmissive;
      object.castShadow =
        enabled && !isTransmissive && !SHADOW_DETAIL_PATTERN.test(object.name);
    });
  }
}

function getFrozenQaProgress(): number | null {
  if (typeof window === "undefined") return null;

  const searchParams = new URLSearchParams(window.location.search);
  const qaProgress = searchParams.get("qaProgress");
  if (qaProgress !== null) {
    const parsedProgress = Number.parseFloat(qaProgress);
    if (Number.isFinite(parsedProgress)) return clamp01(parsedProgress);
  }

  const qaStage = searchParams.get("qaStage");
  const index = JOURNEY_STAGES.findIndex((stage) => stage.id === qaStage);
  return index < 0 ? null : JOURNEY_STAGE_PROGRESS[index];
}

function isQaCameraInspectionEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).has("qaCamera");
}

function normalizeError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

export async function createJourneyScene({
  canvasHost,
  labelHost,
  signal,
  onStageChange,
  onReady,
  onError,
}: JourneySceneOptions): Promise<JourneySceneController> {
  const quality = getQualitySettings();
  const renderer = createRenderer(canvasHost, quality);
  const scene = new Scene();
  scene.background = new Color("#e6ecef");
  scene.fog = new Fog("#e6ecef", 10, 28);

  const cameraRig = createCameraRig();
  const cameraTimeline = createCameraTimeline();
  const cameraSample = createCameraTimelineSample();
  const cameraWorldPosition = new Vector3();
  const cameraCollision = createCameraCollisionInspector();
  const cameraPathReport = inspectCameraTimeline(cameraTimeline);
  const qaCameraInspectionEnabled = isQaCameraInspectionEnabled();
  const cameraVisibilityInspector = qaCameraInspectionEnabled
    ? createCameraVisibilityInspector()
    : null;
  scene.userData.cameraPathReport = cameraPathReport;
  scene.add(cameraRig.rig);
  const lightRig = createStudioLightRig(quality);
  scene.add(lightRig.group);

  const floorGeometry = new PlaneGeometry(26, 12);
  const floorMaterial = new MeshStandardMaterial({
    color: "#ede9df",
    roughness: 0.92,
    metalness: 0,
  });
  const floor = new Mesh(floorGeometry, floorMaterial);
  floor.name = "MORPH_WORLD_FLOOR";
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0.08, -1.7);
  floor.receiveShadow = quality.shadows;
  scene.add(floor);

  const routeCurve = new CatmullRomCurve3([...ROUTE_POINTS], false, "catmullrom", 0.34);
  const routeGeometry = new TubeGeometry(routeCurve, 160, 0.026, 6, false);
  const routeMaterial = new MeshStandardMaterial({
    color: "#ff6b5f",
    emissive: "#ff6b5f",
    emissiveIntensity: 0.08,
    roughness: 0.58,
  });
  const route = new Mesh(routeGeometry, routeMaterial);
  route.name = "MORPH_CONTINUOUS_ROUTE";
  route.castShadow = false;
  route.receiveShadow = false;
  scene.add(route);
  const routeIndexCount = routeGeometry.index?.count ?? 0;
  routeGeometry.setDrawRange(0, 6);

  const frozenQaProgress = getFrozenQaProgress();
  let progress = frozenQaProgress ?? 0;
  let activeStage = -1;
  let animationFrameId = 0;
  let previousFrameTime = 0;
  let disposed = false;
  let ready = false;
  let clipController: ReturnType<typeof createBlenderClipController> | null = null;
  let stageTimelines: ReturnType<typeof createStageTimelines> | null = null;
  let projectedLabels: ReturnType<typeof createProjectedLabels> | null = null;
  let resizeObserver: ResizeObserver | null = null;
  let loadedTextures: readonly Texture[] = [];
  let lastCameraInspectionProgress = Number.NaN;

  function updateStageBoundary(nextProgress: number): void {
    const nextStage = stageIndexForProgress(nextProgress);
    if (nextStage === activeStage) return;
    activeStage = nextStage;
    onStageChange(nextStage);
  }

  function resize(): void {
    if (disposed) return;
    const bounds = canvasHost.getBoundingClientRect();
    const width = Math.max(1, Math.floor(bounds.width));
    const height = Math.max(1, Math.floor(bounds.height));
    renderer.setPixelRatio(Math.min(quality.dpr, 1.5));
    renderer.setSize(width, height, false);
    cameraRig.resize(width, height);
    projectedLabels?.resize();
  }

  function renderFrame(time: number): void {
    animationFrameId = 0;
    if (disposed || !ready || !visibility.isVisible()) return;
    const deltaSeconds = previousFrameTime
      ? Math.min(0.05, Math.max(0, (time - previousFrameTime) * 0.001))
      : 1 / 60;
    previousFrameTime = time;

    clipController?.update(progress);
    stageTimelines?.update(progress, time * 0.001);
    lightRig.update(progress);
    cameraTimeline.sample(progress, cameraSample);
    cameraRig.setPose(cameraSample, 1 - Math.exp(-12 * deltaSeconds));
    cameraRig.rig.updateMatrixWorld(true);
    cameraRig.camera.getWorldPosition(cameraWorldPosition);
    scene.userData.cameraPose = {
      progress,
      position: cameraWorldPosition.toArray(),
      target: cameraSample.target.toArray(),
      fov: cameraSample.fov,
      yaw: cameraSample.yaw,
      pitch: cameraSample.pitch,
      dollyDistance: cameraSample.dollyDistance,
      roll: cameraSample.roll,
      nearPlane: cameraRig.camera.near,
    };
    scene.userData.cameraClearance = cameraCollision.inspect(
      cameraWorldPosition,
      cameraRig.camera.near,
    ).clearance;

    const routeCount = Math.max(
      6,
      Math.floor((routeIndexCount * clamp01(progress)) / 3) * 3,
    );
    routeGeometry.setDrawRange(0, routeCount);
    scene.updateMatrixWorld(true);
    if (
      cameraVisibilityInspector &&
      (!Number.isFinite(lastCameraInspectionProgress) ||
        Math.abs(progress - lastCameraInspectionProgress) > 1e-6)
    ) {
      canvasHost.dataset.cameraSample = JSON.stringify(
        cameraVisibilityInspector.inspect(scene, cameraRig.camera, progress),
      );
      lastCameraInspectionProgress = progress;
    }
    projectedLabels?.update(progress, cameraRig.camera);
    renderer.render(scene, cameraRig.camera);

    animationFrameId = window.requestAnimationFrame(renderFrame);
  }

  function startRendering(): void {
    if (disposed || !ready || animationFrameId || !visibility.isVisible()) return;
    animationFrameId = window.requestAnimationFrame(renderFrame);
  }

  function stopRendering(): void {
    if (!animationFrameId) return;
    window.cancelAnimationFrame(animationFrameId);
    animationFrameId = 0;
    previousFrameTime = 0;
  }

  const visibility = createVisibilityController(canvasHost, {
    onChange(isVisible) {
      if (isVisible) startRendering();
      else stopRendering();
    },
  });

  function dispose(): void {
    if (disposed) return;
    disposed = true;
    ready = false;
    stopRendering();
    resizeObserver?.disconnect();
    resizeObserver = null;
    visibility.dispose();
    signal?.removeEventListener("abort", dispose);
    projectedLabels?.dispose();
    projectedLabels = null;
    stageTimelines?.reset();
    stageTimelines = null;
    clipController?.dispose();
    clipController = null;
    disposeScene(scene, renderer, loadedTextures);
    loadedTextures = [];
    delete canvasHost.dataset.cameraSample;
    scene.clear();
  }

  signal?.addEventListener("abort", dispose, { once: true });
  if (signal?.aborted) dispose();

  try {
    if (cameraPathReport.summary.high > 0 || cameraPathReport.summary.medium > 0) {
      throw new Error(
        `Camera path intersects authored proxies at ${cameraPathReport.collisions.length} samples.`,
      );
    }

    const loadedModels = await loadRound4Models({ signal });
    if (disposed) {
      disposeLoadedStageModels(loadedModels);
      throw new Error("Journey scene was disposed while loading models.");
    }
    const models = getStageRoots(loadedModels);

    for (const stage of JOURNEY_STAGES) {
      scene.add(models[stage.id as JourneyStageId]);
    }
    configureModelShadows(models, quality.shadows);
    loadedTextures = await applyRound4Textures(models, {
      maxAnisotropy: Math.min(
        quality.anisotropy,
        renderer.capabilities.getMaxAnisotropy(),
      ),
      quality,
      renderer,
      scene,
      signal,
    });
    if (disposed) throw new Error("Journey scene was disposed while loading textures.");

    clipController = createBlenderClipController(loadedModels);
    clipController.update(progress);
    stageTimelines = createStageTimelines(models);
    stageTimelines.update(progress);
    projectedLabels = createProjectedLabels(labelHost);
    cameraVisibilityInspector?.refresh(scene);
    resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvasHost);
    resize();
    updateStageBoundary(progress);
    ready = true;
    startRendering();
    onReady();
  } catch (error) {
    const normalized = normalizeError(error);
    dispose();
    if (!signal?.aborted) onError(normalized);
    throw normalized;
  }

  return {
    setProgress(nextProgress) {
      progress = frozenQaProgress ?? clamp01(nextProgress);
      updateStageBoundary(progress);
      startRendering();
    },
    scrollToStage(index) {
      const safeIndex = Math.max(0, Math.min(JOURNEY_STAGE_PROGRESS.length - 1, index));
      progress = frozenQaProgress ?? JOURNEY_STAGE_PROGRESS[safeIndex];
      updateStageBoundary(progress);
      startRendering();
    },
    resize,
    dispose,
  };
}
