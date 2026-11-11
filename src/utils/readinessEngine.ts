/**
 * Student Tracker — Physical Readiness & Sleep Architecture Engine
 * Document ID: FITNESS-M05-RECOVERY-CARDIO
 *
 * Deterministic formulas:
 * - Cross-midnight sleep duration calculator
 * - Weighted holistic readiness score (0 to 100)
 * - DOMS muscle soreness impact analysis
 * - Medical disclaimer labeling
 */

import { SleepRecoveryEntry } from '../types';

export interface ReadinessEvaluation {
  readinessScore: number; // 0 to 100
  tier: 'optimal' | 'moderate' | 'fatigued';
  headline: string;
  recommendation: string;
  sorenessAlert?: string;
  disclaimer: string;
}

/**
 * Calculates sleep duration in minutes, handling midnight boundary transitions.
 * e.g., Bedtime "23:00" and WakeTime "07:30" => 510 minutes (8.5 hours).
 */
export function calculateSleepDurationMinutes(bedTime: string, wakeTime: string): number {
  if (!bedTime || !wakeTime || !bedTime.includes(':') || !wakeTime.includes(':')) {
    return 480; // Default 8 hours
  }

  const [bH, bM] = bedTime.split(':').map(Number);
  const [wH, wM] = wakeTime.split(':').map(Number);

  if (isNaN(bH) || isNaN(bM) || isNaN(wH) || isNaN(wM)) return 480;

  const bedMinutes = bH * 60 + bM;
  const wakeMinutes = wH * 60 + wM;

  if (wakeMinutes >= bedMinutes) {
    return wakeMinutes - bedMinutes;
  } else {
    // Crosses midnight (e.g. 23:00 to 07:00)
    return 24 * 60 - bedMinutes + wakeMinutes;
  }
}

/**
 * Computes deterministic Readiness Score (0 to 100) from sleep and subjective fatigue metrics.
 */
export function calculateDailyReadiness(
  entry: Partial<SleepRecoveryEntry>,
  todaysScheduledSplitName?: string
): ReadinessEvaluation {
  const durationMin = entry.sleepDurationMinutes ?? 480;
  const quality = entry.sleepQualityRating ?? 3;
  const energy = entry.energyLevel ?? 3;
  const stress = entry.stressLevel ?? 3;

  // 1. Duration score: 8 hours (480 mins) is 100. Penalize <6 hours and >10 hours slightly.
  let durationScore = 0;
  if (durationMin >= 450 && durationMin <= 540) {
    durationScore = 100;
  } else if (durationMin < 450) {
    durationScore = Math.max(20, Math.round((durationMin / 450) * 100));
  } else {
    durationScore = Math.max(70, Math.round(100 - (durationMin - 540) * 0.1));
  }

  // 2. Quality score: 1 to 5 stars -> 20 to 100
  const qualityScore = quality * 20;

  // 3. Energy score: 1 to 5 -> 20 to 100
  const energyScore = energy * 20;

  // 4. Stress score: inverted (stress 1 = 100, stress 5 = 20)
  const stressScore = (6 - stress) * 20;

  // 5. Soreness score
  const sorenessMap = entry.muscleSorenessMap || {};
  const values = Object.values(sorenessMap).filter((v) => typeof v === 'number') as number[];
  const avgSoreness = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  const sorenessScore = Math.max(0, Math.round(((3 - avgSoreness) / 3) * 100));

  // Weighted total:
  // Duration: 35%, Quality: 25%, Energy: 20%, Stress: 10%, Soreness: 10%
  const total = Math.round(
    durationScore * 0.35 +
    qualityScore * 0.25 +
    energyScore * 0.20 +
    stressScore * 0.10 +
    sorenessScore * 0.10
  );

  const clampedScore = Math.max(10, Math.min(100, total));

  // Soreness conflict check
  let sorenessAlert: string | undefined;
  if (todaysScheduledSplitName) {
    const splitLower = todaysScheduledSplitName.toLowerCase();
    if (splitLower.includes('leg') || splitLower.includes('lower')) {
      if ((sorenessMap.quads ?? 0) >= 2 || (sorenessMap.hamstrings ?? 0) >= 2) {
        sorenessAlert = 'High leg soreness detected. Consider an active recovery session or swapping today with an upper body day.';
      }
    } else if (splitLower.includes('push') || splitLower.includes('chest')) {
      if ((sorenessMap.chest ?? 0) >= 2 || (sorenessMap.front_delts ?? 0) >= 2) {
        sorenessAlert = 'High chest/shoulder soreness detected. Consider lighter loads or extra warmup sets.';
      }
    } else if (splitLower.includes('pull') || splitLower.includes('back')) {
      if ((sorenessMap.lats ?? 0) >= 2 || (sorenessMap.upper_back ?? 0) >= 2) {
        sorenessAlert = 'High back soreness detected. Prioritize hamstring/mobility warmups before heavy pulls.';
      }
    }
  }

  let tier: ReadinessEvaluation['tier'] = 'moderate';
  let headline = 'Moderate Readiness';
  let recommendation = 'Standard training volume is recommended. Listen to your body on working sets.';

  if (clampedScore >= 80) {
    tier = 'optimal';
    headline = 'Optimal Readiness';
    recommendation = 'Central nervous system and muscles are well-rested. Great day for heavy sets or PR attempts!';
  } else if (clampedScore < 60) {
    tier = 'fatigued';
    headline = 'Fatigue Accumulation Alert';
    recommendation = 'Sleep or recovery metrics are low. Consider reducing working sets by 30-40% or taking an active rest day.';
  }

  return {
    readinessScore: clampedScore,
    tier,
    headline,
    recommendation,
    sorenessAlert,
    disclaimer: 'Readiness is an informational estimate derived from your logged subjective inputs. It is not a clinical medical assessment.',
  };
}
