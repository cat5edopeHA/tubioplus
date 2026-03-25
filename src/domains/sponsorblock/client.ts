import type { SkipSegment } from './types.js';
import { Cache } from '../../infrastructure/cache.js';

const API_BASE = 'https://sponsor.ajay.app/api';

export class SponsorBlockClient {
  private cache = new Cache<SkipSegment[]>();

  async getSkipSegments(videoId: string, categories: string[]): Promise<SkipSegment[]> {
    const cacheKey = `sb:${videoId}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;
    try {
      const params = new URLSearchParams({ videoID: videoId, categories: JSON.stringify(categories) });
      const response = await fetch(`${API_BASE}/skipSegments?${params}`, { signal: AbortSignal.timeout(5000) });
      if (!response.ok) return [];
      const segments = (await response.json()) as SkipSegment[];
      this.cache.set(cacheKey, segments, 300);
      return segments;
    } catch { return []; }
  }
}
