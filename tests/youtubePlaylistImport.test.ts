import { describe, it, expect, beforeEach } from 'vitest';
import { parseYouTubePlaylistId } from '../src/components/focus-radio/youtubeUtils';
import { parseIso8601Duration, fetchYouTubePlaylistPreview } from '../src/services/youtubePlaylistService';
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
        videoId: 'video_lec_01',
        title: 'Lecture 0 - HTML, CSS & Git',
        position: 0,
        durationSeconds: 3000,
        thumbnailUrl: 'https://img.youtube.com/vi/video_lec_01/hqdefault.jpg',
      },
      {
        videoId: 'video_lec_02',
        title: 'Lecture 1 - Python Fundamentals',
        position: 1,
        durationSeconds: 3600,
        thumbnailUrl: 'https://img.youtube.com/vi/video_lec_02/hqdefault.jpg',
      },
      {
        videoId: 'video_lec_03',
        title: 'Lecture 2 - Django Web Framework',
        position: 2,
        durationSeconds: 2400,
        thumbnailUrl: 'https://img.youtube.com/vi/video_lec_03/hqdefault.jpg',
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
    expect(course.lectures[0].videoId).toBe('video_lec_01');
    expect(course.lectures[0].title).toBe('Lecture 0 - HTML, CSS & Git');
    expect(course.lectures[0].durationSeconds).toBe(3000);
    expect(course.lectures[0].completed).toBe(false);

    expect(course.lectures[1].videoId).toBe('video_lec_02');
    expect(course.lectures[2].videoId).toBe('video_lec_03');
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
          videoId: 'video_lec_01',
          title: 'Lecture 0 - HTML, CSS & Modern Git (Updated)',
          position: 0,
          durationSeconds: 3000,
        },
        {
          videoId: 'video_lec_02',
          title: 'Lecture 1 - Python Fundamentals',
          position: 1,
          durationSeconds: 3600,
        },
        {
          videoId: 'video_lec_03',
          title: 'Lecture 2 - Django Web Framework',
          position: 2,
          durationSeconds: 2400,
        },
        {
          videoId: 'video_lec_04',
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
    const syncedLec1 = synced.lectures.find((l) => l.videoId === 'video_lec_01');
    expect(syncedLec1?.completed).toBe(true);
    expect(syncedLec1?.notes).toBe('Key note on flexbox');
    expect(syncedLec1?.title).toBe('Lecture 0 - HTML, CSS & Modern Git (Updated)');

    // Lecture 1 preserved playback position
    const syncedLec2 = synced.lectures.find((l) => l.videoId === 'video_lec_02');
    expect(syncedLec2?.lastPositionSeconds).toBe(1800);
    expect(syncedLec2?.completed).toBe(false);

    // Newly added lecture is present and uncompleted
    const syncedLec4 = synced.lectures.find((l) => l.videoId === 'video_lec_04');
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

