export type VisibilityController = {
  isVisible: () => boolean;
  request: (callback?: () => void) => boolean;
  dispose: () => void;
};

export type VisibilityControllerOptions = {
  root?: Element | Document | null;
  threshold?: number;
  onChange?: (visible: boolean) => void;
};

export function createVisibilityController(
  target: Element,
  options: VisibilityControllerOptions = {},
): VisibilityController {
  let documentVisible = !document.hidden;
  let intersectionVisible = true;
  let disposed = false;
  let lastVisible = documentVisible && intersectionVisible;
  const callbacks = new Set<() => void>();

  function computeVisible(): boolean {
    return !disposed && documentVisible && intersectionVisible;
  }

  function notifyIfChanged(): void {
    const next = computeVisible();
    if (next === lastVisible) return;

    lastVisible = next;
    options.onChange?.(next);

    if (next) {
      for (const callback of callbacks) {
        callback();
      }
    }
  }

  function handleVisibilityChange(): void {
    documentVisible = !document.hidden;
    notifyIfChanged();
  }

  const observer =
    typeof IntersectionObserver === "undefined"
      ? null
      : new IntersectionObserver(
          (entries) => {
            const entry = entries[0];
            intersectionVisible = Boolean(entry?.isIntersecting);
            notifyIfChanged();
          },
          {
            root: options.root instanceof Document ? null : options.root ?? null,
            threshold: options.threshold ?? 0.01,
          },
        );

  observer?.observe(target);
  document.addEventListener("visibilitychange", handleVisibilityChange);

  return {
    isVisible() {
      return computeVisible();
    },

    request(callback) {
      if (callback) {
        callbacks.add(callback);
      }

      if (!computeVisible()) return false;

      callback?.();
      return true;
    },

    dispose() {
      if (disposed) return;

      disposed = true;
      callbacks.clear();
      observer?.disconnect();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    },
  };
}
