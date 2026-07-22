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

    if (!isDesktop || prefersReducedMotion) {
      if (prefersReducedMotion) {
        document.documentElement.classList.add("motion-reduced");
      }

      return () => {
        document.documentElement.classList.remove("motion-reduced");
      };
    }

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
              "[data-motion-mask]",
              "[data-project-mask]",
              "[data-project-image]",
              "[data-project-visual]",
              "[data-cta-path]",
              "[data-cta-mark]",
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

        gsap.utils.toArray<HTMLElement>("[data-motion-mask]").forEach((element) => {
          gsap.fromTo(
            element,
            { clipPath: "inset(0 0 100% 0)", y: 18 },
            {
              clipPath: "inset(0 0 0% 0)",
              y: 0,
              duration: 0.95,
              ease: "power3.out",
              scrollTrigger: {
                trigger: element,
                start: "top 88%",
                once: true,
              },
            },
          );
        });

        gsap.utils.toArray<HTMLElement>("[data-project-mask]").forEach((element) => {
          gsap.fromTo(
            element,
            { clipPath: "inset(0 0 100% 0)" },
            {
              clipPath: "inset(0 0 0% 0)",
              duration: 0.9,
              ease: "power3.out",
              scrollTrigger: {
                trigger: element,
                start: "top 88%",
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
                ? Math.min(1.025, Math.max(1.015, rawZoom))
                : 1.02;

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

          gsap.utils
            .toArray<HTMLElement>("[data-project-visual]")
            .forEach((visual) => {
              gsap.fromTo(
                visual,
                { yPercent: 1.2 },
                {
                  yPercent: -1.2,
                  ease: "none",
                  scrollTrigger: {
                    trigger: visual,
                    start: "top bottom",
                    end: "bottom top",
                    scrub: 0.8,
                  },
                },
              );
            });
        }

        const convergence = document.querySelector<HTMLElement>("[data-cta-convergence]");
        if (convergence) {
          const paths = convergence.querySelectorAll<HTMLElement>("[data-cta-path]");
          const mark = convergence.querySelector<HTMLElement>("[data-cta-mark]");
          const timeline = gsap.timeline({
            scrollTrigger: {
              trigger: convergence,
              start: "top 82%",
              once: true,
            },
          });

          timeline.fromTo(
            paths,
            { scaleX: 0, opacity: 0.35 },
            {
              scaleX: 1,
              opacity: 1,
              duration: 0.72,
              stagger: 0.08,
              ease: "power2.inOut",
            },
          );

          if (mark) {
            timeline.fromTo(
              mark,
              { autoAlpha: 0, scale: 0.96 },
              { autoAlpha: 1, scale: 1, duration: 0.42, ease: "power2.out" },
              "-=0.18",
            );
          }
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
