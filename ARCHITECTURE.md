# Architecture Documentation

Deep dive into the yt-stremio addon architecture, design decisions, and technical implementation.

## Overview

yt-stremio is a Stremio addon that streams YouTube videos directly in Stremio, with special optimization for iOS/tvOS via Stremio Lite.

```
┌─────────────────┐
│ Stremio Client  │ (iOS/tvOS/Web)
│ (Stremio Lite)  │
└────────┬────────┘
         │ HTTP REST
         ▼
┌──────────────────────────┐
│   yt-stremio Addon       │
│  ┌────────────────────┐  │
│  │  Express.js Routes │  │
│  ├────────────────────┤  │
│  │ /manifest.json     │  │
│  │ /catalog/:config/* │  │
│  │ /meta/:config/*    │  │
│  │ /stream/:config/*  │  │
│  │ /play/:videoId    │  │
│  └────────────────────┘  │
│  ┌────────────────────┐  │
│  │    Services       │  │
│  ├────────────────────┤  │
│  │ yt-dlp (YouTube)  │  │
│  │ FFmpeg (Muxing)   │  │
│  │ SponsorBlock API  │  │
│  │ DeArrow API       │  │
│  │ Cache Layer       │  │
│  └────────────────────┘  │
└──────────┬───────────────┘
           │
     ┌─────┴─────────────────┐
     │                       │
     ▼                       ▼
┌──────────────┐      ┌──────────────┐
│ YouTube.com  │      │ APIs:        │
│ (via yt-dlp) │      │ SponsorBlock │
│              │      │ DeArrow      │
└──────────────┘      └──────────────┘
```

## Design Philosophy

### 1. No SDK Dependency

**Why not use `stremio-addon-sdk`?**

The official SDK is great for general purposes but adds constraints:

- **URL Stream Priority**: SDK encourages `url` streams but Stremio Lite on iOS hides them by default
- **Player Assumptions**: SDK streams assume Stremio Player, which doesn't work on iOS
- **Configuration Handling**: SDK's config system doesn't support encryption for sensitive data
- **FFmpeg Integration**: SDK doesn't provide native spawning of external processes

**Decision**: Implement Stremio REST API directly using Express.js for:
- Full control over stream types
- Native FFmpeg integration
- Encrypted configuration support
- iOS optimization

### 2. iOS Compatibility First

**The iOS Problem**:
YouTube only provides:
- itag 18: 360p muxed (h264 + AAC) - ready to stream
- DASH streams: Separate video (h264/vp9) + audio (aac/opus)

Stremio Lite on iOS:
- Only plays `url` type streams
- Displays these as "unsupported" by default
- Can't open URLs with custom schemes
- Must use HTTP/HTTPS URLs

**Solution**:
- Redirect 360p to YouTube's native itag 18
- For higher quality: spawn FFmpeg to mux on-demand
- Never use `ytId` (opens YouTube app) or `externalUrl` (opens Safari)

### 3. Fresh YouTube URLs on Every Play

**The Problem**:
YouTube CDN URLs expire after a few hours. Caching them doesn't work.

**Solution**:
- Call yt-dlp fresh on every `/play/` request
- Get current, valid streaming URLs
- Pass immediately to FFmpeg
- No intermediate storage

**Trade-off**: Slightly slower first play (yt-dlp extraction ~2-3 seconds), but guarantees working URLs.

## Core Components

### Express Application (`src/index.js`)

```javascript
// REST API server
app.get('/manifest.json')           // Addon metadata
app.get('/')                        // Redirect to /configure
app.use('/configure', ...)          // Configuration routes
app.use('/', catalogRouter)         // Catalog API
app.use('/', metaRouter)            // Meta API
app.use('/', streamRouter)          // Stream API
app.use('/', playRouter)            // Video playback
```

**CORS Headers**: All responses include:
```
Access-Control-Allow-Origin: *
```

This allows Stremio clients from any origin to access the addon.

### Configuration System (`src/config.js`)

**Encryption/Decryption**:

```
User Config (JSON)
    ↓
Stringify & serialize
    ↓
AES-256-CBC encryption with random IV
    ↓
IV + Encrypted data (hex)
    ↓
Base64URL encode
    ↓
URL-safe encrypted string
```

Example flow:
```javascript
// User enters: cookies=..., quality=720, sponsorblock=true
config = { cookies: "...", quality: "720", sponsorblock: { enabled: true, ... } }

// Encryption
encrypted = encryptConfig(config)
// Result: "eyJjb29raWVzIjoiLi4uIiwicXVhbGl0eSI6IjcyMCJ9..." (base64url)

// In URL
GET /eyJjb29raWVzIjoiLi4uIn0.../catalog/channel/yt:trending.json

// Decryption
config = decryptConfig("eyJjb29raWVzIjoiLi4uIn0...")
// Result: { cookies: "...", quality: "720", ... }
```

