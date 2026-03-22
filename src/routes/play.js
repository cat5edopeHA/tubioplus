import express from 'express';
import { spawn } from 'child_process';
import { Readable } from 'stream';
import * as ytdlp from '../services/ytdlp.js';

const router = express.Router();

/**
 * Find best h264 video format at or below requested height
 */
function findVideoFormat(formats, requestedHeight) {
  const videoOnly = formats
    .filter(f => f.vcodec && f.vcodec !== 'none' && f.acodec === 'none' && f.url && !f.format_id?.startsWith('sb'))
    .sort((a, b) => (a.height || 0) - (b.height || 0));

  // Prefer h264/avc1 at <= requested height
  const h264 = videoOnly.filter(f => f.vcodec?.startsWith('avc1') || f.vcodec?.includes('h264'));
  let pick = h264.reverse().find(f => (f.height || 0) <= requestedHeight);
  if (!pick) pick = h264[0]; // fallback to lowest h264
  if (!pick) {
    // No h264 at all, try any codec
    const all = videoOnly.slice().reverse();
    pick = all.find(f => (f.height || 0) <= requestedHeight) || all[0];
  }
  return pick;
}

/**
 * Find best AAC audio format
 */
function findAudioFormat(formats) {
  const audioOnly = formats.filter(f => f.acodec && f.acodec !== 'none' && f.vcodec === 'none' && f.url);
  // Prefer AAC (mp4a) with highest bitrate
  const aac = audioOnly.filter(f => f.acodec?.startsWith('mp4a')).sort((a, b) => (b.abr || 0) - (a.abr || 0));
  return aac[0] || audioOnly.sort((a, b) => (b.abr || 0) - (a.abr || 0))[0];
}

/**
 * GET /play/:videoId.mp4?q=QUALITY
 * Runs yt-dlp fresh, muxes video+audio via ffmpeg, streams to client
 */
router.get('/play/:videoId.mp4', async (req, res) => {
  const { videoId } = req.params;
  const quality = parseInt(req.query.q) || 720;

  if (!ytdlp.isValidVideoId(videoId)) {
    return res.status(400).send('Invalid video ID');
  }

  try {
    // FRESH yt-dlp run — no cache, URLs must be current
    console.log(`[play] Fetching fresh info for ${videoId} q=${quality}`);
    const info = await ytdlp.getFreshVideoInfo(videoId);
    if (!info) return res.status(404).send('Video not found');

    const formats = info.formats || [];

    // Build YouTube auth headers for ffmpeg
    const ytHeaders = { 'Referer': 'https://www.youtube.com/', 'Origin': 'https://www.youtube.com' };
    const ua = info.http_headers?.['User-Agent'];
    if (ua) ytHeaders['User-Agent'] = ua;

    // For 360p, try muxed format first (direct proxy, no ffmpeg)
    if (quality <= 360) {
      const muxed = formats.find(f =>
        f.format_id === '18' && f.acodec !== 'none' && f.vcodec !== 'none' && f.url
      );
      if (muxed) {
        console.log(`[play] Proxying muxed 360p for ${videoId}`);
        const fetchHeaders = { ...ytHeaders };
        if (req.headers.range) fetchHeaders['Range'] = req.headers.range;

        const response = await fetch(muxed.url, { headers: fetchHeaders, redirect: 'follow' });
        if (!response.ok && response.status !== 206) {
          throw new Error(`YouTube CDN: ${response.status}`);
        }

        res.status(response.status);
        res.setHeader('Content-Type', 'video/mp4');
        res.setHeader('Access-Control-Allow-Origin', '*');
        for (const h of ['content-length', 'content-range', 'accept-ranges']) {
          const v = response.headers.get(h);
          if (v) res.setHeader(h, v);
        }
        return Readable.fromWeb(response.body).pipe(res);
      }
    }

    // Find DASH video + audio and mux with ffmpeg
    const videoFmt = findVideoFormat(formats, quality);
    const audioFmt = findAudioFormat(formats);

    if (!videoFmt?.url || !audioFmt?.url) {
      // Last resort: try muxed format
      const muxed = formats.find(f => f.acodec !== 'none' && f.vcodec !== 'none' && f.url && !f.format_id?.startsWith('sb'));
      if (muxed) {
        console.log(`[play] Falling back to muxed format for ${videoId}`);
        const fetchHeaders = { ...ytHeaders };
        if (req.headers.range) fetchHeaders['Range'] = req.headers.range;
        const response = await fetch(muxed.url, { headers: fetchHeaders, redirect: 'follow' });
        if (!response.ok && response.status !== 206) throw new Error(`YouTube CDN: ${response.status}`);
        res.status(response.status);
        res.setHeader('Content-Type', 'video/mp4');
        res.setHeader('Access-Control-Allow-Origin', '*');
        return Readable.fromWeb(response.body).pipe(res);
      }
      return res.status(404).send('No playable format found');
    }

    console.log(`[play] Muxing ${videoFmt.format_id} (${videoFmt.height}p ${videoFmt.vcodec}) + ${audioFmt.format_id} (${audioFmt.acodec}) for ${videoId}`);

    // Build ffmpeg header args
    const headerStr = Object.entries(ytHeaders).map(([k, v]) => `${k}: ${v}\r\n`).join('');

    const ffmpeg = spawn('ffmpeg', [
      '-headers', headerStr,
      '-i', videoFmt.url,
      '-headers', headerStr,
      '-i', audioFmt.url,
      '-c:v', 'copy',
      '-c:a', 'copy',
      '-movflags', 'frag_keyframe+empty_moov+faststart',
      '-f', 'mp4',
      'pipe:1'
    ], { stdio: ['ignore', 'pipe', 'pipe'] });

    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Transfer-Encoding', 'chunked');

    ffmpeg.stdout.pipe(res);

    ffmpeg.stderr.on('data', (data) => {
      const line = data.toString().trim();
      if (line.includes('time=') && process.env.DEV_LOGGING) {
        console.log(`[ffmpeg] ${line.split('\r').pop()}`);
      }
      if (line.includes('Error') || line.includes('error')) {
        console.error(`[ffmpeg] ${line}`);
      }
    });

    ffmpeg.on('error', (err) => {
      console.error('[ffmpeg] spawn error:', err.message);
      if (!res.headersSent) res.status(500).send('FFmpeg error');
    });

    ffmpeg.on('close', (code) => {
      if (code && code !== 0 && code !== 255) {
        console.error(`[ffmpeg] exited with code ${code}`);
      }
    });

    req.on('close', () => { ffmpeg.kill('SIGTERM'); });
  } catch (err) {
    console.error(`[play] Error for ${videoId}:`, err.message);
    if (!res.headersSent) res.status(502).send('Play failed');
  }
});

export default router;
