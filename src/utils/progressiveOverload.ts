/**
 * Student Tracker — Progressive Overload & 1RM Calculation Engine
 * Document ID: FITNESS-M01-M02-PROGRESSIVE-OVERLOAD
 *
 * Deterministic sport-science formulas:
 * - Brzycki formula for 1-12 reps
 * - Epley formula for >12 reps
 * - Double progression recommendations
 * - Deload detection & volume load tracking
 */

import { WorkoutSession, WorkoutExercise, ExerciseSet } from '../types';

export interface OneRepMaxEstimate {
  estimated1RMKg: number;
  formula: 'exact' | 'brzycki' | 'epley';
  confidencePercentage: number;
}

export interface PRStatus {
  isNewWeightPR: boolean;
  isNewEstimated1RMPR: boolean;
  isNewVolumePR: boolean;
  previousMaxWeightKg?: number;
  previousMaxEstimated1RMKg?: number;
}

export interface ProgressionRecommendation {
  type: 'increase_weight' | 'increase_reps' | 'maintain' | 'deload_suggested';
  suggestedWeightDeltaKg?: number;
  suggestedTargetWeightKg?: number;
  suggestedTargetReps?: number;
  reason: string;
  historicalBasis: string;
}

/**
 * Calculates estimated 1 Rep Max using Brzycki or Epley formulas.
 * Clamped and protected against division by zero.
 */
export function calculateEstimated1RM(weightKg: number, reps: number): OneRepMaxEstimate {
  if (weightKg <= 0 || reps <= 0) {
    return { estimated1RMKg: 0, formula: 'exact', confidencePercentage: 0 };
  }

  if (reps === 1) {
    return { estimated1RMKg: weightKg, formula: 'exact', confidencePercentage: 100 };
  }

  if (reps <= 12) {
    // Brzycki formula: W * (36 / (37 - R))
    const brzycki = weightKg * (36 / Math.max(1, 37 - reps));
    const confidence = Math.max(60, Math.round(100 - reps * 3));
    return {
      estimated1RMKg: Number(brzycki.toFixed(1)),
      formula: 'brzycki',
      confidencePercentage: confidence,
    };
  }

  // Epley formula for higher rep ranges: W * (1 + R / 30)
  const epley = weightKg * (1 + reps / 30);
  const confidence = Math.max(40, Math.round(85 - reps * 2));
  return {
    estimated1RMKg: Number(epley.toFixed(1)),
    formula: 'epley',
    confidencePercentage: confidence,
  };
}

/**
 * Calculates total working volume load for a workout session or exercise.
 * Strict rule: warmup sets are excluded from working volume.
 */
export function calculateWorkingVolume(session: WorkoutSession): number {
  if (!session || !Array.isArray(session.exercises)) return 0;

  let totalVolume = 0;
  for (const ex of session.exercises) {
    for (const set of ex.sets || []) {
      if (set.completed && set.type !== 'warmup') {
        const weight = typeof set.actualWeightKg === 'number' && !isNaN(set.actualWeightKg) ? set.actualWeightKg : 0;
        const reps = typeof set.actualReps === 'number' && !isNaN(set.actualReps) ? set.actualReps : 0;
        totalVolume += weight * reps;
      }
    }
  }

  return Math.round(totalVolume);
}

/**
 * Evaluates whether a completed set constitutes a Personal Record (PR).
 */
export function evaluatePersonalRecords(
  exerciseId: string,
  currentSet: ExerciseSet,
  historicalSessions: WorkoutSession[]
): PRStatus {
  if (!currentSet.completed || currentSet.type === 'warmup') {
    return { isNewWeightPR: false, isNewEstimated1RMPR: false, isNewVolumePR: false };
  }

  const currentWeight = currentSet.actualWeightKg || 0;
  const currentReps = currentSet.actualReps || 0;
  const current1RM = calculateEstimated1RM(currentWeight, currentReps).estimated1RMKg;
  const currentSetVolume = currentWeight * currentReps;

  let historicalMaxWeight = 0;
  let historicalMax1RM = 0;
  let historicalMaxSetVolume = 0;

  for (const session of historicalSessions || []) {
    for (const ex of session.exercises || []) {
      if (ex.exerciseId === exerciseId || ex.exerciseName === exerciseId) {
        for (const s of ex.sets || []) {
          if (s.completed && s.type !== 'warmup') {
            const w = s.actualWeightKg || 0;
            const r = s.actualReps || 0;
            if (w > historicalMaxWeight) historicalMaxWeight = w;
            const est = calculateEstimated1RM(w, r).estimated1RMKg;
            if (est > historicalMax1RM) historicalMax1RM = est;
            const vol = w * r;
            if (vol > historicalMaxSetVolume) historicalMaxSetVolume = vol;
          }
        }
      }
    }
  }

  const isNewWeightPR = currentWeight > 0 && currentWeight > historicalMaxWeight;
  const isNewEstimated1RMPR = current1RM > 0 && current1RM > historicalMax1RM;
  const isNewVolumePR = currentSetVolume > 0 && currentSetVolume > historicalMaxSetVolume;

  return {
    isNewWeightPR,
    isNewEstimated1RMPR,
    isNewVolumePR,
    previousMaxWeightKg: historicalMaxWeight > 0 ? historicalMaxWeight : undefined,
    previousMaxEstimated1RMKg: historicalMax1RM > 0 ? historicalMax1RM : undefined,
  };
}

