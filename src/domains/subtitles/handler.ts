import type { VideoInfo, SubtitleTrack } from '../youtube/types.js';
import type { StremioSubtitle } from '../stremio/types.js';

const FORMAT_PRIORITY = ['srt', 'vtt'];

function selectBestTrack(tracks: SubtitleTrack[]): SubtitleTrack | undefined {
  for (const format of FORMAT_PRIORITY) {
    const match = tracks.find((t) => t.ext === format);
    if (match) return match;
  }
  return tracks[0];
}

export function buildSubtitleList(info: VideoInfo): StremioSubtitle[] {
  const result: StremioSubtitle[] = [];

  if (info.subtitles) {
    for (const [lang, tracks] of Object.entries(info.subtitles)) {
      const best = selectBestTrack(tracks);
      if (best) result.push({ id: `${lang}`, url: best.url, lang });
    }
  }

  if (info.automatic_captions) {
    for (const [lang, tracks] of Object.entries(info.automatic_captions)) {
      const best = selectBestTrack(tracks);
      if (best) result.push({ id: `Auto ${lang}`, url: best.url, lang });
    }
  }

  return result;
}
