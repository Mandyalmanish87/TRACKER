import React, { useState, useMemo } from 'react';
import { Card } from '../common/Card';
import { getSessionLocalDateStr } from '../../utils/focusAnalytics';
import { useApp } from '../../context/AppContext';
import { calculateYearlyFocus, DayFocusMetric } from '../../utils/focusAnalytics';
import { StudySession } from '../../types';

// Configurable intensity thresholds (in minutes) and corresponding Tailwind color classes.
const INTENSITY_THRESHOLDS = [0, 30, 60, 120]; // 0 = none, <30 low, <60 medium, >=120 high
const INTENSITY_COLORS = [
  'bg-espresso-900', // no activity (very dark)
  'bg-terracotta-200', // low activity
  'bg-terracotta-400', // medium activity
  'bg-terracotta-600', // high activity
];

/**
 * Determine which intensity bucket a given minute total falls into.
 */
function getIntensityClass(minutes: number): string {
  if (minutes === 0) return INTENSITY_COLORS[0];
  if (minutes < INTENSITY_THRESHOLDS[1]) return INTENSITY_COLORS[1];
  if (minutes < INTENSITY_THRESHOLDS[2]) return INTENSITY_COLORS[2];
  return INTENSITY_COLORS[3];
}

/**
 * Modal overlay that lists all sessions for a particular day.
 */
const DayDetailModal: React.FC<{
  day: DayFocusMetric;
  sessions: StudySession[];
  onClose: () => void;
}> = ({ day, sessions, onClose }) => {
  // Filter sessions belonging to this day using the helper.
  const daySessions = useMemo(() => {
    const dateStr = day.dateStr;
    return sessions.filter((s) => getSessionLocalDateStr(s) === dateStr);
  }, [sessions, day.dateStr]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm"
      onClick={onClose}
    >
      <Card
        title={`${day.dateStr} – ${day.minutes} min`}
        className="max-w-xl w-full mx-4"
        bodyClassName="max-h-[70vh] overflow-y-auto"
      >
        {daySessions.length === 0 ? (
          <p className="text-sm text-espresso-500 dark:text-espresso-400">
            No sessions recorded for this day.
          </p>
        ) : (
          <ul className="space-y-2">
            {daySessions.map((s) => (
              <li key={s.id} className="border-b border-ivory-200 dark:border-espresso-750 pb-2">
                <p className="font-medium text-espresso-900 dark:text-ivory-50">
                  {s.subjectName || 'Untitled'} – {s.durationMinutes} min
                </p>
                <p className="text-xs text-espresso-500 dark:text-espresso-400">
                  {new Date(s.startTime || s.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
                <p className="text-xs italic text-espresso-400 dark:text-espresso-500">
                  Status: {s.status ?? 'completed'}
                </p>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-espresso-700 bg-ivory-200 rounded hover:bg-ivory-300 dark:bg-espresso-700 dark:text-ivory-100 dark:hover:bg-espresso-600"
          >
            Close
          </button>
        </div>
      </Card>
    </div>
  );
};

/**
 * Journey heatmap component – shows a GitHub‑style contribution graph for the last 365 days.
 */
export const JourneyHeatmap: React.FC = () => {
  const { state } = useApp();
  const sessions = state.studySessions ?? [];
  const rolloverHour = state.settings?.studyDayRolloverHour ?? 0;

  // Compute yearly focus data once.
  const yearlyData = useMemo(() => calculateYearlyFocus(sessions, new Date(), rolloverHour), [
    sessions,
    rolloverHour,
  ]);

  // Determine the number of weeks to display (ceil of 365/7).
  const weeks = Math.ceil(yearlyData.length / 7);

  const [selectedDay, setSelectedDay] = useState<DayFocusMetric | null>(null);

  // Helper to get CSS class for a day cell.
  const cellClass = (minutes: number) => `w-3 h-3 sm:w-4 sm:h-4 rounded ${getIntensityClass(minutes)}`;

  return (
    <Card title="Journey" className="bg-espresso-800" bodyClassName="p-4 sm:p-6">
      <div className="overflow-x-auto py-2">
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
                const tooltip = `${day.dayName} ${day.dateStr}\n${day.minutes} min (${day.sessionCount} session${day.sessionCount !== 1 ? 's' : ''})`;
                return (
                  <div
                    key={day.dateStr}
                    className={cellClass(day.minutes)}
                    title={tooltip}
                    role="button"
                    aria-label={tooltip.replace(/\n/g, ', ')}
                    onClick={() => setSelectedDay(day)}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') setSelectedDay(day);
                    }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-4 flex items-center space-x-2 text-xs">
        <span className="text-ivory-300 dark:text-espresso-400">No activity</span>
        <div className="w-3 h-3 bg-terracotta-200 rounded" />
        <span className="text-ivory-300 dark:text-espresso-400">Low</span>
        <div className="w-3 h-3 bg-terracotta-400 rounded" />
        <span className="text-ivory-300 dark:text-espresso-400">Medium</span>
        <div className="w-3 h-3 bg-terracotta-600 rounded" />
        <span className="text-ivory-300 dark:text-espresso-400">High</span>
      </div>

      {/* Future & Today markers */}
      <div className="mt-2 text-xs text-ivory-400 dark:text-espresso-300 flex space-x-4">
        <span className="flex items-center">
          <span className="w-2 h-2 bg-espresso-800 rounded mr-1" /> Future
        </span>
        <span className="flex items-center">
          <span className="w-2 h-2 border-2 border-terracotta-600 rounded mr-1" /> Today
        </span>
      </div>

      {/* Day detail modal */}
      {selectedDay && (
        <DayDetailModal day={selectedDay} sessions={sessions} onClose={() => setSelectedDay(null)} />
      )}
    </Card>
  );
};
