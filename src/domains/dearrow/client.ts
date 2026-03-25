import type { DeArrowBranding, DeArrowApiResponse } from './types.js';
import { Cache } from '../../infrastructure/cache.js';

const API_BASE = 'https://sponsor.ajay.app/api/branding';

export class DeArrowClient {
  private cache = new Cache<DeArrowBranding>();

  async getBranding(videoId: string): Promise<DeArrowBranding> {
    const cacheKey = `da:${videoId}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;
    try {
      const response = await fetch(`${API_BASE}?videoID=${videoId}`, { signal: AbortSignal.timeout(5000) });
      if (!response.ok) return {};
      const data = (await response.json()) as DeArrowApiResponse;
      const branding: DeArrowBranding = {};
      const communityTitle = data.titles?.filter((t) => !t.original).sort((a, b) => b.votes - a.votes)[0];
      if (communityTitle) branding.title = communityTitle.title;
      const communityThumb = data.thumbnails?.filter((t) => !t.original).sort((a, b) => b.votes - a.votes)[0];
      if (communityThumb) branding.thumbnail = communityThumb.thumbnail;
      this.cache.set(cacheKey, branding, 3600);
      return branding;
    } catch { return {}; }
  }
}
