import { SpacedReview } from '../types';
import { formatLocalDateStr } from './focusAnalytics';

export const DEFAULT_REVIEW_INTERVALS = [1, 3, 7, 14, 30];

/**
 * Calculates a future local date string by adding a given number of days to a base date.
 */
export function addDaysToDateStr(baseDate: Date, days: number): string {
  const result = new Date(baseDate);
  result.setDate(result.getDate() + days);
  return formatLocalDateStr(result);
}

/**
 * Determines if a spaced review is overdue relative to referenceDate.
 * Completed reviews are not overdue.
 */
export function isReviewOverdue(review: SpacedReview, referenceDate: Date = new Date()): boolean {
  if (review.isCompleted) return false;
  const todayStr = formatLocalDateStr(referenceDate);
  return review.dueDate < todayStr;
}

/**
 * Determines if a spaced review is due today.
 */
export function isReviewDueToday(review: SpacedReview, referenceDate: Date = new Date()): boolean {
  if (review.isCompleted) return false;
  const todayStr = formatLocalDateStr(referenceDate);
  return review.dueDate === todayStr;
}

/**
 * Determines if a spaced review is upcoming (due in the future).
 */
export function isReviewUpcoming(review: SpacedReview, referenceDate: Date = new Date()): boolean {
  if (review.isCompleted) return false;
  const todayStr = formatLocalDateStr(referenceDate);
  return review.dueDate > todayStr;
}

/**
 * Gets the interval (in days) for a given repetition level.
 */
export function getIntervalForLevel(level: number, intervals: number[] = DEFAULT_REVIEW_INTERVALS): number {
  const safeIntervals = intervals.length > 0 ? intervals : DEFAULT_REVIEW_INTERVALS;
  if (level <= 0) return safeIntervals[0];
  const idx = Math.min(level, safeIntervals.length - 1);
  return safeIntervals[idx];
}

/**
 * Checks whether an active (uncompleted) review already exists for this topic.
 * Used to prevent duplicate reviews on repeated clicks.
 */
export function hasActiveReviewForTopic(
  reviews: SpacedReview[],
  syllabusTopicId: string
): boolean {
  return reviews.some((r) => r.syllabusTopicId === syllabusTopicId && !r.isCompleted);
}

/**
 * Computes review progress/completion.
 * Advances the review to the next interval without mutating syllabus progress.
 */
export function completeReviewStep(
  review: SpacedReview,
  intervals: number[] = DEFAULT_REVIEW_INTERVALS,
  completionDate: Date = new Date()
): SpacedReview {
  const completedAt = completionDate.toISOString();
  const nextLevel = review.repetitionLevel + 1;
  const nextInterval = getIntervalForLevel(nextLevel, intervals);
  const nextDueDate = addDaysToDateStr(completionDate, nextInterval);

  const historyItem = {
    reviewedAt: completedAt,
    nextDueDate,
  };

  return {
    ...review,
    dueDate: nextDueDate,
    intervalDays: nextInterval,
    repetitionLevel: nextLevel,
    completedAt,
    history: [...(review.history || []), historyItem],
  };
}
