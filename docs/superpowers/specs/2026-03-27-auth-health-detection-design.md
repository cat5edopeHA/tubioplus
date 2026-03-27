# Auth Health Detection + Source Regression Fix

**Date:** 2026-03-27
**Status:** Approved
**Problem:** Google auth cookies expire silently, all authenticated catalogs return empty results with no user-visible signal. Additionally, git source is missing all fixes from Resolved Issues #4-#17.

## Root Cause

Google periodically invalidates sessions for headless/automated browsers. When this happens, the critical auth cookies (SID, HSID, SSID, APISID, SAPISID, __Secure-1PSID) are removed from Chromium's cookie DB. The addon has no mechanism to detect this — it passes the (now useless) cookies to yt-dlp, which returns 0 entries, which get swallowed by the catch-all error handler, and Stremio receives `{"metas":[]}`.

## Design

### 1. Cookie DB Auth Check (`src/domains/config/auth-check.ts`)

A function `checkAuthCookies()` that opens the Chromium cookie SQLite DB and checks for the presence of critical Google auth cookies. Returns an `AuthStatus` object:

```typescript
interface AuthStatus {
  authenticated: boolean;
  cookieCount: number;
  hasRequiredCookies: boolean;
  missingCookies: string[];
  checkedAt: number;
}
```

Required cookies to check (on `.google.com` or `.youtube.com` domains):
- `SID`, `HSID`, `SSID` (on `.google.com`)
- `__Secure-1PSID` or `__Secure-3PSID` (on `.youtube.com`)

If at least `SID` + one `__Secure-*PSID` cookie exist, auth is considered valid. The check uses `better-sqlite3` (synchronous, no connection pool needed) for a single read query — faster and simpler than async sqlite3.

Cache the result for 60 seconds to avoid hammering the DB on every catalog request.

### 2. Health Endpoint Enhancement

`GET /health` response gains an `auth` field:

```json
{
  "status": "ok",
  "ytdlp": true,
  "ffmpeg": true,
  "auth": {
    "authenticated": false,
    "cookieCount": 17,
    "hasRequiredCookies": false,
    "missingCookies": ["SID", "HSID", "SSID", "__Secure-1PSID"]
  }
}
```

### 3. Catalog Auth Signaling

When auth check fails AND the catalog requires authentication (recommendations, subscriptions, history, watchlater), inject an informational meta entry instead of returning empty:

```json
{
  "metas": [{
    "id": "yt:auth-required",
    "type": "YouTube",
    "name": "Login Required",
    "description": "Google login has expired. Open the noVNC panel to sign in again.",
    "poster": "<a simple placeholder image URL or inline SVG data URI>"
  }]
}
```

This makes the problem visible directly in Stremio's UI.

### 4. Source Code Regression Fix

Sync all TypeScript source files to match the deployed container code. The following fixes are missing from git:

- **ytdlp.ts:** `--cookies-from-browser chromium:/data/chromium-profile` (not bare `chromium`), `--js-runtimes node` in BASE_ARGS, `clearCaches()` method
- **app.ts:** Recommendations using `getPlaylist('https://www.youtube.com')` not `search('')`, play route passing cookies, `request.host` not `request.hostname`, FFmpeg reconnect flags, `Accept-Ranges: none`, `-c:a aac -b:a 192k`, `notWebReady: true` in streams, `shouldUseBrowserCookies()` dynamic function, reset endpoint cache clearing, trustProxy, empty result cache prevention
- **server.ts:** Chromium readiness gate
- **encryption.ts:** Default key path `/data/.encryption-key`

### 5. Non-Goals

- Automatic re-login (Google's anti-automation makes this fragile)
- Push notifications (requires external infra)
- Cookie refresh/renewal (cookies are managed by Chromium, not the addon)

## Testing

- Unit test for `checkAuthCookies()` with mock SQLite DB (cookies present vs absent)
- Unit test for catalog handler returning auth-required meta when auth check fails
- Integration test for `/health` endpoint including auth field
