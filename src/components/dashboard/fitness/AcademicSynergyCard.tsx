import React, { useMemo } from 'react';
import { useApp } from '../../../context/AppContext';
import { Card } from '../../common/Card';
import {
  findOptimalWorkoutWindows,
  evaluateExamDeloadStatus,
} from '../../../utils/timetableFitnessSynergy';
import { BookOpen, Clock, Dumbbell } from 'lucide-react';

export const AcademicSynergyCard: React.FC = () => {
  const { state } = useApp();

  const freeWindows = useMemo(() => {
    return findOptimalWorkoutWindows(state.timetable || []);
  }, [state.timetable]);

  const examDeload = useMemo(() => {
    if (!state.profile?.examDate) return null;
    return evaluateExamDeloadStatus(state.profile.examDate);
  }, [state.profile?.examDate]);

  if (freeWindows.length === 0 && (!examDeload || !examDeload.isExamSoon)) {
    return null;
  }

  return (
    <Card
      eyebrow="Academic & Fitness Synergy"
      title="Intelligent DayOS Co-Optimization"
      subtitle="Timetable schedule alignment and cognitive fatigue prevention"
    >
      <div className="space-y-3">
        {/* Exam Deload Alert if within 7 days of exam */}
        {examDeload && examDeload.isExamSoon && (
          <div className="p-3.5 rounded-xl border border-ochre-200 dark:border-ochre-800/50 bg-ochre-50/70 dark:bg-ochre-950/20 text-xs space-y-1">
            <div className="flex items-center gap-2 font-bold text-ochre-800 dark:text-ochre-200">
              <BookOpen className="w-4 h-4 text-ochre-600" />
              <span>Exam Deload Protocol Recommended ({examDeload.daysRemaining} days remaining)</span>
            </div>
            <p className="text-espresso-600 dark:text-espresso-300">
              {examDeload.recommendation}
            </p>
          </div>
        )}

        {/* Free Workout Windows between classes */}
        {freeWindows.length > 0 && (
          <div className="space-y-2">
            <span className="text-[11px] font-mono uppercase text-espresso-400 font-semibold flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-terracotta-500" />
              Available Workout Blocks Between Lectures Today:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {freeWindows.slice(0, 2).map((windowItem: { startTime: string; endTime: string; durationMinutes: number }, idx: number) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl border border-ivory-200 dark:border-espresso-750 bg-white dark:bg-espresso-850 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2">
                    <Dumbbell className="w-3.5 h-3.5 text-terracotta-600 dark:text-terracotta-400" />
                    <span className="font-mono font-semibold text-espresso-900 dark:text-ivory-50">
                      {windowItem.startTime} - {windowItem.endTime}
                    </span>
                  </div>
                  <span className="font-mono text-[11px] text-espresso-500">
                    {windowItem.durationMinutes} min block
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};

