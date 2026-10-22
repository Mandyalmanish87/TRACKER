import React, { useState, useMemo } from 'react';
import { Card } from '../common/Card';
import { getSessionLocalDateStr, calculateYearlyFocus, DayFocusMetric } from '../../utils/focusAnalytics';
import { useApp } from '../../context/AppContext';
import { StudySession } from '../../types';
import { Flame, Calendar, Clock, CheckCircle2, AlertCircle, X } from 'lucide-react';

const INTENSITY_THRESHOLDS = [0, 30, 60, 120];

/**
 * Determine which intensity and styling a day cell receives.
 */
function getIntensityClass(minutes: number, isToday: boolean): string {
  let color = '';
  if (minutes === 0) {
    color = 'bg-ivory-200 dark:bg-espresso-800/80 hover:bg-ivory-300 dark:hover:bg-espresso-700 border border-ivory-300/50 dark:border-espresso-750/50';
  } else if (minutes < INTENSITY_THRESHOLDS[1]) {
    color = 'bg-terracotta-200 dark:bg-terracotta-900/70 hover:opacity-85 text-terracotta-900 dark:text-terracotta-200';
  } else if (minutes < INTENSITY_THRESHOLDS[2]) {
    color = 'bg-terracotta-400 dark:bg-terracotta-600 hover:opacity-85 text-white';
  } else {
    color = 'bg-terracotta-600 dark:bg-terracotta-500 hover:opacity-85 text-white shadow-xs';
  }

  const todayOutline = isToday
    ? 'ring-2 ring-terracotta-500 ring-offset-1 ring-offset-white dark:ring-offset-espresso-900 font-bold z-10'
    : '';

  return `${color} ${todayOutline}`;
}

/**
 * Modal overlay that lists all sessions for a particular day.
 */
