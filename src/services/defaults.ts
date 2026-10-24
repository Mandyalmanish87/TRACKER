import {
  AppStateData,
  UserProfile,
  AppSettings,
  NutritionProfile,
  CustomPlaylist,
} from '../types';

export const DEFAULT_DAILY_QUESTION_TARGET: number = 25;

export const DEFAULT_REVIEW_INTERVALS: number[] = [1, 3, 7, 14, 30];

export const DEFAULT_CUSTOM_PLAYLISTS: CustomPlaylist[] = [
  {
    id: 'playlist-lofi-focus',
    name: '📚 Deep Focus & Lo-Fi Beats',
    description: 'Calm lo-fi hip hop and chill beats for uninterrupted focus.',
    createdAt: '2026-10-18T00:00:00.000Z',
    items: [
      {
        id: 'item-1',
        title: 'Lo-Fi Hip Hop Radio — Beats to Relax/Study',
        url: 'https://www.youtube.com/watch?v=jfKfPfyJRdk',
        videoId: 'jfKfPfyJRdk',
        addedAt: '2026-10-18T00:00:00.000Z',
      },
      {
        id: 'item-2',
        title: 'Coffee Shop Ambience & Soft Beats',
        url: 'https://www.youtube.com/watch?v=h__V03XTAOE',
        videoId: 'h__V03XTAOE',
        addedAt: '2026-10-18T00:00:00.000Z',
      },
      {
        id: 'item-3',
        title: 'Deep Focus — Solo Piano',
        url: 'https://www.youtube.com/watch?v=5qap5aO4i9A',
        videoId: '5qap5aO4i9A',
        addedAt: '2026-10-18T00:00:00.000Z',
      },
    ],
  },
  {
    id: 'playlist-nature-ambient',
    name: '🌧️ Nature Sounds & Calm Waves',
    description: 'Gentle ocean waves and relaxing rain sounds.',
    createdAt: '2026-10-18T00:00:00.000Z',
    items: [
      {
        id: 'item-4',
        title: 'Rain & Thunder Sounds for Sleep & Study',
        url: 'https://www.youtube.com/watch?v=mPZkdNFkNps',
        videoId: 'mPZkdNFkNps',
        addedAt: '2026-10-18T00:00:00.000Z',
      },
      {
        id: 'item-5',
        title: 'Ocean Waves Meditation',
        url: 'https://www.youtube.com/watch?v=bn9F19Hi1Lk',
        videoId: 'bn9F19Hi1Lk',
        addedAt: '2026-10-18T00:00:00.000Z',
      },
    ],
  },
];

export const DEFAULT_NUTRITION_PROFILE: NutritionProfile = {
  goal: 'maintain',
  targetCalories: 2200,
  macroTargets: {
    calories: 2200,
    protein: 140,
    carbs: 260,
    fat: 65,
    isManualOverride: false,
  },
  waterTargetMl: 2500,
  enabledMealTypes: ['breakfast', 'lunch', 'dinner', 'snacks', 'pre_workout', 'post_workout'],
  updatedAt: '2026-10-18T00:00:00.000Z',
};

export const DEFAULT_PROFILE: UserProfile = {
  displayName: '',
  targetExam: '',
};

export const DEFAULT_SETTINGS: AppSettings = {
  themeMode: 'system',
  accentColor: 'terracotta',
  backgroundStyle: 'minimal',
  studyDayRolloverHour: 0,
  showExamCountdown: true,
  showFocusRadio: false,
  dashboardLayoutMode: 'bento',
  dashboardDensity: 'compact',
  userMode: 'individual',
};

export const EMPTY_STATE: AppStateData = {
  hasSampleData: false,
  schemaVersion: 2,
  profile: DEFAULT_PROFILE,
  settings: DEFAULT_SETTINGS,
  subjects: [],
  timetable: [],
  attendanceLogs: [],
  studySessions: [],
  gymWorkouts: [],
  reminders: [],
  syllabusSubjects: [],
  occurrenceOverrides: [],
  extraClasses: [],
  tasks: [],
  spacedReviews: [],
  dailyQuestions: [],
  dailyQuestionTarget: DEFAULT_DAILY_QUESTION_TARGET,
  reviewIntervals: DEFAULT_REVIEW_INTERVALS,
  foodDiaryEntries: [],
  customFoods: [],
  recipes: [],
  weightLogs: [],
  nutritionProfile: DEFAULT_NUTRITION_PROFILE,
  radioUrls: [],
  radioQueue: [],
  radioLoopMode: 'off',
  radioIsShuffle: false,
  customPlaylists: JSON.parse(JSON.stringify(DEFAULT_CUSTOM_PLAYLISTS)),
  mockTests: [],
  errorLogs: [],
  events: [],
};

