export interface AppConfig {
  cookies: string;
  quality: string;
  sponsorblock: { enabled: boolean; categories: string[] };
  dearrow: { enabled: boolean };
}

export const DEFAULT_CONFIG: AppConfig = {
  cookies: '',
  quality: '1080',
  sponsorblock: { enabled: false, categories: ['sponsor', 'selfpromo', 'interaction', 'intro', 'outro'] },
  dearrow: { enabled: false },
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
    dearrow: { enabled: (da?.enabled as boolean) ?? DEFAULT_CONFIG.dearrow.enabled },
  };
}
