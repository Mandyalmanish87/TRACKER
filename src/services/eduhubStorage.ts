import { EduHubCourse, EduHubLecture, YouTubePlaylistPreview } from '../types/eduhub';
import { parseYouTubeVideoId } from '../components/focus-radio/youtubeUtils';
import { storageService } from './storage';
import { cloudSyncService } from './cloudSyncService';

const STORAGE_KEY = 'tracker_eduhub_courses_v1';

/**
 * Format seconds into a friendly workload string: e.g. "2h 15m 30s" or "45m 10s"
 */
export function formatRemainingWorkload(totalSeconds: number): string {
  if (!totalSeconds || totalSeconds <= 0) return '0s';

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);

  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0 || hours > 0) parts.push(`${minutes}m`);
  parts.push(`${seconds}s`);

  return parts.join(' ');
}

/**
 * Format seconds into standard digital player timestamp: "MM:SS" or "HH:MM:SS"
 */
export function formatDigitalTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  const mStr = String(m).padStart(2, '0');
  const sStr = String(s).padStart(2, '0');

  if (h > 0) {
    return `${h}:${mStr}:${sStr}`;
  }
  return `${mStr}:${sStr}`;
}

/**
 * Calculates comprehensive progress and workload statistics for an EduHub course.
 */
export function calculateCourseStats(course: EduHubCourse) {
  const lectures = course.lectures || [];
  const totalLectures = lectures.length;
  const completedLectures = lectures.filter((l) => l.completed).length;
  const completionPercentage = totalLectures > 0
    ? Math.round((completedLectures / totalLectures) * 100)
    : 0;

  // Total duration of all lectures
  const totalDurationSeconds = lectures.reduce((acc, l) => acc + (l.durationSeconds || 0), 0);

  // Remaining watch time from incomplete lectures:
  // For uncompleted lectures, subtract watched progress so student gets accurate remaining time
  const remainingSeconds = lectures.reduce((acc, l) => {
    if (l.completed) return acc;
    const dur = l.durationSeconds || 0;
    const pos = l.lastPositionSeconds || 0;
    const remainingForLecture = Math.max(0, dur - pos);
    return acc + (remainingForLecture > 0 ? remainingForLecture : dur);
  }, 0);

  return {
    totalLectures,
    completedLectures,
    remainingLectures: totalLectures - completedLectures,
    completionPercentage,
    totalDurationSeconds,
    remainingSeconds,
    formattedRemainingWorkload: formatRemainingWorkload(remainingSeconds),
    formattedTotalDuration: formatDigitalTime(totalDurationSeconds),
  };
}

export const SAMPLE_EDUHUB_COURSE: EduHubCourse = {
  id: 'sample-cs50-intro',
  title: 'CS50: Introduction to Computer Science',
  description: 'Harvard university fundamental computer science and programming course lectures.',
  color: 'terracotta',
  isSample: true,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
  lectures: [
    {
      id: 'lec-cs50-01',
      title: 'Lecture 0 - Scratch & Computational Thinking',
      youtubeUrl: 'https://www.youtube.com/watch?v=YoXxevp1WRQ',
      videoId: 'YoXxevp1WRQ',
      durationSeconds: 8760, // 2h 26m
      lastPositionSeconds: 8760,
      completed: true,
      addedAt: '2026-10-01T00:00:00.000Z',
      completedAt: '2026-10-05T12:00:00.000Z',
    },
    {
      id: 'lec-cs50-02',
      title: 'Lecture 1 - C Programming Basics',
      youtubeUrl: 'https://www.youtube.com/watch?v=34HmhyvO_5I',
      videoId: '34HmhyvO_5I',
      durationSeconds: 9120, // 2h 32m
      lastPositionSeconds: 3600, // 1h in
      completed: false,
      addedAt: '2026-10-02T00:00:00.000Z',
    },
    {
      id: 'lec-cs50-03',
      title: 'Lecture 2 - Arrays & Memory',
      youtubeUrl: 'https://www.youtube.com/watch?v=8m9gW0kI44I',
      videoId: '8m9gW0kI44I',
      durationSeconds: 7800, // 2h 10m
      lastPositionSeconds: 0,
      completed: false,
      addedAt: '2026-10-03T00:00:00.000Z',
    },
  ],
};

