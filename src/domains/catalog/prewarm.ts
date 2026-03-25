import type { YtDlpService } from '../youtube/ytdlp.js';

export function prewarmVideoInfo(
  ytdlp: YtDlpService,
  videoIds: string[],
  cookieFile?: string,
  browserCookies?: boolean,
): void {
  const idsToWarm = videoIds.slice(0, 10);
  for (const id of idsToWarm) {
    ytdlp.getVideoInfo(id, cookieFile, browserCookies).catch(() => {});
  }
}
