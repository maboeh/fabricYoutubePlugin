// Content Script for YouTube pages
// Extracts video information from the YouTube page

(function() {
  'use strict';

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

    // Extract video ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    info.videoId = urlParams.get('v');

    // Handle YouTube Shorts
    const shortsMatch = window.location.pathname.match(/\/shorts\/([^/?]+)/);
    if (shortsMatch) {
      info.videoId = shortsMatch[1];
    }

    // Get title
    const titleElement = document.querySelector('h1.ytd-video-primary-info-renderer yt-formatted-string') ||
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

    return info;
  }

  // Listen for messages from popup or background script
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getVideoInfo') {
      const videoInfo = getVideoInfo();
      sendResponse({ videoInfo: videoInfo });
    }
    return true;
  });

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

    const button = document.createElement('button');
    button.id = 'fabric-save-button';
    button.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
      </svg>
      <span>Fabric</span>
    `;
    button.title = 'In Fabric speichern (Alt+Shift+F)';

    button.addEventListener('click', async () => {
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

  // Initialize when page is ready
  function init() {
    // Wait for YouTube's dynamic content to load
    const observer = new MutationObserver((mutations, obs) => {
      const videoPlayer = document.querySelector('#movie_player') ||
                          document.querySelector('ytd-player');

      if (videoPlayer) {
        addFloatingSaveButton();
        // Don't disconnect - YouTube is a SPA, we need to watch for navigation
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Also try immediately
    addFloatingSaveButton();
  }

  // Handle YouTube's SPA navigation
  let lastUrl = location.href;
  new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      // Re-add button on navigation
      setTimeout(addFloatingSaveButton, 1000);
    }
  }).observe(document, { subtree: true, childList: true });

  // Start
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
