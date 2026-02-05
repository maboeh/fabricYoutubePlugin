// Background Service Worker for YouTube to Fabric Extension
import {
  STORAGE_KEYS,
  DEFAULT_CONFIG,
  isYouTubeVideoUrl,
  extractVideoId,
  getStorage,
  removeStorage
} from './shared/constants.js';

// Retry configuration
const RETRY_CONFIG = {
  maxRetries: 2,
  delayMs: 1000,
  backoffMultiplier: 2
};

// Listen for keyboard shortcut
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'save-to-fabric') {
    await handleSaveShortcut();
  }
});

// Handle the save shortcut
async function handleSaveShortcut() {
  try {
    // Get the active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab || !tab.url) {
      await showNotification('Fehler', 'Kein aktiver Tab gefunden');
      return;
    }

    // Check if it's a YouTube video
    if (!isYouTubeVideoUrl(tab.url)) {
      await showNotification('Kein YouTube Video', 'Bitte öffne ein YouTube Video');
      return;
    }

    // Get credentials
    const credentials = await getStoredCredentials();

    if (!credentials || !credentials.apiKey) {
      await showNotification('Nicht angemeldet', 'Bitte öffne das Plugin und melde dich an');
      return;
    }

    // Get video info from content script if possible
    let videoInfo;
    try {
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'getVideoInfo' });
      videoInfo = response.videoInfo;
    } catch (e) {
      // Fallback to basic info
      videoInfo = {
        url: tab.url,
        title: tab.title?.replace(' - YouTube', '') || 'YouTube Video',
        videoId: extractVideoId(tab.url),
        channel: 'YouTube'
      };
    }

    // Show saving notification
    await showNotification('Speichern...', 'Video wird in Fabric gespeichert');

    // Save to Fabric
    const result = await saveToFabric(videoInfo, credentials.apiKey);

    if (result.success) {
      await showNotification('Gespeichert!', `"${videoInfo.title}" wurde in Fabric gespeichert`);
    } else {
      // Show error notification (no fallback that opens Fabric)
      const errorMsg = result.error || 'Unbekannter Fehler';
      console.error('Save to Fabric failed:', errorMsg);
      await showNotification('Fehler', `Speichern fehlgeschlagen: ${errorMsg}`);
    }
  } catch (error) {
    console.error('Error in shortcut handler:', error);
    await showNotification('Fehler', 'Ein Fehler ist aufgetreten');
  }
}

// Get stored credentials
async function getStoredCredentials() {
  const result = await getStorage([STORAGE_KEYS.API_KEY]);
  return { apiKey: result[STORAGE_KEYS.API_KEY] };
}

// Get stored settings
async function getStoredSettings() {
  const result = await getStorage([
    STORAGE_KEYS.SHOW_NOTIFICATIONS,
    STORAGE_KEYS.AUTO_COPY_URL
  ]);
  return {
    showNotifications: result[STORAGE_KEYS.SHOW_NOTIFICATIONS] !== false,
    autoCopyUrl: result[STORAGE_KEYS.AUTO_COPY_URL] === true
  };
}

// Get stored API config
async function getStoredConfig() {
  const result = await getStorage([
    STORAGE_KEYS.API_BASE_URL,
    STORAGE_KEYS.API_ENDPOINT,
    STORAGE_KEYS.AUTH_TYPE
  ]);
  return {
    apiUrl: result[STORAGE_KEYS.API_BASE_URL] || DEFAULT_CONFIG.apiUrl,
    endpoint: result[STORAGE_KEYS.API_ENDPOINT] || DEFAULT_CONFIG.endpoint,
    authType: result[STORAGE_KEYS.AUTH_TYPE] || DEFAULT_CONFIG.authType
  };
}

// Clear credentials (on auth failure)
async function clearCredentials() {
  await removeStorage([STORAGE_KEYS.API_KEY]);
}

