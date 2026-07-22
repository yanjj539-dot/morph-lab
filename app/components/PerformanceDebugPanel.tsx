"use client";

import { useEffect, useMemo, useState } from "react";

import {
  calculateFrameMetrics,
  round5PerformanceStore,
  type PerformanceSnapshot,
} from "../scene/debug/performanceStore.ts";

function formatNumber(value: number | undefined, suffix = ""): string {
  return value === undefined ? "—" : `${value.toLocaleString()}${suffix}`;
}

export function PerformanceDebugPanel() {
  const [enabled, setEnabled] = useState(false);
  const [snapshot, setSnapshot] = useState<PerformanceSnapshot>(() =>
    round5PerformanceStore.getSnapshot(),
  );

  useEffect(() => {
    const active = new URLSearchParams(window.location.search).get("debugPerformance") === "1";
    if (!active) return;
    const activationFrame = window.requestAnimationFrame(() => setEnabled(true));

    const unsubscribe = round5PerformanceStore.subscribe(() => {
      setSnapshot(round5PerformanceStore.getSnapshot());
    });
    const frameTimes: number[] = [];
    let previousFrame = 0;
    let lastPublish = 0;
    let frameId = 0;
    let longTasks = 0;
    const navigatorWithMemory = navigator as Navigator & { deviceMemory?: number };
    const observer =
      typeof PerformanceObserver === "undefined"
        ? null
        : new PerformanceObserver((list) => {
            longTasks += list.getEntries().length;
          });
    try {
      observer?.observe({ type: "longtask", buffered: true });
    } catch {
      // Older engines may not implement Long Tasks.
    }

    const sample = (time: number) => {
      if (previousFrame > 0) {
        frameTimes.push(Math.min(250, Math.max(0.1, time - previousFrame)));
        if (frameTimes.length > 600) frameTimes.shift();
      }
      previousFrame = time;
      if (time - lastPublish >= 500) {
        lastPublish = time;
        const metrics = calculateFrameMetrics(frameTimes);
        round5PerformanceStore.update("browser", {
          ...metrics,
          longTasks,
          activeCanvasCount: document.querySelectorAll("canvas").length,
          deviceMemory: navigatorWithMemory.deviceMemory,
          hardwareConcurrency: navigator.hardwareConcurrency,
        });
      }
      frameId = window.requestAnimationFrame(sample);
    };
    frameId = window.requestAnimationFrame(sample);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.cancelAnimationFrame(activationFrame);
      observer?.disconnect();
      unsubscribe();
      round5PerformanceStore.remove("browser");
    };
  }, []);

  const rows = useMemo(() => {
    const browser = snapshot.sources.browser;
    const hero = snapshot.sources.hero;
    const journey = snapshot.sources.journey;
    return [
      ["FPS / 1% LOW", `${formatNumber(browser?.fps)} / ${formatNumber(browser?.onePercentLow)}`],
      ["FRAME TIME", formatNumber(browser?.averageFrameTime, " ms")],
      ["LONG TASKS", formatNumber(browser?.longTasks)],
      ["DRAW CALLS", formatNumber(journey?.drawCalls ?? hero?.drawCalls)],
      ["TRIANGLES", formatNumber(journey?.triangles ?? hero?.triangles)],
      ["GEO / TEX / PROG", `${formatNumber(journey?.geometries)} / ${formatNumber(journey?.textures)} / ${formatNumber(journey?.programs)}`],
      ["DPR", formatNumber(journey?.dpr ?? hero?.dpr)],
      ["STAGE", journey?.currentStage ?? "—"],
      ["LOADED", journey?.loadedStages?.join(" · ") ?? "—"],
      ["CANVASES", formatNumber(browser?.activeCanvasCount ?? journey?.activeCanvasCount)],
      ["HERO RAF", hero?.schedulerState ?? "fallback"],
      ["JOURNEY RAF", journey?.schedulerState ?? "fallback"],
      ["GPU", journey?.gpuRenderer ?? hero?.gpuRenderer ?? "—"],
      ["WEBGL / ANISO", `${journey?.webglVersion ?? hero?.webglVersion ?? "—"} / ${formatNumber(journey?.maxAnisotropy ?? hero?.maxAnisotropy)}`],
      ["MEM / THREADS", `${formatNumber(browser?.deviceMemory, " GB")} / ${formatNumber(browser?.hardwareConcurrency)}`],
    ] as const;
  }, [snapshot]);

  if (!enabled) return null;

  return (
    <aside className="performance-debug" data-performance-debug aria-label="WebGL performance telemetry">
      <header>
        <span>ROUND 5 / LIVE</span>
        <span>PERFORMANCE</span>
      </header>
      <dl>
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}
