import { cache } from './cache.js';

const DEARROW_API = 'https://sponsor.ajay.app/api/branding';

/**
 * Fetch DeArrow branding (community title and thumbnail)
 */
export async function getDeArrowBranding(videoId) {
  const cacheKey = `dearrow:${videoId}`;
  const cached = cache.get(cacheKey);
  if (cached !== null) return cached;

  try {
    const url = `${DEARROW_API}?videoID=${videoId}`;
    const response = await fetch(url, { timeout: 5000 });

    if (!response.ok) {
      cache.set(cacheKey, null, 300);
      return null;
    }

    const branding = await response.json();

    // Return null if no title and thumbnail suggestions
    if (!branding.titles?.length && !branding.thumbnails?.length) {
      cache.set(cacheKey, null, 300);
      return null;
    }

    const result = {
      title: null,
      thumbnail: null
    };

    // Get highest voted title
    if (branding.titles?.length > 0) {
      const topTitle = branding.titles.reduce((a, b) =>
        (a.votes || 0) > (b.votes || 0) ? a : b
      );
      result.title = topTitle.title;
    }

    // Get highest voted thumbnail
    if (branding.thumbnails?.length > 0) {
      const topThumb = branding.thumbnails.reduce((a, b) =>
        (a.votes || 0) > (b.votes || 0) ? a : b
      );
      result.thumbnail = topThumb.url;
    }

    cache.set(cacheKey, result, 3600); // 1 hour
    return result;
  } catch (err) {
    console.error(`Error fetching DeArrow branding for ${videoId}:`, err.message);
    cache.set(cacheKey, null, 300);
    return null;
  }
}

/**
 * Check if DeArrow is available
 */
export async function isDeArrowAvailable() {
  const cacheKey = 'dearrow:status';
  const cached = cache.get(cacheKey);
  if (cached !== null) return cached;

  try {
    const response = await fetch(`${DEARROW_API}?videoID=jNQXAC9IVRw`, {
      timeout: 3000
    });
    const available = response.ok;
    cache.set(cacheKey, available, 300); // 5 minutes
    return available;
  } catch (err) {
    console.warn('DeArrow unavailable:', err.message);
    cache.set(cacheKey, false, 60); // 1 minute
    return false;
  }
}
