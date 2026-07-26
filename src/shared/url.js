// Shared URL helpers for options page and unit tests
import { DEFAULT_CONFIG } from './constants.js';

/**
 * Normalize and validate the API base URL.
 * Requires https, strips trailing slash, rejects invalid URLs.
 * @param {string} raw
 * @returns {{ ok: true, value: string } | { ok: false, error: string }}
 */
export function normalizeApiBaseUrl(raw) {
  const trimmed = (raw || '').trim();
  if (!trimmed) {
    return { ok: true, value: DEFAULT_CONFIG.apiUrl };
  }
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, error: 'API Base URL ist ungültig' };
  }
  if (parsed.protocol !== 'https:') {
    return { ok: false, error: 'API Base URL muss https:// verwenden' };
  }
  // Strip trailing slash so endpoint join does not produce //
  const normalized = parsed.origin + parsed.pathname.replace(/\/+$/, '');
  return { ok: true, value: normalized || parsed.origin };
}

/**
 * Normalize endpoint path: must start with /, empty falls back to default.
 * @param {string} raw
 * @returns {string}
 */
export function normalizeEndpoint(raw) {
  let endpoint = (raw || '').trim() || DEFAULT_CONFIG.endpoint;
  if (!endpoint.startsWith('/')) {
    endpoint = '/' + endpoint;
  }
  return endpoint;
}
