import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';

export interface AuthStatus {
  authenticated: boolean;
  cookieCount: number;
  hasRequiredCookies: boolean;
  missingCookies: string[];
  checkedAt: number;
}

// Critical Google auth cookies that indicate a valid login session
const REQUIRED_COOKIE_SETS = [
  // At least one from each group must be present
  { domain: '.google.com', names: ['SID', 'HSID', 'SSID'] },
  { domain: '.youtube.com', names: ['__Secure-1PSID', '__Secure-3PSID'] },
];

const COOKIE_DB_PATH = '/data/chromium-profile/Default/Cookies';

// Cache auth status to avoid querying SQLite on every request
let authCache: AuthStatus | null = null;
const AUTH_CACHE_TTL = 60000; // 60 seconds

export async function checkAuthCookies(): Promise<AuthStatus> {
  const now = Date.now();
  if (authCache && now - authCache.checkedAt < AUTH_CACHE_TTL) {
    return authCache;
  }

  if (!existsSync(COOKIE_DB_PATH)) {
    const status: AuthStatus = {
      authenticated: false,
      cookieCount: 0,
      hasRequiredCookies: false,
      missingCookies: REQUIRED_COOKIE_SETS.flatMap((s) => s.names),
      checkedAt: now,
    };
    authCache = status;
    return status;
  }

  try {
    // Use sqlite3 CLI to query the cookie DB (available in the Docker image)
    // This avoids needing a Node.js sqlite binding dependency
    const result = await runSqlite3(
      COOKIE_DB_PATH,
      'SELECT host_key, name FROM cookies WHERE (host_key LIKE "%.google.com" OR host_key LIKE "%.youtube.com") ORDER BY host_key, name;',
    );

    const cookies = result
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const [host_key, name] = line.split('|');
        return { host_key, name };
      });

    const cookieNames = new Set(cookies.map((c) => c.name));
    const missingCookies: string[] = [];
    let allGroupsSatisfied = true;

    for (const group of REQUIRED_COOKIE_SETS) {
      const hasAny = group.names.some((name) => cookieNames.has(name));
      if (!hasAny) {
        allGroupsSatisfied = false;
        missingCookies.push(...group.names);
      }
    }

    const status: AuthStatus = {
      authenticated: allGroupsSatisfied,
      cookieCount: cookies.length,
      hasRequiredCookies: allGroupsSatisfied,
      missingCookies,
      checkedAt: now,
    };
    authCache = status;
    return status;
  } catch {
    const status: AuthStatus = {
      authenticated: false,
      cookieCount: 0,
      hasRequiredCookies: false,
      missingCookies: ['(check failed)'],
      checkedAt: now,
    };
    authCache = status;
    return status;
  }
}

export function clearAuthCache(): void {
  authCache = null;
}

function runSqlite3(dbPath: string, query: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn('sqlite3', ['-separator', '|', dbPath, query], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
    proc.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });
    proc.on('close', (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(`sqlite3 exited with code ${code}: ${stderr}`));
    });
    proc.on('error', (err) => reject(err));
  });
}
