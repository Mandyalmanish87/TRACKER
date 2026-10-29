import {
  AppStateData,
  ThemeMode,
  SyllabusSubject,
  GymWorkout,
  Reminder,
  PlannerTask,
  MockTest,
  ErrorLogEntry,
  CalendarEvent,
  CustomPlaylist,
  SyncTombstone,
  EduHubCourse,
} from '../types';

import { migrateV1ToV2 } from './migration';
import {
  DEFAULT_PROFILE,
  DEFAULT_SETTINGS,
  DEFAULT_NUTRITION_PROFILE,
  DEFAULT_DAILY_QUESTION_TARGET,
  DEFAULT_REVIEW_INTERVALS,
  DEFAULT_CUSTOM_PLAYLISTS,
  EMPTY_STATE,
} from './defaults';

export {
  DEFAULT_PROFILE,
  DEFAULT_SETTINGS,
  DEFAULT_NUTRITION_PROFILE,
  DEFAULT_DAILY_QUESTION_TARGET,
  DEFAULT_REVIEW_INTERVALS,
  DEFAULT_CUSTOM_PLAYLISTS,
  EMPTY_STATE,
};

export const STORAGE_KEY_V2 = 'tracker_app_data_v2';
export const THEME_KEY = 'tracker_app_theme';

// Pre-filled defaults are clean and empty for new users (no demo records in production)
export const DEFAULT_EVENTS: CalendarEvent[] = [];
export const DEFAULT_SYLLABUS_SUBJECTS: SyllabusSubject[] = [];
export const DEFAULT_MOCK_TESTS: MockTest[] = [];
export const DEFAULT_ERROR_LOGS: ErrorLogEntry[] = [];

// Known pre-filled / seeded demo record IDs to clean up on load (excluding Nutrition)
export const DEMO_SYLLABUS_IDS = new Set(['syl-phy', 'syl-chem', 'syl-math', 'syl-bio']);
export const DEMO_MOCK_TEST_IDS = new Set(['test-mock-1', 'test-mock-2']);
export const DEMO_ERROR_LOG_IDS = new Set(['err-1', 'err-2', 'err-3', 'err-log-1', 'err-log-2']);
export const DEMO_EVENT_IDS = new Set(['evt-exam-1', 'evt-deadline-1', 'evt-holiday-1', 'evt-campus-1', 'evt-rem-1']);
export const DEMO_TASK_IDS = new Set(['task-sample-1', 'task-sample-2', 'task-sample-3']);
export const DEMO_REMINDER_IDS = new Set(['rem-1', 'rem-2', 'rem-3']);

export const sanitizeEntityArray = <T extends { id: string }>(arr: unknown): T[] => {
  if (!Array.isArray(arr)) return [];
  return arr.filter(
    (item): item is T =>
      Boolean(item) &&
      typeof item === 'object' &&
      !Array.isArray(item) &&
      typeof (item as any).id === 'string' &&
      (item as any).id.trim().length > 0
  );
};

export const sanitizeEduHubCourses = (courses: unknown): EduHubCourse[] => {
  if (!Array.isArray(courses)) return [];
  return courses
    .filter(
      (c): c is any =>
        Boolean(c) &&
        typeof c === 'object' &&
        !Array.isArray(c) &&
        typeof c.id === 'string' &&
        c.id.trim().length > 0 &&
        typeof c.title === 'string' &&
        !c.isSample &&
        c.id.trim() !== 'sample-cs50-intro'
    )
    .map((c) => ({
      id: c.id.trim(),
      title: c.title.trim() || 'Untitled Course',
      description: typeof c.description === 'string' ? c.description : '',
      color: typeof c.color === 'string' ? c.color : 'terracotta',
      playlistId: typeof c.playlistId === 'string' ? c.playlistId : undefined,
      playlistUrl: typeof c.playlistUrl === 'string' ? c.playlistUrl : undefined,
      lastSyncedAt: typeof c.lastSyncedAt === 'string' ? c.lastSyncedAt : undefined,
      lectures: Array.isArray(c.lectures)
        ? c.lectures
            .filter(
              (l: any) =>
                Boolean(l) &&
                typeof l === 'object' &&
                !Array.isArray(l) &&
                typeof l.id === 'string' &&
                l.id.trim().length > 0 &&
                typeof l.title === 'string'
            )
            .map((l: any) => ({
              id: l.id.trim(),
              title: l.title.trim() || 'Untitled Lecture',
              youtubeUrl: typeof l.youtubeUrl === 'string' ? l.youtubeUrl : '',
              videoId: typeof l.videoId === 'string' ? l.videoId : '',
              durationSeconds: typeof l.durationSeconds === 'number' && !isNaN(l.durationSeconds) && l.durationSeconds >= 0 ? Math.round(l.durationSeconds) : 0,
              lastPositionSeconds: typeof l.lastPositionSeconds === 'number' && !isNaN(l.lastPositionSeconds) && l.lastPositionSeconds >= 0 ? Math.round(l.lastPositionSeconds) : 0,
              completed: Boolean(l.completed),
              notes: typeof l.notes === 'string' ? l.notes : undefined,
              thumbnailUrl: typeof l.thumbnailUrl === 'string' ? l.thumbnailUrl : undefined,
              addedAt: typeof l.addedAt === 'string' ? l.addedAt : new Date().toISOString(),
              completedAt: typeof l.completedAt === 'string' ? l.completedAt : undefined,
            }))
        : [],
      createdAt: typeof c.createdAt === 'string' ? c.createdAt : new Date().toISOString(),
      updatedAt: typeof c.updatedAt === 'string' ? c.updatedAt : new Date().toISOString(),
      isSample: Boolean(c.isSample),
    }));
};