const DayDetailModal: React.FC<{
  day: DayFocusMetric;
  sessions: StudySession[];
  onClose: () => void;
}> = ({ day, sessions, onClose }) => {
  const daySessions = useMemo(() => {
    const dateStr = day.dateStr;
    return sessions.filter((s) => getSessionLocalDateStr(s) === dateStr);
  }, [sessions, day.dateStr]);

  const totalMinutes = useMemo(() => {
    return daySessions.reduce((acc, s) => acc + (s.durationMinutes || 0), 0);
  }, [daySessions]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-espresso-950/70 backdrop-blur-sm transition-opacity"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-white dark:bg-espresso-850 border border-ivory-300 dark:border-espresso-750 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-ivory-200 dark:border-espresso-750 bg-ivory-50 dark:bg-espresso-800/40">
          <div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-terracotta-500" />
              <h3 className="font-serif text-lg font-semibold text-espresso-950 dark:text-ivory-50">
                {day.dateStr}
              </h3>
              <span className="text-xs font-mono font-medium text-espresso-500 dark:text-espresso-400">
                ({day.dayName})
              </span>
            </div>
            <p className="text-xs text-espresso-600 dark:text-espresso-300 mt-0.5">
              Total active study: <span className="font-semibold text-terracotta-600 dark:text-terracotta-400 font-mono">{totalMinutes.toFixed(totalMinutes % 1 === 0 ? 0 : 1)} min</span> across {daySessions.length} session{daySessions.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Dismiss modal"
            className="p-1.5 rounded-lg text-espresso-500 hover:text-espresso-900 dark:text-espresso-400 dark:hover:text-ivory-100 hover:bg-ivory-200 dark:hover:bg-espresso-700 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sessions list */}
        <div className="p-5 max-h-[60vh] overflow-y-auto space-y-3">
          {daySessions.length === 0 ? (
            <div className="py-8 text-center text-espresso-500 dark:text-espresso-400 text-sm">
              <p>No study sessions recorded for this day.</p>
              <p className="text-xs text-espresso-400 dark:text-espresso-500 mt-1">Start a Pomodoro interval to log active focus time.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {daySessions.map((s) => {
                const startTime = s.startTime || s.timestamp;
                const timeStr = startTime
                  ? new Date(startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : '—';
                const isInterrupted = s.status === 'interrupted';

                return (
                  <div
                    key={s.id}
                    className="flex items-center justify-between p-3 rounded-xl border border-ivory-200 dark:border-espresso-750 bg-ivory-50/60 dark:bg-espresso-800/40 hover:border-ivory-300 dark:hover:border-espresso-700 transition"
                  >
                    <div className="min-w-0 pr-3">
                      <div className="flex items-center gap-2">
                        {isInterrupted ? (
                          <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        )}
                        <span className="font-semibold text-sm text-espresso-900 dark:text-ivory-100 truncate">
                          {s.subjectName || 'General Focus'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-espresso-500 dark:text-espresso-400 mt-0.5">
                        <Clock className="w-3 h-3" />
                        <span>{timeStr}</span>
                        {s.notes && <span className="truncate italic">· {s.notes}</span>}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-mono font-bold text-sm text-terracotta-600 dark:text-terracotta-400 tabular-nums">
                        {s.durationMinutes.toFixed(s.durationMinutes % 1 === 0 ? 0 : 1)} min
                      </span>
                      <p className="text-[10px] uppercase font-mono text-espresso-400 dark:text-espresso-500">
                        {s.status ?? 'completed'}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-ivory-200 dark:border-espresso-750 bg-ivory-50/50 dark:bg-espresso-800/20 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-xl text-espresso-700 dark:text-ivory-200 bg-ivory-200 hover:bg-ivory-300 dark:bg-espresso-700 dark:hover:bg-espresso-600 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * Journey heatmap component – shows a GitHub-style contribution graph for the last 365 days.
 */
export const JourneyHeatmap: React.FC = () => {
  const { state } = useApp();
  const sessions = state.studySessions ?? [];
  const rolloverHour = state.settings?.studyDayRolloverHour ?? 0;

  const yearlyData = useMemo(
    () => calculateYearlyFocus(sessions, new Date(), rolloverHour),
    [sessions, rolloverHour]
  );

  const weeks = Math.ceil(yearlyData.length / 7);
  const [selectedDay, setSelectedDay] = useState<DayFocusMetric | null>(null);

  // Calculate total focus minutes in the year and active days
  const stats = useMemo(() => {
    let totalMinutes = 0;
    let activeDays = 0;
    for (const d of yearlyData) {
      if (d.minutes > 0) {
        totalMinutes += d.minutes;
        activeDays += 1;
      }
    }
    const hours = Math.floor(totalMinutes / 60);
    const mins = Math.round(totalMinutes % 60);
    return { totalMinutes, hours, mins, activeDays };
  }, [yearlyData]);

  // Extract month markers for columns
  const monthLabels = useMemo(() => {
    const labels: { index: number; name: string }[] = [];
    let lastMonth = -1;
    for (let w = 0; w < weeks; w++) {
      const day = yearlyData[w * 7];
      if (day) {
        const m = day.date.getMonth();
        if (m !== lastMonth) {
          labels.push({
            index: w,
            name: day.date.toLocaleDateString(undefined, { month: 'short' }),
          });
          lastMonth = m;
        }
      }
    }
    return labels;
  }, [yearlyData, weeks]);

  return (
    <Card
      title="Focus Journey & Consistency"
      subtitle="Empirical day-by-day contribution heatmap of your active study sessions over the past 365 days."
      className="w-full"
      bodyClassName="p-4 sm:p-6"
      action={
        <div className="flex items-center gap-2 text-xs font-mono font-medium text-espresso-600 dark:text-espresso-300 bg-ivory-100 dark:bg-espresso-800 px-3 py-1.5 rounded-xl border border-ivory-200 dark:border-espresso-750">
          <Flame className="w-3.5 h-3.5 text-terracotta-500" />
          <span>
            {stats.hours}h {stats.mins}m in last year ({stats.activeDays} active days)
          </span>
        </div>
      }
    >
      <div className="overflow-x-auto pb-2 pt-1 scrollbar-thin">
        <div className="inline-block min-w-full">
          {/* Month labels header */}
          <div className="flex items-center text-[10px] font-mono text-espresso-500 dark:text-espresso-400 mb-1.5 pl-7">
            {Array.from({ length: weeks }).map((_, wIdx) => {
              const label = monthLabels.find((m) => m.index === wIdx);
              return (
                <div key={wIdx} className="w-3 sm:w-3.5 mr-1 shrink-0 text-left">
                  {label ? label.name : ''}
                </div>
              );
            })}
          </div>

          {/* Grid with Weekday headers on left */}
          <div className="flex items-start">
            {/* Weekday indicators */}
            <div className="flex flex-col space-y-1 text-[9px] font-mono text-espresso-400 dark:text-espresso-500 pr-1.5 select-none shrink-0 pt-0.5">
              <span className="h-3 sm:h-3.5 flex items-center">Sun</span>
              <span className="h-3 sm:h-3.5 flex items-center">Mon</span>
              <span className="h-3 sm:h-3.5 flex items-center">Tue</span>
              <span className="h-3 sm:h-3.5 flex items-center">Wed</span>
              <span className="h-3 sm:h-3.5 flex items-center">Thu</span>
              <span className="h-3 sm:h-3.5 flex items-center">Fri</span>
              <span className="h-3 sm:h-3.5 flex items-center">Sat</span>
            </div>

            {/* Weeks columns */}
            <div
              className="grid grid-rows-7 gap-1"
              style={{ gridAutoFlow: 'column', gridAutoColumns: 'minmax(0, 1fr)' }}
            >
              {Array.from({ length: weeks }).map((_, weekIdx) => (
                <div key={weekIdx} className="flex flex-col space-y-1">
                  {Array.from({ length: 7 }).map((_, dayIdx) => {
                    const dataIdx = weekIdx * 7 + dayIdx;
                    if (dataIdx >= yearlyData.length) return null;
                    const day = yearlyData[dataIdx];
                    const tooltip = `${day.dayName} ${day.dateStr}\n${day.minutes.toFixed(day.minutes % 1 === 0 ? 0 : 1)} min (${day.sessionCount} session${day.sessionCount !== 1 ? 's' : ''})`;

                    return (
                      <button
                        key={day.dateStr}
                        type="button"
                        className={`w-3 h-3 sm:w-3.5 sm:h-3.5 rounded transition-transform active:scale-95 focus:outline-hidden focus:ring-1 focus:ring-terracotta-500 cursor-pointer ${getIntensityClass(
                          day.minutes,
                          day.isToday
                        )}`}
                        title={tooltip}
                        aria-label={tooltip.replace(/\n/g, ', ')}
                        onClick={() => setSelectedDay(day)}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Legend & Summary Footer */}
      <div className="mt-4 pt-3 border-t border-ivory-200 dark:border-espresso-750 flex flex-wrap items-center justify-between gap-3 text-xs text-espresso-600 dark:text-espresso-400">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <span>No activity</span>
          <div className="w-3 h-3 rounded bg-ivory-200 dark:bg-espresso-800 border border-ivory-300 dark:border-espresso-750" />
          <span>Low</span>
          <div className="w-3 h-3 rounded bg-terracotta-200 dark:bg-terracotta-900/70" />
          <span>Medium</span>
          <div className="w-3 h-3 rounded bg-terracotta-400 dark:bg-terracotta-600" />
          <span>High</span>
          <div className="w-3 h-3 rounded bg-terracotta-600 dark:bg-terracotta-500" />
        </div>

        <div className="flex items-center gap-4 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs ring-2 ring-terracotta-500 ring-offset-1 ring-offset-white dark:ring-offset-espresso-900 inline-block" />
            <span>Today</span>
          </span>
          <span className="text-espresso-400 dark:text-espresso-500">
            Click any cell to view detailed sessions
          </span>
        </div>
      </div>

      {/* Day detail modal */}
      {selectedDay && (
        <DayDetailModal
          day={selectedDay}
          sessions={sessions}
          onClose={() => setSelectedDay(null)}
        />
      )}
    </Card>
  );
};
