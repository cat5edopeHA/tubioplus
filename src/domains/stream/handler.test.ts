// src/domains/stream/handler.test.ts
import { describe, it, expect } from 'vitest';
import { buildStreamList } from './handler.js';
import type { VideoFormat } from '../youtube/types.js';

const formats: VideoFormat[] = [
  { format_id: '313', ext: 'webm', width: 3840, height: 2160, vcodec: 'vp9', acodec: 'none', url: 'https://example.com/4k', tbr: 12000 },
  { format_id: '137', ext: 'mp4', width: 1920, height: 1080, vcodec: 'avc1.640028', acodec: 'none', url: 'https://example.com/1080', tbr: 4000 },
  { format_id: '136', ext: 'mp4', width: 1280, height: 720, vcodec: 'avc1.4d401f', acodec: 'none', url: 'https://example.com/720', tbr: 2500 },
  { format_id: '135', ext: 'mp4', width: 854, height: 480, vcodec: 'avc1.4d401e', acodec: 'none', url: 'https://example.com/480', tbr: 1000 },
  { format_id: '18', ext: 'mp4', width: 640, height: 360, vcodec: 'avc1.42001E', acodec: 'mp4a.40.2', url: 'https://example.com/360', tbr: 500 },
  { format_id: '140', ext: 'm4a', vcodec: 'none', acodec: 'mp4a.40.2', url: 'https://example.com/audio', abr: 128 },
];

describe('buildStreamList', () => {
  const baseUrl = 'http://localhost:8000';
  it('returns streams for available qualities', () => { expect(buildStreamList(formats, 'dQw4w9WgXcQ', baseUrl, '1080').length).toBeGreaterThan(0); });
  it('respects max quality setting', () => {
    const streams = buildStreamList(formats, 'dQw4w9WgXcQ', baseUrl, '720');
    const heights = streams.map((s) => { const m = s.url.match(/q=(\d+)/); return m ? parseInt(m[1]) : 0; });
    expect(Math.max(...heights)).toBeLessThanOrEqual(720);
  });
  it('includes play URL with correct format', () => { expect(buildStreamList(formats, 'dQw4w9WgXcQ', baseUrl, '1080')[0].url).toMatch(/\/play\/dQw4w9WgXcQ\.mp4\?q=\d+/); });
  it('includes quality name in stream name', () => { expect(buildStreamList(formats, 'dQw4w9WgXcQ', baseUrl, '1080').some((s) => s.name?.includes('1080p'))).toBe(true); });
  it('sets filename in behaviorHints', () => { expect(buildStreamList(formats, 'dQw4w9WgXcQ', baseUrl, '1080')[0].behaviorHints?.filename).toContain('.mp4'); });
  it('returns empty array when no formats available', () => { expect(buildStreamList([], 'dQw4w9WgXcQ', baseUrl, '1080')).toEqual([]); });
  it('adds SponsorBlock note to description when segments provided', () => { expect(buildStreamList(formats, 'dQw4w9WgXcQ', baseUrl, '1080', 3)[0].description).toContain('SponsorBlock'); });
});
