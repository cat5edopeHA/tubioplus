import { describe, it, expect, afterEach } from 'vitest';
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
  afterEach(async () => { if (existsSync(keyFile)) await unlink(keyFile); });

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
