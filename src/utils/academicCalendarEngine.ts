import {
  AcademicPeriodType,
  WeeklyHolidaySettings,
  NationalHoliday,
  AcademicCalendarSettings,
} from '../types';
import { formatDateStr } from './scheduleResolver';

export type {
  AcademicPeriodType,
  WeeklyHolidaySettings,
  NationalHoliday,
  AcademicCalendarSettings,
};

export const DEFAULT_WEEKLY_OFF_SETTINGS: WeeklyHolidaySettings = {
  sundayOff: true,
  saturdayOff: false,
};

export const DEFAULT_NATIONAL_HOLIDAYS: NationalHoliday[] = [
  { id: 'hol-newyear', name: "New Year's Day", date: '2026-01-01' },
  { id: 'hol-republic', name: 'Republic Day', date: '2026-01-26' },
  { id: 'hol-independence', name: 'Independence Day', date: '2026-08-15' },
  { id: 'hol-gandhi', name: 'Gandhi Jayanti', date: '2026-10-02' },
  { id: 'hol-diwali', name: 'Diwali', date: '2026-11-08' },
  { id: 'hol-christmas', name: 'Christmas Day', date: '2026-12-25' },
];

/**
 * Get days in month for a given year and month (1-indexed)
 */
export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/**
 * Calculate default end date based on start date and period type:
 * - Semester: 6 calendar months
 * - Academic Year: 12 calendar months (1 year)
 * Correctly clamps month-end dates and respects leap years.
 */
export function calculateDefaultEndDate(
  startDateStr: string,
  periodType: AcademicPeriodType
): string {
  if (!startDateStr || !/^\d{4}-\d{2}-\d{2}$/.test(startDateStr)) {
    return '';
  }

  const [y, m, d] = startDateStr.split('-').map(Number);
  const monthsToAdd = periodType === 'semester' ? 6 : 12;

  let targetYear = y;
  let targetMonth = m;
  let targetDay = d;

  if (d === 1) {
    // If starting on the 1st of a month, the period covers exactly `monthsToAdd` full months
    // e.g. 2026-08-01 + 6 months -> ends on 2027-01-31 (Aug, Sep, Oct, Nov, Dec, Jan)
    const endMonthTotal = m + monthsToAdd - 1;
    targetYear = y + Math.floor((endMonthTotal - 1) / 12);
    targetMonth = ((endMonthTotal - 1) % 12) + 1;
    targetDay = getDaysInMonth(targetYear, targetMonth);
  } else {
    // Starting on day d > 1: ends on day d - 1 after monthsToAdd months
    // e.g. 2026-08-15 + 6 months -> ends on 2027-02-14
    const endMonthTotal = m + monthsToAdd;
    targetYear = y + Math.floor((endMonthTotal - 1) / 12);
    targetMonth = ((endMonthTotal - 1) % 12) + 1;
    const maxDays = getDaysInMonth(targetYear, targetMonth);
    targetDay = Math.min(d - 1, maxDays);
  }

  const pad = (n: number) => String(n).padStart(2, '0');
  return `${targetYear}-${pad(targetMonth)}-${pad(targetDay)}`;
}

/**
 * Create default academic calendar settings
 */
export function createDefaultAcademicSettings(
  periodType: AcademicPeriodType = 'semester',
  startDateOverride?: string
): AcademicCalendarSettings {
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const startDate = startDateOverride || `${y}-${m}-01`;
  const endDate = calculateDefaultEndDate(startDate, periodType);

  return {
    periodType,
    startDate,
    endDate,
    isManualEndDate: false,
    weeklyOffDays: { ...DEFAULT_WEEKLY_OFF_SETTINGS },
    nationalHolidays: [...DEFAULT_NATIONAL_HOLIDAYS],
  };
}

/**
 * Check if a given Date is a configured weekly off day
 */
export function isWeeklyOffDay(
  date: Date,
  weeklyOff: WeeklyHolidaySettings
): boolean {
  const day = date.getDay(); // 0 = Sun, 6 = Sat
  if (day === 0 && weeklyOff.sundayOff) return true;
  if (day === 6 && weeklyOff.saturdayOff) return true;
  return false;
}

/**
 * Check if a given date string is in the national holidays list
 */
export function findNationalHoliday(
  dateStr: string,
  holidays: NationalHoliday[]
): NationalHoliday | undefined {
  return holidays.find((h) => h.date === dateStr);
}

