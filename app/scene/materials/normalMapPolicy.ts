import type { WebGLRenderer } from "three";

export type NormalDistanceTier = "near" | "medium" | "far";

export type NormalMapPolicy = Readonly<{
  enabled: boolean;
  scale: number;
}>;

export const ROUND5_NORMAL_TEXTURE_REPEATS = Object.freeze({
  paperNormal: [2, 2] as const,
  plasticNormal: [1.5, 1.5] as const,
  metalBrushedNormal: [1, 3] as const,
  rubberNormal: [2, 2] as const,
  studioOrm: [2, 2] as const,
});

const BASE_NORMAL_SCALE: Readonly<Record<string, number>> = Object.freeze({
  warmWhitePlastic: 0.01,
  coolWhiteCeramic: 0.006,
  paper: 0.012,
  softGreyMetal: 0.014,
  blackRubber: 0.018,
});

export function readMaterialNormalOverride(
  search: string | URLSearchParams,
): boolean | null {
  const params =
    typeof search === "string" ? new URLSearchParams(search) : search;
  const value = params.get("materialNormals");
  if (value === "0") return false;
  if (value === "1") return true;
  return null;
}

export function normalPolicyFor(
  material: string,
  distanceTier: NormalDistanceTier,
  runtimeEnabled = true,
): NormalMapPolicy {
  const baseScale = BASE_NORMAL_SCALE[material] ?? 0;
  if (!runtimeEnabled || baseScale === 0 || distanceTier === "far") {
    return { enabled: false, scale: 0 };
  }
  const multiplier = distanceTier === "medium" ? 0.4 : 1;
  return {
    enabled: true,
    scale: Math.round(baseScale * multiplier * 1000) / 1000,
  };
}

export function normalDistanceTierForStage(
  stage: string,
): NormalDistanceTier {
  if (stage === "observe") return "near";
  if (stage === "release") return "far";
  return "medium";
}

const SOFTWARE_RENDERER_PATTERN =
  /(?:swiftshader|llvmpipe|software rasterizer|basic render driver)/i;

export function supportsStableCompressedNormals(
  rendererDescription: string | null | undefined,
): boolean {
  return !SOFTWARE_RENDERER_PATTERN.test(rendererDescription ?? "");
}

export function getWebGLRendererDescription(renderer: WebGLRenderer): string {
  const context = renderer.getContext();

  try {
    const debugInfo = context.getExtension("WEBGL_debug_renderer_info") as {
      UNMASKED_RENDERER_WEBGL: number;
    } | null;
    if (debugInfo) {
      return String(context.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) ?? "");
    }
  } catch {
    // Privacy-restricted browsers can reject the unmasked renderer query.
  }

  try {
    return String(context.getParameter(context.RENDERER) ?? "");
  } catch {
    return "";
  }
}
