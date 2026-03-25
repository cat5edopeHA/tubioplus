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
├── app.ts                          # Fastify app factory (creates and configures the instance)
├── server.ts                       # Entry point: startup banner, local IP detection, signal handlers, graceful shutdown (see Graceful Shutdown section)
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
│   │   ├── handler.ts              # Meta assembly: title, poster (posterShape: "landscape"),
│   │   │                           # description, releaseInfo (year), runtime ("Xm"),
│   │   │                           # channel as links entry ({name, category:"channel", url}),
│   │   │                           # behaviorHints.defaultVideoId. DeArrow enrichment if enabled.
│   │   └── plugin.ts               # Registers /:config/meta routes
│   ├── stream/                     # Stream quality options
│   │   ├── handler.ts              # Available qualities for a video
│   │   └── plugin.ts               # Registers /:config/stream routes
│   ├── subtitles/                  # Subtitle extraction
│   │   ├── handler.ts              # Track discovery: manual subs priority over auto-generated.
│   │   │                           # Format preference: SRT > VTT > first available.
│   │   │                           # Auto-generated captions prefixed with "Auto".
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
2. Config decryption extracts `:config` param, decrypts AES-256-CBC, merges with defaults, attaches to request. If decryption fails (bad key, corrupted data), return empty results for Stremio routes (not a 500 — Stremio handles empty gracefully). Routes without a `:config` param (manifest, health, landing) skip this hook.
3. Domain handler processes the request (catalog, meta, stream, or subtitles)
4. YouTube service spawns yt-dlp with `--referer https://www.youtube.com` flag, parses JSON output, caches result
5. Optional enrichment: DeArrow titles/thumbnails if enabled
6. Pre-warming: fire-and-forget cache fill for the first 10 video IDs from the response. No concurrency limit (each is a single yt-dlp spawn). Failures are silently ignored — pre-warming is best-effort.
7. Response formatted as Stremio protocol JSON with cache headers

### Play Endpoint (Video Streaming)

```
Request → Rate Limiter → Validate Video ID → Fresh Format Extraction → Codec Selection → Stream
```

1. Rate limiter (play-specific: 15/min per IP)
2. Video ID validation: regex check (11 chars, `[a-zA-Z0-9_-]`)
3. Fresh yt-dlp extraction with `--referer https://www.youtube.com` (URLs expire ~6 hours, always fetch new). yt-dlp timeout: 30 seconds.
4. Codec selection: best video format at/below requested height
   - ≤1080p: prefer h264 (iOS compatibility)
   - 4K: accept VP9/AV1
5. Audio selection: best AAC track
6. Streaming:
   - 360p: direct HTTP proxy to YouTube's muxed stream (no FFmpeg)
   - 720p+: spawn FFmpeg to mux DASH video + audio → fragmented MP4 → pipe to response
   - 480p: FFmpeg mux (same as 720p+ — YouTube serves 480p as separate DASH streams)
7. FFmpeg args include `--referer https://www.youtube.com` on input URLs
8. FFmpeg flags: `-movflags frag_keyframe+empty_moov+faststart -f mp4 pipe:1`
9. FFmpeg killed on client disconnect (response `close` event)
10. No concurrent stream cap — rate limiting provides backpressure. Monitor memory in production.

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

- Always points to the **server's local/LAN IP**, not the request hostname. This is because the VNC port (6080) is typically not exposed through a reverse proxy — users need to hit the Docker host directly.
- At startup, the server detects its local IP (first non-loopback IPv4 address) and stores it. The config page serves this as `http://{local_ip}:6080/vnc.html`.
- `NOVNC_URL` env var overrides this entirely if set (for custom setups).
- Opens in new tab.

### SPA Routing and BASE_PATH

- The React SPA uses client-side routing (React Router) with two routes: `/` (landing) and `/configure` (stepper wizard).
- Fastify serves `index.html` for both `/` and `/configure`, with static assets (JS/CSS) from the Vite build output.
- To avoid collision with the `/:config/` Stremio route pattern, the Stremio config param route is registered with a regex constraint that only matches base64url strings (alphanumeric, `-`, `_`, minimum 32 chars). `/configure` will never match this pattern.
- When `BASE_PATH` is set, Fastify mounts all routes under the prefix. The React SPA receives the `BASE_PATH` value via a `<script>` tag injected into `index.html` at serve time (e.g., `window.__BASE_PATH__ = "/tubio"`). The SPA uses this for API calls and the `stremio://` install link.

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

**Stale-on-error behavior:** The cache retains expired entries for an additional grace period (2x the original TTL). If a fresh fetch fails (yt-dlp error, timeout), the cache returns the stale entry and logs a warning. If no stale entry exists, the error propagates normally. This prevents transient YouTube failures from breaking the user experience.

