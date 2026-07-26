// Popup script for YouTube to Fabric Extension
import {
  STORAGE_KEYS,
  DEFAULT_CONFIG,
  TIMEOUTS,
  isYouTubeVideoUrl,
  isYouTubePlaylistUrl,
  extractVideoId,
  getThumbnailUrl,
  getStorage,
  setStorage,
  removeStorage,
  getStoredCredentials
} from './shared/constants.js';
import { api } from './shared/browser-api.js';
import { sendMessageWithTimeout } from './shared/messaging.js';

// Runtime config (can be overridden by user settings)
let config = { ...DEFAULT_CONFIG };

// Load configuration from storage
async function loadConfig() {
  try {
    const result = await getStorage([
      STORAGE_KEYS.API_BASE_URL,
      STORAGE_KEYS.API_ENDPOINT,
      STORAGE_KEYS.AUTH_TYPE
    ]);
    if (result[STORAGE_KEYS.API_BASE_URL]) {
      config.apiUrl = result[STORAGE_KEYS.API_BASE_URL];
    }
    if (result[STORAGE_KEYS.API_ENDPOINT]) {
      config.endpoint = result[STORAGE_KEYS.API_ENDPOINT];
    }
    if (result[STORAGE_KEYS.AUTH_TYPE]) {
      config.authType = result[STORAGE_KEYS.AUTH_TYPE];
    }
  } catch (error) {
    console.error('Error loading config:', error);
  }
  return config;
}

// DOM Elements
const elements = {
  loginSection: document.getElementById('login-section'),
  loggedInSection: document.getElementById('logged-in-section'),
  videoSection: document.getElementById('video-section'),
  noVideoSection: document.getElementById('no-video-section'),
  playlistSection: document.getElementById('playlist-section'),
  successMessage: document.getElementById('success-message'),
  successText: document.getElementById('success-text'),
  errorMessage: document.getElementById('error-message'),
  errorText: document.getElementById('error-text'),
  loading: document.getElementById('loading'),

  apiKeyInput: document.getElementById('api-key'),
  toggleApiKeyVisibility: document.getElementById('toggle-api-key-visibility'),
  saveCredentialsBtn: document.getElementById('save-credentials'),
  logoutBtn: document.getElementById('logout-btn'),
  openOptionsBtn: document.getElementById('open-options'),
  saveToFabricBtn: document.getElementById('save-to-fabric'),
  openInFabricBtn: document.getElementById('open-in-fabric'),
  savePlaylistBtn: document.getElementById('save-playlist'),
  playlistConfirm: document.getElementById('playlist-confirm'),
  playlistConfirmText: document.getElementById('playlist-confirm-text'),
  playlistConfirmYes: document.getElementById('playlist-confirm-yes'),
  playlistConfirmNo: document.getElementById('playlist-confirm-no'),
  shortcutHint: document.getElementById('shortcut-hint'),

  videoThumbnail: document.getElementById('video-thumbnail'),
  videoTitle: document.getElementById('video-title'),
  videoChannel: document.getElementById('video-channel'),

  customTags: document.getElementById('custom-tags'),
  customNote: document.getElementById('custom-note'),

  playlistTitle: document.getElementById('playlist-title'),
  playlistCount: document.getElementById('playlist-count'),
  playlistHint: document.getElementById('playlist-hint'),
  playlistProgress: document.getElementById('playlist-progress'),
  progressFill: document.getElementById('progress-fill'),
  progressText: document.getElementById('progress-text')
};

const PLAYLIST_HINT_DEFAULT = 'Scrolle in der Playlist um mehr Videos zu laden';
const PLAYLIST_HINT_EMPTY =
  'Keine Videos geladen. Scrolle in der Playlist oder lade die Seite neu.';
const PLAYLIST_HINT_RELOAD =
  'Playlist erkannt — bitte die YouTube-Seite neu laden (F5), damit das Plugin die Videos lesen kann.';

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
  await updateShortcutHint();
});

