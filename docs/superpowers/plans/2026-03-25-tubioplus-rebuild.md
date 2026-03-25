# Tubio+ Clean Sheet Rebuild — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete YouTube streaming addon for Stremio Lite from scratch with TypeScript, Fastify, React, and comprehensive tests.

**Architecture:** Modular monolith with domain-driven Fastify plugins. Each domain (youtube, catalog, meta, stream, subtitles, config, sponsorblock, dearrow) is an isolated plugin with its own routes and logic. React SPA for config UI built with Vite. Custom Stremio REST protocol implementation (no SDK).

**Tech Stack:** TypeScript, Fastify, React 18, Vite, vitest, Playwright, yt-dlp-wrap, pino

**Spec:** `docs/superpowers/specs/2026-03-25-tubioplus-rebuild-design.md`

---

## Milestone Overview

| Milestone | Tasks | Independent? |
|---|---|---|
| M1: Project Scaffolding | 1-2 | Sequential |
| M2: Core Infrastructure | 3-7 | Tasks 3,4,5,6,7 are independent |
| M3: YouTube Domain | 8-10 | Sequential (builds on each other) |
| M4: Stremio Protocol & Config | 11-14 | 11,12 independent; 13,14 depend on 11,12 |
| M5: API Domains | 15-19 | 15,16,17,18 are independent (all depend on M3+M4) |
| M6: App Assembly & Integration | 20-22 | Sequential. **Depends on ALL of M1-M5.** |
| M7: Frontend SPA | 23-27 | 23 first, then 24,25 independent, 26,27 sequential |
| M8: Docker & Deployment | 28-30 | Sequential |
| M9: E2E Tests | 31-32 | Sequential |

**Dependency note:** M6 (App Assembly) imports from every prior milestone. All M1-M5 tasks must be complete before starting M6.

---

## Chunk 1: Project Scaffolding & Core Infrastructure (Tasks 1-7)

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `src/server.ts` (placeholder)

- [ ] **Step 1: Initialize package.json**

```json
{
  "name": "tubioplus",
  "version": "2.0.0",
  "description": "YouTube streaming addon for Stremio Lite",
  "type": "module",
  "main": "dist/server.js",
  "scripts": {
    "build": "tsc",
    "start": "node dist/server.js",
    "dev": "tsx watch src/server.ts",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "engines": {
    "node": ">=20.0.0"
  }
}
```

- [ ] **Step 2: Install production dependencies**

Run: `npm install fastify yt-dlp-wrap`
Expected: package-lock.json created, node_modules populated

- [ ] **Step 3: Install dev dependencies**

Run: `npm install -D typescript tsx @types/node vitest`
Expected: devDependencies added to package.json

- [ ] **Step 4: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "test", "frontend"]
}
```

- [ ] **Step 5: Create vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/*.d.ts'],
    },
  },
});
```

- [ ] **Step 6: Create placeholder server.ts**

```typescript
// src/server.ts
console.log('Tubio+ server placeholder');
```

- [ ] **Step 7: Verify build works**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json tsconfig.json vitest.config.ts src/server.ts
git commit -m "chore: scaffold project with TypeScript, Fastify, vitest"
```

---

### Task 2: Environment Variable Loading

**Files:**
- Create: `src/shared/env.ts`
- Create: `src/shared/env.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/shared/env.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/shared/env.test.ts`
Expected: FAIL — module './env.js' not found

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/shared/env.ts
export interface EnvConfig {
  port: number;
  encryptionKey: string | undefined;
  nodeEnv: string;
  rateLimitEnabled: boolean;
  catalogLimit: number;
  basePath: string;
  browserCookies: 'auto' | 'on' | 'off';
  noVncUrl: string | undefined;
  ytDlpPath: string;
  vncPassword: string | undefined;
}

export function loadEnv(): EnvConfig {
  const basePath = (process.env.BASE_PATH ?? '').replace(/\/+$/, '');

  return {
    port: parseInt(process.env.PORT ?? '8000', 10),
    encryptionKey: process.env.ENCRYPTION_KEY,
    nodeEnv: process.env.NODE_ENV ?? 'development',
    rateLimitEnabled: (process.env.RATE_LIMIT ?? 'on').toLowerCase() !== 'off',
    catalogLimit: parseInt(process.env.CATALOG_LIMIT ?? '100', 10),
    basePath,
    browserCookies: parseBrowserCookies(process.env.BROWSER_COOKIES),
    noVncUrl: process.env.NOVNC_URL,
    ytDlpPath: process.env.YT_DLP_PATH ?? 'yt-dlp',
    vncPassword: process.env.VNC_PASSWORD,
  };
}

function parseBrowserCookies(value: string | undefined): 'auto' | 'on' | 'off' {
  const v = (value ?? 'auto').toLowerCase();
  if (v === 'on' || v === 'true' || v === '1') return 'on';
  if (v === 'off' || v === 'false' || v === '0') return 'off';
  return 'auto';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/shared/env.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/shared/env.ts src/shared/env.test.ts
git commit -m "feat: add environment variable loading with defaults"
```

---

### Task 3: Shared Validators

**Files:**
- Create: `src/shared/validation.ts`
- Create: `src/shared/validation.test.ts`

**Independent: can run in parallel with Tasks 4, 5, 6, 7**

- [ ] **Step 1: Write the failing test**

```typescript
// src/shared/validation.test.ts
import { describe, it, expect } from 'vitest';
import { isValidVideoId, extractVideoId } from './validation.js';

describe('isValidVideoId', () => {
  it('accepts valid 11-char video IDs', () => {
    expect(isValidVideoId('dQw4w9WgXcQ')).toBe(true);
    expect(isValidVideoId('abc123_-XYZ')).toBe(true);
  });

  it('rejects IDs shorter than 11 chars', () => {
    expect(isValidVideoId('abc')).toBe(false);
    expect(isValidVideoId('')).toBe(false);
  });

  it('rejects IDs longer than 11 chars', () => {
    expect(isValidVideoId('dQw4w9WgXcQx')).toBe(false);
  });

  it('rejects IDs with invalid characters', () => {
    expect(isValidVideoId('dQw4w9WgXc!')).toBe(false);
    expect(isValidVideoId('dQw4w9WgXc ')).toBe(false);
    expect(isValidVideoId('dQw4w9WgXc.')).toBe(false);
  });

  it('strips yt: prefix before validating', () => {
    expect(isValidVideoId('yt:dQw4w9WgXcQ')).toBe(true);
    expect(isValidVideoId('yt:abc')).toBe(false);
  });
});

describe('extractVideoId', () => {
  it('strips yt: prefix', () => {
    expect(extractVideoId('yt:dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('returns ID unchanged when no prefix', () => {
    expect(extractVideoId('dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/shared/validation.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/shared/validation.ts
const VIDEO_ID_REGEX = /^[a-zA-Z0-9_-]{11}$/;

export function isValidVideoId(id: string): boolean {
  const cleaned = id.startsWith('yt:') ? id.slice(3) : id;
  return VIDEO_ID_REGEX.test(cleaned);
}

export function extractVideoId(id: string): string {
  return id.startsWith('yt:') ? id.slice(3) : id;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/shared/validation.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/shared/validation.ts src/shared/validation.test.ts
git commit -m "feat: add video ID validation and extraction"
```

---

### Task 4: Typed Error Classes

**Files:**
- Create: `src/infrastructure/errors.ts`
- Create: `src/infrastructure/errors.test.ts`

**Independent: can run in parallel with Tasks 3, 5, 6, 7**

- [ ] **Step 1: Write the failing test**

```typescript
// src/infrastructure/errors.test.ts
import { describe, it, expect } from 'vitest';
import {
  VideoNotFoundError,
  ExtractionError,
  EncryptionError,
  RateLimitError,
  ExternalServiceError,
  DependencyError,
} from './errors.js';

describe('error classes', () => {
  it('VideoNotFoundError has correct name and message', () => {
    const err = new VideoNotFoundError('abc123');
    expect(err.name).toBe('VideoNotFoundError');
    expect(err.message).toContain('abc123');
    expect(err).toBeInstanceOf(Error);
  });

  it('ExtractionError has correct name', () => {
    const err = new ExtractionError('yt-dlp timeout');
    expect(err.name).toBe('ExtractionError');
    expect(err).toBeInstanceOf(Error);
  });

  it('EncryptionError has correct name', () => {
    const err = new EncryptionError('bad key');
    expect(err.name).toBe('EncryptionError');
    expect(err).toBeInstanceOf(Error);
  });

  it('RateLimitError has correct name', () => {
    const err = new RateLimitError('too many requests');
    expect(err.name).toBe('RateLimitError');
    expect(err).toBeInstanceOf(Error);
  });

  it('ExternalServiceError includes service name', () => {
    const err = new ExternalServiceError('SponsorBlock', 'timeout');
    expect(err.name).toBe('ExternalServiceError');
    expect(err.message).toContain('SponsorBlock');
  });

  it('DependencyError includes binary name', () => {
    const err = new DependencyError('yt-dlp');
    expect(err.name).toBe('DependencyError');
    expect(err.message).toContain('yt-dlp');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/infrastructure/errors.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/infrastructure/errors.ts
export class VideoNotFoundError extends Error {
  constructor(videoId: string) {
    super(`Video not found: ${videoId}`);
    this.name = 'VideoNotFoundError';
  }
}

export class ExtractionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExtractionError';
  }
}

export class EncryptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EncryptionError';
  }
}

export class RateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RateLimitError';
  }
}

export class ExternalServiceError extends Error {
  constructor(service: string, message: string) {
    super(`${service}: ${message}`);
    this.name = 'ExternalServiceError';
  }
}

export class DependencyError extends Error {
  constructor(binary: string) {
    super(`Required binary not found or not executable: ${binary}`);
    this.name = 'DependencyError';
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/infrastructure/errors.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/infrastructure/errors.ts src/infrastructure/errors.test.ts
git commit -m "feat: add typed error classes"
```

---

### Task 5: In-Memory TTL Cache with Stale-on-Error

**Files:**
- Create: `src/infrastructure/cache.ts`
- Create: `src/infrastructure/cache.test.ts`

**Independent: can run in parallel with Tasks 3, 4, 6, 7**

- [ ] **Step 1: Write the failing test**

```typescript
// src/infrastructure/cache.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Cache } from './cache.js';

describe('Cache', () => {
  let cache: Cache<string>;

  beforeEach(() => {
    cache = new Cache<string>();
  });

  it('stores and retrieves a value', () => {
    cache.set('key', 'value', 60);
    expect(cache.get('key')).toBe('value');
  });

  it('returns undefined for missing keys', () => {
    expect(cache.get('missing')).toBeUndefined();
  });

  it('expires entries after TTL', () => {
    vi.useFakeTimers();
    cache.set('key', 'value', 1); // 1 second TTL
    vi.advanceTimersByTime(1001);
    expect(cache.get('key')).toBeUndefined();
    vi.useRealTimers();
  });

  it('returns stale value within grace period via getStale', () => {
    vi.useFakeTimers();
    cache.set('key', 'value', 1); // 1s TTL, additional 2s grace = 3s total
    vi.advanceTimersByTime(2000); // past TTL (1s), within grace (1s + 2s = 3s total)
    expect(cache.get('key')).toBeUndefined(); // normal get returns nothing
    expect(cache.getStale('key')).toBe('value'); // stale get returns it
    vi.useRealTimers();
  });

  it('returns undefined from getStale after grace period', () => {
    vi.useFakeTimers();
    cache.set('key', 'value', 1); // 1s TTL, grace = 1s + 2s = 3s total
    vi.advanceTimersByTime(4000); // past grace period (3s total)
    expect(cache.getStale('key')).toBeUndefined();
    vi.useRealTimers();
  });

  it('deletes entries', () => {
    cache.set('key', 'value', 60);
    cache.delete('key');
    expect(cache.get('key')).toBeUndefined();
  });

  it('clears all entries', () => {
    cache.set('a', '1', 60);
    cache.set('b', '2', 60);
    cache.clear();
    expect(cache.size()).toBe(0);
  });

  it('reports correct size', () => {
    cache.set('a', '1', 60);
    cache.set('b', '2', 60);
    expect(cache.size()).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/infrastructure/cache.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/infrastructure/cache.ts
interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  graceExpiresAt: number;
}

export class Cache<T> {
  private store = new Map<string, CacheEntry<T>>();

  set(key: string, value: T, ttlSeconds: number): void {
    const now = Date.now();
    this.store.set(key, {
      value,
      expiresAt: now + ttlSeconds * 1000,
      graceExpiresAt: now + ttlSeconds * 1000 + ttlSeconds * 2 * 1000, // TTL + 2x TTL additional grace
    });
  }

  get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      return undefined;
    }
    return entry.value;
  }

  getStale(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.graceExpiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  size(): number {
    return this.store.size;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/infrastructure/cache.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/infrastructure/cache.ts src/infrastructure/cache.test.ts
git commit -m "feat: add in-memory TTL cache with stale-on-error support"
```

---

### Task 6: Sliding-Window Rate Limiter

**Files:**
- Create: `src/infrastructure/rate-limit.ts`
- Create: `src/infrastructure/rate-limit.test.ts`

**Independent: can run in parallel with Tasks 3, 4, 5, 7**

- [ ] **Step 1: Write the failing test**

