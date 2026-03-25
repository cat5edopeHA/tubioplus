import { describe, it, expect } from 'vitest';
import { isValidVideoId, extractVideoId } from './validation.js';

describe('isValidVideoId', () => {
  it('accepts valid 11-char video IDs', () => {
    expect(isValidVideoId('dQw4w9WgXcQ')).toBe(true);
    expect(isValidVideoId('abc123_-XYZ')).toBe(true);
  });
  it('rejects IDs shorter than 11 chars', () => {
    expect(isValidVideoId('abc')).toBe(false);
    expect(isValidVideoId('')).toBe(false);
  });
  it('rejects IDs longer than 11 chars', () => {
    expect(isValidVideoId('dQw4w9WgXcQx')).toBe(false);
  });
  it('rejects IDs with invalid characters', () => {
    expect(isValidVideoId('dQw4w9WgXc!')).toBe(false);
    expect(isValidVideoId('dQw4w9WgXc ')).toBe(false);
    expect(isValidVideoId('dQw4w9WgXc.')).toBe(false);
  });
  it('strips yt: prefix before validating', () => {
    expect(isValidVideoId('yt:dQw4w9WgXcQ')).toBe(true);
    expect(isValidVideoId('yt:abc')).toBe(false);
  });
});

describe('extractVideoId', () => {
  it('strips yt: prefix', () => {
    expect(extractVideoId('yt:dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });
  it('returns ID unchanged when no prefix', () => {
    expect(extractVideoId('dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });
});
