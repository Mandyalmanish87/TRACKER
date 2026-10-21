import React from 'react';
import { MacroTargets } from '../../types';
import { Droplet, Plus, Minus } from 'lucide-react';

interface MacroDonutChartProps {
  consumedCalories: number;
  consumedProtein: number;
  consumedCarbs: number;
  consumedFat: number;
  consumedFiber?: number;
  consumedSodium?: number;
  targetCalories: number;
  macroTargets: MacroTargets;
  waterIntakeMl?: number;
  waterTargetMl?: number;
  onUpdateWater?: (newMl: number) => void;
  incompleteFoodsCount?: number;
}

export const MacroDonutChart: React.FC<MacroDonutChartProps> = ({
  consumedCalories,
  consumedProtein,
  consumedCarbs,
  consumedFat,
  consumedFiber,
  consumedSodium,
  targetCalories,
  macroTargets,
  waterIntakeMl = 0,
  waterTargetMl = 2500,
  onUpdateWater,
  incompleteFoodsCount = 0,
}) => {
  const caloriesFromProtein = consumedProtein * 4;
  const caloriesFromCarbs = consumedCarbs * 4;
  const caloriesFromFat = consumedFat * 9;
  const totalMacroCalories = caloriesFromProtein + caloriesFromCarbs + caloriesFromFat;

  // Percentages for SVG donut segments
  const proteinPct = totalMacroCalories > 0 ? (caloriesFromProtein / totalMacroCalories) * 100 : 33.3;
  const carbsPct = totalMacroCalories > 0 ? (caloriesFromCarbs / totalMacroCalories) * 100 : 33.3;
  const fatPct = totalMacroCalories > 0 ? (caloriesFromFat / totalMacroCalories) * 100 : 33.4;

  // SVG circular arc calculations (Circumference of r=40 is 251.32)
  const radius = 40;
  const circumference = 2 * Math.PI * radius;

  const proteinStroke = (proteinPct / 100) * circumference;
  const carbsStroke = (carbsPct / 100) * circumference;
  const fatStroke = (fatPct / 100) * circumference;

  const remainingCalories = Math.max(0, targetCalories - consumedCalories);
  const calorieProgressPct = targetCalories > 0 ? Math.min(100, Math.round((consumedCalories / targetCalories) * 100)) : 0;
  const isOverBudget = consumedCalories > targetCalories;

  return (
    <div className="bg-white dark:bg-espresso-900 border border-ivory-300 dark:border-espresso-800 rounded-2xl p-5 shadow-sm space-y-6">
      {/* Top Header: Calorie Budget Bar */}
      <div>
        <div className="flex items-baseline justify-between mb-2">
          <div>
            <span className="text-xs uppercase tracking-wider font-mono text-espresso-500 dark:text-espresso-400 font-semibold">
              Daily Energy Budget
            </span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="font-serif text-3xl font-bold text-espresso-950 dark:text-ivory-50 tabular-nums">
                {consumedCalories}
              </span>
              <span className="text-xs text-espresso-500 dark:text-espresso-400">
                / {targetCalories} kcal
              </span>
            </div>
          </div>
          <div className="text-right">
            <span
              className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                isOverBudget
                  ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                  : 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
              }`}
            >
              {isOverBudget ? `${consumedCalories - targetCalories} kcal surplus` : `${remainingCalories} kcal left`}
            </span>
          </div>
        </div>

        {/* Multi-tier progress bar */}
        <div className="h-2.5 w-full bg-ivory-200 dark:bg-espresso-800 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 rounded-full ${
              isOverBudget ? 'bg-amber-500' : 'bg-terracotta-500'
            }`}
            style={{ width: `${calorieProgressPct}%` }}
          />
        </div>
      </div>

      {/* Middle Section: Donut Chart + Macro Gauges */}
      <div className="grid grid-cols-1 sm:grid-cols-[140px_minmax(0,1fr)] gap-5 items-center">
        {/* SVG Donut */}
        <div className="relative w-32 h-32 mx-auto flex items-center justify-center">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r={radius}
              className="stroke-ivory-200 dark:stroke-espresso-800"
              strokeWidth="12"
              fill="transparent"
            />
            {totalMacroCalories > 0 && (
              <>
                {/* Protein Segment */}
                <circle
                  cx="50"
                  cy="50"
                  r={radius}
                  className="stroke-emerald-500 transition-all duration-500"
                  strokeWidth="12"
                  strokeDasharray={`${proteinStroke} ${circumference}`}
                  strokeDashoffset="0"
                  fill="transparent"
                />
                {/* Carbs Segment */}
                <circle
                  cx="50"
                  cy="50"
                  r={radius}
                  className="stroke-blue-500 transition-all duration-500"
                  strokeWidth="12"
                  strokeDasharray={`${carbsStroke} ${circumference}`}
                  strokeDashoffset={-proteinStroke}
                  fill="transparent"
                />
                {/* Fat Segment */}
                <circle
                  cx="50"
                  cy="50"
                  r={radius}
                  className="stroke-amber-500 transition-all duration-500"
                  strokeWidth="12"
                  strokeDasharray={`${fatStroke} ${circumference}`}
                  strokeDashoffset={-(proteinStroke + carbsStroke)}
                  fill="transparent"
                />
              </>
            )}
          </svg>
          <div className="absolute flex flex-col items-center justify-center text-center">
            <span className="text-[10px] text-espresso-400 font-mono uppercase">Energy</span>
            <span className="text-sm font-bold font-serif text-espresso-950 dark:text-ivory-50 tabular-nums">
              {calorieProgressPct}%
            </span>
          </div>
        </div>

        {/* Macro Progress Bars */}
        <div className="space-y-3">
          {/* Protein */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="flex items-center gap-1.5 font-medium text-espresso-800 dark:text-ivory-200">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Protein
              </span>
              <span className="text-espresso-500 dark:text-espresso-400 font-mono text-[11px]">
                <strong>{consumedProtein}g</strong> / {macroTargets.protein}g
              </span>
            </div>
            <div className="h-1.5 w-full bg-ivory-200 dark:bg-espresso-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all duration-300 rounded-full"
                style={{
                  width: `${macroTargets.protein > 0 ? Math.min(100, (consumedProtein / macroTargets.protein) * 100) : 0}%`,
                }}
              />
            </div>
          </div>

          {/* Carbs */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="flex items-center gap-1.5 font-medium text-espresso-800 dark:text-ivory-200">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                Carbohydrates
              </span>
              <span className="text-espresso-500 dark:text-espresso-400 font-mono text-[11px]">
                <strong>{consumedCarbs}g</strong> / {macroTargets.carbs}g
              </span>
            </div>
            <div className="h-1.5 w-full bg-ivory-200 dark:bg-espresso-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all duration-300 rounded-full"
                style={{
                  width: `${macroTargets.carbs > 0 ? Math.min(100, (consumedCarbs / macroTargets.carbs) * 100) : 0}%`,
                }}
              />
            </div>
          </div>

          {/* Fat */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="flex items-center gap-1.5 font-medium text-espresso-800 dark:text-ivory-200">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                Fats
              </span>
              <span className="text-espresso-500 dark:text-espresso-400 font-mono text-[11px]">
                <strong>{consumedFat}g</strong> / {macroTargets.fat}g
              </span>
            </div>
            <div className="h-1.5 w-full bg-ivory-200 dark:bg-espresso-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-500 transition-all duration-300 rounded-full"
                style={{
                  width: `${macroTargets.fat > 0 ? Math.min(100, (consumedFat / macroTargets.fat) * 100) : 0}%`,
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Micronutrient & Water Bar */}
      <div className="pt-3 border-t border-ivory-200 dark:border-espresso-800 flex flex-wrap items-center justify-between gap-3 text-xs text-espresso-600 dark:text-espresso-300">
        <div className="flex items-center gap-4">
          <div>
            <span className="text-espresso-400 text-[11px]">Fiber: </span>
            <span className="font-semibold">{consumedFiber !== undefined ? `${consumedFiber}g` : '—'}</span>
          </div>
          <div>
            <span className="text-espresso-400 text-[11px]">Sodium: </span>
            <span className="font-semibold">{consumedSodium !== undefined ? `${consumedSodium}mg` : '—'}</span>
          </div>
          {incompleteFoodsCount > 0 && (
            <span className="text-[10px] text-amber-600 dark:text-amber-400 italic">
              ({incompleteFoodsCount} items with incomplete micronutrient data)
            </span>
          )}
        </div>

        {/* Water Intake Tracker */}
        {onUpdateWater && (
          <div className="flex items-center gap-2">
            <Droplet className="w-3.5 h-3.5 text-blue-500" />
            <span className="font-mono text-[11px]">
              {(waterIntakeMl / 1000).toFixed(1)} / {(waterTargetMl / 1000).toFixed(1)} L
            </span>
            <div className="flex items-center gap-0.5 ml-1">
              <button
                onClick={() => onUpdateWater(Math.max(0, waterIntakeMl - 250))}
                className="w-5 h-5 rounded bg-ivory-200 dark:bg-espresso-800 hover:bg-ivory-300 dark:hover:bg-espresso-750 flex items-center justify-center text-espresso-700 dark:text-ivory-200"
                title="-250ml"
              >
                <Minus className="w-3 h-3" />
              </button>
              <button
                onClick={() => onUpdateWater(waterIntakeMl + 250)}
                className="w-5 h-5 rounded bg-blue-100 dark:bg-blue-950 hover:bg-blue-200 dark:hover:bg-blue-900 text-blue-700 dark:text-blue-300 flex items-center justify-center font-bold"
                title="+250ml"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

