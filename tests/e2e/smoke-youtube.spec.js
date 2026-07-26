import { test, expect, seedStorage } from './fixtures/extension.js';

/**
 * Optional smoke against real YouTube. Excluded from default `npm run test:e2e`
 * via --grep-invert @smoke. Run with: npm run test:e2e:smoke
 */
test.describe('real YouTube smoke @smoke', () => {
  test('injects floating button and reads a title @smoke', async ({
    page,
    serviceWorker,
    context
  }) => {
    // Do not use fixture routes for this file — clear routes by using a fresh page
    // against the real network. The shared fixture still installs youtube.com routes,
    // so we unroute first.
    await context.unroute('https://www.youtube.com/watch**');
    await context.unroute('https://www.youtube.com/playlist**');
    await context.unroute('https://www.youtube.com/**');

    await seedStorage(serviceWorker, { fabricShowFloatingButton: true });
    await page.goto('https://www.youtube.com/watch?v=dQw4w9WgXcQ', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    await expect(page.locator('#fabric-save-button')).toBeVisible({ timeout: 30000 });

    const title = await page.evaluate(() => {
      const el =
        document.querySelector('h1.ytd-watch-metadata yt-formatted-string') ||
        document.querySelector('h1 yt-formatted-string') ||
        document.querySelector('meta[name="title"]');
      return el?.textContent || el?.content || document.title;
    });
    expect(title && title.length).toBeGreaterThan(0);
  });
});
