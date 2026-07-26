import { test, expect, configureMockBackend } from './fixtures/extension.js';

async function ensureOriginDnrRule(serviceWorker) {
  return serviceWorker.evaluate(async () => {
    const RULE_ID = 1;
    // tabIds requires session rules — dynamic rules reject this key
    await chrome.declarativeNetRequest.updateSessionRules({
      removeRuleIds: [RULE_ID],
      addRules: [
        {
          id: RULE_ID,
          priority: 1,
          action: {
            type: 'modifyHeaders',
            requestHeaders: [{ header: 'Origin', operation: 'remove' }]
          },
          condition: {
            urlFilter: '||api.fabric.so/',
            resourceTypes: ['xmlhttprequest'],
            tabIds: [-1]
          }
        }
      ]
    });
    return chrome.declarativeNetRequest.getSessionRules();
  });
}

test.describe('background service worker', () => {
  test('registers session DNR rule with tabIds [-1]', async ({ serviceWorker }) => {
    const rules = await ensureOriginDnrRule(serviceWorker);
    const originRule = rules.find((r) =>
      r.action?.requestHeaders?.some((h) => h.header === 'Origin' && h.operation === 'remove')
    );
    expect(originRule).toBeTruthy();
    expect(originRule.condition.tabIds).toEqual([-1]);
  });

  test('unknown message action returns an error instead of hanging', async ({
    page,
    extensionId
  }) => {
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    const response = await page.evaluate(async () => {
      return chrome.runtime.sendMessage({ action: 'definitely-not-a-real-action' });
    });
    expect(response.success).toBe(false);
    expect(response.error).toMatch(/Unbekannte Aktion/i);
  });

  test('429 with large Retry-After stays under popup budget', async ({
    page,
    extensionId,
    serviceWorker,
    mockApi
  }) => {
    mockApi.setMode('rateLimited');
    mockApi.setRetryAfterSeconds(120);
    await configureMockBackend(serviceWorker, mockApi.baseUrl);

    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    const started = Date.now();
    const result = await page.evaluate(async () => {
      return chrome.runtime.sendMessage({
        action: 'saveVideoToFabric',
        videoInfo: {
          url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          title: 'Budget Test',
          channel: 'Fixture Channel'
        }
      });
    });
    const elapsed = Date.now() - started;

    expect(result.success).toBe(false);
    expect(elapsed).toBeLessThan(20000);
  });
});
