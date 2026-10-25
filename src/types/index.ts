export type ThemeMode = 'light' | 'dark' | 'system';

export type DayOfWeek = 1 | 2 | 3 | 4 | 5 | 6 | 7; // 1 = Monday, 7 = Sunday

// ----- Existing types -----
export interface Subject {
  id: string;
  code: string;
  name: string;
  attended: number;
  totalConducted: number;
  targetPct: number; // typically 75
  color: string;
  isSample?: boolean;
}

export interface TimetableSlot {
  id: string;
  dayOfWeek: DayOfWeek;
  startTime: string; // "09:00"
  endTime: string;   // "10:15"
  subjectId: string;
  room?: string;
  instructor?: string;
  notes?: string;
  isSample?: boolean;
}

export type AttendanceMark = 'present' | 'absent' | 'cancelled';

export interface AttendanceLog {
  id: string;
  date: string; // YYYY-MM-DD
  slotId: string;
  subjectId: string;
  status: AttendanceMark;
  timestamp: string;
  isSample?: boolean;
  /** If this log is for a rescheduled occurrence, store the override ID */
  overrideId?: string;
  /** If this is for an extra class */
  extraClassId?: string;
  /** Future planned mark (not yet held — should NOT count in actual attendance %) */
  isPlanned?: boolean;
}

export type SessionStatus = 'completed' | 'interrupted' | 'cancelled';

export interface StudySession {
  id: string;
  subjectId?: string;
  subjectName?: string;
  durationMinutes: number; // actual focused duration in minutes (e.g. 0.85 for 51s, 25 for 25m)
  durationSeconds?: number; // actual focused duration in seconds
  plannedDurationMinutes?: number; // target planned duration if timed
  timestamp: string; // ISO string
  startTime?: string; // ISO string
  endTime?: string; // ISO string
  status?: SessionStatus;
  notes?: string;
  isSample?: boolean;
}

export type FocusTimerMode = 'pomodoro' | 'short_break' | 'long_break' | 'custom' | 'timer' | 'stopwatch';

export interface StopwatchLap {
  id: string;
  lapNumber: number;
  lapTimeSeconds: number;
  totalTimeSeconds: number;
}

export interface ActiveTimerState {
  mode: FocusTimerMode;
  plannedSeconds: number;
  accumulatedSeconds: number;
  lastStartedTimestamp: number | null;
  isRunning: boolean;
  subjectId?: string;
  subjectName?: string;
  notes?: string;
  sessionStartedAt?: string;
  pausedAt?: number | null;
  totalPausedSeconds?: number;
  status?: 'idle' | 'running' | 'paused' | 'completed';
  laps?: StopwatchLap[];
}

export interface GymExerciseSet {
  reps: number;
  weightKg: number;
  completed: boolean;
}

export interface GymExercise {
  name: string;
  sets: GymExerciseSet[];
}

export interface GymWorkout {
  id: string;
  date: string; // YYYY-MM-DD
  split: string; // e.g. "Push Day (Chest, Shoulders, Triceps)"
  completed: boolean;
  durationMinutes?: number;
  exercises: GymExercise[];
  notes?: string;
  isSample?: boolean;
}

export interface Reminder {
  id: string;
  title: string;
  category: 'academic' | 'fitness' | 'personal';
  dueDate: string; // YYYY-MM-DD or ISO
  priority: 'high' | 'medium' | 'low';
  isCompleted: boolean;
  linkedEntity?: string;
  isSample?: boolean;
}

// ----- New types for Milestone 2 -----
// ExamTarget is a free-text string — any academic goal the user chooses.
// The empty string represents "not set". No hardcoded exam names.
export type ExamTarget = string;

export interface UserProfile {
  displayName: string;
  targetExam: ExamTarget;
  examDate?: string; // YYYY-MM-DD for specific date
  examYear?: number; // optional year when only year is set
  avatarUrl?: string; // Custom profile picture (base64 data URL or external link)
  email?: string;
  institution?: string; // College / University / School
  department?: string; // Branch / Section / Major
  studentId?: string; // Roll Number / Student ID
  bio?: string; // Short bio or academic motto
}

export type AccentColor = 'terracotta' | 'sage' | 'ochre' | 'dusty-blue' | 'plum' | 'slate';
export type BackgroundStyle = 'minimal' | 'abstract' | 'space' | 'ocean' | 'custom';
export type UserMode = 'individual' | 'class_based';

