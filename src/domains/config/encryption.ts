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

export async function loadEncryptionKey(envKey: string | undefined, keyFilePath: string = '.encryption-key'): Promise<Buffer> {
  if (envKey) return Buffer.from(envKey, 'hex');
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