**Pre-warming:** After catalog responses, fire-and-forget calls to cache video info for the first 10 returned video IDs. Each pre-warm is an independent yt-dlp spawn. Failures are silently ignored. Pre-warming does not count against rate limits (it's server-to-YouTube, not user-to-server).

### Catalog Pagination

- First page: 20 items
- Subsequent pages (skip > 0): 10 items per page
- Hard limit: `CATALOG_LIMIT` env var (default 100) — stop returning results after this many total items
- Stremio sends `skip` as a multiple of its page size. The addon interprets `skip=0` as first page (20 items) and `skip>0` as continuation (10 items).

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
- `DependencyError` — yt-dlp or FFmpeg binary not found or not executable

### Response Strategy

- **Stremio routes:** return empty arrays on failure (`{ metas: [] }`, `{ streams: [] }`). Stremio handles missing data gracefully; 500 errors break the client.
- **`/play` endpoint:** return proper HTTP errors (404 for bad video ID, 500 for extraction failure, 503 if yt-dlp/FFmpeg unavailable) since this is a direct video stream.
- **`/api/encrypt`:** return 400 with message for bad input.
- **SponsorBlock/DeArrow failures:** silent degradation. Features stop enriching but never block playback.
- **yt-dlp timeout:** 30 seconds, prevents hanging processes.
- **Cache on failure:** serve stale cached data when fresh extraction fails (see Caching section for stale-on-error behavior).
- **Cookie-dependent catalogs without cookies:** Subscriptions, History, and Watch Later return empty arrays (`{ metas: [] }`) when no cookies are available. The manifest always advertises all 5 catalogs — hiding them dynamically would require per-user manifests which Stremio doesn't support well. Empty results are the graceful fallback.
- **Startup validation:** On server start, check that yt-dlp and FFmpeg binaries exist and are executable. Log a warning if missing but don't fail startup — the `/play` and catalog routes will return errors at request time. This allows the health check and config UI to work even if system deps are missing.

### Content Type Handling

- **YouTube Shorts:** Same video ID format as regular videos. yt-dlp handles them normally. No special treatment needed — they have standard formats available.
- **Live streams:** yt-dlp returns different format structures for live content. If no downloadable formats are found (live-only HLS), return empty streams array. Do not attempt to proxy live HLS streams.

---

## Security

- **AES-256-CBC** encryption with random 16-byte IV per config encryption
- **Encryption key** sourced from: `ENCRYPTION_KEY` env → `.encryption-key` file → auto-generate and persist
- **Cookie handling:** decrypt config → write cookies to temp file → yt-dlp reads → delete immediately. Cookies never logged, cached, or exposed.
- **FFmpeg spawning:** array args via `child_process.spawn` (no shell, no injection). `--referer https://www.youtube.com` set on input URLs.
- **yt-dlp spawning:** array args via `child_process.spawn`. `--referer https://www.youtube.com` flag included. 30-second timeout.
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
| `BROWSER_COOKIES` | auto | Chromium cookie mode (see below) |
| `NOVNC_URL` | `http://{local_ip}:6080` | noVNC URL override (default: server's local IP) |
| `YT_DLP_PATH` | `yt-dlp` | Custom yt-dlp binary path |
| `VNC_PASSWORD` | — | noVNC authentication password |

### BROWSER_COOKIES Mode Behavior

| Mode | Behavior |
|---|---|
| `auto` (default) | Check if Chromium cookie database exists at `/data/chromium-profile`. If yes, pass `--cookies-from-browser chromium` to yt-dlp. If no, fall back to per-request cookie strings from encrypted config. |
| `on` | Always pass `--cookies-from-browser chromium` to yt-dlp. If the Chromium profile doesn't exist, yt-dlp will fail — cookie-dependent catalogs return empty results. |
| `off` | Never use Chromium cookies. Always use per-request cookie strings from encrypted config. Ignore the Chromium profile even if it exists. |

When browser cookies are active, per-request cookie strings from the encrypted config are ignored (browser cookies take precedence).

### Production Runtime Dependencies

Node.js packages (production only):
- `fastify` — HTTP framework
- `yt-dlp-wrap` — yt-dlp process wrapper
- `pino` — structured logging (bundled with Fastify but listed explicitly)

Dev/build dependencies (not in production image):
- `typescript`, `vitest`, `playwright`, `react`, `react-dom`, `vite`, `@types/*`

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
- `GET /health` — Health check (see below)

All Stremio routes accept an encrypted config string as the first path segment.

### Health Check

`GET /health` returns 200 with JSON:
```json
{
  "status": "ok",
  "ytdlp": true,
  "ffmpeg": true
}
```
Checks that yt-dlp and FFmpeg binaries are executable (runs `yt-dlp --version` and `ffmpeg -version`). If either is missing, the field is `false` but status is still 200 — the server is running, just degraded. Cache the binary check results for 5 minutes.

### Graceful Shutdown

On `SIGTERM` or `SIGINT`:
1. Stop accepting new connections (Fastify `close()`)
2. Wait up to 10 seconds for in-flight requests to complete
3. Kill any active FFmpeg child processes
4. Exit

### SponsorBlock Delivery

SponsorBlock segments are included in the **stream response** as metadata. Each stream object's `description` field includes a note like "SponsorBlock: 3 segments will be skipped" when segments are available. The actual skip behavior depends on the Stremio client — Stremio does not natively support skip segments, so this is informational. The segments data is not currently actionable in the Stremio protocol but is included for future client support and user awareness.

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
| Prod dependencies | 3 (express, yt-dlp-wrap, node-cache) | 2 (fastify, yt-dlp-wrap) + pino bundled with Fastify |

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
- noVNC login button (changed: now uses server's local IP instead of request hostname)
