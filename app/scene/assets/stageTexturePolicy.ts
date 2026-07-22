import type { JourneyStageId } from "../../data/journey";

export type StageTextureLoadMode = "deferred" | "blocking";

export function stageTextureLoadMode(
  stage: JourneyStageId,
): StageTextureLoadMode {
  return stage === "observe" ? "deferred" : "blocking";
}
