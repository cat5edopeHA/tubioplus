import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

// Ensure key is proper length (32 bytes for AES-256)
const keyBuffer = Buffer.from(ENCRYPTION_KEY.slice(0, 64), 'hex');

export const DEFAULT_CONFIG = {
  cookies: '',
  quality: '1080',
  sponsorblock: {
    enabled: false,
    categories: ['sponsor', 'selfpromo', 'interaction', 'intro', 'outro']
  },
  dearrow: {
    enabled: false
  }
};

/**
 * Encrypt config object to base64url string
 */
export function encryptConfig(config) {
  try {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', keyBuffer, iv);

    const jsonStr = JSON.stringify(config);
    let encrypted = cipher.update(jsonStr, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const combined = iv.toString('hex') + ':' + encrypted;
    return Buffer.from(combined).toString('base64url');
  } catch (err) {
    console.error('Encryption error:', err);
    return '';
  }
}

/**
 * Decrypt base64url string to config object
 */
export function decryptConfig(encryptedStr) {
  try {
    const combined = Buffer.from(encryptedStr, 'base64url').toString('utf8');
    const [ivHex, encryptedHex] = combined.split(':');

    if (!ivHex || !encryptedHex) {
      return DEFAULT_CONFIG;
    }

    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', keyBuffer, iv);

    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    const config = JSON.parse(decrypted);
    return { ...DEFAULT_CONFIG, ...config };
  } catch (err) {
    console.error('Decryption error:', err);
    return DEFAULT_CONFIG;
  }
}

/**
 * Merge user config with defaults
 */
export function mergeConfig(userConfig) {
  return {
    ...DEFAULT_CONFIG,
    ...userConfig,
    sponsorblock: {
      ...DEFAULT_CONFIG.sponsorblock,
      ...(userConfig?.sponsorblock || {})
    },
    dearrow: {
      ...DEFAULT_CONFIG.dearrow,
      ...(userConfig?.dearrow || {})
    }
  };
}
