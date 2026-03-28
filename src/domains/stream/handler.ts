import type { VideoFormat } from '../youtube/types.js';
import type { StremioStream } from '../stremio/types.js';
import type { SkipSegment } from '../sponsorblock/types.js';
import { findVideoFormat, findAudioFormat } from '../youtube/formats.js';

const QUALITY_LEVELS = [2160, 1080, 720, 480, 360];
const MAX_SPONSOR_SEGMENTS = 50;

export function buildStreamList(formats: VideoFormat[], videoId: string, baseUrl: string, maxQuality: string, sponsorSegments?: SkipSegment[]): StremioStream[] {
  const maxHeight = parseInt(maxQuality, 10) || 1080;
  const streams: StremioStream[] = [];
  const capped = sponsorSegments?.slice(0, MAX_SPONSOR_SEGMENTS);
  const hasSponsor = capped && capped.length > 0;
  const sbParam = hasSponsor
    ? `&sb=${capped.map(s => `${s.segment[0]}-${s.segment[1]}`).join(',')}`
    : '';

  for (const height of QUALITY_LEVELS) {
    if (height > maxHeight) continue;
    const video = findVideoFormat(formats, height);
    if (!video) continue;
    const isMuxed = video.acodec && video.acodec !== 'none';
    if (!isMuxed && !findAudioFormat(formats)) continue;
    const codec = video.vcodec?.split('.')[0] ?? 'unknown';
    const label = height >= 2160 ? '4K' : `${height}p`;
    let description = `${codec} + AAC`;
    if (hasSponsor) {
      description += ` | SponsorBlock: ${capped.length} segments skipped`;
    }
    streams.push({
      url: `${baseUrl}/play/${videoId}.mp4?q=${height}${sbParam}`,
      name: `[Tubio+] ${label}`,
      description,
      behaviorHints: { filename: `${videoId}-${height}p.mp4`, bingeGroup: `tubioplus-${height}p`, notWebReady: true },
    });
  }
  return streams;
}
