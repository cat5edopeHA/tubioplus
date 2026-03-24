# CLAUDE.md — TubioPlus Project Context

## What This Is

TubioPlus is a self-hosted Stremio addon that serves YouTube content via yt-dlp. It provides search, trending, popular, subscriptions, history, watch later, and channel-based catalogs with multi-quality streaming (360p–1080p on main, up to 4K on testing/nightly). Higher quality streams use ffmpeg to mux separate video+audio tracks.

User preferences (quality, cookies, DeArrow, SponsorBlock, etc.) are AES-256 encrypted into a config token embedded in the Stremio install URL — no server-side state per user. Don't break the encryption in `config.js`; it would invalidate all existing user installs.

## Architecture

```
src/
  index.js                # Express server, BASE_PATH mounting, rate limiting init
  config.js               # Encrypt/decrypt user config tokens, defaults merge
  routes/
    catalog.js            # Stremio catalog — search, recommendations, subscriptions, history, WL
    stream.js             # Stremio stream endpoint — quality tiers, DASH stream list
    play.js               # Play endpoint — resolves actual stream URLs at play time
    meta.js               # Stremio meta endpoint — video metadata
    configure.js          # Web UI for building/editing user config
  services/
    ytdlp.js              # All yt-dlp invocations — search, playlist, video info, formats
    cache.js              # In-memory LRU cache for yt-dlp results
    dearrow.js            # DeArrow API (better titles/thumbnails)
    sponsorblock.js       # SponsorBlock integration
  middleware/
    rateLimit.js          # Per-endpoint rate limiting
```

Nightly-specific files:
```
docker/
  supervisord.conf  # Process manager config (Xvfb, x11vnc, noVNC, Chromium, Node)
  start-vnc.sh      # VNC startup script
```

Key dependencies: express, yt-dlp (system binary, downloaded at build time from latest GitHub release), ffmpeg (system binary), crypto (built-in). Nightly adds: chromium, xvfb, x11vnc, novnc, supervisord.

## Branch Strategy

| Branch | Purpose | Docker Hub Tag | Notes |
|--------|---------|---------------|-------|
| `main` | Stable release | `cat5edopeha/tubioplus:latest` + `:main` | 360p–1080p, no embedded browser |
| `testing` | Feature staging | `cat5edopeha/tubioplus:testing` | Adds 4K (VP9/AV1), BASE_PATH subfolder mounting |
| `nightly` | Experimental | `cat5edopeha/tubioplus:nightly` | Adds headless Chromium + noVNC for cookie management |

All three branches have: pagination support (`skip` extra param), configurable `CATALOG_LIMIT`, Docker Hub CI/CD.

Promotion flow: `nightly` → `testing` → `main`. The 4K and BASE_PATH features in `testing` are pending merge to `main`.

## CI/CD

`.github/workflows/publish.yml` triggers on push to any of the three branches. Builds multi-arch (amd64 + arm64) Docker images and pushes to Docker Hub with the appropriate tag. Uses GHA layer cache. Requires repo secrets: `DOCKERHUB_USERNAME` (`cat5edopeha`) and `DOCKERHUB_TOKEN`.

## Deployment

- **Live instance:** Fedora box at `192.168.10.163:8000`
- **Public URL:** `https://youtubio.m2bw.net` (Pangolin reverse proxy + Newt tunnel for SSL termination)
- **Newt** runs in LXC 101 on Proxmox and tunnels traffic to the Fedora box
- **Docker Hub:** GitHub Actions builds and pushes on every push to main/testing/nightly

> **Pangolin note:** The health check port in Pangolin's config must match the proxy target port. Changing the app port without updating `hcPort` in Pangolin's SQLite DB causes "no available server" errors.

```bash
# Pull and restart
docker compose pull && docker compose up -d

# Logs
docker compose logs -f

# noVNC browser login (nightly)
http://192.168.10.163:6080/vnc.html
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8000` | HTTP listen port |
| `ENCRYPTION_KEY` | (required) | 64-char hex key for config encryption |
| `CATALOG_LIMIT` | `100` | Max videos fetched per catalog/search |
| `BASE_PATH` | `""` | Subfolder prefix (e.g. `/tubio`); testing/nightly |
| `BROWSER_COOKIES` | `auto` | `auto` / `true` / `false` — Chromium cookie mode; nightly |
| `VNC_PASSWORD` | `""` | noVNC password; leave empty to disable auth; nightly |
| `RATE_LIMIT` | `true` | Set `false` to disable per-endpoint rate limiting |
| `NODE_ENV` | `production` | |

## Nightly Branch: Cookie Management

YouTube cookies expire fast, breaking yt-dlp requests for auth-gated content (subscriptions, history, recommendations). This branch solves it by bundling headless Chromium inside the Docker container:

- **Xvfb** provides a virtual display (`:99`)
- **x11vnc** exposes it as a VNC server
- **noVNC** (port 6080) provides browser-based access at `/vnc.html`
- **supervisord** manages all processes (Xvfb → x11vnc → noVNC → Chromium → Node app)
- User logs into YouTube once via the noVNC web UI
- yt-dlp uses `--cookies-from-browser chromium` to pull fresh cookies
- Chromium profile persists at `/data/chromium-profile` via Docker volume (symlinked to `/root/.config/chromium`)
- Stale Chromium lock files are cleared on container startup
- `shm_size: 256mb` required in docker-compose or the Chromium renderer crashes

The Docker image is significantly larger due to Chromium. VNC port (6080) should never be exposed to the internet without `VNC_PASSWORD` set.

## Known Issues

- **Cookie expiration** — YouTube sessions expire periodically; user must re-login via noVNC. The Chromium solution is experimental and under active validation.
- **4K codec compatibility** — 4K uses VP9/AV1 (YouTube doesn't serve h264 above 1080p). Not supported on all Stremio clients/devices.
- **Stremio Lite compatibility** — may require "Show Unsupported Streams" enabled for some stream types.
- **yt-dlp timeouts** — some searches/feeds can be slow; timeout is 90s.
- **GitHub Actions Node 20 deprecation** — Docker actions will need upstream updates by June 2, 2026.
- **Nightly image size** — Chromium adds significant size vs. main/testing images.

## Active Work

- Validating Chromium + noVNC cookie solution on real iOS/Stremio Lite clients
- Docker Hub publishing working on all three branches
- Testing branch 4K and BASE_PATH features pending validation before merge to main

## Stremio Addon Install Flow

1. User opens `https://youtubio.m2bw.net/configure` in browser
2. Selects quality preference (and optional cookies/DeArrow/SponsorBlock)
3. Clicks Install — Stremio receives the manifest URL with encrypted config in the path
4. Catalog/stream requests include the config token; server decrypts per-request

## Pagination

Two-tier: first page (`skip=0`) returns 20 items; subsequent pages return 10. Hard stop at `CATALOG_LIMIT`. The `skip` param comes from Stremio's extra URL segment.

## Useful Commands

```bash
# Health check
curl https://youtubio.m2bw.net/health

# Manifest
curl https://youtubio.m2bw.net/manifest.json

# Docker pull (nightly)
docker pull cat5edopeha/tubioplus:nightly

# Run locally
docker compose up -d

# Access noVNC (nightly only)
open http://localhost:6080/vnc.html
```
