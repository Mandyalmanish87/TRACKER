import React, { useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { Card } from '../common/Card';
import { ProgressBar } from '../common/ProgressBar';
import {
  Dumbbell,
  Salad,
  CheckSquare,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { resolveSchedule, formatDateStr } from '../../utils/scheduleResolver';
import { isTaskOverdue } from '../../utils/plannerUtils';

export interface DayOSSummaryWidgetProps {
  onNavigateToDayOS?: () => void;
}

export const DayOSSummaryWidget: React.FC<DayOSSummaryWidgetProps> = ({ onNavigateToDayOS }) => {
  const { state } = useApp();

  const todayStr = useMemo(() => formatDateStr(new Date()), []);
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  // 1. Personal timetable classes for today
  const todayClasses = useMemo(() => {
    return resolveSchedule(
      state.timetable || [],
      state.occurrenceOverrides || [],
      state.extraClasses || [],
      now,
      now
    );
  }, [state.timetable, state.occurrenceOverrides, state.extraClasses]);

  // 2. Tasks completed vs pending
  const { completedTasksCount, pendingTasksCount } = useMemo(() => {
    const relevantTasks = (state.tasks || []).filter(
      (t) => t.dueDate === todayStr || (!t.dueDate && t.status !== 'done') || isTaskOverdue(t)
    );
    const completed = relevantTasks.filter((t) => t.status === 'done').length;
    const pending = relevantTasks.length - completed;
    return { completedTasksCount: completed, pendingTasksCount: pending };
  }, [state.tasks, todayStr]);

  // 3. Workout status
  const todayWorkout = (state.gymWorkouts || []).find((w) => w.date === todayStr);
  const workoutFinished = Boolean(todayWorkout?.completed);
  const workoutTitle = todayWorkout?.split || "Push / Pull / Legs Protocol";

  // 4. Nutrition progress
  const todayCalories = useMemo(() => {
    return (state.foodDiaryEntries || [])
      .filter((e) => e.date === todayStr)
      .reduce((acc, curr) => acc + (curr.calories || 0), 0);
  }, [state.foodDiaryEntries, todayStr]);

  const targetCalories = state.nutritionProfile?.targetCalories || 2200;
  const calPercent = Math.min(100, Math.round((todayCalories / targetCalories) * 100));

  // 5. Next upcoming activity
  const nextActivityTitle = useMemo(() => {
    // Find next class today
    const upcomingClass = todayClasses.find((c) => {
      const [h, m] = c.startTime.split(':').map(Number);
      return (h || 0) * 60 + (m || 0) >= currentMinutes;
    });

    if (upcomingClass) {
      const sub = state.subjects.find((s) => s.id === upcomingClass.subjectId);
      return `${upcomingClass.startTime} · ${sub?.name || 'Class'}`;
    }

    if (!workoutFinished) {
      return `Workout: ${workoutTitle}`;
    }

    if (pendingTasksCount > 0) {
      return `${pendingTasksCount} task${pendingTasksCount === 1 ? '' : 's'} pending`;
    }

    return 'Schedule up to date';
  }, [todayClasses, currentMinutes, state.subjects, workoutFinished, workoutTitle, pendingTasksCount]);

  return (
    <Card
      className="dayos-summary-widget-card"
      eyebrow="Personal Space Overview"
      title="DayOS Daily Briefing"
      action={
        onNavigateToDayOS && (
          <button
            onClick={onNavigateToDayOS}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-terracotta-600 hover:bg-terracotta-700 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
          >
            <span>Open DayOS</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )
      }
    >
      <p className="dayos-summary-lede">A live snapshot of your schedule, study tasks, training, and nutrition.</p>
      <div className="dayos-summary-kpis grid grid-cols-1 gap-3.5 pt-1">
        {/* Stat 1: Upcoming Activity */}
        <div className="p-3.5 rounded-xl bg-ivory-50 dark:bg-espresso-800/70 border border-ivory-200 dark:border-espresso-700 flex flex-col justify-between">
          <div className="flex items-center justify-between text-espresso-500 mb-1">
            <span className="text-[10px] font-mono uppercase font-bold text-terracotta-600 dark:text-terracotta-400">Next Activity</span>
            <Clock className="w-3.5 h-3.5 text-terracotta-600 dark:text-terracotta-400" />
          </div>
          <p className="font-serif text-sm font-bold text-espresso-950 dark:text-ivory-50 mt-1">
            {nextActivityTitle}
          </p>
          <p className="text-[11px] text-espresso-400 mt-1">
            {todayClasses.length} class{todayClasses.length === 1 ? '' : 'es'} in My Orbit
          </p>
        </div>

        {/* Stat 2: Tasks Completed vs Pending */}
        <div className="p-3.5 rounded-xl bg-ivory-50 dark:bg-espresso-800/70 border border-ivory-200 dark:border-espresso-700 flex flex-col justify-between">
          <div className="flex items-center justify-between text-espresso-500 mb-1">
            <span className="text-[10px] font-mono uppercase font-bold">Tasks &amp; Todos</span>
            <CheckSquare className="w-3.5 h-3.5 text-espresso-400" />
          </div>
          <p className="font-serif text-base font-bold text-espresso-950 dark:text-ivory-50 mt-1">
            {completedTasksCount} <span className="text-xs font-normal text-espresso-400">done · {pendingTasksCount} pending</span>
          </p>
          <div className="mt-2">
            <ProgressBar
              value={completedTasksCount + pendingTasksCount > 0 ? Math.round((completedTasksCount / (completedTasksCount + pendingTasksCount)) * 100) : 100}
              height="sm"
            />
          </div>
        </div>

        {/* Stat 3: Iron Lab Workout Status */}
        <div className="p-3.5 rounded-xl bg-ivory-50 dark:bg-espresso-800/70 border border-ivory-200 dark:border-espresso-700 flex flex-col justify-between">
          <div className="flex items-center justify-between text-espresso-500 mb-1">
            <span className="text-[10px] font-mono uppercase font-bold">Iron Lab Gym</span>
            <Dumbbell className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
          </div>
          <p className="font-serif text-sm font-bold text-espresso-950 dark:text-ivory-50 mt-1">
            {workoutTitle}
          </p>
          <p className="text-[11px] font-mono mt-1 font-semibold">
            {workoutFinished ? (
              <span className="text-sage-600 dark:text-sage-400">✓ Finished</span>
            ) : (
              <span className="text-amber-600 dark:text-amber-400">Pending Session</span>
            )}
          </p>
        </div>

        {/* Stat 4: Fuel OS Nutrition */}
        <div className="p-3.5 rounded-xl bg-ivory-50 dark:bg-espresso-800/70 border border-ivory-200 dark:border-espresso-700 flex flex-col justify-between">
          <div className="flex items-center justify-between text-espresso-500 mb-1">
            <span className="text-[10px] font-mono uppercase font-bold">Fuel OS Calories</span>
            <Salad className="w-3.5 h-3.5 text-sage-600 dark:text-sage-400" />
          </div>
          <p className="font-serif text-sm font-bold text-espresso-950 dark:text-ivory-50 mt-1">
            {todayCalories} <span className="text-xs font-normal text-espresso-400">/ {targetCalories} kcal</span>
          </p>
          <div className="mt-2">
            <ProgressBar value={calPercent} height="sm" />
          </div>
        </div>
      </div>
    </Card>
  );
};
