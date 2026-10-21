import React, { useState } from 'react';
import { Scale, TrendingUp, TrendingDown, Minus, AlertCircle } from 'lucide-react';
import { WeightLogEntry, FitnessGoal } from '../../types';
import { evaluateWeightTrend } from '../../utils/nutritionCalculators';

interface WeightTrackerProps {
  weightLogs: WeightLogEntry[];
  currentGoal?: FitnessGoal;
  selectedDate: string;
  onLogWeight: (weightKg: number, date: string, notes?: string) => void;
  onDeleteWeight?: (id: string) => void;
  onOpenTargetModal?: () => void;
}

export const WeightTracker: React.FC<WeightTrackerProps> = ({
  weightLogs,
  currentGoal = 'maintain',
  selectedDate,
  onLogWeight,
  onDeleteWeight: _onDeleteWeight,
  onOpenTargetModal,
}) => {
  const [weightInput, setWeightInput] = useState<string>('');
  const [notesInput, setNotesInput] = useState<string>('');

  // Check if weight was already logged for selected date
  const existingForDate = weightLogs.find((w) => w.date === selectedDate);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(weightInput);
    if (!val || isNaN(val) || val < 20 || val > 300) return;
    onLogWeight(val, selectedDate, notesInput.trim() || undefined);
    setWeightInput('');
    setNotesInput('');
  };

  const trendAnalysis = evaluateWeightTrend(weightLogs, currentGoal);

  // Chronologically sorted logs for SVG Line chart
  const sortedLogs = [...weightLogs].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // SVG Chart Dimensions
  const chartHeight = 120;
  const chartWidth = 320;
  const padding = 20;

  const weights = sortedLogs.map((l) => l.weightKg);
  const minWeight = weights.length > 0 ? Math.floor(Math.min(...weights) - 1) : 60;
  const maxWeight = weights.length > 0 ? Math.ceil(Math.max(...weights) + 1) : 80;
  const weightRange = Math.max(1, maxWeight - minWeight);

  const points = sortedLogs.map((log, index) => {
    const x =
      sortedLogs.length === 1
        ? chartWidth / 2
        : padding + (index / (sortedLogs.length - 1)) * (chartWidth - 2 * padding);
    const y =
      chartHeight -
      padding -
      ((log.weightKg - minWeight) / weightRange) * (chartHeight - 2 * padding);
    return { x, y, ...log };
  });

  const svgPath =
    points.length > 1
      ? points.reduce((acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`, '')
      : '';

  return (
    <div className="bg-white dark:bg-espresso-900 border border-ivory-300 dark:border-espresso-800 rounded-2xl p-5 shadow-sm space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-ivory-100 dark:bg-espresso-800 flex items-center justify-center text-espresso-700 dark:text-ivory-200">
            <Scale className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-serif text-lg font-bold text-espresso-950 dark:text-ivory-50">
              Body Weight & Trend
            </h3>
            <p className="text-xs text-espresso-500 dark:text-espresso-400">
              Daily weigh-ins with 2-week progression regression.
            </p>
          </div>
        </div>
        {trendAnalysis.currentWeight && (
          <div className="text-right">
            <span className="font-serif text-2xl font-bold text-espresso-950 dark:text-ivory-50 tabular-nums">
              {trendAnalysis.currentWeight} <span className="text-xs font-normal text-espresso-500">kg</span>
            </span>
          </div>
        )}
      </div>

      {/* Recalibration Alert (if trend diverges from goal over >= 14 days) */}
      {trendAnalysis.recalibrationSuggested && trendAnalysis.suggestionMessage && (
        <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 flex items-start justify-between gap-3 text-xs text-amber-800 dark:text-amber-300">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
            <div>
              <span className="font-semibold block">Goal Recalibration Recommended</span>
              <p className="text-[11px] mt-0.5">{trendAnalysis.suggestionMessage}</p>
            </div>
          </div>
          {onOpenTargetModal && (
            <button
              onClick={onOpenTargetModal}
              className="px-2.5 py-1 bg-amber-200 dark:bg-amber-900 hover:bg-amber-300 dark:hover:bg-amber-800 text-amber-950 dark:text-amber-100 font-semibold rounded-lg shrink-0 text-[11px] transition"
            >
              Recalibrate
            </button>
          )}
        </div>
      )}

      {/* SVG Progression Line Chart */}
      {sortedLogs.length > 0 ? (
        <div className="p-3 bg-ivory-50/70 dark:bg-espresso-950/40 rounded-xl border border-ivory-200 dark:border-espresso-800/60">
          <div className="flex justify-between text-[10px] text-espresso-400 font-mono mb-1">
            <span>Range: {minWeight}kg – {maxWeight}kg</span>
            {trendAnalysis.weeklyRateKg !== undefined && (
              <span className="flex items-center gap-1 font-semibold text-espresso-600 dark:text-espresso-300">
                {trendAnalysis.weeklyRateKg > 0 ? (
                  <TrendingUp className="w-3 h-3 text-emerald-500" />
                ) : trendAnalysis.weeklyRateKg < 0 ? (
                  <TrendingDown className="w-3 h-3 text-blue-500" />
                ) : (
                  <Minus className="w-3 h-3 text-espresso-400" />
                )}
                {trendAnalysis.weeklyRateKg > 0 ? `+${trendAnalysis.weeklyRateKg}` : trendAnalysis.weeklyRateKg} kg/week
              </span>
            )}
          </div>
          <svg
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            className="w-full h-28 overflow-visible"
          >
            {/* Grid Line */}
            <line
              x1={padding}
              y1={chartHeight / 2}
              x2={chartWidth - padding}
              y2={chartHeight / 2}
              stroke="currentColor"
              className="text-ivory-200 dark:text-espresso-800 stroke-[1] stroke-dasharray-[2]"
            />
            {/* Sparkline */}
            {points.length > 1 && (
              <path
                d={svgPath}
                fill="none"
                className="stroke-terracotta-500 stroke-[2.5]"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
            {/* Data Points */}
            {points.map((p) => (
              <circle
                key={p.id}
                cx={p.x}
                cy={p.y}
                r="3.5"
                className="fill-terracotta-600 stroke-white dark:stroke-espresso-900 stroke-[1.5] transition hover:r-5 cursor-pointer"
              >
                <title>{`${p.date}: ${p.weightKg} kg`}</title>
              </circle>
            ))}
          </svg>
        </div>
      ) : (
        <div className="py-6 text-center text-xs text-espresso-400 dark:text-espresso-500 italic">
          No weight logs yet. Log your first weight measurement below.
        </div>
      )}

      {/* Quick Entry Form for selectedDate */}
      <form onSubmit={handleSubmit} className="pt-2 border-t border-ivory-200 dark:border-espresso-800 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-espresso-800 dark:text-ivory-200">
            Log weight for <strong className="font-mono">{selectedDate}</strong>
          </span>
          {existingForDate && (
            <span className="text-[11px] text-espresso-500 dark:text-espresso-400">
              Current: <strong>{existingForDate.weightKg} kg</strong>
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <input
            type="number"
            step="0.1"
            min="20"
            max="300"
            placeholder={existingForDate ? String(existingForDate.weightKg) : 'Weight (kg)'}
            value={weightInput}
            onChange={(e) => setWeightInput(e.target.value)}
            className="flex-1 px-3 py-1.5 rounded-xl border border-ivory-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-950 text-xs sm:text-sm text-espresso-900 dark:text-ivory-100 font-bold focus:outline-none"
          />
          <button
            type="submit"
            disabled={!weightInput.trim()}
            className="px-4 py-1.5 bg-espresso-900 dark:bg-ivory-100 hover:bg-espresso-800 dark:hover:bg-white text-white dark:text-espresso-950 text-xs font-semibold rounded-xl disabled:opacity-40 transition"
          >
            {existingForDate ? 'Update' : 'Log'}
          </button>
        </div>
      </form>
    </div>
  );
};

