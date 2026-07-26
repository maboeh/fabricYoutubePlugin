// Fabric API: request body, fetch, retry, save, validate
import {
  DEFAULT_CONFIG,
  TIMEOUTS,
  sanitizeText
} from '../shared/constants.js';
import { clearCredentials, getStoredConfig } from './settings.js';

const RETRY_CONFIG = {
  maxRetries: TIMEOUTS.MAX_RETRIES,
  delayMs: TIMEOUTS.RETRY_DELAY_MS,
  backoffMultiplier: TIMEOUTS.RETRY_BACKOFF,
  rateLimitDelayMs: TIMEOUTS.RATE_LIMIT_DELAY_MS,
  fetchTimeoutMs: TIMEOUTS.FETCH_MS
};

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function appendCustomTags(tags, customTags) {
  if (!Array.isArray(customTags)) {
    return;
  }
  for (const tagName of customTags) {
    if (typeof tagName !== 'string') continue;
    const trimmed = tagName.trim();
    if (!trimmed) continue;
    const exists = tags.some(t => t.name.toLowerCase() === trimmed.toLowerCase());
    if (exists) continue;
    tags.push({ name: sanitizeText(trimmed, 100) });
  }
}

function buildTags(videoInfo) {
  const channel = sanitizeText(videoInfo.channel, 200);
  const tags = [{ name: 'YouTube' }];
  if (channel && channel !== 'YouTube') {
    tags.push({ name: channel });
  }
  appendCustomTags(tags, videoInfo.customTags);
  return tags;
}

function buildComment(videoInfo) {
  const channel = sanitizeText(videoInfo.channel, 200);
  const description = sanitizeText(videoInfo.description, 2000);
  const commentParts = [];
  if (channel) commentParts.push(`Channel: ${channel}`);
  if (videoInfo.duration) commentParts.push(`Dauer: ${videoInfo.duration}`);
  if (description) commentParts.push(`\n${description}`);
  if (videoInfo.customNote) {
    commentParts.push(`\n${sanitizeText(videoInfo.customNote, 1000)}`);
  }
  if (commentParts.length === 0) {
    return null;
  }
  return { content: commentParts.join('\n') };
}

export function buildRequestBody(videoInfo, config) {
  const title = sanitizeText(videoInfo.title, 500);
  // TODO: Duplikat-Erkennung — Fabric API v2 hat keinen "search by URL" Endpoint.
  const requestBody = {
    url: videoInfo.url,
    parentId: config.parentId,
    name: title || null,
    tags: buildTags(videoInfo)
  };

  const comment = buildComment(videoInfo);
  if (comment) {
    requestBody.comment = comment;
  }

  return requestBody;
}

export function buildAuthHeaders(apiKey, authType, { includeContentType = true } = {}) {
  const headers = {};
  if (includeContentType) {
    headers['Content-Type'] = 'application/json';
  }
  if (authType === 'apikey') {
    headers['X-Api-Key'] = apiKey;
  } else if (authType === 'oauth2') {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }
  return headers;
}

