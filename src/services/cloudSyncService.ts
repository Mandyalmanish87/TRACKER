import { getSupabaseClient, isSupabaseConfigured } from './authService';
import { AppStateData, NutritionProfile, SyncTombstone, EduHubCourse, EduHubLecture } from '../types';
import {
  DEFAULT_NUTRITION_PROFILE,
  DEFAULT_DAILY_QUESTION_TARGET,
  DEFAULT_REVIEW_INTERVALS,
} from './defaults';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PENDING_SYNC_KEY_PREFIX = 'tracker_pending_sync_';

function isValidCloudUserId(id?: string | null): boolean {
  if (!id || typeof id !== 'string') return false;
  if (id.startsWith('usr_local_') || id === 'usr_google_student_demo') return false;
  return UUID_REGEX.test(id);
}

export interface CloudRecord {
  userId: string;
  data: AppStateData;
  updatedAt: string;
}

export interface FetchCloudResult {
  status: 'found' | 'not_found' | 'unconfigured' | 'error';
  record: CloudRecord | null;
  error?: string;
}

export const cloudSyncService = {
  /**
   * Fetch data from cloud with distinct status differentiation:
   * - 'found': genuine cloud record exists
   * - 'not_found': confirmed empty cloud account (PGRST116: 0 rows)
   * - 'unconfigured': cloud credentials not configured (local-only mode)
   * - 'error': transient network, auth, timeout, or RLS error
   */
  async fetchCloudDataDetailed(userId: string): Promise<FetchCloudResult> {
    if (!isValidCloudUserId(userId)) {
      return { status: 'error', record: null, error: 'Simulated or non-UUID identities cannot perform remote cloud sync.' };
    }

    const supabase = getSupabaseClient();

    if (!supabase || !isSupabaseConfigured) {
      return { status: 'unconfigured', record: null };
    }

    try {
      const { data, error } = await supabase
        .from('user_trackers')
        .select('user_id, data, updated_at')
        .eq('user_id', userId)
        .single();

      if (error) {
        // PostgREST PGRST116: The result contains 0 rows (confirmed empty cloud account)
        if (error.code === 'PGRST116') {
          return { status: 'not_found', record: null };
        }
        // Genuine network, auth, timeout, or RLS error
        return { status: 'error', record: null, error: error.message };
      }

      if (!data) {
        return { status: 'not_found', record: null };
      }

      return {
        status: 'found',
        record: {
          userId: data.user_id,
          data: data.data as AppStateData,
          updatedAt: data.updated_at,
        },
      };
    } catch (err) {
      return { status: 'error', record: null, error: (err as Error).message || 'Failed to fetch cloud data.' };
    }
  },

  /**
   * Fetch data from cloud (convenience method returning CloudRecord or null)
   */
  async fetchCloudData(userId: string): Promise<CloudRecord | null> {
    const res = await this.fetchCloudDataDetailed(userId);
    return res.record;
  },

  /**
   * Upload data to cloud
   */
  async uploadToCloud(userId: string, data: AppStateData): Promise<{ success: boolean; error?: string }> {
    if (!isValidCloudUserId(userId)) {
      return { success: false, error: 'Simulated or non-UUID identities cannot perform remote cloud sync.' };
    }

    const supabase = getSupabaseClient();
    const now = new Date().toISOString();

    if (supabase && isSupabaseConfigured) {
      try {
        const { error } = await supabase
          .from('user_trackers')
          .upsert({
            user_id: userId,
            data: data,
            updated_at: now,
          });

        if (error) return { success: false, error: error.message };
        return { success: true };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    }

    return { success: false, error: 'Cloud sync is unavailable: Supabase credentials are not configured.' };
  },

  /**
   * Append a deletion tombstone for an entity.
   */
  addTombstone(currentTombstones: SyncTombstone[] = [], id: string, collection: string): SyncTombstone[] {
    if (!id || !collection) return Array.isArray(currentTombstones) ? currentTombstones : [];
    const now = new Date().toISOString();
    const existing = Array.isArray(currentTombstones) ? currentTombstones : [];
    const filtered = existing.filter((t) => !(t.id === id && t.collection === collection));
    return [...filtered, { id, collection, deletedAt: now }];
  },

  /**
   * Safe retention strategy:
   * Retain tombstones persistently so stale devices offline for arbitrary durations (including > 60 days)
   * cannot resurrect deleted records. Only enforce a generous capacity cap (5,000 entries)
   * to guard against unbounded growth, retaining the most recent deletions.
   */
  pruneTombstones(tombstones: SyncTombstone[] = [], maxCapacity: number = 5000): SyncTombstone[] {
    if (!Array.isArray(tombstones)) return [];
    const valid = tombstones.filter((t) => {
      if (!t || typeof t.id !== 'string' || typeof t.collection !== 'string' || typeof t.deletedAt !== 'string') {
        return false;
      }
      return !isNaN(new Date(t.deletedAt).getTime());
    });

    if (valid.length <= maxCapacity) return valid;

    return valid
      .sort((a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime())
      .slice(0, maxCapacity);
  },

  /**
   * Merge tombstones from local and remote states, keeping the latest deletion timestamp for duplicates.
   */
  mergeTombstones(localTombstones: SyncTombstone[] = [], cloudTombstones: SyncTombstone[] = []): SyncTombstone[] {
    const map = new Map<string, SyncTombstone>();
    const combined = [
      ...(Array.isArray(localTombstones) ? localTombstones : []),
      ...(Array.isArray(cloudTombstones) ? cloudTombstones : []),
    ];
    for (const t of combined) {
      if (!t || !t.id || !t.collection || !t.deletedAt) continue;
      const key = `${t.collection}:${t.id}`;
      const existing = map.get(key);
      if (!existing) {
        map.set(key, t);
      } else {
        const existingMs = new Date(existing.deletedAt).getTime();
        const currentMs = new Date(t.deletedAt).getTime();
        if (!isNaN(currentMs) && (isNaN(existingMs) || currentMs > existingMs)) {
          map.set(key, t);
        }
      }
    }
    return this.pruneTombstones(Array.from(map.values()));
  },

  /**
   * Offline sync queue: mark that local mutations are pending remote sync.
   */
  markPendingSync(userId: string): void {
    if (!userId) return;
    try {
      localStorage.setItem(`${PENDING_SYNC_KEY_PREFIX}${userId}`, new Date().toISOString());
    } catch {}
  },

  /**
   * Offline sync queue: clear pending sync flag once remote upload completes.
   */
  clearPendingSync(userId: string): void {
    if (!userId) return;
    try {
      localStorage.removeItem(`${PENDING_SYNC_KEY_PREFIX}${userId}`);
    } catch {}
  },

  /**
   * Offline sync queue: check whether mutations are pending for a user.
   */
  hasPendingSync(userId: string): boolean {
    if (!userId) return false;
    try {
      return Boolean(localStorage.getItem(`${PENDING_SYNC_KEY_PREFIX}${userId}`));
    } catch {
      return false;
    }
  },

  /**
   * Subscribe to browser online reconnection events to auto-replay pending uploads.
   */
  onNetworkReconnect(callback: () => void): () => void {
    if (typeof window === 'undefined') return () => {};
    const handleOnline = () => {
      callback();
    };
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('online', handleOnline);
    };
  },

  /**
   * Merge local and cloud datasets without losing records or resurrecting deleted items
   */
  mergeDatasets(local: AppStateData, cloud: AppStateData): AppStateData {
    const mergedTombstones = this.mergeTombstones(local.tombstones, cloud.tombstones);
    const tombstoneMap = new Map<string, string>();
    for (const t of mergedTombstones) {
      tombstoneMap.set(`${t.collection}:${t.id}`, t.deletedAt);
    }
    const supersededTombstoneKeys = new Set<string>();

    // Helper to merge arrays by unique 'id', keeping newer items based on timestamp
    // and filtering out records deleted via tombstones unless modified after deletion.
    const mergeById = <T extends { id: string }>(
      arr1: T[] = [],
      arr2: T[] = [],
      collectionName?: string
    ): T[] => {
      const map = new Map<string, T>();
      for (const item of (Array.isArray(arr1) ? arr1 : [])) {
        if (item && item.id) map.set(item.id, item);
      }
      for (const item of (Array.isArray(arr2) ? arr2 : [])) {
        if (item && item.id) {
          const existing = map.get(item.id);
          if (existing) {
            const itemAny = item as any;
            const existAny = existing as any;
            const itemTime = itemAny.updatedAt || itemAny.completedAt || itemAny.createdAt || itemAny.timestamp || itemAny.date;
            const existTime = existAny.updatedAt || existAny.completedAt || existAny.createdAt || existAny.timestamp || existAny.date;

            const itemMs = itemTime ? new Date(itemTime).getTime() : NaN;
            const existMs = existTime ? new Date(existTime).getTime() : NaN;
            const itemValid = !isNaN(itemMs);
            const existValid = !isNaN(existMs);

            if (itemValid && existValid) {
              if (itemMs > existMs) {
                map.set(item.id, item);
              } else if (existMs > itemMs) {
                // keep local existing (arr1)
              } else {
                // Equal timestamps: resolve deterministically
                // If one record has completed/done status and other does not, completed status takes precedence
                const itemDone = itemAny.status === 'done' || itemAny.status === 'completed' || Boolean(itemAny.isCompleted);
                const existDone = existAny.status === 'done' || existAny.status === 'completed' || Boolean(existAny.isCompleted);
                if (existDone && !itemDone) {
                  // keep local (arr1)
                } else {
                  map.set(item.id, item);
                }
              }
            } else if (itemValid && !existValid) {
              // Cloud has a valid timestamp, local is missing/malformed -> use cloud
              map.set(item.id, item);
            } else if (!itemValid && existValid) {
              // Local has a valid timestamp, cloud is missing/malformed -> keep local
            } else if (
              typeof existAny?.totalConducted === 'number' &&
              typeof itemAny?.totalConducted === 'number'
            ) {
              // For subjects where totalConducted reflects offline attendance marks
              if (itemAny.totalConducted >= existAny.totalConducted) {
                map.set(item.id, item);
              }
              // else keep existing local subject with higher totalConducted
            } else {
              // Cloud (arr2) takes precedence if no timestamps
              map.set(item.id, item);
            }
          } else {
            map.set(item.id, item);
          }
        }
      }

      // If a collection name is specified, filter out items that have been deleted
      // unless the entity was created or modified strictly after the tombstone deletion.
      if (collectionName) {
        const result: T[] = [];
        for (const item of map.values()) {
          const key = `${collectionName}:${item.id}`;
          const deletedAt = tombstoneMap.get(key);
          if (deletedAt) {
            const itemAny = item as any;
            const itemTime = itemAny.updatedAt || itemAny.completedAt || itemAny.createdAt || itemAny.timestamp || itemAny.date;
            const itemMs = itemTime ? new Date(itemTime).getTime() : NaN;
            const deletedMs = new Date(deletedAt).getTime();
            if (!isNaN(itemMs) && !isNaN(deletedMs) && itemMs > deletedMs) {
              result.push(item);
              supersededTombstoneKeys.add(key);
            }
            // Otherwise discarded: tombstone deletion takes precedence
          } else {
            result.push(item);
          }
        }
        return result;
      }

      return Array.from(map.values());
    };

    const mergeNutritionProfile = (localProf?: NutritionProfile, cloudProf?: NutritionProfile): NutritionProfile => {
      if (!localProf && !cloudProf) return DEFAULT_NUTRITION_PROFILE;
      if (!localProf) return cloudProf!;
      if (!cloudProf) return localProf!;
      const localTime = localProf.updatedAt ? new Date(localProf.updatedAt).getTime() : 0;
      const cloudTime = cloudProf.updatedAt ? new Date(cloudProf.updatedAt).getTime() : 0;
      return cloudTime >= localTime ? cloudProf : localProf;
    };

    const mergeEduHubCourses = (
      localCourses: EduHubCourse[] = [],
      cloudCourses: EduHubCourse[] = []
    ): EduHubCourse[] => {
      const courseMap = new Map<string, EduHubCourse>();

      // Filter out sample courses if any real user course exists
      const localReal = (Array.isArray(localCourses) ? localCourses : []).filter((c) => !c?.isSample);
      const cloudReal = (Array.isArray(cloudCourses) ? cloudCourses : []).filter((c) => !c?.isSample);

      const lList = (localReal.length > 0 || cloudReal.length > 0)
        ? localReal
        : (Array.isArray(localCourses) ? localCourses : []);
      const cList = (localReal.length > 0 || cloudReal.length > 0)
        ? cloudReal
        : (Array.isArray(cloudCourses) ? cloudCourses : []);

      for (const course of lList) {
        if (course && course.id) {
          courseMap.set(course.id, course);
        }
      }

      for (const cloudCourse of cList) {
        if (!cloudCourse || !cloudCourse.id) continue;
        const localCourse = courseMap.get(cloudCourse.id);
        if (!localCourse) {
          courseMap.set(cloudCourse.id, cloudCourse);
        } else {
          // If one is sample and other is real, real always wins
          if (localCourse.isSample && !cloudCourse.isSample) {
            courseMap.set(cloudCourse.id, cloudCourse);
            continue;
          }
          if (!localCourse.isSample && cloudCourse.isSample) {
            continue;
          }

          const localTime = new Date(localCourse.updatedAt || localCourse.createdAt || 0).getTime();
          const cloudTime = new Date(cloudCourse.updatedAt || cloudCourse.createdAt || 0).getTime();

          const newerCourse = cloudTime >= localTime ? cloudCourse : localCourse;
          const olderCourse = cloudTime >= localTime ? localCourse : cloudCourse;

          // Merge lectures between the two versions of the course
          const lectureMap = new Map<string, EduHubLecture>();
          for (const l of (olderCourse.lectures || [])) {
            if (l && l.id) lectureMap.set(l.id, l);
          }
          for (const l of (newerCourse.lectures || [])) {
            if (!l || !l.id) continue;
            const existing = lectureMap.get(l.id);
            if (!existing) {
              lectureMap.set(l.id, l);
            } else {
              // Intelligently merge lecture state:
              // 1. Completion: if either is completed, keep completed unless explicitly uncompleted later
              const isCompleted = l.completed || existing.completed;
              const completedAt = (l.completed && l.completedAt) || (existing.completed && existing.completedAt) || (isCompleted ? (l.completedAt || existing.completedAt || new Date().toISOString()) : undefined);
              // 2. Playback position: student never loses watch progress
              const lastPositionSeconds = Math.max(l.lastPositionSeconds || 0, existing.lastPositionSeconds || 0);
              const durationSeconds = Math.max(l.durationSeconds || 0, existing.durationSeconds || 0);
              // 3. Notes: preserve notes from whichever side has them; if both have notes, prefer newer
              const notes = (l.notes && l.notes.trim()) ? l.notes : existing.notes;

              lectureMap.set(l.id, {
                ...existing,
                ...l,
                completed: isCompleted,
                completedAt,
                lastPositionSeconds,
                durationSeconds,
                notes,
              });
            }
          }

          const mergedCourse: EduHubCourse = {
            ...newerCourse,
            lectures: Array.from(lectureMap.values()),
            updatedAt: new Date(Math.max(isNaN(localTime) ? 0 : localTime, isNaN(cloudTime) ? 0 : cloudTime, Date.now())).toISOString(),
          };
          courseMap.set(cloudCourse.id, mergedCourse);
        }
      }

      // Filter via tombstones for 'eduhubCourses'
      const result: EduHubCourse[] = [];
      for (const course of courseMap.values()) {
        const key = `eduhubCourses:${course.id}`;
        const deletedAt = tombstoneMap.get(key);
        if (deletedAt) {
          const courseTime = new Date(course.updatedAt || course.createdAt || 0).getTime();
          const delTime = new Date(deletedAt).getTime();
          if (!isNaN(courseTime) && !isNaN(delTime) && courseTime > delTime) {
            result.push(course);
            supersededTombstoneKeys.add(key);
          }
        } else {
          result.push(course);
        }
      }

      return result;
    };

    return {
      schemaVersion: 2,
      hasSampleData: false, // Once merged with user account, sample data flag is turned off
      profile: {
        displayName: local.profile?.displayName || cloud.profile?.displayName || '',
        targetExam: local.profile?.targetExam || cloud.profile?.targetExam || '',
        examDate: local.profile?.examDate || cloud.profile?.examDate,
        examYear: local.profile?.examYear || cloud.profile?.examYear,
        avatarUrl: local.profile?.avatarUrl || cloud.profile?.avatarUrl,
        email: local.profile?.email || cloud.profile?.email,
        institution: local.profile?.institution || cloud.profile?.institution,
        department: local.profile?.department || cloud.profile?.department,
        studentId: local.profile?.studentId || cloud.profile?.studentId,
        bio: local.profile?.bio || cloud.profile?.bio,
      },
      settings: {
        themeMode: local.settings?.themeMode || cloud.settings?.themeMode || 'system',
        accentColor: local.settings?.accentColor || cloud.settings?.accentColor || 'terracotta',
        backgroundStyle: local.settings?.backgroundStyle || cloud.settings?.backgroundStyle || 'minimal',
        customBackgroundUrl: local.settings?.customBackgroundUrl || cloud.settings?.customBackgroundUrl,
        studyDayRolloverHour: local.settings?.studyDayRolloverHour ?? cloud.settings?.studyDayRolloverHour ?? 0,
        showExamCountdown: local.settings?.showExamCountdown ?? cloud.settings?.showExamCountdown ?? true,
        showFocusRadio: local.settings?.showFocusRadio ?? cloud.settings?.showFocusRadio ?? false,
        attendanceRequirement: local.settings?.attendanceRequirement ?? cloud.settings?.attendanceRequirement ?? 75,
        dashboardLayoutMode: local.settings?.dashboardLayoutMode || cloud.settings?.dashboardLayoutMode || 'bento',
        dashboardDensity: local.settings?.dashboardDensity || cloud.settings?.dashboardDensity || 'compact',
        userMode: local.settings?.userMode || cloud.settings?.userMode || 'individual',
        dashboardWidgetOrder: local.settings?.dashboardWidgetOrder || cloud.settings?.dashboardWidgetOrder,
      },
      subjects: mergeById(local.subjects, cloud.subjects, 'subjects'),
      timetable: mergeById(local.timetable, cloud.timetable, 'timetable'),
      attendanceLogs: mergeById(local.attendanceLogs, cloud.attendanceLogs, 'attendanceLogs'),
      studySessions: mergeById(local.studySessions, cloud.studySessions, 'studySessions'),
      gymWorkouts: mergeById(local.gymWorkouts, cloud.gymWorkouts, 'gymWorkouts'),
      reminders: mergeById(local.reminders, cloud.reminders, 'reminders'),
      syllabusSubjects: mergeById(local.syllabusSubjects, cloud.syllabusSubjects, 'syllabusSubjects'),
      occurrenceOverrides: mergeById(local.occurrenceOverrides, cloud.occurrenceOverrides, 'occurrenceOverrides'),
      extraClasses: mergeById(local.extraClasses, cloud.extraClasses, 'extraClasses'),
      tasks: mergeById(local.tasks, cloud.tasks, 'tasks'),
      spacedReviews: mergeById(local.spacedReviews, cloud.spacedReviews, 'spacedReviews'),
      dailyQuestions: mergeById(local.dailyQuestions, cloud.dailyQuestions, 'dailyQuestions'),
      dailyQuestionTarget: local.dailyQuestionTarget ?? cloud.dailyQuestionTarget ?? DEFAULT_DAILY_QUESTION_TARGET,
      reviewIntervals: (Array.isArray(local.reviewIntervals) && local.reviewIntervals.length > 0)
        ? local.reviewIntervals
        : (Array.isArray(cloud.reviewIntervals) && cloud.reviewIntervals.length > 0)
          ? cloud.reviewIntervals
          : DEFAULT_REVIEW_INTERVALS,
      foodDiaryEntries: mergeById(local.foodDiaryEntries, cloud.foodDiaryEntries, 'foodDiaryEntries'),
      customFoods: mergeById(local.customFoods, cloud.customFoods, 'customFoods'),
      recipes: mergeById(local.recipes, cloud.recipes, 'recipes'),
      weightLogs: mergeById(local.weightLogs, cloud.weightLogs, 'weightLogs'),
      nutritionProfile: mergeNutritionProfile(local.nutritionProfile, cloud.nutritionProfile),
      radioUrls: mergeById(local.radioUrls, cloud.radioUrls, 'radioUrls'),
      radioQueue: mergeById(local.radioQueue, cloud.radioQueue, 'radioQueue'),
      radioLoopMode: local.radioLoopMode ?? cloud.radioLoopMode ?? 'off',
      radioIsShuffle: local.radioIsShuffle ?? cloud.radioIsShuffle ?? false,
      customPlaylists: mergeById(local.customPlaylists, cloud.customPlaylists, 'customPlaylists'),
      mockTests: mergeById(local.mockTests, cloud.mockTests, 'mockTests'),
      errorLogs: mergeById(local.errorLogs, cloud.errorLogs, 'errorLogs'),
      events: mergeById(local.events, cloud.events, 'events'),
      eduhubCourses: mergeEduHubCourses(local.eduhubCourses, cloud.eduhubCourses),
      tombstones: mergedTombstones.filter((t) => !supersededTombstoneKeys.has(`${t.collection}:${t.id}`)),
    };
  },
};
