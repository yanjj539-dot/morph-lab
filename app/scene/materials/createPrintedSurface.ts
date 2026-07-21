import { Color, MeshStandardMaterial, Texture } from "three";

import { type ScreenConfig } from "./screenManifest";
import { fitUv, type UvFitResult } from "./uvFit";

export type CreatedPrintedSurface = {
  material: MeshStandardMaterial;
  fit: UvFitResult;
};

function constrainSurfaceUv(
  material: MeshStandardMaterial,
  fit: UvFitResult,
  borderRadius: number,
): void {
  const visibleRect = fit.content
    ? {
        x: fit.content.offset.x,
        y: fit.content.offset.y,
        width: fit.content.scale.x,
        height: fit.content.scale.y,
      }
    : fit.safeRect;
  const sourceMapping = fit.content
    ? `(runtimeSurfaceUv - vec2(${fit.content.offset.x.toFixed(8)}, ${fit.content.offset.y.toFixed(8)})) / vec2(${fit.content.scale.x.toFixed(8)}, ${fit.content.scale.y.toFixed(8)})`
    : `runtimeSurfaceUv * vec2(${fit.crop?.scale.x.toFixed(8)}, ${fit.crop?.scale.y.toFixed(8)}) + vec2(${fit.crop?.offset.x.toFixed(8)}, ${fit.crop?.offset.y.toFixed(8)})`;
  const rotation = fit.rotation.toFixed(8);

  material.onBeforeCompile = (shader) => {
    shader.vertexShader = `varying vec2 runtimeSurfaceUv;\n${shader.vertexShader}`.replace(
      "#include <uv_vertex>",
      "#include <uv_vertex>\nruntimeSurfaceUv = uv;",
    );
    shader.fragmentShader = `varying vec2 runtimeSurfaceUv;\n${shader.fragmentShader}`;
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <map_fragment>",
      `#ifdef USE_MAP
        vec2 runtimeRectCenter = vec2(${(visibleRect.x + visibleRect.width / 2).toFixed(8)}, ${(visibleRect.y + visibleRect.height / 2).toFixed(8)});
        vec2 runtimeRectHalfSize = vec2(${(visibleRect.width / 2).toFixed(8)}, ${(visibleRect.height / 2).toFixed(8)});
        float runtimeCornerRadius = min(${borderRadius.toFixed(8)}, min(runtimeRectHalfSize.x, runtimeRectHalfSize.y));
        vec2 runtimeCornerDelta = abs(runtimeSurfaceUv - runtimeRectCenter) - (runtimeRectHalfSize - vec2(runtimeCornerRadius));
        float runtimeCornerDistance = length(max(runtimeCornerDelta, vec2(0.0))) + min(max(runtimeCornerDelta.x, runtimeCornerDelta.y), 0.0) - runtimeCornerRadius;
        if (runtimeCornerDistance > 0.0) discard;
        vec2 runtimeSourceUv = ${sourceMapping};
        runtimeSourceUv -= vec2(0.5);
        runtimeSourceUv = mat2(cos(${rotation}), -sin(${rotation}), sin(${rotation}), cos(${rotation})) * runtimeSourceUv;
        runtimeSourceUv += vec2(0.5);
        vec4 sampledDiffuseColor = texture2D(map, runtimeSourceUv);
        diffuseColor *= sampledDiffuseColor;
      #endif`,
    );
  };
  material.customProgramCacheKey = () => `runtime-print-${visibleRect.x}-${visibleRect.y}-${visibleRect.width}-${visibleRect.height}-${borderRadius}-${rotation}`;
}

export function createPrintedSurface(
  texture: Texture,
  config: ScreenConfig,
): CreatedPrintedSurface {
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
  const material = new MeshStandardMaterial({
    color: new Color("#ffffff"),
    map: texture,
    roughness: 0.9,
    metalness: 0,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  material.name = "MAT_RuntimePrintContent";
  material.depthWrite = true;
  material.depthTest = true;
  constrainSurfaceUv(material, fit, config.borderRadius);
  return { material, fit };
}
