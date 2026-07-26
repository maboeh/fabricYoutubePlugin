// Content Script for YouTube pages
// Extracts video information from the YouTube page
//
// NOTE: Content Scripts cannot use ES6 modules.
// Inline polyfill matching shared/browser-api.js logic.
//
// Storage keys used here MUST match shared/constants.js STORAGE_KEYS:
//   - 'fabricShowFloatingButton' = STORAGE_KEYS.SHOW_FLOATING_BUTTON

(function() {
  'use strict';

  // Cross-browser API polyfill (inline version of shared/browser-api.js)
  const api = (typeof browser !== 'undefined' && browser.runtime) ? browser : chrome;

  // UI Constants (content.js can't import ES6 modules)
  const BUTTON_ID = 'fabric-save-button';
  const BUTTON_TEXT = 'Fabric';
  const BUTTON_SAVING_TEXT = 'Speichern...';
  const BUTTON_SAVED_TEXT = 'Gespeichert!';
  const BUTTON_ERROR_TEXT = 'Fehler';
  const BUTTON_AUTH_ERROR_TEXT = 'Login!';
  const STORAGE_KEY_FLOATING_BUTTON = 'fabricShowFloatingButton';

  // Settings cache
  let settings = {
    showFloatingButton: true
  };

  // State for cleanup and debouncing
  let addButtonTimeout = null;
  let playerCheckTimer = null;
  let playerCheckCount = 0;
  let buttonResetTimer = null;
  let _onNavigateHandler = null;
  let _initialized = false;
  const PLAYER_CHECK_MAX = 5;
  const PLAYER_CHECK_INTERVAL = 300; // ms

  // Load settings from storage, then run callback (avoids floating-button flash)
  // Key must match STORAGE_KEYS.SHOW_FLOATING_BUTTON in shared/constants.js
  function loadSettings(onReady) {
    api.storage.local.get([STORAGE_KEY_FLOATING_BUTTON], (result) => {
      settings.showFloatingButton = result[STORAGE_KEY_FLOATING_BUTTON] !== false;
      updateFloatingButtonVisibility();
      if (typeof onReady === 'function') {
        onReady();
      }
    });
  }

  // Listen for settings changes (named function for cleanup)
  // Key must match STORAGE_KEYS.SHOW_FLOATING_BUTTON in shared/constants.js
  function onStorageChanged(changes, namespace) {
    if (namespace === 'local' && changes[STORAGE_KEY_FLOATING_BUTTON]) {
      settings.showFloatingButton = changes[STORAGE_KEY_FLOATING_BUTTON].newValue !== false;
      updateFloatingButtonVisibility();
    }
  }
  api.storage.onChanged.addListener(onStorageChanged);

  // Update floating button visibility based on settings
  function updateFloatingButtonVisibility() {
    const button = document.getElementById(BUTTON_ID);
    if (button) {
      button.style.display = settings.showFloatingButton ? 'flex' : 'none';
    }
  }

  // Get video information from the current YouTube page
  function getVideoInfo() {
    const info = {
      url: window.location.href,
      title: null,
      channel: null,
      videoId: null,
      thumbnail: null,
      description: null,
      duration: null
    };

    try {
      // Extract video ID from URL
      const urlParams = new URLSearchParams(window.location.search);
      info.videoId = urlParams.get('v');

      // Handle YouTube Shorts
      const shortsMatch = window.location.pathname.match(/\/shorts\/([^/?]+)/);
      if (shortsMatch) {
        info.videoId = shortsMatch[1];
      }

      // Get title (with fallback chain)
      const titleElement = document.querySelector('h1.ytd-video-primary-info-renderer yt-formatted-string') ||
                           document.querySelector('h1.ytd-watch-metadata yt-formatted-string') ||
                           document.querySelector('h1.title') ||
                           document.querySelector('[itemprop="name"]') ||
                           document.querySelector('meta[name="title"]');

      if (titleElement) {
        info.title = titleElement.textContent || titleElement.content;
      } else {
        // Fallback to document title
        info.title = document.title.replace(' - YouTube', '');
      }

      // Get channel name
      const channelElement = document.querySelector('#channel-name a') ||
                             document.querySelector('ytd-channel-name a') ||
                             document.querySelector('[itemprop="author"] [itemprop="name"]') ||
                             document.querySelector('.ytd-channel-name');

      if (channelElement) {
        info.channel = channelElement.textContent?.trim();
      }

      // Get thumbnail (hqdefault is more reliable than maxresdefault)
      if (info.videoId) {
        info.thumbnail = `https://img.youtube.com/vi/${info.videoId}/hqdefault.jpg`;
      }

      // Get description (first 200 characters)
      const descriptionElement = document.querySelector('#description-inner') ||
                                 document.querySelector('meta[name="description"]');

      if (descriptionElement) {
        const desc = descriptionElement.textContent || descriptionElement.content;
        info.description = desc?.substring(0, 200);
      }

      // Get duration
      const durationElement = document.querySelector('.ytp-time-duration');
      if (durationElement) {
        info.duration = durationElement.textContent;
      }
    } catch (error) {
      console.error('Error extracting video info:', error);
    }

    return info;
  }

  // Check if current page is a dedicated playlist page (not video in playlist)
  function isPlaylistPage() {
    return window.location.pathname === '/playlist';
  }

  function extractVideoIdFromHref(href) {
    if (!href) return null;
    const match = href.match(/[?&]v=([A-Za-z0-9_-]{11})/);
    return match ? match[1] : null;
  }

  function cleanWatchUrl(href) {
    try {
      const url = new URL(href, window.location.origin);
      const videoId = url.searchParams.get('v');
      if (!videoId) return href.split('&list=')[0];
      return `https://www.youtube.com/watch?v=${videoId}`;
    } catch {
      return href.split('&list=')[0];
    }
  }

  function pushUniquePlaylistVideo(videos, seen, entry) {
    if (!entry.videoId || seen.has(entry.videoId)) {
      return;
    }
    seen.add(entry.videoId);
    videos.push(entry);
  }

  function queryFirstText(selectors) {
    for (const selector of selectors) {
      const text = document.querySelector(selector)?.textContent?.trim();
      if (text) return text;
    }
    return null;
  }

  function parsePlaylistTotalVideos() {
    const statsText = queryFirstText([
      'yt-formatted-string.ytd-playlist-sidebar-primary-info-renderer',
      '.metadata-stats',
      '.yt-content-metadata-view-model__metadata-row'
    ]);
    if (!statsText) return null;
    const countMatch = statsText.match(/(\d+)\s*(videos?|Videos?)/i);
    return countMatch ? parseInt(countMatch[1], 10) : null;
  }

  function buildPlaylistVideoEntry(href, title, channel, index) {
    const videoId = extractVideoIdFromHref(href);
    return {
      url: cleanWatchUrl(href),
      title: title || `Video ${index + 1}`,
      videoId,
      channel: channel || 'YouTube',
      thumbnail: videoId ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` : null
    };
  }

  function scrapeLegacyPlaylistVideos(videos, seen) {
    document.querySelectorAll('ytd-playlist-video-renderer').forEach((element, index) => {
      const linkElement = element.querySelector('a#video-title');
      if (!linkElement?.href) return;
      const channel =
        element.querySelector('ytd-channel-name a')?.textContent?.trim() ||
        element.querySelector('.ytd-channel-name')?.textContent?.trim();
      pushUniquePlaylistVideo(
        videos,
        seen,
        buildPlaylistVideoEntry(
          linkElement.href,
          linkElement.textContent?.trim(),
          channel,
          index
        )
      );
    });
  }

  function queryChildText(root, selectors) {
    for (const selector of selectors) {
      const text = root.querySelector(selector)?.textContent?.trim();
      if (text) return text;
    }
    return null;
  }

  function scrapeOneLockup(element, index, videos, seen) {
    const link = element.querySelector('a[href*="watch?v="]');
    if (!link?.href) return;
    const title = queryChildText(element, [
      '.yt-lockup-metadata-view-model__title',
      '.ytLockupMetadataViewModelTitle',
      'a[href*="watch?v="] span'
    ]) || link.textContent?.trim();
    const channel = queryChildText(element, [
      '.yt-content-metadata-view-model__metadata-text',
      '.ytContentMetadataViewModelMetadataText'
    ]);
    pushUniquePlaylistVideo(
      videos,
      seen,
      buildPlaylistVideoEntry(link.href, title, channel, index)
    );
  }

  function scrapeLockupPlaylistVideos(videos, seen) {
    const lockups = document.querySelectorAll(
      'yt-lockup-view-model, .ytLockupViewModelHost, ytd-rich-item-renderer yt-lockup-view-model'
    );
    lockups.forEach((element, index) => {
      scrapeOneLockup(element, index, videos, seen);
    });
  }

  /** Last-resort: any watch links in the playlist contents area. */
  function scrapeFallbackWatchLinks(videos, seen) {
    if (videos.length > 0) return;

    const container =
      document.querySelector('ytd-playlist-video-list-renderer') ||
      document.querySelector('#contents.ytd-section-list-renderer') ||
      document.querySelector('ytd-section-list-renderer') ||
      document.body;

    container.querySelectorAll('a[href*="watch?v="]').forEach((link, index) => {
      pushUniquePlaylistVideo(
        videos,
        seen,
        buildPlaylistVideoEntry(link.href, link.textContent?.trim(), 'YouTube', index)
      );
    });
  }

  // Get playlist information
  function getPlaylistInfo() {
    const info = {
      isPlaylist: isPlaylistPage(),
      playlistId: null,
      playlistTitle: null,
      videos: [],
      totalVideos: null,
      visibleVideos: 0
    };

    if (!info.isPlaylist) return info;

    try {
      info.playlistId = new URLSearchParams(window.location.search).get('list');
      info.playlistTitle = queryFirstText([
        'h1#title a.yt-simple-endpoint',
        'yt-formatted-string.ytd-playlist-header-renderer',
        'h1.ytd-playlist-header-renderer',
        '#page-header h1',
        'yt-dynamic-text-view-model',
        'h1.dynamicTextViewModelH1'
      ]);
      info.totalVideos = parsePlaylistTotalVideos();

      const seen = new Set();
      scrapeLegacyPlaylistVideos(info.videos, seen);
      scrapeLockupPlaylistVideos(info.videos, seen);
      scrapeFallbackWatchLinks(info.videos, seen);
      info.visibleVideos = info.videos.length;
    } catch (error) {
      console.error('Error extracting playlist info:', error);
    }

    return info;
  }

  // Listen for messages from popup or background script
  api.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getVideoInfo') {
      sendResponse({ videoInfo: getVideoInfo() });
    } else if (request.action === 'getPlaylistInfo') {
      sendResponse({ playlistInfo: getPlaylistInfo() });
    } else if (request.action === 'isPlaylist') {
      sendResponse({ isPlaylist: isPlaylistPage() });
    }
    // Synchronous responses — no need to keep the message channel open
    return false;
  });

  // Create the floating save button element
  function createButtonElement() {
    const button = document.createElement('button');
    button.id = BUTTON_ID;
    button.title = 'In Fabric speichern (Alt+Shift+F)';

    button.setAttribute('aria-label', 'Video in Fabric speichern');

    // Create SVG icon using DOM methods (safe, no innerHTML with user content)
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '20');
    svg.setAttribute('height', '20');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('aria-hidden', 'true');

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z');
    svg.appendChild(path);

    const span = document.createElement('span');
    span.textContent = BUTTON_TEXT;

    button.appendChild(svg);
    button.appendChild(span);

    return button;
  }

  // Add floating save button (optional feature)
  // Returns true if button was added, false otherwise
  function addFloatingSaveButton() {
    // Check if button already exists
    if (document.getElementById(BUTTON_ID)) {
      return false;
    }

    // Only add on video pages
    if (!window.location.pathname.includes('/watch') && !window.location.pathname.includes('/shorts/')) {
      return false;
    }

    // Respect user settings
    if (!settings.showFloatingButton) {
      return false;
    }

    const button = createButtonElement();

    button.addEventListener('click', async () => {
      // Prevent double-clicks
      if (button.classList.contains('saving')) {
        return;
      }

      button.classList.add('saving');
      button.setAttribute('aria-busy', 'true');
      button.querySelector('span').textContent = BUTTON_SAVING_TEXT;

      try {
        // Send videoInfo directly to avoid race condition with tab re-query
        const videoInfo = getVideoInfo();
        const response = await Promise.race([
          api.runtime.sendMessage({
            action: 'saveFromContentScript',
            videoInfo: videoInfo
          }),
          new Promise(resolve => setTimeout(() => resolve({ success: false, error: 'Zeitüberschreitung' }), 60000))
        ]);

        if (response && response.success) {
          button.classList.remove('saving');
          button.removeAttribute('aria-busy');
          button.classList.add('saved');
          button.querySelector('span').textContent = BUTTON_SAVED_TEXT;

          if (buttonResetTimer) clearTimeout(buttonResetTimer);
          buttonResetTimer = setTimeout(() => {
            button.classList.remove('saved');
            button.querySelector('span').textContent = BUTTON_TEXT;
            buttonResetTimer = null;
          }, 2000);
        } else {
          // Show specific error message
          throw new Error(response?.error || 'Unbekannter Fehler');
        }
      } catch (error) {
        button.classList.remove('saving');
        button.removeAttribute('aria-busy');
        button.classList.add('error');
        // Show short error hint if not logged in
        const isAuthError = error.message?.includes('angemeldet') || error.message?.includes('API');
        button.querySelector('span').textContent = isAuthError ? BUTTON_AUTH_ERROR_TEXT : BUTTON_ERROR_TEXT;

        if (buttonResetTimer) clearTimeout(buttonResetTimer);
        buttonResetTimer = setTimeout(() => {
          button.classList.remove('error');
          button.querySelector('span').textContent = BUTTON_TEXT;
          buttonResetTimer = null;
        }, 3000);
      }
    });

    document.body.appendChild(button);
    return true;
  }

  // Remove floating button (for navigation cleanup)
  function removeFloatingSaveButton() {
    if (buttonResetTimer) {
      clearTimeout(buttonResetTimer);
      buttonResetTimer = null;
    }
    const button = document.getElementById(BUTTON_ID);
    if (button) {
      button.remove();
    }
  }

  // Cleanup function for page unload
  function cleanup() {
    // Remove navigation event listeners
    if (_onNavigateHandler) {
      document.removeEventListener('yt-navigate-finish', _onNavigateHandler);
      window.removeEventListener('popstate', _onNavigateHandler);
      _onNavigateHandler = null;
    }

    // Remove storage listener
    api.storage.onChanged.removeListener(onStorageChanged);

    // Clear all timers
    if (addButtonTimeout) {
      clearTimeout(addButtonTimeout);
      addButtonTimeout = null;
    }
    if (playerCheckTimer) {
      clearTimeout(playerCheckTimer);
      playerCheckTimer = null;
    }
    if (buttonResetTimer) {
      clearTimeout(buttonResetTimer);
      buttonResetTimer = null;
    }

    removeFloatingSaveButton();
    _initialized = false;
  }

  // Player detection via bounded polling (replaces MutationObserver subtree watching)
  function startPlayerCheck() {
    cancelPlayerCheck(); // defensive: cancel any existing poll
    attemptAddButton();
  }

  function attemptAddButton() {
    if (playerCheckCount >= PLAYER_CHECK_MAX) return;

    const videoPlayer = document.querySelector('#movie_player') ||
                        document.querySelector('ytd-player');
    if (videoPlayer) {
      addFloatingSaveButton();
    } else {
      playerCheckCount++;
      playerCheckTimer = setTimeout(attemptAddButton, PLAYER_CHECK_INTERVAL);
    }
  }

  function cancelPlayerCheck() {
    if (playerCheckTimer) {
      clearTimeout(playerCheckTimer);
      playerCheckTimer = null;
    }
    playerCheckCount = 0;
  }

  // Initialize when page is ready
  function init() {
    let lastUrl = location.href;

    // Navigation handler for YouTube SPA transitions
    function onNavigate() {
      const currentUrl = location.href;
      if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;

        // Remove old button and cancel pending player checks
        removeFloatingSaveButton();
        cancelPlayerCheck();

        // Clear any pending timeout to prevent race conditions
        if (addButtonTimeout) {
          clearTimeout(addButtonTimeout);
        }
        // Debounce: wait for page to settle, then start player detection
        addButtonTimeout = setTimeout(startPlayerCheck, 300);
      }
    }

    // Store reference for cleanup
    _onNavigateHandler = onNavigate;

    // Primary: YouTube's own SPA navigation event (works in Chrome + Safari)
    document.addEventListener('yt-navigate-finish', onNavigate);

    // Secondary: browser back/forward navigation
    window.addEventListener('popstate', onNavigate);

    // Initial page load — try immediately, then poll if player not ready yet
    if (!addFloatingSaveButton()) {
      startPlayerCheck();
    }

    _initialized = true;
  }

  // Only tear down on real navigation away — not when entering bfcache
  window.addEventListener('pagehide', (event) => {
    if (!event.persisted) {
      cleanup();
    }
  });

  // Re-init after bfcache restore if a previous cleanup ran (or listeners were lost)
  window.addEventListener('pageshow', (event) => {
    if (event.persisted && !_initialized) {
      // Storage listener may have been removed — re-attach before start
      api.storage.onChanged.addListener(onStorageChanged);
      start();
    }
  });

  // Start: wait for settings before init so the floating button does not flash.
  // Idempotent: skip if already initialized (e.g. duplicate pageshow).
  function start() {
    if (_initialized) {
      return;
    }
    loadSettings(() => {
      if (_initialized) {
        return;
      }
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
      } else {
        init();
      }
    });
  }

  start();
})();
