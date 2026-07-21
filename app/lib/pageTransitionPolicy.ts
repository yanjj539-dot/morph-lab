export const PAGE_TRANSITION_TOTAL_MS = 620;
export const PAGE_TRANSITION_OUT_MS = 310;
export const PAGE_TRANSITION_IN_MS = 310;
export const PAGE_TRANSITION_REDUCED_MS = 100;

export type PageTransitionIntent = Readonly<{
  currentHref: string;
  targetHref: string;
  button?: number;
  detail?: number;
  defaultPrevented?: boolean;
  metaKey?: boolean;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  target?: string;
  download?: boolean;
}>;

export function navigationDelayForMotion(prefersReducedMotion: boolean): number {
  return prefersReducedMotion ? 0 : PAGE_TRANSITION_OUT_MS;
}

export function shouldInterceptPageTransition({
  currentHref,
  targetHref,
  button = 0,
  defaultPrevented = false,
  metaKey = false,
  ctrlKey = false,
  shiftKey = false,
  altKey = false,
  target = "",
  download = false,
}: PageTransitionIntent): boolean {
  if (
    defaultPrevented ||
    button !== 0 ||
    metaKey ||
    ctrlKey ||
    shiftKey ||
    altKey ||
    download
  ) {
    return false;
  }

  const normalizedTarget = target.trim().toLowerCase();
  if (normalizedTarget && normalizedTarget !== "_self") return false;

  try {
    const current = new URL(currentHref);
    const destination = new URL(targetHref, current);
    const isHttpNavigation =
      destination.protocol === "http:" || destination.protocol === "https:";
    if (!isHttpNavigation || destination.origin !== current.origin) return false;

    const isSameDocument =
      destination.pathname === current.pathname &&
      destination.search === current.search;
    if (isSameDocument) return false;

    return true;
  } catch {
    return false;
  }
}
