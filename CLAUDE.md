# CLAUDE.md — TubioPlus Project Context

## What This Is

TubioPlus is a self-hosted Stremio addon that serves YouTube content via yt-dlp. It provides search, trending, popular, and channel-based catalogs with multi-quality streaming (360p–1080p on main, up to 4K on testing). Higher quality streams use ffmpeg to mux separate video+audio tracks.

The addon exposes a Stremio-compatible manifest, catalog, and stream API. User preferences (quality, etc.) are encrypted into a config token embedded in the URL path, so each Stremio install can have its own settings without server-side state.

## Architecture

```
src/
  index.js          # Express server, route setup, static file serving
  manifest.js       # Stremio addon manifest (catalogs, types, extras)
  catalog.js        # Catalog handler — search, trending, popular, channel feeds
  stream.js         # Stream handler — returns quality-sorted stream list
  play.js           # Play endpoint — proxies video (direct or ffmpeg mux)
  ytdlp.js          # yt-dlp wrapper — fetches video info, formats, feeds
  config.js         # Encryption/decryption of user config tokens
  configure.html    # Browser-based configuration page for addon install
```

Key dependencies: express, yt-dlp (system binary), ffmpeg (system binary), node-fetch, crypto (built-in).

## Branch Strategy

| Branch | Purpose | Docker Hub Tag | Notes |
|--------|---------|---------------|-------|
| `main` | Stable release | `cat5edopeha/tubioplus:latest` | Production-ready, 360p–1080p |
| `testing` | Feature staging | `cat5edopeha/tubioplus:testing` | Adds 4K support, BASE_PATH for reverse proxy sub-paths |
| `nightly` | Experimental | `cat5edopeha/tubioplus:nightly` | Adds headless Chromium + noVNC for cookie management |

All three branches have: pagination support (skip extra), configurable CATALOG_LIMIT env var, Docker Hub CI/CD.

## Deployment

- **Current live instance:** Running on Fedora box at `192.168.10.163:8000`
- **Public URL:** `https://youtubio.m2bw.net` (via Pangolin reverse proxy + Newt tunnel)
- **Pangolin** handles SSL termination and routing. Newt runs in LXC 101 on Proxmox and tunnels traffic to the Fedora box.
- **Docker Hub:** `cat5edopeha/tubioplus` — GitHub Actions builds and pushes on every push to main, testing, or nightly
- **Docker Compose:** Each branch has a docker-compose.yml referencing the appropriate Hub image

Pangolin health check must point to the same port as the proxy target (learned the hard way — changing the app port without updating hcPort in Pangolin's SQLite DB causes "no available server" errors).

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 8000 | Server listen port |
| `ENCRYPTION_KEY` | (required) | 64-char hex key for config encryption |
| `CATALOG_LIMIT` | 100 | Max videos fetched per catalog/search |
| `BASE_PATH` | (none) | Sub-path prefix (testing branch only) |
| `BROWSER_COOKIES` | auto | Cookie mode: auto/true/false (nightly only) |
| `VNC_PASSWORD` | (none) | noVNC password (nightly only) |

## Nightly Branch: Cookie Management

YouTube cookies expire fast, breaking yt-dlp requests. The nightly branch solves this by bundling headless Chromium inside the Docker container:

- **Xvfb** provides a virtual display (`:99`)
- **x11vnc** exposes it as a VNC server
- **noVNC** (port 6080) provides browser-based access at `/vnc.html`
- **supervisord** manages all processes (Xvfb, x11vnc, noVNC, Chromium, Node app)
- User logs into YouTube once via the noVNC web UI
- yt-dlp uses `--cookies-from-browser chromium` to pull fresh cookies
- Chromium profile persists at `/data/chromium-profile` via Docker volume
- `shm_size: 256mb` required in docker-compose or Chromium's renderer crashes

## Known Issues

- **Cookie expiration** — YouTube cookies from static files expire within hours/days. The nightly branch cookie solution is experimental.
- **Stremio Lite compatibility** — requires "Show Unsupported Streams" enabled because streams use `url` type rather than direct video URLs
- **yt-dlp timeouts** — some searches/feeds can take a while; timeout is 90s
- **Node.js 20 action deprecation** — GitHub Actions will deprecate Node 20 runtime on June 2, 2026; Docker actions will need upstream updates

## Active Work

- Validating the nightly branch Chromium + noVNC cookie solution on real iOS/Stremio Lite clients
- Docker Hub publishing is set up and working on all three branches
- Testing branch has 4K and BASE_PATH features pending validation before merge to main

## Stremio Addon Install Flow

1. User opens `https://youtubio.m2bw.net/configure` in browser
2. Selects quality preference, clicks Install
3. Stremio receives manifest with encrypted config in URL path
4. Catalog/stream requests include the config token
5. Server decrypts config to apply user preferences per-request

## Useful Commands

```bash
# Health check
curl https://youtubio.m2bw.net/health

# Manifest
curl https://youtubio.m2bw.net/manifest.json

# Docker pull
docker pull cat5edopeha/tubioplus:latest
docker pull cat5edopeha/tubioplus:nightly

# Run locally
docker compose up -d
```
