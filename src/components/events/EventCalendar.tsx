import React, { useState, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  MapPin,
  Filter,
  CheckCircle2,
  Circle,
  AlertCircle,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { CalendarEvent, EventCategory } from '../../types';
import { EVENT_CATEGORIES, getEventCategoryConfig } from '../../utils/eventCategories';
import { EventModal } from './EventModal';

export type CalendarViewMode = 'day' | 'week' | 'month' | 'year';

interface EventCalendarProps {
  onSelectEvent?: (event: CalendarEvent) => void;
}

const HOURS = Array.from({ length: 16 }, (_, i) => i + 7); // 7:00 to 22:00
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// Helper: Format Date to YYYY-MM-DD in local time
export const toLocalDateString = (d: Date): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Helper: Parse YYYY-MM-DD into local Date
export const parseLocalDate = (str: string): Date => {
  const [year, month, day] = str.split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
};

export const EventCalendar: React.FC<EventCalendarProps> = () => {
  const { state, updateEvent, toggleEventComplete } = useApp();

  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());
  const [viewMode, setViewMode] = useState<CalendarViewMode>('month');
  const [selectedCategory, setSelectedCategory] = useState<EventCategory | 'all'>('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [modalDate, setModalDate] = useState<string>('');
  const [modalStartTime, setModalStartTime] = useState<string>('10:00');

  // Drag and drop state
  const [draggedEventId, setDraggedEventId] = useState<string | null>(null);

  // Filtered Events
  const events = useMemo(() => {
    const list = state.events || [];
    if (selectedCategory === 'all') return list;
    return list.filter((e) => e.category === selectedCategory);
  }, [state.events, selectedCategory]);

  const todayStr = useMemo(() => toLocalDateString(new Date()), []);
  const currentDateStr = useMemo(() => toLocalDateString(currentDate), [currentDate]);

  // Navigation handlers
  const handlePrev = () => {
    setCurrentDate((prev) => {
      const next = new Date(prev);
      if (viewMode === 'day') next.setDate(next.getDate() - 1);
      else if (viewMode === 'week') next.setDate(next.getDate() - 7);
      else if (viewMode === 'month') next.setMonth(next.getMonth() - 1);
      else if (viewMode === 'year') next.setFullYear(next.getFullYear() - 1);
      return next;
    });
  };

  const handleNext = () => {
    setCurrentDate((prev) => {
      const next = new Date(prev);
      if (viewMode === 'day') next.setDate(next.getDate() + 1);
      else if (viewMode === 'week') next.setDate(next.getDate() + 7);
      else if (viewMode === 'month') next.setMonth(next.getMonth() + 1);
      else if (viewMode === 'year') next.setFullYear(next.getFullYear() + 1);
      return next;
    });
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Quick Open Modal Handlers
  const handleCreateNew = (dateStr?: string, timeStr?: string) => {
    setEditingEvent(null);
    setModalDate(dateStr || currentDateStr);
    setModalStartTime(timeStr || '10:00');
    setIsModalOpen(true);
  };

  const handleEdit = (event: CalendarEvent, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingEvent(event);
    setModalDate(event.date);
    setModalStartTime(event.startTime || '10:00');
    setIsModalOpen(true);
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, eventId: string) => {
    setDraggedEventId(eventId);
    e.dataTransfer.setData('text/plain', eventId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDropOnDate = (e: React.DragEvent, targetDateStr: string, targetHour?: number) => {
    e.preventDefault();
    const eventId = e.dataTransfer.getData('text/plain') || draggedEventId;
    if (!eventId) return;

    const updates: Partial<CalendarEvent> = { date: targetDateStr };
    if (targetHour !== undefined) {
      const hourStr = String(targetHour).padStart(2, '0') + ':00';
      const endHourStr = String(Math.min(targetHour + 1, 23)).padStart(2, '0') + ':00';
      updates.startTime = hourStr;
      updates.endTime = endHourStr;
      updates.isAllDay = false;
    }
    updateEvent(eventId, updates);
    setDraggedEventId(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  // Header Title computed based on active view mode
  const headerTitle = useMemo(() => {
    if (viewMode === 'day') {
      return currentDate.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });
    }
    if (viewMode === 'week') {
      const startOfWeek = new Date(currentDate);
      const day = startOfWeek.getDay();
      const diff = day === 0 ? -6 : 1 - day; // Mon
      startOfWeek.setDate(startOfWeek.getDate() + diff);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(endOfWeek.getDate() + 6);

      const sameMonth = startOfWeek.getMonth() === endOfWeek.getMonth();
      const sameYear = startOfWeek.getFullYear() === endOfWeek.getFullYear();

      if (sameMonth && sameYear) {
        return `${MONTH_NAMES[startOfWeek.getMonth()]} ${startOfWeek.getDate()} – ${endOfWeek.getDate()}, ${startOfWeek.getFullYear()}`;
      }
      return `${MONTH_NAMES[startOfWeek.getMonth()].slice(0, 3)} ${startOfWeek.getDate()} – ${MONTH_NAMES[endOfWeek.getMonth()].slice(0, 3)} ${endOfWeek.getDate()}, ${endOfWeek.getFullYear()}`;
    }
    if (viewMode === 'month') {
      return `${MONTH_NAMES[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
    }
    return `${currentDate.getFullYear()}`;
  }, [currentDate, viewMode]);

  // Compute week days for Week View
  const weekDays = useMemo(() => {
    const d = new Date(currentDate);
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day; // Monday as start
    d.setDate(d.getDate() + diff);

    const result: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const nextDay = new Date(d);
      nextDay.setDate(d.getDate() + i);
      result.push(nextDay);
    }
    return result;
  }, [currentDate]);

  // Compute month days grid
  const monthDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDayOfMonth = new Date(year, month, 1);
    let startDayOfWeek = firstDayOfMonth.getDay(); // 0 is Sun, 1 is Mon
    startDayOfWeek = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1; // Mon = 0

    const startDate = new Date(year, month, 1 - startDayOfWeek);
    const days: Date[] = [];

    for (let i = 0; i < 42; i++) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);
      days.push(d);
    }
    return days;
  }, [currentDate]);

  return (
    <div className="space-y-4">
      {/* Top Controls Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 rounded-2xl bg-white dark:bg-espresso-850 border border-ivory-300 dark:border-espresso-750 shadow-xs">
        {/* Navigation & Title */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-ivory-100 dark:bg-espresso-800 rounded-xl p-1 border border-ivory-200 dark:border-espresso-700">
            <button
              onClick={handlePrev}
              aria-label="Previous Period"
              className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-espresso-700 text-espresso-600 dark:text-espresso-300 transition"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleToday}
              className="px-3 py-1 rounded-lg text-xs font-semibold hover:bg-white dark:hover:bg-espresso-700 text-espresso-800 dark:text-ivory-100 transition"
            >
              Today
            </button>
            <button
              onClick={handleNext}
              aria-label="Next Period"
              className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-espresso-700 text-espresso-600 dark:text-espresso-300 transition"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <h2 className="text-base sm:text-lg font-serif font-semibold text-espresso-950 dark:text-ivory-100 tracking-tight">
            {headerTitle}
          </h2>
        </div>

        {/* View Mode Switcher & Add Button */}
        <div className="flex items-center flex-wrap gap-2">
          {/* View Mode Tabs */}
          <div className="flex items-center bg-ivory-100 dark:bg-espresso-800 rounded-xl p-1 border border-ivory-200 dark:border-espresso-700">
            {(['day', 'week', 'month', 'year'] as CalendarViewMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize transition ${
                  viewMode === mode
                    ? 'bg-white dark:bg-espresso-700 text-espresso-950 dark:text-ivory-50 shadow-xs'
                    : 'text-espresso-600 dark:text-espresso-400 hover:text-espresso-950 dark:hover:text-ivory-100'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>

          {/* New Event Button */}
          <button
            onClick={() => handleCreateNew()}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-terracotta-500 hover:bg-terracotta-600 text-white text-xs font-semibold shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            <span>New Event</span>
          </button>
        </div>
      </div>

      {/* Category Filter Badges */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 text-xs">
        <span className="text-[11px] font-mono text-espresso-400 dark:text-espresso-500 shrink-0 flex items-center gap-1 mr-1">
          <Filter className="w-3 h-3" />
          Filter:
        </span>
        <button
          onClick={() => setSelectedCategory('all')}
          className={`px-2.5 py-1 rounded-lg font-medium shrink-0 transition ${
            selectedCategory === 'all'
              ? 'bg-espresso-900 text-white dark:bg-ivory-100 dark:text-espresso-950'
              : 'bg-ivory-100 dark:bg-espresso-800 text-espresso-600 dark:text-espresso-300 hover:bg-ivory-200 dark:hover:bg-espresso-750'
          }`}
        >
          All Categories ({state.events?.length || 0})
        </button>
        {(Object.keys(EVENT_CATEGORIES) as EventCategory[]).map((catKey) => {
          const config = EVENT_CATEGORIES[catKey];
          const count = (state.events || []).filter((e) => e.category === catKey).length;
          const isSelected = selectedCategory === catKey;
          return (
            <button
              key={catKey}
              onClick={() => setSelectedCategory(catKey)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-medium shrink-0 transition border ${
                isSelected
                  ? 'border-transparent text-espresso-950 dark:text-ivory-50'
                  : 'border-ivory-200 dark:border-espresso-750 bg-white dark:bg-espresso-850 text-espresso-600 dark:text-espresso-300 hover:bg-ivory-50'
              }`}
              style={
                isSelected
                  ? { backgroundColor: config.lightBg, borderColor: config.color, fontWeight: 600 }
                  : undefined
              }
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: config.color }} />
              <span>{config.shortLabel}</span>
              <span className="font-mono text-[10px] opacity-75">({count})</span>
            </button>
          );
        })}
      </div>

      {/* VIEW RENDERERS */}
      {viewMode === 'day' && (
        <DayView
          currentDate={currentDate}
          events={events}
          todayStr={todayStr}
          onSelectSlot={(hour) => handleCreateNew(currentDateStr, `${String(hour).padStart(2, '0')}:00`)}
          onEditEvent={handleEdit}
          onToggleComplete={toggleEventComplete}
          onDropOnHour={(hour, e) => handleDropOnDate(e, currentDateStr, hour)}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
        />
      )}

      {viewMode === 'week' && (
        <WeekView
          weekDays={weekDays}
          events={events}
          todayStr={todayStr}
          onSelectSlot={(dateStr, hour) => handleCreateNew(dateStr, `${String(hour).padStart(2, '0')}:00`)}
          onEditEvent={handleEdit}
          onDropOnSlot={(dateStr, hour, e) => handleDropOnDate(e, dateStr, hour)}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
        />
      )}

      {viewMode === 'month' && (
        <MonthView
          currentDate={currentDate}
          monthDays={monthDays}
          events={events}
          todayStr={todayStr}
          onSelectDay={(dateStr) => {
            setCurrentDate(parseLocalDate(dateStr));
            setViewMode('day');
          }}
          onQuickAdd={(dateStr) => handleCreateNew(dateStr)}
          onEditEvent={handleEdit}
          onDropOnDay={(dateStr, e) => handleDropOnDate(e, dateStr)}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
        />
      )}

      {viewMode === 'year' && (
        <YearView
          year={currentDate.getFullYear()}
          events={events}
          todayStr={todayStr}
          onSelectDate={(dateStr) => {
            setCurrentDate(parseLocalDate(dateStr));
            setViewMode('day');
          }}
          onSelectMonth={(monthIdx) => {
            const next = new Date(currentDate);
            next.setMonth(monthIdx);
            setCurrentDate(next);
            setViewMode('month');
          }}
        />
      )}

      {/* Event Creation & Edit Modal */}
      <EventModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        initialEvent={editingEvent}
        initialDate={modalDate}
        initialStartTime={modalStartTime}
      />
    </div>
  );
};

