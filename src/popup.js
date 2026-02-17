// Popup script for YouTube to Fabric Extension
import {
  STORAGE_KEYS,
  DEFAULT_CONFIG,
  isYouTubeVideoUrl,
  isYouTubePlaylistUrl,
  extractVideoId,
  getThumbnailUrl,
  removeStorage,
  getStoredCredentials
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

  customTags: document.getElementById('custom-tags'),
  customNote: document.getElementById('custom-note'),

  playlistTitle: document.getElementById('playlist-title'),
  playlistCount: document.getElementById('playlist-count'),
  playlistProgress: document.getElementById('playlist-progress'),
  progressFill: document.getElementById('progress-fill'),
  progressText: document.getElementById('progress-text')
};

// State
let currentVideoInfo = null;
let currentPlaylistInfo = null;
let lastSavedBookmarkUrl = null;
let cachedCredentials = null;

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  await loadConfig();
  await checkAuthStatus();
  await checkCurrentTab();
  setupEventListeners();
});

// Check if user is authenticated (caches credentials for later use)
async function checkAuthStatus() {
  cachedCredentials = await getStoredCredentials();

  if (cachedCredentials && cachedCredentials.apiKey) {
    showLoggedIn();
  } else {
    cachedCredentials = null;
    showLogin();
  }
}

// Get credentials (from cache or storage)
async function getCachedCredentials() {
  if (cachedCredentials) return cachedCredentials;
  cachedCredentials = await getStoredCredentials();
  return cachedCredentials;
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
    cachedCredentials = { apiKey };
    showLoggedIn();

    // Show warning after login transition so it's visible in the logged-in state
    if (validation.warning) {
      showSuccess(validation.warning);
    }

    // Re-check current tab after login
    await checkCurrentTab();
  } finally {
    elements.saveCredentialsBtn.disabled = false;
    elements.saveCredentialsBtn.textContent = 'Anmelden';
  }
}

// Handle logout
async function handleLogout() {
  cachedCredentials = null;
  await clearCredentials();
  showLogin();
}

// Handle save to Fabric
async function handleSaveToFabric() {
  if (!currentVideoInfo) {
    showError('Kein Video zum Speichern');
    return;
  }

  const credentials = await getCachedCredentials();

  if (!credentials || !credentials.apiKey) {
    showError('Bitte melde dich zuerst an');
    showLogin();
    return;
  }

  showLoading(elements.saveToFabricBtn);

  // Attach custom tags and note from popup fields
  const videoInfoWithExtras = { ...currentVideoInfo };
  if (elements.customTags && elements.customTags.value.trim()) {
    videoInfoWithExtras.customTags = elements.customTags.value
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0);
  }
  if (elements.customNote && elements.customNote.value.trim()) {
    videoInfoWithExtras.customNote = elements.customNote.value.trim();
  }

  try {
    const result = await saveToFabric(videoInfoWithExtras, credentials.apiKey);
    hideLoading();

    if (result.success) {
      lastSavedBookmarkUrl = result.bookmarkUrl;
      showSuccess('Video erfolgreich in Fabric gespeichert!');
      // Clear fields after successful save
      if (elements.customTags) elements.customTags.value = '';
      if (elements.customNote) elements.customNote.value = '';
    } else {
      if (result.authExpired) {
        cachedCredentials = null;
        showError('Session abgelaufen. Bitte erneut anmelden.');
        showLogin();
      } else {
        showError(result.error || 'Fehler beim Speichern');
      }
    }
  } catch (error) {
    hideLoading();
    console.error('Error saving to Fabric:', error);
    showError('Verbindungsfehler: ' + error.message);
  }
}

// Handle open in Fabric — opens last saved bookmark or Fabric home
function handleOpenInFabric() {
  const url = lastSavedBookmarkUrl || DEFAULT_CONFIG.baseUrl + '/home';
  chrome.runtime.sendMessage({ action: 'openInFabric', url });
}