async function postBookmark(requestBody, apiKey, config) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), RETRY_CONFIG.fetchTimeoutMs);

  try {
    const response = await fetch(`${config.apiUrl}${config.endpoint}`, {
      method: 'POST',
      headers: buildAuthHeaders(apiKey, config.authType),
      credentials: 'omit',
      body: JSON.stringify(requestBody),
      signal: controller.signal
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

function parseClientError(status, errorText) {
  let errorDetail = `API Fehler ${status}`;
  try {
    const errorBody = JSON.parse(errorText);
    const apiMessage = errorBody.message || errorBody.error;
    if (apiMessage) {
      errorDetail = String(apiMessage).substring(0, 200);
    }
  } catch (_) {
    if (errorText) {
      errorDetail = errorText.substring(0, 200);
    }
  }
  return { success: false, error: errorDetail };
}

function getRateLimitDelay(response, remainingMs) {
  const retryAfter = response.headers.get('Retry-After');
  let delay = RETRY_CONFIG.rateLimitDelayMs;
  if (retryAfter) {
    const seconds = parseInt(retryAfter, 10);
    if (!isNaN(seconds) && seconds > 0 && seconds <= 300) {
      delay = seconds * 1000;
    }
  }
  if (typeof remainingMs === 'number' && remainingMs >= 0) {
    delay = Math.min(delay, remainingMs);
  }
  return delay;
}

function defaultBackoffDelay(attempt) {
  return RETRY_CONFIG.delayMs * Math.pow(RETRY_CONFIG.backoffMultiplier, attempt);
}

function exhaustedOrDefault(result, attempt, reason) {
  if (result.exhausted) {
    return result.exhausted;
  }
  const message = reason === 'budget'
    ? `Zeitbudget überschritten nach ${attempt + 1} Versuchen`
    : `Fehlgeschlagen nach ${attempt + 1} Versuchen`;
  return { success: false, error: message };
}

/**
 * Retry wrapper: calls fn(attempt); if it returns { retry: true, delay },
 * waits and retries until maxRetries or the absolute deadline is reached.
 */
async function withRetry(fn, deadline = Infinity) {
  for (let attempt = 0; ; attempt++) {
    const result = await fn(attempt);
    if (!result?.retry) {
      return result;
    }

    const delay = result.delay ?? defaultBackoffDelay(attempt);
    const overMax = attempt >= RETRY_CONFIG.maxRetries;
    const overBudget = Date.now() + delay + RETRY_CONFIG.fetchTimeoutMs >= deadline;
    if (overMax || overBudget) {
      return exhaustedOrDefault(result, attempt, overMax ? 'max' : 'budget');
    }

    await sleep(delay);
  }
}

async function mapSaveResponse(response, retryCount, deadline) {
  if (response.ok) {
    const data = await response.json();
    const bookmarkId = data.id;
    return {
      success: true,
      bookmarkId,
      bookmarkUrl: bookmarkId ? `${DEFAULT_CONFIG.baseUrl}/resources/${bookmarkId}` : null
    };
  }

  const errorText = await response.text();
  console.error('API response error:', response.status, errorText);

  // Only clear credentials on 401 (unauthorized).
  // 403 can be a transient permission issue (e.g. wrong parent folder).
  if (response.status === 401) {
    await clearCredentials();
    return {
      success: false,
      error: 'API Key ungültig oder abgelaufen',
      authExpired: true
    };
  }
  if (response.status === 403) {
    return {
      success: false,
      error: 'Zugriff verweigert (403). Bitte API Key und Ziel-Ordner prüfen.'
    };
  }

  if (response.status === 429) {
    const remainingMs = Math.max(0, deadline - Date.now() - RETRY_CONFIG.fetchTimeoutMs);
    const delay = getRateLimitDelay(response, remainingMs);
    return {
      retry: true,
      delay,
      exhausted: { success: false, error: 'Zu viele Anfragen - bitte später erneut versuchen' }
    };
  }

  if (response.status >= 400 && response.status < 500) {
    return parseClientError(response.status, errorText);
  }

  return {
    retry: true,
    delay: RETRY_CONFIG.delayMs * Math.pow(RETRY_CONFIG.backoffMultiplier, retryCount),
    exhausted: {
      success: false,
      error: `API Fehler ${response.status} nach ${retryCount + 1} Versuchen`
    }
  };
}

export async function saveToFabric(videoInfo, apiKey, config = null) {
  if (!videoInfo || !videoInfo.url) {
    return { success: false, error: 'Keine Video-URL vorhanden' };
  }
  if (!config) config = await getStoredConfig();

  const requestBody = buildRequestBody(videoInfo, config);
  const deadline = Date.now() + TIMEOUTS.SAVE_BUDGET_MS;

  return withRetry(async (retryCount) => {
    try {
      const response = await postBookmark(requestBody, apiKey, config);
      return await mapSaveResponse(response, retryCount, deadline);
    } catch (error) {
      console.error('API error:', error);
      return {
        retry: true,
        delay: RETRY_CONFIG.delayMs * Math.pow(RETRY_CONFIG.backoffMultiplier, retryCount),
        exhausted: {
          success: false,
          error: `Netzwerkfehler nach ${retryCount + 1} Versuchen`
        }
      };
    }
  }, deadline);
}

function mapValidationStatus(status) {
  if (status >= 200 && status < 300) {
    return { valid: true };
  }
  if (status === 401 || status === 403) {
    return { valid: false, error: `Ungültiger API Key (${status})` };
  }
  if (status >= 500) {
    // Server error - save key anyway (known Fabric API issue)
    return {
      valid: true,
      warning: 'Fabric API antwortet mit Server-Fehler. Key wurde gespeichert - bei Problemen bitte erneut versuchen.'
    };
  }
  return { valid: false, error: `API Fehler: ${status}` };
}

/** Optional configOverride lets the options page test without persisting settings. */
export async function validateApiKey(apiKey, configOverride = null) {
  const stored = await getStoredConfig();
  const config = {
    apiUrl: configOverride?.apiUrl || stored.apiUrl,
    endpoint: configOverride?.endpoint || stored.endpoint,
    authType: configOverride?.authType || stored.authType,
    parentId: stored.parentId
  };
  const url = `${config.apiUrl}/v2/user/me`;

  try {
    const headers = buildAuthHeaders(apiKey, config.authType, { includeContentType: false });
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUTS.VALIDATE_API_KEY_MS);

    let response;
    try {
      response = await fetch(url, {
        method: 'GET',
        headers,
        credentials: 'omit',
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeoutId);
    }

    return mapValidationStatus(response.status);
  } catch (error) {
    console.error('API key validation failed:', error);
    return { valid: false, error: `Verbindung fehlgeschlagen: ${error.message}` };
  }
}
