import { describe, it, expect } from 'vitest';
import {
  parseYouTubeVideoId,
  parseYouTubePlaylistId,
  CURATED_STARTER_TRACKS,
} from '../src/components/focus-radio/youtubeUtils';

describe('Focus Radio YouTube Utilities', () => {
  it('correctly extracts video IDs from standard youtube.com/watch URLs', () => {
    expect(parseYouTubeVideoId('https://www.youtube.com/watch?v=jfKfPfyJRdk')).toBe('jfKfPfyJRdk');
    expect(parseYouTubeVideoId('https://www.youtube.com/watch?v=4xDzrJKXOOY&t=120s')).toBe('4xDzrJKXOOY');
  });

  it('correctly extracts video IDs from shortened youtu.be URLs', () => {
    expect(parseYouTubeVideoId('https://youtu.be/jfKfPfyJRdk')).toBe('jfKfPfyJRdk');
    expect(parseYouTubeVideoId('http://youtu.be/1ZYbU82GVz4?si=abc123xyz')).toBe('1ZYbU82GVz4');
  });

  it('correctly extracts video IDs from YouTube Shorts', () => {
    expect(parseYouTubeVideoId('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('correctly extracts video IDs from YouTube Music URLs', () => {
    expect(parseYouTubeVideoId('https://music.youtube.com/watch?v=jfKfPfyJRdk')).toBe('jfKfPfyJRdk');
  });

  it('accepts bare 11-character YouTube video IDs', () => {
    expect(parseYouTubeVideoId('jfKfPfyJRdk')).toBe('jfKfPfyJRdk');
    expect(parseYouTubeVideoId('4xDzrJKXOOY')).toBe('4xDzrJKXOOY');
  });

  it('safely returns null for invalid or malicious URLs', () => {
    expect(parseYouTubeVideoId('')).toBeNull();
    expect(parseYouTubeVideoId('https://vimeo.com/12345678')).toBeNull();
    expect(parseYouTubeVideoId('javascript:alert(1)')).toBeNull();
    expect(parseYouTubeVideoId('not-a-valid-youtube-id')).toBeNull();
  });

  it('correctly extracts playlist IDs from playlist and mix URLs', () => {
    expect(parseYouTubePlaylistId('https://www.youtube.com/playlist?list=PL4fGSI1pDJn6jXS_PEO476D19m_4hs420')).toBe(
      'PL4fGSI1pDJn6jXS_PEO476D19m_4hs420'
    );
    expect(parseYouTubePlaylistId('https://www.youtube.com/watch?v=abc123xyz89&list=PLrAl5_J2XmAmqTqT2w2Q9v9T1')).toBe(
      'PLrAl5_J2XmAmqTqT2w2Q9v9T1'
    );
    expect(parseYouTubePlaylistId('PL4fGSI1pDJn6jXS_PEO476D19m_4hs420')).toBe(
      'PL4fGSI1pDJn6jXS_PEO476D19m_4hs420'
    );
  });

  it('returns null when URL has no playlist ID', () => {
    expect(parseYouTubePlaylistId('https://www.youtube.com/watch?v=jfKfPfyJRdk')).toBeNull();
    expect(parseYouTubePlaylistId('')).toBeNull();
  });

  it('verifies curated starter tracks have valid video IDs and titles', () => {
    expect(CURATED_STARTER_TRACKS.length).toBeGreaterThanOrEqual(3);
    for (const track of CURATED_STARTER_TRACKS) {
      expect(track.videoId).toHaveLength(11);
      expect(track.title).toBeTruthy();
      expect(track.thumbnailUrl).toContain('img.youtube.com');
    }
  });
});

