import React from 'react';
import { ProductivityInsights } from '../../utils/focusAnalytics';
import { Sparkles, Clock, BookOpen, Calendar, TrendingUp, TrendingDown, Minus, Info } from 'lucide-react';

interface ProductivityInsightsPanelProps {
  insights: ProductivityInsights;
}

export const ProductivityInsightsPanel: React.FC<ProductivityInsightsPanelProps> = ({ insights }) => {
  if (!insights.hasSufficientData) {
    return (
      <div className="p-5 rounded-2xl border border-ivory-300 dark:border-espresso-750 bg-white dark:bg-espresso-850 shadow-subtle">
        <div className="flex items-center gap-2 mb-2 text-espresso-700 dark:text-ivory-200">
          <Sparkles className="w-4 h-4 text-ochre-600 dark:text-ochre-400" />
          <h4 className="font-serif font-bold text-sm">Productivity Pattern Intelligence</h4>
        </div>
        <div className="flex items-start gap-2.5 text-xs text-espresso-500 dark:text-espresso-400 mt-2 p-3 rounded-xl bg-ivory-100 dark:bg-espresso-800 border border-ivory-200 dark:border-espresso-700">
          <Info className="w-4 h-4 text-ochre-600 dark:text-ochre-400 shrink-0 mt-0.5" />
          <p>
            {insights.dataNotice ||
              'Complete at least 3 deep-focus sessions across your schedule to unlock data-driven study habit insights.'}
          </p>
        </div>
      </div>
    );
  }

  const { mostProductiveHour, bestDayOfWeek, topSubject, weekComparison } = insights;

  return (
    <div className="p-5 rounded-2xl border border-ivory-300 dark:border-espresso-750 bg-white dark:bg-espresso-850 shadow-subtle">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4" style={{ color: 'var(--accent)' }} />
          <h4 className="font-serif font-bold text-sm text-espresso-950 dark:text-ivory-50">
            Observed Productivity Patterns
          </h4>
        </div>
        <span className="text-[11px] font-mono text-espresso-400 dark:text-espresso-500">
          Empirical study ledger trends
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* 1. Prime Focus Window */}
        <div className="p-3.5 rounded-xl bg-ivory-50 dark:bg-espresso-800/60 border border-ivory-200 dark:border-espresso-700">
          <div className="flex items-center gap-1.5 text-espresso-500 dark:text-espresso-400 text-xs mb-1 font-medium">
            <Clock className="w-3.5 h-3.5 text-terracotta-500" />
            <span>Peak Focus Hour</span>
          </div>
          {mostProductiveHour ? (
            <>
              <p className="font-serif font-bold text-sm text-espresso-900 dark:text-ivory-100">
                {mostProductiveHour.label}
              </p>
              <p className="text-[11px] text-espresso-400 dark:text-espresso-500 font-mono mt-0.5">
                {mostProductiveHour.minutes}m total study recorded
              </p>
            </>
          ) : (
            <p className="text-xs text-espresso-400 italic">No clear peak hour yet</p>
          )}
        </div>

        {/* 2. Top Focused Subject */}
        <div className="p-3.5 rounded-xl bg-ivory-50 dark:bg-espresso-800/60 border border-ivory-200 dark:border-espresso-700">
          <div className="flex items-center gap-1.5 text-espresso-500 dark:text-espresso-400 text-xs mb-1 font-medium">
            <BookOpen className="w-3.5 h-3.5 text-sage-600 dark:text-sage-400" />
            <span>Most Studied Subject</span>
          </div>
          {topSubject ? (
            <>
              <p className="font-serif font-bold text-sm text-espresso-900 dark:text-ivory-100 truncate">
                {topSubject.subjectName}
              </p>
              <p className="text-[11px] text-espresso-400 dark:text-espresso-500 font-mono mt-0.5">
                {topSubject.minutes}m across {topSubject.sessionCount} sessions
              </p>
            </>
          ) : (
            <p className="text-xs text-espresso-400 italic">No subject-linked sessions</p>
          )}
        </div>

        {/* 3. Best Day of Week */}
        <div className="p-3.5 rounded-xl bg-ivory-50 dark:bg-espresso-800/60 border border-ivory-200 dark:border-espresso-700">
          <div className="flex items-center gap-1.5 text-espresso-500 dark:text-espresso-400 text-xs mb-1 font-medium">
            <Calendar className="w-3.5 h-3.5 text-ochre-600 dark:text-ochre-400" />
            <span>Optimal Study Day</span>
          </div>
          {bestDayOfWeek ? (
            <>
              <p className="font-serif font-bold text-sm text-espresso-900 dark:text-ivory-100">
                {bestDayOfWeek.name}
              </p>
              <p className="text-[11px] text-espresso-400 dark:text-espresso-500 font-mono mt-0.5">
                {bestDayOfWeek.minutes}m recorded historically
              </p>
            </>
          ) : (
            <p className="text-xs text-espresso-400 italic">Evenly distributed</p>
          )}
        </div>

        {/* 4. Week-over-Week Momentum */}
        <div className="p-3.5 rounded-xl bg-ivory-50 dark:bg-espresso-800/60 border border-ivory-200 dark:border-espresso-700">
          <div className="flex items-center gap-1.5 text-espresso-500 dark:text-espresso-400 text-xs mb-1 font-medium">
            {weekComparison.percentageChange === null ? (
              <Minus className="w-3.5 h-3.5 text-espresso-400" />
            ) : weekComparison.differenceMinutes >= 0 ? (
              <TrendingUp className="w-3.5 h-3.5 text-sage-600 dark:text-sage-400" />
            ) : (
              <TrendingDown className="w-3.5 h-3.5 text-rose-500" />
            )}
            <span>Weekly Momentum</span>
          </div>
          {weekComparison.percentageChange !== null ? (
            <>
              <p
                className={`font-serif font-bold text-sm ${
                  weekComparison.differenceMinutes >= 0
                    ? 'text-sage-700 dark:text-sage-300'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {weekComparison.percentageChange >= 0 ? '+' : ''}
                {weekComparison.percentageChange}% vs prior week
              </p>
              <p className="text-[11px] text-espresso-400 dark:text-espresso-500 font-mono mt-0.5">
                {weekComparison.differenceMinutes >= 0 ? '+' : ''}
                {weekComparison.differenceMinutes}m difference
              </p>
            </>
          ) : (
            <>
              <p className="font-serif font-bold text-sm text-espresso-900 dark:text-ivory-100">
                Baseline Phase
              </p>
              <p className="text-[11px] text-espresso-400 dark:text-espresso-500 font-mono mt-0.5">
                First full 7-day period
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
