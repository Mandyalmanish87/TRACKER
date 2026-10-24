import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import {
  storageService,
  STORAGE_KEY_V2,
  THEME_KEY,
  EMPTY_STATE,
  DEFAULT_SETTINGS,
  DEFAULT_NUTRITION_PROFILE,
} from '../src/services/storage';
import { cloudSyncService } from '../src/services/cloudSyncService';
import { AppProvider, useApp } from '../src/context/AppContext';
import { AppStateData } from '../src/types';

describe('Phase 2B — Data Integrity Hardening Before Cloud Setup', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // 1. Saving an intentionally empty syllabus collection does not restore default syllabus fixtures
  it('1. Saving an intentionally empty syllabus collection does not restore default syllabus fixtures', () => {
    const dataWithEmptySyllabus: AppStateData = {
      ...EMPTY_STATE,
      syllabusSubjects: [],
    };

    storageService.saveData(dataWithEmptySyllabus);
    const loaded = storageService.loadData();

    expect(loaded.syllabusSubjects).toBeDefined();
    expect(loaded.syllabusSubjects).toEqual([]);
    expect(loaded.syllabusSubjects?.some((s) => s.id === 'syl-phy')).toBe(false);
  });

  // 2. Saving an intentionally empty events collection does not restore default events
  it('2. Saving an intentionally empty events collection does not restore default events', () => {
    const dataWithEmptyEvents: AppStateData = {
      ...EMPTY_STATE,
      events: [],
    };

    storageService.saveData(dataWithEmptyEvents);
    const loaded = storageService.loadData();

    expect(loaded.events).toBeDefined();
    expect(loaded.events).toEqual([]);
    expect(loaded.events?.some((e) => e.id === 'evt-exam-1')).toBe(false);
  });

  // 3. Existing real user records survive load/save cycles
  it('3. Existing real user records survive load/save cycles', () => {
    const customUserRecord: AppStateData = {
      ...EMPTY_STATE,
      profile: {
        displayName: 'Dr. Ada Lovelace',
        targetExam: 'Analytical Engine Certification',
        examDate: '2026-12-10',
        email: 'ada@computing.org',
        institution: 'University of London',
      },
      settings: {
        ...DEFAULT_SETTINGS,
        themeMode: 'dark',
        accentColor: 'slate',
        studyDayRolloverHour: 3,
      },
      subjects: [
        {
          id: 'sub-user-custom',
          code: 'MATH500',
          name: 'Advanced Calculus',
          attended: 28,
          totalConducted: 30,
          targetPct: 85,
          color: '#3B82F6',
          isSample: false,
        },
      ],
      tasks: [
        {
          id: 'task-user-custom',
          title: 'Complete Bernstein polynomial proof',
          status: 'in_progress',
          priority: 'high',
          dueDate: '2026-10-30',
          createdAt: '2026-10-20T10:00:00.000Z',
        },
      ],
      events: [
        {
          id: 'evt-user-custom',
          title: 'Symposium on Bernoulli Numbers',
          category: 'college_event',
          date: '2026-11-15',
          startTime: '09:00',
          endTime: '17:00',
          priority: 'high',
          createdAt: '2026-10-21T08:00:00.000Z',
        },
      ],
      foodDiaryEntries: [
        {
          id: 'food-entry-user',
          name: 'Oatmeal with Blueberries',
          mealType: 'breakfast',
          quantity: 1,
          servingUnit: 'serving',
          calories: 320,
          protein: 12,
          carbs: 55,
          fat: 6,
          date: '2026-10-23',
          lastEditedAt: '2026-10-23T07:30:00.000Z',
        },
      ],
    };

    // Cycle 1: Save and load
    storageService.saveData(customUserRecord);
    const loaded1 = storageService.loadData();

    expect(loaded1.profile?.displayName).toBe('Dr. Ada Lovelace');
    expect(loaded1.profile?.email).toBe('ada@computing.org');
    expect(loaded1.settings?.studyDayRolloverHour).toBe(3);
    expect(loaded1.subjects).toHaveLength(1);
    expect(loaded1.subjects[0].id).toBe('sub-user-custom');
    expect(loaded1.tasks).toBeDefined();
    expect(loaded1.tasks![0].title).toBe('Complete Bernstein polynomial proof');
    expect(loaded1.events).toBeDefined();
    expect(loaded1.events![0].title).toBe('Symposium on Bernoulli Numbers');
    expect(loaded1.foodDiaryEntries).toHaveLength(1);

    // Cycle 2: Save loaded state and reload
    storageService.saveData(loaded1);
    const loaded2 = storageService.loadData();

    expect(loaded2.profile?.displayName).toBe('Dr. Ada Lovelace');
    expect(loaded2.subjects[0].id).toBe('sub-user-custom');
    expect(loaded2.tasks).toBeDefined();
    expect(loaded2.tasks![0].id).toBe('task-user-custom');
    expect(loaded2.events).toBeDefined();
    expect(loaded2.events![0].id).toBe('evt-user-custom');
    expect(loaded2.foodDiaryEntries?.[0].id).toBe('food-entry-user');
  });

  // 4. Legacy and partial stored data migrate without losing valid profile/settings or records
  it('4. Legacy and partial stored data migrate without losing valid profile/settings or records', () => {
    const legacyV1Data = {
      profile: {
        displayName: 'Legacy Scholar',
        targetExam: 'GATE CSE 2027',
        examDate: '2027-02-14',
      },
      settings: {
        themeMode: 'dark',
        accentColor: 'plum',
        backgroundStyle: 'abstract',
        studyDayRolloverHour: 4,
        showExamCountdown: false,
        userMode: 'individual',
      },
      subjects: [
        {
          id: 'legacy-sub-1',
          code: 'CS201',
          name: 'Data Structures',
          attended: 20,
          totalConducted: 22,
          targetPct: 75,
          color: '#10B981',
        },
      ],
      timetable: [
        {
          id: 'legacy-slot-1',
          dayOfWeek: 'Monday',
          startTime: '10:00',
          endTime: '11:00',
          subjectId: 'legacy-sub-1',
          room: 'Hall B',
        },
      ],
      attendanceLogs: [
        {
          id: 'legacy-log-1',
          slotId: 'legacy-slot-1',
          subjectId: 'legacy-sub-1',
          date: '2026-10-10',
          status: 'present',
          timestamp: '2026-10-10T10:00:00Z',
        },
      ],
    };

    localStorage.setItem('tracker_app_data_v1', JSON.stringify(legacyV1Data));

    // loadData should migrate v1 data to v2
    const migrated = storageService.loadData();

    expect(migrated.schemaVersion).toBe(2);
    expect(migrated.profile?.displayName).toBe('Legacy Scholar');
    expect(migrated.profile?.targetExam).toBe('GATE CSE 2027');
    expect(migrated.settings?.themeMode).toBe('dark');
    expect(migrated.settings?.accentColor).toBe('plum');
    expect(migrated.settings?.studyDayRolloverHour).toBe(4);
    expect(migrated.settings?.showExamCountdown).toBe(false);
    expect(migrated.subjects).toHaveLength(1);
    expect(migrated.subjects[0].id).toBe('legacy-sub-1');
    expect(migrated.timetable).toHaveLength(1);
    expect(migrated.timetable[0].id).toBe('legacy-slot-1');
    expect(migrated.attendanceLogs).toHaveLength(1);
    // Missing collections become empty arrays rather than injecting sample data
    expect(migrated.tasks).toEqual([]);
    expect(migrated.events).toEqual([]);
    expect(migrated.mockTests).toEqual([]);
    expect(migrated.errorLogs).toEqual([]);
    expect(migrated.foodDiaryEntries).toEqual([]);
  });

  // 5. Backup export/import round-trips every applicable persisted collection
  it('5. Backup export/import round-trips every applicable persisted collection', () => {
    const fullDataset: AppStateData = {
      schemaVersion: 2,
      hasSampleData: false,
      profile: {
        displayName: 'Grace Hopper',
        targetExam: 'Compiler Specialist',
        email: 'grace@navy.mil',
      },
      settings: {
        ...DEFAULT_SETTINGS,
        themeMode: 'light',
        accentColor: 'terracotta',
      },
      subjects: [{ id: 'sub-1', code: 'C101', name: 'COBOL', attended: 10, totalConducted: 10, targetPct: 75, color: '#111' }],
      timetable: [{ id: 'tt-1', dayOfWeek: 1, startTime: '09:00', endTime: '10:00', subjectId: 'sub-1' }],
      attendanceLogs: [{ id: 'att-1', slotId: 'tt-1', subjectId: 'sub-1', date: '2026-10-01', status: 'present', timestamp: '2026-10-01T09:00:00Z' }],
      studySessions: [{ id: 'ss-1', subjectId: 'sub-1', durationMinutes: 60, startTime: '2026-10-01T09:00:00Z', timestamp: '2026-10-01T09:00:00Z', status: 'completed' }],
      gymWorkouts: [{ id: 'gw-1', date: '2026-10-02', split: 'Leg Day', completed: true, exercises: [] }],
      reminders: [{ id: 'rem-1', title: 'Return library book', category: 'academic', dueDate: '2026-10-25', priority: 'medium', isCompleted: false }],
      syllabusSubjects: [{ id: 'syl-1', name: 'Computer Arch', chapters: [], color: '#333' }],
      occurrenceOverrides: [{ id: 'occ-1', originalDate: '2026-10-05', slotId: 'tt-1', type: 'cancel' }],
      extraClasses: [{ id: 'extra-1', subjectId: 'sub-1', date: '2026-10-06', startTime: '11:00', endTime: '12:00' }],
      tasks: [{ id: 'task-1', title: 'Fix moth in relay', status: 'done', priority: 'high', createdAt: '2026-10-01T00:00:00Z' }],
      spacedReviews: [{ id: 'rev-1', syllabusTopicId: 'top-1', dueDate: '2026-10-28', intervalDays: 3, repetitionLevel: 2 }],
      dailyQuestions: [{ id: 'dq-1', date: '2026-10-01', attempted: 20, correct: 18, createdAt: '2026-10-01T00:00:00Z' }],
      dailyQuestionTarget: 30,
      reviewIntervals: [1, 2, 5, 10, 20],
      foodDiaryEntries: [{ id: 'food-1', name: 'Sandwich', mealType: 'lunch', quantity: 1, servingUnit: 'serving', calories: 450, protein: 25, carbs: 40, fat: 15, date: '2026-10-01', lastEditedAt: '2026-10-01T12:00:00Z' }],
      customFoods: [{ id: 'cf-1', name: 'Protein Bar', category: 'Custom', servingSize: 60, servingUnit: 'g', calories: 200, protein: 20, carbs: 20, fat: 5, isCustom: true, createdAt: '2026-10-01T00:00:00Z' }],
      recipes: [{ id: 'rec-1', name: 'Protein Shake', ingredients: [], totalServings: 1, caloriesPerServing: 300, proteinPerServing: 40, carbsPerServing: 10, fatPerServing: 3, createdAt: '2026-10-01T00:00:00Z' }],
      weightLogs: [{ id: 'wl-1', date: '2026-10-01', weightKg: 65.5 }],
      nutritionProfile: {
        goal: 'maintain',
        targetCalories: 2400,
        macroTargets: { calories: 2400, protein: 160, carbs: 280, fat: 70, isManualOverride: true },
        waterTargetMl: 3000,
        enabledMealTypes: ['breakfast', 'lunch', 'dinner'],
        updatedAt: '2026-10-01T00:00:00.000Z',
      },
      radioUrls: [{ id: 'rad-1', label: 'Jazz', url: 'https://youtu.be/1', embedUrl: 'https://embed.1', addedAt: '2026-10-01T00:00:00Z' }],
      radioQueue: [{ id: 'rq-1', label: 'Chill', url: 'https://youtu.be/2', embedUrl: 'https://embed.2', addedAt: '2026-10-01T00:00:00Z' }],
      radioLoopMode: 'all',
      radioIsShuffle: true,
      customPlaylists: [{ id: 'pl-1', name: 'Synthwave', items: [], createdAt: '2026-10-01T00:00:00Z' }],
      mockTests: [{ id: 'mock-1', title: 'Compiler Mock', category: 'Finals', date: '2026-10-15', totalScore: 95, maxMarks: 100, questionsAttempted: 50, questionsCorrect: 48, createdAt: '2026-10-15T00:00:00Z' }],
      errorLogs: [{ id: 'err-1', title: 'Off by one', subjectId: 'sub-1', errorType: 'conceptual', reviewedCount: 1, resolved: true, createdAt: '2026-10-15T00:00:00Z' }],
      events: [{ id: 'evt-1', title: 'Navy Graduation', category: 'college_event', date: '2026-11-01', createdAt: '2026-10-01T00:00:00Z' }],
    };

    const exportedJson = storageService.exportBackup(fullDataset);
    expect(typeof exportedJson).toBe('string');

    // Clear local storage and import the backup
    localStorage.clear();
    const imported = storageService.importBackup(exportedJson);

    // Verify all 22 collections survived the export/import round-trip
    expect(imported.subjects).toHaveLength(1);
    expect(imported.timetable).toHaveLength(1);
    expect(imported.attendanceLogs).toHaveLength(1);
    expect(imported.studySessions).toHaveLength(1);
    expect(imported.gymWorkouts).toHaveLength(1);
    expect(imported.reminders).toHaveLength(1);
    expect(imported.syllabusSubjects).toHaveLength(1);
    expect(imported.occurrenceOverrides).toHaveLength(1);
    expect(imported.extraClasses).toHaveLength(1);
    expect(imported.tasks).toHaveLength(1);
    expect(imported.spacedReviews).toHaveLength(1);
    expect(imported.dailyQuestions).toHaveLength(1);
    expect(imported.foodDiaryEntries).toHaveLength(1);
    expect(imported.customFoods).toHaveLength(1);
    expect(imported.recipes).toHaveLength(1);
    expect(imported.weightLogs).toHaveLength(1);
    expect(imported.radioUrls).toHaveLength(1);
    expect(imported.radioQueue).toHaveLength(1);
    expect(imported.customPlaylists).toHaveLength(1);
    expect(imported.mockTests).toHaveLength(1);
    expect(imported.errorLogs).toHaveLength(1);
    expect(imported.events).toHaveLength(1);

    // Verify scalar/settings fields
    expect(imported.dailyQuestionTarget).toBe(30);
    expect(imported.reviewIntervals).toEqual([1, 2, 5, 10, 20]);
    expect(imported.radioLoopMode).toBe('all');
    expect(imported.radioIsShuffle).toBe(true);
    expect(imported.nutritionProfile?.targetCalories).toBe(2400);
    expect(imported.profile?.displayName).toBe('Grace Hopper');
    expect(imported.settings?.accentColor).toBe('terracotta');
  });

  // 6. Importing a legacy backup with omitted fields does not unexpectedly erase existing records
  it('6. Importing a legacy backup with omitted fields does not unexpectedly erase existing records', () => {
    // Setup existing state with genuine records across modern features
    const existingState: AppStateData = {
      ...EMPTY_STATE,
      tasks: [
        { id: 'task-pre-existing', title: 'User task before import', status: 'todo', priority: 'medium', createdAt: '2026-10-22T00:00:00Z' },
      ],
      events: [
        { id: 'evt-pre-existing', title: 'User event before import', category: 'personal_event', date: '2026-10-30', createdAt: '2026-10-22T00:00:00Z' },
      ],
      customFoods: [
        { id: 'cf-pre-existing', name: 'Greek Yogurt', category: 'Dairy & Eggs', servingSize: 150, servingUnit: 'g', calories: 120, protein: 18, carbs: 6, fat: 2, isCustom: true, createdAt: '2026-10-22T00:00:00Z' },
      ],
      nutritionProfile: {
        ...DEFAULT_NUTRITION_PROFILE,
        targetCalories: 2600,
      },
    };
    storageService.saveData(existingState);

    // Create a legacy backup file format that only has subjects and profile (omits tasks, events, customFoods, nutritionProfile)
    const legacyBackup = JSON.stringify({
      schemaVersion: 1,
      profile: {
        displayName: 'Updated Profile Name',
      },
      subjects: [
        { id: 'sub-legacy-import', code: 'PHY101', name: 'Mechanics', attended: 5, totalConducted: 5, targetPct: 75, color: '#222' },
      ],
    });

    const imported = storageService.importBackup(legacyBackup);

    // Profile and subjects were updated from the backup
    expect(imported.profile?.displayName).toBe('Updated Profile Name');
    expect(imported.subjects).toHaveLength(1);
    expect(imported.subjects[0].id).toBe('sub-legacy-import');

    // OMITTED fields in legacy backup MUST NOT erase the user's existing records
    expect(imported.tasks).toHaveLength(1);
    expect(imported.tasks?.[0].id).toBe('task-pre-existing');
    expect(imported.events).toHaveLength(1);
    expect(imported.events?.[0].id).toBe('evt-pre-existing');
    expect(imported.customFoods).toHaveLength(1);
    expect(imported.customFoods?.[0].id).toBe('cf-pre-existing');
    expect(imported.nutritionProfile?.targetCalories).toBe(2600);
  });

  // 7. Explicitly empty collections remain empty after import where the format supports that distinction
  it('7. Explicitly empty collections remain empty after import where the format supports that distinction', () => {
    // Setup existing state with items
    const existingState: AppStateData = {
      ...EMPTY_STATE,
      tasks: [
        { id: 'task-1', title: 'Task to be cleared', status: 'todo', priority: 'low', createdAt: '2026-10-20T00:00:00Z' },
      ],
      events: [
        { id: 'evt-1', title: 'Event to be cleared', category: 'reminder', date: '2026-10-25', createdAt: '2026-10-20T00:00:00Z' },
      ],
    };
    storageService.saveData(existingState);

    // Backup explicitly includes tasks: [] and events: []
    const backupWithEmptyArrays = JSON.stringify({
      schemaVersion: 2,
      profile: { displayName: 'User with cleared lists' },
      tasks: [],
      events: [],
    });

    const imported = storageService.importBackup(backupWithEmptyArrays);

    // The explicit empty collections in the backup must be respected
    expect(imported.tasks).toEqual([]);
    expect(imported.events).toEqual([]);
  });

  // 8. Repeated merges do not create duplicate records
  it('8. Repeated merges do not create duplicate records', () => {
    const localData: AppStateData = {
      ...EMPTY_STATE,
      subjects: [
        { id: 'sub-shared', code: 'CS100', name: 'Intro CS', attended: 10, totalConducted: 12, targetPct: 75, color: '#333' },
        { id: 'sub-local-only', code: 'CS101', name: 'Data Structures', attended: 14, totalConducted: 15, targetPct: 75, color: '#444' },
      ],
      tasks: [
        { id: 'task-1', title: 'Study recursion', status: 'in_progress', priority: 'medium', createdAt: '2026-10-18T00:00:00Z' },
      ],
      events: [
        { id: 'evt-1', title: 'Lab Exam', category: 'exam', date: '2026-10-28', createdAt: '2026-10-18T00:00:00Z' },
      ],
    };

    const cloudData: AppStateData = {
      ...EMPTY_STATE,
      subjects: [
        { id: 'sub-shared', code: 'CS100', name: 'Intro CS', attended: 11, totalConducted: 13, targetPct: 75, color: '#333' },
        { id: 'sub-cloud-only', code: 'MATH200', name: 'Linear Algebra', attended: 8, totalConducted: 8, targetPct: 75, color: '#555' },
      ],
      tasks: [
        { id: 'task-2', title: 'Complete math assignment', status: 'todo', priority: 'high', createdAt: '2026-10-19T00:00:00Z' },
      ],
      events: [
        { id: 'evt-1', title: 'Lab Exam Updated', category: 'exam', date: '2026-10-28', createdAt: '2026-10-18T00:00:00Z' },
      ],
    };

    // First merge
    const merged1 = cloudSyncService.mergeDatasets(localData, cloudData);
    expect(merged1.subjects).toHaveLength(3); // sub-shared, sub-local-only, sub-cloud-only
    expect(merged1.tasks).toHaveLength(2); // task-1, task-2
    expect(merged1.events).toHaveLength(1); // evt-1 updated

    // Repeated merges (idempotency check)
    const merged2 = cloudSyncService.mergeDatasets(merged1, cloudData);
    expect(merged2.subjects).toHaveLength(3);
    expect(merged2.tasks).toHaveLength(2);
    expect(merged2.events).toHaveLength(1);

    const merged3 = cloudSyncService.mergeDatasets(merged2, cloudData);
    expect(merged3.subjects).toHaveLength(3);
    expect(merged3.tasks).toHaveLength(2);
    expect(merged3.events).toHaveLength(1);
  });

  // 9. Every applicable collection survives merging, including nutrition data
  it('9. Every applicable collection survives merging, including nutrition data', () => {
    const localData: AppStateData = {
      ...EMPTY_STATE,
      nutritionProfile: {
        ...DEFAULT_NUTRITION_PROFILE,
        targetCalories: 2000,
        updatedAt: '2026-10-18T10:00:00.000Z',
      },
      foodDiaryEntries: [
        { id: 'food-local-1', name: 'Eggs & Toast', mealType: 'breakfast', quantity: 1, servingUnit: 'serving', calories: 350, protein: 20, carbs: 30, fat: 12, date: '2026-10-20', lastEditedAt: '2026-10-20T08:00:00Z' },
      ],
      customFoods: [
        { id: 'cf-local-1', name: 'Almond Milk', category: 'Dairy & Eggs', servingSize: 240, servingUnit: 'ml', calories: 40, protein: 1, carbs: 2, fat: 3, isCustom: true, createdAt: '2026-10-20T00:00:00Z' },
      ],
      recipes: [
        { id: 'rec-local-1', name: 'Morning Smoothie', ingredients: [], totalServings: 1, caloriesPerServing: 280, proteinPerServing: 25, carbsPerServing: 35, fatPerServing: 4, createdAt: '2026-10-20T00:00:00Z' },
      ],
      weightLogs: [
        { id: 'wl-local-1', date: '2026-10-20', weightKg: 72.0 },
      ],
      events: [
        { id: 'evt-local-1', title: 'Local Study Group', category: 'personal_event', date: '2026-10-24', createdAt: '2026-10-20T00:00:00Z' },
      ],
      mockTests: [
        { id: 'mock-local-1', title: 'Algorithms Quiz', category: 'Quiz', date: '2026-10-21', totalScore: 18, maxMarks: 20, questionsAttempted: 20, questionsCorrect: 18, createdAt: '2026-10-21T00:00:00Z' },
      ],
      errorLogs: [
        { id: 'err-local-1', title: 'Boundary check missing', subjectId: 'sub-1', errorType: 'conceptual', reviewedCount: 1, resolved: false, createdAt: '2026-10-21T00:00:00Z' },
      ],
      radioUrls: [
        { id: 'rad-local-1', label: 'Local Station', url: 'https://youtube.com/watch?v=local', embedUrl: 'https://embed/local', addedAt: '2026-10-20T00:00:00Z' },
      ],
      customPlaylists: [
        { id: 'pl-local-1', name: 'Ambient Local', items: [], createdAt: '2026-10-20T00:00:00Z' },
      ],
    };

    const cloudData: AppStateData = {
      ...EMPTY_STATE,
      nutritionProfile: {
        ...DEFAULT_NUTRITION_PROFILE,
        targetCalories: 2350,
        updatedAt: '2026-10-22T15:00:00.000Z', // Newer timestamp
      },
      foodDiaryEntries: [
        { id: 'food-cloud-1', name: 'Chicken Rice Bowl', mealType: 'lunch', quantity: 1, servingUnit: 'serving', calories: 600, protein: 45, carbs: 65, fat: 12, date: '2026-10-20', lastEditedAt: '2026-10-20T13:00:00Z' },
      ],
      customFoods: [
        { id: 'cf-cloud-1', name: 'Whey Isolate', category: 'Supplements', servingSize: 30, servingUnit: 'g', calories: 120, protein: 25, carbs: 2, fat: 1, isCustom: true, createdAt: '2026-10-22T00:00:00Z' },
      ],
      recipes: [
        { id: 'rec-cloud-1', name: 'Chicken Curry', ingredients: [], totalServings: 2, caloriesPerServing: 550, proteinPerServing: 40, carbsPerServing: 20, fatPerServing: 20, createdAt: '2026-10-22T00:00:00Z' },
      ],
      weightLogs: [
        { id: 'wl-cloud-1', date: '2026-10-21', weightKg: 71.8 },
      ],
      events: [
        { id: 'evt-cloud-1', title: 'Cloud Project Presentation', category: 'deadline', date: '2026-10-27', createdAt: '2026-10-22T00:00:00Z' },
      ],
      mockTests: [
        { id: 'mock-cloud-1', title: 'OS Midterm Mock', category: 'Mid-Sem', date: '2026-10-22', totalScore: 82, maxMarks: 100, questionsAttempted: 50, questionsCorrect: 41, createdAt: '2026-10-22T00:00:00Z' },
      ],
      errorLogs: [
        { id: 'err-cloud-1', title: 'Deadlock detection omitted', subjectId: 'sub-2', errorType: 'conceptual', reviewedCount: 0, resolved: false, createdAt: '2026-10-22T00:00:00Z' },
      ],
      radioUrls: [
        { id: 'rad-cloud-1', label: 'Cloud Beats', url: 'https://youtube.com/watch?v=cloud', embedUrl: 'https://embed/cloud', addedAt: '2026-10-22T00:00:00Z' },
      ],
      customPlaylists: [
        { id: 'pl-cloud-1', name: 'Deep LoFi Cloud', items: [], createdAt: '2026-10-22T00:00:00Z' },
      ],
    };

    const merged = cloudSyncService.mergeDatasets(localData, cloudData);

    // Nutrition profile took the newer cloud version
    expect(merged.nutritionProfile?.targetCalories).toBe(2350);
    // Nutrition collections merged union
    expect(merged.foodDiaryEntries).toHaveLength(2);
    expect(merged.customFoods).toHaveLength(2);
    expect(merged.recipes).toHaveLength(2);
    expect(merged.weightLogs).toHaveLength(2);
    // Calendar events merged union
    expect(merged.events).toHaveLength(2);
    // Analytics & error log merged union
    expect(merged.mockTests).toHaveLength(2);
    expect(merged.errorLogs).toHaveLength(2);
    // Focus radio merged union
    expect(merged.radioUrls).toHaveLength(2);
    expect(merged.customPlaylists).toHaveLength(2);
  });

  // 10. A Tracker full reset removes only its intended keys
  it('10. A Tracker full reset removes only its intended keys', () => {
    // Populate Tracker-owned keys in localStorage
    localStorage.setItem(STORAGE_KEY_V2, JSON.stringify({ ...EMPTY_STATE, profile: { displayName: 'To Reset', targetExam: 'Exam' } }));
    localStorage.setItem('tracker_app_data_v1', JSON.stringify({ oldData: true }));
    localStorage.setItem('tracker_active_focus_timer', JSON.stringify({ active: true }));

    const TestComponent = () => {
      const { fullReset } = useApp();
      return (
        <button data-testid="reset-btn" onClick={() => fullReset()}>
          Reset Tracker
        </button>
      );
    };

    render(
      <AppProvider>
        <TestComponent />
      </AppProvider>
    );

    act(() => {
      screen.getByTestId('reset-btn').click();
    });

    // Tracker-owned legacy & active timer keys must be removed
    expect(localStorage.getItem('tracker_app_data_v1')).toBeNull();
    expect(localStorage.getItem('tracker_active_focus_timer')).toBeNull();
    // V2 key is re-initialized to fresh clean state
    const currentV2 = localStorage.getItem(STORAGE_KEY_V2);
    expect(currentV2).not.toBeNull();
    const parsed = JSON.parse(currentV2!);
    expect(parsed.profile?.displayName).toBe('');
    expect(parsed.subjects).toEqual([]);
  });

  // 11. ClassSpace data and unrelated preferences survive the Tracker reset
  it('11. ClassSpace data and unrelated preferences survive the Tracker reset', () => {
    const classSpacePayload = JSON.stringify({
      classes: [{ id: 'cls-math-101', name: 'Mathematics 101', code: 'MATH101' }],
      activeClassId: 'cls-math-101',
    });
    localStorage.setItem('tracker_classspace_data_v1', classSpacePayload);
    localStorage.setItem(THEME_KEY, 'dark');
    localStorage.setItem('unrelated_third_party_key', 'unrelated_secret_data');
    localStorage.setItem(STORAGE_KEY_V2, JSON.stringify({ ...EMPTY_STATE, profile: { displayName: 'Old User', targetExam: 'Old Exam' } }));

    const TestComponent = () => {
      const { fullReset } = useApp();
      return (
        <button data-testid="reset-btn" onClick={() => fullReset()}>
          Reset Tracker
        </button>
      );
    };

    render(
      <AppProvider>
        <TestComponent />
      </AppProvider>
    );

    act(() => {
      screen.getByTestId('reset-btn').click();
    });

    // ClassSpace data MUST survive Tracker full reset
    expect(localStorage.getItem('tracker_classspace_data_v1')).toBe(classSpacePayload);
    // User theme choice MUST survive Tracker full reset
    expect(localStorage.getItem(THEME_KEY)).toBe('dark');
    // Unrelated preferences MUST survive Tracker full reset
    expect(localStorage.getItem('unrelated_third_party_key')).toBe('unrelated_secret_data');
  });

  // 12. Malformed backup input fails safely without partially destroying existing data
  it('12. Malformed backup input fails safely without partially destroying existing data', () => {
    const existingData: AppStateData = {
      ...EMPTY_STATE,
      profile: { displayName: 'Safe Protected User', targetExam: 'Safe Exam' },
      subjects: [
        { id: 'sub-safe-1', code: 'CS100', name: 'Protected Subject', attended: 10, totalConducted: 10, targetPct: 75, color: '#333' },
      ],
      tasks: [
        { id: 'task-safe-1', title: 'Protected Task', status: 'todo', priority: 'high', createdAt: '2026-10-20T00:00:00Z' },
      ],
    };
    storageService.saveData(existingData);

    // Case A: Syntax error (invalid JSON)
    expect(() => {
      storageService.importBackup('This is not json at all {]');
    }).toThrow(/Invalid backup file format/i);

    const stateAfterSyntaxError = storageService.loadData();
    expect(stateAfterSyntaxError.profile?.displayName).toBe('Safe Protected User');
    expect(stateAfterSyntaxError.subjects).toHaveLength(1);
    expect(stateAfterSyntaxError.tasks).toHaveLength(1);

    // Case B: Non-Tracker JSON object
    expect(() => {
      storageService.importBackup(JSON.stringify({ someUnrelatedApp: 1234, randomKey: 'hello' }));
    }).toThrow(/Invalid backup file format/i);

    const stateAfterBadStructure = storageService.loadData();
    expect(stateAfterBadStructure.profile?.displayName).toBe('Safe Protected User');
    expect(stateAfterBadStructure.subjects).toHaveLength(1);
    expect(stateAfterBadStructure.tasks).toHaveLength(1);

    // Case C: JSON array instead of object
    expect(() => {
      storageService.importBackup(JSON.stringify(['array', 'of', 'items']));
    }).toThrow(/Invalid backup file format/i);

    const stateAfterArray = storageService.loadData();
    expect(stateAfterArray.profile?.displayName).toBe('Safe Protected User');
    expect(stateAfterArray.subjects).toHaveLength(1);
    expect(stateAfterArray.tasks).toHaveLength(1);
  });
});
