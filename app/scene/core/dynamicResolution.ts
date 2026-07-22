export type DynamicResolutionReason =
  | "slow-frames"
  | "fast-frames"
  | "idle-sharp"
  | "test";

export type DynamicResolutionChange = {
  changed: boolean;
  currentDpr: number;
  previousDpr: number;
  reason: DynamicResolutionReason;
  sharpFrame: boolean;
};

export type DynamicResolutionState = {
  currentDpr: number;
  lastActivityAt: number;
  lastChangeAt: number;
  idleRestored: boolean;
};

export type DynamicResolutionController = {
  markActivity(nowMs: number): void;
  recordFrame(frameTimeMs: number, nowMs: number): DynamicResolutionChange | null;
  settleIdle(nowMs: number): DynamicResolutionChange;
  setDpr(
    nextDpr: number,
    reason: DynamicResolutionReason,
    nowMs: number,
  ): DynamicResolutionChange;
  getState(): DynamicResolutionState;
};

export type DynamicResolutionOptions = {
  activeDpr: number;
  idleDpr: number;
  minDpr?: number;
  maxDpr?: number;
  cooldownMs?: number;
  idleDelayMs?: number;
  onChange?: (change: DynamicResolutionChange) => void;
};

const roundTenth = (value: number): number => Math.round(value * 10) / 10;

export function createDynamicResolutionController({
  activeDpr,
  idleDpr,
  minDpr = 1,
  maxDpr = 1.5,
  cooldownMs = 2000,
  idleDelayMs = 220,
  onChange,
}: DynamicResolutionOptions): DynamicResolutionController {
  const clampDpr = (value: number) =>
    roundTenth(Math.max(minDpr, Math.min(maxDpr, value)));
  const activeTarget = clampDpr(activeDpr);
  const idleTarget = clampDpr(idleDpr);
  let currentDpr = activeTarget;
  let lastActivityAt = Number.NEGATIVE_INFINITY;
  let lastChangeAt = Number.NEGATIVE_INFINITY;
  let idleRestored = currentDpr === idleTarget;
  let slowFrames: number[] = [];
  let fastFrames: number[] = [];

  function result(
    changed: boolean,
    previousDpr: number,
    reason: DynamicResolutionReason,
    sharpFrame = false,
  ): DynamicResolutionChange {
    return { changed, currentDpr, previousDpr, reason, sharpFrame };
  }

  function setDpr(
    nextDpr: number,
    reason: DynamicResolutionReason,
    nowMs: number,
  ): DynamicResolutionChange {
    const previousDpr = currentDpr;
    currentDpr = clampDpr(nextDpr);
    const changed = currentDpr !== previousDpr;
    if (changed) {
      lastChangeAt = nowMs;
      const change = result(true, previousDpr, reason, reason === "idle-sharp");
      onChange?.(change);
      return change;
    }
    return result(false, previousDpr, reason, false);
  }

  return {
    markActivity(nowMs) {
      lastActivityAt = nowMs;
      idleRestored = false;
    },
    recordFrame(frameTimeMs, nowMs) {
      if (!Number.isFinite(frameTimeMs) || frameTimeMs <= 0) return null;
      if (frameTimeMs > 24) {
        slowFrames.push(frameTimeMs);
        fastFrames = [];
        if (slowFrames.length < 60) return null;
        const mean = slowFrames.reduce((sum, value) => sum + value, 0) / slowFrames.length;
        slowFrames = [];
        if (mean > 24 && currentDpr > minDpr) {
          return setDpr(currentDpr - 0.1, "slow-frames", nowMs);
        }
        return null;
      }
      if (frameTimeMs < 15) {
        fastFrames.push(frameTimeMs);
        slowFrames = [];
        if (fastFrames.length < 120) return null;
        if (nowMs - lastChangeAt < cooldownMs) {
          fastFrames = fastFrames.slice(-120);
          return null;
        }
        fastFrames = [];
        if (currentDpr < activeTarget) {
          return setDpr(currentDpr + 0.1, "fast-frames", nowMs);
        }
        return null;
      }
      slowFrames = [];
      fastFrames = [];
      return null;
    },
    settleIdle(nowMs) {
      const previousDpr = currentDpr;
      if (idleRestored || nowMs - lastActivityAt < idleDelayMs) {
        return result(false, previousDpr, "idle-sharp", false);
      }
      idleRestored = true;
      const change = setDpr(idleTarget, "idle-sharp", nowMs);
      return { ...change, sharpFrame: true };
    },
    setDpr,
    getState() {
      return { currentDpr, lastActivityAt, lastChangeAt, idleRestored };
    },
  };
}
