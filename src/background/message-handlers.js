// Message action handlers for the service worker
import { isYouTubeVideoUrl } from '../shared/constants.js';
import { api } from '../shared/browser-api.js';
import { validateApiKey } from './fabric-api.js';
import { handleSaveShortcut, saveVideoWithStoredCredentials } from './save-flow.js';

function handleOpenInFabric(request) {
  const url = request.url;
  const isFabricUrl = url && (
    url === 'https://fabric.so' || url.startsWith('https://fabric.so/') ||
    url === 'https://app.fabric.so' || url.startsWith('https://app.fabric.so/')
  );
  if (isFabricUrl) {
    api.tabs.create({ url });
    return { success: true };
  }
  console.warn('Blocked openInFabric with invalid URL:', url);
  return { success: false, error: 'Ungültige URL' };
}

export const handlers = {
  saveToFabric: () => handleSaveShortcut(),

  validateApiKey: (req) => validateApiKey(req.apiKey, req.configOverride),

  saveVideoToFabric: (req, sender) => {
    if (!isYouTubeVideoUrl(req.videoInfo?.url)) {
      return { success: false, error: 'Keine gültige YouTube URL' };
    }
    return saveVideoWithStoredCredentials(req.videoInfo, sender.tab?.id ?? null);
  },

  saveFromContentScript: (req, sender) => {
    const videoInfo = req.videoInfo;
    if (!videoInfo || !isYouTubeVideoUrl(videoInfo.url)) {
      return { success: false, error: 'Keine gültige YouTube URL' };
    }
    return saveVideoWithStoredCredentials(videoInfo, sender.tab?.id ?? null);
  },

  openInFabric: (req) => handleOpenInFabric(req)
};
