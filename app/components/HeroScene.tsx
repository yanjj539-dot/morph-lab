"use client";

/* The authored fallback remains the semantic/LCP image for every mode. */
import { useEffect, useRef, useState, type PointerEvent } from "react";

type HeroSceneState = "fallback" | "loading" | "ready" | "error";

type HeroController = {
  setPointer(x: number, y: number): void;
  setExitProgress(progress: number): void;
  pulse(): void;
  dispose(): void;
};

type HeroSceneProps = {
  fallbackSrc: string;
  mobileFallbackSrc?: string;
  fallbackAlt: string;
};

const DESKTOP_QUERY = "(min-width: 1024px)";
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function canUseWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    if (!context) return false;
    context.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}

export function HeroScene({
  fallbackSrc,
  mobileFallbackSrc,
  fallbackAlt,
}: HeroSceneProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const canvasHostRef = useRef<HTMLDivElement | null>(null);
  const controllerRef = useRef<HeroController | null>(null);
  const [state, setState] = useState<HeroSceneState>("fallback");

  useEffect(() => {
    const canvasHost = canvasHostRef.current;
    if (!canvasHost) return;

    const desktopQuery = window.matchMedia(DESKTOP_QUERY);
    const reducedMotionQuery = window.matchMedia(REDUCED_MOTION_QUERY);
    let abortController: AbortController | null = null;
    let disposed = false;
    let generation = 0;
    let started = false;

    const intentEvents = ["pointermove", "keydown", "scroll", "touchstart"] as const;

    const updateExitProgress = () => {
      const hero = rootRef.current?.closest<HTMLElement>(".hero");
      if (!hero) return;
      const bounds = hero.getBoundingClientRect();
      const travel = Math.max(1, bounds.height * 0.82);
      const progress = Math.max(0, Math.min(1, -bounds.top / travel));
      controllerRef.current?.setExitProgress(progress);
    };

    const removeIntentListeners = () => {
      for (const eventName of intentEvents) {
        window.removeEventListener(eventName, startFromIntent);
      }
    };

    const cleanupScene = () => {
      abortController?.abort();
      abortController = null;
      controllerRef.current?.dispose();
      controllerRef.current = null;
      canvasHost.replaceChildren();
    };

    const startScene = async () => {
      if (started || disposed) return;
      const isDesktop = desktopQuery.matches;
      const prefersReducedMotion = reducedMotionQuery.matches;
      if (!isDesktop || prefersReducedMotion || !canUseWebGL()) {
        setState("fallback");
        return;
      }

      started = true;
      removeIntentListeners();
      const currentGeneration = ++generation;
      abortController = new AbortController();
      const { signal } = abortController;
      setState("loading");

      try {
        const { createHeroScene } = await import("../scene/createHeroScene");
        if (disposed || signal.aborted || currentGeneration !== generation) return;
        const controller = await createHeroScene({
          canvasHost,
          signal,
          onReady() {
            if (!disposed && currentGeneration === generation) setState("ready");
          },
          onError() {
            if (!disposed && currentGeneration === generation) setState("error");
          },
        });
        if (disposed || signal.aborted || currentGeneration !== generation) {
          controller.dispose();
          return;
        }
        controllerRef.current = controller;
        updateExitProgress();
      } catch {
        if (!disposed && !signal.aborted && currentGeneration === generation) {
          setState("error");
        }
      }
    };

    function startFromIntent() {
      void startScene();
    }

    const configureMode = () => {
      generation += 1;
      started = false;
      removeIntentListeners();
      cleanupScene();
      const isDesktop = desktopQuery.matches;
      const prefersReducedMotion = reducedMotionQuery.matches;
      if (!isDesktop || prefersReducedMotion) {
        setState("fallback");
        return;
      }

      const search = new URLSearchParams(window.location.search);
      if (search.get("qaHero") === "1") {
        void startScene();
        return;
      }

      setState("fallback");
      for (const eventName of intentEvents) {
        window.addEventListener(eventName, startFromIntent, {
          once: true,
          passive: true,
        });
      }
    };

    const handlePulse = (event: globalThis.PointerEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest("[data-hero-observe-pulse]")) {
        controllerRef.current?.pulse();
      }
    };

    configureMode();
    desktopQuery.addEventListener("change", configureMode);
    reducedMotionQuery.addEventListener("change", configureMode);
    document.addEventListener("pointerover", handlePulse, true);
    window.addEventListener("scroll", updateExitProgress, { passive: true });
    window.addEventListener("resize", updateExitProgress, { passive: true });

    return () => {
      disposed = true;
      generation += 1;
      removeIntentListeners();
      desktopQuery.removeEventListener("change", configureMode);
      reducedMotionQuery.removeEventListener("change", configureMode);
      document.removeEventListener("pointerover", handlePulse, true);
      window.removeEventListener("scroll", updateExitProgress);
      window.removeEventListener("resize", updateExitProgress);
      cleanupScene();
    };
  }, []);

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) return;
    const x = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2;
    const y = ((event.clientY - bounds.top) / bounds.height - 0.5) * 2;
    controllerRef.current?.setPointer(x, y);
  };

  return (
    <div
      ref={rootRef}
      className="hero-scene"
      data-state={state}
      data-hero-scene
      onPointerMove={handlePointerMove}
      onPointerLeave={() => controllerRef.current?.setPointer(0, 0)}
    >
      <figure className="hero-art" data-motion-reveal>
        <picture className="hero-scene__fallback">
          {mobileFallbackSrc ? (
            <source
              media="(max-width: 1023px), (prefers-reduced-motion: reduce)"
              srcSet={mobileFallbackSrc}
            />
          ) : null}
          <img
            className="hero-scene__fallback-image"
            src={fallbackSrc}
            alt={fallbackAlt}
            width={1600}
            height={1000}
            loading="eager"
            fetchPriority="high"
          />
        </picture>
        <div ref={canvasHostRef} className="hero-scene__canvas" aria-hidden="true" />
        <figcaption>
          <span>SCENE 01 / OBSERVE</span>
          <span>{state === "ready" ? "LIVE MODEL / POINTER 1.5°" : "AUTHORED FALLBACK / ZERO SHIFT"}</span>
        </figcaption>
      </figure>
      <span className="sr-only" role="status" aria-live="polite">
        {state === "ready" ? "Observe 3D scene ready" : "Observe scene plate"}
      </span>
    </div>
  );
}
