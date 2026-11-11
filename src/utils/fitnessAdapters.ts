/**
 * Student Tracker — Fitness Ecosystem Compatibility Adapters
 * Document ID: FITNESS-M00-AUDIT
 * 
 * Bidirectional conversion utilities between legacy Milestone 7 GymWorkout
 * records and modern Milestone 01+ WorkoutSession architectures.
 * Guarantees zero data loss across version migrations.
 */

import { GymWorkout, WorkoutSession, WorkoutExercise, ExerciseSet, SetType } from '../types';

/**
 * Normalizes an arbitrary exercise name into a deterministic fallback ID
 */
export function slugifyExerciseName(name: string): string {
  if (typeof name !== 'string') return 'ex-unknown';
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `ex-${slug || 'custom'}`;
}

/**
 * Converts a legacy Milestone 7 GymWorkout into a modern WorkoutSession.
 */
export function adaptLegacyWorkout(legacy: GymWorkout): WorkoutSession {
  const exercises: WorkoutExercise[] = (legacy.exercises || []).map((ex, exIdx) => {
    const exerciseId = slugifyExerciseName(ex.name);
    const sets: ExerciseSet[] = (ex.sets || []).map((s, sIdx) => ({
      id: `${legacy.id || 'w'}-ex${exIdx}-s${sIdx}`,
      setNumber: sIdx + 1,
      type: 'working' as SetType,
      targetWeightKg: s.weightKg,
      targetReps: s.reps,
      actualWeightKg: typeof s.weightKg === 'number' && !isNaN(s.weightKg) ? s.weightKg : 0,
      actualReps: typeof s.reps === 'number' && !isNaN(s.reps) ? s.reps : 0,
      completed: Boolean(s.completed),
    }));

    return {
      id: `${legacy.id || 'w'}-ex${exIdx}`,
      exerciseId,
      exerciseName: ex.name || 'Unnamed Exercise',
      order: exIdx + 1,
      sets,
    };
  });

  const nowIso = new Date().toISOString();
  const createdAt = legacy.createdAt || nowIso;
  const updatedAt = legacy.updatedAt || createdAt;

  return {
    id: legacy.id || `session-${Date.now()}`,
    date: legacy.date || nowIso.split('T')[0],
    splitName: legacy.split || 'Custom Split',
    completed: Boolean(legacy.completed),
    durationMinutes: typeof legacy.durationMinutes === 'number' ? legacy.durationMinutes : undefined,
    exercises,
    notes: legacy.notes,
    isSample: Boolean(legacy.isSample),
    createdAt,
    updatedAt,
  };
}

/**
 * Converts a modern WorkoutSession back to a legacy GymWorkout.
 * Ensures existing widgets (e.g. GymSplitWidget) can consume new sessions.
 */
export function adaptSessionToLegacy(session: WorkoutSession): GymWorkout {
  return {
    id: session.id,
    date: session.date,
    split: session.splitName || 'Workout Session',
    completed: session.completed,
    durationMinutes: session.durationMinutes,
    exercises: (session.exercises || []).map((ex) => ({
      name: ex.exerciseName || 'Exercise',
      sets: (ex.sets || []).map((s) => ({
        reps: s.actualReps ?? s.targetReps ?? 0,
        weightKg: s.actualWeightKg ?? s.targetWeightKg ?? 0,
        completed: Boolean(s.completed),
      })),
    })),
    notes: session.notes,
    isSample: session.isSample,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  };
}

/**
 * Batch conversion helper: GymWorkout[] -> WorkoutSession[]
 */
export function adaptLegacyWorkoutsToSessions(legacyList: GymWorkout[]): WorkoutSession[] {
  if (!Array.isArray(legacyList)) return [];
  return legacyList.map(adaptLegacyWorkout);
}

/**
 * Batch conversion helper: WorkoutSession[] -> GymWorkout[]
 */
export function adaptSessionsToLegacyWorkouts(sessions: WorkoutSession[]): GymWorkout[] {
  if (!Array.isArray(sessions)) return [];
  return sessions.map(adaptSessionToLegacy);
}

// Aliases for intuitive API semantics
export const convertWorkoutSessionToGymWorkout = adaptSessionToLegacy;
export const convertGymWorkoutToWorkoutSession = adaptLegacyWorkout;

