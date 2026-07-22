import {
  CatmullRomCurve3,
  Color,
  Fog,
  Mesh,
  MeshPhysicalMaterial,
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
import {
  acquireRound4StageAsset,
  type LoadedStageModel,
} from "./assets/loadModels";
import {
  applyRound4StageTextures,
  type LoadedTextureResources,
} from "./assets/loadTextures";
import {
  createStagePreloader,
  type StageLoadState,
} from "./assets/stagePreloader.ts";
import { createBlenderClipController } from "./animation/blenderClipController";
import {
  createCameraTimeline,
  createCameraTimelineSample,
} from "./animation/cameraTimeline";
import { clamp01, stageIndexForProgress } from "./animation/progressMath";
import {
  residentStages,
  STAGE_ORDER,
  type StageReadiness,
} from "./animation/stageResidency.ts";
import { createStageTimelines } from "./animation/stageTimelines";
import { createCameraCollisionInspector } from "./collision/cameraCollision";
import { createCameraRig } from "./core/createCameraRig";
import { createRenderer } from "./core/createRenderer";
import {
  createDynamicResolutionController,
  type DynamicResolutionChange,
} from "./core/dynamicResolution";
import { disposeScene } from "./core/disposeScene";
import { getQualitySettings } from "./core/qualityManager";
import {
  createRenderScheduler,
  type RenderSchedulerState,
} from "./core/renderScheduler";
import { inspectCameraTimeline } from "./debug/cameraPathInspector";
import { createCameraVisibilityInspector } from "./debug/cameraVisibilityInspector";
import { createProjectedLabels } from "./interaction/projectedLabels";
import { createVisibilityController } from "./interaction/visibilityController";
import { createStudioLightRig } from "./lighting/studioLightRig";

export type JourneyPerformanceState = {
  currentStage: JourneyStageId;
  loadedStages: JourneyStageId[];
  stageStates: Record<JourneyStageId, StageLoadState>;
  activeCanvasCount: number;
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
  programs: number;
  dpr: number;
  scheduler: RenderSchedulerState;
};

export type JourneySceneController = {
  setProgress(progress: number): void;
  scrollToStage(index: number): void;
  resize(): void;
  getPerformanceState(): JourneyPerformanceState;
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

type LoadedStageRuntime = {
  stage: JourneyStageId;
  model: LoadedStageModel;
  textures: LoadedTextureResources;
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

function configureStageShadows(
  root: LoadedStageModel["root"],
  enabled: boolean,
): void {
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

function scheduleIdle(callback: () => void): () => void {
  if ("requestIdleCallback" in window) {
    const id = window.requestIdleCallback(callback, { timeout: 900 });
    return () => window.cancelIdleCallback(id);
  }
  const id = globalThis.setTimeout(callback, 80);
  return () => globalThis.clearTimeout(id);
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
  scene.fog = new Fog("#e6ecef", 14, 34);

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
  floor.updateMatrix();
  floor.matrixAutoUpdate = false;
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
  route.updateMatrix();
  route.matrixAutoUpdate = false;
  scene.add(route);
  const routeIndexCount = routeGeometry.index?.count ?? 0;
  routeGeometry.setDrawRange(0, 6);

  const frozenQaProgress = getFrozenQaProgress();
  let progress = frozenQaProgress ?? 0;
  let activeStage = -1;
  let previousFrameTime = 0;
  let disposed = false;
  let ready = false;
  let projectedLabels: ReturnType<typeof createProjectedLabels> | null = null;
  let resizeObserver: ResizeObserver | null = null;
  let lastCameraInspectionProgress = Number.NaN;
  let lastResidencySignature = "";
  let currentResidentStage: JourneyStageId = "observe";
  let reconciling = false;
  let idleSharpTimer = 0;
  const loadedStages = new Map<JourneyStageId, LoadedStageRuntime>();
  const activeClipStages = new Set<JourneyStageId>();
  const clipController = createBlenderClipController({});
  const stageTimelines = createStageTimelines({});

  function applyDpr(change: DynamicResolutionChange): void {
    if (!change.changed || disposed) return;
    const bounds = canvasHost.getBoundingClientRect();
    renderer.setPixelRatio(change.currentDpr);
    renderer.setSize(
      Math.max(1, Math.floor(bounds.width)),
      Math.max(1, Math.floor(bounds.height)),
      false,
    );
    renderer.shadowMap.needsUpdate = true;
  }

  const resolution = createDynamicResolutionController({
    activeDpr: quality.activeDpr,
    idleDpr: quality.idleDpr,
    minDpr: 1,
    maxDpr: 1.5,
    cooldownMs: 2000,
    idleDelayMs: 220,
    onChange: applyDpr,
  });

  function markActivity(reason: string, durationMs = 180): void {
    if (disposed || !ready) return;
    if (scheduler.getState().status === "sleeping") previousFrameTime = 0;
    const now = performance.now();
    resolution.markActivity(now);
    if (idleSharpTimer) window.clearTimeout(idleSharpTimer);
    idleSharpTimer = window.setTimeout(() => {
      idleSharpTimer = 0;
      const change = resolution.settleIdle(performance.now());
      if (change.sharpFrame) scheduler.invalidate("idle-sharp");
    }, 220);
    scheduler.startTransient(durationMs, reason);
  }

  function disposeStageRuntime(runtime: LoadedStageRuntime): void {
    activeClipStages.delete(runtime.stage);
    clipController.removeStage(runtime.stage);
    stageTimelines.removeStage(runtime.stage);
    runtime.model.root.removeFromParent();
    runtime.model.root.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      const materials = Array.isArray(object.material)
        ? object.material
        : [object.material];
      for (const material of materials) material.dispose();
    });
    for (const texture of runtime.textures) {
      if (!runtime.textures.sharedTextures.has(texture)) texture.dispose();
    }
    runtime.textures.release();
    runtime.model.release?.();
    loadedStages.delete(runtime.stage);
  }

  function readiness(): StageReadiness {
    return Object.fromEntries(
      STAGE_ORDER.map((stage) => [stage, stagePreloader.getState(stage) === "ready"]),
    ) as StageReadiness;
  }

  function reconcileResidency(): void {
    if (disposed || reconciling) return;
    reconciling = true;
    try {
      const residency = residentStages(progress, readiness());
      currentResidentStage = residency.current;
      const attached = new Set(residency.attached);
      const signature = `${residency.current}:${residency.attached.join(",")}`;

      if (signature !== lastResidencySignature) {
        for (const [stage, runtime] of loadedStages) {
          const shouldAttach = attached.has(stage);
          if (shouldAttach && runtime.model.root.parent !== scene) {
            scene.add(runtime.model.root);
          } else if (!shouldAttach) {
            runtime.model.root.removeFromParent();
          }
          runtime.model.root.visible = stage === residency.current;
          configureStageShadows(
            runtime.model.root,
            quality.shadows && stage === residency.current,
          );
          if (shouldAttach && !activeClipStages.has(stage)) {
            clipController.addStage(stage, runtime.model);
            activeClipStages.add(stage);
          } else if (!shouldAttach && activeClipStages.has(stage)) {
            clipController.removeStage(stage);
            activeClipStages.delete(stage);
          }
        }
        stageTimelines.update(progress);
        for (const [stage, runtime] of loadedStages) {
          runtime.model.root.visible = stage === residency.current;
        }
        renderer.shadowMap.needsUpdate = true;
        cameraVisibilityInspector?.refresh(scene);
        lastResidencySignature = signature;
        markActivity(`stage-residency:${residency.current}`);
      }

      for (const [stage] of [...loadedStages]) {
        if (attached.has(stage)) continue;
        stagePreloader.evict(stage, disposeStageRuntime);
      }
      canvasHost.dataset.loadedStages = [...loadedStages.keys()].join(",");
      canvasHost.dataset.currentStage = residency.current;
    } finally {
      reconciling = false;
    }
  }

  const stagePreloader = createStagePreloader<LoadedStageRuntime>({
    scheduleIdle,
    async loadStage(stage) {
      const model = await acquireRound4StageAsset(stage, "Round5Journey", { signal });
      let textures: LoadedTextureResources | null = null;
      try {
        signal?.throwIfAborted();
        textures = await applyRound4StageTextures(stage, model.root, {
          maxAnisotropy: Math.min(
            quality.anisotropy,
            renderer.capabilities.getMaxAnisotropy(),
          ),
          quality,
          renderer,
          scene,
          signal,
        });
        signal?.throwIfAborted();
        if (disposed) throw new Error(`Journey ${stage} loaded after disposal.`);
        model.root.updateMatrix();
        model.root.matrixAutoUpdate = false;
        const runtime = { stage, model, textures };
        loadedStages.set(stage, runtime);
        stageTimelines.addStage(stage, model.root);
        reconcileResidency();
        markActivity(`stage-loaded:${stage}`);
        return runtime;
      } catch (error) {
        if (textures) {
          for (const texture of textures) {
            if (!textures.sharedTextures.has(texture)) texture.dispose();
          }
          textures.release();
        }
        model.release?.();
        throw error;
      }
    },
  });
  const unsubscribePreloader = stagePreloader.subscribe(reconcileResidency);

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
    renderer.setPixelRatio(resolution.getState().currentDpr);
    renderer.setSize(width, height, false);
    cameraRig.resize(width, height);
    projectedLabels?.resize();
    scheduler.invalidate("resize");
  }

  function renderFrame(time: number): void {
    if (disposed || !ready || !visibility.isVisible()) return;
    const frameTimeMs = previousFrameTime
      ? Math.min(50, Math.max(0, time - previousFrameTime))
      : 1000 / 60;
    const deltaSeconds = previousFrameTime
      ? Math.min(0.05, Math.max(0, (time - previousFrameTime) * 0.001))
      : 1 / 60;
    previousFrameTime = time;
    clipController.update(progress);
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
    resolution.recordFrame(frameTimeMs, time);
  }

  const visibility = createVisibilityController(canvasHost, {
    onChange(isVisible) {
      if (isVisible) scheduler.invalidate("visibility-restored");
      else scheduler.stop();
    },
  });

  const scheduler = createRenderScheduler({
    render: renderFrame,
    isVisible: visibility.isVisible,
    requestFrame: window.requestAnimationFrame.bind(window),
    cancelFrame: window.cancelAnimationFrame.bind(window),
    stableFrames: quality.stableFrameCount,
    onStateChange(state) {
      canvasHost.dataset.schedulerState = state.status;
      canvasHost.dataset.schedulerFrames = String(state.frameCount);
    },
  });

  function dispose(): void {
    if (disposed) return;
    disposed = true;
    ready = false;
    if (idleSharpTimer) window.clearTimeout(idleSharpTimer);
    idleSharpTimer = 0;
    scheduler.dispose();
    resizeObserver?.disconnect();
    resizeObserver = null;
    visibility.dispose();
    signal?.removeEventListener("abort", dispose);
    unsubscribePreloader();
    stagePreloader.dispose();
    projectedLabels?.dispose();
    projectedLabels = null;
    stageTimelines.reset();
    clipController.dispose();
    scene.environment = null;
    for (const runtime of [...loadedStages.values()]) disposeStageRuntime(runtime);
    disposeScene(scene, renderer);
    delete canvasHost.dataset.cameraSample;
    delete canvasHost.dataset.loadedStages;
    delete canvasHost.dataset.currentStage;
    delete canvasHost.dataset.schedulerState;
    delete canvasHost.dataset.schedulerFrames;
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
    await stagePreloader.ensure("observe", "critical");
    if (disposed) throw new Error("Journey scene was disposed while loading Observe.");
    stagePreloader.preloadForProgress(progress);
    if (frozenQaProgress !== null) {
      const desired = residentStages(progress, readiness()).desired;
      if (desired !== "observe") {
        await stagePreloader.ensure(desired, "critical");
      }
    }
    projectedLabels = createProjectedLabels(labelHost);
    resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvasHost);
    resize();
    updateStageBoundary(progress);
    reconcileResidency();
    ready = true;
    markActivity("initial-ready", 180);
    onReady();
    stagePreloader.schedule("structure");
  } catch (error) {
    const normalized = normalizeError(error);
    dispose();
    if (!signal?.aborted) onError(normalized);
    throw normalized;
  }

  return {
    setProgress(nextProgress) {
      progress = frozenQaProgress ?? clamp01(nextProgress);
      stagePreloader.preloadForProgress(progress);
      updateStageBoundary(progress);
      reconcileResidency();
      markActivity("scroll-progress");
    },
    scrollToStage(index) {
      const safeIndex = Math.max(0, Math.min(JOURNEY_STAGE_PROGRESS.length - 1, index));
      progress = frozenQaProgress ?? JOURNEY_STAGE_PROGRESS[safeIndex];
      stagePreloader.preloadForProgress(progress);
      updateStageBoundary(progress);
      reconcileResidency();
      markActivity("stage-jump");
    },
    resize,
    getPerformanceState() {
      const stageStates = Object.fromEntries(
        STAGE_ORDER.map((stage) => [stage, stagePreloader.getState(stage)]),
      ) as Record<JourneyStageId, StageLoadState>;
      const render = renderer.info.render;
      return {
        currentStage: currentResidentStage,
        loadedStages: [...loadedStages.keys()],
        stageStates,
        activeCanvasCount: document.querySelectorAll("canvas").length,
        drawCalls: render.calls,
        triangles: render.triangles,
        geometries: renderer.info.memory.geometries,
        textures: renderer.info.memory.textures,
        programs: renderer.info.programs?.length ?? 0,
        dpr: renderer.getPixelRatio(),
        scheduler: scheduler.getState(),
      };
    },
    dispose,
  };
}
