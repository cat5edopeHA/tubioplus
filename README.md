# Tubio+

YouTube addon for Stremio — stream YouTube content directly in Stremio Lite on iOS, tvOS, and web.

Inspired by [YouTubio](https://github.com/xXCrash2BomberXx/YouTubio). Vibe coded with love.

## Features

- Search YouTube, browse recommendations, subscriptions, history, and watch later
- Quality up to 1080p (h264 for iOS compatibility)
- SponsorBlock integration (skip sponsors, intros, outros, etc.)
- DeArrow support (community titles & thumbnails)
- Cookie-based authentication for personalized feeds
- On-the-fly FFmpeg muxing for higher quality streams
- AES-256 encrypted config with a unique key per deployment

## Deploy with Docker

```bash
docker run -d --name tubioplus -p 8800:8000 --restart unless-stopped tubioplus
```

Or build locally:

```bash
docker build -t tubioplus .
docker run -d --name tubioplus -p 8800:8000 --restart unless-stopped tubioplus
```

Then open `http://your-host:8800/configure` to set up cookies and install in Stremio.

## Run with Node.js

Requires Node.js 18+, yt-dlp, and FFmpeg.

```bash
git clone https://github.com/cat5edopeHA/tubioplus.git
cd tubioplus
npm install
npm start
```

## Privacy

Your config (including cookies) is AES-256 encrypted with a unique key generated per deployment. However, the server decrypts cookies on every request to make YouTube API calls on your behalf. This is a fundamental limitation of any proxy-based service. For full control over your data, self-host your own instance.

## License

MIT
