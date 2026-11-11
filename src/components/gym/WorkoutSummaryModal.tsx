import React from 'react';
import { WorkoutSession } from '../../types';
import { calculateWorkingVolume } from '../../utils/progressiveOverload';
import { Trophy, Clock, Dumbbell, Flame, CheckCircle, X } from 'lucide-react';
import { Button } from '../common/Button';

interface WorkoutSummaryModalProps {
  session: WorkoutSession | null;
  isOpen: boolean;
  onClose: () => void;
}

export const WorkoutSummaryModal: React.FC<WorkoutSummaryModalProps> = ({
  session,
  isOpen,
  onClose,
}) => {
  if (!isOpen || !session) return null;

  const volumeKg = calculateWorkingVolume(session);
  const duration = session.durationMinutes || 45;

  const workingSets = session.exercises.flatMap((ex) =>
    (ex.sets || []).filter((s) => s.completed && s.type !== 'warmup')
  );

  const prSets = session.exercises.flatMap((ex) =>
    (ex.sets || [])
      .filter((s) => s.isPersonalRecord)
      .map((s) => ({
        exerciseName: ex.exerciseName,
        weightKg: s.actualWeightKg,
        reps: s.actualReps,
      }))
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-espresso-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-espresso-900 border border-ivory-300 dark:border-espresso-750 shadow-2xl p-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-sage-100 dark:bg-sage-900/40 flex items-center justify-center text-sage-600 dark:text-sage-400">
              <Trophy className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs font-mono font-semibold uppercase tracking-wider text-sage-600 dark:text-sage-400">
                Session Complete
              </span>
              <h2 className="text-xl font-bold text-espresso-950 dark:text-ivory-50 tracking-tight">
                {session.splitName}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-espresso-400 hover:text-espresso-700 dark:hover:text-ivory-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3.5 rounded-xl bg-ivory-50 dark:bg-espresso-800/60 border border-ivory-200 dark:border-espresso-700 text-center">
            <div className="flex items-center justify-center gap-1 text-terracotta-600 dark:text-terracotta-400 mb-1">
              <Flame className="w-4 h-4" />
              <span className="text-[11px] font-semibold uppercase">Volume</span>
            </div>
            <p className="font-mono text-lg font-bold text-espresso-900 dark:text-ivory-50">
              {volumeKg.toLocaleString()} <span className="text-xs font-normal text-espresso-500">kg</span>
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-ivory-50 dark:bg-espresso-800/60 border border-ivory-200 dark:border-espresso-700 text-center">
            <div className="flex items-center justify-center gap-1 text-ochre-600 dark:text-ochre-400 mb-1">
              <Clock className="w-4 h-4" />
              <span className="text-[11px] font-semibold uppercase">Duration</span>
            </div>
            <p className="font-mono text-lg font-bold text-espresso-900 dark:text-ivory-50">
              {duration} <span className="text-xs font-normal text-espresso-500">min</span>
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-ivory-50 dark:bg-espresso-800/60 border border-ivory-200 dark:border-espresso-700 text-center">
            <div className="flex items-center justify-center gap-1 text-sage-600 dark:text-sage-400 mb-1">
              <Dumbbell className="w-4 h-4" />
              <span className="text-[11px] font-semibold uppercase">Sets</span>
            </div>
            <p className="font-mono text-lg font-bold text-espresso-900 dark:text-ivory-50">
              {workingSets.length} <span className="text-xs font-normal text-espresso-500">sets</span>
            </p>
          </div>
        </div>

        {/* Personal Records Broken */}
        {prSets.length > 0 ? (
          <div className="p-4 rounded-xl bg-ochre-50 dark:bg-ochre-900/20 border border-ochre-200 dark:border-ochre-800/50 space-y-2">
            <div className="flex items-center gap-2 text-ochre-800 dark:text-ochre-300 font-semibold text-xs">
              <Trophy className="w-4 h-4" />
              <span>{prSets.length} Personal Record{prSets.length > 1 ? 's' : ''} Broken!</span>
            </div>
            <div className="space-y-1.5">
              {prSets.map((pr, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs font-mono">
                  <span className="text-espresso-800 dark:text-ivory-200">{pr.exerciseName}</span>
                  <span className="font-bold text-ochre-700 dark:text-ochre-300">
                    {pr.weightKg}kg × {pr.reps} reps
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="p-3.5 rounded-xl bg-ivory-100 dark:bg-espresso-800/40 text-center">
            <p className="text-xs text-espresso-500 dark:text-espresso-400">
              Solid progressive stimulus logged. Keep building consistent progressive overload!
            </p>
          </div>
        )}

        {/* Exercises Executed */}
        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-espresso-500 dark:text-espresso-400">
            Completed Exercises
          </p>
          {session.exercises.map((ex, idx) => {
            const completedCount = (ex.sets || []).filter((s) => s.completed).length;
            return (
              <div
                key={idx}
                className="flex items-center justify-between p-2.5 rounded-lg border border-ivory-200 dark:border-espresso-750 bg-ivory-50/50 dark:bg-espresso-850 text-xs"
              >
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-3.5 h-3.5 text-sage-600 dark:text-sage-400" />
                  <span className="font-medium text-espresso-900 dark:text-ivory-100">
                    {ex.exerciseName}
                  </span>
                </div>
                <span className="font-mono text-espresso-500 dark:text-espresso-400">
                  {completedCount}/{ex.sets.length} sets
                </span>
              </div>
            );
          })}
        </div>

        <Button variant="primary" size="lg" className="w-full" onClick={onClose}>
          Save & Return to Lab
        </Button>
      </div>
    </div>
  );
};

