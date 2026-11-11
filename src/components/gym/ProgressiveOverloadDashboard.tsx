import React, { useState, useMemo } from 'react';
import { WorkoutSession } from '../../types/fitness';
import { calculateEstimated1RM } from '../../utils/progressiveOverload';
import {
  TrendingUp,
  Sparkles,
  ArrowUpRight,
  Calendar,
} from 'lucide-react';

interface ProgressiveOverloadDashboardProps {
  sessions: WorkoutSession[];
}

export const ProgressiveOverloadDashboard: React.FC<ProgressiveOverloadDashboardProps> = ({
  sessions = [],
}) => {
  // Extract all unique exercises from completed sessions
  const exerciseHistoryMap = useMemo(() => {
    const map = new Map<
      string,
      {
        name: string;
        history: {
          date: string;
          maxWeight: number;
          maxReps: number;
          est1RM: number;
          volume: number;
          workingSetsCount: number;
        }[];
      }
    >();

    const sorted = [...sessions]
      .filter((s) => s.completed)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    sorted.forEach((session) => {
      (session.exercises || []).forEach((ex) => {
        const workingSets = (ex.sets || []).filter((s) => s.completed && s.type !== 'warmup');
        if (workingSets.length === 0) return;

        let maxWeight = 0;
        let maxReps = 0;
        let est1RM = 0;
        let volume = 0;

        workingSets.forEach((s) => {
          const w = s.actualWeightKg || 0;
          const r = s.actualReps || 0;
          volume += w * r;
          if (w > maxWeight) maxWeight = w;
          if (r > maxReps) maxReps = r;
          const e = calculateEstimated1RM(w, r).estimated1RMKg;
          if (e > est1RM) est1RM = e;
        });

        if (!map.has(ex.exerciseId)) {
          map.set(ex.exerciseId, { name: ex.exerciseName, history: [] });
        }
        map.get(ex.exerciseId)!.history.push({
          date: session.date,
          maxWeight,
          maxReps,
          est1RM,
          volume,
          workingSetsCount: workingSets.length,
        });
      });
    });

    return map;
  }, [sessions]);

  const exerciseIds = useMemo(() => Array.from(exerciseHistoryMap.keys()), [exerciseHistoryMap]);
  const [selectedExerciseId, setSelectedExerciseId] = useState<string>(() => exerciseIds[0] || '');

  // Active exercise data
  const activeExerciseData = useMemo(() => {
    return exerciseHistoryMap.get(selectedExerciseId);
  }, [exerciseHistoryMap, selectedExerciseId]);

  // Overall PRs and Stats for Active Exercise
  const stats = useMemo(() => {
    if (!activeExerciseData || activeExerciseData.history.length === 0) {
      return null;
    }
    const hist = activeExerciseData.history;
    const bestWeight = Math.max(...hist.map((h) => h.maxWeight));
    const bestReps = Math.max(...hist.map((h) => h.maxReps));
    const best1RM = Math.max(...hist.map((h) => h.est1RM));
    const bestVolume = Math.max(...hist.map((h) => h.volume));

    const latest = hist[hist.length - 1];
    const previous = hist.length > 1 ? hist[hist.length - 2] : null;

    // Trend calculation
    const weightGain = previous ? latest.maxWeight - previous.maxWeight : 0;
    const est1RMGain = previous ? latest.est1RM - previous.est1RM : 0;

    return {
      bestWeight,
      bestReps,
      best1RM,
      bestVolume,
      latest,
      previous,
      weightGain,
      est1RMGain,
      totalSessionsTracked: hist.length,
    };
  }, [activeExerciseData]);

  // Progressive Overload Recommendation
  const recommendation = useMemo(() => {
    if (!stats) return null;
    if (stats.latest.maxWeight === 0) {
      return {
        text: 'Bodyweight progression: Aim to complete +1 repetition or perform with a slower eccentric tempo next session.',
        type: 'reps',
      };
    }
    if (stats.weightGain > 0) {
      return {
        text: `Great progression! You increased load to ${stats.latest.maxWeight} kg. Consolidate this weight for all working sets before progressing further.`,
        type: 'maintain',
      };
    }
    if (stats.latest.maxReps >= 10) {
      const nextWeight = stats.latest.maxWeight + 2.5;
      return {
        text: `You completed sets of ${stats.latest.maxReps} reps at ${stats.latest.maxWeight} kg. Consider attempting ${nextWeight} kg if your form allows.`,
        type: 'weight',
      };
    }
    return {
      text: `Focus on hitting ${stats.latest.maxReps + 1} reps with clean technique at ${stats.latest.maxWeight} kg before adding external load.`,
      type: 'reps',
    };
  }, [stats]);

  if (exerciseIds.length === 0) {
    return (
      <div className="p-8 text-center border border-dashed border-ivory-300 dark:border-espresso-700 rounded-2xl bg-white/50 dark:bg-espresso-850/50 space-y-3">
        <TrendingUp className="w-10 h-10 text-espresso-400 mx-auto" />
        <h3 className="font-serif text-lg font-bold text-espresso-950 dark:text-ivory-50">
          No workout performance logged yet
        </h3>
        <p className="text-xs text-espresso-500 max-w-md mx-auto">
          Start and complete your first workout session to unlock automatic progressive overload analytics and 1RM tracking.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Exercise Picker Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl border border-ivory-300 dark:border-espresso-750 bg-white dark:bg-espresso-850 shadow-subtle">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-terracotta-600 dark:text-terracotta-400" />
          <div>
            <h3 className="font-serif text-base font-bold text-espresso-950 dark:text-ivory-50">
              Progressive Overload &amp; 1RM Progression
            </h3>
            <p className="text-xs text-espresso-500">
              Sport-science loading curves and double progression recommendations
            </p>
          </div>
        </div>

        <select
          value={selectedExerciseId}
          onChange={(e) => setSelectedExerciseId(e.target.value)}
          className="px-3 py-1.5 rounded-xl border border-ivory-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-900 text-xs font-semibold text-espresso-900 dark:text-ivory-100 focus:outline-none focus:ring-2 focus:ring-terracotta-500"
        >
          {exerciseIds.map((id) => (
            <option key={id} value={id}>
              {exerciseHistoryMap.get(id)?.name}
            </option>
          ))}
        </select>
      </div>

      {/* Recommendation Banner */}
      {recommendation && (
        <div className="p-4 rounded-2xl border border-terracotta-200 dark:border-terracotta-800/60 bg-terracotta-50/70 dark:bg-terracotta-900/20 flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-terracotta-600 dark:text-terracotta-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5 text-xs">
            <span className="font-mono font-bold uppercase tracking-wider text-terracotta-700 dark:text-terracotta-300">
              Double Progression Recommendation
            </span>
            <p className="text-espresso-800 dark:text-ivory-200 font-medium leading-relaxed">
              {recommendation.text}
            </p>
          </div>
        </div>
      )}

      {/* Key Metric Tiles */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          <div className="p-4 rounded-2xl border border-ivory-300 dark:border-espresso-750 bg-white dark:bg-espresso-850 shadow-subtle">
            <span className="text-[10px] font-mono uppercase tracking-wider font-bold text-espresso-400">
              All-Time Max Weight
            </span>
            <p className="font-serif text-2xl font-bold text-espresso-950 dark:text-ivory-50 mt-1">
              {stats.bestWeight} <span className="text-xs font-normal text-espresso-500">kg</span>
            </p>
            {stats.weightGain > 0 && (
              <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-sage-600 dark:text-sage-400 mt-1">
                <ArrowUpRight className="w-3.5 h-3.5" /> +{stats.weightGain} kg recent
              </span>
            )}
          </div>

          <div className="p-4 rounded-2xl border border-ivory-300 dark:border-espresso-750 bg-white dark:bg-espresso-850 shadow-subtle">
            <span className="text-[10px] font-mono uppercase tracking-wider font-bold text-espresso-400">
              Est. 1RM (Epley)
            </span>
            <p className="font-serif text-2xl font-bold text-espresso-950 dark:text-ivory-50 mt-1">
              {stats.best1RM} <span className="text-xs font-normal text-espresso-500">kg</span>
            </p>
            <span className="text-[10px] text-espresso-400 font-mono block mt-1">
              Calculated estimate
            </span>
          </div>

          <div className="p-4 rounded-2xl border border-ivory-300 dark:border-espresso-750 bg-white dark:bg-espresso-850 shadow-subtle">
            <span className="text-[10px] font-mono uppercase tracking-wider font-bold text-espresso-400">
              Best Session Volume
            </span>
            <p className="font-serif text-2xl font-bold text-espresso-950 dark:text-ivory-50 mt-1">
              {stats.bestVolume.toLocaleString()}{' '}
              <span className="text-xs font-normal text-espresso-500">kg</span>
            </p>
            <span className="text-[10px] text-espresso-400 font-mono block mt-1">
              Sets × Reps × Load
            </span>
          </div>

          <div className="p-4 rounded-2xl border border-ivory-300 dark:border-espresso-750 bg-white dark:bg-espresso-850 shadow-subtle">
            <span className="text-[10px] font-mono uppercase tracking-wider font-bold text-espresso-400">
              Total Sessions
            </span>
            <p className="font-serif text-2xl font-bold text-espresso-950 dark:text-ivory-50 mt-1">
              {stats.totalSessionsTracked}x
            </p>
            <span className="text-[10px] text-espresso-400 font-mono block mt-1">
              Logged in Tracker
            </span>
          </div>
        </div>
      )}

      {/* Historical Progression Table */}
      {activeExerciseData && (
        <div className="p-5 rounded-2xl border border-ivory-300 dark:border-espresso-750 bg-white dark:bg-espresso-850 shadow-subtle space-y-3">
          <h4 className="font-serif text-base font-bold text-espresso-950 dark:text-ivory-50">
            Historical Progression Log
          </h4>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-ivory-200 dark:border-espresso-750 font-mono text-[10px] uppercase text-espresso-400">
                  <th className="py-2.5">Date</th>
                  <th className="py-2.5">Working Sets</th>
                  <th className="py-2.5">Heaviest Load</th>
                  <th className="py-2.5">Max Reps</th>
                  <th className="py-2.5">Est. 1RM</th>
                  <th className="py-2.5 text-right">Session Volume</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ivory-100 dark:divide-espresso-800">
                {[...activeExerciseData.history].reverse().map((h, i) => (
                  <tr key={`${h.date}-${i}`} className="hover:bg-ivory-50 dark:hover:bg-espresso-800/50">
                    <td className="py-2.5 font-medium text-espresso-950 dark:text-ivory-100 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-espresso-400" />
                      {h.date}
                    </td>
                    <td className="py-2.5 font-mono text-espresso-600 dark:text-espresso-400">
                      {h.workingSetsCount} sets
                    </td>
                    <td className="py-2.5 font-mono font-semibold text-espresso-950 dark:text-ivory-50">
                      {h.maxWeight} kg
                    </td>
                    <td className="py-2.5 font-mono text-espresso-700 dark:text-espresso-300">
                      {h.maxReps} reps
                    </td>
                    <td className="py-2.5 font-mono font-semibold text-terracotta-600 dark:text-terracotta-400">
                      {h.est1RM} kg
                    </td>
                    <td className="py-2.5 font-mono text-right font-medium text-espresso-900 dark:text-ivory-100">
                      {h.volume.toLocaleString()} kg
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
