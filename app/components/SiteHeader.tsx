"use client";

import { Menu, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { withBasePath } from "../lib/paths";

type NavKey = "work" | "process" | "studio" | "contact";

const NAV_ITEMS = [
  { href: "/work", label: "Work", key: "work" },
  { href: "/#process", label: "Process", key: "process" },
  { href: "/studio", label: "Studio", key: "studio" },
  { href: "/contact", label: "Contact", key: "contact" },
] as const satisfies ReadonlyArray<{ href: string; label: string; key: NavKey }>;

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function SiteHeader() {
  const [isHidden, setIsHidden] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [activeNav, setActiveNav] = useState<NavKey | null>(null);
  const [isDarkTheme, setIsDarkTheme] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const lastFocusedElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    let lastScrollY = window.scrollY;

    const onScroll = () => {
      const currentScrollY = window.scrollY;
      const delta = currentScrollY - lastScrollY;

      setIsScrolled(currentScrollY > 24);

      if (!isMenuOpen) {
        if (delta > 12 && currentScrollY > 96) {
          setIsHidden(true);
        } else if (delta < -6 || currentScrollY < 48) {
          setIsHidden(false);
        }
      }

      lastScrollY = currentScrollY;
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => window.removeEventListener("scroll", onScroll);
  }, [isMenuOpen]);

  useEffect(() => {
    const desktopQuery = window.matchMedia("(min-width: 1024px)");
    const closeMenuAtDesktop = (event: MediaQueryListEvent) => {
      if (event.matches) setIsMenuOpen(false);
    };

    desktopQuery.addEventListener("change", closeMenuAtDesktop);
    return () => desktopQuery.removeEventListener("change", closeMenuAtDesktop);
  }, []);

  useEffect(() => {
    const navigationSections = Array.from(
      document.querySelectorAll<HTMLElement>("[data-nav-section]"),
    );
    const themedSections = Array.from(
      document.querySelectorAll<HTMLElement>("[data-header-theme]"),
    );
    let animationFrameId = 0;

    const routeKey = (): NavKey | null => {
      const pathname = window.location.pathname.replace(/\/$/, "");
      if (pathname.endsWith("/work")) return "work";
      if (pathname.endsWith("/studio")) return "studio";
      if (pathname.endsWith("/contact")) return "contact";
      return null;
    };

    const sectionAtViewportPoint = (elements: HTMLElement[], point: number) =>
      elements.find((element) => {
        const rect = element.getBoundingClientRect();
        return rect.top <= point && rect.bottom > point;
      });

    const updateSectionState = () => {
      animationFrameId = 0;
      const viewportPoint = window.innerHeight * 0.42;
      const activeSection = sectionAtViewportPoint(navigationSections, viewportPoint);
      const themedSection = sectionAtViewportPoint(themedSections, viewportPoint);
      const sectionKey = activeSection?.dataset.navSection as NavKey | undefined;

      setActiveNav(sectionKey ?? routeKey());
      setIsDarkTheme(themedSection?.dataset.headerTheme === "dark");
    };

    const scheduleUpdate = () => {
      if (animationFrameId) return;
      animationFrameId = window.requestAnimationFrame(updateSectionState);
    };

    updateSectionState();
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);

    return () => {
      if (animationFrameId) window.cancelAnimationFrame(animationFrameId);
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
    };
  }, []);

  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }

    lastFocusedElementRef.current = document.activeElement as HTMLElement | null;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const menuFocusableElements = Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? [],
    );
    const firstFocusable = menuFocusableElements[0];
    const focusableElements = [
      ...(menuButtonRef.current ? [menuButtonRef.current] : []),
      ...menuFocusableElements,
    ];
    const lastFocusable = focusableElements[focusableElements.length - 1];

    firstFocusable?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setIsMenuOpen(false);
        return;
      }

      if (event.key !== "Tab" || focusableElements.length === 0) {
        return;
      }

      if (event.shiftKey && document.activeElement === focusableElements[0]) {
        event.preventDefault();
        lastFocusable?.focus();
      } else if (!event.shiftKey && document.activeElement === lastFocusable) {
        event.preventDefault();
        focusableElements[0]?.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      document.removeEventListener("keydown", onKeyDown);
      lastFocusedElementRef.current?.focus();
    };
  }, [isMenuOpen]);

  const closeMenu = () => setIsMenuOpen(false);
  const toggleMenu = () => {
    if (!isMenuOpen) {
      setIsHidden(false);
    }

    setIsMenuOpen((current) => !current);
  };

  const activeItem = NAV_ITEMS.find((item) => item.key === activeNav);
  const useDarkSurface = isDarkTheme && !isMenuOpen;

  return (
    <header
      className={[
        "site-header fixed inset-x-0 top-0 z-50 transition-[background-color,transform,border-color,box-shadow] duration-300 ease-out",
        isScrolled || isMenuOpen ? "site-header--scrolled" : "site-header--transparent",
        useDarkSurface ? "site-header--dark" : "site-header--light",
        isHidden ? "site-header--hidden -translate-y-[calc(100%+1px)]" : "translate-y-0",
        isMenuOpen ? "site-header--menu-open" : "",
      ].join(" ")}
      data-current-section={activeNav ?? "index"}
      onFocusCapture={() => setIsHidden(false)}
    >
      <nav
        aria-label="Primary navigation"
        className="site-header__nav mx-auto flex h-20 w-full max-w-7xl items-center justify-between px-5 sm:px-8"
      >
        <a
          href={withBasePath("/")}
          className="site-header__brand text-sm font-semibold uppercase tracking-[0.28em] outline-none transition-colors hover:text-[#2456ff] focus-visible:ring-2 focus-visible:ring-[#2456ff]/70 focus-visible:ring-offset-4 focus-visible:ring-offset-[#f6f5ef]"
          onClick={closeMenu}
        >
          MORPH//LAB
        </a>

        <div className="site-header__desktop-links hidden items-center gap-8 lg:flex">
          <span className="site-header__section-status" aria-hidden="true">
            {activeItem ? `${activeItem.label} / 05` : "Index / 05"}
          </span>
          {NAV_ITEMS.map((item) => (
            <a
              key={item.href}
              href={withBasePath(item.href)}
              className={[
                "site-header__link group relative text-xs font-medium uppercase tracking-[0.22em] outline-none transition-colors hover:text-[#2456ff] focus-visible:text-[#2456ff]",
                activeNav === item.key ? "site-header__link--active" : "",
              ].join(" ")}
              aria-current={activeNav === item.key ? "location" : undefined}
            >
              <span className="site-header__link-label">{item.label}</span>
              <span
                aria-hidden="true"
                className="site-header__link-underline pointer-events-none absolute -bottom-2 left-0 h-px w-full origin-left scale-x-0 bg-[#2456ff] transition-transform duration-300 ease-out group-hover:scale-x-100 group-focus-visible:scale-x-100"
              />
            </a>
          ))}
        </div>

        <button
          ref={menuButtonRef}
          type="button"
          className="site-header__menu-button inline-flex h-11 w-11 items-center justify-center rounded-full border outline-none transition-colors hover:border-[#2456ff]/40 hover:text-[#2456ff] focus-visible:ring-2 focus-visible:ring-[#2456ff]/70 focus-visible:ring-offset-4 lg:hidden"
          aria-label={isMenuOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={isMenuOpen}
          aria-controls="site-mobile-menu"
          onClick={toggleMenu}
        >
          <span aria-hidden="true" className="site-header__menu-icon">
            {isMenuOpen ? <X size={19} strokeWidth={1.8} /> : <Menu size={19} strokeWidth={1.8} />}
          </span>
        </button>
      </nav>

      <div
        id="site-mobile-menu"
        ref={menuRef}
        className={[
          "site-header__mobile-menu fixed inset-0 top-20 z-40 flex min-h-[calc(100dvh-5rem)] flex-col justify-between bg-[#f6f5ef] px-5 pb-8 pt-10 text-[#111318] transition-[opacity,visibility] duration-300 lg:hidden",
          isMenuOpen
            ? "site-header__mobile-menu--open visible opacity-100"
            : "site-header__mobile-menu--closed invisible opacity-0",
        ].join(" ")}
        aria-hidden={!isMenuOpen}
      >
        <div className="site-header__mobile-links flex flex-col gap-1">
          {NAV_ITEMS.map((item, index) => (
            <a
              key={item.href}
              href={withBasePath(item.href)}
              className={[
                "site-header__mobile-link border-b border-black/10 py-6 text-4xl font-semibold uppercase tracking-[0.04em] outline-none transition-[opacity,transform,color] duration-500 ease-out hover:text-[#2456ff] focus-visible:text-[#2456ff]",
                isMenuOpen
                  ? "site-header__mobile-link--visible translate-y-0 opacity-100"
                  : "site-header__mobile-link--hidden translate-y-6 opacity-0",
              ].join(" ")}
              style={{ transitionDelay: isMenuOpen ? `${120 + index * 70}ms` : "0ms" }}
              tabIndex={isMenuOpen ? 0 : -1}
              aria-current={activeNav === item.key ? "location" : undefined}
              onClick={closeMenu}
            >
              {item.label}
            </a>
          ))}
        </div>

        <a
          href={withBasePath("/contact")}
          className="site-header__mobile-cta inline-flex w-fit items-center border border-[#2456ff]/32 px-5 py-3 text-xs font-semibold uppercase tracking-[0.22em] text-[#2456ff] outline-none transition-colors hover:border-[#2456ff] focus-visible:ring-2 focus-visible:ring-[#2456ff]/70"
          tabIndex={isMenuOpen ? 0 : -1}
          onClick={closeMenu}
        >
          Make it real
        </a>
      </div>
    </header>
  );
}
