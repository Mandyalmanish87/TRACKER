// Migration utilities for Tracker app
import { AppStateData, UserProfile, AppSettings } from '../types';
import {
  DEFAULT_NUTRITION_PROFILE,
  DEFAULT_DAILY_QUESTION_TARGET,
  DEFAULT_REVIEW_INTERVALS,
  DEFAULT_CUSTOM_PLAYLISTS,
} from './defaults';

// New storage key for v2 schema
export const STORAGE_KEY_V2 = 'tracker_app_data_v2';

/**
 * Pure function that migrates raw v1 data (or incomplete data) to the v2 schema.
 * It preserves all existing arrays and fields, adds defaults for new top‑level keys
 * and sets `schemaVersion` to 2.
 */
export function migrateV1ToV2(raw: unknown): AppStateData {
  const v1 = (raw && typeof raw === 'object' ? raw : {}) as Partial<AppStateData>;
  // Preserve existing data structures, ensuring they are arrays
  const subjects = Array.isArray(v1.subjects) ? v1.subjects : [];
  const timetable = Array.isArray(v1.timetable) ? v1.timetable : [];
  const attendanceLogs = Array.isArray(v1.attendanceLogs) ? v1.attendanceLogs : [];
  const studySessions = Array.isArray(v1.studySessions)
    ? v1.studySessions.map((s: any) => ({
        ...s,
        status: s.status ?? 'completed',
      }))
    : [];
  const gymWorkouts = Array.isArray(v1.gymWorkouts) ? v1.gymWorkouts : [];
  const reminders = Array.isArray(v1.reminders) ? v1.reminders : [];

  const defaultProfile: UserProfile = {
    displayName: v1.profile?.displayName ?? '',
    targetExam: v1.profile?.targetExam ?? '',
    examDate: v1.profile?.examDate,
    examYear: v1.profile?.examYear,
    avatarUrl: v1.profile?.avatarUrl,
    email: v1.profile?.email,
    institution: v1.profile?.institution,
    department: v1.profile?.department,
    studentId: v1.profile?.studentId,
    bio: v1.profile?.bio,
  };

  const defaultSettings: AppSettings = {
    themeMode: v1.settings?.themeMode ?? 'system',
    accentColor: v1.settings?.accentColor ?? 'terracotta',
    backgroundStyle: v1.settings?.backgroundStyle ?? 'minimal',
    customBackgroundUrl: v1.settings?.customBackgroundUrl,
    studyDayRolloverHour: typeof v1.settings?.studyDayRolloverHour === 'number' ? v1.settings.studyDayRolloverHour : 0,
    showExamCountdown: typeof v1.settings?.showExamCountdown === 'boolean' ? v1.settings.showExamCountdown : true,
    showFocusRadio: typeof v1.settings?.showFocusRadio === 'boolean' ? v1.settings.showFocusRadio : false,
    attendanceRequirement: v1.settings?.attendanceRequirement,
    dashboardWidgetOrder: v1.settings?.dashboardWidgetOrder,
    dashboardLayoutMode: v1.settings?.dashboardLayoutMode || 'bento',
    dashboardDensity: v1.settings?.dashboardDensity || 'compact',
    userMode: v1.settings?.userMode === 'class_based' ? 'class_based' : 'individual',
  };

  return {
    // Existing v1 fields
    hasSampleData: Boolean(v1.hasSampleData),
    subjects,
    timetable,
    attendanceLogs,
    studySessions,
    gymWorkouts,
    reminders,
    // New v2 fields
    schemaVersion: 2,
    profile: defaultProfile,
    settings: defaultSettings,
    syllabusSubjects: Array.isArray(v1.syllabusSubjects) ? v1.syllabusSubjects : [],
    occurrenceOverrides: Array.isArray(v1.occurrenceOverrides) ? v1.occurrenceOverrides : [],
    extraClasses: Array.isArray(v1.extraClasses) ? v1.extraClasses : [],
    tasks: Array.isArray(v1.tasks) ? v1.tasks : [],
    spacedReviews: Array.isArray(v1.spacedReviews) ? v1.spacedReviews : [],
    dailyQuestions: Array.isArray(v1.dailyQuestions) ? v1.dailyQuestions : [],
    dailyQuestionTarget: typeof v1.dailyQuestionTarget === 'number' ? v1.dailyQuestionTarget : DEFAULT_DAILY_QUESTION_TARGET,
    reviewIntervals: Array.isArray(v1.reviewIntervals) ? v1.reviewIntervals : DEFAULT_REVIEW_INTERVALS,
    foodDiaryEntries: Array.isArray(v1.foodDiaryEntries) ? v1.foodDiaryEntries : [],
    customFoods: Array.isArray(v1.customFoods) ? v1.customFoods : [],
    recipes: Array.isArray(v1.recipes) ? v1.recipes : [],
    weightLogs: Array.isArray(v1.weightLogs) ? v1.weightLogs : [],
    nutritionProfile: v1.nutritionProfile ?? DEFAULT_NUTRITION_PROFILE,
    radioUrls: Array.isArray(v1.radioUrls) ? v1.radioUrls : [],
    radioQueue: Array.isArray(v1.radioQueue) ? v1.radioQueue : [],
    radioLoopMode: v1.radioLoopMode === 'all' || v1.radioLoopMode === 'one' ? v1.radioLoopMode : 'off',
    radioIsShuffle: Boolean(v1.radioIsShuffle),
    customPlaylists: Array.isArray(v1.customPlaylists) ? v1.customPlaylists : JSON.parse(JSON.stringify(DEFAULT_CUSTOM_PLAYLISTS)),
    mockTests: Array.isArray(v1.mockTests) ? v1.mockTests : [],
    errorLogs: Array.isArray(v1.errorLogs) ? v1.errorLogs : [],
    events: Array.isArray(v1.events) ? v1.events : [],
  };
}
