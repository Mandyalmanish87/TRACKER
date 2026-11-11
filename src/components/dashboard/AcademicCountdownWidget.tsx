import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Target, CalendarDays, AlertCircle, CheckCircle2 } from 'lucide-react';

const DAY_MS = 24 * 60 * 60 * 1000;

function parseLocalDate(dateString: string | undefined): Date | null {
  if (!dateString) return null;
  const match = dateString.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return date.getFullYear() === Number(match[1]) && date.getMonth() === Number(match[2]) - 1 && date.getDate() === Number(match[3])
    ? date
    : null;
}

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function calendarDayNumber(date: Date): number {
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS);
}

function formatTargetDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export const AcademicCountdownWidget: React.FC = () => {
  const { state } = useApp();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  const settings = state.settings;
  const profile = state.profile;

  if (settings && settings.showExamCountdown === false) return null;

  const targetDate = parseLocalDate(profile?.examDate);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const daysRemaining = targetDate ? calendarDayNumber(targetDate) - calendarDayNumber(today) : null;
  const targetLabel = profile?.targetExam?.trim() || 'Academic Target';

  const timelineDays = useMemo(() => {
    if (!targetDate || daysRemaining === null) return [];
    const start = daysRemaining >= 0 ? today : targetDate;
    const end = daysRemaining >= 0 ? targetDate : today;
    const days: Date[] = [];
    const cursor = new Date(start);
    while (cursor <= end) {
      days.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    return days;
  }, [profile?.examDate, daysRemaining, now]);

  if (!targetDate || daysRemaining === null) {
    return (
      <div className="p-5 rounded-2xl border border-dashed border-ivory-400 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-900/50 flex items-start gap-3">
        <CalendarDays className="w-5 h-5 text-espresso-400 dark:text-espresso-500 mt-0.5 shrink-0" aria-hidden="true" />
        <div>
          <p className="text-xs font-semibold uppercase font-mono tracking-wider text-espresso-500 dark:text-espresso-400">Countdown</p>
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
        <CheckCircle2 className="w-5 h-5 text-sage-500 dark:text-sage-400 mt-0.5 shrink-0" aria-hidden="true" />
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

  const urgent = daysRemaining >= 0 && daysRemaining <= 7;
  const warning = daysRemaining > 7 && daysRemaining <= 30;
  const bannerTone = urgent
    ? 'border-red-300/70 dark:border-red-900/60 bg-red-50 dark:bg-red-950/35'
    : warning
    ? 'border-amber-300/70 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30'
    : 'border-ivory-300 dark:border-espresso-750 bg-white dark:bg-espresso-850';
  const countTone = urgent
    ? 'text-red-700 dark:text-red-300'
    : warning
    ? 'text-amber-700 dark:text-amber-300'
    : 'text-espresso-950 dark:text-ivory-50';
  const labelTone = urgent
    ? 'text-red-700 dark:text-red-300'
    : warning
    ? 'text-amber-700 dark:text-amber-300'
    : 'text-terracotta-600 dark:text-terracotta-400';
  const examKey = dateKey(targetDate);
  const todayKey = dateKey(today);

  return (
    <section className={`academic-countdown-banner rounded-2xl border shadow-subtle p-4 sm:p-5 ${bannerTone}`} aria-label={`${targetLabel} countdown`}>
      <div className="flex flex-col gap-5 md:flex-row md:items-center md:gap-6">
        <div className="min-w-0 md:w-[190px] md:shrink-0 md:border-r md:border-[var(--border)] md:pr-5">
          <div className="flex items-center gap-2">
            <Target className={`w-4 h-4 shrink-0 ${labelTone}`} aria-hidden="true" />
            <span className={`truncate text-xs font-semibold uppercase font-mono tracking-wider ${labelTone}`} title={targetLabel}>
              {targetLabel}
            </span>
            {urgent && <AlertCircle className="w-3.5 h-3.5 shrink-0 text-red-600 dark:text-red-400" aria-label="Final stretch" />}
          </div>
          <div className="mt-2 flex items-end gap-2">
            <span className={`font-serif tabular-nums text-5xl sm:text-6xl font-bold leading-none ${countTone}`}>
              {Math.abs(daysRemaining)}
            </span>
            <span className="mb-1 text-xs leading-tight text-espresso-500 dark:text-espresso-400">
              {daysRemaining < 0 ? <>days<br />past</> : <>{daysRemaining === 1 ? 'day' : 'days'}<br />remaining</>}
            </span>
          </div>
          <p className="mt-2 flex items-center gap-1.5 text-[11px] leading-snug text-espresso-500 dark:text-espresso-400">
            <CalendarDays className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{formatTargetDate(targetDate)}</span>
          </p>
        </div>

        <div className="min-w-0 flex-1" role="group" aria-label="Daily countdown heatmap">
          <div
            className="grid w-full items-center gap-x-1 gap-y-1.5 sm:gap-x-1.5"
            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(10px, 1fr))' }}
            role="grid"
            aria-label={`Days from ${formatTargetDate(today)} to ${formatTargetDate(targetDate)}`}
          >
            {timelineDays.map((day) => {
              const key = dateKey(day);
              const isToday = key === todayKey;
              const isExam = key === examKey;
              const stateLabel = isToday && isExam ? 'Today and exam' : isToday ? 'Today' : isExam ? 'Exam' : 'Future';
              return (
                <span
                  key={key}
                  role="gridcell"
                  aria-label={`${day.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}: ${stateLabel}`}
                  title={`${day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · ${stateLabel}`}
                  className="aspect-square w-[10px] justify-self-center rounded-[3px] transition-colors sm:w-3 sm:rounded-[4px]"
                  style={{
                    backgroundColor: isExam ? 'var(--warning)' : isToday ? 'var(--accent)' : 'color-mix(in srgb, var(--text-primary) 9%, var(--surface))',
                    border: isToday && isExam ? '2px solid var(--accent)' : '1px solid color-mix(in srgb, var(--border) 75%, transparent)',
                    boxShadow: isToday && isExam ? '0 0 0 2px var(--surface), 0 0 0 3px var(--accent)' : undefined,
                  }}
                />
              );
            })}
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[10px] font-medium text-espresso-500 dark:text-espresso-400" aria-label="Heatmap legend">
            <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-[3px] border border-[var(--border)]" style={{ backgroundColor: 'color-mix(in srgb, var(--text-primary) 9%, var(--surface))' }} aria-hidden="true" />Future</span>
            <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-[3px]" style={{ backgroundColor: 'var(--accent)' }} aria-hidden="true" />Today</span>
            <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-[3px]" style={{ backgroundColor: 'var(--warning)' }} aria-hidden="true" />Exam</span>
          </div>
        </div>
      </div>
    </section>
  );
};
