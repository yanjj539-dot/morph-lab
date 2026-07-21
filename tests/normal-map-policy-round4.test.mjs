import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (
      (specifier.startsWith("./") || specifier.startsWith("../")) &&
      !specifier.match(/\.[a-z]+$/i)
    ) {
      return nextResolve(`${specifier}.ts`, context);
    }
    return nextResolve(specifier, context);
  },
});

const { supportsStableCompressedNormals } = await import(
  "../app/scene/materials/normalMapPolicy.ts"
);

test("software WebGL renderers disable the unstable compressed-normal shader path", () => {
  assert.equal(
    supportsStableCompressedNormals(
      "ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)",
    ),
    false,
  );
  assert.equal(supportsStableCompressedNormals("llvmpipe (LLVM 18.1.8, 256 bits)"), false);
  assert.equal(supportsStableCompressedNormals("Microsoft Basic Render Driver"), false);
  assert.equal(supportsStableCompressedNormals("Software Rasterizer"), false);
});

test("hardware and privacy-masked renderers retain authored compressed normals", () => {
  assert.equal(supportsStableCompressedNormals("ANGLE (NVIDIA GeForce RTX 4070)"), true);
  assert.equal(supportsStableCompressedNormals("Apple M4 Pro"), true);
  assert.equal(supportsStableCompressedNormals("WebKit WebGL"), true);
  assert.equal(supportsStableCompressedNormals(""), true);
});
