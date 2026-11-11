import React, { useMemo } from 'react';
import { FocusWidget } from '../dashboard/FocusWidget';
import { useApp } from '../../context/AppContext';
import { SevenDayFocusChart } from '../focus/SevenDayFocusChart';
import { FocusMetricsSummary } from '../focus/FocusMetricsSummary';
import { ProductivityInsightsPanel } from '../focus/ProductivityInsightsPanel';
import { SessionHistoryLedger } from '../focus/SessionHistoryLedger';
import { JourneyHeatmap } from '../focus/JourneyHeatmap';
import { FocusRadioDashboardCard } from '../focus-radio';
import { PlannerFocusLaunch } from '../../types';
import { calculateSevenDayFocus,
  calculateFocusSummaries,
  calculateStudyStreaks,
  calculateProductivityInsights,
} from '../../utils/focusAnalytics';
import { ProFeatureGate } from '../common/ProFeatureGate';


interface FocusViewProps {
  plannerFocusLaunch?: PlannerFocusLaunch | null;
  onPlannerFocusLaunchConsumed?: () => void;
}

export const FocusView: React.FC<FocusViewProps> = ({ plannerFocusLaunch, onPlannerFocusLaunchConsumed }) => {
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
    <div className="focus-page flex flex-col gap-6 sm:gap-7 pb-8 p-3 sm:p-5 rounded-[30px]">
      <div className="focus-hero relative overflow-hidden rounded-[28px] px-6 py-7 sm:px-9 sm:py-9">
        <div className="focus-hero-orbit" aria-hidden="true" />
        <div className="relative z-10 max-w-2xl">
          <div className="focus-hero-label inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-[0.16em]">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />
            Study workspace
          </div>
          <h1 className="focus-hero-title mt-4 font-serif text-3xl sm:text-4xl font-semibold tracking-tight">
            Deep Focus
          </h1>
          <p className="focus-hero-copy mt-2 max-w-xl text-sm leading-relaxed">
            Pomodoro intervals, custom timers, and study history in one place.
          </p>
        </div>
        <div className="focus-hero-glint" aria-hidden="true" />
      </div>

      {/* 1. Quick Metrics Ribbon (Today, 7-Day Total, Streaks, Rolling Avg) */}
      <FocusMetricsSummary summary={summaries} streaks={streaks} />

      {/* 2. Main Work Area: Timer & 7-Day Distribution Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(340px,0.85fr)_minmax(0,1.15fr)] gap-6 lg:gap-8 items-start">
        {/* Left: Enhanced Timer Widget */}
        <div className="min-w-0">
          <FocusWidget plannerFocusLaunch={plannerFocusLaunch} onPlannerFocusLaunchConsumed={onPlannerFocusLaunchConsumed} />
        </div>

        {/* Right: Analytics and the year-long consistency map fill the companion column. */}
        <div className="min-w-0 space-y-6">
          <ProFeatureGate featureKey="advanced_analytics">
            <div className="space-y-6">
              <SevenDayFocusChart data={sevenDayData} />
              <ProductivityInsightsPanel insights={insights} />
              <JourneyHeatmap />
            </div>
          </ProFeatureGate>
        </div>
      </div>

      {/* 3. Focus Radio in Deep Focus */}
      {!showRadio && (
        <div className="focus-radio-prompt p-4 rounded-2xl border border-ivory-300 dark:border-espresso-750 bg-white dark:bg-espresso-850 shadow-subtle flex flex-col sm:flex-row items-center justify-between gap-3">
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
    </div>
  );
};
