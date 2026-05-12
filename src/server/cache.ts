type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

const cache = new Map<string, CacheEntry<unknown>>();

export function getCached<T>(key: string, now = Date.now()): T | undefined {
  const entry = cache.get(key);

  if (!entry) {
    return undefined;
  }

  if (now >= entry.expiresAt) {
    cache.delete(key);
    return undefined;
  }

  return entry.value as T;
}

export function setCached<T>(key: string, value: T, ttlMs: number, now = Date.now()): void {
  cache.set(key, {
    value,
    expiresAt: now + ttlMs,
  });
}

export function clearCache(): void {
  cache.clear();
}
