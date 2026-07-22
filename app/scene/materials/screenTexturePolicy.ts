import {
  LinearFilter,
  LinearMipmapLinearFilter,
  SRGBColorSpace,
  type Texture,
} from "three";

import type { SceneQualityTier } from "../core/qualityManager.ts";

export type ScreenTextureCapability = Readonly<{
  maxAnisotropy: number;
}>;

const TIER_ANISOTROPY: Readonly<Record<SceneQualityTier, number>> = {
  low: 2,
  balanced: 4,
  high: 8,
};

export function configureScreenTexture(
  texture: Texture,
  capability: ScreenTextureCapability,
  tier: SceneQualityTier,
): Texture {
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.magFilter = LinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = Math.max(
    1,
    Math.min(capability.maxAnisotropy, TIER_ANISOTROPY[tier]),
  );
  texture.needsUpdate = true;
  return texture;
}
