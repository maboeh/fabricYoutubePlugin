// Options page JavaScript
import { STORAGE_KEYS, DEFAULT_CONFIG } from './shared/constants.js';

const elements = {
  apiBaseUrl: document.getElementById('api-base-url'),
  apiEndpoint: document.getElementById('api-endpoint'),
  apiKey: document.getElementById('api-key'),
  authType: document.getElementById('auth-type'),
  defaultParentId: document.getElementById('default-parent-id'),
  showFloatingButton: document.getElementById('show-floating-button'),
  showNotifications: document.getElementById('show-notifications'),
  autoCopyUrl: document.getElementById('auto-copy-url'),
  saveSettingsBtn: document.getElementById('save-settings'),
  testConnectionBtn: document.getElementById('test-connection'),
  successMessage: document.getElementById('success-message'),
  errorMessage: document.getElementById('error-message')
};

// Load settings when page opens
document.addEventListener('DOMContentLoaded', loadSettings);

// Event listeners
elements.saveSettingsBtn.addEventListener('click', saveSettings);
elements.testConnectionBtn.addEventListener('click', testConnection);

// Load settings from storage
async function loadSettings() {
  const settings = await new Promise((resolve) => {
    chrome.storage.local.get([
      STORAGE_KEYS.API_BASE_URL,
      STORAGE_KEYS.API_ENDPOINT,
      STORAGE_KEYS.API_KEY,
      STORAGE_KEYS.AUTH_TYPE,
      STORAGE_KEYS.DEFAULT_PARENT_ID,
      STORAGE_KEYS.SHOW_FLOATING_BUTTON,
      STORAGE_KEYS.SHOW_NOTIFICATIONS,
      STORAGE_KEYS.AUTO_COPY_URL
    ], resolve);
  });

  // Apply settings with defaults
  elements.apiBaseUrl.value = settings[STORAGE_KEYS.API_BASE_URL] || DEFAULT_CONFIG.apiUrl;
  elements.apiEndpoint.value = settings[STORAGE_KEYS.API_ENDPOINT] || DEFAULT_CONFIG.endpoint;
  elements.apiKey.value = settings[STORAGE_KEYS.API_KEY] || '';
  elements.authType.value = settings[STORAGE_KEYS.AUTH_TYPE] || DEFAULT_CONFIG.authType;
  elements.defaultParentId.value = settings[STORAGE_KEYS.DEFAULT_PARENT_ID] || DEFAULT_CONFIG.defaultParentId;

  elements.showFloatingButton.checked = settings[STORAGE_KEYS.SHOW_FLOATING_BUTTON] !== false;
  elements.showNotifications.checked = settings[STORAGE_KEYS.SHOW_NOTIFICATIONS] !== false;
  elements.autoCopyUrl.checked = settings[STORAGE_KEYS.AUTO_COPY_URL] === true;
}

// Save settings to storage
async function saveSettings() {
  const settings = {
    [STORAGE_KEYS.API_BASE_URL]: elements.apiBaseUrl.value.trim(),
    [STORAGE_KEYS.API_ENDPOINT]: elements.apiEndpoint.value.trim(),
    [STORAGE_KEYS.API_KEY]: elements.apiKey.value.trim(),
    [STORAGE_KEYS.AUTH_TYPE]: elements.authType.value,
    [STORAGE_KEYS.DEFAULT_PARENT_ID]: elements.defaultParentId.value.trim() || DEFAULT_CONFIG.defaultParentId,
    [STORAGE_KEYS.SHOW_FLOATING_BUTTON]: elements.showFloatingButton.checked,
    [STORAGE_KEYS.SHOW_NOTIFICATIONS]: elements.showNotifications.checked,
    [STORAGE_KEYS.AUTO_COPY_URL]: elements.autoCopyUrl.checked
  };

  try {
    await new Promise((resolve) => {
      chrome.storage.local.set(settings, resolve);
    });

    showMessage('success', 'Einstellungen erfolgreich gespeichert!');
  } catch (error) {
    showMessage('error', 'Fehler beim Speichern: ' + error.message);
  }
}

// Test API connection via background script (consistent auth handling, avoids CORS)
async function testConnection() {
  const apiKey = elements.apiKey.value.trim();

  if (!apiKey) {
    showMessage('error', 'Bitte gib einen API Key ein');
    return;
  }

  // Save settings first so background uses current config
  await saveSettings();

  elements.testConnectionBtn.textContent = 'Teste...';
  elements.testConnectionBtn.disabled = true;

  try {
    const result = await new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { action: 'validateApiKey', apiKey },
        (response) => resolve(response || { valid: false, error: 'Keine Antwort' })
      );
    });

    if (result.valid) {
      const msg = result.warning
        ? result.warning
        : 'Verbindung erfolgreich! API Key ist gültig.';
      showMessage('success', msg);
    } else {
      showMessage('error', result.error || 'Verbindung fehlgeschlagen');
    }
  } catch (error) {
    console.error('Connection test error:', error);
    showMessage('error', 'Verbindung fehlgeschlagen: ' + error.message);
  } finally {
    elements.testConnectionBtn.textContent = 'Verbindung testen';
    elements.testConnectionBtn.disabled = false;
  }
}

// Show message
function showMessage(type, text) {
  // Hide all messages
  elements.successMessage.classList.remove('show');
  elements.errorMessage.classList.remove('show');

  // Show the appropriate message
  if (type === 'success') {
    elements.successMessage.textContent = text;
    elements.successMessage.classList.add('show');
  } else {
    elements.errorMessage.textContent = text;
    elements.errorMessage.classList.add('show');
  }

  // Auto-hide after 5 seconds
  setTimeout(() => {
    elements.successMessage.classList.remove('show');
    elements.errorMessage.classList.remove('show');
  }, 5000);
}
