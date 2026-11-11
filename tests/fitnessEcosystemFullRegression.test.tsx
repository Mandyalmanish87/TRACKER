import { describe, it, expect, beforeEach } from 'vitest';
import BUILTIN_EXERCISES from '../src/data/exerciseLibrary.json';
import {
  calculateEstimated1RM,
  calculateWorkingVolume,
  evaluatePersonalRecords,
  detectSessionPRs,
} from '../src/utils/progressiveOverload';
import {
  lookupBarcode,
} from '../src/utils/barcodeEngine';
import {
  aggregateMicronutrients,
  convertRawCookedWeight,
  calculateEmpiricalTDEE,
} from '../src/utils/smartNutritionEngine';
import {
  calculateNavyBodyComposition,
} from '../src/utils/bodyComposition';
import {
  calculateSleepDurationMinutes,
  calculateDailyReadiness,
} from '../src/utils/readinessEngine';
import {
  findOptimalWorkoutWindows,
  evaluateExamDeloadStatus,
} from '../src/utils/timetableFitnessSynergy';
import {
  adaptLegacyWorkout,
  adaptSessionToLegacy,
} from '../src/utils/fitnessAdapters';
import type {
  WorkoutSession,
  FoodDiaryEntry,
  WeightLogEntry,
  TimetableSlot,
} from '../src/types';

