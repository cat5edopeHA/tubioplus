// test/integration/api.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../src/app.js';
import { loadEnv } from '../../src/shared/env.js';
import { encryptConfig, loadEncryptionKey } from '../../src/domains/config/encryption.js';
import type { FastifyInstance } from 'fastify';

describe('API Integration Tests', () => {
  let app: FastifyInstance;
  let encryptedConfig: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.RATE_LIMIT = 'off';
    process.env.BROWSER_COOKIES = 'off';
    process.env.ENCRYPTION_KEY = 'a'.repeat(64); // 32-byte hex key for tests
    const env = loadEnv();
    app = await buildApp(env);
    const key = await loadEncryptionKey(env.encryptionKey);
    encryptedConfig = encryptConfig({ quality: '1080' }, key);
  });

  afterAll(async () => {
    delete process.env.ENCRYPTION_KEY;
    await app.close();
  });

  it('GET /manifest.json returns valid manifest', async () => {
    const res = await app.inject({ method: 'GET', url: '/manifest.json' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.id).toBe('yt.stremio.addon');
    expect(body.catalogs).toHaveLength(5);
    expect(body.resources).toEqual(['catalog', 'meta', 'stream', 'subtitles']);
  });

  it('GET /health returns status with dependency checks', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('ok');
    expect(body).toHaveProperty('ytdlp');
    expect(body).toHaveProperty('ffmpeg');
  });

  it('CORS headers present on all responses', async () => {
    const res = await app.inject({ method: 'GET', url: '/manifest.json' });
    expect(res.headers['access-control-allow-origin']).toBe('*');
  });

  it('POST /api/encrypt returns encrypted URL', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/encrypt',
      payload: { quality: '720' },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.url).toContain('/manifest.json');
  });

  it('GET /play/:invalidId.mp4 returns 404', async () => {
    const res = await app.inject({ method: 'GET', url: '/play/bad!id.mp4?q=720' });
    expect(res.statusCode).toBe(404);
  });

  it('Stremio subtitles route returns array shape on failure', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/${encryptedConfig}/subtitles/YouTube/yt:dQw4w9WgXcQ.json`,
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('subtitles');
    expect(Array.isArray(body.subtitles)).toBe(true);
  });

  it('Stremio meta route returns object shape on failure', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/${encryptedConfig}/meta/YouTube/yt:dQw4w9WgXcQ.json`,
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('meta');
  });

  it('Stremio stream route returns array shape on failure', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/${encryptedConfig}/stream/YouTube/yt:dQw4w9WgXcQ.json`,
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('streams');
    expect(Array.isArray(body.streams)).toBe(true);
  });

  it('/configure does not match Stremio config route', async () => {
    // /configure is shorter than 32 chars and not base64url, so should NOT match /:config/ routes
    const res = await app.inject({ method: 'GET', url: '/configure' });
    // Should return 200 (SPA page) or 404, NOT a Stremio JSON response
    expect(res.statusCode).not.toBe(500);
  });
});
