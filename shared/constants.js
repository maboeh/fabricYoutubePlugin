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
  AUTO_COPY_URL: 'fabricAutoCopyUrl'
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
  OAUTH2: 'oauth2',    // OAuth2 flow
  COOKIE: 'cookie'     // Cookie-based (fallback)
};

// YouTube URL patterns
export const YOUTUBE_PATTERNS = {
  WATCH: 'youtube.com/watch',
  SHORT_URL: 'youtu.be/',
  SHORTS: 'youtube.com/shorts/'
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
