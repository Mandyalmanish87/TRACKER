import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import {
  calculateScorePercentage,
  calculateAccuracyPercentage,
  calculateCategoryStats,
  detectRecurringWeaknesses,
  ERROR_TYPES,
} from '../../utils/testAnalytics';
import type { ErrorType } from '../../types';
import {
  Award,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Plus,
  Trash2,
  ListTodo,
  TrendingUp,
  Brain,
  Filter,
  Check,
  ChevronRight,
  Sparkles,
} from 'lucide-react';

interface TestsViewProps {
  onNavigateToPlanner?: () => void;
}

export const TestsView: React.FC<TestsViewProps> = ({ onNavigateToPlanner }) => {
  const {
    state,
    addMockTest,
    deleteMockTest,
    addErrorLogEntry,
    deleteErrorLogEntry,
    resolveErrorLogEntry,
    convertErrorToPlannerTask,
  } = useApp();

  // Navigation tab within TestsView
  const [activeSubTab, setActiveSubTab] = useState<'analytics' | 'errors'>('analytics');

  // Filters for Analytics
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  // Filters for Error Log
  const [selectedErrorType, setSelectedErrorType] = useState<string>('All');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('All');
  const [showResolved, setShowResolved] = useState<boolean>(false);
  const [chapterFilter, setChapterFilter] = useState<string | null>(null);

  // Modals state
  const [isAddTestOpen, setIsAddTestOpen] = useState(false);
  const [isAddErrorOpen, setIsAddErrorOpen] = useState(false);
  const [feedbackToast, setFeedbackToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  // Test form state
  const [testTitle, setTestTitle] = useState('');
  const [testCategory, setTestCategory] = useState('Full Length Mock');
  const [customCategory, setCustomCategory] = useState('');
  const [testDate, setTestDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [testScore, setTestScore] = useState<string>('');
  const [testMaxMarks, setTestMaxMarks] = useState<string>('300');
  const [testAttempted, setTestAttempted] = useState<string>('');
  const [testCorrect, setTestCorrect] = useState<string>('');
  const [testNotes, setTestNotes] = useState('');

  // Error form state
  const [errorTitle, setErrorTitle] = useState('');
  const [errorSubjectId, setErrorSubjectId] = useState(() => state.syllabusSubjects?.[0]?.id || '');
  const [errorChapterId, setErrorChapterId] = useState('');
  const [errorType, setErrorType] = useState<ErrorType>('conceptual');
  const [errorDescription, setErrorDescription] = useState('');
  const [errorCorrectApproach, setErrorCorrectApproach] = useState('');
  const [errorMockTestId, setErrorMockTestId] = useState('');

  const showToast = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setFeedbackToast({ message, type });
    setTimeout(() => {
      setFeedbackToast(null);
    }, 4000);
  };

  const mockTests = state.mockTests || [];
  const errorLogs = state.errorLogs || [];
  const syllabusSubjects = state.syllabusSubjects || [];

  // Categories list
  const categories = useMemo(() => {
    const set = new Set<string>();
    mockTests.forEach((t) => {
      if (t.category) set.add(t.category);
    });
    return ['All', ...Array.from(set)];
  }, [mockTests]);

  // Analytics stats
  const analyticsStats = useMemo(() => {
    return calculateCategoryStats(mockTests, selectedCategory);
  }, [mockTests, selectedCategory]);

  // Filtered tests
  const filteredTests = useMemo(() => {
    let list = [...mockTests];
    if (selectedCategory !== 'All') {
      list = list.filter((t) => t.category === selectedCategory);
    }
    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [mockTests, selectedCategory]);

  // Trend series for chart
  const trendSeries = useMemo(() => {
    return [...filteredTests]
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map((t) => ({
        id: t.id,
        title: t.title,
        date: t.date,
        category: t.category,
        totalScore: t.totalScore,
        maxMarks: t.maxMarks,
        scorePct: calculateScorePercentage(t.totalScore, t.maxMarks),
        accuracyPct: calculateAccuracyPercentage(t.questionsCorrect, t.questionsAttempted),
      }));
  }, [filteredTests]);

  // Weakness detection
  const recurringWeaknesses = useMemo(() => {
    return detectRecurringWeaknesses(errorLogs);
  }, [errorLogs]);

  // Filtered errors
  const filteredErrors = useMemo(() => {
    let list = [...errorLogs];
    if (!showResolved) {
      list = list.filter((e) => !e.resolved);
    }
    if (selectedErrorType !== 'All') {
      list = list.filter((e) => e.errorType === selectedErrorType);
    }
    if (selectedSubjectId !== 'All') {
      list = list.filter((e) => e.subjectId === selectedSubjectId);
    }
    if (chapterFilter) {
      list = list.filter((e) => e.syllabusChapterId === chapterFilter);
    }
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [errorLogs, showResolved, selectedErrorType, selectedSubjectId, chapterFilter]);

  // Helper to find chapter name
  const getChapterName = (subjectId?: string, chapterId?: string): string => {
    if (!chapterId) return '';
    const subject = syllabusSubjects.find((s) => s.id === subjectId);
    if (!subject) {
      for (const sub of syllabusSubjects) {
        const found = sub.chapters.find((c) => c.id === chapterId);
        if (found) return found.name;
      }
      return chapterId;
    }
    const chap = subject.chapters.find((c) => c.id === chapterId);
    return chap ? chap.name : chapterId;
  };

  // Helper to find subject name
  const getSubjectName = (subjectId: string): string => {
    const s = syllabusSubjects.find((sub) => sub.id === subjectId);
    return s ? s.name : subjectId;
  };

  // Submit test
  const handleSaveTest = (e: React.FormEvent) => {
    e.preventDefault();
    const score = parseFloat(testScore) || 0;
    const maxMarks = parseFloat(testMaxMarks) || 100;
    const attempted = parseInt(testAttempted, 10) || 0;
    const correct = parseInt(testCorrect, 10) || 0;

    if (maxMarks <= 0) {
      showToast('Maximum marks must be greater than 0', 'error');
      return;
    }
    if (correct > attempted && attempted > 0) {
      showToast('Correct questions cannot exceed attempted questions', 'error');
      return;
    }

    const cat = testCategory === '__custom__' ? customCategory.trim() || 'Custom' : testCategory;

    addMockTest({
      title: testTitle.trim() || 'Mock Test',
      category: cat,
      date: testDate,
      totalScore: score,
      maxMarks,
      questionsAttempted: attempted,
      questionsCorrect: correct,
      notes: testNotes.trim() || undefined,
    });

    setIsAddTestOpen(false);
    setTestTitle('');
    setTestScore('');
    setTestAttempted('');
    setTestCorrect('');
    setTestNotes('');
    setCustomCategory('');
    showToast('Mock test score logged successfully!');
  };

  // Submit error
  const handleSaveError = (e: React.FormEvent) => {
    e.preventDefault();
    if (!errorTitle.trim()) {
      showToast('Please specify a title for the error', 'error');
      return;
    }

    addErrorLogEntry({
      title: errorTitle.trim(),
      subjectId: errorSubjectId,
      syllabusChapterId: errorChapterId || undefined,
      mockTestId: errorMockTestId || undefined,
      errorType,
      description: errorDescription.trim() || undefined,
      correctApproach: errorCorrectApproach.trim() || undefined,
      resolved: false,
    });

    setIsAddErrorOpen(false);
    setErrorTitle('');
    setErrorDescription('');
    setErrorCorrectApproach('');
    showToast('Error logged to Weakness Radar!');
  };

  // Convert error to planner task
  const handleConvertToTask = (errorId: string) => {
    const res = convertErrorToPlannerTask(errorId);
    if (res.success) {
      showToast(res.message || 'Task scheduled in Study Planner!', 'success');
    } else {
      showToast(res.message || 'Unable to schedule task', 'info');
    }
  };

  // Active subject's chapters for modal
  const modalSubjectChapters = useMemo(() => {
    const sub = syllabusSubjects.find((s) => s.id === errorSubjectId);
    return sub ? sub.chapters : [];
  }, [syllabusSubjects, errorSubjectId]);

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {feedbackToast && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 ${
            feedbackToast.type === 'error'
              ? 'bg-rose-50 dark:bg-rose-950/80 text-rose-800 dark:text-rose-200 border-rose-300 dark:border-rose-800'
              : feedbackToast.type === 'info'
              ? 'bg-amber-50 dark:bg-amber-950/80 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-800'
              : 'bg-emerald-50 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-200 border-emerald-300 dark:border-emerald-800'
          }`}
        >
          {feedbackToast.type === 'error' ? (
            <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          )}
          <span>{feedbackToast.message}</span>
        </div>
      )}

      {/* Header and Sub-tab switcher */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-ivory-300 dark:border-espresso-800 pb-6">
        <div>
          <span className="text-xs font-mono font-semibold uppercase tracking-wider text-terracotta-600 dark:text-terracotta-400">
            Performance &amp; Error Log
          </span>
          <h1 className="font-serif text-3xl sm:text-4xl font-normal text-espresso-950 dark:text-ivory-50 tracking-tight mt-1">
            Mock-Test Analytics &amp; Error Log
          </h1>
          <p className="text-xs sm:text-sm text-espresso-500 dark:text-espresso-400 mt-1">
            Track quantitative exam performance, classify mistakes, and systematically resolve recurring weaknesses.
          </p>
        </div>

        {/* Sub-tab pills */}
        <div className="flex items-center gap-1.5 bg-ivory-100 dark:bg-espresso-800 p-1 rounded-xl border border-ivory-300 dark:border-espresso-700 shrink-0">
          <button
            onClick={() => setActiveSubTab('analytics')}
            className={`px-3.5 sm:px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeSubTab === 'analytics'
                ? 'bg-white dark:bg-espresso-700 text-espresso-950 dark:text-ivory-50 shadow-subtle'
                : 'text-espresso-600 dark:text-espresso-300 hover:text-espresso-900 dark:hover:text-ivory-100'
            }`}
          >
            Mock-Test Analytics ({mockTests.length})
          </button>
          <button
            onClick={() => setActiveSubTab('errors')}
            className={`px-3.5 sm:px-4 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
              activeSubTab === 'errors'
                ? 'bg-white dark:bg-espresso-700 text-espresso-950 dark:text-ivory-50 shadow-subtle'
                : 'text-espresso-600 dark:text-espresso-300 hover:text-espresso-900 dark:hover:text-ivory-100'
            }`}
          >
            <span>Weakness Radar</span>
            {errorLogs.filter((e) => !e.resolved).length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono bg-rose-500 text-white font-bold tabular-nums">
                {errorLogs.filter((e) => !e.resolved).length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* SUB-TAB 1: MOCK-TEST ANALYTICS                                       */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeSubTab === 'analytics' && (
        <div className="space-y-6">
          {/* Top Controls: Category Pills & Log Test Button */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-mono font-semibold uppercase tracking-wider text-espresso-500 dark:text-espresso-400 mr-1 flex items-center gap-1">
                <Filter className="w-3.5 h-3.5" /> Category:
              </span>
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1 rounded-xl text-xs transition-colors ${
                    selectedCategory === cat
                      ? 'bg-espresso-900 text-ivory-50 dark:bg-ivory-100 dark:text-espresso-950 font-bold shadow-subtle'
                      : 'border border-ivory-300 dark:border-espresso-700 bg-white/70 dark:bg-espresso-850 text-espresso-700 dark:text-ivory-200 hover:bg-ivory-100 dark:hover:bg-espresso-800'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <button
              onClick={() => setIsAddTestOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white shadow-subtle transition hover:opacity-95"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              <Plus className="w-4 h-4" />
              <span>Log Mock Test</span>
            </button>
          </div>

          {/* Mixed Max Marks Cross-Category Guard Warning */}
          {analyticsStats.isMixedMaxMarks && (
            <div className="p-3.5 rounded-xl border border-amber-300 dark:border-amber-700/60 bg-amber-50/70 dark:bg-amber-950/30 flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-200">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">Normalized Comparison Guard:</span> Tests in this view have varying
                maximum marks (e.g. 100 vs 300). Metrics are calculated using normalized score percentages to ensure
                mathematically sound comparisons.
              </div>
            </div>
          )}

          {/* KPI Cards Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* Card 1: Tests Count */}
            <div className="p-4 rounded-2xl border border-ivory-300 dark:border-espresso-750 bg-white dark:bg-espresso-850 shadow-subtle">
              <span className="text-[11px] font-semibold uppercase font-mono text-espresso-500 dark:text-espresso-400">
                Tests Taken
              </span>
              <p className="font-serif text-2xl sm:text-3xl font-bold text-espresso-950 dark:text-ivory-50 mt-1 tabular-nums">
                {analyticsStats.count}
              </p>
              <span className="text-[11px] text-espresso-400 dark:text-espresso-500 mt-1 block">
                {selectedCategory === 'All' ? 'Across all categories' : selectedCategory}
              </span>
            </div>

            {/* Card 2: Average Score % */}
            <div className="p-4 rounded-2xl border border-ivory-300 dark:border-espresso-750 bg-white dark:bg-espresso-850 shadow-subtle">
              <span className="text-[11px] font-semibold uppercase font-mono text-espresso-500 dark:text-espresso-400">
                Average Score %
              </span>
              <p className="font-serif text-2xl sm:text-3xl font-bold text-espresso-950 dark:text-ivory-50 mt-1 tabular-nums flex items-baseline gap-1">
                {analyticsStats.avgScorePercentage}%
              </p>
              <span className="text-[11px] text-espresso-400 dark:text-espresso-500 mt-1 block">
                Score vs Max Marks
              </span>
            </div>

            {/* Card 3: Average Accuracy % */}
            <div className="p-4 rounded-2xl border border-ivory-300 dark:border-espresso-750 bg-white dark:bg-espresso-850 shadow-subtle">
              <span className="text-[11px] font-semibold uppercase font-mono text-espresso-500 dark:text-espresso-400">
                Average Accuracy %
              </span>
              <p className="font-serif text-2xl sm:text-3xl font-bold text-emerald-600 dark:text-emerald-400 mt-1 tabular-nums">
                {analyticsStats.avgAccuracy}%
              </p>
              <span className="text-[11px] text-espresso-400 dark:text-espresso-500 mt-1 block">
                Correct vs Attempted
              </span>
            </div>

            {/* Card 4: Moving Average & Best */}
            <div className="p-4 rounded-2xl border border-ivory-300 dark:border-espresso-750 bg-white dark:bg-espresso-850 shadow-subtle">
              <span className="text-[11px] font-semibold uppercase font-mono text-espresso-500 dark:text-espresso-400 flex items-center justify-between">
                <span>3-Test Trend</span>
                <TrendingUp className="w-3.5 h-3.5 text-indigo-500" />
              </span>
              <p className="font-serif text-2xl sm:text-3xl font-bold text-espresso-950 dark:text-ivory-50 mt-1 tabular-nums">
                {analyticsStats.movingAverage.length > 0
                  ? `${analyticsStats.movingAverage[analyticsStats.movingAverage.length - 1]}%`
                  : '—'}
              </p>
              <span className="text-[11px] text-espresso-400 dark:text-espresso-500 mt-1 block">
                Best: <strong className="text-espresso-700 dark:text-ivory-200">{analyticsStats.bestScorePercentage}%</strong>
              </span>
            </div>
          </div>

          {/* Chronological Score % Trend Chart */}
          {trendSeries.length > 0 && (
            <div className="p-5 rounded-2xl border border-ivory-300 dark:border-espresso-750 bg-white dark:bg-espresso-850 shadow-subtle space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-serif font-bold text-base text-espresso-900 dark:text-ivory-100 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-indigo-500" />
                    Score % Progression
                  </h3>
                  <p className="text-xs text-espresso-500 dark:text-espresso-400">
                    Chronological performance over time (Normalized Score %)
                  </p>
                </div>
              </div>

              {/* Visual Trend Bars */}
              <div className="space-y-3 pt-2">
                {trendSeries.map((item, idx) => (
                  <div key={item.id} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 truncate max-w-[70%]">
                        <span className="font-mono text-[11px] text-espresso-400 dark:text-espresso-500 shrink-0">
                          #{idx + 1} ({item.date})
                        </span>
                        <span className="font-medium text-espresso-800 dark:text-ivory-200 truncate">
                          {item.title}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-ivory-200 dark:bg-espresso-750 text-espresso-600 dark:text-espresso-300 shrink-0">
                          {item.category}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 font-mono text-[11px] shrink-0">
                        <span className="font-bold text-espresso-900 dark:text-ivory-100">
                          {item.scorePct}% ({item.totalScore}/{item.maxMarks})
                        </span>
                        <span className="text-emerald-600 dark:text-emerald-400">
                          Acc: {item.accuracyPct}%
                        </span>
                      </div>
                    </div>

                    <div className="w-full h-3 rounded-full bg-ivory-200 dark:bg-espresso-750 overflow-hidden flex">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(100, Math.max(0, item.scorePct))}%`,
                          backgroundColor:
                            item.scorePct >= 80 ? '#10b981' : item.scorePct >= 60 ? 'var(--accent)' : '#f59e0b',
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Test History List */}
          <div className="space-y-3">
            <h3 className="font-serif font-bold text-base text-espresso-900 dark:text-ivory-100">
              Mock Test History ({filteredTests.length})
            </h3>

            {filteredTests.length === 0 ? (
              <div className="text-center py-10 border border-dashed border-ivory-300 dark:border-espresso-750 rounded-2xl p-6">
                <Award className="w-10 h-10 mx-auto text-espresso-300 dark:text-espresso-600 mb-2" />
                <p className="text-sm font-medium text-espresso-600 dark:text-espresso-400">No mock tests recorded yet.</p>
                <button
                  onClick={() => setIsAddTestOpen(true)}
                  className="mt-3 px-4 py-2 rounded-xl text-xs font-semibold text-white shadow-subtle"
                  style={{ backgroundColor: 'var(--accent)' }}
                >
                  Log Your First Mock Test
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {filteredTests.map((test) => {
                  const scorePct = calculateScorePercentage(test.totalScore, test.maxMarks);
                  const accuracyPct = calculateAccuracyPercentage(test.questionsCorrect, test.questionsAttempted);

                  return (
                    <div
                      key={test.id}
                      className="p-4 rounded-2xl border border-ivory-300 dark:border-espresso-750 bg-white dark:bg-espresso-850 shadow-subtle hover:border-ivory-400 dark:hover:border-espresso-700 transition-all space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md bg-ivory-200 dark:bg-espresso-750 text-espresso-700 dark:text-espresso-300">
                              {test.category}
                            </span>
                            <span className="text-xs text-espresso-400 dark:text-espresso-500 flex items-center gap-1 font-mono">
                              <Calendar className="w-3 h-3" />
                              {test.date}
                            </span>
                          </div>
                          <h4 className="font-serif font-bold text-base text-espresso-950 dark:text-ivory-50 mt-1">
                            {test.title}
                          </h4>
                        </div>

                        <button
                          onClick={() => {
                            if (window.confirm(`Delete mock test "${test.title}"?`)) {
                              deleteMockTest(test.id);
                              showToast('Mock test deleted');
                            }
                          }}
                          className="p-1.5 rounded-lg text-espresso-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                          title="Delete test"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Score & Accuracy Badges */}
                      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-ivory-200 dark:border-espresso-750">
                        <div className="p-2 rounded-xl bg-ivory-100/60 dark:bg-espresso-800/40">
                          <span className="text-[10px] font-semibold uppercase text-espresso-400 dark:text-espresso-500 block">
                            Score
                          </span>
                          <span className="font-mono text-sm font-bold text-espresso-900 dark:text-ivory-100">
                            {test.totalScore} / {test.maxMarks}
                          </span>
                          <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 ml-1.5">
                            ({scorePct}%)
                          </span>
                        </div>

                        <div className="p-2 rounded-xl bg-ivory-100/60 dark:bg-espresso-800/40">
                          <span className="text-[10px] font-semibold uppercase text-espresso-400 dark:text-espresso-500 block">
                            Accuracy
                          </span>
                          <span className="font-mono text-sm font-bold text-espresso-900 dark:text-ivory-100">
                            {test.questionsCorrect} / {test.questionsAttempted}
                          </span>
                          <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 ml-1.5">
                            ({accuracyPct}%)
                          </span>
                        </div>
                      </div>

                      {test.notes && (
                        <p className="text-xs text-espresso-600 dark:text-espresso-400 italic bg-ivory-50 dark:bg-espresso-900/60 p-2.5 rounded-xl border border-ivory-200 dark:border-espresso-800">
                          "{test.notes}"
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* SUB-TAB 2: ERROR LOG & WEAKNESS RADAR                                */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeSubTab === 'errors' && (
        <div className="space-y-6">
          {/* Recurring Weakness Alert Banner (>= 3 errors in chapter) */}
          {recurringWeaknesses.some((w) => w.isRecurring) && (
            <div className="p-4 sm:p-5 rounded-2xl border-2 border-rose-400 dark:border-rose-700 bg-rose-50/80 dark:bg-rose-950/40 shadow-sm space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-rose-500 text-white shrink-0 mt-0.5">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-serif font-bold text-base text-rose-950 dark:text-rose-100">
                      Recurring Weakness Radar Alert
                    </h3>
                    <p className="text-xs text-rose-700 dark:text-rose-300 mt-0.5">
                      You have 3 or more unresolved mistakes concentrated in specific chapters. Target these high-frequency
                      error zones immediately.
                    </p>
                  </div>
                </div>

                {chapterFilter && (
                  <button
                    onClick={() => setChapterFilter(null)}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-white dark:bg-espresso-800 text-espresso-700 dark:text-ivory-200 border border-ivory-300 dark:border-espresso-700 hover:bg-ivory-100 shrink-0"
                  >
                    Clear Filter
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
                {recurringWeaknesses
                  .filter((w) => w.isRecurring)
                  .map((w) => {
                    const chapterName = getChapterName(undefined, w.chapterId);
                    const isFiltered = chapterFilter === w.chapterId;

                    return (
                      <div
                        key={w.chapterId}
                        className={`p-3 rounded-xl border transition-all cursor-pointer ${
                          isFiltered
                            ? 'bg-rose-200/60 dark:bg-rose-900/60 border-rose-500 dark:border-rose-400 font-semibold'
                            : 'bg-white/80 dark:bg-espresso-850 border-rose-200 dark:border-rose-800/60 hover:border-rose-400'
                        }`}
                        onClick={() => setChapterFilter(isFiltered ? null : w.chapterId)}
                      >
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="font-bold text-rose-900 dark:text-rose-200 truncate">
                            {chapterName || w.chapterId}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500 text-white shrink-0">
                            {w.errorCount} mistakes
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-rose-600 dark:text-rose-400">
                          <span>{isFiltered ? '● Viewing filtered' : 'Click to filter mistakes'}</span>
                          <ChevronRight className="w-3 h-3" />
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Top Controls: Error Types & Filters */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-semibold text-espresso-500 dark:text-espresso-400 mr-1 flex items-center gap-1">
                <Brain className="w-3.5 h-3.5" /> Type:
              </span>
              <button
                onClick={() => setSelectedErrorType('All')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                  selectedErrorType === 'All'
                    ? 'bg-espresso-800 text-white dark:bg-ivory-200 dark:text-espresso-900'
                    : 'bg-ivory-200 dark:bg-espresso-800 text-espresso-600 dark:text-espresso-300'
                }`}
              >
                All
              </button>
              {ERROR_TYPES.map((t) => (
                <button
                  key={t.type}
                  onClick={() => setSelectedErrorType(t.type)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                    selectedErrorType === t.type
                      ? 'bg-espresso-800 text-white dark:bg-ivory-200 dark:text-espresso-900'
                      : 'bg-ivory-200 dark:bg-espresso-800 text-espresso-600 dark:text-espresso-300'
                  }`}
                >
                  {t.label}
                </button>
              ))}

              {/* Subject selector */}
              {syllabusSubjects.length > 0 && (
                <div className="flex items-center gap-1 ml-2">
                  <span className="text-xs font-semibold text-espresso-500 dark:text-espresso-400">Subject:</span>
                  <select
                    value={selectedSubjectId}
                    onChange={(e) => setSelectedSubjectId(e.target.value)}
                    className="px-2 py-1 rounded-lg text-xs border border-ivory-300 dark:border-espresso-750 bg-ivory-100 dark:bg-espresso-800 text-espresso-800 dark:text-ivory-100"
                  >
                    <option value="All">All Subjects</option>
                    {syllabusSubjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5 text-xs text-espresso-600 dark:text-espresso-400 cursor-pointer mr-2">
                <input
                  type="checkbox"
                  checked={showResolved}
                  onChange={(e) => setShowResolved(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-0"
                />
                <span>Show Resolved</span>
              </label>

              <button
                onClick={() => setIsAddErrorOpen(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-medium text-white shadow-subtle hover:brightness-105 transition-all"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                <Plus className="w-4 h-4" />
                <span>Log Mistake</span>
              </button>
            </div>
          </div>

          {/* Error Cards Grid */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-espresso-500 dark:text-espresso-400">
              <span>
                Showing {filteredErrors.length} mistake{filteredErrors.length === 1 ? '' : 's'}
                {chapterFilter ? ` in selected chapter` : ''}
              </span>
              {chapterFilter && (
                <button
                  onClick={() => setChapterFilter(null)}
                  className="text-xs text-indigo-600 dark:text-indigo-400 underline font-medium"
                >
                  Clear chapter filter
                </button>
              )}
            </div>

            {filteredErrors.length === 0 ? (
              <div className="text-center py-10 border border-dashed border-ivory-300 dark:border-espresso-750 rounded-2xl p-6">
                <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-500 mb-2" />
                <p className="text-sm font-medium text-espresso-700 dark:text-ivory-200">
                  {showResolved ? 'No error log entries found.' : 'All clear! No unresolved errors in this view.'}
                </p>
                <button
                  onClick={() => setIsAddErrorOpen(true)}
                  className="mt-3 px-4 py-2 rounded-xl text-xs font-semibold text-white shadow-subtle"
                  style={{ backgroundColor: 'var(--accent)' }}
                >
                  Log a Mistake
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredErrors.map((error) => {
                  const errorTypeMeta = ERROR_TYPES.find((t) => t.type === error.errorType) || ERROR_TYPES[0];
                  const chapterName = getChapterName(error.subjectId, error.syllabusChapterId);
                  const subjectName = getSubjectName(error.subjectId);

                  // Check if this error is already converted to a planner task
                  const linkedTask = (state.tasks || []).find((t) => t.errorLogId === error.id);

                  return (
                    <div
                      key={error.id}
                      className={`p-4 sm:p-5 rounded-2xl border transition-all ${
                        error.resolved
                          ? 'border-ivory-200 dark:border-espresso-800 bg-ivory-50/60 dark:bg-espresso-900/40 opacity-75'
                          : 'border-ivory-300 dark:border-espresso-750 bg-white dark:bg-espresso-850 shadow-subtle'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                        <div className="space-y-1.5 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            {/* Error Type Badge */}
                            <span
                              className={`text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${errorTypeMeta.badgeColor} ${errorTypeMeta.darkBadgeColor}`}
                            >
                              {errorTypeMeta.icon} {errorTypeMeta.label}
                            </span>

                            {/* Subject & Chapter Badges */}
                            <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-ivory-200 dark:bg-espresso-750 text-espresso-700 dark:text-espresso-300">
                              {subjectName}
                            </span>

                            {chapterName && (
                              <span className="text-[11px] font-mono text-espresso-500 dark:text-espresso-400">
                                ➔ {chapterName}
                              </span>
                            )}

                            {error.resolved && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                                Resolved
                              </span>
                            )}
                          </div>

                          <h4 className="font-serif font-bold text-base text-espresso-950 dark:text-ivory-50">
                            {error.title}
                          </h4>
                        </div>

                        {/* Top-Right Action Controls */}
                        <div className="flex items-center gap-2 shrink-0">
                          {/* 1-Click Study Planner Bridge */}
                          <button
                            onClick={() => {
                              if (linkedTask && onNavigateToPlanner) {
                                onNavigateToPlanner();
                              } else {
                                handleConvertToTask(error.id);
                              }
                            }}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                              linkedTask
                                ? 'bg-ivory-200 dark:bg-espresso-800 text-espresso-600 dark:text-espresso-300 hover:bg-ivory-300 cursor-pointer'
                                : 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/60'
                            }`}
                            title={linkedTask ? 'View in Study Planner' : 'Schedule revision task in Study Planner'}
                          >
                            <ListTodo className="w-3.5 h-3.5" />
                            <span>{linkedTask ? 'View Task ➔' : '1-Click Revision Task'}</span>
                          </button>

                          {/* Resolve / Reopen toggle */}
                          <button
                            onClick={() => {
                              resolveErrorLogEntry(error.id, !error.resolved);
                              showToast(error.resolved ? 'Mistake reopened' : 'Mistake marked as resolved!', 'success');
                            }}
                            className={`p-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1 transition-colors ${
                              error.resolved
                                ? 'border-ivory-300 dark:border-espresso-750 text-espresso-600 dark:text-espresso-300 hover:bg-ivory-200'
                                : 'border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                            }`}
                            title={error.resolved ? 'Reopen mistake' : 'Mark as resolved'}
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">{error.resolved ? 'Reopen' : 'Resolve'}</span>
                          </button>

                          {/* Delete button */}
                          <button
                            onClick={() => {
                              if (window.confirm(`Delete mistake log "${error.title}"?`)) {
                                deleteErrorLogEntry(error.id);
                                showToast('Mistake log deleted');
                              }
                            }}
                            className="p-1.5 rounded-lg text-espresso-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                            title="Delete mistake"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Mistake Description & Correct Approach Boxes */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3">
                        {error.description && (
                          <div className="p-3 rounded-xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200/60 dark:border-rose-900/40 text-xs space-y-1">
                            <span className="font-semibold text-rose-800 dark:text-rose-300 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                              What Went Wrong:
                            </span>
                            <p className="text-espresso-700 dark:text-ivory-200 leading-relaxed">
                              {error.description}
                            </p>
                          </div>
                        )}

                        {error.correctApproach && (
                          <div className="p-3 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40 text-xs space-y-1">
                            <span className="font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-1">
                              <Sparkles className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                              Correct Approach & Key Takeaway:
                            </span>
                            <p className="text-espresso-700 dark:text-ivory-200 leading-relaxed">
                              {error.correctApproach}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Footer: Reviewed count & date */}
                      <div className="flex items-center justify-between text-[11px] text-espresso-400 dark:text-espresso-500 pt-3 border-t border-ivory-200 dark:border-espresso-750/60 mt-3 font-mono">
                        <span>Reviewed: {error.reviewedCount || 0} times</span>
                        {error.lastReviewedAt && (
                          <span>Last: {new Date(error.lastReviewedAt).toLocaleDateString()}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* MODAL: LOG MOCK TEST                                                */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {isAddTestOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-espresso-850 rounded-2xl border border-ivory-300 dark:border-espresso-700 max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-ivory-200 dark:border-espresso-750 pb-3">
              <h3 className="font-serif font-bold text-lg text-espresso-950 dark:text-ivory-50 flex items-center gap-2">
                <Award className="w-5 h-5 text-indigo-500" />
                Log Mock Test Performance
              </h3>
              <button
                onClick={() => setIsAddTestOpen(false)}
                className="text-espresso-400 hover:text-espresso-700 dark:hover:text-ivory-200 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveTest} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-espresso-600 dark:text-espresso-300 block mb-1">
                  Test Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Full Length Mock 3, Algorithms Quiz 2"
                  value={testTitle}
                  onChange={(e) => setTestTitle(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl text-sm border border-ivory-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-900 text-espresso-900 dark:text-ivory-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-espresso-600 dark:text-espresso-300 block mb-1">
                    Category
                  </label>
                  <select
                    value={testCategory}
                    onChange={(e) => setTestCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-sm border border-ivory-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-900 text-espresso-900 dark:text-ivory-100 focus:outline-none"
                  >
                    <option value="Full Length Mock">Full Length Mock</option>
                    <option value="Mid-Semester Exam">Mid-Semester Exam</option>
                    <option value="Chapter Test">Chapter Test</option>
                    <option value="Subject Test">Subject Test</option>
                    <option value="__custom__">+ Custom Category</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-espresso-600 dark:text-espresso-300 block mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    required
                    value={testDate}
                    onChange={(e) => setTestDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-sm border border-ivory-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-900 text-espresso-900 dark:text-ivory-100 focus:outline-none"
                  />
                </div>
              </div>

              {testCategory === '__custom__' && (
                <div>
                  <label className="text-xs font-semibold text-espresso-600 dark:text-espresso-300 block mb-1">
                    Custom Category Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Unit Assessment"
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl text-sm border border-ivory-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-900 text-espresso-900 dark:text-ivory-100 focus:outline-none"
                  />
                </div>
              )}

              {/* Score & Max Marks */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-espresso-600 dark:text-espresso-300 block mb-1">
                    Total Score *
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder="e.g. 210"
                    value={testScore}
                    onChange={(e) => setTestScore(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl text-sm border border-ivory-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-900 text-espresso-900 dark:text-ivory-100 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-espresso-600 dark:text-espresso-300 block mb-1">
                    Maximum Marks *
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder="e.g. 300"
                    value={testMaxMarks}
                    onChange={(e) => setTestMaxMarks(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl text-sm border border-ivory-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-900 text-espresso-900 dark:text-ivory-100 focus:outline-none"
                  />
                </div>
              </div>

              {/* Attempted & Correct Questions */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-espresso-600 dark:text-espresso-300 block mb-1">
                    Questions Attempted
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 70"
                    value={testAttempted}
                    onChange={(e) => setTestAttempted(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl text-sm border border-ivory-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-900 text-espresso-900 dark:text-ivory-100 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-espresso-600 dark:text-espresso-300 block mb-1">
                    Questions Correct
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 62"
                    value={testCorrect}
                    onChange={(e) => setTestCorrect(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl text-sm border border-ivory-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-900 text-espresso-900 dark:text-ivory-100 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-espresso-600 dark:text-espresso-300 block mb-1">
                  Analysis Notes / Reflection
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Good pacing in section 1, ran short of time on tree algorithms..."
                  value={testNotes}
                  onChange={(e) => setTestNotes(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl text-sm border border-ivory-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-900 text-espresso-900 dark:text-ivory-100 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-ivory-200 dark:border-espresso-750">
                <button
                  type="button"
                  onClick={() => setIsAddTestOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs sm:text-sm font-medium text-espresso-600 dark:text-espresso-300 hover:bg-ivory-200 dark:hover:bg-espresso-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs sm:text-sm font-medium text-white shadow-subtle"
                  style={{ backgroundColor: 'var(--accent)' }}
                >
                  Save Test
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* MODAL: LOG MISTAKE TO ERROR RADAR                                   */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {isAddErrorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-espresso-850 rounded-2xl border border-ivory-300 dark:border-espresso-700 max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-ivory-200 dark:border-espresso-750 pb-3">
              <h3 className="font-serif font-bold text-lg text-espresso-950 dark:text-ivory-50 flex items-center gap-2">
                <Brain className="w-5 h-5 text-indigo-500" />
                Log Mistake to Weakness Radar
              </h3>
              <button
                onClick={() => setIsAddErrorOpen(false)}
                className="text-espresso-400 hover:text-espresso-700 dark:hover:text-ivory-200 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveError} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-espresso-600 dark:text-espresso-300 block mb-1">
                  Mistake Title / Topic *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Off-by-one in binary search boundary condition"
                  value={errorTitle}
                  onChange={(e) => setErrorTitle(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl text-sm border border-ivory-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-900 text-espresso-900 dark:text-ivory-100 focus:outline-none"
                />
              </div>

              {/* Subject & Chapter Linkage */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-espresso-600 dark:text-espresso-300 block mb-1">
                    Subject *
                  </label>
                  <select
                    value={errorSubjectId}
                    onChange={(e) => {
                      setErrorSubjectId(e.target.value);
                      setErrorChapterId('');
                    }}
                    className="w-full px-3 py-2 rounded-xl text-sm border border-ivory-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-900 text-espresso-900 dark:text-ivory-100 focus:outline-none"
                  >
                    {syllabusSubjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-espresso-600 dark:text-espresso-300 block mb-1">
                    Syllabus Chapter
                  </label>
                  <select
                    value={errorChapterId}
                    onChange={(e) => setErrorChapterId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-sm border border-ivory-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-900 text-espresso-900 dark:text-ivory-100 focus:outline-none"
                  >
                    <option value="">(Select Chapter)</option>
                    {modalSubjectChapters.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Error Type Selector */}
              <div>
                <label className="text-xs font-semibold text-espresso-600 dark:text-espresso-300 block mb-1.5">
                  Error Classification *
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {ERROR_TYPES.map((t) => (
                    <button
                      key={t.type}
                      type="button"
                      onClick={() => setErrorType(t.type)}
                      className={`p-2 rounded-xl border text-xs font-medium text-left transition-all ${
                        errorType === t.type
                          ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-950 dark:text-indigo-200 font-semibold shadow-xs ring-1 ring-indigo-400'
                          : 'border-ivory-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-900 text-espresso-700 dark:text-espresso-300 hover:bg-ivory-100'
                      }`}
                    >
                      <div className="font-bold text-[11px] truncate">{t.label}</div>
                      <div className="text-[10px] text-espresso-400 dark:text-espresso-500 truncate mt-0.5">
                        {t.description}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* What went wrong */}
              <div>
                <label className="text-xs font-semibold text-espresso-600 dark:text-espresso-300 block mb-1">
                  What Went Wrong / Mistake Description
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Used low < high instead of low <= high, prematurely exiting before checking single-element range..."
                  value={errorDescription}
                  onChange={(e) => setErrorDescription(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl text-sm border border-ivory-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-900 text-espresso-900 dark:text-ivory-100 focus:outline-none"
                />
              </div>

              {/* Correct approach */}
              <div>
                <label className="text-xs font-semibold text-espresso-600 dark:text-espresso-300 block mb-1">
                  Correct Approach & Key Takeaway
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Keep inclusive invariant [low, high] with update high = mid - 1..."
                  value={errorCorrectApproach}
                  onChange={(e) => setErrorCorrectApproach(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl text-sm border border-ivory-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-900 text-espresso-900 dark:text-ivory-100 focus:outline-none"
                />
              </div>

              {/* Optional Mock Test linkage */}
              {mockTests.length > 0 && (
                <div>
                  <label className="text-xs font-semibold text-espresso-600 dark:text-espresso-300 block mb-1">
                    Originating Mock Test (Optional)
                  </label>
                  <select
                    value={errorMockTestId}
                    onChange={(e) => setErrorMockTestId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-sm border border-ivory-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-900 text-espresso-900 dark:text-ivory-100 focus:outline-none"
                  >
                    <option value="">None / Standalone Mistake</option>
                    {mockTests.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title} ({t.date})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-ivory-200 dark:border-espresso-750">
                <button
                  type="button"
                  onClick={() => setIsAddErrorOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs sm:text-sm font-medium text-espresso-600 dark:text-espresso-300 hover:bg-ivory-200 dark:hover:bg-espresso-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs sm:text-sm font-medium text-white shadow-subtle"
                  style={{ backgroundColor: 'var(--accent)' }}
                >
                  Save to Radar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

