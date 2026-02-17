// Popup script for YouTube to Fabric Extension
import {
  STORAGE_KEYS,
  DEFAULT_CONFIG,
  isYouTubeVideoUrl,
  isYouTubePlaylistUrl,
  extractVideoId,
  getThumbnailUrl,
  getStorage,
  removeStorage
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
  playlistSection: document.getElementById('playlist-section'),
  successMessage: document.getElementById('success-message'),
  errorMessage: document.getElementById('error-message'),
  errorText: document.getElementById('error-text'),
  loading: document.getElementById('loading'),

  apiKeyInput: document.getElementById('api-key'),
  saveCredentialsBtn: document.getElementById('save-credentials'),
  logoutBtn: document.getElementById('logout-btn'),
  saveToFabricBtn: document.getElementById('save-to-fabric'),
  openInFabricBtn: document.getElementById('open-in-fabric'),
  savePlaylistBtn: document.getElementById('save-playlist'),

  videoThumbnail: document.getElementById('video-thumbnail'),
  videoTitle: document.getElementById('video-title'),
  videoChannel: document.getElementById('video-channel'),

  playlistTitle: document.getElementById('playlist-title'),
  playlistCount: document.getElementById('playlist-count')
};

// State
let currentVideoInfo = null;
let currentPlaylistInfo = null;
let lastSavedBookmarkUrl = null;

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
  try {
    const result = await getStorage([STORAGE_KEYS.API_KEY]);
    return { apiKey: result[STORAGE_KEYS.API_KEY] };
  } catch (error) {
    console.error('Error getting credentials:', error);
    return { apiKey: null };
  }
}

// Store credentials via background script (avoids CORS issues)
async function storeCredentials(apiKey) {
  return new Promise((resolve) => {
    chrome.storage.local.set({
      [STORAGE_KEYS.API_KEY]: apiKey
    }, resolve);
  });
}

// Clear credentials
async function clearCredentials() {
  try {
    await removeStorage([STORAGE_KEYS.API_KEY]);
  } catch (error) {
    console.error('Error clearing credentials:', error);
  }
}

// Check current tab for YouTube video or playlist
async function checkCurrentTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab || !tab.url) {
      showNoVideo();
      return;
    }

    // Check for playlist first
    if (isYouTubePlaylistUrl(tab.url)) {
      try {
        const response = await chrome.tabs.sendMessage(tab.id, { action: 'getPlaylistInfo' });
        if (response && response.playlistInfo && response.playlistInfo.videos.length > 0) {
          currentPlaylistInfo = response.playlistInfo;
          displayPlaylistInfo(currentPlaylistInfo);
          showPlaylistSection();
          return;
        }
      } catch (e) {
        // Content script might not be loaded
      }
    }

    // Check for video
    if (isYouTubeVideoUrl(tab.url)) {
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

// Display playlist information
function displayPlaylistInfo(info) {
  if (elements.playlistTitle) {
    elements.playlistTitle.textContent = info.playlistTitle || 'Unbekannte Playlist';
  }
  if (elements.playlistCount) {
    // Show visible vs total if we know the total
    if (info.totalVideos && info.totalVideos > info.visibleVideos) {
      elements.playlistCount.textContent = `${info.visibleVideos} von ${info.totalVideos} Videos geladen`;
    } else {
      elements.playlistCount.textContent = `${info.videos.length} Videos`;
    }
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

  // Open in Fabric button
  if (elements.openInFabricBtn) {
    elements.openInFabricBtn.addEventListener('click', handleOpenInFabric);
  }

  // Save playlist button
  if (elements.savePlaylistBtn) {
    elements.savePlaylistBtn.addEventListener('click', handleSavePlaylist);
  }

  // Enter key on API key input
  elements.apiKeyInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      handleSaveCredentials();
    }
  });
}

