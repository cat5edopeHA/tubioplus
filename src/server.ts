import { buildApp, getActiveProcesses } from './app.js';
import { loadEnv } from './shared/env.js';
import { networkInterfaces } from 'node:os';
import { spawn } from 'node:child_process';

function getLocalIp(): string {
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] ?? []) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return '127.0.0.1';
}

async function checkBinary(command: string, args: string[]): Promise<boolean> {
  try {
    const proc = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    return new Promise((resolve) => proc.on('close', (code) => resolve(code === 0)));
  } catch {
    return false;
  }
}

async function waitForChromium(maxWaitMs: number = 15000): Promise<boolean> {
  const interval = 1000;
  let elapsed = 0;
  while (elapsed < maxWaitMs) {
    const found = await new Promise<boolean>((resolve) => {
      const proc = spawn('pgrep', ['-x', 'chromium'], { stdio: ['ignore', 'pipe', 'pipe'] });
      proc.on('close', (code) => resolve(code === 0));
      proc.on('error', () => resolve(false));
    });
    if (found) return true;
    await new Promise((r) => setTimeout(r, interval));
    elapsed += interval;
  }
  return false;
}

const BANNER = `
  ╔════════════════════════════╗
  ║       Tubio+ v2.0.0       ║
  ║   YouTube for Stremio     ║
  ╚════════════════════════════╝
`;

async function main() {
  console.log(BANNER);

  const env = loadEnv();
  const localIp = getLocalIp();

  // Set default noVNC URL if not provided
  if (!env.noVncUrl) {
    env.noVncUrl = `http://${localIp}:6080/vnc.html`;
  }

  // Startup dependency validation
  const ytdlpOk = await checkBinary(env.ytDlpPath, ['--version']);
  const ffmpegOk = await checkBinary('ffmpeg', ['-version']);
  if (!ytdlpOk) console.warn('WARNING: yt-dlp not found or not executable. Video features will fail.');
  if (!ffmpegOk) console.warn('WARNING: FFmpeg not found or not executable. Streaming above 360p will fail.');

  // Wait for Chromium to be ready before accepting requests
  if (env.browserCookies !== 'off') {
    console.log('Waiting for Chromium to start...');
    const chromiumReady = await waitForChromium(15000);
    if (chromiumReady) {
      console.log('Chromium is running.');
    } else {
      console.warn('WARNING: Chromium did not start within 15 seconds. Proceeding anyway.');
    }
  }

  const app = await buildApp(env);

  // Graceful shutdown
  const shutdown = async () => {
    app.log.info('Shutting down...');
    // Kill active FFmpeg processes
    const procs = getActiveProcesses();
    for (const proc of procs) {
      proc.kill('SIGTERM');
    }
    procs.clear();
    // Close Fastify (waits up to 10s for in-flight requests)
    await app.close();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  try {
    await app.listen({ port: env.port, host: '0.0.0.0' });
    app.log.info(`Addon: http://${localIp}:${env.port}${env.basePath}`);
    app.log.info(`noVNC: ${env.noVncUrl}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
