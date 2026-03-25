# Tubio+ Requirements Specification

## Overview

Tubio+ is a YouTube streaming addon for Stremio Lite (iOS/tvOS/Web). It lets users browse, search, and stream YouTube videos directly inside Stremio with iOS-optimized codec selection, subtitle support, and privacy-preserving encrypted configuration.

**Target build: Nightly (superset of all features).** There is no branch gating. One build ships everything.

---

## Features & Capabilities

### 1. Video Browsing (Catalogs)

- **Recommendations/Trending** — no auth required
- **Search** — query-based, no auth required
- **Subscriptions** — requires YouTube cookies
- **Watch History** — requires YouTube cookies
- **Watch Later** — requires YouTube cookies
- Pagination: first page 20 items, subsequent pages 10, configurable hard limit (default 100)
- Pre-warming: fire-and-forget video info fetch after catalog responses

### 2. Video Metadata

- Title, description, poster/thumbnail, release year, runtime, channel info
- Optional DeArrow community title/thumbnail replacement
- Channel link with category metadata

### 3. Multi-Quality Streaming

- **2160p / 4K** (VP9/AV1 — YouTube does not serve h264 above 1080p)
- **1080p** (h264 preferred for iOS compatibility)
- **720p** (h264)
- **480p** (h264)
- **360p** (h264, direct proxy — no FFmpeg needed)
- FFmpeg on-the-fly muxing for 720p+: DASH video + separate audio → fragmented MP4
- FFmpeg flags: `-movflags frag_keyframe+empty_moov+faststart -f mp4 pipe:1`
- FFmpeg killed on client disconnect
- Fresh format extraction on every play request (YouTube URLs expire ~6 hours)
- Codec strategy: h264 preferred at ≤1080p (iOS), VP9/AV1 accepted at 4K

### 4. Subtitles

- Manual subtitles (higher priority) and auto-generated captions (prefixed "Auto")
- Format preference: SRT > VTT > first available
- Multi-language support

### 5. SponsorBlock Integration (optional, off by default)

- Skip segment categories: sponsor, selfpromo, interaction, intro, outro
- Fetched from `sponsor.ajay.app/api`
- 5-minute cache TTL

### 6. DeArrow Integration (optional, off by default)

- Community-voted replacement titles and thumbnails
- Fetched from `sponsor.ajay.app/api/branding`
- Votes-based ranking
- 1-hour cache TTL

### 7. Configuration & Security

- AES-256-CBC encrypted config embedded in URL path
- Random 16-byte IV per encryption
- Config contains: cookies, max quality, SponsorBlock settings, DeArrow settings
- Encryption key sourced from: `ENCRYPTION_KEY` env > `.encryption-key` file > auto-generate and persist
- Cookie handling: decrypt → write temp file → yt-dlp reads → delete immediately
- Cookies never logged, cached, or exposed
- Web-based configuration UI with form fields, copy-to-clipboard, and install-in-Stremio button

### 8. Rate Limiting (on by default)

- Play endpoint: 15 requests/min per IP
- Encrypt endpoint: 10 requests/min per IP
- API endpoints: 60 requests/min per IP
- Global limit: 120 requests/min per IP
- Sliding-window counter, no external dependencies
- Configurable on/off via `RATE_LIMIT` env var
- Returns 429 with RateLimit-* headers when exceeded
- Automatic cleanup every 5 minutes

### 9. Caching

- In-memory TTL cache (no external dependencies)
- Search results: 5 min
- Video metadata: 1 hour
- Format info: 1 hour
- Trending: 10 min
- SponsorBlock segments: 5 min
- DeArrow branding: 1 hour
- Automatic expiration on access

### 10. Embedded Browser YouTube Login

- Chromium running in Docker with virtual display (Xvfb)
- noVNC web UI for browser access (websockify proxy)
- Users log into YouTube via VNC, cookies persist in Chromium profile
- yt-dlp reads cookies directly from Chromium's cookie database
- `BROWSER_COOKIES` mode: auto (use if profile exists) / on (require) / off (ignore)
- Optional `VNC_PASSWORD` for noVNC authentication
- Persistent volume at `/data` for Chromium profile across restarts

### 11. BASE_PATH Support

- Mount the entire addon under a URL subfolder (e.g., `/tubio`)
- Configured via `BASE_PATH` env var
- All routes respect the prefix

---

## External Dependencies

