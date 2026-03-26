> [!IMPORTANT]
> **TubioPlus v2.0 is coming.** The `nightly` branch contains a complete ground-up rewrite in TypeScript with Fastify, browser-based YouTube login, subtitles, SponsorBlock, DeArrow, and more. When it's ready, it will replace this branch entirely. Check out the [`nightly` branch](https://github.com/cat5edopeHA/tubioplus/tree/nightly) to try it now. This branch (`main`) and the `testing` branch will be removed once v2.0 is promoted to `main`.

# Tubio+

YouTube addon for Stremio — stream YouTube content directly in Stremio Lite on iOS, tvOS, and web.

Inspired by [YouTubio](https://github.com/xXCrash2BomberXx/YouTubio). Vibe coded with love.

## Features

- Search YouTube, browse recommendations, subscriptions, history, and watch later
- Quality up to 1080p (h264 for iOS compatibility)
- SponsorBlock integration (skip sponsors, intros, outros, etc.)
- DeArrow support (community titles & thumbnails)
- Cookie based authentication for personalized feeds
- On the fly FFmpeg muxing for higher quality streams
- AES 256 encrypted config with a unique key per deployment
- Catalog pagination (loads 20 initially, then 10 more on scroll)

## Deploy with Docker

Pull the prebuilt image from Docker Hub:

```bash
docker run -d --name tubio -p 8800:8000 --restart unless-stopped cat5edopeha/tubioplus
```

Or a specific branch:

```bash
# Stable
docker run -d --name tubio -p 8800:8000 --restart unless-stopped cat5edopeha/tubioplus:latest

# Testing (4K, subfolder support)
docker run -d --name tubio -p 8800:8000 --restart unless-stopped cat5edopeha/tubioplus:testing

# Nightly (browser login, no cookie pasting)
docker run -d --name tubio -p 8800:8000 -p 6080:6080 -v tubioplus-data:/data --restart unless-stopped cat5edopeha/tubioplus:nightly
```

Or with docker compose (pulls automatically):

```bash
docker compose up -d
```

Then open `http://your-host:8800/configure` to set up cookies and install in Stremio.

### Build locally

```bash
docker build -t tubioplus .
docker run -d --name tubio -p 8800:8000 --restart unless-stopped tubioplus
```

## Run with Node.js

Requires Node.js 18+, yt-dlp, and FFmpeg.

```bash
git clone https://github.com/cat5edopeHA/tubioplus.git
cd tubioplus
npm install
npm start
```

## Branches

| Branch | Docker Hub Tag | Key Differences |
|--------|---------------|-----------------|
| `main` | `cat5edopeha/tubioplus:latest` | Stable release, rate limiting ON, catalog pagination (20 initial + 10 per scroll, up to 100) |
| `testing` | `cat5edopeha/tubioplus:testing` | Rate limiting OFF, 4K playback (VP9/AV1), subfolder support (`BASE_PATH` env var) |
| `nightly` | `cat5edopeha/tubioplus:nightly` | Everything in testing + embedded Chromium with noVNC for browser based YouTube login (no manual cookie pasting) |

Set `RATE_LIMIT=on` or `RATE_LIMIT=off` via environment variable to override the default for either branch.

Set `CATALOG_LIMIT` to control the maximum number of videos fetched per catalog (default: 100).

Set `BASE_PATH` to mount the addon under a subfolder (e.g., `BASE_PATH=/tubio` serves at `https://myserver.com/tubio`). Testing and nightly branches only.

## Browser Login (Nightly)

The nightly build includes an embedded Chromium browser accessible through noVNC. You log into YouTube once through a real browser, and yt-dlp automatically pulls cookies from that session. No more extracting and pasting cookie files.

```bash
docker run -d --name tubio -p 8800:8000 -p 6080:6080 -v tubioplus-data:/data --restart unless-stopped cat5edopeha/tubioplus:nightly
```

Open `http://your-host:6080/vnc.html` to sign into YouTube, then open `http://your-host:8800/configure` to install the addon.

**Important:** Port 6080 (the VNC interface) gives unauthenticated access to a browser with your Google account logged in. **Do not expose port 6080 to the internet.** Keep it on your local network only. If you need remote access, use a VPN. Port 8800 (the addon itself) is safe to expose. See [NIGHTLY_SETUP.md](NIGHTLY_SETUP.md) for the full setup guide.

## Privacy

Your config (including cookies) is AES 256 encrypted with a unique key generated per deployment. However, the server decrypts cookies on every request to make YouTube API calls on your behalf. This is a fundamental limitation of any proxy based service. For full control over your data, self host your own instance.

## License

MIT