```typescript
// src/infrastructure/rate-limit.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RateLimiter } from './rate-limit.js';

describe('RateLimiter', () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    limiter = new RateLimiter({ windowMs: 60000, max: 3 });
  });

  it('allows requests under the limit', () => {
    expect(limiter.check('127.0.0.1').allowed).toBe(true);
    expect(limiter.check('127.0.0.1').allowed).toBe(true);
    expect(limiter.check('127.0.0.1').allowed).toBe(true);
  });

  it('blocks requests over the limit', () => {
    limiter.check('127.0.0.1');
    limiter.check('127.0.0.1');
    limiter.check('127.0.0.1');
    const result = limiter.check('127.0.0.1');
    expect(result.allowed).toBe(false);
    expect(result.retryAfter).toBeGreaterThan(0);
  });

  it('tracks IPs independently', () => {
    limiter.check('1.1.1.1');
    limiter.check('1.1.1.1');
    limiter.check('1.1.1.1');
    expect(limiter.check('1.1.1.1').allowed).toBe(false);
    expect(limiter.check('2.2.2.2').allowed).toBe(true);
  });

  it('resets after window expires', () => {
    vi.useFakeTimers();
    limiter.check('127.0.0.1');
    limiter.check('127.0.0.1');
    limiter.check('127.0.0.1');
    expect(limiter.check('127.0.0.1').allowed).toBe(false);

    vi.advanceTimersByTime(60001);
    expect(limiter.check('127.0.0.1').allowed).toBe(true);
    vi.useRealTimers();
  });

  it('returns remaining count', () => {
    const r1 = limiter.check('127.0.0.1');
    expect(r1.remaining).toBe(2);
    const r2 = limiter.check('127.0.0.1');
    expect(r2.remaining).toBe(1);
  });

  it('cleanup removes expired entries', () => {
    vi.useFakeTimers();
    limiter.check('127.0.0.1');
    vi.advanceTimersByTime(60001);
    limiter.cleanup();
    // Internal state cleared — next check starts fresh
    const result = limiter.check('127.0.0.1');
    expect(result.remaining).toBe(2);
    vi.useRealTimers();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/infrastructure/rate-limit.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/infrastructure/rate-limit.ts
export interface RateLimitOptions {
  windowMs: number;
  max: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfter: number;
  limit: number;
}

interface WindowEntry {
  count: number;
  resetTime: number;
}

export class RateLimiter {
  private windows = new Map<string, WindowEntry>();
  private readonly windowMs: number;
  private readonly max: number;

  constructor(options: RateLimitOptions) {
    this.windowMs = options.windowMs;
    this.max = options.max;
  }

  check(ip: string): RateLimitResult {
    const now = Date.now();
    let entry = this.windows.get(ip);

    if (!entry || now > entry.resetTime) {
      entry = { count: 0, resetTime: now + this.windowMs };
      this.windows.set(ip, entry);
    }

    entry.count++;

    if (entry.count > this.max) {
      return {
        allowed: false,
        remaining: 0,
        retryAfter: Math.ceil((entry.resetTime - now) / 1000),
        limit: this.max,
      };
    }

    return {
      allowed: true,
      remaining: this.max - entry.count,
      retryAfter: 0,
      limit: this.max,
    };
  }

  cleanup(): void {
    const now = Date.now();
    for (const [ip, entry] of this.windows) {
      if (now > entry.resetTime) {
        this.windows.delete(ip);
      }
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/infrastructure/rate-limit.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/infrastructure/rate-limit.ts src/infrastructure/rate-limit.test.ts
git commit -m "feat: add sliding-window rate limiter"
```

---

### Task 7: Logger Configuration

**Files:**
- Create: `src/infrastructure/logger.ts`

**Independent: can run in parallel with Tasks 3, 4, 5, 6**

This is a thin configuration wrapper — no test needed (testing pino config is testing the library).

- [ ] **Step 1: Write logger config**

```typescript
// src/infrastructure/logger.ts
import pino from 'pino';

export function createLogger(nodeEnv: string) {
  return pino({
    level: nodeEnv === 'production' ? 'info' : 'debug',
    transport:
      nodeEnv !== 'production'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
  });
}

export type Logger = pino.Logger;
```

- [ ] **Step 2: Install pino dependencies**

Run: `npm install pino && npm install -D pino-pretty`

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/infrastructure/logger.ts package.json package-lock.json
git commit -m "feat: add pino logger configuration"
```

---

## Chunk 2: YouTube Domain (Tasks 8-10)

### Task 8: YouTube Types

**Files:**
- Create: `src/domains/youtube/types.ts`

No test needed — pure type definitions.

- [ ] **Step 1: Write type definitions**

```typescript
// src/domains/youtube/types.ts
export interface VideoFormat {
  format_id: string;
  ext: string;
  width?: number;
  height?: number;
  vcodec?: string;
  acodec?: string;
  url: string;
  filesize?: number;
  tbr?: number; // total bitrate
  abr?: number; // audio bitrate
  protocol?: string;
}

export interface VideoInfo {
  id: string;
  title: string;
  description?: string;
  thumbnail?: string;
  duration?: number; // seconds
  upload_date?: string; // YYYYMMDD
  uploader?: string;
  uploader_url?: string;
  channel?: string;
  channel_url?: string;
  view_count?: number;
  formats?: VideoFormat[];
  subtitles?: Record<string, SubtitleTrack[]>;
  automatic_captions?: Record<string, SubtitleTrack[]>;
}

export interface SubtitleTrack {
  ext: string;
  url: string;
  name?: string;
}

