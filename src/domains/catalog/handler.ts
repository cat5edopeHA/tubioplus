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

export function buildCatalogMetas(results: SearchResult[], brandings?: Map<string, DeArrowBranding>): StremioMetaPreview[] {
  return results.map((r) => {
    const branding = brandings?.get(r.id);
    return {
      id: `yt:${r.id}`,
      type: 'YouTube',
      name: branding?.title ?? r.title,
      poster: branding?.thumbnail ?? r.thumbnail ?? '',
      posterShape: 'landscape' as const,
    };
  });
}
