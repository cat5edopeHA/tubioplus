import type { StremioManifest } from './types.js';

export const manifest: StremioManifest = {
  id: 'yt.stremio.addon',
  name: 'Tubio+',
  version: '2.0.0',
  description: 'YouTube addon for Stremio',
  types: ['YouTube'],
  idPrefixes: ['yt:'],
  catalogs: [
    { type: 'YouTube', id: 'yt:recommendations', name: 'Recommendations' },
    { type: 'YouTube', id: 'yt:search', name: 'Search', extra: [{ name: 'search', isRequired: true }] },
    { type: 'YouTube', id: 'yt:subscriptions', name: 'Subscriptions' },
    { type: 'YouTube', id: 'yt:history', name: 'History' },
    { type: 'YouTube', id: 'yt:watchlater', name: 'Watch Later' },
  ],
  resources: ['catalog', 'meta', 'stream', 'subtitles'],
  behaviorHints: { configurable: true, configurationRequired: false },
};
