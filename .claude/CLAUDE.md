# TubioPlus - Claude Context

> Read this file before making any changes to the codebase.
> Last updated: 2026-03-25

## Project Overview

TubioPlus is a Stremio addon that serves YouTube content (search, recommendations, subscriptions, history, watch later) via yt-dlp and an embedded Chromium browser for cookie-based authentication. It is a fork/rebrand of Tubio with additional features.

## Architecture

- **Runtime:** Node.js 20 + TypeScript, Fastify HTTP server
- **Video extraction:** yt-dlp (search, playlist, video info, formats)
- **Browser cookies:** Embedded Chromium with persistent profile at `/data/chromium-profile`, accessed by yt-dlp via `--cookies-from-browser 'chromium:/data/chromium-profile'`
- **Display server:** Xvfb + x11vnc + websockify (noVNC) for remote Chromium access (Google login)
- **Process management:** supervisord runs five services: node, chromium, xvfb, x11vnc, websockify
- **Config encryption:** User config is AES-encrypted into a base64url token embedded in the Stremio addon URL

## Key Paths (inside Docker container)

| Path | Purpose |
|------|---------|
| `/app/dist/` | Compiled JS (from TypeScript) |
| `/app/dist/frontend/` | Built React SPA |
| `/data/` | Persistent volume |
| `/data/chromium-profile/` | Chromium user data dir (cookies, sessions) |
| `/etc/supervisor/conf.d/supervisord.conf` | Process manager config |

## Source Layout

```
src/
  app.ts              # Fastify app, all route definitions
  server.ts           # Entry point, starts the app
  shared/
    env.ts            # Environment config (EnvConfig interface)
    validation.ts     # Video ID validation helpers
  infrastructure/
    logger.ts         # Pino logger
    rate-limit.ts     # Per-IP rate limiter
    cache.ts          # In-memory TTL cache
    errors.ts         # Custom error classes
  domains/
    youtube/
      ytdlp.ts        # YtDlpService: search, playlist, video info
      formats.ts      # Format selection (video/audio)
      types.ts        # VideoInfo, SearchResult types
    catalog/
      handler.ts      # Catalog pagination, meta building
      prewarm.ts      # Background video info prefetch
    stremio/
      plugin.ts       # Stremio manifest route (bare /manifest.json)
      manifest.ts     # Manifest object definition
      types.ts        # Stremio type definitions
    stream/
      handler.ts      # Stream URL building
    meta/
      handler.ts      # Meta object building
    subtitles/
      handler.ts      # Subtitle list building
    config/
      encryption.ts   # AES encrypt/decrypt config
      schema.ts       # AppConfig schema + defaults
    sponsorblock/
      client.ts       # SponsorBlock API client
    dearrow/
      client.ts       # DeArrow API client
      types.ts
frontend/             # React SPA (configure page)
docker/
  Dockerfile          # Multi-stage build
  supervisord.conf    # Process manager
  start-vnc.sh        # VNC startup script
  docker-compose.yml  # Reference compose file
```

## Stremio Route Structure

All Stremio data routes require an encrypted config prefix:
- `/{config}/manifest.json`
- `/{config}/catalog/:type/:id.json`
- `/{config}/catalog/:type/:id/:extra.json`
- `/{config}/meta/:type/:id.json`
- `/{config}/stream/:type/:id.json`
- `/{config}/subtitles/:type/:id.json`

Plus a bare `/manifest.json` (registered via stremio plugin).

The config param is validated with regex `[A-Za-z0-9_\\-]{32,}`.

## Cookie Flow

1. `BROWSER_COOKIES` env var controls behavior: `auto` (default), `on`, `off`
2. When `auto`: checks if `/data/chromium-profile` exists, enables browser cookies if so
3. yt-dlp is called with `--cookies-from-browser 'chromium:/data/chromium-profile'`
4. User logs into Google via noVNC (Chromium opens to Google sign-in on startup)
5. After login, yt-dlp can access subscriptions, history, watch later

## Docker Build & Deploy (LXC 101)

```bash
# Build from source
cd /opt/tubioplus
docker build -f docker/Dockerfile -t cat5edopeha/tubioplus:nightly .

# Deploy
docker stop tubioplus && docker rm tubioplus
docker run -d --name tubioplus --restart unless-stopped \
  -p 8000:8000 -p 6080:6080 \
  -v tubio-data:/data --shm-size=256m \
  -e PORT=8000 -e RATE_LIMIT=on -e CATALOG_LIMIT=100 \
  -e BROWSER_COOKIES=auto \
  -e 'NOVNC_URL=http://192.168.10.9:6080/vnc.html' \
  cat5edopeha/tubioplus:nightly
```

## Development Notes

- `NODE_ENV=production` is baked into the Dockerfile production stage (not passed at runtime)
- The app silently catches yt-dlp errors in catalog handlers and returns `{ metas: [] }` — check yt-dlp directly inside the container when debugging empty results
- supervisorctl socket is not configured, so `supervisorctl status` won't work inside the container; use `ps aux` instead
- Chromium creates `SingletonLock`/`SingletonSocket`/`SingletonCookie` files that must be cleaned on startup (handled in supervisord.conf)
- Tests use vitest: `npm test`

## Resolved Issues Log

1. **pino-pretty crash** (d96a0ff): Missing `NODE_ENV=production` in Dockerfile production stage caused dev transport load attempt
2. **Chromium exit code 21** (d96a0ff): Missing `--no-first-run --disable-dev-shm-usage` flags + stale singleton lock files from persistent volume
3. **Addon install failed** (312ce0a): Missing config-prefixed manifest route (`/:config/manifest.json`)
4. **Empty catalogs** (pending): yt-dlp `--cookies-from-browser chromium` looked in wrong path; fix: use `chromium:/data/chromium-profile`
