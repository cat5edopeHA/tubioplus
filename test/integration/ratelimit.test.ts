import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../src/app.js';
import { loadEnv } from '../../src/shared/env.js';
import type { FastifyInstance } from 'fastify';

describe('Rate Limiting', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    process.env.RATE_LIMIT = 'on';
    process.env.BROWSER_COOKIES = 'off';
    // Use a nonexistent yt-dlp binary so play requests fail instantly
    // instead of making real network calls to YouTube
    process.env.YT_DLP_PATH = '/nonexistent-yt-dlp';
    const env = loadEnv();
    app = await buildApp(env);
  });

  afterAll(async () => {
    delete process.env.RATE_LIMIT;
    delete process.env.YT_DLP_PATH;
    await app.close();
  });

  it('returns 429 when play endpoint rate limit exceeded', async () => {
    // Hit play endpoint 15 times (play limit is 15/min)
    for (let i = 0; i < 15; i++) {
      const res = await app.inject({ method: 'GET', url: '/play/dQw4w9WgXcQ.mp4?q=720' });
      // These will fail with 500 (nonexistent yt-dlp) but should NOT be 429
      expect(res.statusCode).not.toBe(429);
    }
    // 16th request should be rate limited
    const res = await app.inject({ method: 'GET', url: '/play/dQw4w9WgXcQ.mp4?q=720' });
    expect(res.statusCode).toBe(429);
  }, 30000);

  it('includes RateLimit headers', async () => {
    // Need a fresh app to reset rate limit state
    await app.close();
    const env = loadEnv();
    app = await buildApp(env);

    const res = await app.inject({ method: 'GET', url: '/play/dQw4w9WgXcQ.mp4?q=720' });
    expect(res.headers['ratelimit-limit']).toBeDefined();
    expect(res.headers['ratelimit-remaining']).toBeDefined();
  }, 15000);
});
