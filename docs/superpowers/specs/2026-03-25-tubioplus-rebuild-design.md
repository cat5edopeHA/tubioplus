# Tubio+ Clean Sheet Rebuild — Design Specification

## Overview

Tubio+ is a YouTube streaming addon for Stremio Lite (iOS/tvOS/Web). This document specifies the architecture and design for a complete rebuild targeting the nightly feature set (all features, no branch gating).

The rebuild improves code quality (TypeScript, domain modules, comprehensive tests), user experience (React SPA with stepper wizard), and ops (structured logging, two-stage Docker build, typed errors).

---

## Architecture: Modular Monolith

Single Node.js process with domain-driven modules. Each domain is a Fastify plugin that encapsulates its routes and business logic.

### Technology Stack

| Layer | Choice | Rationale |
|---|---|---|
| Runtime | Node.js 20+ | Same as original, proven for this workload |
| Language | TypeScript | Compile-time safety, self-documenting, better IDE support |
| HTTP framework | Fastify | Schema validation, pino logging, plugin isolation, 2-3x faster than Express |
| Frontend | React + Vite | SPA for config UI, fast dev/build, industry standard |
| Testing | vitest + Playwright | Unit/integration + browser E2E |
| Process manager | supervisord | Same as original, manages Xvfb/Chromium/VNC/Node |

### Module Structure

```
src/
├── app.ts                          # Fastify app factory
├── server.ts                       # Entry point, startup, graceful shutdown
├── domains/
│   ├── stremio/                    # Stremio protocol types and manifest
│   │   ├── manifest.ts             # Manifest definition and route
│   │   ├── types.ts                # Meta, Stream, Subtitle, Catalog types
│   │   └── plugin.ts               # Registers manifest route
│   ├── youtube/                    # YouTube data extraction
│   │   ├── ytdlp.ts                # yt-dlp wrapper (spawn, parse)
│   │   ├── formats.ts              # Codec/quality selection logic
│   │   ├── types.ts                # VideoInfo, Format types
│   │   └── plugin.ts               # Registers /play streaming route
│   ├── catalog/                    # Catalog browsing
│   │   ├── handler.ts              # Trending, search, subscriptions, history, watchlater
│   │   ├── plugin.ts               # Registers /:config/catalog routes
│   │   └── prewarm.ts              # Fire-and-forget video info prefetching
│   ├── meta/                       # Video metadata
│   │   ├── handler.ts              # Meta assembly (title, poster, runtime, links)
│   │   └── plugin.ts               # Registers /:config/meta routes
│   ├── stream/                     # Stream quality options
│   │   ├── handler.ts              # Available qualities for a video
│   │   └── plugin.ts               # Registers /:config/stream routes
│   ├── subtitles/                  # Subtitle extraction
│   │   ├── handler.ts              # Track discovery, format preference, manual vs auto
│   │   └── plugin.ts               # Registers /:config/subtitles routes
│   ├── config/                     # Configuration and encryption
│   │   ├── encryption.ts           # AES-256-CBC encrypt/decrypt
│   │   ├── schema.ts               # Config shape, defaults, validation
│   │   └── plugin.ts               # Registers /configure, /api/encrypt
│   ├── sponsorblock/               # SponsorBlock integration
│   │   ├── client.ts               # Fetch skip segments from API
│   │   └── types.ts                # Segment types
│   └── dearrow/                    # DeArrow integration
│       ├── client.ts               # Fetch community branding from API
│       └── types.ts                # Branding types
├── infrastructure/
│   ├── cache.ts                    # Generic in-memory TTL cache
│   ├── rate-limit.ts               # Sliding-window rate limiter
│   ├── logger.ts                   # Pino logger configuration
│   └── errors.ts                   # Typed error classes
└── shared/
    ├── env.ts                      # Environment variable loading and validation
    └── validation.ts               # Shared validators (video ID regex, etc.)
```

### Domain Communication Rules

- Domains never import from another domain's internals
- The `youtube` domain is the shared data layer — other domains call its exported functions for video info
- `sponsorblock` and `dearrow` are independent — called by `catalog`, `meta`, and `stream` handlers when enabled
- `infrastructure` is shared utilities with no business logic
- `shared` is pure functions and constants

---

## Request Lifecycle

### Standard Stremio Request

```
Request → Rate Limiter (onRequest) → Config Decrypt (preHandler) → Domain Handler → YouTube Service → Response
```