export interface SearchResult {
  id: string;
  title: string;
  description?: string;
  thumbnail?: string;
  duration?: number;
  uploader?: string;
  channel_url?: string;
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/domains/youtube/types.ts
git commit -m "feat: add YouTube domain type definitions"
```

---

### Task 9: Format Selection Logic

**Files:**
- Create: `src/domains/youtube/formats.ts`
- Create: `src/domains/youtube/formats.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/domains/youtube/formats.test.ts
import { describe, it, expect } from 'vitest';
import { findVideoFormat, findAudioFormat } from './formats.js';
import type { VideoFormat } from './types.js';

const h264_1080: VideoFormat = { format_id: '137', ext: 'mp4', width: 1920, height: 1080, vcodec: 'avc1.640028', acodec: 'none', url: 'https://example.com/1080', tbr: 4000 };
const h264_720: VideoFormat = { format_id: '136', ext: 'mp4', width: 1280, height: 720, vcodec: 'avc1.4d401f', acodec: 'none', url: 'https://example.com/720', tbr: 2500 };
const h264_480: VideoFormat = { format_id: '135', ext: 'mp4', width: 854, height: 480, vcodec: 'avc1.4d401e', acodec: 'none', url: 'https://example.com/480', tbr: 1000 };
const h264_360_muxed: VideoFormat = { format_id: '18', ext: 'mp4', width: 640, height: 360, vcodec: 'avc1.42001E', acodec: 'mp4a.40.2', url: 'https://example.com/360', tbr: 500 };
const vp9_4k: VideoFormat = { format_id: '313', ext: 'webm', width: 3840, height: 2160, vcodec: 'vp9', acodec: 'none', url: 'https://example.com/4k', tbr: 12000 };
const aac_audio: VideoFormat = { format_id: '140', ext: 'm4a', vcodec: 'none', acodec: 'mp4a.40.2', url: 'https://example.com/audio', abr: 128 };
const opus_audio: VideoFormat = { format_id: '251', ext: 'webm', vcodec: 'none', acodec: 'opus', url: 'https://example.com/opus', abr: 160 };

const allFormats = [h264_1080, h264_720, h264_480, h264_360_muxed, vp9_4k, aac_audio, opus_audio];

describe('findVideoFormat', () => {
  it('selects h264 at requested height when available', () => {
    const result = findVideoFormat(allFormats, 1080);
    expect(result?.format_id).toBe('137');
  });

  it('falls back to lower quality if requested height unavailable', () => {
    const result = findVideoFormat([h264_720, h264_480], 1080);
    expect(result?.format_id).toBe('136'); // 720p
  });

  it('prefers h264 over vp9 at 1080p and below', () => {
    const vp9_1080: VideoFormat = { ...h264_1080, format_id: 'vp9-1080', vcodec: 'vp9' };
    const result = findVideoFormat([vp9_1080, h264_1080], 1080);
    expect(result?.vcodec).toContain('avc1');
  });

  it('accepts vp9/av1 at 4K (no h264 available)', () => {
    const result = findVideoFormat(allFormats, 2160);
    expect(result?.format_id).toBe('313');
  });

  it('selects muxed stream for 360p', () => {
    const result = findVideoFormat(allFormats, 360);
    expect(result?.format_id).toBe('18');
    expect(result?.acodec).not.toBe('none');
  });

  it('returns undefined when no formats available', () => {
    expect(findVideoFormat([], 1080)).toBeUndefined();
  });
});

describe('findAudioFormat', () => {
  it('prefers AAC over opus', () => {
    const result = findAudioFormat(allFormats);
    expect(result?.acodec).toContain('mp4a');
  });

  it('returns highest bitrate AAC', () => {
    const aac_low: VideoFormat = { ...aac_audio, format_id: 'aac-low', abr: 64 };
    const result = findAudioFormat([aac_low, aac_audio]);
    expect(result?.format_id).toBe('140');
  });

  it('returns undefined when no audio-only formats', () => {
    expect(findAudioFormat([h264_1080])).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/domains/youtube/formats.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/domains/youtube/formats.ts
import type { VideoFormat } from './types.js';

const H264_CODECS = ['avc1', 'h264'];

function isH264(format: VideoFormat): boolean {
  return H264_CODECS.some((c) => format.vcodec?.startsWith(c));
}

function isVideoOnly(format: VideoFormat): boolean {
  return (
    format.vcodec !== undefined &&
    format.vcodec !== 'none' &&
    (format.acodec === undefined || format.acodec === 'none')
  );
}

function isMuxed(format: VideoFormat): boolean {
  return (
    format.vcodec !== undefined &&
    format.vcodec !== 'none' &&
    format.acodec !== undefined &&
    format.acodec !== 'none'
  );
}

function isAudioOnly(format: VideoFormat): boolean {
  return (
    (format.vcodec === undefined || format.vcodec === 'none') &&
    format.acodec !== undefined &&
    format.acodec !== 'none'
  );
}

function isAAC(format: VideoFormat): boolean {
  return format.acodec?.startsWith('mp4a') ?? false;
}

export function findVideoFormat(
  formats: VideoFormat[],
  targetHeight: number,
): VideoFormat | undefined {
  // For 360p, prefer muxed streams (no FFmpeg needed)
  if (targetHeight <= 360) {
    const muxed = formats
      .filter((f) => isMuxed(f) && (f.height ?? 0) <= targetHeight)
      .sort((a, b) => (b.height ?? 0) - (a.height ?? 0));
    if (muxed.length > 0) return muxed[0];
  }

  // Get video-only formats at or below target height
  const candidates = formats
    .filter((f) => isVideoOnly(f) && (f.height ?? 0) <= targetHeight)
    .sort((a, b) => (b.height ?? 0) - (a.height ?? 0));

  if (candidates.length === 0) return undefined;

  // At 1080p and below, prefer h264
  if (targetHeight <= 1080) {
    const h264 = candidates.find((f) => isH264(f));
    if (h264) return h264;
  }

  // At 4K or if no h264, take the best available
  return candidates[0];
}

export function findAudioFormat(formats: VideoFormat[]): VideoFormat | undefined {
  const audioFormats = formats.filter(isAudioOnly);
  if (audioFormats.length === 0) return undefined;

  // Prefer AAC, sorted by bitrate descending
  const aac = audioFormats
    .filter(isAAC)
    .sort((a, b) => (b.abr ?? 0) - (a.abr ?? 0));
  if (aac.length > 0) return aac[0];

  // Fall back to highest bitrate non-AAC
  return audioFormats.sort((a, b) => (b.abr ?? 0) - (a.abr ?? 0))[0];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/domains/youtube/formats.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/domains/youtube/formats.ts src/domains/youtube/formats.test.ts
git commit -m "feat: add video/audio format selection with h264 preference"
```

---

### Task 10: yt-dlp Wrapper

**Files:**
- Create: `src/domains/youtube/ytdlp.ts`
- Create: `src/domains/youtube/ytdlp.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/domains/youtube/ytdlp.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildYtDlpArgs, parseVideoInfo, YtDlpService } from './ytdlp.js';

describe('buildYtDlpArgs', () => {
  it('includes base args for video info', () => {
    const args = buildYtDlpArgs('dQw4w9WgXcQ', { type: 'info' });
    expect(args).toContain('--no-warnings');
    expect(args).toContain('--no-cache-dir');
    expect(args).toContain('--no-playlist');
    expect(args).toContain('-J');
    expect(args).toContain('--referer');
    expect(args).toContain('https://www.youtube.com');
    expect(args[args.length - 1]).toContain('youtube.com/watch?v=dQw4w9WgXcQ');
  });

  it('includes cookie file arg when cookies provided', () => {
    const args = buildYtDlpArgs('dQw4w9WgXcQ', {
      type: 'info',
      cookieFile: '/tmp/cookies.txt',
    });
    expect(args).toContain('--cookies');
    expect(args).toContain('/tmp/cookies.txt');
  });

  it('includes browser cookies arg when specified', () => {
    const args = buildYtDlpArgs('dQw4w9WgXcQ', {
      type: 'info',
      browserCookies: true,
    });
    expect(args).toContain('--cookies-from-browser');
    expect(args).toContain('chromium');
  });

  it('builds search args correctly', () => {
    const args = buildYtDlpArgs('', {
      type: 'search',
      query: 'test query',
      limit: 20,
    });
    expect(args).toContain('--flat-playlist');
    expect(args.some((a) => a.includes('ytsearch20:test query'))).toBe(true);
  });
});

describe('parseVideoInfo', () => {
  it('parses valid JSON output', () => {
    const json = JSON.stringify({
      id: 'test123abcd',
      title: 'Test Video',
      duration: 120,
      formats: [],
    });
    const info = parseVideoInfo(json);
    expect(info.id).toBe('test123abcd');
    expect(info.title).toBe('Test Video');
    expect(info.duration).toBe(120);
  });

  it('throws on invalid JSON', () => {
    expect(() => parseVideoInfo('not json')).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/domains/youtube/ytdlp.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/domains/youtube/ytdlp.ts
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

const BASE_ARGS = [
  '--no-warnings',
  '--no-cache-dir',
  '--no-playlist',
  '-J',
  '--referer', 'https://www.youtube.com',
];

export function buildYtDlpArgs(videoId: string, options: YtDlpOptions): string[] {
  const args = [...BASE_ARGS];

  if (options.cookieFile) {
    args.push('--cookies', options.cookieFile);
  }

  if (options.browserCookies) {
    args.push('--cookies-from-browser', 'chromium');
  }

  if (options.type === 'search') {
    // Remove --no-playlist and -J for search, use --flat-playlist
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
    this.cache.set(`video:${videoId}`, info, 3600); // 1 hour
    return info;
  }

  async getFreshVideoInfo(videoId: string, cookieFile?: string, browserCookies?: boolean): Promise<VideoInfo> {
    return this.fetchVideoInfo(videoId, cookieFile, browserCookies);
  }

  async getVideoInfoWithStale(videoId: string, cookieFile?: string, browserCookies?: boolean): Promise<VideoInfo> {
    try {
      return await this.getVideoInfo(videoId, cookieFile, browserCookies);
    } catch (error) {
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
    try {
      await unlink(path);
    } catch {
      // Ignore — file may already be deleted
    }
  }

  private run(args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const proc = spawn(this.ytDlpPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });
      let stdout = '';
      let stderr = '';

      const timer = setTimeout(() => {
        proc.kill('SIGTERM');
        reject(new Error(`yt-dlp timed out after ${this.timeoutMs}ms`));
      }, this.timeoutMs);

      proc.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
      proc.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });

      proc.on('close', (code) => {
        clearTimeout(timer);
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`yt-dlp exited with code ${code}: ${stderr}`));
        }
      });

      proc.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/domains/youtube/ytdlp.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/domains/youtube/ytdlp.ts src/domains/youtube/ytdlp.test.ts
git commit -m "feat: add yt-dlp wrapper with caching, cookies, and timeout"
```

---

## Chunk 3: Stremio Protocol & Config Domain (Tasks 11-14)

### Task 11: Stremio Protocol Types

**Files:**
- Create: `src/domains/stremio/types.ts`

**Independent: can run in parallel with Task 12**

No test needed — pure type definitions following the Stremio addon SDK schema.

- [ ] **Step 1: Write Stremio protocol types**

```typescript
// src/domains/stremio/types.ts
export interface StremioManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  types: string[];
  idPrefixes: string[];
  catalogs: StremioCatalog[];
  resources: string[];
  behaviorHints: {
    configurable: boolean;
    configurationRequired: boolean;
  };
}

export interface StremioCatalog {
  type: string;
  id: string;
  name: string;
  extra?: StremioExtra[];
}

export interface StremioExtra {
  name: string;
  isRequired?: boolean;
  options?: string[];
}

export interface StremioMetaPreview {
  id: string;
  type: string;
  name: string;
  poster: string;
  posterShape?: 'square' | 'poster' | 'landscape';
  description?: string;
  releaseInfo?: string;
  links?: StremioLink[];
}

export interface StremioMeta extends StremioMetaPreview {
  background?: string;
  logo?: string;
  runtime?: string;
  behaviorHints?: {
    defaultVideoId?: string;
  };
}

export interface StremioLink {
  name: string;
  category: string;
  url: string;
}

export interface StremioStream {
  url: string;
  name?: string;
  description?: string;
  behaviorHints?: {
    filename?: string;
    bingeGroup?: string;
    notWebReady?: boolean;
    proxyHeaders?: {
      request?: Record<string, string>;
    };
  };
}

export interface StremioSubtitle {
  id: string;
  url: string;
  lang: string;
}

export interface CatalogResponse {
  metas: StremioMetaPreview[];
}

export interface MetaResponse {
  meta: StremioMeta;
}

export interface StreamResponse {
  streams: StremioStream[];
}

export interface SubtitleResponse {
  subtitles: StremioSubtitle[];
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/domains/stremio/types.ts
git commit -m "feat: add Stremio protocol type definitions"
```

---

### Task 12: Config Encryption

**Files:**
- Create: `src/domains/config/encryption.ts`
- Create: `src/domains/config/encryption.test.ts`
- Create: `src/domains/config/schema.ts`
- Create: `src/domains/config/schema.test.ts`

**Independent: can run in parallel with Task 11**

- [ ] **Step 1: Write encryption failing test**

```typescript
// src/domains/config/encryption.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { encryptConfig, decryptConfig, loadEncryptionKey } from './encryption.js';
import { writeFile, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';

describe('encryptConfig / decryptConfig', () => {
  const key = Buffer.from('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef', 'hex');

  it('round-trips a config object', () => {
    const config = { cookies: 'test', quality: '1080' };
    const encrypted = encryptConfig(config, key);
    const decrypted = decryptConfig(encrypted, key);
    expect(decrypted).toEqual(config);
  });

  it('produces base64url-safe output (no +, /, =)', () => {
    const config = { cookies: 'data with special chars: +/=' };
    const encrypted = encryptConfig(config, key);
    expect(encrypted).not.toMatch(/[+/=]/);
  });

  it('produces different output each time (random IV)', () => {
    const config = { test: 'data' };
    const a = encryptConfig(config, key);
    const b = encryptConfig(config, key);
    expect(a).not.toBe(b);
  });

  it('throws on invalid encrypted string', () => {
    expect(() => decryptConfig('not-valid', key)).toThrow();
  });

  it('throws on wrong key', () => {
    const config = { test: 'data' };
    const encrypted = encryptConfig(config, key);
    const wrongKey = Buffer.from('ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff', 'hex');
    expect(() => decryptConfig(encrypted, wrongKey)).toThrow();
  });
});

describe('loadEncryptionKey', () => {
  const keyFile = '.encryption-key-test';

  afterEach(async () => {
    if (existsSync(keyFile)) await unlink(keyFile);
  });

  it('returns key from env var', async () => {
    const hex = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    const key = await loadEncryptionKey(hex, keyFile);
    expect(key.length).toBe(32);
  });

  it('reads key from file if no env var', async () => {
    const hex = 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789';
    await writeFile(keyFile, hex);
    const key = await loadEncryptionKey(undefined, keyFile);
    expect(key.toString('hex')).toBe(hex);
  });

  it('generates and persists key if neither env nor file', async () => {
    const key = await loadEncryptionKey(undefined, keyFile);
    expect(key.length).toBe(32);
    expect(existsSync(keyFile)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/domains/config/encryption.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write encryption implementation**

```typescript
// src/domains/config/encryption.ts
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

export function encryptConfig(config: Record<string, unknown>, key: Buffer): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const json = JSON.stringify(config);
  const encrypted = Buffer.concat([cipher.update(json, 'utf-8'), cipher.final()]);
  const combined = iv.toString('hex') + ':' + encrypted.toString('hex');
  return toBase64Url(Buffer.from(combined, 'utf-8'));
}

export function decryptConfig(encryptedStr: string, key: Buffer): Record<string, unknown> {
  const combined = fromBase64Url(encryptedStr).toString('utf-8');
  const [ivHex, encryptedHex] = combined.split(':');
  if (!ivHex || !encryptedHex) throw new Error('Invalid encrypted config format');

  const iv = Buffer.from(ivHex, 'hex');
  const encrypted = Buffer.from(encryptedHex, 'hex');
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return JSON.parse(decrypted.toString('utf-8'));
}

export async function loadEncryptionKey(
  envKey: string | undefined,
  keyFilePath: string = '.encryption-key',
): Promise<Buffer> {
  if (envKey) {
    return Buffer.from(envKey, 'hex');
  }

  if (existsSync(keyFilePath)) {
    const hex = (await readFile(keyFilePath, 'utf-8')).trim();
    return Buffer.from(hex, 'hex');
  }

  const key = randomBytes(32);
  await writeFile(keyFilePath, key.toString('hex'));
  return key;
}

function toBase64Url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(str: string): Buffer {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(base64, 'base64');
}
```

- [ ] **Step 4: Run encryption test to verify it passes**

Run: `npx vitest run src/domains/config/encryption.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Write schema failing test**

```typescript
// src/domains/config/schema.test.ts
import { describe, it, expect } from 'vitest';
import { mergeWithDefaults, DEFAULT_CONFIG, type AppConfig } from './schema.js';

describe('DEFAULT_CONFIG', () => {
  it('has expected default values', () => {
    expect(DEFAULT_CONFIG.cookies).toBe('');
    expect(DEFAULT_CONFIG.quality).toBe('1080');
    expect(DEFAULT_CONFIG.sponsorblock.enabled).toBe(false);
    expect(DEFAULT_CONFIG.dearrow.enabled).toBe(false);
  });
});

describe('mergeWithDefaults', () => {
  it('returns defaults for empty object', () => {
    const result = mergeWithDefaults({});
    expect(result).toEqual(DEFAULT_CONFIG);
  });

  it('overrides quality', () => {
    const result = mergeWithDefaults({ quality: '720' });
    expect(result.quality).toBe('720');
    expect(result.cookies).toBe(''); // default preserved
  });

  it('deeply merges sponsorblock', () => {
    const result = mergeWithDefaults({
      sponsorblock: { enabled: true },
    });
    expect(result.sponsorblock.enabled).toBe(true);
    expect(result.sponsorblock.categories).toEqual(DEFAULT_CONFIG.sponsorblock.categories);
  });

  it('deeply merges dearrow', () => {
    const result = mergeWithDefaults({ dearrow: { enabled: true } });
    expect(result.dearrow.enabled).toBe(true);
  });
});
```

- [ ] **Step 6: Run schema test to verify it fails**

Run: `npx vitest run src/domains/config/schema.test.ts`
Expected: FAIL — module not found

- [ ] **Step 7: Write schema implementation**

```typescript
// src/domains/config/schema.ts
export interface AppConfig {
  cookies: string;
  quality: string;
  sponsorblock: {
    enabled: boolean;
    categories: string[];
  };
  dearrow: {
    enabled: boolean;
  };
}

export const DEFAULT_CONFIG: AppConfig = {
  cookies: '',
  quality: '1080',
  sponsorblock: {
    enabled: false,
    categories: ['sponsor', 'selfpromo', 'interaction', 'intro', 'outro'],
  },
  dearrow: {
    enabled: false,
  },
};

export function mergeWithDefaults(partial: Record<string, unknown>): AppConfig {
  const sb = partial.sponsorblock as Record<string, unknown> | undefined;
  const da = partial.dearrow as Record<string, unknown> | undefined;

  return {
    cookies: (partial.cookies as string) ?? DEFAULT_CONFIG.cookies,
    quality: (partial.quality as string) ?? DEFAULT_CONFIG.quality,
    sponsorblock: {
      enabled: (sb?.enabled as boolean) ?? DEFAULT_CONFIG.sponsorblock.enabled,
      categories: (sb?.categories as string[]) ?? DEFAULT_CONFIG.sponsorblock.categories,
    },
    dearrow: {
      enabled: (da?.enabled as boolean) ?? DEFAULT_CONFIG.dearrow.enabled,
    },
  };
}
```

- [ ] **Step 8: Run schema test to verify it passes**

Run: `npx vitest run src/domains/config/schema.test.ts`
Expected: All tests PASS

- [ ] **Step 9: Commit**

```bash
git add src/domains/config/encryption.ts src/domains/config/encryption.test.ts \
  src/domains/config/schema.ts src/domains/config/schema.test.ts
git commit -m "feat: add config encryption and schema with defaults"
```

---

### Task 13: Stremio Manifest

**Files:**
- Create: `src/domains/stremio/manifest.ts`
- Create: `src/domains/stremio/manifest.test.ts`

**Depends on: Task 11 (Stremio types)**

- [ ] **Step 1: Write the failing test**

```typescript
// src/domains/stremio/manifest.test.ts
import { describe, it, expect } from 'vitest';
import { manifest } from './manifest.js';

describe('manifest', () => {
  it('has required fields', () => {
    expect(manifest.id).toBe('yt.stremio.addon');
    expect(manifest.name).toBe('Tubio+');
    expect(manifest.version).toBeDefined();
    expect(manifest.description).toBeDefined();
  });

  it('declares YouTube type', () => {
    expect(manifest.types).toContain('YouTube');
  });

  it('declares yt: id prefix', () => {
    expect(manifest.idPrefixes).toContain('yt:');
  });

  it('has 5 catalogs', () => {
    expect(manifest.catalogs).toHaveLength(5);
    const ids = manifest.catalogs.map((c) => c.id);
    expect(ids).toContain('yt:recommendations');
    expect(ids).toContain('yt:search');
    expect(ids).toContain('yt:subscriptions');
    expect(ids).toContain('yt:history');
    expect(ids).toContain('yt:watchlater');
  });

  it('search catalog has required search extra', () => {
    const search = manifest.catalogs.find((c) => c.id === 'yt:search');
    expect(search?.extra).toBeDefined();
    expect(search?.extra?.[0]?.name).toBe('search');
    expect(search?.extra?.[0]?.isRequired).toBe(true);
  });

  it('declares all 4 resources', () => {
    expect(manifest.resources).toEqual(['catalog', 'meta', 'stream', 'subtitles']);
  });

  it('is configurable but not required', () => {
    expect(manifest.behaviorHints.configurable).toBe(true);
    expect(manifest.behaviorHints.configurationRequired).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/domains/stremio/manifest.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write implementation**

```typescript
// src/domains/stremio/manifest.ts
import type { StremioManifest } from './types.js';

export const manifest: StremioManifest = {
  id: 'yt.stremio.addon',
  name: 'Tubio+',
  version: '2.0.0',
  description: 'YouTube addon for Stremio',
  types: ['YouTube'],
  idPrefixes: ['yt:'],
  catalogs: [
    { type: 'YouTube', id: 'yt:recommendations', name: 'Recommendations' },
    {
      type: 'YouTube',
      id: 'yt:search',
      name: 'Search',
      extra: [{ name: 'search', isRequired: true }],
    },
    { type: 'YouTube', id: 'yt:subscriptions', name: 'Subscriptions' },
    { type: 'YouTube', id: 'yt:history', name: 'History' },
    { type: 'YouTube', id: 'yt:watchlater', name: 'Watch Later' },
  ],
  resources: ['catalog', 'meta', 'stream', 'subtitles'],
  behaviorHints: { configurable: true, configurationRequired: false },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/domains/stremio/manifest.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/domains/stremio/manifest.ts src/domains/stremio/manifest.test.ts
git commit -m "feat: add Stremio addon manifest"
```

---

### Task 14: SponsorBlock & DeArrow Clients

**Files:**
- Create: `src/domains/sponsorblock/types.ts`
- Create: `src/domains/sponsorblock/client.ts`
- Create: `src/domains/sponsorblock/client.test.ts`
- Create: `src/domains/dearrow/types.ts`
- Create: `src/domains/dearrow/client.ts`
- Create: `src/domains/dearrow/client.test.ts`

**Depends on: Task 5 (Cache)**

- [ ] **Step 1: Write SponsorBlock types**

```typescript
// src/domains/sponsorblock/types.ts
export interface SkipSegment {
  segment: [number, number]; // [startTime, endTime] in seconds
  category: string;
  UUID: string;
  votes: number;
  locked: number;
}
```

- [ ] **Step 2: Write SponsorBlock client failing test**

```typescript
// src/domains/sponsorblock/client.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SponsorBlockClient } from './client.js';
import type { SkipSegment } from './types.js';

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('SponsorBlockClient', () => {
  let client: SponsorBlockClient;

  beforeEach(() => {
    client = new SponsorBlockClient();
    mockFetch.mockReset();
  });

  it('fetches skip segments for a video', async () => {
    const segments: SkipSegment[] = [
      { segment: [0, 30], category: 'sponsor', UUID: 'abc', votes: 5, locked: 0 },
    ];
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(segments),
    });

    const result = await client.getSkipSegments('testVideoId1', ['sponsor']);
    expect(result).toHaveLength(1);
    expect(result[0].category).toBe('sponsor');
  });

  it('returns empty array on 404', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });
    const result = await client.getSkipSegments('testVideoId1', ['sponsor']);
    expect(result).toEqual([]);
  });

  it('returns empty array on network error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('network error'));
    const result = await client.getSkipSegments('testVideoId1', ['sponsor']);
    expect(result).toEqual([]);
  });

  it('filters by categories', async () => {
    const segments: SkipSegment[] = [
      { segment: [0, 30], category: 'sponsor', UUID: 'a', votes: 5, locked: 0 },
      { segment: [60, 90], category: 'intro', UUID: 'b', votes: 3, locked: 0 },
    ];
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(segments),
    });

    const result = await client.getSkipSegments('testVideoId1', ['sponsor']);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('categories='),
      expect.anything(),
    );
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/domains/sponsorblock/client.test.ts`
Expected: FAIL — module not found

- [ ] **Step 4: Write SponsorBlock client implementation**

```typescript
// src/domains/sponsorblock/client.ts
import type { SkipSegment } from './types.js';
import { Cache } from '../../infrastructure/cache.js';

const API_BASE = 'https://sponsor.ajay.app/api';

export class SponsorBlockClient {
  private cache = new Cache<SkipSegment[]>();

  async getSkipSegments(videoId: string, categories: string[]): Promise<SkipSegment[]> {
    const cacheKey = `sb:${videoId}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    try {
      const params = new URLSearchParams({
        videoID: videoId,
        categories: JSON.stringify(categories),
      });
      const response = await fetch(`${API_BASE}/skipSegments?${params}`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) return [];
      const segments = (await response.json()) as SkipSegment[];
      this.cache.set(cacheKey, segments, 300); // 5 min
      return segments;
    } catch {
      return [];
    }
  }
}
```

- [ ] **Step 5: Run SponsorBlock test to verify it passes**

Run: `npx vitest run src/domains/sponsorblock/client.test.ts`
Expected: All tests PASS

- [ ] **Step 6: Write DeArrow types and client**

```typescript
// src/domains/dearrow/types.ts
export interface DeArrowBranding {
  title?: string;
  thumbnail?: string;
}

export interface DeArrowApiResponse {
  titles: Array<{ title: string; votes: number; original: boolean }>;
  thumbnails: Array<{ thumbnail: string; votes: number; original: boolean }>;
}
```

```typescript
// src/domains/dearrow/client.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DeArrowClient } from './client.js';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('DeArrowClient', () => {
  let client: DeArrowClient;

  beforeEach(() => {
    client = new DeArrowClient();
    mockFetch.mockReset();
  });

  it('returns community title and thumbnail', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        titles: [{ title: 'Better Title', votes: 10, original: false }],
        thumbnails: [{ thumbnail: '123.jpg', votes: 5, original: false }],
      }),
    });

    const result = await client.getBranding('testVideoId1');
    expect(result.title).toBe('Better Title');
  });

  it('skips original titles', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        titles: [{ title: 'Original', votes: 10, original: true }],
        thumbnails: [],
      }),
    });

    const result = await client.getBranding('testVideoId1');
    expect(result.title).toBeUndefined();
  });

  it('returns empty branding on error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('network'));
    const result = await client.getBranding('testVideoId1');
    expect(result.title).toBeUndefined();
    expect(result.thumbnail).toBeUndefined();
  });
});
```

- [ ] **Step 7: Run DeArrow test to verify it fails**

Run: `npx vitest run src/domains/dearrow/client.test.ts`
Expected: FAIL — module not found

- [ ] **Step 8: Write DeArrow client implementation**

```typescript
// src/domains/dearrow/client.ts
import type { DeArrowBranding, DeArrowApiResponse } from './types.js';
import { Cache } from '../../infrastructure/cache.js';

const API_BASE = 'https://sponsor.ajay.app/api/branding';

export class DeArrowClient {
  private cache = new Cache<DeArrowBranding>();

