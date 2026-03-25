export interface RateLimitOptions {
  windowMs: number;
  max: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfter: number;
  limit: number;
}

interface WindowEntry {
  count: number;
  resetTime: number;
}

export class RateLimiter {
  private windows = new Map<string, WindowEntry>();
  private readonly windowMs: number;
  private readonly max: number;

  constructor(options: RateLimitOptions) {
    this.windowMs = options.windowMs;
    this.max = options.max;
  }

  check(ip: string): RateLimitResult {
    const now = Date.now();
    let entry = this.windows.get(ip);

    if (!entry || now > entry.resetTime) {
      entry = { count: 0, resetTime: now + this.windowMs };
      this.windows.set(ip, entry);
    }

    entry.count++;

    if (entry.count > this.max) {
      return {
        allowed: false,
        remaining: 0,
        retryAfter: Math.ceil((entry.resetTime - now) / 1000),
        limit: this.max,
      };
    }

    return {
      allowed: true,
      remaining: this.max - entry.count,
      retryAfter: 0,
      limit: this.max,
    };
  }

  cleanup(): void {
    const now = Date.now();
    for (const [ip, entry] of this.windows) {
      if (now > entry.resetTime) {
        this.windows.delete(ip);
      }
    }
  }
}
