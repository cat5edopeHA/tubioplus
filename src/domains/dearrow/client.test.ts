import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DeArrowClient } from './client.js';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('DeArrowClient', () => {
  let client: DeArrowClient;
  beforeEach(() => { client = new DeArrowClient(); mockFetch.mockReset(); });

  it('returns community title and thumbnail', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ titles: [{ title: 'Better Title', votes: 10, original: false }], thumbnails: [{ thumbnail: '123.jpg', votes: 5, original: false }] }) });
    const result = await client.getBranding('testVideoId1');
    expect(result.title).toBe('Better Title');
  });
  it('skips original titles', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ titles: [{ title: 'Original', votes: 10, original: true }], thumbnails: [] }) });
    expect((await client.getBranding('testVideoId1')).title).toBeUndefined();
  });
  it('returns empty branding on error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('network'));
    const result = await client.getBranding('testVideoId1');
    expect(result.title).toBeUndefined();
  });
});
