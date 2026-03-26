# TubioPlus

YouTube addon for Stremio — stream YouTube content directly in Stremio.

Inspired by [YouTubio](https://github.com/xXCrash2BomberXx/YouTubio). Vibe coded with love.

> **This is the `nightly` branch — a complete ground-up rewrite of TubioPlus.** For the stable release, see the [`main`](https://github.com/cat5edopeHA/tubioplus/tree/main) branch.

## What's New in Nightly

The nightly branch is a full rewrite of the original JavaScript codebase. Everything from the runtime to the Docker image has been rebuilt.

### TypeScript + Fastify

The entire backend has been rewritten in TypeScript with Fastify replacing Express. The source is organized into a domain-driven layout with dedicated modules for catalog, stream, meta, subtitles, config, SponsorBlock, and DeArrow. Shared infrastructure (caching, rate limiting, logging, error handling) lives in its own layer with co-located unit tests. Fastify runs with `trustProxy` enabled for correct protocol detection behind reverse proxies and Cloudflare tunnels.

### Browser-Based YouTube Login

No more extracting and pasting cookie files. The nightly build embeds a full Chromium browser managed by supervisord alongside Xvfb, x11vnc, and websockify. You log into your Google account once through a noVNC web interface, and yt-dlp pulls cookies directly from the browser profile. The session persists across container restarts via a Docker volume.

### React Configure Page

The inline HTML configure page from main has been replaced with a standalone React SPA. It builds separately and is served as static files by Fastify.

### Subtitles Support

A new `/{config}/subtitles/:type/:id.json` endpoint returns available subtitle tracks for each video, including multiple languages and YouTube auto-generated captions. Stremio displays these as selectable subtitle options during playback.

### SponsorBlock Integration

When enabled in your config, the stream description shows how many SponsorBlock segments (sponsors, intros, outros, etc.) are present in a video. SponsorBlock and DeArrow are disabled by default and only activate when explicitly enabled through the configure page.

### DeArrow Support

When enabled, DeArrow replaces YouTube's original titles and thumbnails with community-submitted alternatives on the meta endpoint. This gives you cleaner, less clickbaity titles and thumbnails in your Stremio library.

### Background Video Info Prefetch

Catalog results trigger background prefetching of video metadata so stream and meta requests resolve faster when you actually click through to play something.

### Structured Logging

Console output uses Pino for structured JSON logging in production, with pino-pretty for human-readable output during development. No more raw `console.log` statements.

### Custom In-Memory Cache

The node-cache dependency has been replaced with a zero-dependency TTL cache built from scratch with full test coverage.

### Per-IP Rate Limiting

Rate limiting is now implemented as a custom per-IP middleware rather than relying on external packages. Controlled via the `RATE_LIMIT` environment variable.

### Custom Error Classes

A dedicated error hierarchy (`AppError`, `NotFoundError`, `ValidationError`) replaces generic throws, making error handling and logging more consistent across the codebase.

### Multi-Stage Docker Build

The Dockerfile has been completely rewritten as a multi-stage build. Stage one compiles TypeScript and builds the React frontend. Stage two produces a slim production image with only runtime dependencies (ffmpeg, yt-dlp, Chromium, supervisor, noVNC). The build artifacts directory is organized under `docker/` alongside the supervisord config and VNC startup script.

### Test Suite

The project now includes a test framework: Vitest for unit tests (co-located with source files in the `infrastructure/` layer) and Playwright for end-to-end testing. Run `npm test` for unit tests or `npm run test:e2e` for browser tests.

### Process Management

Instead of a single `node` process, supervisord manages five services inside the container: the Node.js app, Chromium, Xvfb, x11vnc, and websockify. Stale Chromium singleton lock files are cleaned automatically on startup to prevent crashes after unclean shutdowns.

## Features

- Search YouTube, browse recommendations, subscriptions, history, and watch later
- Quality selection up to 1080p (h264 for broad device compatibility)
- On-the-fly FFmpeg muxing for higher quality streams
- Subtitles with multi-language and auto-caption support
- SponsorBlock integration (segment count display)
- DeArrow support (community titles and thumbnails)
- Browser-based Google login via noVNC (no manual cookie handling)
- Persistent login sessions across container restarts
- AES-256 encrypted config with a unique key per deployment
- Catalog pagination (20 initial results, 10 more per scroll, configurable limit)
- Per-IP rate limiting
- Background video info prefetching
- Health endpoint (`/health`) for monitoring
- Structured JSON logging

## Deploy with Docker

Pull the prebuilt image from Docker Hub:

```bash
docker run -d \
  --name tubioplus \
  --restart unless-stopped \
  -p 8000:8000 \
  -p 6080:6080 \
  -v tubio-data:/data \
  --shm-size=256m \
  cat5edopeha/tubioplus:nightly
```

Or use a different branch:

```bash
# Stable
docker run -d --name tubioplus -p 8000:8000 --restart unless-stopped cat5edopeha/tubioplus:latest

# Testing (4K, subfolder support)
docker run -d --name tubioplus -p 8000:8000 --restart unless-stopped cat5edopeha/tubioplus:testing

# Nightly (browser login, full rewrite)
docker run -d --name tubioplus --restart unless-stopped \
  -p 8000:8000 -p 6080:6080 \
  -v tubio-data:/data --shm-size=256m \
  cat5edopeha/tubioplus:nightly
```

### Docker Compose

```yaml
services:
  tubioplus:
    image: cat5edopeha/tubioplus:nightly
    container_name: tubioplus
    restart: unless-stopped
    ports:
      - "8000:8000"
      - "6080:6080"
    volumes:
      - tubio-data:/data
    shm_size: 256m
    environment:
      - PORT=8000
      - RATE_LIMIT=on
      - CATALOG_LIMIT=100
      - BROWSER_COOKIES=auto

volumes:
  tubio-data:
```

### Build from Source

```bash
git clone https://github.com/cat5edopeHA/tubioplus.git
cd tubioplus
git checkout nightly
docker build -f docker/Dockerfile -t tubioplus:nightly .
```

## Setup

1. Start the container using one of the methods above
2. Open `http://your-host:6080/vnc.html` and sign into your Google account
3. Open `http://your-host:8000/configure` to set your preferences and install the addon in Stremio

## Branches

| Branch | Docker Hub Tag | Description |
|--------|---------------|-------------|
| `main` | `cat5edopeha/tubioplus:latest` | Stable release, JavaScript, Express, manual cookie pasting |
| `testing` | `cat5edopeha/tubioplus:testing` | Rate limiting OFF, 4K playback (VP9/AV1), subfolder support (`BASE_PATH`) |
| `nightly` | `cat5edopeha/tubioplus:nightly` | Full TypeScript rewrite, Fastify, browser-based login, subtitles, SponsorBlock, DeArrow |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8000` | HTTP port for the addon |
| `RATE_LIMIT` | `on` | Enable or disable per-IP rate limiting (`on`/`off`) |
| `CATALOG_LIMIT` | `100` | Maximum number of videos fetched per catalog |
| `BROWSER_COOKIES` | `auto` | Cookie mode: `auto` (detect browser profile), `on`, or `off` |
| `NOVNC_URL` | — | Override the noVNC URL shown on the configure page |

## Security

Port 6080 (the noVNC interface) provides unauthenticated access to a browser with your Google account logged in. **Do not expose port 6080 to the internet.** Keep it on your local network only. If you need remote access, use a VPN or SSH tunnel. Port 8000 (the addon itself) is safe to expose.

Your config (including cookie preferences) is AES-256 encrypted with a unique key generated per deployment. The server decrypts config on each request to make YouTube API calls on your behalf. For full control over your data, self-host your own instance.

## Architecture

```
src/
  app.ts                    # Fastify app + all route definitions
  server.ts                 # Entry point
  shared/
    env.ts                  # Environment config
    validation.ts           # Video ID validation
  infrastructure/
    logger.ts               # Pino structured logging
    rate-limit.ts           # Per-IP rate limiter
    cache.ts                # In-memory TTL cache
    errors.ts               # Custom error classes
  domains/
    youtube/                # yt-dlp service, format selection, types
    catalog/                # Catalog pagination, prefetch
    stream/                 # Stream URL building
    meta/                   # Meta object building
    subtitles/              # Subtitle list building
    config/                 # AES encryption, config schema
    stremio/                # Stremio manifest + types
    sponsorblock/           # SponsorBlock API client
    dearrow/                # DeArrow API client + types
frontend/                   # React SPA (configure page)
docker/
  Dockerfile                # Multi-stage build
  supervisord.conf          # Process manager config
  start-vnc.sh              # VNC startup script
  docker-compose.yml        # Reference compose file
```

## License

MIT
