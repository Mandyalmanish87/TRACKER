import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { TodayScheduleWidget } from './TodayScheduleWidget';
import { AttendanceGaugeWidget } from './AttendanceGaugeWidget';
import { FocusWidget } from './FocusWidget';
import { JourneySummaryWidget } from './JourneySummaryWidget';
import { FocusRadioDashboardCard } from '../focus-radio';
import { GymSplitWidget } from './GymSplitWidget';
import { RemindersWidget } from './RemindersWidget';
import { AcademicCountdownWidget } from './AcademicCountdownWidget';
import { SyllabusSummaryWidget } from './SyllabusSummaryWidget';
import { PlannerSummaryWidget } from './PlannerSummaryWidget';
import { FitnessSummaryWidget } from './FitnessSummaryWidget';
import { TestSummaryWidget } from './TestSummaryWidget';
import { calculateOverallAttendance } from '../../utils/attendance';
import { calculateStudyStreaks } from '../../utils/focusAnalytics';
import { AnimatedCounter } from '../ui/AnimatedCounter';
import {
  Clock,
  Calendar,
  GraduationCap,
  Flame,
  Dumbbell,
  CheckSquare,
  GripVertical,
  ChevronUp,
  ChevronDown,
  RotateCcw,
} from 'lucide-react';
import { NavTab } from '../common/Navigation';
import { TiltCard } from '../common/TiltCard';
import { CardDensityContext } from '../common/Card';

export const DEFAULT_DASHBOARD_WIDGET_ORDER = [
  'today_schedule',
  'attendance',
  'focus_timer',
  'journey_heatmap',
  'focus_radio',
  'events_tasks',
  'planner',
  'nutrition',
  'gym',
  'syllabus',
  'tests',
];

const WIDGET_TITLES: Record<string, string> = {
  today_schedule: "Today's Timetable",
  attendance: 'Attendance Health',
  focus_timer: 'Deep Focus Timer',
  journey_heatmap: 'Focus Journey Heatmap',
  focus_radio: 'Focus Radio',
  events_tasks: 'Events & Tasks',
  planner: 'Study Planner',
  nutrition: 'Nutrition & Macros',
  gym: 'Gym Workout Split',
  syllabus: 'Syllabus Tracker',
  tests: 'Tests & Error Analytics',
};