export interface AppSettings {
  themeMode: ThemeMode;
  accentColor: AccentColor;
  backgroundStyle: BackgroundStyle;
  customBackgroundUrl?: string;
  studyDayRolloverHour: number; // 0-23
  showExamCountdown: boolean;
  showFocusRadio: boolean;
  /** User mode: 'individual' for private self-study, 'class_based' for collaborative class workspace */
  userMode?: UserMode;
  /** Shared attendance requirement percentage (0-100). Default 75 when not set. */
  attendanceRequirement?: number;
  /** Custom arrangement of dashboard widget IDs */
  dashboardWidgetOrder?: string[];
  /** Custom layout style for Active Command Center */
  dashboardLayoutMode?: 'bento' | 'masonry' | 'comfortable';
  /** Density for dashboard command center widgets */
  dashboardDensity?: 'compact' | 'comfortable';
}

// ----- New types for Milestone 3 (Syllabus Tracker) -----
export type TopicStatus = 'not_started' | 'in_progress' | 'done' | 'revision_needed';

export interface Subtopic {
  id: string;
  name: string;
  status: TopicStatus;
  revisionCount: number;
  pyqCovered?: boolean;
  lastRevised?: string; // ISO date string or YYYY-MM-DD
  deadline?: string;     // YYYY-MM-DD
  priority?: 'high' | 'medium' | 'low';
  notes?: string;
  /** Estimated lecture count (from GPT import) */
  estimatedLectures?: number;
  /** Importance level (from GPT import) */
  importance?: 'High' | 'Medium' | 'Low';
}

export interface SyllabusChapter {
  id: string;
  name: string;
  subtopics: Subtopic[];
  /** Estimated lecture count (from GPT import) */
  estimatedLectures?: number;
  /** Importance level (from GPT import) */
  importance?: 'High' | 'Medium' | 'Low';
}

export interface SyllabusSubject {
  id: string;
  name: string;
  color?: string;
  code?: string;
  chapters: SyllabusChapter[];
}

// ----- Timetable Import types (GPT copy/paste integration) -----
export interface TimetableImportClass {
  subject: string;
  day: string; // "Monday", "Tuesday", etc.
  startTime: string; // "09:00" (24-hour format)
  endTime: string;   // "10:15"
  location?: string;
  room?: string;
  instructor?: string;
  notes?: string;
}

export interface TimetableImportPayload {
  format: 'student-tracker-timetable';
  version: number;
  classes: TimetableImportClass[];
}

// ----- Syllabus Import types (GPT copy/paste integration) -----
export interface SyllabusImportTopic {
  name: string;
  estimatedLectures?: number;
  importance?: 'High' | 'Medium' | 'Low';
  subtopics?: string[];
}

export interface SyllabusImportChapter {
  name: string;
  estimatedLectures?: number;
  importance?: 'High' | 'Medium' | 'Low';
  topics: SyllabusImportTopic[];
}

export interface SyllabusImportPayload {
  schemaVersion: number;
  subject: {
    name: string;
    chapters: SyllabusImportChapter[];
  };
}

// ----- Occurrence Override types (Fix recurring rescheduling bug) -----
export type OccurrenceOverrideType = 'reschedule' | 'cancel';

/**
 * Represents a per-occurrence change to a recurring timetable slot.
 * Each override targets a specific (slotId, originalDate) pair.
 */
export interface OccurrenceOverride {
  id: string;
  /** The recurring TimetableSlot this overrides */
  slotId: string;
  /** The original date (YYYY-MM-DD) this occurrence would have fallen on */
  originalDate: string;
  type: OccurrenceOverrideType;
  /** For 'reschedule': the new date (YYYY-MM-DD) */
  newDate?: string;
  /** For 'reschedule': optional new start time */
  newStartTime?: string;
  /** For 'reschedule': optional new end time */
  newEndTime?: string;
  /** For 'reschedule': optional new room */
  newRoom?: string;
  /** For 'reschedule': optional notes */
  newNotes?: string;
}

/**
 * An extra (one-off) class not tied to any recurring slot.
 */
export interface ExtraClass {
  id: string;
  subjectId: string;
  date: string; // YYYY-MM-DD
  startTime: string;
  endTime: string;
  room?: string;
  notes?: string;
}

/**
 * A resolved calendar event — the result of combining recurring slots,
 * occurrence overrides, extra classes, and cancellations.
 */
export interface ResolvedCalendarEvent {
  /** Stable identity: slotId + date for recurring, or extraClass id */
  occurrenceKey: string;
  subjectId: string;
  date: string; // YYYY-MM-DD
  startTime: string;
  endTime: string;
  room?: string;
  instructor?: string;
  notes?: string;
  /** Source info */
  source: 'recurring' | 'rescheduled' | 'extra';
  /** Original slot ID (for recurring/rescheduled) */
  slotId?: string;
  /** Override ID if rescheduled */
  overrideId?: string;
  /** Extra class ID if extra */
  extraClassId?: string;
  /** Whether this occurrence is cancelled */
  isCancelled?: boolean;
  dayOfWeek?: DayOfWeek;
  changeNote?: string;
}

