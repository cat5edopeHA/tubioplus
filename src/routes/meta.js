import express from 'express';
import { decryptConfig, mergeConfig } from '../config.js';
import * as ytdlp from '../services/ytdlp.js';
import { getDeArrowBranding } from '../services/dearrow.js';

const router = express.Router();

/**
 * GET /:config/meta/:type/:id.json
 */
router.get('/:config/meta/:type/:id.json', async (req, res) => {
  try {
    const { config: configStr, type, id } = req.params;

    // Decrypt config
    const config = mergeConfig(decryptConfig(configStr));

    // Extract video ID from yt:VIDEOID format
    const videoId = id.startsWith('yt:') ? id.slice(3) : id;

    // Validate video ID
    if (!ytdlp.isValidVideoId(videoId)) {
      return res.json({});
    }

    // Get video info
    const info = await ytdlp.getVideoInfo(videoId);
    if (!info) {
      return res.json({});
    }

    let title = info.title || '';
    let poster = info.thumbnail || '';

    // Apply DeArrow if enabled
    if (config.dearrow?.enabled) {
      const dearrow = await getDeArrowBranding(videoId);
      if (dearrow) {
        if (dearrow.title) title = dearrow.title;
        if (dearrow.thumbnail) poster = dearrow.thumbnail;
      }
    }

    // Extract year from upload date
    let releaseInfo = '';
    if (info.upload_date) {
      releaseInfo = info.upload_date.slice(0, 4);
    }

    // Calculate runtime in minutes
    const runtime = info.duration ? Math.round(info.duration / 60) : 0;

    // Build channel link
    const links = [];
    if (info.channel_url) {
      links.push({
        name: info.uploader || 'Channel',
        url: info.channel_url
      });
    }

    const meta = {
      id: `yt:${videoId}`,
      type: 'channel',
      name: title,
      poster: poster || 'https://via.placeholder.com/320x180',
      posterShape: 'landscape',
      description: info.description || '',
      releaseInfo: releaseInfo,
      runtime: `${runtime}m`,
      links: links,
      behaviorHints: {
        defaultVideoId: `yt:${videoId}`
      }
    };

    res.json({ meta });
  } catch (err) {
    console.error('Meta error:', err);
    res.json({});
  }
});

export default router;
