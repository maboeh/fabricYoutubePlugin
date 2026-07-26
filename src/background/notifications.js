// Notifications and clipboard helpers for the service worker
import { api } from '../shared/browser-api.js';
import { getStoredSettings } from './settings.js';

export async function showNotification(title, message) {
  const settings = await getStoredSettings();

  if (!settings.showNotifications) {
    return;
  }

  if (api.notifications) {
    // Fixed ID so later notifications replace earlier ones instead of stacking
    api.notifications.create('fabric-save', {
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: title,
      message: message
    });
  }
}

/** Copy text via a tab script (service workers have no clipboard API). */
export async function copyToClipboard(text, tabId) {
  try {
    const results = await api.scripting.executeScript({
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

    if (results && results[0] && results[0].result && results[0].result.success) {
      return true;
    }
    return false;
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    return false;
  }
}

export async function maybeAutoCopy(result, tabId) {
  if (!result.success || !result.bookmarkUrl || tabId == null) {
    return;
  }
  const settings = await getStoredSettings();
  if (settings.autoCopyUrl) {
    await copyToClipboard(result.bookmarkUrl, tabId);
  }
}