interface DashboardProps {
  onNavigateToSyllabus?: () => void;
  onNavigateToFocus?: () => void;
  onNavigateToPlanner?: () => void;
  onNavigateToNutrition?: () => void;
  onNavigateToTests?: () => void;
  onSelectTab?: (tab: NavTab) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  onNavigateToSyllabus,
  onNavigateToFocus,
  onNavigateToPlanner,
  onNavigateToNutrition,
  onNavigateToTests,
  onSelectTab: _onSelectTab,
}) => {
  const { state, updateSettings } = useApp();

  // Profile name
  const displayName = state.profile?.displayName?.trim() || 'Scholar';

  // Drag and drop state
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Compute live overview metrics
  const targetDay = 3; // Wednesday in demo/academic term
  const todayClasses = state.timetable.filter((t) => t.dayOfWeek === targetDay);
  const overall = calculateOverallAttendance(state.subjects, 75);

  const todayStr = new Date().toISOString().split('T')[0];
  const minutesToday = state.studySessions
    .filter((s) => s.timestamp.startsWith(todayStr))
    .reduce((acc, s) => acc + s.durationMinutes, 0);

  const focusStreaks = calculateStudyStreaks(
    state.studySessions,
    new Date(),
    state.settings?.studyDayRolloverHour ?? 0
  );

  const todayWorkout = state.gymWorkouts.find(
    (w) => w.date === todayStr || (w.isSample && state.gymWorkouts.length > 0)
  );

  const pendingReminders = state.reminders.filter((r) => !r.isCompleted).length;
  const pendingTasks = (state.tasks || []).filter((t) => t.status !== 'done').length;
  const totalPending = pendingReminders + pendingTasks;

  // Live clock state for Current Time widget
  const [currentTime, setCurrentTime] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const timeFormatted = useMemo(() => {
    const hours = currentTime.getHours();
    const minutes = currentTime.getMinutes();
    const hours12 = hours % 12 || 12;
    const hoursStr = String(hours12).padStart(2, '0');
    const minutesStr = String(minutes).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const dayName = currentTime.toLocaleDateString('en-US', { weekday: 'long' });
    const dateMonth = currentTime.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    return {
      time: `${hoursStr}:${minutesStr}`,
      ampm,
      dayName,
      dateMonth,
    };
  }, [currentTime]);

  const hour = currentTime.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  // Sanitized order: merges user preferences with defaults, recovering from missing/obsolete IDs
  const widgetOrder = useMemo(() => {
    const stored = state.settings?.dashboardWidgetOrder;
    if (!Array.isArray(stored) || stored.length === 0) {
      return DEFAULT_DASHBOARD_WIDGET_ORDER;
    }
    const valid = stored.filter((id) => id in WIDGET_TITLES);
    for (const defId of DEFAULT_DASHBOARD_WIDGET_ORDER) {
      if (!valid.includes(defId)) valid.push(defId);
    }
    return valid;
  }, [state.settings?.dashboardWidgetOrder]);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData('text/plain', String(index));
    e.dataTransfer.effectAllowed = 'move';
    setDraggingIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    const sourceIndexStr = e.dataTransfer.getData('text/plain');
    const sourceIndex = Number(sourceIndexStr);

    setDraggingIndex(null);
    setDragOverIndex(null);

    if (isNaN(sourceIndex) || sourceIndex === targetIndex) return;

    const newOrder = [...widgetOrder];
    const [moved] = newOrder.splice(sourceIndex, 1);
    newOrder.splice(targetIndex, 0, moved);

    updateSettings({ dashboardWidgetOrder: newOrder });
  };

  const handleDragEnd = () => {
    setDraggingIndex(null);
    setDragOverIndex(null);
  };

  const handleMove = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= widgetOrder.length) return;
    const newOrder = [...widgetOrder];
    const [moved] = newOrder.splice(fromIndex, 1);
    newOrder.splice(toIndex, 0, moved);

    updateSettings({ dashboardWidgetOrder: newOrder });
  };

  const handleResetLayout = () => {
    updateSettings({
      dashboardWidgetOrder: DEFAULT_DASHBOARD_WIDGET_ORDER,
    });
  };

  const renderWidgetComponent = (widgetId: string) => {
    switch (widgetId) {
      case 'today_schedule':
        return <TodayScheduleWidget />;
      case 'attendance':
        return <AttendanceGaugeWidget />;
      case 'focus_timer':
        return (
          <FocusWidget
            onNavigateToFocus={onNavigateToFocus}
            showExtendedAnalyticsLink={Boolean(onNavigateToFocus)}
          />
        );
      case 'journey_heatmap':
        return <JourneySummaryWidget onNavigateToFocus={onNavigateToFocus} />;
      case 'focus_radio':
        return <FocusRadioDashboardCard />;
      case 'events_tasks':
        return <RemindersWidget />;
      case 'planner':
        return <PlannerSummaryWidget onNavigateToPlanner={onNavigateToPlanner} />;
      case 'nutrition':
        return <FitnessSummaryWidget onNavigateToNutrition={onNavigateToNutrition} />;
      case 'gym':
        return <GymSplitWidget />;
      case 'syllabus':
        return <SyllabusSummaryWidget onNavigateToSyllabus={onNavigateToSyllabus} />;
      case 'tests':
        return <TestSummaryWidget onNavigateToTests={onNavigateToTests} />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-8 pb-20">
      {/* ── 1. EDITORIAL GREETING & FOCUS LAUNCHER ──────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-ivory-300 dark:border-espresso-800 pb-5">
        <div>
          <h1 className="font-serif text-3xl sm:text-4xl font-normal text-espresso-950 dark:text-ivory-50 tracking-tight">
            {greeting}, {displayName}.
          </h1>
          <p className="text-sm font-serif italic text-espresso-500 dark:text-espresso-400 mt-1">
            "Excellence is not an act, but a habit." — Aristotle
          </p>
        </div>
        <div className="flex items-center gap-2">
          {onNavigateToFocus && (
            <button
              onClick={onNavigateToFocus}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-white shadow-subtle flex items-center gap-2 transition hover:opacity-95 cursor-pointer"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              <Flame className="w-3.5 h-3.5" />
              <span>Start Focus Session</span>
            </button>
          )}
        </div>
      </div>

      {/* ── 2. ACADEMIC COUNTDOWN & KPI STRIP ─────────────────────── */}
      <section className="space-y-6">
        <AcademicCountdownWidget />

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5 sm:gap-4">
          {/* Stat 0: Current Time */}
          <TiltCard maxTilt={8} scale={1.02}>
            <div className="p-4 sm:p-5 rounded-2xl border border-ivory-300 dark:border-espresso-750 bg-white dark:bg-espresso-850 shadow-subtle h-full flex flex-col justify-between">
              <div className="flex items-center justify-between text-espresso-500 dark:text-espresso-400 mb-2">
                <span className="text-[11px] font-mono font-semibold uppercase tracking-wider">Current Time</span>
                <div className="p-1.5 rounded-lg bg-terracotta-50 dark:bg-terracotta-900/30">
                  <Clock className="w-3.5 h-3.5 text-terracotta-600 dark:text-terracotta-400" />
                </div>
              </div>
              <div className="flex items-baseline gap-1.5">
                <p className="font-serif tabular-nums text-2xl sm:text-3xl font-bold text-espresso-950 dark:text-ivory-50">
                  {timeFormatted.time}
                </p>
                <span className="font-mono text-xs font-bold text-terracotta-600 dark:text-terracotta-400 uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-terracotta-50 dark:bg-terracotta-950/60 border border-terracotta-200/50 dark:border-terracotta-800/50">
                  {timeFormatted.ampm}
                </span>
              </div>
              <p className="text-xs text-espresso-500 dark:text-espresso-400 mt-1 truncate">
                {timeFormatted.dayName} · {timeFormatted.dateMonth}
              </p>
            </div>
          </TiltCard>

          {/* Stat 1: Classes Today */}
          <TiltCard maxTilt={8} scale={1.02}>
            <div className="p-4 sm:p-5 rounded-2xl border border-ivory-300 dark:border-espresso-750 bg-white dark:bg-espresso-850 shadow-subtle h-full flex flex-col justify-between">
              <div className="flex items-center justify-between text-espresso-500 dark:text-espresso-400 mb-2">
                <span className="text-[11px] font-mono font-semibold uppercase tracking-wider">Classes Today</span>
                <div className="p-1.5 rounded-lg bg-ivory-100 dark:bg-espresso-800">
                  <Calendar className="w-3.5 h-3.5 text-terracotta-600 dark:text-terracotta-400" />
                </div>
              </div>
              <p className="font-serif tabular-nums text-2xl sm:text-3xl font-bold text-espresso-950 dark:text-ivory-50">
                <AnimatedCounter value={todayClasses.length} />
              </p>
              <p className="text-xs text-espresso-500 dark:text-espresso-400 mt-1">Scheduled Lectures</p>
            </div>
          </TiltCard>

          {/* Stat 2: Attendance Health */}
          <TiltCard maxTilt={8} scale={1.02}>
            <div className="p-4 sm:p-5 rounded-2xl border border-ivory-300 dark:border-espresso-750 bg-white dark:bg-espresso-850 shadow-subtle h-full flex flex-col justify-between">
              <div className="flex items-center justify-between text-espresso-500 dark:text-espresso-400 mb-2">
                <span className="text-[11px] font-mono font-semibold uppercase tracking-wider">Attendance</span>
                <div className="p-1.5 rounded-lg bg-sage-50 dark:bg-sage-900/30">
                  <GraduationCap className="w-3.5 h-3.5 text-sage-600 dark:text-sage-400" />
                </div>
              </div>
              <p className="font-serif tabular-nums text-2xl sm:text-3xl font-bold text-espresso-950 dark:text-ivory-50">
                {overall.formattedPercentage}
              </p>
              <p className="text-xs text-espresso-500 dark:text-espresso-400 mt-1">
                {overall.status === 'safe'
                  ? 'Above 75% Target'
                  : overall.status === 'warning'
                  ? 'Threshold Alert'
                  : 'Action Required'}
              </p>
            </div>
          </TiltCard>

          {/* Stat 3: Focus Study Time */}
          <TiltCard maxTilt={8} scale={1.02}>
            <div className="p-4 sm:p-5 rounded-2xl border border-ivory-300 dark:border-espresso-750 bg-white dark:bg-espresso-850 shadow-subtle h-full flex flex-col justify-between">
              <div className="flex items-center justify-between text-espresso-500 dark:text-espresso-400 mb-2">
                <span className="text-[11px] font-mono font-semibold uppercase tracking-wider">Deep Focus</span>
                <div className="p-1.5 rounded-lg bg-ochre-50 dark:bg-ochre-900/30">
                  <Flame className="w-3.5 h-3.5 text-ochre-600 dark:text-ochre-400" />
                </div>
              </div>
              <p className="font-serif tabular-nums text-2xl sm:text-3xl font-bold text-espresso-950 dark:text-ivory-50">
                <AnimatedCounter value={minutesToday} suffix="m" />
              </p>
              <p className="text-xs text-espresso-500 dark:text-espresso-400 mt-1">
                {focusStreaks.currentStreak > 0 ? `${focusStreaks.currentStreak}d Streak` : 'Logged Study'}
              </p>
            </div>
          </TiltCard>

          {/* Stat 4: Workout Status */}
          <TiltCard maxTilt={8} scale={1.02}>
            <div className="p-4 sm:p-5 rounded-2xl border border-ivory-300 dark:border-espresso-750 bg-white dark:bg-espresso-850 shadow-subtle h-full flex flex-col justify-between">
              <div className="flex items-center justify-between text-espresso-500 dark:text-espresso-400 mb-2">
                <span className="text-[11px] font-mono font-semibold uppercase tracking-wider">Gym Split</span>
                <div className="p-1.5 rounded-lg bg-ivory-100 dark:bg-espresso-800">
                  <Dumbbell className="w-3.5 h-3.5 text-espresso-600 dark:text-espresso-300" />
                </div>
              </div>
              <p className="font-serif text-xl sm:text-2xl font-bold text-espresso-950 dark:text-ivory-50 truncate">
                {todayWorkout ? (todayWorkout.completed ? 'Done' : 'Active') : 'Rest'}
              </p>
              <p className="text-xs text-espresso-500 dark:text-espresso-400 mt-1 truncate">
                {todayWorkout?.split.split('(')[0] || 'Recovery'}
              </p>
            </div>
          </TiltCard>

          {/* Stat 5: Pending Actions */}
          <TiltCard maxTilt={8} scale={1.02}>
            <div className="p-4 sm:p-5 rounded-2xl border border-ivory-300 dark:border-espresso-750 bg-white dark:bg-espresso-850 shadow-subtle h-full flex flex-col justify-between">
              <div className="flex items-center justify-between text-espresso-500 dark:text-espresso-400 mb-2">
                <span className="text-[11px] font-mono font-semibold uppercase tracking-wider">Tasks</span>
                <div className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-900/30">
                  <CheckSquare className="w-3.5 h-3.5 text-rose-500" />
                </div>
              </div>
              <p className="font-serif tabular-nums text-2xl sm:text-3xl font-bold text-espresso-950 dark:text-ivory-50">
                <AnimatedCounter value={totalPending} />
              </p>
              <p className="text-xs text-espresso-500 dark:text-espresso-400 mt-1">
                {pendingTasks > 0 ? `${pendingTasks} Tasks · ${pendingReminders} Reminders` : 'Queue Clear'}
              </p>
            </div>
          </TiltCard>
        </div>
      </section>

      {/* ── 3. REARRANGEABLE COMMAND CENTER WIDGETS ────────────────── */}
      <section className="space-y-4">
        {/* Header with Title and Reset Layout */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-ivory-300 dark:border-espresso-800">
          <div>
            <span className="font-mono text-xs font-semibold uppercase tracking-wider text-terracotta-600 dark:text-terracotta-400">
              Customizable Layout
            </span>
            <h2 className="font-serif text-2xl sm:text-3xl font-normal text-espresso-950 dark:text-ivory-50 tracking-tight mt-0.5">
              Active Command Center
            </h2>
            <p className="text-xs text-espresso-500 dark:text-espresso-400 mt-0.5">
              Dynamic masonry layout · Drag handles or accessible controls to rearrange
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleResetLayout}
              title="Reset dashboard widget order to default"
              className="text-xs px-3 py-1.5 rounded-xl border border-ivory-300 dark:border-espresso-750 bg-white dark:bg-espresso-850 hover:bg-ivory-100 dark:hover:bg-espresso-800 text-espresso-700 dark:text-ivory-200 flex items-center gap-1.5 font-medium shadow-xs transition cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-terracotta-500" />
              <span>Reset Layout</span>
            </button>
          </div>
        </div>

        {/* Masonry Layout: stacks blocks with zero vertical gaps */}
        <CardDensityContext.Provider value={{ density: 'compact', borderless: false }}>
          <div className="columns-1 md:columns-2 lg:columns-3 xl:columns-4 gap-4 space-y-4">
            {widgetOrder.map((widgetId, idx) => {
              const isDragging = draggingIndex === idx;
              const isOver = dragOverIndex === idx;

              return (
                <div
                  key={widgetId}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDrop={(e) => handleDrop(e, idx)}
                  className={`break-inside-avoid rounded-2xl border border-ivory-300 dark:border-espresso-750 bg-white dark:bg-espresso-850 overflow-hidden shadow-subtle mb-4 flex flex-col transition-all duration-200 relative group ${
                    isOver ? 'ring-2 ring-terracotta-500 scale-[1.01]' : ''
                  } ${isDragging ? 'opacity-40' : ''}`}
                >
                  {/* Sleek Integrated Drag Header */}
                  <div className="flex items-center justify-between px-3.5 py-1.5 border-b border-ivory-200 dark:border-espresso-800 bg-ivory-50/80 dark:bg-espresso-900/60 select-none shrink-0 text-xs">
                    <div
                      draggable
                      onDragStart={(e) => handleDragStart(e, idx)}
                      onDragEnd={handleDragEnd}
                      className="flex items-center gap-1.5 cursor-grab active:cursor-grabbing hover:text-espresso-950 dark:hover:text-ivory-50 transition py-0.5 px-1 rounded -ml-1"
                      title="Click and drag to rearrange this widget"
                    >
                      <GripVertical className="w-3.5 h-3.5 text-terracotta-500 shrink-0" />
                      <span className="font-mono text-[11px] font-semibold tracking-wide text-espresso-800 dark:text-ivory-200 truncate">
                        {WIDGET_TITLES[widgetId] || widgetId}
                      </span>
                    </div>

                    <div className="flex items-center gap-0.5 shrink-0 opacity-70 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={() => handleMove(idx, idx - 1)}
                        disabled={idx === 0}
                        aria-label="Move widget up"
                        title="Move up"
                        className="p-1 rounded hover:bg-ivory-200 dark:hover:bg-espresso-750 disabled:opacity-20 transition cursor-pointer text-espresso-600 dark:text-espresso-300"
                      >
                        <ChevronUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMove(idx, idx + 1)}
                        disabled={idx === widgetOrder.length - 1}
                        aria-label="Move widget down"
                        title="Move down"
                        className="p-1 rounded hover:bg-ivory-200 dark:hover:bg-espresso-750 disabled:opacity-20 transition cursor-pointer text-espresso-600 dark:text-espresso-300"
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Embedded Widget Card Content */}
                  <div className="flex-1 flex flex-col min-w-0 w-full [&>div]:border-0 [&>div]:rounded-none [&>div]:shadow-none">
                    {renderWidgetComponent(widgetId)}
                  </div>
                </div>
              );
            })}
          </div>
        </CardDensityContext.Provider>
      </section>
    </div>
  );
};