/**
 * Show the configured keyboard shortcut (user may have changed it in Chrome).
 */
async function updateShortcutHint() {
  if (!elements.shortcutHint || !api.commands?.getAll) {
    return;
  }
  try {
    const commands = await api.commands.getAll();
    const saveCommand = commands.find((c) => c.name === 'save-to-fabric');
    if (!saveCommand?.shortcut) {
      return;
    }
    const parts = saveCommand.shortcut.split('+').map((part) => part.trim()).filter(Boolean);
    elements.shortcutHint.replaceChildren();
    elements.shortcutHint.append('Tipp: Nutze ');
    parts.forEach((label, index) => {
      if (index > 0) {
        elements.shortcutHint.append('+');
      }
      const kbd = document.createElement('kbd');
      kbd.textContent = label;
      elements.shortcutHint.appendChild(kbd);
    });
    elements.shortcutHint.append(' als Shortcut');
  } catch (error) {
    console.warn('Could not load shortcut hint:', error);
  }
}

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

// Store credentials
async function storeCredentials(apiKey) {
  await setStorage({ [STORAGE_KEYS.API_KEY]: apiKey });
}

// Clear credentials
async function clearCredentials() {
  try {
    await removeStorage([STORAGE_KEYS.API_KEY]);
  } catch (error) {
    console.error('Error clearing credentials:', error);
  }
}

function playlistFallbackFromTab(tab) {
  return {
    isPlaylist: true,
    playlistId: null,
    playlistTitle: tab.title?.replace(' - YouTube', '') || 'Playlist',
    videos: [],
    totalVideos: null,
    visibleVideos: 0
  };
}

function setPlaylistHint(text) {
  if (elements.playlistHint) {
    elements.playlistHint.textContent = text;
  }
}

function applyPlaylistUi(info, { hint, canSave }) {
  currentPlaylistInfo = info;
  displayPlaylistInfo(info);
  showPlaylistSection();
  setPlaylistHint(hint);
  if (elements.savePlaylistBtn) {
    elements.savePlaylistBtn.disabled = !canSave;
  }
}

async function loadPlaylistForTab(tab) {
  try {
    const response = await api.tabs.sendMessage(tab.id, { action: 'getPlaylistInfo' });
    const info = response?.playlistInfo || playlistFallbackFromTab(tab);
    if (!info.playlistTitle) {
      info.playlistTitle = playlistFallbackFromTab(tab).playlistTitle;
    }
    const videoCount = info.videos?.length || 0;
    applyPlaylistUi(info, {
      hint: videoCount > 0 ? PLAYLIST_HINT_DEFAULT : PLAYLIST_HINT_EMPTY,
      canSave: videoCount > 0
    });
  } catch (_e) {
    // Content script missing (e.g. tab not reloaded after install)
    applyPlaylistUi(playlistFallbackFromTab(tab), {
      hint: PLAYLIST_HINT_RELOAD,
      canSave: false
    });
  }
}

async function loadVideoForTab(tab) {
  try {
    const response = await api.tabs.sendMessage(tab.id, { action: 'getVideoInfo' });
    if (response?.videoInfo) {
      currentVideoInfo = response.videoInfo;
      displayVideoInfo(currentVideoInfo);
      showVideoSection();
      return;
    }
  } catch (_e) {
    // Content script might not be loaded — fall back to URL metadata
  }

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
}

// Check current tab for YouTube video or playlist
async function checkCurrentTab() {
  try {
    const [tab] = await api.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url) {
      showNoVideo();
      return;
    }

    // Playlist URL: never fall through to "Kein YouTube Video"
    if (isYouTubePlaylistUrl(tab.url)) {
      await loadPlaylistForTab(tab);
      return;
    }

    if (isYouTubeVideoUrl(tab.url)) {
      await loadVideoForTab(tab);
      return;
    }

    showNoVideo();
  } catch (error) {
    console.error('Error checking current tab:', error);
    showNoVideo();
  }
}

