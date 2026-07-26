import { test as base, chromium, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createMockApi } from './mock-api.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../..');
const EXT_DIR = path.join(ROOT, 'dist/chrome');
const WATCH_HTML = path.join(__dirname, 'youtube-watch.html');
const PLAYLIST_HTML = path.join(__dirname, 'youtube-playlist.html');

/**
 * Ensure dist/chrome exists and can talk to the local mock API.
 * host_permissions normally only cover api.fabric.so — tests need 127.0.0.1.
 */
function prepareExtensionForTests() {
  if (!fs.existsSync(path.join(EXT_DIR, 'manifest.json'))) {
    throw new Error(
      `Extension build missing at ${EXT_DIR}. Run "npm run build:chrome" first.`
    );
  }
  const manifestPath = path.join(EXT_DIR, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const hosts = new Set(manifest.host_permissions || []);
  hosts.add('http://127.0.0.1/*');
  hosts.add('http://localhost/*');
  manifest.host_permissions = [...hosts];
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
}

async function getServiceWorker(context) {
  let [serviceWorker] = context.serviceWorkers();
  if (!serviceWorker) {
    serviceWorker = await context.waitForEvent('serviceworker');
  }
  return serviceWorker;
}

export const test = base.extend({
  // eslint-disable-next-line no-empty-pattern
  mockApi: async ({}, use) => {
    const mock = createMockApi();
    const { baseUrl } = await mock.start();
    await use({ ...mock, baseUrl });
    await mock.stop();
  },

  // eslint-disable-next-line no-empty-pattern
  context: async ({}, use) => {
    prepareExtensionForTests();
    const userDataDir = path.join(
      ROOT,
      `.pw-user-data-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    const context = await chromium.launchPersistentContext(userDataDir, {
      channel: 'chromium',
      headless: true,
      args: [
        `--disable-extensions-except=${EXT_DIR}`,
        `--load-extension=${EXT_DIR}`
      ]
    });

    // Serve fixture HTML under real YouTube URLs so content_scripts.matches fire
    await context.route('https://www.youtube.com/watch**', async (route) => {
      const html = fs.readFileSync(WATCH_HTML, 'utf8');
      await route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: html
      });
    });
    await context.route('https://www.youtube.com/playlist**', async (route) => {
      const html = fs.readFileSync(PLAYLIST_HTML, 'utf8');
      await route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: html
      });
    });
    // Avoid noise from YouTube assets
    await context.route('https://www.youtube.com/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/watch') || url.includes('/playlist')) {
        await route.fallback();
        return;
      }
      await route.fulfill({ status: 204, body: '' });
    });

    await use(context);
    await context.close();
    fs.rmSync(userDataDir, { recursive: true, force: true });
  },

  extensionId: async ({ context }, use) => {
    const serviceWorker = await getServiceWorker(context);
    const extensionId = serviceWorker.url().split('/')[2];
    await use(extensionId);
  },

  serviceWorker: async ({ context }, use) => {
    const serviceWorker = await getServiceWorker(context);
    await use(serviceWorker);
  }
});

export { expect };

/**
 * Seed chrome.storage.local via the extension service worker.
 */
export async function seedStorage(serviceWorker, values) {
  await serviceWorker.evaluate(async (data) => {
    await chrome.storage.local.set(data);
  }, values);
}

/**
 * Read chrome.storage.local keys via the service worker.
 */
export async function readStorage(serviceWorker, keys) {
  return serviceWorker.evaluate(async (keyList) => {
    return chrome.storage.local.get(keyList);
  }, keys);
}

/**
 * Point the extension at the mock API and optionally set an API key.
 */
export async function configureMockBackend(serviceWorker, mockBaseUrl, apiKey = 'test-api-key') {
  await seedStorage(serviceWorker, {
    fabricApiBaseUrl: mockBaseUrl,
    fabricApiEndpoint: '/v2/bookmarks',
    fabricAuthType: 'apikey',
    fabricApiKey: apiKey,
    fabricShowFloatingButton: true,
    fabricShowNotifications: false,
    fabricAutoCopyUrl: false
  });
}

export async function clearCredentials(serviceWorker) {
  await serviceWorker.evaluate(async () => {
    await chrome.storage.local.remove(['fabricApiKey']);
  });
}
