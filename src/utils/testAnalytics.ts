import { MockTest, ErrorLogEntry, ErrorType } from '../types';

/**
 * Calculates score percentage: (score / maxMarks) * 100
 * Guarded against maxMarks <= 0.
 */
export function calculateScorePercentage(score: number, maxMarks: number): number {
  if (typeof score !== 'number' || typeof maxMarks !== 'number' || maxMarks <= 0) {
    return 0;
  }
  const pct = (score / maxMarks) * 100;
  return Number(Math.max(0, pct).toFixed(1));
}

/**
 * Calculates accuracy percentage: (correct / attempted) * 100
 * Guarded against attempted = 0 to prevent division by zero.
 */
export function calculateAccuracyPercentage(correct: number, attempted: number): number {
  if (typeof correct !== 'number' || typeof attempted !== 'number' || attempted <= 0) {
    return 0;
  }
  const pct = (correct / attempted) * 100;
  return Number(Math.min(100, Math.max(0, pct)).toFixed(1));
}

export interface CategoryPerformanceStats {
  category: string;
  count: number;
  isMixedMaxMarks: boolean;
  commonMaxMarks: number | null;
  avgScore: number;
  bestScore: number;
  avgScorePercentage: number;
  bestScorePercentage: number;
  avgAccuracy: number;
  movingAverage: number[]; // N-test moving average (3-test window)
  recentTrend: 'up' | 'down' | 'stable';
}

/**
 * Analyzes a collection of mock tests, grouping by category and safely computing metrics.
 * Blocks invalid raw score averaging when maxMarks differ across tests.
 */
export function calculateCategoryStats(
  tests: MockTest[],
  categoryFilter?: string
): CategoryPerformanceStats {
  const filtered = categoryFilter && categoryFilter !== 'all'
    ? tests.filter((t) => t.category.toLowerCase() === categoryFilter.toLowerCase())
    : [...tests];

  // Sort chronologically (oldest to newest)
  filtered.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const count = filtered.length;
  if (count === 0) {
    return {
      category: categoryFilter || 'all',
      count: 0,
      isMixedMaxMarks: false,
      commonMaxMarks: null,
      avgScore: 0,
      bestScore: 0,
      avgScorePercentage: 0,
      bestScorePercentage: 0,
      avgAccuracy: 0,
      movingAverage: [],
      recentTrend: 'stable',
    };
  }

  // Check if maxMarks are uniform
  const firstMax = filtered[0].maxMarks;
  const isMixedMaxMarks = filtered.some((t) => t.maxMarks !== firstMax);
  const commonMaxMarks = isMixedMaxMarks ? null : firstMax;

  let totalScoreSum = 0;
  let bestScore = -Infinity;
  let scorePctSum = 0;
  let bestScorePct = -Infinity;
  let accuracySum = 0;

  const scorePercentages = filtered.map((t) => {
    const sPct = calculateScorePercentage(t.totalScore, t.maxMarks);
    const acc = calculateAccuracyPercentage(t.questionsCorrect, t.questionsAttempted);

    totalScoreSum += t.totalScore;
    if (t.totalScore > bestScore) bestScore = t.totalScore;

    scorePctSum += sPct;
    if (sPct > bestScorePct) bestScorePct = sPct;

    accuracySum += acc;
    return sPct;
  });

  // Calculate 3-test moving average on score percentage
  const windowSize = 3;
  const movingAverage: number[] = [];
  for (let i = 0; i < scorePercentages.length; i++) {
    const start = Math.max(0, i - windowSize + 1);
    const windowSlice = scorePercentages.slice(start, i + 1);
    const sum = windowSlice.reduce((a, b) => a + b, 0);
    movingAverage.push(Number((sum / windowSlice.length).toFixed(1)));
  }

  // Determine trend from last 2 moving average points
  let recentTrend: 'up' | 'down' | 'stable' = 'stable';
  if (movingAverage.length >= 2) {
    const last = movingAverage[movingAverage.length - 1];
    const prev = movingAverage[movingAverage.length - 2];
    if (last - prev >= 1.5) recentTrend = 'up';
    else if (prev - last >= 1.5) recentTrend = 'down';
  }

  return {
    category: categoryFilter || 'all',
    count,
    isMixedMaxMarks,
    commonMaxMarks,
    avgScore: isMixedMaxMarks ? 0 : Number((totalScoreSum / count).toFixed(1)),
    bestScore: isMixedMaxMarks ? 0 : Number(bestScore.toFixed(1)),
    avgScorePercentage: Number((scorePctSum / count).toFixed(1)),
    bestScorePercentage: Number(bestScorePct.toFixed(1)),
    avgAccuracy: Number((accuracySum / count).toFixed(1)),
    movingAverage,
    recentTrend,
  };
}

export interface ChapterWeaknessGroup {
  chapterId: string;
  subjectId: string;
  errorCount: number;
  isRecurring: boolean; // True when errorCount >= 3
  errors: ErrorLogEntry[];
}

/**
 * Detects recurring weaknesses across error logs.
 * Groups by chapter and flags recurring weaknesses when error count >= 3.
 */
export function detectRecurringWeaknesses(
  errorLogs: ErrorLogEntry[]
): ChapterWeaknessGroup[] {
  const chapterMap = new Map<string, ChapterWeaknessGroup>();

  // Only consider unresolved errors
  const activeErrors = errorLogs.filter((e) => !e.resolved);

  for (const err of activeErrors) {
    const groupKey = err.syllabusChapterId || `sub-${err.subjectId}`;
    let existing = chapterMap.get(groupKey);
    if (!existing) {
      existing = {
        chapterId: groupKey,
        subjectId: err.subjectId,
        errorCount: 0,
        isRecurring: false,
        errors: [],
      };
      chapterMap.set(groupKey, existing);
    }
    existing.errorCount += 1;
    existing.errors.push(err);
    // Milestone 6 requirement: exactly >= 3 triggers recurring weakness
    if (existing.errorCount >= 3) {
      existing.isRecurring = true;
    }
  }

  return Array.from(chapterMap.values()).sort((a, b) => b.errorCount - a.errorCount);
}

export const ERROR_TYPES: {
  type: ErrorType;
  label: string;
  badgeColor: string;
  darkBadgeColor: string;
  description: string;
  icon: string;
}[] = [
  {
    type: 'conceptual',
    label: 'Conceptual Error',
    badgeColor: 'bg-purple-100 text-purple-800 border-purple-200',
    darkBadgeColor: 'dark:bg-purple-950/80 dark:text-purple-300 dark:border-purple-800',
    description: 'Fundamental misunderstanding of core topic or theorem',
    icon: '🧠',
  },
  {
    type: 'calculation',
    label: 'Calculation Error',
    badgeColor: 'bg-blue-100 text-blue-800 border-blue-200',
    darkBadgeColor: 'dark:bg-blue-950/80 dark:text-blue-300 dark:border-blue-800',
    description: 'Algebraic, arithmetic, or sign slip during execution',
    icon: '🔢',
  },
  {
    type: 'silly',
    label: 'Silly / Reading Mistake',
    badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
    darkBadgeColor: 'dark:bg-amber-950/80 dark:text-amber-300 dark:border-amber-800',
    description: 'Misread the question, units mismatch, or hurried bubbling',
    icon: '⚡',
  },
  {
    type: 'formula',
    label: 'Formula / Memory Slip',
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    darkBadgeColor: 'dark:bg-emerald-950/80 dark:text-emerald-300 dark:border-emerald-800',
    description: 'Forgot formula constant, sign, or specific constraint',
    icon: '📐',
  },
];

