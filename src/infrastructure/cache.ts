interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  graceExpiresAt: number;
}

export class Cache<T> {
  private store = new Map<string, CacheEntry<T>>();

  set(key: string, value: T, ttlSeconds: number): void {
    const now = Date.now();
    this.store.set(key, {
      value,
      expiresAt: now + ttlSeconds * 1000,
      graceExpiresAt: now + ttlSeconds * 1000 + ttlSeconds * 2 * 1000, // TTL + 2x TTL additional grace
    });
  }

  get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) return undefined;
    return entry.value;
  }

  getStale(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.graceExpiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  size(): number {
    return this.store.size;
  }
}
