import type { JourneyStageId } from "../../data/journey.ts";

export type StageLoadState = "idle" | "loading" | "ready" | "error";
export type StageLoadPriority = "idle" | "normal" | "critical";

export const STAGE_PRELOAD_THRESHOLDS = Object.freeze({
  structure: 0.08,
  prototype: 0.32,
  release: 0.58,
});

export type StagePreloader<T> = {
  ensure(stage: JourneyStageId, priority?: StageLoadPriority): Promise<T>;
  retry(stage: JourneyStageId): Promise<T>;
  evict(stage: JourneyStageId, disposeValue: (value: T) => void): boolean;
  schedule(stage: JourneyStageId): void;
  preloadForProgress(progress: number): void;
  getState(stage: JourneyStageId): StageLoadState;
  get(stage: JourneyStageId): T | undefined;
  subscribe(listener: () => void): () => void;
  dispose(): void;
};

export type StagePreloaderOptions<T> = {
  loadStage(stage: JourneyStageId, priority: StageLoadPriority): Promise<T>;
  scheduleIdle(callback: () => void): void | (() => void);
};

const STAGES: readonly JourneyStageId[] = [
  "observe",
  "structure",
  "prototype",
  "release",
];

export function createStagePreloader<T>({
  loadStage,
  scheduleIdle,
}: StagePreloaderOptions<T>): StagePreloader<T> {
  const states = new Map<JourneyStageId, StageLoadState>(
    STAGES.map((stage) => [stage, "idle"]),
  );
  const values = new Map<JourneyStageId, T>();
  const errors = new Map<JourneyStageId, unknown>();
  const requests = new Map<JourneyStageId, Promise<T>>();
  const listeners = new Set<() => void>();
  const cancelIdleCallbacks = new Set<() => void>();
  let disposed = false;

  const notify = () => {
    for (const listener of listeners) listener();
  };

  function ensure(
    stage: JourneyStageId,
    priority: StageLoadPriority = "normal",
  ): Promise<T> {
    if (disposed) return Promise.reject(new Error("Stage preloader is disposed."));
    const value = values.get(stage);
    if (value) return Promise.resolve(value);
    const request = requests.get(stage);
    if (request) return request;
    if (states.get(stage) === "error") {
      return Promise.reject(errors.get(stage));
    }

    states.set(stage, "loading");
    notify();
    const nextRequest = Promise.resolve()
      .then(() => loadStage(stage, priority))
      .then((result) => {
        if (disposed) throw new Error("Stage preloader was disposed while loading.");
        values.set(stage, result);
        errors.delete(stage);
        states.set(stage, "ready");
        notify();
        return result;
      })
      .catch((error) => {
        errors.set(stage, error);
        states.set(stage, "error");
        notify();
        throw error;
      })
      .finally(() => {
        if (requests.get(stage) === nextRequest) requests.delete(stage);
      });
    requests.set(stage, nextRequest);
    return nextRequest;
  }

  function schedule(stage: JourneyStageId): void {
    if (disposed || states.get(stage) !== "idle") return;
    let cancel: void | (() => void);
    cancel = scheduleIdle(() => {
      if (cancel) cancelIdleCallbacks.delete(cancel);
      void ensure(stage, "idle").catch(() => {
        // Later-stage failure is reflected in state and must not break Observe.
      });
    });
    if (cancel) cancelIdleCallbacks.add(cancel);
  }

  return {
    ensure,
    retry(stage) {
      if (states.get(stage) === "error") {
        states.set(stage, "idle");
        errors.delete(stage);
        notify();
      }
      return ensure(stage, "critical");
    },
    evict(stage, disposeValue) {
      if (requests.has(stage)) return false;
      const value = values.get(stage);
      if (!value) return false;
      values.delete(stage);
      errors.delete(stage);
      states.set(stage, "idle");
      disposeValue(value);
      notify();
      return true;
    },
    schedule,
    preloadForProgress(progress) {
      if (progress >= STAGE_PRELOAD_THRESHOLDS.structure) {
        void ensure("structure", "critical").catch(() => {});
      }
      if (progress >= STAGE_PRELOAD_THRESHOLDS.prototype) {
        void ensure("prototype", "critical").catch(() => {});
      }
      if (progress >= STAGE_PRELOAD_THRESHOLDS.release) {
        void ensure("release", "critical").catch(() => {});
      }
    },
    getState(stage) {
      return states.get(stage) ?? "idle";
    },
    get(stage) {
      return values.get(stage);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const cancel of cancelIdleCallbacks) cancel();
      cancelIdleCallbacks.clear();
      listeners.clear();
    },
  };
}