function formatPlaylistCount(info) {
  const videoCount = Array.isArray(info.videos) ? info.videos.length : 0;
  const visible = info.visibleVideos == null ? videoCount : info.visibleVideos;
  const total = info.totalVideos;
  if (typeof total === 'number' && total > visible) {
    return `${visible} von ${total} Videos geladen`;
  }
  return `${videoCount} Videos`;
}

// Display playlist information
function displayPlaylistInfo(info) {
  if (elements.playlistTitle) {
    elements.playlistTitle.textContent = info.playlistTitle || 'Unbekannte Playlist';
  }
  if (elements.playlistCount) {
    elements.playlistCount.textContent = formatPlaylistCount(info);
  }
}

// Display video information
function displayVideoInfo(info) {
  if (elements.videoTitle) {
    elements.videoTitle.textContent = info.title || 'Unbekannter Titel';
  }
  if (elements.videoChannel) {
    elements.videoChannel.textContent = info.channel || 'YouTube';
  }

  if (elements.videoThumbnail) {
    if (info.thumbnail) {
      elements.videoThumbnail.onerror = () => {
        if (info.videoId) {
          elements.videoThumbnail.onerror = null;
          elements.videoThumbnail.src = getThumbnailUrl(info.videoId, 'mqdefault');
        } else {
          elements.videoThumbnail.style.display = 'none';
        }
      };
      elements.videoThumbnail.src = info.thumbnail;
      elements.videoThumbnail.alt = info.title ? `Thumbnail: ${info.title}` : 'Video Thumbnail';
      elements.videoThumbnail.style.display = 'block';
    } else {
      elements.videoThumbnail.style.display = 'none';
    }
  }
}

// Setup event listeners
function setupEventListeners() {
  elements.saveCredentialsBtn.addEventListener('click', handleSaveCredentials);
  elements.logoutBtn.addEventListener('click', handleLogout);
  elements.saveToFabricBtn.addEventListener('click', handleSaveToFabric);

  if (elements.openOptionsBtn) {
    elements.openOptionsBtn.addEventListener('click', () => {
      if (api.runtime.openOptionsPage) {
        api.runtime.openOptionsPage();
      }
    });
  }

  if (elements.toggleApiKeyVisibility) {
    elements.toggleApiKeyVisibility.addEventListener('click', () => {
      const isPassword = elements.apiKeyInput.type === 'password';
      elements.apiKeyInput.type = isPassword ? 'text' : 'password';
      elements.toggleApiKeyVisibility.textContent = isPassword ? 'Verbergen' : 'Anzeigen';
      elements.toggleApiKeyVisibility.setAttribute(
        'aria-label',
        isPassword ? 'API Key verbergen' : 'API Key anzeigen'
      );
    });
  }

  // Open in Fabric button
  if (elements.openInFabricBtn) {
    elements.openInFabricBtn.addEventListener('click', handleOpenInFabric);
  }

  // Save playlist button — shows inline confirmation first
  if (elements.savePlaylistBtn) {
    elements.savePlaylistBtn.addEventListener('click', showPlaylistConfirm);
  }
  if (elements.playlistConfirmYes) {
    elements.playlistConfirmYes.addEventListener('click', () => {
      hidePlaylistConfirm();
      handleSavePlaylist();
    });
  }
  if (elements.playlistConfirmNo) {
    elements.playlistConfirmNo.addEventListener('click', hidePlaylistConfirm);
  }

  // Enter key on API key input
  elements.apiKeyInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      handleSaveCredentials();
    }
  });

  // Dismiss buttons on messages
  document.querySelectorAll('.dismiss-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.closest('.message').classList.add('hidden');
    });
  });

  // Escape key closes visible messages / playlist confirm
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      hideMessages();
      hidePlaylistConfirm();
    }
  });
}

