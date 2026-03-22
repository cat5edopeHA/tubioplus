# Testing Guide

Comprehensive testing procedures for the yt-stremio addon.

## Local Development Testing

### Setup

```bash
# Install dependencies
npm install

# Ensure yt-dlp is in PATH
which yt-dlp
# If not found: pip install yt-dlp

# Ensure ffmpeg is in PATH
which ffmpeg
# If not found: apt-get install ffmpeg (or brew install ffmpeg on macOS)

# Start dev server
npm run dev
# Or for production: npm start
```

### Basic Endpoint Tests

```bash
# Test manifest
curl http://localhost:8000/manifest.json | jq .

# Expected output:
# {
#   "id": "yt.stremio.addon",
#   "name": "YouTube for Stremio",
#   "version": "1.0.0",
#   "types": ["channel"],
#   ...
# }

# Test health
curl http://localhost:8000/health | jq .
# Expected: { "status": "ok" }

# Test configure page
curl -I http://localhost:8000/configure
# Expected: 200 OK
```

### Configuration Generation

```bash
# Generate default config
curl http://localhost:8000/configure/configure | grep "config-value"

# The page should contain:
# - Cookies textarea
# - Quality selector (default 1080p)
# - SponsorBlock checkbox group
# - DeArrow toggle
```

### Catalog Tests

Create a test config:

```bash
node -e "
import { encryptConfig, DEFAULT_CONFIG } from './src/config.js';
const encrypted = encryptConfig(DEFAULT_CONFIG);
console.log(encrypted);
" > /tmp/test-config.txt

CONFIG=$(cat /tmp/test-config.txt)

# Test trending
curl "http://localhost:8000/$CONFIG/catalog/channel/yt:trending.json" | jq '.metas | length'
# Expected: >= 5 items

# Test search
curl "http://localhost:8000/$CONFIG/catalog/channel/yt:search.json?search=tutorial" | jq '.metas | length'
# Expected: >= 1 items

# Test with specific video
curl "http://localhost:8000/$CONFIG/catalog/channel/yt:search.json?search=dQw4w9WgXcQ" | jq '.metas'
```

### Meta Tests

```bash
CONFIG=$(cat /tmp/test-config.txt)

# Get metadata for a specific video (Rick Roll)
curl "http://localhost:8000/$CONFIG/meta/channel/yt:dQw4w9WgXcQ.json" | jq .

# Expected fields:
# {
#   "id": "yt:dQw4w9WgXcQ",
#   "type": "channel",
#   "name": "Rick Astley - Never Gonna Give You Up",
#   "poster": "https://...",
#   "description": "...",
#   "releaseInfo": "2009",
#   "runtime": "..." (minutes),
#   "links": [{ "name": "Rick Astley", "url": "..." }]
# }
```

### Stream Tests

```bash
CONFIG=$(cat /tmp/test-config.txt)

# Get available streams for a video
curl "http://localhost:8000/$CONFIG/stream/channel/yt:dQw4w9WgXcQ.json" | jq '.streams'

# Expected:
# [
#   {
#     "url": "https://localhost:8000/.../play/dQw4w9WgXcQ.mp4?q=1080",
#     "name": "1080p",
#     "description": "h264 + AAC",
#     "behaviorHints": { ... }
#   },
#   ...
# ]
```

### Play Endpoint Tests

```bash
CONFIG=$(cat /tmp/test-config.txt)
VIDEO_ID="dQw4w9WgXcQ"

# Test 360p (muxed format - should redirect or stream)
curl -I "http://localhost:8000/$CONFIG/play/$VIDEO_ID.mp4?q=360"
# Expected: 200 or 302

# Test 720p (should use FFmpeg muxing)
curl -I "http://localhost:8000/$CONFIG/play/$VIDEO_ID.mp4?q=720"
# Expected: 200 with video/mp4 content-type

# Actually stream (takes time)
curl "http://localhost:8000/$CONFIG/play/$VIDEO_ID.mp4?q=360" --output /tmp/test-video.mp4
ffprobe /tmp/test-video.mp4  # Verify it's a valid MP4

# Check file info
ls -lh /tmp/test-video.mp4
file /tmp/test-video.mp4  # Should say "ISO Media, MP4 Base Media"
```

## Docker Testing

### Build and Run

```bash
# Build image
docker build -t yt-stremio:latest .

# Run container
docker run -d \
  --name yt-stremio-test \
  -p 8000:8000 \
  -e PORT=8000 \
  -e ENCRYPTION_KEY="0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef" \
  yt-stremio:latest

# Check logs
docker logs yt-stremio-test

# Test from host
curl http://localhost:8000/manifest.json

# Stop container
docker stop yt-stremio-test
docker rm yt-stremio-test
```

### Docker Compose

```bash
# Start
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f

# Test
curl http://localhost:8000/manifest.json

# Stop
docker-compose down
```