**Why encryption?**

- Prevents cookies from appearing in URL/logs/referrer
- Allows safe sharing of configuration links
- Prevents session hijacking if URL is logged
- Works over HTTPS for full security

### Catalog Handler (`src/routes/catalog.js`)

Implements Stremio catalog API:

```
GET /:config/catalog/:type/:id.json?extra[search]=QUERY

Types: channel
IDs:
  - yt:trending (no auth)
  - yt:search (no auth, requires search query)
  - yt:subscriptions (requires cookies)
  - yt:history (requires cookies)
  - yt:watchlater (requires cookies)
```

**Response Format**:
```json
{
  "metas": [
    {
      "id": "yt:dQw4w9WgXcQ",
      "type": "channel",
      "name": "Video Title",
      "poster": "https://...",
      "posterShape": "landscape"
    }
  ]
}
```

**yt-dlp Commands**:
- Trending: `yt-dlp -J "https://www.youtube.com/feed/trending"`
- Search: `yt-dlp -J "ytsearch20:QUERY"`
- Subscriptions: `yt-dlp -J --cookies cookies.txt "https://www.youtube.com/feed/subscriptions"`
- History: `yt-dlp -J --cookies cookies.txt "https://www.youtube.com/feed/history"`
- Watch Later: `yt-dlp -J --cookies cookies.txt "https://www.youtube.com/playlist?list=WL"`

### Meta Handler (`src/routes/meta.js`)

```
GET /:config/meta/:type/:id.json

Returns full video metadata:
```json
{
  "id": "yt:dQw4w9WgXcQ",
  "type": "channel",
  "name": "Rick Astley - Never Gonna Give You Up",
  "poster": "https://...",
  "description": "...",
  "releaseInfo": "2009",
  "runtime": "4m",
  "links": [
    {
      "name": "Rick Astley",
      "url": "https://www.youtube.com/@RickAstleyYC"
    }
  ],
  "behaviorHints": {
    "defaultVideoId": "yt:dQw4w9WgXcQ"
  }
}
```

**DeArrow Integration**:
If enabled, fetches from `sponsor.ajay.app/api/branding?videoID=ID`:
- Replaces title with community version
- Replaces poster with community thumbnail
- Uses highest-voted submissions

### Stream Handler (`src/routes/stream.js`)

```
GET /:config/stream/:type/:id.json

Returns available quality options:
```json
{
  "streams": [
    {
      "url": "https://yt.m2bw.net/CONFIG/play/dQw4w9WgXcQ.mp4?q=1080",
      "name": "1080p",
      "description": "h264 + AAC",
      "behaviorHints": {
        "bingeGroup": "yt-stremio",
        "filename": "Video_Title_1080p.mp4"
      }
    },
    {
      "url": "https://yt.m2bw.net/CONFIG/play/dQw4w9WgXcQ.mp4?q=720",
      "name": "720p",
      "description": "h264 + AAC",
      "behaviorHints": { ... }
    }
  ]
}
```

**Quality Selection Logic**:
1. Get available formats from yt-dlp
2. Filter for h264/avc1 video codec (iOS compatible)
3. Get up to user's max quality preference
4. Return as separate `url` streams

### Play Handler (`src/routes/play.js`) - The Critical Endpoint

This is where actual video streaming happens.

```
GET /:config/play/:videoId.mp4?q=QUALITY

Flow:
1. Validate videoId (11 chars: alphanumeric, dash, underscore)
2. Run yt-dlp fresh to get current YouTube CDN URLs
3. Select best h264 video stream at requested quality
4. Select best AAC audio stream
5. If 360p: redirect to YouTube's native itag 18
6. If higher: spawn FFmpeg to mux video + audio
7. Pipe FFmpeg stdout to HTTP response
8. Kill FFmpeg if client disconnects
```

**For 360p (Muxed Format)**:
```
YouTube provides itag 18 as ready-to-stream MP4
Client can directly play via URL redirect
No FFmpeg needed
```

**For 720p+ (DASH)**:
```
Video Stream (h264, ~height=720)
+
Audio Stream (AAC, 128-256kbps)
        ↓
FFmpeg muxing process:
        ↓
FFmpeg -i VIDEO_URL -i AUDIO_URL \
        -c:v copy -c:a copy \
        -movflags frag_keyframe+empty_moov+faststart \
        -f mp4 pipe:1
        ↓
HTTP response (video/mp4)
```