function showPlaylistConfirm() {
  if (!currentPlaylistInfo || !currentPlaylistInfo.videos.length) {
    showError('Keine Playlist zum Speichern');
    return;
  }
  const videoCount = currentPlaylistInfo.videos.length;
  if (elements.playlistConfirmText) {
    elements.playlistConfirmText.textContent = `${videoCount} Videos in Fabric speichern?`;
  }
  elements.playlistConfirm?.classList.remove('hidden');
  elements.savePlaylistBtn?.classList.add('hidden');
  elements.playlistConfirmYes?.focus();
}

function hidePlaylistConfirm() {
  elements.playlistConfirm?.classList.add('hidden');
  elements.savePlaylistBtn?.classList.remove('hidden');
}

// Validate API key via background script (avoids CORS issues)
async function validateApiKey(apiKey) {
  return sendMessageWithTimeout({ action: 'validateApiKey', apiKey }, TIMEOUTS.VALIDATE_API_KEY_MS);
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

    // Move focus to the primary action for keyboard / screen-reader users
    if (!elements.videoSection.classList.contains('hidden')) {
      elements.saveToFabricBtn?.focus();
    } else if (!elements.playlistSection?.classList.contains('hidden')) {
      elements.savePlaylistBtn?.focus();
    }
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
    const result = await saveToFabric(videoInfoWithExtras);
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
  api.runtime.sendMessage({ action: 'openInFabric', url });
}

// Handle save playlist — saves each video individually with progress UI
async function handleSavePlaylist() {
  if (!currentPlaylistInfo || !currentPlaylistInfo.videos.length) {
    showError('Keine Playlist zum Speichern');
    return;
  }

  const videoCount = currentPlaylistInfo.videos.length;

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

      const result = await saveToFabric(video);

      // Delay between saves to avoid API rate limiting
      if (i < videoCount - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }

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

// Save to Fabric via background script (avoids CORS issues; API key stays in background)
async function saveToFabric(videoInfo) {
  return sendMessageWithTimeout(
    { action: 'saveVideoToFabric', videoInfo },
    TIMEOUTS.MESSAGE_SAVE_MS
  );
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
let _loadingOrigIcon = null;
let _loadingOrigText = null;

function showLoading(triggerBtn = null) {
  _loadingTriggerBtn = triggerBtn;
  if (triggerBtn) {
    triggerBtn.disabled = true;
    const icon = triggerBtn.querySelector('.btn-icon');
    const text = triggerBtn.querySelector('.btn-text');
    _loadingOrigIcon = icon ? icon.textContent : null;
    _loadingOrigText = text ? text.textContent : null;
    if (icon) icon.textContent = '...';
    if (text) text.textContent = 'Speichern...';
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
    if (_loadingOrigIcon !== null) {
      const icon = _loadingTriggerBtn.querySelector('.btn-icon');
      if (icon) icon.textContent = _loadingOrigIcon;
    }
    if (_loadingOrigText !== null) {
      const text = _loadingTriggerBtn.querySelector('.btn-text');
      if (text) text.textContent = _loadingOrigText;
    }
    _loadingTriggerBtn = null;
    _loadingOrigIcon = null;
    _loadingOrigText = null;
  } else {
    elements.saveToFabricBtn.disabled = false;
    if (elements.savePlaylistBtn) elements.savePlaylistBtn.disabled = false;
  }
  elements.loading.classList.add('hidden');
}

let _successTimer = null;
let _errorTimer = null;

function showSuccess(message = 'Video erfolgreich in Fabric gespeichert!') {
  if (elements.successText) {
    elements.successText.textContent = message;
  }
  elements.successMessage.classList.remove('hidden');

  if (_successTimer) clearTimeout(_successTimer);
  _successTimer = setTimeout(() => {
    elements.successMessage.classList.add('hidden');
    _successTimer = null;
  }, 10000);
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

  if (_errorTimer) clearTimeout(_errorTimer);
  _errorTimer = setTimeout(() => {
    elements.errorMessage.classList.add('hidden');
    _errorTimer = null;
  }, 10000);
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
  elements.playlistSection?.classList.add('hidden');
}
