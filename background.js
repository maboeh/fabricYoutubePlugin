// Background Service Worker for YouTube to Fabric Extension

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
      showNotification('Fehler', 'Kein aktiver Tab gefunden');
      return;
    }

    // Check if it's a YouTube video
    if (!isYouTubeVideoUrl(tab.url)) {
      showNotification('Kein YouTube Video', 'Bitte öffne ein YouTube Video');
      return;
    }

    // Get credentials
    const credentials = await getStoredCredentials();

    if (!credentials || !credentials.apiKey) {
      showNotification('Nicht angemeldet', 'Bitte öffne das Plugin und melde dich an');
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
    showNotification('Speichern...', 'Video wird in Fabric gespeichert');

    // Save to Fabric
    const result = await saveToFabric(videoInfo, credentials.apiKey);

    if (result.success) {
      showNotification('Gespeichert!', `"${videoInfo.title}" wurde in Fabric gespeichert`);
    } else {
      // Fallback: Copy URL and open Fabric
      await navigator.clipboard.writeText(videoInfo.url);
      chrome.tabs.create({ url: 'https://fabric.so/home' });
      showNotification('URL kopiert', 'Füge die URL in Fabric ein (Ctrl+V)');
    }
  } catch (error) {
    console.error('Error in shortcut handler:', error);
    showNotification('Fehler', 'Ein Fehler ist aufgetreten');
  }
}

// Check if URL is a YouTube video
function isYouTubeVideoUrl(url) {
  return url && (
    url.includes('youtube.com/watch') ||
    url.includes('youtu.be/') ||
    url.includes('youtube.com/shorts/')
  );
}

// Extract video ID from YouTube URL
function extractVideoId(url) {
  const patterns = [
    /[?&]v=([^&]+)/,
    /youtu\.be\/([^?&]+)/,
    /shorts\/([^?&]+)/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

// Get stored credentials
async function getStoredCredentials() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['fabricApiKey'], (result) => {
      resolve({
        apiKey: result.fabricApiKey
      });
    });
  });
}

// Save to Fabric API
async function saveToFabric(videoInfo, apiKey) {
  const FABRIC_API_URL = 'https://api.fabric.so';

  try {
    const response = await fetch(`${FABRIC_API_URL}/api/v1/links`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'X-API-Key': apiKey
      },
      body: JSON.stringify({
        url: videoInfo.url,
        title: videoInfo.title,
        description: `YouTube Video: ${videoInfo.title}`,
        type: 'link',
        metadata: {
          source: 'youtube',
          videoId: videoInfo.videoId,
          channel: videoInfo.channel
        }
      })
    });

    if (response.ok) {
      return { success: true };
    }

    return { success: false, error: 'API request failed' };
  } catch (error) {
    console.error('API error:', error);
    return { success: false, error: error.message };
  }
}

// Show notification
function showNotification(title, message) {
  // Use chrome notifications API if available
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
    handleSaveShortcut().then(() => {
      sendResponse({ success: true });
    }).catch((error) => {
      sendResponse({ success: false, error: error.message });
    });
    return true; // Keep message channel open for async response
  }
});

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

    if (isYouTubeVideoUrl(url)) {
      const credentials = await getStoredCredentials();

      if (!credentials || !credentials.apiKey) {
        showNotification('Nicht angemeldet', 'Bitte öffne das Plugin und melde dich an');
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
        showNotification('Gespeichert!', 'Video wurde in Fabric gespeichert');
      } else {
        showNotification('Fehler', 'Konnte nicht speichern. Öffne das Plugin für Details.');
      }
    } else {
      showNotification('Kein YouTube Video', 'Dieser Link ist kein YouTube Video');
    }
  }
});
