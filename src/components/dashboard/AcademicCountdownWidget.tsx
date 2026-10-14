import React, { useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { Target, CalendarDays, AlertCircle, CheckCircle2 } from 'lucide-react';

/**
 * Computes full calendar days between today (local midnight) and the target date.
 * Returns null if no date is configured or the string is invalid.
 */
function computeDaysRemaining(examDateStr: string | undefined): number | null {
  if (!examDateStr) return null;
  const target = new Date(examDateStr + 'T00:00:00'); // parse as local midnight
  if (isNaN(target.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffMs = target.getTime() - today.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

export const AcademicCountdownWidget: React.FC = () => {
  const { state } = useApp();

  const settings = state.settings;
  const profile  = state.profile;

  // If the user has hidden the countdown in settings, render nothing
  if (settings && settings.showExamCountdown === false) return null;

  const daysRemaining = useMemo(
    () => computeDaysRemaining(profile?.examDate),
    [profile?.examDate],
  );

  const targetLabel = profile?.targetExam?.trim() || 'Academic Target';
  const hasDate     = daysRemaining !== null;

  /* ── No date configured ── */
  if (!hasDate) {
    return (
      <div className="p-5 rounded-2xl border border-dashed border-ivory-400 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-900/50 flex items-start gap-3">
        <CalendarDays className="w-5 h-5 text-espresso-400 dark:text-espresso-500 mt-0.5 shrink-0" />
        <div>
          <p className="text-xs font-semibold uppercase font-mono tracking-wider text-espresso-500 dark:text-espresso-400">
            Countdown
          </p>
          <p className="text-sm text-espresso-600 dark:text-espresso-300 mt-1">
            Set a <span className="font-semibold">target date</span> in{' '}
            <span className="font-semibold">Settings → Profile</span> to see your countdown here.
          </p>
        </div>
      </div>
    );
  }

  /* ── Past date ── */
  if (daysRemaining < 0) {
    return (
      <div className="p-5 rounded-2xl border border-ivory-300 dark:border-espresso-750 bg-white dark:bg-espresso-850 shadow-subtle flex items-start gap-3">
        <CheckCircle2 className="w-5 h-5 text-sage-500 dark:text-sage-400 mt-0.5 shrink-0" />
        <div>
          <p className="text-xs font-semibold uppercase font-mono tracking-wider text-espresso-500 dark:text-espresso-400">
            {targetLabel}
          </p>
          <p className="text-sm font-medium text-espresso-900 dark:text-ivory-100 mt-0.5">
            Target date has passed — update it in Settings.
          </p>
        </div>
      </div>
    );
  }

  /* ── Today! ── */
  if (daysRemaining === 0) {
    return (
      <div className="p-5 rounded-2xl border border-terracotta-300 dark:border-terracotta-700 bg-terracotta-50 dark:bg-terracotta-900/30 shadow-subtle">
        <p className="text-xs font-semibold uppercase font-mono tracking-wider text-terracotta-600 dark:text-terracotta-400 mb-1">
          🎯 {targetLabel}
        </p>
        <p className="font-serif text-2xl font-bold text-terracotta-700 dark:text-terracotta-300">
          Today is the day!
        </p>
        <p className="text-xs text-terracotta-500 dark:text-terracotta-400 mt-1">
          You've put in the work. Go show what you know.
        </p>
      </div>
    );
  }

  /* ── Urgency tier ── */
  const urgent  = daysRemaining <= 7;
  const warning = daysRemaining <= 30;

  const colorClasses = urgent
    ? 'border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-900/20'
    : warning
    ? 'border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-900/20'
    : 'border-ivory-300 dark:border-espresso-750 bg-white dark:bg-espresso-850';

  const accentColor = urgent
    ? 'text-red-600 dark:text-red-400'
    : warning
    ? 'text-amber-600 dark:text-amber-400'
    : 'text-terracotta-600 dark:text-terracotta-400';

  const numberColor = urgent
    ? 'text-red-700 dark:text-red-300'
    : warning
    ? 'text-amber-700 dark:text-amber-300'
    : 'text-espresso-950 dark:text-ivory-50';

  return (
    <div className={`p-5 rounded-2xl border shadow-subtle ${colorClasses}`}>
      {/* Label row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Target className={`w-4 h-4 ${accentColor}`} />
          <span className={`text-xs font-semibold uppercase font-mono tracking-wider ${accentColor}`}>
            {targetLabel}
          </span>
        </div>
        {urgent && (
          <div className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400 font-medium">
            <AlertCircle className="w-3.5 h-3.5" />
            Final stretch!
          </div>
        )}
      </div>

      {/* Big counter */}
      <div className="flex items-end gap-2">
        <span className={`font-serif tabular-nums text-5xl sm:text-6xl font-bold leading-none ${numberColor}`}>
          {daysRemaining}
        </span>
        <div className="mb-1">
          <p className="text-sm font-semibold text-espresso-700 dark:text-espresso-200 leading-tight">
            {daysRemaining === 1 ? 'day' : 'days'}
          </p>
          <p className="text-xs text-espresso-400 dark:text-espresso-500">remaining</p>
        </div>
      </div>

      {/* Date display */}
      {profile?.examDate && (
        <p className="text-xs text-espresso-400 dark:text-espresso-500 mt-3 flex items-center gap-1.5">
          <CalendarDays className="w-3.5 h-3.5" />
          {new Date(profile.examDate + 'T00:00:00').toLocaleDateString('en-US', {
            weekday: 'long',
            month:   'long',
            day:     'numeric',
            year:    'numeric',
          })}
        </p>
      )}
    </div>
  );
};
