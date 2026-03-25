import type { VideoInfo } from '../youtube/types.js';
import type { StremioMeta } from '../stremio/types.js';
import type { DeArrowBranding } from '../dearrow/types.js';

export function buildMeta(
  info: VideoInfo,
  dearrow?: DeArrowBranding,
): StremioMeta {
  const links = [];
  if (info.uploader && info.channel_url) {
    links.push({
      name: info.uploader,
      category: 'channel',
      url: info.channel_url,
    });
  }

  return {
    id: `yt:${info.id}`,
    type: 'YouTube',
    name: dearrow?.title ?? info.title,
    poster: dearrow?.thumbnail ?? info.thumbnail ?? '',
    posterShape: 'landscape',
    description: info.description,
    releaseInfo: info.upload_date ? info.upload_date.slice(0, 4) : undefined,
    runtime: info.duration ? `${Math.round(info.duration / 60)}m` : undefined,
    links,
    behaviorHints: { defaultVideoId: `yt:${info.id}` },
  };
}
