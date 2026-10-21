import React from 'react';
import { Card } from '../common/Card';
import { useApp } from '../../context/AppContext';
import { ArrowRight } from 'lucide-react';
import { DEFAULT_NUTRITION_PROFILE } from '../../services/storage';

interface FitnessSummaryWidgetProps {
  onNavigateToNutrition?: () => void;
}

export const FitnessSummaryWidget: React.FC<FitnessSummaryWidgetProps> = ({
  onNavigateToNutrition,
}) => {
  const { state } = useApp();
  const profile = state.nutritionProfile || DEFAULT_NUTRITION_PROFILE;
  const targetCalories = profile.targetCalories || 2200;
  const macroTargets = profile.macroTargets || {
    calories: 2200,
    protein: 140,
    carbs: 260,
    fat: 65,
  };

  const todayStr = new Date().toISOString().split('T')[0];
  const dayEntries = (state.foodDiaryEntries || []).filter((e) => e.date === todayStr);

  const consumedCalories = dayEntries.reduce((acc, cur) => acc + cur.calories, 0);
  const consumedProtein = Number(
    dayEntries.reduce((acc, cur) => acc + cur.protein, 0).toFixed(1)
  );
  const consumedCarbs = Number(
    dayEntries.reduce((acc, cur) => acc + cur.carbs, 0).toFixed(1)
  );
  const consumedFat = Number(
    dayEntries.reduce((acc, cur) => acc + cur.fat, 0).toFixed(1)
  );

  const remainingCalories = Math.max(0, targetCalories - consumedCalories);
  const isOver = consumedCalories > targetCalories;
  const progressPct = targetCalories > 0 ? Math.min(100, Math.round((consumedCalories / targetCalories) * 100)) : 0;

  return (
    <Card
      eyebrow="Fuel & Nutrition"
      title="Daily Energy & Macros"
      subtitle={`${profile.goal.toUpperCase()} Target · ${targetCalories} kcal`}
      action={
        onNavigateToNutrition ? (
          <button
            onClick={onNavigateToNutrition}
            className="text-xs font-semibold text-espresso-600 dark:text-ivory-200 hover:text-espresso-900 flex items-center gap-0.5 group"
          >
            <span>Diary</span>
            <ArrowRight className="w-3.5 h-3.5 transition group-hover:translate-x-0.5" />
          </button>
        ) : undefined
      }
    >
      <div className="space-y-4">
        {/* Calorie Progress */}
        <div>
          <div className="flex items-baseline justify-between mb-1.5">
            <span className="font-serif text-2xl font-bold text-espresso-950 dark:text-ivory-50 tabular-nums">
              {consumedCalories} <span className="text-xs font-normal text-espresso-400">/ {targetCalories} kcal</span>
            </span>
            <span
              className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                isOver
                  ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                  : 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
              }`}
            >
              {isOver ? `+${consumedCalories - targetCalories} kcal` : `${remainingCalories} kcal remaining`}
            </span>
          </div>

          <div className="h-2 w-full bg-ivory-200 dark:bg-espresso-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                isOver ? 'bg-amber-500' : 'bg-terracotta-500'
              }`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Macro Triple Pill */}
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="p-2 rounded-xl bg-ivory-50 dark:bg-espresso-850 border border-ivory-200 dark:border-espresso-750">
            <span className="text-[10px] text-espresso-400 font-mono uppercase block">Protein</span>
            <span className="font-bold text-emerald-700 dark:text-emerald-400 font-mono">
              {consumedProtein}g
            </span>
            <span className="text-[10px] text-espresso-400 block font-mono">/ {macroTargets.protein}g</span>
          </div>

          <div className="p-2 rounded-xl bg-ivory-50 dark:bg-espresso-850 border border-ivory-200 dark:border-espresso-750">
            <span className="text-[10px] text-espresso-400 font-mono uppercase block">Carbs</span>
            <span className="font-bold text-blue-700 dark:text-blue-400 font-mono">
              {consumedCarbs}g
            </span>
            <span className="text-[10px] text-espresso-400 block font-mono">/ {macroTargets.carbs}g</span>
          </div>

          <div className="p-2 rounded-xl bg-ivory-50 dark:bg-espresso-850 border border-ivory-200 dark:border-espresso-750">
            <span className="text-[10px] text-espresso-400 font-mono uppercase block">Fats</span>
            <span className="font-bold text-amber-700 dark:text-amber-400 font-mono">
              {consumedFat}g
            </span>
            <span className="text-[10px] text-espresso-400 block font-mono">/ {macroTargets.fat}g</span>
          </div>
        </div>
      </div>
    </Card>
  );
};

