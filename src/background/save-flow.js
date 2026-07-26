// Save flows: shortcut, context menu, shared video helpers
import {
  isYouTubeVideoUrl,
  extractVideoId,
  getStoredCredentials
} from '../shared/constants.js';
import { api } from '../shared/browser-api.js';
import { saveToFabric } from './fabric-api.js';
import { showNotification, maybeAutoCopy } from './notifications.js';

async function resolveActiveTab() {
  const [tab] = await api.tabs.query({ active: true, currentWindow: true });

  if (!tab || !tab.url) {
    await showNotification('Fehler', 'Kein aktiver Tab gefunden');
    return { ok: false, error: 'Kein aktiver Tab' };
  }

  if (!isYouTubeVideoUrl(tab.url)) {
    await showNotification('Kein YouTube Video', 'Bitte öffne ein YouTube Video');
    return { ok: false, error: 'Kein YouTube Video' };
  }

  const credentials = await getStoredCredentials();
  if (!credentials || !credentials.apiKey) {
    await showNotification('Nicht angemeldet', 'Bitte öffne das Plugin und melde dich an');
    return { ok: false, error: 'Nicht angemeldet' };
  }

  return { ok: true, tab, credentials };
}

async function getVideoInfoForTab(tab) {
  try {
    const response = await api.tabs.sendMessage(tab.id, { action: 'getVideoInfo' });
    return response.videoInfo;
  } catch (_e) {
    return buildFallbackVideoInfo(tab.url, tab);
  }
}

async function notifySaveOutcome(result, videoInfo, tabId) {
  if (result.success) {
    const titleLabel = videoInfo?.title
      ? `"${videoInfo.title}" wurde in Fabric gespeichert`
      : 'Video wurde in Fabric gespeichert';
    await showNotification('Gespeichert!', titleLabel);
    await maybeAutoCopy(result, tabId);
    return { success: true, bookmarkUrl: result.bookmarkUrl };
  }

  const errorMsg = result.error || 'Unbekannter Fehler';
  console.error('Save to Fabric failed:', errorMsg);
  await showNotification('Fehler', `Speichern fehlgeschlagen: ${errorMsg}`);
  return { success: false, error: errorMsg };
}

export async function handleSaveShortcut() {
  try {
    const resolved = await resolveActiveTab();
    if (!resolved.ok) {
      return { success: false, error: resolved.error };
    }

    const { tab, credentials } = resolved;
    const videoInfo = await getVideoInfoForTab(tab);

    await showNotification('Speichern...', 'Video wird in Fabric gespeichert');
    const result = await saveToFabric(videoInfo, credentials.apiKey);
    return notifySaveOutcome(result, videoInfo, tab.id);
  } catch (error) {
    console.error('Error in shortcut handler:', error);
    await showNotification('Fehler', 'Ein Fehler ist aufgetreten');
    return { success: false, error: error.message };
  }
}

function buildFallbackVideoInfo(url, tab) {
  return {
    url,
    title: tab?.title?.replace(' - YouTube', '') || 'YouTube Video',
    videoId: extractVideoId(url),
    channel: 'YouTube'
  };
}

async function requireCredentialsForSave() {
  const credentials = await getStoredCredentials();
  if (!credentials?.apiKey) {
    await showNotification('Nicht angemeldet', 'Bitte öffne das Plugin und melde dich an');
    return null;
  }
  return credentials;
}

export async function handleContextMenuSave(info, tab) {
  if (info.menuItemId !== 'save-to-fabric') {
    return;
  }

  const url = info.linkUrl || info.pageUrl;
  if (!url) {
    await showNotification('Fehler', 'Keine URL gefunden');
    return;
  }
  if (!isYouTubeVideoUrl(url)) {
    await showNotification('Kein YouTube Video', 'Dieser Link ist kein YouTube Video');
    return;
  }

  const credentials = await requireCredentialsForSave();
  if (!credentials) {
    return;
  }

  const result = await saveToFabric(buildFallbackVideoInfo(url, tab), credentials.apiKey);
  if (result.success) {
    await showNotification('Gespeichert!', 'Video wurde in Fabric gespeichert');
  } else {
    await showNotification('Fehler', 'Konnte nicht speichern. Öffne das Plugin für Details.');
  }
}

export async function saveVideoWithStoredCredentials(videoInfo, tabId) {
  const credentials = await getStoredCredentials();
  if (!credentials || !credentials.apiKey) {
    // No key stored yet — not the same as API 401 (authExpired).
    return { success: false, error: 'Nicht angemeldet' };
  }
  const result = await saveToFabric(videoInfo, credentials.apiKey);
  await maybeAutoCopy(result, tabId);
  return result;
}
