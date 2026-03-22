# YouTube for Stremio

A complete Stremio addon that streams YouTube videos directly in Stremio Lite on iOS, tvOS, and web. Built for iOS compatibility with special handling for h264 video, AAC audio, and FFmpeg muxing.

## Features

- 🎬 Stream YouTube videos in Stremio
- 📱 Native support for iOS and tvOS via Stremio Lite
- 🔍 Search YouTube videos
- 🔥 Trending videos
- 📺 Subscriptions feed (requires authentication)
- 📜 Watch history (requires authentication)
- ⏰ Watch later list (requires authentication)
- 🎚️ Multiple quality options (360p to 1080p)
- ⚡ SponsorBlock integration (skip ads and sponsored content)
- 🎨 DeArrow support (community titles and thumbnails)
- 🔐 Encrypted configuration with AES-256-CBC

## Architecture

### Why No SDK?

This addon implements the Stremio REST API directly instead of using the npm `stremio-addon-sdk` package because:

1. **iOS Compatibility**: Full control over stream URLs and format selection for iOS h264 codec compatibility
2. **FFmpeg Integration**: Direct spawning of FFmpeg for on-the-fly video muxing (h264 + AAC)
3. **No Stremio Player Streams**: SDK would encourage `externalUrl` and `ytId` types which don't work on iOS
4. **Configuration Control**: Complete flexibility for encrypted, user-specific config handling

### Key Technical Decisions

#### 1. Stream Format Selection (iOS Critical)

YouTube only provides **one muxed MP4**: itag 18 (360p, h264 + AAC).

All higher quality requires DASH streams (separate video + audio). The addon:

- **360p**: Serves YouTube's native itag 18 directly (redirect)
- **720p+**: Finds best h264 video stream + best AAC audio, spawns FFmpeg to mux on-the-fly

FFmpeg command:
```bash
ffmpeg -i VIDEO_URL -i AUDIO_URL -c:v copy -c:a copy -movflags frag_keyframe+empty_moov+faststart -f mp4 pipe:1
```

#### 2. Stremio Lite iOS Behavior

- **url streams**: Appear as "unsupported" by default
  - Users must enable: Settings → Stream Quality → "Show Unsupported Streams"
  - No workaround exists
- **ytId streams**: Open YouTube app (not for playback)
- **externalUrl streams**: Open in Safari (not for playback)

**Result**: Only `url` streams with HTTP/HTTPS work for video playback.

#### 3. YouTube CDN URL Expiration

YouTube CDN URLs expire after a few hours. The addon:
- Calls `yt-dlp` fresh for every /play/ request
- Gets current, valid stream URLs
- Passes URLs to FFmpeg immediately

#### 4. Codec Requirements

For iOS video playback:
- **Video**: h264 (avc1) - universal iOS support
- **Audio**: AAC (mp4a) - native iOS support
- **Container**: MP4 - iOS standard
- **Muxing flags**: `frag_keyframe+empty_moov+faststart` for streaming

## Installation

### Docker (Recommended)

```bash
# Clone or download this repo
cd yt-stremio

# Set encryption key (optional, defaults to dev key)
export ENCRYPTION_KEY="0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"

# Start with Docker Compose
docker-compose up -d

# Access at http://localhost:8000
```

### Manual Setup

```bash
# Install dependencies
npm install

# Ensure ffmpeg and yt-dlp are installed
# Ubuntu/Debian: sudo apt-get install ffmpeg python3-pip && pip install yt-dlp
# macOS: brew install ffmpeg yt-dlp
# Fedora: sudo dnf install ffmpeg python3-pip && pip install yt-dlp

# Set encryption key
export ENCRYPTION_KEY="0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
export PORT=8000

# Start
npm start
```

### Generate Encryption Key

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the output to your `.env` or environment variables as `ENCRYPTION_KEY`.

## Configuration

### Via Web UI

1. Open `http://your-addon-url/configure`
2. Enter YouTube cookies (optional, for subscriptions/history/watch later)
3. Select maximum quality preference
4. Enable SponsorBlock and/or DeArrow if desired
5. Click "Save & Generate Config"
6. Copy the generated link and open in Stremio

### Installing in Stremio

1. From the configuration page, click "Install in Stremio"
2. Or copy the config link and open it with the `stremio://` protocol:
   ```
   stremio://install/https://your-addon-url/ENCRYPTED_CONFIG
   ```

### Configuration Parameters

#### Cookies (Optional)

YouTube cookies in Netscape format for:
- Subscriptions feed (`/feed/subscriptions`)
- Watch history (`/feed/history`)
- Watch later list (`/playlist?list=WL`)

Export from your browser using "Get cookies.txt LOCALLY" extension.

#### Quality Preference

Maximum quality to stream (360p, 480p, 720p, 1080p). Default: 1080p.

Videos are streamed at this quality or lower if not available.

#### SponsorBlock

Skip sponsored segments and other content:
- **Sponsor**: Paid sponsorship
- **Selfpromo**: Self-promotion
- **Interaction**: Like/subscribe reminders
- **Intro**: Intro scenes
- **Outro**: Outro scenes
- **Preview**: Preview/recap segments
- **Music_offtopic**: Off-topic music
- **Filler**: Filler content

#### DeArrow

Use community-created titles and thumbnails instead of YouTube's clickbait.

## API Endpoints

### `/manifest.json`
Returns the Stremio addon manifest.

### `/configure`
Configuration web UI and installation handler.

