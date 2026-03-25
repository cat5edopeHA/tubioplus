import Fastify from 'fastify';
import { existsSync } from 'node:fs';
import { spawn, type ChildProcess } from 'node:child_process';
import type { EnvConfig } from './shared/env.js';
import { createLogger } from './infrastructure/logger.js';
import { RateLimiter } from './infrastructure/rate-limit.js';
import { Cache } from './infrastructure/cache.js';
import { YtDlpService } from './domains/youtube/ytdlp.js';
import { SponsorBlockClient } from './domains/sponsorblock/client.js';
import { DeArrowClient } from './domains/dearrow/client.js';
import { stremioPlugin } from './domains/stremio/plugin.js';
import { loadEncryptionKey, decryptConfig, encryptConfig } from './domains/config/encryption.js';
import { mergeWithDefaults, type AppConfig } from './domains/config/schema.js';
import { isValidVideoId, extractVideoId } from './shared/validation.js';
import { buildSubtitleList } from './domains/subtitles/handler.js';
import { buildMeta } from './domains/meta/handler.js';
import { buildStreamList } from './domains/stream/handler.js';
import { parseExtraParams, paginateResults, buildCatalogMetas } from './domains/catalog/handler.js';
import { prewarmVideoInfo } from './domains/catalog/prewarm.js';
import { findVideoFormat, findAudioFormat } from './domains/youtube/formats.js';
import type { VideoInfo } from './domains/youtube/types.js';

// Augment Fastify request to carry decoded config
declare module 'fastify' {
  interface FastifyRequest {
    appConfig?: AppConfig;
  }
}

// Track active FFmpeg processes for graceful shutdown
const activeProcesses = new Set<ChildProcess>();

export function getActiveProcesses(): Set<ChildProcess> {
  return activeProcesses;
}

// Health check cache
let healthCache: { ytdlp: boolean; ffmpeg: boolean; cachedAt: number } | null = null;
const HEALTH_CACHE_TTL = 300000; // 5 minutes

// Base64url regex: at least 32 chars, only [A-Za-z0-9_-]
const CONFIG_PARAM_REGEX = /^[A-Za-z0-9_-]{32,}$/;

