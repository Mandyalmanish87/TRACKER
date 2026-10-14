import React, { useState, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  MapPin,
  User,
  Sparkles,
  Edit2,
  Trash2,
  X,
  FileText,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { DayOfWeek, TimetableSlot, Subject, ResolvedCalendarEvent } from '../../types';
import { GptTimetableImportModal } from '../timetable/GptTimetableImportModal';
import { ClassOccurrenceModal } from '../timetable/ClassOccurrenceModal';
import { ConfirmModal } from '../common/ConfirmModal';
import { resolveSchedule } from '../../utils/scheduleResolver';

type CalendarViewMode = 'month' | 'week' | 'list';

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

// Helper: converts JS Date day (0=Sun, 1=Mon, ..., 6=Sat) to DayOfWeek (1=Mon ... 7=Sun)
const getDayOfWeekFromDate = (date: Date): DayOfWeek => {
  const d = date.getDay();
  return (d === 0 ? 7 : d) as DayOfWeek;
};

// Helper: format YYYY-MM-DD
const formatDateStr = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const TimetableView: React.FC = () => {
  const {
    state,
    addTimetableSlot,
    updateTimetableSlot,
    deleteTimetableSlot,
    rescheduleOccurrence,
    cancelOccurrence,
    restoreOccurrence,
    addExtraClass,
  } = useApp();

  const [viewMode, setViewMode] = useState<CalendarViewMode>('month');
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Selected event for details modal (supports both recurring slot and resolved event)
  const [selectedSlot, setSelectedSlot] = useState<TimetableSlot | null>(null);
  const [selectedOccurrence, setSelectedOccurrence] = useState<ResolvedCalendarEvent | null>(null);

  // In-app confirm modal state (replacing window.confirm)
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const todayStr = useMemo(() => formatDateStr(new Date()), []);

  // Extra class modal state
  const [isAddExtraModalOpen, setIsAddExtraModalOpen] = useState(false);
  const [extraSubjectId, setExtraSubjectId] = useState('');
  const [extraDate, setExtraDate] = useState(() => formatDateStr(new Date()));
  const [extraStartTime, setExtraStartTime] = useState('09:00');
  const [extraEndTime, setExtraEndTime] = useState('10:00');
  const [extraRoom, setExtraRoom] = useState('');
  const [extraNotes, setExtraNotes] = useState('');

  // Add / Edit Modal state
  const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  const [formSubjectId, setFormSubjectId] = useState<string>('');
  const [formCustomSubject, setFormCustomSubject] = useState<string>('');
  const [formDayOfWeek, setFormDayOfWeek] = useState<DayOfWeek>(1);
  const [formStartTime, setFormStartTime] = useState<string>('09:00');
  const [formEndTime, setFormEndTime] = useState<string>('10:15');
  const [formRoom, setFormRoom] = useState<string>('');
  const [formInstructor, setFormInstructor] = useState<string>('');
  const [formNotes, setFormNotes] = useState<string>('');

  // Helper to resolve Subject
  const getSubject = (subjectId: string): Subject | undefined => {
    return state.subjects.find((s) => s.id === subjectId);
  };

  // ── Date Navigation Helpers ──
  const handlePrev = () => {
    const next = new Date(currentDate);
    if (viewMode === 'month') {
      next.setMonth(next.getMonth() - 1);
    } else if (viewMode === 'week') {
      next.setDate(next.getDate() - 7);
    } else {
      next.setDate(next.getDate() - 1);
    }
    setCurrentDate(next);
  };

  const handleNext = () => {
    const next = new Date(currentDate);
    if (viewMode === 'month') {
      next.setMonth(next.getMonth() + 1);
    } else if (viewMode === 'week') {
      next.setDate(next.getDate() + 7);
    } else {
      next.setDate(next.getDate() + 1);
    }
    setCurrentDate(next);
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Calendar Header Title
  const headerTitle = useMemo(() => {
    if (viewMode === 'month') {
      return `${MONTH_NAMES[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
    }
    if (viewMode === 'week') {
      // Find Monday of the current week
      const d = new Date(currentDate);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(d.setDate(diff));
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);

      const monMonth = MONTH_NAMES[monday.getMonth()].slice(0, 3);
      const sunMonth = MONTH_NAMES[sunday.getMonth()].slice(0, 3);
      if (monMonth === sunMonth) {
        return `${monMonth} ${monday.getDate()} – ${sunday.getDate()}, ${monday.getFullYear()}`;
      }
      return `${monMonth} ${monday.getDate()} – ${sunMonth} ${sunday.getDate()}, ${sunday.getFullYear()}`;
    }
    // Day/List
    const dayName = DAYS_OF_WEEK.find((d) => d.id === getDayOfWeekFromDate(currentDate))?.name;
    return `${dayName}, ${MONTH_NAMES[currentDate.getMonth()]} ${currentDate.getDate()}, ${currentDate.getFullYear()}`;
  }, [currentDate, viewMode]);

  // ── Month Calendar Grid Calculation ──
  const monthDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    // Monday-based offset (1 = Mon ... 7 = Sun)
    const firstDayDow = getDayOfWeekFromDate(firstDayOfMonth); // 1..7
    const leadingDaysCount = firstDayDow - 1; // e.g. Mon=0, Tue=1, Sun=6

    const days: { date: Date; isCurrentMonth: boolean; dateStr: string; dayOfWeek: DayOfWeek }[] = [];

    // Leading days from previous month
    for (let i = leadingDaysCount; i > 0; i--) {
      const prevDate = new Date(year, month, 1 - i);
      days.push({
        date: prevDate,
        isCurrentMonth: false,
        dateStr: formatDateStr(prevDate),
        dayOfWeek: getDayOfWeekFromDate(prevDate),
      });
    }

    // Days in current month
    for (let day = 1; day <= lastDayOfMonth.getDate(); day++) {
      const thisDate = new Date(year, month, day);
      days.push({
        date: thisDate,
        isCurrentMonth: true,
        dateStr: formatDateStr(thisDate),
        dayOfWeek: getDayOfWeekFromDate(thisDate),
      });
    }

    // Trailing days to round up to full week rows (multiple of 7)
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

  // ── Week View Days Calculation ──
  const weekDays = useMemo(() => {
    const d = new Date(currentDate);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
    const monday = new Date(d.setDate(diff));

    const days: { date: Date; dateStr: string; dayOfWeek: DayOfWeek; dayName: string; dayShort: string }[] = [];
    for (let i = 0; i < 7; i++) {
      const dayDate = new Date(monday);
      dayDate.setDate(monday.getDate() + i);
      const dow = (i + 1) as DayOfWeek;
      days.push({
        date: dayDate,
        dateStr: formatDateStr(dayDate),
        dayOfWeek: dow,
        dayName: DAYS_OF_WEEK[i].name,
        dayShort: DAYS_OF_WEEK[i].short,
      });
    }
    return days;
  }, [currentDate]);

  // ── Resolved Effective Schedule for the Visible Range ──
  // Combines recurring weekly timetable + individual date overrides + extra classes
  const resolvedEventsByDate = useMemo(() => {
    if (monthDays.length === 0) return new Map<string, ResolvedCalendarEvent[]>();

    const start = monthDays[0].date;
    const end = monthDays[monthDays.length - 1].date;

    const allEvents = resolveSchedule(
      state.timetable,
      state.occurrenceOverrides || [],
      state.extraClasses || [],
      start,
      end
    );

    const map = new Map<string, ResolvedCalendarEvent[]>();
    for (const evt of allEvents) {
      const list = map.get(evt.date) || [];
      list.push(evt);
      map.set(evt.date, list);
    }
    return map;
  }, [monthDays, state.timetable, state.occurrenceOverrides, state.extraClasses]);
  const handleOpenAddModal = (initialDay?: DayOfWeek) => {
    setEditingSlotId(null);
    setFormSubjectId(state.subjects[0]?.id || 'new');
    setFormCustomSubject('');
    setFormDayOfWeek(initialDay || getDayOfWeekFromDate(currentDate));
    setFormStartTime('09:00');
    setFormEndTime('10:15');
    setFormRoom('');
    setFormInstructor('');
    setFormNotes('');
    setIsAddEditModalOpen(true);
  };

  const handleOpenEditModal = (slot: TimetableSlot) => {
    setEditingSlotId(slot.id);
    setFormSubjectId(slot.subjectId);
    setFormCustomSubject('');
    setFormDayOfWeek(slot.dayOfWeek);
    setFormStartTime(slot.startTime);
    setFormEndTime(slot.endTime);
    setFormRoom(slot.room || '');
    setFormInstructor(slot.instructor || '');
    setFormNotes(slot.notes || '');
    setSelectedSlot(null);
    setIsAddEditModalOpen(true);
  };

  const handleSaveSlot = (e: React.FormEvent) => {
    e.preventDefault();

    if (formStartTime >= formEndTime) {
      alert('End time must be after start time.');
      return;
    }

    if (editingSlotId) {
      updateTimetableSlot(editingSlotId, {
        dayOfWeek: formDayOfWeek,
        startTime: formStartTime,
        endTime: formEndTime,
        subjectId: formSubjectId,
        room: formRoom.trim() || undefined,
        instructor: formInstructor.trim() || undefined,
        notes: formNotes.trim() || undefined,
      });
    } else {
      addTimetableSlot(
        {
          dayOfWeek: formDayOfWeek,
          startTime: formStartTime,
          endTime: formEndTime,
          subjectId: formSubjectId === 'new' ? '' : formSubjectId,
          room: formRoom.trim() || undefined,
          instructor: formInstructor.trim() || undefined,
          notes: formNotes.trim() || undefined,
        },
        formSubjectId === 'new' ? formCustomSubject.trim() : undefined
      );
    }

    setIsAddEditModalOpen(false);
  };

  const handleDeleteSlot = (id: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Recurring Class',
      message: 'Are you sure you want to delete this weekly recurring class from your timetable? This will remove all future weekly occurrences.',
      onConfirm: () => {
        deleteTimetableSlot(id);
        setSelectedSlot(null);
        setSelectedOccurrence(null);
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  return (
    <div className="space-y-6 pb-20">
      {/* ── Page Header ── */}
      <div className="border-b border-ivory-300 dark:border-espresso-800 pb-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest font-mono font-semibold mb-1" style={{ color: 'var(--accent)' }}>
              Master Schedule
            </p>
            <h1 className="font-serif text-3xl sm:text-4xl font-normal text-espresso-950 dark:text-ivory-50">
              Timetable & Calendar
            </h1>
            <p className="text-xs text-espresso-500 dark:text-espresso-400 mt-1">
              Google Calendar-style schedule with weekly recurrence and GPT copy/paste import.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setIsImportModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-espresso-850 border border-ivory-300 dark:border-espresso-700 text-espresso-800 dark:text-ivory-100 hover:bg-ivory-100 dark:hover:bg-espresso-800 shadow-subtle transition"
            >
              <Sparkles className="w-3.5 h-3.5 text-ochre-600 dark:text-ochre-400" />
              <span>Import Timetable (GPT)</span>
            </button>

            <button
              onClick={() => {
                setExtraSubjectId(state.subjects[0]?.id || '');
                setExtraDate(todayStr);
                setExtraStartTime('10:00');
                setExtraEndTime('11:00');
                setExtraRoom('');
                setExtraNotes('');
                setIsAddExtraModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-espresso-850 border border-ivory-300 dark:border-espresso-700 text-espresso-800 dark:text-ivory-100 hover:bg-ivory-100 dark:hover:bg-espresso-800 shadow-subtle transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Extra Class</span>
            </button>

            <button
              onClick={() => handleOpenAddModal()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-white text-xs font-semibold hover:opacity-95 shadow-subtle transition"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              <Plus className="w-4 h-4" />
              <span>Add Recurring Class</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Calendar Toolbar ── */}
      <div className="p-3.5 sm:p-4 rounded-2xl border border-ivory-300 dark:border-espresso-750 bg-white dark:bg-espresso-850 shadow-subtle flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Navigation & Date Heading */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={handleToday}
            aria-label="Go to today"
            data-testid="calendar-today-btn"
            className="px-3 py-1.5 rounded-xl border border-ivory-300 dark:border-espresso-700 text-xs font-semibold text-espresso-800 dark:text-ivory-100 hover:bg-ivory-100 dark:hover:bg-espresso-800 transition shadow-subtle"
          >
            Today
          </button>

          <div className="flex items-center rounded-xl border border-ivory-300 dark:border-espresso-700 overflow-hidden bg-ivory-50 dark:bg-espresso-800">
            <button
              onClick={handlePrev}
              className="p-1.5 text-espresso-600 dark:text-ivory-200 hover:bg-ivory-200 dark:hover:bg-espresso-700 transition"
              title="Previous"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleNext}
              className="p-1.5 text-espresso-600 dark:text-ivory-200 hover:bg-ivory-200 dark:hover:bg-espresso-700 transition border-l border-ivory-200 dark:border-espresso-700"
              title="Next"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <h2 className="font-serif text-lg sm:text-xl font-bold text-espresso-950 dark:text-ivory-50 tracking-tight">
            {headerTitle}
          </h2>
        </div>

        {/* View Switcher: Month / Week / List */}
        <div className="flex items-center p-1 bg-ivory-100 dark:bg-espresso-800 rounded-xl border border-ivory-200 dark:border-espresso-700 self-start md:self-auto">
          {(['month', 'week', 'list'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize transition ${
                viewMode === mode
                  ? 'bg-white dark:bg-espresso-700 text-espresso-950 dark:text-ivory-50 shadow-subtle'
                  : 'text-espresso-500 dark:text-espresso-400 hover:text-espresso-800 dark:hover:text-ivory-200'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* ── 1. MONTH VIEW ── */}
      {viewMode === 'month' && (
        <div className="rounded-2xl border border-ivory-300 dark:border-espresso-750 bg-white dark:bg-espresso-850 shadow-subtle overflow-hidden">
          {/* Day of week headers */}
          <div className="grid grid-cols-7 border-b border-ivory-200 dark:border-espresso-800 bg-ivory-50/70 dark:bg-espresso-900/60 text-center font-mono text-[11px] font-bold text-espresso-600 dark:text-espresso-400 py-2.5 uppercase tracking-wider">
            {DAYS_OF_WEEK.map((d) => (
              <span key={d.id}>{d.short}</span>
            ))}
          </div>

          {/* Monthly dates grid */}
          <div className="grid grid-cols-7 divide-x divide-y divide-ivory-200 dark:divide-espresso-800">
            {monthDays.map((cell, idx) => {
              const isToday = cell.dateStr === todayStr;
              // Get effective classes resolved for this exact date (combines recurring + single-date overrides + extra classes)
              const cellEvents = resolvedEventsByDate.get(cell.dateStr) || [];

              return (
                <div
                  key={idx}
                  className={`min-h-[105px] sm:min-h-[125px] p-1.5 sm:p-2 transition-colors flex flex-col justify-between ${
                    cell.isCurrentMonth
                      ? 'bg-white dark:bg-espresso-850'
                      : 'bg-ivory-50/40 dark:bg-espresso-900/30 opacity-60'
                  } ${isToday ? 'ring-2 ring-inset ring-terracotta-400 dark:ring-terracotta-500' : ''}`}
                >
                  {/* Date badge */}
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`text-xs font-mono font-bold w-6 h-6 rounded-full flex items-center justify-center ${
                        isToday
                          ? 'bg-espresso-900 text-ivory-50 dark:bg-ivory-100 dark:text-espresso-950 font-bold'
                          : cell.isCurrentMonth
                          ? 'text-espresso-800 dark:text-ivory-200'
                          : 'text-espresso-400 dark:text-espresso-600'
                      }`}
                    >
                      {cell.date.getDate()}
                    </span>

                    {/* Quick add button on date hover */}
                    <button
                      onClick={() => handleOpenAddModal(cell.dayOfWeek)}
                      className="opacity-0 group-hover:opacity-100 hover:opacity-100 p-0.5 text-espresso-400 hover:text-espresso-700 dark:hover:text-ivory-200"
                      title="Add recurring class on this weekday"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Effective Classes Chips */}
                  <div className="space-y-1 flex-1 overflow-y-auto no-scrollbar max-h-24">
                    {cellEvents.map((evt) => {
                      const subject = getSubject(evt.subjectId);
                      const color = subject?.color || '#C45532';
                      const isCancelled = Boolean(evt.isCancelled);

                      return (
                        <div
                          key={evt.occurrenceKey}
                          onClick={() => setSelectedOccurrence(evt)}
                          className={`px-1.5 py-0.5 rounded text-[11px] font-medium truncate cursor-pointer transition hover:opacity-90 flex items-center gap-1 ${
                            isCancelled ? 'line-through opacity-50' : ''
                          }`}
                          style={{
                            backgroundColor: `${color}18`,
                            borderLeft: `3px solid ${color}`,
                            color: color,
                          }}
                          title={`${evt.startTime} ${subject?.name || 'Class'}${evt.source === 'rescheduled' ? ' (Rescheduled)' : ''}${isCancelled ? ' (Cancelled)' : ''}`}
                        >
                          <span className="font-mono text-[10px] font-bold">{evt.startTime}</span>
                          <span className="truncate text-espresso-900 dark:text-ivory-100 font-semibold">
                            {subject?.code || subject?.name || 'Class'}
                          </span>
                          {evt.source === 'rescheduled' && (
                            <span className="text-[9px] font-mono font-bold text-ochre-600 dark:text-ochre-400">↺</span>
                          )}
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

      {/* ── 2. WEEK VIEW ── */}
      {viewMode === 'week' && (
        <div className="rounded-2xl border border-ivory-300 dark:border-espresso-750 bg-white dark:bg-espresso-850 shadow-subtle overflow-x-auto">
          <div className="min-w-[720px]">
            {/* Week Columns Header */}
            <div className="grid grid-cols-7 border-b border-ivory-200 dark:border-espresso-800 bg-ivory-50/70 dark:bg-espresso-900/60 divide-x divide-ivory-200 dark:divide-espresso-800 text-center py-3">
              {weekDays.map((day) => {
                const isToday = day.dateStr === todayStr;
                return (
                  <div key={day.dayOfWeek} className="px-2">
                    <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-espresso-500 dark:text-espresso-400 block">
                      {day.dayShort}
                    </span>
                    <span
                      className={`inline-block font-mono text-base font-bold mt-0.5 w-7 h-7 rounded-full leading-7 ${
                        isToday
                          ? 'bg-espresso-900 text-ivory-50 dark:bg-ivory-100 dark:text-espresso-950 font-bold'
                          : 'text-espresso-900 dark:text-ivory-100'
                      }`}
                    >
                      {day.date.getDate()}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Week Schedule Columns */}
            <div className="grid grid-cols-7 divide-x divide-ivory-200 dark:divide-espresso-800 min-h-[420px]">
              {weekDays.map((day) => {
                const isToday = day.dateStr === todayStr;
                const dayEvents = resolvedEventsByDate.get(day.dateStr) || [];

                return (
                  <div
                    key={day.dayOfWeek}
                    className={`p-2 space-y-2.5 ${
                      isToday ? 'bg-terracotta-50/20 dark:bg-terracotta-950/10' : ''
                    }`}
                  >
                    {dayEvents.length === 0 ? (
                      <div className="py-12 text-center text-[11px] text-espresso-400 italic">
                        No classes
                      </div>
                    ) : (
                      dayEvents.map((evt) => {
                        const subject = getSubject(evt.subjectId);
                        const color = subject?.color || '#C45532';
                        const isCancelled = Boolean(evt.isCancelled);

                        return (
                          <div
                            key={evt.occurrenceKey}
                            onClick={() => setSelectedOccurrence(evt)}
                            className={`p-2.5 rounded-xl border border-ivory-200 dark:border-espresso-750 bg-white dark:bg-espresso-800 shadow-sm cursor-pointer hover:shadow-md transition-all space-y-1.5 ${
                              isCancelled ? 'opacity-50 line-through' : ''
                            }`}
                            style={{ borderLeft: `4px solid ${color}` }}
                          >
                            <span className="font-mono text-[10px] font-bold flex items-center justify-between text-espresso-600 dark:text-espresso-300">
                              <span className="flex items-center gap-1">
                                <Clock className="w-2.5 h-2.5" />
                                {evt.startTime} – {evt.endTime}
                              </span>
                              {evt.source === 'rescheduled' && (
                                <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-ochre-100 dark:bg-ochre-900/40 text-ochre-700 dark:text-ochre-300 font-bold">
                                  Rescheduled
                                </span>
                              )}
                              {isCancelled && (
                                <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-rose-100 text-rose-700 font-bold">
                                  Cancelled
                                </span>
                              )}
                            </span>
                            <h4 className="text-xs font-serif font-bold text-espresso-950 dark:text-ivory-50 line-clamp-2">
                              {subject?.name || 'Class'}
                            </h4>
                            {evt.room && (
                              <p className="text-[10px] text-espresso-500 dark:text-espresso-400 flex items-center gap-1 truncate">
                                <MapPin className="w-2.5 h-2.5 text-terracotta-500" />
                                {evt.room}
                              </p>
                            )}
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

      {/* ── 3. LIST / DAY VIEW ── */}
      {viewMode === 'list' && (
        <div className="space-y-4">
          {/* Day Pills Bar */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
            {DAYS_OF_WEEK.map((day) => {
              const count = state.timetable.filter((t) => t.dayOfWeek === day.id).length;
              const isSelected = getDayOfWeekFromDate(currentDate) === day.id;

              return (
                <button
                  key={day.id}
                  onClick={() => {
                    // Update currentDate to that day in current week
                    const d = new Date(currentDate);
                    const currDow = getDayOfWeekFromDate(d);
                    d.setDate(d.getDate() + (day.id - currDow));
                    setCurrentDate(d);
                  }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition ${
                    isSelected
                      ? 'bg-espresso-900 text-ivory-50 dark:bg-ivory-100 dark:text-espresso-950 font-bold shadow-subtle'
                      : 'bg-white dark:bg-espresso-850 text-espresso-700 dark:text-espresso-300 border border-ivory-300 dark:border-espresso-750'
                  }`}
                >
                  <span>{day.name}</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-black/10 dark:bg-white/20">
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Classes for selected day */}
          {(() => {
            const activeDow = getDayOfWeekFromDate(currentDate);
            const slots = state.timetable
              .filter((t) => t.dayOfWeek === activeDow)
              .sort((a, b) => a.startTime.localeCompare(b.startTime));

            if (slots.length === 0) {
              return (
                <div className="p-12 text-center rounded-2xl border border-dashed border-ivory-300 dark:border-espresso-700 bg-white/40 dark:bg-espresso-850/40">
                  <CalendarIcon className="w-8 h-8 text-espresso-400 mx-auto mb-2" />
                  <p className="text-xs text-espresso-500 italic">No classes scheduled for this day.</p>
                  <button
                    onClick={() => handleOpenAddModal(activeDow)}
                    className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-white text-xs font-semibold"
                    style={{ backgroundColor: 'var(--accent)' }}
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Class
                  </button>
                </div>
              );
            }

            return (
              <div className="space-y-3">
                {slots.map((slot) => {
                  const subject = getSubject(slot.subjectId);
                  const color = subject?.color || '#C45532';

                  return (
                    <div
                      key={slot.id}
                      className="p-4 sm:p-5 rounded-2xl border border-ivory-300 dark:border-espresso-750 bg-white dark:bg-espresso-850 shadow-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      style={{ borderLeft: `6px solid ${color}` }}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-semibold text-terracotta-600 dark:text-terracotta-400 flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {slot.startTime} — {slot.endTime}
                          </span>
                          {subject && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-ivory-200 dark:bg-espresso-800 text-espresso-700 dark:text-ivory-200">
                              {subject.code}
                            </span>
                          )}
                        </div>
                        <h3 className="font-serif text-lg font-bold text-espresso-950 dark:text-ivory-50">
                          {subject?.name || 'Class'}
                        </h3>
                        <div className="flex flex-wrap items-center gap-4 text-xs text-espresso-500 dark:text-espresso-400">
                          {slot.room && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-terracotta-500" />
                              {slot.room}
                            </span>
                          )}
                          {slot.instructor && (
                            <span className="flex items-center gap-1">
                              <User className="w-3 h-3 text-espresso-400" />
                              {slot.instructor}
                            </span>
                          )}
                          {slot.notes && (
                            <span className="flex items-center gap-1 italic">
                              <FileText className="w-3 h-3 text-espresso-400" />
                              {slot.notes}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center">
                        <button
                          onClick={() => handleOpenEditModal(slot)}
                          className="p-2 rounded-xl border border-ivory-300 dark:border-espresso-700 text-espresso-600 dark:text-ivory-200 hover:bg-ivory-100 dark:hover:bg-espresso-800"
                          title="Edit Class"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteSlot(slot.id)}
                          className="p-2 rounded-xl border border-ivory-300 dark:border-espresso-700 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                          title="Delete Class"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}

      {/* ── Class Details Modal ── */}
      {selectedSlot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-espresso-950/40 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white dark:bg-espresso-900 rounded-2xl border border-ivory-300 dark:border-espresso-700 p-6 shadow-xl space-y-4">
            {(() => {
              const subject = getSubject(selectedSlot.subjectId);
              const color = subject?.color || '#C45532';
              const dayName = DAYS_OF_WEEK.find((d) => d.id === selectedSlot.dayOfWeek)?.name;

              return (
                <>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: color }} />
                      <div>
                        <span className="text-[10px] font-mono uppercase tracking-wider font-bold text-espresso-500">
                          {dayName} Schedule
                        </span>
                        <h3 className="font-serif text-lg font-bold text-espresso-950 dark:text-ivory-50">
                          {subject?.name || 'Class Details'}
                        </h3>
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedSlot(null)}
                      className="text-espresso-400 hover:text-espresso-700"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="p-4 rounded-xl bg-ivory-50 dark:bg-espresso-850 border border-ivory-200 dark:border-espresso-800 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-espresso-500 font-mono">Time:</span>
                      <span className="font-mono font-bold text-espresso-900 dark:text-ivory-100">
                        {selectedSlot.startTime} — {selectedSlot.endTime}
                      </span>
                    </div>
                    {subject && (
                      <div className="flex items-center justify-between">
                        <span className="text-espresso-500 font-mono">Course Code:</span>
                        <span className="font-mono font-bold text-espresso-900 dark:text-ivory-100">
                          {subject.code}
                        </span>
                      </div>
                    )}
                    {selectedSlot.room && (
                      <div className="flex items-center justify-between">
                        <span className="text-espresso-500 font-mono">Location:</span>
                        <span className="font-semibold text-espresso-900 dark:text-ivory-100">
                          {selectedSlot.room}
                        </span>
                      </div>
                    )}
                    {selectedSlot.instructor && (
                      <div className="flex items-center justify-between">
                        <span className="text-espresso-500 font-mono">Instructor:</span>
                        <span className="font-semibold text-espresso-900 dark:text-ivory-100">
                          {selectedSlot.instructor}
                        </span>
                      </div>
                    )}
                    {selectedSlot.notes && (
                      <div className="pt-1 border-t border-ivory-200 dark:border-espresso-800">
                        <span className="text-espresso-500 block mb-0.5">Notes:</span>
                        <p className="italic text-espresso-800 dark:text-ivory-200">{selectedSlot.notes}</p>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      onClick={() => handleDeleteSlot(selectedSlot.id)}
                      className="px-3.5 py-1.5 rounded-xl border border-rose-200 dark:border-rose-900 text-rose-600 text-xs font-semibold hover:bg-rose-50"
                    >
                      Delete
                    </button>
                    <button
                      onClick={() => handleOpenEditModal(selectedSlot)}
                      className="px-4 py-1.5 rounded-xl text-white text-xs font-semibold shadow-subtle"
                      style={{ backgroundColor: 'var(--accent)' }}
                    >
                      Edit Class
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* ── Add / Edit Class Modal ── */}
      {isAddEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-espresso-950/40 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white dark:bg-espresso-900 rounded-2xl border border-ivory-300 dark:border-espresso-700 p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-serif text-lg font-bold text-espresso-950 dark:text-ivory-50">
                {editingSlotId ? 'Edit Scheduled Class' : 'Add Class to Schedule'}
              </h3>
              <button
                onClick={() => setIsAddEditModalOpen(false)}
                className="text-espresso-400 hover:text-espresso-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSlot} className="space-y-3.5">
              {/* Subject selector */}
              <div>
                <label className="block text-xs font-semibold text-espresso-700 dark:text-espresso-300 mb-1 uppercase font-mono">
                  Subject / Course
                </label>
                <select
                  value={formSubjectId}
                  onChange={(e) => setFormSubjectId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-ivory-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-850 text-xs text-espresso-950 dark:text-ivory-50"
                >
                  {state.subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code} — {s.name}
                    </option>
                  ))}
                  <option value="new">+ Add New Subject</option>
                </select>
              </div>

              {formSubjectId === 'new' && (
                <div>
                  <label className="block text-xs font-semibold text-espresso-700 dark:text-espresso-300 mb-1 uppercase font-mono">
                    New Subject Name
                  </label>
                  <input
                    type="text"
                    required
                    value={formCustomSubject}
                    onChange={(e) => setFormCustomSubject(e.target.value)}
                    placeholder="e.g. Operating Systems"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-ivory-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-850 text-xs text-espresso-950 dark:text-ivory-50"
                  />
                </div>
              )}

              {/* Day of Week */}
              <div>
                <label className="block text-xs font-semibold text-espresso-700 dark:text-espresso-300 mb-1 uppercase font-mono">
                  Day of Week
                </label>
                <select
                  value={formDayOfWeek}
                  onChange={(e) => setFormDayOfWeek(Number(e.target.value) as DayOfWeek)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-ivory-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-850 text-xs text-espresso-950 dark:text-ivory-50"
                >
                  {DAYS_OF_WEEK.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Time slots */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-espresso-700 dark:text-espresso-300 mb-1 uppercase font-mono">
                    Start Time
                  </label>
                  <input
                    type="time"
                    required
                    value={formStartTime}
                    onChange={(e) => setFormStartTime(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-ivory-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-850 text-xs text-espresso-950 dark:text-ivory-50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-espresso-700 dark:text-espresso-300 mb-1 uppercase font-mono">
                    End Time
                  </label>
                  <input
                    type="time"
                    required
                    value={formEndTime}
                    onChange={(e) => setFormEndTime(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-ivory-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-850 text-xs text-espresso-950 dark:text-ivory-50"
                  />
                </div>
              </div>

              {/* Location & Instructor */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-espresso-700 dark:text-espresso-300 mb-1 uppercase font-mono">
                    Room / Hall
                  </label>
                  <input
                    type="text"
                    value={formRoom}
                    onChange={(e) => setFormRoom(e.target.value)}
                    placeholder="e.g. Hall 204"
                    className="w-full px-3 py-2 rounded-xl border border-ivory-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-850 text-xs text-espresso-950 dark:text-ivory-50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-espresso-700 dark:text-espresso-300 mb-1 uppercase font-mono">
                    Instructor
                  </label>
                  <input
                    type="text"
                    value={formInstructor}
                    onChange={(e) => setFormInstructor(e.target.value)}
                    placeholder="e.g. Prof. Kumar"
                    className="w-full px-3 py-2 rounded-xl border border-ivory-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-850 text-xs text-espresso-950 dark:text-ivory-50"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-espresso-700 dark:text-espresso-300 mb-1 uppercase font-mono">
                  Notes (Optional)
                </label>
                <input
                  type="text"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="e.g. Practical lab, bring manual"
                  className="w-full px-3.5 py-2 rounded-xl border border-ivory-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-850 text-xs text-espresso-950 dark:text-ivory-50"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddEditModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl border border-ivory-300 dark:border-espresso-700 text-espresso-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold rounded-xl text-white shadow-subtle"
                  style={{ backgroundColor: 'var(--accent)' }}
                >
                  {editingSlotId ? 'Save Changes' : 'Add to Schedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Add Extra Class Modal ── */}
      {isAddExtraModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-espresso-950/40 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white dark:bg-espresso-900 rounded-2xl border border-ivory-300 dark:border-espresso-700 p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider font-bold text-terracotta-600 dark:text-terracotta-400">
                  One-Off Class
                </span>
                <h3 className="font-serif text-lg font-bold text-espresso-950 dark:text-ivory-50">
                  Add Extra Class
                </h3>
              </div>
              <button
                onClick={() => setIsAddExtraModalOpen(false)}
                className="text-espresso-400 hover:text-espresso-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (extraStartTime >= extraEndTime) {
                  alert('End time must be after start time.');
                  return;
                }
                addExtraClass({
                  subjectId: extraSubjectId || state.subjects[0]?.id || '',
                  date: extraDate,
                  startTime: extraStartTime,
                  endTime: extraEndTime,
                  room: extraRoom.trim() || undefined,
                  notes: extraNotes.trim() || undefined,
                });
                setIsAddExtraModalOpen(false);
              }}
              className="space-y-3.5"
            >
              <div>
                <label className="block text-xs font-semibold text-espresso-700 dark:text-espresso-300 mb-1 uppercase font-mono">
                  Subject / Course
                </label>
                <select
                  value={extraSubjectId}
                  onChange={(e) => setExtraSubjectId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-ivory-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-850 text-xs text-espresso-950 dark:text-ivory-50"
                >
                  {state.subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code} — {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-espresso-700 dark:text-espresso-300 mb-1 uppercase font-mono">
                  Date
                </label>
                <input
                  type="date"
                  required
                  value={extraDate}
                  onChange={(e) => setExtraDate(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-ivory-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-850 text-xs text-espresso-950 dark:text-ivory-50"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-espresso-700 dark:text-espresso-300 mb-1 uppercase font-mono">
                    Start Time
                  </label>
                  <input
                    type="time"
                    required
                    value={extraStartTime}
                    onChange={(e) => setExtraStartTime(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-ivory-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-850 text-xs text-espresso-950 dark:text-ivory-50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-espresso-700 dark:text-espresso-300 mb-1 uppercase font-mono">
                    End Time
                  </label>
                  <input
                    type="time"
                    required
                    value={extraEndTime}
                    onChange={(e) => setExtraEndTime(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-ivory-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-850 text-xs text-espresso-950 dark:text-ivory-50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-espresso-700 dark:text-espresso-300 mb-1 uppercase font-mono">
                  Room / Location (Optional)
                </label>
                <input
                  type="text"
                  value={extraRoom}
                  onChange={(e) => setExtraRoom(e.target.value)}
                  placeholder="e.g. Auditorium, Lab 3"
                  className="w-full px-3.5 py-2 rounded-xl border border-ivory-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-850 text-xs text-espresso-950 dark:text-ivory-50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-espresso-700 dark:text-espresso-300 mb-1 uppercase font-mono">
                  Notes (Optional)
                </label>
                <input
                  type="text"
                  value={extraNotes}
                  onChange={(e) => setExtraNotes(e.target.value)}
                  placeholder="e.g. Remedial lecture, guest speaker"
                  className="w-full px-3.5 py-2 rounded-xl border border-ivory-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-850 text-xs text-espresso-950 dark:text-ivory-50"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddExtraModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl border border-ivory-300 dark:border-espresso-700 text-espresso-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold rounded-xl text-white shadow-subtle"
                  style={{ backgroundColor: 'var(--accent)' }}
                >
                  Add Extra Class
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Single-Occurrence Details & Reschedule Modal ── */}
      <ClassOccurrenceModal
        isOpen={Boolean(selectedOccurrence)}
        event={selectedOccurrence}
        subjectName={selectedOccurrence ? getSubject(selectedOccurrence.subjectId)?.name : undefined}
        subjectCode={selectedOccurrence ? getSubject(selectedOccurrence.subjectId)?.code : undefined}
        subjectColor={selectedOccurrence ? getSubject(selectedOccurrence.subjectId)?.color : undefined}
        onClose={() => setSelectedOccurrence(null)}
        onRescheduleOccurrence={(slotId, originalDate, newDate, newStartTime, newEndTime, newRoom, newNotes) => {
          rescheduleOccurrence(slotId, originalDate, newDate, newStartTime, newEndTime, newRoom, newNotes);
        }}
        onCancelOccurrence={(slotId, originalDate) => {
          cancelOccurrence(slotId, originalDate);
        }}
        onRestoreOccurrence={(slotId, originalDate) => {
          restoreOccurrence(slotId, originalDate);
        }}
      />

      {/* ── In-App Deletion Confirm Modal ── */}
      <ConfirmModal
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
      />

      {/* ── GPT Import Modal ── */}
      <GptTimetableImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
      />
    </div>
  );
};