// Sleep helper for retry delays
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Copy text to clipboard via content script (Service Worker can't use navigator.clipboard)
async function copyToClipboard(text, tabId) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: async (textToCopy) => {
        try {
          await navigator.clipboard.writeText(textToCopy);
          return { success: true };
        } catch (e) {
          console.error('Clipboard write failed:', e);
          return { success: false, error: e.message };
        }
      },
      args: [text]
    });

    // Check if the script execution returned success
    if (results && results[0] && results[0].result && results[0].result.success) {
      return true;
    }
    return false;
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    return false;
  }
}

// Save to Fabric API (v2) with retry logic
async function saveToFabric(videoInfo, apiKey, retryCount = 0) {
  const config = await getStoredConfig();

  try {
    const headers = {
      'Content-Type': 'application/json'
    };

    // Set auth headers based on auth type
    if (config.authType === 'apikey') {
      headers['X-Api-Key'] = apiKey;
    } else if (config.authType === 'oauth2') {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    // Build rich tags
    const tags = [{ name: 'YouTube' }];
    if (videoInfo.channel && videoInfo.channel !== 'YouTube') {
      tags.push({ name: videoInfo.channel });
    }

    // Build request body with rich metadata
    const requestBody = {
      url: videoInfo.url,
      parentId: DEFAULT_CONFIG.defaultParentId,
      name: videoInfo.title || null,
      tags: tags
    };

    // Add detailed comment with video metadata
    const commentParts = [];
    if (videoInfo.channel) commentParts.push(`Channel: ${videoInfo.channel}`);
    if (videoInfo.duration) commentParts.push(`Dauer: ${videoInfo.duration}`);
    if (videoInfo.description) commentParts.push(`\n${videoInfo.description}`);

    if (commentParts.length > 0) {
      requestBody.comment = {
        content: commentParts.join('\n')
      };
    }

    const response = await fetch(`${config.apiUrl}${config.endpoint}`, {
      method: 'POST',
      headers: headers,
      credentials: config.authType === 'cookie' ? 'include' : 'omit',
      body: JSON.stringify(requestBody)
    });

    if (response.ok) {
      const data = await response.json();
      return {
        success: true,
        data,
        bookmarkId: data.id,
        bookmarkUrl: `${DEFAULT_CONFIG.baseUrl}/resources/${data.id}`
      };
    }

    const errorText = await response.text();
    console.error('API response error:', response.status, errorText);

    // Handle auth errors - clear credentials
    if (response.status === 401 || response.status === 403) {
      await clearCredentials();
      return {
        success: false,
        error: 'API Key ungültig oder abgelaufen',
        authExpired: true
      };
    }

    // Don't retry on client errors (4xx)
    if (response.status >= 400 && response.status < 500) {
      let errorMessage = 'Ungültige Anfrage';
      if (response.status === 429) {
        errorMessage = 'Zu viele Anfragen - bitte warten';
      }
      return { success: false, error: errorMessage };
    }

    // Retry on server errors (5xx) or network issues
    if (retryCount < RETRY_CONFIG.maxRetries) {
      const delay = RETRY_CONFIG.delayMs * Math.pow(RETRY_CONFIG.backoffMultiplier, retryCount);
      await sleep(delay);
      return saveToFabric(videoInfo, apiKey, retryCount + 1);
    }

    return { success: false, error: `API Fehler ${response.status} nach ${retryCount + 1} Versuchen` };
  } catch (error) {
    console.error('API error:', error);

    // Retry on network errors
    if (retryCount < RETRY_CONFIG.maxRetries) {
      const delay = RETRY_CONFIG.delayMs * Math.pow(RETRY_CONFIG.backoffMultiplier, retryCount);
      await sleep(delay);
      return saveToFabric(videoInfo, apiKey, retryCount + 1);
    }

    return { success: false, error: `Netzwerkfehler nach ${retryCount + 1} Versuchen` };
  }
}

// Show notification (respects user settings)
async function showNotification(title, message) {
  const settings = await getStoredSettings();

  if (!settings.showNotifications) {
    return;
  }

  if (chrome.notifications) {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: title,
      message: message
    });
  }
}

