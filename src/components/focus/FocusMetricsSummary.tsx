import React from 'react';
import { FocusSummaryMetrics, StudyStreakMetrics } from '../../utils/focusAnalytics';
import { Clock, Flame, Award, BarChart2, CheckCircle2, TrendingUp } from 'lucide-react';

interface FocusMetricsSummaryProps {
  summary: FocusSummaryMetrics;
  streaks: StudyStreakMetrics;
}

export const FocusMetricsSummary: React.FC<FocusMetricsSummaryProps> = ({ summary, streaks }) => {
  const formatHoursMinutes = (mins: number): string => {
    if (mins === 0) return '0m';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5 sm:gap-4">
      {/* 1. Today's Focus */}
      <div className="p-4 rounded-2xl border border-ivory-300 dark:border-espresso-750 bg-white dark:bg-espresso-850 shadow-subtle">
        <div className="flex items-center justify-between text-espresso-500 dark:text-espresso-400 mb-1.5">
          <span className="text-[11px] font-semibold uppercase font-mono tracking-wider">Today</span>
          <Clock className="w-4 h-4" style={{ color: 'var(--accent)' }} />
        </div>
        <p className="font-serif tabular-nums text-2xl sm:text-3xl font-bold text-espresso-950 dark:text-ivory-50">
          {formatHoursMinutes(summary.todayMinutes)}
        </p>
        <p className="text-[11px] text-espresso-400 dark:text-espresso-500 mt-1 font-medium">
          {summary.todayMinutes > 0 ? 'Active study logged' : 'No sessions today'}
        </p>
      </div>

      {/* 2. Last 7 Days Total */}
      <div className="p-4 rounded-2xl border border-ivory-300 dark:border-espresso-750 bg-white dark:bg-espresso-850 shadow-subtle">
        <div className="flex items-center justify-between text-espresso-500 dark:text-espresso-400 mb-1.5">
          <span className="text-[11px] font-semibold uppercase font-mono tracking-wider">7-Day Total</span>
          <TrendingUp className="w-4 h-4 text-sage-600 dark:text-sage-400" />
        </div>
        <p className="font-serif tabular-nums text-2xl sm:text-3xl font-bold text-espresso-950 dark:text-ivory-50">
          {formatHoursMinutes(summary.last7DaysMinutes)}
        </p>
        <p className="text-[11px] text-espresso-400 dark:text-espresso-500 mt-1 font-medium">
          {summary.completedSessions7d} completed blocks
        </p>
      </div>

      {/* 3. Current Study Streak */}
      <div className="p-4 rounded-2xl border border-ivory-300 dark:border-espresso-750 bg-white dark:bg-espresso-850 shadow-subtle">
        <div className="flex items-center justify-between text-espresso-500 dark:text-espresso-400 mb-1.5">
          <span className="text-[11px] font-semibold uppercase font-mono tracking-wider">Current Streak</span>
          <Flame
            className={`w-4 h-4 ${
              streaks.currentStreak > 0
                ? 'text-amber-500 dark:text-amber-400 fill-amber-500/20'
                : 'text-espresso-400'
            }`}
          />
        </div>
        <p className="font-serif tabular-nums text-2xl sm:text-3xl font-bold text-espresso-950 dark:text-ivory-50">
          {streaks.currentStreak} {streaks.currentStreak === 1 ? 'day' : 'days'}
        </p>
        <p className="text-[11px] text-espresso-400 dark:text-espresso-500 mt-1 font-medium">
          {streaks.hasStudiedToday ? 'Extended today!' : 'Pending today session'}
        </p>
      </div>

      {/* 4. Longest Streak */}
      <div className="p-4 rounded-2xl border border-ivory-300 dark:border-espresso-750 bg-white dark:bg-espresso-850 shadow-subtle">
        <div className="flex items-center justify-between text-espresso-500 dark:text-espresso-400 mb-1.5">
          <span className="text-[11px] font-semibold uppercase font-mono tracking-wider">Longest Streak</span>
          <Award className="w-4 h-4 text-ochre-600 dark:text-ochre-400" />
        </div>
        <p className="font-serif tabular-nums text-2xl sm:text-3xl font-bold text-espresso-950 dark:text-ivory-50">
          {streaks.longestStreak} {streaks.longestStreak === 1 ? 'day' : 'days'}
        </p>
        <p className="text-[11px] text-espresso-400 dark:text-espresso-500 mt-1 font-medium">
          Personal record
        </p>
      </div>

      {/* 5. 7-Day Rolling Daily Average */}
      <div className="p-4 rounded-2xl border border-ivory-300 dark:border-espresso-750 bg-white dark:bg-espresso-850 shadow-subtle">
        <div className="flex items-center justify-between text-espresso-500 dark:text-espresso-400 mb-1.5">
          <span className="text-[11px] font-semibold uppercase font-mono tracking-wider">Daily Avg</span>
          <BarChart2 className="w-4 h-4 text-dusty-blue-600 dark:text-dusty-blue-400" />
        </div>
        <p className="font-serif tabular-nums text-2xl sm:text-3xl font-bold text-espresso-950 dark:text-ivory-50">
          {summary.dailyRollingAverage7d}m
        </p>
        <p className="text-[11px] text-espresso-400 dark:text-espresso-500 mt-1 font-medium">
          Per day (7-day window)
        </p>
      </div>

      {/* 6. All-Time Completed Blocks & Avg Duration */}
      <div className="p-4 rounded-2xl border border-ivory-300 dark:border-espresso-750 bg-white dark:bg-espresso-850 shadow-subtle">
        <div className="flex items-center justify-between text-espresso-500 dark:text-espresso-400 mb-1.5">
          <span className="text-[11px] font-semibold uppercase font-mono tracking-wider">Sessions</span>
          <CheckCircle2 className="w-4 h-4 text-sage-600 dark:text-sage-400" />
        </div>
        <p className="font-serif tabular-nums text-2xl sm:text-3xl font-bold text-espresso-950 dark:text-ivory-50">
          {summary.totalCompletedSessions}
        </p>
        <p className="text-[11px] text-espresso-400 dark:text-espresso-500 mt-1 font-medium">
          Avg: {summary.averageSessionMinutes}m (Max {summary.longestSessionMinutes}m)
        </p>
      </div>
    </div>
  );
};
