import {
  AmbientLight,
  Color,
  DirectionalLight,
  Group,
  HemisphereLight,
  PointLight,
} from "three";

import type { SceneQualitySettings } from "./qualityManager";

export function createLights(quality: SceneQualitySettings) {
  const group = new Group();
  group.name = "MORPH_LIGHT_RIG";

  const ambient = new AmbientLight(new Color("#dbe7ff"), 0.42);
  ambient.name = "LAB_soft_ambient";
  group.add(ambient);

  const hemi = new HemisphereLight("#f6f8ff", "#141821", 0.62);
  hemi.name = "LAB_hemisphere_wrap";
  group.add(hemi);

  const key = new DirectionalLight(
    "#ffffff",
    quality.tier === "high" ? 2.1 : 1.72,
  );
  key.name = "LAB_editorial_key";
  key.position.set(-4.5, 6.2, 5.4);
  key.castShadow = quality.shadows;
  key.shadow.mapSize.set(quality.shadowMapSize, quality.shadowMapSize);
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 26;
  key.shadow.camera.left = -8;
  key.shadow.camera.right = 8;
  key.shadow.camera.top = 8;
  key.shadow.camera.bottom = -8;
  key.shadow.bias = -0.00018;
  group.add(key);

  const rim = new DirectionalLight("#7ba7ff", 1.1);
  rim.name = "LAB_cobalt_rim";
  rim.position.set(5.5, 3.1, -4.2);
  group.add(rim);

  const accent = new PointLight(
    "#ff7058",
    quality.tier === "mobile" ? 0.5 : 0.78,
    9,
    2,
  );
  accent.name = "LAB_coral_signal";
  accent.position.set(-2.6, 1.4, 2.4);
  group.add(accent);

  return group;
}
