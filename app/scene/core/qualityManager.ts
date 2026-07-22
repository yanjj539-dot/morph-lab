export type SceneQualityTier = "low" | "balanced" | "high";

export type SceneQualitySettings = {
  tier: SceneQualityTier;
  dpr: number;
  activeDpr: number;
  idleDpr: number;
  targetFps: number;
  stableFrameCount: number;
  transmissionResolutionScale: number;
  anisotropy: number;
  shadows: boolean;
  shadowMapSize: number;
  antialias: boolean;
};

export type QualityProfile = {
  devicePixelRatio?: number;
  deviceMemory?: number;
  hardwareConcurrency?: number;
  coarsePointer?: boolean;
  narrowViewport?: boolean;
  reducedMotion?: boolean;
};

export function selectQualitySettings({
  devicePixelRatio = 1,
  deviceMemory = 4,
  hardwareConcurrency = 4,
  coarsePointer = false,
  narrowViewport = false,
  reducedMotion = false,
}: QualityProfile): SceneQualitySettings {
  const constrained =
    coarsePointer ||
    narrowViewport ||
    reducedMotion ||
    deviceMemory <= 4 ||
    hardwareConcurrency <= 4;

  if (constrained) {
    return {
      tier: "low",
      dpr: 1,
      activeDpr: 1,
      idleDpr: 1,
      targetFps: 45,
      stableFrameCount: 6,
      transmissionResolutionScale: 0.5,
      anisotropy: 2,
      shadows: false,
      shadowMapSize: 512,
      antialias: false,
    };
  }

  const high =
    devicePixelRatio >= 1.5 &&
    deviceMemory >= 8 &&
    hardwareConcurrency >= 8;
  if (high) {
    return {
      tier: "high",
      dpr: 1.5,
      activeDpr: 1.5,
      idleDpr: 1.5,
      targetFps: 60,
      stableFrameCount: 10,
      transmissionResolutionScale: 0.75,
      anisotropy: 8,
      shadows: true,
      shadowMapSize: 2048,
      antialias: true,
    };
  }

  return {
    tier: "balanced",
    dpr: 1.25,
    activeDpr: 1.25,
    idleDpr: 1.25,
    targetFps: 60,
    stableFrameCount: 8,
    transmissionResolutionScale: 0.5,
    anisotropy: 4,
    shadows: true,
    shadowMapSize: 1024,
    antialias: true,
  };
}

export function getQualitySettings(): SceneQualitySettings {
  if (typeof window === "undefined") return selectQualitySettings({});
  const navigatorWithMemory = navigator as Navigator & { deviceMemory?: number };
  return selectQualitySettings({
    devicePixelRatio: window.devicePixelRatio || 1,
    deviceMemory: navigatorWithMemory.deviceMemory ?? 8,
    hardwareConcurrency: navigator.hardwareConcurrency ?? 4,
    coarsePointer: window.matchMedia("(pointer: coarse)").matches,
    narrowViewport: window.matchMedia("(max-width: 767px)").matches,
    reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  });
}
