// Migration utilities for Tracker app
import { AppStateData, UserProfile, AppSettings } from '../types';

// New storage key for v2 schema
export const STORAGE_KEY_V2 = 'tracker_app_data_v2';

/**
 * Pure function that migrates raw v1 data (or incomplete data) to the v2 schema.
 * It preserves all existing arrays and fields, adds defaults for new top‑level keys
 * and sets `schemaVersion` to 2.
 */
export function migrateV1ToV2(raw: unknown): AppStateData {
  const v1 = raw as Partial<AppStateData>;
  // Preserve existing data structures, ensuring they are arrays
  const subjects = Array.isArray(v1.subjects) ? v1.subjects : [];
  const timetable = Array.isArray(v1.timetable) ? v1.timetable : [];
  const attendanceLogs = Array.isArray(v1.attendanceLogs) ? v1.attendanceLogs : [];
  const studySessions = Array.isArray(v1.studySessions) ? v1.studySessions : [];
  const gymWorkouts = Array.isArray(v1.gymWorkouts) ? v1.gymWorkouts : [];
  const reminders = Array.isArray(v1.reminders) ? v1.reminders : [];

  const defaultProfile: UserProfile = {
    displayName: '',
    targetExam: '',
    // examDate and examYear are optional
  };

  const defaultSettings: AppSettings = {
    themeMode: 'system',
    accentColor: 'terracotta',
    backgroundStyle: 'minimal',
    customBackgroundUrl: undefined,
    studyDayRolloverHour: 0,
    showExamCountdown: true,
    showFocusRadio: false,
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
  } as AppStateData;
}
