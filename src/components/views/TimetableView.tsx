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
import { BlockCalendar } from '../calendar/BlockCalendar';
import { useOptionalClassSpace } from '../../context/ClassSpaceContext';

type CalendarViewMode = 'month' | 'week' | 'day' | 'list';

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

  const classSpace = useOptionalClassSpace();
  const isClassBased = state.settings?.userMode === 'class_based';
  const hasClassSpace = Boolean(isClassBased && classSpace?.activeWorkspace);
  const canManageSchedule = Boolean(classSpace?.canEditSchedule);
  const [scheduleSource, setScheduleSource] = useState<'official' | 'personal'>('official');

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
      {/* ── Timetable Header ── */}
      <div className="border-b border-ivory-300 dark:border-espresso-800 pb-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wider font-mono font-semibold mb-1 text-terracotta-600 dark:text-terracotta-400">
              Master Schedule · Weekly Rhythms
            </p>
            <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-normal text-espresso-950 dark:text-ivory-50 tracking-tight">
              Timetable &amp; Calendar
            </h1>
            <p className="text-xs sm:text-sm text-espresso-500 dark:text-espresso-400 mt-1">
              {hasClassSpace && scheduleSource === 'official'
                ? `Official shared schedule for ${classSpace?.activeWorkspace?.name}.`
                : 'Interactive lecture schedule with single-date overrides, cancellations, and GPT syllabus synchronization.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {(!hasClassSpace || scheduleSource === 'personal' || canManageSchedule) && (
              <button
                onClick={() => setIsImportModalOpen(true)}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-espresso-850 border border-ivory-300 dark:border-espresso-700 text-espresso-800 dark:text-ivory-100 hover:bg-ivory-50 dark:hover:bg-espresso-800 shadow-subtle transition cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-terracotta-600 dark:text-terracotta-400" />
                <span>Import Timetable (GPT)</span>
              </button>
            )}

            {hasClassSpace && scheduleSource === 'official' && !canManageSchedule ? (
              <span className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-ivory-100 dark:bg-espresso-800 border border-ivory-300 dark:border-espresso-700 text-espresso-700 dark:text-ivory-300 font-mono">
                Official Schedule (CR Managed) · Read-Only
              </span>
            ) : (
              <>
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
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-espresso-850 border border-ivory-300 dark:border-espresso-700 text-espresso-800 dark:text-ivory-100 hover:bg-ivory-50 dark:hover:bg-espresso-800 shadow-subtle transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Extra Class</span>
                </button>

                <button
                  onClick={() => handleOpenAddModal()}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white shadow-subtle transition hover:opacity-95 cursor-pointer"
                  style={{ backgroundColor: 'var(--accent)' }}
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Recurring Class</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Schedule Mode Switcher (Visible when enrolled in a ClassSpace) */}
        {hasClassSpace && (
          <div className="flex items-center gap-2 p-1 bg-ivory-100 dark:bg-espresso-800 rounded-xl border border-ivory-300 dark:border-espresso-700 w-fit">
            <button
              onClick={() => setScheduleSource('official')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                scheduleSource === 'official'
                  ? 'bg-white dark:bg-espresso-700 text-espresso-950 dark:text-ivory-50 shadow-subtle'
                  : 'text-espresso-600 dark:text-espresso-300 hover:text-espresso-900 dark:hover:text-ivory-100'
              }`}
            >
              Official Class Schedule ({classSpace?.activeWorkspace?.name})
            </button>
            <button
              onClick={() => setScheduleSource('personal')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                scheduleSource === 'personal'
                  ? 'bg-white dark:bg-espresso-700 text-espresso-950 dark:text-ivory-50 shadow-subtle'
                  : 'text-espresso-600 dark:text-espresso-300 hover:text-espresso-900 dark:hover:text-ivory-100'
              }`}
            >
              Personal Timetable
            </button>
          </div>
        )}
      </div>

      {/* ── Calendar Toolbar ── */}
      <div className="p-4 rounded-2xl border border-ivory-300 dark:border-espresso-750 bg-white dark:bg-espresso-850 shadow-subtle flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Navigation & Date Heading */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleToday}
            aria-label="Go to today"
            data-testid="calendar-today-btn"
            className="px-3.5 py-1.5 rounded-xl border border-ivory-300 dark:border-espresso-700 text-xs font-medium text-espresso-800 dark:text-ivory-100 hover:bg-ivory-50 dark:hover:bg-espresso-800 transition shadow-subtle"
          >
            Today
          </button>

          <div className="flex items-center rounded-xl border border-ivory-300 dark:border-espresso-700 overflow-hidden bg-ivory-100 dark:bg-espresso-800">
            <button
              onClick={handlePrev}
              className="p-1.5 text-espresso-600 dark:text-espresso-300 hover:bg-ivory-200 dark:hover:bg-espresso-700 transition"
              title="Previous"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleNext}
              className="p-1.5 text-espresso-600 dark:text-espresso-300 hover:bg-ivory-200 dark:hover:bg-espresso-700 transition border-l border-ivory-300 dark:border-espresso-700"
              title="Next"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <h2 className="font-serif text-lg sm:text-xl font-bold text-espresso-950 dark:text-ivory-50 tracking-tight">
            {headerTitle}
          </h2>
        </div>

        {/* View Switcher: Month / Week / Day / List */}
        <div className="flex items-center p-1 bg-ivory-100 dark:bg-espresso-800 rounded-xl border border-ivory-300 dark:border-espresso-700 self-start md:self-auto">
          {(['month', 'week', 'day', 'list'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-3 sm:px-4 py-1.5 rounded-lg text-xs font-medium capitalize transition cursor-pointer ${
                viewMode === mode
                  ? 'bg-white dark:bg-espresso-700 text-espresso-950 dark:text-ivory-50 shadow-subtle font-semibold'
                  : 'text-espresso-600 dark:text-espresso-300 hover:text-espresso-900 dark:hover:text-ivory-100'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* ── 1, 2 & 3. GOOGLE CALENDAR (MONTH, WEEK & DAY VIEWS) ── */}
      {(viewMode === 'month' || viewMode === 'week' || viewMode === 'day') && (
        <BlockCalendar
          currentDate={currentDate}
          viewMode={viewMode}
          onNavigateDate={(d) => {
            setCurrentDate(d);
            setViewMode('day');
          }}
          onSelectEvent={(blk) => {
            if (blk.rawEvent) {
              setSelectedOccurrence(blk.rawEvent);
            }
          }}
        />
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