export interface AppStateData {
  // Base data
  subjects: Subject[];
  timetable: TimetableSlot[];
  attendanceLogs: AttendanceLog[];
  studySessions: StudySession[];
  gymWorkouts: GymWorkout[];
  reminders: Reminder[];
  hasSampleData: boolean;
  // New v2 fields
  schemaVersion?: number; // undefined for v1
  profile?: UserProfile;
  settings?: AppSettings;
  // Milestone 3
  syllabusSubjects?: SyllabusSubject[];
  // Occurrence overrides (fix recurring rescheduling)
  occurrenceOverrides?: OccurrenceOverride[];
  // Extra classes (one-off additions)
  extraClasses?: ExtraClass[];
  // Milestone 5: Study Planner, Spaced Repetition & Daily Questions
  tasks?: PlannerTask[];
  spacedReviews?: SpacedReview[];
  dailyQuestions?: DailyQuestionEntry[];
  dailyQuestionTarget?: number;
  reviewIntervals?: number[];
  // Milestone 7: Gym & Nutrition
  foodDiaryEntries?: FoodDiaryEntry[];
  customFoods?: CustomFood[];
  recipes?: Recipe[];
  weightLogs?: WeightLogEntry[];
  nutritionProfile?: NutritionProfile;
  // Milestone 8: Focus Radio & Custom Playlists
  radioUrls?: RadioUrl[];
  radioQueue?: RadioUrl[];
  radioLoopMode?: RadioLoopMode;
  radioIsShuffle?: boolean;
  customPlaylists?: CustomPlaylist[];
  // Milestone 6: Mock-Test Analytics & Error Log
  mockTests?: MockTest[];
  errorLogs?: ErrorLogEntry[];
  // Events & Tasks Calendar Module
  events?: CalendarEvent[];
}

// ----- Events & Tasks Calendar Types -----
export type EventCategory =
  | 'exam'
  | 'deadline'
  | 'task'
  | 'holiday'
  | 'college_event'
  | 'personal_event'
  | 'reminder';

export type EventPriority = 'high' | 'medium' | 'low';

export type ExamType = 'mid_sem' | 'end_sem' | 'practical' | 'viva' | 'quiz' | 'other';

export interface CalendarEvent {
  id: string;
  title: string;
  category: EventCategory;
  date: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
  startTime?: string; // HH:MM (24h)
  endTime?: string;   // HH:MM (24h)
  isAllDay?: boolean;
  description?: string;
  location?: string;
  priority?: EventPriority;
  reminderNoticeMinutes?: number;
  linkUrl?: string;
  isCompleted?: boolean;
  status?: TaskStatus;
  subjectId?: string;
  examType?: ExamType;
  linkedEntity?: string;
  createdAt: string;
  completedAt?: string;
  isSample?: boolean;
  subtasks?: Subtask[];
}

// Subtask definition for checklist items on tasks
export interface Subtask {
  id: string;
  title: string;
  isCompleted: boolean;
  completedAt?: string;
}

// ----- Milestone 5 Types -----
export type TaskStatus = 'todo' | 'in_progress' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high';

export interface PlannerTask {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  subjectId?: string;
  syllabusSubjectId?: string;
  syllabusChapterId?: string;
  syllabusTopicId?: string;
  dueDate?: string; // YYYY-MM-DD
  dueTime?: string; // HH:mm (24h)
  estimatedDuration?: number; // minutes
  notes?: string;
  errorLogId?: string; // Link to ErrorLogEntry if created from error log
  createdAt: string; // ISO string
  completedAt?: string; // ISO string
  isSample?: boolean;
  subtasks?: Subtask[];
}

export interface SpacedReviewHistoryItem {
  reviewedAt: string; // ISO string
  nextDueDate: string; // YYYY-MM-DD
}

export interface SpacedReview {
  id: string;
  syllabusTopicId: string;
  syllabusSubjectId?: string;
  syllabusChapterId?: string;
  topicName?: string;
  dueDate: string; // YYYY-MM-DD local calendar date
  intervalDays: number;
  repetitionLevel: number;
  isCompleted?: boolean;
  completedAt?: string; // ISO string
  history?: SpacedReviewHistoryItem[];
  notes?: string;
  isSample?: boolean;
}

export interface DailyQuestionEntry {
  id: string;
  date: string; // YYYY-MM-DD local calendar date
  subjectId?: string;
  subjectName?: string;
  attempted: number; // integer >= 0
  correct: number;   // integer >= 0, <= attempted
  notes?: string;
  createdAt: string; // ISO string
  isSample?: boolean;
}

// ----- Milestone 7: Gym & Nutrition Types -----
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snacks' | 'pre_workout' | 'post_workout';
export type FoodServingUnit = 'g' | 'ml' | 'piece' | 'cup' | 'tbsp' | 'serving';

