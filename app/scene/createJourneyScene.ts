import {
  CatmullRomCurve3,
  Color,
  Fog,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  Scene,
  TubeGeometry,
  Vector3,
} from "three";

import {
  JOURNEY_STAGE_PROGRESS,
  JOURNEY_STAGES,
  type JourneyStageId,
} from "../data/journey";
import { loadRound2Models, type Round2ModelMap } from "./assets/loadModels";
import { applyRound2Textures } from "./assets/loadTextures";
import {
  createCameraTimeline,
  createCameraTimelineSample,
} from "./animation/cameraTimeline";
import { clamp01, stageIndexForProgress } from "./animation/progressMath";
import { createStageTimelines } from "./animation/stageTimelines";
import { createCameraRig } from "./core/createCameraRig";
import { createLights } from "./core/createLights";
import { createRenderer } from "./core/createRenderer";
import { disposeScene } from "./core/disposeScene";
import { getQualitySettings } from "./core/qualityManager";
import { createProjectedLabels } from "./interaction/projectedLabels";
import { createVisibilityController } from "./interaction/visibilityController";

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
      object.receiveShadow = enabled;
      object.castShadow = enabled && !SHADOW_DETAIL_PATTERN.test(object.name);
    });
  }
}

function getFrozenQaProgress(): number | null {
  if (typeof window === "undefined") return null;

  const qaStage = new URLSearchParams(window.location.search).get("qaStage");
  const index = JOURNEY_STAGES.findIndex((stage) => stage.id === qaStage);
  return index < 0 ? null : JOURNEY_STAGE_PROGRESS[index];
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
  scene.background = new Color("#bfd4f5");
  scene.fog = new Fog("#bfd4f5", 10, 28);

  const cameraRig = createCameraRig();
  const cameraTimeline = createCameraTimeline();
  const cameraSample = createCameraTimelineSample();
  scene.add(cameraRig.rig);
  scene.add(createLights(quality));

  const floorGeometry = new PlaneGeometry(26, 12);
  const floorMaterial = new MeshStandardMaterial({
    color: "#eef2f8",
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
    color: "#ff7157",
    emissive: "#ff7157",
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
  let disposed = false;
  let ready = false;
  let stageTimelines: ReturnType<typeof createStageTimelines> | null = null;
  let projectedLabels: ReturnType<typeof createProjectedLabels> | null = null;
  let resizeObserver: ResizeObserver | null = null;

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

    stageTimelines?.update(progress, time * 0.001);
    cameraTimeline.sample(progress, cameraSample);
    cameraRig.setPose(cameraSample);

    const routeCount = Math.max(
      6,
      Math.floor((routeIndexCount * clamp01(progress)) / 3) * 3,
    );
    routeGeometry.setDrawRange(0, routeCount);
    scene.updateMatrixWorld(true);
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
    disposeScene(scene, renderer);
    scene.clear();
  }

  signal?.addEventListener("abort", dispose, { once: true });
  if (signal?.aborted) dispose();

  try {
    const models = await loadRound2Models({ signal });
    if (disposed) throw new Error("Journey scene was disposed while loading models.");

    for (const stage of JOURNEY_STAGES) {
      scene.add(models[stage.id as JourneyStageId]);
    }
    configureModelShadows(models, quality.shadows);
    await applyRound2Textures(models, {
      maxAnisotropy: Math.min(
        quality.anisotropy,
        renderer.capabilities.getMaxAnisotropy(),
      ),
      signal,
    });
    if (disposed) throw new Error("Journey scene was disposed while loading textures.");

    stageTimelines = createStageTimelines(models);
    projectedLabels = createProjectedLabels(labelHost);
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
