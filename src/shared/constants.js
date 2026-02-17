// Shared constants for YouTube to Fabric Extension
// This file is imported by background.js and popup.js (ES modules)

// Storage keys - use these instead of magic strings
export const STORAGE_KEYS = {
  API_KEY: 'fabricApiKey',
  API_BASE_URL: 'fabricApiBaseUrl',
  API_ENDPOINT: 'fabricApiEndpoint',
  AUTH_TYPE: 'fabricAuthType',
  SHOW_FLOATING_BUTTON: 'fabricShowFloatingButton',
  SHOW_NOTIFICATIONS: 'fabricShowNotifications',
  AUTO_COPY_URL: 'fabricAutoCopyUrl',
  DEFAULT_PARENT_ID: 'fabricDefaultParentId'
};

// Default configuration (based on Fabric API v2)
export const DEFAULT_CONFIG = {
  baseUrl: 'https://fabric.so',
  apiUrl: 'https://api.fabric.so',
  endpoint: '/v2/bookmarks',
  authType: 'apikey',  // Uses X-Api-Key header
  defaultParentId: '@alias::inbox'  // Saves to Inbox by default
};

// API Auth types
export const AUTH_TYPES = {
  API_KEY: 'apikey',   // X-Api-Key header
  OAUTH2: 'oauth2'     // OAuth2 flow
};

// YouTube URL patterns
export const YOUTUBE_PATTERNS = {
  WATCH: 'youtube.com/watch',
  SHORT_URL: 'youtu.be/',
  SHORTS: 'youtube.com/shorts/',
  PLAYLIST: 'youtube.com/playlist'
};

// Check if URL is a YouTube video
export function isYouTubeVideoUrl(url) {
  if (!url) return false;
  return (
    url.includes(YOUTUBE_PATTERNS.WATCH) ||
    url.includes(YOUTUBE_PATTERNS.SHORT_URL) ||
    url.includes(YOUTUBE_PATTERNS.SHORTS)
  );
}

// Check if URL is a YouTube playlist page (not video in playlist)
export function isYouTubePlaylistUrl(url) {
  if (!url) return false;
  // Only match dedicated playlist pages, not videos within playlists
  return url.includes(YOUTUBE_PATTERNS.PLAYLIST) && !url.includes('/watch');
}

// Storage helper functions (Promise-based with error handling)
export async function getStorage(keys) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(keys, (result) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(result);
      }
    });
  });
}

export async function setStorage(obj) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set(obj, (result) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(result);
      }
    });
  });
}

export async function removeStorage(keys) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.remove(keys, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve();
      }
    });
  });
}

// Extract video ID from YouTube URL
export function extractVideoId(url) {
  if (!url) return null;

  const patterns = [
    /[?&]v=([^&]+)/,           // youtube.com/watch?v=ID
    /youtu\.be\/([^?&]+)/,      // youtu.be/ID
    /shorts\/([^?&]+)/          // youtube.com/shorts/ID
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

// Get thumbnail URL for video ID
export function getThumbnailUrl(videoId, quality = 'mqdefault') {
  if (!videoId) return null;
  return `https://img.youtube.com/vi/${videoId}/${quality}.jpg`;
}

// Sanitize text for API submission: strip control characters, trim
export function sanitizeText(text, maxLength = 0) {
  if (!text) return text;
  let clean = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '');
  clean = clean.trim();
  if (maxLength > 0 && clean.length > maxLength) {
    clean = clean.substring(0, maxLength);
  }
  return clean;
}
