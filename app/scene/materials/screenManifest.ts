import { type JourneyStageId } from "../../data/journey";
import { withBasePath } from "../../lib/paths";
import { type ScreenFitMode, type TextureRotation } from "./uvFit";

export type ProjectSurfaceKind = "screen" | "print";

export type ScreenConfig = {
  stage: JourneyStageId;
  meshName: string;
  kind: ProjectSurfaceKind;
  source: string;
  sourceWidth: number;
  sourceHeight: number;
  surfaceAspect: number;
  fit: ScreenFitMode;
  positionX: number;
  positionY: number;
  scale: number;
  rotation: TextureRotation;
  flipY: boolean;
  borderRadius: number;
  safeArea: number;
  contentDepthOffset: number;
  glassDepthOffset: number;
  renderOrder: number;
};

type SurfaceDefinition = Omit<ScreenConfig, "source"> & { source: string };

const source = (path: string): string => withBasePath(`/images/${path}`);

const surfaceDefinitions: readonly SurfaceDefinition[] = [
  { stage: "observe", meshName: "SCREEN_observe_inspection", kind: "screen", source: source("persona-result.webp"), sourceWidth: 1200, sourceHeight: 1600, surfaceAspect: 1.451, fit: "contain", positionX: 0.5, positionY: 0.46, scale: 1, rotation: 0, flipY: false, borderRadius: 0.04, safeArea: 0.06, contentDepthOffset: 0.001, glassDepthOffset: 0.002, renderOrder: 2 },
  { stage: "observe", meshName: "PRINT_observe_persona", kind: "print", source: source("persona-home.webp"), sourceWidth: 900, sourceHeight: 1600, surfaceAspect: 1.493, fit: "contain", positionX: 0.5, positionY: 0.5, scale: 1, rotation: 0, flipY: false, borderRadius: 0.015, safeArea: 0.07, contentDepthOffset: 0.001, glassDepthOffset: 0, renderOrder: 1 },
  { stage: "observe", meshName: "PRINT_observe_output", kind: "print", source: source("persona-result.webp"), sourceWidth: 1200, sourceHeight: 1600, surfaceAspect: 1.679, fit: "contain", positionX: 0.5, positionY: 0.48, scale: 1, rotation: 0, flipY: false, borderRadius: 0.015, safeArea: 0.07, contentDepthOffset: 0.001, glassDepthOffset: 0, renderOrder: 1 },
  { stage: "structure", meshName: "SCREEN_structure_system", kind: "screen", source: source("web-field-notes.webp"), sourceWidth: 1600, sourceHeight: 1000, surfaceAspect: 1.595, fit: "cover", positionX: 0.5, positionY: 0.48, scale: 1, rotation: 0, flipY: false, borderRadius: 0.03, safeArea: 0.05, contentDepthOffset: 0.001, glassDepthOffset: 0.002, renderOrder: 2 },
  { stage: "prototype", meshName: "SCREEN_prototype_monitor", kind: "screen", source: source("web-aeroform.webp"), sourceWidth: 1600, sourceHeight: 1000, surfaceAspect: 1.689, fit: "cover", positionX: 0.5, positionY: 0.5, scale: 1, rotation: 0, flipY: false, borderRadius: 0.03, safeArea: 0.05, contentDepthOffset: 0.001, glassDepthOffset: 0.002, renderOrder: 2 },
  { stage: "prototype", meshName: "SCREEN_prototype_phone", kind: "screen", source: source("persona-home.webp"), sourceWidth: 900, sourceHeight: 1600, surfaceAspect: 0.492, fit: "contain", positionX: 0.5, positionY: 0.5, scale: 1, rotation: 0, flipY: false, borderRadius: 0.08, safeArea: 0.06, contentDepthOffset: 0.001, glassDepthOffset: 0.002, renderOrder: 2 },
  { stage: "prototype", meshName: "SCREEN_prototype_tablet", kind: "screen", source: source("web-field-notes.webp"), sourceWidth: 1600, sourceHeight: 1000, surfaceAspect: 1.5, fit: "cover", positionX: 0.5, positionY: 0.5, scale: 1, rotation: 0, flipY: false, borderRadius: 0.04, safeArea: 0.05, contentDepthOffset: 0.001, glassDepthOffset: 0.002, renderOrder: 2 },
  { stage: "release", meshName: "SCREEN_release_monitor", kind: "screen", source: source("web-units.webp"), sourceWidth: 1600, sourceHeight: 1000, surfaceAspect: 1.6, fit: "contain", positionX: 0.5, positionY: 0.5, scale: 1, rotation: 0, flipY: false, borderRadius: 0.03, safeArea: 0.05, contentDepthOffset: 0.001, glassDepthOffset: 0.002, renderOrder: 2 },
  { stage: "release", meshName: "SCREEN_release_laptop", kind: "screen", source: source("web-smoke-fruit.webp"), sourceWidth: 1600, sourceHeight: 1000, surfaceAspect: 1.653, fit: "cover", positionX: 0.5, positionY: 0.48, scale: 1, rotation: 0, flipY: false, borderRadius: 0.03, safeArea: 0.05, contentDepthOffset: 0.001, glassDepthOffset: 0.002, renderOrder: 2 },
  { stage: "release", meshName: "SCREEN_release_phone", kind: "screen", source: source("persona-home.webp"), sourceWidth: 900, sourceHeight: 1600, surfaceAspect: 0.481, fit: "contain", positionX: 0.5, positionY: 0.5, scale: 1, rotation: 0, flipY: false, borderRadius: 0.08, safeArea: 0.06, contentDepthOffset: 0.001, glassDepthOffset: 0.002, renderOrder: 2 },
  { stage: "release", meshName: "PRINT_release_device", kind: "print", source: source("device-tree-hole.webp"), sourceWidth: 1600, sourceHeight: 1000, surfaceAspect: 1.556, fit: "contain", positionX: 0.5, positionY: 0.5, scale: 1, rotation: 0, flipY: false, borderRadius: 0.015, safeArea: 0.05, contentDepthOffset: 0.001, glassDepthOffset: 0, renderOrder: 1 },
  { stage: "release", meshName: "REL_project_image_0", kind: "print", source: source("web-aeroform.webp"), sourceWidth: 1600, sourceHeight: 1000, surfaceAspect: 1.429, fit: "cover", positionX: 0.5, positionY: 0.5, scale: 1, rotation: 0, flipY: false, borderRadius: 0.02, safeArea: 0.07, contentDepthOffset: 0.001, glassDepthOffset: 0, renderOrder: 1 },
  { stage: "release", meshName: "REL_project_image_1", kind: "print", source: source("persona-home.webp"), sourceWidth: 900, sourceHeight: 1600, surfaceAspect: 1.429, fit: "contain", positionX: 0.5, positionY: 0.5, scale: 1, rotation: 0, flipY: false, borderRadius: 0.02, safeArea: 0.07, contentDepthOffset: 0.001, glassDepthOffset: 0, renderOrder: 1 },
  { stage: "release", meshName: "REL_project_image_2", kind: "print", source: source("web-field-notes.webp"), sourceWidth: 1600, sourceHeight: 1000, surfaceAspect: 1.429, fit: "cover", positionX: 0.5, positionY: 0.5, scale: 1, rotation: 0, flipY: false, borderRadius: 0.02, safeArea: 0.07, contentDepthOffset: 0.001, glassDepthOffset: 0, renderOrder: 1 },
] as const;

export const SCREEN_MANIFEST: readonly ScreenConfig[] = surfaceDefinitions;

export function findScreenConfig(
  stage: JourneyStageId,
  meshName: string,
): ScreenConfig | undefined {
  return SCREEN_MANIFEST.find(
    (config) => config.stage === stage && config.meshName === meshName,
  );
}
