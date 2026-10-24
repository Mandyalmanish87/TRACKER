import {
  TimetableSlot,
  OccurrenceOverride,
  ExtraClass,
  ResolvedCalendarEvent,
  DayOfWeek,
} from '../types';

/**
 * Convert JS Date.getDay() (0=Sun) to DayOfWeek (1=Mon..7=Sun)
 */
export const dateToDayOfWeek = (date: Date): DayOfWeek => {
  const d = date.getDay();
  return (d === 0 ? 7 : d) as DayOfWeek;
};

/**
 * Format Date as YYYY-MM-DD
 */
export const formatDateStr = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

/**
 * Parse YYYY-MM-DD to a Date (local time, midnight)
 */
export const parseDateStr = (str: string): Date => {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
};

/**
 * Get all dates in a range [start, end] inclusive
 */
export const getDatesInRange = (start: Date, end: Date): Date[] => {
  const dates: Date[] = [];
  const current = new Date(start);
  while (current <= end) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  return dates;
};

/**
 * Resolve the effective schedule for a date range by combining:
 * 1. Recurring timetable slots
 * 2. Occurrence overrides (reschedules & cancellations)
 * 3. Extra one-off classes
 *
 * This is the single source of truth for both Timetable and Attendance calendars.
 */
export function resolveSchedule(
  timetable: TimetableSlot[],
  overrides: OccurrenceOverride[],
  extraClasses: ExtraClass[],
  startDate: Date,
  endDate: Date,
): ResolvedCalendarEvent[] {
  const events: ResolvedCalendarEvent[] = [];

  // Normalize dates to start of day and end of day so time-of-day in Date objects doesn't break comparisons
  const normStart = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const normEnd = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 23, 59, 59, 999);

  const dates = getDatesInRange(normStart, normEnd);

  // Index overrides by "slotId::originalDate" for O(1) lookup
  const overrideMap = new Map<string, OccurrenceOverride>();
  for (const ov of overrides) {
    overrideMap.set(`${ov.slotId}::${ov.originalDate}`, ov);
  }

  // Track which (slotId, originalDate) pairs have been rescheduled OUT of this range
  // and which rescheduled occurrences land IN this range
  const rescheduledInto = new Map<string, OccurrenceOverride>(); // newDate -> override
  const cancelledKeys = new Set<string>(); // "slotId::originalDate"

  for (const ov of overrides) {
    const key = `${ov.slotId}::${ov.originalDate}`;
    if (ov.type === 'cancel') {
      cancelledKeys.add(key);
    } else if (ov.type === 'reschedule' && ov.newDate) {
      cancelledKeys.add(key); // Remove from original date
      rescheduledInto.set(`${ov.slotId}::${ov.newDate}`, ov);
    }
  }

  // 1. Generate recurring class occurrences for each date in range
  for (const date of dates) {
    const dow = dateToDayOfWeek(date);
    const dateStr = formatDateStr(date);

    for (const slot of timetable) {
      if (slot.dayOfWeek !== dow) continue;

      const key = `${slot.id}::${dateStr}`;

      // Check if this occurrence has been cancelled or rescheduled away
      if (cancelledKeys.has(key)) {
        // Check if it's a cancellation (show as cancelled) vs reschedule (don't show here)
        const ov = overrideMap.get(key);
        if (ov?.type === 'cancel') {
          events.push({
            occurrenceKey: key,
            subjectId: slot.subjectId,
            date: dateStr,
            startTime: slot.startTime,
            endTime: slot.endTime,
            room: slot.room,
            instructor: slot.instructor,
            notes: slot.notes,
            source: 'recurring',
            slotId: slot.id,
            isCancelled: true,
          });
        }
        // If rescheduled, this occurrence doesn't appear at original date/time
        continue;
      }

      // Normal recurring occurrence
      events.push({
        occurrenceKey: key,
        subjectId: slot.subjectId,
        date: dateStr,
        startTime: slot.startTime,
        endTime: slot.endTime,
        room: slot.room,
        instructor: slot.instructor,
        notes: slot.notes,
        source: 'recurring',
        slotId: slot.id,
      });
    }
  }

  // 2. Add rescheduled occurrences that land in this range
  for (const ov of overrides) {
    if (ov.type !== 'reschedule' || !ov.newDate) continue;

    const newDateObj = parseDateStr(ov.newDate);
    if (newDateObj < normStart || newDateObj > normEnd) continue;

    const slot = timetable.find((t) => t.id === ov.slotId);
    if (!slot) continue;

    const key = `${ov.slotId}::${ov.originalDate}`;
    events.push({
      occurrenceKey: key,
      subjectId: slot.subjectId,
      date: ov.newDate,
      startTime: ov.newStartTime || slot.startTime,
      endTime: ov.newEndTime || slot.endTime,
      room: ov.newRoom ?? slot.room,
      instructor: slot.instructor,
      notes: ov.newNotes ?? slot.notes,
      source: 'rescheduled',
      slotId: slot.id,
      overrideId: ov.id,
    });
  }

  // 3. Add extra one-off classes
  for (const extra of extraClasses) {
    const extraDateObj = parseDateStr(extra.date);
    if (extraDateObj < normStart || extraDateObj > normEnd) continue;

    events.push({
      occurrenceKey: `extra::${extra.id}`,
      subjectId: extra.subjectId,
      date: extra.date,
      startTime: extra.startTime,
      endTime: extra.endTime,
      room: extra.room,
      notes: extra.notes,
      source: 'extra',
      extraClassId: extra.id,
    });
  }

  // Sort by date then start time
  events.sort((a, b) => {
    const dateCmp = a.date.localeCompare(b.date);
    if (dateCmp !== 0) return dateCmp;
    return a.startTime.localeCompare(b.startTime);
  });

  return events;
}

/**
 * Resolve schedule for a single date.
 */
export function resolveScheduleForDate(
  timetable: TimetableSlot[],
  overrides: OccurrenceOverride[],
  extraClasses: ExtraClass[],
  date: Date,
): ResolvedCalendarEvent[] {
  return resolveSchedule(timetable, overrides, extraClasses, date, date);
}

/**
 * Get the shared attendance requirement from settings, defaulting to 75.
 */
export function getAttendanceRequirement(attendanceRequirement?: number): number {
  if (typeof attendanceRequirement === 'number' && attendanceRequirement >= 0 && attendanceRequirement <= 100) {
    return attendanceRequirement;
  }
  return 75;
}