export const getUserStorageKey = (userId: string): string => `tracker_user_data_${userId}`;

export const saveUserData = (userId: string, data: AppStateData): void => {
  if (!userId || typeof userId !== 'string') return;
  try {
    localStorage.setItem(getUserStorageKey(userId), JSON.stringify(data));
  } catch (err) {
    console.error(`Failed to persist user data for ${userId}:`, err);
  }
};

export const sanitizeLoadedState = (parsed: any): AppStateData => {
  if (!parsed || typeof parsed !== 'object') {
    return {
      ...EMPTY_STATE,
      profile: { ...DEFAULT_PROFILE },
      settings: { ...DEFAULT_SETTINGS },
      customPlaylists: JSON.parse(JSON.stringify(DEFAULT_CUSTOM_PLAYLISTS)),
      hasSampleData: false,
      schemaVersion: 2,
    };
  }
  const playlists = sanitizeEntityArray<CustomPlaylist>(parsed.customPlaylists);
  return {
    hasSampleData: Boolean(parsed.hasSampleData),
    subjects: sanitizeEntityArray(parsed.subjects),
    timetable: sanitizeEntityArray(parsed.timetable),
    attendanceLogs: sanitizeEntityArray(parsed.attendanceLogs),
    studySessions: sanitizeEntityArray(parsed.studySessions).map((s: any) => ({
      ...s,
      status: s?.status ?? 'completed',
    })),
    gymWorkouts: sanitizeEntityArray<GymWorkout>(parsed.gymWorkouts).filter(
      (g) => !g.isSample && g.id !== 'gym-today'
    ),
    reminders: sanitizeEntityArray<Reminder>(parsed.reminders).filter(
      (r) => !r.isSample && !DEMO_REMINDER_IDS.has(r.id)
    ),
    schemaVersion: 2,
    profile: {
      displayName: typeof parsed.profile?.displayName === 'string' ? parsed.profile.displayName : '',
      targetExam: typeof parsed.profile?.targetExam === 'string' ? parsed.profile.targetExam : '',
      examDate: parsed.profile?.examDate,
      examYear: parsed.profile?.examYear,
      avatarUrl: typeof parsed.profile?.avatarUrl === 'string' ? parsed.profile.avatarUrl : undefined,
      email: typeof parsed.profile?.email === 'string' ? parsed.profile.email : undefined,
      institution: typeof parsed.profile?.institution === 'string' ? parsed.profile.institution : undefined,
      department: typeof parsed.profile?.department === 'string' ? parsed.profile.department : undefined,
      studentId: typeof parsed.profile?.studentId === 'string' ? parsed.profile.studentId : undefined,
      bio: typeof parsed.profile?.bio === 'string' ? parsed.profile.bio : undefined,
    },
    settings: {
      themeMode: parsed.settings?.themeMode ?? 'system',
      accentColor: parsed.settings?.accentColor ?? 'terracotta',
      backgroundStyle: parsed.settings?.backgroundStyle ?? 'minimal',
      customBackgroundUrl: parsed.settings?.customBackgroundUrl,
      studyDayRolloverHour: typeof parsed.settings?.studyDayRolloverHour === 'number' ? parsed.settings.studyDayRolloverHour : 0,
      showExamCountdown: typeof parsed.settings?.showExamCountdown === 'boolean' ? parsed.settings.showExamCountdown : true,
      showFocusRadio: typeof parsed.settings?.showFocusRadio === 'boolean' ? parsed.settings.showFocusRadio : false,
      attendanceRequirement: typeof parsed.settings?.attendanceRequirement === 'number' ? parsed.settings.attendanceRequirement : undefined,
      dashboardWidgetOrder: Array.isArray(parsed.settings?.dashboardWidgetOrder) ? parsed.settings.dashboardWidgetOrder : undefined,
      dashboardLayoutMode: parsed.settings?.dashboardLayoutMode || 'bento',
      dashboardDensity: parsed.settings?.dashboardDensity || 'compact',
      userMode: parsed.settings?.userMode === 'class_based' ? 'class_based' : 'individual',
    },
    syllabusSubjects: sanitizeEntityArray<SyllabusSubject>(parsed.syllabusSubjects).filter(
      (s) => !s.isSample && !DEMO_SYLLABUS_IDS.has(s.id)
    ),
    occurrenceOverrides: sanitizeEntityArray(parsed.occurrenceOverrides),
    extraClasses: sanitizeEntityArray(parsed.extraClasses),
    tasks: sanitizeEntityArray<PlannerTask>(parsed.tasks).filter(
      (t) => !t.isSample && !DEMO_TASK_IDS.has(t.id)
    ),
    spacedReviews: sanitizeEntityArray(parsed.spacedReviews),
    dailyQuestions: sanitizeEntityArray(parsed.dailyQuestions),
    dailyQuestionTarget: typeof parsed.dailyQuestionTarget === 'number' ? parsed.dailyQuestionTarget : DEFAULT_DAILY_QUESTION_TARGET,
    reviewIntervals: Array.isArray(parsed.reviewIntervals) ? parsed.reviewIntervals : DEFAULT_REVIEW_INTERVALS,
    // Nutrition section: PRESERVE demo data, seed logic, food database, recipes, and defaults intact
    foodDiaryEntries: sanitizeEntityArray(parsed.foodDiaryEntries),
    customFoods: sanitizeEntityArray(parsed.customFoods),
    recipes: sanitizeEntityArray(parsed.recipes),
    weightLogs: sanitizeEntityArray(parsed.weightLogs),
    nutritionProfile: parsed.nutritionProfile ?? DEFAULT_NUTRITION_PROFILE,
    radioUrls: sanitizeEntityArray(parsed.radioUrls),
    radioQueue: sanitizeEntityArray(parsed.radioQueue),
    radioLoopMode: parsed.radioLoopMode === 'all' || parsed.radioLoopMode === 'one' ? parsed.radioLoopMode : 'off',
    radioIsShuffle: Boolean(parsed.radioIsShuffle),
    customPlaylists: playlists.length > 0 ? playlists : JSON.parse(JSON.stringify(DEFAULT_CUSTOM_PLAYLISTS)),
    mockTests: sanitizeEntityArray<MockTest>(parsed.mockTests).filter(
      (m) => !m.isSample && !DEMO_MOCK_TEST_IDS.has(m.id)
    ),
    errorLogs: sanitizeEntityArray<ErrorLogEntry>(parsed.errorLogs).filter(
      (e) => !e.isSample && !DEMO_ERROR_LOG_IDS.has(e.id)
    ),
    events: sanitizeEntityArray<CalendarEvent>(parsed.events).filter(
      (e) => !e.isSample && !DEMO_EVENT_IDS.has(e.id)
    ),
    eduhubCourses: sanitizeEduHubCourses(parsed.eduhubCourses),
    tombstones: sanitizeEntityArray<SyncTombstone>(parsed.tombstones),
  };
};

