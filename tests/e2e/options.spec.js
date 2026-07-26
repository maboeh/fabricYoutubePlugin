import { test, expect, seedStorage, readStorage } from './fixtures/extension.js';

test.describe('options page', () => {
  test('rejects http API base URL on save', async ({ page, extensionId }) => {
    await page.goto(`chrome-extension://${extensionId}/options.html`);
    await page.fill('#api-base-url', 'http://api.fabric.so');
    await page.fill('#api-key', 'dummy-key');
    await page.click('#save-settings');
    await expect(page.locator('#error-message')).toBeVisible();
    await expect(page.locator('#error-message')).toContainText('https');
  });

  test('normalizes trailing slash when saving', async ({ page, extensionId, serviceWorker }) => {
    await page.goto(`chrome-extension://${extensionId}/options.html`);
    await page.fill('#api-base-url', 'https://api.fabric.so/');
    await page.fill('#api-endpoint', '/v2/bookmarks');
    await page.fill('#api-key', 'dummy-key');
    await page.click('#save-settings');
    await expect(page.locator('#success-message')).toBeVisible();
    await expect(page.locator('#api-base-url')).toHaveValue('https://api.fabric.so');

    const stored = await readStorage(serviceWorker, ['fabricApiBaseUrl']);
    expect(stored.fabricApiBaseUrl).toBe('https://api.fabric.so');
  });

  test('connection test does not persist form values', async ({
    page,
    extensionId,
    serviceWorker
  }) => {
    await seedStorage(serviceWorker, {
      fabricApiBaseUrl: 'https://api.fabric.so',
      fabricApiEndpoint: '/v2/bookmarks',
      fabricAuthType: 'apikey',
      fabricApiKey: 'old-key'
    });

    await page.goto(`chrome-extension://${extensionId}/options.html`);
    await page.fill('#api-base-url', 'https://example.invalid');
    await page.fill('#api-key', 'probe-key');
    await page.click('#test-connection');
    await expect(page.locator('#error-message')).toBeVisible({ timeout: 20000 });

    const stored = await readStorage(serviceWorker, [
      'fabricApiBaseUrl',
      'fabricApiKey',
      'fabricApiEndpoint',
      'fabricAuthType'
    ]);
    expect(stored.fabricApiBaseUrl).toBe('https://api.fabric.so');
    expect(stored.fabricApiKey).toBe('old-key');
  });
});
