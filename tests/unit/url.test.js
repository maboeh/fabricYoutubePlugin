import { describe, it, expect, vi } from 'vitest';

vi.mock('../../src/shared/browser-api.js', () => ({
  api: {
    storage: { local: { get: vi.fn(), set: vi.fn(), remove: vi.fn() } },
    runtime: { lastError: null }
  }
}));

import { DEFAULT_CONFIG } from '../../src/shared/constants.js';
import { normalizeApiBaseUrl, normalizeEndpoint } from '../../src/shared/url.js';

describe('normalizeApiBaseUrl', () => {
  it('falls back to default for empty input', () => {
    expect(normalizeApiBaseUrl('')).toEqual({ ok: true, value: DEFAULT_CONFIG.apiUrl });
    expect(normalizeApiBaseUrl('   ')).toEqual({ ok: true, value: DEFAULT_CONFIG.apiUrl });
    expect(normalizeApiBaseUrl(null)).toEqual({ ok: true, value: DEFAULT_CONFIG.apiUrl });
  });

  it('rejects http and invalid URLs', () => {
    expect(normalizeApiBaseUrl('http://api.fabric.so').ok).toBe(false);
    expect(normalizeApiBaseUrl('not-a-url').ok).toBe(false);
  });

  it('strips trailing slash and accepts https', () => {
    expect(normalizeApiBaseUrl('https://api.fabric.so/')).toEqual({
      ok: true,
      value: 'https://api.fabric.so'
    });
    expect(normalizeApiBaseUrl('https://api.fabric.so/v2/')).toEqual({
      ok: true,
      value: 'https://api.fabric.so/v2'
    });
  });
});

describe('normalizeEndpoint', () => {
  it('uses default for empty input', () => {
    expect(normalizeEndpoint('')).toBe(DEFAULT_CONFIG.endpoint);
  });

  it('prefixes leading slash when missing', () => {
    expect(normalizeEndpoint('v2/bookmarks')).toBe('/v2/bookmarks');
  });

  it('keeps a valid path', () => {
    expect(normalizeEndpoint('/v2/bookmarks')).toBe('/v2/bookmarks');
  });
});
