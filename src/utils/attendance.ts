import { Subject } from '../types';

export interface AttendanceMetrics {
  percentage: number; // 0 - 100
  safeSkips: number;  // How many classes can be safely skipped while staying >= target
  neededClasses: number; // How many consecutive classes must be attended to reach target
  status: 'safe' | 'warning' | 'danger';
  formattedPercentage: string;
  summaryText: string;
}

/**
 * Calculates attendance metrics for a single subject.
 * Handles edge cases: 0 conducted, attended > conducted, target boundary conditions.
 * @param targetPct - The attendance requirement percentage (e.g. 75). Uses shared setting.
 */
export function calculateSubjectAttendance(
  attendedRaw: number,
  totalConductedRaw: number,
  targetPct: number = 75
): AttendanceMetrics {
  // Clamp & sanitize inputs
  const totalConducted = Math.max(0, Math.floor(totalConductedRaw));
  const attended = Math.min(totalConducted, Math.max(0, Math.floor(attendedRaw)));
  const target = Math.min(99.9, Math.max(1, targetPct)) / 100;

  if (totalConducted === 0) {
    return {
      percentage: 100,
      safeSkips: 0,
      neededClasses: 0,
      status: 'safe',
      formattedPercentage: '100%',
      summaryText: 'No sessions conducted yet',
    };
  }

  const percentage = (attended / totalConducted) * 100;
  const roundedPct = Math.round(percentage * 10) / 10;
  const formattedPercentage = `${roundedPct}%`;

  if (percentage >= targetPct) {
    // How many classes x can we miss such that attended / (totalConducted + x) >= target
    const safeSkips = Math.max(0, Math.floor((attended - target * totalConducted) / target));

    let status: 'safe' | 'warning' = 'safe';
    if (percentage < targetPct + 5) {
      status = 'warning';
    }

    const summaryText = safeSkips === 0
      ? 'On the threshold: attend next lecture'
      : safeSkips === 1
      ? 'Can miss 1 class safely'
      : `Can miss ${safeSkips} classes safely`;

    return {
      percentage,
      safeSkips,
      neededClasses: 0,
      status,
      formattedPercentage,
      summaryText,
    };
  } else {
    // How many consecutive classes y must be attended
    const neededClasses = Math.max(1, Math.ceil((target * totalConducted - attended) / (1 - target)));

    const summaryText = neededClasses === 1
      ? `Must attend next 1 class to restore ${targetPct}%`
      : `Must attend next ${neededClasses} classes to restore ${targetPct}%`;

    return {
      percentage,
      safeSkips: 0,
      neededClasses,
      status: 'danger',
      formattedPercentage,
      summaryText,
    };
  }
}

/**
 * Calculates aggregate stats across all active subjects.
 * @param defaultTargetPct - The shared attendance requirement.
 */
export function calculateOverallAttendance(
  subjects: Subject[],
  defaultTargetPct: number = 75
): {
  totalAttended: number;
  totalConducted: number;
  overallPercentage: number;
  formattedPercentage: string;
  subjectsAtRiskCount: number;
  safeCount: number;
  status: 'safe' | 'warning' | 'danger';
} {
  if (!subjects.length) {
    return {
      totalAttended: 0,
      totalConducted: 0,
      overallPercentage: 100,
      formattedPercentage: '—',
      subjectsAtRiskCount: 0,
      safeCount: 0,
      status: 'safe',
    };
  }

  let totalAttended = 0;
  let totalConducted = 0;
  let subjectsAtRiskCount = 0;
  let safeCount = 0;

  subjects.forEach((sub) => {
    const subTarget = sub.targetPct || defaultTargetPct;
    const metrics = calculateSubjectAttendance(sub.attended, sub.totalConducted, subTarget);
    totalAttended += Math.min(sub.totalConducted, Math.max(0, sub.attended));
    totalConducted += Math.max(0, sub.totalConducted);

    if (metrics.status === 'danger') {
      subjectsAtRiskCount++;
    } else {
      safeCount++;
    }
  });

  const overallPercentage = totalConducted === 0 ? 100 : (totalAttended / totalConducted) * 100;
  const roundedPct = Math.round(overallPercentage * 10) / 10;

  let status: 'safe' | 'warning' | 'danger' = 'safe';
  if (overallPercentage < defaultTargetPct) {
    status = 'danger';
  } else if (overallPercentage < defaultTargetPct + 5) {
    status = 'warning';
  }

  return {
    totalAttended,
    totalConducted,
    overallPercentage,
    formattedPercentage: `${roundedPct}%`,
    subjectsAtRiskCount,
    safeCount,
    status,
  };
}

/**
 * Check if attendance meets the requirement.
 * Shared helper used across the app.
 */
export function meetsAttendanceRequirement(
  percentage: number,
  requirement: number = 75
): boolean {
  return percentage >= requirement;
}

// Re-export academic calendar & scope resolver utilities
export * from './academicCalendarEngine';
export * from './attendanceScopeResolver';