| Dependency | Purpose |
|---|---|
| **yt-dlp** | YouTube metadata/format extraction, search, playlists |
| **FFmpeg** | Video+audio muxing for 720p+ streams |
| **Python 3** | Required by yt-dlp |
| **Chromium** | Browser-based YouTube login |
| **Xvfb** | Virtual display for headless Chromium |
| **x11vnc** | VNC server for Chromium display |
| **noVNC + websockify** | Web-based VNC client |
| **supervisord** | Process manager for all services in Docker |
| **SponsorBlock API** | Skip segment data |
| **DeArrow API** | Community titles/thumbnails |

Node.js production dependencies (3 total): `express`, `yt-dlp-wrap`, `node-cache`

---

## Environment Variables

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | 8000 | Server port |
| `ENCRYPTION_KEY` | auto-generated | 64-char hex AES-256 key |
| `NODE_ENV` | — | production/development |
| `RATE_LIMIT` | on | Enable/disable rate limiting |
| `CATALOG_LIMIT` | 100 | Max videos per catalog page |
| `BASE_PATH` | — | URL subfolder mount (e.g., `/tubio`) |
| `BROWSER_COOKIES` | auto | Chromium cookie mode: auto/on/off |
| `NOVNC_URL` | `http://HOSTNAME:6080` | noVNC UI URL shown in config page |
| `YT_DLP_PATH` | `yt-dlp` | Custom yt-dlp binary path |
| `VNC_PASSWORD` | — | noVNC authentication password |

---

## API Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/` | Landing page |
| GET | `/health` | Health check |
| GET | `/manifest.json` | Stremio addon manifest |
| GET | `/configure` | Configuration form UI |
| POST | `/api/encrypt` | Encrypt config, return addon URL |
| GET | `/:config/catalog/:type/:id/:extra?.json` | Browse videos |
| GET | `/:config/meta/:type/:id.json` | Video metadata |
| GET | `/:config/stream/:type/:id.json` | Available quality options |
| GET | `/:config/subtitles/:type/:id.json` | Subtitle tracks |
| GET | `/play/:videoId.mp4?q=QUALITY` | Stream video content |

All Stremio API routes accept an encrypted config string as the first path segment.

---

## Stremio Addon Manifest

- id: `yt.stremio.addon`
- name: Tubio+
- types: `['YouTube']`
- idPrefixes: `['yt:']`
- Catalogs: recommendations, search, subscriptions, history, watchlater
- Resources: catalog, meta, stream, subtitles
- configurable: true, configurationRequired: false

---

## UI Components

1. **Landing page** (`/`) — Logo/branding, tagline, "Configure" and "Install" buttons
2. **Configuration page** (`/configure`) — Cookies textarea (Netscape format), quality dropdown, SponsorBlock category checkboxes, DeArrow toggle, copy-to-clipboard, install-in-Stremio button, "Open YouTube Login" button linking to noVNC

---

## Deployment

- **Docker** (primary): node:20-slim base with FFmpeg, yt-dlp, Chromium, noVNC, supervisord
- **Bare metal**: Node.js 18+ with yt-dlp and FFmpeg installed manually
- **Ports**: 8000 (addon), 6080 (noVNC)
- **Persistent volume**: `/data` (Chromium cookie profile)
- **Docker Hub**: published image with CI/CD workflow
- **Process management**: supervisord runs Xvfb, Chromium, x11vnc, websockify, Node app
- **Shared memory**: 256mb minimum for Chromium renderer

---

## Default Configuration

```json
{
  "cookies": "",
  "quality": "1080",
  "sponsorblock": {
    "enabled": false,
    "categories": ["sponsor", "selfpromo", "interaction", "intro", "outro"]
  },
  "dearrow": {
    "enabled": false
  }
}
```

---

## Security Model

- AES-256-CBC encryption with random IV per config
- No plaintext config in URLs, logs, or referrer headers
- Cookie temp files deleted immediately after yt-dlp reads them
- FFmpeg spawned with array args (no shell, no injection)
- Video IDs validated by regex (11 chars: alphanumeric, -, _)
- HTTPS referer header set for YouTube requests
- CORS: `Access-Control-Allow-Origin: *` (required by Stremio)

---

## Performance Characteristics

- Manifest: <10ms
- Catalog (cached): <100ms
- Catalog (fresh): 2-5s
- Meta/Stream (cached): <100ms
- Meta/Stream (fresh): 1-2s
- Play 360p (direct proxy): <500ms startup
- Play 720p+ (FFmpeg mux): 5-10s startup
- Idle memory: 50-100MB
- Per-stream memory: 150-500MB (yt-dlp + FFmpeg)

---

## Visual Assets Needed

- Landing page branding/logo
- ASCII art banner for console startup
- Configuration page styling
