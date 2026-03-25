# Stage 1: Build
FROM node:20-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json vitest.config.ts ./
COPY src/ src/
RUN npx tsc
COPY frontend/ frontend/
RUN cd frontend && npm ci && npm run build

# Stage 2: Production
FROM node:20-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg python3 chromium xvfb x11vnc novnc websockify supervisor \
    && rm -rf /var/lib/apt/lists/*

# Install yt-dlp
RUN python3 -c "import urllib.request; urllib.request.urlretrieve('https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp', '/usr/local/bin/yt-dlp')" \
    && chmod +x /usr/local/bin/yt-dlp

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist/ dist/
COPY docker/supervisord.conf /etc/supervisor/conf.d/supervisord.conf
COPY docker/start-vnc.sh /app/start-vnc.sh
RUN chmod +x /app/start-vnc.sh

# Chromium profile persistence
RUN mkdir -p /data/chromium-profile
VOLUME /data

ENV PORT=8000
ENV DISPLAY=:99
EXPOSE 8000 6080

CMD ["supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
