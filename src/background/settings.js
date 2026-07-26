// Settings cache and storage helpers for the service worker
import {
  STORAGE_KEYS,
  DEFAULT_CONFIG,
  TIMEOUTS,
  getStorage,
  removeStorage
} from '../shared/constants.js';
import { api } from '../shared/browser-api.js';

let _settingsCache = null;
let _settingsCacheTime = 0;
const SETTINGS_CACHE_TTL = TIMEOUTS.SETTINGS_CACHE_TTL_MS;

/** Invalidate settings cache when any local storage key changes. */
export function registerSettingsCacheInvalidation() {
  api.storage.onChanged.addListener((_changes, namespace) => {
    if (namespace === 'local') {
      _settingsCache = null;
    }
  });
}

export async function getStoredSettings() {
  const now = Date.now();
  if (_settingsCache && (now - _settingsCacheTime) < SETTINGS_CACHE_TTL) {
    return _settingsCache;
  }
  const result = await getStorage([
    STORAGE_KEYS.SHOW_NOTIFICATIONS,
    STORAGE_KEYS.AUTO_COPY_URL
  ]);
  _settingsCache = {
    showNotifications: result[STORAGE_KEYS.SHOW_NOTIFICATIONS] !== false,
    autoCopyUrl: result[STORAGE_KEYS.AUTO_COPY_URL] === true
  };
  _settingsCacheTime = now;
  return _settingsCache;
}

export async function getStoredConfig() {
  const result = await getStorage([
    STORAGE_KEYS.API_BASE_URL,
    STORAGE_KEYS.API_ENDPOINT,
    STORAGE_KEYS.AUTH_TYPE,
    STORAGE_KEYS.DEFAULT_PARENT_ID
  ]);
  return {
    apiUrl: result[STORAGE_KEYS.API_BASE_URL] || DEFAULT_CONFIG.apiUrl,
    endpoint: result[STORAGE_KEYS.API_ENDPOINT] || DEFAULT_CONFIG.endpoint,
    authType: result[STORAGE_KEYS.AUTH_TYPE] || DEFAULT_CONFIG.authType,
    parentId: result[STORAGE_KEYS.DEFAULT_PARENT_ID] || DEFAULT_CONFIG.defaultParentId
  };
}

export async function clearCredentials() {
  await removeStorage([STORAGE_KEYS.API_KEY]);
}
