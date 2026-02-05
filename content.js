// Content Script for YouTube pages
// Extracts video information from the YouTube page
//
// NOTE: Content Scripts cannot use ES6 modules.
// Storage keys must match shared/constants.js STORAGE_KEYS:
//   - 'fabricShowFloatingButton' = STORAGE_KEYS.SHOW_FLOATING_BUTTON

(function() {
  'use strict';

  // Settings cache
  let settings = {
    showFloatingButton: true
  };

  // State for cleanup and debouncing
  let observer = null;
  let addButtonTimeout = null;

  // Load settings from storage
  // Key must match STORAGE_KEYS.SHOW_FLOATING_BUTTON in shared/constants.js
  function loadSettings() {
    chrome.storage.local.get(['fabricShowFloatingButton'], (result) => {
      settings.showFloatingButton = result.fabricShowFloatingButton !== false;
      updateFloatingButtonVisibility();
    });
  }

  // Listen for settings changes
  // Key must match STORAGE_KEYS.SHOW_FLOATING_BUTTON in shared/constants.js
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.fabricShowFloatingButton) {
      settings.showFloatingButton = changes.fabricShowFloatingButton.newValue !== false;
      updateFloatingButtonVisibility();
    }
  });

  // Update floating button visibility based on settings
  function updateFloatingButtonVisibility() {
    const button = document.getElementById('fabric-save-button');
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

      // Get thumbnail
      if (info.videoId) {
        info.thumbnail = `https://img.youtube.com/vi/${info.videoId}/maxresdefault.jpg`;
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

  // Check if current page is a playlist
  function isPlaylistPage() {
    return window.location.pathname === '/playlist' ||
           window.location.search.includes('list=');
  }

  // Get playlist information
  function getPlaylistInfo() {
    const info = {
      isPlaylist: isPlaylistPage(),
      playlistId: null,
      playlistTitle: null,
      videos: []
    };

    if (!info.isPlaylist) return info;

    try {
      // Get playlist ID
      const urlParams = new URLSearchParams(window.location.search);
      info.playlistId = urlParams.get('list');

      // Get playlist title
      const titleElement = document.querySelector('h1#title a.yt-simple-endpoint') ||
                           document.querySelector('yt-formatted-string.ytd-playlist-header-renderer') ||
                           document.querySelector('h1.ytd-playlist-header-renderer');
      if (titleElement) {
        info.playlistTitle = titleElement.textContent?.trim();
      }

      // Get all video links in the playlist
      const videoElements = document.querySelectorAll('ytd-playlist-video-renderer');
      videoElements.forEach((element, index) => {
        const linkElement = element.querySelector('a#video-title');
        const channelElement = element.querySelector('ytd-channel-name a') ||
                               element.querySelector('.ytd-channel-name');

        if (linkElement) {
          const href = linkElement.href;
          const videoIdMatch = href.match(/[?&]v=([^&]+)/);

          info.videos.push({
            url: href.split('&list=')[0], // Clean URL without playlist param
            title: linkElement.textContent?.trim() || `Video ${index + 1}`,
            videoId: videoIdMatch ? videoIdMatch[1] : null,
            channel: channelElement?.textContent?.trim() || 'YouTube',
            thumbnail: videoIdMatch ? `https://img.youtube.com/vi/${videoIdMatch[1]}/mqdefault.jpg` : null
          });
        }
      });
    } catch (error) {
      console.error('Error extracting playlist info:', error);
    }

    return info;
  }

  // Listen for messages from popup or background script
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getVideoInfo') {
      const videoInfo = getVideoInfo();
      sendResponse({ videoInfo: videoInfo });
    }
    if (request.action === 'getPlaylistInfo') {
      const playlistInfo = getPlaylistInfo();
      sendResponse({ playlistInfo: playlistInfo });
    }
    if (request.action === 'isPlaylist') {
      sendResponse({ isPlaylist: isPlaylistPage() });
    }
    return true;
  });

  // Create the floating save button element
  function createButtonElement() {
    const button = document.createElement('button');
    button.id = 'fabric-save-button';
    button.title = 'In Fabric speichern (Alt+Shift+F)';

    // Create SVG icon using DOM methods (safe, no innerHTML with user content)
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '20');
    svg.setAttribute('height', '20');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z');
    svg.appendChild(path);

    const span = document.createElement('span');
    span.textContent = 'Fabric';

    button.appendChild(svg);
    button.appendChild(span);

    return button;
  }

  // Add floating save button (optional feature)
  function addFloatingSaveButton() {
    // Check if button already exists
    if (document.getElementById('fabric-save-button')) {
      return;
    }

    // Only add on video pages
    if (!window.location.pathname.includes('/watch') && !window.location.pathname.includes('/shorts/')) {
      return;
    }

    // Respect user settings
    if (!settings.showFloatingButton) {
      return;
    }

    const button = createButtonElement();

    button.addEventListener('click', async () => {
      // Prevent double-clicks
      if (button.classList.contains('saving')) {
        return;
      }

      button.classList.add('saving');
      button.querySelector('span').textContent = 'Speichern...';

      try {
        const response = await chrome.runtime.sendMessage({ action: 'saveToFabric' });

        if (response && response.success) {
          button.classList.remove('saving');
          button.classList.add('saved');
          button.querySelector('span').textContent = 'Gespeichert!';

          setTimeout(() => {
            button.classList.remove('saved');
            button.querySelector('span').textContent = 'Fabric';
          }, 2000);
        } else {
          throw new Error('Save failed');
        }
      } catch (error) {
        button.classList.remove('saving');
        button.classList.add('error');
        button.querySelector('span').textContent = 'Fehler';

        setTimeout(() => {
          button.classList.remove('error');
          button.querySelector('span').textContent = 'Fabric';
        }, 2000);
      }
    });

    document.body.appendChild(button);
  }

  // Remove floating button (for navigation cleanup)
  function removeFloatingSaveButton() {
    const button = document.getElementById('fabric-save-button');
    if (button) {
      button.remove();
    }
  }

  // Cleanup function for page unload
  function cleanup() {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    if (addButtonTimeout) {
      clearTimeout(addButtonTimeout);
      addButtonTimeout = null;
    }
    removeFloatingSaveButton();
  }

  // Initialize when page is ready
  function init() {
    let lastUrl = location.href;

    // Single MutationObserver for both video player detection and SPA navigation
    observer = new MutationObserver(() => {
      // Check for URL change (YouTube SPA navigation)
      const currentUrl = location.href;
      if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;

        // Remove old button and add new one after navigation (with debounce)
        removeFloatingSaveButton();

        // Clear any pending timeout to prevent race conditions
        if (addButtonTimeout) {
          clearTimeout(addButtonTimeout);
        }
        addButtonTimeout = setTimeout(addFloatingSaveButton, 500);
        return;
      }

      // Check for video player (initial load)
      const videoPlayer = document.querySelector('#movie_player') ||
                          document.querySelector('ytd-player');

      if (videoPlayer) {
        addFloatingSaveButton();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Also try immediately
    addFloatingSaveButton();
  }

  // Cleanup on page unload (prevents memory leaks)
  window.addEventListener('beforeunload', cleanup);
  window.addEventListener('unload', cleanup);

  // Start
  loadSettings(); // Load settings first

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
