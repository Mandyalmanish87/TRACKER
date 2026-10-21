import React from 'react';
import { useApp } from '../../context/AppContext';
import { TodayScheduleWidget } from './TodayScheduleWidget';
import { AttendanceGaugeWidget } from './AttendanceGaugeWidget';
import { FocusWidget } from './FocusWidget';
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
import { Calendar, GraduationCap, Flame, Dumbbell, CheckSquare } from 'lucide-react';
import { NavTab } from '../common/Navigation';
import { TiltCard } from '../common/TiltCard';

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
  const { state } = useApp();

  // Profile name
  const displayName = state.profile?.displayName?.trim() || 'Scholar';

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

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

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
              className="px-4 py-2 rounded-xl text-xs font-semibold text-white shadow-subtle flex items-center gap-2 transition hover:opacity-95"
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
        {/* Academic Countdown — only renders if a target date is configured */}
        <AcademicCountdownWidget />

        {/* Quick Stats Ribbon — 3D Tilt Numbered Cards with Specular Glare */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5 sm:gap-4">
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
          <TiltCard maxTilt={8} scale={1.02} className="col-span-2 sm:col-span-1">
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

      {/* ── 3. MAIN COMMAND CENTER WIDGETS ────────────────────────── */}
      <section className="space-y-6">
        <div className="flex items-center justify-between pb-3 border-b border-ivory-300 dark:border-espresso-800">
          <div>
            <span className="font-mono text-xs font-semibold uppercase tracking-wider text-terracotta-600 dark:text-terracotta-400">
              Daily Operations
            </span>
            <h2 className="font-serif text-2xl sm:text-3xl font-normal text-espresso-950 dark:text-ivory-50 tracking-tight">
              Active Command Center
            </h2>
          </div>
          <span className="font-serif italic text-xs text-espresso-400 dark:text-espresso-500">
            Live Functional Grid
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)] gap-6 lg:gap-8 items-start">
          {/* Left Column: Schedule, Attendance & Syllabus */}
          <div className="min-w-0 space-y-6 lg:space-y-8">
            <TodayScheduleWidget />
            <AttendanceGaugeWidget />
            <SyllabusSummaryWidget onNavigateToSyllabus={onNavigateToSyllabus} />
            <TestSummaryWidget onNavigateToTests={onNavigateToTests} />
          </div>

          {/* Right Column: Planner, Focus, Gym & Reminders */}
          <div className="min-w-0 space-y-6 lg:space-y-8">
            <PlannerSummaryWidget onNavigateToPlanner={onNavigateToPlanner} />
            <FitnessSummaryWidget onNavigateToNutrition={onNavigateToNutrition} />
            <FocusWidget onNavigateToFocus={onNavigateToFocus} showExtendedAnalyticsLink={Boolean(onNavigateToFocus)} />
            <GymSplitWidget />
            <RemindersWidget />
          </div>
        </div>
      </section>
    </div>
  );
};
