import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RateLimiter } from './rate-limit.js';

describe('RateLimiter', () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    limiter = new RateLimiter({ windowMs: 60000, max: 3 });
  });

  it('allows requests under the limit', () => {
    expect(limiter.check('127.0.0.1').allowed).toBe(true);
    expect(limiter.check('127.0.0.1').allowed).toBe(true);
    expect(limiter.check('127.0.0.1').allowed).toBe(true);
  });
  it('blocks requests over the limit', () => {
    limiter.check('127.0.0.1');
    limiter.check('127.0.0.1');
    limiter.check('127.0.0.1');
    const result = limiter.check('127.0.0.1');
    expect(result.allowed).toBe(false);
    expect(result.retryAfter).toBeGreaterThan(0);
  });
  it('tracks IPs independently', () => {
    limiter.check('1.1.1.1');
    limiter.check('1.1.1.1');
    limiter.check('1.1.1.1');
    expect(limiter.check('1.1.1.1').allowed).toBe(false);
    expect(limiter.check('2.2.2.2').allowed).toBe(true);
  });
  it('resets after window expires', () => {
    vi.useFakeTimers();
    limiter.check('127.0.0.1');
    limiter.check('127.0.0.1');
    limiter.check('127.0.0.1');
    expect(limiter.check('127.0.0.1').allowed).toBe(false);
    vi.advanceTimersByTime(60001);
    expect(limiter.check('127.0.0.1').allowed).toBe(true);
    vi.useRealTimers();
  });
  it('returns remaining count', () => {
    const r1 = limiter.check('127.0.0.1');
    expect(r1.remaining).toBe(2);
    const r2 = limiter.check('127.0.0.1');
    expect(r2.remaining).toBe(1);
  });
  it('cleanup removes expired entries', () => {
    vi.useFakeTimers();
    limiter.check('127.0.0.1');
    vi.advanceTimersByTime(60001);
    limiter.cleanup();
    const result = limiter.check('127.0.0.1');
    expect(result.remaining).toBe(2);
    vi.useRealTimers();
  });
});