/**
 * Loads all EduHub courses from localStorage.
 */
export function loadEduHubCourses(): EduHubCourse[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.filter((c: any) => c && !c.isSample && c.id !== 'sample-cs50-intro');
      }
    }
    // Fallback: check if active AppStateData has eduhubCourses
    const v2Raw = localStorage.getItem('tracker_app_data_v2');
    if (v2Raw) {
      const v2Parsed = JSON.parse(v2Raw);
      if (Array.isArray(v2Parsed?.eduhubCourses) && v2Parsed.eduhubCourses.length > 0) {
        return v2Parsed.eduhubCourses.filter((c: any) => c && !c.isSample && c.id !== 'sample-cs50-intro');
      }
    }
  } catch (err) {
    console.error('[EduHubStorage] Failed to read courses from localStorage:', err);
  }

  // Clean empty state for production
  return [];
}

/**
 * Saves all EduHub courses to localStorage.
 */
export function saveEduHubCourses(courses: EduHubCourse[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(courses));
    window.dispatchEvent(new CustomEvent('tracker_eduhub_updated', { detail: courses }));
  } catch (err) {
    console.error('[EduHubStorage] Failed to save courses to localStorage:', err);
  }
}

/**
 * Creates a new course and persists it.
 */
export function createCourse(title: string, description?: string, color: string = 'terracotta'): EduHubCourse {
  const newCourse: EduHubCourse = {
    id: `course_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    title: title.trim(),
    description: description?.trim() || '',
    color,
    lectures: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isSample: false,
  };

  const existing = loadEduHubCourses().filter((c) => !c.isSample);
  const updated = [newCourse, ...existing];
  saveEduHubCourses(updated);
  return newCourse;
}

/**
 * Finds an existing course matching a given YouTube playlist ID (Duplicate detection).
 */
export function findCourseByPlaylistId(playlistId: string): EduHubCourse | undefined {
  if (!playlistId) return undefined;
  const courses = loadEduHubCourses();
  return courses.find((c) => c.playlistId === playlistId);
}

/**
 * Imports a course from a YouTube playlist preview.
 * If syncExisting is true and an existing course is found, updates it without creating duplicates.
 */
export function importCourseFromPlaylist(
  preview: YouTubePlaylistPreview,
  options?: { syncExisting?: boolean; color?: string }
): { course: EduHubCourse; updated: boolean; isExisting: boolean } {
  const existingCourse = findCourseByPlaylistId(preview.playlistId);

  if (existingCourse && options?.syncExisting) {
    const synced = syncCourseWithPlaylist(existingCourse.id, preview);
    return { course: synced, updated: true, isExisting: true };
  }

  // Create new course
  const newCourse: EduHubCourse = {
    id: `course_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    title: preview.title.trim() || 'Imported Course',
    description: preview.description?.trim() || `Imported from YouTube Playlist: ${preview.title}`,
    color: options?.color || 'terracotta',
    playlistId: preview.playlistId,
    playlistUrl: preview.playlistUrl,
    lastSyncedAt: new Date().toISOString(),
    lectures: preview.lectures.map((item, idx) => ({
      id: `lec_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
      title: item.title,
      youtubeUrl: `https://www.youtube.com/watch?v=${item.videoId}`,
      videoId: item.videoId,
      durationSeconds: item.durationSeconds > 0 ? Math.round(item.durationSeconds) : 0,
      lastPositionSeconds: 0,
      completed: false,
      thumbnailUrl: item.thumbnailUrl,
      addedAt: new Date().toISOString(),
    })),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isSample: false,
  };

  const currentList = loadEduHubCourses().filter((c) => !c.isSample);
  saveEduHubCourses([newCourse, ...currentList]);

  return { course: newCourse, updated: false, isExisting: Boolean(existingCourse) };
}

