import { withBasePath } from "../../lib/paths";

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
    repeat: [5, 5],
  },
  plasticNormal: {
    url: withBasePath("/textures/round-3/plastic-normal.ktx2"),
    repeat: [4, 4],
  },
  metalBrushedNormal: {
    url: withBasePath("/textures/round-3/metal-brushed-normal.ktx2"),
    repeat: [3, 7],
  },
  rubberNormal: {
    url: withBasePath("/textures/round-3/rubber-normal.ktx2"),
    repeat: [6, 6],
  },
  studioOrm: {
    url: withBasePath("/textures/round-3/studio-orm.ktx2"),
    repeat: [3, 3],
  },
  neutralStudioEnv: {
    url: withBasePath("/textures/round-3/neutral-studio-env.ktx2"),
    environment: true,
  },
};
