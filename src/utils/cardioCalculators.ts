/**
 * Student Tracker — Cardio & Conditioning Metrics Engine
 * Document ID: FITNESS-M05-RECOVERY-CARDIO
 *
 * Deterministic formulas:
 * - MET (Metabolic Equivalent of Task) calorie burn estimates
 * - Distance, Pace (min/km), and Speed (km/h) converters
 * - Zero-division guards and duration boundary protections
 */

import { CardioType } from '../types';

export const CARDIO_MET_VALUES: Record<CardioType, { met: number; label: string; defaultCadence?: string }> = {
  walking: { met: 3.5, label: 'Brisk Walking (4.8 km/h)' },
  running: { met: 8.5, label: 'Jogging / Running (8.5 km/h)' },
  cycling: { met: 6.0, label: 'Outdoor / Stationary Cycling (Moderate)' },
  treadmill: { met: 7.5, label: 'Treadmill Jog / Incline Power Walk' },
  swimming: { met: 8.0, label: 'Swimming (Freestyle / Laps)' },
  rowing: { met: 7.0, label: 'Rowing Machine (Moderate Effort)' },
  stair_climbing: { met: 9.0, label: 'Stair Climber / Bleachers' },
  hiit: { met: 10.0, label: 'High Intensity Interval Training (HIIT)' },
};

export interface CardioCalculationResult {
  estimatedCalories: number;
  averagePaceMinPerKm?: number;
  formattedPace?: string; // e.g. "5:12 /km"
  averageSpeedKmh?: number;
  provenance: string;
}

/**
 * Calculates cardio performance metrics and MET calories.
 * Safe against zero distance or zero duration.
 */
export function calculateCardioMetrics(
  type: CardioType,
  durationMinutes: number,
  distanceKm?: number,
  userWeightKg: number = 70
): CardioCalculationResult {
  const safeWeight = typeof userWeightKg === 'number' && userWeightKg > 30 ? userWeightKg : 70;
  const safeDuration = typeof durationMinutes === 'number' && durationMinutes > 0 ? durationMinutes : 0;
  const met = (CARDIO_MET_VALUES[type] || CARDIO_MET_VALUES.running).met;

  // Calories = MET * Weight(kg) * (Minutes / 60)
  const calories = Math.round(met * safeWeight * (safeDuration / 60));

  let paceMinPerKm: number | undefined;
  let formattedPace: string | undefined;
  let speedKmh: number | undefined;

  if (distanceKm && distanceKm > 0 && safeDuration > 0) {
    const rawPace = safeDuration / distanceKm; // minutes per km
    paceMinPerKm = Number(rawPace.toFixed(2));

    const paceMinutes = Math.floor(rawPace);
    const paceSeconds = Math.round((rawPace - paceMinutes) * 60);
    const paddedSec = String(paceSeconds).padStart(2, '0');
    formattedPace = `${paceMinutes}:${paddedSec} /km`;

    const rawSpeed = (distanceKm / safeDuration) * 60; // km per hour
    speedKmh = Number(rawSpeed.toFixed(1));
  }

  return {
    estimatedCalories: calories,
    averagePaceMinPerKm: paceMinPerKm,
    formattedPace,
    averageSpeedKmh: speedKmh,
    provenance: `[MET Formula Estimate: ${met} MET x ${safeWeight}kg x ${safeDuration}m]`,
  };
}

export function calculateCardioCalories(params: {
  cardioType: CardioType;
  durationMinutes: number;
  weightKg?: number;
  distanceKm?: number;
  averageHeartRateBpm?: number;
}): { caloriesBurned: number; calculationSource: 'pace_weight_formula' | 'heart_rate_formula' | 'manual_entry' } {
  const metrics = calculateCardioMetrics(
    params.cardioType,
    params.durationMinutes,
    params.distanceKm,
    params.weightKg || 70
  );
  return {
    caloriesBurned: metrics.estimatedCalories,
    calculationSource: 'pace_weight_formula',
  };
}

export function formatPace(paceMinPerKm?: number): string {
  if (!paceMinPerKm || paceMinPerKm <= 0) return '--';
  const mins = Math.floor(paceMinPerKm);
  const secs = Math.round((paceMinPerKm - mins) * 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs} /km`;
}

