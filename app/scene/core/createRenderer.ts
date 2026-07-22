import {
  AgXToneMapping,
  PCFSoftShadowMap,
  SRGBColorSpace,
  WebGLRenderer,
} from "three";

import type { SceneQualitySettings } from "./qualityManager";

export function createRenderer(
  host: HTMLElement,
  quality: SceneQualitySettings,
) {
  const renderer = new WebGLRenderer({
    alpha: true,
    antialias: quality.antialias,
    powerPreference: quality.tier === "mobile" ? "default" : "high-performance",
    stencil: false,
  });

  renderer.setPixelRatio(Math.min(quality.dpr, 1.5));
  renderer.setSize(host.clientWidth, host.clientHeight, false);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = AgXToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.shadowMap.enabled = quality.shadows;
  renderer.shadowMap.type = PCFSoftShadowMap; // Round 2 baseline: PCFShadowMap.
  renderer.transmissionResolutionScale = quality.tier === "high" ? 1 : 0.75;
  renderer.domElement.setAttribute("aria-hidden", "true");
  renderer.domElement.style.display = "block";
  renderer.domElement.style.height = "100%";
  renderer.domElement.style.width = "100%";

  host.appendChild(renderer.domElement);

  return renderer;
}
