import { Color, MeshStandardMaterial, Texture } from "three";

import { type ScreenConfig } from "./screenManifest";
import { fitUv, type UvFitResult } from "./uvFit";

export type CreatedScreenMaterial = {
  material: MeshStandardMaterial;
  fit: UvFitResult;
};

function configureCoverTexture(texture: Texture, fit: UvFitResult): void {
  if (!fit.crop) return;
  texture.center.set(0.5, 0.5);
  texture.rotation = fit.rotation;
  texture.repeat.set(fit.crop.scale.x, fit.crop.scale.y);
  texture.offset.set(fit.crop.offset.x, fit.crop.offset.y);
  texture.needsUpdate = true;
}

function constrainContainUv(material: MeshStandardMaterial, fit: UvFitResult): void {
  const content = fit.content;
  if (!content) return;
  const rotation = fit.rotation.toFixed(8);

  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <map_fragment>",
      `#ifdef USE_MAP
        vec2 runtimeContentUv = vMapUv;
        if (runtimeContentUv.x < ${content.offset.x.toFixed(8)} || runtimeContentUv.x > ${(content.offset.x + content.scale.x).toFixed(8)} || runtimeContentUv.y < ${content.offset.y.toFixed(8)} || runtimeContentUv.y > ${(content.offset.y + content.scale.y).toFixed(8)}) discard;
        runtimeContentUv = (runtimeContentUv - vec2(${content.offset.x.toFixed(8)}, ${content.offset.y.toFixed(8)})) / vec2(${content.scale.x.toFixed(8)}, ${content.scale.y.toFixed(8)});
        runtimeContentUv -= vec2(0.5);
        runtimeContentUv = mat2(cos(${rotation}), -sin(${rotation}), sin(${rotation}), cos(${rotation})) * runtimeContentUv;
        runtimeContentUv += vec2(0.5);
        vec4 sampledDiffuseColor = texture2D(map, runtimeContentUv);
        diffuseColor *= sampledDiffuseColor;
      #endif`,
    );
  };
  material.customProgramCacheKey = () => `runtime-contain-${content.offset.x}-${content.offset.y}-${content.scale.x}-${content.scale.y}-${rotation}`;
}

export function createScreenMaterial(
  texture: Texture,
  config: ScreenConfig,
): CreatedScreenMaterial {
  const fit = fitUv({
    source: { width: config.sourceWidth, height: config.sourceHeight },
    surfaceAspect: config.surfaceAspect,
    fit: config.fit,
    positionX: config.positionX,
    positionY: config.positionY,
    scale: config.scale,
    rotation: config.rotation,
    safeArea: config.safeArea,
  });

  texture.flipY = config.flipY;
  texture.needsUpdate = true;
  if (config.fit === "cover") configureCoverTexture(texture, fit);
  const material = new MeshStandardMaterial({
    color: new Color("#ffffff"),
    map: texture,
    roughness: 0.31,
    metalness: 0,
    emissive: new Color("#ffffff"),
    emissiveMap: texture,
    emissiveIntensity: 0.16,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  material.name = "MAT_RuntimeScreenContent";
  material.depthWrite = true;
  material.depthTest = true;
  constrainContainUv(material, fit);
  return { material, fit };
}
