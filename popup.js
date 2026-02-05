// Popup script for YouTube to Fabric Extension
import {
  STORAGE_KEYS,
  DEFAULT_CONFIG,
  isYouTubeVideoUrl,
  extractVideoId,
  getThumbnailUrl
} from './shared/constants.js';

// Runtime config (can be overridden by user settings)
let config = { ...DEFAULT_CONFIG };

// Load configuration from storage
async function loadConfig() {
  return new Promise((resolve) => {
    chrome.storage.local.get([
      STORAGE_KEYS.API_BASE_URL,
      STORAGE_KEYS.API_ENDPOINT,
      STORAGE_KEYS.AUTH_TYPE
    ], (result) => {
      if (result[STORAGE_KEYS.API_BASE_URL]) {
        config.apiUrl = result[STORAGE_KEYS.API_BASE_URL];
      }
      if (result[STORAGE_KEYS.API_ENDPOINT]) {
        config.endpoint = result[STORAGE_KEYS.API_ENDPOINT];
      }
      if (result[STORAGE_KEYS.AUTH_TYPE]) {
        config.authType = result[STORAGE_KEYS.AUTH_TYPE];
      }
      resolve(config);
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
    chrome.storage.local.get([STORAGE_KEYS.API_KEY], (result) => {
      resolve({
        apiKey: result[STORAGE_KEYS.API_KEY]
      });
    });
  });
}

// Store credentials
async function storeCredentials(apiKey) {
  return new Promise((resolve) => {
    chrome.storage.local.set({
      [STORAGE_KEYS.API_KEY]: apiKey
    }, resolve);
  });
}

// Clear credentials
async function clearCredentials() {
  return new Promise((resolve) => {
    chrome.storage.local.remove([STORAGE_KEYS.API_KEY], resolve);
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
      const videoId = extractVideoId(tab.url);
      currentVideoInfo = {
        url: tab.url,
        title: tab.title?.replace(' - YouTube', '') || 'YouTube Video',
        videoId: videoId,
        channel: 'YouTube',
        thumbnail: getThumbnailUrl(videoId)
      };

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

// Validate API key by testing against user endpoint
async function validateApiKey(apiKey) {
  const url = `${config.apiUrl}/v2/user/me`;
  console.log('Validating API key against:', url);
  console.log('API key prefix:', apiKey.substring(0, 5) + '...');

  try {
    const headers = {
      'Content-Type': 'application/json',
      'X-Api-Key': apiKey
    };

    const response = await fetch(url, {
      method: 'GET',
      headers: headers
    });

    console.log('Validation response status:', response.status);

    if (response.ok) {
      const data = await response.json();
      console.log('Validation success:', data);
      return { valid: true };
    } else {
      const errorText = await response.text();
      console.error('Validation failed:', response.status, errorText);

      if (response.status === 401 || response.status === 403) {
        return { valid: false, error: `Ungültiger API Key (${response.status})` };
      } else {
        return { valid: false, error: `API Fehler: ${response.status}` };
      }
    }
  } catch (error) {
    console.error('Validation error:', error);
    return { valid: false, error: 'Verbindung fehlgeschlagen: ' + error.message };
  }
}

// Handle saving credentials
async function handleSaveCredentials() {
  const apiKey = elements.apiKeyInput.value.trim();

  if (!apiKey) {
    showError('Bitte gib einen API Key ein');
    return;
  }

  // Disable button during validation
  elements.saveCredentialsBtn.disabled = true;
  elements.saveCredentialsBtn.textContent = 'Prüfe...';

  try {
    // Validate API key before storing
    const validation = await validateApiKey(apiKey);

    if (!validation.valid) {
      showError(validation.error || 'API Key ungültig');
      return;
    }

    await storeCredentials(apiKey);
    showLoggedIn();

    // Re-check current tab after login
    await checkCurrentTab();
  } finally {
    elements.saveCredentialsBtn.disabled = false;
    elements.saveCredentialsBtn.textContent = 'Anmelden';
  }
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
    showError('Verbindungsfehler: ' + error.message);
  }
}

// Save to Fabric API (v2)
async function saveToFabric(videoInfo, apiKey) {
  const headers = {
    'Content-Type': 'application/json'
  };

  let credentials = 'omit';

  // Fabric API uses X-Api-Key header
  if (config.authType === 'apikey') {
    headers['X-Api-Key'] = apiKey;
  } else if (config.authType === 'oauth2') {
    headers['Authorization'] = `Bearer ${apiKey}`;
  } else if (config.authType === 'cookie') {
    credentials = 'include';
  }

  // Build request body according to Fabric API v2 spec
  const requestBody = {
    url: videoInfo.url,
    parentId: config.defaultParentId || '@alias::inbox',
    name: videoInfo.title || null,
    tags: [{ name: 'YouTube' }]
  };

  // Add comment with video details
  if (videoInfo.channel) {
    requestBody.comment = {
      content: `Channel: ${videoInfo.channel}`
    };
  }

  try {
    const apiUrl = `${config.apiUrl}${config.endpoint}`;
    console.log('Sending request to:', apiUrl);

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: headers,
      credentials: credentials,
      body: JSON.stringify(requestBody)
    });

    if (response.ok) {
      const data = await response.json();
      return { success: true, data };
    }

    const errorText = await response.text();
    console.error('API response error:', response.status, errorText);

    // Provide specific error messages
    let errorMessage;
    if (response.status === 401 || response.status === 403) {
      errorMessage = 'API Key ungültig oder abgelaufen';
    } else if (response.status === 400) {
      errorMessage = 'Ungültige Anfrage';
    } else if (response.status === 429) {
      errorMessage = 'Zu viele Anfragen - bitte warten';
    } else {
      // Try to parse error message from response
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.message || `API Fehler ${response.status}`;
      } catch (e) {
        errorMessage = `API Fehler ${response.status}`;
      }
    }

    return { success: false, error: errorMessage };
  } catch (error) {
    console.error('API error:', error);
    return { success: false, error: error.message };
  }
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
