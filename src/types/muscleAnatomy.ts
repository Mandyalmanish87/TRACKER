/**
 * Detailed Biomechanical Muscle Taxonomy & 3D Anatomy Types
 * Supporting left/right unilateral tracking, compound contribution weights,
 * and multi-mode heatmap visualization metrics.
 */

export type MuscleSide = 'left' | 'right' | 'bilateral';

export type AnatomicalRegion =
  | 'chest'
  | 'shoulders'
  | 'back'
  | 'arms'
  | 'core'
  | 'legs'
  | 'calves'
  | 'neck';

export type HeatmapMode =
  | 'volume' // Total logged volume (kg) scaled by contribution
  | 'recovery' // Fatigue dissipation percentage (0 - 100%)
  | 'frequency' // Sessions trained in selected time window
  | 'sets' // Effective sets completed
  | 'imbalance'; // Agonist/antagonist & bilateral symmetry delta

export interface DetailedMuscle {
  id: string; // e.g. "pec_major_sternal_left"
  name: string; // e.g. "Left Pectoralis Major (Sternal Head)"
  commonName: string; // e.g. "Lower Chest"
  region: AnatomicalRegion;
  side: MuscleSide;
  view: 'anterior' | 'posterior' | 'lateral';
  description: string;
  primaryActions: string[];
  // 3D positioning metadata for raycasting / camera focus
  centerCoordinates: [number, number, number];
}

export interface ExerciseMuscleContribution {
  muscleId: string; // DetailedMuscle ID
  role: 'primary' | 'secondary' | 'stabilizer';
  percentageWeight: number; // 0.0 to 1.0 (sums to ~1.0 per exercise)
}

export interface MuscleTrainingMetric {
  muscleId: string;
  name: string;
  region: AnatomicalRegion;
  side: MuscleSide;
  totalVolumeKg: number;
  effectiveSets: number;
  totalReps: number;
  sessionsCount: number;
  lastTrainedDate?: string;
  hoursSinceLastTrained?: number;
  recoveryPercentage: number; // 0 to 100
  recentExercises: {
    exerciseId: string;
    exerciseName: string;
    sets: number;
    volumeKg: number;
    date: string;
  }[];
}

