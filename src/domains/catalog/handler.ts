import type { SearchResult } from '../youtube/types.js';
import type { StremioMetaPreview } from '../stremio/types.js';
import type { DeArrowBranding } from '../dearrow/types.js';

export interface ExtraParams { search?: string; skip: number; }

export function parseExtraParams(extra: string): ExtraParams {
  const params: ExtraParams = { skip: 0 };
  if (!extra) return params;
  const pairs = extra.split('&');
  for (const pair of pairs) {
    const [key, value] = pair.split('=');
    if (key === 'search') params.search = decodeURIComponent(value ?? '');
    if (key === 'skip') params.skip = parseInt(value ?? '0', 10);
  }
  return params;
}

export function paginateResults<T>(items: T[], skip: number, catalogLimit: number): T[] {
  if (skip >= catalogLimit) return [];
  const pageSize = skip === 0 ? 20 : 10;
  const remaining = catalogLimit - skip;
  const count = Math.min(pageSize, remaining);
  return items.slice(skip, skip + count);
}

/** Pick the highest resolution thumbnail URL from the yt-dlp thumbnails array */
function bestThumbnail(thumbnails?: Array<{ url: string; height?: number; width?: number }>): string | undefined {
  if (!thumbnails || thumbnails.length === 0) return undefined;
  // yt-dlp typically orders smallest to largest, so last entry is best.
  // But sort explicitly by height to be safe.
  let best = thumbnails[0];
  for (const t of thumbnails) {
    if ((t.height ?? 0) > (best.height ?? 0)) {
      best = t;
    }
  }
  return best.url;
}

export function buildCatalogMetas(results: SearchResult[], brandings?: Map<string, DeArrowBranding>): StremioMetaPreview[] {
  return results.map((r) => {
    const branding = brandings?.get(r.id);
    return {
      id: `yt:${r.id}`,
      type: 'YouTube',
      name: branding?.title ?? r.title,
      poster: branding?.thumbnail ?? r.thumbnail ?? bestThumbnail(r.thumbnails) ?? '',
      posterShape: 'landscape' as const,
    };
  });
}
