import express from 'express';
import { decryptConfig, mergeConfig } from '../config.js';
import * as ytdlp from '../services/ytdlp.js';
import { CATALOG_LIMIT } from '../services/ytdlp.js';
import { getDeArrowBranding } from '../services/dearrow.js';

const router = express.Router();

// Pagination: first page loads more, subsequent pages load smaller batches
const FIRST_PAGE_SIZE = 20;
const NEXT_PAGE_SIZE = 10;

/**
 * Extract video ID from various YouTube URL formats
 */
function extractVideoId(entry) {
  const url = entry.url || entry.id || '';
  if (/^[a-zA-Z0-9_-]{11}$/.test(url)) return url;
  let match = url.match(/(?:youtube\.com\/watch\?v=|youtube\.com\/.*[?&]v=)([a-zA-Z0-9_-]{11})/);
  if (match) return match[1];
  match = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (match) return match[1];
  // Sometimes yt-dlp returns just the ID in the 'id' field
  if (entry.id && /^[a-zA-Z0-9_-]{11}$/.test(entry.id)) return entry.id;
  return null;
}

/**
 * Parse Stremio extra params from URL path segment
 * e.g., "search=hello&genre=music" -> {search: "hello", genre: "music"}
 */
function parseExtra(extraStr) {
  if (!extraStr) return {};
  const params = {};
  for (const part of extraStr.split('&')) {
    const [key, ...rest] = part.split('=');
    if (key) params[key] = decodeURIComponent(rest.join('='));
  }
  return params;
}

/**
 * Convert yt-dlp entry to Stremio meta preview
 */
async function entryToMeta(entry, config) {
  const videoId = extractVideoId(entry);
  if (!videoId) return null;

  let title = entry.title || 'Untitled';
  let poster = entry.thumbnail || entry.thumbnails?.[entry.thumbnails.length - 1]?.url || '';

  if (config.dearrow?.enabled) {
    try {
      const dearrow = await getDeArrowBranding(videoId);
      if (dearrow?.title) title = dearrow.title;
      if (dearrow?.thumbnail) poster = dearrow.thumbnail;
    } catch {}
  }

  return {
    id: `yt:${videoId}`,
    type: 'YouTube',
    name: title,
    poster: poster || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    posterShape: 'landscape'
  };
}

/**
 * GET /:config/catalog/:type/:id/:extra?.json
 * Stremio sends extra params in the URL path
 */
router.get('/:config/catalog/:type/:id/:extra?.json', async (req, res) => {
  try {
    const { config: configStr, id } = req.params;
    const extra = parseExtra(req.params.extra);
    const config = mergeConfig(decryptConfig(configStr));

    // Pagination: parse skip from extra params
    const skip = Math.max(0, parseInt(extra.skip) || 0);

    // If skip is beyond the hard limit, stop paginating
    if (skip >= CATALOG_LIMIT) {
      return res.json({ metas: [] });
    }

    // Determine page size: first page (skip=0) gets more, subsequent pages get smaller batches
    const pageSize = skip === 0 ? FIRST_PAGE_SIZE : NEXT_PAGE_SIZE;

    let entries = [];

    if (id === 'yt:recommendations') {
      entries = await ytdlp.getRecommendations(config.cookies);
    } else if (id === 'yt:search') {
      const query = extra.search;
      if (!query) return res.json({ metas: [] });
      entries = await ytdlp.searchYouTube(query);
    } else if (id === 'yt:subscriptions') {
      if (!config.cookies) return res.json({ metas: [] });
      entries = await ytdlp.getSubscriptions(config.cookies);
    } else if (id === 'yt:history') {
      if (!config.cookies) return res.json({ metas: [] });
      entries = await ytdlp.getHistory(config.cookies);
    } else if (id === 'yt:watchlater') {
      if (!config.cookies) return res.json({ metas: [] });
      entries = await ytdlp.getWatchLater(config.cookies);
    } else {
      return res.json({ metas: [] });
    }

    // Slice the page from the full cached result set
    const page = entries.slice(skip, skip + pageSize);

    // If no entries in this page, stop paginating
    if (page.length === 0) {
      return res.json({ metas: [] });
    }

    // Convert entries to meta previews (process in parallel)
    const metaPromises = page.map(e => entryToMeta(e, config));
    const metas = (await Promise.all(metaPromises)).filter(Boolean);

    console.log(`[catalog] ${id} skip=${skip} pageSize=${pageSize} returned=${metas.length}/${entries.length} total`);

    res.json({ metas });
  } catch (err) {
    console.error('[catalog] Error:', err.message);
    res.json({ metas: [] });
  }
});

export default router;