// Validate API key via background script (avoids CORS issues)
async function validateApiKey(apiKey) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { action: 'validateApiKey', apiKey: apiKey },
      (response) => {
        resolve(response || { valid: false, error: 'Keine Antwort vom Background Script' });
      }
    );
  });
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
      lastSavedBookmarkUrl = result.bookmarkUrl;
      showSuccess('Video erfolgreich in Fabric gespeichert!', lastSavedBookmarkUrl);
    } else {
      // Handle auth expiry
      if (result.authExpired) {
        showError('Session abgelaufen. Bitte erneut anmelden.');
        showLogin();
      } else {
        showError(result.error || 'Fehler beim Speichern');
      }
    }
  } catch (error) {
    console.error('Error saving to Fabric:', error);
    showError('Verbindungsfehler: ' + error.message);
  }
}

// Handle open in Fabric
function handleOpenInFabric() {
  if (lastSavedBookmarkUrl) {
    chrome.runtime.sendMessage({ action: 'openInFabric', url: lastSavedBookmarkUrl });
  } else {
    chrome.runtime.sendMessage({ action: 'openInFabric', url: DEFAULT_CONFIG.baseUrl + '/home' });
  }
}

// Handle save playlist
async function handleSavePlaylist() {
  if (!currentPlaylistInfo || !currentPlaylistInfo.videos.length) {
    showError('Keine Playlist zum Speichern');
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
    const result = await savePlaylistToFabric(currentPlaylistInfo.videos, credentials.apiKey);

    if (result.success) {
      showSuccess(`${result.results.saved} von ${result.results.total} Videos gespeichert!`);
    } else {
      if (result.authExpired) {
        showError('Session abgelaufen. Bitte erneut anmelden.');
        showLogin();
      } else {
        showError(result.error || `Fehler: ${result.results?.failed || 0} Videos fehlgeschlagen`);
      }
    }
  } catch (error) {
    console.error('Error saving playlist:', error);
    showError('Verbindungsfehler: ' + error.message);
  }
}

// Save playlist via background script
async function savePlaylistToFabric(videos, apiKey) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { action: 'savePlaylistToFabric', videos: videos, apiKey: apiKey },
      (response) => {
        resolve(response || { success: false, error: 'Keine Antwort vom Background Script' });
      }
    );
  });
}

// Save to Fabric via background script (avoids CORS issues)
async function saveToFabric(videoInfo, apiKey) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { action: 'saveVideoToFabric', videoInfo: videoInfo, apiKey: apiKey },
      (response) => {
        resolve(response || { success: false, error: 'Keine Antwort vom Background Script' });
      }
    );
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
  if (elements.savePlaylistBtn) {
    elements.savePlaylistBtn.disabled = true;
  }
  elements.loading.classList.remove('hidden');
  hideMessages();
}

function hideLoading() {
  elements.saveToFabricBtn.disabled = false;
  if (elements.savePlaylistBtn) {
    elements.savePlaylistBtn.disabled = false;
  }
  elements.loading.classList.add('hidden');
}

function showSuccess(message = 'Video erfolgreich in Fabric gespeichert!', bookmarkUrl = null) {
  hideLoading();
  elements.successMessage.querySelector('span:last-child').textContent = message;
  elements.successMessage.classList.remove('hidden');

  // Show "Open in Fabric" button if we have a bookmark URL
  if (elements.openInFabricBtn && bookmarkUrl) {
    elements.openInFabricBtn.classList.remove('hidden');
  }

  setTimeout(() => {
    elements.successMessage.classList.add('hidden');
  }, 5000);
}

function showPlaylistSection() {
  elements.videoSection?.classList.add('hidden');
  elements.noVideoSection?.classList.add('hidden');
  elements.playlistSection?.classList.remove('hidden');
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
  // Hide "Open in Fabric" button when starting new action
  if (elements.openInFabricBtn) {
    elements.openInFabricBtn.classList.add('hidden');
  }
}

function hideAllSections() {
  elements.loginSection.classList.add('hidden');
  elements.loggedInSection.classList.add('hidden');
  elements.videoSection.classList.add('hidden');
  elements.noVideoSection.classList.add('hidden');
}