**FFmpeg Flags Explained**:
- `-c:v copy -c:a copy`: Copy streams without re-encoding (fast)
- `-movflags frag_keyframe`: Create fragmented MP4 for streaming
- `-movflags empty_moov`: Write moov atom before mdat (seekable)
- `-movflags faststart`: Optimize for streaming
- `-f mp4`: Output format
- `pipe:1`: Write to stdout

**Error Handling**:
- Invalid video ID → 400
- Video not found → 404
- Quality not available → 500 with error
- Client disconnect → Kill FFmpeg, end stream

### Services Layer

#### yt-dlp Service (`src/services/ytdlp.js`)

Wrapper around `yt-dlp` CLI tool.

**Key Functions**:

```javascript
// Get full video information
await getVideoInfo(videoId)
// Returns: { title, duration, formats[], ...}

// Search YouTube
await searchYouTube(query, limit=20)
// Returns: [{ title, url, thumbnail }, ...]

// Authenticated endpoints (require cookies)
await getSubscriptions(cookiesStr)
await getHistory(cookiesStr)
await getWatchLater(cookiesStr)

// Format selection
await getFormatInfo(videoId)      // Video formats
await getAudioInfo(videoId)       // Audio formats

// Utilities
isValidVideoId(videoId)           // Regex check
streamVideoWithFFmpeg(...)        // Spawn FFmpeg
```

**Process Execution**:
```javascript
execSync('yt-dlp -J "https://www.youtube.com/watch?v=ID"', {
  encoding: 'utf8',
  maxBuffer: 10 * 1024 * 1024,  // 10MB output limit
  timeout: 30000                 // 30 second timeout
})
```

#### Cache Service (`src/services/cache.js`)

Simple in-memory TTL cache.

```javascript
cache.set(key, value, ttlSeconds)
cache.get(key)  // Returns null if expired/missing
```

**TTL Strategy**:
- Search results: 5 min
- Video metadata: 1 hour
- Format info: 1 hour
- Trending: 10 min
- SponsorBlock: 5 min
- DeArrow: 1 hour

Reduces external API calls significantly.

#### SponsorBlock Service (`src/services/sponsorblock.js`)

Fetches skip segment metadata.

```
GET /api/skipSegments?videoID=ID&categories=JSON_ARRAY

Returns:
[
  {
    "segment": [10.5, 45.2],      // Start and end time in seconds
    "category": "sponsor",
    "votes": 42,
    "locked": false
  },
  ...
]
```

**Integration**:
- Fetches segments for videos when requested
- Stores as metadata (client-side implementation would need to skip)
- Available for future HLS-based implementation

#### DeArrow Service (`src/services/dearrow.js`)

Fetches community titles and thumbnails.

```
GET /api/branding?videoID=ID

Returns:
{
  "titles": [
    { "title": "Community Title", "votes": 50 },
    ...
  ],
  "thumbnails": [
    { "url": "https://...", "votes": 30 },
    ...
  ]
}
```

**Integration**:
- Optional (disabled by default)
- Replaces YouTube's clickbait with community versions
- Uses highest-voted submissions

## Request Flow Example

**User searches for "tutorial" on iOS**:

```
1. iOS Stremio App
   GET /CONFIG/catalog/channel/yt:search.json?search=tutorial

2. yt-stremio receives request
   - Decrypts CONFIG
   - Calls yt-dlp: ytsearch20:tutorial
   - Gets 20 video results

3. Process results
   - Extract video IDs, titles, thumbnails
   - Apply DeArrow if enabled
   - Return as catalog

4. iOS receives metas
   [
     { id: "yt:VIDEO_ID", name: "Tutorial Title", poster: "..." },
     ...
   ]

5. User taps video
   GET /CONFIG/meta/channel/yt:VIDEO_ID.json

6. yt-stremio returns metadata
   { title, description, runtime, ... }

7. User taps "Play"
   GET /CONFIG/stream/channel/yt:VIDEO_ID.json

8. yt-stremio returns stream options
   [
     { url: "...play/VIDEO_ID.mp4?q=1080", name: "1080p" },
     { url: "...play/VIDEO_ID.mp4?q=720", name: "720p" },
     ...
   ]

9. User selects quality
   iOS opens "unsupported stream"
   GET /CONFIG/play/VIDEO_ID.mp4?q=720
   (Must enable "Show Unsupported Streams" first)

10. yt-stremio play endpoint
    - Runs yt-dlp fresh
    - Gets current video + audio URLs
    - Spawns FFmpeg to mux
    - Streams to iOS

11. iOS plays video
    FFmpeg output → H.264 MP4 stream → iPhone screen
```

## Performance Characteristics

### Request Latencies

