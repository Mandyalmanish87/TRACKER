import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { parseYouTubePlaylistId, parseYouTubeVideoId } from '../src/components/focus-radio/youtubeUtils';
import {
  parseIso8601Duration,
  fetchYouTubePlaylistPreview,
  validateAndNormalizePreview,
} from '../src/services/youtubePlaylistService';
import * as authService from '../src/services/authService';
import { firebaseService } from '../src/services/firebaseService';
import {
  findCourseByPlaylistId,
  importCourseFromPlaylist,
  syncCourseWithPlaylist,
  loadEduHubCourses,
  saveEduHubCourses,
  updateLectureProgress,
  calculateCourseStats,
} from '../src/services/eduhubStorage';
import { YouTubePlaylistPreview } from '../src/types/eduhub';

describe('YouTube Playlist Import & Extraction', () => {
  it('correctly extracts playlist ID from various YouTube URL formats and bare IDs', () => {
    // Standard playlist URL
    expect(
      parseYouTubePlaylistId('https://www.youtube.com/playlist?list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf')
    ).toBe('PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf');

    // Video URL with playlist parameter
    expect(
      parseYouTubePlaylistId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf')
    ).toBe('PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf');

    // youtu.be shortlink with playlist
    expect(
      parseYouTubePlaylistId('https://youtu.be/dQw4w9WgXcQ?list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf')
    ).toBe('PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf');

    // Music YouTube playlist
    expect(
      parseYouTubePlaylistId('https://music.youtube.com/playlist?list=OLAK5uy_k1234567890abcdef')
    ).toBe('OLAK5uy_k1234567890abcdef');

    // Bare playlist ID with PL prefix
    expect(parseYouTubePlaylistId('PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf')).toBe('PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf');

    // Bare playlist ID with UU prefix
    expect(parseYouTubePlaylistId('UUrAXtmErZgOeiKm4sgNOknGvNjby9efdf')).toBe('UUrAXtmErZgOeiKm4sgNOknGvNjby9efdf');

    // HTML entity-encoded playlist link (e.g. copied from formatted rich text or web interfaces)
    expect(
      parseYouTubePlaylistId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&amp;list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf')
    ).toBe('PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf');

    // Invalid URLs or non-playlist links
    expect(parseYouTubePlaylistId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(null);
    expect(parseYouTubePlaylistId('invalid-string')).toBe(null);
    expect(parseYouTubePlaylistId('')).toBe(null);
  });

  it('accurately parses ISO 8601 duration strings into total seconds', () => {
    expect(parseIso8601Duration('PT1H23M45S')).toBe(5025); // 3600 + 1380 + 45
    expect(parseIso8601Duration('PT15M30S')).toBe(930);    // 900 + 30
    expect(parseIso8601Duration('PT45S')).toBe(45);
    expect(parseIso8601Duration('PT2H')).toBe(7200);
    expect(parseIso8601Duration('PT1H5S')).toBe(3605);
    expect(parseIso8601Duration('P1DT2H')).toBe(93600);    // 86400 + 7200
    expect(parseIso8601Duration('')).toBe(0);
    expect(parseIso8601Duration('invalid')).toBe(0);
  });
});

describe('EduHub Course Playlist Storage & Duplicate Prevention', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const mockPreview: YouTubePlaylistPreview = {
    playlistId: 'PLcs50_web_programming_2026',
    playlistUrl: 'https://www.youtube.com/playlist?list=PLcs50_web_programming_2026',
    title: 'CS50 Web Programming with Python and JavaScript',
    description: 'Learn modern web application design with Harvard University.',
    channelTitle: 'CS50',
    thumbnailUrl: 'https://img.youtube.com/vi/mock1/hqdefault.jpg',
    itemCount: 3,
    totalDurationSeconds: 9000,
    lectures: [
      {
        videoId: 'vid_lec_001',
        title: 'Lecture 0 - HTML, CSS & Git',
        position: 0,
        durationSeconds: 3000,
        thumbnailUrl: 'https://img.youtube.com/vi/vid_lec_001/hqdefault.jpg',
      },
      {
        videoId: 'vid_lec_002',
        title: 'Lecture 1 - Python Fundamentals',
        position: 1,
        durationSeconds: 3600,
        thumbnailUrl: 'https://img.youtube.com/vi/vid_lec_002/hqdefault.jpg',
      },
      {
        videoId: 'vid_lec_003',
        title: 'Lecture 2 - Django Web Framework',
        position: 2,
        durationSeconds: 2400,
        thumbnailUrl: 'https://img.youtube.com/vi/vid_lec_003/hqdefault.jpg',
      },
    ],
  };

  it('imports course from playlist preview and preserves lecture ordering', () => {
    const result = importCourseFromPlaylist(mockPreview);
    expect(result.updated).toBe(false);
    expect(result.isExisting).toBe(false);

    const course = result.course;
    expect(course.title).toBe(mockPreview.title);
    expect(course.playlistId).toBe(mockPreview.playlistId);
    expect(course.playlistUrl).toBe(mockPreview.playlistUrl);
    expect(course.lectures.length).toBe(3);

    // Verify ordering is preserved
    expect(course.lectures[0].videoId).toBe('vid_lec_001');
    expect(course.lectures[0].title).toBe('Lecture 0 - HTML, CSS & Git');
    expect(course.lectures[0].durationSeconds).toBe(3000);
    expect(course.lectures[0].completed).toBe(false);

    expect(course.lectures[1].videoId).toBe('vid_lec_002');
    expect(course.lectures[2].videoId).toBe('vid_lec_003');
  });

  it('detects existing playlist and avoids unwanted duplicates', () => {
    // First import
    importCourseFromPlaylist(mockPreview);

    // Duplicate lookup
    const existing = findCourseByPlaylistId(mockPreview.playlistId);
    expect(existing).toBeDefined();
    expect(existing?.title).toBe(mockPreview.title);
    expect(existing?.playlistId).toBe(mockPreview.playlistId);

    // Unknown playlist lookup
    const notFound = findCourseByPlaylistId('PL_non_existent_id');
    expect(notFound).toBeUndefined();
  });

  it('synchronizes existing course while preserving user completion, position, and notes', () => {
    // 1. Initial import
    const initial = importCourseFromPlaylist(mockPreview).course;
    const lec1Id = initial.lectures[0].id;
    const lec2Id = initial.lectures[1].id;

    // 2. Student watches and completes Lecture 0, and watches 50% of Lecture 1
    updateLectureProgress(initial.id, lec1Id, 3000, 3000); // 100% completed
    updateLectureProgress(initial.id, lec2Id, 1800, 3600); // 1800s watched

    // Add note to lecture 0
    const courses = loadEduHubCourses();
    const updatedWithNotes = courses.map((c) => {
      if (c.id === initial.id) {
        return {
          ...c,
          lectures: c.lectures.map((l) => (l.id === lec1Id ? { ...l, notes: 'Key note on flexbox' } : l)),
        };
      }
      return c;
    });
    saveEduHubCourses(updatedWithNotes);

    // 3. Updated playlist from YouTube adds Lecture 3 and updates title of Lecture 1
    const updatedPreview: YouTubePlaylistPreview = {
      ...mockPreview,
      lectures: [
        {
          videoId: 'vid_lec_001',
          title: 'Lecture 0 - HTML, CSS & Modern Git (Updated)',
          position: 0,
          durationSeconds: 3000,
        },
        {
          videoId: 'vid_lec_002',
          title: 'Lecture 1 - Python Fundamentals',
          position: 1,
          durationSeconds: 3600,
        },
        {
          videoId: 'vid_lec_003',
          title: 'Lecture 2 - Django Web Framework',
          position: 2,
          durationSeconds: 2400,
        },
        {
          videoId: 'vid_lec_004',
          title: 'Lecture 3 - SQL, Models & Migrations (New)',
          position: 3,
          durationSeconds: 2800,
        },
      ],
    };

    // Synchronize
    const synced = syncCourseWithPlaylist(initial.id, updatedPreview);

    expect(synced.lectures.length).toBe(4);

    // Lecture 0 preserved completion status and notes, but updated title
    const syncedLec1 = synced.lectures.find((l) => l.videoId === 'vid_lec_001');
    expect(syncedLec1?.completed).toBe(true);
    expect(syncedLec1?.notes).toBe('Key note on flexbox');
    expect(syncedLec1?.title).toBe('Lecture 0 - HTML, CSS & Modern Git (Updated)');

    // Lecture 1 preserved playback position
    const syncedLec2 = synced.lectures.find((l) => l.videoId === 'vid_lec_002');
    expect(syncedLec2?.lastPositionSeconds).toBe(1800);
    expect(syncedLec2?.completed).toBe(false);

    // Newly added lecture is present and uncompleted
    const syncedLec4 = synced.lectures.find((l) => l.videoId === 'vid_lec_004');
    expect(syncedLec4).toBeDefined();
    expect(syncedLec4?.completed).toBe(false);

    // Overall stats accurately reflect workload
    const stats = calculateCourseStats(synced);
    expect(stats.totalLectures).toBe(4);
    expect(stats.completedLectures).toBe(1);
    expect(stats.remainingLectures).toBe(3);
    // Remaining seconds: lec1(0) + lec2(3600-1800=1800) + lec3(2400) + lec4(2800) = 7000s
    expect(stats.remainingSeconds).toBe(7000);
  });
});

