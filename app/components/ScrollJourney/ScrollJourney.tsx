"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ScrollTrigger as ScrollTriggerInstance } from "gsap/ScrollTrigger";

import {
  JOURNEY_STAGE_PROGRESS,
  JOURNEY_STAGES,
} from "../../data/journey";
import type { JourneySceneController } from "../../scene/createJourneyScene";
import { JourneyFallback, type JourneyState } from "./JourneyFallback";
import { JourneyLabels } from "./JourneyLabels";
import { JourneyProgress } from "./JourneyProgress";
import { JourneyUI } from "./JourneyUI";

function canUseWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    const context =
      canvas.getContext("webgl2") ??
      canvas.getContext("webgl") ??
      canvas.getContext("experimental-webgl");

    if (!context) return false;
    (context as WebGLRenderingContext)
      .getExtension("WEBGL_lose_context")
      ?.loseContext();
    return true;
  } catch {
    return false;
  }
}

export default function ScrollJourney() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const pinRef = useRef<HTMLDivElement | null>(null);
  const canvasHostRef = useRef<HTMLDivElement | null>(null);
  const labelHostRef = useRef<HTMLDivElement | null>(null);
  const sceneControllerRef = useRef<JourneySceneController | null>(null);
  const scrollTriggerRef = useRef<ScrollTriggerInstance | null>(null);
  const [activeStage, setActiveStage] = useState(0);
  const [journeyState, setJourneyState] = useState<JourneyState>("loading");

  const selectStage = useCallback((index: number) => {
    const safeIndex = Math.max(0, Math.min(JOURNEY_STAGES.length - 1, index));
    const controller = sceneControllerRef.current;
    const trigger = scrollTriggerRef.current;

    setActiveStage(safeIndex);

    if (controller && trigger) {
      const progress = JOURNEY_STAGE_PROGRESS[safeIndex];
      const scrollTop = trigger.start + (trigger.end - trigger.start) * progress;
      controller.scrollToStage(safeIndex);
      window.scrollTo({ top: scrollTop, behavior: "smooth" });
      return;
    }

    document
      .getElementById(`journey-stage-${JOURNEY_STAGES[safeIndex].id}`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  useEffect(() => {
    const section = sectionRef.current;
    const pin = pinRef.current;
    const canvasHost = canvasHostRef.current;
    const labelHost = labelHostRef.current;

    if (!section || !pin || !canvasHost || !labelHost) return;

    const desktopQuery = window.matchMedia("(min-width: 1024px)");
    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let abortController: AbortController | null = null;
    let fallbackObserver: IntersectionObserver | null = null;
    let generation = 0;
    let disposed = false;

    const setStageBoundary = (index: number) => {
      if (disposed) return;
      setActiveStage((current) => (current === index ? current : index));
    };

    const observeFallbackStages = () => {
      fallbackObserver?.disconnect();

      const stages = Array.from(
        section.querySelectorAll<HTMLElement>("[data-journey-fallback-stage]"),
      );
      if (!("IntersectionObserver" in window) || stages.length === 0) return;

      fallbackObserver = new IntersectionObserver(
        (entries) => {
          const visible = entries
            .filter((entry) => entry.isIntersecting)
            .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
          if (!visible) return;

          const index = Number(
            (visible.target as HTMLElement).dataset.journeyFallbackStage,
          );
          if (Number.isInteger(index)) setStageBoundary(index);
        },
        { rootMargin: "-24% 0px -54%", threshold: [0.15, 0.35, 0.6] },
      );

      stages.forEach((stage) => fallbackObserver?.observe(stage));
    };

    const cleanupExperience = () => {
      abortController?.abort();
      abortController = null;
      fallbackObserver?.disconnect();
      fallbackObserver = null;
      scrollTriggerRef.current?.kill();
      scrollTriggerRef.current = null;
      sceneControllerRef.current?.dispose();
      sceneControllerRef.current = null;
      canvasHost.replaceChildren();
      labelHost.replaceChildren();
    };

    const initializeExperience = async () => {
      const currentGeneration = ++generation;
      cleanupExperience();
      setStageBoundary(0);

      const shouldLoadScene =
        desktopQuery.matches &&
        !reducedMotionQuery.matches &&
        canUseWebGL();

      if (!shouldLoadScene) {
        setJourneyState("fallback");
        observeFallbackStages();
        return;
      }

      setJourneyState("loading");
      abortController = new AbortController();
      const { signal } = abortController;

      try {
        const [{ gsap }, { ScrollTrigger }, { createJourneyScene }] =
          await Promise.all([
            import("gsap"),
            import("gsap/ScrollTrigger"),
            import("../../scene/createJourneyScene"),
          ]);

        if (disposed || signal.aborted || currentGeneration !== generation) return;

        gsap.registerPlugin(ScrollTrigger);
        let sceneReportedReady = false;
        const controller = await createJourneyScene({
          canvasHost,
          labelHost,
          signal,
          onStageChange: setStageBoundary,
          onReady() {
            sceneReportedReady = true;
          },
          onError() {
            if (currentGeneration === generation && !disposed) {
              setJourneyState("error");
            }
          },
        });

        if (disposed || signal.aborted || currentGeneration !== generation) {
          controller.dispose();
          return;
        }

        sceneControllerRef.current = controller;
        const trigger = ScrollTrigger.create({
          id: "round-2-journey",
          trigger: section,
          start: "top top",
          end: "+=420%",
          pin,
          scrub: true,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          onUpdate(self) {
            controller.setProgress(self.progress);
          },
          onRefresh(self) {
            controller.setProgress(self.progress);
          },
        });

        scrollTriggerRef.current = trigger;
        controller.setProgress(trigger.progress);
        if (sceneReportedReady) setJourneyState("ready");
      } catch {
        if (disposed || signal.aborted || currentGeneration !== generation) return;
        setJourneyState("error");
        canvasHost.replaceChildren();
        labelHost.replaceChildren();
        observeFallbackStages();
      }
    };

    const handleModeChange = () => {
      void initializeExperience();
    };

    void initializeExperience();
    desktopQuery.addEventListener("change", handleModeChange);
    reducedMotionQuery.addEventListener("change", handleModeChange);

    return () => {
      disposed = true;
      generation += 1;
      desktopQuery.removeEventListener("change", handleModeChange);
      reducedMotionQuery.removeEventListener("change", handleModeChange);
      cleanupExperience();
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      id="process"
      className="scroll-journey"
      data-state={journeyState}
      aria-labelledby="journey-title"
    >
      <div ref={pinRef} className="scroll-journey__pin">
        <JourneyUI activeStage={activeStage} state={journeyState} />
        <JourneyProgress
          activeStage={activeStage}
          onSelectStage={selectStage}
        />

        <div className="scroll-journey__scene">
          <div ref={canvasHostRef} className="scroll-journey__canvas" aria-hidden="true" />
          <JourneyLabels labelHostRef={labelHostRef} />
          <JourneyFallback state={journeyState} />
        </div>
      </div>
    </section>
  );
}
