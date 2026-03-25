import { spawn } from 'node:child_process';
import { writeFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Cache } from '../../infrastructure/cache.js';
import type { VideoInfo, SearchResult } from './types.js';

export interface YtDlpInfoOptions {
  type: 'info';
  cookieFile?: string;
  browserCookies?: boolean;
}

export interface YtDlpSearchOptions {
  type: 'search';
  query: string;
  limit: number;
  cookieFile?: string;
  browserCookies?: boolean;
}

export interface YtDlpPlaylistOptions {
  type: 'playlist';
  url: string;
  cookieFile?: string;
  browserCookies?: boolean;
}

export type YtDlpOptions = YtDlpInfoOptions | YtDlpSearchOptions | YtDlpPlaylistOptions;

const BASE_ARGS = ['--no-warnings', '--no-cache-dir', '--no-playlist', '-J', '--referer', 'https://www.youtube.com'];

export function buildYtDlpArgs(videoId: string, options: YtDlpOptions): string[] {
  const args = [...BASE_ARGS];
  if (options.cookieFile) { args.push('--cookies', options.cookieFile); }
  if (options.browserCookies) { args.push('--cookies-from-browser', 'chromium'); }
  if (options.type === 'search') {
    const searchArgs = args.filter((a) => a !== '--no-playlist');
    searchArgs.push('--flat-playlist');
    searchArgs.push(`ytsearch${options.limit}:${options.query}`);
    return searchArgs;
  }
  if (options.type === 'playlist') {
    const playlistArgs = args.filter((a) => a !== '--no-playlist');
    playlistArgs.push('--flat-playlist');
    playlistArgs.push(options.url);
    return playlistArgs;
  }
  args.push(`https://www.youtube.com/watch?v=${videoId}`);
  return args;
}

export function parseVideoInfo(output: string): VideoInfo {
  return JSON.parse(output) as VideoInfo;
}

export class YtDlpService {
  private readonly ytDlpPath: string;
  private readonly cache: Cache<VideoInfo>;
  private readonly timeoutMs: number;

  constructor(ytDlpPath: string, cache: Cache<VideoInfo>, timeoutMs = 30000) {
    this.ytDlpPath = ytDlpPath;
    this.cache = cache;
    this.timeoutMs = timeoutMs;
  }

  async getVideoInfo(videoId: string, cookieFile?: string, browserCookies?: boolean): Promise<VideoInfo> {
    const cached = this.cache.get(`video:${videoId}`);
    if (cached) return cached;
    const info = await this.fetchVideoInfo(videoId, cookieFile, browserCookies);
    this.cache.set(`video:${videoId}`, info, 3600);
    return info;
  }

  async getFreshVideoInfo(videoId: string, cookieFile?: string, browserCookies?: boolean): Promise<VideoInfo> {
    return this.fetchVideoInfo(videoId, cookieFile, browserCookies);
  }

  async getVideoInfoWithStale(videoId: string, cookieFile?: string, browserCookies?: boolean): Promise<VideoInfo> {
    try { return await this.getVideoInfo(videoId, cookieFile, browserCookies); }
    catch (error) {
      const stale = this.cache.getStale(`video:${videoId}`);
      if (stale) return stale;
      throw error;
    }
  }

  private async fetchVideoInfo(videoId: string, cookieFile?: string, browserCookies?: boolean): Promise<VideoInfo> {
    const args = buildYtDlpArgs(videoId, { type: 'info', cookieFile, browserCookies });
    const output = await this.run(args);
    return parseVideoInfo(output);
  }

  async search(query: string, limit: number, cookieFile?: string, browserCookies?: boolean): Promise<SearchResult[]> {
    const args = buildYtDlpArgs('', { type: 'search', query, limit, cookieFile, browserCookies });
    const output = await this.run(args);
    const data = JSON.parse(output);
    return (data.entries ?? []) as SearchResult[];
  }

  async writeCookieFile(cookies: string): Promise<string> {
    const path = join(tmpdir(), `tubio-cookies-${randomUUID()}.txt`);
    await writeFile(path, cookies, 'utf-8');
    return path;
  }

  async removeCookieFile(path: string): Promise<void> {
    try { await unlink(path); } catch { /* ignore */ }
  }

  private run(args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const proc = spawn(this.ytDlpPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });
      let stdout = '';
      let stderr = '';
      const timer = setTimeout(() => { proc.kill('SIGTERM'); reject(new Error(`yt-dlp timed out after ${this.timeoutMs}ms`)); }, this.timeoutMs);
      proc.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
      proc.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });
      proc.on('close', (code) => { clearTimeout(timer); if (code === 0) resolve(stdout); else reject(new Error(`yt-dlp exited with code ${code}: ${stderr}`)); });
      proc.on('error', (err) => { clearTimeout(timer); reject(err); });
    });
  }
}
