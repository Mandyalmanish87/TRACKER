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

export interface StudySession {
  id: string;
  subjectId?: string;
  subjectName?: string;
  durationMinutes: number;
  timestamp: string; // ISO string
  notes?: string;
  isSample?: boolean;
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
}

export type AccentColor = 'terracotta' | 'sage' | 'ochre' | 'dusty-blue' | 'plum' | 'slate';
export type BackgroundStyle = 'minimal' | 'abstract' | 'space' | 'ocean' | 'custom';

export interface AppSettings {
  themeMode: ThemeMode;
  accentColor: AccentColor;
  backgroundStyle: BackgroundStyle;
  customBackgroundUrl?: string;
  studyDayRolloverHour: number; // 0-23
  showExamCountdown: boolean;
  showFocusRadio: boolean;
  /** Shared attendance requirement percentage (0-100). Default 75 when not set. */
  attendanceRequirement?: number;
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
}
