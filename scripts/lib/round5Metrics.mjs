function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function percentileLowFps(frameTimes, fraction = 0.01) {
  if (frameTimes.length === 0) return 0;
  const slowestFirst = [...frameTimes].sort((a, b) => b - a);
  const sampleCount = Math.max(1, Math.ceil(slowestFirst.length * fraction));
  const slowSample = slowestFirst.slice(0, sampleCount);
  const averageSlowFrame =
    slowSample.reduce((sum, frameTime) => sum + frameTime, 0) / sampleCount;
  return averageSlowFrame > 0 ? round(1000 / averageSlowFrame) : 0;
}

export function summarizeFrameSamples(samples) {
  const frameTimes = samples.filter(
    (sample) => Number.isFinite(sample) && sample > 0,
  );
  if (frameTimes.length === 0) {
    return {
      sampleCount: 0,
      averageFrameTimeMs: 0,
      averageFps: 0,
      onePercentLowFps: 0,
      longFrameCount: 0,
      consecutiveBelow25Fps: 0,
    };
  }

  const averageFrameTimeMs =
    frameTimes.reduce((sum, frameTime) => sum + frameTime, 0) /
    frameTimes.length;
  let currentBelow25 = 0;
  let consecutiveBelow25Fps = 0;
  for (const frameTime of frameTimes) {
    if (frameTime > 40) {
      currentBelow25 += 1;
      consecutiveBelow25Fps = Math.max(consecutiveBelow25Fps, currentBelow25);
    } else {
      currentBelow25 = 0;
    }
  }

  return {
    sampleCount: frameTimes.length,
    averageFrameTimeMs: round(averageFrameTimeMs),
    averageFps: round(1000 / averageFrameTimeMs),
    onePercentLowFps: percentileLowFps(frameTimes),
    longFrameCount: frameTimes.filter((frameTime) => frameTime > 50).length,
    consecutiveBelow25Fps,
  };
}