export const loadUserData = (userId: string): AppStateData | null => {
  if (!userId || typeof userId !== 'string') return null;
  try {
    const serialized = localStorage.getItem(getUserStorageKey(userId));
    if (!serialized) return null;
    const parsed = JSON.parse(serialized);
    return sanitizeLoadedState(parsed);
  } catch (err) {
    console.error(`Failed to load user data for ${userId}:`, err);
    return null;
  }
};

export const clearUserData = (userId: string): void => {
  if (!userId || typeof userId !== 'string') return;
  try {
    localStorage.removeItem(getUserStorageKey(userId));
  } catch {}
};

export const GUEST_BACKUP_KEY = 'tracker_guest_data_backup';

export const saveGuestBackup = (data: AppStateData): void => {
  try {
    localStorage.setItem(GUEST_BACKUP_KEY, JSON.stringify(data));
  } catch (err) {
    console.error('Failed to save guest backup:', err);
  }
};

export const loadGuestBackup = (): AppStateData | null => {
  try {
    const raw = localStorage.getItem(GUEST_BACKUP_KEY);
    if (!raw) return null;
    return sanitizeLoadedState(JSON.parse(raw));
  } catch {
    return null;
  }
};

export const loadData = (): AppStateData => {
  // Helper to fallback to legacy EduHub courses if v2 does not have them yet
  const getLegacyEduHubCourses = (): EduHubCourse[] => {
    try {
      const raw = localStorage.getItem('tracker_eduhub_courses_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return sanitizeEduHubCourses(parsed);
        }
      }
    } catch {}
    return [];
  };

  // Try loading v2 data first
  const v2Serialized = localStorage.getItem(STORAGE_KEY_V2);
  if (v2Serialized) {
    try {
      const parsed = JSON.parse(v2Serialized);
      if (parsed && typeof parsed === 'object') {
        const state = sanitizeLoadedState(parsed);
        // Backwards compatibility: if v2 has no courses or only sample courses, migrate from legacy store
        if (!state.eduhubCourses || state.eduhubCourses.length === 0 || state.eduhubCourses.every((c) => c.isSample)) {
          const legacy = getLegacyEduHubCourses();
          if (legacy.length > 0 && legacy.some((c) => !c.isSample)) {
            state.eduhubCourses = legacy;
          }
        }
        return state;
      }
    } catch (err) {
      console.error('Corrupt v2 data, attempting migration from v1');
      try {
        localStorage.setItem('tracker_app_data_v2_corrupt_backup', v2Serialized);
      } catch {}
    }
  }
  // Fallback to v1 data and migrate
  const v1Serialized = localStorage.getItem('tracker_app_data_v1');
  if (v1Serialized) {
    try {
      const raw = JSON.parse(v1Serialized);
      const migrated = migrateV1ToV2(raw);
      const legacy = getLegacyEduHubCourses();
      if (legacy.length > 0) {
        migrated.eduhubCourses = legacy;
      }
      // Save migrated data under v2 key
      localStorage.setItem(STORAGE_KEY_V2, JSON.stringify(migrated));
      return migrated;
    } catch {
      console.error('Failed to parse v1 data, initializing empty state');
    }
  }
  // Fresh installation: initialize with a valid, clean, empty default state without demo data
  const legacy = getLegacyEduHubCourses();
  const fresh: AppStateData = {
    ...EMPTY_STATE,
    profile: { ...DEFAULT_PROFILE },
    settings: { ...DEFAULT_SETTINGS },
    customPlaylists: JSON.parse(JSON.stringify(DEFAULT_CUSTOM_PLAYLISTS)),
    eduhubCourses: legacy.length > 0 ? legacy : [],
    hasSampleData: false,
    schemaVersion: 2,
  };
  localStorage.setItem(STORAGE_KEY_V2, JSON.stringify(fresh));
  return fresh;
};

