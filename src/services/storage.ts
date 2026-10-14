import { AppStateData, ThemeMode, UserProfile, AppSettings, SyllabusSubject } from '../types';
import { migrateV1ToV2 } from './migration';

const STORAGE_KEY_V2 = 'tracker_app_data_v2';
const THEME_KEY = 'tracker_app_theme';

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
};

export const DEFAULT_SYLLABUS_SUBJECTS: SyllabusSubject[] = [
  {
    id: 'syl-phy',
    name: 'Physics',
    color: '#C45532',
    chapters: [
      {
        id: 'chap-phy-1',
        name: 'Classical Mechanics & Oscillations',
        subtopics: [
          { id: 'top-p1', name: 'Newtonian Laws & Friction', status: 'done', revisionCount: 2, pyqCovered: true, deadline: '2026-10-20', priority: 'high' },
          { id: 'top-p2', name: 'Work, Energy & Conservative Forces', status: 'in_progress', revisionCount: 1, pyqCovered: true, deadline: '2026-10-28', priority: 'medium' },
          { id: 'top-p3', name: 'Simple Harmonic Motion & Resonance', status: 'not_started', revisionCount: 0, pyqCovered: false, deadline: '2026-11-05', priority: 'low' },
        ],
      },
      {
        id: 'chap-phy-2',
        name: 'Electrodynamics & Magnetism',
        subtopics: [
          { id: 'top-p4', name: 'Gauss Law & Electrostatic Potential', status: 'done', revisionCount: 1, pyqCovered: true, priority: 'high' },
          { id: 'top-p5', name: 'Ampere Law & Magnetic Induction', status: 'not_started', revisionCount: 0, pyqCovered: false, priority: 'medium' },
        ],
      },
    ],
  },
  {
    id: 'syl-chem',
    name: 'Chemistry',
    color: '#B8732E',
    chapters: [
      {
        id: 'chap-chem-1',
        name: 'Thermodynamics & Equilibrium',
        subtopics: [
          { id: 'top-c1', name: 'First & Second Laws of Thermodynamics', status: 'done', revisionCount: 3, pyqCovered: true, priority: 'high' },
          { id: 'top-c2', name: 'Chemical Equilibrium & Le Chatelier Principle', status: 'in_progress', revisionCount: 1, pyqCovered: false, priority: 'medium' },
        ],
      },
      {
        id: 'chap-chem-2',
        name: 'Organic Reaction Mechanisms',
        subtopics: [
          { id: 'top-c3', name: 'Nucleophilic Substitution (SN1/SN2)', status: 'revision_needed', revisionCount: 2, pyqCovered: true, priority: 'high', notes: 'Revisit stereochemistry inversion' },
          { id: 'top-c4', name: 'Electrophilic Aromatic Substitution', status: 'not_started', revisionCount: 0, pyqCovered: false, priority: 'medium' },
        ],
      },
    ],
  },
  {
    id: 'syl-math',
    name: 'Mathematics',
    color: '#3D6A8A',
    chapters: [
      {
        id: 'chap-math-1',
        name: 'Calculus & Differential Equations',
        subtopics: [
          { id: 'top-m1', name: 'Limits, Continuity & Mean Value Theorems', status: 'done', revisionCount: 2, pyqCovered: true, priority: 'medium' },
          { id: 'top-m2', name: 'Definite Integrals & Area under Curves', status: 'done', revisionCount: 1, pyqCovered: true, priority: 'high' },
          { id: 'top-m3', name: 'First-Order Differential Equations', status: 'in_progress', revisionCount: 0, pyqCovered: false, priority: 'high' },
        ],
      },
      {
        id: 'chap-math-2',
        name: 'Linear Algebra & Vectors',
        subtopics: [
          { id: 'top-m4', name: 'Matrices, Determinants & Eigenvalues', status: 'not_started', revisionCount: 0, pyqCovered: false, priority: 'medium' },
        ],
      },
    ],
  },
  {
    id: 'syl-bio',
    name: 'Biology',
    color: '#436650',
    chapters: [
      {
        id: 'chap-bio-1',
        name: 'Cell Biology & Genetics',
        subtopics: [
          { id: 'top-b1', name: 'Cell Membrane Structure & Transport', status: 'done', revisionCount: 1, pyqCovered: true, priority: 'low' },
          { id: 'top-b2', name: 'Mendelian Genetics & Gene Expression', status: 'in_progress', revisionCount: 0, pyqCovered: false, priority: 'high' },
        ],
      },
    ],
  },
];

