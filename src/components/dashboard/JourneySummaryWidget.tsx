import React, { useState, useMemo } from 'react';
import { Card } from '../common/Card';
import { useApp } from '../../context/AppContext';
import { calculateYearlyFocus } from '../../utils/focusAnalytics';
import { Flame, ArrowRight, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

interface JourneySummaryWidgetProps {
  onNavigateToFocus?: () => void;
}

const INTENSITY_THRESHOLDS = [0, 30, 60, 120];

function getMiniIntensityClass(minutes: number, isToday: boolean): string {
  let color = '';
  if (minutes === 0) {
    color = 'bg-ivory-200 dark:bg-espresso-800/80 border border-ivory-300/40 dark:border-espresso-750/40 text-espresso-600 dark:text-espresso-400';
  } else if (minutes < INTENSITY_THRESHOLDS[1]) {
    color = 'bg-terracotta-200 dark:bg-terracotta-900/70 text-terracotta-900 dark:text-terracotta-100 font-semibold';
  } else if (minutes < INTENSITY_THRESHOLDS[2]) {
    color = 'bg-terracotta-400 dark:bg-terracotta-600 text-white font-semibold';
  } else {
    color = 'bg-terracotta-600 dark:bg-terracotta-500 text-white font-bold shadow-xs';
  }

  const todayOutline = isToday
    ? 'ring-2 ring-terracotta-500 ring-offset-1 ring-offset-white dark:ring-offset-espresso-900 z-10 font-bold'
    : '';

  return `${color} ${todayOutline}`;
}

export const JourneySummaryWidget: React.FC<JourneySummaryWidgetProps> = ({ onNavigateToFocus }) => {
  const { state } = useApp();
  const sessions = state.studySessions ?? [];
  const rolloverHour = state.settings?.studyDayRolloverHour ?? 0;
  const [viewMode, setViewMode] = useState<'month' | 'timeline'>('month');
  const [monthOffset, setMonthOffset] = useState<number>(0);

  // Compute yearly data and slice the latest 12 weeks (84 days)
  const recentDays = useMemo(() => {
    const yearly = calculateYearlyFocus(sessions, new Date(), rolloverHour);
    // Take the last 84 days (12 weeks)
    return yearly.slice(-84);
  }, [sessions, rolloverHour]);

  // Aggregate 12-week stats
  const summary = useMemo(() => {
    let totalMinutes = 0;
    let activeDays = 0;
    for (const d of recentDays) {
      if (d.minutes > 0) {
        totalMinutes += d.minutes;
        activeDays += 1;
      }
    }
    const hours = Math.floor(totalMinutes / 60);
    const mins = Math.round(totalMinutes % 60);
    return { totalMinutes, hours, mins, activeDays };
  }, [recentDays]);

  // Current selected month calendar data
  const currentMonthData = useMemo(() => {
    const targetDate = new Date();
    targetDate.setDate(1);
    targetDate.setMonth(targetDate.getMonth() + monthOffset);

    const year = targetDate.getFullYear();
    const month = targetDate.getMonth();
    const monthName = targetDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

    const firstDay = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Monday as start of week: (firstDay.getDay() + 6) % 7
    const startOffset = (firstDay.getDay() + 6) % 7;

    const todayStr = new Date().toISOString().split('T')[0];

    const days: Array<{
      dateStr: string;
      dayNum: number;
      minutes: number;
      isToday: boolean;
    } | null> = [];

    // Leading empty slots
    for (let i = 0; i < startOffset; i++) {
      days.push(null);
    }

    let monthFocusMinutes = 0;
    let monthActiveDays = 0;

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const daySessions = sessions.filter((s) => s.timestamp.startsWith(dateStr));
      const minutes = daySessions.reduce((acc, s) => acc + (s.durationMinutes || 0), 0);
      if (minutes > 0) {
        monthFocusMinutes += minutes;
        monthActiveDays += 1;
      }
      days.push({
        dateStr,
        dayNum: d,
        minutes,
        isToday: dateStr === todayStr,
      });
    }

    const monthHours = Math.floor(monthFocusMinutes / 60);
    const monthMins = Math.round(monthFocusMinutes % 60);

    return {
      monthName,
      days,
      daysInMonth,
      monthHours,
      monthMins,
      monthActiveDays,
    };
  }, [sessions, monthOffset]);

  // 12 weeks horizontal month grouping
  const monthGroups = useMemo(() => {
    const groups: { monthName: string; weekSpan: number; isCurrentMonth: boolean }[] = [];
    const currentMonthNum = new Date().getMonth();
    for (let w = 0; w < 12; w++) {
      const day = recentDays[w * 7];
      if (!day) continue;
      const mName = day.date.toLocaleDateString(undefined, { month: 'short' });
      const isCurrent = day.date.getMonth() === currentMonthNum;
      const lastGroup = groups[groups.length - 1];
      if (lastGroup && lastGroup.monthName === mName) {
        lastGroup.weekSpan += 1;
      } else {
        groups.push({ monthName: mName, weekSpan: 1, isCurrentMonth: isCurrent });
      }
    }
    return groups;
  }, [recentDays]);

  const numWeeks = 12;

  return (
    <Card
      title="Focus Journey"
      subtitle="Last 12 weeks activity"
      className="w-full"
      bodyClassName="p-3.5 sm:p-4.5"
      action={
        <div className="flex items-center gap-2">
          {/* Mini View Switcher */}
          <div className="flex items-center p-0.5 rounded-lg bg-ivory-100 dark:bg-espresso-800 border border-ivory-200 dark:border-espresso-750 text-[11px]">
            <button
              type="button"
              onClick={() => setViewMode('month')}
              className={`px-2 py-0.5 rounded-md font-medium transition cursor-pointer ${
                viewMode === 'month'
                  ? 'bg-white dark:bg-espresso-700 text-espresso-950 dark:text-ivory-50 shadow-xs font-semibold'
                  : 'text-espresso-500 dark:text-espresso-400 hover:text-espresso-900'
              }`}
            >
              Month Map
            </button>
            <button
              type="button"
              onClick={() => setViewMode('timeline')}
              className={`px-2 py-0.5 rounded-md font-medium transition cursor-pointer ${
                viewMode === 'timeline'
                  ? 'bg-white dark:bg-espresso-700 text-espresso-950 dark:text-ivory-50 shadow-xs font-semibold'
                  : 'text-espresso-500 dark:text-espresso-400 hover:text-espresso-900'
              }`}
            >
              12 Weeks
            </button>
          </div>

          {onNavigateToFocus && (
            <button
              onClick={onNavigateToFocus}
              className="text-xs font-semibold text-terracotta-600 dark:text-terracotta-400 hover:text-terracotta-700 dark:hover:text-terracotta-300 flex items-center gap-1 transition"
              title="Open full Journey Heatmap in Focus View"
            >
              <span>View All</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      }
    >
      {/* Metrics Banner */}
      <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-ivory-200 dark:border-espresso-750">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-terracotta-50 dark:bg-terracotta-900/30 text-terracotta-600 dark:text-terracotta-400">
            <Flame className="w-4 h-4" />
          </div>
          <div>
            <span className="font-mono text-sm sm:text-base font-bold text-espresso-950 dark:text-ivory-50 tabular-nums">
              {viewMode === 'month'
                ? `${currentMonthData.monthHours}h ${currentMonthData.monthMins}m`
                : `${summary.hours}h ${summary.mins}m`}
            </span>
            <span className="text-xs text-espresso-500 dark:text-espresso-400 ml-1.5">
              {viewMode === 'month' ? 'in month' : 'focused'}
            </span>
          </div>
        </div>

        <div className="text-right">
          <span className="font-mono text-xs font-bold text-terracotta-600 dark:text-terracotta-400 tabular-nums">
            {viewMode === 'month' ? currentMonthData.monthActiveDays : summary.activeDays}
          </span>
          <span className="text-xs text-espresso-500 dark:text-espresso-400 ml-1">
            {viewMode === 'month' ? (
              <span>active this month ({summary.activeDays} of 84 days active)</span>
            ) : (
              <span>of 84 days active</span>
            )}
          </span>
        </div>
      </div>

      {/* ── VIEW 1: HORIZONTAL MONTH MAP WITH SMALL DAY BLOCKS ── */}
      {viewMode === 'month' && (
        <div className="space-y-2">
          {/* Month Navigation Header */}
          <div className="flex items-center justify-between px-1 text-xs">
            <div className="flex items-center gap-1.5 font-medium text-espresso-800 dark:text-ivory-200">
              <Calendar className="w-3.5 h-3.5 text-terracotta-500" />
              <span className="font-semibold">{currentMonthData.monthName}</span>
              {monthOffset === 0 && (
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-sage-100 dark:bg-sage-950/40 text-sage-700 dark:text-sage-300 font-semibold">
                  Current
                </span>
              )}
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setMonthOffset((prev) => prev - 1)}
                className="p-1 rounded hover:bg-ivory-100 dark:hover:bg-espresso-800 text-espresso-600 dark:text-espresso-400 transition"
                title="Previous month"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              {monthOffset !== 0 && (
                <button
                  type="button"
                  onClick={() => setMonthOffset(0)}
                  className="text-[11px] px-1.5 py-0.5 rounded text-terracotta-600 dark:text-terracotta-400 hover:underline font-mono"
                >
                  Today
                </button>
              )}
              <button
                type="button"
                onClick={() => setMonthOffset((prev) => prev + 1)}
                className="p-1 rounded hover:bg-ivory-100 dark:hover:bg-espresso-800 text-espresso-600 dark:text-espresso-400 transition"
                title="Next month"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Weekday indicators across columns (horizontal) */}
          <div className="grid grid-cols-7 gap-1 text-center font-mono text-[10px] text-espresso-400 dark:text-espresso-500 font-semibold select-none">
            <span>M</span>
            <span>T</span>
            <span>W</span>
            <span>T</span>
            <span>F</span>
            <span>S</span>
            <span>S</span>
          </div>

          {/* Month grid: Small day blocks */}
          <div className="grid grid-cols-7 gap-1">
            {currentMonthData.days.map((day, idx) => {
              if (!day) {
                return (
                  <div
                    key={`empty-${idx}`}
                    className="w-full aspect-square max-w-[28px] max-h-[28px] mx-auto rounded-md bg-transparent opacity-0 pointer-events-none"
                  />
                );
              }

              const tooltip = `${day.dateStr}: ${day.minutes.toFixed(
                day.minutes % 1 === 0 ? 0 : 1
              )} min focused`;

              return (
                <div
                  key={day.dateStr}
                  title={tooltip}
                  className={`w-full aspect-square max-w-[28px] max-h-[28px] mx-auto rounded-md flex flex-col items-center justify-center text-[10px] font-mono transition cursor-pointer select-none ${getMiniIntensityClass(
                    day.minutes,
                    day.isToday
                  )}`}
                >
                  <span>{day.dayNum}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── VIEW 2: 12-WEEK HORIZONTAL TIMELINE WITH MONTH LABELS & SMALL BLOCKS ── */}
      {viewMode === 'timeline' && (
        <div className="space-y-1.5">
          {/* Horizontal Month Headers */}
          <div className="flex items-center pl-4 text-[10px] font-mono">
            {monthGroups.map((group, idx) => (
              <div
                key={idx}
                className={`text-center uppercase tracking-wider font-semibold truncate ${
                  group.isCurrentMonth
                    ? 'text-terracotta-600 dark:text-terracotta-400 font-bold'
                    : 'text-espresso-400 dark:text-espresso-500'
                }`}
                style={{ flex: group.weekSpan }}
              >
                {group.monthName}
              </div>
            ))}
          </div>

          {/* Heatmap Grid Horizontal */}
          <div className="overflow-x-auto pb-1 scrollbar-none">
            <div className="flex items-start justify-center gap-1 min-w-[260px]">
              {/* Weekday indicators */}
              <div className="flex flex-col space-y-1 text-[9px] font-mono text-espresso-400 dark:text-espresso-500 pr-1 select-none shrink-0 pt-0.5">
                <span className="h-2.5 flex items-center">S</span>
                <span className="h-2.5 flex items-center">M</span>
                <span className="h-2.5 flex items-center">T</span>
                <span className="h-2.5 flex items-center">W</span>
                <span className="h-2.5 flex items-center">T</span>
                <span className="h-2.5 flex items-center">F</span>
                <span className="h-2.5 flex items-center">S</span>
              </div>

              {/* 12 columns with small day blocks */}
              <div
                className="grid grid-rows-7 gap-1 flex-1 max-w-sm"
                style={{ gridAutoFlow: 'column', gridAutoColumns: 'minmax(0, 1fr)' }}
              >
                {Array.from({ length: numWeeks }).map((_, weekIdx) => (
                  <div key={weekIdx} className="flex flex-col space-y-1">
                    {Array.from({ length: 7 }).map((_, dayIdx) => {
                      const idx = weekIdx * 7 + dayIdx;
                      if (idx >= recentDays.length) return null;
                      const day = recentDays[idx];
                      const tooltip = `${day.dayName} ${day.dateStr}: ${day.minutes.toFixed(
                        day.minutes % 1 === 0 ? 0 : 1
                      )} min`;

                      return (
                        <div
                          key={day.dateStr}
                          className={`h-2.5 sm:h-2.5 rounded-[2px] transition ${getMiniIntensityClass(
                            day.minutes,
                            day.isToday
                          )}`}
                          title={tooltip}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mini Legend */}
      <div className="mt-2.5 pt-2 border-t border-ivory-200 dark:border-espresso-750 flex items-center justify-between text-[11px] text-espresso-500 dark:text-espresso-400">
        <div className="flex items-center gap-1">
          <span>Less</span>
          <span className="w-2.5 h-2.5 rounded-xs bg-ivory-200 dark:bg-espresso-800 border border-ivory-300 dark:border-espresso-750" />
          <span className="w-2.5 h-2.5 rounded-xs bg-terracotta-200 dark:bg-terracotta-900/70" />
          <span className="w-2.5 h-2.5 rounded-xs bg-terracotta-400 dark:bg-terracotta-600" />
          <span className="w-2.5 h-2.5 rounded-xs bg-terracotta-600 dark:bg-terracotta-500" />
          <span>More</span>
        </div>
        <span className="text-[10px] text-espresso-400 dark:text-espresso-500 font-mono">
          Deep Focus Sync
        </span>
      </div>
    </Card>
  );
};
