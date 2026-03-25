import { describe, it, expect } from 'vitest';
import { manifest } from './manifest.js';

describe('manifest', () => {
  it('has required fields', () => { expect(manifest.id).toBe('yt.stremio.addon'); expect(manifest.name).toBe('Tubio+'); expect(manifest.version).toBeDefined(); });
  it('declares YouTube type', () => { expect(manifest.types).toContain('YouTube'); });
  it('declares yt: id prefix', () => { expect(manifest.idPrefixes).toContain('yt:'); });
  it('has 5 catalogs', () => { expect(manifest.catalogs).toHaveLength(5); const ids = manifest.catalogs.map(c => c.id); expect(ids).toContain('yt:recommendations'); expect(ids).toContain('yt:search'); expect(ids).toContain('yt:subscriptions'); expect(ids).toContain('yt:history'); expect(ids).toContain('yt:watchlater'); });
  it('search catalog has required search extra', () => { const search = manifest.catalogs.find(c => c.id === 'yt:search'); expect(search?.extra?.[0]?.name).toBe('search'); expect(search?.extra?.[0]?.isRequired).toBe(true); });
  it('declares all 4 resources', () => { expect(manifest.resources).toEqual(['catalog', 'meta', 'stream', 'subtitles']); });
  it('is configurable but not required', () => { expect(manifest.behaviorHints.configurable).toBe(true); expect(manifest.behaviorHints.configurationRequired).toBe(false); });
});
