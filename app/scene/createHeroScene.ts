import {
  AnimationAction,
  AnimationMixer,
  Color,
  Fog,
  LoopOnce,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  Scene,
  Texture,
  Vector3,
} from "three";

import { createCameraTimeline, createCameraTimelineSample } from "./animation/cameraTimeline";
import { loadRound4StageModel } from "./assets/loadModels";
import { applyRound4StageTextures } from "./assets/loadTextures";
import { createCameraRig } from "./core/createCameraRig";
import { createRenderer } from "./core/createRenderer";
import { disposeScene } from "./core/disposeScene";
import { getQualitySettings } from "./core/qualityManager";
import { createVisibilityController } from "./interaction/visibilityController";
import { createStudioLightRig } from "./lighting/studioLightRig";

export const HERO_POINTER_LIMIT_DEGREES = 1.5;
export const HERO_OPENING_POSE = Object.freeze({
  position: [-1.164, 4.358, 4.996] as const,
  target: [-6, 0.7, -1.7] as const,
  fov: 28,
  yaw: 0,
  pitch: 0,
  dollyDistance: 0,
  roll: 0,
});

const POINTER_LIMIT_RADIANS = (HERO_POINTER_LIMIT_DEGREES * Math.PI) / 180;
const HERO_PULSE_DURATION_MS = 620;

export type HeroSceneController = {
  setPointer(x: number, y: number): void;
  setExitProgress(progress: number): void;
  pulse(): void;
  resize(): void;
  dispose(): void;
};

export type HeroSceneOptions = {
  canvasHost: HTMLElement;
  signal?: AbortSignal;
  onReady(): void;
  onError(error: Error): void;
};

function clampPointer(value: number): number {
  return Math.max(-1, Math.min(1, Number.isFinite(value) ? value : 0));
}

function clampProgress(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function smoothstep(value: number): number {
  const progress = clampProgress(value);
  return progress * progress * (3 - 2 * progress);
}

function configureModelShadows(root: Mesh["parent"], enabled: boolean): void {
  root?.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    const isTransmissive = materials.some(
      (material) =>
        material.transparent ||
        material.opacity < 0.999 ||
        (material instanceof MeshPhysicalMaterial && material.transmission > 0),
    );
    object.receiveShadow = enabled && !isTransmissive;
    object.castShadow =
      enabled &&
      !isTransmissive &&
      !/(?:key_|pin_|grid_|qr_|clip_|text|screen|print|image)/i.test(object.name);
  });
}

function normalizeError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

