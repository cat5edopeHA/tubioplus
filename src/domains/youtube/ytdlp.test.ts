import { describe, it, expect } from 'vitest';
import { buildYtDlpArgs, parseVideoInfo } from './ytdlp.js';

describe('buildYtDlpArgs', () => {
  it('includes base args for video info', () => {
    const args = buildYtDlpArgs('dQw4w9WgXcQ', { type: 'info' });
    expect(args).toContain('--no-warnings');
    expect(args).toContain('--no-cache-dir');
    expect(args).toContain('--no-playlist');
    expect(args).toContain('-J');
    expect(args).toContain('--referer');
    expect(args).toContain('https://www.youtube.com');
    expect(args[args.length - 1]).toContain('youtube.com/watch?v=dQw4w9WgXcQ');
  });
  it('includes cookie file arg when cookies provided', () => {
    const args = buildYtDlpArgs('dQw4w9WgXcQ', { type: 'info', cookieFile: '/tmp/cookies.txt' });
    expect(args).toContain('--cookies');
    expect(args).toContain('/tmp/cookies.txt');
  });
  it('includes browser cookies arg when specified', () => {
    const args = buildYtDlpArgs('dQw4w9WgXcQ', { type: 'info', browserCookies: true });
    expect(args).toContain('--cookies-from-browser');
    expect(args).toContain('chromium');
  });
  it('builds search args correctly', () => {
    const args = buildYtDlpArgs('', { type: 'search', query: 'test query', limit: 20 });
    expect(args).toContain('--flat-playlist');
    expect(args.some((a) => a.includes('ytsearch20:test query'))).toBe(true);
  });
});

describe('parseVideoInfo', () => {
  it('parses valid JSON output', () => {
    const json = JSON.stringify({ id: 'test123abcd', title: 'Test Video', duration: 120, formats: [] });
    const info = parseVideoInfo(json);
    expect(info.id).toBe('test123abcd');
    expect(info.title).toBe('Test Video');
  });
  it('throws on invalid JSON', () => {
    expect(() => parseVideoInfo('not json')).toThrow();
  });
});
