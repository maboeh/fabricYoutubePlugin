import { describe, it, expect, vi } from 'vitest';

// Mock browser-api before importing constants (which depend on it)
vi.mock('../../src/shared/browser-api.js', () => ({
  api: {
    storage: {
      local: {
        get: vi.fn(),
        set: vi.fn(),
        remove: vi.fn()
      }
    },
    runtime: {
      lastError: null
    }
  }
}));

import {
  isYouTubeVideoUrl,
  isYouTubePlaylistUrl,
  extractVideoId,
  sanitizeText,
  getThumbnailUrl
} from '../../src/shared/constants.js';

describe('isYouTubeVideoUrl', () => {
  it('accepts standard watch URLs', () => {
    expect(isYouTubeVideoUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(true);
    expect(isYouTubeVideoUrl('https://youtube.com/watch?v=dQw4w9WgXcQ')).toBe(true);
  });

  it('accepts Shorts and youtu.be', () => {
    expect(isYouTubeVideoUrl('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe(true);
    expect(isYouTubeVideoUrl('https://youtu.be/dQw4w9WgXcQ')).toBe(true);
  });

  it('rejects spoofed hostnames that contain youtube.com in the path', () => {
    expect(isYouTubeVideoUrl('https://evil.com/youtube.com/watch?v=dQw4w9WgXcQ')).toBe(false);
    expect(isYouTubeVideoUrl('https://notyoutube.com/watch?v=dQw4w9WgXcQ')).toBe(false);
    expect(isYouTubeVideoUrl('https://youtube.com.evil.com/watch?v=abc')).toBe(false);
  });

  it('rejects empty / invalid values', () => {
    expect(isYouTubeVideoUrl('')).toBe(false);
    expect(isYouTubeVideoUrl(null)).toBe(false);
    expect(isYouTubeVideoUrl('not-a-url')).toBe(false);
  });
});

describe('isYouTubePlaylistUrl', () => {
  it('accepts playlist pages', () => {
    expect(isYouTubePlaylistUrl('https://www.youtube.com/playlist?list=PLtest')).toBe(true);
  });

  it('rejects watch URLs that also have a list param', () => {
    expect(
      isYouTubePlaylistUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLtest')
    ).toBe(false);
  });

  it('rejects spoofed playlist URLs', () => {
    expect(isYouTubePlaylistUrl('https://evil.com/youtube.com/playlist?list=PLtest')).toBe(false);
  });
});

describe('extractVideoId', () => {
  it('extracts from watch, short and shorts URLs', () => {
    expect(extractVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(extractVideoId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(extractVideoId('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('returns null for missing / invalid IDs', () => {
    expect(extractVideoId('https://www.youtube.com/')).toBe(null);
    expect(extractVideoId('')).toBe(null);
    expect(extractVideoId(null)).toBe(null);
  });
});

describe('sanitizeText', () => {
  it('strips control characters and trims', () => {
    expect(sanitizeText('  hello\x00world  ')).toBe('helloworld');
  });

  it('respects maxLength', () => {
    expect(sanitizeText('abcdefghij', 5)).toBe('abcde');
  });

  it('passes through empty / falsy values', () => {
    expect(sanitizeText('')).toBe('');
    expect(sanitizeText(null)).toBe(null);
  });
});

describe('getThumbnailUrl', () => {
  it('builds mqdefault by default', () => {
    expect(getThumbnailUrl('dQw4w9WgXcQ')).toBe(
      'https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg'
    );
  });

  it('returns null without videoId', () => {
    expect(getThumbnailUrl(null)).toBe(null);
  });
});