## iOS/tvOS Testing

### Prerequisites

- iOS device or simulator with Stremio app installed
- Stremio Lite (free version)
- Network access to addon (local network or public IP)

### Installation Steps

1. **Get Configuration Link**
   ```
   http://your-addon-url/configure
   ```

2. **Click "Install in Stremio"**
   - Stremio app should open
   - Installation prompt appears
   - Confirm to install

3. **Enable Unsupported Streams** (Important!)
   ```
   Settings → Stream Quality → Show Unsupported Streams ✓
   ```

### Testing Playback

1. **Search for Video**
   - Open Stremio
   - Go to YouTube addon
   - Search for a popular video (e.g., "tutorial")

2. **Try Different Qualities**
   - 360p (muxed format)
   - 720p (FFmpeg muxed)
   - 1080p (FFmpeg muxed)

3. **Monitor Issues**
   - Check if video starts playing
   - Monitor bitrate switching
   - Check for buffering
   - Verify audio syncs with video

### Debug Mode

Enable request logging:

```bash
# Add to index.js before routes
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});
```

Watch server logs while playing:
```bash
docker-compose logs -f | grep -E "(play|ffmpeg|error)"
```

## Performance Testing

### Load Testing

Use Apache Bench or similar:

```bash
# Single request
ab -n 1 -c 1 http://localhost:8000/manifest.json

# Multiple concurrent requests
ab -n 100 -c 10 http://localhost:8000/manifest.json

# Search load
ab -n 50 -c 5 "http://localhost:8000/$CONFIG/catalog/channel/yt:search.json?search=test"
```

### Memory Usage

Monitor while streaming:

```bash
# Watch container memory
docker stats yt-stremio --no-stream

# Monitor from inside container
docker exec -it yt-stremio bash
top -p $(pgrep -f "node src/index")
```

### Network Bandwidth

Monitor FFmpeg streaming:

```bash
# Watch network I/O
iftop -i eth0

# Or check container network
docker stats yt-stremio
```

## Error Scenarios

### Test Invalid Inputs

```bash
CONFIG=$(cat /tmp/test-config.txt)

# Invalid video ID
curl "http://localhost:8000/$CONFIG/meta/channel/invalid.json"
# Expected: {} (empty object)

# Invalid quality
curl "http://localhost:8000/$CONFIG/play/dQw4w9WgXcQ.mp4?q=999"
# Expected: 400 error

# Missing config
curl "http://localhost:8000/invalid-config/catalog/channel/yt:trending.json"
# Expected: should use default config (no error)

# Non-existent video
curl "http://localhost:8000/$CONFIG/play/0000000000a.mp4?q=360"
# Expected: 404 error
```

### Test Network Failures

```bash
# Stop YouTube connectivity temporarily
# (iptables rule or firewall)
iptables -I OUTPUT -d youtube.com -j DROP

# Try to stream
curl "http://localhost:8000/$CONFIG/play/dQw4w9WgXcQ.mp4?q=360"
# Expected: connection timeout, graceful error

# Re-enable
iptables -D OUTPUT -d youtube.com -j DROP
```

### Test Resource Exhaustion

```bash
# Start many FFmpeg processes
for i in {1..10}; do
  curl "http://localhost:8000/$CONFIG/play/dQw4w9WgXcQ.mp4?q=1080" &
done

# Monitor:
docker stats yt-stremio
ps aux | grep ffmpeg | wc -l

# Kill all background requests
kill %1 %2 %3 ... etc
```

## SponsorBlock Testing

```bash
# Create config with SponsorBlock enabled
node -e "
import { encryptConfig } from './src/config.js';
const config = {
  cookies: '',
  quality: '720',
  sponsorblock: {
    enabled: true,
    categories: ['sponsor', 'selfpromo']
  },
  dearrow: { enabled: false }
};
console.log(encryptConfig(config));
" > /tmp/test-config-sb.txt

CONFIG=$(cat /tmp/test-config-sb.txt)

# Test catalog with SponsorBlock enabled
curl "http://localhost:8000/$CONFIG/catalog/channel/yt:search.json?search=sponsor" | jq '.metas'
```

## DeArrow Testing

```bash
# Create config with DeArrow enabled
node -e "
import { encryptConfig } from './src/config.js';
const config = {
  cookies: '',
  quality: '720',
  sponsorblock: { enabled: false, categories: [] },
  dearrow: { enabled: true }
};
console.log(encryptConfig(config));
" > /tmp/test-config-da.txt

CONFIG=$(cat /tmp/test-config-da.txt)

# Test meta with DeArrow
curl "http://localhost:8000/$CONFIG/meta/channel/yt:dQw4w9WgXcQ.json" | jq '.name, .poster'
# Should show community title if available
```

## Cookie Authentication Testing

