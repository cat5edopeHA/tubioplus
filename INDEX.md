# yt-stremio Documentation Index

Complete guide to all documentation and source files.

## Quick Navigation

### For First-Time Users
1. Start with **QUICKSTART.md** - 5-minute setup
2. Then read **README.md** - Complete feature overview

### For Developers
1. **ARCHITECTURE.md** - System design and components
2. **src/** - Browse source code with inline comments
3. **TESTING.md** - Testing procedures

### For DevOps/Deployment
1. **DEPLOYMENT.md** - Production deployment on Proxmox
2. **docker-compose.yml** - Docker orchestration
3. **Dockerfile** - Container image

### For Troubleshooting
1. **README.md** - Troubleshooting section
2. **TESTING.md** - Error scenarios and debugging
3. **DEPLOYMENT.md** - Monitoring and logs

## Documentation Files

### README.md (450 lines)
**What**: Complete feature and user guide
**When to read**: Before using the addon
**Contents**:
- Feature overview
- Installation instructions (Docker & manual)
- Configuration guide
- API endpoint documentation
- Environment variables
- Troubleshooting section
- Performance characteristics
- Security considerations
- Known limitations

### QUICKSTART.md (100 lines)
**What**: 5-minute setup guide
**When to read**: When you want to get started immediately
**Contents**:
- Docker setup (3 commands)
- Node.js setup
- iOS/tvOS critical notes
- Basic testing commands
- Common troubleshooting

### DEPLOYMENT.md (350 lines)
**What**: Production deployment for Proxmox/Docker
**When to read**: Before deploying to production
**Contents**:
- Proxmox LXC container creation
- Docker installation steps
- Pangolin reverse proxy configuration
- SSL/TLS setup
- Systemd auto-update timers
- Monitoring and logging
- Backup and recovery
- Security hardening
- Performance tuning

### TESTING.md (400 lines)
**What**: Comprehensive testing guide
**When to read**: Before testing deployment
**Contents**:
- Local development testing
- 15+ API endpoint test examples
- Docker container testing
- iOS/tvOS testing procedures
- Performance testing methodology
- Load testing with ApacheBench
- Error scenario testing
- Debugging techniques
- Testing checklist (20+ items)

### ARCHITECTURE.md (400 lines)
**What**: Technical architecture deep dive
**When to read**: To understand how it works
**Contents**:
- System architecture diagram
- Design philosophy (why no SDK)
- Core components explanation
- Request flow walkthrough
- Performance characteristics
- Memory usage analysis
- Security model
- Scalability considerations
- Future enhancements

### PROJECT_OVERVIEW.md
**What**: Executive project summary
**When to read**: To get project status and metrics
**Contents**:
- Project status
- Deliverables checklist
- Feature implementation status
- API endpoints summary
- Key technical achievements
- Code quality standards
- Next steps for user

### FILES_SUMMARY.txt
**What**: Complete file listing and metrics
**When to read**: To see project structure at a glance
**Contents**:
- All 24 files listed
- Line counts for each file
- File purposes
- Key metrics and statistics

## Source Code Structure

### Core Application (src/)

#### index.js (109 lines)
Express.js application entry point
- Server startup
- Route mounting
- Middleware setup (CORS, error handling)
- Startup banner

#### manifest.js (75 lines)
Stremio addon manifest definition
- Addon metadata
- Catalog definitions
- Resource types
- Behavior hints

#### config.js (82 lines)
Configuration encryption/decryption
- AES-256-CBC encryption
- Base64URL encoding
- Configuration merging
- Default values

### Routes (src/routes/)

#### configure.js (636 lines)
Configuration web UI and installation
- GET / - Addon info page
- GET /configure - Config form UI
- Quality selector
- SponsorBlock options
- DeArrow toggle
- Cookies input
- Config generation and encryption

#### catalog.js (112 lines)
Catalog endpoints
- GET /:config/catalog/:type/:id.json
- Supports 5 catalog types
- yt-dlp wrapper for extraction
- Meta conversion

#### meta.js (84 lines)
Video metadata endpoint
- GET /:config/meta/:type/:id.json
- Full video information
- DeArrow integration
- Caching

#### stream.js (100 lines)
Quality options endpoint
- GET /:config/stream/:type/:id.json
- Quality selection
- Format availability checking
- Stream URL generation

#### play.js (206 lines)
**CRITICAL**: Video streaming endpoint
- GET /play/:videoId.mp4?q=QUALITY
- Video ID validation
- Fresh yt-dlp extraction
- Format selection (h264 video, AAC audio)
- 360p redirect handling
- FFmpeg muxing for 720p+
- Process management
- Client disconnect handling

### Services (src/services/)

#### ytdlp.js (281 lines)
YouTube extraction wrapper
- searchYouTube(query, limit)
- getTrending()
- getSubscriptions(cookies)
- getHistory(cookies)
- getWatchLater(cookies)
- getVideoInfo(videoId)
- getFormatInfo(videoId) - h264 selection
- getAudioInfo(videoId) - AAC selection
- isValidVideoId(videoId)

#### cache.js (54 lines)
In-memory TTL cache
- set(key, value, ttlSeconds)
- get(key) - returns null if expired
- Cache invalidation
- Configurable TTL per data type

#### sponsorblock.js (116 lines)
SponsorBlock API integration
- getSkipSegments(videoId, categories)
- Segment filtering
- FFmpeg filter generation
- API status checking

#### dearrow.js (80 lines)
DeArrow API integration
- getDeArrowBranding(videoId)
- Community title fetching
- Community thumbnail fetching
- Highest-voted selection

## Configuration Files

### package.json
Node.js dependencies and scripts
- express ^4.18.2
- yt-dlp-wrap ^0.2.7
- node-cache ^5.1.2
- Start scripts for dev and production

### Dockerfile
Docker image definition
- Base: node:20-slim
- Installs: ffmpeg, yt-dlp
- Exposes: port 8000
- Health check included

### docker-compose.yml
Docker Compose orchestration
- Service configuration
- Port mapping
- Environment variables
- Network setup

### .env.example
Environment variable template
- PORT
- ENCRYPTION_KEY
- NODE_ENV

### .gitignore
Git ignore patterns
- node_modules/
- .env files
- .cache/
- Temporary files

## API Endpoints Reference

### GET /manifest.json
- Returns: Stremio addon manifest
- No parameters
- No auth required

### GET / → /configure
- Redirects to /configure
- No parameters

### GET /configure
- Returns: Configuration web UI (HTML)
- Features: Quality selector, cookies, SponsorBlock, DeArrow
- Form submission generates encrypted config

### GET /:config/catalog/:type/:id.json
- Parameters: config (encrypted), type, id, search (optional)
- Returns: { metas: [...] }
- Catalogs: yt:trending, yt:search, yt:subscriptions, yt:history, yt:watchlater

### GET /:config/meta/:type/:id.json
- Parameters: config (encrypted), type, id
- Returns: { id, type, name, poster, description, runtime, ... }
- Includes video metadata from yt-dlp

### GET /:config/stream/:type/:id.json
- Parameters: config (encrypted), type, id
- Returns: { streams: [...] }
- Streams include quality options and URLs

### GET /play/:videoId.mp4?q=QUALITY
- Parameters: videoId (11 chars), q (360/480/720/1080)
- Returns: video/mp4 stream via HTTP
- Critical endpoint - fresh extraction, FFmpeg muxing

### GET /health
- No parameters
- Returns: { status: "ok" }
- For monitoring and health checks

## Development Workflow

1. **Setup**: `npm install`
2. **Development**: `npm run dev` (auto-reload)
3. **Testing**: See TESTING.md
4. **Build**: `docker build -t yt-stremio .`
5. **Deploy**: `docker-compose up -d`

## Deployment Workflow

1. **Prepare**: Generate ENCRYPTION_KEY
2. **Configure**: Create .env file
3. **Build**: `docker build -t yt-stremio .`
4. **Deploy**: `docker-compose up -d`
5. **Verify**: `curl http://localhost:8000/health`
6. **Install**: Visit /configure and click "Install in Stremio"
7. **Use**: Enable unsupported streams on iOS and search!

For Proxmox deployment, see DEPLOYMENT.md.

## Testing Workflow

1. **Unit Tests**: See TESTING.md for endpoint tests
2. **Integration**: Test full flow (search → meta → stream → play)
3. **iOS Tests**: Test on device or simulator
4. **Load Tests**: Use ApacheBench (see TESTING.md)
5. **Error Tests**: Test failure scenarios (see TESTING.md)

## Key Concepts

### Configuration Encryption
- Encrypts: cookies, quality preference, SponsorBlock settings, DeArrow toggle
- Method: AES-256-CBC with random IV
- Encoding: Base64URL (URL-safe)
- Purpose: Hide sensitive data from URLs/logs
- Result: Safe to share encrypted config links

### Fresh URL Extraction
- Why: YouTube CDN URLs expire after hours
- Solution: Extract fresh on every /play request
- Ensures: Working URLs guaranteed
- Trade-off: ~2-3 second startup per request

### FFmpeg Muxing
- 360p: Direct redirect (YouTube provides muxed)
- 720p+: Spawn FFmpeg to mux h264 video + AAC audio
- Copy mode: No re-encoding (fast)
- Streaming flags: frag_keyframe+empty_moov+faststart
- Result: iOS-compatible MP4 streams

### iOS Compatibility
- Codec: h264 (avc1) for video, AAC (mp4a) for audio
- Container: MP4 with streaming flags
- Stream type: url only (no ytId/externalUrl)
- User action: Enable "Show Unsupported Streams"
- Result: Seamless playback on iOS/tvOS

## Common Tasks

### To install locally:
1. Read QUICKSTART.md
2. `docker-compose up -d`
3. Visit http://localhost:8000/configure

### To deploy to production:
1. Read DEPLOYMENT.md
2. Follow step-by-step instructions
3. Configure Pangolin reverse proxy

### To test endpoints:
1. Read TESTING.md
2. Use curl examples provided
3. Follow testing checklist

### To understand architecture:
1. Read ARCHITECTURE.md
2. Browse src/ directory
3. Review request flow diagrams

### To troubleshoot issues:
1. Check README.md troubleshooting section
2. Review TESTING.md error scenarios
3. Check logs: `docker-compose logs -f`

## File Dependencies

```
index.js
  ├── manifest.js
  ├── routes/configure.js
  ├── routes/catalog.js
  ├── routes/meta.js
  ├── routes/stream.js
  └── routes/play.js

routes/*
  ├── config.js (encryption/decryption)
  └── services/*

services/*
  ├── ytdlp.js (YouTube extraction)
  ├── cache.js (caching)
  ├── sponsorblock.js (SponsorBlock API)
  └── dearrow.js (DeArrow API)
```

## Statistics

- **Total Files**: 24
- **Code Files**: 12
- **Documentation**: 6
- **Config/Build**: 6
- **Lines of Code**: 1,935
- **Lines of Docs**: 1,700+
- **API Endpoints**: 8
- **Catalogs**: 5
- **Quality Levels**: 4
- **Service Integrations**: 4
- **Test Scenarios**: 20+

## Support & Help

All documentation is self-contained in this project.

- **Getting Started**: QUICKSTART.md
- **Features**: README.md
- **Deployment**: DEPLOYMENT.md
- **Testing**: TESTING.md
- **Architecture**: ARCHITECTURE.md
- **Troubleshooting**: README.md or TESTING.md
- **Code**: Browse src/ with inline comments

No external dependencies or third-party docs required.

---

**Last Updated**: March 22, 2026
**Status**: Complete and Production-Ready
