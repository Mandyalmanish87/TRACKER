/**
 * Student Tracker — Academic-Fitness Timetable Synergy Engine
 * Document ID: FITNESS-M06-INTEL-DASHBOARD
 *
 * Deterministic algorithms:
 * - Free workout window detection between lectures and study blocks
 * - Exam season academic deload recommendations (within 7 days)
 * - Zero mutation of academic timetable state
 */

import { TimetableSlot, ResolvedCalendarEvent } from '../types';

export interface WorkoutWindow {
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
  durationMinutes: number;
  label: string;
  context: string;
}

export interface ExamDeloadEvaluation {
  isExamSoon: boolean;
  daysRemaining: number;
  recommendation?: string;
}

/**
 * Finds optimal free workout windows during a student's day.
 * Analyzes scheduled timetable slots and finds gaps >= 60 minutes.
 */
export function findOptimalWorkoutWindows(
  todaySlots: (TimetableSlot | ResolvedCalendarEvent)[],
  dayStartTimeOrMinGap?: string | number,
  dayEndTimeOrMinGap?: string | number,
  minGapMinutesParam: number = 60
): WorkoutWindow[] {
  const windows: WorkoutWindow[] = [];

  // If no classes today, entire day is open
  if (!todaySlots || todaySlots.length === 0) {
    return [
      {
        startTime: '10:00',
        endTime: '12:00',
        durationMinutes: 120,
        label: 'Open Academic Schedule',
        context: 'No classes scheduled today. Flexible workout timing all day.',
      },
    ];
  }

  // Sort slots by start time
  const sorted = [...todaySlots].sort((a, b) => a.startTime.localeCompare(b.startTime));

  const timeToMinutes = (t: string): number => {
    const [h, m] = t.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };

  const minutesToTime = (min: number): string => {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  let dayStartTime = '08:00';
  let dayEndTime = '21:00';
  let minGapMinutes = minGapMinutesParam;
  let cursor = timeToMinutes(dayStartTime);
  let checkBeforeFirstClass = true;

  if (typeof dayStartTimeOrMinGap === 'number') {
    minGapMinutes = dayStartTimeOrMinGap;
    cursor = timeToMinutes(sorted[0].endTime);
    checkBeforeFirstClass = false;
  } else if (typeof dayStartTimeOrMinGap === 'string') {
    dayStartTime = dayStartTimeOrMinGap;
    cursor = timeToMinutes(dayStartTime);
  }

  if (typeof dayEndTimeOrMinGap === 'number') {
    minGapMinutes = dayEndTimeOrMinGap;
  } else if (typeof dayEndTimeOrMinGap === 'string') {
    dayEndTime = dayEndTimeOrMinGap;
  }

  const startIndex = checkBeforeFirstClass ? 0 : 1;

  for (let i = startIndex; i < sorted.length; i++) {
    const slot = sorted[i];
    const slotStart = timeToMinutes(slot.startTime);
    const slotEnd = timeToMinutes(slot.endTime);

    // Gap before this slot
    if (slotStart - cursor >= minGapMinutes) {
      const dur = slotStart - cursor;
      windows.push({
        startTime: minutesToTime(cursor),
        endTime: minutesToTime(slotStart),
        durationMinutes: dur,
        label: i === 0 ? 'Pre-Lecture Morning Window' : 'Midday Gap Between Classes',
        context: `Free ${dur}m block before ${slot.startTime}.`,
      });
    }

    cursor = Math.max(cursor, slotEnd);
  }

  // Check window after last class
  const dayEndMin = timeToMinutes(dayEndTime);
  if (dayEndMin - cursor >= minGapMinutes) {
    const dur = dayEndMin - cursor;
    windows.push({
      startTime: minutesToTime(cursor),
      endTime: minutesToTime(dayEndMin),
      durationMinutes: dur,
      label: 'Post-Lecture Evening Slot',
      context: `Free evening time after final class ends at ${minutesToTime(cursor)}.`,
    });
  }

  return windows;
}

/**
 * Checks if final examinations are approaching within 7 days
 * and generates an Academic Deload suggestion.
 */
export function evaluateExamDeloadStatus(
  examDateStr?: string,
  today: Date = new Date()
): ExamDeloadEvaluation {
  if (!examDateStr) {
    return { isExamSoon: false, daysRemaining: -1 };
  }

  let examMidnight: Date;
  if (/^\d{4}-\d{2}-\d{2}$/.test(examDateStr)) {
    const [y, m, d] = examDateStr.split('-').map(Number);
    examMidnight = new Date(y, m - 1, d);
  } else {
    const examDate = new Date(examDateStr);
    if (isNaN(examDate.getTime())) {
      return { isExamSoon: false, daysRemaining: -1 };
    }
    examMidnight = new Date(examDate.getFullYear(), examDate.getMonth(), examDate.getDate());
  }

  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const diffMs = examMidnight.getTime() - todayMidnight.getTime();
  const daysRemaining = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (daysRemaining >= 0 && daysRemaining <= 7) {
    return {
      isExamSoon: true,
      daysRemaining,
      recommendation: `Academic exam is in ${daysRemaining === 0 ? 'today' : `${daysRemaining} day${daysRemaining > 1 ? 's' : ''}`}. Activate Academic Deload? Reduce training volume: we recommend reducing training sets by 40% and keeping sessions under 45 minutes to protect cognitive energy and sleep.`,
    };
  }

  return { isExamSoon: false, daysRemaining };
}
