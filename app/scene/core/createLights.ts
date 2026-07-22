import type { SceneQualitySettings } from "./qualityManager";
import { createStudioLightRig } from "../lighting/studioLightRig";

export function createLights(quality: SceneQualitySettings) {
  return createStudioLightRig(quality).group;
}