export async function buildApp(env: EnvConfig) {
  const app = Fastify({
    logger: env.nodeEnv === 'test' ? false : {
      level: env.nodeEnv === 'production' ? 'info' : 'debug',
      ...(env.nodeEnv !== 'production' ? { transport: { target: 'pino-pretty', options: { colorize: true } } } : {}),
    },
    routerOptions: { maxParamLength: 500 },
  });
  const encryptionKey = await loadEncryptionKey(env.encryptionKey);
  const videoCache = new Cache<VideoInfo>();
  const ytdlp = new YtDlpService(env.ytDlpPath, videoCache);
  const sponsorblock = new SponsorBlockClient();
  const dearrow = new DeArrowClient();

  // Rate limiters
  const playLimiter = new RateLimiter({ windowMs: 60000, max: 15 });
  const encryptLimiter = new RateLimiter({ windowMs: 60000, max: 10 });
  const apiLimiter = new RateLimiter({ windowMs: 60000, max: 60 });
  const globalLimiter = new RateLimiter({ windowMs: 60000, max: 120 });

  // Cleanup interval
  const cleanupInterval = setInterval(() => {
    playLimiter.cleanup();
    encryptLimiter.cleanup();
    apiLimiter.cleanup();
    globalLimiter.cleanup();
  }, 300000);

  app.addHook('onClose', () => {
    clearInterval(cleanupInterval);
    // Kill active FFmpeg processes on shutdown
    for (const proc of activeProcesses) {
      proc.kill('SIGTERM');
    }
    activeProcesses.clear();
  });

  // CORS
  app.addHook('onSend', async (_request, reply) => {
    reply.header('Access-Control-Allow-Origin', '*');
    reply.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    reply.header('Access-Control-Allow-Headers', 'Content-Type');
  });

  // Rate limiting hook with full headers (when enabled)
  function applyRateLimit(limiter: RateLimiter, request: any, reply: any): boolean {
    if (!env.rateLimitEnabled) return true;
    const result = limiter.check(request.ip);
    reply.header('RateLimit-Limit', String(result.limit));
    reply.header('RateLimit-Remaining', String(result.remaining));
    if (!result.allowed) {
      reply.header('Retry-After', String(result.retryAfter));
      reply.status(429);
      return false;
    }
    return true;
  }

  if (env.rateLimitEnabled) {
    app.addHook('onRequest', async (request, reply) => {
      const result = globalLimiter.check(request.ip);
      reply.header('RateLimit-Limit', String(result.limit));
      reply.header('RateLimit-Remaining', String(result.remaining));
      if (!result.allowed) {
        reply.header('Retry-After', String(result.retryAfter));
        reply.status(429).send({ error: 'Too many requests' });
      }
    });
  }

  // Health check with caching (always at root, not behind basePath)
  app.get('/health', async () => {
    const now = Date.now();
    if (healthCache && now - healthCache.cachedAt < HEALTH_CACHE_TTL) {
      return { status: 'ok', ytdlp: healthCache.ytdlp, ffmpeg: healthCache.ffmpeg };
    }

    let ytdlpOk = false;
    let ffmpegOk = false;
    try {
      const proc = spawn(env.ytDlpPath, ['--version'], { stdio: ['ignore', 'pipe', 'pipe'] });
      await new Promise<void>((resolve) => proc.on('close', (code) => { ytdlpOk = code === 0; resolve(); }));
    } catch { /* ignore */ }
    try {
      const proc = spawn('ffmpeg', ['-version'], { stdio: ['ignore', 'pipe', 'pipe'] });
      await new Promise<void>((resolve) => proc.on('close', (code) => { ffmpegOk = code === 0; resolve(); }));
    } catch { /* ignore */ }

    healthCache = { ytdlp: ytdlpOk, ffmpeg: ffmpegOk, cachedAt: now };
    return { status: 'ok', ytdlp: ytdlpOk, ffmpeg: ffmpegOk };
  });

  // Stremio manifest
  await app.register(stremioPlugin, { prefix: env.basePath || undefined });

  // Config encryption API
  app.post<{ Body: Record<string, unknown> }>(`${env.basePath}/api/encrypt`, async (request, reply) => {
    if (!applyRateLimit(encryptLimiter, request, reply)) {
      return { error: 'Too many requests' };
    }
    const encrypted = encryptConfig(request.body, encryptionKey);
    const baseUrl = `${request.protocol}://${request.hostname}${env.basePath}`;
    return { url: `${baseUrl}/${encrypted}/manifest.json` };
  });

  // Config decryption helper
  function decryptRequestConfig(configStr: string): AppConfig {
    try {
      const raw = decryptConfig(configStr, encryptionKey);
      return mergeWithDefaults(raw);
    } catch {
      return mergeWithDefaults({});
    }
  }

  // Cookie resolution helper
  async function resolveCookies(config: AppConfig): Promise<{ cookieFile?: string; browserCookies?: boolean; cleanup?: () => Promise<void> }> {
    if (env.browserCookies === 'on' || (env.browserCookies === 'auto' && existsSync('/data/chromium-profile'))) {
      return { browserCookies: true };
    }
    if (config.cookies) {
      const file = await ytdlp.writeCookieFile(config.cookies);
      return { cookieFile: file, cleanup: () => ytdlp.removeCookieFile(file) };
    }
    return {};
  }

  // Stremio catalog route -- uses regex constraint on :config to avoid collisions
  const stremioPrefix = env.basePath;

  app.get<{ Params: { config: string; type: string; id: string } }>(
    `${stremioPrefix}/:config([A-Za-z0-9_\\-]{32,})/catalog/:type/:id.json`,
    async (request) => {
      if (!applyRateLimit(apiLimiter, request, {} as any)) return { metas: [] };
      const config = decryptRequestConfig(request.params.config);
      const cookies = await resolveCookies(config);
      try {
        return await handleCatalog(request.params.id, '', config, cookies, env);
      } finally {
        await cookies.cleanup?.();
      }
    },
  );

  app.get<{ Params: { config: string; type: string; id: string; extra: string } }>(
    `${stremioPrefix}/:config([A-Za-z0-9_\\-]{32,})/catalog/:type/:id/:extra.json`,
    async (request) => {
      if (!applyRateLimit(apiLimiter, request, {} as any)) return { metas: [] };
      const config = decryptRequestConfig(request.params.config);
      const cookies = await resolveCookies(config);
      try {
        return await handleCatalog(request.params.id, request.params.extra, config, cookies, env);
      } finally {
        await cookies.cleanup?.();
      }
    },
  );

  // Catalog handler (shared logic)
  async function handleCatalog(
    catalogId: string,
    extra: string,
    config: AppConfig,
    cookies: { cookieFile?: string; browserCookies?: boolean },
    _env: EnvConfig,
  ) {
    const { search, skip } = parseExtraParams(extra);

    try {
      let results: any[] = [];

      if (catalogId === 'yt:search' && search) {
        results = await ytdlp.search(search, env.catalogLimit, cookies.cookieFile, cookies.browserCookies);
      } else if (catalogId === 'yt:recommendations') {
        results = await ytdlp.search('', env.catalogLimit, cookies.cookieFile, cookies.browserCookies);
      }
      // yt:subscriptions, yt:history, yt:watchlater require cookies
      // Return empty if no cookies available (graceful degradation)

      const paginated = paginateResults(results, skip, env.catalogLimit);
      const metas = buildCatalogMetas(paginated);

      // Prewarm video info for returned IDs
      const rawIds = paginated.map((r: any) => r.id).filter(Boolean);
      prewarmVideoInfo(ytdlp, rawIds, cookies.cookieFile, cookies.browserCookies);

      return { metas };
    } catch {
      return { metas: [] };
    }
  }

  // Stremio meta route
  app.get<{ Params: { config: string; type: string; id: string } }>(
    `${stremioPrefix}/:config([A-Za-z0-9_\\-]{32,})/meta/:type/:id.json`,
    async (request) => {
      if (!applyRateLimit(apiLimiter, request, {} as any)) return { meta: {} };
      const config = decryptRequestConfig(request.params.config);
      const videoId = extractVideoId(request.params.id);
      if (!isValidVideoId(request.params.id)) return { meta: {} };

      const cookies = await resolveCookies(config);
      try {
        const info = await ytdlp.getVideoInfoWithStale(videoId, cookies.cookieFile, cookies.browserCookies);
        const branding = config.dearrow.enabled ? await dearrow.getBranding(videoId) : undefined;
        return { meta: buildMeta(info, branding) };
      } catch {
        return { meta: {} };
      } finally {
        await cookies.cleanup?.();
      }
    },
  );

  // Stremio stream route
  app.get<{ Params: { config: string; type: string; id: string } }>(
    `${stremioPrefix}/:config([A-Za-z0-9_\\-]{32,})/stream/:type/:id.json`,
    async (request) => {
      if (!applyRateLimit(apiLimiter, request, {} as any)) return { streams: [] };
      const config = decryptRequestConfig(request.params.config);
      const videoId = extractVideoId(request.params.id);
      if (!isValidVideoId(request.params.id)) return { streams: [] };

      const cookies = await resolveCookies(config);
      try {
        const info = await ytdlp.getVideoInfoWithStale(videoId, cookies.cookieFile, cookies.browserCookies);
        const baseUrl = `${request.protocol}://${request.hostname}${env.basePath}`;

        let sbCount: number | undefined;
        if (config.sponsorblock.enabled) {
          const segments = await sponsorblock.getSkipSegments(videoId, config.sponsorblock.categories);
          sbCount = segments.length;
        }

        return { streams: buildStreamList(info.formats ?? [], videoId, baseUrl, config.quality, sbCount) };
      } catch {
        return { streams: [] };
      } finally {
        await cookies.cleanup?.();
      }
    },
  );

  // Stremio subtitles route
  app.get<{ Params: { config: string; type: string; id: string } }>(
    `${stremioPrefix}/:config([A-Za-z0-9_\\-]{32,})/subtitles/:type/:id.json`,
    async (request) => {
      if (!applyRateLimit(apiLimiter, request, {} as any)) return { subtitles: [] };
      const config = decryptRequestConfig(request.params.config);
      const videoId = extractVideoId(request.params.id);
      if (!isValidVideoId(request.params.id)) return { subtitles: [] };

      const cookies = await resolveCookies(config);
      try {
        const info = await ytdlp.getVideoInfoWithStale(videoId, cookies.cookieFile, cookies.browserCookies);
        return { subtitles: buildSubtitleList(info) };
      } catch {
        return { subtitles: [] };
      } finally {
        await cookies.cleanup?.();
      }
    },
  );

  // Play route (video streaming)
  app.get<{ Params: { videoId: string }; Querystring: { q?: string } }>(
    `${stremioPrefix}/play/:videoId.mp4`,
    async (request, reply) => {
      if (!applyRateLimit(playLimiter, request, reply)) {
        return { error: 'Too many requests' };
      }

      const rawId = request.params.videoId;
      if (!isValidVideoId(rawId)) {
        reply.status(404);
        return { error: 'Invalid video ID' };
      }

      const height = parseInt(request.query.q ?? '1080', 10);

      try {
        const info = await ytdlp.getFreshVideoInfo(rawId);
        const formats = info.formats ?? [];
        const video = findVideoFormat(formats, height);
        if (!video) {
          reply.status(404);
          return { error: 'No suitable format found' };
        }

        const isMuxed = video.acodec && video.acodec !== 'none';

        if (isMuxed) {
          // Direct proxy for muxed streams (360p)
          const response = await fetch(video.url, {
            headers: { Referer: 'https://www.youtube.com' },
          });
          reply.header('Content-Type', 'video/mp4');
          return reply.send(response.body);
        }

        // FFmpeg mux for DASH streams
        const audio = findAudioFormat(formats);
        if (!audio) {
          reply.status(404);
          return { error: 'No audio format found' };
        }

        const ffmpeg = spawn('ffmpeg', [
          '-headers', 'Referer: https://www.youtube.com\r\n',
          '-i', video.url,
          '-headers', 'Referer: https://www.youtube.com\r\n',
          '-i', audio.url,
          '-c:v', 'copy',
          '-c:a', 'copy',
          '-movflags', 'frag_keyframe+empty_moov+faststart',
          '-f', 'mp4',
          'pipe:1',
        ], { stdio: ['ignore', 'pipe', 'pipe'] });

        // Track for graceful shutdown
        activeProcesses.add(ffmpeg);
        ffmpeg.on('close', () => activeProcesses.delete(ffmpeg));

        reply.header('Content-Type', 'video/mp4');
        reply.raw.on('close', () => ffmpeg.kill('SIGTERM'));

        return reply.send(ffmpeg.stdout);
      } catch (err) {
        reply.status(500);
        return { error: 'Extraction failed' };
      }
    },
  );

  return app;
}
