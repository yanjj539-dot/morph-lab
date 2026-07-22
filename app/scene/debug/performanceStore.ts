export type PerformanceSourceName = "hero" | "journey" | "browser";

export type PerformanceSource = {
  schedulerState?: string;
  fps?: number;
  onePercentLow?: number;
  averageFrameTime?: number;
  longTasks?: number;
  drawCalls?: number;
  triangles?: number;
  geometries?: number;
  textures?: number;
  programs?: number;
  dpr?: number;
  currentStage?: string;
  loadedStages?: string[];
  stageStates?: Record<string, string>;
  activeCanvasCount?: number;
  gpuRenderer?: string;
  webglVersion?: string;
  maxAnisotropy?: number;
  deviceMemory?: number;
  hardwareConcurrency?: number;
};

export type PerformanceSnapshot = {
  version: number;
  updatedAt: number;
  sources: Partial<Record<PerformanceSourceName, PerformanceSource>>;
};

export type PerformanceStore = {
  update(source: PerformanceSourceName, patch: PerformanceSource): void;
  remove(source: PerformanceSourceName): void;
  subscribe(listener: () => void): () => void;
  getSnapshot(): PerformanceSnapshot;
};

export type FrameMetrics = {
  sampleCount: number;
  averageFrameTime: number;
  fps: number;
  onePercentLow: number;
};

const round2 = (value: number): number => Math.round(value * 100) / 100;

export function calculateFrameMetrics(
  frameTimes: readonly number[],
): FrameMetrics {
  const samples = frameTimes.filter(
    (value) => Number.isFinite(value) && value > 0,
  );
  if (samples.length === 0) {
    return {
      sampleCount: 0,
      averageFrameTime: 0,
      fps: 0,
      onePercentLow: 0,
    };
  }
  const averageFrameTime =
    samples.reduce((sum, value) => sum + value, 0) / samples.length;
  const worstFrameCount = Math.max(1, Math.ceil(samples.length * 0.01));
  const worstAverage = [...samples]
    .sort((a, b) => b - a)
    .slice(0, worstFrameCount)
    .reduce((sum, value) => sum + value, 0) / worstFrameCount;
  return {
    sampleCount: samples.length,
    averageFrameTime: round2(averageFrameTime),
    fps: round2(1000 / averageFrameTime),
    onePercentLow: round2(1000 / worstAverage),
  };
}

export function createPerformanceStore(): PerformanceStore {
  const listeners = new Set<() => void>();
  let snapshot: PerformanceSnapshot = {
    version: 0,
    updatedAt: 0,
    sources: {},
  };

  function notify(): void {
    for (const listener of listeners) listener();
  }

  return {
    update(source, patch) {
      snapshot = {
        version: snapshot.version + 1,
        updatedAt: Date.now(),
        sources: {
          ...snapshot.sources,
          [source]: {
            ...snapshot.sources[source],
            ...patch,
          },
        },
      };
      notify();
    },
    remove(source) {
      if (!snapshot.sources[source]) return;
      const sources = { ...snapshot.sources };
      delete sources[source];
      snapshot = {
        version: snapshot.version + 1,
        updatedAt: Date.now(),
        sources,
      };
      notify();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot() {
      return snapshot;
    },
  };
}

export const round5PerformanceStore = createPerformanceStore();
