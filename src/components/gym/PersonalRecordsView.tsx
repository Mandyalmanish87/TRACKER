import React, { useState, useMemo } from 'react';
import { WorkoutSession } from '../../types/fitness';
import { calculateEstimated1RM } from '../../utils/progressiveOverload';
import {
  Trophy,
  Award,
  Calendar,
  Search,
} from 'lucide-react';

interface PersonalRecordsViewProps {
  sessions: WorkoutSession[];
}

interface PREntry {
  exerciseId: string;
  exerciseName: string;
  maxWeightKg: number;
  maxReps: number;
  max1RMKg: number;
  maxVolumeKg: number;
  dateAchieved: string;
  totalTimesPerformed: number;
}

export const PersonalRecordsView: React.FC<PersonalRecordsViewProps> = ({ sessions = [] }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState<'weight' | '1rm' | 'volume' | 'date'>('weight');

  // Compute all personal records from completed sessions
  const prList = useMemo(() => {
    const map = new Map<string, PREntry>();

    sessions
      .filter((s) => s.completed)
      .forEach((session) => {
        (session.exercises || []).forEach((ex) => {
          const workingSets = (ex.sets || []).filter((s) => s.completed && s.type !== 'warmup');
          if (workingSets.length === 0) return;

          let sessionMaxWeight = 0;
          let sessionMaxReps = 0;
          let sessionMax1RM = 0;
          let sessionVolume = 0;

          workingSets.forEach((s) => {
            const w = s.actualWeightKg || 0;
            const r = s.actualReps || 0;
            sessionVolume += w * r;
            if (w > sessionMaxWeight) sessionMaxWeight = w;
            if (r > sessionMaxReps) sessionMaxReps = r;
            const est1RM = calculateEstimated1RM(w, r).estimated1RMKg;
            if (est1RM > sessionMax1RM) sessionMax1RM = est1RM;
          });

          if (!map.has(ex.exerciseId)) {
            map.set(ex.exerciseId, {
              exerciseId: ex.exerciseId,
              exerciseName: ex.exerciseName,
              maxWeightKg: sessionMaxWeight,
              maxReps: sessionMaxReps,
              max1RMKg: sessionMax1RM,
              maxVolumeKg: sessionVolume,
              dateAchieved: session.date,
              totalTimesPerformed: 1,
            });
          } else {
            const current = map.get(ex.exerciseId)!;
            current.totalTimesPerformed += 1;
            if (sessionMaxWeight > current.maxWeightKg) {
              current.maxWeightKg = sessionMaxWeight;
              current.dateAchieved = session.date;
            }
            if (sessionMaxReps > current.maxReps) {
              current.maxReps = sessionMaxReps;
            }
            if (sessionMax1RM > current.max1RMKg) {
              current.max1RMKg = sessionMax1RM;
            }
            if (sessionVolume > current.maxVolumeKg) {
              current.maxVolumeKg = sessionVolume;
            }
          }
        });
      });

    return Array.from(map.values());
  }, [sessions]);

  // Filter & Sort
  const filteredAndSortedPRs = useMemo(() => {
    let list = prList;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((p) => p.exerciseName.toLowerCase().includes(q));
    }

    return [...list].sort((a, b) => {
      if (sortKey === 'weight') return b.maxWeightKg - a.maxWeightKg;
      if (sortKey === '1rm') return b.max1RMKg - a.max1RMKg;
      if (sortKey === 'volume') return b.maxVolumeKg - a.maxVolumeKg;
      return new Date(b.dateAchieved).getTime() - new Date(a.dateAchieved).getTime();
    });
  }, [prList, searchQuery, sortKey]);

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="p-4 sm:p-5 rounded-2xl border border-ivory-300 dark:border-espresso-750 bg-white dark:bg-espresso-850 shadow-subtle space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Trophy className="w-6 h-6 text-ochre-500 shrink-0" />
            <div>
              <h3 className="font-serif text-xl font-bold text-espresso-950 dark:text-ivory-50">
                Personal Records (PR) Hall of Fame
              </h3>
              <p className="text-xs text-espresso-500">
                All-time heaviest lifts, max estimated 1RM, and high-water volume marks
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-espresso-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search PR exercise..."
                className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-ivory-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-900 text-espresso-950 dark:text-ivory-100 placeholder:text-espresso-400 focus:outline-none focus:ring-1 focus:ring-terracotta-500"
              />
            </div>

            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as any)}
              className="px-3 py-1.5 rounded-xl border border-ivory-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-900 text-xs font-semibold text-espresso-900 dark:text-ivory-100"
            >
              <option value="weight">Sort by Max Weight</option>
              <option value="1rm">Sort by Est. 1RM</option>
              <option value="volume">Sort by Session Volume</option>
              <option value="date">Sort by Recent Date</option>
            </select>
          </div>
        </div>
      </div>

      {/* PR Cards Grid */}
      {filteredAndSortedPRs.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAndSortedPRs.map((pr) => (
            <div
              key={pr.exerciseId}
              className="p-5 rounded-2xl border border-ivory-300 dark:border-espresso-750 bg-white dark:bg-espresso-850 shadow-subtle flex flex-col justify-between space-y-4 hover:border-terracotta-300 dark:hover:border-terracotta-700/60 transition group"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <span className="p-2 rounded-xl bg-ochre-50 dark:bg-ochre-900/30 text-ochre-600 dark:text-ochre-400 border border-ochre-200 dark:border-ochre-800/40">
                    <Award className="w-5 h-5" />
                  </span>
                  <span className="text-[10px] font-mono font-semibold text-espresso-400 flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> {pr.dateAchieved}
                  </span>
                </div>

                <h4 className="font-serif text-lg font-bold text-espresso-950 dark:text-ivory-50 mt-3 group-hover:text-terracotta-600 dark:group-hover:text-terracotta-400 transition">
                  {pr.exerciseName}
                </h4>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-3 border-t border-ivory-200 dark:border-espresso-800 text-center">
                <div className="p-2 rounded-xl bg-ivory-100/70 dark:bg-espresso-800/60">
                  <span className="block text-[9px] font-mono uppercase font-bold text-espresso-400">
                    Max Load
                  </span>
                  <span className="font-serif text-base font-bold text-espresso-950 dark:text-ivory-50">
                    {pr.maxWeightKg} <span className="text-[10px] font-normal text-espresso-500">kg</span>
                  </span>
                </div>

                <div className="p-2 rounded-xl bg-ivory-100/70 dark:bg-espresso-800/60">
                  <span className="block text-[9px] font-mono uppercase font-bold text-espresso-400">
                    Est. 1RM
                  </span>
                  <span className="font-serif text-base font-bold text-terracotta-600 dark:text-terracotta-400">
                    {pr.max1RMKg} <span className="text-[10px] font-normal text-espresso-500">kg</span>
                  </span>
                </div>

                <div className="p-2 rounded-xl bg-ivory-100/70 dark:bg-espresso-800/60">
                  <span className="block text-[9px] font-mono uppercase font-bold text-espresso-400">
                    Max Reps
                  </span>
                  <span className="font-serif text-base font-bold text-espresso-950 dark:text-ivory-50">
                    {pr.maxReps} <span className="text-[10px] font-normal text-espresso-500">reps</span>
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] text-espresso-500 dark:text-espresso-400">
                <span>Peak Tonnage: {pr.maxVolumeKg.toLocaleString()} kg</span>
                <span>{pr.totalTimesPerformed}x executed</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-8 text-center border border-dashed border-ivory-300 dark:border-espresso-750 rounded-2xl bg-white/50 text-xs text-espresso-400">
          No personal records found matching search criteria.
        </div>
      )}
    </div>
  );
};