/**
 * Double-Progression recommendation engine.
 * When a user hits the top of their target rep range on all working sets with reserve,
 * recommends increasing the load.
 */
export function evaluateProgressiveOverload(
  exerciseId: string,
  recentSessions: WorkoutSession[],
  targetRepRange: { min: number; max: number } = { min: 8, max: 12 },
  isLowerBody: boolean = false
): ProgressionRecommendation {
  const relevantSessions = (recentSessions || [])
    .filter((s) => s.completed)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);

  if (relevantSessions.length === 0) {
    return {
      type: 'maintain',
      reason: 'No previous history recorded for this exercise. Establish a baseline load.',
      historicalBasis: 'First logged attempt.',
    };
  }

  const latestSession = relevantSessions[0];
  const exercise = latestSession.exercises.find(
    (e) => e.exerciseId === exerciseId || e.exerciseName === exerciseId
  );

  if (!exercise || !exercise.sets || exercise.sets.length === 0) {
    return {
      type: 'maintain',
      reason: 'Exercise not performed in the latest workout.',
      historicalBasis: 'Latest workout session lacked this exercise.',
    };
  }

  const workingSets = exercise.sets.filter((s) => s.completed && s.type !== 'warmup');
  if (workingSets.length === 0) {
    return {
      type: 'maintain',
      reason: 'No completed working sets in the latest session.',
      historicalBasis: 'Only warmups or incomplete sets found.',
    };
  }

  const allHitTopReps = workingSets.every((s) => s.actualReps >= targetRepRange.max);
  const avgWeight = workingSets.reduce((sum, s) => sum + s.actualWeightKg, 0) / workingSets.length;
  const avgRir = workingSets.reduce((sum, s) => sum + (s.rir ?? 1), 0) / workingSets.length;

  if (allHitTopReps && avgRir >= 0.5) {
    const delta = isLowerBody ? 5.0 : 2.5;
    const nextWeight = Number((avgWeight + delta).toFixed(1));
    return {
      type: 'increase_weight',
      suggestedWeightDeltaKg: delta,
      suggestedTargetWeightKg: nextWeight,
      suggestedTargetReps: targetRepRange.min,
      reason: `You hit the ceiling of your rep range (${targetRepRange.max} reps) across all working sets with reserve. Time to progressive overload!`,
      historicalBasis: `Based on your last session on ${latestSession.date} (${workingSets.length} sets @ ${avgWeight}kg).`,
    };
  }

  const allAboveMin = workingSets.every((s) => s.actualReps >= targetRepRange.min);
  if (allAboveMin) {
    return {
      type: 'increase_reps',
      suggestedTargetWeightKg: avgWeight,
      suggestedTargetReps: Math.min(targetRepRange.max, Math.round(workingSets[0].actualReps + 1)),
      reason: `Good baseline load. Keep weight at ${avgWeight}kg and aim to add 1-2 more reps toward the ${targetRepRange.max} rep target.`,
      historicalBasis: `Based on your session on ${latestSession.date}.`,
    };
  }

  return {
    type: 'maintain',
    suggestedTargetWeightKg: avgWeight,
    suggestedTargetReps: targetRepRange.min,
    reason: `Focus on mastering form and hitting at least ${targetRepRange.min} clean reps per set before adding weight.`,
    historicalBasis: `Based on your session on ${latestSession.date}.`,
  };
}

/**
 * Evaluates PRs across all sets in a workout and returns exercises with isPersonalRecord tagged.
 */
export function detectSessionPRs(
  exercises: WorkoutExercise[],
  historicalSessions: WorkoutSession[]
): WorkoutExercise[] {
  return (exercises || []).map((ex) => {
    const updatedSets = (ex.sets || []).map((set) => {
      const prStatus = evaluatePersonalRecords(ex.exerciseId, set, historicalSessions);
      return {
        ...set,
        isPersonalRecord: Boolean(prStatus.isNewWeightPR || prStatus.isNewEstimated1RMPR || prStatus.isNewVolumePR),
      };
    });
    return {
      ...ex,
      sets: updatedSets,
    };
  });
}

