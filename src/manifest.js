export const manifest = {
  id: 'yt.stremio.addon',
  name: 'YouTube for Stremio',
  description: 'Stream YouTube videos directly in Stremio Lite on iOS and tvOS',
  version: '1.0.0',
  types: ['channel'],
  idPrefixes: ['yt:'],
  catalogs: [
    {
      type: 'channel',
      id: 'yt:trending',
      name: 'YouTube Trending',
      extra: [
        {
          name: 'search',
          isRequired: false
        }
      ]
    },
    {
      type: 'channel',
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
      type: 'channel',
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
      type: 'channel',
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
      type: 'channel',
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