export interface AcademicDaySummary {
  totalCalendarDays: number;
  potentialWorkingDays: number;
  weeklyOffDaysCount: number;
  nationalHolidaysCount: number;
}

/**
 * Resolves working days, off days, and holidays for an academic period [startDate, endDate] inclusive
 */
export function resolveAcademicPeriodDays(
  startDateStr: string,
  endDateStr: string,
  weeklyOff: WeeklyHolidaySettings,
  holidays: NationalHoliday[]
): AcademicDaySummary {
  if (!startDateStr || !endDateStr || startDateStr > endDateStr) {
    return {
      totalCalendarDays: 0,
      potentialWorkingDays: 0,
      weeklyOffDaysCount: 0,
      nationalHolidaysCount: 0,
    };
  }

  const [sy, sm, sd] = startDateStr.split('-').map(Number);
  const [ey, em, ed] = endDateStr.split('-').map(Number);

  const start = new Date(sy, sm - 1, sd);
  const end = new Date(ey, em - 1, ed);

  let totalCalendarDays = 0;
  let potentialWorkingDays = 0;
  let weeklyOffDaysCount = 0;
  let nationalHolidaysCount = 0;

  const current = new Date(start);
  while (current <= end) {
    totalCalendarDays++;
    const dateStr = formatDateStr(current);
    const isOff = isWeeklyOffDay(current, weeklyOff);
    const holiday = findNationalHoliday(dateStr, holidays);

    if (isOff) {
      weeklyOffDaysCount++;
    }

    if (holiday) {
      nationalHolidaysCount++;
    }

    // A potential working day is neither a weekly off day nor a national holiday
    if (!isOff && !holiday) {
      potentialWorkingDays++;
    }

    current.setDate(current.getDate() + 1);
  }

  return {
    totalCalendarDays,
    potentialWorkingDays,
    weeklyOffDaysCount,
    nationalHolidaysCount,
  };
}

// ---------------------------------------------------------------------------
// ATTENDANCE CALCULATION FORMULAS
// ---------------------------------------------------------------------------

export interface SubjectAttendanceMetrics {
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  subjectColor?: string;
  totalScheduled: number;
  attended: number;
  absent: number;
  cancelled: number;
  futureOrUnmarked: number;
  effectiveConducted: number; // attended + absent
  percentage: number;
  formattedPercentage: string;
  safeSkips: number;
  neededClasses: number;
  targetPercentage: number;
  status: 'safe' | 'warning' | 'danger';
  summaryText: string;
}

export interface AggregateAttendanceMetrics {
  totalAttended: number;
  totalAbsent: number;
  totalCancelled: number;
  totalConducted: number; // sum of (attended + absent)
  totalScheduled: number;
  aggregatePercentage: number;
  formattedPercentage: string;
  subjectsCount: number;
  subjectsAtRiskCount: number;
  safeCount: number;
  status: 'safe' | 'warning' | 'danger';
}

/**
 * Calculates subject-wise attendance metrics strictly adhering to:
 * - attended count in numerator and denominator
 * - absent count in denominator
 * - cancelled excluded from denominator
 * - future/unmarked excluded from denominator
 * - percentage = (attended / (attended + absent)) * 100
 * - safe skips: floor((attended - target * conducted) / target)
 * - needed classes: ceil((target * conducted - attended) / (1 - target))
 */
