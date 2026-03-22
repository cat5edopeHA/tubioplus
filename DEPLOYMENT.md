# Deployment Guide

Complete instructions for deploying yt-stremio on Proxmox with a residential IP and Pangolin reverse proxy.

## Prerequisites

- Proxmox host with LXC container support
- Residential IP or domain name
- Pangolin reverse proxy installed and configured
- Docker and Docker Compose installed in container

## Step 1: Create LXC Container

On Proxmox host:

```bash
# Create Ubuntu 22.04 LXC container (ID 100)
pct create 100 local:vztmpl/ubuntu-22.04-standard_22.04-1_amd64.tar.zst \
  --hostname yt-stremio \
  --memory 2048 \
  --cores 2 \
  --storage local-lvm \
  --network name=eth0,bridge=vmbr0,ip=dhcp

# Start container
pct start 100

# Enter container
pct shell 100
```

## Step 2: Install Dependencies

Inside the LXC container:

```bash
# Update packages
apt-get update && apt-get upgrade -y

# Install Docker and Docker Compose
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Install Docker Compose
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Verify installation
docker --version
docker-compose --version
```

## Step 3: Clone and Configure Addon

```bash
# Clone repository (or copy files)
cd /opt
git clone https://github.com/yourusername/yt-stremio.git
cd yt-stremio

# Generate encryption key
ENCRYPTION_KEY=$(openssl rand -hex 32)
echo "Generated key: $ENCRYPTION_KEY"

# Create .env file
cat > .env << EOF
PORT=8000
ENCRYPTION_KEY=$ENCRYPTION_KEY
NODE_ENV=production
HOST=yt.m2bw.net
EOF

# Verify .env
cat .env
```

## Step 4: Start with Docker Compose

```bash
cd /opt/yt-stremio

# Build and start
docker-compose up -d

# Verify it's running
docker-compose ps

# Check logs
docker-compose logs -f yt-stremio

# Test locally
curl http://localhost:8000/manifest.json
```

## Step 5: Configure Pangolin Reverse Proxy

In Pangolin (or your reverse proxy):

```
Domain: yt.m2bw.net
Backend: http://container-ip:8000
Protocol: https (enable SSL)
Path: /
```

Example Nginx config:
```nginx
server {
    listen 443 ssl http2;
    server_name yt.m2bw.net;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://yt-stremio:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Important for streaming
        proxy_buffering off;
        proxy_request_buffering off;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
    }
}

server {
    listen 80;
    server_name yt.m2bw.net;
    return 301 https://$server_name$request_uri;
}
```

## Step 6: Verify Installation

```bash
# Test manifest
curl https://yt.m2bw.net/manifest.json | jq .

# Test health check
curl https://yt.m2bw.net/health | jq .

# Test configure page
curl -I https://yt.m2bw.net/configure
```

## Step 7: Install in Stremio

### From Web UI

1. Open https://yt.m2bw.net/configure
2. Configure settings as desired
3. Click "Install in Stremio"
4. Stremio should open with installation prompt

### Manual Installation

```bash
# Get configuration link from web UI
# Then in Stremio, use:
stremio://install/https://yt.m2bw.net/ENCRYPTED_CONFIG
```

## Step 8: Setup Auto-Updates

Create systemd timer to keep addon updated:

```bash
sudo tee /etc/systemd/system/yt-stremio-update.service << EOF
[Unit]
Description=Update yt-stremio addon
After=network.target

[Service]
Type=oneshot
WorkingDirectory=/opt/yt-stremio
ExecStart=/usr/bin/docker-compose pull
ExecStart=/usr/bin/docker-compose up -d
EOF

sudo tee /etc/systemd/system/yt-stremio-update.timer << EOF
[Unit]
Description=Update yt-stremio daily

[Timer]
OnCalendar=daily
OnCalendar=02:00
Persistent=true

[Install]
WantedBy=timers.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable yt-stremio-update.timer
sudo systemctl start yt-stremio-update.timer
```

## Step 9: Monitoring

### Container Logs

```bash
# Watch logs
docker-compose logs -f

# Tail last 100 lines
docker-compose logs --tail=100
```

### Resource Usage

```bash
# Monitor container stats
docker stats yt-stremio
```

### Health Check

```bash
# Set up cron job to check health
(crontab -l 2>/dev/null; echo "*/5 * * * * curl -f https://yt.m2bw.net/health || systemctl restart yt-stremio") | crontab -
```