export const saveData = (data: AppStateData): void => {
  try {
    const toSave: AppStateData = {
      ...data,
      schemaVersion: 2,
      profile: data.profile ?? DEFAULT_PROFILE,
      settings: data.settings ?? DEFAULT_SETTINGS,
      syllabusSubjects: Array.isArray(data.syllabusSubjects) ? data.syllabusSubjects : [],
      occurrenceOverrides: Array.isArray(data.occurrenceOverrides) ? data.occurrenceOverrides : [],
      extraClasses: Array.isArray(data.extraClasses) ? data.extraClasses : [],
      tasks: Array.isArray(data.tasks) ? data.tasks : [],
      spacedReviews: Array.isArray(data.spacedReviews) ? data.spacedReviews : [],
      dailyQuestions: Array.isArray(data.dailyQuestions) ? data.dailyQuestions : [],
      dailyQuestionTarget: typeof data.dailyQuestionTarget === 'number' ? data.dailyQuestionTarget : DEFAULT_DAILY_QUESTION_TARGET,
      reviewIntervals: Array.isArray(data.reviewIntervals) ? data.reviewIntervals : DEFAULT_REVIEW_INTERVALS,
      foodDiaryEntries: Array.isArray(data.foodDiaryEntries) ? data.foodDiaryEntries : [],
      customFoods: Array.isArray(data.customFoods) ? data.customFoods : [],
      recipes: Array.isArray(data.recipes) ? data.recipes : [],
      weightLogs: Array.isArray(data.weightLogs) ? data.weightLogs : [],
      nutritionProfile: data.nutritionProfile ?? DEFAULT_NUTRITION_PROFILE,
      radioUrls: Array.isArray(data.radioUrls) ? data.radioUrls : [],
      radioQueue: Array.isArray(data.radioQueue) ? data.radioQueue : [],
      radioLoopMode: data.radioLoopMode === 'all' || data.radioLoopMode === 'one' ? data.radioLoopMode : 'off',
      radioIsShuffle: Boolean(data.radioIsShuffle),
      customPlaylists: Array.isArray(data.customPlaylists) ? data.customPlaylists : JSON.parse(JSON.stringify(DEFAULT_CUSTOM_PLAYLISTS)),
      mockTests: Array.isArray(data.mockTests) ? data.mockTests : [],
      errorLogs: Array.isArray(data.errorLogs) ? data.errorLogs : [],
      events: Array.isArray(data.events) ? data.events : [],
      eduhubCourses: sanitizeEduHubCourses(data.eduhubCourses),
      tombstones: Array.isArray(data.tombstones) ? data.tombstones : [],
    };
    localStorage.setItem(STORAGE_KEY_V2, JSON.stringify(toSave));
    // Synchronize legacy key for backwards compatibility
    if (Array.isArray(toSave.eduhubCourses) && toSave.eduhubCourses.length > 0) {
      try {
        localStorage.setItem('tracker_eduhub_courses_v1', JSON.stringify(toSave.eduhubCourses));
      } catch {}
    }
  } catch (err) {
    console.error('Failed to persist to localStorage:', err);
  }
};

export const getTodayDateStr = (): string => {
  try {
    return new Date().toISOString().split('T')[0];
  } catch {
    return '2026-10-18';
  }
};

