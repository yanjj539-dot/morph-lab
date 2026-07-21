"use client";

import { useEffect, useRef } from "react";

import {
  navigationDelayForMotion,
  PAGE_TRANSITION_BOOT_SCRIPT,
  PAGE_TRANSITION_ENTERING_CLASS,
  PAGE_TRANSITION_INCOMING_CLASS,
  PAGE_TRANSITION_IN_MS,
  PAGE_TRANSITION_LEAVING_CLASS,
  PAGE_TRANSITION_REDUCED_MS,
  PAGE_TRANSITION_SESSION_KEY,
  PAGE_TRANSITION_STATE_CLASSES,
  parsePageTransitionMarker,
  shouldInterceptPageTransition,
} from "../lib/pageTransitionPolicy";

function storeIncomingMarker(destination: URL): void {
  try {
    sessionStorage.setItem(
      PAGE_TRANSITION_SESSION_KEY,
      JSON.stringify({ href: destination.href, createdAt: Date.now() }),
    );
  } catch {
    // Native navigation still proceeds when storage is unavailable.
  }
}

function clearIncomingMarker(): void {
  try {
    sessionStorage.removeItem(PAGE_TRANSITION_SESSION_KEY);
  } catch {
    // Storage can be unavailable in hardened browsing modes.
  }
}

function readValidIncomingMarker(): boolean {
  try {
    const marker = parsePageTransitionMarker(
      sessionStorage.getItem(PAGE_TRANSITION_SESSION_KEY),
      window.location.href,
      Date.now(),
    );
    if (marker) return true;
    clearIncomingMarker();
    return false;
  } catch {
    clearIncomingMarker();
    return false;
  }
}

export function PageTransitionLayer() {
  const timersRef = useRef<Set<number>>(new Set());
  const framesRef = useRef<Set<number>>(new Set());
  const navigatingRef = useRef(false);

  useEffect(() => {
    const root = document.documentElement;

    const scheduleTimer = (callback: () => void, delay: number) => {
      const timer = window.setTimeout(() => {
        timersRef.current.delete(timer);
        callback();
      }, delay);
      timersRef.current.add(timer);
      return timer;
    };

    const scheduleFrame = (callback: () => void) => {
      const frame = window.requestAnimationFrame(() => {
        framesRef.current.delete(frame);
        callback();
      });
      framesRef.current.add(frame);
      return frame;
    };

    const clearTransitionState = () => {
      for (const timer of timersRef.current) window.clearTimeout(timer);
      timersRef.current.clear();
      for (const frame of framesRef.current) window.cancelAnimationFrame(frame);
      framesRef.current.clear();
      root.classList.remove(...PAGE_TRANSITION_STATE_CLASSES);
      delete root.dataset.pageTransitionState;
      navigatingRef.current = false;
    };

    const prefersReducedMotion = () =>
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const revealIncomingPage = () => {
      if (
        !root.classList.contains(PAGE_TRANSITION_INCOMING_CLASS) ||
        !readValidIncomingMarker()
      ) {
        clearTransitionState();
        return;
      }

      clearIncomingMarker();
      root.dataset.pageTransitionState = "incoming";
      const revealDuration = prefersReducedMotion()
        ? PAGE_TRANSITION_REDUCED_MS
        : PAGE_TRANSITION_IN_MS;

      scheduleFrame(() => {
        scheduleFrame(() => {
          root.classList.remove(PAGE_TRANSITION_INCOMING_CLASS);
          root.classList.add(PAGE_TRANSITION_ENTERING_CLASS);
          root.dataset.pageTransitionState = "entering";
          scheduleTimer(clearTransitionState, revealDuration);
        });
      });
    };

    const handleClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      const anchor = event.target.closest<HTMLAnchorElement>("a[href]");
      if (!anchor) return;

      const destination = new URL(anchor.href, window.location.href);
      const shouldIntercept = shouldInterceptPageTransition({
        currentHref: window.location.href,
        targetHref: destination.href,
        button: event.button,
        detail: event.detail,
        defaultPrevented: event.defaultPrevented,
        metaKey: event.metaKey,
        ctrlKey: event.ctrlKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
        target: anchor.target,
        download: anchor.hasAttribute("download"),
      });
      if (!shouldIntercept) return;

      event.preventDefault();
      if (navigatingRef.current) return;
      navigatingRef.current = true;
      storeIncomingMarker(destination);
      root.classList.remove(PAGE_TRANSITION_INCOMING_CLASS, PAGE_TRANSITION_ENTERING_CLASS);
      root.classList.add(PAGE_TRANSITION_LEAVING_CLASS);
      root.dataset.pageTransitionState = "leaving";

      const delay = navigationDelayForMotion(prefersReducedMotion());
      scheduleTimer(() => window.location.assign(destination.href), delay);
      scheduleTimer(() => {
        clearIncomingMarker();
        clearTransitionState();
      }, Math.max(2400, delay + 1800));
    };

    const handlePageShow = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      clearIncomingMarker();
      clearTransitionState();
    };

    revealIncomingPage();
    document.addEventListener("click", handleClick, true);
    window.addEventListener("pageshow", handlePageShow);

    return () => {
      document.removeEventListener("click", handleClick, true);
      window.removeEventListener("pageshow", handlePageShow);
      clearTransitionState();
    };
  }, []);

  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: PAGE_TRANSITION_BOOT_SCRIPT }} />
      <div className="page-transition-layer" aria-hidden="true">
        <span className="page-transition-layer__mark">MORPH//LAB</span>
        <span className="page-transition-layer__line" />
      </div>
    </>
  );
}
