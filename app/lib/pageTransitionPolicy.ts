export const PAGE_TRANSITION_TOTAL_MS = 620;
export const PAGE_TRANSITION_OUT_MS = 310;
export const PAGE_TRANSITION_IN_MS = 310;
export const PAGE_TRANSITION_REDUCED_MS = 100;
export const PAGE_TRANSITION_MARKER_TTL_MS = 10_000;
export const PAGE_TRANSITION_SESSION_KEY = "morph-lab:page-transition";
export const PAGE_TRANSITION_LEAVING_CLASS = "page-transition-leaving";
export const PAGE_TRANSITION_INCOMING_CLASS = "page-transition-incoming";
export const PAGE_TRANSITION_ENTERING_CLASS = "page-transition-entering";
export const PAGE_TRANSITION_STATE_CLASSES = [
  PAGE_TRANSITION_LEAVING_CLASS,
  PAGE_TRANSITION_INCOMING_CLASS,
  PAGE_TRANSITION_ENTERING_CLASS,
] as const;

export type PageTransitionMarker = Readonly<{
  href: string;
  createdAt: number;
}>;

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

export function parsePageTransitionMarker(
  rawMarker: string | null,
  currentHref: string,
  now: number,
): PageTransitionMarker | null {
  if (!rawMarker) return null;

  try {
    const marker: unknown = JSON.parse(rawMarker);
    if (!marker || typeof marker !== "object" || Array.isArray(marker)) return null;

    const { href, createdAt } = marker as Record<string, unknown>;
    if (typeof href !== "string" || href !== currentHref) return null;
    if (typeof createdAt !== "number" || !Number.isFinite(createdAt)) return null;

    const age = now - createdAt;
    if (age < 0 || age > PAGE_TRANSITION_MARKER_TTL_MS) return null;

    return { href, createdAt };
  } catch {
    return null;
  }
}

export function createPageTransitionBootScript(): string {
  const sessionKey = JSON.stringify(PAGE_TRANSITION_SESSION_KEY);
  const incomingClass = JSON.stringify(PAGE_TRANSITION_INCOMING_CLASS);
  const ttl = JSON.stringify(PAGE_TRANSITION_MARKER_TTL_MS);

  return `try{const k=${sessionKey},r=sessionStorage.getItem(k),n=Date.now();let v=false;if(r){const m=JSON.parse(r);if(m&&typeof m==="object"&&!Array.isArray(m)&&typeof m.href==="string"&&m.href===window.location.href&&typeof m.createdAt==="number"&&Number.isFinite(m.createdAt)){const a=n-m.createdAt;v=a>=0&&a<=${ttl}}}if(v){document.documentElement.classList.add(${incomingClass})}else if(r){sessionStorage.removeItem(k)}}catch{try{sessionStorage.removeItem(${sessionKey})}catch{}}`;
}

export const PAGE_TRANSITION_BOOT_SCRIPT = createPageTransitionBootScript();

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
