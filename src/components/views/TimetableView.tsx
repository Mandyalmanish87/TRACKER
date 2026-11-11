import React, { useState, useMemo, useEffect } from 'react';
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
import { AttendanceMark, DayOfWeek, TimetableSlot, Subject, ResolvedCalendarEvent, TimetableImportClass } from '../../types';
import { GptTimetableImportModal } from '../timetable/GptTimetableImportModal';
import { ClassOccurrenceModal } from '../timetable/ClassOccurrenceModal';
import { ScheduleConflictBanner } from '../timetable/ScheduleConflictBanner';
import { ConfirmModal } from '../common/ConfirmModal';
import { BlockCalendar } from '../calendar/BlockCalendar';
import { useOptionalClassSpace } from '../../context/ClassSpaceContext';
import { findScheduleConflicts } from '../../utils/scheduleResolver';
import { resolveClassSchedule } from '../../utils/classSpaceUtils';
import { getActiveAccentColor } from '../../utils/themeColors';

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
    markAttendanceForEvent,
  } = useApp();

  const [viewMode, setViewMode] = useState<CalendarViewMode>('month');
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [scheduleMigrationNotice, setScheduleMigrationNotice] = useState<string | null>(null);

  const classSpace = useOptionalClassSpace();
  const isClassBased = state.settings?.userMode === 'class_based';
  const hasClassSpace = Boolean(isClassBased && classSpace?.activeWorkspace);
  const canManageSchedule = Boolean(classSpace?.canEditSchedule);
  // Default to personal schedule unless actively in class-based mode with an active ClassSpace
  const [selectedScheduleSource, setScheduleSource] = useState<'official' | 'personal'>(() =>
    isClassBased ? 'official' : 'personal'
  );
  // Class-based users always see the authoritative shared schedule. Their
  // private timetable remains stored, but is not a second schedule surface.
  const scheduleSource: 'official' | 'personal' = isClassBased ? 'official' : selectedScheduleSource;

  // ClassSpace data hydrates asynchronously; select its schedule as soon as it is available.
  useEffect(() => {
    setScheduleSource(isClassBased ? 'official' : 'personal');
  }, [isClassBased]);

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

  // Conflict detection for Add Extra Class modal
  const extraConflicts = useMemo(() => {
    if (!isAddExtraModalOpen || !extraDate || !extraStartTime || !extraEndTime) return [];
    return findScheduleConflicts({
      date: extraDate,
      startTime: extraStartTime,
      endTime: extraEndTime,
      timetable: state.timetable || [],
      overrides: state.occurrenceOverrides || [],
      extraClasses: state.extraClasses || [],
      subjects: state.subjects || [],
    });
  }, [
    isAddExtraModalOpen,
    extraDate,
    extraStartTime,
    extraEndTime,
    state.timetable,
    state.occurrenceOverrides,
    state.extraClasses,
    state.subjects,
  ]);

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

  const handleOpenEditModal = (slot: {
    id: string;
    dayOfWeek: DayOfWeek;
    startTime: string;
    endTime: string;
    room?: string;
    instructor?: string;
    notes?: string;
    subjectId?: string;
    subjectName?: string;
  }) => {
    setEditingSlotId(slot.id);
    setFormSubjectId(slot.subjectId || slot.id);
    setFormCustomSubject(slot.subjectName || '');
    setFormDayOfWeek(slot.dayOfWeek);
    setFormStartTime(slot.startTime);
    setFormEndTime(slot.endTime);
    setFormRoom(slot.room || '');
    setFormInstructor(slot.instructor || '');
    setFormNotes(slot.notes || '');
    setSelectedSlot(null);
    setIsAddEditModalOpen(true);
  };

  const handleSaveSlot = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formStartTime >= formEndTime) {
      alert('End time must be after start time.');
      return;
    }

    if (scheduleSource === 'official') {
      if (!classSpace?.canEditSchedule) {
        alert('You do not have permission to edit the official ClassSpace timetable.');
        return;
      }
      let subjectName = formCustomSubject.trim();
      let subjectCode = 'ACAD';
      let subjectColor = getActiveAccentColor();

      if (formSubjectId !== 'new') {
        const found = classSpace.rules.find((r) => r.id === formSubjectId);
        if (found) {
          subjectName = found.subjectName;
          subjectCode = found.subjectCode;
          subjectColor = found.subjectColor;
        } else {
          const appSub = state.subjects.find((s) => s.id === formSubjectId);
          if (appSub) {
            subjectName = appSub.name;
            subjectCode = appSub.code;
            subjectColor = appSub.color;
          }
        }
      }

      if (!subjectName) subjectName = 'Academic Class';

      if (editingSlotId) {
        const result = await classSpace.updateTimetableRule(editingSlotId, {
          dayOfWeek: formDayOfWeek,
          startTime: formStartTime,
          endTime: formEndTime,
          subjectName,
          subjectCode,
          subjectColor,
          room: formRoom.trim() || undefined,
          instructor: formInstructor.trim() || undefined,
          notes: formNotes.trim() || undefined,
        });
        if (result.error) {
          setScheduleMigrationNotice(`Could not save timetable changes: ${result.error}`);
          return;
        }
      } else {
        const result = await classSpace.addTimetableRule({
          dayOfWeek: formDayOfWeek,
          startTime: formStartTime,
          endTime: formEndTime,
          subjectName,
          subjectCode,
          subjectColor,
          room: formRoom.trim() || undefined,
          instructor: formInstructor.trim() || undefined,
          notes: formNotes.trim() || undefined,
        });
        if (result.error) {
          setScheduleMigrationNotice(`Could not save class: ${result.error}`);
          return;
        }
      }

      setScheduleMigrationNotice('Official ClassSpace timetable saved.');
      setIsAddEditModalOpen(false);
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

  const handleImportOfficialClasses = async (classes: TimetableImportClass[]) => {
    if (!classSpace?.activeWorkspace || !classSpace.canEditSchedule) {
      throw new Error('Only the class representative or an approved schedule manager can import the official timetable.');
    }

    const dayNumbers: Record<string, DayOfWeek> = {
      monday: 1, tuesday: 2, wednesday: 3, thursday: 4,
      friday: 5, saturday: 6, sunday: 7,
    };
    const seen = [...classSpace.rules];
    let importedCount = 0;
    let skippedCount = 0;

    for (const item of classes) {
      const dayOfWeek = dayNumbers[item.day.toLowerCase()];
      const normalizedSubject = item.subject.trim().toLowerCase();
      const duplicate = seen.some((rule) =>
        rule.dayOfWeek === dayOfWeek &&
        rule.startTime === item.startTime &&
        rule.endTime === item.endTime &&
        (rule.subjectName.trim().toLowerCase() === normalizedSubject || rule.subjectCode.trim().toLowerCase() === normalizedSubject)
      );
      if (duplicate) {
        skippedCount++;
        continue;
      }

      const linkedSubject = state.subjects.find((subject) =>
        subject.name.trim().toLowerCase() === normalizedSubject || subject.code.trim().toLowerCase() === normalizedSubject
      );
      const generatedCode = item.subject
        .split(/\s+/)
        .filter(Boolean)
        .map((word) => word.replace(/[^a-z0-9]/gi, '').slice(0, 1))
        .join('')
        .toUpperCase()
        .slice(0, 8) || 'ACAD';
      const ruleDetails = {
        subjectName: item.subject,
        subjectCode: linkedSubject?.code || generatedCode,
        subjectColor: linkedSubject?.color || getActiveAccentColor(),
        dayOfWeek,
        startTime: item.startTime,
        endTime: item.endTime,
        room: item.room || item.location,
        instructor: item.instructor,
        notes: item.notes,
      };
      const result = await classSpace.addTimetableRule(ruleDetails);
      if (result.error) {
        skippedCount++;
        continue;
      }
      importedCount++;
      seen.push({ ...ruleDetails, id: `imported-${importedCount}`, workspaceId: classSpace.activeWorkspace.id, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), createdBy: '' });
    }

    return { importedCount, skippedCount };
  };

  const handleDeleteSlot = (id: string) => {
    if (scheduleSource === 'official') {
      setConfirmDialog({
        isOpen: true,
        title: 'Delete ClassSpace Class',
        message: 'Are you sure you want to delete this weekly recurring class from the official ClassSpace timetable? This will remove it for all enrolled classmates.',
        onConfirm: async () => {
          const result = await classSpace?.deleteTimetableRule(id);
          if (result?.error) {
            alert(result.error);
            return;
          }
          setSelectedSlot(null);
          setSelectedOccurrence(null);
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        },
      });
      return;
    }

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

  const getSelectedAttendanceStatus = (): AttendanceMark | 'unmarked' => {
    if (!selectedOccurrence) return 'unmarked';
    if (scheduleSource === 'official') {
      return classSpace?.attendanceRecords.find((record) => record.occurrenceKey === selectedOccurrence.occurrenceKey)?.status || 'unmarked';
    }
    const log = state.attendanceLogs.find((entry) => {
      if (selectedOccurrence.extraClassId) return entry.extraClassId === selectedOccurrence.extraClassId && entry.date === selectedOccurrence.date;
      return Boolean(selectedOccurrence.slotId && entry.slotId === selectedOccurrence.slotId && entry.date === selectedOccurrence.date);
    });
    return log?.status || 'unmarked';
  };

  const markSelectedAttendance = (status: AttendanceMark) => {
    if (!selectedOccurrence || selectedOccurrence.isCancelled) return;
    if (scheduleSource === 'official') {
      void classSpace?.markAttendance(selectedOccurrence.occurrenceKey, selectedOccurrence.date, status);
    } else {
      markAttendanceForEvent(
        selectedOccurrence.occurrenceKey,
        selectedOccurrence.subjectId,
        selectedOccurrence.date,
        status,
        selectedOccurrence.slotId,
        selectedOccurrence.extraClassId,
        selectedOccurrence.overrideId
      );
    }
  };

  return (
    <div className="timetable-page space-y-6 pb-20">
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
            {(!isClassBased || (hasClassSpace && canManageSchedule)) && (
              <button
                onClick={() => setIsImportModalOpen(true)}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-espresso-850 border border-ivory-300 dark:border-espresso-700 text-espresso-800 dark:text-ivory-100 hover:bg-ivory-50 dark:hover:bg-espresso-800 shadow-subtle transition cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-terracotta-600 dark:text-terracotta-400" />
                <span>Import Timetable (GPT)</span>
              </button>
            )}

            {isClassBased && hasClassSpace && !canManageSchedule ? (
              <span className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-ivory-100 dark:bg-espresso-800 border border-ivory-300 dark:border-espresso-700 text-espresso-700 dark:text-ivory-300 font-mono">
                Official Schedule (CR Managed) · Read-Only
              </span>
            ) : (!isClassBased || (hasClassSpace && canManageSchedule)) ? (
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
            ) : null}
          </div>
        </div>

        {isClassBased && hasClassSpace && classSpace && (
          <div className="flex flex-wrap items-center gap-3">
            {classSpace.workspaces.length > 1 ? (
              <label className="flex flex-wrap items-center gap-2 text-xs font-medium text-espresso-600 dark:text-espresso-300">
                <span>Class timetable</span>
                <select
                  value={classSpace.activeWorkspace?.id || ''}
                  onChange={(event) => classSpace.selectWorkspace(event.target.value)}
                  aria-label="Choose a ClassSpace timetable"
                  className="max-w-full rounded-xl border border-ivory-300 dark:border-espresso-700 bg-white dark:bg-espresso-850 px-3 py-2 text-xs font-semibold text-espresso-900 dark:text-ivory-100 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                >
                  {classSpace.workspaces.map((workspace) => (
                    <option key={workspace.id} value={workspace.id}>{workspace.name}</option>
                  ))}
                </select>
              </label>
            ) : (
              <span className="inline-flex items-center gap-2 rounded-xl border border-ivory-300 dark:border-espresso-700 bg-white/70 dark:bg-espresso-850/70 px-3 py-2 text-xs font-semibold text-espresso-700 dark:text-ivory-200">
                Official ClassSpace Schedule <span className="text-espresso-400">·</span> {classSpace.activeWorkspace?.name}
              </span>
            )}
            {!canManageSchedule && (
              <span className="text-[11px] text-espresso-500 dark:text-espresso-400">Read only · managed by your class representative</span>
            )}
          </div>
        )}
        {isClassBased && !hasClassSpace && (
          <div className="rounded-xl border border-dashed border-ivory-300 dark:border-espresso-700 bg-white/50 dark:bg-espresso-900/30 px-4 py-3 text-sm text-espresso-600 dark:text-espresso-300">
            Join a ClassSpace to view its official timetable. Your personal timetable stays private and is not shown in class mode.
          </div>
        )}
      </div>

      {scheduleMigrationNotice && (
        <div role="status" className="flex items-center justify-between gap-3 rounded-xl border border-sage-300 dark:border-sage-800 bg-sage-50 dark:bg-sage-950/30 px-4 py-3 text-xs text-sage-800 dark:text-sage-200">
          <span>{scheduleMigrationNotice}</span>
          <button type="button" onClick={() => setScheduleMigrationNotice(null)} aria-label="Dismiss timetable import message" className="rounded-md p-1 hover:bg-sage-100 dark:hover:bg-sage-900/50">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

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
              aria-label={`Previous ${viewMode}`}
              className="p-1.5 text-espresso-600 dark:text-espresso-300 hover:bg-ivory-200 dark:hover:bg-espresso-700 transition"
              title="Previous"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleNext}
              aria-label={`Next ${viewMode}`}
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
                aria-pressed={viewMode === mode}
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
          scheduleSource={scheduleSource}
          onNavigateDate={(d) => {
            setCurrentDate(d);
            setViewMode('day');
          }}
          onSelectEvent={!isClassBased || canManageSchedule ? (blk) => {
            if (blk.rawEvent) setSelectedOccurrence(blk.rawEvent);
          } : undefined}
        />
      )}

      {/* ── 3. LIST / DAY VIEW ── */}
      {viewMode === 'list' && (
        <div className="space-y-4">
          {/* Day Pills Bar */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
            {DAYS_OF_WEEK.map((day) => {
              const count =
                scheduleSource === 'official'
                  ? (classSpace?.rules || []).filter((r) => r.dayOfWeek === day.id).length
                  : state.timetable.filter((t) => t.dayOfWeek === day.id).length;
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
            const isOfficial = scheduleSource === 'official';
            const selectedDate = formatDateStr(currentDate);
            const rawSlots = isOfficial
              ? canManageSchedule
                ? (classSpace?.rules || []).filter((r) => r.dayOfWeek === activeDow)
                : resolveClassSchedule(
                    classSpace?.rules || [],
                    classSpace?.overrides || [],
                    currentDate,
                    currentDate
                  ).map((occurrence) => ({ ...occurrence, id: occurrence.occurrenceKey, _resolvedOccurrence: occurrence }))
              : state.timetable.filter((t) => t.dayOfWeek === activeDow);

            const slots = [...rawSlots].sort((a, b) => a.startTime.localeCompare(b.startTime));

            if (slots.length === 0) {
              return (
                <div className="p-12 text-center rounded-2xl border border-dashed border-ivory-300 dark:border-espresso-700 bg-white/40 dark:bg-espresso-850/40">
                  <CalendarIcon className="w-8 h-8 text-espresso-400 mx-auto mb-2" />
                  <p className="text-xs text-espresso-500 italic">No classes scheduled for this day.</p>
                  {(!isOfficial || canManageSchedule) && (
                    <button
                      onClick={() => handleOpenAddModal(activeDow)}
                      className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-white text-xs font-semibold"
                      style={{ backgroundColor: 'var(--accent)' }}
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Class
                    </button>
                  )}
                </div>
              );
            }

            return (
              <div className="space-y-3">
                {slots.map((slot: any) => {
                  const subjectName = isOfficial
                    ? slot.subjectName
                    : getSubject(slot.subjectId)?.name || 'Class';
                  const subjectCode = isOfficial
                    ? slot.subjectCode
                    : getSubject(slot.subjectId)?.code;
                  const color = isOfficial
                    ? slot.subjectColor || getActiveAccentColor()
                    : getSubject(slot.subjectId)?.color || getActiveAccentColor();
                  const classOccurrence = isOfficial
                    ? slot._resolvedOccurrence || classSpace?.occurrences.find((occurrence) => occurrence.date === selectedDate && occurrence.ruleId === slot.id)
                    : undefined;
                  const personalClassRecord = classOccurrence
                    ? classSpace?.attendanceRecords.find((record) => record.occurrenceKey === classOccurrence.occurrenceKey)
                    : undefined;

                  return (
                    <div
                      key={slot.id}
                      className={`p-4 sm:p-5 rounded-2xl border border-ivory-300 dark:border-espresso-750 bg-white dark:bg-espresso-850 shadow-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${classOccurrence?.isCancelled ? 'opacity-65' : ''}`}
                      style={{ borderLeft: `6px solid ${color}` }}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-semibold text-terracotta-600 dark:text-terracotta-400 flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {slot.startTime} — {slot.endTime}
                          </span>
                          {subjectCode && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-ivory-200 dark:bg-espresso-800 text-espresso-700 dark:text-ivory-200">
                              {subjectCode}
                            </span>
                          )}
                        </div>
                        <h3 className="font-serif text-lg font-bold text-espresso-950 dark:text-ivory-50">
                          {subjectName}
                        </h3>
                        {classOccurrence?.isCancelled && (
                          <span className="inline-flex rounded-full border border-rose-200 dark:border-rose-900/70 bg-rose-50 dark:bg-rose-950/30 px-2 py-0.5 text-[10px] font-semibold text-rose-700 dark:text-rose-300">
                            {classOccurrence.changeNote || 'Class cancelled'}
                          </span>
                        )}
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

                      {(!isOfficial || canManageSchedule) && (
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
                      )}
                      {isOfficial && isClassBased && !canManageSchedule && classOccurrence && !classOccurrence.isCancelled && (
                        <div className="flex flex-wrap items-center gap-1.5 sm:ml-auto" aria-label={`Mark your ${subjectName} attendance for ${selectedDate}`}>
                          <span className="w-full text-[10px] font-mono uppercase tracking-wide text-espresso-400 sm:text-right">
                            My attendance{personalClassRecord ? ` · ${personalClassRecord.status}` : ''}
                          </span>
                          {([
                            ['present', 'Present'],
                            ['absent', 'Absent'],
                            ['cancelled', 'Cancelled'],
                          ] as const).map(([status, label]) => (
                            <button
                              key={status}
                              type="button"
                              aria-pressed={personalClassRecord?.status === status}
                              onClick={() => void classSpace?.markAttendance(classOccurrence.occurrenceKey, selectedDate, status)}
                              className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] ${
                                personalClassRecord?.status === status
                                  ? status === 'present' ? 'border-emerald-600 bg-emerald-600 text-white' : status === 'absent' ? 'border-rose-600 bg-rose-600 text-white' : 'border-amber-600 bg-amber-600 text-white'
                                  : 'border-ivory-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-800 text-espresso-700 dark:text-ivory-200 hover:border-[var(--accent)]'
                              }`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      )}
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
              const color = subject?.color || getActiveAccentColor();
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
                if (scheduleSource === 'official') {
                  const ruleMatch = classSpace?.rules.find((r) => r.id === extraSubjectId);
                  const sub = state.subjects.find((s) => s.id === extraSubjectId);
                  classSpace?.addExtraClass({
                    subjectName: ruleMatch?.subjectName || sub?.name || 'Academic Class',
                    subjectCode: ruleMatch?.subjectCode || sub?.code || 'ACAD',
                    subjectColor: ruleMatch?.subjectColor || sub?.color || getActiveAccentColor(),
                    date: extraDate,
                    startTime: extraStartTime,
                    endTime: extraEndTime,
                    room: extraRoom.trim() || undefined,
                    notes: extraNotes.trim() || undefined,
                  });
                } else {
                  addExtraClass({
                    subjectId: extraSubjectId || state.subjects[0]?.id || '',
                    date: extraDate,
                    startTime: extraStartTime,
                    endTime: extraEndTime,
                    room: extraRoom.trim() || undefined,
                    notes: extraNotes.trim() || undefined,
                  });
                }
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

              {extraConflicts.length > 0 && (
                <ScheduleConflictBanner
                  conflicts={extraConflicts}
                  message="This proposed extra class overlaps with existing class"
                />
              )}

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
        subjectName={
          selectedOccurrence
            ? scheduleSource === 'official'
              ? (selectedOccurrence as any).subjectName || getSubject(selectedOccurrence.subjectId)?.name
              : getSubject(selectedOccurrence.subjectId)?.name
            : undefined
        }
        subjectCode={
          selectedOccurrence
            ? scheduleSource === 'official'
              ? (selectedOccurrence as any).subjectCode || getSubject(selectedOccurrence.subjectId)?.code
              : getSubject(selectedOccurrence.subjectId)?.code
            : undefined
        }
        subjectColor={
          selectedOccurrence
            ? scheduleSource === 'official'
              ? (selectedOccurrence as any).subjectColor || getSubject(selectedOccurrence.subjectId)?.color
              : getSubject(selectedOccurrence.subjectId)?.color
            : undefined
        }
        onClose={() => setSelectedOccurrence(null)}
        attendanceStatus={getSelectedAttendanceStatus()}
        onMarkAttendance={markSelectedAttendance}
        onRescheduleOccurrence={(slotId, originalDate, newDate, newStartTime, newEndTime, newRoom, newNotes) => {
          if (scheduleSource === 'official') {
            classSpace?.rescheduleOccurrence({
              ruleId: slotId,
              originalDate,
              newDate,
              newStartTime,
              newEndTime,
              newRoom,
              newNotes,
            });
          } else {
            rescheduleOccurrence(slotId, originalDate, newDate, newStartTime, newEndTime, newRoom, newNotes);
          }
        }}
        onCancelOccurrence={(slotId, originalDate) => {
          if (scheduleSource === 'official') {
            classSpace?.cancelOccurrence({
              ruleId: slotId,
              originalDate,
            });
          } else {
            cancelOccurrence(slotId, originalDate);
          }
        }}
        onRestoreOccurrence={(slotId, originalDate) => {
          if (scheduleSource === 'official') {
            if (selectedOccurrence?.overrideId) {
              classSpace?.restoreOccurrence(selectedOccurrence.overrideId);
            }
          } else {
            restoreOccurrence(slotId, originalDate);
          }
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
        destinationLabel={isClassBased && hasClassSpace ? `${classSpace?.activeWorkspace?.name} official ClassSpace schedule` : 'your personal weekly timetable'}
        existingOfficialRules={isClassBased && hasClassSpace ? classSpace?.rules || [] : undefined}
        onImportOfficialClasses={isClassBased && hasClassSpace && canManageSchedule ? handleImportOfficialClasses : undefined}
      />
    </div>
  );
};
