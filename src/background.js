// Background Service Worker for YouTube to Fabric Extension
import {
  STORAGE_KEYS,
  DEFAULT_CONFIG,
  isYouTubeVideoUrl,
  extractVideoId,
  getStorage,
  removeStorage,
  sanitizeText
} from './shared/constants.js';

// Retry configuration
const RETRY_CONFIG = {
  maxRetries: 2,
  delayMs: 1000,
  backoffMultiplier: 2,
  rateLimitDelayMs: 5000   // Longer delay for 429 responses
};

// Listen for keyboard shortcut
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'save-to-fabric') {
    await handleSaveShortcut();
  }
});

// Handle the save shortcut - returns result for message response
async function handleSaveShortcut() {
  try {
    // Get the active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab || !tab.url) {
      await showNotification('Fehler', 'Kein aktiver Tab gefunden');
      return { success: false, error: 'Kein aktiver Tab' };
    }

    // Check if it's a YouTube video
    if (!isYouTubeVideoUrl(tab.url)) {
      await showNotification('Kein YouTube Video', 'Bitte öffne ein YouTube Video');
      return { success: false, error: 'Kein YouTube Video' };
    }

    // Get credentials
    const credentials = await getStoredCredentials();

    if (!credentials || !credentials.apiKey) {
      await showNotification('Nicht angemeldet', 'Bitte öffne das Plugin und melde dich an');
      return { success: false, error: 'Nicht angemeldet' };
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

      // Auto-copy bookmark URL if enabled
      const settings = await getStoredSettings();
      if (settings.autoCopyUrl && result.bookmarkUrl) {
        await copyToClipboard(result.bookmarkUrl, tab.id);
      }

      return { success: true, bookmarkUrl: result.bookmarkUrl };
    } else {
      // Show error notification (no fallback that opens Fabric)
      const errorMsg = result.error || 'Unbekannter Fehler';
      console.error('Save to Fabric failed:', errorMsg);
      await showNotification('Fehler', `Speichern fehlgeschlagen: ${errorMsg}`);
      return { success: false, error: errorMsg };
    }
  } catch (error) {
    console.error('Error in shortcut handler:', error);
    await showNotification('Fehler', 'Ein Fehler ist aufgetreten');
    return { success: false, error: error.message };
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

    // Sanitize user-provided strings before sending to API
    const title = sanitizeText(videoInfo.title, 500);
    const channel = sanitizeText(videoInfo.channel, 200);
    const description = sanitizeText(videoInfo.description, 2000);

    // Build rich tags
    const tags = [{ name: 'YouTube' }];
    if (channel && channel !== 'YouTube') {
      tags.push({ name: channel });
    }

    // Merge custom tags from popup (if provided)
    if (videoInfo.customTags && Array.isArray(videoInfo.customTags)) {
      for (const tagName of videoInfo.customTags) {
        if (typeof tagName !== 'string') continue;
        const trimmed = tagName.trim();
        if (trimmed && !tags.some(t => t.name.toLowerCase() === trimmed.toLowerCase())) {
          tags.push({ name: sanitizeText(trimmed, 100) });
        }
      }
    }

    // Build request body with rich metadata
    // TODO: Duplikat-Erkennung — Fabric API v2 hat keinen "search by URL" Endpoint.
    // Sobald verfügbar, vor dem Speichern prüfen ob die URL bereits existiert.
    const requestBody = {
      url: videoInfo.url,
      parentId: config.parentId,
      name: title || null,
      tags: tags
    };

    // Add detailed comment with video metadata
    const commentParts = [];
    if (channel) commentParts.push(`Channel: ${channel}`);
    if (videoInfo.duration) commentParts.push(`Dauer: ${videoInfo.duration}`);
    if (description) commentParts.push(`\n${description}`);

    // Append custom note from popup (if provided)
    if (videoInfo.customNote) {
      commentParts.push(`\n${sanitizeText(videoInfo.customNote, 1000)}`);
    }

    if (commentParts.length > 0) {
      requestBody.comment = {
        content: commentParts.join('\n')
      };
    }

    const response = await fetch(`${config.apiUrl}${config.endpoint}`, {
      method: 'POST',
      headers: headers,
      credentials: 'omit',
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

    // Handle rate limiting (429) - retry with longer delay
    if (response.status === 429) {
      if (retryCount < RETRY_CONFIG.maxRetries) {
        // Check for Retry-After header, default to rateLimitDelayMs
        const retryAfter = response.headers.get('Retry-After');
        const delay = retryAfter ? parseInt(retryAfter) * 1000 : RETRY_CONFIG.rateLimitDelayMs;
        await sleep(delay);
        return saveToFabric(videoInfo, apiKey, retryCount + 1);
      }
      return { success: false, error: 'Zu viele Anfragen - bitte später erneut versuchen' };
    }

    // Don't retry on other client errors (4xx) — surface API error details
    if (response.status >= 400 && response.status < 500) {
      let errorDetail = `API Fehler ${response.status}`;
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

    // Retry on server errors (5xx)
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
      .then((result) => sendResponse(result))
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
    if (!isYouTubeVideoUrl(request.videoInfo?.url)) {
      sendResponse({ success: false, error: 'Keine gültige YouTube URL' });
      return true;
    }
    saveToFabric(request.videoInfo, request.apiKey)
      .then(async (result) => {
        // Auto-copy if enabled
        if (result.success) {
          const settings = await getStoredSettings();
          if (settings.autoCopyUrl && result.bookmarkUrl && sender.tab && sender.tab.id != null) {
            await copyToClipboard(result.bookmarkUrl, sender.tab.id);
          }
        }
        sendResponse(result);
      })
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  }

  // Content script sends videoInfo directly — avoids race condition with tab re-query
  if (request.action === 'saveFromContentScript') {
    const videoInfo = request.videoInfo;
    if (!videoInfo || !isYouTubeVideoUrl(videoInfo.url)) {
      sendResponse({ success: false, error: 'Keine gültige YouTube URL' });
      return true;
    }
    getStoredCredentials()
      .then(async (credentials) => {
        if (!credentials || !credentials.apiKey) {
          sendResponse({ success: false, error: 'Nicht angemeldet' });
          return;
        }
        const result = await saveToFabric(videoInfo, credentials.apiKey);

        // Auto-copy if enabled
        if (result.success) {
          const settings = await getStoredSettings();
          if (settings.autoCopyUrl && result.bookmarkUrl && sender.tab && sender.tab.id != null) {
            await copyToClipboard(result.bookmarkUrl, sender.tab.id);
          }
        }

        sendResponse(result);
      })
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === 'openInFabric') {
    const url = request.url;
    const isFabricUrl = url && (
      url === 'https://fabric.so' || url.startsWith('https://fabric.so/') ||
      url === 'https://app.fabric.so' || url.startsWith('https://app.fabric.so/')
    );
    if (isFabricUrl) {
      chrome.tabs.create({ url });
      sendResponse({ success: true });
    } else {
      console.warn('Blocked openInFabric with invalid URL:', url);
      sendResponse({ success: false, error: 'Ungültige URL' });
    }
    return true;
  }
});

// Validate API key by testing against user endpoint
async function validateApiKey(apiKey) {
  const config = await getStoredConfig();
  const url = `${config.apiUrl}/v2/user/me`;

  try {
    const headers = {};
    if (config.authType === 'oauth2') {
      headers['Authorization'] = `Bearer ${apiKey}`;
    } else {
      headers['X-Api-Key'] = apiKey;
    }

    const response = await fetch(url, {
      method: 'GET',
      headers
    });

    if (response.ok) {
      return { valid: true };
    } else if (response.status === 401 || response.status === 403) {
      return { valid: false, error: `Ungültiger API Key (${response.status})` };
    } else if (response.status >= 500) {
      // Server error - save key anyway (known Fabric API issue)
      return { valid: true, warning: 'Fabric API antwortet mit Server-Fehler. Key wurde gespeichert - bei Problemen bitte erneut versuchen.' };
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