export const loadData = (): AppStateData => {
  // Try loading v2 data first
  const v2Serialized = localStorage.getItem(STORAGE_KEY_V2);
  if (v2Serialized) {
    try {
      const parsed = JSON.parse(v2Serialized);
      if (parsed && typeof parsed === 'object') {
        return {
          hasSampleData: Boolean(parsed.hasSampleData),
          subjects: Array.isArray(parsed.subjects) ? parsed.subjects : [],
          timetable: Array.isArray(parsed.timetable) ? parsed.timetable : [],
          attendanceLogs: Array.isArray(parsed.attendanceLogs) ? parsed.attendanceLogs : [],
          studySessions: Array.isArray(parsed.studySessions) ? parsed.studySessions : [],
          gymWorkouts: Array.isArray(parsed.gymWorkouts) ? parsed.gymWorkouts : [],
          reminders: Array.isArray(parsed.reminders) ? parsed.reminders : [],
          schemaVersion: 2,
          profile: {
            displayName: typeof parsed.profile?.displayName === 'string' ? parsed.profile.displayName : '',
            targetExam: typeof parsed.profile?.targetExam === 'string' ? parsed.profile.targetExam : '',
            examDate: parsed.profile?.examDate,
            examYear: parsed.profile?.examYear,
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
          },
          syllabusSubjects: Array.isArray(parsed.syllabusSubjects)
            ? parsed.syllabusSubjects
            : DEFAULT_SYLLABUS_SUBJECTS,
          occurrenceOverrides: Array.isArray(parsed.occurrenceOverrides) ? parsed.occurrenceOverrides : [],
          extraClasses: Array.isArray(parsed.extraClasses) ? parsed.extraClasses : [],
        };
      }
    } catch {
      console.error('Corrupt v2 data, attempting migration from v1');
    }
  }
  // Fallback to v1 data and migrate
  const v1Serialized = localStorage.getItem('tracker_app_data_v1');
  if (v1Serialized) {
    try {
      const raw = JSON.parse(v1Serialized);
      const migrated = migrateV1ToV2(raw);
      // Save migrated data under v2 key
      localStorage.setItem(STORAGE_KEY_V2, JSON.stringify(migrated));
      return migrated;
    } catch {
      console.error('Failed to parse v1 data, using SAMPLE_DATA');
    }
  }
  // No existing data, initialize with sample data and save to v2
  const fresh: AppStateData = {
    ...SAMPLE_DATA,
    profile: { ...DEFAULT_PROFILE, ...(SAMPLE_DATA.profile || {}) },
    settings: { ...DEFAULT_SETTINGS, ...(SAMPLE_DATA.settings || {}) },
    syllabusSubjects: JSON.parse(JSON.stringify(DEFAULT_SYLLABUS_SUBJECTS)),
    occurrenceOverrides: [],
    extraClasses: [],
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
      syllabusSubjects: data.syllabusSubjects ?? DEFAULT_SYLLABUS_SUBJECTS,
      occurrenceOverrides: data.occurrenceOverrides ?? [],
      extraClasses: data.extraClasses ?? [],
    };
    localStorage.setItem(STORAGE_KEY_V2, JSON.stringify(toSave));
  } catch (err) {
    console.error('Failed to persist to localStorage:', err);
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
  },
  syllabusSubjects: DEFAULT_SYLLABUS_SUBJECTS,
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
      timestamp: '2026-10-14T07:30:00Z',
      notes: 'Dynamic programming memoization on knapsack problem',
      isSample: true,
    },
    {
      id: 'study-2',
      subjectId: 'sub-3',
      subjectName: 'Discrete Mathematics',
      durationMinutes: 30,
      timestamp: '2026-10-13T19:00:00Z',
      notes: 'Eulerian paths & Hamiltonian cycles proofs',
      isSample: true,
    },
  ],
  gymWorkouts: [
    {
      id: 'gym-today',
      date: '2026-10-14',
      split: 'Push Day (Chest, Delts & Triceps)',
      completed: false,
      durationMinutes: 60,
      exercises: [
        {
          name: 'Barbell Bench Press',
          sets: [
            { reps: 10, weightKg: 60, completed: true },
            { reps: 8, weightKg: 70, completed: true },
            { reps: 6, weightKg: 75, completed: false },
          ],
        },
        {
          name: 'Incline Dumbbell Press',
          sets: [
            { reps: 10, weightKg: 24, completed: false },
            { reps: 10, weightKg: 24, completed: false },
            { reps: 8, weightKg: 26, completed: false },
          ],
        },
        {
          name: 'Standing Overhead Press',
          sets: [
            { reps: 8, weightKg: 40, completed: false },
            { reps: 8, weightKg: 40, completed: false },
          ],
        },
      ],
      notes: 'Focus on slow eccentric tempo on bench press',
      isSample: true,
    },
  ],
  reminders: [
    {
      id: 'rem-1',
      title: 'Submit Algorithms Lab 4 Writeup',
      category: 'academic',
      dueDate: '2026-10-14',
      priority: 'high',
      isCompleted: false,
      linkedEntity: 'CS301',
      isSample: true,
    },
    {
      id: 'rem-2',
      title: 'Restock Whey Protein & Creatine',
      category: 'fitness',
      dueDate: '2026-10-15',
      priority: 'medium',
      isCompleted: false,
      isSample: true,
    },
    {
      id: 'rem-3',
      title: 'Renew Library Book on Discrete Structures',
      category: 'academic',
      dueDate: '2026-10-16',
      priority: 'low',
      isCompleted: false,
      linkedEntity: 'MA201',
      isSample: true,
    },
  ],
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
};

