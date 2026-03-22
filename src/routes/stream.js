import express from 'express';
import { decryptConfig, mergeConfig } from '../config.js';
import * as ytdlp from '../services/ytdlp.js';

const router = express.Router();

const QUALITIES = [
  { height: 1080, label: '1080p' },
  { height: 720, label: '720p' },
  { height: 480, label: '480p' },
  { height: 360, label: '360p' },
];

/**
 * GET /:config/stream/:type/:id.json
 */
router.get('/:config/stream/:type/:id.json', async (req, res) => {
  try {
    const { config: configStr, id } = req.params;
    const config = mergeConfig(decryptConfig(configStr));

    // Extract video ID from yt:VIDEOID format
    const videoId = id.startsWith('yt:') ? id.slice(3) : id;
    if (!ytdlp.isValidVideoId(videoId)) {
      return res.json({ streams: [] });
    }

    // Get video info (cached is fine for metadata)
    const info = await ytdlp.getVideoInfo(videoId);
    if (!info) return res.json({ streams: [] });

    const title = info.title || 'YouTube Video';
    const safeTitle = title.replace(/[^\w\s-]/g, '').trim();
    const maxHeight = parseInt(config.quality) || 1080;

    // Determine protocol and host for play URLs
    const proto = req.get('x-forwarded-proto') || req.protocol || 'https';
    const host = req.get('x-forwarded-host') || req.get('host') || 'localhost:8000';

    // Check which DASH video heights are available (h264 preferred)
    const videoFmts = (info.formats || []).filter(f =>
      f.vcodec && f.vcodec !== 'none' && f.acodec === 'none' && f.url && !f.format_id?.startsWith('sb')
    );
    const availableHeights = new Set(videoFmts.map(f => f.height).filter(Boolean));

    // Also check for muxed 360p
    const hasMuxed = (info.formats || []).some(f =>
      f.format_id === '18' && f.acodec !== 'none' && f.vcodec !== 'none'
    );
    if (hasMuxed) availableHeights.add(360);

    const streams = [];
    for (const q of QUALITIES) {
      if (q.height > maxHeight) continue;
      if (!availableHeights.has(q.height) && q.height !== 360) continue;

      // Find matching video format for description
      const vfmt = videoFmts.find(f => f.height === q.height && (f.vcodec?.startsWith('avc1') || f.vcodec?.includes('h264')));
      const codec = vfmt ? vfmt.vcodec.split('.')[0] : (q.height <= 360 ? 'h264' : 'h264');

      streams.push({
        url: `${proto}://${host}/play/${videoId}.mp4?q=${q.height}`,
        name: `${q.label}`,
        description: `${codec} + AAC | yt-stremio`,
        behaviorHints: {
          bingeGroup: 'yt-stremio',
          filename: `${safeTitle}_${q.label}.mp4`,
          videoSize: vfmt?.filesize_approx || undefined,
        }
      });
    }

    // Ensure at least 360p fallback
    if (streams.length === 0) {
      streams.push({
        url: `${proto}://${host}/play/${videoId}.mp4?q=360`,
        name: '360p',
        description: 'h264 + AAC | yt-stremio',
        behaviorHints: {
          bingeGroup: 'yt-stremio',
          filename: `${safeTitle}_360p.mp4`,
        }
      });
    }

    res.json({ streams });
  } catch (err) {
    console.error('[stream] Error:', err.message);
    res.json({ streams: [] });
  }
});

export default router;
