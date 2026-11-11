import {
  Subject,
  TimetableSlot,
  OccurrenceOverride,
  ExtraClass,
  AttendanceLog,
  AppSettings,
  ResolvedCalendarEvent,
} from '../types';
import {
  ClassSpaceWorkspace,
  ClassSpaceMember,
  ClassTimetableRule,
  ClassTimetableOverride,
  ClassAttendanceRecord,
  ResolvedClassOccurrence,
} from '../types/classSpace';
import {
  AcademicCalendarSettings,
  AcademicDaySummary,
  SubjectAttendanceMetrics,
  AggregateAttendanceMetrics,
  createDefaultAcademicSettings,
  resolveAcademicPeriodDays,
  calculateSubjectAttendanceFromCounts,
  calculateWeightedAggregateAttendance,
} from './academicCalendarEngine';
import { resolveSchedule, formatDateStr, parseDateStr, dateToDayOfWeek } from './scheduleResolver';
import { resolveClassSchedule } from './classSpaceUtils';
import { getEventHolidayRanges, isEventHolidayOnDate, mergeEventHolidays } from './eventHolidayCalendar';

export interface AttendanceScopeData {
  mode: 'individual' | 'class_based';
  workspaceName?: string;
  workspaceId?: string;
  role?: string;
  academicCalendar: AcademicCalendarSettings;
  academicSummary: AcademicDaySummary;
  subjectMetrics: SubjectAttendanceMetrics[];
  aggregateMetrics: AggregateAttendanceMetrics;
  scheduledOccurrences: ResolvedCalendarEvent[];
  todayOccurrences: ResolvedCalendarEvent[];
  hasWorkspaces: boolean;
  isEmpty: boolean;
  targetRequirement: number;
}

export interface ResolveScopeParams {
  userMode: 'individual' | 'class_based';
  appState: {
    subjects: Subject[];
    timetable: TimetableSlot[];
    occurrenceOverrides?: OccurrenceOverride[];
    extraClasses?: ExtraClass[];
    attendanceLogs: AttendanceLog[];
    events?: import('../types').CalendarEvent[];
    settings?: AppSettings;
  };
  classSpace?: {
    workspaces: ClassSpaceWorkspace[];
    activeWorkspace: ClassSpaceWorkspace | null;
    currentMember: ClassSpaceMember | null;
    rules: ClassTimetableRule[];
    overrides: ClassTimetableOverride[];
    attendanceRecords: ClassAttendanceRecord[];
  } | null;
  effectiveUserId?: string;
  targetRequirement?: number;
}

/**
 * Pure resolver that calculates all subject-wise metrics, aggregate attendance,
 * academic period summary, and scheduled occurrences scoped to either:
 * 1. Individual mode: personal subjects, timetable, logs, and calendar settings
 * 2. Class-Based mode: selected ClassSpace's shared schedule with authenticated student's personal attendance
 */