1. Rate limiter checks IP against sliding window, returns 429 if exceeded
2. Config decryption extracts `:config` param, decrypts AES-256-CBC, merges with defaults, attaches to request
3. Domain handler processes the request (catalog, meta, stream, or subtitles)
4. YouTube service spawns yt-dlp, parses output, caches result
5. Optional enrichment: DeArrow titles/thumbnails if enabled
6. Pre-warming: fire-and-forget cache fill for returned video IDs
7. Response formatted as Stremio protocol JSON with cache headers

### Play Endpoint (Video Streaming)

```
Request → Rate Limiter → Validate Video ID → Fresh Format Extraction → Codec Selection → Stream
```

1. Rate limiter (play-specific: 15/min per IP)
2. Video ID validation: regex check (11 chars, alphanumeric + `-_`)
3. Fresh yt-dlp extraction (URLs expire ~6 hours, always fetch new)
4. Codec selection: best video format at/below requested height
   - ≤1080p: prefer h264 (iOS compatibility)
   - 4K: accept VP9/AV1
5. Audio selection: best AAC track
6. Streaming:
   - 360p: direct HTTP proxy to YouTube's muxed stream (no FFmpeg)
   - 480p+: spawn FFmpeg to mux DASH video + audio → fragmented MP4 → pipe to response
7. FFmpeg flags: `-movflags frag_keyframe+empty_moov+faststart -f mp4 pipe:1`
8. FFmpeg killed on client disconnect (response `close` event)

### Config Encryption Flow

1. User fills stepper wizard form
2. POST `/api/encrypt` with config JSON
3. Server encrypts: `JSON.stringify → AES-256-CBC(random 16-byte IV) → hex(iv:ciphertext) → base64url`
4. Returns addon URL with encrypted config in path
5. Every Stremio request decrypts config from URL path

---

## Frontend Design

### Technology

- React 18+ with TypeScript
- Vite for dev server and production builds
- Built to static files, served by Fastify as static assets
- Dark theme matching the Minimal Dark direction

### Landing Page

