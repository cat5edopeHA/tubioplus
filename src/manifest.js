export const manifest = {
  id: 'yt.stremio.addon',
  name: 'YouTube for Stremio',
  description: 'Stream YouTube videos directly in Stremio Lite on iOS and tvOS',
  version: '1.1.0',
  types: ['YouTube'],
  idPrefixes: ['yt:'],
  catalogs: [
    {
      type: 'YouTube',
      id: 'yt:recommendations',
      name: 'Recommended',
      extra: [
        {
          name: 'search',
          isRequired: false
        }
      ]
    },
    {
      type: 'YouTube',
      id: 'yt:search',
      name: 'YouTube Search',
      extra: [
        {
          name: 'search',
          isRequired: true
        }
      ]
    },
    {
      type: 'YouTube',
      id: 'yt:subscriptions',
      name: 'Your Subscriptions',
      extra: [
        {
          name: 'search',
          isRequired: false
        }
      ]
    },
    {
      type: 'YouTube',
      id: 'yt:history',
      name: 'Watch History',
      extra: [
        {
          name: 'search',
          isRequired: false
        }
      ]
    },
    {
      type: 'YouTube',
      id: 'yt:watchlater',
      name: 'Watch Later',
      extra: [
        {
          name: 'search',
          isRequired: false
        }
      ]
    }
  ],
  resources: [
    'catalog',
    'meta',
    'stream',
    'subtitles'
  ],
  behaviorHints: {
    configurable: true,
    configurationRequired: false
  }
};
