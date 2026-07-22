export type ResourceLease<T> = {
  readonly resource: T;
  release(): void;
};

export type ReferenceCountedCache<K, T> = {
  acquire(key: K, factory: () => Promise<T>): Promise<ResourceLease<T>>;
  getRefCount(key: K): number;
  has(key: K): boolean;
  dispose(): void;
};

type CacheEntry<T> = {
  promise: Promise<T>;
  resource: T | null;
  refCount: number;
  disposed: boolean;
};

export function createReferenceCountedCache<K, T>(
  disposeResource: (resource: T) => void,
): ReferenceCountedCache<K, T> {
  const entries = new Map<K, CacheEntry<T>>();
  let disposed = false;

  async function acquire(
    key: K,
    factory: () => Promise<T>,
  ): Promise<ResourceLease<T>> {
    if (disposed) throw new Error("Reference-counted cache is disposed.");

    let entry = entries.get(key);
    if (!entry) {
      const newEntry: CacheEntry<T> = {
        promise: Promise.resolve().then(factory),
        resource: null,
        refCount: 0,
        disposed: false,
      };
      entry = newEntry;
      entries.set(key, entry);
      void newEntry.promise
        .then((resource) => {
          newEntry.resource = resource;
          if (newEntry.disposed) disposeResource(resource);
        })
        .catch(() => {
          if (entries.get(key) === newEntry) entries.delete(key);
        });
    }

    entry.refCount += 1;
    let resource: T;
    try {
      resource = await entry.promise;
    } catch (error) {
      entry.refCount = Math.max(0, entry.refCount - 1);
      throw error;
    }

    if (disposed || entry.disposed) {
      entry.refCount = Math.max(0, entry.refCount - 1);
      throw new Error("Reference-counted cache was disposed while acquiring a resource.");
    }

    let released = false;
    return {
      resource,
      release() {
        if (released) return;
        released = true;
        entry.refCount = Math.max(0, entry.refCount - 1);
        if (entry.refCount > 0 || entry.disposed) return;

        entry.disposed = true;
        if (entries.get(key) === entry) entries.delete(key);
        disposeResource(resource);
      },
    };
  }

  return {
    acquire,
    getRefCount(key) {
      return entries.get(key)?.refCount ?? 0;
    },
    has(key) {
      return entries.has(key);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const entry of entries.values()) {
        if (entry.disposed) continue;
        entry.disposed = true;
        if (entry.resource) disposeResource(entry.resource);
      }
      entries.clear();
    },
  };
}
