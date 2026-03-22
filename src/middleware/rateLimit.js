/**
 * Lightweight in-memory rate limiter — no external dependencies.
 * Uses a sliding-window counter per IP.
 *
 * Usage:
 *   import { rateLimit } from './middleware/rateLimit.js';
 *   app.use('/play', rateLimit({ windowMs: 60000, max: 20 }));
 */

const stores = new Map(); // one store per limiter instance

/**
 * Create a rate-limit middleware.
 * @param {object} opts
 * @param {number} opts.windowMs  - Time window in milliseconds (default 60 000)
 * @param {number} opts.max       - Max requests per window (default 30)
 * @param {string} opts.message   - Response body on limit (default 'Too many requests, please try again later.')
 * @param {number} opts.statusCode - HTTP status on limit (default 429)
 * @param {boolean} opts.headers  - Send RateLimit-* headers (default true)
 */
export function rateLimit({
  windowMs = 60_000,
  max = 30,
  message = 'Too many requests, please try again later.',
  statusCode = 429,
  headers = true,
  isGlobal = false,
} = {}) {
  const hits = new Map(); // ip -> { count, resetTime }

  // Periodically clean up expired entries every 5 minutes
  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of hits) {
      if (now > entry.resetTime) hits.delete(ip);
    }
  }, 5 * 60_000);
  cleanup.unref(); // don't keep the process alive

  return (req, res, next) => {
    // If this is the global limiter and a specific limiter already ran, skip
    if (isGlobal && req._rateLimited) return next();

    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    const now = Date.now();

    let entry = hits.get(ip);
    if (!entry || now > entry.resetTime) {
      entry = { count: 0, resetTime: now + windowMs };
      hits.set(ip, entry);
    }

    entry.count++;

    // Mark that a specific (non-global) limiter has handled this request
    if (!isGlobal) req._rateLimited = true;

    if (headers) {
      res.setHeader('RateLimit-Limit', max);
      res.setHeader('RateLimit-Remaining', Math.max(0, max - entry.count));
      res.setHeader('RateLimit-Reset', Math.ceil(entry.resetTime / 1000));
    }

    if (entry.count > max) {
      res.setHeader('Retry-After', Math.ceil((entry.resetTime - now) / 1000));
      return res.status(statusCode).json({ error: message });
    }

    next();
  };
}
