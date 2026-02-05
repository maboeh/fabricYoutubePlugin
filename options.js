// Options page JavaScript

const elements = {
  apiBaseUrl: document.getElementById('api-base-url'),
  apiEndpoint: document.getElementById('api-endpoint'),
  apiKey: document.getElementById('api-key'),
  authType: document.getElementById('auth-type'),
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
      'fabricApiBaseUrl',
      'fabricApiEndpoint',
      'fabricApiKey',
      'fabricAuthType',
      'fabricShowFloatingButton',
      'fabricShowNotifications',
      'fabricAutoCopyUrl'
    ], resolve);
  });

  if (settings.fabricApiBaseUrl) {
    elements.apiBaseUrl.value = settings.fabricApiBaseUrl;
  }

  if (settings.fabricApiEndpoint) {
    elements.apiEndpoint.value = settings.fabricApiEndpoint;
  }

  if (settings.fabricApiKey) {
    elements.apiKey.value = settings.fabricApiKey;
  }

  if (settings.fabricAuthType) {
    elements.authType.value = settings.fabricAuthType;
  }

  elements.showFloatingButton.checked = settings.fabricShowFloatingButton !== false;
  elements.showNotifications.checked = settings.fabricShowNotifications !== false;
  elements.autoCopyUrl.checked = settings.fabricAutoCopyUrl === true;
}

// Save settings to storage
async function saveSettings() {
  const settings = {
    fabricApiBaseUrl: elements.apiBaseUrl.value.trim(),
    fabricApiEndpoint: elements.apiEndpoint.value.trim(),
    fabricApiKey: elements.apiKey.value.trim(),
    fabricAuthType: elements.authType.value,
    fabricShowFloatingButton: elements.showFloatingButton.checked,
    fabricShowNotifications: elements.showNotifications.checked,
    fabricAutoCopyUrl: elements.autoCopyUrl.checked
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

// Test API connection
async function testConnection() {
  const baseUrl = elements.apiBaseUrl.value.trim();
  const endpoint = elements.apiEndpoint.value.trim();
  const apiKey = elements.apiKey.value.trim();
  const authType = elements.authType.value;

  if (!apiKey) {
    showMessage('error', 'Bitte gib einen API Token ein');
    return;
  }

  elements.testConnectionBtn.textContent = 'Teste...';
  elements.testConnectionBtn.disabled = true;

  try {
    // Build headers based on auth type
    const headers = {
      'Content-Type': 'application/json'
    };

    switch (authType) {
      case 'bearer':
        headers['Authorization'] = `Bearer ${apiKey}`;
        break;
      case 'apikey':
        headers['X-API-Key'] = apiKey;
        break;
      case 'cookie':
        // Cookie-based auth will use credentials: 'include'
        break;
    }

    // Try a simple test request
    const testUrl = `${baseUrl}${endpoint}`;

    // Send a test request (OPTIONS or HEAD to check if endpoint exists)
    const response = await fetch(testUrl, {
      method: 'OPTIONS',
      headers: headers,
      credentials: authType === 'cookie' ? 'include' : 'omit'
    });

    if (response.ok || response.status === 204 || response.status === 405) {
      // 405 = Method Not Allowed, but endpoint exists
      showMessage('success', 'Verbindung erfolgreich! API ist erreichbar.');
    } else if (response.status === 401 || response.status === 403) {
      showMessage('error', 'Authentifizierung fehlgeschlagen. Bitte Token prüfen.');
    } else {
      showMessage('error', `API antwortet mit Status ${response.status}`);
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
