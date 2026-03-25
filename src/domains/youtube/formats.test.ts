import { describe, it, expect } from 'vitest';
import { findVideoFormat, findAudioFormat } from './formats.js';
import type { VideoFormat } from './types.js';

const h264_1080: VideoFormat = { format_id: '137', ext: 'mp4', width: 1920, height: 1080, vcodec: 'avc1.640028', acodec: 'none', url: 'https://example.com/1080', tbr: 4000 };
const h264_720: VideoFormat = { format_id: '136', ext: 'mp4', width: 1280, height: 720, vcodec: 'avc1.4d401f', acodec: 'none', url: 'https://example.com/720', tbr: 2500 };
const h264_480: VideoFormat = { format_id: '135', ext: 'mp4', width: 854, height: 480, vcodec: 'avc1.4d401e', acodec: 'none', url: 'https://example.com/480', tbr: 1000 };
const h264_360_muxed: VideoFormat = { format_id: '18', ext: 'mp4', width: 640, height: 360, vcodec: 'avc1.42001E', acodec: 'mp4a.40.2', url: 'https://example.com/360', tbr: 500 };
const vp9_4k: VideoFormat = { format_id: '313', ext: 'webm', width: 3840, height: 2160, vcodec: 'vp9', acodec: 'none', url: 'https://example.com/4k', tbr: 12000 };
const aac_audio: VideoFormat = { format_id: '140', ext: 'm4a', vcodec: 'none', acodec: 'mp4a.40.2', url: 'https://example.com/audio', abr: 128 };
const opus_audio: VideoFormat = { format_id: '251', ext: 'webm', vcodec: 'none', acodec: 'opus', url: 'https://example.com/opus', abr: 160 };

const allFormats = [h264_1080, h264_720, h264_480, h264_360_muxed, vp9_4k, aac_audio, opus_audio];

describe('findVideoFormat', () => {
  it('selects h264 at requested height when available', () => {
    const result = findVideoFormat(allFormats, 1080);
    expect(result?.format_id).toBe('137');
  });
  it('falls back to lower quality if requested height unavailable', () => {
    const result = findVideoFormat([h264_720, h264_480], 1080);
    expect(result?.format_id).toBe('136');
  });
  it('prefers h264 over vp9 at 1080p and below', () => {
    const vp9_1080: VideoFormat = { ...h264_1080, format_id: 'vp9-1080', vcodec: 'vp9' };
    const result = findVideoFormat([vp9_1080, h264_1080], 1080);
    expect(result?.vcodec).toContain('avc1');
  });
  it('accepts vp9/av1 at 4K', () => {
    const result = findVideoFormat(allFormats, 2160);
    expect(result?.format_id).toBe('313');
  });
  it('selects muxed stream for 360p', () => {
    const result = findVideoFormat(allFormats, 360);
    expect(result?.format_id).toBe('18');
    expect(result?.acodec).not.toBe('none');
  });
  it('returns undefined when no formats available', () => {
    expect(findVideoFormat([], 1080)).toBeUndefined();
  });
});

describe('findAudioFormat', () => {
  it('prefers AAC over opus', () => {
    const result = findAudioFormat(allFormats);
    expect(result?.acodec).toContain('mp4a');
  });
  it('returns highest bitrate AAC', () => {
    const aac_low: VideoFormat = { ...aac_audio, format_id: 'aac-low', abr: 64 };
    const result = findAudioFormat([aac_low, aac_audio]);
    expect(result?.format_id).toBe('140');
  });
  it('returns undefined when no audio-only formats', () => {
    expect(findAudioFormat([h264_1080])).toBeUndefined();
  });
});
