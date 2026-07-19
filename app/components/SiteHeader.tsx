"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const NAV_ITEMS = [
  { href: "/work", label: "Work" },
  { href: "/#process", label: "Process" },
  { href: "/studio", label: "Studio" },
  { href: "/contact", label: "Contact" },
];

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function SiteHeader() {
  const [isHidden, setIsHidden] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
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
    if (!isMenuOpen) {
      return;
    }

    lastFocusedElementRef.current = document.activeElement as HTMLElement | null;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusableElements = Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? [],
    );
    const firstFocusable = focusableElements[0];
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

      if (event.shiftKey && document.activeElement === firstFocusable) {
        event.preventDefault();
        lastFocusable?.focus();
      } else if (!event.shiftKey && document.activeElement === lastFocusable) {
        event.preventDefault();
        firstFocusable?.focus();
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

    setIsMenuOpen(!isMenuOpen);
  };

  return (
    <header
      className={[
        "site-header fixed inset-x-0 top-0 z-50 transition-[background-color,transform,border-color,box-shadow] duration-300 ease-out",
        isScrolled || isMenuOpen
          ? "site-header--scrolled border-b border-black/10 bg-[#f6f5ef]/88 shadow-[0_16px_40px_rgba(36,86,255,0.06)] backdrop-blur-xl"
          : "site-header--transparent border-b border-transparent bg-transparent",
        isHidden ? "site-header--hidden -translate-y-[calc(100%+1px)]" : "translate-y-0",
        isMenuOpen ? "site-header--menu-open" : "",
      ].join(" ")}
    >
      <nav
        aria-label="Primary navigation"
        className="site-header__nav mx-auto flex h-20 w-full max-w-7xl items-center justify-between px-5 text-[#111318] sm:px-8"
      >
        <Link
          href="/"
          className="site-header__brand text-sm font-semibold uppercase tracking-[0.28em] outline-none transition-colors hover:text-[#2456ff] focus-visible:ring-2 focus-visible:ring-[#2456ff]/70 focus-visible:ring-offset-4 focus-visible:ring-offset-[#f6f5ef]"
          onClick={closeMenu}
        >
          MORPH//LAB
        </Link>

        <div className="site-header__desktop-links hidden items-center gap-8 md:flex">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="site-header__link group relative text-xs font-medium uppercase tracking-[0.22em] text-[#111318]/68 outline-none transition-colors hover:text-[#2456ff] focus-visible:text-[#2456ff]"
            >
              <span className="site-header__link-label">{item.label}</span>
              <span
                aria-hidden="true"
                className="site-header__link-underline pointer-events-none absolute -bottom-2 left-0 h-px w-full origin-left scale-x-0 bg-[#2456ff] transition-transform duration-300 ease-out group-hover:scale-x-100 group-focus-visible:scale-x-100"
              />
            </Link>
          ))}
        </div>

        <button
          type="button"
          className="site-header__menu-button inline-flex h-11 w-11 items-center justify-center rounded-full border border-black/10 bg-white/42 text-[#111318] outline-none transition-colors hover:border-[#2456ff]/40 hover:text-[#2456ff] focus-visible:ring-2 focus-visible:ring-[#2456ff]/70 focus-visible:ring-offset-4 focus-visible:ring-offset-[#f6f5ef] md:hidden"
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
          "site-header__mobile-menu fixed inset-0 top-20 z-40 flex min-h-[calc(100dvh-5rem)] flex-col justify-between bg-[#f6f5ef] px-5 pb-8 pt-10 text-[#111318] transition-[opacity,visibility] duration-300 md:hidden",
          isMenuOpen
            ? "site-header__mobile-menu--open visible opacity-100"
            : "site-header__mobile-menu--closed invisible opacity-0",
        ].join(" ")}
        aria-hidden={!isMenuOpen}
      >
        <div className="site-header__mobile-links flex flex-col gap-1">
          {NAV_ITEMS.map((item, index) => (
            <Link
              key={item.href}
              href={item.href}
              className={[
                "site-header__mobile-link border-b border-black/10 py-6 text-4xl font-semibold uppercase tracking-[0.04em] outline-none transition-[opacity,transform,color] duration-500 ease-out hover:text-[#2456ff] focus-visible:text-[#2456ff]",
                isMenuOpen
                  ? "site-header__mobile-link--visible translate-y-0 opacity-100"
                  : "site-header__mobile-link--hidden translate-y-6 opacity-0",
              ].join(" ")}
              style={{ transitionDelay: isMenuOpen ? `${120 + index * 70}ms` : "0ms" }}
              tabIndex={isMenuOpen ? 0 : -1}
              onClick={closeMenu}
            >
              {item.label}
            </Link>
          ))}
        </div>

        <Link
          href="/contact"
          className="site-header__mobile-cta inline-flex w-fit items-center border border-[#2456ff]/32 px-5 py-3 text-xs font-semibold uppercase tracking-[0.22em] text-[#2456ff] outline-none transition-colors hover:border-[#2456ff] focus-visible:ring-2 focus-visible:ring-[#2456ff]/70"
          tabIndex={isMenuOpen ? 0 : -1}
          onClick={closeMenu}
        >
          Make it real
        </Link>
      </div>
    </header>
  );
}
