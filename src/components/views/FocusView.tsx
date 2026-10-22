import React, { useMemo } from 'react';
import { FocusWidget } from '../dashboard/FocusWidget';
import { useApp } from '../../context/AppContext';
import { SevenDayFocusChart } from '../focus/SevenDayFocusChart';
import { FocusMetricsSummary } from '../focus/FocusMetricsSummary';
import { ProductivityInsightsPanel } from '../focus/ProductivityInsightsPanel';
import { SessionHistoryLedger } from '../focus/SessionHistoryLedger';
import { JourneyHeatmap } from '../focus/JourneyHeatmap';
import { FocusRadioDashboardCard } from '../focus-radio';
import {
  calculateSevenDayFocus,
  calculateFocusSummaries,
  calculateStudyStreaks,
  calculateProductivityInsights,
} from '../../utils/focusAnalytics';


export const FocusView: React.FC = () => {
  const { state, updateSettings } = useApp();

  const rolloverHour = state.settings?.studyDayRolloverHour ?? 0;
  const sessions = state.studySessions || [];
  const showRadio = state.settings?.showFocusRadio ?? false;

  // Compute all analytics synchronously
  const sevenDayData = useMemo(
    () => calculateSevenDayFocus(sessions, new Date(), rolloverHour),
    [sessions, rolloverHour]
  );

  const summaries = useMemo(
    () => calculateFocusSummaries(sessions, new Date(), rolloverHour),
    [sessions, rolloverHour]
  );

  const streaks = useMemo(
    () => calculateStudyStreaks(sessions, new Date(), rolloverHour),
    [sessions, rolloverHour]
  );

  const insights = useMemo(
    () => calculateProductivityInsights(sessions, new Date(), rolloverHour),
    [sessions, rolloverHour]
  );

  return (
    <div className="space-y-6 sm:space-y-8 pb-20">
      {/* Editorial Header */}
      <div className="border-b border-ivory-300 dark:border-espresso-800 pb-6">
        <span className="text-xs font-mono font-semibold uppercase tracking-wider text-terracotta-600 dark:text-terracotta-400">
          Cognitive Focus & Immersion
        </span>
        <h1 className="font-serif text-3xl sm:text-4xl font-normal text-espresso-950 dark:text-ivory-50 tracking-tight mt-1">
          Deep Focus &amp; Cognitive Energy
        </h1>
        <p className="text-xs sm:text-sm text-espresso-500 dark:text-espresso-400 mt-1">
          Distraction-free Pomodoro intervals, study streaks, and empirical focus analytics.
        </p>
      </div>

      {/* 1. Quick Metrics Ribbon (Today, 7-Day Total, Streaks, Rolling Avg) */}
      <FocusMetricsSummary summary={summaries} streaks={streaks} />

      {/* 2. Main Work Area: Timer & 7-Day Distribution Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(340px,0.85fr)_minmax(0,1.15fr)] gap-6 lg:gap-8 items-start">
        {/* Left: Enhanced Timer Widget */}
        <div className="min-w-0">
          <FocusWidget />
        </div>

        {/* Right: 7-Day Distribution Chart & Productivity Insights */}
        <div className="min-w-0 space-y-6">
          <SevenDayFocusChart data={sevenDayData} />
          <ProductivityInsightsPanel insights={insights} />
        </div>
      </div>

      {/* 3. Focus Radio in Deep Focus */}
      {!showRadio && (
        <div className="p-4 rounded-2xl border border-ivory-300 dark:border-espresso-750 bg-white dark:bg-espresso-850 shadow-subtle flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-ivory-200 dark:bg-espresso-800 text-espresso-900 dark:text-ivory-100 flex items-center justify-center font-bold text-lg shrink-0">
              📻
            </div>
            <div>
              <p className="text-sm font-semibold text-espresso-900 dark:text-ivory-100">
                Want ambient background audio while studying?
              </p>
              <p className="text-xs text-espresso-500 dark:text-espresso-400">
                Turn on the built-in Focus Radio panel with YouTube playlists, lo-fi beats, and custom stations.
              </p>
            </div>
          </div>
          <button
            onClick={() => updateSettings({ showFocusRadio: true })}
            className="text-xs px-4 py-2 rounded-xl text-white font-semibold shadow-subtle transition hover:opacity-95 whitespace-nowrap"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            Enable Radio Panel
          </button>
        </div>
      )}

      {showRadio && (
        <div className="w-full">
          <FocusRadioDashboardCard />
        </div>
      )}

      {/* 4. Complete Session History Ledger with Status Filters & Search */}
      <div className="w-full">
        <SessionHistoryLedger sessions={sessions} />
      </div>
      <JourneyHeatmap />
    </div>
  );
};