export interface IStorageService {
  loadData(): AppStateData;
  saveData(data: AppStateData): void;
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
      syllabusSubjects: existing.syllabusSubjects?.length ? existing.syllabusSubjects : DEFAULT_SYLLABUS_SUBJECTS,
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
      syllabusSubjects: current.syllabusSubjects ?? DEFAULT_SYLLABUS_SUBJECTS,
      subjects: current.subjects.filter((s) => !s.isSample),
      timetable: current.timetable.filter((t) => !t.isSample),
      attendanceLogs: current.attendanceLogs.filter((a) => !a.isSample),
      studySessions: current.studySessions.filter((s) => !s.isSample),
      gymWorkouts: current.gymWorkouts.filter((g) => !g.isSample),
      reminders: current.reminders.filter((r) => !r.isSample),
    };
    this.saveData(cleaned);
    return cleaned;
  }

  exportBackup(data: AppStateData): string {
    return JSON.stringify(data, null, 2);
  }

  importBackup(jsonString: string): AppStateData {
    const parsed = JSON.parse(jsonString);
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Invalid backup file format');
    }
    const validated: AppStateData = {
      hasSampleData: Boolean(parsed.hasSampleData),
      subjects: Array.isArray(parsed.subjects) ? parsed.subjects : [],
      timetable: Array.isArray(parsed.timetable) ? parsed.timetable : [],
      attendanceLogs: Array.isArray(parsed.attendanceLogs) ? parsed.attendanceLogs : [],
      studySessions: Array.isArray(parsed.studySessions) ? parsed.studySessions : [],
      gymWorkouts: Array.isArray(parsed.gymWorkouts) ? parsed.gymWorkouts : [],
      reminders: Array.isArray(parsed.reminders) ? parsed.reminders : [],
      schemaVersion: 2,
      profile: parsed.profile ?? DEFAULT_PROFILE,
      settings: {
        ...DEFAULT_SETTINGS,
        ...(parsed.settings && typeof parsed.settings === 'object' ? parsed.settings : {}),
      },
      syllabusSubjects: Array.isArray(parsed.syllabusSubjects)
        ? parsed.syllabusSubjects
        : DEFAULT_SYLLABUS_SUBJECTS,
    };
    this.saveData(validated);
    return validated;
  }
}

export const storageService: IStorageService = new LocalStorageService();
