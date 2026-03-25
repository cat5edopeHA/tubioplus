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