### `/:config/catalog/:type/:id.json`
Catalog handler. Supported catalogs:
- `yt:trending` - YouTube trending
- `yt:search?search=QUERY` - YouTube search
- `yt:subscriptions` - User's subscriptions (requires cookies)
- `yt:history` - User's watch history (requires cookies)
- `yt:watchlater` - User's watch later list (requires cookies)

### `/:config/meta/:type/:id.json`
Video metadata (title, description, poster, duration, etc.)

### `/:config/stream/:type/:id.json`
Available streams for a video (quality options)

### `/play/:videoId.mp4?q=QUALITY`
The critical endpoint that serves actual video content.
- Validates video ID
- Fetches current YouTube CDN URLs via yt-dlp
- For 360p: redirects to YouTube's muxed format
- For higher quality: spawns FFmpeg to mux h264 video + AAC audio
- Pipes FFmpeg output directly to client (no disk buffering)

## Environment Variables

```bash
PORT=8000                    # Server port
ENCRYPTION_KEY=...          # AES-256 key for config encryption (64 hex chars)
NODE_ENV=production         # production or development
HOST=your-addon-url         # Public URL (optional, for stream URLs in responses)
```

## Deployment

### Proxmox/LXC with Reverse Proxy

```bash
# In LXC container
git clone <repo>
cd yt-stremio
npm install

ENCRYPTION_KEY=... PORT=8000 npm start
```

Configure reverse proxy (e.g., Pangolin):
```
Domain: yt.m2bw.net
Backend: http://container-ip:8000
```

### Development

```bash
npm run dev  # Uses --watch flag for auto-reload
```

## Troubleshooting

### "Unsupported Streams" on iOS/tvOS

This is expected. Stremio Lite hides `url` type streams by default.

**Fix**: Settings → Stream Quality → Enable "Show Unsupported Streams"

### Video Won't Play

1. Check `/health` endpoint is responding
2. Verify FFmpeg is installed: `ffmpeg -version`
3. Verify yt-dlp is installed: `yt-dlp --version`
4. Check server logs for errors
5. Ensure requested video is available in requested quality

### Authentication Not Working

1. Verify cookies are in Netscape format
2. Check cookie file has proper permissions
3. Test with trending/search first (no auth needed)

### Poor Quality Selection

YouTube availability varies by region and account. Use search to verify video availability at desired quality:

```bash
yt-dlp -F "https://www.youtube.com/watch?v=VIDEO_ID"
```

## File Structure

```
yt-stremio/
├── package.json               # Node dependencies
├── Dockerfile                 # Docker image
├── docker-compose.yml         # Docker Compose config
├── .env.example              # Environment template
├── README.md                 # This file
└── src/
    ├── index.js              # Express app entry point
    ├── manifest.js           # Stremio addon manifest
    ├── config.js             # Encryption/decryption utilities
    ├── routes/
    │   ├── configure.js      # Configuration page handler
    │   ├── catalog.js        # Catalog endpoint (/catalog/:type/:id)
    │   ├── meta.js           # Meta endpoint (/meta/:type/:id)
    │   ├── stream.js         # Stream endpoint (/stream/:type/:id)
    │   └── play.js           # Video playback endpoint (/play/:videoId.mp4)
    └── services/
        ├── ytdlp.js          # yt-dlp wrapper (search, info, format selection)
        ├── sponsorblock.js    # SponsorBlock API client
        ├── dearrow.js        # DeArrow API client
        └── cache.js          # TTL-based in-memory cache
```

## Performance Optimization

### Caching Strategy

- **Search results**: 5 minutes TTL
- **Video metadata**: 1 hour TTL
- **Format information**: 1 hour TTL
- **Trending**: 10 minutes TTL
- **SponsorBlock segments**: 5 minutes TTL
- **DeArrow branding**: 1 hour TTL

In-memory cache reduces yt-dlp calls and API requests significantly.

### FFmpeg Optimization

- Copy-mode encoding (`-c:v copy -c:a copy`) - no re-encoding
- Fragmented MP4 with fast start (`-movflags frag_keyframe+empty_moov+faststart`)
- Pipes directly to response (no disk buffering)
- Automatically killed on client disconnect

## Security Considerations

### Configuration Encryption

User configurations are encrypted with AES-256-CBC before being embedded in URLs:

```
GET /ENCRYPTED_CONFIG/catalog/channel/yt:trending.json
```

This prevents:
- Exposing cookies in URLs/referrer logs
- Accidental sharing of configuration
- Man-in-the-middle attacks (if used over HTTPS)

### yt-dlp Cookies

Temporary cookie files are:
- Written to `/tmp/`
- Used immediately
- Deleted after request
- Never logged or cached

### FFmpeg Security

- Only spawned with validated parameters
- Killed on client disconnect
- No shell execution
- URL headers restricted to YouTube referrer

## Known Limitations

1. **iOS HLS**: Stremio doesn't support HLS playlist streams on iOS, so muxing is required for HD
2. **Segment Skipping**: SponsorBlock segments are stored as metadata, not actively skipped (requires client-side implementation or HLS manipulation)
3. **Rate Limiting**: YouTube may rate-limit requests if too many are made too quickly
4. **Geo-Blocking**: Some videos may not be available in all regions
5. **DRM**: Protected content will fail (YouTube doesn't serve DRM content via yt-dlp)

## License

MIT

## Credits

- [yt-dlp](https://github.com/yt-dlp/yt-dlp) - YouTube content extraction
- [Stremio](https://www.stremio.com/) - Streaming addon platform
- [SponsorBlock](https://sponsor.ajay.app/) - Ad segment crowdsourcing
- [DeArrow](https://dearrow.ajay.app/) - Community titles and thumbnails