export const SAMPLE_DATA: AppStateData = {
  hasSampleData: true,
  schemaVersion: 2,
  profile: {
    displayName: 'Scholar',
    targetExam: 'End-Semester Examinations',
    examDate: '2026-11-20',
  },
  settings: {
    themeMode: 'system',
    accentColor: 'terracotta',
    backgroundStyle: 'minimal',
    studyDayRolloverHour: 0,
    showExamCountdown: true,
    showFocusRadio: false,
    userMode: 'individual',
  },
  syllabusSubjects: [],
  subjects: [
    {
      id: 'sub-1',
      code: 'CS301',
      name: 'Design & Analysis of Algorithms',
      attended: 22,
      totalConducted: 25,
      targetPct: 75,
      color: '#C45532', // Terracotta
      isSample: true,
    },
    {
      id: 'sub-2',
      code: 'CS304',
      name: 'Database Management Systems',
      attended: 19,
      totalConducted: 26,
      targetPct: 75,
      color: '#436650', // Forest Sage
      isSample: true,
    },
    {
      id: 'sub-3',
      code: 'MA201',
      name: 'Discrete Mathematics & Graph Theory',
      attended: 14,
      totalConducted: 20,
      targetPct: 75,
      color: '#B8732E', // Ochre
      isSample: true,
    },
    {
      id: 'sub-4',
      code: 'EC205',
      name: 'Microprocessors & Embedded Systems',
      attended: 15,
      totalConducted: 24,
      targetPct: 75,
      color: '#705746', // Warm Walnut
      isSample: true,
    },
  ],
  timetable: [
    {
      id: 'tt-1',
      dayOfWeek: 3, // Wednesday (active today for realistic demo)
      startTime: '09:00',
      endTime: '10:15',
      subjectId: 'sub-1',
      room: 'Lecture Hall 204',
      instructor: 'Prof. S. Sharma',
      isSample: true,
    },
    {
      id: 'tt-2',
      dayOfWeek: 3,
      startTime: '10:30',
      endTime: '11:45',
      subjectId: 'sub-2',
      room: 'Computing Lab 3',
      instructor: 'Dr. R. Verma',
      isSample: true,
    },
    {
      id: 'tt-3',
      dayOfWeek: 3,
      startTime: '14:00',
      endTime: '15:15',
      subjectId: 'sub-3',
      room: 'Seminar Room B',
      instructor: 'Prof. K. Iyer',
      isSample: true,
    },
    {
      id: 'tt-4',
      dayOfWeek: 3,
      startTime: '15:30',
      endTime: '16:45',
      subjectId: 'sub-4',
      room: 'Embedded Systems Lab',
      instructor: 'Dr. A. Gupta',
      isSample: true,
    },
  ],
  attendanceLogs: [
    {
      id: 'att-1',
      date: '2026-10-14',
      slotId: 'tt-1',
      subjectId: 'sub-1',
      status: 'present',
      timestamp: '2026-10-14T09:12:00Z',
      isSample: true,
    },
  ],
  studySessions: [
    {
      id: 'study-1',
      subjectId: 'sub-1',
      subjectName: 'Design & Analysis of Algorithms',
      durationMinutes: 45,
      plannedDurationMinutes: 45,
      timestamp: '2026-10-14T07:30:00Z',
      status: 'completed',
      notes: 'Dynamic programming memoization on knapsack problem',
      isSample: true,
    },
    {
      id: 'study-2',
      subjectId: 'sub-3',
      subjectName: 'Discrete Mathematics',
      durationMinutes: 30,
      plannedDurationMinutes: 30,
      timestamp: '2026-10-13T19:00:00Z',
      status: 'completed',
      notes: 'Eulerian paths & Hamiltonian cycles proofs',
      isSample: true,
    },
  ],
  gymWorkouts: [],
  reminders: [],
  tasks: [],
  spacedReviews: [],
  dailyQuestions: [],
  dailyQuestionTarget: DEFAULT_DAILY_QUESTION_TARGET,
  reviewIntervals: DEFAULT_REVIEW_INTERVALS,
  foodDiaryEntries: [
    {
      id: 'entry-sample-1',
      date: getTodayDateStr(),
      mealType: 'breakfast',
      foodId: 'food-rolled-oats',
      name: 'Rolled Oats (Dry)',
      quantity: 50,
      servingUnit: 'g',
      calories: 190,
      protein: 6.6,
      carbs: 34.0,
      fat: 3.3,
      fiber: 5.1,
      lastEditedAt: '2026-10-18T08:00:00.000Z',
      isSample: true,
    },
    {
      id: 'entry-sample-2',
      date: getTodayDateStr(),
      mealType: 'breakfast',
      foodId: 'food-milk-cow-toned',
      name: 'Toned Cow Milk (3% Fat)',
      quantity: 250,
      servingUnit: 'ml',
      calories: 150,
      protein: 8.2,
      carbs: 12.0,
      fat: 7.5,
      lastEditedAt: '2026-10-18T08:02:00.000Z',
      isSample: true,
    },
    {
      id: 'entry-sample-3',
      date: getTodayDateStr(),
      mealType: 'breakfast',
      foodId: 'food-banana',
      name: 'Medium Banana',
      quantity: 1,
      servingUnit: 'piece',
      calories: 105,
      protein: 1.3,
      carbs: 27.0,
      fat: 0.3,
      fiber: 3.1,
      lastEditedAt: '2026-10-18T08:05:00.000Z',
      isSample: true,
    },
    {
      id: 'entry-sample-4',
      date: getTodayDateStr(),
      mealType: 'lunch',
      foodId: 'food-roti-wheat',
      name: 'Whole Wheat Roti / Chapati',
      quantity: 2,
      servingUnit: 'piece',
      calories: 208,
      protein: 6.4,
      carbs: 40.8,
      fat: 1.6,
      fiber: 6.2,
      lastEditedAt: '2026-10-18T13:30:00.000Z',
      isSample: true,
    },
    {
      id: 'entry-sample-5',
      date: getTodayDateStr(),
      mealType: 'lunch',
      foodId: 'food-dal-toor',
      name: 'Toor Dal Tadka (Cooked)',
      quantity: 150,
      servingUnit: 'g',
      calories: 165,
      protein: 8.8,
      carbs: 24.1,
      fat: 3.6,
      fiber: 6.1,
      lastEditedAt: '2026-10-18T13:32:00.000Z',
      isSample: true,
    },
    {
      id: 'entry-sample-6',
      date: getTodayDateStr(),
      mealType: 'lunch',
      foodId: 'food-paneer-raw',
      name: 'Fresh Dairy Paneer (Raw)',
      quantity: 50,
      servingUnit: 'g',
      calories: 133,
      protein: 9.2,
      carbs: 1.7,
      fat: 10.4,
      lastEditedAt: '2026-10-18T13:35:00.000Z',
      isSample: true,
    },
    {
      id: 'entry-sample-7',
      date: getTodayDateStr(),
      mealType: 'dinner',
      foodId: 'food-chicken-breast-cooked',
      name: 'Chicken Breast (Grilled/Cooked)',
      quantity: 150,
      servingUnit: 'g',
      calories: 248,
      protein: 46.5,
      carbs: 0,
      fat: 5.4,
      lastEditedAt: '2026-10-18T20:00:00.000Z',
      isSample: true,
    },
    {
      id: 'entry-sample-8',
      date: getTodayDateStr(),
      mealType: 'dinner',
      foodId: 'food-rice-basmati-cooked',
      name: 'White Basmati Rice (Cooked)',
      quantity: 150,
      servingUnit: 'g',
      calories: 195,
      protein: 4.1,
      carbs: 42.8,
      fat: 0.6,
      lastEditedAt: '2026-10-18T20:02:00.000Z',
      isSample: true,
    },
  ],
  customFoods: [
    {
      id: 'custom-whey-shake',
      name: 'Signature Protein Power Shake',
      category: 'Custom',
      servingSize: 1,
      servingUnit: 'serving',
      calories: 340,
      protein: 36,
      carbs: 32,
      fat: 8,
      isCustom: true,
      createdAt: '2026-10-18T00:00:00.000Z',
      isSample: true,
    },
  ],
  recipes: [],
  weightLogs: [
    { id: 'wt-1', date: '2026-10-01', weightKg: 73.2, isSample: true },
    { id: 'wt-2', date: '2026-10-05', weightKg: 73.5, isSample: true },
    { id: 'wt-3', date: '2026-10-10', weightKg: 73.6, isSample: true },
    { id: 'wt-4', date: '2026-10-15', weightKg: 73.8, isSample: true },
    { id: 'wt-5', date: '2026-10-18', weightKg: 74.0, isSample: true },
  ],
  nutritionProfile: DEFAULT_NUTRITION_PROFILE,
  mockTests: [],
  errorLogs: [],
  events: [],
};

