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

export const ROUND4_STUDIO_LIGHT_COLORS = Object.freeze({
  ambient: "#eef2f5",
  hemisphereSky: "#fffaf4",
  hemisphereGround: "#30343a",
  key: "#fff2df",
  fill: "#dce9ff",
  rim: "#afc2ec",
  screenLocal: "#e5efff",
});

export type StudioLightRig = {
  group: Group;
  update(progress: number): void;
};

export function createStudioLightRig(
  quality: SceneQualitySettings,
): StudioLightRig {
  const group = new Group();
  group.name = "MORPH_STUDIO_LIGHT_RIG";

  const ambient = new AmbientLight(ROUND4_STUDIO_LIGHT_COLORS.ambient, 0.25);
  ambient.name = "STUDIO_ambient";

  const hemisphere = new HemisphereLight(
    ROUND4_STUDIO_LIGHT_COLORS.hemisphereSky,
    ROUND4_STUDIO_LIGHT_COLORS.hemisphereGround,
    0.5,
  );
  hemisphere.name = "STUDIO_hemisphere";

  const keyTarget = new Object3D();
  keyTarget.name = "STUDIO_key_target";
  keyTarget.position.set(-6, 0.75, -1.7);
  const key = new DirectionalLight(ROUND4_STUDIO_LIGHT_COLORS.key, 1.64);
  key.name = "STUDIO_soft_key";
  key.position.set(-9.8, 6.5, 4.4);
  key.target = keyTarget;
  configureContactShadow(key, quality);

  const fillTarget = new Object3D();
  fillTarget.name = "STUDIO_fill_target";
  fillTarget.position.set(-6, 0.8, -1.7);
  const fill = new SpotLight(
    ROUND4_STUDIO_LIGHT_COLORS.fill,
    0.42,
    18,
    Math.PI / 3,
    1,
    1.35,
  );
  fill.name = "STUDIO_area_fill";
  fill.position.set(-3, 3.8, 4.5);
  fill.target = fillTarget;

  const rimTarget = new Object3D();
  rimTarget.name = "STUDIO_rim_target";
  rimTarget.position.set(-6, 0.9, -1.7);
  const rim = new DirectionalLight(ROUND4_STUDIO_LIGHT_COLORS.rim, 0.32);
  rim.name = "STUDIO_restrained_rim";
  rim.position.set(-1, 3.8, -5.8);
  rim.target = rimTarget;

  const screenLocal = new PointLight(
    ROUND4_STUDIO_LIGHT_COLORS.screenLocal,
    0.12,
    3.6,
    2,
  );
  screenLocal.name = "STUDIO_screen_local";
  screenLocal.position.set(-6, 1.45, 0.3);

  group.add(
    ambient,
    hemisphere,
    key,
    keyTarget,
    fill,
    fillTarget,
    rim,
    rimTarget,
    screenLocal,
  );

  const sample = createStageLightSample();

  function update(progress: number): void {
    sampleStageLightState(progress, sample);
    ambient.intensity = sample.ambient;
    hemisphere.intensity = sample.hemisphere;
    key.intensity = sample.key;
    fill.intensity = sample.fill;
    rim.intensity = sample.rim;
    screenLocal.intensity = sample.screenLocal;

    keyTarget.position.x = sample.stageCenterX;
    key.position.x = sample.stageCenterX - 3.8;
    fill.position.x = sample.stageCenterX + 2.2;
    fillTarget.position.x = sample.stageCenterX;
    rimTarget.position.x = sample.stageCenterX;
    rim.position.x = sample.stageCenterX + 5;
    screenLocal.position.x = sample.stageCenterX;
  }

  update(0);
  return { group, update };
}
