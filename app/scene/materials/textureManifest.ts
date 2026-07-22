import { withBasePath } from "../../lib/paths";
import { ROUND5_NORMAL_TEXTURE_REPEATS } from "./normalMapPolicy.ts";

export type Round3TextureId =
  | "paperNormal"
  | "plasticNormal"
  | "metalBrushedNormal"
  | "rubberNormal"
  | "studioOrm"
  | "neutralStudioEnv";

export type Round3TextureManifestEntry = {
  url: string;
  repeat?: readonly [number, number];
  environment?: boolean;
};

export const ROUND3_TEXTURE_MANIFEST: Record<
  Round3TextureId,
  Round3TextureManifestEntry
> = {
  paperNormal: {
    url: withBasePath("/textures/round-3/paper-normal.ktx2"),
    repeat: ROUND5_NORMAL_TEXTURE_REPEATS.paperNormal,
  },
  plasticNormal: {
    url: withBasePath("/textures/round-3/plastic-normal.ktx2"),
    repeat: ROUND5_NORMAL_TEXTURE_REPEATS.plasticNormal,
  },
  metalBrushedNormal: {
    url: withBasePath("/textures/round-3/metal-brushed-normal.ktx2"),
    repeat: ROUND5_NORMAL_TEXTURE_REPEATS.metalBrushedNormal,
  },
  rubberNormal: {
    url: withBasePath("/textures/round-3/rubber-normal.ktx2"),
    repeat: ROUND5_NORMAL_TEXTURE_REPEATS.rubberNormal,
  },
  studioOrm: {
    url: withBasePath("/textures/round-3/studio-orm.ktx2"),
    repeat: ROUND5_NORMAL_TEXTURE_REPEATS.studioOrm,
  },
  neutralStudioEnv: {
    url: withBasePath("/textures/round-3/neutral-studio-env.ktx2"),
    environment: true,
  },
};
