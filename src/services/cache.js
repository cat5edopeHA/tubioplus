/**
 * Simple in-memory cache with TTL support
 */
export class Cache {
  constructor() {
    this.store = new Map();
  }

  /**
   * Set a value with optional TTL in seconds
   */
  set(key, value, ttlSeconds = 300) {
    const expiresAt = Date.now() + (ttlSeconds * 1000);
    this.store.set(key, { value, expiresAt });
  }

  /**
   * Get a value, returning null if expired or not found
   */
  get(key) {
    const item = this.store.get(key);
    if (!item) return null;

    if (Date.now() > item.expiresAt) {
      this.store.delete(key);
      return null;
    }

    return item.value;
  }

  /**
   * Delete a key
   */
  delete(key) {
    this.store.delete(key);
  }

  /**
   * Clear all entries
   */
  clear() {
    this.store.clear();
  }

  /**
   * Get cache size
   */
  size() {
    return this.store.size;
  }
}

export const cache = new Cache();
