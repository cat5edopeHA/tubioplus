import crypto from 'crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const KEY_FILE = join(__dirname, '..', '.encryption-key');

/**
 * Get or generate the encryption key.
 * Priority: ENCRYPTION_KEY env var > .encryption-key file > generate new key
 * This ensures each deployment has a unique key, and it persists across restarts.
 */
function loadEncryptionKey() {
  // 1. Check env var
  if (process.env.ENCRYPTION_KEY) {
    const key = process.env.ENCRYPTION_KEY;
    if (key.length !== 64 || !/^[0-9a-fA-F]+$/.test(key)) {
      console.error('[config] ENCRYPTION_KEY must be 64 hex characters (32 bytes). Exiting.');
      process.exit(1);
    }
    return Buffer.from(key, 'hex');
  }

  // 2. Check key file
  if (existsSync(KEY_FILE)) {
    const key = readFileSync(KEY_FILE, 'utf8').trim();
    if (key.length === 64 && /^[0-9a-fA-F]+$/.test(key)) {
      return Buffer.from(key, 'hex');
    }
    console.warn('[config] .encryption-key file is invalid, generating a new one.');
  }

  // 3. Generate and save a new key
  const newKey = crypto.randomBytes(32);
  try {
    writeFileSync(KEY_FILE, newKey.toString('hex'), { mode: 0o600 });
    console.log('[config] Generated new encryption key and saved to .encryption-key');
    console.log('[config] IMPORTANT: Back up this file! If lost, all existing user configs become invalid.');
  } catch (err) {
    console.error('[config] Could not write .encryption-key file:', err.message);
    console.error('[config] Set ENCRYPTION_KEY env var instead. Exiting.');
    process.exit(1);
  }

  return newKey;
}

const keyBuffer = loadEncryptionKey();

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
