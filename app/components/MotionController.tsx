"use client";

import { useEffect } from "react";

const DESKTOP_QUERY = "(min-width: 768px)";
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

export function MotionController() {
  useEffect(() => {
    const desktopQuery = window.matchMedia(DESKTOP_QUERY);
    const reducedMotionQuery = window.matchMedia(REDUCED_MOTION_QUERY);
    const isDesktop = desktopQuery.matches;
    const prefersReducedMotion = reducedMotionQuery.matches;
    let cancelled = false;
    let teardown: (() => void) | undefined;

    const initializeMotion = async () => {
      const [gsapModule, scrollTriggerModule, lenisModule] = await Promise.all([
        import("gsap"),
        import("gsap/ScrollTrigger"),
        isDesktop && !prefersReducedMotion
          ? import("lenis")
          : Promise.resolve(null),
      ]);

      if (cancelled) {
        return;
      }

      const gsap = gsapModule.default;
      const { ScrollTrigger } = scrollTriggerModule;
      const Lenis = lenisModule?.default;
      let animationFrameId = 0;
      let lenis: import("lenis").default | null = null;

      gsap.registerPlugin(ScrollTrigger);

      const context = gsap.context(() => {
        if (prefersReducedMotion) {
          gsap.set(
            [
              "[data-motion-reveal]",
              ".motion-reveal",
              "[data-project-image]",
            ],
            { clearProps: "all" },
          );
          document.documentElement.classList.add("motion-reduced");
          return;
        }

        document.documentElement.classList.remove("motion-reduced");

        if (isDesktop && Lenis) {
          lenis = new Lenis({
            lerp: 0.08,
            smoothWheel: true,
            syncTouch: false,
            wheelMultiplier: 0.9,
          });

          lenis.on("scroll", ScrollTrigger.update);

          const raf = (time: number) => {
            lenis?.raf(time);
            animationFrameId = window.requestAnimationFrame(raf);
          };

          animationFrameId = window.requestAnimationFrame(raf);
        }

        gsap.utils
          .toArray<HTMLElement>("[data-motion-reveal], .motion-reveal")
          .forEach((element) => {
            const distance = Number(element.dataset.motionY ?? 24);
            const y = Number.isFinite(distance)
              ? Math.min(30, Math.max(20, distance))
              : 24;

            gsap.fromTo(
              element,
              { autoAlpha: 0, y },
              {
                autoAlpha: 1,
                y: 0,
                duration: 0.8,
                ease: "power2.out",
                scrollTrigger: {
                  trigger: element,
                  start: "top 86%",
                  once: true,
                },
              },
            );
          });

        if (isDesktop) {
          gsap.utils
            .toArray<HTMLElement>("[data-project-image]")
            .forEach((image) => {
              const rawZoom = Number(image.dataset.projectZoom ?? 1.045);
              const zoom = Number.isFinite(rawZoom)
                ? Math.min(1.06, Math.max(1.03, rawZoom))
                : 1.045;

              gsap.fromTo(
                image,
                { scale: 1 },
                {
                  scale: zoom,
                  ease: "none",
                  scrollTrigger: {
                    trigger: image,
                    start: "top bottom",
                    end: "bottom top",
                    scrub: 0.8,
                  },
                },
              );
            });
        }
      });

      const refresh = () => ScrollTrigger.refresh();
      window.addEventListener("load", refresh, { once: true });

      teardown = () => {
        window.removeEventListener("load", refresh);
        if (animationFrameId) {
          window.cancelAnimationFrame(animationFrameId);
        }
        lenis?.destroy();
        lenis = null;
        context.revert();
        ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
        document.documentElement.classList.remove("motion-reduced");
      };
    };

    void initializeMotion();

    return () => {
      cancelled = true;
      teardown?.();
      teardown = undefined;
    };
  }, []);

  return null;
}
