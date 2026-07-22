import assert from "node:assert/strict";
import test from "node:test";
import {
  LinearFilter,
  LinearMipmapLinearFilter,
  SRGBColorSpace,
  Texture,
} from "three";

const textureUrl = new URL(
  "../app/scene/materials/screenTexturePolicy.ts",
  import.meta.url,
);

test("configures screen textures for sRGB trilinear mipmapped sampling", async () => {
  const { configureScreenTexture } = await import(textureUrl.href);
  const texture = new Texture();
  configureScreenTexture(texture, { maxAnisotropy: 16 }, "balanced");
  assert.equal(texture.colorSpace, SRGBColorSpace);
  assert.equal(texture.minFilter, LinearMipmapLinearFilter);
  assert.equal(texture.magFilter, LinearFilter);
  assert.equal(texture.generateMipmaps, true);
  assert.equal(texture.anisotropy, 4);
  assert.ok(texture.version > 0);
});

test("caps anisotropy by both capability and quality tier", async () => {
  const { configureScreenTexture } = await import(textureUrl.href);
  const low = configureScreenTexture(new Texture(), { maxAnisotropy: 16 }, "low");
  const balanced = configureScreenTexture(
    new Texture(),
    { maxAnisotropy: 3 },
    "balanced",
  );
  const high = configureScreenTexture(new Texture(), { maxAnisotropy: 16 }, "high");
  assert.equal(low.anisotropy, 2);
  assert.equal(balanced.anisotropy, 3);
  assert.equal(high.anisotropy, 8);
});