export function calculateSubjectAttendanceFromCounts(
  subjectId: string,
  subjectCode: string,
  subjectName: string,
  attendedRaw: number,
  absentRaw: number,
  cancelledRaw: number,
  totalScheduledRaw: number,
  targetPct: number = 75,
  subjectColor?: string
): SubjectAttendanceMetrics {
  const attended = Math.max(0, Math.floor(attendedRaw));
  const absent = Math.max(0, Math.floor(absentRaw));
  const cancelled = Math.max(0, Math.floor(cancelledRaw));
  const effectiveConducted = attended + absent;
  const totalScheduled = Math.max(effectiveConducted + cancelled, Math.floor(totalScheduledRaw));
  const futureOrUnmarked = Math.max(0, totalScheduled - effectiveConducted - cancelled);

  const target = Math.min(99.9, Math.max(1, targetPct)) / 100;

  if (effectiveConducted === 0) {
    return {
      subjectId,
      subjectCode,
      subjectName,
      subjectColor,
      totalScheduled,
      attended: 0,
      absent: 0,
      cancelled,
      futureOrUnmarked,
      effectiveConducted: 0,
      percentage: 100,
      formattedPercentage: '—',
      safeSkips: 0,
      neededClasses: 0,
      targetPercentage: targetPct,
      status: 'safe',
      summaryText: 'No sessions held yet',
    };
  }

  const percentage = (attended / effectiveConducted) * 100;
  const roundedPct = Math.round(percentage * 10) / 10;
  const formattedPercentage = `${roundedPct}%`;

  if (percentage >= targetPct) {
    const safeSkips = Math.max(
      0,
      Math.floor((attended - target * effectiveConducted) / target)
    );

    let status: 'safe' | 'warning' = 'safe';
    if (percentage < targetPct + 5) {
      status = 'warning';
    }

    const summaryText =
      safeSkips === 0
        ? 'On the threshold: attend next lecture'
        : safeSkips === 1
        ? 'Can miss 1 class safely'
        : `Can miss ${safeSkips} classes safely`;

    return {
      subjectId,
      subjectCode,
      subjectName,
      subjectColor,
      totalScheduled,
      attended,
      absent,
      cancelled,
      futureOrUnmarked,
      effectiveConducted,
      percentage,
      formattedPercentage,
      safeSkips,
      neededClasses: 0,
      targetPercentage: targetPct,
      status,
      summaryText,
    };
  } else {
    const neededClasses = Math.max(
      1,
      Math.ceil((target * effectiveConducted - attended) / (1 - target))
    );

    const summaryText =
      neededClasses === 1
        ? `Must attend next 1 class to restore ${targetPct}%`
        : `Must attend next ${neededClasses} classes to restore ${targetPct}%`;

    return {
      subjectId,
      subjectCode,
      subjectName,
      subjectColor,
      totalScheduled,
      attended,
      absent,
      cancelled,
      futureOrUnmarked,
      effectiveConducted,
      percentage,
      formattedPercentage,
      safeSkips: 0,
      neededClasses,
      targetPercentage: targetPct,
      status: 'danger',
      summaryText,
    };
  }
}

/**
 * Calculates weighted aggregate attendance across all subjects in the current scope.
 * Formula: (sum(attended) / sum(attended + absent)) * 100.
 * Never a simple arithmetic average of subject percentages.
 */
export function calculateWeightedAggregateAttendance(
  subjectMetrics: SubjectAttendanceMetrics[],
  targetPct: number = 75
): AggregateAttendanceMetrics {
  if (!subjectMetrics || subjectMetrics.length === 0) {
    return {
      totalAttended: 0,
      totalAbsent: 0,
      totalCancelled: 0,
      totalConducted: 0,
      totalScheduled: 0,
      aggregatePercentage: 100,
      formattedPercentage: '—',
      subjectsCount: 0,
      subjectsAtRiskCount: 0,
      safeCount: 0,
      status: 'safe',
    };
  }

  let totalAttended = 0;
  let totalAbsent = 0;
  let totalCancelled = 0;
  let totalScheduled = 0;
  let subjectsAtRiskCount = 0;
  let safeCount = 0;

  for (const m of subjectMetrics) {
    totalAttended += m.attended;
    totalAbsent += m.absent;
    totalCancelled += m.cancelled;
    totalScheduled += m.totalScheduled;

    if (m.effectiveConducted > 0 && m.status === 'danger') {
      subjectsAtRiskCount++;
    } else {
      safeCount++;
    }
  }

  const totalConducted = totalAttended + totalAbsent;
  const aggregatePercentage =
    totalConducted === 0 ? 100 : (totalAttended / totalConducted) * 100;
  const roundedPct = Math.round(aggregatePercentage * 10) / 10;

  let status: 'safe' | 'warning' | 'danger' = 'safe';
  if (totalConducted > 0) {
    if (aggregatePercentage < targetPct) {
      status = 'danger';
    } else if (aggregatePercentage < targetPct + 5) {
      status = 'warning';
    }
  }

  return {
    totalAttended,
    totalAbsent,
    totalCancelled,
    totalConducted,
    totalScheduled,
    aggregatePercentage,
    formattedPercentage: totalConducted === 0 ? '—' : `${roundedPct}%`,
    subjectsCount: subjectMetrics.length,
    subjectsAtRiskCount,
    safeCount,
    status,
  };
}
