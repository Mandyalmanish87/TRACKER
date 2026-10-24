import {
  AppStateData,
  ThemeMode,
  SyllabusSubject,
  MockTest,
  ErrorLogEntry,
  CalendarEvent,
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

export const DEFAULT_EVENTS: CalendarEvent[] = [
  {
    id: 'evt-exam-1',
    title: 'Mid-Semester Exam: Algorithms & Data Structures',
    category: 'exam',
    date: '2026-10-26',
    startTime: '10:00',
    endTime: '12:00',
    location: 'Main Examination Hall A',
    priority: 'high',
    examType: 'mid_sem',
    description: 'Covers graph algorithms, dynamic programming, and greedy methods.',
    isSample: true,
    createdAt: '2026-10-18T00:00:00.000Z',
  },
  {
    id: 'evt-deadline-1',
    title: 'Operating Systems Milestone 2 Submission',
    category: 'deadline',
    date: '2026-10-28',
    isAllDay: true,
    priority: 'high',
    description: 'Submit memory management kernel code and architecture report.',
    isSample: true,
    createdAt: '2026-10-18T00:00:00.000Z',
  },
  {
    id: 'evt-holiday-1',
    title: 'Autumn Break / College Holiday',
    category: 'holiday',
    date: '2026-11-01',
    isAllDay: true,
    description: 'Campus closed for autumn semester break.',
    isSample: true,
    createdAt: '2026-10-18T00:00:00.000Z',
  },
  {
    id: 'evt-campus-1',
    title: 'Annual Hackathon & Tech Fest 2026',
    category: 'college_event',
    date: '2026-10-24',
    startTime: '14:00',
    endTime: '18:00',
    location: 'Campus Auditorium',
    description: 'Keynotes, networking sessions, and project pitch rounds.',
    isSample: true,
    createdAt: '2026-10-18T00:00:00.000Z',
  },
  {
    id: 'evt-rem-1',
    title: 'Submit Algorithms Lab 4 Writeup',
    category: 'reminder',
    date: '2026-10-22',
    isAllDay: true,
    priority: 'high',
    isCompleted: false,
    status: 'todo',
    isSample: true,
    createdAt: '2026-10-18T00:00:00.000Z',
  },
];

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

export const DEFAULT_MOCK_TESTS: MockTest[] = [
  {
    id: 'test-1',
    title: 'Mid-Semester Practice Test 1',
    category: 'Mid-Semester Exam',
    date: '2026-10-05',
    totalScore: 78,
    maxMarks: 100,
    questionsAttempted: 45,
    questionsCorrect: 39,
    notes: 'Good pacing, made two calculation slips in section B.',
    createdAt: '2026-10-05T10:00:00.000Z',
    isSample: true,
  },
  {
    id: 'test-2',
    title: 'Full Length Mock 1',
    category: 'Full Length Mock',
    date: '2026-10-10',
    totalScore: 215,
    maxMarks: 300,
    questionsAttempted: 65,
    questionsCorrect: 54,
    notes: 'Attempted more questions; time management in Algorithms was solid.',
    createdAt: '2026-10-10T14:00:00.000Z',
    isSample: true,
  },
  {
    id: 'test-3',
    title: 'Full Length Mock 2',
    category: 'Full Length Mock',
    date: '2026-10-15',
    totalScore: 232,
    maxMarks: 300,
    questionsAttempted: 70,
    questionsCorrect: 61,
    notes: 'Improved accuracy in Discrete Math.',
    createdAt: '2026-10-15T15:30:00.000Z',
    isSample: true,
  },
];

export const DEFAULT_ERROR_LOGS: ErrorLogEntry[] = [
  {
    id: 'err-1',
    title: 'Off-by-one in binary search index bounds',
    subjectId: 'sub-1',
    syllabusChapterId: 'chap-algo-1',
    mockTestId: 'test-1',
    errorType: 'conceptual',
    description: 'Used low < high instead of low <= high leading to early loop termination on target element.',
    correctApproach: 'Maintain inclusive invariant [low, high] and update high = mid - 1.',
    reviewedCount: 2,
    lastReviewedAt: '2026-10-12T10:00:00Z',
    resolved: false,
    createdAt: '2026-10-05T14:30:00Z',
    isSample: true,
  },
  {
    id: 'err-2',
    title: 'Sign error in recurrence relation calculation',
    subjectId: 'sub-1',
    syllabusChapterId: 'chap-algo-1',
    mockTestId: 'test-2',
    errorType: 'calculation',
    description: 'Subtracted 2T(n/2) instead of adding when expanding the master theorem tree.',
    correctApproach: 'Always write down tree layer cost explicitly before summing.',
    reviewedCount: 1,
    lastReviewedAt: '2026-10-14T09:00:00Z',
    resolved: false,
    createdAt: '2026-10-10T16:00:00Z',
    isSample: true,
  },
  {
    id: 'err-3',
    title: 'Forgot graph cycle constraint in topological sort',
    subjectId: 'sub-1',
    syllabusChapterId: 'chap-algo-1',
    mockTestId: 'test-3',
    errorType: 'formula',
    description: 'Did not check in-degrees counter for cycle detection in Kahns algorithm.',
    correctApproach: 'If processed node count != V, graph contains a directed cycle.',
    reviewedCount: 0,
    resolved: false,
    createdAt: '2026-10-15T18:00:00Z',
    isSample: true,
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
          studySessions: Array.isArray(parsed.studySessions)
            ? parsed.studySessions.map((s: any) => ({
                ...s,
                status: s.status ?? 'completed',
              }))
            : [],
          gymWorkouts: Array.isArray(parsed.gymWorkouts) ? parsed.gymWorkouts : [],
          reminders: Array.isArray(parsed.reminders) ? parsed.reminders : [],
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
          syllabusSubjects: Array.isArray(parsed.syllabusSubjects)
            ? parsed.syllabusSubjects
            : [],
          occurrenceOverrides: Array.isArray(parsed.occurrenceOverrides) ? parsed.occurrenceOverrides : [],
          extraClasses: Array.isArray(parsed.extraClasses) ? parsed.extraClasses : [],
          tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
          spacedReviews: Array.isArray(parsed.spacedReviews) ? parsed.spacedReviews : [],
          dailyQuestions: Array.isArray(parsed.dailyQuestions) ? parsed.dailyQuestions : [],
          dailyQuestionTarget: typeof parsed.dailyQuestionTarget === 'number' ? parsed.dailyQuestionTarget : DEFAULT_DAILY_QUESTION_TARGET,
          reviewIntervals: Array.isArray(parsed.reviewIntervals) ? parsed.reviewIntervals : DEFAULT_REVIEW_INTERVALS,
          foodDiaryEntries: Array.isArray(parsed.foodDiaryEntries) ? parsed.foodDiaryEntries : [],
          customFoods: Array.isArray(parsed.customFoods) ? parsed.customFoods : [],
          recipes: Array.isArray(parsed.recipes) ? parsed.recipes : [],
          weightLogs: Array.isArray(parsed.weightLogs) ? parsed.weightLogs : [],
          nutritionProfile: parsed.nutritionProfile ?? DEFAULT_NUTRITION_PROFILE,
          radioUrls: Array.isArray(parsed.radioUrls) ? parsed.radioUrls : [],
          radioQueue: Array.isArray(parsed.radioQueue) ? parsed.radioQueue : [],
          radioLoopMode: parsed.radioLoopMode === 'all' || parsed.radioLoopMode === 'one' ? parsed.radioLoopMode : 'off',
          radioIsShuffle: Boolean(parsed.radioIsShuffle),
          customPlaylists: Array.isArray(parsed.customPlaylists) ? parsed.customPlaylists : DEFAULT_CUSTOM_PLAYLISTS,
          mockTests: Array.isArray(parsed.mockTests) ? parsed.mockTests : [],
          errorLogs: Array.isArray(parsed.errorLogs) ? parsed.errorLogs : [],
          events: Array.isArray(parsed.events) ? parsed.events : [],
        };
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
      // Save migrated data under v2 key
      localStorage.setItem(STORAGE_KEY_V2, JSON.stringify(migrated));
      return migrated;
    } catch {
      console.error('Failed to parse v1 data, initializing empty state');
    }
  }
  // Fresh installation: initialize with a valid, clean, empty default state without demo data
  const fresh: AppStateData = {
    ...EMPTY_STATE,
    profile: { ...DEFAULT_PROFILE },
    settings: { ...DEFAULT_SETTINGS },
    customPlaylists: JSON.parse(JSON.stringify(DEFAULT_CUSTOM_PLAYLISTS)),
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
    };
    localStorage.setItem(STORAGE_KEY_V2, JSON.stringify(toSave));
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
  tasks: [
    {
      id: 'task-sample-1',
      title: 'Solve problem set on Newtonian Laws & Friction',
      description: 'Complete practice problems 1 to 15 from course textbook.',
      status: 'in_progress',
      priority: 'high',
      subjectId: 'sub-1',
      syllabusSubjectId: 'syl-phy',
      syllabusChapterId: 'chap-phy-1',
      syllabusTopicId: 'top-p1',
      dueDate: '2026-10-18',
      dueTime: '17:00',
      estimatedDuration: 45,
      createdAt: '2026-10-15T10:00:00.000Z',
      isSample: true,
    },
    {
      id: 'task-sample-2',
      title: 'Review Thermodynamics formulas & state functions',
      description: 'Summarize First & Second Laws equations on review sheet.',
      status: 'todo',
      priority: 'medium',
      subjectId: 'sub-2',
      syllabusSubjectId: 'syl-chem',
      syllabusChapterId: 'chap-chem-1',
      syllabusTopicId: 'top-c1',
      dueDate: '2026-10-20',
      dueTime: '14:30',
      estimatedDuration: 30,
      createdAt: '2026-10-16T12:00:00.000Z',
      isSample: true,
    },
    {
      id: 'task-sample-3',
      title: 'Read lecture slides on Graph Theory algorithms',
      description: 'Depth-first search and breadth-first search examples.',
      status: 'done',
      priority: 'low',
      subjectId: 'sub-3',
      dueDate: '2026-10-14',
      estimatedDuration: 40,
      createdAt: '2026-10-13T09:00:00.000Z',
      completedAt: '2026-10-14T11:20:00.000Z',
      isSample: true,
    },
  ],
  spacedReviews: [
    {
      id: 'sr-sample-1',
      syllabusSubjectId: 'syl-phy',
      syllabusChapterId: 'chap-phy-1',
      syllabusTopicId: 'top-p1',
      topicName: 'Newtonian Laws & Friction',
      dueDate: '2026-10-18',
      intervalDays: 3,
      repetitionLevel: 1,
      isCompleted: false,
      history: [
        { reviewedAt: '2026-10-15T10:00:00.000Z', nextDueDate: '2026-10-18' }
      ],
      isSample: true,
    },
    {
      id: 'sr-sample-2',
      syllabusSubjectId: 'syl-chem',
      syllabusChapterId: 'chap-chem-1',
      syllabusTopicId: 'top-c1',
      topicName: 'First & Second Laws of Thermodynamics',
      dueDate: '2026-10-22',
      intervalDays: 7,
      repetitionLevel: 2,
      isCompleted: false,
      history: [],
      isSample: true,
    },
  ],
  dailyQuestions: [
    {
      id: 'dq-sample-1',
      date: '2026-10-18',
      subjectId: 'sub-1',
      subjectName: 'Design & Analysis of Algorithms',
      attempted: 20,
      correct: 17,
      notes: 'Divide and conquer recurrence relations',
      createdAt: '2026-10-18T08:30:00.000Z',
      isSample: true,
    },
    {
      id: 'dq-sample-2',
      date: '2026-10-18',
      subjectId: 'sub-2',
      subjectName: 'Database Management Systems',
      attempted: 10,
      correct: 8,
      notes: 'SQL subqueries and indexing',
      createdAt: '2026-10-18T11:00:00.000Z',
      isSample: true,
    },
  ],
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
  mockTests: DEFAULT_MOCK_TESTS,
  errorLogs: DEFAULT_ERROR_LOGS,
  events: DEFAULT_EVENTS,
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
      tasks: existing.tasks?.length ? existing.tasks : (SAMPLE_DATA.tasks ?? []),
      spacedReviews: existing.spacedReviews?.length ? existing.spacedReviews : (SAMPLE_DATA.spacedReviews ?? []),
      dailyQuestions: existing.dailyQuestions?.length ? existing.dailyQuestions : (SAMPLE_DATA.dailyQuestions ?? []),
      dailyQuestionTarget: existing.dailyQuestionTarget ?? SAMPLE_DATA.dailyQuestionTarget ?? DEFAULT_DAILY_QUESTION_TARGET,
      reviewIntervals: existing.reviewIntervals ?? SAMPLE_DATA.reviewIntervals ?? DEFAULT_REVIEW_INTERVALS,
      foodDiaryEntries: existing.foodDiaryEntries?.length ? existing.foodDiaryEntries : (SAMPLE_DATA.foodDiaryEntries ?? []),
      customFoods: existing.customFoods?.length ? existing.customFoods : (SAMPLE_DATA.customFoods ?? []),
      recipes: existing.recipes?.length ? existing.recipes : (SAMPLE_DATA.recipes ?? []),
      weightLogs: existing.weightLogs?.length ? existing.weightLogs : (SAMPLE_DATA.weightLogs ?? []),
      nutritionProfile: existing.nutritionProfile ?? SAMPLE_DATA.nutritionProfile ?? DEFAULT_NUTRITION_PROFILE,
      mockTests: existing.mockTests?.length ? existing.mockTests : (SAMPLE_DATA.mockTests ?? []),
      errorLogs: existing.errorLogs?.length ? existing.errorLogs : (SAMPLE_DATA.errorLogs ?? []),
      events: existing.events?.length ? existing.events : (SAMPLE_DATA.events ?? DEFAULT_EVENTS),
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
      syllabusSubjects: current.syllabusSubjects ?? [],
      subjects: current.subjects.filter((s) => !s.isSample),
      timetable: current.timetable.filter((t) => !t.isSample),
      attendanceLogs: current.attendanceLogs.filter((a) => !a.isSample),
      studySessions: current.studySessions.filter((s) => !s.isSample),
      gymWorkouts: current.gymWorkouts.filter((g) => !g.isSample),
      reminders: current.reminders.filter((r) => !r.isSample),
      occurrenceOverrides: current.occurrenceOverrides ?? [],
      extraClasses: current.extraClasses ?? [],
      tasks: (current.tasks || []).filter((t) => !t.isSample),
      spacedReviews: (current.spacedReviews || []).filter((r) => !r.isSample),
      dailyQuestions: (current.dailyQuestions || []).filter((q) => !q.isSample),
      dailyQuestionTarget: current.dailyQuestionTarget ?? DEFAULT_DAILY_QUESTION_TARGET,
      reviewIntervals: current.reviewIntervals ?? DEFAULT_REVIEW_INTERVALS,
      foodDiaryEntries: (current.foodDiaryEntries || []).filter((e) => !e.isSample),
      customFoods: (current.customFoods || []).filter((c) => !c.isSample),
      recipes: (current.recipes || []).filter((r) => !r.isSample),
      weightLogs: (current.weightLogs || []).filter((w) => !w.isSample),
      nutritionProfile: current.nutritionProfile ?? DEFAULT_NUTRITION_PROFILE,
      radioUrls: current.radioUrls ?? [],
      radioQueue: current.radioQueue ?? [],
      radioLoopMode: current.radioLoopMode ?? 'off',
      radioIsShuffle: Boolean(current.radioIsShuffle),
      customPlaylists: current.customPlaylists ?? JSON.parse(JSON.stringify(DEFAULT_CUSTOM_PLAYLISTS)),
      mockTests: (current.mockTests || []).filter((m) => !m.isSample),
      errorLogs: (current.errorLogs || []).filter((e) => !e.isSample),
      events: (current.events || []).filter((e) => !e.isSample),
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

    const readCollection = <T>(key: string, existingList: T[] = []): T[] => {
      if (key in parsed) {
        return Array.isArray(parsed[key]) ? (parsed[key] as T[]) : [];
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
