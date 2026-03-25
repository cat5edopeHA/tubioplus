import { describe, it, expect } from 'vitest';
import { buildSubtitleList } from './handler.js';
import type { VideoInfo, SubtitleTrack } from '../youtube/types.js';

function makeVideoInfo(
  subtitles: Record<string, SubtitleTrack[]>,
  automatic_captions: Record<string, SubtitleTrack[]> = {},
): VideoInfo {
  return { id: 'test123abcd', title: 'Test', subtitles, automatic_captions };
}

describe('buildSubtitleList', () => {
  it('returns empty array for no subtitles', () => {
    expect(buildSubtitleList(makeVideoInfo({}))).toEqual([]);
  });

  it('extracts manual subtitles', () => {
    const info = makeVideoInfo({ en: [{ ext: 'srt', url: 'https://example.com/en.srt' }] });
    const result = buildSubtitleList(info);
    expect(result).toHaveLength(1);
    expect(result[0].lang).toBe('en');
    expect(result[0].url).toContain('.srt');
  });

  it('prefers SRT over VTT', () => {
    const info = makeVideoInfo({
      en: [
        { ext: 'vtt', url: 'https://example.com/en.vtt' },
        { ext: 'srt', url: 'https://example.com/en.srt' },
      ],
    });
    expect(buildSubtitleList(info)[0].url).toContain('.srt');
  });

  it('falls back to VTT if no SRT', () => {
    const info = makeVideoInfo({ en: [{ ext: 'vtt', url: 'https://example.com/en.vtt' }] });
    expect(buildSubtitleList(info)[0].url).toContain('.vtt');
  });

  it('prefixes auto captions with "Auto"', () => {
    const info = makeVideoInfo(
      {},
      { en: [{ ext: 'vtt', url: 'https://example.com/auto-en.vtt', name: 'English' }] },
    );
    expect(buildSubtitleList(info)[0].id).toContain('Auto');
  });

  it('places manual subtitles before auto captions', () => {
    const info = makeVideoInfo(
      { en: [{ ext: 'srt', url: 'https://example.com/en.srt' }] },
      { fr: [{ ext: 'vtt', url: 'https://example.com/auto-fr.vtt' }] },
    );
    const result = buildSubtitleList(info);
    expect(result[0].id).not.toContain('Auto');
    expect(result[1].id).toContain('Auto');
  });

  it('handles multiple languages', () => {
    const info = makeVideoInfo({
      en: [{ ext: 'srt', url: 'https://example.com/en.srt' }],
      es: [{ ext: 'vtt', url: 'https://example.com/es.vtt' }],
    });
    expect(buildSubtitleList(info)).toHaveLength(2);
  });
});
