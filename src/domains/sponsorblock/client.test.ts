import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SponsorBlockClient } from './client.js';
import type { SkipSegment } from './types.js';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('SponsorBlockClient', () => {
  let client: SponsorBlockClient;
  beforeEach(() => { client = new SponsorBlockClient(); mockFetch.mockReset(); });

  it('fetches skip segments for a video', async () => {
    const segments: SkipSegment[] = [{ segment: [0, 30], category: 'sponsor', UUID: 'abc', votes: 5, locked: 0 }];
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(segments) });
    const result = await client.getSkipSegments('testVideoId1', ['sponsor']);
    expect(result).toHaveLength(1);
    expect(result[0].category).toBe('sponsor');
  });
  it('returns empty array on 404', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });
    expect(await client.getSkipSegments('testVideoId1', ['sponsor'])).toEqual([]);
  });
  it('returns empty array on network error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('network error'));
    expect(await client.getSkipSegments('testVideoId1', ['sponsor'])).toEqual([]);
  });
});