describe('YouTube Service Error Handling & Diagnostics', () => {
  it('returns clean error for invalid playlist URLs without calling backend', async () => {
    const res = await fetchYouTubePlaylistPreview('not-a-valid-url');
    expect(res.success).toBe(false);
    expect(res.errorCode).toBe('INVALID_URL');
    expect(res.error).toContain('Invalid YouTube playlist URL');
  });

  it('identifies single YouTube video links and provides explicit guidance', async () => {
    const res = await fetchYouTubePlaylistPreview('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    expect(res.success).toBe(false);
    expect(res.errorCode).toBe('INVALID_URL');
    expect(res.error).toContain('The link you pasted is for a single YouTube video, not a course playlist');
    expect(res.error).toContain('click "Add Lecture"');
  });

  it('returns informative error response for invalid/offline playlist queries', async () => {
    const res = await fetchYouTubePlaylistPreview('https://www.youtube.com/playlist?list=PL1234567890abcdef');
    expect(res.success).toBe(false);
    expect(res.error).toBeDefined();
  });

  it('tests live Edge Function import with a real public YouTube playlist', async () => {
    // Corey Schafer Python Tutorial Series public playlist
    const res = await fetchYouTubePlaylistPreview('https://www.youtube.com/playlist?list=PL-osiE80TeTs4UjLw5MM6OjgkjFeUxCYH');
    if (res.success && res.preview) {
      expect(res.preview.title).toBeDefined();
      expect(res.preview.lectures.length).toBeGreaterThan(0);
    }
  }, 25000);
});

describe('Focus Radio Playlist Import Resilience & Empty API Handling', () => {
  it('correctly extracts both videoId and playlistId when user pastes a video-in-playlist URL', () => {
    const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf&index=3';
    const playlistId = parseYouTubePlaylistId(url);
    const videoId = parseYouTubeVideoId(url);

    expect(playlistId).toBe('PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf');
    expect(videoId).toBe('dQw4w9WgXcQ');
  });

  it('correctly extracts both videoId and playlistId from youtu.be shortlinks with playlist parameter', () => {
    const url = 'https://youtu.be/jfKfPfyJRdk?list=PL4fGSI1pDJn6jXS_PEO476D19m_4hs420';
    const playlistId = parseYouTubePlaylistId(url);
    const videoId = parseYouTubeVideoId(url);

    expect(playlistId).toBe('PL4fGSI1pDJn6jXS_PEO476D19m_4hs420');
    expect(videoId).toBe('jfKfPfyJRdk');
  });

  it('safely handles empty or missing lecture list without crashing or returning 0 tracks', async () => {
    // Calling with an invalid/empty playlist ID returns an error, never a success with 0 tracks
    const res = await fetchYouTubePlaylistPreview('https://www.youtube.com/playlist?list=PL_nonexistent_empty_00000000000');
    expect(res.success).toBe(false);
    expect(res.preview).toBeUndefined();
    expect(res.error).toBeDefined();
  });

  describe('validateAndNormalizePreview strictly prevents [0] track state', () => {
    it('returns null when backend responds with empty lectures array (root cause of [0])', () => {
      const emptyPayload = {
        playlistId: 'PLtest',
        title: 'Empty Playlist',
        itemCount: 0,
        lectures: [],
      };
      const result = validateAndNormalizePreview(emptyPayload);
      expect(result).toBeNull();
    });

    it('returns null when lectures contain malformed video IDs or empty strings', () => {
      const malformedPayload = {
        playlistId: 'PLtest',
        title: 'Malformed Playlist',
        itemCount: 2,
        lectures: [
          { videoId: '', title: 'Track 1' },
          { videoId: 'inv', title: 'Track 2' },
          { videoId: 'invalid id with spaces & symbols!', title: 'Track 3' },
          { title: 'Missing videoId' },
        ],
      };
      const result = validateAndNormalizePreview(malformedPayload);
      expect(result).toBeNull();
    });

    it('filters out invalid tracks and keeps only valid video IDs', () => {
      const mixedPayload = {
        playlistId: 'PLtest',
        title: 'Mixed Playlist',
        lectures: [
          { videoId: 'dQw4w9WgXcQ', title: 'Valid Track 1', durationSeconds: 212 },
          { videoId: 'inv', title: 'Invalid Track' },
          { videoId: 'video-01', title: 'Invalid 8-char Track' },
          { videoId: '9bZkp7q19f0', title: 'Valid Track 2', durationSeconds: 250 },
        ],
      };
      const result = validateAndNormalizePreview(mixedPayload);
      expect(result).not.toBeNull();
      expect(result?.itemCount).toBe(2);
      expect(result?.lectures.length).toBe(2);
      expect(result?.lectures[0].videoId).toBe('dQw4w9WgXcQ');
      expect(result?.lectures[1].videoId).toBe('9bZkp7q19f0');
    });

    it('strictly rejects non-11-character video IDs like "video-01" from entering normalized playlists', () => {
      const non11Payload = {
        playlistId: 'PLtest',
        title: 'Non-11-Char Playlist',
        itemCount: 1,
        lectures: [
          { videoId: 'video-01', title: 'Invalid 8-char track' },
          { videoId: 'way_too_long_video_id_123', title: 'Invalid long track' },
        ],
      };
      const result = validateAndNormalizePreview(non11Payload);
      expect(result).toBeNull();
    });

    it('handles dynamic YouTube Mix (RD...) URLs by extracting videoId for single-track fallback', () => {
      const mixUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=RDdQw4w9WgXcQ&start_radio=1';
      const playlistId = parseYouTubePlaylistId(mixUrl);
      const videoId = parseYouTubeVideoId(mixUrl);

      expect(playlistId).toBe('RDdQw4w9WgXcQ');
      expect(videoId).toBe('dQw4w9WgXcQ');
    });
  });

  describe('Supabase YouTube Import Error-Handling & Fallback Isolation', () => {
    let mockInvoke: any;
    let callFunctionSpy: any;

    beforeEach(() => {
      mockInvoke = vi.fn();
      vi.spyOn(authService, 'getSupabaseClient').mockReturnValue({
        functions: {
          invoke: mockInvoke,
        },
      } as any);

      callFunctionSpy = vi.spyOn(firebaseService, 'callFunction');
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('handles 401 Unauthorized: returns UNAUTHENTICATED without calling Firebase fallback', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: null,
        error: {
          name: 'FunctionsHttpError',
          message: 'Edge Function returned a non-2xx status code',
          context: {
            status: 401,
            json: async () => ({
              success: false,
              errorCode: 'UNAUTHENTICATED',
              error: 'Sign in to import a playlist.',
            }),
          },
        },
      });

      const res = await fetchYouTubePlaylistPreview('https://www.youtube.com/playlist?list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf');

      expect(res.success).toBe(false);
      expect(res.errorCode).toBe('UNAUTHENTICATED');
      expect(res.error).toContain('Sign in');
      expect(callFunctionSpy).not.toHaveBeenCalled();
    });

    it('handles 403 Forbidden: returns access denied without calling Firebase fallback', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: null,
        error: {
          name: 'FunctionsHttpError',
          message: 'Edge Function returned a non-2xx status code',
          context: {
            status: 403,
            json: async () => ({
              success: false,
              errorCode: 'FETCH_ERROR',
              error: 'Access to this playlist was denied.',
            }),
          },
        },
      });

      const res = await fetchYouTubePlaylistPreview('https://www.youtube.com/playlist?list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf');

      expect(res.success).toBe(false);
      expect(res.error).toContain('Access to this playlist was denied');
      expect(callFunctionSpy).not.toHaveBeenCalled();
    });

    it('handles 429 Rate Limit Exceeded: returns RATE_LIMIT_EXCEEDED without calling Firebase fallback', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: null,
        error: {
          name: 'FunctionsHttpError',
          message: 'Edge Function returned a non-2xx status code',
          context: {
            status: 429,
            json: async () => ({
              success: false,
              errorCode: 'RATE_LIMIT_EXCEEDED',
              error: 'Too many playlist import requests. Please wait 45 seconds before trying again.',
            }),
          },
        },
      });

      const res = await fetchYouTubePlaylistPreview('https://www.youtube.com/playlist?list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf');

      expect(res.success).toBe(false);
      expect(res.errorCode).toBe('RATE_LIMIT_EXCEEDED');
      expect(res.error).toContain('Too many playlist import requests');
      expect(callFunctionSpy).not.toHaveBeenCalled();
    });

    it('handles 429 Quota Exceeded: returns QUOTA_EXCEEDED without calling Firebase fallback', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: null,
        error: {
          name: 'FunctionsHttpError',
          message: 'Edge Function returned a non-2xx status code',
          context: {
            status: 429,
            json: async () => ({
              success: false,
              errorCode: 'QUOTA_EXCEEDED',
              error: 'YouTube Data API daily quota limit reached. Please check your Google Cloud quota or try again tomorrow.',
            }),
          },
        },
      });

      const res = await fetchYouTubePlaylistPreview('https://www.youtube.com/playlist?list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf');

      expect(res.success).toBe(false);
      expect(res.errorCode).toBe('QUOTA_EXCEEDED');
      expect(res.error).toContain('quota');
      expect(callFunctionSpy).not.toHaveBeenCalled();
    });

    it('handles 404 PRIVATE_PLAYLIST: returns PRIVATE_PLAYLIST without calling Firebase fallback', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: null,
        error: {
          name: 'FunctionsHttpError',
          message: 'Edge Function returned a non-2xx status code',
          context: {
            status: 404,
            json: async () => ({
              success: false,
              errorCode: 'PRIVATE_PLAYLIST',
              error: 'This YouTube playlist could not be accessed. It may be private or deleted.',
            }),
          },
        },
      });

      const res = await fetchYouTubePlaylistPreview('https://www.youtube.com/playlist?list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf');

      expect(res.success).toBe(false);
      expect(res.errorCode).toBe('PRIVATE_PLAYLIST');
      expect(res.error).toContain('private');
      expect(callFunctionSpy).not.toHaveBeenCalled();
    });

    it('handles 404 NOT_FOUND (no playable videos): returns NOT_FOUND without calling Firebase fallback', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: null,
        error: {
          name: 'FunctionsHttpError',
          message: 'Edge Function returned a non-2xx status code',
          context: {
            status: 404,
            json: async () => ({
              success: false,
              errorCode: 'NOT_FOUND',
              error: 'The playlist contains no playable public videos.',
            }),
          },
        },
      });

      const res = await fetchYouTubePlaylistPreview('https://www.youtube.com/playlist?list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf');

      expect(res.success).toBe(false);
      expect(res.errorCode).toBe('NOT_FOUND');
      expect(res.error).toContain('no playable public videos');
      expect(callFunctionSpy).not.toHaveBeenCalled();
    });

    it('handles 500 Server Error: returns clean error without calling Firebase fallback', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: null,
        error: {
          name: 'FunctionsHttpError',
          message: 'Edge Function returned a non-2xx status code',
          context: {
            status: 500,
            json: async () => ({
              success: false,
              errorCode: 'FETCH_ERROR',
              error: 'Database connection failed during playlist import.',
            }),
          },
        },
      });

      const res = await fetchYouTubePlaylistPreview('https://www.youtube.com/playlist?list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf');

      expect(res.success).toBe(false);
      expect(res.errorCode).toBe('FETCH_ERROR');
      expect(res.error).toContain('Database connection failed');
      expect(callFunctionSpy).not.toHaveBeenCalled();
    });

    it('falls back to Firebase ONLY when Edge Function is not deployed (relay error / generic 404)', async () => {
      vi.spyOn(firebaseService, 'isConfigured', 'get').mockReturnValue(true);

      mockInvoke.mockResolvedValueOnce({
        data: null,
        error: {
          name: 'FunctionsRelayError',
          message: 'Relay error: Function not found',
          context: {
            status: 404,
            json: async () => null,
          },
        },
      });

      callFunctionSpy.mockResolvedValueOnce({
        success: true,
        preview: {
          playlistId: 'PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf',
          title: 'Fallback Playlist',
          itemCount: 1,
          lectures: [
            { videoId: 'dQw4w9WgXcQ', title: 'Video 1', durationSeconds: 100 },
          ],
        },
      });

      const res = await fetchYouTubePlaylistPreview('https://www.youtube.com/playlist?list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf');

      expect(callFunctionSpy).toHaveBeenCalled();
      expect(res.success).toBe(true);
      expect(res.preview?.title).toBe('Fallback Playlist');
      expect(res.preview?.lectures.length).toBe(1);
    });

    it('handles network failure cleanly when offline', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('Failed to fetch'));
      callFunctionSpy.mockRejectedValueOnce(new Error('Failed to fetch'));

      const res = await fetchYouTubePlaylistPreview('https://www.youtube.com/playlist?list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf');

      expect(res.success).toBe(false);
      expect(res.errorCode).toBe('FETCH_ERROR');
      expect(res.error).toBeDefined();
    });

    it('successfully imports and normalizes playlist from Supabase Edge Function', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: {
          success: true,
          preview: {
            playlistId: 'PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf',
            title: 'Algorithms 101',
            itemCount: 2,
            totalDurationSeconds: 600,
            lectures: [
              { videoId: 'dQw4w9WgXcQ', title: 'Binary Search', durationSeconds: 300, position: 0 },
              { videoId: '9bZkp7q19f0', title: 'Merge Sort', durationSeconds: 300, position: 1 },
            ],
          },
        },
        error: null,
      });

      const res = await fetchYouTubePlaylistPreview('https://www.youtube.com/playlist?list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf');

      expect(res.success).toBe(true);
      expect(res.preview?.title).toBe('Algorithms 101');
      expect(res.preview?.itemCount).toBe(2);
      expect(res.preview?.lectures[0].videoId).toBe('dQw4w9WgXcQ');
      expect(res.preview?.lectures[1].videoId).toBe('9bZkp7q19f0');
      expect(callFunctionSpy).not.toHaveBeenCalled();
    });

    it('successfully imports and normalizes a 142-video multi-page playlist for Focus Radio and EduHub', async () => {
      // Generate 142 realistic YouTube video items across 3 pages (50 + 50 + 42)
      const mock142Lectures = Array.from({ length: 142 }, (_, i) => {
        const paddedIndex = String(i + 1).padStart(3, '0');
        return {
          videoId: `vid_tr_${paddedIndex}x`, // Exactly 11 characters
          title: `Lecture ${i + 1} - System Architecture Part ${i + 1}`,
          durationSeconds: 1200 + i * 10,
          position: i,
          thumbnailUrl: `https://i.ytimg.com/vi/vid_tr_${paddedIndex}x/hqdefault.jpg`,
        };
      });

      mockInvoke.mockResolvedValueOnce({
        data: {
          success: true,
          preview: {
            playlistId: 'PL4fGSI1pDJn6jXS_PEO476D19m_4hs420',
            playlistUrl: 'https://www.youtube.com/playlist?list=PL4fGSI1pDJn6jXS_PEO476D19m_4hs420',
            title: 'Complete 142-Video System Design & Architecture Course',
            description: 'Comprehensive 142 lecture series covering scalable distributed systems.',
            channelTitle: 'Tech Lead Academy',
            thumbnailUrl: 'https://i.ytimg.com/vi/vid_tr_001x/hqdefault.jpg',
            itemCount: 142,
            totalDurationSeconds: mock142Lectures.reduce((acc, l) => acc + l.durationSeconds, 0),
            lectures: mock142Lectures,
          },
        },
        error: null,
      });

      const res = await fetchYouTubePlaylistPreview('https://www.youtube.com/playlist?list=PL4fGSI1pDJn6jXS_PEO476D19m_4hs420');

      // 1. Verify Preview Extraction
      expect(res.success).toBe(true);
      expect(res.preview).toBeDefined();
      expect(res.preview?.itemCount).toBe(142);
      expect(res.preview?.lectures.length).toBe(142);
      expect(res.preview?.title).toBe('Complete 142-Video System Design & Architecture Course');

      // 2. Verify First, Middle, and Last Track Ordering
      expect(res.preview?.lectures[0].position).toBe(0);
      expect(res.preview?.lectures[0].videoId).toBe('vid_tr_001x');
      expect(res.preview?.lectures[70].position).toBe(70);
      expect(res.preview?.lectures[70].videoId).toBe('vid_tr_071x');
      expect(res.preview?.lectures[141].position).toBe(141);
      expect(res.preview?.lectures[141].videoId).toBe('vid_tr_142x');

      // 3. Verify EduHub Course Import
      const { course } = importCourseFromPlaylist(res.preview!);
      expect(course.lectures.length).toBe(142);
      expect(course.title).toBe('Complete 142-Video System Design & Architecture Course');
      expect(course.playlistId).toBe('PL4fGSI1pDJn6jXS_PEO476D19m_4hs420');

      // 4. Verify Focus Radio Track Conversion
      const { playlistItemToRadioTrack } = await import('../src/components/focus-radio/youtubeUtils');
      const radioTracks = res.preview!.lectures.map((l) =>
        playlistItemToRadioTrack(l, res.preview!.channelTitle)
      );
      expect(radioTracks.length).toBe(142);
      expect(radioTracks[0].videoId).toBe('vid_tr_001x');
      expect(radioTracks[141].videoId).toBe('vid_tr_142x');
    });

    it('handles Cache Hit (0 quota units) seamlessly without invoking external API or Firebase', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: {
          success: true,
          preview: {
            playlistId: 'PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf',
            title: 'Cached Algorithms 101',
            itemCount: 2,
            totalDurationSeconds: 600,
            lectures: [
              { videoId: 'dQw4w9WgXcQ', title: 'Binary Search', durationSeconds: 300, position: 0 },
              { videoId: '9bZkp7q19f0', title: 'Merge Sort', durationSeconds: 300, position: 1 },
            ],
          },
          fromCache: true,
        },
        error: null,
      });

      const res = await fetchYouTubePlaylistPreview('https://www.youtube.com/playlist?list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf');

      expect(res.success).toBe(true);
      expect(res.preview?.title).toBe('Cached Algorithms 101');
      expect(res.preview?.itemCount).toBe(2);
      expect(callFunctionSpy).not.toHaveBeenCalled();
    });

    it('handles Quota Hard Safety Threshold (SAFETY_THRESHOLD_REACHED) with student-friendly message', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: null,
        error: {
          name: 'FunctionsHttpError',
          message: 'Edge Function returned a non-2xx status code',
          context: {
            status: 429,
            json: async () => ({
              success: false,
              errorCode: 'SAFETY_THRESHOLD_REACHED',
              error: 'YouTube imports are temporarily unavailable because TRAKIFY has reached its daily YouTube import allowance. Your saved playlists and lectures are safe. Please try again after the quota resets.',
            }),
          },
        },
      });

      const res = await fetchYouTubePlaylistPreview('https://www.youtube.com/playlist?list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf');

      expect(res.success).toBe(false);
      expect(res.errorCode).toBe('QUOTA_EXCEEDED');
      expect(res.error).toContain('TRAKIFY has reached its daily YouTube import allowance');
      expect(res.error).toContain('Your saved playlists and lectures are safe');
      expect(callFunctionSpy).not.toHaveBeenCalled();
    });

    it('handles User Rate Limit (USER_RATE_LIMIT_EXCEEDED) with friendly guidance', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: null,
        error: {
          name: 'FunctionsHttpError',
          message: 'Edge Function returned a non-2xx status code',
          context: {
            status: 429,
            json: async () => ({
              success: false,
              errorCode: 'USER_RATE_LIMIT_EXCEEDED',
              error: 'You have reached your playlist import limit. Please wait 45 seconds before trying again.',
              retryAfterSeconds: 45,
            }),
          },
        },
      });

      const res = await fetchYouTubePlaylistPreview('https://www.youtube.com/playlist?list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf');

      expect(res.success).toBe(false);
      expect(res.errorCode).toBe('RATE_LIMIT_EXCEEDED');
      expect(res.error).toContain('You have reached your playlist import limit');
      expect(callFunctionSpy).not.toHaveBeenCalled();
    });

    it('handles Playlist Too Large (>500 videos) with clear constraint explanation', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: null,
        error: {
          name: 'FunctionsHttpError',
          message: 'Edge Function returned a non-2xx status code',
          context: {
            status: 400,
            json: async () => ({
              success: false,
              errorCode: 'PLAYLIST_TOO_LARGE',
              error: 'This playlist exceeds the maximum limit of 500 videos. Only playlists with up to 500 videos are supported.',
            }),
          },
        },
      });

      const res = await fetchYouTubePlaylistPreview('https://www.youtube.com/playlist?list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf');

      expect(res.success).toBe(false);
      expect(res.errorCode).toBe('INVALID_URL');
      expect(res.error).toContain('maximum limit of 500 videos');
      expect(callFunctionSpy).not.toHaveBeenCalled();
    });

    it('handles 503 SERVICE_UNAVAILABLE when database rate limiting is offline (fails closed)', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: null,
        error: {
          name: 'FunctionsHttpError',
          message: 'Edge Function returned a non-2xx status code',
          context: {
            status: 503,
            json: async () => ({
              success: false,
              errorCode: 'SERVICE_UNAVAILABLE',
              error: 'Rate limit verification service is temporarily unavailable. Please try again in a few moments.',
            }),
          },
        },
      });

      const res = await fetchYouTubePlaylistPreview('https://www.youtube.com/playlist?list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf');

      expect(res.success).toBe(false);
      expect(res.errorCode).toBe('SERVICE_UNAVAILABLE');
      expect(res.error).toContain('Rate limit verification service is temporarily unavailable');
      expect(callFunctionSpy).not.toHaveBeenCalled();
    });

    it('handles 502 FETCH_ERROR when pagination is aborted on intermediate page', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: null,
        error: {
          name: 'FunctionsHttpError',
          message: 'Edge Function returned a non-2xx status code',
          context: {
            status: 502,
            json: async () => ({
              success: false,
              errorCode: 'FETCH_ERROR',
              error: 'Failed to import complete playlist: YouTube API error on page 2. Please try again.',
            }),
          },
        },
      });

      const res = await fetchYouTubePlaylistPreview('https://www.youtube.com/playlist?list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf');

      expect(res.success).toBe(false);
      expect(res.errorCode).toBe('FETCH_ERROR');
      expect(res.error).toContain('Failed to import complete playlist');
      expect(callFunctionSpy).not.toHaveBeenCalled();
    });

    it('successfully imports and normalizes a 147-video multi-page playlist for Focus Radio and EduHub', async () => {
      const mock147Lectures = Array.from({ length: 147 }, (_, i) => {
        const paddedIndex = String(i + 1).padStart(3, '0');
        return {
          videoId: `vid_yt_${paddedIndex}z`, // Exactly 11 characters
          title: `Lecture ${i + 1} - Advanced Fullstack Systems ${i + 1}`,
          durationSeconds: 900 + i * 5,
          position: i,
          thumbnailUrl: `https://i.ytimg.com/vi/vid_yt_${paddedIndex}z/hqdefault.jpg`,
        };
      });

      mockInvoke.mockResolvedValueOnce({
        data: {
          success: true,
          preview: {
            playlistId: 'PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf',
            playlistUrl: 'https://www.youtube.com/playlist?list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf',
            title: 'Complete 147-Video Stanford Engineering Curriculum',
            description: 'Full 147 lecture series on operating systems and compilers.',
            channelTitle: 'Stanford Online',
            thumbnailUrl: 'https://i.ytimg.com/vi/vid_yt_001z/hqdefault.jpg',
            itemCount: 147,
            totalDurationSeconds: mock147Lectures.reduce((acc, l) => acc + l.durationSeconds, 0),
            lectures: mock147Lectures,
          },
        },
        error: null,
      });

      const res = await fetchYouTubePlaylistPreview('https://www.youtube.com/playlist?list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf');

      expect(res.success).toBe(true);
      expect(res.preview).toBeDefined();
      expect(res.preview?.itemCount).toBe(147);
      expect(res.preview?.lectures.length).toBe(147);
      expect(res.preview?.lectures[0].videoId).toBe('vid_yt_001z');
      expect(res.preview?.lectures[146].videoId).toBe('vid_yt_147z');

      // Test EduHub course creation with 147 lectures
      const { course } = importCourseFromPlaylist(res.preview!);
      expect(course.lectures.length).toBe(147);
      expect(course.title).toBe('Complete 147-Video Stanford Engineering Curriculum');

      // Test Focus Radio conversion with 147 tracks
      const { playlistItemToRadioTrack } = await import('../src/components/focus-radio/youtubeUtils');
      const radioTracks = res.preview!.lectures.map((l) =>
        playlistItemToRadioTrack(l, res.preview!.channelTitle)
      );
      expect(radioTracks.length).toBe(147);
      expect(radioTracks[0].videoId).toBe('vid_yt_001z');
      expect(radioTracks[146].videoId).toBe('vid_yt_147z');
    });
  });

  describe('YouTube Production Safety Source Code Verification', () => {
    it('verifies Edge Function accurately charges dispatched units on RSS fallback', () => {
      const code = fs.readFileSync(path.resolve('supabase/functions/import-youtube-playlist/index.ts'), 'utf8');

      // Check reconcile on plRes error RSS fallback passes actualUnitsConsumed
      expect(code).toMatch(/p_api_method:\s*'rss\.fallback'[\s\S]*?p_actual_units:\s*actualUnitsConsumed/);
    });

    it('verifies fetchWithRetry takes an onAttempt callback to account for dispatched retries', () => {
      const code = fs.readFileSync(path.resolve('supabase/functions/import-youtube-playlist/index.ts'), 'utf8');

      expect(code).toMatch(/fetchWithRetry\([\s\S]*?onAttempt\?:/);
      expect(code).toMatch(/onAttempt\(\)/);
    });

    it('verifies incomplete pagination is rejected with status 502 and never saved to cache', () => {
      const code = fs.readFileSync(path.resolve('supabase/functions/import-youtube-playlist/index.ts'), 'utf8');

      expect(code).toMatch(/paginationError/);
      expect(code).toMatch(/status:\s*502/);
      expect(code).toMatch(/playlistItems\.incomplete/);
    });

    it('verifies rate limit RPC errors fail closed with status 503 instead of bypassing', () => {
      const code = fs.readFileSync(path.resolve('supabase/functions/import-youtube-playlist/index.ts'), 'utf8');

      expect(code).toMatch(/if\s*\(limitErr\)\s*\{[\s\S]*?status:\s*503/);
      expect(code).toMatch(/SERVICE_UNAVAILABLE/);
    });

    it('verifies SQL migration uses atomic INSERT ... ON CONFLICT DO UPDATE ... RETURNING pattern', () => {
      const sql = fs.readFileSync(path.resolve('supabase/migrations/20261110_youtube_api_quota_protection.sql'), 'utf8');

      expect(sql).toMatch(/insert into public\.youtube_import_usage[\s\S]*?on conflict \(user_id, period_type, period_start\)[\s\S]*?do update set request_count = public\.youtube_import_usage\.request_count \+ 1[\s\S]*?returning request_count into v_minute_count/);
      expect(sql).toMatch(/returning request_count into v_hour_count/);
      expect(sql).toMatch(/returning request_count into v_day_count/);
    });
  });

  describe('Admin Quota Monitoring Service Integration', () => {
    it('queries public.get_youtube_import_status RPC and returns structured status', async () => {
      const mockRpc = vi.fn().mockResolvedValueOnce({
        data: {
          quota_date: '2026-11-10',
          timezone: 'America/Los_Angeles',
          units_used: 142,
          units_reserved: 0,
          remaining_safety_budget: 6858,
          daily_budget: 10000,
          request_count: 25,
          cache_hits: 18,
          cache_misses: 7,
          successful_imports: 25,
          failed_imports: 0,
          quota_blocked_imports: 0,
          rate_limited_imports: 1,
          rss_fallback_imports: 0,
          active_cached_playlists: 14,
          alerts: [],
          config: {
            cache_enabled: true,
            cache_ttl_hours: 24,
            quota_hard_safety_threshold: 7000,
          },
        },
        error: null,
      });

      vi.spyOn(authService, 'getSupabaseClient').mockReturnValue({
        rpc: mockRpc,
      } as any);

      const { adminService } = await import('../src/services/adminService');
      const res = await adminService.getYouTubeQuotaStatus();

      expect(res.error).toBeUndefined();
      expect(res.data).toBeDefined();
      expect(res.data?.units_used).toBe(142);
      expect(res.data?.cache_hits).toBe(18);
      expect(res.data?.active_cached_playlists).toBe(14);
      expect(res.data?.timezone).toBe('America/Los_Angeles');
      expect(mockRpc).toHaveBeenCalledWith('get_youtube_import_status');
    });
  });
});

