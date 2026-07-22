import {
  BufferGeometry,
  Material,
  Object3D,
  Scene,
  Texture,
  WebGLRenderer,
} from "three";

type DisposableTextureCarrier = {
  dispose?: () => void;
  image?: unknown;
};

type UniformRecord = Record<string, { value?: unknown } | undefined>;

export type DisposeSceneOptions = {
  preserveGeometries?: ReadonlySet<BufferGeometry>;
  preserveTextures?: ReadonlySet<Texture>;
};

function isTexture(value: unknown): value is Texture {
  return value instanceof Texture;
}

function isMaterial(value: unknown): value is Material {
  return value instanceof Material;
}

function disposeImageBitmapLike(image: unknown) {
  if (
    image &&
    typeof image === "object" &&
    "close" in image &&
    typeof image.close === "function"
  ) {
    image.close();
  }
}

function disposeTexture(
  value: unknown,
  textures: Set<Texture>,
  imageBitmaps: Set<unknown>,
  preserveTextures: ReadonlySet<Texture>,
) {
  if (
    !isTexture(value) ||
    textures.has(value) ||
    preserveTextures.has(value)
  ) {
    return;
  }

  const texture = value;
  textures.add(texture);
  const image = (texture as DisposableTextureCarrier).image;
  if (image && !imageBitmaps.has(image)) {
    imageBitmaps.add(image);
    disposeImageBitmapLike(image);
  }

  texture.dispose();
}

function disposeMaterialTextures(
  material: Material,
  textures: Set<Texture>,
  imageBitmaps: Set<unknown>,
  preserveTextures: ReadonlySet<Texture>,
) {
  const materialRecord = material as unknown as Record<string, unknown>;

  for (const value of Object.values(materialRecord)) {
    disposeTexture(value, textures, imageBitmaps, preserveTextures);
  }

  const uniforms = materialRecord.uniforms as UniformRecord | undefined;
  if (!uniforms) return;

  for (const uniform of Object.values(uniforms)) {
    const value = uniform?.value;
    disposeTexture(value, textures, imageBitmaps, preserveTextures);

    if (Array.isArray(value)) {
      for (const entry of value) {
        disposeTexture(entry, textures, imageBitmaps, preserveTextures);
      }
    }
  }
}

export function disposeScene(
  scene: Object3D,
  renderer: WebGLRenderer,
  extraTextures: Iterable<Texture> = [],
  options: DisposeSceneOptions = {},
) {
  const geometries = new Set<BufferGeometry>();
  const materials = new Set<Material>();
  const textures = new Set<Texture>();
  const imageBitmaps = new Set<unknown>();
  const preserveGeometries = options.preserveGeometries ?? new Set<BufferGeometry>();
  const preserveTextures = options.preserveTextures ?? new Set<Texture>();

  scene.traverse((object) => {
    const maybeMesh = object as Object3D & {
      geometry?: unknown;
      material?: unknown;
    };

    if (maybeMesh.geometry instanceof BufferGeometry) {
      geometries.add(maybeMesh.geometry);
    }

    const objectMaterials = Array.isArray(maybeMesh.material)
      ? maybeMesh.material
      : [maybeMesh.material];

    for (const material of objectMaterials) {
      if (isMaterial(material)) {
        materials.add(material);
      }
    }
  });

  if (scene instanceof Scene) {
    disposeTexture(scene.background, textures, imageBitmaps, preserveTextures);
    disposeTexture(scene.environment, textures, imageBitmaps, preserveTextures);
    scene.background = null;
    scene.environment = null;
  }

  for (const geometry of geometries) {
    if (!preserveGeometries.has(geometry)) geometry.dispose();
  }

  for (const material of materials) {
    disposeMaterialTextures(material, textures, imageBitmaps, preserveTextures);
    material.dispose();
  }

  for (const texture of extraTextures) {
    disposeTexture(texture, textures, imageBitmaps, preserveTextures);
  }

  renderer.dispose();
  renderer.forceContextLoss();
  renderer.domElement.remove();
}
