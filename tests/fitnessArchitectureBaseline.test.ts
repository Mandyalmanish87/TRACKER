import { describe, it, expect, beforeEach } from 'vitest';
import {
  adaptLegacyWorkout,
  adaptSessionToLegacy,
  adaptLegacyWorkoutsToSessions,
  adaptSessionsToLegacyWorkouts,
  slugifyExerciseName,
} from '../src/utils/fitnessAdapters';
import { storageService, sanitizeEntityArray } from '../src/services/storage';
import { cloudSyncService } from '../src/services/cloudSyncService';
import { DEFAULT_STATE } from '../src/services/defaults';
import type { GymWorkout, AppStateData } from '../src/types';

describe('Fitness Ecosystem Milestone 00: Architecture Baseline & Safety Suite', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('1. Backward Compatibility Adapters (GymWorkout <-> WorkoutSession)', () => {
    const legacyWorkout: GymWorkout = {
      id: 'gym-legacy-1',
      date: '2026-11-02',
      split: 'Push Day (Chest, Shoulders, Triceps)',
      completed: true,
      durationMinutes: 55,
      notes: 'Focus on slow eccentric tempo on incline dumbells',
      isSample: false,
      exercises: [
        {
          name: 'Incline Dumbbell Press',
          sets: [
            { reps: 10, weightKg: 28, completed: true },
            { reps: 10, weightKg: 28, completed: true },
            { reps: 8, weightKg: 30, completed: true },
          ],
        },
        {
          name: 'Overhead Press',
          sets: [
            { reps: 8, weightKg: 45, completed: true },
            { reps: 6, weightKg: 45, completed: false },
          ],
        },
      ],
    };

    it('converts a legacy GymWorkout into a WorkoutSession without data loss', () => {
      const session = adaptLegacyWorkout(legacyWorkout);

      expect(session.id).toBe('gym-legacy-1');
      expect(session.date).toBe('2026-11-02');
      expect(session.splitName).toBe('Push Day (Chest, Shoulders, Triceps)');
      expect(session.completed).toBe(true);
      expect(session.durationMinutes).toBe(55);
      expect(session.notes).toBe('Focus on slow eccentric tempo on incline dumbells');
      expect(session.isSample).toBe(false);

      expect(session.exercises).toHaveLength(2);
      expect(session.exercises[0].exerciseName).toBe('Incline Dumbbell Press');
      expect(session.exercises[0].exerciseId).toBe('ex-incline-dumbbell-press');
      expect(session.exercises[0].order).toBe(1);
      expect(session.exercises[0].sets).toHaveLength(3);
      expect(session.exercises[0].sets[0].actualWeightKg).toBe(28);
      expect(session.exercises[0].sets[0].actualReps).toBe(10);
      expect(session.exercises[0].sets[0].type).toBe('working');
      expect(session.exercises[0].sets[0].completed).toBe(true);

      expect(session.exercises[1].exerciseName).toBe('Overhead Press');
      expect(session.exercises[1].sets[1].completed).toBe(false);
    });

    it('converts a modern WorkoutSession back to a legacy GymWorkout with identical structure', () => {
      const session = adaptLegacyWorkout(legacyWorkout);
      const restoredLegacy = adaptSessionToLegacy(session);

      expect(restoredLegacy.id).toBe(legacyWorkout.id);
      expect(restoredLegacy.date).toBe(legacyWorkout.date);
      expect(restoredLegacy.split).toBe(legacyWorkout.split);
      expect(restoredLegacy.completed).toBe(legacyWorkout.completed);
      expect(restoredLegacy.durationMinutes).toBe(legacyWorkout.durationMinutes);
      expect(restoredLegacy.notes).toBe(legacyWorkout.notes);

      expect(restoredLegacy.exercises).toHaveLength(2);
      expect(restoredLegacy.exercises[0].name).toBe('Incline Dumbbell Press');
      expect(restoredLegacy.exercises[0].sets).toEqual(legacyWorkout.exercises[0].sets);
      expect(restoredLegacy.exercises[1].sets).toEqual(legacyWorkout.exercises[1].sets);
    });

    it('handles missing or undefined optional fields in legacy workouts gracefully', () => {
      const minimalLegacy: GymWorkout = {
        id: '',
        date: '',
        split: '',
        completed: false,
        exercises: [
          {
            name: '',
            sets: [{ reps: 0, weightKg: 0, completed: false }],
          },
        ],
      };

      const session = adaptLegacyWorkout(minimalLegacy);
      expect(session.id).toMatch(/^session-/);
      expect(session.splitName).toBe('Custom Split');
      expect(session.durationMinutes).toBeUndefined();
      expect(session.notes).toBeUndefined();
      expect(session.exercises[0].exerciseName).toBe('Unnamed Exercise');
      expect(session.exercises[0].exerciseId).toBe('ex-custom');
      expect(session.exercises[0].sets[0].actualReps).toBe(0);

      const roundTripped = adaptSessionToLegacy(session);
      expect(roundTripped.split).toBe('Custom Split');
      expect(roundTripped.durationMinutes).toBeUndefined();
      expect(roundTripped.notes).toBeUndefined();
    });

    it('preserves custom timestamps when converting legacy workout with timestamps', () => {
      const legacyWithTime: GymWorkout = {
        id: 'legacy-timed-1',
        date: '2026-11-01',
        split: 'Arm Day',
        completed: true,
        exercises: [],
        createdAt: '2026-11-01T08:00:00.000Z',
        updatedAt: '2026-11-01T08:45:00.000Z',
      };

      const session = adaptLegacyWorkout(legacyWithTime);
      expect(session.createdAt).toBe('2026-11-01T08:00:00.000Z');
      expect(session.updatedAt).toBe('2026-11-01T08:45:00.000Z');

      const restored = adaptSessionToLegacy(session);
      expect(restored.createdAt).toBe('2026-11-01T08:00:00.000Z');
      expect(restored.updatedAt).toBe('2026-11-01T08:45:00.000Z');
    });

    it('batch converts arrays of workouts bidirectionally and safely handles empty input', () => {
      expect(adaptLegacyWorkoutsToSessions([])).toEqual([]);
      expect(adaptSessionsToLegacyWorkouts([])).toEqual([]);
      expect(adaptLegacyWorkoutsToSessions(null as any)).toEqual([]);
      expect(adaptSessionsToLegacyWorkouts(undefined as any)).toEqual([]);

      const sessions = adaptLegacyWorkoutsToSessions([legacyWorkout]);
      expect(sessions).toHaveLength(1);
      const roundTripped = adaptSessionsToLegacyWorkouts(sessions);
      expect(roundTripped).toHaveLength(1);
      expect(roundTripped[0].id).toBe(legacyWorkout.id);
    });

    it('slugifies exercise names deterministically', () => {
      expect(slugifyExerciseName('Barbell Bench Press')).toBe('ex-barbell-bench-press');
      expect(slugifyExerciseName('Dumbbell Lateral Raise (Cable / DB)')).toBe('ex-dumbbell-lateral-raise-cable-db');
      expect(slugifyExerciseName('')).toBe('ex-custom');
      expect(slugifyExerciseName(null as any)).toBe('ex-unknown');
    });
  });

  describe('2. Storage Sanitization & State Migration', () => {
    it('loadData() initializes all new fitness collections as arrays when absent from stored JSON', () => {
      // Simulate existing legacy v2 data in localStorage that knows nothing about Fitness Ecosystem
      const legacySavedData = {
        schemaVersion: 2,
        hasSampleData: false,
        subjects: [],
        timetable: [],
        attendanceLogs: [],
        studySessions: [],
        gymWorkouts: [],
        reminders: [],
        foodDiaryEntries: [],
        customFoods: [],
        recipes: [],
        weightLogs: [],
        // Notice: workoutSessions, mealPlans, bodyMeasurements etc. are completely undefined
      };

      localStorage.setItem('tracker_app_data', JSON.stringify(legacySavedData));
      const loaded = storageService.loadData();

      // Invariant: no collection is undefined; all are initialized to valid arrays
      expect(Array.isArray(loaded.workoutSessions)).toBe(true);
      expect(Array.isArray(loaded.workoutPrograms)).toBe(true);
      expect(Array.isArray(loaded.workoutTemplates)).toBe(true);
      expect(Array.isArray(loaded.exerciseLibrary)).toBe(true);
      expect(Array.isArray(loaded.customBarcodes)).toBe(true);
      expect(Array.isArray(loaded.mealPlans)).toBe(true);
      expect(Array.isArray(loaded.bodyMeasurements)).toBe(true);
      expect(Array.isArray(loaded.bodyCompositions)).toBe(true);
      expect(Array.isArray(loaded.progressPhotos)).toBe(true);
      expect(Array.isArray(loaded.sleepRecoveryLogs)).toBe(true);
      expect(Array.isArray(loaded.cardioSessions)).toBe(true);
      expect(Array.isArray(loaded.hydrationLogs)).toBe(true);
      expect(Array.isArray(loaded.fitnessInsights)).toBe(true);
    });

    it('clearSampleData() removes sample fitness entries while strictly preserving real user data', () => {
      const stateWithMix: AppStateData = {
        ...DEFAULT_STATE,
        gymWorkouts: [
          { id: 'gw-user-1', date: '2026-11-02', split: 'Push Day', completed: true, exercises: [] },
          { id: 'gym-today', date: '2026-11-02', split: 'Sample Demo Split', completed: false, isSample: true, exercises: [] },
        ],
        workoutSessions: [
          {
            id: 'ws-user-real',
            date: '2026-11-02',
            splitName: 'Real Push Session',
            completed: true,
            isSample: false,
            exercises: [],
            createdAt: '',
            updatedAt: '',
          },
          {
            id: 'ws-sample-1',
            date: '2026-11-01',
            splitName: 'Demo Session',
            completed: false,
            isSample: true,
            exercises: [],
            createdAt: '',
            updatedAt: '',
          },
        ],
        foodDiaryEntries: [
          {
            id: 'fde-real-1',
            date: '2026-11-02',
            mealType: 'breakfast',
            name: 'Oats & Milk',
            quantity: 1,
            servingUnit: 'serving',
            calories: 300,
            protein: 15,
            carbs: 45,
            fat: 5,
            lastEditedAt: '',
            isSample: false,
          },
        ],
        bodyMeasurements: [
          { id: 'bm-real-1', date: '2026-11-02', weightKg: 75.5, waistCm: 82, createdAt: '' },
        ],
        sleepRecoveryLogs: [
          {
            id: 'sr-real-1',
            date: '2026-11-02',
            sleepDurationMinutes: 480,
            bedTime: '23:00',
            wakeTime: '07:00',
            sleepQualityRating: 4,
            energyLevel: 4,
            stressLevel: 2,
            muscleSorenessMap: {},
            estimatedReadinessScore: 85,
            createdAt: '',
          },
        ],
      };

      const cleaned = storageService.clearSampleData(stateWithMix);

      // Real entries preserved
      expect(cleaned.gymWorkouts).toHaveLength(1);
      expect(cleaned.gymWorkouts[0].id).toBe('gw-user-1');

      expect(cleaned.workoutSessions).toHaveLength(1);
      expect(cleaned.workoutSessions![0].id).toBe('ws-user-real');

      expect(cleaned.foodDiaryEntries).toHaveLength(1);
      expect(cleaned.foodDiaryEntries![0].id).toBe('fde-real-1');

      expect(cleaned.bodyMeasurements).toHaveLength(1);
      expect(cleaned.bodyMeasurements![0].id).toBe('bm-real-1');

      expect(cleaned.sleepRecoveryLogs).toHaveLength(1);
      expect(cleaned.sleepRecoveryLogs![0].id).toBe('sr-real-1');

      // Sample data flag turned off
      expect(cleaned.hasSampleData).toBe(false);
    });

    it('sanitizeEntityArray() filters malformed items without throwing', () => {
      const corrupted = [
        null,
        undefined,
        42,
        'string',
        {},
        { id: '' },
        { id: '   ' },
        { id: 'valid-item-1', name: 'Item 1' },
      ];

      const sanitized = sanitizeEntityArray<{ id: string; name?: string }>(corrupted);
      expect(sanitized).toHaveLength(1);
      expect(sanitized[0].id).toBe('valid-item-1');
    });

    it('importBackup() and exportBackup() roundtrip fitness collections cleanly', () => {
      const customState: AppStateData = {
        ...DEFAULT_STATE,
        bodyMeasurements: [
          { id: 'bm-test-1', date: '2026-11-01', weightKg: 74.0, waistCm: 80, createdAt: '' },
        ],
        cardioSessions: [
          {
            id: 'cs-test-1',
            date: '2026-11-01',
            cardioType: 'running',
            durationMinutes: 30,
            distanceKm: 5,
            calorieCalculationSource: 'pace_weight_formula',
            createdAt: '',
          },
        ],
      };

      const exportedJson = storageService.exportBackup(customState);
      const importedState = storageService.importBackup(exportedJson);

      expect(importedState.bodyMeasurements).toHaveLength(1);
      expect(importedState.bodyMeasurements![0].id).toBe('bm-test-1');
      expect(importedState.cardioSessions).toHaveLength(1);
      expect(importedState.cardioSessions![0].id).toBe('cs-test-1');
    });
  });

  describe('3. Cloud Sync Integration Safety', () => {
    it('cloudSyncService.mergeData() merges fitness collections between local and cloud without data loss', () => {
      const localState: AppStateData = {
        ...DEFAULT_STATE,
        workoutSessions: [
          {
            id: 'session-local-1',
            date: '2026-11-02',
            splitName: 'Chest & Arms',
            completed: true,
            exercises: [],
            createdAt: '2026-11-02T10:00:00Z',
            updatedAt: '2026-11-02T10:00:00Z',
          },
        ],
        bodyMeasurements: [
          { id: 'bm-local-1', date: '2026-11-02', weightKg: 75, waistCm: 81, createdAt: '' },
        ],
      };

      const cloudState: AppStateData = {
        ...DEFAULT_STATE,
        workoutSessions: [
          {
            id: 'session-cloud-2',
            date: '2026-11-01',
            splitName: 'Leg Day',
            completed: true,
            exercises: [],
            createdAt: '2026-11-01T10:00:00Z',
            updatedAt: '2026-11-01T10:00:00Z',
          },
        ],
        bodyMeasurements: [
          { id: 'bm-cloud-2', date: '2026-10-25', weightKg: 76, waistCm: 82, createdAt: '' },
        ],
      };

      const merged = cloudSyncService.mergeDatasets(localState, cloudState);

      // Both local and cloud workouts are preserved
      expect(merged.workoutSessions).toHaveLength(2);
      expect(merged.workoutSessions?.some((w) => w.id === 'session-local-1')).toBe(true);
      expect(merged.workoutSessions?.some((w) => w.id === 'session-cloud-2')).toBe(true);

      // Both measurements preserved
      expect(merged.bodyMeasurements).toHaveLength(2);
      expect(merged.bodyMeasurements?.some((m) => m.id === 'bm-local-1')).toBe(true);
      expect(merged.bodyMeasurements?.some((m) => m.id === 'bm-cloud-2')).toBe(true);
    });

    it('cloudSyncService.mergeDatasets() applies per-record last-write-wins when two offline devices edit the same workout with different timestamps while preserving non-conflicting additions and honoring tombstones', () => {
      const deviceAState: AppStateData = {
        ...DEFAULT_STATE,
        workoutSessions: [
          {
            id: 'session-shared-1',
            date: '2026-11-02',
            splitName: 'Upper Body',
            completed: true,
            notes: 'Device A notes - earlier edit',
            exercises: [],
            createdAt: '2026-11-02T09:00:00.000Z',
            updatedAt: '2026-11-02T10:00:00.000Z',
          },
          {
            id: 'session-device-a-unique',
            date: '2026-11-02',
            splitName: 'Device A Only Split',
            completed: true,
            exercises: [],
            createdAt: '2026-11-02T10:05:00.000Z',
            updatedAt: '2026-11-02T10:05:00.000Z',
          },
          {
            id: 'session-to-delete',
            date: '2026-11-02',
            splitName: 'Old Session',
            completed: false,
            exercises: [],
            createdAt: '2026-11-02T08:00:00.000Z',
            updatedAt: '2026-11-02T08:00:00.000Z',
          },
        ],
        tombstones: [],
      };

      const deviceBState: AppStateData = {
        ...DEFAULT_STATE,
        workoutSessions: [
          {
            id: 'session-shared-1',
            date: '2026-11-02',
            splitName: 'Upper Body',
            completed: true,
            notes: 'Device B notes - LATEST EDIT WINS',
            exercises: [],
            createdAt: '2026-11-02T09:00:00.000Z',
            updatedAt: '2026-11-02T10:30:00.000Z', // Newer than Device A
          },
          {
            id: 'session-device-b-unique',
            date: '2026-11-02',
            splitName: 'Device B Only Split',
            completed: true,
            exercises: [],
            createdAt: '2026-11-02T10:15:00.000Z',
            updatedAt: '2026-11-02T10:15:00.000Z',
          },
        ],
        tombstones: [
          {
            id: 'session-to-delete',
            collection: 'workoutSessions',
            deletedAt: '2026-11-02T09:30:00.000Z', // Deleted after Device A created it at 08:00
          },
        ],
      };

      const merged = cloudSyncService.mergeDatasets(deviceAState, deviceBState);

      // 1. Non-conflicting additions from both devices are preserved
      expect(merged.workoutSessions?.some((s) => s.id === 'session-device-a-unique')).toBe(true);
      expect(merged.workoutSessions?.some((s) => s.id === 'session-device-b-unique')).toBe(true);

      // 2. Conflicting record resolved by per-record last-write-wins (Device B wins)
      const shared = merged.workoutSessions?.find((s) => s.id === 'session-shared-1');
      expect(shared).toBeDefined();
      expect(shared?.notes).toBe('Device B notes - LATEST EDIT WINS');
      expect(shared?.updatedAt).toBe('2026-11-02T10:30:00.000Z');

      // 3. Deleted record is properly filtered out by tombstone
      expect(merged.workoutSessions?.some((s) => s.id === 'session-to-delete')).toBe(false);
      expect(merged.workoutSessions).toHaveLength(3); // shared, device A unique, device B unique
    });
  });

  describe('4. Legacy Academic State Non-Regression', () => {
    it('storageService.loadData() preserves all legacy academic state (subjects, timetable, attendance) exactly as stored when migrating legacy JSON', () => {
      const legacyState = {
        schemaVersion: 2,
        hasSampleData: false,
        profile: {
          displayName: 'Academic Scholar',
          targetExam: 'Engineering Final 2026',
        },
        subjects: [
          {
            id: 'sub-math-1',
            code: 'MATH101',
            name: 'Linear Algebra',
            totalConducted: 20,
            attended: 18,
            color: 'terracotta',
            targetPct: 75,
            isSample: false,
          },
        ],
        timetable: [
          {
            id: 'tt-slot-1',
            dayOfWeek: 1,
            subjectId: 'sub-math-1',
            startTime: '09:00',
            endTime: '10:00',
            room: 'Hall A',
          },
        ],
        attendanceLogs: [
          {
            id: 'att-log-1',
            subjectId: 'sub-math-1',
            slotId: 'tt-slot-1',
            date: '2026-11-02',
            status: 'present',
            timestamp: '2026-11-02T09:05:00.000Z',
          },
        ],
        gymWorkouts: [
          {
            id: 'gw-legacy-1',
            date: '2026-11-02',
            split: 'Legs',
            completed: true,
            exercises: [],
          },
        ],
      };

      localStorage.setItem('tracker_app_data_v2', JSON.stringify(legacyState));

      const loaded = storageService.loadData();

      // Legacy academic data intact
      expect(loaded.subjects).toHaveLength(1);
      expect(loaded.subjects[0].id).toBe('sub-math-1');
      expect(loaded.subjects[0].name).toBe('Linear Algebra');
      expect(loaded.subjects[0].attended).toBe(18);

      expect(loaded.timetable).toHaveLength(1);
      expect(loaded.timetable[0].subjectId).toBe('sub-math-1');

      expect(loaded.attendanceLogs).toHaveLength(1);
      expect(loaded.attendanceLogs[0].status).toBe('present');

      expect(loaded.gymWorkouts).toHaveLength(1);
      expect(loaded.gymWorkouts[0].split).toBe('Legs');

      // Fitness collections cleanly initialized without crashing
      expect(loaded.workoutSessions).toEqual([]);
      expect(loaded.workoutPrograms).toEqual([]);
      expect(loaded.mealPlans).toEqual([]);
      expect(loaded.bodyMeasurements).toEqual([]);

      // Test re-saving and re-loading
      storageService.saveData(loaded);
      const reloaded = storageService.loadData();
      expect(reloaded.subjects[0].name).toBe('Linear Algebra');
      expect(reloaded.workoutSessions).toEqual([]);
    });
  });
});
