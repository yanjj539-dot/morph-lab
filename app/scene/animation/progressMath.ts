export function clamp01(value: number): number {
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

export function smoothstep(value: number): number {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}

export function rangeProgress(start: number, end: number, progress: number): number {
  if (start === end) {
    return progress >= end ? 1 : 0;
  }

  return smoothstep((progress - start) / (end - start));
}

export function lerp(from: number, to: number, progress: number): number {
  return from + (to - from) * progress;
}

export function stageIndexForProgress(progress: number): number {
  const t = clamp01(progress);

  if (t < 0.25) return 0;
  if (t < 0.5) return 1;
  if (t < 0.75) return 2;
  return 3;
}
