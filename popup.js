// Fabric.so API Configuration (loaded from settings)
let FABRIC_CONFIG = {
  baseUrl: 'https://fabric.so',
  apiUrl: 'https://api.fabric.so',
  endpoint: '/v1/links',
  authType: 'bearer'
};

// Load configuration from storage
async function loadConfig() {
  return new Promise((resolve) => {
    chrome.storage.local.get([
      'fabricApiBaseUrl',
      'fabricApiEndpoint',
      'fabricAuthType'
    ], (result) => {
      if (result.fabricApiBaseUrl) {
        FABRIC_CONFIG.apiUrl = result.fabricApiBaseUrl;
      }
      if (result.fabricApiEndpoint) {
        FABRIC_CONFIG.endpoint = result.fabricApiEndpoint;
      }
      if (result.fabricAuthType) {
        FABRIC_CONFIG.authType = result.fabricAuthType;
      }
      resolve(FABRIC_CONFIG);
    });
  });
}

// DOM Elements
const elements = {
  loginSection: document.getElementById('login-section'),
  loggedInSection: document.getElementById('logged-in-section'),
  videoSection: document.getElementById('video-section'),
  noVideoSection: document.getElementById('no-video-section'),
  successMessage: document.getElementById('success-message'),
  errorMessage: document.getElementById('error-message'),
  errorText: document.getElementById('error-text'),
  loading: document.getElementById('loading'),

  apiKeyInput: document.getElementById('api-key'),
  saveCredentialsBtn: document.getElementById('save-credentials'),
  logoutBtn: document.getElementById('logout-btn'),
  saveToFabricBtn: document.getElementById('save-to-fabric'),

  videoThumbnail: document.getElementById('video-thumbnail'),
  videoTitle: document.getElementById('video-title'),
  videoChannel: document.getElementById('video-channel')
};

// State
let currentVideoInfo = null;

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  await loadConfig();
  await checkAuthStatus();
  await checkCurrentTab();
  setupEventListeners();
});

// Check if user is authenticated
async function checkAuthStatus() {
  const credentials = await getStoredCredentials();

  if (credentials && credentials.apiKey) {
    showLoggedIn();
  } else {
    showLogin();
  }
}

// Get stored credentials from Chrome storage
async function getStoredCredentials() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['fabricApiKey'], (result) => {
      resolve({
        apiKey: result.fabricApiKey
      });
    });
  });
}

// Store credentials
async function storeCredentials(apiKey) {
  return new Promise((resolve) => {
    chrome.storage.local.set({
      fabricApiKey: apiKey
    }, resolve);
  });
}

// Clear credentials
async function clearCredentials() {
  return new Promise((resolve) => {
    chrome.storage.local.remove(['fabricApiKey'], resolve);
  });
}

// Check current tab for YouTube video
async function checkCurrentTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (tab && tab.url && isYouTubeVideoUrl(tab.url)) {
      // Try to get video info from content script
      try {
        const response = await chrome.tabs.sendMessage(tab.id, { action: 'getVideoInfo' });
        if (response && response.videoInfo) {
          currentVideoInfo = response.videoInfo;
          displayVideoInfo(currentVideoInfo);
          showVideoSection();
          return;
        }
      } catch (e) {
        // Content script might not be loaded, extract basic info from URL
        console.log('Content script not available, using basic info');
      }

      // Fallback: Extract basic info from tab
      currentVideoInfo = {
        url: tab.url,
        title: tab.title?.replace(' - YouTube', '') || 'YouTube Video',
        videoId: extractVideoId(tab.url),
        channel: 'YouTube'
      };

      if (currentVideoInfo.videoId) {
        currentVideoInfo.thumbnail = `https://img.youtube.com/vi/${currentVideoInfo.videoId}/mqdefault.jpg`;
      }

      displayVideoInfo(currentVideoInfo);
      showVideoSection();
    } else {
      showNoVideo();
    }
  } catch (error) {
    console.error('Error checking current tab:', error);
    showNoVideo();
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

// Display video information
function displayVideoInfo(info) {
  elements.videoTitle.textContent = info.title || 'Unbekannter Titel';
  elements.videoChannel.textContent = info.channel || 'YouTube';

  if (info.thumbnail) {
    elements.videoThumbnail.src = info.thumbnail;
    elements.videoThumbnail.style.display = 'block';
  } else {
    elements.videoThumbnail.style.display = 'none';
  }
}

// Setup event listeners
function setupEventListeners() {
  elements.saveCredentialsBtn.addEventListener('click', handleSaveCredentials);
  elements.logoutBtn.addEventListener('click', handleLogout);
  elements.saveToFabricBtn.addEventListener('click', handleSaveToFabric);

  // Enter key on API key input
  elements.apiKeyInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      handleSaveCredentials();
    }
  });
}

// Handle saving credentials
async function handleSaveCredentials() {
  const apiKey = elements.apiKeyInput.value.trim();

  if (!apiKey) {
    showError('Bitte gib einen API Key ein');
    return;
  }

  await storeCredentials(apiKey);
  showLoggedIn();

  // Re-check current tab after login
  await checkCurrentTab();
}

// Handle logout
async function handleLogout() {
  await clearCredentials();
  showLogin();
}