export async function createHeroScene({
  canvasHost,
  signal,
  onReady,
  onError,
}: HeroSceneOptions): Promise<HeroSceneController> {
  const quality = getQualitySettings();
  const renderer = createRenderer(canvasHost, quality);
  const scene = new Scene();
  scene.background = new Color("#e6ecef");
  scene.fog = new Fog("#e6ecef", 10, 28);

  const cameraRig = createCameraRig();
  const cameraTimeline = createCameraTimeline();
  const journeyCameraSample = createCameraTimelineSample();
  const heroCameraSample = createCameraTimelineSample();
  const openingPosition = new Vector3(...HERO_OPENING_POSE.position);
  const openingTarget = new Vector3(...HERO_OPENING_POSE.target);
  cameraTimeline.sample(0, journeyCameraSample);
  scene.add(cameraRig.rig);

  const lightRig = createStudioLightRig(quality);
  lightRig.update(0);
  scene.add(lightRig.group);

  const floorGeometry = new PlaneGeometry(12, 10);
  const floorMaterial = new MeshStandardMaterial({
    color: "#ede9df",
    roughness: 0.92,
    metalness: 0,
  });
  const floor = new Mesh(floorGeometry, floorMaterial);
  floor.name = "MORPH_HERO_FLOOR";
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(-6, 0.04, -1.7);
  floor.receiveShadow = quality.shadows;
  scene.add(floor);

  let animationFrameId = 0;
  let previousFrameTime = 0;
  let disposed = false;
  let ready = false;
  let resizeObserver: ResizeObserver | null = null;
  let mixer: AnimationMixer | null = null;
  let actions: readonly { action: AnimationAction; duration: number }[] = [];
  let loadedTextures: readonly Texture[] = [];
  let pointerTargetX = 0;
  let pointerTargetY = 0;
  let pointerX = 0;
  let pointerY = 0;
  let exitProgress = 0;
  let pulseStartedAt = Number.NEGATIVE_INFINITY;

  function resize(): void {
    if (disposed) return;
    const bounds = canvasHost.getBoundingClientRect();
    const width = Math.max(1, Math.floor(bounds.width));
    const height = Math.max(1, Math.floor(bounds.height));
    renderer.setPixelRatio(Math.min(quality.dpr, 1.5));
    renderer.setSize(width, height, false);
    cameraRig.resize(width, height);
  }

  function renderFrame(time: number): void {
    animationFrameId = 0;
    if (disposed || !ready || !visibility.isVisible()) return;

    const deltaSeconds = previousFrameTime
      ? Math.min(0.05, Math.max(0, (time - previousFrameTime) * 0.001))
      : 1 / 60;
    previousFrameTime = time;
    const pointerBlend = 1 - Math.exp(-9 * deltaSeconds);
    pointerX += (pointerTargetX - pointerX) * pointerBlend;
    pointerY += (pointerTargetY - pointerY) * pointerBlend;

    const pulseProgress = Math.max(
      0,
      Math.min(1, (time - pulseStartedAt) / HERO_PULSE_DURATION_MS),
    );
    const pulseAmount = Number.isFinite(pulseStartedAt)
      ? Math.sin(Math.PI * pulseProgress) * 0.12
      : 0;
    for (const { action, duration } of actions) {
      action.time = duration * pulseAmount;
    }
    mixer?.update(0);
    if (pulseProgress >= 1) pulseStartedAt = Number.NEGATIVE_INFINITY;

    const exitMix = smoothstep(exitProgress);
    heroCameraSample.position.lerpVectors(
      openingPosition,
      journeyCameraSample.position,
      exitMix,
    );
    heroCameraSample.target.lerpVectors(
      openingTarget,
      journeyCameraSample.target,
      exitMix,
    );
    heroCameraSample.fov =
      HERO_OPENING_POSE.fov +
      (journeyCameraSample.fov - HERO_OPENING_POSE.fov) * exitMix;
    heroCameraSample.yaw =
      HERO_OPENING_POSE.yaw +
      (journeyCameraSample.yaw - HERO_OPENING_POSE.yaw) * exitMix;
    heroCameraSample.pitch =
      HERO_OPENING_POSE.pitch +
      (journeyCameraSample.pitch - HERO_OPENING_POSE.pitch) * exitMix;
    heroCameraSample.dollyDistance =
      HERO_OPENING_POSE.dollyDistance +
      (journeyCameraSample.dollyDistance - HERO_OPENING_POSE.dollyDistance) * exitMix;
    heroCameraSample.roll =
      HERO_OPENING_POSE.roll +
      (journeyCameraSample.roll - HERO_OPENING_POSE.roll) * exitMix;
    const pointerPresence = 1 - exitMix;

    cameraRig.setPose(
      {
        ...heroCameraSample,
        yaw:
          heroCameraSample.yaw +
          pointerX * POINTER_LIMIT_RADIANS * pointerPresence,
        pitch:
          heroCameraSample.pitch -
          pointerY * POINTER_LIMIT_RADIANS * pointerPresence,
      },
      1 - Math.exp(-12 * deltaSeconds),
    );
    scene.updateMatrixWorld(true);
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
    for (const { action } of actions) action.stop();
    mixer?.stopAllAction();
    mixer = null;
    actions = [];
    disposeScene(scene, renderer, loadedTextures);
    loadedTextures = [];
    scene.clear();
  }

  signal?.addEventListener("abort", dispose, { once: true });
  if (signal?.aborted) dispose();

  try {
    const model = await loadRound4StageModel("observe", { signal });
    if (disposed) throw new Error("Hero scene was disposed while loading Observe.");
    scene.add(model.root);
    configureModelShadows(model.root, quality.shadows);
    loadedTextures = await applyRound4StageTextures("observe", model.root, {
      maxAnisotropy: Math.min(
        quality.anisotropy,
        renderer.capabilities.getMaxAnisotropy(),
      ),
      quality,
      renderer,
      scene,
      signal,
    });
    if (disposed) throw new Error("Hero scene was disposed while loading textures.");

    mixer = new AnimationMixer(model.root);
    actions = model.animations
      .filter((clip) => clip.duration > 0)
      .map((clip) => {
        const action = mixer?.clipAction(clip);
        if (!action) throw new Error(`Unable to create Hero action ${clip.name}.`);
        action.setLoop(LoopOnce, 1);
        action.clampWhenFinished = true;
        action.play();
        action.paused = true;
        action.time = 0;
        return { action, duration: clip.duration };
      });
    mixer.update(0);
    resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvasHost);
    resize();
    cameraRig.setPose(HERO_OPENING_POSE, 1);
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
    setPointer(x, y) {
      pointerTargetX = clampPointer(x);
      pointerTargetY = clampPointer(y);
      startRendering();
    },
    setExitProgress(progress: number) {
      exitProgress = clampProgress(progress);
      startRendering();
    },
    pulse() {
      pulseStartedAt = performance.now();
      startRendering();
    },
    resize,
    dispose,
  };
}
