import { describe, it, expect } from 'vitest';
import {
  VideoNotFoundError, ExtractionError, EncryptionError,
  RateLimitError, ExternalServiceError, DependencyError,
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