/**
 * Synchronizes an existing course with fresh playlist data from YouTube:
 * - Preserves existing completion status, watch position, and notes.
 * - Updates lecture titles, durations, and thumbnails.
 * - Adds newly published lectures to the playlist.
 * - Preserves playlist ordering.
 */
export function syncCourseWithPlaylist(courseId: string, preview: YouTubePlaylistPreview): EduHubCourse {
  const courses = loadEduHubCourses();
  const existingCourse = courses.find((c) => c.id === courseId);
  if (!existingCourse) {
    throw new Error(`Course with ID ${courseId} not found.`);
  }

  // Map existing lectures by videoId to preserve completed, position, notes
  const existingLectureMap = new Map<string, EduHubLecture>();
  (existingCourse.lectures || []).forEach((l) => {
    existingLectureMap.set(l.videoId, l);
  });

  const mergedLectures: EduHubLecture[] = preview.lectures.map((item, idx) => {
    const existing = existingLectureMap.get(item.videoId);
    if (existing) {
      return {
        ...existing,
        title: item.title || existing.title,
        durationSeconds: item.durationSeconds > 0 ? Math.round(item.durationSeconds) : existing.durationSeconds,
        thumbnailUrl: item.thumbnailUrl || existing.thumbnailUrl,
      };
    }

    // New lecture in playlist
    return {
      id: `lec_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
      title: item.title,
      youtubeUrl: `https://www.youtube.com/watch?v=${item.videoId}`,
      videoId: item.videoId,
      durationSeconds: item.durationSeconds > 0 ? Math.round(item.durationSeconds) : 0,
      lastPositionSeconds: 0,
      completed: false,
      thumbnailUrl: item.thumbnailUrl,
      addedAt: new Date().toISOString(),
    };
  });

  const updatedCourse: EduHubCourse = {
    ...existingCourse,
    title: preview.title || existingCourse.title,
    description: preview.description || existingCourse.description,
    playlistId: preview.playlistId,
    playlistUrl: preview.playlistUrl,
    lastSyncedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lectures: mergedLectures,
  };

  const updatedCourses = courses.map((c) => (c.id === courseId ? updatedCourse : c));
  saveEduHubCourses(updatedCourses);

  return updatedCourse;
}

/**
 * Updates an existing course's details.
 */
export function updateCourse(courseId: string, updates: Partial<EduHubCourse>): EduHubCourse[] {
  const courses = loadEduHubCourses();
  const updated = courses.map((c) => {
    if (c.id === courseId) {
      return {
        ...c,
        ...updates,
        updatedAt: new Date().toISOString(),
      };
    }
    return c;
  });
  saveEduHubCourses(updated);
  return updated;
}

/**
 * Deletes a course.
 */
export function deleteCourse(courseId: string): EduHubCourse[] {
  const courses = loadEduHubCourses();
  const updated = courses.filter((c) => c.id !== courseId);
  saveEduHubCourses(updated);

  try {
    const activeData = storageService.loadData();
    const updatedTombstones = cloudSyncService.addTombstone(activeData.tombstones, courseId, 'eduhubCourses');
    storageService.saveData({
      ...activeData,
      eduhubCourses: updated,
      tombstones: updatedTombstones,
    });
  } catch {}

  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(
        new CustomEvent('tracker_eduhub_deleted', {
          detail: { courseId },
        })
      );
    } catch {}
  }

  return updated;
}

/**
 * Adds a new lecture to a course playlist from YouTube URL or ID.
 */
