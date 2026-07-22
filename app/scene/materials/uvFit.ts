export type ScreenFitMode = "contain" | "cover";
export type TextureRotation = 0 | 90 | 180 | 270;

export type UvFitInput = {
  source: { width: number; height: number };
  surfaceAspect: number;
  fit: ScreenFitMode;
  positionX: number;
  positionY: number;
  scale: number;
  rotation: TextureRotation;
  safeArea: number;
};

export type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type Point2 = { x: number; y: number };

export type UvTransform = {
  scale: { x: number; y: number };
  offset: { x: number; y: number };
};

export type UvFitResult = {
  crop: UvTransform | null;
  content: UvTransform | null;
  rotation: number;
  safeRect: Rect;
};

const QUARTER_TURN_RADIANS = Math.PI / 2;

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function assertPositive(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be a positive finite number.`);
  }
}

function safeRect(safeArea: number): Rect {
  if (!Number.isFinite(safeArea) || safeArea < 0 || safeArea >= 0.5) {
    throw new Error("safeArea must be a finite normalized inset from 0 (inclusive) to 0.5 (exclusive).");
  }

  const size = 1 - safeArea * 2;
  return { x: safeArea, y: safeArea, width: size, height: size };
}

export function isUvInsideRoundedRect(
  point: Point2,
  rect: Rect,
  borderRadius: number,
): boolean {
  if (
    point.x < rect.x ||
    point.x > rect.x + rect.width ||
    point.y < rect.y ||
    point.y > rect.y + rect.height
  ) {
    return false;
  }

  const radius = Math.min(
    Math.max(0, borderRadius),
    rect.width / 2,
    rect.height / 2,
  );
  if (radius === 0) return true;
  const nearestX = Math.min(
    rect.x + rect.width - radius,
    Math.max(rect.x + radius, point.x),
  );
  const nearestY = Math.min(
    rect.y + rect.height - radius,
    Math.max(rect.y + radius, point.y),
  );
  const deltaX = point.x - nearestX;
  const deltaY = point.y - nearestY;
  return deltaX * deltaX + deltaY * deltaY <= radius * radius + Number.EPSILON;
}

export function fitUv(input: UvFitInput): UvFitResult {
  const { source, fit, rotation } = input;
  assertPositive(source.width, "source.width");
  assertPositive(source.height, "source.height");
  assertPositive(input.surfaceAspect, "surfaceAspect");
  assertPositive(input.scale, "scale");

  const usableSafeRect = safeRect(input.safeArea);
  const rotated = rotation === 90 || rotation === 270;
  const sourceAspect = rotated
    ? source.height / source.width
    : source.width / source.height;
  const targetAspect = input.surfaceAspect;
  const positionX = clampUnit(input.positionX);
  const positionY = clampUnit(input.positionY);

  if (fit === "cover") {
    if (input.scale < 1) {
      throw new Error("cover scale must be at least 1 so the source continues to cover the surface.");
    }
    const baseCropScale = sourceAspect > targetAspect
      ? { x: targetAspect / sourceAspect, y: 1 }
      : { x: 1, y: sourceAspect / targetAspect };
    const cropWindow = {
      x: baseCropScale.x / input.scale,
      y: baseCropScale.y / input.scale,
    };
    const windowOffset = {
      x: (1 - cropWindow.x) * positionX,
      y: (1 - cropWindow.y) * positionY,
    };
    const cropScale = {
      x: cropWindow.x / usableSafeRect.width,
      y: cropWindow.y / usableSafeRect.height,
    };

    return {
      crop: {
        scale: cropScale,
        offset: {
          x: windowOffset.x - usableSafeRect.x * cropScale.x,
          y: windowOffset.y - usableSafeRect.y * cropScale.y,
        },
      },
      content: null,
      rotation: (rotation / 90) * QUARTER_TURN_RADIANS,
      safeRect: usableSafeRect,
    };
  }

  const baseContent = sourceAspect > targetAspect
    ? {
        width: usableSafeRect.width,
        height: usableSafeRect.width / sourceAspect,
      }
    : {
        width: usableSafeRect.height * sourceAspect,
        height: usableSafeRect.height,
      };
  const width = baseContent.width * input.scale;
  const height = baseContent.height * input.scale;

  return {
    crop: null,
    content: {
      scale: { x: width, y: height },
      offset: {
        x: usableSafeRect.x + (usableSafeRect.width - width) * positionX,
        y: usableSafeRect.y + (usableSafeRect.height - height) * positionY,
      },
    },
    rotation: (rotation / 90) * QUARTER_TURN_RADIANS,
    safeRect: usableSafeRect,
  };
}
