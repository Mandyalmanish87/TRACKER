import { getSupabaseClient, isSupabaseConfigured } from './authService';
import { AppStateData, NutritionProfile } from '../types';
import {
  DEFAULT_NUTRITION_PROFILE,
  DEFAULT_DAILY_QUESTION_TARGET,
  DEFAULT_REVIEW_INTERVALS,
} from './defaults';

export interface CloudRecord {
  userId: string;
  data: AppStateData;
  updatedAt: string;
}

export const cloudSyncService = {
  /**
   * Fetch data from cloud
   */
  async fetchCloudData(userId: string): Promise<CloudRecord | null> {
    const supabase = getSupabaseClient();

    if (supabase && isSupabaseConfigured) {
      if (!userId || userId.startsWith('usr_local_') || userId === 'usr_google_student_demo') {
        return null;
      }
      try {
        const { data, error } = await supabase
          .from('user_trackers')
          .select('user_id, data, updated_at')
          .eq('user_id', userId)
          .single();

        if (error || !data) return null;

        return {
          userId: data.user_id,
          data: data.data as AppStateData,
          updatedAt: data.updated_at,
        };
      } catch (err) {
        console.warn('[CloudSync] Error fetching cloud data:', err);
        return null;
      }
    }

    return null;
  },

  /**
   * Upload data to cloud
   */
  async uploadToCloud(userId: string, data: AppStateData): Promise<{ success: boolean; error?: string }> {
    const supabase = getSupabaseClient();
    const now = new Date().toISOString();

    if (supabase && isSupabaseConfigured) {
      if (!userId || userId.startsWith('usr_local_') || userId === 'usr_google_student_demo') {
        return { success: false, error: 'Simulated identities cannot perform remote cloud sync.' };
      }
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
   * Merge local and cloud datasets without losing records
   */
  mergeDatasets(local: AppStateData, cloud: AppStateData): AppStateData {
    // Helper to merge arrays by unique 'id', keeping newer items based on timestamp
    const mergeById = <T extends { id: string }>(arr1: T[] = [], arr2: T[] = []): T[] => {
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
            if (itemTime && existTime) {
              const itemMs = new Date(itemTime).getTime();
              const existMs = new Date(existTime).getTime();
              if (!isNaN(itemMs) && !isNaN(existMs) && itemMs >= existMs) {
                map.set(item.id, item);
              }
              // else keep existing (arr1)
            } else {
              // Cloud (arr2) takes precedence if no timestamps
              map.set(item.id, item);
            }
          } else {
            map.set(item.id, item);
          }
        }
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
      subjects: mergeById(local.subjects, cloud.subjects),
      timetable: mergeById(local.timetable, cloud.timetable),
      attendanceLogs: mergeById(local.attendanceLogs, cloud.attendanceLogs),
      studySessions: mergeById(local.studySessions, cloud.studySessions),
      gymWorkouts: mergeById(local.gymWorkouts, cloud.gymWorkouts),
      reminders: mergeById(local.reminders, cloud.reminders),
      syllabusSubjects: mergeById(local.syllabusSubjects, cloud.syllabusSubjects),
      occurrenceOverrides: mergeById(local.occurrenceOverrides, cloud.occurrenceOverrides),
      extraClasses: mergeById(local.extraClasses, cloud.extraClasses),
      tasks: mergeById(local.tasks, cloud.tasks),
      spacedReviews: mergeById(local.spacedReviews, cloud.spacedReviews),
      dailyQuestions: mergeById(local.dailyQuestions, cloud.dailyQuestions),
      dailyQuestionTarget: local.dailyQuestionTarget ?? cloud.dailyQuestionTarget ?? DEFAULT_DAILY_QUESTION_TARGET,
      reviewIntervals: (Array.isArray(local.reviewIntervals) && local.reviewIntervals.length > 0)
        ? local.reviewIntervals
        : (Array.isArray(cloud.reviewIntervals) && cloud.reviewIntervals.length > 0)
          ? cloud.reviewIntervals
          : DEFAULT_REVIEW_INTERVALS,
      foodDiaryEntries: mergeById(local.foodDiaryEntries, cloud.foodDiaryEntries),
      customFoods: mergeById(local.customFoods, cloud.customFoods),
      recipes: mergeById(local.recipes, cloud.recipes),
      weightLogs: mergeById(local.weightLogs, cloud.weightLogs),
      nutritionProfile: mergeNutritionProfile(local.nutritionProfile, cloud.nutritionProfile),
      radioUrls: mergeById(local.radioUrls, cloud.radioUrls),
      radioQueue: mergeById(local.radioQueue, cloud.radioQueue),
      radioLoopMode: local.radioLoopMode ?? cloud.radioLoopMode ?? 'off',
      radioIsShuffle: local.radioIsShuffle ?? cloud.radioIsShuffle ?? false,
      customPlaylists: mergeById(local.customPlaylists, cloud.customPlaylists),
      mockTests: mergeById(local.mockTests, cloud.mockTests),
      errorLogs: mergeById(local.errorLogs, cloud.errorLogs),
      events: mergeById(local.events, cloud.events),
    };
  },
};
