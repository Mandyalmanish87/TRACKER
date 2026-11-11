/**
 * Student Tracker — In-App Deterministic Fitness Intelligence Engine
 * Document ID: FITNESS-M06-INTEL-DASHBOARD
 *
 * Transparent, Explainable Synthesis:
 * - Generates actionable fitness insights without external AI APIs
 * - Every insight includes an explicit mathematical derivation
 * - Synthesizes strength, volume, recovery, nutrition, and academic synergy
 */

import {
  WorkoutSession,
  FoodDiaryEntry,
  NutritionProfile,
  BodyMeasurementEntry,
  SleepRecoveryEntry,
  FitnessInsight,
  UserProfile,
  TimetableSlot,
} from '../types';
import { calculateWorkingVolume } from './progressiveOverload';
import { calculateDailyReadiness } from './readinessEngine';
import { findOptimalWorkoutWindows, evaluateExamDeloadStatus } from './timetableFitnessSynergy';

export function generateFitnessInsights(params: {
  sessions: WorkoutSession[];
  diaryEntries: FoodDiaryEntry[];
  profile?: NutritionProfile;
  userProfile?: UserProfile;
  measurements: BodyMeasurementEntry[];
  recoveryLogs: SleepRecoveryEntry[];
  timetableSlots?: TimetableSlot[];
}): FitnessInsight[] {
  const {
    sessions = [],
    diaryEntries = [],
    profile,
    userProfile,
    measurements = [],
    recoveryLogs = [],
    timetableSlots = [],
  } = params;

  const insights: FitnessInsight[] = [];
  const now = new Date();
  const nowIso = now.toISOString();

  // 1. Academic Synergy: Approaching Exam Deload
  if (userProfile?.examDate) {
    const examDeload = evaluateExamDeloadStatus(userProfile.examDate, now);
    if (examDeload.isExamSoon) {
      insights.push({
        id: `insight-exam-deload-${nowIso.split('T')[0]}`,
        category: 'academic_synergy',
        title: 'Academic Exam Deload Recommended',
        summary: examDeload.recommendation || 'Final exams approaching. Reduce volume to protect cognitive performance.',
        derivationExplanation: `Derived from UserProfile.examDate (${userProfile.examDate}) being ${examDeload.daysRemaining} days away. Research shows tapering resistance training volume by 40% reduces central nervous system fatigue during intensive cognitive periods.`,
        createdAt: nowIso,
      });
    }
  }

  // 2. Academic Synergy: Free Workout Windows Today
  if (timetableSlots.length > 0) {
    const windows = findOptimalWorkoutWindows(timetableSlots);
    if (windows.length > 0) {
      const best = windows[0];
      insights.push({
        id: `insight-timetable-window-${nowIso.split('T')[0]}`,
        category: 'academic_synergy',
        title: 'Optimal Workout Window Identified',
        summary: `You have an open ${best.durationMinutes}m academic block (${best.startTime} - ${best.endTime}) between lectures today.`,
        derivationExplanation: `Derived from active timetable slots. Detected a gap >= 60 minutes between class occurrences without scheduling conflicts.`,
        createdAt: nowIso,
      });
    }
  }

  // 3. Recovery & Readiness Alignment
  if (recoveryLogs.length > 0) {
    const latestRecovery = [...recoveryLogs].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    )[0];
    const readiness = calculateDailyReadiness(latestRecovery);

    if (readiness.tier === 'fatigued') {
      insights.push({
        id: `insight-readiness-fatigue-${latestRecovery.date}`,
        category: 'recovery',
        title: 'Systemic Fatigue Alert',
        summary: `Today's readiness score is ${readiness.readinessScore}/100. Consider an active rest day or lighter loads.`,
        derivationExplanation: `Derived from sleep duration (${Math.round(latestRecovery.sleepDurationMinutes / 60)}h), quality rating (${latestRecovery.sleepQualityRating}/5), and reported stress level (${latestRecovery.stressLevel}/5).`,
        createdAt: nowIso,
      });
    }
  }

  // 4. Strength Progression Tracking
  if (sessions.length >= 2) {
    const completedSessions = sessions
      .filter((s) => s.completed)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    if (completedSessions.length >= 2) {
      const recent = completedSessions.slice(0, 4);
      let totalVolumeRecent = 0;
      for (const s of recent) {
        totalVolumeRecent += calculateWorkingVolume(s);
      }
      const avgVolume = Math.round(totalVolumeRecent / recent.length);

      insights.push({
        id: `insight-volume-avg-${nowIso.split('T')[0]}`,
        category: 'strength',
        title: 'Consistent Working Volume Baseline',
        summary: `Averaging ${avgVolume.toLocaleString()} kg total working volume per workout over your last ${recent.length} sessions.`,
        derivationExplanation: `Calculated as sum of (weight x reps) across all completed non-warmup sets across ${recent.length} recent logged sessions.`,
        createdAt: nowIso,
      });
    }
  }

  // 5. Body Recomposition Detection
  if (measurements.length >= 2) {
    const sorted = [...measurements].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    const first = sorted[0];
    const last = sorted[sorted.length - 1];

    if (first.waistCm && last.waistCm) {
      const waistDiff = last.waistCm - first.waistCm;
      const weightDiff = last.weightKg - first.weightKg;

      if (waistDiff <= -1.5 && Math.abs(weightDiff) <= 1.0) {
        insights.push({
          id: `insight-recomp-${nowIso.split('T')[0]}`,
          category: 'strength',
          title: 'Positive Body Recomposition Detected',
          summary: `Scale weight has remained steady (${weightDiff > 0 ? '+' : ''}${weightDiff.toFixed(1)}kg) while waist decreased by ${Math.abs(waistDiff)}cm, indicating simultaneous muscle gain and fat loss!`,
          derivationExplanation: `Compared measurement on ${first.date} (Weight: ${first.weightKg}kg, Waist: ${first.waistCm}cm) against ${last.date} (Weight: ${last.weightKg}kg, Waist: ${last.waistCm}cm).`,
          createdAt: nowIso,
        });
      }
    }
  }

  // 6. Nutrition Consistency Check
  if (diaryEntries.length > 0 && profile?.macroTargets) {
    const todayStr = nowIso.split('T')[0];
    const todayFoods = diaryEntries.filter((f) => f.date === todayStr);
    const todayProtein = todayFoods.reduce((sum, f) => sum + (f.protein || 0), 0);
    const targetProtein = profile.macroTargets.protein;
    if (todayProtein >= targetProtein && targetProtein > 0) {
      insights.push({
        id: `insight-protein-target-${todayStr}`,
        category: 'nutrition',
        title: 'Daily Protein Target Achieved',
        summary: `You reached ${Math.round(todayProtein)}g of your ${targetProtein}g daily protein target.`,
        derivationExplanation: `Derived from logged meals on ${todayStr} summing to ${Math.round(todayProtein)}g vs configured target of ${targetProtein}g.`,
        createdAt: nowIso,
      });
    }
  }

  return insights;
}
