import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { getActiveAccentColor } from '../../utils/themeColors';
import { NavTab } from '../common/Navigation';
import { Card } from '../common/Card';
import { Badge } from '../common/Badge';
import { ProgressBar } from '../common/ProgressBar';
import {
  CheckCircle2,
  Circle,
  Clock,
  Dumbbell,
  ChevronRight,
  ArrowUpRight,
  Sparkles,
  AlertCircle,
  CheckSquare,
} from 'lucide-react';
import { resolveSchedule, formatDateStr } from '../../utils/scheduleResolver';
import { isTaskOverdue } from '../../utils/plannerUtils';
import { AcademicSynergyCard } from '../dashboard/fitness/AcademicSynergyCard';
import { ReadinessScoreWidget } from '../dashboard/fitness/ReadinessScoreWidget';
import { HydrationWidget } from '../dashboard/fitness/HydrationWidget';

export interface DayOSViewProps {
  onNavigateToTab?: (tab: NavTab) => void;
}

export type DayOSFilterType = 'all' | 'class' | 'task' | 'workout' | 'meal';

export interface DayOSActivityItem {
  id: string;
  title: string;
  subtitle?: string;
  type: 'class' | 'task' | 'reminder' | 'workout' | 'meal' | 'focus';
  startTime?: string;
  endTime?: string;
  isCompleted: boolean;
  canToggleDirectly: boolean;
  isOverdue?: boolean;
  color?: string;
  badge?: string;
  details?: string;
  underlyingTab: NavTab;
  actionLabel?: string;
  onToggle?: () => void;
}

