import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  User,
  CheckCircle2,
  XCircle,
  Ban,
  Filter,
  X,
  Sparkles,
  Flame,
  Dumbbell,
  BookOpen,
  GripVertical,
  ChevronRight,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  ResolvedCalendarEvent,
  Subject,
  DayOfWeek,
} from '../../types';
import {
  dateToDayOfWeek,
  formatDateStr,
  resolveSchedule,
} from '../../utils/scheduleResolver';
import {
  RecurrencePromptModal,
  RescheduleProposal,
} from '../timetable/RecurrencePromptModal';
import { useOptionalClassSpace } from '../../context/ClassSpaceContext';

export type ActivityCategory = 'all' | 'college' | 'study' | 'gym';

export interface CalendarBlockItem {
  id: string;
  title: string;
  subtitle?: string;
  category: 'college' | 'study' | 'gym' | 'personal';
  startTime: string; // "HH:MM"
  endTime: string;   // "HH:MM"
  dateStr: string;   // "YYYY-MM-DD"
  color: string;
  badgeText?: string;
  room?: string;
  instructor?: string;
  notes?: string;
  rawEvent?: ResolvedCalendarEvent;
  isRecurring?: boolean;
}

interface BlockCalendarProps {
  currentDate: Date;
  viewMode: 'month' | 'week' | 'day' | 'list';
  onSelectEvent?: (event: CalendarBlockItem) => void;
  onNavigateDate?: (newDate: Date) => void;
}

const START_HOUR = 7; // 7:00 AM
const END_HOUR = 21;  // 9:00 PM
const HOURS = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => i + START_HOUR);
const HOUR_HEIGHT = 64; // px per hour

const DAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAYS_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const timeToMinutes = (timeStr: string): number => {
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

const minutesToTime = (mins: number): string => {
  const clamped = Math.max(0, Math.min(24 * 60 - 1, mins));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

export const BlockCalendar: React.FC<BlockCalendarProps> = ({
  currentDate,
  viewMode,
  onSelectEvent,
  onNavigateDate,
}) => {
  const {
    state,
    markAttendanceForEvent,
    rescheduleOccurrence,
    updateTimetableSlot,
  } = useApp();
  const classSpace = useOptionalClassSpace();

  const [selectedCategory, setSelectedCategory] = useState<ActivityCategory>('all');
  const [activeDrawerBlock, setActiveDrawerBlock] = useState<CalendarBlockItem | null>(null);

  // Recurrence confirmation dialog state for drag-and-drop
  const [recurrenceProposal, setRecurrenceProposal] = useState<RescheduleProposal | null>(null);

  // Dragging state
  const [draggingBlock, setDraggingBlock] = useState<CalendarBlockItem | null>(null);
  const [dragPreview, setDragPreview] = useState<{
    dateStr: string;
    startTime: string;
    endTime: string;
  } | null>(null);

  // Current time tracker for live red line
  const [currentTimeMinutes, setCurrentTimeMinutes] = useState<number>(() => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  });

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTimeMinutes(now.getHours() * 60 + now.getMinutes());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  const todayStr = useMemo(() => formatDateStr(new Date()), []);

  // Subject lookup map
  const subjectMap = useMemo(() => {
    const map = new Map<string, Subject>();
    for (const s of state.subjects || []) {
      map.set(s.id, s);
    }
    return map;
  }, [state.subjects]);

  // Compute Week range [Monday ... Sunday]
  const weekDates = useMemo(() => {
    const d = new Date(currentDate);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));

    const dates: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const cur = new Date(monday);
      cur.setDate(monday.getDate() + i);
      dates.push(cur);
    }
    return dates;
  }, [currentDate]);

  // Compute Month range (includes leading/trailing padding days)
  const monthDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const firstDow = dateToDayOfWeek(firstDay); // 1=Mon..7=Sun
    const totalDays = lastDay.getDate();

    const days: { date: Date; dateStr: string; isCurrentMonth: boolean; isToday: boolean }[] = [];

    // Leading padding days
    const prevMonthLast = new Date(year, month, 0).getDate();
    for (let i = firstDow - 2; i >= 0; i--) {
      const d = new Date(year, month - 1, prevMonthLast - i);
      const str = formatDateStr(d);
      days.push({ date: d, dateStr: str, isCurrentMonth: false, isToday: str === todayStr });
    }

    // Days in current month
    for (let d = 1; d <= totalDays; d++) {
      const date = new Date(year, month, d);
      const str = formatDateStr(date);
      days.push({ date, dateStr: str, isCurrentMonth: true, isToday: str === todayStr });
    }

    // Trailing padding days
    const remaining = 7 - (days.length % 7);
    if (remaining < 7) {
      for (let i = 1; i <= remaining; i++) {
        const d = new Date(year, month + 1, i);
        const str = formatDateStr(d);
        days.push({ date: d, dateStr: str, isCurrentMonth: false, isToday: str === todayStr });
      }
    }

    return days;
  }, [currentDate, todayStr]);

  // Active date range based on view
  const { visibleStart, visibleEnd } = useMemo(() => {
    if (viewMode === 'month') {
      return {
        visibleStart: monthDays[0]?.date || currentDate,
        visibleEnd: monthDays[monthDays.length - 1]?.date || currentDate,
      };
    }
    if (viewMode === 'week') {
      return {
        visibleStart: weekDates[0],
        visibleEnd: weekDates[6],
      };
    }
    // Day or List
    const dayStart = new Date(currentDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(currentDate);
    dayEnd.setHours(23, 59, 59, 999);
    return { visibleStart: dayStart, visibleEnd: dayEnd };
  }, [viewMode, monthDays, weekDates, currentDate]);

  // Unified items aggregator for calendar using resolveSchedule or official ClassSpace
  const allCalendarBlocks = useMemo(() => {
    const blocks: CalendarBlockItem[] = [];
    const isClassBased = state.settings?.userMode === 'class_based';

    if (isClassBased && classSpace?.activeWorkspace && classSpace.occurrences.length > 0) {
      const startStr = formatDateStr(visibleStart);
      const endStr = formatDateStr(visibleEnd);

      for (const occ of classSpace.occurrences) {
        if (occ.isCancelled) continue;
        if (occ.date < startStr || occ.date > endStr) continue;

        blocks.push({
          id: occ.occurrenceKey,
          title: occ.subjectName,
          subtitle: occ.subjectCode,
          category: 'college',
          startTime: occ.startTime,
          endTime: occ.endTime,
          dateStr: occ.date,
          color: occ.subjectColor,
          badgeText:
            occ.source === 'rescheduled'
              ? 'Rescheduled'
              : occ.source === 'extra'
              ? 'Extra Class'
              : occ.subjectCode || 'Class',
          room: occ.room,
          instructor: occ.instructor,
          notes: occ.changeNote ? `${occ.changeNote}${occ.notes ? ' · ' + occ.notes : ''}` : occ.notes,
          isRecurring: occ.source === 'recurring',
          rawEvent: {
            occurrenceKey: occ.occurrenceKey,
            slotId: occ.ruleId,
            extraClassId: occ.source === 'extra' ? occ.overrideId : undefined,
            overrideId: occ.overrideId,
            subjectId: occ.ruleId || occ.overrideId || occ.occurrenceKey,
            dayOfWeek: dateToDayOfWeek(new Date(occ.date)) as DayOfWeek,
            date: occ.date,
            startTime: occ.startTime,
            endTime: occ.endTime,
            room: occ.room,
            instructor: occ.instructor,
            notes: occ.notes,
            source: occ.source,
            isCancelled: occ.isCancelled,
            changeNote: occ.changeNote,
          },
        });
      }
    } else {
      // 1. College Classes resolved with full override & extra class logic
      const resolvedEvents = resolveSchedule(
        state.timetable || [],
        state.occurrenceOverrides || [],
        state.extraClasses || [],
        visibleStart,
        visibleEnd
      );

      for (const evt of resolvedEvents) {
        if (evt.isCancelled) continue;

        const sub = subjectMap.get(evt.subjectId);
        const color = sub?.color || '#C45532';
        const isRecurring = Boolean(evt.slotId && evt.source !== 'extra');

        blocks.push({
          id: evt.occurrenceKey,
          title: sub?.name || 'Academic Class',
          subtitle: sub?.code || 'ACAD',
          category: 'college',
          startTime: evt.startTime,
          endTime: evt.endTime,
          dateStr: evt.date,
          color: color,
          badgeText:
            evt.source === 'rescheduled'
              ? 'Rescheduled'
              : evt.source === 'extra'
              ? 'Extra Class'
              : sub?.code || 'Class',
          room: evt.room,
          instructor: evt.instructor,
          notes: evt.notes,
          isRecurring: isRecurring,
          rawEvent: evt,
        });
      }
    }

    // 2. Study Tasks with due dates
    for (const task of state.tasks || []) {
      if (task.dueDate) {
        const start = task.dueTime || '14:00';
        const [h, m] = start.split(':').map(Number);
        const dur = task.estimatedDuration || 45;
        const total = (h || 14) * 60 + (m || 0) + dur;
        const end = minutesToTime(total);

        blocks.push({
          id: `task-${task.id}`,
          title: task.title,
          subtitle: 'Study Sprint',
          category: 'study',
          startTime: start,
          endTime: end,
          dateStr: task.dueDate,
          color: '#E07A5F',
          badgeText: `Task (${task.priority.toUpperCase()})`,
          notes: task.description,
          isRecurring: false,
        });
      }
    }

    // 3. Gym workout logs
    for (const log of state.gymWorkouts || []) {
      blocks.push({
        id: `gym-${log.id}`,
        title: `${log.split || 'Strength'} Session`,
        subtitle: 'Physical Training',
        category: 'gym',
        startTime: '18:00',
        endTime: '19:15',
        dateStr: log.date,
        color: '#D4A373',
        badgeText: 'Workout',
        notes: log.notes,
        isRecurring: false,
      });
    }

    return blocks;
  }, [
    state.timetable,
    state.occurrenceOverrides,
    state.extraClasses,
    state.tasks,
    state.gymWorkouts,
    visibleStart,
    visibleEnd,
    subjectMap,
  ]);

  // Filtered blocks based on category stream
  const filteredBlocks = useMemo(() => {
    if (selectedCategory === 'all') return allCalendarBlocks;
    return allCalendarBlocks.filter((b) => b.category === selectedCategory);
  }, [allCalendarBlocks, selectedCategory]);

  // Fast date-keyed lookup
  const blocksByDate = useMemo(() => {
    const map = new Map<string, CalendarBlockItem[]>();
    for (const blk of filteredBlocks) {
      const list = map.get(blk.dateStr) || [];
      list.push(blk);
      map.set(blk.dateStr, list);
    }
    map.forEach((list) => {
      list.sort((a, b) => a.startTime.localeCompare(b.startTime));
    });
    return map;
  }, [filteredBlocks]);

  const getBlocksForDate = (dateStr: string) => blocksByDate.get(dateStr) || [];

  const handleBlockClick = (blk: CalendarBlockItem) => {
    if (onSelectEvent) {
      onSelectEvent(blk);
    } else {
      setActiveDrawerBlock(blk);
    }
  };

  const getAttendanceStatusForBlock = (block: CalendarBlockItem) => {
    const log = state.attendanceLogs?.find((l) => {
      if (block.rawEvent?.extraClassId) {
        return l.extraClassId === block.rawEvent.extraClassId && l.date === block.rawEvent.date;
      }
      if (block.rawEvent?.slotId) {
        return l.slotId === block.rawEvent.slotId && l.date === block.rawEvent.date;
      }
      return false;
    });
    return log?.status || 'unmarked';
  };

  // ─────────────────────────────────────────────────────────────
  // DRAG & DROP RESCHEDULING ENGINE
  // ─────────────────────────────────────────────────────────────

  const handleDragStart = (e: React.DragEvent, blk: CalendarBlockItem) => {
    e.dataTransfer.setData('text/plain', JSON.stringify({ id: blk.id }));
    e.dataTransfer.effectAllowed = 'move';
    setDraggingBlock(blk);
  };

  const handleDragEnd = () => {
    setDraggingBlock(null);
    setDragPreview(null);
  };

  // Month View Drop Handler (moves block to target date, preserves duration)
  const handleMonthCellDrop = (e: React.DragEvent, targetDateStr: string) => {
    e.preventDefault();
    if (!draggingBlock) return;

    if (draggingBlock.dateStr === targetDateStr) {
      setDraggingBlock(null);
      return;
    }

    const duration = timeToMinutes(draggingBlock.endTime) - timeToMinutes(draggingBlock.startTime);
    const newStart = draggingBlock.startTime;
    const newEnd = minutesToTime(timeToMinutes(newStart) + duration);

    initiateRescheduleProposal(draggingBlock, targetDateStr, newStart, newEnd);
    setDraggingBlock(null);
  };

  // Week & Day View Drop Handler (moves block to day and 15-min snapped time slot)
  const handleTimeGridDrop = (
    e: React.DragEvent,
    targetDateStr: string,
    gridTopY: number
  ) => {
    e.preventDefault();
    if (!draggingBlock) return;

    const offsetY = Math.max(0, e.clientY - gridTopY);
    const quarterHours = Math.round((offsetY / HOUR_HEIGHT) * 4);
    const minutesFromDayStart = quarterHours * 15;
    const originalDuration = Math.max(
      30,
      timeToMinutes(draggingBlock.endTime) - timeToMinutes(draggingBlock.startTime)
    );

    let startMins = START_HOUR * 60 + minutesFromDayStart;
    if (startMins + originalDuration > (END_HOUR + 1) * 60) {
      startMins = (END_HOUR + 1) * 60 - originalDuration;
    }
    if (startMins < START_HOUR * 60) {
      startMins = START_HOUR * 60;
    }

    const newStart = minutesToTime(startMins);
    const newEnd = minutesToTime(startMins + originalDuration);

    initiateRescheduleProposal(draggingBlock, targetDateStr, newStart, newEnd);
    setDraggingBlock(null);
    setDragPreview(null);
  };

  const handleTimeGridDragOver = (
    e: React.DragEvent,
    targetDateStr: string,
    gridTopY: number
  ) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    if (!draggingBlock) return;

    const offsetY = Math.max(0, e.clientY - gridTopY);
    const quarterHours = Math.round((offsetY / HOUR_HEIGHT) * 4);
    const minutesFromDayStart = quarterHours * 15;
    const originalDuration = Math.max(
      30,
      timeToMinutes(draggingBlock.endTime) - timeToMinutes(draggingBlock.startTime)
    );

    let startMins = START_HOUR * 60 + minutesFromDayStart;
    if (startMins + originalDuration > (END_HOUR + 1) * 60) {
      startMins = (END_HOUR + 1) * 60 - originalDuration;
    }
    if (startMins < START_HOUR * 60) {
      startMins = START_HOUR * 60;
    }

    setDragPreview({
      dateStr: targetDateStr,
      startTime: minutesToTime(startMins),
      endTime: minutesToTime(startMins + originalDuration),
    });
  };

  const initiateRescheduleProposal = (
    block: CalendarBlockItem,
    newDate: string,
    newStartTime: string,
    newEndTime: string
  ) => {
    const raw = block.rawEvent;
    const targetDateObj = new Date(newDate + 'T00:00:00');
    const newDow = dateToDayOfWeek(targetDateObj);

    // If it's a recurring slot, prompt user: "This occurrence only" vs "All future occurrences"
    if (block.isRecurring && raw?.slotId) {
      setRecurrenceProposal({
        slotId: raw.slotId,
        occurrenceKey: raw.occurrenceKey,
        title: block.title,
        originalDate: block.dateStr,
        newDate,
        originalStartTime: block.startTime,
        newStartTime,
        originalEndTime: block.endTime,
        newEndTime,
        newDayOfWeek: newDow,
      });
      return;
    }

    // If it's a non-recurring occurrence (already rescheduled single occurrence or extra class)
    if (raw?.slotId) {
      rescheduleOccurrence(
        raw.slotId,
        block.dateStr,
        newDate,
        newStartTime,
        newEndTime
      );
    }
  };

  const handleConfirmSingleOccurrence = (proposal: RescheduleProposal) => {
    if (!proposal.slotId) return;
    rescheduleOccurrence(
      proposal.slotId,
      proposal.originalDate,
      proposal.newDate,
      proposal.newStartTime,
      proposal.newEndTime
    );
    setRecurrenceProposal(null);
  };

  const handleConfirmAllOccurrences = (proposal: RescheduleProposal) => {
    if (!proposal.slotId) return;
    updateTimetableSlot(proposal.slotId, {
      dayOfWeek: proposal.newDayOfWeek as DayOfWeek,
      startTime: proposal.newStartTime,
      endTime: proposal.newEndTime,
    });
    setRecurrenceProposal(null);
  };

  const gridContainerRef = useRef<HTMLDivElement | null>(null);

  // Red line position calculation for current time indicator
  const currentTimeTop = useMemo(() => {
    const startMins = START_HOUR * 60;
    const endMins = (END_HOUR + 1) * 60;
    if (currentTimeMinutes < startMins || currentTimeMinutes > endMins) return null;
    return ((currentTimeMinutes - startMins) / 60) * HOUR_HEIGHT;
  }, [currentTimeMinutes]);

  return (
    <div className="w-full space-y-4">
      {/* ── Category Filter Bar ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-white dark:bg-espresso-900 border border-ivory-300 dark:border-espresso-750 shadow-subtle">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-semibold text-espresso-500 dark:text-ivory-400 mr-1 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Streams:
          </span>
          {(
            [
              { id: 'all', label: 'All Activities', icon: <Sparkles className="w-3.5 h-3.5" /> },
              { id: 'college', label: 'College Lectures', icon: <BookOpen className="w-3.5 h-3.5 text-terracotta-500" /> },
              { id: 'study', label: 'Study Tasks', icon: <Flame className="w-3.5 h-3.5 text-ochre-500" /> },
              { id: 'gym', label: 'Fitness & Gym', icon: <Dumbbell className="w-3.5 h-3.5 text-sage-500" /> },
            ] as const
          ).map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                  isSelected
                    ? 'bg-espresso-900 text-ivory-50 dark:bg-ivory-100 dark:text-espresso-950 font-semibold shadow-subtle'
                    : 'bg-ivory-100 dark:bg-espresso-800 text-espresso-700 dark:text-ivory-300 hover:bg-ivory-200 dark:hover:bg-espresso-750'
                }`}
              >
                {cat.icon}
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>

        <div className="text-xs font-mono text-espresso-500 dark:text-ivory-400 hidden sm:flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse" />
          <span>{filteredBlocks.length} Scheduled Blocks</span>
        </div>
      </div>

      {/* ── 1. GOOGLE CALENDAR MONTH VIEW ── */}
      {viewMode === 'month' && (
        <div className="rounded-2xl border border-ivory-300 dark:border-espresso-750 bg-white dark:bg-espresso-900 shadow-subtle overflow-hidden">
          {/* Day Headers */}
          <div className="grid grid-cols-7 border-b border-ivory-300 dark:border-espresso-750 bg-ivory-100/70 dark:bg-espresso-850/70 text-center text-xs font-semibold text-espresso-600 dark:text-ivory-300 py-2.5">
            {DAYS_SHORT.map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>

          {/* Month Days Grid */}
          <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-ivory-200 dark:divide-espresso-800">
            {monthDays.map((cell) => {
              const dayBlocks = getBlocksForDate(cell.dateStr);

              return (
                <div
                  key={cell.dateStr}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                  }}
                  onDrop={(e) => handleMonthCellDrop(e, cell.dateStr)}
                  onClick={() => onNavigateDate && onNavigateDate(cell.date)}
                  className={`min-h-[110px] sm:min-h-[130px] p-2 flex flex-col justify-between transition-colors ${
                    !cell.isCurrentMonth
                      ? 'bg-ivory-50/50 dark:bg-espresso-950/30 opacity-45'
                      : cell.isToday
                      ? 'bg-terracotta-500/5 dark:bg-terracotta-400/5 ring-1 ring-inset ring-terracotta-500/20'
                      : 'hover:bg-ivory-50 dark:hover:bg-espresso-850/40'
                  }`}
                >
                  {/* Date Number Header */}
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`text-xs font-semibold w-6 h-6 rounded-full flex items-center justify-center ${
                        cell.isToday
                          ? 'bg-terracotta-600 text-white font-bold shadow-xs'
                          : 'text-espresso-700 dark:text-ivory-300'
                      }`}
                    >
                      {cell.date.getDate()}
                    </span>

                    {dayBlocks.length > 0 && (
                      <span className="text-[10px] font-mono text-espresso-400 dark:text-ivory-400 font-medium">
                        {dayBlocks.length}
                      </span>
                    )}
                  </div>

                  {/* Activity Block Chips */}
                  <div className="space-y-1 overflow-y-auto max-h-[85px] no-scrollbar">
                    {dayBlocks.map((blk) => (
                      <div
                        key={blk.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, blk)}
                        onDragEnd={handleDragEnd}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleBlockClick(blk);
                        }}
                        className="group relative w-full text-left p-1.5 rounded-lg border text-xs leading-tight transition hover:shadow-subtle cursor-grab active:cursor-grabbing select-none"
                        style={{
                          backgroundColor: `${blk.color}15`,
                          borderColor: `${blk.color}40`,
                          borderLeftWidth: '3px',
                          borderLeftColor: blk.color,
                        }}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-medium text-espresso-950 dark:text-ivory-50 truncate">
                            {blk.title}
                          </span>
                          <span className="font-mono text-[10px] text-espresso-500 dark:text-ivory-400 shrink-0">
                            {blk.startTime}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── 2. GOOGLE CALENDAR WEEK TIME-GRID VIEW ── */}
      {viewMode === 'week' && (
        <div
          ref={gridContainerRef}
          className="rounded-2xl border border-ivory-300 dark:border-espresso-750 bg-white dark:bg-espresso-900 shadow-subtle overflow-x-auto"
        >
          <div className="min-w-[800px]">
            {/* Week Days Column Header */}
            <div className="grid grid-cols-[64px_repeat(7,1fr)] border-b border-ivory-300 dark:border-espresso-750 bg-ivory-100/70 dark:bg-espresso-850/70 sticky top-0 z-20">
              <div className="p-3 text-center text-[10px] font-mono font-semibold text-espresso-400 dark:text-ivory-400 border-r border-ivory-200 dark:border-espresso-800">
                TIME
              </div>
              {weekDates.map((date) => {
                const str = formatDateStr(date);
                const isToday = str === todayStr;
                const dow = dateToDayOfWeek(date);

                return (
                  <div
                    key={str}
                    onClick={() => onNavigateDate && onNavigateDate(date)}
                    className={`p-2.5 text-center border-r border-ivory-200 dark:border-espresso-800 cursor-pointer transition ${
                      isToday ? 'bg-terracotta-500/10 dark:bg-terracotta-400/10' : 'hover:bg-black/5 dark:hover:bg-white/5'
                    }`}
                  >
                    <span className="block text-[11px] font-medium uppercase text-espresso-500 dark:text-ivory-400">
                      {DAYS_SHORT[dow - 1]}
                    </span>
                    <span
                      className={`inline-flex items-center justify-center w-7 h-7 text-sm font-semibold rounded-full mt-0.5 ${
                        isToday
                          ? 'bg-terracotta-600 text-white font-bold shadow-xs'
                          : 'text-espresso-900 dark:text-ivory-100'
                      }`}
                    >
                      {date.getDate()}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Time Grid with Hourly Dividers and Event Blocks */}
            <div className="relative grid grid-cols-[64px_repeat(7,1fr)]">
              {/* Hourly Time Ruler */}
              <div className="border-r border-ivory-200 dark:border-espresso-800 select-none">
                {HOURS.map((hour) => (
                  <div
                    key={hour}
                    style={{ height: HOUR_HEIGHT }}
                    className="border-b border-ivory-200/60 dark:border-espresso-800/60 pr-2 pt-1 text-right text-[11px] font-mono text-espresso-400 dark:text-ivory-400"
                  >
                    {hour === 12 ? '12 PM' : hour < 12 ? `${hour} AM` : `${hour - 12} PM`}
                  </div>
                ))}
              </div>

              {/* 7 Day Columns */}
              {weekDates.map((date) => {
                const str = formatDateStr(date);
                const dayBlocks = getBlocksForDate(str);
                const isToday = str === todayStr;

                return (
                  <div
                    key={str}
                    onDragOver={(e) => {
                      if (gridContainerRef.current) {
                        const rect = gridContainerRef.current.getBoundingClientRect();
                        handleTimeGridDragOver(e, str, rect.top + 50);
                      }
                    }}
                    onDrop={(e) => {
                      if (gridContainerRef.current) {
                        const rect = gridContainerRef.current.getBoundingClientRect();
                        handleTimeGridDrop(e, str, rect.top + 50);
                      }
                    }}
                    className={`relative border-r border-ivory-200 dark:border-espresso-800 transition ${
                      isToday ? 'bg-terracotta-500/[0.02]' : ''
                    }`}
                  >
                    {/* Hour Dividers */}
                    {HOURS.map((hour) => (
                      <div
                        key={hour}
                        style={{ height: HOUR_HEIGHT }}
                        className="border-b border-ivory-200/50 dark:border-espresso-800/50"
                      />
                    ))}

                    {/* Red line for Current Time (Google Calendar style) */}
                    {isToday && currentTimeTop !== null && (
                      <div
                        style={{ top: `${currentTimeTop}px` }}
                        className="absolute inset-x-0 z-20 pointer-events-none flex items-center"
                      >
                        <div className="w-2.5 h-2.5 rounded-full bg-rose-500 -ml-1.5 shadow-xs" />
                        <div className="flex-1 h-[2px] bg-rose-500" />
                      </div>
                    )}

                    {/* Drag-and-drop preview ghost */}
                    {dragPreview && dragPreview.dateStr === str && (
                      <div
                        style={{
                          top: `${((timeToMinutes(dragPreview.startTime) - START_HOUR * 60) / 60) * HOUR_HEIGHT}px`,
                          height: `${((timeToMinutes(dragPreview.endTime) - timeToMinutes(dragPreview.startTime)) / 60) * HOUR_HEIGHT - 4}px`,
                        }}
                        className="absolute inset-x-1 z-30 rounded-xl border-2 border-dashed border-terracotta-500 bg-terracotta-500/20 p-2 text-xs font-semibold text-terracotta-700 dark:text-terracotta-300 pointer-events-none animate-pulse flex flex-col justify-center items-center"
                      >
                        <span>Move to {dragPreview.startTime} – {dragPreview.endTime}</span>
                      </div>
                    )}

                    {/* Positioned Event Blocks */}
                    {dayBlocks.map((blk) => {
                      const startMins = timeToMinutes(blk.startTime);
                      const endMins = timeToMinutes(blk.endTime);
                      const dayStartMins = START_HOUR * 60;

                      const topOffset = Math.max(0, ((startMins - dayStartMins) / 60) * HOUR_HEIGHT);
                      const durationMins = Math.max(30, endMins - startMins);
                      const blockHeight = (durationMins / 60) * HOUR_HEIGHT;

                      return (
                        <div
                          key={blk.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, blk)}
                          onDragEnd={handleDragEnd}
                          onClick={() => handleBlockClick(blk)}
                          style={{
                            top: `${topOffset}px`,
                            height: `${blockHeight - 4}px`,
                            backgroundColor: `${blk.color}18`,
                            borderColor: `${blk.color}50`,
                            borderLeftWidth: '4px',
                            borderLeftColor: blk.color,
                          }}
                          className="absolute inset-x-1 z-10 p-2 rounded-xl border transition shadow-xs hover:shadow-md cursor-grab active:cursor-grabbing select-none flex flex-col justify-between overflow-hidden group"
                        >
                          <div>
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-xs font-semibold text-espresso-950 dark:text-ivory-50 truncate">
                                {blk.title}
                              </span>
                              <GripVertical className="w-3.5 h-3.5 text-espresso-400 opacity-0 group-hover:opacity-100 transition shrink-0" />
                            </div>
                            <p className="text-[11px] font-mono text-espresso-600 dark:text-ivory-300">
                              {blk.startTime} – {blk.endTime}
                            </p>
                          </div>

                          {blk.room && (
                            <span className="text-[10px] font-mono text-espresso-500 dark:text-ivory-400 truncate flex items-center gap-1">
                              <MapPin className="w-3 h-3 shrink-0" /> {blk.room}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── 3. GOOGLE CALENDAR DAY VIEW ── */}
      {viewMode === 'day' && (
        <div
          ref={gridContainerRef}
          className="rounded-2xl border border-ivory-300 dark:border-espresso-750 bg-white dark:bg-espresso-900 shadow-subtle overflow-hidden"
        >
          {/* Day Header Banner */}
          <div className="p-4 border-b border-ivory-300 dark:border-espresso-750 bg-ivory-100/70 dark:bg-espresso-850/70 flex items-center justify-between">
            <div>
              <span className="text-xs font-medium text-espresso-500 dark:text-ivory-400">
                {DAYS_FULL[dateToDayOfWeek(currentDate) - 1]}
              </span>
              <h3 className="text-lg font-semibold text-espresso-950 dark:text-ivory-50">
                {currentDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </h3>
            </div>
            <span className="text-xs font-semibold px-3 py-1 rounded-full bg-terracotta-100 dark:bg-terracotta-950/40 text-terracotta-700 dark:text-terracotta-300 border border-terracotta-200 dark:border-terracotta-800">
              {getBlocksForDate(formatDateStr(currentDate)).length} Scheduled
            </span>
          </div>

          {/* Single Day Time Grid */}
          <div className="relative grid grid-cols-[72px_1fr]">
            {/* Time Ruler */}
            <div className="border-r border-ivory-200 dark:border-espresso-800 select-none">
              {HOURS.map((hour) => (
                <div
                  key={hour}
                  style={{ height: HOUR_HEIGHT }}
                  className="border-b border-ivory-200/60 dark:border-espresso-800/60 pr-2 pt-1 text-right text-xs font-mono text-espresso-400 dark:text-ivory-400"
                >
                  {hour === 12 ? '12:00 PM' : hour < 12 ? `${hour}:00 AM` : `${hour - 12}:00 PM`}
                </div>
              ))}
            </div>

            {/* Event Canvas for Today */}
            {(() => {
              const str = formatDateStr(currentDate);
              const dayBlocks = getBlocksForDate(str);
              const isToday = str === todayStr;

              return (
                <div
                  onDragOver={(e) => {
                    if (gridContainerRef.current) {
                      const rect = gridContainerRef.current.getBoundingClientRect();
                      handleTimeGridDragOver(e, str, rect.top + 70);
                    }
                  }}
                  onDrop={(e) => {
                    if (gridContainerRef.current) {
                      const rect = gridContainerRef.current.getBoundingClientRect();
                      handleTimeGridDrop(e, str, rect.top + 70);
                    }
                  }}
                  className="relative transition min-h-[960px]"
                >
                  {/* Hour Dividers */}
                  {HOURS.map((hour) => (
                    <div
                      key={hour}
                      style={{ height: HOUR_HEIGHT }}
                      className="border-b border-ivory-200/50 dark:border-espresso-800/50"
                    />
                  ))}

                  {/* Red line for Current Time */}
                  {isToday && currentTimeTop !== null && (
                    <div
                      style={{ top: `${currentTimeTop}px` }}
                      className="absolute inset-x-0 z-20 pointer-events-none flex items-center"
                    >
                      <div className="w-2.5 h-2.5 rounded-full bg-rose-500 -ml-1.5 shadow-xs" />
                      <div className="flex-1 h-[2px] bg-rose-500" />
                    </div>
                  )}

                  {/* Drag-and-drop preview ghost */}
                  {dragPreview && dragPreview.dateStr === str && (
                    <div
                      style={{
                        top: `${((timeToMinutes(dragPreview.startTime) - START_HOUR * 60) / 60) * HOUR_HEIGHT}px`,
                        height: `${((timeToMinutes(dragPreview.endTime) - timeToMinutes(dragPreview.startTime)) / 60) * HOUR_HEIGHT - 4}px`,
                      }}
                      className="absolute inset-x-4 z-30 rounded-xl border-2 border-dashed border-terracotta-500 bg-terracotta-500/20 p-3 text-xs font-semibold text-terracotta-700 dark:text-terracotta-300 pointer-events-none animate-pulse flex items-center justify-center gap-2"
                    >
                      <span>Move to {dragPreview.startTime} – {dragPreview.endTime}</span>
                    </div>
                  )}

                  {/* Positioned Event Blocks */}
                  {dayBlocks.map((blk) => {
                    const startMins = timeToMinutes(blk.startTime);
                    const endMins = timeToMinutes(blk.endTime);
                    const dayStartMins = START_HOUR * 60;

                    const topOffset = Math.max(0, ((startMins - dayStartMins) / 60) * HOUR_HEIGHT);
                    const durationMins = Math.max(30, endMins - startMins);
                    const blockHeight = (durationMins / 60) * HOUR_HEIGHT;

                    return (
                      <div
                        key={blk.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, blk)}
                        onDragEnd={handleDragEnd}
                        onClick={() => handleBlockClick(blk)}
                        style={{
                          top: `${topOffset}px`,
                          height: `${blockHeight - 6}px`,
                          backgroundColor: `${blk.color}15`,
                          borderColor: `${blk.color}50`,
                          borderLeftWidth: '5px',
                          borderLeftColor: blk.color,
                        }}
                        className="absolute inset-x-4 z-10 p-3 rounded-xl border transition shadow-xs hover:shadow-md cursor-grab active:cursor-grabbing select-none flex items-start justify-between group overflow-hidden"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-espresso-950 dark:text-ivory-50">
                              {blk.title}
                            </span>
                            {blk.badgeText && (
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-ivory-200 dark:bg-espresso-800 text-espresso-700 dark:text-ivory-300">
                                {blk.badgeText}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs font-mono text-espresso-600 dark:text-ivory-300">
                            <span className="flex items-center gap-1 font-medium">
                              <Clock className="w-3.5 h-3.5" /> {blk.startTime} – {blk.endTime}
                            </span>
                            {blk.room && (
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3.5 h-3.5" /> {blk.room}
                              </span>
                            )}
                            {blk.instructor && (
                              <span className="flex items-center gap-1">
                                <User className="w-3.5 h-3.5" /> {blk.instructor}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <GripVertical className="w-4 h-4 text-espresso-400 opacity-0 group-hover:opacity-100 transition" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ── 4. LIST VIEW ── */}
      {viewMode === 'list' && (
        <div className="space-y-3">
          {getBlocksForDate(formatDateStr(currentDate)).length === 0 ? (
            <div className="p-12 text-center rounded-2xl border border-dashed border-ivory-300 dark:border-espresso-750 bg-white dark:bg-espresso-900">
              <CalendarIcon className="w-8 h-8 mx-auto text-espresso-400 mb-2" />
              <p className="text-sm text-espresso-500 dark:text-ivory-400">
                No classes or events scheduled for this day
              </p>
            </div>
          ) : (
            getBlocksForDate(formatDateStr(currentDate)).map((blk) => (
              <div
                key={blk.id}
                onClick={() => handleBlockClick(blk)}
                className="p-4 rounded-xl border border-ivory-300 dark:border-espresso-750 bg-white dark:bg-espresso-900 shadow-subtle hover:border-terracotta-500 transition flex items-center justify-between gap-4 cursor-pointer"
                style={{ borderLeftWidth: '4px', borderLeftColor: blk.color }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold text-white shrink-0"
                    style={{ backgroundColor: blk.color }}
                  >
                    {blk.category.slice(0, 3).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-espresso-950 dark:text-ivory-50">
                      {blk.title}
                    </h4>
                    <div className="flex items-center gap-3 text-xs text-espresso-500 dark:text-ivory-400 font-mono mt-0.5">
                      <span>{blk.startTime} – {blk.endTime}</span>
                      {blk.room && <span>• {blk.room}</span>}
                    </div>
                  </div>
                </div>

                <ChevronRight className="w-4 h-4 text-espresso-400" />
              </div>
            ))
          )}
        </div>
      )}

      {/* ── 5. EVENT DETAIL DRAWER / QUICK ATTENDANCE MODAL ── */}
      {activeDrawerBlock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-espresso-900 border border-ivory-300 dark:border-espresso-750 shadow-2xl p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-terracotta-600 dark:text-terracotta-400">
                  {activeDrawerBlock.isRecurring ? 'Weekly Recurring Class' : 'Class Occurrence'}
                </span>
                <h3 className="text-lg font-semibold text-espresso-950 dark:text-ivory-50 mt-0.5">
                  {activeDrawerBlock.title}
                </h3>
              </div>
              <button
                onClick={() => setActiveDrawerBlock(null)}
                className="p-1 rounded-lg text-espresso-400 hover:text-espresso-700 dark:hover:text-ivory-200 hover:bg-ivory-100 dark:hover:bg-espresso-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-ivory-50 dark:bg-espresso-850 border border-ivory-200 dark:border-espresso-800 space-y-2 text-xs font-mono">
              <div className="flex justify-between items-center py-1 border-b border-ivory-200 dark:border-espresso-800">
                <span className="text-espresso-500 dark:text-ivory-400">Time</span>
                <span className="font-semibold text-espresso-950 dark:text-ivory-50">
                  {activeDrawerBlock.startTime} – {activeDrawerBlock.endTime}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-ivory-200 dark:border-espresso-800">
                <span className="text-espresso-500 dark:text-ivory-400">Date</span>
                <span className="font-semibold text-espresso-950 dark:text-ivory-50">
                  {activeDrawerBlock.dateStr}
                </span>
              </div>
              {activeDrawerBlock.room && (
                <div className="flex justify-between items-center py-1 border-b border-ivory-200 dark:border-espresso-800">
                  <span className="text-espresso-500 dark:text-ivory-400">Location</span>
                  <span className="font-semibold text-espresso-950 dark:text-ivory-50">
                    {activeDrawerBlock.room}
                  </span>
                </div>
              )}
              {activeDrawerBlock.instructor && (
                <div className="flex justify-between items-center py-1">
                  <span className="text-espresso-500 dark:text-ivory-400">Instructor</span>
                  <span className="font-semibold text-espresso-950 dark:text-ivory-50">
                    {activeDrawerBlock.instructor}
                  </span>
                </div>
              )}
            </div>

            {/* Attendance Marking Controls */}
            {activeDrawerBlock.rawEvent && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-espresso-600 dark:text-ivory-300">
                  Attendance Status:
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => {
                      if (activeDrawerBlock.rawEvent) {
                        const ev = activeDrawerBlock.rawEvent;
                        markAttendanceForEvent(
                          ev.occurrenceKey,
                          ev.subjectId,
                          ev.date,
                          'present',
                          ev.slotId,
                          ev.extraClassId,
                          ev.overrideId
                        );
                      }
                    }}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                      getAttendanceStatusForBlock(activeDrawerBlock) === 'present'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'border border-ivory-300 dark:border-espresso-750 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 text-espresso-700 dark:text-ivory-200'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Present
                  </button>
                  <button
                    onClick={() => {
                      if (activeDrawerBlock.rawEvent) {
                        const ev = activeDrawerBlock.rawEvent;
                        markAttendanceForEvent(
                          ev.occurrenceKey,
                          ev.subjectId,
                          ev.date,
                          'absent',
                          ev.slotId,
                          ev.extraClassId,
                          ev.overrideId
                        );
                      }
                    }}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                      getAttendanceStatusForBlock(activeDrawerBlock) === 'absent'
                        ? 'bg-rose-600 text-white shadow-xs'
                        : 'border border-ivory-300 dark:border-espresso-750 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-espresso-700 dark:text-ivory-200'
                    }`}
                  >
                    <XCircle className="w-3.5 h-3.5" /> Absent
                  </button>
                  <button
                    onClick={() => {
                      if (activeDrawerBlock.rawEvent) {
                        const ev = activeDrawerBlock.rawEvent;
                        markAttendanceForEvent(
                          ev.occurrenceKey,
                          ev.subjectId,
                          ev.date,
                          'cancelled',
                          ev.slotId,
                          ev.extraClassId,
                          ev.overrideId
                        );
                      }
                    }}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                      getAttendanceStatusForBlock(activeDrawerBlock) === 'cancelled'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'border border-ivory-300 dark:border-espresso-750 hover:bg-amber-50 dark:hover:bg-amber-950/30 text-espresso-700 dark:text-ivory-200'
                    }`}
                  >
                    <Ban className="w-3.5 h-3.5" /> Cancelled
                  </button>
                </div>
              </div>
            )}

            <button
              onClick={() => setActiveDrawerBlock(null)}
              className="w-full py-2.5 rounded-xl bg-espresso-900 text-ivory-50 dark:bg-ivory-100 dark:text-espresso-950 text-xs font-semibold shadow-subtle hover:opacity-90 transition cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* ── 6. RECURRENCE PROMPT MODAL ── */}
      <RecurrencePromptModal
        isOpen={Boolean(recurrenceProposal)}
        proposal={recurrenceProposal}
        onConfirmSingle={handleConfirmSingleOccurrence}
        onConfirmAll={handleConfirmAllOccurrences}
        onCancel={() => setRecurrenceProposal(null)}
      />
    </div>
  );
};
