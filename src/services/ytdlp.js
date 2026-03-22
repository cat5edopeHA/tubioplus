import { execFile, spawn } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';
import crypto from 'crypto';
import { cache } from './cache.js';

const YT_DLP = process.env.YT_DLP_PATH || 'yt-dlp';

// Common yt-dlp args
const BASE_ARGS = [
  '--no-warnings', '--no-cache-dir', '--no-playlist',
  '-J', '--js-runtimes', 'node',
  '--extractor-args', 'generic:impersonate',
  '--ignore-no-formats-error'
];

/**
 * Run yt-dlp asynchronously (non-blocking)
 */
function runYtDlp(args, cookiesStr = null) {
  return new Promise((resolve, reject) => {
    let tmpFile = null;
    const fullArgs = [...BASE_ARGS];

    if (cookiesStr) {
      tmpFile = `/tmp/yt-cookies-${crypto.randomBytes(16).toString('hex')}.txt`;
      writeFileSync(tmpFile, cookiesStr, { encoding: 'utf8', mode: 0o600 });
      fullArgs.push('--cookies', tmpFile);
    }
    fullArgs.push(...args);

    const cleanup = () => {
      if (tmpFile) try { unlinkSync(tmpFile); } catch {}
    };

    execFile(YT_DLP, fullArgs, {
      encoding: 'utf8',
      maxBuffer: 20 * 1024 * 1024,
      timeout: 90000
    }, (err, stdout, stderr) => {
      cleanup();
      if (err) {
        reject(new Error(err.message?.slice(0, 300)));
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch (parseErr) {
        reject(new Error(`JSON parse error: ${parseErr.message}`));
      }
    });
  });
}

/**
 * Get video info (cached - for metadata only, NOT for stream URLs)
 */
export async function getVideoInfo(videoId) {
  const cacheKey = `info:${videoId}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  try {
    const info = await runYtDlp([`https://www.youtube.com/watch?v=${videoId}`]);
    cache.set(cacheKey, info, 3600);
    return info;
  } catch (err) {
    console.error(`[ytdlp] Error getting info for ${videoId}:`, err.message?.slice(0, 200));
    return null;
  }
}

/**
 * Get FRESH video info (no cache - for play endpoint where URLs must be current)
 */
export async function getFreshVideoInfo(videoId) {
  try {
    return await runYtDlp([`https://www.youtube.com/watch?v=${videoId}`]);
  } catch (err) {
    console.error(`[ytdlp] Error getting fresh info for ${videoId}:`, err.message?.slice(0, 200));
    return null;
  }
}

/**
 * Search YouTube — fetches up to CATALOG_LIMIT results, paginated by catalog route
 */
const CATALOG_LIMIT = parseInt(process.env.CATALOG_LIMIT) || 100;

export { CATALOG_LIMIT };

export async function searchYouTube(query, limit = CATALOG_LIMIT) {
  const cacheKey = `search:${query}:${limit}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  try {
    const result = await runYtDlp(['--flat-playlist', `ytsearch${limit}:${query}`]);
    const entries = result.entries || [];
    cache.set(cacheKey, entries, 300);
    return entries;
  } catch (err) {
    console.error(`[ytdlp] Search error for "${query}":`, err.message?.slice(0, 200));
    return [];
  }
}

/**
 * Get personalized recommendations (YouTube home page with cookies)
 * Falls back to popular content search if no cookies or if home page fails.
 */
export async function getRecommendations(cookiesStr) {
  const cacheKey = cookiesStr ? `recs:${cookiesStr.length}` : 'recs:anon';
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  // If we have cookies, try the YouTube home page for personalized recs
  if (cookiesStr) {
    try {
      const result = await runYtDlp(
        ['--flat-playlist', '--playlist-end', String(CATALOG_LIMIT), 'https://www.youtube.com/'],
        cookiesStr
      );
      const entries = result.entries || [];
      if (entries.length > 0) {
        cache.set(cacheKey, entries, 300);
        return entries;
      }
    } catch (err) {
      console.error('[ytdlp] Recommendations failed:', err.message?.slice(0, 100));
    }
  }

  // Fallback: popular content search
  try {
    const result = await runYtDlp(['--flat-playlist', `ytsearch${CATALOG_LIMIT}:popular videos today`]);
    const entries = result.entries || [];
    if (entries.length > 0) {
      cache.set(cacheKey, entries, 600);
      return entries;
    }
  } catch (err) {
    console.error('[ytdlp] Popular fallback failed:', err.message?.slice(0, 100));
  }

  return [];
}

/**
 * Get subscriptions feed (requires cookies)
 */
export async function getSubscriptions(cookiesStr) {
  const cacheKey = `subs:${cookiesStr.length}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  try {
    const result = await runYtDlp(['--flat-playlist', '--playlist-end', String(CATALOG_LIMIT), 'https://www.youtube.com/feed/subscriptions'], cookiesStr);
    const entries = result.entries || [];
    cache.set(cacheKey, entries, 300);
    return entries;
  } catch (err) {
    console.error('[ytdlp] Subscriptions error:', err.message?.slice(0, 200));
    return [];
  }
}

/**
 * Get watch history (requires cookies)
 */
export async function getHistory(cookiesStr) {
  const cacheKey = `history:${cookiesStr.length}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  try {
    const result = await runYtDlp(['--flat-playlist', '--playlist-end', String(CATALOG_LIMIT), 'https://www.youtube.com/feed/history'], cookiesStr);
    const entries = result.entries || [];
    cache.set(cacheKey, entries, 300);
    return entries;
  } catch (err) {
    console.error('[ytdlp] History error:', err.message?.slice(0, 200));
    return [];
  }
}

/**
 * Get watch later (requires cookies)
 */
export async function getWatchLater(cookiesStr) {
  const cacheKey = `watchlater:${cookiesStr.length}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  try {
    const result = await runYtDlp(['--flat-playlist', '--playlist-end', String(CATALOG_LIMIT), 'https://www.youtube.com/playlist?list=WL'], cookiesStr);
    const entries = result.entries || [];
    cache.set(cacheKey, entries, 300);
    return entries;
  } catch (err) {
    console.error('[ytdlp] Watch later error:', err.message?.slice(0, 200));
    return [];
  }
}

/**
 * Validate video ID format
 */
export function isValidVideoId(videoId) {
  return /^[a-zA-Z0-9_-]{11}$/.test(videoId);
}
