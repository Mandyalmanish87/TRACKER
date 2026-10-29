import React from 'react';
import { Card } from '../common/Card';
import { Badge } from '../common/Badge';
import { Button } from '../common/Button';
import { EmptyState } from '../common/EmptyState';
import { useApp } from '../../context/AppContext';
import { Dumbbell, Check, CheckCircle2 } from 'lucide-react';

export const GymSplitWidget: React.FC = () => {
  const { state, toggleGymSet, toggleGymWorkoutComplete, startTodayWorkout } = useApp();

  const todayStr = new Date().toISOString().split('T')[0];
  const workout = state.gymWorkouts.find(
    (w) => w.date === todayStr && !w.isSample
  );

  if (!workout) {
    return (
      <Card
        eyebrow="Physical Conditioning"
        title="Today's Gym & Split"
        subtitle="Workout logging, active sets, and strength progressions"
      >
        <EmptyState
          title="No gym sessions yet. Log your first workout."
          description="Log your training routine, track working sets, and monitor progressive overload."
          actionLabel="Log Workout"
          onAction={() => startTodayWorkout()}
        />
      </Card>
    );
  }

  const totalSets = workout.exercises.reduce((acc, ex) => acc + ex.sets.length, 0);
  const completedSets = workout.exercises.reduce(
    (acc, ex) => acc + ex.sets.filter((s) => s.completed).length,
    0
  );

  return (
    <Card
      eyebrow="Physical Conditioning"
      title="Today's Gym & Split"
      subtitle={workout.split}
      action={
        <Badge
          variant={workout.completed ? 'sage' : completedSets > 0 ? 'ochre' : 'neutral'}
          size="sm"
        >
          {workout.completed ? (
            <span className="flex items-center gap-1.5 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" /> Completed
            </span>
          ) : (
            <span className="font-mono tabular-nums font-semibold">
              {completedSets}/{totalSets} Sets
            </span>
          )}
        </Badge>
      }
    >
      <div className="space-y-4">
        {/* Workout Completion Action */}
        <div className="flex items-center justify-between p-4 rounded-2xl bg-ivory-100 dark:bg-espresso-800 border border-ivory-200 dark:border-espresso-750">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-terracotta-100 dark:bg-terracotta-900/40 flex items-center justify-center text-terracotta-600 dark:text-terracotta-400 shrink-0">
              <Dumbbell className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs sm:text-sm font-semibold text-espresso-950 dark:text-ivory-50">
                {workout.split}
              </p>
              <p className="text-xs text-espresso-500 dark:text-espresso-400 font-mono mt-0.5">
                {workout.durationMinutes ? `${workout.durationMinutes} min routine` : 'Standard volume'}
              </p>
            </div>
          </div>

          <Button
            variant={workout.completed ? 'secondary' : 'primary'}
            size="md"
            onClick={toggleGymWorkoutComplete}
            icon={workout.completed ? <Check className="w-4 h-4 text-sage-600 dark:text-sage-400" /> : undefined}
          >
            {workout.completed ? 'Finished' : 'Mark Done'}
          </Button>
        </div>

        {/* Exercise List & Set Checkboxes */}
        <div className="space-y-3.5">
          {workout.exercises.map((exercise, exIdx) => (
            <div
              key={exercise.name}
              className="p-3.5 sm:p-4 rounded-2xl border border-ivory-200 dark:border-espresso-750 bg-white dark:bg-espresso-850 shadow-subtle"
            >
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-xs sm:text-sm font-semibold text-espresso-900 dark:text-ivory-100">
                  {exercise.name}
                </span>
                <span className="text-xs font-mono tabular-nums text-espresso-400 dark:text-espresso-500 font-medium">
                  {exercise.sets.filter((s) => s.completed).length}/{exercise.sets.length} sets
                </span>
              </div>

              {/* Individual Sets */}
              <div className="flex flex-wrap gap-2">
                {exercise.sets.map((set, sIdx) => (
                  <button
                    key={sIdx}
                    onClick={() => toggleGymSet(exIdx, sIdx)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-mono tabular-nums border transition-all select-none active:scale-95 ${
                      set.completed
                        ? 'bg-sage-50 text-sage-800 border-sage-300 dark:bg-sage-950/40 dark:text-sage-300 dark:border-sage-800 shadow-sm'
                        : 'bg-ivory-50 text-espresso-700 border-ivory-300 dark:bg-espresso-800 dark:text-espresso-300 dark:border-espresso-700 hover:border-ivory-400'
                    }`}
                  >
                    <span
                      className={`w-4 h-4 rounded-md flex items-center justify-center text-[10px] font-bold ${
                        set.completed
                          ? 'bg-sage-600 text-white'
                          : 'border border-espresso-300 dark:border-espresso-600 text-espresso-500'
                      }`}
                    >
                      {set.completed ? '✓' : sIdx + 1}
                    </span>
                    <span className="font-semibold">
                      {set.reps}r @ {set.weightKg}kg
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {workout.notes && (
          <p className="text-xs italic text-espresso-500 dark:text-espresso-400 border-l-2 border-terracotta-400 pl-3 py-0.5">
            Coach's note: {workout.notes}
          </p>
        )}
      </div>
    </Card>
  );
};
