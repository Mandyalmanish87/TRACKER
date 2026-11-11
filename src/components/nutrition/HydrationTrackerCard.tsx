import React, { useState } from 'react';
import { Droplet, Minus } from 'lucide-react';

interface HydrationTrackerCardProps {
  currentWaterMl: number;
  targetWaterMl?: number;
  onUpdateWater: (newTotalMl: number) => void;
}

export const HydrationTrackerCard: React.FC<HydrationTrackerCardProps> = ({
  currentWaterMl,
  targetWaterMl = 3000,
  onUpdateWater,
}) => {
  const [unit, setUnit] = useState<'ml' | 'l' | 'oz'>('ml');

  const pct = Math.min(100, Math.round((currentWaterMl / targetWaterMl) * 100));

  const formatVolume = (ml: number) => {
    if (unit === 'l') return `${(ml / 1000).toFixed(2)} L`;
    if (unit === 'oz') return `${Math.round(ml * 0.033814)} oz`;
    return `${ml} ml`;
  };

  const handleAdd = (deltaMl: number) => {
    onUpdateWater(Math.max(0, currentWaterMl + deltaMl));
  };

  return (
    <div className="p-5 rounded-2xl border border-ivory-300 dark:border-espresso-750 bg-white dark:bg-espresso-850 shadow-subtle space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Droplet className="w-5 h-5 text-dusty-500 animate-bounce" />
          <div>
            <h4 className="font-serif text-base font-bold text-espresso-950 dark:text-ivory-50">
              Daily Hydration Tracker
            </h4>
            <p className="text-xs text-espresso-500">Fluid balance, cellular volumization, and mental clarity</p>
          </div>
        </div>

        <div className="inline-flex rounded-lg p-0.5 bg-ivory-100 dark:bg-espresso-800 text-[11px] font-semibold font-mono">
          {(['ml', 'l', 'oz'] as const).map((u) => (
            <button
              key={u}
              onClick={() => setUnit(u)}
              className={`px-2 py-0.5 rounded-md transition ${
                unit === u
                  ? 'bg-espresso-900 text-white dark:bg-ivory-100 dark:text-espresso-950 font-bold'
                  : 'text-espresso-600 dark:text-espresso-400'
              }`}
            >
              {u.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Progress Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-dusty-50/60 dark:bg-dusty-900/20 border border-dusty-200 dark:border-dusty-800/40">
        <div>
          <span className="text-[10px] font-mono uppercase font-bold text-dusty-600 dark:text-dusty-400">
            Current Intake
          </span>
          <p className="font-serif text-3xl font-bold text-espresso-950 dark:text-ivory-50 mt-0.5">
            {formatVolume(currentWaterMl)}
          </p>
          <p className="text-xs text-espresso-500">
            Target: {formatVolume(targetWaterMl)} ({pct}% completed)
          </p>
        </div>

        {/* Quick Add Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => handleAdd(250)}
            className="px-3 py-1.5 rounded-xl border border-dusty-300 dark:border-dusty-700 bg-white dark:bg-espresso-800 text-xs font-semibold text-espresso-900 dark:text-ivory-100 hover:bg-dusty-50 shadow-xs transition"
          >
            +250 ml (Glass)
          </button>
          <button
            onClick={() => handleAdd(500)}
            className="px-3 py-1.5 rounded-xl border border-dusty-300 dark:border-dusty-700 bg-white dark:bg-espresso-800 text-xs font-semibold text-espresso-900 dark:text-ivory-100 hover:bg-dusty-50 shadow-xs transition"
          >
            +500 ml (Bottle)
          </button>
          <button
            onClick={() => handleAdd(1000)}
            className="px-3 py-1.5 rounded-xl border border-dusty-300 dark:border-dusty-700 bg-white dark:bg-espresso-800 text-xs font-semibold text-espresso-900 dark:text-ivory-100 hover:bg-dusty-50 shadow-xs transition"
          >
            +1.0 L
          </button>
          <button
            onClick={() => handleAdd(-250)}
            disabled={currentWaterMl <= 0}
            className="p-1.5 rounded-xl border border-ivory-300 dark:border-espresso-750 bg-white dark:bg-espresso-800 text-espresso-500 hover:text-espresso-800 disabled:opacity-40"
            title="Subtract 250 ml"
          >
            <Minus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Progress Track */}
      <div className="w-full bg-ivory-200 dark:bg-espresso-800 h-2.5 rounded-full overflow-hidden">
        <div
          className="h-full bg-dusty-500 rounded-full transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
};