// Handle save to Fabric
async function handleSaveToFabric() {
  if (!currentVideoInfo) {
    showError('Kein Video zum Speichern');
    return;
  }

  const credentials = await getStoredCredentials();

  if (!credentials || !credentials.apiKey) {
    showError('Bitte melde dich zuerst an');
    showLogin();
    return;
  }

  showLoading();

  try {
    const result = await saveToFabric(currentVideoInfo, credentials.apiKey);

    if (result.success) {
      showSuccess();
    } else {
      showError(result.error || 'Fehler beim Speichern');
    }
  } catch (error) {
    console.error('Error saving to Fabric:', error);
    showError('Verbindungsfehler. Versuche den Fallback...');

    // Fallback: Open Fabric with the URL
    openFabricFallback(currentVideoInfo.url);
  }
}

// Save to Fabric API
async function saveToFabric(videoInfo, apiKey) {
  // Build headers based on auth type from config
  const headers = {
    'Content-Type': 'application/json'
  };

  let credentials = 'omit';

  switch (FABRIC_CONFIG.authType) {
    case 'bearer':
      headers['Authorization'] = `Bearer ${apiKey}`;
      break;
    case 'apikey':
      headers['X-API-Key'] = apiKey;
      break;
    case 'cookie':
      credentials = 'include';
      break;
  }

  const requestBody = {
    url: videoInfo.url,
    title: videoInfo.title,
    description: `YouTube Video: ${videoInfo.title}`,
    type: 'link',
    metadata: {
      source: 'youtube',
      videoId: videoInfo.videoId,
      channel: videoInfo.channel,
      thumbnail: videoInfo.thumbnail
    }
  };

  // Method 1: Try the configured API endpoint
  try {
    const apiUrl = `${FABRIC_CONFIG.apiUrl}${FABRIC_CONFIG.endpoint}`;
    console.log('Sending request to:', apiUrl);

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: headers,
      credentials: credentials,
      body: JSON.stringify(requestBody)
    });

    if (response.ok) {
      return { success: true };
    }

    const errorText = await response.text();
    console.log('API response:', response.status, errorText);

    // If API fails, try alternative method
    throw new Error(`API request failed: ${response.status}`);
  } catch (apiError) {
    console.log('API method failed:', apiError.message);

    // Method 2: Try using cookies (if user is logged in to fabric.so)
    try {
      const cookies = await chrome.cookies.getAll({ domain: 'fabric.so' });

      if (cookies.length > 0) {
        // User has fabric.so cookies, try fetch with credentials
        const response = await fetch(`${FABRIC_CONFIG.baseUrl}/api/links`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            url: videoInfo.url,
            title: videoInfo.title
          })
        });

        if (response.ok) {
          return { success: true };
        }
      }

      throw new Error('Cookie method failed');
    } catch (cookieError) {
      console.log('Cookie method failed');
      return {
        success: false,
        error: 'API nicht erreichbar. Öffne Einstellungen und prüfe die Konfiguration.'
      };
    }
  }
}

// Fallback: Open Fabric website with the URL
function openFabricFallback(url) {
  // Fabric supports pasting URLs directly, so we open Fabric and copy the URL
  const fabricUrl = `${FABRIC_CONFIG.baseUrl}/home`;

  // Copy URL to clipboard
  navigator.clipboard.writeText(url).then(() => {
    chrome.tabs.create({ url: fabricUrl });
    showSuccess('URL kopiert! Füge sie in Fabric ein (Cmd/Ctrl+V)');
  }).catch(() => {
    chrome.tabs.create({ url: fabricUrl });
    showError('Öffne Fabric und füge die URL manuell ein');
  });
}

// UI State functions
function showLogin() {
  hideAllSections();
  elements.loginSection.classList.remove('hidden');
}

function showLoggedIn() {
  elements.loginSection.classList.add('hidden');
  elements.loggedInSection.classList.remove('hidden');
}

function showVideoSection() {
  elements.noVideoSection.classList.add('hidden');
  elements.videoSection.classList.remove('hidden');
}

function showNoVideo() {
  elements.videoSection.classList.add('hidden');
  elements.noVideoSection.classList.remove('hidden');
}

function showLoading() {
  elements.saveToFabricBtn.disabled = true;
  elements.loading.classList.remove('hidden');
  hideMessages();
}

function hideLoading() {
  elements.saveToFabricBtn.disabled = false;
  elements.loading.classList.add('hidden');
}

function showSuccess(message = 'Video erfolgreich in Fabric gespeichert!') {
  hideLoading();
  elements.successMessage.querySelector('span:last-child').textContent = message;
  elements.successMessage.classList.remove('hidden');

  setTimeout(() => {
    elements.successMessage.classList.add('hidden');
  }, 3000);
}

function showError(message) {
  hideLoading();
  elements.errorText.textContent = message;
  elements.errorMessage.classList.remove('hidden');

  setTimeout(() => {
    elements.errorMessage.classList.add('hidden');
  }, 5000);
}

function hideMessages() {
  elements.successMessage.classList.add('hidden');
  elements.errorMessage.classList.add('hidden');
}

function hideAllSections() {
  elements.loginSection.classList.add('hidden');
  elements.loggedInSection.classList.add('hidden');
  elements.videoSection.classList.add('hidden');
  elements.noVideoSection.classList.add('hidden');
}
