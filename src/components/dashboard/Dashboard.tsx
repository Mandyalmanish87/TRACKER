import React from 'react';
import { useApp } from '../../context/AppContext';
import { TodayScheduleWidget } from './TodayScheduleWidget';
import { AttendanceGaugeWidget } from './AttendanceGaugeWidget';
import { FocusWidget } from './FocusWidget';
import { GymSplitWidget } from './GymSplitWidget';
import { RemindersWidget } from './RemindersWidget';
import { AcademicCountdownWidget } from './AcademicCountdownWidget';
import { SyllabusSummaryWidget } from './SyllabusSummaryWidget';
import { calculateOverallAttendance } from '../../utils/attendance';
import { Calendar, GraduationCap, Flame, Dumbbell, CheckSquare } from 'lucide-react';

interface DashboardProps {
  onNavigateToSyllabus?: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigateToSyllabus }) => {
  const { state } = useApp();

  const currentHour = new Date().getHours();
  const greeting =
    currentHour < 12
      ? 'Good morning'
      : currentHour < 17
      ? 'Good afternoon'
      : 'Good evening';

  // Profile name (falls back to "Scholar" if not set)
  const displayName = state.profile?.displayName?.trim() || 'Scholar';

  // Compute live overview metrics
  const targetDay = 3; // Wednesday in demo/academic term
  const todayClasses = state.timetable.filter((t) => t.dayOfWeek === targetDay);
  const overall = calculateOverallAttendance(state.subjects, 75);

  const todayStr = new Date().toISOString().split('T')[0];
  const minutesToday = state.studySessions
    .filter((s) => s.timestamp.startsWith(todayStr))
    .reduce((acc, s) => acc + s.durationMinutes, 0);

  const todayWorkout = state.gymWorkouts.find(
    (w) => w.date === todayStr || (w.isSample && state.gymWorkouts.length > 0)
  );

  const pendingReminders = state.reminders.filter((r) => !r.isCompleted).length;

  return (
    <div className="space-y-8 sm:space-y-10 pb-20">
      {/* Editorial Headline & Daily Metrics Ribbon */}
      <section className="space-y-5">
        <div className="border-b border-ivory-300 dark:border-espresso-800 pb-5">
          <p className="text-xs uppercase tracking-widest font-mono font-semibold mb-1.5" style={{ color: 'var(--accent)' }}>
            Personal Daily Operating System
          </p>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
            <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-normal tracking-tight text-espresso-950 dark:text-ivory-50">
              {greeting}, {displayName}.
            </h1>
            <p className="text-xs sm:text-sm italic font-serif text-espresso-500 dark:text-espresso-400 max-w-md">
              "Excellence is not an act, but a habit." — Aristotle
            </p>
          </div>
        </div>

        {/* Academic Countdown — only renders if a target date is configured */}
        <AcademicCountdownWidget />

        {/* Quick Stats Ribbon — Responsive 5-card layout */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5 sm:gap-4">
          {/* Stat 1: Classes Today */}
          <div className="p-4 sm:p-5 rounded-2xl border border-ivory-300 dark:border-espresso-750 bg-white dark:bg-espresso-850 shadow-subtle hover:border-ivory-400 dark:hover:border-espresso-700 transition-colors">
            <div className="flex items-center justify-between text-espresso-500 dark:text-espresso-400 mb-2">
              <span className="text-xs font-semibold uppercase font-mono tracking-wider">Today's Classes</span>
              <Calendar className="w-4 h-4" style={{ color: 'var(--accent)' }} />
            </div>
            <p className="font-serif tabular-nums text-2xl sm:text-3xl font-bold text-espresso-950 dark:text-ivory-50">
              {todayClasses.length}
            </p>
            <p className="text-xs text-espresso-400 dark:text-espresso-500 mt-1 font-medium">Sessions scheduled</p>
          </div>

          {/* Stat 2: Attendance Health */}
          <div className="p-4 sm:p-5 rounded-2xl border border-ivory-300 dark:border-espresso-750 bg-white dark:bg-espresso-850 shadow-subtle hover:border-ivory-400 dark:hover:border-espresso-700 transition-colors">
            <div className="flex items-center justify-between text-espresso-500 dark:text-espresso-400 mb-2">
              <span className="text-xs font-semibold uppercase font-mono tracking-wider">Attendance</span>
              <GraduationCap className="w-4 h-4 text-sage-600 dark:text-sage-400" />
            </div>
            <p className="font-serif tabular-nums text-2xl sm:text-3xl font-bold text-espresso-950 dark:text-ivory-50">
              {overall.formattedPercentage}
            </p>
            <p className="text-xs text-espresso-400 dark:text-espresso-500 mt-1 font-medium">
              {overall.status === 'safe'
                ? 'Above 75% Target'
                : overall.status === 'warning'
                ? 'Threshold Alert'
                : 'Action Required'}
            </p>
          </div>

          {/* Stat 3: Focus Study Time */}
          <div className="p-4 sm:p-5 rounded-2xl border border-ivory-300 dark:border-espresso-750 bg-white dark:bg-espresso-850 shadow-subtle hover:border-ivory-400 dark:hover:border-espresso-700 transition-colors">
            <div className="flex items-center justify-between text-espresso-500 dark:text-espresso-400 mb-2">
              <span className="text-xs font-semibold uppercase font-mono tracking-wider">Deep Focus</span>
              <Flame className="w-4 h-4 text-amber-500 dark:text-amber-400" />
            </div>
            <p className="font-serif tabular-nums text-2xl sm:text-3xl font-bold text-espresso-950 dark:text-ivory-50">
              {minutesToday}m
            </p>
            <p className="text-xs text-espresso-400 dark:text-espresso-500 mt-1 font-medium">Logged study today</p>
          </div>

          {/* Stat 4: Workout Status */}
          <div className="p-4 sm:p-5 rounded-2xl border border-ivory-300 dark:border-espresso-750 bg-white dark:bg-espresso-850 shadow-subtle hover:border-ivory-400 dark:hover:border-espresso-700 transition-colors">
            <div className="flex items-center justify-between text-espresso-500 dark:text-espresso-400 mb-2">
              <span className="text-xs font-semibold uppercase font-mono tracking-wider">Gym Split</span>
              <Dumbbell className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
            </div>
            <p className="font-serif text-xl sm:text-2xl font-bold text-espresso-950 dark:text-ivory-50 truncate">
              {todayWorkout ? (todayWorkout.completed ? 'Done' : 'Active') : 'Rest'}
            </p>
            <p className="text-xs text-espresso-400 dark:text-espresso-500 mt-1 font-medium truncate">
              {todayWorkout?.split.split('(')[0] || 'Recovery day'}
            </p>
          </div>

          {/* Stat 5: Pending Actions */}
          <div className="p-4 sm:p-5 rounded-2xl border border-ivory-300 dark:border-espresso-750 bg-white dark:bg-espresso-850 shadow-subtle hover:border-ivory-400 dark:hover:border-espresso-700 transition-colors col-span-2 sm:col-span-1">
            <div className="flex items-center justify-between text-espresso-500 dark:text-espresso-400 mb-2">
              <span className="text-xs font-semibold uppercase font-mono tracking-wider">Pending Tasks</span>
              <CheckSquare className="w-4 h-4" style={{ color: 'var(--accent)' }} />
            </div>
            <p className="font-serif tabular-nums text-2xl sm:text-3xl font-bold text-espresso-950 dark:text-ivory-50">
              {pendingReminders}
            </p>
            <p className="text-xs text-espresso-400 dark:text-espresso-500 mt-1 font-medium">Action items remaining</p>
          </div>
        </div>
      </section>

      {/* Main Command Center Grid — Flexible Proportional Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)] gap-6 lg:gap-8 items-start">
        {/* Left Column: Schedule, Attendance & Syllabus (Flexible, shrinkable) */}
        <div className="min-w-0 space-y-6 lg:space-y-8">
          <TodayScheduleWidget />
          <AttendanceGaugeWidget />
          <SyllabusSummaryWidget onNavigateToSyllabus={onNavigateToSyllabus} />
        </div>

        {/* Right Column: Focus, Gym & Reminders (Flexible, shrinkable) */}
        <div className="min-w-0 space-y-6 lg:space-y-8">
          <FocusWidget />
          <GymSplitWidget />
          <RemindersWidget />
        </div>
      </div>
    </div>
  );
};
