import React, { useState, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Ban,
  Filter,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { DayOfWeek, ResolvedCalendarEvent } from '../../types';
import { resolveSchedule } from '../../utils/scheduleResolver';

const DAYS_OF_WEEK: { id: DayOfWeek; name: string; short: string }[] = [
  { id: 1, name: 'Monday', short: 'Mon' },
  { id: 2, name: 'Tuesday', short: 'Tue' },
  { id: 3, name: 'Wednesday', short: 'Wed' },
  { id: 4, name: 'Thursday', short: 'Thu' },
  { id: 5, name: 'Friday', short: 'Fri' },
  { id: 6, name: 'Saturday', short: 'Sat' },
  { id: 7, name: 'Sunday', short: 'Sun' },
];

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const getDayOfWeekFromDate = (date: Date): DayOfWeek => {
  const d = date.getDay();
  return (d === 0 ? 7 : d) as DayOfWeek;
};

const formatDateStr = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const AttendanceCalendarTab: React.FC = () => {
  const { state, markAttendanceForEvent } = useApp();

  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());
  const [calendarView, setCalendarView] = useState<'month' | 'week'>('month');
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string>('all');
  const [markingEvent, setMarkingEvent] = useState<ResolvedCalendarEvent | null>(null);

  const todayStr = useMemo(() => formatDateStr(new Date()), []);

  const handlePrev = () => {
    const next = new Date(currentDate);
    if (calendarView === 'month') {
      next.setMonth(next.getMonth() - 1);
    } else {
      next.setDate(next.getDate() - 7);
    }
    setCurrentDate(next);
  };

  const handleNext = () => {
    const next = new Date(currentDate);
    if (calendarView === 'month') {
      next.setMonth(next.getMonth() + 1);
    } else {
      next.setDate(next.getDate() + 7);
    }
    setCurrentDate(next);
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Month days calculation
  const monthDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const firstDayDow = getDayOfWeekFromDate(firstDay);
    const leading = firstDayDow - 1;

    const days: { date: Date; isCurrentMonth: boolean; dateStr: string; dayOfWeek: DayOfWeek }[] = [];

    for (let i = leading; i > 0; i--) {
      const prevDate = new Date(year, month, 1 - i);
      days.push({
        date: prevDate,
        isCurrentMonth: false,
        dateStr: formatDateStr(prevDate),
        dayOfWeek: getDayOfWeekFromDate(prevDate),
      });
    }

    for (let d = 1; d <= lastDay.getDate(); d++) {
      const thisDate = new Date(year, month, d);
      days.push({
        date: thisDate,
        isCurrentMonth: true,
        dateStr: formatDateStr(thisDate),
        dayOfWeek: getDayOfWeekFromDate(thisDate),
      });
    }

    const remaining = 7 - (days.length % 7);
    if (remaining < 7) {
      for (let i = 1; i <= remaining; i++) {
        const nextDate = new Date(year, month + 1, i);
        days.push({
          date: nextDate,
          isCurrentMonth: false,
          dateStr: formatDateStr(nextDate),
          dayOfWeek: getDayOfWeekFromDate(nextDate),
        });
      }
    }

    return days;
  }, [currentDate]);

  // Week days calculation
  const weekDays = useMemo(() => {
    const d = new Date(currentDate);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));

    const days: { date: Date; dateStr: string; dayOfWeek: DayOfWeek; dayShort: string }[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      days.push({
        date,
        dateStr: formatDateStr(date),
        dayOfWeek: (i + 1) as DayOfWeek,
        dayShort: DAYS_OF_WEEK[i].short,
      });
    }
    return days;
  }, [currentDate]);

  // Resolved calendar events for visible range
  const resolvedEventsByDate = useMemo(() => {
    if (monthDays.length === 0) return new Map<string, ResolvedCalendarEvent[]>();

    const start = monthDays[0].date;
    const end = monthDays[monthDays.length - 1].date;

    const all = resolveSchedule(
      state.timetable,
      state.occurrenceOverrides || [],
      state.extraClasses || [],
      start,
      end
    );

    const map = new Map<string, ResolvedCalendarEvent[]>();
    for (const evt of all) {
      if (selectedSubjectFilter !== 'all' && evt.subjectId !== selectedSubjectFilter) {
        continue;
      }
      const list = map.get(evt.date) || [];
      list.push(evt);
      map.set(evt.date, list);
    }
    return map;
  }, [monthDays, state.timetable, state.occurrenceOverrides, state.extraClasses, selectedSubjectFilter]);

  // Attendance log lookup for quick status display
  const getAttendanceForEvent = (evt: ResolvedCalendarEvent) => {
    return state.attendanceLogs.find((log) => {
      if (evt.extraClassId) return log.extraClassId === evt.extraClassId && log.date === evt.date;
      if (evt.slotId) return log.slotId === evt.slotId && log.date === evt.date;
      return false;
    });
  };

  const getSubject = (id: string) => state.subjects.find((s) => s.id === id);

  const headerTitle = useMemo(() => {
    if (calendarView === 'month') {
      return `${MONTH_NAMES[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
    }
    const d = new Date(currentDate);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const monMonth = MONTH_NAMES[monday.getMonth()].slice(0, 3);
    const sunMonth = MONTH_NAMES[sunday.getMonth()].slice(0, 3);
    return `${monMonth} ${monday.getDate()} – ${sunMonth} ${sunday.getDate()}, ${sunday.getFullYear()}`;
  }, [currentDate, calendarView]);

  return (
    <div className="space-y-4">
      {/* Calendar Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-white dark:bg-espresso-850 border border-ivory-300 dark:border-espresso-750 shadow-subtle">
        <div className="flex items-center gap-3">
          <button
            onClick={handleToday}
            aria-label="Attendance calendar today"
            className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-ivory-300 dark:border-espresso-700 hover:bg-ivory-100 dark:hover:bg-espresso-800"
          >
            Today
          </button>
          <div className="flex items-center border border-ivory-300 dark:border-espresso-700 rounded-xl overflow-hidden">
            <button
              onClick={handlePrev}
              className="p-1.5 text-espresso-600 dark:text-ivory-200 hover:bg-ivory-100"
              title="Previous"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleNext}
              className="p-1.5 text-espresso-600 dark:text-ivory-200 hover:bg-ivory-100 border-l border-ivory-300 dark:border-espresso-700"
              title="Next"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <h3 className="font-serif text-base sm:text-lg font-bold text-espresso-950 dark:text-ivory-50">
            {headerTitle}
          </h3>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Subject Filter Dropdown */}
          <div className="flex items-center gap-1 text-xs">
            <Filter className="w-3.5 h-3.5 text-espresso-400" />
            <select
              value={selectedSubjectFilter}
              onChange={(e) => setSelectedSubjectFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl border border-ivory-300 dark:border-espresso-700 bg-white dark:bg-espresso-800 text-xs text-espresso-900 dark:text-ivory-100"
            >
              <option value="all">All Courses</option>
              {state.subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code}
                </option>
              ))}
            </select>
          </div>

          {/* Month / Week Toggle */}
          <div className="flex items-center p-1 bg-ivory-100 dark:bg-espresso-800 rounded-xl border border-ivory-200 dark:border-espresso-700">
            <button
              onClick={() => setCalendarView('month')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize transition ${
                calendarView === 'month'
                  ? 'bg-white dark:bg-espresso-700 text-espresso-950 dark:text-ivory-50 shadow-subtle'
                  : 'text-espresso-500'
              }`}
            >
              Month
            </button>
            <button
              onClick={() => setCalendarView('week')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize transition ${
                calendarView === 'week'
                  ? 'bg-white dark:bg-espresso-700 text-espresso-950 dark:text-ivory-50 shadow-subtle'
                  : 'text-espresso-500'
              }`}
            >
              Week
            </button>
          </div>
        </div>
      </div>

      {/* Month View Grid */}
      {calendarView === 'month' && (
        <div className="rounded-2xl border border-ivory-300 dark:border-espresso-750 bg-white dark:bg-espresso-850 shadow-subtle overflow-hidden">
          <div className="grid grid-cols-7 border-b border-ivory-200 dark:border-espresso-800 bg-ivory-50/70 dark:bg-espresso-900/60 text-center font-mono text-[11px] font-bold text-espresso-600 dark:text-espresso-400 py-2 uppercase">
            {DAYS_OF_WEEK.map((d) => (
              <span key={d.id}>{d.short}</span>
            ))}
          </div>

          <div className="grid grid-cols-7 divide-x divide-y divide-ivory-200 dark:divide-espresso-800">
            {monthDays.map((cell, idx) => {
              const isToday = cell.dateStr === todayStr;
              const isFuture = cell.dateStr > todayStr;
              const cellEvents = resolvedEventsByDate.get(cell.dateStr) || [];

              return (
                <div
                  key={idx}
                  className={`min-h-[110px] p-1.5 sm:p-2 flex flex-col justify-between ${
                    cell.isCurrentMonth
                      ? 'bg-white dark:bg-espresso-850'
                      : 'bg-ivory-50/40 dark:bg-espresso-900/30 opacity-60'
                  } ${isToday ? 'ring-2 ring-inset ring-terracotta-400' : ''}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`text-xs font-mono font-bold w-6 h-6 rounded-full flex items-center justify-center ${
                        isToday
                          ? 'bg-espresso-900 text-ivory-50 dark:bg-ivory-100 dark:text-espresso-950'
                          : cell.isCurrentMonth
                          ? 'text-espresso-800 dark:text-ivory-200'
                          : 'text-espresso-400'
                      }`}
                    >
                      {cell.date.getDate()}
                    </span>
                    {isFuture && cellEvents.length > 0 && (
                      <span className="text-[9px] font-mono text-espresso-400 uppercase">Planned</span>
                    )}
                  </div>

                  {/* Class Chips with Attendance Status */}
                  <div className="space-y-1 flex-1 overflow-y-auto no-scrollbar max-h-24">
                    {cellEvents.map((evt) => {
                      const subject = getSubject(evt.subjectId);
                      const color = subject?.color || '#C45532';
                      const log = getAttendanceForEvent(evt);
                      const isCancelled = Boolean(evt.isCancelled);

                      return (
                        <div
                          key={evt.occurrenceKey}
                          onClick={() => setMarkingEvent(evt)}
                          className={`px-1.5 py-0.5 rounded text-[11px] font-medium truncate cursor-pointer transition hover:opacity-90 flex items-center justify-between gap-1 ${
                            isCancelled ? 'line-through opacity-40' : ''
                          }`}
                          style={{
                            backgroundColor: `${color}18`,
                            borderLeft: `3px solid ${color}`,
                            color: color,
                          }}
                          title={`Click to mark attendance for ${subject?.name || 'Class'}`}
                        >
                          <span className="truncate text-espresso-900 dark:text-ivory-100 font-semibold text-[10px]">
                            {subject?.code || subject?.name || 'Class'}
                          </span>

                          {/* Attendance Status Icon */}
                          <div className="shrink-0 flex items-center">
                            {log?.status === 'present' ? (
                              <span
                                className={`text-[10px] font-bold text-sage-600 ${
                                  log.isPlanned ? 'opacity-70' : ''
                                }`}
                                title={log.isPlanned ? 'Planned Present' : 'Present'}
                              >
                                ✓{log.isPlanned ? 'p' : ''}
                              </span>
                            ) : log?.status === 'absent' ? (
                              <span
                                className={`text-[10px] font-bold text-rose-600 ${
                                  log.isPlanned ? 'opacity-70' : ''
                                }`}
                                title={log.isPlanned ? 'Planned Absent' : 'Absent'}
                              >
                                ✗{log.isPlanned ? 'p' : ''}
                              </span>
                            ) : log?.status === 'cancelled' ? (
                              <span className="text-[10px] text-espresso-400">○</span>
                            ) : (
                              <span className="text-[9px] text-espresso-400 opacity-60">·</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Week View Grid */}
      {calendarView === 'week' && (
        <div className="rounded-2xl border border-ivory-300 dark:border-espresso-750 bg-white dark:bg-espresso-850 shadow-subtle overflow-x-auto">
          <div className="min-w-[700px]">
            <div className="grid grid-cols-7 border-b border-ivory-200 dark:border-espresso-800 bg-ivory-50/70 dark:bg-espresso-900/60 divide-x divide-ivory-200 dark:divide-espresso-800 text-center py-2.5">
              {weekDays.map((day) => {
                const isToday = day.dateStr === todayStr;
                return (
                  <div key={day.dayOfWeek} className="px-2">
                    <span className="font-mono text-[10px] font-bold uppercase text-espresso-500 block">
                      {day.dayShort}
                    </span>
                    <span
                      className={`inline-block font-mono text-sm font-bold mt-0.5 w-6 h-6 rounded-full leading-6 ${
                        isToday
                          ? 'bg-espresso-900 text-ivory-50 dark:bg-ivory-100 dark:text-espresso-950'
                          : 'text-espresso-900 dark:text-ivory-100'
                      }`}
                    >
                      {day.date.getDate()}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-7 divide-x divide-ivory-200 dark:divide-espresso-800 min-h-[360px]">
              {weekDays.map((day) => {
                const isToday = day.dateStr === todayStr;
                const dayEvents = resolvedEventsByDate.get(day.dateStr) || [];

                return (
                  <div
                    key={day.dayOfWeek}
                    className={`p-2 space-y-2 ${isToday ? 'bg-terracotta-50/20' : ''}`}
                  >
                    {dayEvents.length === 0 ? (
                      <div className="py-10 text-center text-[10px] text-espresso-400 italic">
                        No classes
                      </div>
                    ) : (
                      dayEvents.map((evt) => {
                        const subject = getSubject(evt.subjectId);
                        const color = subject?.color || '#C45532';
                        const log = getAttendanceForEvent(evt);

                        return (
                          <div
                            key={evt.occurrenceKey}
                            onClick={() => setMarkingEvent(evt)}
                            className="p-2 rounded-xl border border-ivory-200 dark:border-espresso-750 bg-white dark:bg-espresso-800 shadow-sm cursor-pointer hover:shadow transition space-y-1"
                            style={{ borderLeft: `3px solid ${color}` }}
                          >
                            <div className="flex items-center justify-between text-[10px] font-mono">
                              <span className="text-espresso-500">{evt.startTime}</span>
                              {log?.status === 'present' ? (
                                <span className="font-bold text-sage-600">Present</span>
                              ) : log?.status === 'absent' ? (
                                <span className="font-bold text-rose-600">Absent</span>
                              ) : null}
                            </div>
                            <h4 className="text-xs font-bold text-espresso-950 dark:text-ivory-50 truncate">
                              {subject?.name || 'Class'}
                            </h4>
                          </div>
                        );
                      })
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Attendance Marking Modal */}
      {markingEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-espresso-950/40 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-white dark:bg-espresso-900 rounded-2xl border border-ivory-300 dark:border-espresso-700 p-5 shadow-xl space-y-4">
            <div>
              <span className="text-[10px] font-mono uppercase font-bold text-espresso-400">
                {markingEvent.date} · {markingEvent.startTime}–{markingEvent.endTime}
              </span>
              <h3 className="font-serif text-lg font-bold text-espresso-950 dark:text-ivory-50">
                {getSubject(markingEvent.subjectId)?.name || 'Class Session'}
              </h3>
              <p className="text-xs text-espresso-500 mt-0.5">
                {markingEvent.date > todayStr
                  ? '⚠️ Future session: marking a planned attendance record will NOT inflate your actual historical attendance percentage.'
                  : 'Record whether you attended this conducted class session:'}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => {
                  const isFuture = markingEvent.date > todayStr;
                  markAttendanceForEvent(
                    markingEvent.occurrenceKey,
                    markingEvent.subjectId,
                    markingEvent.date,
                    'present',
                    markingEvent.slotId,
                    markingEvent.extraClassId,
                    markingEvent.overrideId,
                    isFuture
                  );
                  setMarkingEvent(null);
                }}
                className="p-3 rounded-xl border border-sage-200 dark:border-sage-800 bg-sage-50 dark:bg-sage-900/30 text-sage-700 dark:text-sage-300 flex flex-col items-center gap-1 font-semibold text-xs hover:bg-sage-100"
              >
                <CheckCircle2 className="w-5 h-5 text-sage-600" />
                <span>Present</span>
              </button>

              <button
                onClick={() => {
                  const isFuture = markingEvent.date > todayStr;
                  markAttendanceForEvent(
                    markingEvent.occurrenceKey,
                    markingEvent.subjectId,
                    markingEvent.date,
                    'absent',
                    markingEvent.slotId,
                    markingEvent.extraClassId,
                    markingEvent.overrideId,
                    isFuture
                  );
                  setMarkingEvent(null);
                }}
                className="p-3 rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 flex flex-col items-center gap-1 font-semibold text-xs hover:bg-rose-100"
              >
                <XCircle className="w-5 h-5 text-rose-600" />
                <span>Absent</span>
              </button>

              <button
                onClick={() => {
                  markAttendanceForEvent(
                    markingEvent.occurrenceKey,
                    markingEvent.subjectId,
                    markingEvent.date,
                    'cancelled',
                    markingEvent.slotId,
                    markingEvent.extraClassId,
                    markingEvent.overrideId,
                    false
                  );
                  setMarkingEvent(null);
                }}
                className="p-3 rounded-xl border border-ivory-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-800 text-espresso-700 dark:text-ivory-200 flex flex-col items-center gap-1 font-semibold text-xs hover:bg-ivory-100"
              >
                <Ban className="w-5 h-5 text-espresso-500" />
                <span>Cancelled</span>
              </button>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setMarkingEvent(null)}
                className="px-3 py-1.5 text-xs text-espresso-500 hover:text-espresso-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
