import { test, expect, seedStorage, configureMockBackend } from './fixtures/extension.js';

test.describe('content script floating button', () => {
  test('shows Fabric button on watch fixture', async ({ page, serviceWorker }) => {
    await seedStorage(serviceWorker, { fabricShowFloatingButton: true });
    await page.goto('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    await expect(page.locator('#fabric-save-button')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('#fabric-save-button span')).toHaveText('Fabric');
  });

  test('hides button when setting is disabled', async ({ page, serviceWorker }) => {
    await seedStorage(serviceWorker, { fabricShowFloatingButton: false });
    await page.goto('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    await page.waitForTimeout(800);
    await expect(page.locator('#fabric-save-button')).toHaveCount(0);
  });

  test('recreates button after SPA navigation event', async ({ page, serviceWorker }) => {
    await seedStorage(serviceWorker, { fabricShowFloatingButton: true });
    await page.goto('https://www.youtube.com/watch?v=aaaaaaaaaaa');
    await expect(page.locator('#fabric-save-button')).toBeVisible({ timeout: 15000 });

    await page.evaluate(() => {
      history.pushState({}, '', '/watch?v=bbbbbbbbbbb');
      document.dispatchEvent(new CustomEvent('yt-navigate-finish'));
    });

    await expect(page.locator('#fabric-save-button')).toBeVisible({ timeout: 15000 });
  });

  test('keeps button after back navigation (bfcache regression)', async ({ page, serviceWorker }) => {
    await seedStorage(serviceWorker, { fabricShowFloatingButton: true });
    await page.goto('https://www.youtube.com/watch?v=aaaaaaaaaaa');
    await expect(page.locator('#fabric-save-button')).toBeVisible({ timeout: 15000 });

    await page.goto('https://www.youtube.com/watch?v=bbbbbbbbbbb');
    await expect(page.locator('#fabric-save-button')).toBeVisible({ timeout: 15000 });

    await page.goBack();
    await expect(page.locator('#fabric-save-button')).toBeVisible({ timeout: 15000 });
  });

  test('reads fixture metadata from the page DOM', async ({ page, serviceWorker }) => {
    await seedStorage(serviceWorker, { fabricShowFloatingButton: true });
    await page.goto('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    await expect(page.locator('#fabric-save-button')).toBeVisible({ timeout: 15000 });

    const info = await page.evaluate(() => ({
      title: document.querySelector('h1 yt-formatted-string')?.textContent || null,
      channel: document.querySelector('#channel-name a')?.textContent || null
    }));

    expect(info.title).toBe('Fixture Video Title');
    expect(info.channel).toBe('Fixture Channel');
  });

  test('saves via floating button against mock API', async ({ page, serviceWorker, mockApi }) => {
    mockApi.setMode('success');
    await configureMockBackend(serviceWorker, mockApi.baseUrl);
    await page.goto('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    await expect(page.locator('#fabric-save-button')).toBeVisible({ timeout: 15000 });
    await page.click('#fabric-save-button');
    await expect(page.locator('#fabric-save-button span')).toHaveText('Gespeichert!', {
      timeout: 15000
    });
    expect(mockApi.getLastRequest()?.url).toBe('/v2/bookmarks');
    expect(mockApi.getLastRequest()?.body?.name).toBe('Fixture Video Title');
  });
});

test.describe('content script playlist scraping', () => {
  test('reads legacy and lockup playlist videos with dedup', async ({ page, serviceWorker }) => {
    await page.goto('https://www.youtube.com/playlist?list=PLtest');
    await expect(page.locator('h1#title')).toBeVisible({ timeout: 15000 });

    const response = await serviceWorker.evaluate(async () => {
      const tabs = await chrome.tabs.query({ url: 'https://www.youtube.com/playlist*' });
      if (!tabs[0]?.id) return null;
      return chrome.tabs.sendMessage(tabs[0].id, { action: 'getPlaylistInfo' });
    });

    expect(response?.playlistInfo?.isPlaylist).toBe(true);
    expect(response.playlistInfo.playlistTitle).toBe('Fixture Playlist Title');
    const ids = response.playlistInfo.videos.map((v) => v.videoId).sort();
    // Legacy a+b, lockup unique c; lockup duplicate of a is dropped
    expect(ids).toEqual(['aaaaaaaaaaa', 'bbbbbbbbbbb', 'ccccccccccc']);
    expect(response.playlistInfo.visibleVideos).toBe(3);
  });

  test('scrapes lockup-only playlist markup when legacy rows are absent', async ({
    page,
    serviceWorker
  }) => {
    await page.goto('https://www.youtube.com/playlist?list=PLtest');
    await expect(page.locator('yt-lockup-view-model').first()).toBeVisible({ timeout: 15000 });

    await page.evaluate(() => {
      document.querySelectorAll('ytd-playlist-video-renderer').forEach((el) => el.remove());
    });

    const response = await serviceWorker.evaluate(async () => {
      const tabs = await chrome.tabs.query({ url: 'https://www.youtube.com/playlist*' });
      if (!tabs[0]?.id) return null;
      return chrome.tabs.sendMessage(tabs[0].id, { action: 'getPlaylistInfo' });
    });

    const ids = response.playlistInfo.videos.map((v) => v.videoId).sort();
    expect(ids).toEqual(['aaaaaaaaaaa', 'ccccccccccc']);
    expect(
      response.playlistInfo.videos.find((v) => v.videoId === 'ccccccccccc')?.title
    ).toContain('Playlist Video 3 Lockup');
  });
});
