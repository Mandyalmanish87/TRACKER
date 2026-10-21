import { DailyQuestionEntry } from '../types';
import { formatLocalDateStr } from './focusAnalytics';

export interface DayQuestionAggregate {
  date: string; // YYYY-MM-DD
  attempted: number;
  correct: number;
  accuracy: number; // 0 - 100
  meetsTarget: boolean;
  entries: DailyQuestionEntry[];
}

export interface DailyQuestionStats {
  todayAttempted: number;
  todayCorrect: number;
  todayAccuracy: number; // 0 - 100
  todayTarget: number;
  todayProgressPct: number; // 0 - 100
  todayMetTarget: boolean;
  currentStreak: number;
  longestStreak: number;
  totalQuestionsAttempted: number;
  totalQuestionsCorrect: number;
  overallAccuracy: number;
  dailyAggregates: Map<string, DayQuestionAggregate>;
}

/**
 * Validates a single daily question entry.
 */
export function validateQuestionEntry(attempted: number, correct: number): { valid: boolean; error?: string } {
  if (!Number.isInteger(attempted) || attempted < 0) {
    return { valid: false, error: 'Questions attempted must be a non-negative whole number.' };
  }
  if (!Number.isInteger(correct) || correct < 0) {
    return { valid: false, error: 'Correct answers must be a non-negative whole number.' };
  }
  if (correct > attempted) {
    return { valid: false, error: 'Correct answers cannot exceed attempted questions.' };
  }
  return { valid: true };
}

/**
 * Computes aggregated metrics, daily totals, accuracy, and streaks for daily questions.
 */
export function calculateDailyQuestionStats(
  entries: DailyQuestionEntry[],
  dailyTarget: number = 25,
  referenceDate: Date = new Date()
): DailyQuestionStats {
  const target = Math.max(1, dailyTarget);
  const todayStr = formatLocalDateStr(referenceDate);

  // Group entries by local date
  const dailyMap = new Map<string, DayQuestionAggregate>();

  for (const entry of entries) {
    const existing = dailyMap.get(entry.date) || {
      date: entry.date,
      attempted: 0,
      correct: 0,
      accuracy: 0,
      meetsTarget: false,
      entries: [],
    };

    existing.attempted += entry.attempted;
    existing.correct += entry.correct;
    existing.entries.push(entry);
    dailyMap.set(entry.date, existing);
  }

  // Calculate accuracy & target status for each day
  for (const day of dailyMap.values()) {
    day.accuracy = day.attempted > 0 ? Math.round((day.correct / day.attempted) * 100) : 0;
    day.meetsTarget = day.attempted >= target;
  }

  // Today's summary
  const todayAgg = dailyMap.get(todayStr);
  const todayAttempted = todayAgg?.attempted ?? 0;
  const todayCorrect = todayAgg?.correct ?? 0;
  const todayAccuracy = todayAttempted > 0 ? Math.round((todayCorrect / todayAttempted) * 100) : 0;
  const todayProgressPct = Math.min(100, Math.round((todayAttempted / target) * 100));
  const todayMetTarget = todayAttempted >= target;

  // Overall totals
  let totalQuestionsAttempted = 0;
  let totalQuestionsCorrect = 0;
  for (const day of dailyMap.values()) {
    totalQuestionsAttempted += day.attempted;
    totalQuestionsCorrect += day.correct;
  }
  const overallAccuracy =
    totalQuestionsAttempted > 0 ? Math.round((totalQuestionsCorrect / totalQuestionsAttempted) * 100) : 0;

  // Calculate Streaks
  // A day qualifies if its aggregated attempted >= target.
  const qualifyingDates = new Set<string>();
  for (const [dateStr, agg] of dailyMap.entries()) {
    if (agg.attempted >= target) {
      qualifyingDates.add(dateStr);
    }
  }

  // Calculate Current Streak:
  // Starts from today (if qualifying) or yesterday (if today not yet qualifying).
  let currentStreak = 0;
  const checkDate = new Date(referenceDate);
  const isTodayQualifying = qualifyingDates.has(todayStr);

  if (isTodayQualifying) {
    currentStreak++;
    checkDate.setDate(checkDate.getDate() - 1);
  } else {
    // If today is not yet qualifying, check if yesterday was qualifying
    checkDate.setDate(checkDate.getDate() - 1);
  }

  while (true) {
    const dStr = formatLocalDateStr(checkDate);
    if (qualifyingDates.has(dStr)) {
      currentStreak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  // Calculate Longest Streak historically
  const sortedDates = Array.from(qualifyingDates).sort();
  let longestStreak = 0;
  let runningStreak = 0;
  let previousDate: Date | null = null;

  for (const dateStr of sortedDates) {
    const [year, month, day] = dateStr.split('-').map(Number);
    const currentDate = new Date(year, month - 1, day);

    if (previousDate) {
      const diffDays = Math.round((currentDate.getTime() - previousDate.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays === 1) {
        runningStreak++;
      } else if (diffDays > 1) {
        runningStreak = 1;
      }
    } else {
      runningStreak = 1;
    }

    if (runningStreak > longestStreak) {
      longestStreak = runningStreak;
    }

    previousDate = currentDate;
  }

  // Longest streak must be at least currentStreak
  if (currentStreak > longestStreak) {
    longestStreak = currentStreak;
  }

  return {
    todayAttempted,
    todayCorrect,
    todayAccuracy,
    todayTarget: target,
    todayProgressPct,
    todayMetTarget,
    currentStreak,
    longestStreak,
    totalQuestionsAttempted,
    totalQuestionsCorrect,
    overallAccuracy,
    dailyAggregates: dailyMap,
  };
}