// Listen for messages from popup or content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'saveToFabric') {
    handleSaveShortcut()
      .then(() => sendResponse({ success: true }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === 'validateApiKey') {
    validateApiKey(request.apiKey)
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ valid: false, error: error.message }));
    return true;
  }

  if (request.action === 'saveVideoToFabric') {
    saveToFabric(request.videoInfo, request.apiKey)
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === 'savePlaylistToFabric') {
    savePlaylistToFabric(request.videos, request.apiKey, sender.tab?.id)
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === 'openInFabric') {
    chrome.tabs.create({ url: request.url });
    sendResponse({ success: true });
    return true;
  }
});

// Save multiple videos from a playlist
async function savePlaylistToFabric(videos, apiKey, tabId) {
  const results = {
    total: videos.length,
    saved: 0,
    failed: 0,
    errors: []
  };

  for (let i = 0; i < videos.length; i++) {
    const video = videos[i];

    // Update progress notification
    await showNotification(
      'Playlist speichern...',
      `Video ${i + 1} von ${videos.length}: ${video.title || 'Unbekannt'}`
    );

    const result = await saveToFabric(video, apiKey);

    if (result.success) {
      results.saved++;
    } else {
      results.failed++;
      results.errors.push({ video: video.title, error: result.error });

      // Stop on auth error
      if (result.authExpired) {
        return {
          success: false,
          error: 'API Key abgelaufen',
          authExpired: true,
          results
        };
      }
    }

    // Small delay between saves to avoid rate limiting
    if (i < videos.length - 1) {
      await sleep(500);
    }
  }

  return {
    success: results.failed === 0,
    results,
    message: `${results.saved} von ${results.total} Videos gespeichert`
  };
}

// Validate API key by testing against user endpoint
async function validateApiKey(apiKey) {
  const config = await getStoredConfig();
  const url = `${config.apiUrl}/v2/user/me`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'X-Api-Key': apiKey }
    });

    if (response.ok) {
      return { valid: true };
    } else if (response.status === 401 || response.status === 403) {
      return { valid: false, error: `Ungültiger API Key (${response.status})` };
    } else if (response.status === 500) {
      // Server error - save key anyway (Fabric API bug)
      return { valid: true, warning: 'Server-Fehler bei Validierung' };
    } else {
      return { valid: false, error: `API Fehler: ${response.status}` };
    }
  } catch (error) {
    return { valid: false, error: 'Verbindung fehlgeschlagen' };
  }
}

// Context menu for right-click on YouTube pages
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'save-to-fabric',
    title: 'In Fabric speichern',
    contexts: ['page', 'link'],
    documentUrlPatterns: [
      'https://www.youtube.com/*',
      'https://youtube.com/*'
    ]
  });
});

// Handle context menu click
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'save-to-fabric') {
    const url = info.linkUrl || info.pageUrl;

    if (!url) {
      await showNotification('Fehler', 'Keine URL gefunden');
      return;
    }

    if (isYouTubeVideoUrl(url)) {
      const credentials = await getStoredCredentials();

      if (!credentials || !credentials.apiKey) {
        await showNotification('Nicht angemeldet', 'Bitte öffne das Plugin und melde dich an');
        return;
      }

      const videoInfo = {
        url: url,
        title: tab.title?.replace(' - YouTube', '') || 'YouTube Video',
        videoId: extractVideoId(url),
        channel: 'YouTube'
      };

      const result = await saveToFabric(videoInfo, credentials.apiKey);

      if (result.success) {
        await showNotification('Gespeichert!', 'Video wurde in Fabric gespeichert');
      } else {
        await showNotification('Fehler', 'Konnte nicht speichern. Öffne das Plugin für Details.');
      }
    } else {
      await showNotification('Kein YouTube Video', 'Dieser Link ist kein YouTube Video');
    }
  }
});
