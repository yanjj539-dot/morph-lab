export type SceneQualityTier = "mobile" | "balanced" | "high";

export type SceneQualitySettings = {
  tier: SceneQualityTier;
  dpr: number;
  anisotropy: number;
  shadows: boolean;
  shadowMapSize: number;
  antialias: boolean;
};

const DESKTOP_DPR_CAP = 1.5;

export function getQualitySettings(): SceneQualitySettings {
  if (typeof window === "undefined") {
    return {
      tier: "balanced",
      dpr: 1,
      anisotropy: 4,
      shadows: true,
      shadowMapSize: 1024,
      antialias: true,
    };
  }

  const dpr = Math.min(window.devicePixelRatio || 1, DESKTOP_DPR_CAP);
  const isCoarsePointer = window.matchMedia("(pointer: coarse)").matches;
  const isNarrowViewport = window.matchMedia("(max-width: 767px)").matches;
  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  const navigatorWithMemory = navigator as Navigator & {
    deviceMemory?: number;
  };
  const deviceMemory = navigatorWithMemory.deviceMemory ?? 4;
  const hardwareConcurrency = navigator.hardwareConcurrency ?? 4;
  const isConstrainedDevice =
    isCoarsePointer ||
    isNarrowViewport ||
    prefersReducedMotion ||
    deviceMemory <= 4 ||
    hardwareConcurrency <= 4;

  if (isConstrainedDevice) {
    return {
      tier: "mobile",
      dpr: Math.min(dpr, 1),
      anisotropy: 2,
      shadows: false,
      shadowMapSize: 512,
      antialias: false,
    };
  }

  if (dpr >= 1.4 && deviceMemory >= 8 && hardwareConcurrency >= 8) {
    return {
      tier: "high",
      dpr,
      anisotropy: 8,
      shadows: true,
      shadowMapSize: 2048,
      antialias: true,
    };
  }

  return {
    tier: "balanced",
    dpr,
    anisotropy: 4,
    shadows: true,
    shadowMapSize: 1024,
    antialias: true,
  };
}
