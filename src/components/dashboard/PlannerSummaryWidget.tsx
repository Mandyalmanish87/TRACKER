import React from 'react';
import {
  ListTodo,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { getDueTodayTasks, getOverdueTasks } from '../../utils/plannerUtils';
import { isReviewOverdue, isReviewDueToday } from '../../utils/spacedRepetitionUtils';
import { calculateDailyQuestionStats } from '../../utils/dailyQuestionsUtils';

interface PlannerSummaryWidgetProps {
  onNavigateToPlanner?: () => void;
}

export const PlannerSummaryWidget: React.FC<PlannerSummaryWidgetProps> = ({
  onNavigateToPlanner,
}) => {
  const { state, setTaskStatus, completeSpacedReview } = useApp();

  const tasks = state.tasks || [];
  const reviews = state.spacedReviews || [];
  const dailyQuestions = state.dailyQuestions || [];
  const target = state.dailyQuestionTarget ?? 25;

  const dueTodayTasks = getDueTodayTasks(tasks);
  const overdueTasks = getOverdueTasks(tasks);

  const dueReviews = reviews.filter((r) => isReviewOverdue(r) || isReviewDueToday(r));
  const upcomingReviews = reviews.filter((r) => !isReviewOverdue(r) && !isReviewDueToday(r));

  const questionStats = calculateDailyQuestionStats(dailyQuestions, target, new Date());

  return (
    <div className="p-5 sm:p-6 rounded-2xl border border-ivory-300 dark:border-espresso-750 bg-white dark:bg-espresso-850 shadow-subtle space-y-5">
      {/* Widget Header */}
      <div className="flex items-center justify-between pb-3 border-b border-ivory-200 dark:border-espresso-800">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-ivory-100 dark:bg-espresso-800 text-espresso-700 dark:text-ivory-200">
            <ListTodo className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-serif text-base font-bold text-espresso-950 dark:text-ivory-50">
              Planner & Spaced Learning
            </h3>
            <p className="text-xs text-espresso-500 dark:text-espresso-400">
              Tasks due today, upcoming reviews, and daily question goals
            </p>
          </div>
        </div>

        {onNavigateToPlanner && (
          <button
            onClick={onNavigateToPlanner}
            className="inline-flex items-center gap-1 text-xs font-semibold text-terracotta-600 dark:text-terracotta-400 hover:underline"
          >
            <span>Open Planner</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Overdue Alert if applicable */}
      {overdueTasks.length > 0 && (
        <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex items-center justify-between text-xs text-rose-700 dark:text-rose-300">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>
              <strong className="font-mono">{overdueTasks.length}</strong> overdue task
              {overdueTasks.length !== 1 ? 's' : ''} require completion
            </span>
          </div>
          {onNavigateToPlanner && (
            <button onClick={onNavigateToPlanner} className="underline text-[11px] font-semibold">
              Review
            </button>
          )}
        </div>
      )}

      {/* Grid: Tasks Due Today + Spaced Repetition + Daily Question Progress */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 1. Tasks Due Today */}
        <div className="p-3.5 rounded-xl border border-ivory-200 dark:border-espresso-750 bg-ivory-50/50 dark:bg-espresso-900/30 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-espresso-500 dark:text-espresso-400">
              Tasks Due Today
            </span>
            <span className="text-xs font-mono font-bold tabular-nums px-2 py-0.5 rounded-full bg-ivory-200 dark:bg-espresso-800 text-espresso-800 dark:text-ivory-200">
              {dueTodayTasks.length}
            </span>
          </div>

          {dueTodayTasks.length === 0 ? (
            <p className="text-xs text-espresso-400 italic py-2">No tasks due today.</p>
          ) : (
            <ul className="space-y-1.5 max-h-36 overflow-y-auto">
              {dueTodayTasks.slice(0, 3).map((task) => (
                <li
                  key={task.id}
                  className="flex items-center justify-between gap-2 text-xs py-1 px-2 rounded-lg bg-white dark:bg-espresso-800 border border-ivory-200 dark:border-espresso-700"
                >
                  <span className="truncate text-espresso-900 dark:text-ivory-100 font-medium">
                    {task.title}
                  </span>
                  <button
                    onClick={() => setTaskStatus(task.id, 'done')}
                    className="p-1 text-espresso-400 hover:text-sage-600 dark:hover:text-sage-400 shrink-0"
                    title="Mark done"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
              {dueTodayTasks.length > 3 && (
                <p className="text-[10px] text-espresso-400 italic text-center">
                  +{dueTodayTasks.length - 3} more in Planner
                </p>
              )}
            </ul>
          )}
        </div>

        {/* 2. Spaced Reviews */}
        <div className="p-3.5 rounded-xl border border-ivory-200 dark:border-espresso-750 bg-ivory-50/50 dark:bg-espresso-900/30 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-espresso-500 dark:text-espresso-400">
              Syllabus Reviews
            </span>
            <span className="text-xs font-mono font-bold tabular-nums px-2 py-0.5 rounded-full bg-ochre-100 dark:bg-ochre-900/40 text-ochre-700 dark:text-ochre-300">
              {dueReviews.length} Due
            </span>
          </div>

          {dueReviews.length === 0 ? (
            <div className="py-2 text-xs text-espresso-400">
              {upcomingReviews.length > 0 ? (
                <span>
                  Next review in {upcomingReviews[0].dueDate} ({upcomingReviews.length} scheduled)
                </span>
              ) : (
                <span className="italic">No active reviews scheduled.</span>
              )}
            </div>
          ) : (
            <ul className="space-y-1.5 max-h-36 overflow-y-auto">
              {dueReviews.slice(0, 2).map((rev) => (
                <li
                  key={rev.id}
                  className="flex items-center justify-between gap-2 text-xs py-1 px-2 rounded-lg bg-white dark:bg-espresso-800 border border-ivory-200 dark:border-espresso-700"
                >
                  <span className="truncate text-espresso-900 dark:text-ivory-100 font-medium">
                    {rev.topicName || 'Topic Review'}
                  </span>
                  <button
                    onClick={() => completeSpacedReview(rev.id)}
                    className="text-[10px] font-semibold text-sage-600 dark:text-sage-400 hover:underline shrink-0"
                  >
                    Done
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* 3. Daily Questions Progress */}
        <div className="p-3.5 rounded-xl border border-ivory-200 dark:border-espresso-750 bg-ivory-50/50 dark:bg-espresso-900/30 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-espresso-500 dark:text-espresso-400">
              Questions Goal
            </span>
            <span className="text-xs font-mono font-bold tabular-nums px-2 py-0.5 rounded-full bg-sage-100 dark:bg-sage-900/40 text-sage-700 dark:text-sage-300">
              {questionStats.todayAttempted}/{questionStats.todayTarget}
            </span>
          </div>

          <div>
            <div className="flex items-center justify-between text-xs text-espresso-600 dark:text-espresso-300 mb-1">
              <span>Today's Accuracy</span>
              <span className="font-mono font-bold">{questionStats.todayAccuracy}%</span>
            </div>
            <div className="w-full bg-ivory-200 dark:bg-espresso-800 h-2 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  questionStats.todayMetTarget ? 'bg-sage-500' : 'bg-terracotta-500'
                }`}
                style={{ width: `${questionStats.todayProgressPct}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-espresso-500 dark:text-espresso-400 mt-1.5">
              <span>{questionStats.currentStreak}d streak</span>
              <span>{questionStats.todayMetTarget ? 'Target met ✓' : 'In progress'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