// ==========================================
// 1. DAY VIEW COMPONENT
// ==========================================
interface DayViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  todayStr: string;
  onSelectSlot: (hour: number) => void;
  onEditEvent: (event: CalendarEvent, e?: React.MouseEvent) => void;
  onToggleComplete: (id: string) => void;
  onDropOnHour: (hour: number, e: React.DragEvent) => void;
  onDragStart: (e: React.DragEvent, eventId: string) => void;
  onDragOver: (e: React.DragEvent) => void;
}

const DayView: React.FC<DayViewProps> = ({
  currentDate,
  events,
  todayStr,
  onSelectSlot,
  onEditEvent,
  onToggleComplete,
  onDropOnHour,
  onDragStart,
  onDragOver,
}) => {
  const dateStr = toLocalDateString(currentDate);
  const isToday = dateStr === todayStr;

  const dayEvents = events.filter((e) => e.date === dateStr);
  const allDayEvents = dayEvents.filter((e) => e.isAllDay || (!e.startTime && !e.endTime));
  const timedEvents = dayEvents.filter((e) => !e.isAllDay && e.startTime);

  return (
    <div className="bg-white dark:bg-espresso-850 rounded-2xl border border-ivory-300 dark:border-espresso-750 shadow-xs overflow-hidden">
      {/* All-Day Banner */}
      {allDayEvents.length > 0 && (
        <div className="p-3 bg-ivory-50 dark:bg-espresso-800 border-b border-ivory-200 dark:border-espresso-750">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-espresso-400 dark:text-espresso-500">
              All-Day Events &amp; Holidays ({allDayEvents.length})
            </span>
            {isToday && (
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-terracotta-500 text-white">
                Today
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {allDayEvents.map((evt) => {
              const conf = getEventCategoryConfig(evt.category);
              return (
                <div
                  key={evt.id}
                  draggable
                  onDragStart={(e) => onDragStart(e, evt.id)}
                  onClick={(e) => onEditEvent(evt, e)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-medium cursor-pointer shadow-xs transition hover:scale-[1.01]"
                  style={{
                    backgroundColor: conf.lightBg,
                    borderColor: conf.color,
                    color: conf.color,
                  }}
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleComplete(evt.id);
                    }}
                    className="hover:opacity-80"
                  >
                    {evt.isCompleted ? (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    ) : (
                      <Circle className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <span className={evt.isCompleted ? 'line-through opacity-70' : 'font-semibold'}>
                    {evt.title}
                  </span>
                  <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-white/70 dark:bg-black/30">
                    {conf.shortLabel}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Hourly Timeline */}
      <div className="relative divide-y divide-ivory-200 dark:divide-espresso-800">
        {HOURS.map((hour) => {
          const hourEvents = timedEvents.filter((evt) => {
            const h = parseInt((evt.startTime || '00:00').split(':')[0], 10);
            return h === hour;
          });

          return (
            <div
              key={hour}
              onDragOver={onDragOver}
              onDrop={(e) => onDropOnHour(hour, e)}
              onClick={() => onSelectSlot(hour)}
              className="flex min-h-[64px] group hover:bg-ivory-50/60 dark:hover:bg-espresso-800/40 transition cursor-pointer relative"
            >
              {/* Hour Label */}
              <div className="w-16 sm:w-20 shrink-0 p-2 sm:p-3 text-right text-xs font-mono font-medium text-espresso-400 dark:text-espresso-500 border-r border-ivory-200 dark:border-espresso-800 select-none">
                {String(hour).padStart(2, '0')}:00
              </div>

              {/* Event Slot Area */}
              <div className="flex-1 p-1.5 sm:p-2 flex flex-col gap-1.5 relative">
                {hourEvents.map((evt) => {
                  const conf = getEventCategoryConfig(evt.category);
                  return (
                    <div
                      key={evt.id}
                      draggable
                      onDragStart={(e) => onDragStart(e, evt.id)}
                      onClick={(e) => onEditEvent(evt, e)}
                      className="p-2 sm:p-2.5 rounded-xl border text-xs shadow-xs cursor-pointer hover:shadow-md transition group/item"
                      style={{
                        backgroundColor: conf.lightBg,
                        borderColor: conf.color,
                        borderLeftWidth: '4px',
                      }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleComplete(evt.id);
                            }}
                            className="hover:scale-110 transition shrink-0"
                          >
                            {evt.isCompleted ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Circle className="w-3.5 h-3.5 text-espresso-400" />
                            )}
                          </button>
                          <span
                            className={`font-semibold text-espresso-950 dark:text-ivory-100 truncate ${
                              evt.isCompleted ? 'line-through opacity-60' : ''
                            }`}
                          >
                            {evt.title}
                          </span>
                        </div>
                        <span
                          className="text-[10px] font-mono px-1.5 py-0.5 rounded font-semibold shrink-0 uppercase"
                          style={{ backgroundColor: conf.color, color: '#fff' }}
                        >
                          {conf.shortLabel}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 mt-1 text-[11px] text-espresso-600 dark:text-espresso-300 font-mono">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-espresso-400" />
                          {evt.startTime} – {evt.endTime || 'end'}
                        </span>
                        {evt.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-espresso-400" />
                            {evt.location}
                          </span>
                        )}
                        {evt.priority === 'high' && (
                          <span className="flex items-center gap-0.5 text-rose-600 font-bold">
                            <AlertCircle className="w-3 h-3" />
                            HIGH
                          </span>
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
  );
};

// ==========================================
// 2. WEEK VIEW COMPONENT
// ==========================================
interface WeekViewProps {
  weekDays: Date[];
  events: CalendarEvent[];
  todayStr: string;
  onSelectSlot: (dateStr: string, hour: number) => void;
  onEditEvent: (event: CalendarEvent, e?: React.MouseEvent) => void;
  onDropOnSlot: (dateStr: string, hour: number, e: React.DragEvent) => void;
  onDragStart: (e: React.DragEvent, eventId: string) => void;
  onDragOver: (e: React.DragEvent) => void;
}

const WeekView: React.FC<WeekViewProps> = ({
  weekDays,
  events,
  todayStr,
  onSelectSlot,
  onEditEvent,
  onDropOnSlot,
  onDragStart,
  onDragOver,
}) => {
  return (
    <div className="bg-white dark:bg-espresso-850 rounded-2xl border border-ivory-300 dark:border-espresso-750 shadow-xs overflow-x-auto">
      <div className="min-w-[700px]">
        {/* Header Row: Days of Week */}
        <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-ivory-200 dark:border-espresso-800 bg-ivory-50/70 dark:bg-espresso-800/60 sticky top-0 z-10">
          <div className="p-2 border-r border-ivory-200 dark:border-espresso-800" />
          {weekDays.map((d, idx) => {
            const dateStr = toLocalDateString(d);
            const isToday = dateStr === todayStr;
            return (
              <div
                key={dateStr}
                className={`p-2.5 text-center border-r border-ivory-200 dark:border-espresso-800 last:border-r-0 ${
                  isToday ? 'bg-terracotta-50/60 dark:bg-terracotta-950/20' : ''
                }`}
              >
                <div className="text-[11px] font-mono font-medium text-espresso-500 dark:text-espresso-400 uppercase">
                  {WEEKDAYS[idx]}
                </div>
                <div
                  className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold mt-0.5 ${
                    isToday
                      ? 'bg-terracotta-500 text-white shadow-xs'
                      : 'text-espresso-900 dark:text-ivory-100'
                  }`}
                >
                  {d.getDate()}
                </div>
              </div>
            );
          })}
        </div>

        {/* Hourly Grid Rows */}
        <div className="divide-y divide-ivory-200 dark:divide-espresso-800">
          {HOURS.map((hour) => (
            <div key={hour} className="grid grid-cols-[60px_repeat(7,1fr)] min-h-[56px]">
              {/* Hour Label */}
              <div className="p-2 text-right text-[11px] font-mono text-espresso-400 dark:text-espresso-500 border-r border-ivory-200 dark:border-espresso-800 select-none">
                {String(hour).padStart(2, '0')}:00
              </div>

              {/* Day Columns for this hour */}
              {weekDays.map((d) => {
                const dateStr = toLocalDateString(d);
                const hourEvents = events.filter((evt) => {
                  if (evt.date !== dateStr) return false;
                  if (evt.isAllDay) return false;
                  const h = parseInt((evt.startTime || '00:00').split(':')[0], 10);
                  return h === hour;
                });

                return (
                  <div
                    key={dateStr}
                    onDragOver={onDragOver}
                    onDrop={(e) => onDropOnSlot(dateStr, hour, e)}
                    onClick={() => onSelectSlot(dateStr, hour)}
                    className="p-1 border-r border-ivory-200 dark:border-espresso-800 last:border-r-0 hover:bg-ivory-50/50 dark:hover:bg-espresso-800/40 transition cursor-pointer flex flex-col gap-1"
                  >
                    {hourEvents.map((evt) => {
                      const conf = getEventCategoryConfig(evt.category);
                      return (
                        <div
                          key={evt.id}
                          draggable
                          onDragStart={(e) => onDragStart(e, evt.id)}
                          onClick={(e) => onEditEvent(evt, e)}
                          className="p-1.5 rounded-lg border text-[11px] leading-tight cursor-pointer shadow-xs hover:shadow-md transition"
                          style={{
                            backgroundColor: conf.lightBg,
                            borderColor: conf.color,
                            borderLeftWidth: '3px',
                          }}
                        >
                          <div className="font-semibold truncate text-espresso-950 dark:text-ivory-100">
                            {evt.title}
                          </div>
                          <div className="text-[10px] font-mono text-espresso-600 dark:text-espresso-400 mt-0.5">
                            {evt.startTime}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 3. MONTH VIEW COMPONENT
// ==========================================
interface MonthViewProps {
  currentDate: Date;
  monthDays: Date[];
  events: CalendarEvent[];
  todayStr: string;
  onSelectDay: (dateStr: string) => void;
  onQuickAdd: (dateStr: string) => void;
  onEditEvent: (event: CalendarEvent, e?: React.MouseEvent) => void;
  onDropOnDay: (dateStr: string, e: React.DragEvent) => void;
  onDragStart: (e: React.DragEvent, eventId: string) => void;
  onDragOver: (e: React.DragEvent) => void;
}

const MonthView: React.FC<MonthViewProps> = ({
  currentDate,
  monthDays,
  events,
  todayStr,
  onSelectDay,
  onQuickAdd,
  onEditEvent,
  onDropOnDay,
  onDragStart,
  onDragOver,
}) => {
  const currentMonthIdx = currentDate.getMonth();

  return (
    <div className="bg-white dark:bg-espresso-850 rounded-2xl border border-ivory-300 dark:border-espresso-750 shadow-xs overflow-hidden">
      {/* Weekday Header */}
      <div className="grid grid-cols-7 border-b border-ivory-200 dark:border-espresso-800 bg-ivory-50/70 dark:bg-espresso-800/60">
        {WEEKDAYS.map((wd) => (
          <div
            key={wd}
            className="py-2.5 text-center text-xs font-mono font-semibold uppercase text-espresso-500 dark:text-espresso-400"
          >
            {wd}
          </div>
        ))}
      </div>

      {/* 42 Calendar Cells */}
      <div className="grid grid-cols-7 divide-x divide-y divide-ivory-200 dark:divide-espresso-800">
        {monthDays.map((d) => {
          const dateStr = toLocalDateString(d);
          const isToday = dateStr === todayStr;
          const isCurrentMonth = d.getMonth() === currentMonthIdx;
          const dayEvents = events.filter((e) => e.date === dateStr);
          const visibleEvents = dayEvents.slice(0, 3);
          const remainingCount = dayEvents.length - visibleEvents.length;

          return (
            <div
              key={dateStr}
              onDragOver={onDragOver}
              onDrop={(e) => onDropOnDay(dateStr, e)}
              onClick={() => onSelectDay(dateStr)}
              className={`min-h-[105px] sm:min-h-[120px] p-1.5 sm:p-2 flex flex-col justify-between transition cursor-pointer hover:bg-ivory-50/70 dark:hover:bg-espresso-800/40 relative group ${
                !isCurrentMonth ? 'opacity-40 bg-ivory-100/30 dark:bg-espresso-900/30' : ''
              } ${isToday ? 'bg-terracotta-50/30 dark:bg-terracotta-950/20' : ''}`}
            >
              {/* Day Header */}
              <div className="flex items-center justify-between">
                <span
                  className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-mono font-bold ${
                    isToday
                      ? 'bg-terracotta-500 text-white shadow-xs'
                      : 'text-espresso-800 dark:text-ivory-100'
                  }`}
                >
                  {d.getDate()}
                </span>

                {/* Quick Add icon on hover */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onQuickAdd(dateStr);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-ivory-200 dark:hover:bg-espresso-750 text-espresso-500 transition"
                  title="Add Event on this date"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>

              {/* Event Chips */}
              <div className="flex flex-col gap-1 my-1 flex-1 overflow-hidden">
                {visibleEvents.map((evt) => {
                  const conf = getEventCategoryConfig(evt.category);
                  return (
                    <div
                      key={evt.id}
                      draggable
                      onDragStart={(e) => onDragStart(e, evt.id)}
                      onClick={(e) => onEditEvent(evt, e)}
                      className="px-1.5 py-0.5 rounded text-[11px] font-medium truncate border shadow-xs transition hover:scale-[1.01]"
                      style={{
                        backgroundColor: conf.lightBg,
                        borderColor: conf.borderColor,
                        borderLeftWidth: '3px',
                        color: 'inherit',
                      }}
                      title={`${evt.title} (${conf.label})`}
                    >
                      <span className={evt.isCompleted ? 'line-through opacity-60' : ''}>
                        {evt.title}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* +X More Indicator */}
              {remainingCount > 0 ? (
                <div className="text-[10px] font-mono font-semibold text-terracotta-600 dark:text-terracotta-400">
                  +{remainingCount} more
                </div>
              ) : (
                <div className="h-3" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ==========================================
// 4. YEAR VIEW COMPONENT
// ==========================================
interface YearViewProps {
  year: number;
  events: CalendarEvent[];
  todayStr: string;
  onSelectDate: (dateStr: string) => void;
  onSelectMonth: (monthIdx: number) => void;
}

const YearView: React.FC<YearViewProps> = ({
  year,
  events,
  todayStr,
  onSelectDate,
  onSelectMonth,
}) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {Array.from({ length: 12 }, (_, monthIdx) => {
        const firstDay = new Date(year, monthIdx, 1);
        let startDayOfWeek = firstDay.getDay();
        startDayOfWeek = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1; // Mon = 0
        const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();

        return (
          <div
            key={monthIdx}
            className="p-3.5 bg-white dark:bg-espresso-850 rounded-2xl border border-ivory-300 dark:border-espresso-750 shadow-xs hover:border-terracotta-400 transition"
          >
            {/* Mini Month Title */}
            <button
              onClick={() => onSelectMonth(monthIdx)}
              className="w-full text-left font-serif font-semibold text-sm text-espresso-950 dark:text-ivory-50 mb-2 hover:text-terracotta-600 dark:hover:text-terracotta-400 transition"
            >
              {MONTH_NAMES[monthIdx]}
            </button>

            {/* Weekday initials */}
            <div className="grid grid-cols-7 text-[10px] font-mono text-center text-espresso-400 dark:text-espresso-500 mb-1">
              <span>M</span>
              <span>T</span>
              <span>W</span>
              <span>T</span>
              <span>F</span>
              <span>S</span>
              <span>S</span>
            </div>

            {/* Days grid */}
            <div className="grid grid-cols-7 gap-1 text-[11px] font-mono text-center">
              {Array.from({ length: startDayOfWeek }).map((_, i) => (
                <div key={`empty-${i}`} />
              ))}
              {Array.from({ length: daysInMonth }, (_, i) => {
                const dayNum = i + 1;
                const dateStr = `${year}-${String(monthIdx + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                const isToday = dateStr === todayStr;
                const dayEvents = events.filter((e) => e.date === dateStr);
                const hasEvents = dayEvents.length > 0;
                const primaryCategory = hasEvents ? dayEvents[0].category : undefined;
                const dotColor = primaryCategory
                  ? getEventCategoryConfig(primaryCategory).color
                  : undefined;

                return (
                  <button
                    key={dayNum}
                    onClick={() => onSelectDate(dateStr)}
                    className={`h-6 rounded flex flex-col items-center justify-center relative hover:bg-ivory-100 dark:hover:bg-espresso-800 transition ${
                      isToday
                        ? 'bg-terracotta-500 text-white font-bold'
                        : 'text-espresso-800 dark:text-ivory-200'
                    }`}
                  >
                    <span>{dayNum}</span>
                    {hasEvents && !isToday && (
                      <span
                        className="w-1.5 h-1.5 rounded-full absolute -bottom-0.5"
                        style={{ backgroundColor: dotColor }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};
