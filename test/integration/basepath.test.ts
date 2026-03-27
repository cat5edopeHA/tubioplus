// test/integration/basepath.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../src/app.js';
import { loadEnv } from '../../src/shared/env.js';
import type { FastifyInstance } from 'fastify';

describe('BASE_PATH Integration', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.RATE_LIMIT = 'off';
    process.env.BASE_PATH = '/tubio';
    process.env.BROWSER_COOKIES = 'off';
    process.env.ENCRYPTION_KEY = 'a'.repeat(64);
    const env = loadEnv();
    app = await buildApp(env);
  });

  afterAll(async () => {
    delete process.env.BASE_PATH;
    delete process.env.ENCRYPTION_KEY;
    await app.close();
  });

  it('manifest served under BASE_PATH', async () => {
    const res = await app.inject({ method: 'GET', url: '/tubio/manifest.json' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.id).toBe('yt.stremio.addon');
  });

  it('health check served at root (not behind BASE_PATH)', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
  });

  it('encrypt API served under BASE_PATH', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/tubio/api/encrypt',
      payload: { quality: '720' },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.url).toContain('/tubio/');
  });
});