export const DayOSView: React.FC<DayOSViewProps> = ({ onNavigateToTab }) => {
  const {
    state,
    markAttendanceForEvent,
    updateTask,
    toggleReminder,
    toggleGymWorkoutComplete,
  } = useApp();

  const [activeFilter, setActiveFilter] = useState<DayOSFilterType>('all');
  const [timelineTab, setTimelineTab] = useState<'pending' | 'completed' | 'all'>('all');

  const todayStr = useMemo(() => formatDateStr(new Date()), []);
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const displayName = state.profile?.displayName?.trim() || 'Scholar';

  // ─────────────────────────────────────────────────────────────
  // 1. DERIVED TIMELINE ITEMS FROM SOURCE OF TRUTH
  // ─────────────────────────────────────────────────────────────

  // A. Personal Timetable (My Orbit)
  const todayClasses = useMemo(() => {
    const todayDate = new Date();
    const occurrences = resolveSchedule(
      state.timetable || [],
      state.occurrenceOverrides || [],
      state.extraClasses || [],
      todayDate,
      todayDate
    );

    return occurrences.map((occ): DayOSActivityItem => {
      const sub = state.subjects.find((s) => s.id === occ.subjectId);
      const log = state.attendanceLogs?.find((l) => {
        if (occ.extraClassId) {
          return l.extraClassId === occ.extraClassId && l.date === occ.date;
        }
        if (occ.slotId) {
          return l.slotId === occ.slotId && l.date === occ.date;
        }
        return false;
      });

      const isAttended = log?.status === 'present';

      return {
        id: `class-${occ.occurrenceKey}`,
        title: sub?.name || 'Academic Class',
        subtitle: sub?.code || 'ACAD',
        type: 'class',
        startTime: occ.startTime,
        endTime: occ.endTime,
        isCompleted: isAttended,
        canToggleDirectly: true,
        color: sub?.color || '#B45309',
        badge: occ.room ? `Room ${occ.room}` : undefined,
        details: occ.instructor ? `Prof. ${occ.instructor}` : undefined,
        underlyingTab: 'timetable',
        actionLabel: 'My Orbit',
        onToggle: () => {
          markAttendanceForEvent(
            occ.occurrenceKey,
            occ.subjectId,
            occ.date,
            isAttended ? 'absent' : 'present',
            occ.slotId,
            occ.extraClassId,
            occ.overrideId
          );
        },
      };
    });
  }, [state.timetable, state.occurrenceOverrides, state.extraClasses, state.subjects, state.attendanceLogs, markAttendanceForEvent]);

  // B. Tasks & Reminders
  const todayTasks = useMemo(() => {
    const items: DayOSActivityItem[] = [];

    // Tasks due today or active
    for (const task of state.tasks || []) {
      const isDueToday = task.dueDate === todayStr;
      const isOverdueTask = isTaskOverdue(task);

      if (isDueToday || isOverdueTask) {
        items.push({
          id: `task-${task.id}`,
          title: task.title,
          subtitle: task.subjectId ? state.subjects.find((s) => s.id === task.subjectId)?.code : 'Personal Task',
          type: 'task',
          startTime: task.dueTime || undefined,
          isCompleted: task.status === 'done',
          canToggleDirectly: true,
          isOverdue: isOverdueTask,
          color: getActiveAccentColor(),
          badge: task.priority ? task.priority.toUpperCase() : undefined,
          details: task.description || undefined,
          underlyingTab: 'planner',
          actionLabel: 'Planner',
          onToggle: () => {
            updateTask(task.id, {
              status: task.status === 'done' ? 'todo' : 'done',
            });
          },
        });
      }
    }

    // Reminders for today
    for (const rem of state.reminders || []) {
      if (rem.dueDate === todayStr || (!rem.isCompleted && !rem.dueDate)) {
        items.push({
          id: `reminder-${rem.id}`,
          title: rem.title,
          subtitle: 'Event & Reminder',
          type: 'reminder',
          isCompleted: rem.isCompleted,
          canToggleDirectly: true,
          color: '#3D6A8A',
          badge: rem.category,
          underlyingTab: 'reminders',
          actionLabel: 'Reminders',
          onToggle: () => {
            toggleReminder(rem.id);
          },
        });
      }
    }

    return items;
  }, [state.tasks, state.reminders, state.subjects, todayStr, updateTask, toggleReminder]);

  // C. Iron Lab Workout
  const todayWorkoutItem = useMemo((): DayOSActivityItem | null => {
    const todayWorkout = (state.gymWorkouts || []).find((w) => w.date === todayStr);
    const splitTitle = todayWorkout?.split || "Today's Hypertrophy Protocol";
    const isFinished = Boolean(todayWorkout?.completed);

    return {
      id: 'gym-today',
      title: splitTitle,
      subtitle: 'Iron Lab Workout Split',
      type: 'workout',
      startTime: '17:30',
      endTime: '18:45',
      isCompleted: isFinished,
      canToggleDirectly: true,
      color: '#D4A373',
      badge: isFinished ? 'Completed' : 'Planned',
      underlyingTab: 'gym',
      actionLabel: 'Iron Lab',
      onToggle: () => {
        toggleGymWorkoutComplete();
      },
    };
  }, [state.gymWorkouts, todayStr, toggleGymWorkoutComplete]);

  // D. Fuel OS Nutrition Slots
  const todayMealItems = useMemo((): DayOSActivityItem[] => {
    const todayLogs = (state.foodDiaryEntries || []).filter((e) => e.date === todayStr);

    const mealSlots: { id: string; title: string; time: string; type: 'breakfast' | 'lunch' | 'snacks' | 'dinner' }[] = [
      { id: 'meal-breakfast', title: 'Breakfast Energy', time: '08:30', type: 'breakfast' },
      { id: 'meal-lunch', title: 'Midday Lunch Recovery', time: '13:00', type: 'lunch' },
      { id: 'meal-snacks', title: 'Afternoon Fuel & Snack', time: '16:30', type: 'snacks' },
      { id: 'meal-dinner', title: 'Evening Dinner & Macros', time: '20:30', type: 'dinner' },
    ];

    return mealSlots.map((slot) => {
      const logsForSlot = todayLogs.filter((l) => l.mealType === slot.type);
      const hasLogged = logsForSlot.length > 0;
      const totalCals = logsForSlot.reduce((acc, curr) => acc + (curr.calories || 0), 0);
      const totalProtein = logsForSlot.reduce((acc, curr) => acc + (curr.protein || 0), 0);

      return {
        id: slot.id,
        title: slot.title,
        subtitle: hasLogged ? `${totalCals} kcal · ${totalProtein}g Protein logged` : 'Scheduled Nutrition Window',
        type: 'meal',
        startTime: slot.time,
        isCompleted: hasLogged,
        canToggleDirectly: false, // Meals must use Fuel OS logging flow to avoid falsification
        color: '#819B7C',
        badge: hasLogged ? 'Logged' : 'Pending',
        underlyingTab: 'nutrition',
        actionLabel: hasLogged ? 'View in Fuel OS' : 'Log in Fuel OS',
      };
    });
  }, [state.foodDiaryEntries, todayStr]);

  // Combine all activities
  const allActivities = useMemo(() => {
    const list: DayOSActivityItem[] = [
      ...todayClasses,
      ...todayTasks,
      ...(todayWorkoutItem ? [todayWorkoutItem] : []),
      ...todayMealItems,
    ];

    // Sort chronologically by startTime, placing non-timed items at the end
    return list.sort((a, b) => {
      if (a.startTime && b.startTime) {
        return a.startTime.localeCompare(b.startTime);
      }
      if (a.startTime) return -1;
      if (b.startTime) return 1;
      return 0;
    });
  }, [todayClasses, todayTasks, todayWorkoutItem, todayMealItems]);

  // Filtered activities
  const filteredActivities = useMemo(() => {
    return allActivities.filter((act) => {
      if (activeFilter === 'class' && act.type !== 'class') return false;
      if (activeFilter === 'task' && act.type !== 'task' && act.type !== 'reminder') return false;
      if (activeFilter === 'workout' && act.type !== 'workout') return false;
      if (activeFilter === 'meal' && act.type !== 'meal') return false;

      if (timelineTab === 'pending' && act.isCompleted) return false;
      if (timelineTab === 'completed' && !act.isCompleted) return false;

      return true;
    });
  }, [allActivities, activeFilter, timelineTab]);

  // Metrics
  const totalCount = allActivities.length;
  const completedCount = allActivities.filter((a) => a.isCompleted).length;
  const pendingCount = totalCount - completedCount;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // Next Upcoming Activity
  const nextActivity = useMemo(() => {
    const pendingTimed = allActivities
      .filter((a) => !a.isCompleted && a.startTime)
      .map((a) => {
        const [h, m] = (a.startTime || '00:00').split(':').map(Number);
        const mins = (h || 0) * 60 + (m || 0);
        return { item: a, mins };
      })
      .sort((a, b) => a.mins - b.mins);

    const upcoming = pendingTimed.find((p) => p.mins >= currentMinutes);
    return upcoming ? upcoming.item : pendingTimed[0]?.item || allActivities.find((a) => !a.isCompleted) || null;
  }, [allActivities, currentMinutes]);

  // Focus today summary
  const focusMinutesToday = useMemo(() => {
    return (state.studySessions || [])
      .filter((s) => s.timestamp.startsWith(todayStr))
      .reduce((acc, curr) => acc + curr.durationMinutes, 0);
  }, [state.studySessions, todayStr]);

  // Nutrition energy summary
  const todayCalories = useMemo(() => {
    return (state.foodDiaryEntries || [])
      .filter((e) => e.date === todayStr)
      .reduce((acc, curr) => acc + (curr.calories || 0), 0);
  }, [state.foodDiaryEntries, todayStr]);

  const targetCalories = state.nutritionProfile?.targetCalories || 2200;

  return (
    <div className="my-space-page flex flex-col gap-6 pb-12 animate-in fade-in duration-300">
      {/* ── 1. GREETING & HEADER ────────────────────────────────────── */}
      <div className="my-space-header flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-terracotta-600 dark:text-terracotta-400">
              Personal Space
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-terracotta-100 dark:bg-terracotta-950/70 text-terracotta-700 dark:text-terracotta-300 border border-terracotta-200 dark:border-terracotta-800">
              <Sparkles className="w-3 h-3" />
              DayOS Active
            </span>
          </div>

          <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-normal text-espresso-950 dark:text-ivory-50 tracking-tight">
            Daily Operating System
          </h1>

          <p className="text-xs sm:text-sm text-espresso-500 dark:text-espresso-400 mt-1">
            Good day, {displayName}. Here is your coordinated personal breakdown across timetable, fitness, nutrition, and focus.
          </p>
        </div>

        {/* Date Stamp */}
        <div className="my-space-date-stamp p-3 rounded-2xl bg-white dark:bg-espresso-850 border border-ivory-300 dark:border-espresso-750 shadow-subtle shrink-0">
          <p className="text-[10px] font-mono uppercase text-espresso-400 font-semibold">Today's Horizon</p>
          <p className="text-sm font-serif font-bold text-espresso-950 dark:text-ivory-50">
            {now.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}
          </p>
        </div>
      </div>

      {/* ── 2. TODAY'S PROGRESS STRIP ───────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Completion Progress Gauge */}
        <Card>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono uppercase text-espresso-500 font-semibold">
              Today's Execution
            </span>
            <Badge variant={progressPercent >= 75 ? 'sage' : progressPercent >= 40 ? 'ochre' : 'neutral'}>
              {progressPercent}% Done
            </Badge>
          </div>
          <p className="font-serif text-3xl font-bold text-espresso-950 dark:text-ivory-50">
            {completedCount} <span className="text-lg text-espresso-400 font-normal">/ {totalCount} completed</span>
          </p>
          <div className="mt-3">
            <ProgressBar value={progressPercent} height="sm" />
          </div>
          <p className="text-[11px] text-espresso-400 mt-2 font-mono">
            {pendingCount} item{pendingCount === 1 ? '' : 's'} remaining on schedule
          </p>
        </Card>

        {/* Next Up Activity */}
        <Card>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono uppercase text-espresso-500 font-semibold">
              Next Up
            </span>
            <span className="text-[11px] font-mono text-terracotta-600 dark:text-terracotta-400 font-bold flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {nextActivity?.startTime || 'Soon'}
            </span>
          </div>

          {nextActivity ? (
            <div className="space-y-1">
              <p className="font-serif text-lg font-bold text-espresso-950 dark:text-ivory-50 truncate">
                {nextActivity.title}
              </p>
              <p className="text-xs text-espresso-500 dark:text-espresso-400">
                {nextActivity.subtitle || nextActivity.details || nextActivity.type.toUpperCase()}
              </p>
              {onNavigateToTab && (
                <button
                  onClick={() => onNavigateToTab(nextActivity.underlyingTab)}
                  className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-terracotta-600 dark:text-terracotta-400 hover:underline cursor-pointer"
                >
                  <span>Open {nextActivity.actionLabel || 'Details'}</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ) : (
            <div className="py-2">
              <p className="text-xs font-semibold text-sage-600 dark:text-sage-400 flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" /> All planned items wrapped up!
              </p>
              <p className="text-[11px] text-espresso-400 mt-1">Take time for restorative rest.</p>
            </div>
          )}
        </Card>

        {/* Energy & Focus Pulse */}
        <Card>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono uppercase text-espresso-500 font-semibold">
              Energy &amp; Focus Pulse
            </span>
            <span className="text-[11px] font-mono text-sage-600 dark:text-sage-400 font-semibold">
              Fuel + Focus
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-1">
            <div className="p-2.5 rounded-xl bg-ivory-50 dark:bg-espresso-800/80 border border-ivory-200 dark:border-espresso-700">
              <p className="text-[10px] font-mono uppercase text-espresso-400">Calories</p>
              <p className="font-serif text-lg font-bold text-espresso-950 dark:text-ivory-50 mt-0.5">
                {todayCalories} <span className="text-xs font-normal text-espresso-400">/ {targetCalories}</span>
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-ivory-50 dark:bg-espresso-800/80 border border-ivory-200 dark:border-espresso-700">
              <p className="text-[10px] font-mono uppercase text-espresso-400">Deep Focus</p>
              <p className="font-serif text-lg font-bold text-espresso-950 dark:text-ivory-50 mt-0.5">
                {focusMinutesToday} <span className="text-xs font-normal text-espresso-400">min</span>
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* ── 3. FULL CHRONOLOGICAL DAILY TIMELINE ────────────────────── */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-ivory-200 dark:border-espresso-800 pb-3">
          <div>
            <h2 className="font-serif text-xl sm:text-2xl font-bold text-espresso-950 dark:text-ivory-50 tracking-tight">
              Chronological Daily Timeline
            </h2>
            <p className="text-xs text-espresso-500 dark:text-espresso-400">
              Real-time sequence of lectures, training splits, meals, and tasks.
            </p>
          </div>

          {/* Timeline Filter Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="my-space-filter-tabs flex items-center p-1 bg-ivory-100 dark:bg-espresso-800 rounded-xl border border-ivory-300 dark:border-espresso-700">
              {(['all', 'pending', 'completed'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setTimelineTab(tab)}
                  aria-pressed={timelineTab === tab}
                  className={`px-3 py-1 rounded-lg text-xs font-medium capitalize transition cursor-pointer ${
                    timelineTab === tab
                      ? 'bg-white dark:bg-espresso-700 text-espresso-950 dark:text-ivory-50 shadow-subtle font-semibold'
                      : 'text-espresso-600 dark:text-espresso-300 hover:text-espresso-900'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            <div className="my-space-filter-tabs flex items-center gap-1">
              {(['all', 'class', 'task', 'workout', 'meal'] as const).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveFilter(cat)}
                  aria-pressed={activeFilter === cat}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-mono uppercase font-semibold transition cursor-pointer ${
                    activeFilter === cat
                      ? 'bg-terracotta-600 text-white shadow-xs'
                      : 'bg-ivory-100 dark:bg-espresso-800 text-espresso-600 dark:text-ivory-300 hover:bg-ivory-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Timeline Items List */}
        {filteredActivities.length === 0 ? (
          <div className="p-12 text-center rounded-2xl border border-dashed border-ivory-300 dark:border-espresso-700 bg-white/40 dark:bg-espresso-850/40 space-y-2">
            <CheckSquare className="w-8 h-8 text-espresso-400 mx-auto mb-1" />
            <p className="text-sm font-semibold text-espresso-900 dark:text-ivory-100">
              No activities found in this filter view.
            </p>
            <p className="text-xs text-espresso-500">
              Switch the filter to "All" or add classes, workouts, or tasks in their respective sections.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredActivities.map((item) => {
              return (
                <div
                  key={item.id}
                  className={`p-4 sm:p-5 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    item.isCompleted
                      ? 'bg-white/60 dark:bg-espresso-900/60 border-ivory-200 dark:border-espresso-800 opacity-75'
                      : 'bg-white dark:bg-espresso-850 border-ivory-300 dark:border-espresso-750 shadow-subtle'
                  }`}
                  style={{ borderLeft: `6px solid ${item.color || getActiveAccentColor()}` }}
                >
                  <div className="flex items-start sm:items-center gap-3.5">
                    {/* Completion Checkbox */}
                    {item.canToggleDirectly ? (
                      <button
                        onClick={item.onToggle}
                        className="mt-0.5 sm:mt-0 text-espresso-400 hover:text-terracotta-600 transition cursor-pointer shrink-0"
                        title={item.isCompleted ? 'Mark Pending' : 'Mark Completed'}
                      >
                        {item.isCompleted ? (
                          <CheckCircle2 className="w-5 h-5 text-sage-600 dark:text-sage-400" />
                        ) : (
                          <Circle className="w-5 h-5 text-espresso-400 hover:text-espresso-600" />
                        )}
                      </button>
                    ) : (
                      <span className="mt-0.5 sm:mt-0 p-1 text-espresso-400 shrink-0" title="Must be logged via underlying module">
                        {item.isCompleted ? (
                          <CheckCircle2 className="w-5 h-5 text-sage-600 dark:text-sage-400" />
                        ) : (
                          <Circle className="w-5 h-5 text-espresso-300" />
                        )}
                      </span>
                    )}

                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        {item.startTime && (
                          <span className="font-mono text-xs font-semibold text-terracotta-600 dark:text-terracotta-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {item.startTime}{item.endTime ? ` — ${item.endTime}` : ''}
                          </span>
                        )}
                        {item.badge && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-ivory-200 dark:bg-espresso-800 text-espresso-700 dark:text-ivory-200">
                            {item.badge}
                          </span>
                        )}
                        {item.isOverdue && (
                          <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200">
                            <AlertCircle className="w-2.5 h-2.5" /> Overdue
                          </span>
                        )}
                      </div>

                      <h3 className={`font-serif text-base sm:text-lg font-bold text-espresso-950 dark:text-ivory-50 ${item.isCompleted ? 'line-through text-espresso-500 dark:text-espresso-400' : ''}`}>
                        {item.title}
                      </h3>

                      {(item.subtitle || item.details) && (
                        <p className="text-xs text-espresso-500 dark:text-espresso-400">
                          {item.subtitle} {item.details && `· ${item.details}`}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Right Action Button */}
                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    {onNavigateToTab && (
                      <button
                        onClick={() => onNavigateToTab(item.underlyingTab)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-ivory-300 dark:border-espresso-700 text-xs font-semibold text-espresso-700 dark:text-ivory-200 hover:bg-ivory-100 dark:hover:bg-espresso-800 transition cursor-pointer"
                      >
                        <span>{item.actionLabel || 'Details'}</span>
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── 4. INTEGRATED COMPONENT PILLARS ─────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pillar 1: Classes & Attendance */}
        <Card
          eyebrow="My Orbit Timetable"
          title="Today's Classes & Personal Attendance"
          subtitle={`${todayClasses.length} class occurrences scheduled for today`}
        >
          {todayClasses.length === 0 ? (
            <p className="text-xs text-espresso-400 italic py-4">No personal classes scheduled for today.</p>
          ) : (
            <div className="space-y-3 mt-2">
              {todayClasses.map((cls) => (
                <div
                  key={cls.id}
                  className="p-3.5 rounded-xl border border-ivory-200 dark:border-espresso-750 flex items-center justify-between gap-3 bg-white dark:bg-espresso-850"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-espresso-900 dark:text-ivory-100">
                        {cls.subtitle}
                      </span>
                      <span className="text-xs text-espresso-500">
                        {cls.startTime} — {cls.endTime}
                      </span>
                    </div>
                    <p className="text-sm font-serif font-bold text-espresso-950 dark:text-ivory-50 mt-0.5">
                      {cls.title}
                    </p>
                  </div>

                  <button
                    onClick={cls.onToggle}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                      cls.isCompleted
                        ? 'bg-sage-600 text-white'
                        : 'border border-ivory-300 dark:border-espresso-700 text-espresso-700 dark:text-ivory-200 hover:bg-ivory-100'
                    }`}
                  >
                    {cls.isCompleted ? 'Marked Present' : 'Mark Present'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Pillar 2: Iron Lab Workout & Fuel OS Summary */}
        <div className="space-y-6">
          <AcademicSynergyCard />
          {(() => {
            const todayWorkout = (state.gymWorkouts || []).find((w) => w.date === todayStr);
            const isFinished = Boolean(todayWorkout?.completed);
            const splitTitle = todayWorkout?.split || "Push / Pull / Legs Split";

            return (
              <Card
                eyebrow="Iron Lab Split"
                title="Today's Training Session"
                subtitle={splitTitle}
              >
                <div className="flex items-center justify-between p-4 rounded-xl bg-ivory-50 dark:bg-espresso-800/60 border border-ivory-200 dark:border-espresso-750">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300">
                      <Dumbbell className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-serif text-base font-bold text-espresso-950 dark:text-ivory-50">
                        {splitTitle}
                      </p>
                      <p className="text-xs text-espresso-500 dark:text-espresso-400 mt-0.5">
                        {isFinished ? 'Routine marked complete' : 'Scheduled routine pending'}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={toggleGymWorkoutComplete}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                      isFinished
                        ? 'bg-sage-600 text-white'
                        : 'bg-espresso-900 text-white dark:bg-ivory-100 dark:text-espresso-950'
                    }`}
                  >
                    {isFinished ? 'Finished ✓' : 'Mark Done'}
                  </button>
                </div>
              </Card>
            );
          })()}

          <Card
            eyebrow="Fuel OS Balance"
            title="Nutrition Energy Progress"
            subtitle={`${todayCalories} of ${targetCalories} kcal budget consumed`}
          >
            <div className="space-y-3">
              <ProgressBar
                value={Math.min(100, Math.round((todayCalories / targetCalories) * 100))}
                height="md"
              />
              <div className="flex items-center justify-between text-xs text-espresso-500">
                <span>Budget: {targetCalories} kcal</span>
                <span className="font-mono font-bold text-espresso-900 dark:text-ivory-100">
                  {Math.max(0, targetCalories - todayCalories)} kcal remaining
                </span>
              </div>
            </div>
          </Card>

          <ReadinessScoreWidget />
          <HydrationWidget />
        </div>
      </div>
    </div>
  );
};
