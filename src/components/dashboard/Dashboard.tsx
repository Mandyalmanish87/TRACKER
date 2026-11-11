import React, { useState, useEffect, useMemo, useRef } from 'react';
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
import { DayOSSummaryWidget } from './DayOSSummaryWidget';
import { ReadinessScoreWidget } from './fitness/ReadinessScoreWidget';
import { HydrationWidget } from './fitness/HydrationWidget';
import { MacroRingsWidget } from './fitness/MacroRingsWidget';
import { RecentPRsWidget } from './fitness/RecentPRsWidget';
import { BodyCompositionWidget } from './fitness/BodyCompositionWidget';
import { DashboardWeather } from './DashboardWeather';
import { calculateOverallAttendance } from '../../utils/attendance';
import { calculateFocusSummaries, calculateStudyStreaks } from '../../utils/focusAnalytics';
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
  Sparkles,
} from 'lucide-react';
import { NavTab } from '../common/Navigation';
import { TiltCard } from '../common/TiltCard';
import { CardDensityContext } from '../common/Card';

export const DEFAULT_DASHBOARD_WIDGET_ORDER = [
  'dayos_summary',
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

const MOTIVATIONAL_QUOTES = [
  'Do the next useful thing. Then do it again.',
  'Discipline carries you when motivation wanders.',
  'Small steps, repeated, become momentum.',
  'Focus is a choice you can make again.',
  'Consistency is quiet progress made visible.',
  'Begin where you are. Make this hour count.',
  'A little progress today is still progress.',
  'Keep your promises to the person you are becoming.',
];

const WIDGET_TITLES: Record<string, string> = {
  dayos_summary: 'DayOS Daily Briefing',
  today_schedule: "Today's Timetable",
  attendance: 'Attendance Health',
  focus_timer: 'Deep Focus Timer',
  journey_heatmap: 'Focus Journey Heatmap',
  focus_radio: 'Focus Radio',
  events_tasks: 'Events & Tasks',
  planner: 'Study Planner',
  nutrition: 'Nutrition & Macros',
  gym: 'Gym Workout Split',
  readiness: 'Daily Readiness Index',
  hydration: 'Hydration Tracker',
  macro_rings: 'Macro Targets & Calorie Rings',
  prs: 'Recent Strength PRs',
  body_composition: 'Body Composition & Navy BF',
  syllabus: 'Syllabus Tracker',
  tests: 'Tests & Error Analytics',
};

interface DashboardProps {
  onNavigateToSyllabus?: () => void;
  onNavigateToFocus?: () => void;
  onNavigateToPlanner?: () => void;
  onNavigateToNutrition?: () => void;
  onNavigateToTests?: () => void;
  onNavigateToDayOS?: () => void;
  onSelectTab?: (tab: NavTab) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  onNavigateToSyllabus,
  onNavigateToFocus,
  onNavigateToPlanner,
  onNavigateToNutrition,
  onNavigateToTests,
  onNavigateToDayOS,
  onSelectTab: _onSelectTab,
}) => {
  const { state, updateSettings } = useApp();

  // Profile name
  const displayName = state.profile?.displayName?.trim() || 'Scholar';
  const [motivationalQuote] = useState(() => MOTIVATIONAL_QUOTES[Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length)]);

  // Drag and drop state
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const dashboardGridRef = useRef<HTMLDivElement>(null);

  const [layoutAnnouncement, setLayoutAnnouncement] = useState('');

  // Compute live overview metrics
  const targetDay = 3; // Wednesday in demo/academic term
  const todayClasses = state.timetable.filter((t) => t.dayOfWeek === targetDay);
  const overall = calculateOverallAttendance(state.subjects, 75);

  const todayStr = new Date().toISOString().split('T')[0];
  const minutesToday = Math.round(calculateFocusSummaries(
    state.studySessions,
    new Date(),
    state.settings?.studyDayRolloverHour ?? 0
  ).todayMinutes);

  const focusStreaks = calculateStudyStreaks(
    state.studySessions,
    new Date(),
    state.settings?.studyDayRolloverHour ?? 0
  );

  const todayWorkout = state.gymWorkouts.find(
    (w) => w.date === todayStr && !w.isSample
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

  // Filter visible widgets according to single source of truth in state.settings?.dashboardWidgetVisibility
  const visibleWidgets = useMemo(() => {
    const visibility = state.settings?.dashboardWidgetVisibility;
    return widgetOrder.filter((id) => {
      if (visibility && typeof visibility[id] === 'boolean') {
        return visibility[id];
      }
      return true; // Default all widgets in command center to visible
    });
  }, [widgetOrder, state.settings?.dashboardWidgetVisibility]);

  // Pack cards to their measured content height. This keeps the dashboard's
  // bento layout tight instead of leaving large empty grid-row pockets.
  useEffect(() => {
    const grid = dashboardGridRef.current;
    if (!grid || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver((entries) => {
      const styles = window.getComputedStyle(grid);
      const rowSize = Math.max(1, Number.parseFloat(styles.gridAutoRows) || 1);
      const rowGap = Number.parseFloat(styles.rowGap) || 0;
      const step = rowSize + rowGap;
      for (const entry of entries) {
        const card = entry.target as HTMLElement;
        const height = entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height;
        const span = Math.max(1, Math.ceil((height + rowGap) / step));
        card.style.setProperty('--dashboard-row-span', String(span));
      }
    });

    Array.from(grid.children).forEach((card) => observer.observe(card));
    return () => observer.disconnect();
  }, [visibleWidgets]);

  const isExamCountdownVisible = useMemo(() => {
    const visibility = state.settings?.dashboardWidgetVisibility;
    if (visibility && typeof visibility.academic_countdown === 'boolean') {
      return visibility.academic_countdown;
    }
    return state.settings?.showExamCountdown ?? true;
  }, [state.settings?.dashboardWidgetVisibility, state.settings?.showExamCountdown]);

  const isKpiStripVisible = useMemo(() => {
    const visibility = state.settings?.dashboardWidgetVisibility;
    if (visibility && typeof visibility.kpi_strip === 'boolean') {
      return visibility.kpi_strip;
    }
    return true;
  }, [state.settings?.dashboardWidgetVisibility]);

  const handleDragStart = (e: React.DragEvent, widgetId: string) => {
    e.dataTransfer.setData('text/plain', widgetId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggingId(widgetId);
    setLayoutAnnouncement('Picked up ' + (WIDGET_TITLES[widgetId] || widgetId) + '.');
  };

  const handleDragOver = (e: React.DragEvent, widgetId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverId !== widgetId) {
      setDragOverId(widgetId);
    }
  };

  const handleDrop = (e: React.DragEvent, targetWidgetId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const sourceWidgetId = e.dataTransfer.getData('text/plain');

    setDraggingId(null);
    setDragOverId(null);

    if (!sourceWidgetId || sourceWidgetId === targetWidgetId) return;

    const sourceIndex = visibleWidgets.indexOf(sourceWidgetId);
    const targetIndex = visibleWidgets.indexOf(targetWidgetId);
    if (sourceIndex === -1 || targetIndex === -1) return;

    const newOrder = [...visibleWidgets];
    const [moved] = newOrder.splice(sourceIndex, 1);
    newOrder.splice(targetIndex, 0, moved);
    saveVisibleWidgetOrder(newOrder);
    setLayoutAnnouncement((WIDGET_TITLES[sourceWidgetId] || sourceWidgetId) + ' moved to position ' + (targetIndex + 1) + ' of ' + visibleWidgets.length + '.');
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setDragOverId(null);
  };

  const handleMove = (widgetId: string, direction: 'up' | 'down') => {
    const fromIndex = visibleWidgets.indexOf(widgetId);
    if (fromIndex === -1) return;
    const toIndex = direction === 'up' ? fromIndex - 1 : fromIndex + 1;
    if (toIndex < 0 || toIndex >= visibleWidgets.length) return;

    const newOrder = [...visibleWidgets];
    const [moved] = newOrder.splice(fromIndex, 1);
    newOrder.splice(toIndex, 0, moved);
    saveVisibleWidgetOrder(newOrder);
    setLayoutAnnouncement((WIDGET_TITLES[widgetId] || widgetId) + ' moved to position ' + (toIndex + 1) + ' of ' + visibleWidgets.length + '.');
  };

  const saveVisibleWidgetOrder = (newVisibleOrder: string[]) => {
    const visibleSet = new Set(visibleWidgets);
    let visibleIndex = 0;
    const fullOrder = widgetOrder.map((id) => visibleSet.has(id) ? newVisibleOrder[visibleIndex++] : id);
    updateSettings({ dashboardWidgetOrder: fullOrder });
  };

  const handleResetLayout = () => {
    updateSettings({
      dashboardWidgetOrder: DEFAULT_DASHBOARD_WIDGET_ORDER,
    });
    setLayoutAnnouncement('Dashboard widget order reset to the default layout.');
  };

  const renderWidgetComponent = (widgetId: string) => {
    switch (widgetId) {
      case 'dayos_summary':
        return <DayOSSummaryWidget onNavigateToDayOS={onNavigateToDayOS || (() => _onSelectTab?.('dayos'))} />;
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
      case 'readiness':
        return <ReadinessScoreWidget />;
      case 'hydration':
        return <HydrationWidget />;
      case 'macro_rings':
        return <MacroRingsWidget />;
      case 'prs':
        return <RecentPRsWidget />;
      case 'body_composition':
        return <BodyCompositionWidget />;
      case 'syllabus':
        return <SyllabusSummaryWidget onNavigateToSyllabus={onNavigateToSyllabus} />;
      case 'tests':
        return <TestSummaryWidget onNavigateToTests={onNavigateToTests} />;
      default:
        return null;
    }
  };

  const nowMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
  const dayProgressPct = Math.round((nowMinutes / 1440) * 100);

  return (
    <div className="tracker-dashboard space-y-8 pb-20">
      {/* Screen reader announcement for widget drag/reorder */}
      <div className="sr-only" aria-live="polite" role="status">
        {layoutAnnouncement}
      </div>

      {/* ── 1. SPATIAL HERO BRIEFING & FOCUS LAUNCHER ──────────────────── */}
      <div className="tracker-aurora-hero p-5 sm:p-7 lg:p-8 rounded-3xl border border-ivory-300/80 dark:border-white/10 bg-white/80 dark:bg-[#14121A]/80 backdrop-blur-xl [box-shadow:inset_0_1px_0_0_rgba(255,255,255,0.85),0_12px_36px_-6px_rgba(0,0,0,0.06)] dark:[box-shadow:inset_0_1px_0_0_rgba(255,255,255,0.12),0_20px_50px_-8px_rgba(0,0,0,0.55)] transition-all duration-300">
        <div className="dashboard-hero-layout">
          <div className="space-y-2 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="dashboard-daily-kicker inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10.5px] font-mono font-semibold tracking-wider uppercase">
                <span className="dashboard-daily-kicker-dot w-1.5 h-1.5 rounded-full" />
                DAILY OVERVIEW
              </span>
              <span className="text-[11px] font-mono text-espresso-400 dark:text-espresso-500 hidden sm:inline">
                · {dayProgressPct}% of your day
              </span>
            </div>

            <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-normal text-espresso-950 dark:text-ivory-50 tracking-tight">
              {greeting}, {displayName}.
            </h1>

            <p className="text-xs sm:text-sm font-serif italic text-espresso-600 dark:text-espresso-300">
              {`“${motivationalQuote}”`}
            </p>

            {/* Subtle Day Progress Indicator */}
            <div className="pt-2 flex items-center gap-3 max-w-md">
              <div className="flex-1 bg-ivory-200 dark:bg-white/10 h-1.5 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${dayProgressPct}%`,
                    backgroundColor: 'var(--accent)',
                  }}
                />
              </div>
              <span className="text-[10px] font-mono tabular-nums text-espresso-400 dark:text-espresso-500 shrink-0">
                {timeFormatted.time} {timeFormatted.ampm}
              </span>
            </div>
          </div>

          <DashboardWeather />

          <div className="dashboard-hero-actions flex flex-wrap items-center gap-3 shrink-0">
            {onNavigateToDayOS && (
              <button
                onClick={onNavigateToDayOS}
                className="px-4 py-2.5 rounded-2xl text-xs font-semibold border border-ivory-300/80 dark:border-white/10 bg-white/90 dark:bg-white/[0.05] hover:bg-white dark:hover:bg-white/[0.1] text-espresso-800 dark:text-ivory-100 transition shadow-xs cursor-pointer flex items-center gap-2 group"
              >
                <Sparkles className="w-4 h-4 text-amber-500 group-hover:rotate-12 transition-transform" />
                <span>Day Planner</span>
              </button>
            )}
            {onNavigateToFocus && (
              <button
                onClick={onNavigateToFocus}
                className="px-5 py-2.5 rounded-2xl text-xs font-semibold text-white shadow-subtle flex items-center gap-2 transition hover:opacity-95 active:scale-[0.98] cursor-pointer"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                <Flame className="w-4 h-4" />
                <span>Start Focus Session</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── 2. ACADEMIC COUNTDOWN & KPI STRIP ─────────────────────── */}
      {(isExamCountdownVisible || isKpiStripVisible) && (
        <section className="space-y-6">
          {isExamCountdownVisible && <AcademicCountdownWidget />}

          {isKpiStripVisible && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5 sm:gap-4">
          {/* Stat 0: Current Time */}
          <TiltCard maxTilt={6} scale={1.015}>
            <div className="tracker-kpi-card p-4 sm:p-5 rounded-2xl border border-ivory-300/80 dark:border-white/10 bg-white/95 dark:bg-[#18151D]/90 [box-shadow:inset_0_1px_0_0_rgba(255,255,255,0.7),0_1px_3px_0_rgba(0,0,0,0.02)] dark:[box-shadow:inset_0_1px_0_0_rgba(255,255,255,0.08),0_8px_24px_-4px_rgba(0,0,0,0.4)] shadow-subtle h-full flex flex-col justify-between transition-all">
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
          <TiltCard maxTilt={6} scale={1.015}>
            <div className="tracker-kpi-card p-4 sm:p-5 rounded-2xl border border-ivory-300/80 dark:border-white/10 bg-white/95 dark:bg-[#18151D]/90 [box-shadow:inset_0_1px_0_0_rgba(255,255,255,0.7),0_1px_3px_0_rgba(0,0,0,0.02)] dark:[box-shadow:inset_0_1px_0_0_rgba(255,255,255,0.08),0_8px_24px_-4px_rgba(0,0,0,0.4)] shadow-subtle h-full flex flex-col justify-between transition-all">
              <div className="flex items-center justify-between text-espresso-500 dark:text-espresso-400 mb-2">
                <span className="text-[11px] font-mono font-semibold uppercase tracking-wider">Classes Today</span>
                <div className="p-1.5 rounded-lg bg-ivory-100 dark:bg-white/[0.05]">
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
          <TiltCard maxTilt={6} scale={1.015}>
            <div className="tracker-kpi-card p-4 sm:p-5 rounded-2xl border border-ivory-300/80 dark:border-white/10 bg-white/95 dark:bg-[#18151D]/90 [box-shadow:inset_0_1px_0_0_rgba(255,255,255,0.7),0_1px_3px_0_rgba(0,0,0,0.02)] dark:[box-shadow:inset_0_1px_0_0_rgba(255,255,255,0.08),0_8px_24px_-4px_rgba(0,0,0,0.4)] shadow-subtle h-full flex flex-col justify-between transition-all">
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
          <TiltCard maxTilt={6} scale={1.015}>
            <div className="tracker-kpi-card p-4 sm:p-5 rounded-2xl border border-ivory-300/80 dark:border-white/10 bg-white/95 dark:bg-[#18151D]/90 [box-shadow:inset_0_1px_0_0_rgba(255,255,255,0.7),0_1px_3px_0_rgba(0,0,0,0.02)] dark:[box-shadow:inset_0_1px_0_0_rgba(255,255,255,0.08),0_8px_24px_-4px_rgba(0,0,0,0.4)] shadow-subtle h-full flex flex-col justify-between transition-all">
              <div className="flex items-center justify-between text-espresso-500 dark:text-espresso-400 mb-2">
                <span className="text-[11px] font-mono font-semibold uppercase tracking-wider">Deep Focus</span>
                <div className="p-1.5 rounded-lg bg-ochre-50 dark:bg-ochre-900/30">
                  <Flame className="w-3.5 h-3.5 text-ochre-600 dark:text-ochre-400" />
                </div>
              </div>
              <p className="min-w-0 truncate font-serif tabular-nums text-xl sm:text-2xl lg:text-3xl font-bold text-espresso-950 dark:text-ivory-50">
                <AnimatedCounter value={minutesToday} suffix="m" />
              </p>
              <p className="text-xs text-espresso-500 dark:text-espresso-400 mt-1">
                {focusStreaks.currentStreak > 0 ? `${focusStreaks.currentStreak}d Streak` : 'Logged Study'}
              </p>
            </div>
          </TiltCard>

          {/* Stat 4: Workout Status */}
          <TiltCard maxTilt={6} scale={1.015}>
            <div className="tracker-kpi-card p-4 sm:p-5 rounded-2xl border border-ivory-300/80 dark:border-white/10 bg-white/95 dark:bg-[#18151D]/90 [box-shadow:inset_0_1px_0_0_rgba(255,255,255,0.7),0_1px_3px_0_rgba(0,0,0,0.02)] dark:[box-shadow:inset_0_1px_0_0_rgba(255,255,255,0.08),0_8px_24px_-4px_rgba(0,0,0,0.4)] shadow-subtle h-full flex flex-col justify-between transition-all">
              <div className="flex items-center justify-between text-espresso-500 dark:text-espresso-400 mb-2">
                <span className="text-[11px] font-mono font-semibold uppercase tracking-wider">
                  Workouts
                  <span className="sr-only">Gym Split</span>
                </span>
                <div className="p-1.5 rounded-lg bg-ivory-100 dark:bg-white/[0.05]">
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
          <TiltCard maxTilt={6} scale={1.015}>
            <div className="p-4 sm:p-5 rounded-2xl border border-ivory-300/80 dark:border-white/10 bg-white/95 dark:bg-[#18151D]/90 [box-shadow:inset_0_1px_0_0_rgba(255,255,255,0.7),0_1px_3px_0_rgba(0,0,0,0.02)] dark:[box-shadow:inset_0_1px_0_0_rgba(255,255,255,0.08),0_8px_24px_-4px_rgba(0,0,0,0.4)] shadow-subtle h-full flex flex-col justify-between transition-all">
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
          )}
        </section>
      )}

      {/* ── 3. REARRANGEABLE COMMAND CENTER WIDGETS ────────────────── */}
      <section className="dashboard-command-center space-y-4" aria-labelledby="command-center-title">
        {/* Header with Title and Reset Layout */}
        <div className="dashboard-command-heading flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="dashboard-command-eyebrow font-mono text-xs font-semibold uppercase tracking-wider text-terracotta-600 dark:text-terracotta-400">
              Your daily workspace
            </span>
            <h2 id="command-center-title" className="font-serif text-2xl sm:text-3xl font-normal text-espresso-950 dark:text-ivory-50 tracking-tight mt-0.5">
              Active Command Center
            </h2>
            <p className="text-xs text-espresso-500 dark:text-espresso-400 mt-0.5">
              {visibleWidgets.length} widgets · Drag to arrange, or use the move buttons
            </p>
          </div>

          <div className="dashboard-command-actions flex items-center gap-2">
            <button
              type="button"
              onClick={handleResetLayout}
              aria-label="Reset layout"
              className="dashboard-reset-layout text-xs px-3 py-1.5 rounded-xl border border-ivory-300 dark:border-espresso-750 bg-white dark:bg-espresso-850 hover:bg-ivory-100 dark:hover:bg-espresso-800 text-espresso-700 dark:text-ivory-200 flex items-center gap-1.5 font-medium shadow-xs transition cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-terracotta-500" />
              <span>Reset Layout</span>
            </button>
          </div>
        </div>

        <CardDensityContext.Provider value={{ density: 'compact', borderless: false }}>
          {visibleWidgets.length === 0 ? (
            <div className="p-8 text-center rounded-2xl border border-dashed border-ivory-400 dark:border-espresso-700 bg-ivory-50/50 dark:bg-espresso-900/30">
              <p className="text-sm font-medium text-espresso-700 dark:text-ivory-200">
                All command center widgets are currently hidden.
              </p>
              <p className="text-xs text-espresso-500 dark:text-espresso-400 mt-1">
                You can re-enable widgets anytime in Settings → Dashboard Control System.
              </p>
            </div>
          ) : (
            <div ref={dashboardGridRef} className="dashboard-command-grid" role="list" aria-label="Active dashboard widgets">
              {visibleWidgets.map((widgetId) => {
                const isDragging = draggingId === widgetId;
                const isOver = dragOverId === widgetId;
                const currentIndexInVisible = visibleWidgets.indexOf(widgetId);

                return (
                  <div
                    key={widgetId}
                    onDragOver={(e) => handleDragOver(e, widgetId)}
                    onDrop={(e) => handleDrop(e, widgetId)}
                    onDragEnter={() => { if (draggingId) setDragOverId(widgetId); }}
                    role="listitem"
                    aria-label={`${WIDGET_TITLES[widgetId] || widgetId}, position ${currentIndexInVisible + 1} of ${visibleWidgets.length}`}
                    className={`dashboard-widget-card break-inside-avoid rounded-2xl border border-ivory-300/80 dark:border-white/10 bg-white/95 dark:bg-[#18151D]/90 overflow-hidden shadow-subtle mb-4 flex flex-col transition-all duration-200 relative group [box-shadow:inset_0_1px_0_0_rgba(255,255,255,0.7),0_1px_3px_0_rgba(0,0,0,0.02)] dark:[box-shadow:inset_0_1px_0_0_rgba(255,255,255,0.08),0_8px_24px_-4px_rgba(0,0,0,0.4)] ${
                      isOver ? 'dashboard-widget-drop-target' : ''
                    } ${isDragging ? 'opacity-40' : ''}`}
                    data-widget-id={widgetId}
                  >
                    {/* Sleek Integrated Drag Header */}
                    <div className="dashboard-widget-heading flex items-center justify-between px-3.5 py-1.5 border-b border-ivory-200/80 dark:border-white/10 bg-ivory-50/80 dark:bg-white/[0.03] select-none shrink-0 text-xs">
                      <div
                        draggable
                        onDragStart={(e) => handleDragStart(e, widgetId)}
                        onDragEnd={handleDragEnd}
                        className="dashboard-widget-drag-handle flex items-center gap-1.5 cursor-grab active:cursor-grabbing hover:text-espresso-950 dark:hover:text-ivory-50 transition py-0.5 px-1 rounded -ml-1"
                        title="Drag this widget to rearrange"
                      >
                        <GripVertical className="w-3.5 h-3.5 text-terracotta-500 shrink-0" />
                        <span className="font-mono text-[11px] font-semibold tracking-wide text-espresso-800 dark:text-ivory-200 truncate">
                          {WIDGET_TITLES[widgetId] || widgetId}
                        </span>
                      </div>

                      <div className="dashboard-widget-move-controls flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleMove(widgetId, 'up')}
                          disabled={currentIndexInVisible === 0}
                          aria-label="Move widget up"
                          title={'Move up to position ' + Math.max(1, currentIndexInVisible)}
                          className="p-1 rounded hover:bg-ivory-200 dark:hover:bg-espresso-750 disabled:opacity-20 transition cursor-pointer text-espresso-600 dark:text-espresso-300"
                        >
                          <ChevronUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMove(widgetId, 'down')}
                          disabled={currentIndexInVisible === visibleWidgets.length - 1}
                          aria-label="Move widget down"
                          title={'Move down to position ' + Math.min(visibleWidgets.length, currentIndexInVisible + 2)}
                          className="p-1 rounded hover:bg-ivory-200 dark:hover:bg-espresso-750 disabled:opacity-20 transition cursor-pointer text-espresso-600 dark:text-espresso-300"
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Embedded Widget Card Content */}
                    <div className="dashboard-widget-content flex-1 flex flex-col min-w-0 w-full [&>div]:border-0 [&>div]:rounded-none [&>div]:shadow-none">
                      {renderWidgetComponent(widgetId)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardDensityContext.Provider>
      </section>
    </div>
  );
};
