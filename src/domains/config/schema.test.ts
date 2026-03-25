import { describe, it, expect } from 'vitest';
import { mergeWithDefaults, DEFAULT_CONFIG } from './schema.js';

describe('DEFAULT_CONFIG', () => {
  it('has expected default values', () => {
    expect(DEFAULT_CONFIG.cookies).toBe('');
    expect(DEFAULT_CONFIG.quality).toBe('1080');
    expect(DEFAULT_CONFIG.sponsorblock.enabled).toBe(false);
    expect(DEFAULT_CONFIG.dearrow.enabled).toBe(false);
  });
});
describe('mergeWithDefaults', () => {
  it('returns defaults for empty object', () => { expect(mergeWithDefaults({})).toEqual(DEFAULT_CONFIG); });
  it('overrides quality', () => { const r = mergeWithDefaults({ quality: '720' }); expect(r.quality).toBe('720'); expect(r.cookies).toBe(''); });
  it('deeply merges sponsorblock', () => { const r = mergeWithDefaults({ sponsorblock: { enabled: true } }); expect(r.sponsorblock.enabled).toBe(true); expect(r.sponsorblock.categories).toEqual(DEFAULT_CONFIG.sponsorblock.categories); });
  it('deeply merges dearrow', () => { expect(mergeWithDefaults({ dearrow: { enabled: true } }).dearrow.enabled).toBe(true); });
});
