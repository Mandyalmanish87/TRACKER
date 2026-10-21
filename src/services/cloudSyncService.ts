import { getSupabaseClient, isSupabaseConfigured } from './authService';
import { AppStateData } from '../types';

export interface CloudRecord {
  userId: string;
  data: AppStateData;
  updatedAt: string;
}

const MOCK_CLOUD_STORAGE_KEY = 'tracker_mock_cloud_storage';

export const cloudSyncService = {
  /**
   * Fetch data from cloud
   */
  async fetchCloudData(userId: string): Promise<CloudRecord | null> {
    const supabase = getSupabaseClient();

    if (supabase && isSupabaseConfigured) {
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

    // Simulated cloud storage fallback
    try {
      const stored = localStorage.getItem(`${MOCK_CLOUD_STORAGE_KEY}_${userId}`);
      if (stored) {
        return JSON.parse(stored) as CloudRecord;
      }
    } catch {
      // Ignored
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

    // Simulated cloud storage fallback
    try {
      const record: CloudRecord = {
        userId,
        data,
        updatedAt: now,
      };
      localStorage.setItem(`${MOCK_CLOUD_STORAGE_KEY}_${userId}`, JSON.stringify(record));
      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  },

  /**
   * Merge local and cloud datasets without losing records
   */
  mergeDatasets(local: AppStateData, cloud: AppStateData): AppStateData {
    // Helper to merge arrays by unique 'id'
    const mergeById = <T extends { id: string }>(arr1: T[] = [], arr2: T[] = []): T[] => {
      const map = new Map<string, T>();
      for (const item of arr1) map.set(item.id, item);
      for (const item of arr2) map.set(item.id, item);
      return Array.from(map.values());
    };

    return {
      profile: {
        displayName: local.profile?.displayName || cloud.profile?.displayName || '',
        targetExam: local.profile?.targetExam || cloud.profile?.targetExam || '',
        examDate: local.profile?.examDate || cloud.profile?.examDate,
        examYear: local.profile?.examYear || cloud.profile?.examYear,
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
      },
      timetable: mergeById(local.timetable, cloud.timetable),
      occurrenceOverrides: mergeById(local.occurrenceOverrides, cloud.occurrenceOverrides),
      extraClasses: mergeById(local.extraClasses, cloud.extraClasses),
      subjects: mergeById(local.subjects, cloud.subjects),
      attendanceLogs: mergeById(local.attendanceLogs, cloud.attendanceLogs),
      tasks: mergeById(local.tasks, cloud.tasks),
      reminders: mergeById(local.reminders, cloud.reminders),
      gymWorkouts: mergeById(local.gymWorkouts, cloud.gymWorkouts),
      foodDiaryEntries: mergeById(local.foodDiaryEntries, cloud.foodDiaryEntries),
      studySessions: mergeById(local.studySessions, cloud.studySessions),
      mockTests: mergeById(local.mockTests, cloud.mockTests),
      syllabusSubjects: mergeById(local.syllabusSubjects, cloud.syllabusSubjects),
      dailyQuestions: mergeById(local.dailyQuestions, cloud.dailyQuestions),
      spacedReviews: mergeById(local.spacedReviews, cloud.spacedReviews),
      hasSampleData: false, // Once merged with user account, sample data flag is turned off
    };
  },
};
