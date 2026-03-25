import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadEnv, type EnvConfig } from './env.js';

describe('loadEnv', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns defaults when no env vars set', () => {
    delete process.env.PORT;
    delete process.env.RATE_LIMIT;
    delete process.env.CATALOG_LIMIT;
    delete process.env.BASE_PATH;
    delete process.env.BROWSER_COOKIES;
    delete process.env.YT_DLP_PATH;

    const env = loadEnv();
    expect(env.port).toBe(8000);
    expect(env.rateLimitEnabled).toBe(true);
    expect(env.catalogLimit).toBe(100);
    expect(env.basePath).toBe('');
    expect(env.browserCookies).toBe('auto');
    expect(env.ytDlpPath).toBe('yt-dlp');
  });

  it('reads PORT from environment', () => {
    process.env.PORT = '3000';
    const env = loadEnv();
    expect(env.port).toBe(3000);
  });

  it('reads RATE_LIMIT on/off', () => {
    process.env.RATE_LIMIT = 'off';
    expect(loadEnv().rateLimitEnabled).toBe(false);

    process.env.RATE_LIMIT = 'on';
    expect(loadEnv().rateLimitEnabled).toBe(true);
  });

  it('reads CATALOG_LIMIT as number', () => {
    process.env.CATALOG_LIMIT = '50';
    expect(loadEnv().catalogLimit).toBe(50);
  });

  it('strips trailing slash from BASE_PATH', () => {
    process.env.BASE_PATH = '/tubio/';
    expect(loadEnv().basePath).toBe('/tubio');
  });

  it('reads BROWSER_COOKIES mode', () => {
    process.env.BROWSER_COOKIES = 'on';
    expect(loadEnv().browserCookies).toBe('on');
  });

  it('reads NOVNC_URL', () => {
    process.env.NOVNC_URL = 'http://192.168.1.50:6080';
    expect(loadEnv().noVncUrl).toBe('http://192.168.1.50:6080');
  });

  it('reads YT_DLP_PATH', () => {
    process.env.YT_DLP_PATH = '/usr/local/bin/yt-dlp';
    expect(loadEnv().ytDlpPath).toBe('/usr/local/bin/yt-dlp');
  });
});