export interface IStorageService {
  loadData(): AppStateData;
  saveData(data: AppStateData): void;
  loadUserData(userId: string): AppStateData | null;
  saveUserData(userId: string, data: AppStateData): void;
  clearUserData(userId: string): void;
  loadGuestBackup(): AppStateData | null;
  saveGuestBackup(data: AppStateData): void;
  loadTheme(): ThemeMode;
  saveTheme(mode: ThemeMode): void;
  populateSampleData(): AppStateData;
  clearSampleData(current: AppStateData): AppStateData;
  exportBackup(data: AppStateData): string;
  importBackup(jsonString: string): AppStateData;
}

class LocalStorageService implements IStorageService {
  loadData(): AppStateData {
    return loadData();
  }

  saveData(data: AppStateData): void {
    saveData(data);
  }

  loadUserData(userId: string): AppStateData | null {
    return loadUserData(userId);
  }

  saveUserData(userId: string, data: AppStateData): void {
    saveUserData(userId, data);
  }

  clearUserData(userId: string): void {
    clearUserData(userId);
  }

  loadGuestBackup(): AppStateData | null {
    return loadGuestBackup();
  }

  saveGuestBackup(data: AppStateData): void {
    saveGuestBackup(data);
  }

  loadTheme(): ThemeMode {
    try {
      const mode = localStorage.getItem(THEME_KEY);
      if (mode === 'light' || mode === 'dark' || mode === 'system') {
        return mode;
      }
      return 'system';
    } catch {
      return 'system';
    }
  }

