// Background Service Worker entry — listeners only
import { api } from './shared/browser-api.js';
import { handlers } from './background/message-handlers.js';
import { handleSaveShortcut, handleContextMenuSave } from './background/save-flow.js';
import { onExtensionReady } from './background/setup.js';
import { registerSettingsCacheInvalidation } from './background/settings.js';

registerSettingsCacheInvalidation();

api.commands.onCommand.addListener(async (command) => {
  if (command === 'save-to-fabric') {
    await handleSaveShortcut();
  }
});

api.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const handler = handlers[request.action];
  if (!handler) {
    console.warn('Unknown message action:', request.action);
    sendResponse({
      success: false,
      error: `Unbekannte Aktion: ${request.action || 'keine'}`
    });
    return true;
  }

  Promise.resolve(handler(request, sender))
    .then(sendResponse)
    .catch((error) => {
      // validateApiKey callers expect { valid }, not { success }
      if (request.action === 'validateApiKey') {
        sendResponse({ valid: false, error: error.message });
        return;
      }
      sendResponse({ success: false, error: error.message });
    });
  return true;
});

api.runtime.onInstalled.addListener(onExtensionReady);
api.runtime.onStartup.addListener(onExtensionReady);
api.contextMenus.onClicked.addListener(handleContextMenuSave);