```bash
# Export cookies from browser using:
# Chrome: https://chrome.google.com/webstore/detail/get-cookiestxt-locally/cclelndhjldjlipmkJeKc2d/
# Firefox: https://addons.mozilla.org/en-US/firefox/addon/get-cookies-txt-locally/

# Save as cookies.txt (Netscape format)

# Create config with cookies
node -e "
import { encryptConfig } from './src/config.js';
import { readFileSync } from 'fs';
const cookies = readFileSync('cookies.txt', 'utf8');
const config = {
  cookies: cookies,
  quality: '720',
  sponsorblock: { enabled: false, categories: [] },
  dearrow: { enabled: false }
};
console.log(encryptConfig(config));
" > /tmp/test-config-auth.txt

CONFIG=$(cat /tmp/test-config-auth.txt)

# Test subscriptions (requires valid cookies)
curl "http://localhost:8000/$CONFIG/catalog/channel/yt:subscriptions.json" | jq '.metas | length'
# Expected: > 0 if authenticated

# Test history
curl "http://localhost:8000/$CONFIG/catalog/channel/yt:history.json" | jq '.metas | length'

# Test watch later
curl "http://localhost:8000/$CONFIG/catalog/channel/yt:watchlater.json" | jq '.metas | length'
```

## Integration Testing

### Full Playback Flow

```bash
#!/bin/bash
CONFIG=$(cat /tmp/test-config.txt)

echo "1. Testing catalog..."
RESULTS=$(curl -s "http://localhost:8000/$CONFIG/catalog/channel/yt:search.json?search=tutorial" | jq '.metas')
echo "Found videos: $(echo "$RESULTS" | jq 'length')"

VIDEO_ID=$(echo "$RESULTS" | jq -r '.[0].id' | cut -d: -f2)
echo "Using video: $VIDEO_ID"

echo "2. Testing meta..."
META=$(curl -s "http://localhost:8000/$CONFIG/meta/channel/yt:$VIDEO_ID.json" | jq .)
echo "Title: $(echo "$META" | jq -r '.name')"

echo "3. Testing stream..."
STREAMS=$(curl -s "http://localhost:8000/$CONFIG/stream/channel/yt:$VIDEO_ID.json" | jq '.streams')
echo "Available qualities: $(echo "$STREAMS" | jq -r '[.[].name] | join(", ")')"

echo "4. Testing playback (360p)..."
curl -I "http://localhost:8000/$CONFIG/play/$VIDEO_ID.mp4?q=360" | head -3

echo "✓ Full flow test completed"
```

## Checklist

- [ ] Manifest endpoint returns valid JSON
- [ ] Configure page loads and renders correctly
- [ ] Config encryption/decryption works
- [ ] Search returns videos
- [ ] Trending loads without auth
- [ ] Subscriptions requires auth
- [ ] Meta endpoint returns video info
- [ ] Stream endpoint returns quality options
- [ ] 360p playback works (redirect)
- [ ] 720p+ playback works (FFmpeg)
- [ ] Video file is valid MP4
- [ ] Audio syncs with video
- [ ] FFmpeg process terminates on disconnect
- [ ] Container memory stays stable
- [ ] Handles missing video gracefully
- [ ] Handles network errors gracefully
- [ ] iOS shows streams after enabling unsupported
- [ ] Stremio can play videos from iOS app
- [ ] DeArrow titles appear if enabled
- [ ] SponsorBlock segments available if enabled
- [ ] Docker image builds without errors
- [ ] docker-compose starts without errors

## Debugging

### Enable Verbose Logging

```bash
# In index.js, add:
app.use((req, res, next) => {
  console.time(`${req.method} ${req.path}`);
  res.on('finish', () => {
    console.timeEnd(`${req.method} ${req.path}`);
  });
  next();
});
```

### Monitor yt-dlp Calls

```bash
# In ytdlp.js, add debug output
console.log(`[yt-dlp] Running: ${cmd}`);
```

### Monitor FFmpeg

```bash
# Add to play.js
ffmpeg.stderr.on('data', (data) => {
  console.log(`[FFmpeg] ${data.toString()}`);
});
```

### Check System Resources

```bash
# CPU usage
top -bn1 | head -20

# Memory
free -h

# Disk space
df -h

# Network
netstat -i
```

## Common Issues and Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| 404 on /manifest.json | Server not running | Start with `npm start` |
| "yt-dlp not found" | Not in PATH | Install: `pip install yt-dlp` |
| "ffmpeg not found" | Not in PATH | Install: `apt-get install ffmpeg` |
| Video won't stream | YouTube blocked | Check IP, use VPN if needed |
| Slow performance | Resource constraint | Increase container memory |
| Audio out of sync | FFmpeg flags wrong | Check `-movflags` parameters |
| iOS doesn't show streams | Unsupported streams disabled | Enable in Stremio settings |
| DeArrow not working | API down | Check https://dearrow.ajay.app |
| SponsorBlock not working | API down | Check https://sponsor.ajay.app |
