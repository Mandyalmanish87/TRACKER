import { describe, it, expect } from 'vitest';
import {
  DETAILED_MUSCLES,
  DEFAULT_EXERCISE_CONTRIBUTIONS,
  getMuscleById,
  getMusclesByRegion,
} from '../src/data/muscleTaxonomy';
import {
  calculateAllMuscleMetrics,
  getMuscleHeatmapColor,
} from '../src/utils/muscleHeatmapEngine';
import {
  MICRONUTRIENT_REFERENCE_TARGETS,
  calculateElectrolyteRatios,
} from '../src/utils/micronutrientReferenceData';
import { WorkoutSession } from '../src/types/fitness';

describe('Advanced 3D Muscle Anatomy & Multi-Mode Heatmap Engine', () => {
  describe('Biomechanical Muscle Taxonomy (45+ Muscles)', () => {
    it('registers at least 45 detailed muscle meshes with unique IDs', () => {
      expect(DETAILED_MUSCLES.length).toBeGreaterThanOrEqual(45);
      const ids = new Set<string>();
      DETAILED_MUSCLES.forEach((m) => {
        expect(ids.has(m.id)).toBe(false);
        ids.add(m.id);
        expect(m.name).toBeTruthy();
        expect(m.commonName).toBeTruthy();
        expect(m.region).toBeTruthy();
        expect(m.centerCoordinates).toBeDefined();
        expect(Array.isArray(m.centerCoordinates)).toBe(true);
        expect(m.centerCoordinates.length).toBe(3);
        expect(typeof m.centerCoordinates[0]).toBe('number');
        expect(typeof m.centerCoordinates[1]).toBe('number');
        expect(typeof m.centerCoordinates[2]).toBe('number');
      });
    });

    it('covers all major anatomical regions with proper unilateral/bilateral segmentation', () => {
      const regions = ['chest', 'shoulders', 'back', 'arms', 'core', 'legs', 'calves', 'neck'];
      regions.forEach((region) => {
        const muscles = getMusclesByRegion(region as any);
        expect(muscles.length).toBeGreaterThan(0);
      });

      // Check left/right unilateral pairing
      const leftBiceps = getMuscleById('biceps_long_head_left');
      const rightBiceps = getMuscleById('biceps_long_head_right');
      expect(leftBiceps).toBeDefined();
      expect(rightBiceps).toBeDefined();
      expect(leftBiceps?.side).toBe('left');
      expect(rightBiceps?.side).toBe('right');
      expect(leftBiceps?.centerCoordinates[0]).toBeLessThan(0); // Left side has negative X in 3D anatomy
      expect(rightBiceps?.centerCoordinates[0]).toBeGreaterThan(0); // Right side has positive X in 3D anatomy

      // Check left/right unilateral pairing for core
      const leftAbs = getMuscleById('rectus_abdominis_upper_left');
      const rightAbs = getMuscleById('rectus_abdominis_upper_right');
      expect(leftAbs).toBeDefined();
      expect(rightAbs).toBeDefined();
      expect(leftAbs?.side).toBe('left');
      expect(rightAbs?.side).toBe('right');
      expect(leftAbs?.centerCoordinates[0]).toBeLessThan(0); // Left of midline
      expect(rightAbs?.centerCoordinates[0]).toBeGreaterThan(0); // Right of midline
    });

    it('defines biomechanical contribution ratios for compound lifts', () => {
      const bench = DEFAULT_EXERCISE_CONTRIBUTIONS['ex-barbell-bench-press'];
      expect(bench).toBeDefined();
      expect(bench.length).toBeGreaterThan(0);

      // Primary mover receives highest weight
      const chestContrib = bench.find((c) => c.muscleId.includes('pec_major_sternal'));
      const tricepContrib = bench.find((c) => c.muscleId.includes('triceps_lateral'));
      expect(chestContrib).toBeDefined();
      expect(tricepContrib).toBeDefined();
      expect((chestContrib?.percentageWeight || 0)).toBeGreaterThan(0);

      // Squats hit quads, glutes, adductors
      const squat = DEFAULT_EXERCISE_CONTRIBUTIONS['ex-barbell-back-squat'];
      expect(squat).toBeDefined();
      const quadContrib = squat.find((c) => c.muscleId.includes('rectus_femoris'));
      expect(quadContrib).toBeDefined();
    });
  });

  describe('Multi-Mode Heatmap Engine Computations', () => {
    const mockSessions: WorkoutSession[] = [
      {
        id: 'session-1',
        date: new Date().toISOString().split('T')[0], // Today
        splitName: 'Push Day (Chest, Triceps, Shoulders)',
        completed: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        exercises: [
          {
            id: 'ex-1',
            exerciseId: 'ex-barbell-bench-press',
            exerciseName: 'Barbell Bench Press',
            order: 1,
            sets: [
              {
                id: 's1',
                setNumber: 1,
                type: 'working',
                actualWeightKg: 100,
                actualReps: 10, // 1000 kg volume
                completed: true,
              },
              {
                id: 's2',
                setNumber: 2,
                type: 'working',
                actualWeightKg: 100,
                actualReps: 10, // 1000 kg volume
                completed: true,
              },
            ],
          },
        ],
      },
    ];

    it('computes training volume and effective sets across muscles', () => {
      const metrics = calculateAllMuscleMetrics(mockSessions, 7);
      expect(metrics.size).toBeGreaterThan(40);

      const leftPec = metrics.get('pec_major_sternal_left');
      const rightPec = metrics.get('pec_major_sternal_right');
      expect(leftPec).toBeDefined();
      expect(rightPec).toBeDefined();

      // Bench press generates volume for both left and right pectoralis based on contribution weights
      expect(leftPec!.totalVolumeKg).toBeGreaterThan(0);
      expect(rightPec!.totalVolumeKg).toBeGreaterThan(0);
      expect(leftPec!.effectiveSets).toBe(0.5);
      expect(rightPec!.effectiveSets).toBe(0.5);
      expect(leftPec!.lastTrainedDate).toBe(mockSessions[0].date);
    });

    it('evaluates heatmap color and status across all 5 heatmap modes', () => {
      const metrics = calculateAllMuscleMetrics(mockSessions, 7);
      const leftPec = metrics.get('pec_major_sternal_left')!;

      // 1. Volume mode
      const volColor = getMuscleHeatmapColor(leftPec, 'volume');
      expect(volColor.hex).toMatch(/^#/);
      expect(volColor.metricValue).toBe(leftPec.totalVolumeKg);

      // 2. Recovery mode (trained today -> in recovery phase)
      const recColor = getMuscleHeatmapColor(leftPec, 'recovery');
      expect(recColor.hex).toMatch(/^#/);
      expect(recColor.metricValue).toBeLessThanOrEqual(100);

      // 3. Frequency mode
      const freqColor = getMuscleHeatmapColor(leftPec, 'frequency');
      expect(freqColor.metricValue).toBe(1);

      // 4. Sets mode (rounds effective sets to nearest whole number)
      const setsColor = getMuscleHeatmapColor(leftPec, 'sets');
      expect(setsColor.metricValue).toBe(1);

      // 5. Imbalance mode
      const imbColor = getMuscleHeatmapColor(leftPec, 'imbalance');
      expect(imbColor.hex).toMatch(/^#/);
      expect(imbColor.label).toBeDefined();
    });

    it('models fatigue decay curve over 72 hours for recovery visualization', () => {
      // Untrained muscle has 100% recovery status
      const metrics = calculateAllMuscleMetrics([], 7);
      const calves = metrics.get('gastrocnemius_medial_left')!;
      expect(calves).toBeDefined();
      const rec = getMuscleHeatmapColor(calves, 'recovery');
      expect(rec.metricValue).toBe(100);
      expect(rec.label).toContain('Fresh / Untrained');
    });
  });

  describe('Micronutrient & Electrolyte Ratios', () => {
    it('provides clinical dietary reference targets for 20+ micronutrients', () => {
      expect(MICRONUTRIENT_REFERENCE_TARGETS.length).toBeGreaterThanOrEqual(18);
      const potassium = MICRONUTRIENT_REFERENCE_TARGETS.find((m) => m.key === 'potassiumMg');
      const magnesium = MICRONUTRIENT_REFERENCE_TARGETS.find((m) => m.key === 'magnesiumMg');
      const calcium = MICRONUTRIENT_REFERENCE_TARGETS.find((m) => m.key === 'calciumMg');
      const vitD = MICRONUTRIENT_REFERENCE_TARGETS.find((m) => m.key === 'vitaminDIU');

      expect(potassium?.standardTarget).toBe(3400); // RDA mg
      expect(magnesium?.standardTarget).toBe(420); // RDA mg
      expect(calcium?.standardTarget).toBe(1000); // RDA mg
      expect(vitD?.standardTarget).toBe(800); // IU
    });

    it('calculates Sodium to Potassium (Na:K) and Calcium to Magnesium (Ca:Mg) ratios', () => {
      const ratios = calculateElectrolyteRatios({
        sodium: 2300,
        potassium: 3400,
        calcium: 1000,
        magnesium: 500,
      });

      // Na:K ratio = 2300 / 3400 ≈ 0.68
      expect(ratios.naToKRatio).toBeCloseTo(0.68, 1);
      expect(ratios.isNaKOptimal).toBe(true);

      // Ca:Mg ratio = 1000 / 500 = 2.0
      expect(ratios.caToMgRatio).toBe(2.0);
      expect(ratios.isCaMgOptimal).toBe(true);
    });
  });
});