## Troubleshooting

### Container Won't Start

```bash
# Check logs
docker-compose logs

# Rebuild
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### Connection Issues

```bash
# Test from host to container
curl http://container-ip:8000/health

# Test from external
curl https://yt.m2bw.net/health

# Check firewall
ufw allow 8000/tcp
```

### Out of Memory

```bash
# Increase container memory in Proxmox
pct set 100 --memory 4096

# Or restart container and monitor
docker-compose restart
docker stats
```

### Slow Streaming

1. Check FFmpeg CPU usage: `docker stats` and `top`
2. Increase container cores in Proxmox
3. Check network bandwidth
4. Try lower quality (360p vs 1080p)

### Video Won't Play on iOS

1. Ensure iOS has "Show Unsupported Streams" enabled
2. Check FFmpeg is running: `docker logs yt-stremio | grep ffmpeg`
3. Try a different video
4. Check server logs for errors

## Backup and Recovery

### Backup Configuration

```bash
# Backup .env file
cp /opt/yt-stremio/.env /backup/yt-stremio.env.backup

# Backup docker volumes (if any)
docker-compose down
tar -czf /backup/yt-stremio-data.tar.gz /opt/yt-stremio/
```

### Restore Configuration

```bash
# Restore .env file
cp /backup/yt-stremio.env.backup /opt/yt-stremio/.env

# Restore full backup
cd /
tar -xzf /backup/yt-stremio-data.tar.gz

# Restart
docker-compose up -d
```

## Performance Tuning

### Cache Settings

Edit `src/services/cache.js` to adjust TTL:

```javascript
// Increase TTLs for larger cache
cache.set(cacheKey, value, 1800); // 30 minutes
```

### FFmpeg Optimization

For higher resolution streaming, add to `docker-compose.yml`:

```yaml
yt-stremio:
  # ... other config ...
  environment:
    # Increase buffer
    PIPE_BUFFER_SIZE: 1048576
  # Increase resource limits
  deploy:
    resources:
      limits:
        cpus: '4'
        memory: 4G
```

### yt-dlp Optimization

For faster extraction, add to `src/services/ytdlp.js`:

```javascript
// Add socket timeout
const timeout = 15000; // 15 seconds
```

## Security Hardening

### SSL/TLS

Always use HTTPS in production:

```bash
# Use Let's Encrypt with certbot
certbot certonly --webroot -w /var/www/html -d yt.m2bw.net

# Auto-renew
certbot renew --quiet --no-eff-email
```

### Rate Limiting

Add to reverse proxy config:

```nginx
limit_req_zone $binary_remote_addr zone=yt_stremio:10m rate=10r/s;

location / {
    limit_req zone=yt_stremio burst=20 nodelay;
    proxy_pass http://yt-stremio:8000;
}
```

### IP Whitelisting (optional)

```nginx
# Allow only specific networks
allow 203.0.113.0/24;  # Your network
deny all;
```

## Container Logs

### Important Patterns to Monitor

```bash
# Watch for errors
docker-compose logs -f | grep -i error

# Watch for FFmpeg issues
docker-compose logs -f | grep -i ffmpeg

# Watch for yt-dlp issues
docker-compose logs -f | grep -i "yt-dlp"
```

## Cleanup and Maintenance

### Remove Old Images

```bash
docker image prune -a -f
```

### Clear Cache

```bash
docker exec yt-stremio npm run clear-cache
# Or restart to clear in-memory cache
docker-compose restart
```

### Update yt-dlp

```bash
docker-compose exec yt-stremio pip install --upgrade yt-dlp
docker-compose restart
```

## Migration

### Moving to Different Host

```bash
# On old host
docker-compose down
tar -czf backup.tar.gz /opt/yt-stremio

# On new host
tar -xzf backup.tar.gz
cd /opt/yt-stremio
docker-compose up -d

# Update DNS/Pangolin to point to new host
```

## Support and Debugging

### Collect Debug Info

```bash
# Create debug bundle
mkdir -p /tmp/yt-stremio-debug
docker-compose logs > /tmp/yt-stremio-debug/logs.txt
docker-compose ps > /tmp/yt-stremio-debug/status.txt
env | grep -i yt >> /tmp/yt-stremio-debug/env.txt
docker stats --no-stream > /tmp/yt-stremio-debug/stats.txt

# Bundle
tar -czf /tmp/yt-stremio-debug.tar.gz /tmp/yt-stremio-debug/
```
