import React, { useState, useMemo } from 'react';
import { WorkoutSession } from '../../types/fitness';
import { calculateAllMuscleMetrics } from '../../utils/muscleHeatmapEngine';
import { BarChart3, ArrowRightLeft } from 'lucide-react';

interface MuscleVolumeAnalyticsProps {
  sessions: WorkoutSession[];
}

export const MuscleVolumeAnalytics: React.FC<MuscleVolumeAnalyticsProps> = ({
  sessions = [],
}) => {
  const [timeFilterDays, setTimeFilterDays] = useState<number>(7);

  const metricsMap = useMemo(() => {
    return calculateAllMuscleMetrics(sessions, timeFilterDays);
  }, [sessions, timeFilterDays]);

  // Aggregate by anatomical region
  const regionBreakdown = useMemo(() => {
    const map = new Map<string, { volumeKg: number; sets: number }>();
    const regions = ['chest', 'shoulders', 'back', 'arms', 'core', 'legs', 'calves', 'neck'];
    regions.forEach((r) => map.set(r, { volumeKg: 0, sets: 0 }));

    metricsMap.forEach((m) => {
      const cur = map.get(m.region);
      if (cur) {
        cur.volumeKg += m.totalVolumeKg;
        cur.sets += m.effectiveSets;
      }
    });

    return map;
  }, [metricsMap]);

  // Total session stats
  const totalVolume = useMemo(() => {
    let sum = 0;
    metricsMap.forEach((m) => (sum += m.totalVolumeKg));
    return sum;
  }, [metricsMap]);

  const totalEffectiveSets = useMemo(() => {
    let sum = 0;
    metricsMap.forEach((m) => (sum += m.effectiveSets));
    return Math.round(sum);
  }, [metricsMap]);

  // Bilateral symmetry comparison (Left vs Right)
  const symmetryComparison = useMemo(() => {
    let leftVolume = 0;
    let rightVolume = 0;

    metricsMap.forEach((m) => {
      if (m.side === 'left') leftVolume += m.totalVolumeKg;
      if (m.side === 'right') rightVolume += m.totalVolumeKg;
    });

    const totalBilateral = leftVolume + rightVolume;
    const leftPct = totalBilateral === 0 ? 50 : Math.round((leftVolume / totalBilateral) * 100);
    const rightPct = totalBilateral === 0 ? 50 : Math.round((rightVolume / totalBilateral) * 100);

    return { leftVolume, rightVolume, leftPct, rightPct };
  }, [metricsMap]);

  // Push / Pull balance
  const pushPullRatio = useMemo(() => {
    const chestVol = regionBreakdown.get('chest')?.volumeKg || 0;
    const backVol = regionBreakdown.get('back')?.volumeKg || 0;
    if (backVol === 0 && chestVol === 0) return 1.0;
    if (backVol === 0) return 2.0;
    return Number((chestVol / backVol).toFixed(2));
  }, [regionBreakdown]);

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="p-4 sm:p-5 rounded-2xl border border-ivory-300 dark:border-espresso-750 bg-white dark:bg-espresso-850 shadow-subtle space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <BarChart3 className="w-5 h-5 text-terracotta-600 dark:text-terracotta-400" />
            <div>
              <h3 className="font-serif text-xl font-bold text-espresso-950 dark:text-ivory-50">
                Muscle Volume Analytics &amp; Kinetic Symmetry
              </h3>
              <p className="text-xs text-espresso-500">
                Tonnage distribution, primary vs secondary contribution, and bilateral balance
              </p>
            </div>
          </div>

          {/* Timeframe Selector */}
          <div className="inline-flex rounded-xl p-0.5 bg-ivory-100 dark:bg-espresso-800 border border-ivory-200 dark:border-espresso-700">
            {[
              { label: '7D', days: 7 },
              { label: '30D', days: 30 },
              { label: '90D', days: 90 },
              { label: '1Y', days: 365 },
            ].map((tf) => (
              <button
                key={tf.label}
                onClick={() => setTimeFilterDays(tf.days)}
                className={`px-3 py-1.5 text-xs rounded-lg font-semibold transition ${
                  timeFilterDays === tf.days
                    ? 'bg-espresso-900 text-white dark:bg-ivory-100 dark:text-espresso-950 shadow-xs'
                    : 'text-espresso-600 dark:text-espresso-400 hover:text-espresso-950 dark:hover:text-ivory-100'
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>
        </div>

        {/* Global Overview Numbers */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center pt-2 border-t border-ivory-200 dark:border-espresso-750">
          <div className="p-3 rounded-xl bg-ivory-100 dark:bg-espresso-800">
            <span className="block text-[10px] font-mono uppercase font-bold text-espresso-400">
              Total Logged Tonnage
            </span>
            <span className="font-serif text-xl font-bold text-espresso-950 dark:text-ivory-50">
              {totalVolume.toLocaleString()} <span className="text-xs font-normal text-espresso-500">kg</span>
            </span>
          </div>

          <div className="p-3 rounded-xl bg-ivory-100 dark:bg-espresso-800">
            <span className="block text-[10px] font-mono uppercase font-bold text-espresso-400">
              Effective Sets
            </span>
            <span className="font-serif text-xl font-bold text-espresso-950 dark:text-ivory-50">
              {totalEffectiveSets} <span className="text-xs font-normal text-espresso-500">sets</span>
            </span>
          </div>

          <div className="p-3 rounded-xl bg-ivory-100 dark:bg-espresso-800">
            <span className="block text-[10px] font-mono uppercase font-bold text-espresso-400">
              Push / Pull Ratio
            </span>
            <span
              className={`font-serif text-xl font-bold ${
                pushPullRatio >= 0.8 && pushPullRatio <= 1.2
                  ? 'text-sage-600 dark:text-sage-400'
                  : 'text-ochre-600 dark:text-ochre-400'
              }`}
            >
              {pushPullRatio} : 1.0
            </span>
          </div>

          <div className="p-3 rounded-xl bg-ivory-100 dark:bg-espresso-800">
            <span className="block text-[10px] font-mono uppercase font-bold text-espresso-400">
              L / R Symmetry
            </span>
            <span className="font-serif text-xl font-bold text-espresso-950 dark:text-ivory-50">
              {symmetryComparison.leftPct}% / {symmetryComparison.rightPct}%
            </span>
          </div>
        </div>
      </div>

      {/* Bilateral Symmetry Bar */}
      <div className="p-5 rounded-2xl border border-ivory-300 dark:border-espresso-750 bg-white dark:bg-espresso-850 shadow-subtle space-y-3">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 font-bold text-espresso-950 dark:text-ivory-50">
            <ArrowRightLeft className="w-4 h-4 text-terracotta-600" />
            <span>Bilateral Limb Volume Symmetry (Left vs Right)</span>
          </div>
          <span className="font-mono text-espresso-500">
            {symmetryComparison.leftVolume.toLocaleString()} kg (L) vs {symmetryComparison.rightVolume.toLocaleString()} kg (R)
          </span>
        </div>

        <div className="w-full bg-ivory-200 dark:bg-espresso-800 h-3 rounded-full overflow-hidden flex">
          <div
            className="h-full bg-terracotta-500 transition-all duration-300"
            style={{ width: `${symmetryComparison.leftPct}%` }}
            title={`Left: ${symmetryComparison.leftPct}%`}
          />
          <div
            className="h-full bg-ochre-500 transition-all duration-300"
            style={{ width: `${symmetryComparison.rightPct}%` }}
            title={`Right: ${symmetryComparison.rightPct}%`}
          />
        </div>

        <div className="flex items-center justify-between text-[11px] font-mono font-semibold text-espresso-400">
          <span className="text-terracotta-600 dark:text-terracotta-400">Left Side: {symmetryComparison.leftPct}%</span>
          <span className="text-ochre-600 dark:text-ochre-400">Right Side: {symmetryComparison.rightPct}%</span>
        </div>
      </div>

      {/* Regional Volume Distribution Bars */}
      <div className="p-5 rounded-2xl border border-ivory-300 dark:border-espresso-750 bg-white dark:bg-espresso-850 shadow-subtle space-y-4">
        <h4 className="font-serif text-base font-bold text-espresso-950 dark:text-ivory-50">
          Regional Volume Breakdown
        </h4>

        <div className="space-y-3">
          {Array.from(regionBreakdown.entries()).map(([region, data]) => {
            const pct = totalVolume === 0 ? 0 : Math.round((data.volumeKg / totalVolume) * 100);

            return (
              <div key={region} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold capitalize text-espresso-900 dark:text-ivory-100">
                    {region}
                  </span>
                  <div className="font-mono text-espresso-600 dark:text-espresso-400 flex items-center gap-2">
                    <span>{Math.round(data.sets)} sets</span>
                    <span>·</span>
                    <span className="font-bold text-espresso-950 dark:text-ivory-50">
                      {data.volumeKg.toLocaleString()} kg ({pct}%)
                    </span>
                  </div>
                </div>

                <div className="w-full bg-ivory-200 dark:bg-espresso-800 h-2 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: 'var(--accent, #C45532)',
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
