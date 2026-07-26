// Extension install/startup setup: context menu + DNR session rules
import { api } from '../shared/browser-api.js';

const DNR_RULE_ID = 1;

export function ensureContextMenu() {
  api.contextMenus.removeAll(() => {
    // Ignore removeAll errors (e.g. menu already empty)
    void api.runtime.lastError;
    api.contextMenus.create({
      id: 'save-to-fabric',
      title: 'In Fabric speichern',
      contexts: ['page', 'link'],
      documentUrlPatterns: [
        'https://www.youtube.com/*',
        'https://youtube.com/*'
      ]
    }, () => {
      if (api.runtime.lastError) {
        console.warn('Context menu create failed:', api.runtime.lastError.message);
      }
    });
  });
}

/**
 * Remove Origin only for extension-originated requests (tabId -1).
 * tabIds is only allowed on session rules (not updateDynamicRules).
 */
export async function ensureDnrRules() {
  if (!api.declarativeNetRequest?.updateSessionRules) {
    return;
  }
  try {
    await api.declarativeNetRequest.updateSessionRules({
      removeRuleIds: [DNR_RULE_ID],
      addRules: [
        {
          id: DNR_RULE_ID,
          priority: 1,
          action: {
            type: 'modifyHeaders',
            requestHeaders: [
              { header: 'Origin', operation: 'remove' }
            ]
          },
          condition: {
            urlFilter: '||api.fabric.so/',
            resourceTypes: ['xmlhttprequest'],
            tabIds: [-1]
          }
        }
      ]
    });
  } catch (error) {
    console.warn('Failed to register DNR session rules:', error);
  }
}

export function onExtensionReady() {
  ensureContextMenu();
  ensureDnrRules();
}
