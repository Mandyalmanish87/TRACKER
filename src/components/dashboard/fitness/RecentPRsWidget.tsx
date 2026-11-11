import React, { useMemo } from 'react';
import { useApp } from '../../../context/AppContext';
import { Card } from '../../common/Card';
import { Trophy } from 'lucide-react';

export const RecentPRsWidget: React.FC = () => {
  const { state } = useApp();

  const prs = useMemo(() => {
    const list: {
      exerciseName: string;
      weightKg: number;
      reps: number;
      date: string;
    }[] = [];

    const sessions = (state.workoutSessions || []).filter((s) => s.completed);
    for (const session of sessions) {
      for (const ex of session.exercises || []) {
        for (const s of ex.sets || []) {
          if (s.isPersonalRecord) {
            list.push({
              exerciseName: ex.exerciseName,
              weightKg: s.actualWeightKg,
              reps: s.actualReps,
              date: session.date,
            });
          }
        }
      }
    }

    return list.slice(0, 4);
  }, [state.workoutSessions]);

  return (
    <Card
      eyebrow="Strength Milestones"
      title="Personal Records"
      subtitle="All-time strength PRs broken in training"
    >
      <div className="space-y-2.5">
        {prs.length === 0 ? (
          <div className="p-4 rounded-xl bg-ivory-50 dark:bg-espresso-800/40 text-center text-xs text-espresso-400">
            Log working sets at higher weights or reps to unlock gold PR badges!
          </div>
        ) : (
          prs.map((pr, idx) => (
            <div
              key={idx}
              className="p-3 rounded-xl border border-ochre-200 dark:border-ochre-900/40 bg-ochre-50/50 dark:bg-ochre-950/20 flex items-center justify-between text-xs"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-ochre-100 dark:bg-ochre-900/60 text-ochre-700 dark:text-ochre-300 flex items-center justify-center shrink-0">
                  <Trophy className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-espresso-950 dark:text-ivory-50 truncate">
                    {pr.exerciseName}
                  </p>
                  <p className="text-[11px] font-mono text-espresso-400">{pr.date}</p>
                </div>
              </div>

              <span className="font-mono font-bold text-ochre-700 dark:text-ochre-300 text-xs shrink-0">
                {pr.weightKg}kg × {pr.reps}
              </span>
            </div>
          ))
        )}
      </div>
    </Card>
  );
};

