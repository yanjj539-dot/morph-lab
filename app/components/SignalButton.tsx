"use client";

import { ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";
import { withBasePath } from "../lib/paths";

type SignalButtonProps = {
  href: string;
  children: ReactNode;
  variant?: "primary" | "line";
  className?: string;
  hoverLabel?: ReactNode;
};

export function SignalButton({
  href,
  children,
  variant = "primary",
  className = "",
  hoverLabel,
}: SignalButtonProps) {
  return (
    <a
      href={withBasePath(href)}
      className={`signal-button signal-button--${variant} ${hoverLabel ? "signal-button--swap" : ""} ${className}`.trim()}
    >
      <span className="signal-button__label-frame">
        <span className="signal-button__label signal-button__label--primary">
          {children}
        </span>
        {hoverLabel ? (
          <span
            className="signal-button__label signal-button__label--alternate"
            aria-hidden="true"
          >
            {hoverLabel}
          </span>
        ) : null}
      </span>
      <ArrowUpRight className="signal-button__icon" size={16} strokeWidth={1.8} aria-hidden="true" />
    </a>
  );
}