Minimal Dark design:
- Centered layout on dark background (#0f0f0f → #1a1a2e gradient)
- Tubio+ logo (play icon in red square + wordmark with red "+")
- Tagline: "YouTube for Stremio"
- Two CTAs: "Configure" (primary, red) and "Install" (secondary, outlined)
- No feature lists, no clutter

### Configuration Page — Stepper Wizard

Four-step guided flow with progress indicator:

**Step 1: Authentication (optional, skippable)**
- Netscape format cookies textarea
- "Open YouTube Login" button (links to noVNC URL)
- Helper text explaining this is needed for subscriptions/history/watchlater
- Skip button to proceed without auth

**Step 2: Quality**
- Visual quality selector (button group): 360p, 480p, 720p, 1080p (default), 4K
- Brief note about iOS h264 preference and 4K codec requirements

**Step 3: Features**
- SponsorBlock toggle (off by default)
  - When enabled: category checkboxes (sponsor, selfpromo, interaction, intro, outro)
- DeArrow toggle (off by default)

**Step 4: Install**
- Generated addon URL (read-only, with copy button)
- "Install in Stremio" button (stremio:// protocol link)
- Back button to revise settings

**Responsive behavior:** Stepper collapses gracefully on mobile. Step content is always single-column. Progress indicator wraps or switches to compact mode on narrow screens.

### noVNC Login Button

- Constructs URL from the incoming request hostname + port 6080: `http://{request_host}:6080/vnc.html`
- `NOVNC_URL` env var overrides this for reverse proxy setups
- Opens in new tab

---

## Caching

In-memory TTL cache with automatic expiration on access. No external dependencies.

| Data | TTL | Key Pattern |
|---|---|---|
| Search results | 5 min | `search:{query}` |
| Video metadata | 1 hr | `video:{videoId}` |
| Format info | 1 hr | `formats:{videoId}` |
| Trending | 10 min | `trending` |
| SponsorBlock segments | 5 min | `sb:{videoId}` |
| DeArrow branding | 1 hr | `da:{videoId}` |

Play endpoint always fetches fresh format info (ignores cache) because YouTube stream URLs expire ~6 hours and cached URLs may be stale.

Pre-warming: after catalog responses, fire-and-forget calls to cache video info for returned IDs.

---

## Rate Limiting

Sliding-window counter per IP. No external dependencies.

| Endpoint | Limit | Window |
|---|---|---|
| `/play` | 15 req | 1 min |
| `/api/encrypt` | 10 req | 1 min |
| Stremio API routes | 60 req | 1 min |
| Global (all routes) | 120 req | 1 min |

- Returns 429 with `RateLimit-*` headers when exceeded
- Automatic cleanup of expired entries every 5 minutes
- Configurable on/off via `RATE_LIMIT` env var (default: on)

---

## Error Handling

### Typed Error Classes

- `VideoNotFoundError` — invalid or unavailable video ID
- `ExtractionError` — yt-dlp failure (timeout, network, YouTube rate limit)
- `EncryptionError` — config decrypt failure (bad key, corrupted data)
- `RateLimitError` — request exceeded limit
- `ExternalServiceError` — SponsorBlock/DeArrow API failure

### Response Strategy

- **Stremio routes:** return empty arrays on failure (`{ metas: [] }`, `{ streams: [] }`). Stremio handles missing data gracefully; 500 errors break the client.
- **`/play` endpoint:** return proper HTTP errors (404 for bad video ID, 500 for extraction failure) since this is a direct video stream.
- **`/api/encrypt`:** return 400 with message for bad input.
- **SponsorBlock/DeArrow failures:** silent degradation. Features stop enriching but never block playback.
- **yt-dlp timeout:** 30 seconds, prevents hanging processes.
- **Cache on failure:** serve stale cached data when fresh extraction fails.

---

## Security

- **AES-256-CBC** encryption with random 16-byte IV per config encryption
- **Encryption key** sourced from: `ENCRYPTION_KEY` env → `.encryption-key` file → auto-generate and persist
- **Cookie handling:** decrypt config → write cookies to temp file → yt-dlp reads → delete immediately. Cookies never logged, cached, or exposed.
- **FFmpeg spawning:** array args via `child_process.spawn` (no shell, no injection). HTTPS referer header set for YouTube.
- **Video ID validation:** regex (11 chars, `[a-zA-Z0-9_-]`) before any processing.
- **CORS:** `Access-Control-Allow-Origin: *` (required by Stremio protocol).
- **No secrets in URLs/logs:** config is encrypted, cookies are in encrypted config, encryption key never leaves the server.

---

## Environment Variables

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | 8000 | Server port |
| `ENCRYPTION_KEY` | auto-generated | 64-char hex AES-256 key |
| `NODE_ENV` | — | production/development |
| `RATE_LIMIT` | on | Enable/disable rate limiting |
| `CATALOG_LIMIT` | 100 | Max videos per catalog |
| `BASE_PATH` | — | URL subfolder mount (e.g., `/tubio`) |
| `BROWSER_COOKIES` | auto | Chromium cookie mode: auto/on/off |
| `NOVNC_URL` | `http://{request_host}:6080` | noVNC URL override |
| `YT_DLP_PATH` | `yt-dlp` | Custom yt-dlp binary path |
| `VNC_PASSWORD` | — | noVNC authentication password |

---

## Stremio Protocol Compliance

Direct implementation of the Stremio addon REST protocol (no SDK).

### Manifest

```json
{
  "id": "yt.stremio.addon",
  "name": "Tubio+",
  "version": "2.0.0",
  "description": "YouTube addon for Stremio",
  "types": ["YouTube"],
  "idPrefixes": ["yt:"],
  "catalogs": [
    { "type": "YouTube", "id": "yt:recommendations", "name": "Recommendations" },
    { "type": "YouTube", "id": "yt:search", "name": "Search", "extra": [{ "name": "search", "isRequired": true }] },
    { "type": "YouTube", "id": "yt:subscriptions", "name": "Subscriptions" },
    { "type": "YouTube", "id": "yt:history", "name": "History" },
    { "type": "YouTube", "id": "yt:watchlater", "name": "Watch Later" }
  ],
  "resources": ["catalog", "meta", "stream", "subtitles"],
  "behaviorHints": { "configurable": true, "configurationRequired": false }
}
```

### URL Routing

- `GET /manifest.json`
- `GET /:config/catalog/:type/:id.json`
- `GET /:config/catalog/:type/:id/:extra.json`
- `GET /:config/meta/:type/:id.json`
- `GET /:config/stream/:type/:id.json`
- `GET /:config/subtitles/:type/:id.json`
- `GET /play/:videoId.mp4?q=HEIGHT`
- `GET /` — Landing page (serves React SPA)
- `GET /configure` — Config page (serves React SPA)
- `POST /api/encrypt` — Encrypt config
- `GET /health` — Health check

All Stremio routes accept an encrypted config string as the first path segment.

---

## Testing Strategy

### Unit Tests (vitest)

Every domain module gets its own test file:

- `youtube/ytdlp.test.ts` — argument building, output parsing, format selection
- `youtube/formats.test.ts` — codec preference, height matching, 4K fallback
- `config/encryption.test.ts` — encrypt/decrypt round-trip, key loading, bad input
- `config/schema.test.ts` — validation, default merging
- `catalog/handler.test.ts` — pagination, extra param parsing, prewarm triggers
- `meta/handler.test.ts` — metadata assembly, DeArrow enrichment
- `stream/handler.test.ts` — quality list building, format availability
- `subtitles/handler.test.ts` — format preference, manual vs auto priority
- `sponsorblock/client.test.ts` — API response parsing, category filtering
- `dearrow/client.test.ts` — branding response parsing, vote ranking
- `infrastructure/cache.test.ts` — TTL expiration, get/set/delete
- `infrastructure/rate-limit.test.ts` — sliding window, cleanup, per-IP tracking
- `shared/validation.test.ts` — video ID regex, input sanitization

Mocking policy: only at process/network boundaries (yt-dlp spawning, HTTP calls to external APIs). Never mock internal modules.

### Integration Tests (vitest + Fastify inject)

Spin up the Fastify app, test real endpoints:

- Manifest returns valid Stremio manifest shape
- Catalog routes decrypt config and return proper response shapes
- Stream routes return quality options in correct format
- Play route validates video IDs and rejects bad input
- Config encrypt/decrypt round-trip through the API
- Rate limiting triggers 429 at threshold
- BASE_PATH prefix works on all routes
- Health check returns 200
- CORS headers present on all responses

These mock yt-dlp at the process boundary but exercise everything else for real.

### E2E Tests (Playwright)

Real browser against running app:

- Landing page loads, Configure button navigates to stepper
- Stepper wizard: navigate through all 4 steps
- Skip optional auth step
- Quality selector works
- SponsorBlock/DeArrow toggles work
- Copy URL button copies correct encrypted URL
- Install in Stremio button has correct protocol link
- Responsive: stepper works on mobile viewport
- Back navigation within stepper preserves state

---

## Docker & Deployment

### Dockerfile (two-stage build)

**Stage 1 — Build:**
- `node:20-slim` base
- Install dependencies, build TypeScript, build React SPA with Vite

**Stage 2 — Production:**
- `node:20-slim` base
- System packages: FFmpeg, Python 3, Chromium, Xvfb, x11vnc, noVNC, websockify, supervisord
- yt-dlp binary from GitHub releases
- Copy compiled JS and built frontend from stage 1
- Production node_modules only
- Chromium profile symlinked to `/data/chromium-profile`

### supervisord (5 processes)

1. Xvfb :99 (virtual display, 1280x720x24)
2. Chromium (YouTube page, no-sandbox, no-gpu)
3. x11vnc (VNC server on :5900)
4. websockify (noVNC proxy on :6080)
5. Node app (Fastify on configured PORT)

### docker-compose.yml

- Ports: 8000 (addon), 6080 (noVNC)
- Volume: `/data` for Chromium cookie persistence
- `shm_size: 256mb` for Chromium renderer
- All env vars passed through
- Restart policy: unless-stopped

### CI/CD

- GitHub Actions workflow for Docker Hub publishing
- Triggered on tags and branch pushes
- Multi-platform builds if needed

---

## Visual Assets

- **Logo:** Play icon in red (#ff0033) rounded square + "Tubio+" wordmark with red "+"
- **ASCII banner:** Console startup art
- **Favicon:** Miniature version of logo for browser tab

These will be created using the canvas-design skill during implementation.

---

## What Changed From the Original

| Aspect | Original | Rebuild |
|---|---|---|
| Language | JavaScript | TypeScript |
| Framework | Express | Fastify |
| Code structure | routes/ + services/ flat | Domain-driven modules as Fastify plugins |
| Frontend | Inline HTML strings | React SPA (Vite) |
| Config UI | Single form page | 4-step stepper wizard |
| Landing page | Inline HTML | Minimal Dark React component |
| Logging | console.log | Pino (structured, built into Fastify) |
| Error handling | String throws | Typed error classes |
| Testing | 1 test file (subtitles) | Comprehensive: unit + integration + E2E |
| Docker build | Single stage | Two-stage (smaller production image) |
| Dependencies | 3 (express, yt-dlp-wrap, node-cache) | Fastify, yt-dlp-wrap, React, Vite, vitest, Playwright |

## What Was Preserved (Conceptually)

- Single-process deployment model
- In-memory caching (no Redis)
- Direct yt-dlp/FFmpeg process spawning
- AES-256-CBC encrypted config in URL path
- Custom Stremio protocol implementation (no SDK)
- Same 5-process Docker supervisord architecture
- Same rate limiting algorithm (sliding window)
- Same codec strategy (h264 ≤1080p, VP9/AV1 at 4K)
- Same cookie temp-file security model
- noVNC URL auto-detection from request hostname