  saveTheme(mode: ThemeMode): void {
    try {
      localStorage.setItem(THEME_KEY, mode);
    } catch (err) {
      console.error('Failed to persist theme:', err);
    }
  }

  populateSampleData(): AppStateData {
    const existing = this.loadData();
    const fresh: AppStateData = {
      ...SAMPLE_DATA,
      profile: existing.profile?.displayName ? existing.profile : SAMPLE_DATA.profile,
      settings: existing.settings ?? SAMPLE_DATA.settings,
      syllabusSubjects: existing.syllabusSubjects?.length ? existing.syllabusSubjects : [],
      tasks: existing.tasks?.length ? existing.tasks : [],
      spacedReviews: existing.spacedReviews?.length ? existing.spacedReviews : [],
      dailyQuestions: existing.dailyQuestions?.length ? existing.dailyQuestions : [],
      dailyQuestionTarget: existing.dailyQuestionTarget ?? SAMPLE_DATA.dailyQuestionTarget ?? DEFAULT_DAILY_QUESTION_TARGET,
      reviewIntervals: existing.reviewIntervals ?? SAMPLE_DATA.reviewIntervals ?? DEFAULT_REVIEW_INTERVALS,
      // Nutrition section: strictly preserved
      foodDiaryEntries: existing.foodDiaryEntries?.length ? existing.foodDiaryEntries : (SAMPLE_DATA.foodDiaryEntries ?? []),
      customFoods: existing.customFoods?.length ? existing.customFoods : (SAMPLE_DATA.customFoods ?? []),
      recipes: existing.recipes?.length ? existing.recipes : (SAMPLE_DATA.recipes ?? []),
      weightLogs: existing.weightLogs?.length ? existing.weightLogs : (SAMPLE_DATA.weightLogs ?? []),
      nutritionProfile: existing.nutritionProfile ?? SAMPLE_DATA.nutritionProfile ?? DEFAULT_NUTRITION_PROFILE,
      mockTests: existing.mockTests?.length ? existing.mockTests : [],
      errorLogs: existing.errorLogs?.length ? existing.errorLogs : [],
      events: existing.events?.length ? existing.events : [],
    };
    this.saveData(fresh);
    return fresh;
  }

  clearSampleData(current: AppStateData): AppStateData {
    const cleaned: AppStateData = {
      hasSampleData: false,
      schemaVersion: 2,
      profile: current.profile ?? DEFAULT_PROFILE,
      settings: current.settings ?? DEFAULT_SETTINGS,
      syllabusSubjects: (current.syllabusSubjects || []).filter(
        (s) => !s.isSample && !DEMO_SYLLABUS_IDS.has(s.id)
      ),
      subjects: current.subjects.filter((s) => !s.isSample),
      timetable: current.timetable.filter((t) => !t.isSample),
      attendanceLogs: current.attendanceLogs.filter((a) => !a.isSample),
      studySessions: current.studySessions.filter((s) => !s.isSample),
      gymWorkouts: current.gymWorkouts.filter((g) => !g.isSample && g.id !== 'gym-today'),
      reminders: current.reminders.filter((r) => !r.isSample && !DEMO_REMINDER_IDS.has(r.id)),
      occurrenceOverrides: current.occurrenceOverrides ?? [],
      extraClasses: current.extraClasses ?? [],
      tasks: (current.tasks || []).filter((t) => !t.isSample && !DEMO_TASK_IDS.has(t.id)),
      spacedReviews: (current.spacedReviews || []).filter((r) => !r.isSample),
      dailyQuestions: (current.dailyQuestions || []).filter((q) => !q.isSample),
      dailyQuestionTarget: current.dailyQuestionTarget ?? DEFAULT_DAILY_QUESTION_TARGET,
      reviewIntervals: current.reviewIntervals ?? DEFAULT_REVIEW_INTERVALS,
      // NUTRITION SECTION: STRICTLY PRESERVED AS REQUIRED BY USER
      foodDiaryEntries: current.foodDiaryEntries || [],
      customFoods: current.customFoods || [],
      recipes: current.recipes || [],
      weightLogs: current.weightLogs || [],
      nutritionProfile: current.nutritionProfile ?? DEFAULT_NUTRITION_PROFILE,
      radioUrls: current.radioUrls ?? [],
      radioQueue: current.radioQueue ?? [],
      radioLoopMode: current.radioLoopMode ?? 'off',
      radioIsShuffle: Boolean(current.radioIsShuffle),
      customPlaylists: current.customPlaylists ?? JSON.parse(JSON.stringify(DEFAULT_CUSTOM_PLAYLISTS)),
      mockTests: (current.mockTests || []).filter((m) => !m.isSample && !DEMO_MOCK_TEST_IDS.has(m.id)),
      errorLogs: (current.errorLogs || []).filter((e) => !e.isSample && !DEMO_ERROR_LOG_IDS.has(e.id)),
      events: (current.events || []).filter((e) => !e.isSample && !DEMO_EVENT_IDS.has(e.id)),
      eduhubCourses: (current.eduhubCourses || []).filter((c) => !c.isSample && c.id !== 'sample-cs50-intro'),
    };
    this.saveData(cleaned);
    return cleaned;
  }

