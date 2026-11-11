import React, { useState } from 'react';
import { DetailedMuscle, MuscleTrainingMetric, HeatmapMode } from '../../types/muscleAnatomy';
import { getMuscleHeatmapColor } from '../../utils/muscleHeatmapEngine';
import BUILTIN_EXERCISES from '../../data/exerciseLibrary.json';
import { ExerciseLibraryItem } from '../../types/fitness';
import {
  X,
  Flame,
  Calendar,
  Activity,
  Dumbbell,
  Clock,
} from 'lucide-react';

interface MuscleDetailDrawerProps {
  muscle: DetailedMuscle | null;
  metric: MuscleTrainingMetric | undefined;
  mode: HeatmapMode;
  onClose: () => void;
  onSelectRelatedExercise?: (exerciseId: string) => void;
}

export const MuscleDetailDrawer: React.FC<MuscleDetailDrawerProps> = ({
  muscle,
  metric,
  mode,
  onClose,
  onSelectRelatedExercise,
}) => {
  const [timeFilter, setTimeFilter] = useState<'7d' | '30d' | '90d' | 'all'>('7d');

  if (!muscle) return null;

  const colorInfo = getMuscleHeatmapColor(metric, mode);
  const totalSets = metric ? metric.effectiveSets : 0;
  const totalReps = metric ? metric.totalReps : 0;
  const totalVol = metric ? metric.totalVolumeKg : 0;
  const sessionsCount = metric ? metric.sessionsCount : 0;
  const recoveryPct = metric ? metric.recoveryPercentage : 100;
  const allExercises = BUILTIN_EXERCISES as unknown as ExerciseLibraryItem[];
  const regionGroups: Record<string, string[]> = {
    chest: ['chest'], shoulders: ['shoulders', 'front_delts', 'side_delts', 'rear_delts'],
    arms: ['biceps', 'triceps', 'forearms'], back: ['back', 'lats', 'traps', 'upper_back', 'lower_back'],
    core: ['abs', 'core', 'obliques'], hips: ['glutes', 'adductors', 'abductors'],
    legs: ['quads', 'hamstrings', 'glutes', 'calves'], neck: ['traps', 'upper_back'], calves: ['calves'],
  };
  const region = muscle.region.toLowerCase();
  const targets = regionGroups[region] || [region];
  const recommendedExercises = allExercises
    .map((exercise) => ({ exercise, score: (targets.includes(exercise.primaryMuscle) ? 3 : 0) +
      exercise.secondaryMuscles.filter((group) => targets.includes(group)).length }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.exercise.name.localeCompare(b.exercise.name))
    .slice(0, 4)
    .map(({ exercise }) => exercise);

  return (
    <div className="p-5 bg-white dark:bg-espresso-850 rounded-2xl border border-ivory-300 dark:border-espresso-750 shadow-lg space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-200">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 border-b border-ivory-200 dark:border-espresso-750 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span
              className="w-3.5 h-3.5 rounded-full shrink-0 shadow-xs"
              style={{ backgroundColor: colorInfo.hex }}
            />
            <span className="text-[11px] font-mono uppercase tracking-wider font-bold text-terracotta-600 dark:text-terracotta-400">
              {muscle.region} · {muscle.side.toUpperCase()}
            </span>
          </div>
          <h3 className="font-serif text-xl sm:text-2xl font-bold text-espresso-950 dark:text-ivory-50 mt-1">
            {muscle.name}
          </h3>
          <p className="text-xs text-espresso-600 dark:text-espresso-400 font-medium">
            Commonly: {muscle.commonName}
          </p>
        </div>

        <button
          onClick={onClose}
          className="p-1.5 rounded-xl text-espresso-400 hover:text-espresso-700 dark:text-espresso-500 dark:hover:text-ivory-200 hover:bg-ivory-100 dark:hover:bg-espresso-800 transition"
          aria-label="Close muscle details"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Description & Anatomy Actions */}
      <div className="p-3.5 rounded-xl bg-ivory-50 dark:bg-espresso-900/60 border border-ivory-200 dark:border-espresso-800 text-xs text-espresso-700 dark:text-espresso-300 space-y-1.5">
        <p className="leading-relaxed">{muscle.description}</p>
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="font-mono text-[10px] uppercase font-bold text-espresso-400">Actions:</span>
          {muscle.primaryActions.map((act) => (
            <span
              key={act}
              className="px-2 py-0.5 rounded-md bg-ivory-200/80 dark:bg-espresso-800 text-[11px] font-medium text-espresso-800 dark:text-ivory-200"
            >
              {act}
            </span>
          ))}
        </div>
      </div>

      {/* Time Filter Pills */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-mono font-semibold uppercase text-espresso-500 dark:text-espresso-400">
          Historical Timeframe:
        </span>
        <div className="inline-flex rounded-xl p-0.5 bg-ivory-100 dark:bg-espresso-800 border border-ivory-200 dark:border-espresso-700">
          {(['7d', '30d', '90d', 'all'] as const).map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeFilter(tf)}
              className={`px-2.5 py-1 text-xs rounded-lg font-semibold transition ${
                timeFilter === tf
                  ? 'bg-espresso-900 text-white dark:bg-ivory-100 dark:text-espresso-950 shadow-xs'
                  : 'text-espresso-600 dark:text-espresso-400 hover:text-espresso-950 dark:hover:text-ivory-100'
              }`}
            >
              {tf.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Current Working Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
        <div className="p-3 rounded-xl bg-ivory-100 dark:bg-espresso-800 border border-ivory-200 dark:border-espresso-700">
          <div className="flex items-center justify-center gap-1 text-espresso-400 mb-0.5">
            <Flame className="w-3.5 h-3.5" />
            <span className="text-[10px] font-mono uppercase tracking-wider">Volume</span>
          </div>
          <span className="font-serif text-lg font-bold text-espresso-950 dark:text-ivory-50 tabular-nums">
            {totalVol.toLocaleString()} <span className="text-xs font-sans font-normal text-espresso-500">kg</span>
          </span>
        </div>

        <div className="p-3 rounded-xl bg-ivory-100 dark:bg-espresso-800 border border-ivory-200 dark:border-espresso-700">
          <div className="flex items-center justify-center gap-1 text-espresso-400 mb-0.5">
            <Dumbbell className="w-3.5 h-3.5" />
            <span className="text-[10px] font-mono uppercase tracking-wider">Sets</span>
          </div>
          <span className="font-serif text-lg font-bold text-espresso-950 dark:text-ivory-50 tabular-nums">
            {totalSets}
          </span>
        </div>

        <div className="p-3 rounded-xl bg-ivory-100 dark:bg-espresso-800 border border-ivory-200 dark:border-espresso-700">
          <div className="flex items-center justify-center gap-1 text-espresso-400 mb-0.5">
            <Activity className="w-3.5 h-3.5" />
            <span className="text-[10px] font-mono uppercase tracking-wider">Reps</span>
          </div>
          <span className="font-serif text-lg font-bold text-espresso-950 dark:text-ivory-50 tabular-nums">
            {totalReps}
          </span>
        </div>

        <div className="p-3 rounded-xl bg-ivory-100 dark:bg-espresso-800 border border-ivory-200 dark:border-espresso-700">
          <div className="flex items-center justify-center gap-1 text-espresso-400 mb-0.5">
            <Calendar className="w-3.5 h-3.5" />
            <span className="text-[10px] font-mono uppercase tracking-wider">Sessions</span>
          </div>
          <span className="font-serif text-lg font-bold text-espresso-950 dark:text-ivory-50 tabular-nums">
            {sessionsCount}x
          </span>
        </div>
      </div>

      {/* Recovery Status Bar */}
      <div className="p-4 rounded-xl border border-ivory-200 dark:border-espresso-800 bg-ivory-50/70 dark:bg-espresso-900/40 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 font-semibold text-espresso-900 dark:text-ivory-100">
            <Clock className="w-3.5 h-3.5 text-terracotta-600 dark:text-terracotta-400" />
            <span>Estimated Recovery Status</span>
          </div>
          <span className="font-mono font-bold text-espresso-950 dark:text-ivory-50">
            {recoveryPct}% · {recoveryPct >= 85 ? 'Ready to Train' : recoveryPct >= 60 ? 'Partially Recovered' : 'Recovering'}
          </span>
        </div>
        <div className="w-full bg-ivory-200 dark:bg-espresso-800 h-2.5 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${recoveryPct}%`,
              backgroundColor: recoveryPct >= 85 ? '#22c55e' : recoveryPct >= 60 ? '#eab308' : '#ef4444',
            }}
          />
        </div>
        <p className="text-[11px] text-espresso-500 dark:text-espresso-400">
          {metric?.lastTrainedDate
            ? `Last stimulated: ${metric.lastTrainedDate} (${metric.hoursSinceLastTrained ?? 0} hrs ago).`
            : 'No logged fatigue. Muscle is completely fresh.'}
        </p>
      </div>

      {/* Recent Exercises Targeting this Muscle */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-espresso-950 dark:text-ivory-100">
            Workout Guide · {recommendedExercises.length} exercises
          </h4>
          <span className="text-[10px] font-mono text-espresso-400">Compound + Direct</span>
        </div>

        {recommendedExercises.length > 0 && (
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {recommendedExercises.map((exercise) => (
              <details key={exercise.id} className="group rounded-xl border border-ivory-200 dark:border-espresso-800 bg-white dark:bg-espresso-800">
                <summary className="p-3 cursor-pointer list-none flex items-center justify-between gap-2 text-xs">
                  <span className="font-semibold text-espresso-900 dark:text-ivory-100">{exercise.name}</span>
                  <span className="text-[10px] text-terracotta-600 dark:text-terracotta-400 whitespace-nowrap">{exercise.recommendedRepRange.min}–{exercise.recommendedRepRange.max} reps · Guide</span>
                </summary>
                <div className="px-3 pb-3 space-y-2 text-[11px] text-espresso-600 dark:text-espresso-300">
                  <ol className="list-decimal pl-4 space-y-1">{exercise.instructions.slice(0, 4).map((step, index) => <li key={index}>{step}</li>)}</ol>
                  {exercise.coachingCues.length > 0 && <p><b>Form cues:</b> {exercise.coachingCues.slice(0, 2).join(' · ')}</p>}
                  {onSelectRelatedExercise && <button type="button" onClick={() => onSelectRelatedExercise(exercise.id)} className="text-terracotta-600 dark:text-terracotta-400 font-semibold">Open exercise library →</button>}
                </div>
              </details>
            ))}
          </div>
        )}
        {metric && metric.recentExercises.length > 0 ? (
          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {metric.recentExercises.map((rec, i) => (
              <div
                key={`${rec.exerciseId}-${i}`}
                onClick={() => onSelectRelatedExercise?.(rec.exerciseId)}
                className="p-2.5 rounded-xl border border-ivory-200 dark:border-espresso-800 bg-white dark:bg-espresso-800 flex items-center justify-between gap-2 text-xs cursor-pointer hover:border-terracotta-300 dark:hover:border-terracotta-700/60 transition"
              >
                <div>
                  <p className="font-semibold text-espresso-900 dark:text-ivory-100">{rec.exerciseName}</p>
                  <p className="text-[10px] font-mono text-espresso-500 dark:text-espresso-400">
                    {rec.date} · {rec.sets} sets
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <span className="font-mono font-bold text-terracotta-600 dark:text-terracotta-400">
                    +{rec.volumeKg.toLocaleString()} kg
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-6 text-center border border-dashed border-ivory-300 dark:border-espresso-750 rounded-xl text-xs text-espresso-400">
            No exercises logged for this muscle in the selected timeframe.
          </div>
        )}
      </div>
    </div>
  );
};
