# Tubio++

YouTube addon for Stremio — stream YouTube content directly in Stremio Lite on iOS, tvOS, and web.

Inspired by [YouTubio](https://github.com/xXCrash2BomberXx/YouTubio).

## Features

- Search YouTube, browse recommendations, subscriptions, history, and watch later
- Quality up to 1080p (h264 for iOS compatibility)
- SponsorBlock integration (skip sponsors, intros, outros, etc.)
- DeArrow support (community titles & thumbnails)
- Cookie-based authentication for personalized feeds
- On-the-fly FFmpeg muxing for higher quality streams

## Deploy with Docker

```bash
docker run -d --name tubiopp -p 8800:8000 --restart unless-stopped ghcr.io/cat5edopeha/tubiopp:latest
```

Or build locally:

```bash
docker build -t tubiopp .
docker run -d --name tubiopp -p 8800:8000 --restart unless-stopped tubiopp
```

Then open `http://your-host:8800/configure` to set up cookies and install in Stremio.

## License

MIT