export function addLectureToCourse(
  courseId: string,
  urlOrId: string,
  title?: string,
  durationSeconds: number = 0
): EduHubCourse[] {
  const videoId = parseYouTubeVideoId(urlOrId);
  if (!videoId) {
    throw new Error('Invalid YouTube URL or Video ID. Please enter a valid YouTube link.');
  }

  const cleanUrl = urlOrId.includes('http') ? urlOrId.trim() : `https://www.youtube.com/watch?v=${videoId}`;
  const lectureTitle = title?.trim() || `Lecture (${videoId})`;

  const newLecture: EduHubLecture = {
    id: `lec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    title: lectureTitle,
    youtubeUrl: cleanUrl,
    videoId,
    durationSeconds: durationSeconds > 0 ? durationSeconds : 0,
    lastPositionSeconds: 0,
    completed: false,
    addedAt: new Date().toISOString(),
  };

  const courses = loadEduHubCourses();
  const updated = courses.map((c) => {
    if (c.id === courseId) {
      return {
        ...c,
        lectures: [...(c.lectures || []), newLecture],
        updatedAt: new Date().toISOString(),
      };
    }
    return c;
  });

  saveEduHubCourses(updated);
  return updated;
}

/**
 * Removes a lecture from a course playlist.
 */
export function removeLectureFromCourse(courseId: string, lectureId: string): EduHubCourse[] {
  const courses = loadEduHubCourses();
  const updated = courses.map((c) => {
    if (c.id === courseId) {
      return {
        ...c,
        lectures: (c.lectures || []).filter((l) => l.id !== lectureId),
        updatedAt: new Date().toISOString(),
      };
    }
    return c;
  });
  saveEduHubCourses(updated);
  return updated;
}

/**
 * Reorders lectures within a course playlist.
 */
export function reorderLectures(courseId: string, fromIndex: number, toIndex: number): EduHubCourse[] {
  const courses = loadEduHubCourses();
  const updated = courses.map((c) => {
    if (c.id === courseId) {
      const list = [...(c.lectures || [])];
      if (fromIndex < 0 || fromIndex >= list.length || toIndex < 0 || toIndex >= list.length) {
        return c;
      }
      const [moved] = list.splice(fromIndex, 1);
      list.splice(toIndex, 0, moved);
      return {
        ...c,
        lectures: list,
        updatedAt: new Date().toISOString(),
      };
    }
    return c;
  });
  saveEduHubCourses(updated);
  return updated;
}

/**
 * Updates lecture playback position and optional auto-completion threshold.
 */
export function updateLectureProgress(
  courseId: string,
  lectureId: string,
  positionSeconds: number,
  durationSeconds?: number
): EduHubCourse[] {
  const courses = loadEduHubCourses();
  const updated = courses.map((c) => {
    if (c.id === courseId) {
      const lectures = (c.lectures || []).map((l) => {
        if (l.id === lectureId) {
          const finalDuration = durationSeconds && durationSeconds > 0
            ? Math.round(durationSeconds)
            : l.durationSeconds;

          // Auto-mark complete threshold: >= 90% of duration
          const shouldAutoComplete = finalDuration > 0 && positionSeconds >= finalDuration * 0.9;
          const isCompleted = l.completed || shouldAutoComplete;

          return {
            ...l,
            lastPositionSeconds: Math.round(positionSeconds),
            durationSeconds: finalDuration,
            completed: isCompleted,
            completedAt: !l.completed && isCompleted ? new Date().toISOString() : l.completedAt,
          };
        }
        return l;
      });

      return {
        ...c,
        lectures,
        updatedAt: new Date().toISOString(),
      };
    }
    return c;
  });

  saveEduHubCourses(updated);
  return updated;
}

/**
 * Toggles completed status of a lecture manually.
 */
export function toggleLectureCompleted(courseId: string, lectureId: string): EduHubCourse[] {
  const courses = loadEduHubCourses();
  const updated = courses.map((c) => {
    if (c.id === courseId) {
      const lectures = (c.lectures || []).map((l) => {
        if (l.id === lectureId) {
          const nextCompleted = !l.completed;
          return {
            ...l,
            completed: nextCompleted,
            completedAt: nextCompleted ? new Date().toISOString() : undefined,
          };
        }
        return l;
      });

      return {
        ...c,
        lectures,
        updatedAt: new Date().toISOString(),
      };
    }
    return c;
  });

  saveEduHubCourses(updated);
  return updated;
}

