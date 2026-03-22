import { cache } from './cache.js';

const SPONSORBLOCK_API = 'https://sponsor.ajay.app/api';

/**
 * Fetch skip segments from SponsorBlock API
 */
export async function getSkipSegments(videoId, categories = []) {
  const cacheKey = `sponsorblock:${videoId}:${categories.join(',')}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  try {
    const categoryParam = JSON.stringify(categories);
    const url = `${SPONSORBLOCK_API}/skipSegments?videoID=${videoId}&categories=${encodeURIComponent(categoryParam)}`;

    const response = await fetch(url, { timeout: 5000 });
    if (!response.ok) {
      return [];
    }

    const segments = await response.json();
    const result = Array.isArray(segments) ? segments : [];

    cache.set(cacheKey, result, 300); // 5 minutes
    return result;
  } catch (err) {
    console.error(`Error fetching SponsorBlock segments for ${videoId}:`, err.message);
    return [];
  }
}

/**
 * Build FFmpeg filter string to skip segments
 * Returns complex filter for video and audio
 */
export function buildSkipSegmentFilter(segments, duration) {
  if (!segments || segments.length === 0) {
    return null;
  }

  // Sort segments by start time
  const sorted = [...segments].sort((a, b) => a.segment[0] - b.segment[0]);

  // Build select filter to keep only non-sponsor times
  const videoFilter = buildSelectFilter(sorted, duration);
  const audioFilter = buildSelectFilter(sorted, duration);

  return {
    video: videoFilter,
    audio: audioFilter
  };
}

/**
 * Helper to build FFmpeg select filter
 */
function buildSelectFilter(segments, duration) {
  const times = [];

  // Add start
  times.push({ start: 0, type: 'keep' });

  for (const seg of segments) {
    const [segStart, segEnd] = seg.segment;
    times.push({ time: segStart, type: 'end' });
    times.push({ time: segEnd, type: 'start' });
  }

  // Add end
  times.push({ start: duration, type: 'keep' });

  // Build expression
  let conditions = [];
  let currentTime = 0;

  for (const seg of segments) {
    const [segStart, segEnd] = seg.segment;
    if (currentTime < segStart) {
      conditions.push(`(t>=${currentTime} && t<${segStart})`);
    }
    currentTime = segEnd;
  }

  if (currentTime < duration) {
    conditions.push(`(t>=${currentTime} && t<=${duration})`);
  }

  if (conditions.length === 0) {
    return 'select=1';
  }

  return `select='${conditions.join('|')}',setpts=N/(FRAME_RATE*TB)`;
}

/**
 * Check if SponsorBlock is available (simple connectivity test)
 */
export async function isSponsorBlockAvailable() {
  const cacheKey = 'sponsorblock:status';
  const cached = cache.get(cacheKey);
  if (cached !== null) return cached;

  try {
    const response = await fetch(`${SPONSORBLOCK_API}/skipSegments?videoID=jNQXAC9IVRw`, {
      timeout: 3000
    });
    const available = response.ok;
    cache.set(cacheKey, available, 300); // 5 minutes
    return available;
  } catch (err) {
    console.warn('SponsorBlock unavailable:', err.message);
    cache.set(cacheKey, false, 60); // 1 minute
    return false;
  }
}
