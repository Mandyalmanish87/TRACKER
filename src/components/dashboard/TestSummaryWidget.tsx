import React, { useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import {
  calculateScorePercentage,
  calculateAccuracyPercentage,
  calculateCategoryStats,
  detectRecurringWeaknesses,
} from '../../utils/testAnalytics';
import { Award, AlertTriangle, TrendingUp, ChevronRight, CheckCircle2 } from 'lucide-react';

interface TestSummaryWidgetProps {
  onNavigateToTests?: () => void;
}

export const TestSummaryWidget: React.FC<TestSummaryWidgetProps> = ({ onNavigateToTests }) => {
  const { state } = useApp();
  const mockTests = state.mockTests || [];
  const errorLogs = state.errorLogs || [];
  const syllabusSubjects = state.syllabusSubjects || [];

  // Sort tests by date desc
  const sortedTests = useMemo(() => {
    return [...mockTests].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [mockTests]);

  const latestTest = sortedTests[0];

  // Stats across all tests
  const stats = useMemo(() => {
    return calculateCategoryStats(mockTests, 'All');
  }, [mockTests]);

  // Weaknesses
  const recurringWeaknesses = useMemo(() => {
    return detectRecurringWeaknesses(errorLogs);
  }, [errorLogs]);

  const recurringCount = recurringWeaknesses.filter((w) => w.isRecurring).length;
  const unresolvedErrorCount = errorLogs.filter((e) => !e.resolved).length;

  // Helper to resolve chapter name
  const getChapterName = (chapterId: string): string => {
    for (const sub of syllabusSubjects) {
      const found = sub.chapters.find((c) => c.id === chapterId);
      if (found) return found.name;
    }
    return chapterId;
  };

  return (
    <div className="p-5 rounded-2xl border border-ivory-300 dark:border-espresso-750 bg-white dark:bg-espresso-850 shadow-subtle space-y-4">
      {/* Widget Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-xl bg-ivory-200 dark:bg-espresso-750 text-espresso-700 dark:text-espresso-300">
            <Award className="w-4 h-4" style={{ color: 'var(--accent)' }} />
          </div>
          <div>
            <h3 className="font-serif font-bold text-sm text-espresso-900 dark:text-ivory-100">
              Mock-Test & Weakness Radar
            </h3>
            <span className="text-[11px] text-espresso-400 dark:text-espresso-500">
              Exam readiness & error tracking
            </span>
          </div>
        </div>

        {onNavigateToTests && (
          <button
            onClick={onNavigateToTests}
            className="text-xs font-semibold text-terracotta-600 dark:text-terracotta-400 hover:underline flex items-center gap-0.5 cursor-pointer"
          >
            <span>Analytics</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Main Content */}
      {latestTest ? (
        <div className="space-y-3">
          {/* Latest Test Snippet */}
          <div className="p-3.5 rounded-xl bg-ivory-100/70 dark:bg-espresso-800/40 border border-ivory-200 dark:border-espresso-750/70 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-ivory-200 dark:bg-espresso-750 text-espresso-700 dark:text-espresso-300">
                Latest Test · {latestTest.category}
              </span>
              <span className="font-mono text-espresso-400 dark:text-espresso-500 text-[11px]">
                {latestTest.date}
              </span>
            </div>

            <p className="font-serif font-bold text-sm text-espresso-950 dark:text-ivory-50 truncate">
              {latestTest.title}
            </p>

            <div className="flex items-center justify-between text-xs pt-1">
              <div>
                <span className="text-espresso-400 dark:text-espresso-500 text-[11px]">Score: </span>
                <span className="font-bold text-espresso-900 dark:text-ivory-100 font-mono">
                  {calculateScorePercentage(latestTest.totalScore, latestTest.maxMarks)}%
                </span>
                <span className="text-espresso-400 dark:text-espresso-500 font-mono text-[10px] ml-1">
                  ({latestTest.totalScore}/{latestTest.maxMarks})
                </span>
              </div>

              <div>
                <span className="text-espresso-400 dark:text-espresso-500 text-[11px]">Accuracy: </span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                  {calculateAccuracyPercentage(latestTest.questionsCorrect, latestTest.questionsAttempted)}%
                </span>
              </div>

              {stats.movingAverage.length > 0 && (
                <div className="flex items-center gap-1 text-[11px] font-mono text-espresso-600 dark:text-espresso-300">
                  <TrendingUp className="w-3 h-3 text-terracotta-500" />
                  <span>3-Avg: <strong>{stats.movingAverage[stats.movingAverage.length - 1]}%</strong></span>
                </div>
              )}
            </div>
          </div>

          {/* Recurring Weakness Alert Callout */}
          {recurringCount > 0 ? (
            <div
              onClick={onNavigateToTests}
              className="p-3 rounded-xl border border-rose-300 dark:border-rose-800 bg-rose-50/80 dark:bg-rose-950/40 text-xs text-rose-900 dark:text-rose-200 cursor-pointer hover:bg-rose-100/80 dark:hover:bg-rose-900/40 transition-colors flex items-center justify-between gap-2"
            >
              <div className="flex items-center gap-2 truncate">
                <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                <span className="truncate">
                  <strong>{recurringCount} Recurring Weakness Zone{recurringCount > 1 ? 's' : ''}:</strong>{' '}
                  {recurringWeaknesses.find((w) => w.isRecurring)
                    ? getChapterName(recurringWeaknesses.find((w) => w.isRecurring)!.chapterId)
                    : ''}
                </span>
              </div>
              <span className="font-bold text-[11px] text-rose-600 dark:text-rose-400 shrink-0">
                Fix ➔
              </span>
            </div>
          ) : (
            <div className="flex items-center justify-between text-xs text-espresso-500 dark:text-espresso-400 px-1 pt-1">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                No recurring error clusters
              </span>
              <span className="font-mono text-[11px]">
                {unresolvedErrorCount} active mistake{unresolvedErrorCount === 1 ? '' : 's'}
              </span>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-4 text-xs text-espresso-400 dark:text-espresso-500">
          <p>No mock tests recorded yet.</p>
          {onNavigateToTests && (
            <button
              onClick={onNavigateToTests}
              className="mt-2 text-terracotta-600 dark:text-terracotta-400 font-semibold underline cursor-pointer"
            >
              Log your first test
            </button>
          )}
        </div>
      )}
    </div>
  );
};
