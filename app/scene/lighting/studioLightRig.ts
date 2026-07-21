import {
  AmbientLight,
  DirectionalLight,
  Group,
  HemisphereLight,
  Object3D,
  PointLight,
  SpotLight,
} from "three";

import type { SceneQualitySettings } from "../core/qualityManager";
import { configureContactShadow } from "./contactShadow";
import {
  createStageLightSample,
  sampleStageLightState,
} from "./stageLightStates";

export type StudioLightRig = {
  group: Group;
  update(progress: number): void;
};

export function createStudioLightRig(
  quality: SceneQualitySettings,
): StudioLightRig {
  const group = new Group();
  group.name = "MORPH_STUDIO_LIGHT_RIG";

  const ambient = new AmbientLight("#dbe4f3", 0.22);
  ambient.name = "STUDIO_ambient";

  const hemisphere = new HemisphereLight("#f7f9ff", "#20242b", 0.52);
  hemisphere.name = "STUDIO_hemisphere";

  const keyTarget = new Object3D();
  keyTarget.name = "STUDIO_key_target";
  keyTarget.position.set(-6, 0.75, -1.7);
  const key = new DirectionalLight("#fffaf2", 2.25);
  key.name = "STUDIO_soft_key";
  key.position.set(-9.8, 6.5, 4.4);
  key.target = keyTarget;
  configureContactShadow(key, quality);

  const fillTarget = new Object3D();
  fillTarget.name = "STUDIO_fill_target";
  fillTarget.position.set(-6, 0.8, -1.7);
  const fill = new SpotLight("#d8e5ff", 1.05, 18, Math.PI / 3, 1, 1.35);
  fill.name = "STUDIO_area_fill";
  fill.position.set(-3, 3.8, 4.5);
  fill.target = fillTarget;

  const rimTarget = new Object3D();
  rimTarget.name = "STUDIO_rim_target";
  rimTarget.position.set(-6, 0.9, -1.7);
  const rim = new DirectionalLight("#779dff", 0.92);
  rim.name = "STUDIO_cobalt_rim";
  rim.position.set(-1, 3.8, -5.8);
  rim.target = rimTarget;

  const accent = new PointLight("#ff8b73", 0.34, 6.8, 2);
  accent.name = "STUDIO_screen_accent";
  accent.position.set(-6, 1.55, 0.35);

  group.add(
    ambient,
    hemisphere,
    key,
    keyTarget,
    fill,
    fillTarget,
    rim,
    rimTarget,
    accent,
  );

  const sample = createStageLightSample();

  function update(progress: number): void {
    sampleStageLightState(progress, sample);
    ambient.intensity = sample.ambient;
    hemisphere.intensity = sample.hemisphere;
    key.intensity = sample.key;
    fill.intensity = sample.fill;
    rim.intensity = sample.rim;
    accent.intensity = sample.accent;
    accent.color.copy(sample.accentColor);

    keyTarget.position.x = sample.stageCenterX;
    key.position.x = sample.stageCenterX - 3.8;
    fill.position.x = sample.stageCenterX + 2.2;
    fillTarget.position.x = sample.stageCenterX;
    rimTarget.position.x = sample.stageCenterX;
    rim.position.x = sample.stageCenterX + 5;
    accent.position.x = sample.stageCenterX;
  }

  update(0);
  return { group, update };
}