describe('Fitness Ecosystem Full Regression & Calculation Suite', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('1. Exercise Library (150+ Offline Movements)', () => {
    it('contains at least 150 curated offline exercises with complete metadata', () => {
      expect(Array.isArray(BUILTIN_EXERCISES)).toBe(true);
      expect(BUILTIN_EXERCISES.length).toBeGreaterThanOrEqual(150);

      const bench = BUILTIN_EXERCISES.find((e) => e.id === 'ex-barbell-bench-press');
      expect(bench).toBeDefined();
      expect(bench?.primaryMuscle).toBe('chest');
      expect(bench?.equipment).toBe('barbell');
      expect(bench?.coachingCues.length).toBeGreaterThan(0);
      expect(bench?.commonMistakes.length).toBeGreaterThan(0);
      expect(bench?.recommendedRepRange.min).toBeGreaterThan(0);
    });

    it('covers major muscle groups across chest, back, quads, hamstrings, and delts', () => {
      const muscles = new Set(BUILTIN_EXERCISES.map((e) => e.primaryMuscle));
      expect(muscles.has('chest')).toBe(true);
      expect(muscles.has('upper_back')).toBe(true);
      expect(muscles.has('lats')).toBe(true);
      expect(muscles.has('quads')).toBe(true);
      expect(muscles.has('hamstrings')).toBe(true);
      expect(muscles.has('side_delts')).toBe(true);
      expect(muscles.has('biceps')).toBe(true);
      expect(muscles.has('triceps')).toBe(true);
    });
  });

  describe('2. Progressive Overload & 1RM Calculations', () => {
    it('calculates 1RM accurately using Brzycki for <= 12 reps', () => {
      // 100kg for 1 rep = 100kg
      const single = calculateEstimated1RM(100, 1);
      expect(single.estimated1RMKg).toBe(100);
      expect(single.formula).toBe('exact');

      // 100kg for 10 reps: Brzycki = 100 * (36 / (37 - 10)) = 100 * (36/27) = 133.3kg
      const tenReps = calculateEstimated1RM(100, 10);
      expect(tenReps.estimated1RMKg).toBe(133.3);
      expect(tenReps.formula).toBe('brzycki');
    });

    it('calculates 1RM using Epley for > 12 reps', () => {
      // 80kg for 15 reps: Epley = 80 * (1 + 15/30) = 80 * 1.5 = 120kg
      const highReps = calculateEstimated1RM(80, 15);
      expect(highReps.estimated1RMKg).toBe(120);
      expect(highReps.formula).toBe('epley');
    });

    it('calculates working volume excluding warmup sets', () => {
      const session: WorkoutSession = {
        id: 'sess-1',
        date: '2026-11-02',
        splitName: 'Push Day',
        completed: true,
        createdAt: '2026-11-02T10:00:00Z',
        updatedAt: '2026-11-02T11:00:00Z',
        exercises: [
          {
            id: 'we-1',
            exerciseId: 'ex-barbell-bench-press',
            exerciseName: 'Barbell Bench Press',
            order: 1,
            sets: [
              { id: 's1', setNumber: 1, type: 'warmup', actualWeightKg: 20, actualReps: 10, completed: true },
              { id: 's2', setNumber: 2, type: 'warmup', actualWeightKg: 40, actualReps: 5, completed: true },
              { id: 's3', setNumber: 3, type: 'working', actualWeightKg: 80, actualReps: 8, completed: true }, // 640kg
              { id: 's4', setNumber: 4, type: 'working', actualWeightKg: 80, actualReps: 8, completed: true }, // 640kg
              { id: 's5', setNumber: 5, type: 'drop', actualWeightKg: 60, actualReps: 10, completed: true },   // 600kg
            ],
          },
        ],
      };

      // Warmup sets (20*10=200, 40*5=200) MUST be excluded! Working = 640 + 640 + 600 = 1880
      const volume = calculateWorkingVolume(session);
      expect(volume).toBe(1880);
    });

    it('detects Personal Records against historical sessions', () => {
      const historical: WorkoutSession[] = [
        {
          id: 'past-sess',
          date: '2026-10-20',
          splitName: 'Push',
          completed: true,
          createdAt: '2026-10-20T10:00:00Z',
          updatedAt: '2026-10-20T11:00:00Z',
          exercises: [
            {
              id: 'ex-1',
              exerciseId: 'ex-barbell-bench-press',
              exerciseName: 'Barbell Bench Press',
              order: 1,
              sets: [
                { id: 's1', setNumber: 1, type: 'working', actualWeightKg: 80, actualReps: 8, completed: true },
              ],
            },
          ],
        },
      ];

      // New PR: 85kg for 8 reps
      const newPrSet = { id: 's2', setNumber: 1, type: 'working' as const, actualWeightKg: 85, actualReps: 8, completed: true };
      const status = evaluatePersonalRecords('ex-barbell-bench-press', newPrSet, historical);
      expect(status.isNewWeightPR).toBe(true);
      expect(status.previousMaxWeightKg).toBe(80);

      // Session PR detector tags sets
      const taggedExercises = detectSessionPRs(
        [
          {
            id: 'we-new',
            exerciseId: 'ex-barbell-bench-press',
            exerciseName: 'Barbell Bench Press',
            order: 1,
            sets: [newPrSet],
          },
        ],
        historical
      );
      expect(taggedExercises[0].sets[0].isPersonalRecord).toBe(true);
    });
  });

  describe('3. Advanced Nutrition, Raw/Cooked & Offline Barcode Engine', () => {
    it('looks up packaged food items from offline barcode database without network', () => {
      // Amul Lassi
      const result = lookupBarcode('8901233024011');
      expect(result.found).toBe(true);
      expect(result.foodName).toContain('Amul');
      expect(result.protein).toBeGreaterThan(0);
    });

    it('supports custom user barcode mappings', () => {
      const customMappings = [
        {
          id: 'cm-1',
          barcode: '999988887777',
          foodId: 'food-my-shake',
          brand: 'Homemade',
          verified: true,
          createdAt: '2026-11-02T12:00:00Z',
        },
      ];

      const result = lookupBarcode('999988887777', customMappings, [
        {
          id: 'food-my-shake',
          name: 'Super High Calorie Oats Shake',
          category: 'Custom',
          servingSize: 1,
          servingUnit: 'serving',
          calories: 650,
          protein: 45,
          carbs: 85,
          fat: 15,
        },
      ]);

      expect(result.found).toBe(true);
      expect(result.foodName).toBe('Super High Calorie Oats Shake');
      expect(result.calories).toBe(650);
      expect(result.isCustomMapping).toBe(true);
    });

    it('converts raw vs cooked food weights accurately', () => {
      // Raw rice -> Cooked rice (yield factor 2.5): 100g raw yields 250g cooked
      const cookedRice = convertRawCookedWeight(100, 'raw_to_cooked', 'rice_white');
      expect(cookedRice.convertedGrams).toBe(250);

      // Cooked chicken breast -> Raw chicken (yield factor 0.75): 150g cooked required 200g raw
      const rawChicken = convertRawCookedWeight(150, 'cooked_to_raw', 'chicken_breast');
      expect(rawChicken.convertedGrams).toBe(200);
    });

    it('preserves Unknown status for foods missing micronutrient data without reporting false zero', () => {
      const entries: FoodDiaryEntry[] = [
        {
          id: 'fd-1',
          date: '2026-11-02',
          mealType: 'lunch',
          name: 'Campus Canteen Thali',
          quantity: 1,
          servingUnit: 'serving',
          calories: 700,
          protein: 22,
          carbs: 95,
          fat: 26,
          lastEditedAt: '2026-11-02T13:00:00Z',
          // micronutrients is undefined!
        },
      ];

      const summary = aggregateMicronutrients(entries);
      const vitaminD = summary.vitaminsAndMinerals['Vitamin D'];
      expect(vitaminD).toBeDefined();
      expect(vitaminD.knownEntriesCount).toBe(0);
      expect(vitaminD.status).toBe('insufficient_data');
    });

    it('calculates empirical TDEE from scale weight changes and calorie logs', () => {
      const dailyCalories = [
        { date: '2026-10-01', calories: 2500 },
        { date: '2026-10-05', calories: 2500 },
        { date: '2026-10-10', calories: 2500 },
        { date: '2026-10-15', calories: 2500 },
        { date: '2026-10-20', calories: 2500 },
        { date: '2026-10-25', calories: 2500 },
        { date: '2026-10-30', calories: 2500 },
      ];
      // 1 kg lost over 30 days = 7700 kcal deficit / 30 = ~256 kcal deficit/day
      // Empirical TDEE = 2500 + 257 = ~2757 kcal
      const weightLogs: WeightLogEntry[] = [
        { id: 'w1', date: '2026-10-01', weightKg: 80 },
        { id: 'w2', date: '2026-10-30', weightKg: 79 },
      ];

      const tdee = calculateEmpiricalTDEE(dailyCalories, weightLogs);
      expect(tdee).not.toBeNull();
      expect(tdee?.empiricalTdee).toBeGreaterThan(2600);
      expect(tdee?.empiricalTdee).toBeLessThan(2900);
    });
  });

  describe('4. Body Composition & Navy Anthropometric Formulas', () => {
    it('calculates male body fat percentage via Navy formula', () => {
      // 178cm height, 80kg weight, 82cm waist, 38cm neck
      const res = calculateNavyBodyComposition({
        sex: 'male',
        heightCm: 178,
        weightKg: 80,
        waistCm: 82,
        neckCm: 38,
      });

      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.bodyFatPercentage).toBeGreaterThan(10);
        expect(res.data.bodyFatPercentage).toBeLessThan(18);
        expect(res.data.leanMassKg).toBeGreaterThan(60);
        expect(res.data.waistToHeightRatio).toBeCloseTo(82 / 178, 2);
      }
    });

    it('calculates female body fat percentage including hips circumference', () => {
      // 165cm height, 60kg weight, 70cm waist, 32cm neck, 95cm hips
      const res = calculateNavyBodyComposition({
        sex: 'female',
        heightCm: 165,
        weightKg: 60,
        waistCm: 70,
        neckCm: 32,
        hipsCm: 95,
      });

      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.bodyFatPercentage).toBeGreaterThan(18);
        expect(res.data.bodyFatPercentage).toBeLessThan(28);
      }
    });
  });

  describe('5. Recovery, Sleep & Cross-Midnight Engine', () => {
    it('calculates sleep duration crossing midnight boundary', () => {
      // 23:00 to 07:30 = 8.5 hours (510 minutes)
      const minutes = calculateSleepDurationMinutes('23:00', '07:30');
      expect(minutes).toBe(510);

      // Same-day sleep: 01:00 to 09:00 = 8.0 hours (480 minutes)
      const sameDay = calculateSleepDurationMinutes('01:00', '09:00');
      expect(sameDay).toBe(480);
    });

    it('determines holistic 0-100 Daily Readiness Index', () => {
      const evaluation = calculateDailyReadiness({
        id: 'rec-1',
        date: '2026-11-02',
        bedTime: '23:00',
        wakeTime: '07:30',
        sleepDurationMinutes: 510,
        sleepQualityRating: 5,
        energyLevel: 5,
        stressLevel: 1,
        muscleSorenessMap: {},
        estimatedReadinessScore: 0,
        createdAt: '2026-11-02T08:00:00Z',
      });

      expect(evaluation.readinessScore).toBeGreaterThanOrEqual(85);
      expect(evaluation.tier).toBe('optimal');
    });
  });

  describe('6. Timetable & Academic Fitness Synergy', () => {
    it('identifies free workout windows >= 60 min between lectures', () => {
      const slots: TimetableSlot[] = [
        { id: 't1', dayOfWeek: 3, startTime: '09:00', endTime: '10:15', subjectId: 's-math' },
        { id: 't2', dayOfWeek: 3, startTime: '12:00', endTime: '13:15', subjectId: 's-physics' },
      ];

      // Free window between 10:15 and 12:00 = 105 minutes
      const windows = findOptimalWorkoutWindows(slots, 60);
      expect(windows.length).toBeGreaterThan(0);
      expect(windows[0].durationMinutes).toBe(105);
      expect(windows[0].startTime).toBe('10:15');
      expect(windows[0].endTime).toBe('12:00');
    });

    it('recommends exam deload within 7 days of final exam', () => {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + 4);
      const examDate = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`;
      const deload = evaluateExamDeloadStatus(examDate);
      expect(deload.isExamSoon).toBe(true);
      expect(deload.daysRemaining).toBe(4);
      expect(deload.recommendation).toContain('Reduce training volume');
    });
  });

  describe('7. Bidirectional Legacy Synchronization', () => {
    it('converts WorkoutSession to GymWorkout with exact fidelity', () => {
      const session: WorkoutSession = {
        id: 'sess-sync-1',
        date: '2026-11-02',
        splitName: 'Legs & Core',
        completed: true,
        durationMinutes: 60,
        notes: 'Heavy squat session',
        createdAt: '2026-11-02T10:00:00Z',
        updatedAt: '2026-11-02T11:00:00Z',
        exercises: [
          {
            id: 'we-1',
            exerciseId: 'ex-barbell-back-squat',
            exerciseName: 'Barbell Back Squat',
            order: 1,
            sets: [
              { id: 's1', setNumber: 1, type: 'working', actualWeightKg: 100, actualReps: 5, completed: true },
            ],
          },
        ],
      };

      const legacy = adaptSessionToLegacy(session);
      expect(legacy.id).toBe('sess-sync-1');
      expect(legacy.split).toBe('Legs & Core');
      expect(legacy.completed).toBe(true);
      expect(legacy.exercises[0].name).toBe('Barbell Back Squat');
      expect(legacy.exercises[0].sets[0].weightKg).toBe(100);
      expect(legacy.exercises[0].sets[0].reps).toBe(5);

      // And converts back
      const restored = adaptLegacyWorkout(legacy);
      expect(restored.id).toBe(session.id);
      expect(restored.splitName).toBe(session.splitName);
      expect(restored.exercises[0].sets[0].actualWeightKg).toBe(100);
    });
  });
});

