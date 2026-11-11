import React, { useMemo, useState } from 'react';
import {
  Dumbbell,
  TrendingUp,
  Search,
  Award,
  Layers,
} from 'lucide-react';
import { useAdminApp } from '../useAdminApp';
import { AdminPageHeader } from '../common/AdminPageHeader';
import { AdminStatCard } from '../common/AdminStatCard';
import { AdminEmptyState } from '../common/AdminEmptyState';

export const AdminFitnessView: React.FC = () => {
  const { state } = useAdminApp();
  const [searchQuery, setSearchQuery] = useState('');

  // Unify legacy and v2 workout sessions
  const workouts = useMemo(() => {
    const list = [...(state.gymWorkouts || []), ...(state.workoutSessions || [])];
    return list.sort((a, b) => {
      const dateA = (a as any).completedAt || (a as any).startedAt || '';
      const dateB = (b as any).completedAt || (b as any).startedAt || '';
      return dateB.localeCompare(dateA);
    });
  }, [state.gymWorkouts, state.workoutSessions]);

  const stats = useMemo(() => {
    let totalSets = 0;
    let totalVolumeKg = 0;
    const splitCounts: Record<string, number> = {};

    workouts.forEach((w: any) => {
      const split = w.splitName || w.title || 'General Workout';
      splitCounts[split] = (splitCounts[split] || 0) + 1;

      (w.exercises || []).forEach((ex: any) => {
        const sets = ex.sets || [];
        totalSets += sets.length;
        sets.forEach((s: any) => {
          const weight = s.weightKg || s.weight || 0;
          const reps = s.reps || 0;
          totalVolumeKg += weight * reps;
        });
      });
    });

    return {
      totalWorkouts: workouts.length,
      totalSets,
      totalVolumeKg: Math.round(totalVolumeKg),
      splitCounts,
    };
  }, [workouts]);

  const filteredWorkouts = useMemo(() => {
    return workouts.filter((w: any) => {
      const split = (w.splitName || w.title || '').toLowerCase();
      return split.includes(searchQuery.toLowerCase());
    });
  }, [workouts, searchQuery]);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Iron Lab — Gym &amp; Fitness Telemetry"
        description="Workout execution history, progressive overload volume, exercise taxonomy records, and personal training session audit."
        badge={{ label: `${workouts.length} Sessions Logged`, variant: 'blue' }}
      />

      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <AdminStatCard
          title="Total Workouts"
          value={workouts.length}
          subtitle="Completed gym sessions"
          icon={<Dumbbell className="w-4 h-4" />}
          accentColor="#3B82F6"
        />

        <AdminStatCard
          title="Total Volume Load"
          value={`${(stats.totalVolumeKg / 1000).toFixed(1)}t`}
          subtitle={`${stats.totalVolumeKg.toLocaleString()} kg total tonnage`}
          icon={<TrendingUp className="w-4 h-4" />}
          accentColor="#10B981"
        />

        <AdminStatCard
          title="Sets Completed"
          value={stats.totalSets}
          subtitle="Recorded training working sets"
          icon={<Layers className="w-4 h-4" />}
          accentColor="#8B5CF6"
        />

        <AdminStatCard
          title="Exercise Library"
          value={(state.exerciseLibrary || []).length || 68}
          subtitle="Taxonomy movements cataloged"
          icon={<Award className="w-4 h-4" />}
          accentColor="#F59E0B"
        />
      </div>

      {/* Search Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-espresso-400 dark:text-ivory-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search workouts by split name..."
            className="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl bg-white/95 dark:bg-[#0A0F1D]/90 border border-ivory-300/80 dark:border-white/10 text-espresso-900 dark:text-ivory-100 placeholder-espresso-400 dark:placeholder-ivory-400 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-sm"
          />
        </div>
      </div>

      {/* Workouts Table */}
      {filteredWorkouts.length === 0 ? (
        <AdminEmptyState
          icon={<Dumbbell className="w-6 h-6" />}
          title="No Workout Sessions Logged"
          description="Log workouts in Iron Lab to view training telemetry, volume tonnage, and exercise history."
        />
      ) : (
        <div className="rounded-3xl bg-white/95 dark:bg-[#0A0F1D]/90 border border-ivory-300/80 dark:border-white/10 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-ivory-100/70 dark:bg-white/[0.03] border-b border-ivory-200 dark:border-white/10 text-espresso-500 dark:text-ivory-400 font-mono uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3.5 px-4">Date</th>
                  <th className="py-3.5 px-4">Training Split</th>
                  <th className="py-3.5 px-4">Duration</th>
                  <th className="py-3.5 px-4">Exercises Logged</th>
                  <th className="py-3.5 px-4">RPE Exertion</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ivory-200/80 dark:divide-white/5 font-sans">
                {filteredWorkouts.map((w: any, idx) => {
                  const dateStr = w.completedAt || w.startedAt;
                  const exercises = w.exercises || [];
                  return (
                    <tr key={w.id || idx} className="hover:bg-ivory-50/80 dark:hover:bg-white/[0.02] transition-colors">
                      <td className="py-3.5 px-4 font-mono text-espresso-600 dark:text-ivory-300">
                        {dateStr ? new Date(dateStr).toLocaleDateString() : 'Recorded'}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-espresso-950 dark:text-white">
                        {w.splitName || w.title || 'Custom Split'}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-espresso-600 dark:text-ivory-300">
                        {w.durationMinutes ? `${w.durationMinutes}m` : '—'}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-mono font-semibold text-blue-500">
                          {exercises.length} movements
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono">
                        {w.rpe ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            RPE {w.rpe}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