export function resolveAttendanceScope(params: ResolveScopeParams): AttendanceScopeData {
  const { userMode, appState, classSpace, targetRequirement: targetReqParam } = params;
  const targetRequirement =
    targetReqParam ?? appState.settings?.attendanceRequirement ?? 75;

  const todayStr = formatDateStr(new Date());
  const eventHolidays = getEventHolidayRanges(appState.events || []);

  // -------------------------------------------------------------------------
  // 1. CLASS-BASED MODE
  // -------------------------------------------------------------------------
  if (userMode === 'class_based') {
    const workspaces = classSpace?.workspaces || [];
    const activeWs = classSpace?.activeWorkspace || (workspaces.length > 0 ? workspaces[0] : null);

    if (!activeWs) {
      const defaultCal = createDefaultAcademicSettings('semester');
      return {
        mode: 'class_based',
        academicCalendar: defaultCal,
        academicSummary: resolveAcademicPeriodDays(
          defaultCal.startDate,
          defaultCal.endDate,
          defaultCal.weeklyOffDays,
          mergeEventHolidays(defaultCal.nationalHolidays, eventHolidays)
        ),
        subjectMetrics: [],
        aggregateMetrics: calculateWeightedAggregateAttendance([], targetRequirement),
        scheduledOccurrences: [],
        todayOccurrences: [],
        hasWorkspaces: workspaces.length > 0,
        isEmpty: true,
        targetRequirement,
      };
    }

    const academicCalendar =
      activeWs.academicCalendar || createDefaultAcademicSettings('semester');

    const academicSummary = resolveAcademicPeriodDays(
      academicCalendar.startDate,
      academicCalendar.endDate,
      academicCalendar.weeklyOffDays,
      mergeEventHolidays(academicCalendar.nationalHolidays, eventHolidays)
    );

    // Resolve occurrences within academic period [startDate, endDate]
    const periodStart = parseDateStr(academicCalendar.startDate);
    const periodEnd = parseDateStr(academicCalendar.endDate);

    const classOccurrences: ResolvedClassOccurrence[] = resolveClassSchedule(
      classSpace?.rules || [],
      classSpace?.overrides || [],
      periodStart,
      periodEnd
    );

    // Convert to ResolvedCalendarEvent format for calendar UI compatibility
    const scheduledOccurrences: ResolvedCalendarEvent[] = classOccurrences.map((occ) => ({
      occurrenceKey: occ.occurrenceKey,
      slotId: occ.ruleId,
      extraClassId: occ.source === 'extra' ? occ.overrideId : undefined,
      overrideId: occ.overrideId,
      subjectId: occ.ruleId || occ.overrideId || occ.occurrenceKey,
      dayOfWeek: occ.date ? dateToDayOfWeek(parseDateStr(occ.date)) : 1,
      date: occ.date,
      startTime: occ.startTime,
      endTime: occ.endTime,
      room: occ.room,
      instructor: occ.instructor,
      notes: occ.notes,
      source: occ.source,
      isCancelled: occ.isCancelled || isEventHolidayOnDate(occ.date, eventHolidays),
      changeNote: isEventHolidayOnDate(occ.date, eventHolidays) ? 'Holiday' : occ.changeNote,
    }));

    const todayOccurrences = scheduledOccurrences.filter((o) => o.date === todayStr);

    // Index attendance records of the student: occurrenceKey -> ClassAttendanceRecord
    // In ClassSpaceContext / service, attendanceRecords is ALREADY strictly scoped to effectiveUser.id
    const attMap = new Map<string, ClassAttendanceRecord>();
    for (const rec of classSpace?.attendanceRecords || []) {
      attMap.set(rec.occurrenceKey, rec);
    }

    // Helper to safely normalize subject codes
    const normalizeSubCode = (code?: string, name?: string) => {
      const c = (code || '').toUpperCase().trim();
      if (c) return c;
      const n = (name || '').toUpperCase().trim();
      if (n) return n.slice(0, 8);
      return 'ACAD';
    };

    // Identify unique subjects from rules and extra class overrides
    const subjectMap = new Map<
      string,
      { code: string; name: string; color: string; id: string }
    >();

    for (const r of classSpace?.rules || []) {
      const code = normalizeSubCode(r.subjectCode, r.subjectName);
      if (!subjectMap.has(code)) {
        subjectMap.set(code, {
          id: r.id,
          code: r.subjectCode || code,
          name: r.subjectName || code,
          color: r.subjectColor || '#B45309',
        });
      }
    }

    for (const o of classSpace?.overrides || []) {
      if (o.type === 'extra' && (o.subjectCode || o.subjectName)) {
        const code = normalizeSubCode(o.subjectCode, o.subjectName);
        if (!subjectMap.has(code)) {
          subjectMap.set(code, {
            id: o.id,
            code: o.subjectCode || code,
            name: o.subjectName || code,
            color: o.subjectColor || '#3D6A8A',
          });
        }
      }
    }

    // Calculate metrics per subject for this student
    const subjectMetrics: SubjectAttendanceMetrics[] = [];

    subjectMap.forEach((sub, subKey) => {
      // Find all class occurrences for this subject
      const subOccurrences = classOccurrences.filter(
        (occ) => normalizeSubCode(occ.subjectCode, occ.subjectName) === subKey
      );

      let attended = 0;
      let absent = 0;
      let cancelled = 0;

      for (const occ of subOccurrences) {
        if (isEventHolidayOnDate(occ.date, eventHolidays)) {
          cancelled++;
          continue;
        }
        const rec = attMap.get(occ.occurrenceKey);
        if (rec) {
          if (rec.status === 'present') attended++;
          else if (rec.status === 'absent') absent++;
          else if (rec.status === 'cancelled') cancelled++;
        } else if (occ.isCancelled) {
          cancelled++;
        }
      }

      const metrics = calculateSubjectAttendanceFromCounts(
        sub.id,
        sub.code,
        sub.name,
        attended,
        absent,
        cancelled,
        subOccurrences.length,
        targetRequirement,
        sub.color
      );

      subjectMetrics.push(metrics);
    });

    const aggregateMetrics = calculateWeightedAggregateAttendance(
      subjectMetrics,
      targetRequirement
    );

    return {
      mode: 'class_based',
      workspaceName: activeWs.name,
      workspaceId: activeWs.id,
      role: classSpace?.currentMember?.role || 'member',
      academicCalendar,
      academicSummary,
      subjectMetrics,
      aggregateMetrics,
      scheduledOccurrences,
      todayOccurrences,
      hasWorkspaces: workspaces.length > 0,
      isEmpty: subjectMetrics.length === 0 && classOccurrences.length === 0,
      targetRequirement,
    };
  }

  // -------------------------------------------------------------------------
  // 2. INDIVIDUAL MODE
  // -------------------------------------------------------------------------
  const academicCalendar =
    appState.settings?.academicCalendar || createDefaultAcademicSettings('semester');

  const academicSummary = resolveAcademicPeriodDays(
    academicCalendar.startDate,
    academicCalendar.endDate,
    academicCalendar.weeklyOffDays,
    mergeEventHolidays(academicCalendar.nationalHolidays, eventHolidays)
  );

  const periodStart = parseDateStr(academicCalendar.startDate);
  const periodEnd = parseDateStr(academicCalendar.endDate);

  const scheduledOccurrences = resolveSchedule(
    appState.timetable || [],
    appState.occurrenceOverrides || [],
    appState.extraClasses || [],
    periodStart,
    periodEnd
  ).map((occ) => isEventHolidayOnDate(occ.date, eventHolidays)
    ? { ...occ, isCancelled: true, changeNote: 'Holiday' }
    : occ);

  const todayOccurrences = scheduledOccurrences.filter((o) => o.date === todayStr);

  // Group logs by slotId::date and extraClassId::date
  const logMap = new Map<string, AttendanceLog>();
  for (const log of appState.attendanceLogs || []) {
    if (log.extraClassId) {
      logMap.set(`extra::${log.extraClassId}::${log.date}`, log);
    } else if (log.slotId) {
      logMap.set(`slot::${log.slotId}::${log.date}`, log);
    }
  }

  const subjectMetrics: SubjectAttendanceMetrics[] = [];

  for (const sub of appState.subjects || []) {
    const subTarget = sub.targetPct || targetRequirement;
    const subOccurrences = scheduledOccurrences.filter((o) => o.subjectId === sub.id);

    let attended = 0;
    let absent = 0;
    let cancelled = 0;

    for (const occ of subOccurrences) {
      if (isEventHolidayOnDate(occ.date, eventHolidays)) {
        cancelled++;
        continue;
      }
      const logKey = occ.extraClassId
        ? `extra::${occ.extraClassId}::${occ.date}`
        : `slot::${occ.slotId}::${occ.date}`;
      const log = logMap.get(logKey);

      if (log && !log.isPlanned) {
        if (log.status === 'present') attended++;
        else if (log.status === 'absent') absent++;
        else if (log.status === 'cancelled') cancelled++;
      } else if (occ.isCancelled) {
        cancelled++;
      }
    }

    // Maintain backwards compatibility with manual subject counters if logs are sparse
    const effectiveAttended = Math.max(attended, sub.attended || 0);
    const recordedConducted = sub.totalConducted || 0;
    const effectiveAbsent = Math.max(
      absent,
      Math.max(0, recordedConducted - (sub.attended || 0))
    );

    const metrics = calculateSubjectAttendanceFromCounts(
      sub.id,
      sub.code,
      sub.name,
      effectiveAttended,
      effectiveAbsent,
      cancelled,
      subOccurrences.length,
      subTarget,
      sub.color
    );

    subjectMetrics.push(metrics);
  }

  const aggregateMetrics = calculateWeightedAggregateAttendance(
    subjectMetrics,
    targetRequirement
  );

  return {
    mode: 'individual',
    academicCalendar,
    academicSummary,
    subjectMetrics,
    aggregateMetrics,
    scheduledOccurrences,
    todayOccurrences,
    hasWorkspaces: false,
    isEmpty: subjectMetrics.length === 0 && scheduledOccurrences.length === 0,
    targetRequirement,
  };
}

