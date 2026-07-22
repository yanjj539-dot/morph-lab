import { DirectionalLight } from "three";

import type { SceneQualitySettings } from "../core/qualityManager";

export function configureContactShadow(
  light: DirectionalLight,
  quality: SceneQualitySettings,
): void {
  light.castShadow = quality.shadows;
  light.shadow.mapSize.set(quality.shadowMapSize, quality.shadowMapSize);
  light.shadow.camera.near = 0.5;
  light.shadow.camera.far = 28;
  light.shadow.camera.left = -8.5;
  light.shadow.camera.right = 8.5;
  light.shadow.camera.top = 7;
  light.shadow.camera.bottom = -5;
  light.shadow.bias = -0.00016;
  light.shadow.normalBias = 0.018;
  light.shadow.radius = quality.tier === "high" ? 3 : 2;
}
