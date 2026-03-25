import { describe, it, expect } from 'vitest';
import { buildMeta } from './handler.js';
import type { VideoInfo } from '../youtube/types.js';

const baseInfo: VideoInfo = {
  id: 'dQw4w9WgXcQ',
  title: 'Test Video Title',
  description: 'A test description',
  thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
  duration: 212,
  upload_date: '20091025',
  uploader: 'Test Channel',
  channel_url: 'https://www.youtube.com/channel/UC1234',
};

describe('buildMeta', () => {
  it('maps basic fields correctly', () => {
    const meta = buildMeta(baseInfo);
    expect(meta.id).toBe('yt:dQw4w9WgXcQ');
    expect(meta.type).toBe('YouTube');
    expect(meta.name).toBe('Test Video Title');
    expect(meta.poster).toBe(baseInfo.thumbnail);
    expect(meta.posterShape).toBe('landscape');
    expect(meta.description).toBe('A test description');
  });

  it('formats release year from upload_date', () => {
    expect(buildMeta(baseInfo).releaseInfo).toBe('2009');
  });

  it('formats runtime in minutes', () => {
    expect(buildMeta(baseInfo).runtime).toBe('4m');
  });

  it('includes channel as link', () => {
    const meta = buildMeta(baseInfo);
    expect(meta.links).toBeDefined();
    expect(meta.links![0].name).toBe('Test Channel');
    expect(meta.links![0].category).toBe('channel');
  });

  it('sets defaultVideoId in behaviorHints', () => {
    expect(buildMeta(baseInfo).behaviorHints?.defaultVideoId).toBe(
      'yt:dQw4w9WgXcQ',
    );
  });

  it('applies DeArrow title when provided', () => {
    expect(buildMeta(baseInfo, { title: 'Better Title' }).name).toBe(
      'Better Title',
    );
  });

  it('applies DeArrow thumbnail when provided', () => {
    expect(
      buildMeta(baseInfo, { thumbnail: 'https://dearrow.com/thumb.jpg' })
        .poster,
    ).toBe('https://dearrow.com/thumb.jpg');
  });

  it('handles missing optional fields', () => {
    const minimal: VideoInfo = { id: 'test123abcd', title: 'Minimal' };
    const meta = buildMeta(minimal);
    expect(meta.name).toBe('Minimal');
    expect(meta.runtime).toBeUndefined();
    expect(meta.links).toEqual([]);
  });
});