// Handle save playlist — saves each video individually with progress UI
async function handleSavePlaylist() {
  if (!currentPlaylistInfo || !currentPlaylistInfo.videos.length) {
    showError('Keine Playlist zum Speichern');
    return;
  }

  const videoCount = currentPlaylistInfo.videos.length;

  // Confirmation before bulk save
  if (!confirm(`${videoCount} Videos in Fabric speichern?`)) {
    return;
  }

  const credentials = await getCachedCredentials();

  if (!credentials || !credentials.apiKey) {
    showError('Bitte melde dich zuerst an');
    showLogin();
    return;
  }

  showLoading(elements.savePlaylistBtn);
  showPlaylistProgress(0, videoCount, 'Starte...');

  let saved = 0;
  let failed = 0;
  let consecutiveFailures = 0;

  try {
    for (let i = 0; i < videoCount; i++) {
      const video = currentPlaylistInfo.videos[i];
      showPlaylistProgress(i, videoCount, video.title || `Video ${i + 1}`);

      const result = await saveToFabric(video, credentials.apiKey);

      if (result.success) {
        saved++;
        consecutiveFailures = 0;
      } else {
        failed++;
        consecutiveFailures++;

        // Stop on auth error
        if (result.authExpired) {
          cachedCredentials = null;
          hidePlaylistProgress();
          hideLoading();
          showError('API Key abgelaufen. Bitte erneut anmelden.');
          showLogin();
          return;
        }

        // Circuit breaker: stop after 3 consecutive failures
        if (consecutiveFailures >= 3) {
          hidePlaylistProgress();
          hideLoading();
          showError(`Abgebrochen nach ${consecutiveFailures} Fehlern. ${saved} von ${videoCount} gespeichert.`);
          return;
        }
      }
    }

    hidePlaylistProgress();
    hideLoading();
    if (failed === 0) {
      showSuccess(`${saved} von ${videoCount} Videos gespeichert!`);
    } else {
      showError(`${saved} gespeichert, ${failed} fehlgeschlagen`);
    }
  } catch (error) {
    console.error('Error saving playlist:', error);
    hidePlaylistProgress();
    hideLoading();
    showError('Verbindungsfehler: ' + error.message);
  }
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

// Button tracking for loading state
let _loadingTriggerBtn = null;

function showLoading(triggerBtn = null) {
  _loadingTriggerBtn = triggerBtn;
  if (triggerBtn) {
    triggerBtn.disabled = true;
  } else {
    // Fallback: disable all action buttons
    elements.saveToFabricBtn.disabled = true;
    if (elements.savePlaylistBtn) elements.savePlaylistBtn.disabled = true;
  }
  elements.loading.classList.remove('hidden');
  hideMessages();
}

function hideLoading() {
  if (_loadingTriggerBtn) {
    _loadingTriggerBtn.disabled = false;
    _loadingTriggerBtn = null;
  } else {
    elements.saveToFabricBtn.disabled = false;
    if (elements.savePlaylistBtn) elements.savePlaylistBtn.disabled = false;
  }
  elements.loading.classList.add('hidden');
}

function showSuccess(message = 'Video erfolgreich in Fabric gespeichert!') {
  elements.successMessage.querySelector('span:last-child').textContent = message;
  elements.successMessage.classList.remove('hidden');

  setTimeout(() => {
    elements.successMessage.classList.add('hidden');
  }, 5000);
}

// Playlist progress helpers
function showPlaylistProgress(current, total, videoTitle) {
  if (elements.playlistProgress) {
    elements.playlistProgress.classList.remove('hidden');
  }
  if (elements.progressFill) {
    const percent = total > 0 ? Math.round(((current + 1) / total) * 100) : 0;
    elements.progressFill.style.width = `${percent}%`;
  }
  if (elements.progressText) {
    elements.progressText.textContent = `${current + 1} von ${total}: ${videoTitle}`;
  }
}

function hidePlaylistProgress() {
  if (elements.playlistProgress) {
    elements.playlistProgress.classList.add('hidden');
  }
}

function showPlaylistSection() {
  elements.videoSection?.classList.add('hidden');
  elements.noVideoSection?.classList.add('hidden');
  elements.playlistSection?.classList.remove('hidden');
}

function showError(message) {
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
