import { StudySession } from '../types';

export interface DayFocusMetric {
  date: Date;
  dateStr: string; // YYYY-MM-DD
  dayName: string;
  dayShort: string;
  minutes: number;
  sessionCount: number;
  completedCount: number;
  isToday: boolean;
}

export interface FocusSummaryMetrics {
  todayMinutes: number;
  last7DaysMinutes: number;
  completedSessions7d: number;
  totalCompletedSessions: number;
  averageSessionMinutes: number;
  longestSessionMinutes: number;
  dailyRollingAverage7d: number;
}

export interface StudyStreakMetrics {
  currentStreak: number;
  longestStreak: number;
  hasStudiedToday: boolean;
  qualifyingDaysCount: number;
}

export interface ProductivityInsights {
  mostProductiveHour: { hour: number; label: string; minutes: number } | null;
  bestDayOfWeek: { dayIndex: number; name: string; minutes: number } | null;
  topSubject: { subjectName: string; minutes: number; sessionCount: number } | null;
  weekComparison: {
    current7DaysMinutes: number;
    previous7DaysMinutes: number;
    differenceMinutes: number;
    percentageChange: number | null; // null if previous was 0
  };
  hasSufficientData: boolean;
  dataNotice?: string;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_SHORTS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Format Date to local YYYY-MM-DD
 */
export function formatLocalDateStr(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Extract local date string YYYY-MM-DD from session timestamp,
 * optionally adjusted by a custom study-day rollover hour (0..23).
 */
export function getSessionLocalDateStr(session: StudySession, rolloverHour: number = 0): string {
  const date = new Date(session.timestamp);
  if (isNaN(date.getTime())) return '';

  if (rolloverHour > 0) {
    // If rolloverHour is e.g. 4 (4 AM), any session between 00:00 and 03:59 belongs to the previous calendar day
    const adjusted = new Date(date);
    if (adjusted.getHours() < rolloverHour) {
      adjusted.setDate(adjusted.getDate() - 1);
    }
    return formatLocalDateStr(adjusted);
  }

  return formatLocalDateStr(date);
}

/**
 * Check if a session counts towards actual focused time.
 * - Completed sessions count.
 * - Interrupted sessions with elapsed focus time > 0 count for their actual elapsed minutes.
 * - Cancelled sessions do NOT count.
 */
export function isQualifyingFocusSession(session: StudySession): boolean {
  if (session.status === 'cancelled') return false;
  return session.durationMinutes > 0;
}

/**
 * Check if a session qualifies towards a study streak.
 * Must be 'completed' (or legacy session without status) with duration >= 1 min.
 * Interrupted and cancelled sessions do not count as completed study sessions for streak qualification.
 */
export function isCompletedStreakSession(session: StudySession): boolean {
  if (session.status && session.status !== 'completed') return false;
  return session.durationMinutes >= 1;
}

/**
 * Calculates daily focused minutes for the latest 7 calendar days ending on referenceDate.
 * Always returns exactly 7 items (oldest to newest), including days with 0 minutes.
 */
export function calculateSevenDayFocus(
  sessions: StudySession[],
  referenceDate: Date = new Date(),
  rolloverHour: number = 0
): DayFocusMetric[] {
  const result: DayFocusMetric[] = [];
  const todayStr = formatLocalDateStr(referenceDate);

  // Map qualifying sessions to dateStr
  const sessionsByDate = new Map<string, StudySession[]>();
  for (const session of sessions) {
    if (!isQualifyingFocusSession(session)) continue;
    const dateStr = getSessionLocalDateStr(session, rolloverHour);
    if (!dateStr) continue;
    const list = sessionsByDate.get(dateStr) || [];
    list.push(session);
    sessionsByDate.set(dateStr, list);
  }

  // Generate 7 days ending at referenceDate
  for (let i = 6; i >= 0; i--) {
    const d = new Date(referenceDate);
    d.setDate(referenceDate.getDate() - i);
    d.setHours(0, 0, 0, 0);

    const dateStr = formatLocalDateStr(d);
    const daySessions = sessionsByDate.get(dateStr) || [];

    const minutes = daySessions.reduce((acc, s) => acc + s.durationMinutes, 0);
    const sessionCount = daySessions.length;
    const completedCount = daySessions.filter((s) => s.status === 'completed' || !s.status).length;

    result.push({
      date: d,
      dateStr,
      dayName: DAY_NAMES[d.getDay()],
      dayShort: DAY_SHORTS[d.getDay()],
      minutes,
      sessionCount,
      completedCount,
      isToday: dateStr === todayStr,
    });
  }

  return result;
}

/**
 * Calculates daily focused minutes for the latest 365 calendar days ending on referenceDate.
 * Returns an array of DayFocusMetric objects ordered from oldest to newest,
 * including days with zero minutes. This is used by the Journey heatmap.
 */
export function calculateYearlyFocus(
  sessions: StudySession[],
  referenceDate: Date = new Date(),
  rolloverHour: number = 0
): DayFocusMetric[] {
  const result: DayFocusMetric[] = [];
  const todayStr = formatLocalDateStr(referenceDate);

  // Map qualifying sessions to dateStr
  const sessionsByDate = new Map<string, StudySession[]>();
  for (const session of sessions) {
    if (!isQualifyingFocusSession(session)) continue;
    const dateStr = getSessionLocalDateStr(session, rolloverHour);
    if (!dateStr) continue;
    const list = sessionsByDate.get(dateStr) || [];
    list.push(session);
    sessionsByDate.set(dateStr, list);
  }

  // Generate 365 days ending at referenceDate (including today)
  for (let i = 364; i >= 0; i--) {
    const d = new Date(referenceDate);
    d.setDate(referenceDate.getDate() - i);
    d.setHours(0, 0, 0, 0);
    const dateStr = formatLocalDateStr(d);
    const daySessions = sessionsByDate.get(dateStr) || [];
    const minutes = daySessions.reduce((acc, s) => acc + s.durationMinutes, 0);
    const sessionCount = daySessions.length;
    const completedCount = daySessions.filter((s) => s.status === 'completed' || !s.status).length;
    result.push({
      date: d,
      dateStr,
      dayName: DAY_NAMES[d.getDay()],
      dayShort: DAY_SHORTS[d.getDay()],
      minutes,
      sessionCount,
      completedCount,
      isToday: dateStr === todayStr,
    });
  }
  return result;
}


/**
 * Calculate Summary Metrics (Today, 7-Day total, completed counts, averages).
 */
export function calculateFocusSummaries(
  sessions: StudySession[],
  referenceDate: Date = new Date(),
  rolloverHour: number = 0
): FocusSummaryMetrics {
  const sevenDays = calculateSevenDayFocus(sessions, referenceDate, rolloverHour);
  const todayStr = formatLocalDateStr(referenceDate);

  const todayMetric = sevenDays.find((d) => d.dateStr === todayStr);
  const todayMinutes = todayMetric ? todayMetric.minutes : 0;

  const last7DaysMinutes = sevenDays.reduce((acc, d) => acc + d.minutes, 0);
  const completedSessions7d = sevenDays.reduce((acc, d) => acc + d.completedCount, 0);

  // All-time completed sessions
  const allCompleted = sessions.filter(
    (s) => (s.status === 'completed' || !s.status) && s.durationMinutes > 0
  );
  const totalCompletedSessions = allCompleted.length;

  const longestSessionMinutes = allCompleted.reduce(
    (max, s) => Math.max(max, s.durationMinutes),
    0
  );

  const totalCompletedMins = allCompleted.reduce((acc, s) => acc + s.durationMinutes, 0);
  const averageSessionMinutes =
    allCompleted.length > 0 ? Math.round(totalCompletedMins / allCompleted.length) : 0;

  // 7-day daily rolling average (including zero days)
  const dailyRollingAverage7d = Math.round((last7DaysMinutes / 7) * 10) / 10;

  return {
    todayMinutes,
    last7DaysMinutes,
    completedSessions7d,
    totalCompletedSessions,
    averageSessionMinutes,
    longestSessionMinutes,
    dailyRollingAverage7d,
  };
}

/**
 * Calculate study streaks based on completed study days.
 * A day qualifies if it contains at least 1 completed focus session.
 */
export function calculateStudyStreaks(
  sessions: StudySession[],
  referenceDate: Date = new Date(),
  rolloverHour: number = 0
): StudyStreakMetrics {
  const completedDatesSet = new Set<string>();

  for (const session of sessions) {
    if (isCompletedStreakSession(session)) {
      const dateStr = getSessionLocalDateStr(session, rolloverHour);
      if (dateStr) {
        completedDatesSet.add(dateStr);
      }
    }
  }

  const qualifyingDaysCount = completedDatesSet.size;
  if (qualifyingDaysCount === 0) {
    return {
      currentStreak: 0,
      longestStreak: 0,
      hasStudiedToday: false,
      qualifyingDaysCount: 0,
    };
  }

  const todayStr = formatLocalDateStr(referenceDate);
  const hasStudiedToday = completedDatesSet.has(todayStr);

  // Calculate current streak
  // If studied today, start counting back from today.
  // If not studied today, check if studied yesterday. If yes, streak is maintained ending yesterday.
  // If not studied yesterday either, current streak is 0.
  let currentStreak = 0;
  const cursor = new Date(referenceDate);
  cursor.setHours(0, 0, 0, 0);

  if (hasStudiedToday) {
    while (true) {
      const dStr = formatLocalDateStr(cursor);
      if (completedDatesSet.has(dStr)) {
        currentStreak++;
        cursor.setDate(cursor.getDate() - 1);
      } else {
        break;
      }
    }
  } else {
    // Check yesterday
    cursor.setDate(cursor.getDate() - 1);
    const yesterdayStr = formatLocalDateStr(cursor);
    if (completedDatesSet.has(yesterdayStr)) {
      while (true) {
        const dStr = formatLocalDateStr(cursor);
        if (completedDatesSet.has(dStr)) {
          currentStreak++;
          cursor.setDate(cursor.getDate() - 1);
        } else {
          break;
        }
      }
    } else {
      currentStreak = 0;
    }
  }

  // Calculate longest historical streak
  const sortedDates = Array.from(completedDatesSet).sort();
  let longestStreak = 0;
  let runningStreak = 0;
  let prevDate: Date | null = null;

  for (const dStr of sortedDates) {
    const [y, m, d] = dStr.split('-').map(Number);
    const currentDate = new Date(y, m - 1, d);

    if (!prevDate) {
      runningStreak = 1;
    } else {
      const diffMs = currentDate.getTime() - prevDate.getTime();
      const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays === 1) {
        runningStreak++;
      } else if (diffDays > 1) {
        runningStreak = 1;
      }
    }

    prevDate = currentDate;
    longestStreak = Math.max(longestStreak, runningStreak);
  }

  return {
    currentStreak,
    longestStreak,
    hasStudiedToday,
    qualifyingDaysCount,
  };
}

/**
 * Calculate productivity insights based on qualifying session history.
 */
export function calculateProductivityInsights(
  sessions: StudySession[],
  referenceDate: Date = new Date(),
  rolloverHour: number = 0
): ProductivityInsights {
  const qualifying = sessions.filter(isQualifyingFocusSession);

  // Check sufficient data (at least 3 qualifying sessions)
  if (qualifying.length < 3) {
    return {
      mostProductiveHour: null,
      bestDayOfWeek: null,
      topSubject: null,
      weekComparison: {
        current7DaysMinutes: qualifying.reduce((acc, s) => acc + s.durationMinutes, 0),
        previous7DaysMinutes: 0,
        differenceMinutes: 0,
        percentageChange: null,
      },
      hasSufficientData: false,
      dataNotice: 'Log at least 3 completed focus sessions to unlock personalized productivity trends.',
    };
  }

  // 1. Most productive hour of day (0..23)
  const hourMinutes = new Array(24).fill(0);
  for (const s of qualifying) {
    const d = new Date(s.startTime || s.timestamp);
    if (!isNaN(d.getTime())) {
      const h = d.getHours();
      hourMinutes[h] += s.durationMinutes;
    }
  }

  let bestHour = 0;
  let maxHourMins = 0;
  for (let h = 0; h < 24; h++) {
    if (hourMinutes[h] > maxHourMins) {
      maxHourMins = hourMinutes[h];
      bestHour = h;
    }
  }

  const formatHour = (h: number): string => {
    const startPeriod = h >= 12 ? 'PM' : 'AM';
    const startH = h % 12 === 0 ? 12 : h % 12;
    const nextH = (h + 1) % 24;
    const endPeriod = nextH >= 12 ? 'PM' : 'AM';
    const endDisp = nextH % 12 === 0 ? 12 : nextH % 12;
    return `${startH}:00 ${startPeriod} – ${endDisp}:00 ${endPeriod}`;
  };

  const mostProductiveHour =
    maxHourMins > 0
      ? { hour: bestHour, label: formatHour(bestHour), minutes: maxHourMins }
      : null;

  // 2. Best day of week (0=Sunday..6=Saturday)
  const dowMinutes = new Array(7).fill(0);
  for (const s of qualifying) {
    const d = new Date(s.timestamp);
    if (!isNaN(d.getTime())) {
      dowMinutes[d.getDay()] += s.durationMinutes;
    }
  }

  let bestDow = 0;
  let maxDowMins = 0;
  for (let dow = 0; dow < 7; dow++) {
    if (dowMinutes[dow] > maxDowMins) {
      maxDowMins = dowMinutes[dow];
      bestDow = dow;
    }
  }

  const bestDayOfWeek =
    maxDowMins > 0
      ? { dayIndex: bestDow, name: DAY_NAMES[bestDow], minutes: maxDowMins }
      : null;

  // 3. Most focused subject (exclude sessions without subject)
  const subjectMap = new Map<string, { minutes: number; sessionCount: number }>();
  for (const s of qualifying) {
    const name = s.subjectName?.trim();
    if (name) {
      const cur = subjectMap.get(name) || { minutes: 0, sessionCount: 0 };
      cur.minutes += s.durationMinutes;
      cur.sessionCount++;
      subjectMap.set(name, cur);
    }
  }

  let topSubject: { subjectName: string; minutes: number; sessionCount: number } | null = null;
  for (const [name, stats] of subjectMap.entries()) {
    if (!topSubject || stats.minutes > topSubject.minutes) {
      topSubject = { subjectName: name, minutes: stats.minutes, sessionCount: stats.sessionCount };
    }
  }

  // 4. Week comparison: Current 7 days (day 0..6 ago) vs Previous 7 days (day 7..13 ago)
  const today = new Date(referenceDate);
  today.setHours(0, 0, 0, 0);

  let current7DaysMinutes = 0;
  let previous7DaysMinutes = 0;

  for (const s of qualifying) {
    const dateStr = getSessionLocalDateStr(s, rolloverHour);
    if (!dateStr) continue;

    const [y, m, d] = dateStr.split('-').map(Number);
    const sessionDate = new Date(y, m - 1, d);
    const diffDays = Math.round((today.getTime() - sessionDate.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays >= 0 && diffDays < 7) {
      current7DaysMinutes += s.durationMinutes;
    } else if (diffDays >= 7 && diffDays < 14) {
      previous7DaysMinutes += s.durationMinutes;
    }
  }

  const differenceMinutes = current7DaysMinutes - previous7DaysMinutes;
  const percentageChange =
    previous7DaysMinutes > 0
      ? Math.round(((current7DaysMinutes - previous7DaysMinutes) / previous7DaysMinutes) * 100)
      : null;

  return {
    mostProductiveHour,
    bestDayOfWeek,
    topSubject,
    weekComparison: {
      current7DaysMinutes,
      previous7DaysMinutes,
      differenceMinutes,
      percentageChange,
    },
    hasSufficientData: true,
  };
}

