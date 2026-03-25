import { describe, it, expect } from 'vitest';
import { parseExtraParams, buildCatalogMetas, paginateResults } from './handler.js';
import type { SearchResult } from '../youtube/types.js';

describe('parseExtraParams', () => {
  it('parses search query', () => { expect(parseExtraParams('search=test%20query').search).toBe('test query'); });
  it('parses skip parameter', () => { expect(parseExtraParams('search=test&skip=20').skip).toBe(20); });
  it('returns defaults for empty string', () => { const p = parseExtraParams(''); expect(p.search).toBeUndefined(); expect(p.skip).toBe(0); });
});

describe('paginateResults', () => {
  const items = Array.from({ length: 50 }, (_, i) => ({ id: `vid${i}` }));
  it('returns 20 items for first page (skip=0)', () => { expect(paginateResults(items as any[], 0, 100)).toHaveLength(20); });
  it('returns 10 items for subsequent pages', () => { expect(paginateResults(items as any[], 20, 100)).toHaveLength(10); });
  it('respects catalog limit', () => { expect(paginateResults(items as any[], 0, 15)).toHaveLength(15); });
  it('returns empty when skip exceeds limit', () => { expect(paginateResults(items as any[], 100, 100)).toHaveLength(0); });
});

describe('buildCatalogMetas', () => {
  it('maps search results to Stremio meta previews', () => {
    const results: SearchResult[] = [{ id: 'dQw4w9WgXcQ', title: 'Test Video', thumbnail: 'https://example.com/thumb.jpg', duration: 120, uploader: 'Channel' }];
    const metas = buildCatalogMetas(results);
    expect(metas[0].id).toBe('yt:dQw4w9WgXcQ'); expect(metas[0].type).toBe('YouTube'); expect(metas[0].name).toBe('Test Video');
  });
  it('applies DeArrow branding when provided', () => {
    const results: SearchResult[] = [{ id: 'dQw4w9WgXcQ', title: 'Original', thumbnail: 'https://example.com/thumb.jpg' }];
    const brandings = new Map([['dQw4w9WgXcQ', { title: 'Better Title' }]]);
    expect(buildCatalogMetas(results, brandings)[0].name).toBe('Better Title');
  });
});