  async getBranding(videoId: string): Promise<DeArrowBranding> {
    const cacheKey = `da:${videoId}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    try {
      const response = await fetch(`${API_BASE}?videoID=${videoId}`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) return {};
      const data = (await response.json()) as DeArrowApiResponse;

      const branding: DeArrowBranding = {};

      const communityTitle = data.titles
        ?.filter((t) => !t.original)
        .sort((a, b) => b.votes - a.votes)[0];
      if (communityTitle) branding.title = communityTitle.title;

      const communityThumb = data.thumbnails
        ?.filter((t) => !t.original)
        .sort((a, b) => b.votes - a.votes)[0];
      if (communityThumb) branding.thumbnail = communityThumb.thumbnail;

      this.cache.set(cacheKey, branding, 3600); // 1 hour
      return branding;
    } catch {
      return {};
    }
  }
}
```

- [ ] **Step 9: Run DeArrow test to verify it passes**

Run: `npx vitest run src/domains/dearrow/client.test.ts`
Expected: All tests PASS

- [ ] **Step 10: Commit**

```bash
git add src/domains/sponsorblock/ src/domains/dearrow/
git commit -m "feat: add SponsorBlock and DeArrow API clients"
```

---

## Chunk 4: API Domain Handlers (Tasks 15-19)

### Task 15: Subtitles Handler

**Files:**
- Create: `src/domains/subtitles/handler.ts`
- Create: `src/domains/subtitles/handler.test.ts`

**Independent: can run in parallel with Tasks 16, 17, 18**

- [ ] **Step 1: Write the failing test**

```typescript
// src/domains/subtitles/handler.test.ts
import { describe, it, expect } from 'vitest';
import { buildSubtitleList } from './handler.js';
import type { VideoInfo, SubtitleTrack } from '../youtube/types.js';

function makeVideoInfo(
  subtitles: Record<string, SubtitleTrack[]>,
  automatic_captions: Record<string, SubtitleTrack[]> = {},
): VideoInfo {
  return {
    id: 'test123abcd',
    title: 'Test',
    subtitles,
    automatic_captions,
  };
}

describe('buildSubtitleList', () => {
  it('returns empty array for no subtitles', () => {
    expect(buildSubtitleList(makeVideoInfo({}))).toEqual([]);
  });

  it('extracts manual subtitles', () => {
    const info = makeVideoInfo({
      en: [{ ext: 'srt', url: 'https://example.com/en.srt' }],
    });
    const result = buildSubtitleList(info);
    expect(result).toHaveLength(1);
    expect(result[0].lang).toBe('en');
    expect(result[0].url).toContain('.srt');
  });

  it('prefers SRT over VTT', () => {
    const info = makeVideoInfo({
      en: [
        { ext: 'vtt', url: 'https://example.com/en.vtt' },
        { ext: 'srt', url: 'https://example.com/en.srt' },
      ],
    });
    const result = buildSubtitleList(info);
    expect(result[0].url).toContain('.srt');
  });

  it('falls back to VTT if no SRT', () => {
    const info = makeVideoInfo({
      en: [{ ext: 'vtt', url: 'https://example.com/en.vtt' }],
    });
    const result = buildSubtitleList(info);
    expect(result[0].url).toContain('.vtt');
  });

  it('prefixes auto captions with "Auto"', () => {
    const info = makeVideoInfo({}, {
      en: [{ ext: 'vtt', url: 'https://example.com/auto-en.vtt', name: 'English' }],
    });
    const result = buildSubtitleList(info);
    expect(result[0].id).toContain('Auto');
  });

  it('places manual subtitles before auto captions', () => {
    const info = makeVideoInfo(
      { en: [{ ext: 'srt', url: 'https://example.com/en.srt' }] },
      { fr: [{ ext: 'vtt', url: 'https://example.com/auto-fr.vtt' }] },
    );
    const result = buildSubtitleList(info);
    expect(result[0].id).not.toContain('Auto');
    expect(result[1].id).toContain('Auto');
  });

  it('handles multiple languages', () => {
    const info = makeVideoInfo({
      en: [{ ext: 'srt', url: 'https://example.com/en.srt' }],
      es: [{ ext: 'vtt', url: 'https://example.com/es.vtt' }],
    });
    const result = buildSubtitleList(info);
    expect(result).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/domains/subtitles/handler.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write implementation**

```typescript
// src/domains/subtitles/handler.ts
import type { VideoInfo, SubtitleTrack } from '../youtube/types.js';
import type { StremioSubtitle } from '../stremio/types.js';

const FORMAT_PRIORITY = ['srt', 'vtt'];

function selectBestTrack(tracks: SubtitleTrack[]): SubtitleTrack | undefined {
  for (const format of FORMAT_PRIORITY) {
    const match = tracks.find((t) => t.ext === format);
    if (match) return match;
  }
  return tracks[0]; // fallback to first available
}

export function buildSubtitleList(info: VideoInfo): StremioSubtitle[] {
  const result: StremioSubtitle[] = [];

  // Manual subtitles (higher priority)
  if (info.subtitles) {
    for (const [lang, tracks] of Object.entries(info.subtitles)) {
      const best = selectBestTrack(tracks);
      if (best) {
        result.push({
          id: `${lang}`,
          url: best.url,
          lang,
        });
      }
    }
  }

  // Auto-generated captions
  if (info.automatic_captions) {
    for (const [lang, tracks] of Object.entries(info.automatic_captions)) {
      const best = selectBestTrack(tracks);
      if (best) {
        result.push({
          id: `Auto ${lang}`,
          url: best.url,
          lang,
        });
      }
    }
  }

  return result;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/domains/subtitles/handler.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/domains/subtitles/handler.ts src/domains/subtitles/handler.test.ts
git commit -m "feat: add subtitle handler with format preference and manual/auto priority"
```

---

### Task 16: Meta Handler

**Files:**
- Create: `src/domains/meta/handler.ts`
- Create: `src/domains/meta/handler.test.ts`

**Independent: can run in parallel with Tasks 15, 17, 18**

- [ ] **Step 1: Write the failing test**

```typescript
// src/domains/meta/handler.test.ts
import { describe, it, expect } from 'vitest';
import { buildMeta } from './handler.js';
import type { VideoInfo } from '../youtube/types.js';

const baseInfo: VideoInfo = {
  id: 'dQw4w9WgXcQ',
  title: 'Test Video Title',
  description: 'A test description',
  thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
  duration: 212,
  upload_date: '20091025',
  uploader: 'Test Channel',
  channel_url: 'https://www.youtube.com/channel/UC1234',
};

describe('buildMeta', () => {
  it('maps basic fields correctly', () => {
    const meta = buildMeta(baseInfo);
    expect(meta.id).toBe('yt:dQw4w9WgXcQ');
    expect(meta.type).toBe('YouTube');
    expect(meta.name).toBe('Test Video Title');
    expect(meta.poster).toBe(baseInfo.thumbnail);
    expect(meta.posterShape).toBe('landscape');
    expect(meta.description).toBe('A test description');
  });

  it('formats release year from upload_date', () => {
    const meta = buildMeta(baseInfo);
    expect(meta.releaseInfo).toBe('2009');
  });

  it('formats runtime in minutes', () => {
    const meta = buildMeta(baseInfo);
    expect(meta.runtime).toBe('3m');
  });

  it('includes channel as link', () => {
    const meta = buildMeta(baseInfo);
    expect(meta.links).toBeDefined();
    expect(meta.links![0].name).toBe('Test Channel');
    expect(meta.links![0].category).toBe('channel');
  });

  it('sets defaultVideoId in behaviorHints', () => {
    const meta = buildMeta(baseInfo);
    expect(meta.behaviorHints?.defaultVideoId).toBe('yt:dQw4w9WgXcQ');
  });

  it('applies DeArrow title when provided', () => {
    const meta = buildMeta(baseInfo, { title: 'Better Title' });
    expect(meta.name).toBe('Better Title');
  });

  it('applies DeArrow thumbnail when provided', () => {
    const meta = buildMeta(baseInfo, { thumbnail: 'https://dearrow.com/thumb.jpg' });
    expect(meta.poster).toBe('https://dearrow.com/thumb.jpg');
  });

  it('handles missing optional fields', () => {
    const minimal: VideoInfo = { id: 'test123abcd', title: 'Minimal' };
    const meta = buildMeta(minimal);
    expect(meta.name).toBe('Minimal');
    expect(meta.runtime).toBeUndefined();
    expect(meta.links).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/domains/meta/handler.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write implementation**

```typescript
// src/domains/meta/handler.ts
import type { VideoInfo } from '../youtube/types.js';
import type { StremioMeta } from '../stremio/types.js';
import type { DeArrowBranding } from '../dearrow/types.js';

export function buildMeta(info: VideoInfo, dearrow?: DeArrowBranding): StremioMeta {
  const links = [];
  if (info.uploader && info.channel_url) {
    links.push({
      name: info.uploader,
      category: 'channel',
      url: info.channel_url,
    });
  }

  return {
    id: `yt:${info.id}`,
    type: 'YouTube',
    name: dearrow?.title ?? info.title,
    poster: dearrow?.thumbnail ?? info.thumbnail ?? '',
    posterShape: 'landscape',
    description: info.description,
    releaseInfo: info.upload_date ? info.upload_date.slice(0, 4) : undefined,
    runtime: info.duration ? `${Math.round(info.duration / 60)}m` : undefined,
    links,
    behaviorHints: {
      defaultVideoId: `yt:${info.id}`,
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/domains/meta/handler.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/domains/meta/handler.ts src/domains/meta/handler.test.ts
git commit -m "feat: add meta handler with DeArrow enrichment"
```

---

### Task 17: Stream Handler

**Files:**
- Create: `src/domains/stream/handler.ts`
- Create: `src/domains/stream/handler.test.ts`

**Independent: can run in parallel with Tasks 15, 16, 18**

- [ ] **Step 1: Write the failing test**

```typescript
// src/domains/stream/handler.test.ts
import { describe, it, expect } from 'vitest';
import { buildStreamList } from './handler.js';
import type { VideoFormat } from '../youtube/types.js';

const formats: VideoFormat[] = [
  { format_id: '313', ext: 'webm', width: 3840, height: 2160, vcodec: 'vp9', acodec: 'none', url: 'https://example.com/4k', tbr: 12000 },
  { format_id: '137', ext: 'mp4', width: 1920, height: 1080, vcodec: 'avc1.640028', acodec: 'none', url: 'https://example.com/1080', tbr: 4000 },
  { format_id: '136', ext: 'mp4', width: 1280, height: 720, vcodec: 'avc1.4d401f', acodec: 'none', url: 'https://example.com/720', tbr: 2500 },
  { format_id: '135', ext: 'mp4', width: 854, height: 480, vcodec: 'avc1.4d401e', acodec: 'none', url: 'https://example.com/480', tbr: 1000 },
  { format_id: '18', ext: 'mp4', width: 640, height: 360, vcodec: 'avc1.42001E', acodec: 'mp4a.40.2', url: 'https://example.com/360', tbr: 500 },
  { format_id: '140', ext: 'm4a', vcodec: 'none', acodec: 'mp4a.40.2', url: 'https://example.com/audio', abr: 128 },
];

describe('buildStreamList', () => {
  const baseUrl = 'http://localhost:8000';

  it('returns streams for available qualities', () => {
    const streams = buildStreamList(formats, 'dQw4w9WgXcQ', baseUrl, '1080');
    expect(streams.length).toBeGreaterThan(0);
  });

  it('respects max quality setting', () => {
    const streams = buildStreamList(formats, 'dQw4w9WgXcQ', baseUrl, '720');
    const heights = streams.map((s) => {
      const match = s.url.match(/q=(\d+)/);
      return match ? parseInt(match[1]) : 0;
    });
    expect(Math.max(...heights)).toBeLessThanOrEqual(720);
  });

  it('includes play URL with correct format', () => {
    const streams = buildStreamList(formats, 'dQw4w9WgXcQ', baseUrl, '1080');
    expect(streams[0].url).toMatch(/\/play\/dQw4w9WgXcQ\.mp4\?q=\d+/);
  });

  it('includes quality name in stream name', () => {
    const streams = buildStreamList(formats, 'dQw4w9WgXcQ', baseUrl, '1080');
    expect(streams.some((s) => s.name?.includes('1080p'))).toBe(true);
  });

  it('sets filename in behaviorHints', () => {
    const streams = buildStreamList(formats, 'dQw4w9WgXcQ', baseUrl, '1080');
    expect(streams[0].behaviorHints?.filename).toContain('.mp4');
  });

  it('returns empty array when no formats available', () => {
    expect(buildStreamList([], 'dQw4w9WgXcQ', baseUrl, '1080')).toEqual([]);
  });

  it('adds SponsorBlock note to description when segments provided', () => {
    const streams = buildStreamList(formats, 'dQw4w9WgXcQ', baseUrl, '1080', 3);
    expect(streams[0].description).toContain('SponsorBlock');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/domains/stream/handler.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write implementation**

```typescript
// src/domains/stream/handler.ts
import type { VideoFormat } from '../youtube/types.js';
import type { StremioStream } from '../stremio/types.js';
import { findVideoFormat, findAudioFormat } from '../youtube/formats.js';

const QUALITY_LEVELS = [2160, 1080, 720, 480, 360];

export function buildStreamList(
  formats: VideoFormat[],
  videoId: string,
  baseUrl: string,
  maxQuality: string,
  sponsorBlockSegmentCount?: number,
): StremioStream[] {
  const maxHeight = parseInt(maxQuality, 10) || 1080;
  const streams: StremioStream[] = [];

  for (const height of QUALITY_LEVELS) {
    if (height > maxHeight) continue;

    const video = findVideoFormat(formats, height);
    if (!video) continue;

    // For non-360p, also need audio
    const isMuxed = video.acodec && video.acodec !== 'none';
    if (!isMuxed && !findAudioFormat(formats)) continue;

    const codec = video.vcodec?.split('.')[0] ?? 'unknown';
    const label = height >= 2160 ? '4K' : `${height}p`;
    let description = `${codec} + AAC`;

    if (sponsorBlockSegmentCount && sponsorBlockSegmentCount > 0) {
      description += ` | SponsorBlock: ${sponsorBlockSegmentCount} segments will be skipped`;
    }

    streams.push({
      url: `${baseUrl}/play/${videoId}.mp4?q=${height}`,
      name: `[Tubio+] ${label}`,
      description,
      behaviorHints: {
        filename: `${videoId}-${height}p.mp4`,
        bingeGroup: `tubioplus-${height}p`,
      },
    });
  }

  return streams;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/domains/stream/handler.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/domains/stream/handler.ts src/domains/stream/handler.test.ts
git commit -m "feat: add stream handler with quality selection and SponsorBlock notes"
```

---

### Task 18: Catalog Handler

**Files:**
- Create: `src/domains/catalog/handler.ts`
- Create: `src/domains/catalog/handler.test.ts`
- Create: `src/domains/catalog/prewarm.ts`

**Independent: can run in parallel with Tasks 15, 16, 17**

- [ ] **Step 1: Write the failing test**

```typescript
// src/domains/catalog/handler.test.ts
import { describe, it, expect } from 'vitest';
import { parseExtraParams, buildCatalogMetas, paginateResults } from './handler.js';
import type { SearchResult } from '../youtube/types.js';

describe('parseExtraParams', () => {
  it('parses search query', () => {
    const params = parseExtraParams('search=test%20query');
    expect(params.search).toBe('test query');
  });

  it('parses skip parameter', () => {
    const params = parseExtraParams('search=test&skip=20');
    expect(params.skip).toBe(20);
  });

  it('returns defaults for empty string', () => {
    const params = parseExtraParams('');
    expect(params.search).toBeUndefined();
    expect(params.skip).toBe(0);
  });
});

describe('paginateResults', () => {
  const items = Array.from({ length: 50 }, (_, i) => ({ id: `vid${i}` }));

  it('returns 20 items for first page (skip=0)', () => {
    const result = paginateResults(items as any[], 0, 100);
    expect(result).toHaveLength(20);
  });

  it('returns 10 items for subsequent pages', () => {
    const result = paginateResults(items as any[], 20, 100);
    expect(result).toHaveLength(10);
  });

  it('respects catalog limit', () => {
    const result = paginateResults(items as any[], 0, 15);
    expect(result).toHaveLength(15);
  });

  it('returns empty when skip exceeds limit', () => {
    const result = paginateResults(items as any[], 100, 100);
    expect(result).toHaveLength(0);
  });
});

describe('buildCatalogMetas', () => {
  it('maps search results to Stremio meta previews', () => {
    const results: SearchResult[] = [
      {
        id: 'dQw4w9WgXcQ',
        title: 'Test Video',
        thumbnail: 'https://example.com/thumb.jpg',
        duration: 120,
        uploader: 'Channel',
      },
    ];
    const metas = buildCatalogMetas(results);
    expect(metas[0].id).toBe('yt:dQw4w9WgXcQ');
    expect(metas[0].type).toBe('YouTube');
    expect(metas[0].name).toBe('Test Video');
    expect(metas[0].poster).toBe('https://example.com/thumb.jpg');
  });

  it('applies DeArrow branding when provided', () => {
    const results: SearchResult[] = [
      { id: 'dQw4w9WgXcQ', title: 'Original', thumbnail: 'https://example.com/thumb.jpg' },
    ];
    const brandings = new Map([['dQw4w9WgXcQ', { title: 'Better Title' }]]);
    const metas = buildCatalogMetas(results, brandings);
    expect(metas[0].name).toBe('Better Title');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/domains/catalog/handler.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write implementation**

```typescript
// src/domains/catalog/handler.ts
import type { SearchResult } from '../youtube/types.js';
import type { StremioMetaPreview } from '../stremio/types.js';
import type { DeArrowBranding } from '../dearrow/types.js';

export interface ExtraParams {
  search?: string;
  skip: number;
}

export function parseExtraParams(extra: string): ExtraParams {
  const params: ExtraParams = { skip: 0 };
  if (!extra) return params;

  const pairs = extra.split('&');
  for (const pair of pairs) {
    const [key, value] = pair.split('=');
    if (key === 'search') params.search = decodeURIComponent(value ?? '');
    if (key === 'skip') params.skip = parseInt(value ?? '0', 10);
  }
  return params;
}

export function paginateResults<T>(items: T[], skip: number, catalogLimit: number): T[] {
  if (skip >= catalogLimit) return [];
  const pageSize = skip === 0 ? 20 : 10;
  const remaining = catalogLimit - skip;
  const count = Math.min(pageSize, remaining);
  return items.slice(0, count);
}

export function buildCatalogMetas(
  results: SearchResult[],
  brandings?: Map<string, DeArrowBranding>,
): StremioMetaPreview[] {
  return results.map((r) => {
    const branding = brandings?.get(r.id);
    return {
      id: `yt:${r.id}`,
      type: 'YouTube',
      name: branding?.title ?? r.title,
      poster: branding?.thumbnail ?? r.thumbnail ?? '',
      posterShape: 'landscape' as const,
    };
  });
}
```

```typescript
// src/domains/catalog/prewarm.ts
import type { YtDlpService } from '../youtube/ytdlp.js';

export function prewarmVideoInfo(
  ytdlp: YtDlpService,
  videoIds: string[],
  cookieFile?: string,
  browserCookies?: boolean,
): void {
  const idsToWarm = videoIds.slice(0, 10);
  for (const id of idsToWarm) {
    // Fire-and-forget — errors silently ignored
    ytdlp.getVideoInfo(id, cookieFile, browserCookies).catch(() => {});
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/domains/catalog/handler.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/domains/catalog/handler.ts src/domains/catalog/handler.test.ts src/domains/catalog/prewarm.ts
git commit -m "feat: add catalog handler with pagination, prewarm, and DeArrow enrichment"
```

---

### Task 19: Stremio Plugin (manifest route)

**Files:**
- Create: `src/domains/stremio/plugin.ts`

No test — thin Fastify plugin wiring. Tested via integration tests in Task 21.

- [ ] **Step 1: Write the plugin**

```typescript
// src/domains/stremio/plugin.ts
import type { FastifyPluginAsync } from 'fastify';
import { manifest } from './manifest.js';

export const stremioPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.get('/manifest.json', async (_request, reply) => {
    reply.header('Cache-Control', 'max-age=86400');
    return manifest;
  });
};
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/domains/stremio/plugin.ts
git commit -m "feat: add Stremio manifest route plugin"
```

---

## Chunk 5: App Assembly & Integration Tests (Tasks 20-22)

**All tasks in this chunk depend on M1-M5 being complete.**

### Task 20: Integration Tests First (TDD for App Assembly)

**Files:**
- Create: `test/integration/api.test.ts`
- Create: `src/app.ts`

Following TDD: write integration tests FIRST, then build the app factory to make them pass.

- [ ] **Step 1: Install @fastify/static**

Run: `npm install @fastify/static && npm install -D @types/node`

- [ ] **Step 2: Write the integration test (RED)**

```typescript
// test/integration/api.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../src/app.js';
import { loadEnv } from '../../src/shared/env.js';
import { encryptConfig, loadEncryptionKey } from '../../src/domains/config/encryption.js';
import type { FastifyInstance } from 'fastify';

describe('API Integration Tests', () => {
  let app: FastifyInstance;
  let encryptedConfig: string;

  beforeAll(async () => {
    process.env.RATE_LIMIT = 'off';
    process.env.BROWSER_COOKIES = 'off';
    const env = loadEnv();
    app = await buildApp(env);
    const key = await loadEncryptionKey(env.encryptionKey);
    encryptedConfig = encryptConfig({ quality: '1080' }, key);
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /manifest.json returns valid manifest', async () => {
    const res = await app.inject({ method: 'GET', url: '/manifest.json' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.id).toBe('yt.stremio.addon');
    expect(body.catalogs).toHaveLength(5);
    expect(body.resources).toEqual(['catalog', 'meta', 'stream', 'subtitles']);
  });

  it('GET /health returns status with dependency checks', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('ok');
    expect(body).toHaveProperty('ytdlp');
    expect(body).toHaveProperty('ffmpeg');
  });

  it('CORS headers present on all responses', async () => {
    const res = await app.inject({ method: 'GET', url: '/manifest.json' });
    expect(res.headers['access-control-allow-origin']).toBe('*');
  });

  it('POST /api/encrypt returns encrypted URL', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/encrypt',
      payload: { quality: '720' },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.url).toContain('/manifest.json');
  });

  it('GET /play/:invalidId.mp4 returns 404', async () => {
    const res = await app.inject({ method: 'GET', url: '/play/bad!id.mp4?q=720' });
    expect(res.statusCode).toBe(404);
  });

  it('Stremio subtitles route returns array shape on failure', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/${encryptedConfig}/subtitles/YouTube/yt:dQw4w9WgXcQ.json`,
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('subtitles');
    expect(Array.isArray(body.subtitles)).toBe(true);
  });

  it('Stremio meta route returns object shape on failure', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/${encryptedConfig}/meta/YouTube/yt:dQw4w9WgXcQ.json`,
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('meta');
  });

  it('Stremio stream route returns array shape on failure', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/${encryptedConfig}/stream/YouTube/yt:dQw4w9WgXcQ.json`,
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('streams');
    expect(Array.isArray(body.streams)).toBe(true);
  });

  it('/configure does not match Stremio config route', async () => {
    // /configure is shorter than 32 chars and not base64url, so should NOT match /:config/ routes
    const res = await app.inject({ method: 'GET', url: '/configure' });
    // Should return 200 (SPA page) or 404, NOT a Stremio JSON response
    expect(res.statusCode).not.toBe(500);
  });
});
```

- [ ] **Step 3: Run tests to verify RED**

Run: `npx vitest run test/integration/api.test.ts`
Expected: FAIL — `src/app.js` does not exist

- [ ] **Step 4: Write the app factory (GREEN)**

```typescript
// src/app.ts
import Fastify from 'fastify';
import { existsSync } from 'node:fs';
import { spawn, type ChildProcess } from 'node:child_process';
import type { EnvConfig } from './shared/env.js';
import { createLogger } from './infrastructure/logger.js';
import { RateLimiter } from './infrastructure/rate-limit.js';
import { Cache } from './infrastructure/cache.js';
import { YtDlpService } from './domains/youtube/ytdlp.js';
import { SponsorBlockClient } from './domains/sponsorblock/client.js';
import { DeArrowClient } from './domains/dearrow/client.js';
import { stremioPlugin } from './domains/stremio/plugin.js';
import { loadEncryptionKey, decryptConfig, encryptConfig } from './domains/config/encryption.js';
import { mergeWithDefaults, type AppConfig } from './domains/config/schema.js';
import { isValidVideoId, extractVideoId } from './shared/validation.js';
import { buildSubtitleList } from './domains/subtitles/handler.js';
import { buildMeta } from './domains/meta/handler.js';
import { buildStreamList } from './domains/stream/handler.js';
import { parseExtraParams, paginateResults, buildCatalogMetas } from './domains/catalog/handler.js';
import { prewarmVideoInfo } from './domains/catalog/prewarm.js';
import { findVideoFormat, findAudioFormat } from './domains/youtube/formats.js';
import type { VideoInfo } from './domains/youtube/types.js';

// Augment Fastify request to carry decoded config
declare module 'fastify' {
  interface FastifyRequest {
    appConfig?: AppConfig;
  }
}

// Track active FFmpeg processes for graceful shutdown
const activeProcesses = new Set<ChildProcess>();

export function getActiveProcesses(): Set<ChildProcess> {
  return activeProcesses;
}

// Health check cache
let healthCache: { ytdlp: boolean; ffmpeg: boolean; cachedAt: number } | null = null;
const HEALTH_CACHE_TTL = 300000; // 5 minutes

// Base64url regex: at least 32 chars, only [A-Za-z0-9_-]
const CONFIG_PARAM_REGEX = /^[A-Za-z0-9_-]{32,}$/;

export async function buildApp(env: EnvConfig) {
  const logger = createLogger(env.nodeEnv);
  const app = Fastify({ logger });
  const encryptionKey = await loadEncryptionKey(env.encryptionKey);
  const videoCache = new Cache<VideoInfo>();
  const ytdlp = new YtDlpService(env.ytDlpPath, videoCache);
  const sponsorblock = new SponsorBlockClient();
  const dearrow = new DeArrowClient();

  // Rate limiters
  const playLimiter = new RateLimiter({ windowMs: 60000, max: 15 });
  const encryptLimiter = new RateLimiter({ windowMs: 60000, max: 10 });
  const apiLimiter = new RateLimiter({ windowMs: 60000, max: 60 });
  const globalLimiter = new RateLimiter({ windowMs: 60000, max: 120 });

  // Cleanup interval
  const cleanupInterval = setInterval(() => {
    playLimiter.cleanup();
    encryptLimiter.cleanup();
    apiLimiter.cleanup();
    globalLimiter.cleanup();
  }, 300000);

  app.addHook('onClose', () => {
    clearInterval(cleanupInterval);
    // Kill active FFmpeg processes on shutdown
    for (const proc of activeProcesses) {
      proc.kill('SIGTERM');
    }
    activeProcesses.clear();
  });

  // CORS
  app.addHook('onSend', async (_request, reply) => {
    reply.header('Access-Control-Allow-Origin', '*');
    reply.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    reply.header('Access-Control-Allow-Headers', 'Content-Type');
  });

  // Rate limiting hook with full headers (when enabled)
  function applyRateLimit(limiter: RateLimiter, request: any, reply: any): boolean {
    if (!env.rateLimitEnabled) return true;
    const result = limiter.check(request.ip);
    reply.header('RateLimit-Limit', String(result.limit));
    reply.header('RateLimit-Remaining', String(result.remaining));
    if (!result.allowed) {
      reply.header('Retry-After', String(result.retryAfter));
      reply.status(429);
      return false;
    }
    return true;
  }

  if (env.rateLimitEnabled) {
    app.addHook('onRequest', async (request, reply) => {
      const result = globalLimiter.check(request.ip);
      reply.header('RateLimit-Limit', String(result.limit));
      reply.header('RateLimit-Remaining', String(result.remaining));
      if (!result.allowed) {
        reply.header('Retry-After', String(result.retryAfter));
        reply.status(429).send({ error: 'Too many requests' });
      }
    });
  }

  // Health check with caching
  app.get('/health', async () => {
    const now = Date.now();
    if (healthCache && now - healthCache.cachedAt < HEALTH_CACHE_TTL) {
      return { status: 'ok', ytdlp: healthCache.ytdlp, ffmpeg: healthCache.ffmpeg };
    }

    let ytdlpOk = false;
    let ffmpegOk = false;
    try {
      const proc = spawn(env.ytDlpPath, ['--version'], { stdio: ['ignore', 'pipe', 'pipe'] });
      await new Promise<void>((resolve) => proc.on('close', (code) => { ytdlpOk = code === 0; resolve(); }));
    } catch { /* ignore */ }
    try {
      const proc = spawn('ffmpeg', ['-version'], { stdio: ['ignore', 'pipe', 'pipe'] });
      await new Promise<void>((resolve) => proc.on('close', (code) => { ffmpegOk = code === 0; resolve(); }));
    } catch { /* ignore */ }

    healthCache = { ytdlp: ytdlpOk, ffmpeg: ffmpegOk, cachedAt: now };
    return { status: 'ok', ytdlp: ytdlpOk, ffmpeg: ffmpegOk };
  });

  // Stremio manifest
  await app.register(stremioPlugin, { prefix: env.basePath || undefined });

  // Config encryption API
  app.post<{ Body: Record<string, unknown> }>(`${env.basePath}/api/encrypt`, async (request, reply) => {
    if (!applyRateLimit(encryptLimiter, request, reply)) {
      return { error: 'Too many requests' };
    }
    const encrypted = encryptConfig(request.body, encryptionKey);
    const baseUrl = `${request.protocol}://${request.hostname}${env.basePath}`;
    return { url: `${baseUrl}/${encrypted}/manifest.json` };
  });

  // Config decryption helper
  function decryptRequestConfig(configStr: string): AppConfig {
    try {
      const raw = decryptConfig(configStr, encryptionKey);
      return mergeWithDefaults(raw);
    } catch {
      return mergeWithDefaults({});
    }
  }

  // Cookie resolution helper
  async function resolveCookies(config: AppConfig): Promise<{ cookieFile?: string; browserCookies?: boolean; cleanup?: () => Promise<void> }> {
    if (env.browserCookies === 'on' || (env.browserCookies === 'auto' && existsSync('/data/chromium-profile'))) {
      return { browserCookies: true };
    }
    if (config.cookies) {
      const file = await ytdlp.writeCookieFile(config.cookies);
      return { cookieFile: file, cleanup: () => ytdlp.removeCookieFile(file) };
    }
    return {};
  }

  // Stremio catalog route — uses regex constraint on :config to avoid collisions
  const stremioPrefix = env.basePath;

  app.get<{ Params: { config: string; type: string; id: string } }>(
    `${stremioPrefix}/:config/catalog/:type/:id.json`,
    { constraints: { config: { match: CONFIG_PARAM_REGEX } } as any },
    async (request) => {
      const config = decryptRequestConfig(request.params.config);
      const cookies = await resolveCookies(config);
      try {
        // No extra params on this route variant
        return await handleCatalog(request.params.id, '', config, cookies, env);
      } finally {
        await cookies.cleanup?.();
      }
    },
  );

  app.get<{ Params: { config: string; type: string; id: string; extra: string } }>(
    `${stremioPrefix}/:config/catalog/:type/:id/:extra.json`,
    async (request) => {
      const config = decryptRequestConfig(request.params.config);
      const cookies = await resolveCookies(config);
      try {
        return await handleCatalog(request.params.id, request.params.extra, config, cookies, env);
      } finally {
        await cookies.cleanup?.();
      }
    },
  );

  // Catalog handler (shared logic)
  async function handleCatalog(
    catalogId: string,
    extra: string,
    config: AppConfig,
    cookies: { cookieFile?: string; browserCookies?: boolean },
    env: EnvConfig,
  ) {
    const { search, skip } = parseExtraParams(extra);

    try {
      let results: any[] = [];

      if (catalogId === 'yt:search' && search) {
        const cached = videoCache.get(`search:${search}`);
        if (cached) {
          // Search cache returns search results, not VideoInfo — handle separately
        }
        results = await ytdlp.search(search, env.catalogLimit, cookies.cookieFile, cookies.browserCookies);
      } else if (catalogId === 'yt:recommendations') {
        // Trending — no cookies required
        results = await ytdlp.search('', env.catalogLimit, cookies.cookieFile, cookies.browserCookies);
        // Note: actual implementation should call a getRecommendations method on ytdlp
      }
      // yt:subscriptions, yt:history, yt:watchlater require cookies
      // Return empty if no cookies available (graceful degradation)

      const paginated = paginateResults(results, skip, env.catalogLimit);
      const metas = buildCatalogMetas(paginated);

      // Prewarm video info for returned IDs
      const rawIds = paginated.map((r: any) => r.id).filter(Boolean);
      prewarmVideoInfo(ytdlp, rawIds, cookies.cookieFile, cookies.browserCookies);

      return { metas };
    } catch {
      return { metas: [] };
    }
  }

  // Stremio meta route
  app.get<{ Params: { config: string; type: string; id: string } }>(
    `${stremioPrefix}/:config/meta/:type/:id.json`,
    async (request) => {
      const config = decryptRequestConfig(request.params.config);
      const videoId = extractVideoId(request.params.id);
      if (!isValidVideoId(request.params.id)) return { meta: {} };

      const cookies = await resolveCookies(config);
      try {
        const info = await ytdlp.getVideoInfoWithStale(videoId, cookies.cookieFile, cookies.browserCookies);
        const branding = config.dearrow.enabled ? await dearrow.getBranding(videoId) : undefined;
        return { meta: buildMeta(info, branding) };
      } catch {
        return { meta: {} };
      } finally {
        await cookies.cleanup?.();
      }
    },
  );

  // Stremio stream route
  app.get<{ Params: { config: string; type: string; id: string } }>(
    `${stremioPrefix}/:config/stream/:type/:id.json`,
    async (request) => {
      const config = decryptRequestConfig(request.params.config);
      const videoId = extractVideoId(request.params.id);
      if (!isValidVideoId(request.params.id)) return { streams: [] };

      const cookies = await resolveCookies(config);
      try {
        const info = await ytdlp.getVideoInfoWithStale(videoId, cookies.cookieFile, cookies.browserCookies);
        const baseUrl = `${request.protocol}://${request.hostname}${env.basePath}`;

        let sbCount: number | undefined;
        if (config.sponsorblock.enabled) {
          const segments = await sponsorblock.getSkipSegments(videoId, config.sponsorblock.categories);
          sbCount = segments.length;
        }

        return { streams: buildStreamList(info.formats ?? [], videoId, baseUrl, config.quality, sbCount) };
      } catch {
        return { streams: [] };
      } finally {
        await cookies.cleanup?.();
      }
    },
  );

  // Stremio subtitles route
  app.get<{ Params: { config: string; type: string; id: string } }>(
    `${stremioPrefix}/:config/subtitles/:type/:id.json`,
    async (request) => {
      const config = decryptRequestConfig(request.params.config);
      const videoId = extractVideoId(request.params.id);
      if (!isValidVideoId(request.params.id)) return { subtitles: [] };

      const cookies = await resolveCookies(config);
      try {
        const info = await ytdlp.getVideoInfoWithStale(videoId, cookies.cookieFile, cookies.browserCookies);
        return { subtitles: buildSubtitleList(info) };
      } catch {
        return { subtitles: [] };
      } finally {
        await cookies.cleanup?.();
      }
    },
  );

  // Play route (video streaming)
  app.get<{ Params: { videoId: string }; Querystring: { q?: string } }>(
    `${stremioPrefix}/play/:videoId.mp4`,
    async (request, reply) => {
      if (!applyRateLimit(playLimiter, request, reply)) {
        return { error: 'Too many requests' };
      }

      const rawId = request.params.videoId;
      if (!isValidVideoId(rawId)) {
        reply.status(404);
        return { error: 'Invalid video ID' };
      }

      const height = parseInt(request.query.q ?? '1080', 10);

      try {
        const info = await ytdlp.getFreshVideoInfo(rawId);
        const formats = info.formats ?? [];
        const video = findVideoFormat(formats, height);
        if (!video) {
          reply.status(404);
          return { error: 'No suitable format found' };
        }

        const isMuxed = video.acodec && video.acodec !== 'none';

        if (isMuxed) {
          // Direct proxy for muxed streams (360p)
          const response = await fetch(video.url, {
            headers: { Referer: 'https://www.youtube.com' },
          });
          reply.header('Content-Type', 'video/mp4');
          return reply.send(response.body);
        }

        // FFmpeg mux for DASH streams
        const audio = findAudioFormat(formats);
        if (!audio) {
          reply.status(404);
          return { error: 'No audio format found' };
        }

        const ffmpeg = spawn('ffmpeg', [
          '-headers', 'Referer: https://www.youtube.com\r\n',
          '-i', video.url,
          '-headers', 'Referer: https://www.youtube.com\r\n',
          '-i', audio.url,
          '-c:v', 'copy',
          '-c:a', 'copy',
          '-movflags', 'frag_keyframe+empty_moov+faststart',
          '-f', 'mp4',
          'pipe:1',
        ], { stdio: ['ignore', 'pipe', 'pipe'] });

        // Track for graceful shutdown
        activeProcesses.add(ffmpeg);
        ffmpeg.on('close', () => activeProcesses.delete(ffmpeg));

        reply.header('Content-Type', 'video/mp4');
        reply.raw.on('close', () => ffmpeg.kill('SIGTERM'));

        return reply.send(ffmpeg.stdout);
      } catch (err) {
        reply.status(500);
        return { error: 'Extraction failed' };
      }
    },
  );

  return app;
}
```

- [ ] **Step 5: Run integration tests to verify GREEN**

Run: `npx vitest run test/integration/api.test.ts`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/app.ts test/integration/api.test.ts package.json package-lock.json
git commit -m "feat: wire up Fastify app with all routes; add integration tests"
```

---

### Task 21: Server Entry Point

**Files:**
- Modify: `src/server.ts`

- [ ] **Step 1: Write the server entry point**

```typescript
// src/server.ts
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
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/server.ts
git commit -m "feat: add server entry point with startup validation, local IP, graceful shutdown"
```

---

### Task 22: BASE_PATH Integration Test

**Files:**
- Create: `test/integration/basepath.test.ts`

- [ ] **Step 1: Write BASE_PATH test**

```typescript
// test/integration/basepath.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../src/app.js';
import { loadEnv } from '../../src/shared/env.js';
import type { FastifyInstance } from 'fastify';

describe('BASE_PATH Integration', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    process.env.RATE_LIMIT = 'off';
    process.env.BASE_PATH = '/tubio';
    process.env.BROWSER_COOKIES = 'off';
    const env = loadEnv();
    app = await buildApp(env);
  });

  afterAll(async () => {
    delete process.env.BASE_PATH;
    await app.close();
  });

  it('manifest served under BASE_PATH', async () => {
    const res = await app.inject({ method: 'GET', url: '/tubio/manifest.json' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.id).toBe('yt.stremio.addon');
  });

  it('health check served under BASE_PATH', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
  });

  it('encrypt API served under BASE_PATH', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/tubio/api/encrypt',
      payload: { quality: '720' },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.url).toContain('/tubio/');
  });
});
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run test/integration/basepath.test.ts`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add test/integration/basepath.test.ts
git commit -m "test: add BASE_PATH integration tests"
```

---

## Chunk 6: Frontend SPA (Tasks 23-27)

### Task 23: Frontend Scaffolding

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/tsconfig.json`
- Create: `frontend/index.html`
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/App.tsx`

- [ ] **Step 1: Create frontend directory and package.json**

```bash
mkdir -p frontend/src/pages frontend/src/components
```

```json
// frontend/package.json
{
  "name": "tubioplus-frontend",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  }
}
```

- [ ] **Step 2: Install frontend dependencies**

Run: `cd frontend && npm install react react-dom react-router-dom && npm install -D vite @vitejs/plugin-react typescript @types/react @types/react-dom && cd ..`

- [ ] **Step 3: Create frontend config files**

`frontend/vite.config.ts`:
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: '../dist/frontend',
    emptyOutDir: true,
  },
  server: {
    proxy: {
      '/api': 'http://localhost:8000',
      '/manifest.json': 'http://localhost:8000',
    },
  },
});
```

`frontend/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src"]
}
```

`frontend/index.html`:
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Tubio+</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #0f0f0f; color: #fff; font-family: system-ui, -apple-system, sans-serif; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.tsx"></script>
</body>
</html>
```

`frontend/src/main.tsx`:
```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

`frontend/src/App.tsx`:
```tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';

const basePath = (window as any).__BASE_PATH__ ?? '';

function Landing() {
  return <div>Landing placeholder</div>;
}

function Configure() {
  return <div>Configure placeholder</div>;
}

export function App() {
  return (
    <BrowserRouter basename={basePath}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/configure" element={<Configure />} />
      </Routes>
    </BrowserRouter>
  );
}
```

- [ ] **Step 4: Verify frontend builds**

Run: `cd frontend && npx vite build && cd ..`
Expected: Build completes, output in `dist/frontend/`

- [ ] **Step 5: Commit**

```bash
git add frontend/
git commit -m "chore: scaffold React frontend with Vite, React Router"
```

---

### Task 24: Landing Page Component

**Files:**
- Create: `frontend/src/pages/Landing.tsx`
- Create: `frontend/src/styles/global.css`

**Use @frontend-design skill for production-grade UI.**

- [ ] **Step 1: Create global styles**

```css
/* frontend/src/styles/global.css */
:root {
  --bg-primary: #0f0f0f;
  --bg-secondary: #1a1a2e;
  --accent: #ff0033;
  --accent-hover: #e6002e;
  --text-primary: #ffffff;
  --text-secondary: #888888;
  --text-muted: #555555;
  --border: rgba(255, 255, 255, 0.08);
  --surface: rgba(255, 255, 255, 0.04);
}

* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  background: linear-gradient(135deg, var(--bg-primary) 0%, var(--bg-secondary) 100%);
  color: var(--text-primary);
  font-family: system-ui, -apple-system, sans-serif;
  min-height: 100vh;
}
```

- [ ] **Step 2: Build the landing page**

```tsx
// frontend/src/pages/Landing.tsx
import { useNavigate } from 'react-router-dom';

export function Landing() {
  const navigate = useNavigate();
  const basePath = (window as any).__BASE_PATH__ ?? '';

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      gap: '20px',
    }}>
      <div style={{
        width: '64px',
        height: '64px',
        background: '#ff0033',
        borderRadius: '16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="white">
          <polygon points="9.5,7 16.5,12 9.5,17" />
        </svg>
      </div>
      <h1 style={{ fontSize: '2rem', fontWeight: 700, letterSpacing: '-0.5px' }}>
        Tubio<span style={{ color: '#ff0033' }}>+</span>
      </h1>
      <p style={{ color: '#888', fontSize: '0.9rem' }}>YouTube for Stremio</p>
      <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
        <button
          onClick={() => navigate('/configure')}
          style={{
            background: '#ff0033',
            color: 'white',
            border: 'none',
            padding: '12px 28px',
            borderRadius: '8px',
            fontSize: '0.9rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Configure
        </button>
        <a
          href={`stremio://${window.location.host}${basePath}/manifest.json`}
          style={{
            background: 'transparent',
            color: '#ccc',
            border: '1px solid #333',
            padding: '12px 28px',
            borderRadius: '8px',
            fontSize: '0.9rem',
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          Install
        </a>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Update App.tsx to use new components**

Replace the placeholder `Landing` and import from `./pages/Landing`.

- [ ] **Step 4: Verify it builds**

Run: `cd frontend && npx vite build && cd ..`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add frontend/
git commit -m "feat: add Minimal Dark landing page"
```

---

### Task 25: Stepper Wizard Configuration Page

**Files:**
- Create: `frontend/src/pages/Configure.tsx`
- Create: `frontend/src/components/Stepper.tsx`
- Create: `frontend/src/components/StepAuth.tsx`
- Create: `frontend/src/components/StepQuality.tsx`
- Create: `frontend/src/components/StepFeatures.tsx`
- Create: `frontend/src/components/StepInstall.tsx`

**Use @frontend-design skill for production-grade UI.**

This is a large task with multiple components. Use @frontend-design skill for production-grade styling. The code below provides the structure and logic — the agent implementing this should enhance the CSS/styling to match the Minimal Dark design direction.

- [ ] **Step 1: Create Stepper component**

```tsx
// frontend/src/components/Stepper.tsx
import { type ReactNode } from 'react';

interface Step {
  label: string;
  content: ReactNode;
}

interface StepperProps {
  steps: Step[];
  activeStep: number;
  onNext: () => void;
  onBack: () => void;
  onSkip?: () => void;
  showSkip?: boolean;
  nextLabel?: string;
}

export function Stepper({ steps, activeStep, onNext, onBack, onSkip, showSkip, nextLabel }: StepperProps) {
  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '24px' }}>
      {/* Progress indicator */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '32px', alignItems: 'center' }}>
        {steps.map((step, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: i < steps.length - 1 ? 1 : undefined }}>
            <div style={{
              width: '28px', height: '28px', borderRadius: '50%',
              background: i <= activeStep ? '#ff0033' : '#333',
              color: i <= activeStep ? 'white' : '#666',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '12px', fontWeight: 600,
            }}>{i + 1}</div>
            <span style={{ color: i <= activeStep ? '#fff' : '#666', fontSize: '13px' }}>{step.label}</span>
            {i < steps.length - 1 && <div style={{ flex: 1, height: '1px', background: '#333' }} />}
          </div>
        ))}
      </div>

      {/* Step content */}
      <div style={{ marginBottom: '24px' }}>{steps[activeStep].content}</div>

      {/* Navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <button onClick={onBack} disabled={activeStep === 0}
          style={{ padding: '10px 20px', background: 'transparent', color: activeStep === 0 ? '#333' : '#888', border: 'none', cursor: 'pointer', fontSize: '14px' }}>
          Back
        </button>
        <div style={{ display: 'flex', gap: '8px' }}>
          {showSkip && <button onClick={onSkip} style={{ padding: '10px 16px', background: 'transparent', color: '#555', border: 'none', cursor: 'pointer', fontSize: '14px' }}>Skip</button>}
          <button onClick={onNext}
            style={{ padding: '10px 24px', background: '#ff0033', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}>
            {nextLabel ?? 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create StepAuth component**

```tsx
// frontend/src/components/StepAuth.tsx
interface StepAuthProps {
  cookies: string;
  onCookiesChange: (cookies: string) => void;
  noVncUrl?: string;
}

export function StepAuth({ cookies, onCookiesChange, noVncUrl }: StepAuthProps) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '24px' }}>
      <h3 style={{ color: '#fff', fontSize: '18px', marginBottom: '4px' }}>Authentication</h3>
      <p style={{ color: '#666', fontSize: '13px', marginBottom: '16px' }}>Optional — needed for subscriptions, history, and watch later</p>
      <textarea
        value={cookies}
        onChange={(e) => onCookiesChange(e.target.value)}
        placeholder="Paste Netscape format cookies here..."
        style={{ width: '100%', minHeight: '100px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '12px', color: '#ccc', fontSize: '13px', fontFamily: 'monospace', resize: 'vertical' }}
      />
      {noVncUrl && (
        <p style={{ color: '#555', fontSize: '12px', marginTop: '8px' }}>
          or <a href={noVncUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#ff0033' }}>open YouTube login</a> to authenticate via browser
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create StepQuality component**

```tsx
// frontend/src/components/StepQuality.tsx
const QUALITIES = ['360', '480', '720', '1080', '2160'];
const LABELS: Record<string, string> = { '360': '360p', '480': '480p', '720': '720p', '1080': '1080p', '2160': '4K' };

interface StepQualityProps {
  quality: string;
  onQualityChange: (q: string) => void;
}

export function StepQuality({ quality, onQualityChange }: StepQualityProps) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '24px' }}>
      <h3 style={{ color: '#fff', fontSize: '18px', marginBottom: '4px' }}>Max Quality</h3>
      <p style={{ color: '#666', fontSize: '13px', marginBottom: '16px' }}>iOS devices work best with 1080p or below (h264 codec)</p>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {QUALITIES.map((q) => (
          <button key={q} onClick={() => onQualityChange(q)} aria-pressed={quality === q}
            style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: quality === q ? 600 : 400,
              background: quality === q ? '#ff0033' : 'rgba(255,255,255,0.06)',
              color: quality === q ? 'white' : '#888',
            }}>
            {LABELS[q]}
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create StepFeatures component**

```tsx
// frontend/src/components/StepFeatures.tsx
const SB_CATEGORIES = ['sponsor', 'selfpromo', 'interaction', 'intro', 'outro'];

interface StepFeaturesProps {
  sponsorblockEnabled: boolean;
  onSponsorblockToggle: (enabled: boolean) => void;
  sponsorblockCategories: string[];
  onCategoriesChange: (cats: string[]) => void;
  dearrowEnabled: boolean;
  onDearrowToggle: (enabled: boolean) => void;
}

export function StepFeatures(props: StepFeaturesProps) {
  const toggleCategory = (cat: string) => {
    const cats = props.sponsorblockCategories.includes(cat)
      ? props.sponsorblockCategories.filter((c) => c !== cat)
      : [...props.sponsorblockCategories, cat];
    props.onCategoriesChange(cats);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 style={{ color: '#fff', fontSize: '16px' }}>SponsorBlock</h3>
          <input type="checkbox" checked={props.sponsorblockEnabled} onChange={(e) => props.onSponsorblockToggle(e.target.checked)} />
        </div>
        {props.sponsorblockEnabled && (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {SB_CATEGORIES.map((cat) => (
              <label key={cat} style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#ccc', fontSize: '13px' }}>
                <input type="checkbox" checked={props.sponsorblockCategories.includes(cat)} onChange={() => toggleCategory(cat)} />
                {cat}
              </label>
            ))}
          </div>
        )}
      </div>
      <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ color: '#fff', fontSize: '16px' }}>DeArrow</h3>
          <input type="checkbox" checked={props.dearrowEnabled} onChange={(e) => props.onDearrowToggle(e.target.checked)} />
        </div>
        <p style={{ color: '#666', fontSize: '12px', marginTop: '4px' }}>Replace titles and thumbnails with community-submitted alternatives</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Create StepInstall component**

```tsx
// frontend/src/components/StepInstall.tsx
import { useState } from 'react';

interface StepInstallProps {
  addonUrl: string | null;
  loading: boolean;
}

export function StepInstall({ addonUrl, loading }: StepInstallProps) {
  const [copied, setCopied] = useState(false);

  const copyUrl = async () => {
    if (!addonUrl) return;
    await navigator.clipboard.writeText(addonUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) return <p style={{ color: '#888', textAlign: 'center' }}>Generating addon URL...</p>;
  if (!addonUrl) return <p style={{ color: '#f44', textAlign: 'center' }}>Failed to generate URL</p>;

  const stremioUrl = addonUrl.replace(/^https?:/, 'stremio:');

  return (
    <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '24px' }}>
      <h3 style={{ color: '#fff', fontSize: '18px', marginBottom: '16px' }}>Your Addon URL</h3>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <input readOnly value={addonUrl} style={{ flex: 1, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '10px', color: '#ccc', fontSize: '12px', fontFamily: 'monospace' }} />
        <button onClick={copyUrl} style={{ padding: '10px 16px', background: 'rgba(255,255,255,0.06)', color: '#888', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px' }}>
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <a href={stremioUrl} style={{ display: 'block', background: '#ff0033', color: 'white', padding: '14px', borderRadius: '8px', textAlign: 'center', textDecoration: 'none', fontSize: '16px', fontWeight: 600 }}>
        Install in Stremio
      </a>
    </div>
  );
}
```

- [ ] **Step 6: Wire Configure page**

```tsx
// frontend/src/pages/Configure.tsx
import { useState } from 'react';
import { Stepper } from '../components/Stepper';
import { StepAuth } from '../components/StepAuth';
import { StepQuality } from '../components/StepQuality';
import { StepFeatures } from '../components/StepFeatures';
import { StepInstall } from '../components/StepInstall';

const basePath = (window as any).__BASE_PATH__ ?? '';

export function Configure() {
  const [step, setStep] = useState(0);
  const [cookies, setCookies] = useState('');
  const [quality, setQuality] = useState('1080');
  const [sbEnabled, setSbEnabled] = useState(false);
  const [sbCategories, setSbCategories] = useState(['sponsor', 'selfpromo', 'interaction', 'intro', 'outro']);
  const [daEnabled, setDaEnabled] = useState(false);
  const [addonUrl, setAddonUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const generateUrl = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${basePath}/api/encrypt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cookies, quality, sponsorblock: { enabled: sbEnabled, categories: sbCategories }, dearrow: { enabled: daEnabled } }),
      });
      const data = await res.json();
      setAddonUrl(data.url);
    } catch {
      setAddonUrl(null);
    } finally {
      setLoading(false);
    }
  };

  const handleNext = () => {
    if (step === 2) { generateUrl(); }
    setStep((s) => Math.min(s + 1, 3));
  };

  const steps = [
    { label: 'Auth', content: <StepAuth cookies={cookies} onCookiesChange={setCookies} /> },
    { label: 'Quality', content: <StepQuality quality={quality} onQualityChange={setQuality} /> },
    { label: 'Features', content: <StepFeatures sponsorblockEnabled={sbEnabled} onSponsorblockToggle={setSbEnabled} sponsorblockCategories={sbCategories} onCategoriesChange={setSbCategories} dearrowEnabled={daEnabled} onDearrowToggle={setDaEnabled} /> },
    { label: 'Install', content: <StepInstall addonUrl={addonUrl} loading={loading} /> },
  ];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center' }}>
      <Stepper steps={steps} activeStep={step} onNext={handleNext} onBack={() => setStep((s) => Math.max(s - 1, 0))} onSkip={() => setStep((s) => Math.min(s + 1, 3))} showSkip={step === 0} nextLabel={step === 3 ? undefined : 'Next'} />
    </div>
  );
}
```

- [ ] **Step 7: Verify it builds**

Run: `cd frontend && npx vite build && cd ..`
Expected: Build succeeds

- [ ] **Step 8: Commit**

```bash
git add frontend/
git commit -m "feat: add stepper wizard configuration page"
```

---

### Task 26: Static File Serving from Fastify

**Files:**
- Modify: `src/app.ts`

Note: `@fastify/static` was already installed in Task 20.

- [ ] **Step 1: Add static file serving to app.ts**

Add the following to the end of `buildApp()` in `src/app.ts`, before `return app`:

```typescript
// Serve React SPA static files
import fastifyStatic from '@fastify/static';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const frontendDir = resolve(import.meta.dirname ?? __dirname, '../frontend');
if (existsSync(frontendDir)) {
  await app.register(fastifyStatic, {
    root: frontendDir,
    prefix: `${env.basePath}/`,
    decorateReply: false,
  });

  // SPA catch-all: serve index.html with BASE_PATH injected
  const indexPath = join(frontendDir, 'index.html');
  let indexHtml: string | null = null;

  const serveIndex = async (_request: any, reply: any) => {
    if (!indexHtml && existsSync(indexPath)) {
      const raw = await readFile(indexPath, 'utf-8');
      // Inject BASE_PATH before closing </head>
      indexHtml = raw.replace('</head>', `<script>window.__BASE_PATH__="${env.basePath}";</script></head>`);
    }
    if (indexHtml) {
      reply.type('text/html').send(indexHtml);
    } else {
      reply.status(404).send('Frontend not built');
    }
  };

  app.get(`${env.basePath}/`, serveIndex);
  app.get(`${env.basePath}/configure`, serveIndex);
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/app.ts
git commit -m "feat: serve React SPA as static files with BASE_PATH injection"
```

---

### Task 27: Frontend Build Integration

**Files:**
- Modify: `package.json` (root)

- [ ] **Step 1: Add build script to root package.json**

Add `"build:frontend": "cd frontend && npm run build"` and update `"build"` to `"tsc && npm run build:frontend"`.

- [ ] **Step 2: Verify full build**

Run: `npm run build`
Expected: TypeScript compiles to `dist/`, frontend builds to `dist/frontend/`

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "chore: add frontend build integration to root package.json"
```

---

## Chunk 7: Docker, E2E Tests & Visual Assets (Tasks 28-32)

### Task 28: Docker Setup

**Files:**
- Create: `docker/Dockerfile`
- Create: `docker/docker-compose.yml`
- Create: `docker/supervisord.conf`
- Create: `docker/start-vnc.sh`
- Create: `.dockerignore`

- [ ] **Step 1: Create Dockerfile (two-stage)**

Stage 1: Build TypeScript + React SPA.
Stage 2: node:20-slim + system deps + compiled output.

- [ ] **Step 2: Create docker-compose.yml**

Ports 8000, 6080. Volume for `/data`. shm_size 256mb.

- [ ] **Step 3: Create supervisord.conf**

5 processes: Xvfb, Chromium, x11vnc, websockify, Node.

- [ ] **Step 4: Create start-vnc.sh**

VNC password setup script.

- [ ] **Step 5: Create .dockerignore**

Exclude node_modules, dist, .git, test, frontend/node_modules.

- [ ] **Step 6: Commit**

```bash
git add docker/ .dockerignore
git commit -m "feat: add Docker setup with two-stage build and supervisord"
```

---

### Task 29: CI/CD Workflow

**Files:**
- Create: `.github/workflows/docker-publish.yml`

- [ ] **Step 1: Create GitHub Actions workflow**

Build and push to Docker Hub on tag pushes and branch pushes.

- [ ] **Step 2: Commit**

```bash
git add .github/
git commit -m "ci: add Docker Hub publish workflow"
```

---

### Task 30: Visual Assets

**Files:**
- Create: `frontend/public/favicon.svg`

**Use @canvas-design skill for original logo and favicon.**

- [ ] **Step 1: Create favicon**

SVG favicon: red rounded square with play icon.

- [ ] **Step 2: Commit**

```bash
git add frontend/public/
git commit -m "feat: add favicon and branding assets"
```

---

### Task 31: Playwright E2E Setup

**Files:**
- Create: `test/e2e/playwright.config.ts`
- Create: `test/e2e/landing.spec.ts`

- [ ] **Step 1: Install Playwright**

Run: `npm install -D @playwright/test && npx playwright install chromium`

- [ ] **Step 2: Create Playwright config**

```typescript
// test/e2e/playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  use: {
    baseURL: 'http://localhost:8000',
  },
  webServer: {
    command: 'npm start',
    port: 8000,
    reuseExistingServer: true,
  },
});
```

- [ ] **Step 3: Write landing page E2E test**

```typescript
// test/e2e/landing.spec.ts
import { test, expect } from '@playwright/test';

test('landing page loads with logo and CTAs', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1')).toContainText('Tubio');
  await expect(page.locator('button:has-text("Configure")')).toBeVisible();
  await expect(page.locator('a:has-text("Install")')).toBeVisible();
});

test('Configure button navigates to stepper', async ({ page }) => {
  await page.goto('/');
  await page.click('button:has-text("Configure")');
  await expect(page).toHaveURL(/\/configure/);
});
```

- [ ] **Step 4: Commit**

```bash
git add test/e2e/
git commit -m "test: add Playwright E2E tests for landing page"
```

---

### Task 32: Stepper Wizard E2E Tests

**Files:**
- Create: `test/e2e/configure.spec.ts`

- [ ] **Step 1: Write stepper E2E tests**

```typescript
// test/e2e/configure.spec.ts
import { test, expect } from '@playwright/test';

test('stepper wizard navigates through all steps', async ({ page }) => {
  await page.goto('/configure');

  // Step 1: Auth — skip
  await expect(page.locator('text=Authentication')).toBeVisible();
  await page.click('button:has-text("Skip")');

  // Step 2: Quality
  await expect(page.locator('text=Quality')).toBeVisible();
  await page.click('button:has-text("1080p")');
  await page.click('button:has-text("Next")');

  // Step 3: Features
  await expect(page.locator('text=Features')).toBeVisible();
  await page.click('button:has-text("Next")');

  // Step 4: Install
  await expect(page.locator('text=Install')).toBeVisible();
  await expect(page.locator('button:has-text("Install in Stremio")')).toBeVisible();
});

test('back navigation preserves state', async ({ page }) => {
  await page.goto('/configure');
  await page.click('button:has-text("Skip")'); // past auth
  await page.click('button:has-text("720p")');
  await page.click('button:has-text("Next")'); // past quality
  await page.click('button:has-text("Back")'); // back to quality
  // 720p should still be selected
  await expect(page.locator('button:has-text("720p")')).toHaveAttribute('aria-pressed', 'true');
});

test('responsive: stepper works on mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/configure');
  await expect(page.locator('text=Authentication')).toBeVisible();
});
```

- [ ] **Step 2: Commit**

```bash
git add test/e2e/configure.spec.ts
git commit -m "test: add Playwright E2E tests for stepper wizard"
```
