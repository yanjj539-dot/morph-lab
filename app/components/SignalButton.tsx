"use client";

import { ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";
import { withBasePath } from "../lib/paths";

type SignalButtonProps = {
  href: string;
  children: ReactNode;
  variant?: "primary" | "line";
  className?: string;
};

export function SignalButton({
  href,
  children,
  variant = "primary",
  className = "",
}: SignalButtonProps) {
  return (
    <a
      href={withBasePath(href)}
      className={`signal-button signal-button--${variant} ${className}`.trim()}
    >
      <span className="signal-button__label">{children}</span>
      <ArrowUpRight className="signal-button__icon" size={16} strokeWidth={1.8} aria-hidden="true" />
    </a>
  );
}
