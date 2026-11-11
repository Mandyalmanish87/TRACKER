import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { SetType, ExerciseLibraryItem } from '../../types';
import { calculateWorkingVolume } from '../../utils/progressiveOverload';
import { ExerciseLibraryModal } from './ExerciseLibraryModal';
import { WorkoutSummaryModal } from './WorkoutSummaryModal';
import {
  Dumbbell,
  Clock,
  Flame,
  Plus,
  Trash2,
  Check,
  RefreshCw,
  Link,
  AlertTriangle,
  Minimize2,
} from 'lucide-react';
import { Button } from '../common/Button';

export const ActiveWorkoutModal: React.FC = () => {
  const {
    activeWorkout,
    isWorkoutModalMinimized,
    setWorkoutModalMinimized,
    updateActiveWorkoutSet,
    addActiveWorkoutSet,
    removeActiveWorkoutSet,
    addExerciseToActiveWorkout,
    substituteExerciseInActiveWorkout,
    completeActiveWorkout,
    discardActiveWorkout,
    linkSuperset,
  } = useApp();

  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [substitutingExerciseIndex, setSubstitutingExerciseIndex] = useState<number | null>(null);
  const [isDiscardConfirmOpen, setIsDiscardConfirmOpen] = useState(false);
  const [completedSessionToSummarize, setCompletedSessionToSummarize] = useState<any | null>(null);

  // Live stopwatch timer
  useEffect(() => {
    if (!activeWorkout || !activeWorkout.startTime) {
      setElapsedSeconds(0);
      return;
    }

    const startMs = new Date(activeWorkout.startTime).getTime();
    const interval = setInterval(() => {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startMs) / 1000)));
    }, 1000);

    return () => clearInterval(interval);
  }, [activeWorkout?.startTime]);

  if (!activeWorkout || isWorkoutModalMinimized) {
    if (completedSessionToSummarize) {
      return (
        <WorkoutSummaryModal
          session={completedSessionToSummarize}
          isOpen={Boolean(completedSessionToSummarize)}
          onClose={() => setCompletedSessionToSummarize(null)}
        />
      );
    }
    return null;
  }

  const formatStopwatch = (totalSec: number) => {
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (h > 0) {
      return `${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
    }
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const volumeKg = calculateWorkingVolume(activeWorkout);
  const totalCompletedSets = activeWorkout.exercises.reduce(
    (acc, ex) => acc + (ex.sets || []).filter((s) => s.completed).length,
    0
  );
  const totalSets = activeWorkout.exercises.reduce(
    (acc, ex) => acc + (ex.sets || []).length,
    0
  );

  const handleFinish = () => {
    const sessionSnapshot = { ...activeWorkout };
    completeActiveWorkout();
    setCompletedSessionToSummarize(sessionSnapshot);
  };

  const handleOpenSubstitute = (exerciseIndex: number) => {
    setSubstitutingExerciseIndex(exerciseIndex);
    setIsLibraryOpen(true);
  };

  const handleSelectFromLibrary = (exercise: ExerciseLibraryItem) => {
    if (substitutingExerciseIndex !== null) {
      substituteExerciseInActiveWorkout(substitutingExerciseIndex, exercise.id, exercise.name);
      setSubstitutingExerciseIndex(null);
    } else {
      addExerciseToActiveWorkout(exercise.id, exercise.name);
    }
  };

  const setTypeLabels: Record<SetType, { label: string; bg: string; text: string }> = {
    working: { label: 'Working', bg: 'bg-ivory-200 dark:bg-espresso-750', text: 'text-espresso-800 dark:text-ivory-200' },
    warmup: { label: 'Warmup', bg: 'bg-ochre-100 dark:bg-ochre-950/40', text: 'text-ochre-700 dark:text-ochre-300' },
    drop: { label: 'Drop', bg: 'bg-indigo-100 dark:bg-indigo-950/40', text: 'text-indigo-700 dark:text-indigo-300' },
    failure: { label: 'Failure', bg: 'bg-rose-100 dark:bg-rose-950/40', text: 'text-rose-700 dark:text-rose-300' },
    amrap: { label: 'AMRAP', bg: 'bg-emerald-100 dark:bg-emerald-950/40', text: 'text-emerald-700 dark:text-emerald-300' },
  };

  return (
    <>
      <div className="fixed inset-0 z-40 flex flex-col bg-ivory-50 dark:bg-espresso-900 overflow-hidden animate-in fade-in duration-200">
        {/* Top Sticky Header */}
        <div className="sticky top-0 z-10 p-4 sm:p-5 bg-white/90 dark:bg-espresso-950/90 backdrop-blur-md border-b border-ivory-200 dark:border-espresso-800 flex items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-terracotta-600 text-white flex items-center justify-center shrink-0">
              <Dumbbell className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-base sm:text-lg text-espresso-950 dark:text-ivory-50 truncate">
                  {activeWorkout.splitName}
                </h2>
                <span className="hidden sm:inline-flex px-2 py-0.5 rounded text-[10px] font-mono uppercase font-semibold bg-terracotta-100 dark:bg-terracotta-900/40 text-terracotta-700 dark:text-terracotta-300">
                  Live
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs font-mono text-espresso-500 dark:text-espresso-400 mt-0.5">
                <span className="flex items-center gap-1 text-espresso-800 dark:text-ivory-200 font-bold">
                  <Clock className="w-3.5 h-3.5 text-ochre-500" />
                  {formatStopwatch(elapsedSeconds)}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1 text-terracotta-600 dark:text-terracotta-400 font-bold">
                  <Flame className="w-3.5 h-3.5" />
                  {volumeKg.toLocaleString()} kg
                </span>
                <span>•</span>
                <span>{totalCompletedSets}/{totalSets} sets</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="secondary"
              size="sm"
              icon={<Minimize2 className="w-3.5 h-3.5" />}
              onClick={() => setWorkoutModalMinimized(true)}
              title="Minimize workout modal"
            >
              <span className="hidden sm:inline">Minimize</span>
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsDiscardConfirmOpen(true)}
              className="text-terracotta-600 dark:text-terracotta-400"
            >
              Discard
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={<Check className="w-4 h-4" />}
              onClick={handleFinish}
            >
              Finish
            </Button>
          </div>
        </div>

        {/* Exercises Container */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 max-w-4xl mx-auto w-full pb-32">
          {activeWorkout.exercises.map((exercise, exIdx) => {
            return (
              <div
                key={exercise.id}
                className="rounded-2xl border border-ivory-200 dark:border-espresso-750 bg-white dark:bg-espresso-850 shadow-subtle p-4 sm:p-5 space-y-4"
              >
                {/* Exercise Header */}
                <div className="flex items-center justify-between gap-3 border-b border-ivory-200 dark:border-espresso-750 pb-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm sm:text-base text-espresso-950 dark:text-ivory-50">
                        {exercise.exerciseName}
                      </span>
                      {exercise.supersetGroupId && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono uppercase bg-indigo-100 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 flex items-center gap-1">
                          <Link className="w-3 h-3" /> Superset
                        </span>
                      )}
                    </div>
                    {exercise.substitutionOriginalExerciseId && (
                      <p className="text-[11px] text-espresso-400 italic mt-0.5">
                        Substituted from original routine
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleOpenSubstitute(exIdx)}
                      title="Substitute Exercise"
                      className="p-1.5 rounded-lg text-espresso-400 hover:text-espresso-700 dark:hover:text-ivory-200 text-xs flex items-center gap-1 border border-ivory-200 dark:border-espresso-700 hover:bg-ivory-50 dark:hover:bg-espresso-800 transition-colors"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Swap</span>
                    </button>

                    {exIdx < activeWorkout.exercises.length - 1 && (
                      <button
                        onClick={() => linkSuperset(exIdx, exIdx + 1)}
                        title="Link Superset with next exercise"
                        className="p-1.5 rounded-lg text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 text-xs flex items-center gap-1 border border-indigo-200 dark:border-indigo-900 transition-colors"
                      >
                        <Link className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Superset</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Sets Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="text-[11px] font-mono uppercase text-espresso-400 border-b border-ivory-200 dark:border-espresso-800">
                        <th className="py-2 pr-2 w-12 text-center">Set</th>
                        <th className="py-2 pr-2 w-28">Type</th>
                        <th className="py-2 pr-2 w-24">Weight (kg)</th>
                        <th className="py-2 pr-2 w-20">Reps</th>
                        <th className="py-2 pr-2 w-20">RPE / RIR</th>
                        <th className="py-2 pr-2 w-12 text-center">Done</th>
                        <th className="py-2 w-10 text-center"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ivory-100 dark:divide-espresso-800">
                      {exercise.sets.map((set, setIdx) => {
                        const typeInfo = setTypeLabels[set.type] || setTypeLabels.working;

                        return (
                          <tr
                            key={set.id}
                            className={`transition-colors ${
                              set.completed
                                ? 'bg-sage-50/40 dark:bg-sage-950/20'
                                : 'hover:bg-ivory-50/50 dark:hover:bg-espresso-800/40'
                            }`}
                          >
                            {/* Set Number */}
                            <td className="py-2.5 pr-2 font-mono font-bold text-center text-espresso-700 dark:text-ivory-200">
                              {set.setNumber}
                            </td>

                            {/* Set Type Dropdown */}
                            <td className="py-2.5 pr-2">
                              <select
                                value={set.type}
                                onChange={(e) =>
                                  updateActiveWorkoutSet(exIdx, setIdx, {
                                    type: e.target.value as SetType,
                                  })
                                }
                                className={`px-2 py-1 rounded-lg text-xs font-mono font-medium border border-transparent focus:outline-none focus:ring-1 focus:ring-terracotta-500 ${typeInfo.bg} ${typeInfo.text}`}
                              >
                                <option value="working">Working</option>
                                <option value="warmup">Warmup</option>
                                <option value="drop">Drop</option>
                                <option value="failure">Failure</option>
                                <option value="amrap">AMRAP</option>
                              </select>
                            </td>

                            {/* Weight (kg) */}
                            <td className="py-2.5 pr-2">
                              <input
                                type="number"
                                step="0.5"
                                min="0"
                                value={set.actualWeightKg === 0 ? '' : set.actualWeightKg}
                                placeholder="0"
                                onChange={(e) =>
                                  updateActiveWorkoutSet(exIdx, setIdx, {
                                    actualWeightKg: parseFloat(e.target.value) || 0,
                                  })
                                }
                                className="w-20 px-2 py-1 rounded-lg font-mono text-center border border-ivory-300 dark:border-espresso-700 bg-white dark:bg-espresso-800 text-espresso-950 dark:text-ivory-50 focus:outline-none focus:ring-2 focus:ring-terracotta-500"
                              />
                            </td>

                            {/* Reps */}
                            <td className="py-2.5 pr-2">
                              <input
                                type="number"
                                min="0"
                                value={set.actualReps === 0 ? '' : set.actualReps}
                                placeholder="0"
                                onChange={(e) =>
                                  updateActiveWorkoutSet(exIdx, setIdx, {
                                    actualReps: parseInt(e.target.value, 10) || 0,
                                  })
                                }
                                className="w-16 px-2 py-1 rounded-lg font-mono text-center border border-ivory-300 dark:border-espresso-700 bg-white dark:bg-espresso-800 text-espresso-950 dark:text-ivory-50 focus:outline-none focus:ring-2 focus:ring-terracotta-500"
                              />
                            </td>

                            {/* RPE Selector */}
                            <td className="py-2.5 pr-2">
                              <select
                                value={set.rpe ?? ''}
                                onChange={(e) =>
                                  updateActiveWorkoutSet(exIdx, setIdx, {
                                    rpe: e.target.value ? parseFloat(e.target.value) : undefined,
                                  })
                                }
                                className="w-20 px-1.5 py-1 rounded-lg font-mono text-xs border border-ivory-300 dark:border-espresso-700 bg-white dark:bg-espresso-800 text-espresso-950 dark:text-ivory-50 focus:outline-none"
                              >
                                <option value="">RPE -</option>
                                <option value="6.0">@ 6.0</option>
                                <option value="7.0">@ 7.0</option>
                                <option value="7.5">@ 7.5</option>
                                <option value="8.0">@ 8.0</option>
                                <option value="8.5">@ 8.5</option>
                                <option value="9.0">@ 9.0</option>
                                <option value="9.5">@ 9.5</option>
                                <option value="10.0">@ 10.0</option>
                              </select>
                            </td>

                            {/* Checkmark Completion Button */}
                            <td className="py-2.5 pr-2 text-center">
                              <button
                                onClick={() =>
                                  updateActiveWorkoutSet(exIdx, setIdx, {
                                    completed: !set.completed,
                                  })
                                }
                                className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
                                  set.completed
                                    ? 'bg-sage-600 text-white shadow-sm'
                                    : 'border border-ivory-300 dark:border-espresso-700 hover:border-terracotta-400 text-espresso-400'
                                }`}
                              >
                                <Check className="w-4 h-4 stroke-[2.5]" />
                              </button>
                            </td>

                            {/* Delete Set */}
                            <td className="py-2.5 text-center">
                              <button
                                onClick={() => removeActiveWorkoutSet(exIdx, setIdx)}
                                className="p-1 rounded text-espresso-300 hover:text-rose-600 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Add Set Button */}
                <div className="pt-2 flex items-center justify-between">
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<Plus className="w-3.5 h-3.5" />}
                    onClick={() => addActiveWorkoutSet(exIdx, 'working')}
                  >
                    Add Set
                  </Button>
                </div>
              </div>
            );
          })}

          {/* Add Exercise Floating Button */}
          <div className="pt-2">
            <Button
              variant="secondary"
              size="lg"
              className="w-full border-dashed border-2 py-3.5"
              icon={<Plus className="w-4 h-4" />}
              onClick={() => {
                setSubstitutingExerciseIndex(null);
                setIsLibraryOpen(true);
              }}
            >
              Add Exercise to Session
            </Button>
          </div>
        </div>

        {/* Exercise Library Modal for Add / Swap */}
        <ExerciseLibraryModal
          isOpen={isLibraryOpen}
          onClose={() => setIsLibraryOpen(false)}
          onSelectExercise={handleSelectFromLibrary}
        />

        {/* Discard Confirmation Modal */}
        {isDiscardConfirmOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-espresso-950/70 backdrop-blur-sm animate-in fade-in">
            <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-espresso-900 border border-ivory-300 dark:border-espresso-750 p-6 space-y-4 shadow-2xl">
              <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950/40 text-rose-600 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-espresso-950 dark:text-ivory-50">
                  Discard Active Workout?
                </h3>
                <p className="text-xs text-espresso-500 dark:text-espresso-400 mt-1">
                  All logged sets and elapsed time for this session will be permanently erased.
                </p>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsDiscardConfirmOpen(false)}
                >
                  Continue Workout
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  className="bg-rose-600 hover:bg-rose-700 text-white"
                  onClick={() => {
                    discardActiveWorkout();
                    setIsDiscardConfirmOpen(false);
                  }}
                >
                  Discard
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};