export interface FoodItem {
  id: string;
  name: string;
  category: 'Grains & Cereals' | 'Dairy & Eggs' | 'Legumes & Pulses' | 'Poultry & Meat' | 'Vegetables' | 'Fruits' | 'Nuts & Seeds' | 'Fats & Oils' | 'Snacks & Beverages' | 'Supplements' | 'Custom';
  servingSize: number;
  servingUnit: FoodServingUnit;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  sugar?: number;
  sodium?: number;
  saturatedFat?: number;
  potassium?: number;
  isCustom?: boolean;
  notes?: string;
}

export interface CustomFood extends FoodItem {
  isCustom: true;
  createdAt: string; // ISO string
  isSample?: boolean;
}

export interface RecipeIngredient {
  foodId: string;
  foodName: string;
  quantity: number;
  servingUnit: FoodServingUnit;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface Recipe {
  id: string;
  name: string;
  ingredients: RecipeIngredient[];
  totalServings: number;
  caloriesPerServing: number;
  proteinPerServing: number;
  carbsPerServing: number;
  fatPerServing: number;
  notes?: string;
  createdAt: string;
  isSample?: boolean;
}

export interface FoodDiaryEntry {
  id: string;
  date: string; // YYYY-MM-DD local calendar date
  mealType: MealType;
  foodId?: string;
  name: string;
  quantity: number;
  servingUnit: FoodServingUnit;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  sugar?: number;
  sodium?: number;
  lastEditedAt: string; // ISO string
  isSample?: boolean;
}

export interface WeightLogEntry {
  id: string;
  date: string; // YYYY-MM-DD local calendar date (one per day)
  weightKg: number;
  notes?: string;
  isSample?: boolean;
}

export type FitnessGoal = 'bulk' | 'cut' | 'maintain';
export type BiologicalSex = 'male' | 'female' | 'prefer_not_to_say';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'very' | 'extra';

export interface MacroTargets {
  protein: number; // in grams
  carbs: number;   // in grams
  fat: number;     // in grams
  calories: number; // in kcal
  isManualOverride?: boolean;
}

export interface NutritionProfile {
  goal: FitnessGoal;
  age?: number;
  heightCm?: number;
  weightKg?: number;
  sex?: BiologicalSex;
  activityLevel?: ActivityLevel;
  calorieAdjustment?: number; // e.g. +300 for bulk, -300 for cut
  calculatedBmr?: number;
  calculatedTdee?: number;
  targetCalories: number;
  macroTargets: MacroTargets;
  waterTargetMl?: number;
  enabledMealTypes?: MealType[];
  updatedAt: string;
}

// ----- Milestone 8: Focus Radio -----
export type RadioLoopMode = 'off' | 'all' | 'one';

export interface RadioUrl {
  id: string;
  label: string;    // user-given name
  url: string;      // original YouTube URL (display purposes)
  embedUrl: string; // precomputed embed src URL
  addedAt: string;  // ISO string
  type?: 'video' | 'playlist';
}

export interface CustomPlaylistItem {
  id: string;
  title: string;
  url: string;
  videoId: string;
  addedAt: string;
}

export interface CustomPlaylist {
  id: string;
  name: string;
  description?: string;
  items: CustomPlaylistItem[];
  createdAt: string;
  youtubePlaylistUrl?: string; // Optional: direct YouTube playlist URL
  youtubePlaylistId?: string;  // Optional: playlist id (e.g. PL...)
  type?: 'custom' | 'youtube'; // 'youtube' if created directly from YT playlist link
}

// ----- Milestone 6: Mock-Test Analytics & Error Log Types -----
export type ErrorType = 'conceptual' | 'calculation' | 'silly' | 'formula';

export interface ErrorLogEntry {
  id: string;
  title: string;
  subjectId: string;
  syllabusChapterId?: string;
  syllabusTopicId?: string;
  mockTestId?: string;
  errorType: ErrorType;
  description?: string;
  correctApproach?: string;
  reviewedCount: number;
  lastReviewedAt?: string; // ISO string
  resolved?: boolean;
  createdAt: string; // ISO string
  isSample?: boolean;
}

export interface MockTestSubjectScore {
  subjectId: string;
  score: number;
  maxMarks: number;
  questionsAttempted: number;
  questionsCorrect: number;
}

export interface MockTest {
  id: string;
  title: string;
  category: string; // e.g. "Full Length Mock", "Chapter Test", "Semester Exam"
  date: string; // YYYY-MM-DD
  totalScore: number;
  maxMarks: number;
  questionsAttempted: number;
  questionsCorrect: number;
  subjectScores?: MockTestSubjectScore[];
  notes?: string;
  createdAt: string; // ISO string
  isSample?: boolean;
}






