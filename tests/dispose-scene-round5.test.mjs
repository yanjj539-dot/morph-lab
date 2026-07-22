import assert from "node:assert/strict";
import test from "node:test";
import { BoxGeometry, Mesh, MeshStandardMaterial, Scene, Texture } from "three";

import { disposeScene } from "../app/scene/core/disposeScene.ts";

test("preserves leased geometry and textures while disposing scene-local resources", () => {
  const scene = new Scene();
  const sharedGeometry = new BoxGeometry(1, 1, 1);
  const sharedTexture = new Texture();
  const localGeometry = new BoxGeometry(2, 2, 2);
  const localTexture = new Texture();
  const sharedMaterial = new MeshStandardMaterial({ map: sharedTexture });
  const localMaterial = new MeshStandardMaterial({ map: localTexture });
  scene.add(new Mesh(sharedGeometry, sharedMaterial));
  scene.add(new Mesh(localGeometry, localMaterial));
  const events = {
    sharedGeometry: 0,
    sharedTexture: 0,
    localGeometry: 0,
    localTexture: 0,
    material: 0,
    renderer: 0,
  };
  sharedGeometry.addEventListener("dispose", () => (events.sharedGeometry += 1));
  sharedTexture.addEventListener("dispose", () => (events.sharedTexture += 1));
  localGeometry.addEventListener("dispose", () => (events.localGeometry += 1));
  localTexture.addEventListener("dispose", () => (events.localTexture += 1));
  sharedMaterial.addEventListener("dispose", () => (events.material += 1));
  const renderer = {
    dispose() {
      events.renderer += 1;
    },
    forceContextLoss() {},
    domElement: { remove() {} },
  };

  disposeScene(scene, renderer, [], {
    preserveGeometries: new Set([sharedGeometry]),
    preserveTextures: new Set([sharedTexture]),
  });

  assert.deepEqual(events, {
    sharedGeometry: 0,
    sharedTexture: 0,
    localGeometry: 1,
    localTexture: 1,
    material: 1,
    renderer: 1,
  });
});