| Endpoint | First Call | Cached | Notes |
|----------|-----------|--------|-------|
| /manifest.json | <10ms | <5ms | Static |
| /catalog (search) | 2-5s | <100ms | yt-dlp extraction |
| /meta (single video) | 1-2s | <100ms | yt-dlp info |
| /stream (quality list) | 1-2s | <100ms | yt-dlp formats |
| /play (360p) | <500ms | N/A | Redirect only |
| /play (720p+) | 5-10s | N/A | FFmpeg muxing |

### Memory Usage

| Component | Typical | Peak |
|-----------|---------|------|
| Node.js base | 50MB | 50MB |
| 1 yt-dlp process | 200-400MB | 600MB |
| 1 FFmpeg process | 100-200MB | 300MB |
| Cache (1000 entries) | 10-20MB | 20MB |
| **Total (idle)** | **50-100MB** | N/A |
| **With 1 stream** | **150-300MB** | **400-500MB** |

### Network Bandwidth

| Operation | Bandwidth |
|-----------|-----------|
| 360p playback | 500-700 Mbps |
| 720p playback | 1.5-2 Mbps |
| 1080p playback | 2-4 Mbps |

YouTube's adaptive bitrate matches available bandwidth.

## Security Considerations

### Configuration Encryption

```
plaintext config
        ↓
JSON.stringify()
        ↓
AES-256-CBC encrypt with random IV
        ↓
base64url encode
        ↓
URL-safe config string
```

**Protection Against**:
- URL logging (encrypted)
- Referrer leakage (encrypted)
- Accidental sharing of cookies (encrypted)
- Man-in-the-middle (works with HTTPS)

### Cookie Handling

1. Cookies saved from browser (Netscape format)
2. Pasted into config form
3. Encrypted in URL
4. On request, temp file created with cookies
5. Cookies passed to yt-dlp
6. Temp file immediately deleted
7. Never logged or cached

### FFmpeg Security

- No shell execution (`spawn` with array args)
- Only accepts validated video IDs
- Only uses https://www.youtube.com referer header
- Killed on client disconnect
- No command injection vectors

## Scalability

### Horizontal Scaling

This addon can be deployed in multiple instances behind a load balancer:

```
Load Balancer (nginx, Pangolin)
     ↓
┌────────┬────────┬────────┐
│Instance│Instance│Instance│
│   1    │   2    │   3    │
└────────┴────────┴────────┘
```

**Stateless Design**:
- No in-memory state shared across instances
- Config is self-contained in URL
- Cache is local to each instance (doesn't matter)
- Each instance independently calls yt-dlp/FFmpeg

**Load Balancer Config** (nginx):
```nginx
upstream yt-stremio {
    least_conn;  # Prefer less-loaded instance
    server instance1:8000;
    server instance2:8000;
    server instance3:8000;
}

server {
    location / {
        proxy_pass http://yt-stremio;
        proxy_buffering off;  # Important for streaming
    }
}
```

### Vertical Scaling

For single-instance deployments, scale by:

1. **Increase memory**: More concurrent FFmpeg processes
2. **Increase CPU cores**: Faster yt-dlp extraction
3. **Increase ulimits**: More file descriptors for concurrent streams

Docker Compose example:
```yaml
yt-stremio:
  # ... config ...
  deploy:
    resources:
      limits:
        cpus: '4'
        memory: 4G
```

## Testing Strategy

See [TESTING.md](TESTING.md) for comprehensive testing procedures.

Key test areas:
- API endpoint responses
- Video format selection
- FFmpeg process management
- Config encryption/decryption
- Error handling
- iOS playback compatibility
- Performance under load

## Future Enhancements

1. **HLS Streaming**: Segment-based streaming for better mobile
2. **Segment Skipping**: Active SponsorBlock segment skipping
3. **Subtitle Support**: Fetch and serve YouTube subtitles
4. **Playlist Support**: Stream entire playlists
5. **Live Streaming**: Support for YouTube live streams
6. **WebRTC**: P2P streaming for better scalability
7. **Caching Layer**: Redis for distributed cache
8. **Analytics**: Track popular videos/queries
9. **UI Improvements**: Better Stremio addon UI
10. **Multi-language**: Support for YouTube in other languages

## References

- [Stremio Addon SDK](https://github.com/Stremio/stremio-addon-sdk)
- [Stremio REST API](https://stremio.github.io/stremio-addon-sdk/docs/api.md)
- [yt-dlp Documentation](https://github.com/yt-dlp/yt-dlp)
- [FFmpeg Documentation](https://ffmpeg.org/documentation.html)
- [YouTube API (unofficial)](https://developers.google.com/youtube)
- [SponsorBlock API](https://wiki.sponsor.ajay.app/w/API_Docs)
- [DeArrow API](https://dearrow.ajay.app/)

## Contributors

Built with iOS/tvOS compatibility in mind.

## License

MIT
