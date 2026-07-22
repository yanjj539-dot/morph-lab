export type RenderSchedulerStatus = "sleeping" | "scheduled" | "rendering" | "disposed";

export type RenderSchedulerState = {
  status: RenderSchedulerStatus;
  frameCount: number;
  lastReason: string | null;
  transientUntil: number;
};

export type RenderScheduler = {
  invalidate(reason?: string): void;
  startTransient(durationMs: number, reason?: string): void;
  stop(): void;
  dispose(): void;
  getState(): RenderSchedulerState;
};

export type RenderSchedulerOptions = {
  render(time: number): void;
  isVisible(): boolean;
  requestFrame(callback: FrameRequestCallback): number;
  cancelFrame(id: number): void;
  now?: () => number;
  stableFrames?: number;
  onStateChange?: (state: RenderSchedulerState) => void;
};

export function createRenderScheduler({
  render,
  isVisible,
  requestFrame,
  cancelFrame,
  now = () => performance.now(),
  stableFrames = 8,
  onStateChange,
}: RenderSchedulerOptions): RenderScheduler {
  const settleFrameCount = Math.max(0, Math.floor(stableFrames));
  let status: RenderSchedulerStatus = "sleeping";
  let frameId = 0;
  let frameCount = 0;
  let lastReason: string | null = null;
  let transientUntil = Number.NEGATIVE_INFINITY;
  let settleFramesRemaining = 0;
  let disposed = false;

  function snapshot(): RenderSchedulerState {
    return { status, frameCount, lastReason, transientUntil };
  }

  function setStatus(nextStatus: RenderSchedulerStatus): void {
    if (status === nextStatus) return;
    status = nextStatus;
    onStateChange?.(snapshot());
  }

  function cancelScheduledFrame(): void {
    if (!frameId) return;
    cancelFrame(frameId);
    frameId = 0;
  }

  function schedule(): void {
    if (disposed || frameId || !isVisible()) {
      if (!disposed && !frameId) setStatus("sleeping");
      return;
    }
    setStatus("scheduled");
    frameId = requestFrame(runFrame);
  }

  function runFrame(time: number): void {
    frameId = 0;
    if (disposed || !isVisible()) {
      setStatus(disposed ? "disposed" : "sleeping");
      return;
    }

    setStatus("rendering");
    render(time);
    frameCount += 1;

    if (time < transientUntil) {
      schedule();
      return;
    }
    if (settleFramesRemaining > 0) {
      settleFramesRemaining -= 1;
      if (settleFramesRemaining > 0) {
        schedule();
        return;
      }
    }
    setStatus("sleeping");
  }

  return {
    invalidate(reason = "invalidate") {
      if (disposed) return;
      lastReason = reason;
      schedule();
    },
    startTransient(durationMs, reason = "transient") {
      if (disposed) return;
      lastReason = reason;
      transientUntil = Math.max(transientUntil, now() + Math.max(0, durationMs));
      settleFramesRemaining = settleFrameCount;
      schedule();
    },
    stop() {
      if (disposed) return;
      cancelScheduledFrame();
      transientUntil = Number.NEGATIVE_INFINITY;
      settleFramesRemaining = 0;
      setStatus("sleeping");
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      cancelScheduledFrame();
      transientUntil = Number.NEGATIVE_INFINITY;
      settleFramesRemaining = 0;
      setStatus("disposed");
    },
    getState() {
      return snapshot();
    },
  };
}
