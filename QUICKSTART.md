# Quick Start Guide

Get yt-stremio running in 5 minutes.

## For Docker Users (Recommended)

```bash
# Clone the repo
git clone https://github.com/yourusername/yt-stremio.git
cd yt-stremio

# Generate encryption key
ENCRYPTION_KEY=$(openssl rand -hex 32)
echo $ENCRYPTION_KEY

# Create .env file
cat > .env << EOF
PORT=8000
ENCRYPTION_KEY=$ENCRYPTION_KEY
NODE_ENV=production
EOF

# Start with Docker Compose
docker-compose up -d

# Open configuration page
open http://localhost:8000/configure
# Or visit in browser: http://localhost:8000/configure
```

## For Node.js Users

```bash
# Install dependencies
npm install

# Install system dependencies (macOS)
brew install ffmpeg yt-dlp

# Install system dependencies (Ubuntu/Debian)
sudo apt-get install ffmpeg python3-pip
pip install yt-dlp

# Start development server
npm run dev

# Or production
PORT=8000 npm start

# Open in browser
open http://localhost:8000/configure
```

## Installation in Stremio

1. Visit http://localhost:8000/configure
2. (Optional) Add YouTube cookies for subscriptions/history
3. (Optional) Select quality preference and features
4. Click "Install in Stremio"
5. Stremio will open with installation prompt
6. Confirm installation

## Important: iOS/tvOS Users

After installing, you MUST enable "Show Unsupported Streams" in Stremio:

```
Settings → Stream Quality → Show Unsupported Streams ✓
```

Without this, YouTube streams won't appear.

## Test It

```bash
# Test manifest
curl http://localhost:8000/manifest.json

# Test search
curl "http://localhost:8000/[CONFIG]/catalog/channel/yt:search.json?search=tutorial"

# Note: Replace [CONFIG] with actual encrypted config from /configure page
```

## Troubleshooting

### "yt-dlp not found"
```bash
pip install yt-dlp
```

### "ffmpeg not found"
```bash
# macOS
brew install ffmpeg

# Ubuntu/Debian
sudo apt-get install ffmpeg

# Fedora
sudo dnf install ffmpeg
```

### Port already in use
```bash
# Use different port
PORT=8001 npm start
```

### Can't access from another device
```bash
# Get your IP
hostname -I  # Linux
ifconfig      # macOS

# Access as: http://YOUR_IP:8000/configure
```

## Next Steps

- Read [README.md](README.md) for detailed documentation
- Read [DEPLOYMENT.md](DEPLOYMENT.md) to deploy to production
- Read [TESTING.md](TESTING.md) for testing procedures
- Check [CONFIGURATION.md](CONFIGURATION.md) for advanced setup

## File Structure

```
yt-stremio/
├── package.json              # Node dependencies
├── Dockerfile                # Docker image
├── docker-compose.yml        # Docker Compose
├── .env.example             # Environment template
├── README.md                # Full documentation
├── QUICKSTART.md            # This file
├── DEPLOYMENT.md            # Deployment guide
├── TESTING.md               # Testing guide
└── src/
    ├── index.js             # Express app
    ├── manifest.js          # Stremio manifest
    ├── config.js            # Config encryption
    ├── routes/              # API endpoints
    └── services/            # Business logic
```

## Key Features

✅ Search YouTube
✅ Trending videos
✅ Subscriptions (with authentication)
✅ Watch history (with authentication)
✅ Watch later (with authentication)
✅ Multiple quality options (360p-1080p)
✅ SponsorBlock integration
✅ DeArrow support
✅ iOS/tvOS compatible
✅ FFmpeg on-the-fly muxing for HD
✅ Encrypted configuration
✅ In-memory caching
✅ Docker support

## Support

Check the [README.md](README.md) troubleshooting section for common issues.

## License

MIT