  exportBackup(data: AppStateData): string {
    return JSON.stringify(data, null, 2);
  }

  importBackup(jsonString: string): AppStateData {
    let parsed: any;
    try {
      parsed = JSON.parse(jsonString);
    } catch {
      throw new Error('Invalid backup file format: not valid JSON');
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Invalid backup file format');
    }
    const hasKnownKey = [
      'subjects',
      'timetable',
      'attendanceLogs',
      'studySessions',
      'gymWorkouts',
      'reminders',
      'syllabusSubjects',
      'occurrenceOverrides',
      'extraClasses',
      'tasks',
      'spacedReviews',
      'dailyQuestions',
      'foodDiaryEntries',
      'customFoods',
      'recipes',
      'weightLogs',
      'nutritionProfile',
      'radioUrls',
      'radioQueue',
      'customPlaylists',
      'mockTests',
      'errorLogs',
      'events',
      'profile',
      'settings',
      'schemaVersion',
    ].some((k) => k in parsed);

    if (!hasKnownKey) {
      throw new Error('Invalid backup file format: unrecognized Tracker backup structure');
    }

    const existing = this.loadData();

    const readCollection = <T extends { id: string }>(key: string, existingList: T[] = []): T[] => {
      if (key in parsed) {
        return sanitizeEntityArray<T>(parsed[key]);
      }
      return existingList;
    };

    const validated: AppStateData = {
      schemaVersion: 2,
      hasSampleData: 'hasSampleData' in parsed ? Boolean(parsed.hasSampleData) : existing.hasSampleData,
      profile: 'profile' in parsed && parsed.profile && typeof parsed.profile === 'object'
        ? { ...DEFAULT_PROFILE, ...existing.profile, ...parsed.profile }
        : (existing.profile ?? DEFAULT_PROFILE),
      settings: 'settings' in parsed && parsed.settings && typeof parsed.settings === 'object'
        ? { ...DEFAULT_SETTINGS, ...existing.settings, ...parsed.settings }
        : (existing.settings ?? DEFAULT_SETTINGS),
      subjects: readCollection('subjects', existing.subjects),
      timetable: readCollection('timetable', existing.timetable),
      attendanceLogs: readCollection('attendanceLogs', existing.attendanceLogs),
      studySessions: readCollection('studySessions', existing.studySessions),
      gymWorkouts: readCollection('gymWorkouts', existing.gymWorkouts),
      reminders: readCollection('reminders', existing.reminders),
      syllabusSubjects: readCollection('syllabusSubjects', existing.syllabusSubjects),
      occurrenceOverrides: readCollection('occurrenceOverrides', existing.occurrenceOverrides),
      extraClasses: readCollection('extraClasses', existing.extraClasses),
      tasks: readCollection('tasks', existing.tasks),
      spacedReviews: readCollection('spacedReviews', existing.spacedReviews),
      dailyQuestions: readCollection('dailyQuestions', existing.dailyQuestions),
      dailyQuestionTarget: typeof parsed.dailyQuestionTarget === 'number'
        ? parsed.dailyQuestionTarget
        : (existing.dailyQuestionTarget ?? DEFAULT_DAILY_QUESTION_TARGET),
      reviewIntervals: Array.isArray(parsed.reviewIntervals)
        ? parsed.reviewIntervals
        : (existing.reviewIntervals ?? DEFAULT_REVIEW_INTERVALS),
      foodDiaryEntries: readCollection('foodDiaryEntries', existing.foodDiaryEntries),
      customFoods: readCollection('customFoods', existing.customFoods),
      recipes: readCollection('recipes', existing.recipes),
      weightLogs: readCollection('weightLogs', existing.weightLogs),
      nutritionProfile: 'nutritionProfile' in parsed && parsed.nutritionProfile
        ? parsed.nutritionProfile
        : (existing.nutritionProfile ?? DEFAULT_NUTRITION_PROFILE),
      radioUrls: readCollection('radioUrls', existing.radioUrls),
      radioQueue: readCollection('radioQueue', existing.radioQueue),
      radioLoopMode: parsed.radioLoopMode === 'all' || parsed.radioLoopMode === 'one' || parsed.radioLoopMode === 'off'
        ? parsed.radioLoopMode
        : (existing.radioLoopMode ?? 'off'),
      radioIsShuffle: typeof parsed.radioIsShuffle === 'boolean'
        ? parsed.radioIsShuffle
        : Boolean(existing.radioIsShuffle),
      customPlaylists: readCollection('customPlaylists', existing.customPlaylists ?? JSON.parse(JSON.stringify(DEFAULT_CUSTOM_PLAYLISTS))),
      mockTests: readCollection('mockTests', existing.mockTests),
      errorLogs: readCollection('errorLogs', existing.errorLogs),
      events: readCollection('events', existing.events),
    };

    this.saveData(validated);
    return validated;
  }
}

export const storageService: IStorageService = new LocalStorageService();
