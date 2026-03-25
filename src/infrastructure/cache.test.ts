import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Cache } from './cache.js';

describe('Cache', () => {
  let cache: Cache<string>;

  beforeEach(() => {
    cache = new Cache<string>();
  });

  it('stores and retrieves a value', () => {
    cache.set('key', 'value', 60);
    expect(cache.get('key')).toBe('value');
  });
  it('returns undefined for missing keys', () => {
    expect(cache.get('missing')).toBeUndefined();
  });
  it('expires entries after TTL', () => {
    vi.useFakeTimers();
    cache.set('key', 'value', 1);
    vi.advanceTimersByTime(1001);
    expect(cache.get('key')).toBeUndefined();
    vi.useRealTimers();
  });
  it('returns stale value within grace period via getStale', () => {
    vi.useFakeTimers();
    cache.set('key', 'value', 1); // 1s TTL, additional 2s grace = 3s total
    vi.advanceTimersByTime(2000); // past TTL, within grace
    expect(cache.get('key')).toBeUndefined();
    expect(cache.getStale('key')).toBe('value');
    vi.useRealTimers();
  });
  it('returns undefined from getStale after grace period', () => {
    vi.useFakeTimers();
    cache.set('key', 'value', 1); // grace = 1s + 2s = 3s total
    vi.advanceTimersByTime(4000);
    expect(cache.getStale('key')).toBeUndefined();
    vi.useRealTimers();
  });
  it('deletes entries', () => {
    cache.set('key', 'value', 60);
    cache.delete('key');
    expect(cache.get('key')).toBeUndefined();
  });
  it('clears all entries', () => {
    cache.set('a', '1', 60);
    cache.set('b', '2', 60);
    cache.clear();
    expect(cache.size()).toBe(0);
  });
  it('reports correct size', () => {
    cache.set('a', '1', 60);
    cache.set('b', '2', 60);
    expect(cache.size()).toBe(2);
  });
});
