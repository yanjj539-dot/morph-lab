"use client";

import Link from "next/link";
import type { ReactNode } from "react";

type SignalButtonProps = {
  href: string;
  children: ReactNode;
  variant?: "signal" | "line";
  className?: string;
};

function setSignal(active: boolean) {
  window.dispatchEvent(
    new CustomEvent("morph-core:signal-boost", {
      detail: { active, intensity: active ? 1 : 0 },
    }),
  );
}

export function SignalButton({
  href,
  children,
  variant = "signal",
  className = "",
}: SignalButtonProps) {
  return (
    <Link
      href={href}
      className={`signal-button signal-button--${variant} ${className}`.trim()}
      onPointerEnter={() => setSignal(true)}
      onPointerLeave={() => setSignal(false)}
      onFocus={() => setSignal(true)}
      onBlur={() => setSignal(false)}
    >
      <span className="signal-button__track" aria-hidden="true" />
      <span className="signal-button__label">{children}</span>
    </Link>
  );
}

