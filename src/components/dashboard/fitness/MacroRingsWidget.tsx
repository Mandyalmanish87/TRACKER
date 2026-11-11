import React, { useMemo } from 'react';
import { useApp } from '../../../context/AppContext';
import { Card } from '../../common/Card';
import { Flame } from 'lucide-react';

export const MacroRingsWidget: React.FC = () => {
  const { state } = useApp();
  const todayStr = new Date().toISOString().split('T')[0];

  const profile = state.nutritionProfile;
  const targetCalories = profile?.targetCalories || 2200;
  const targets = profile?.macroTargets || {
    calories: 2200,
    protein: 140,
    carbs: 260,
    fat: 65,
  };

  const todayEntries = useMemo(() => {
    return (state.foodDiaryEntries || []).filter((e) => e.date === todayStr);
  }, [state.foodDiaryEntries, todayStr]);

  const calories = todayEntries.reduce((sum, e) => sum + e.calories, 0);
  const protein = Math.round(todayEntries.reduce((sum, e) => sum + e.protein, 0));
  const carbs = Math.round(todayEntries.reduce((sum, e) => sum + e.carbs, 0));
  const fat = Math.round(todayEntries.reduce((sum, e) => sum + e.fat, 0));

  const calPct = Math.min(100, Math.round((calories / targetCalories) * 100));
  const proPct = Math.min(100, Math.round((protein / targets.protein) * 100));
  const carbPct = Math.min(100, Math.round((carbs / targets.carbs) * 100));
  const fatPct = Math.min(100, Math.round((fat / targets.fat) * 100));

  return (
    <Card
      eyebrow="Fuel OS"
      title="Nutrition & Macro Targets"
      subtitle={`${calories} / ${targetCalories} kcal consumed today`}
    >
      <div className="space-y-4">
        {/* Calorie Progress Bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="font-semibold text-espresso-900 dark:text-ivory-50 flex items-center gap-1">
              <Flame className="w-3.5 h-3.5 text-terracotta-500" />
              Calories
            </span>
            <span className="text-espresso-500">{calPct}%</span>
          </div>
          <div className="w-full h-2 rounded-full bg-ivory-200 dark:bg-espresso-750 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-terracotta-500 to-ochre-500 transition-all duration-300"
              style={{ width: `${calPct}%` }}
            />
          </div>
        </div>

        {/* 3 Macro Bars */}
        <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono pt-1">
          <div className="p-2.5 rounded-xl bg-ivory-50 dark:bg-espresso-800/40 border border-ivory-200 dark:border-espresso-700 space-y-1">
            <span className="text-[10px] uppercase text-terracotta-600 dark:text-terracotta-400 font-bold">
              Protein
            </span>
            <p className="font-bold text-espresso-900 dark:text-ivory-100 text-sm">
              {protein}g
            </p>
            <p className="text-[10px] text-espresso-400">/ {targets.protein}g ({proPct}%)</p>
          </div>

          <div className="p-2.5 rounded-xl bg-ivory-50 dark:bg-espresso-800/40 border border-ivory-200 dark:border-espresso-700 space-y-1">
            <span className="text-[10px] uppercase text-ochre-600 dark:text-ochre-400 font-bold">
              Carbs
            </span>
            <p className="font-bold text-espresso-900 dark:text-ivory-100 text-sm">
              {carbs}g
            </p>
            <p className="text-[10px] text-espresso-400">/ {targets.carbs}g ({carbPct}%)</p>
          </div>

          <div className="p-2.5 rounded-xl bg-ivory-50 dark:bg-espresso-800/40 border border-ivory-200 dark:border-espresso-700 space-y-1">
            <span className="text-[10px] uppercase text-sage-600 dark:text-sage-400 font-bold">
              Fat
            </span>
            <p className="font-bold text-espresso-900 dark:text-ivory-100 text-sm">
              {fat}g
            </p>
            <p className="text-[10px] text-espresso-400">/ {targets.fat}g ({fatPct}%)</p>
          </div>
        </div>
      </div>
    </Card>
  );
};

