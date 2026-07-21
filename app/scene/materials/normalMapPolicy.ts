import type { WebGLRenderer } from "three";

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
