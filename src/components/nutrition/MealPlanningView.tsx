import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { MealPlanDay, MealType } from '../../types';
import { Calendar, Plus, Trash2, CheckCircle2, Copy, Utensils } from 'lucide-react';
import { Button } from '../common/Button';

export const MealPlanningView: React.FC = () => {
  const { state, saveMealPlanDay, copyPlannedToActualDiary } = useApp();

  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  const [isAddingMeal, setIsAddingMeal] = useState(false);
  const [mealType, setMealType] = useState<MealType>('lunch');
  const [foodName, setFoodName] = useState('');
  const [calories, setCalories] = useState<number>(450);
  const [protein, setProtein] = useState<number>(30);
  const [carbs] = useState<number>(50);
  const [fat] = useState<number>(12);
  const quantity = 1;
  const unit = 'serving' as const;

  const [copiedNotification, setCopiedNotification] = useState<string | null>(null);

  const currentPlan: MealPlanDay = useMemo(() => {
    const existing = (state.mealPlans || []).find((p) => p.date === selectedDate);
    if (existing) return existing;

    const profileTargetCal = state.nutritionProfile?.targetCalories || 2200;
    const profileMacro = state.nutritionProfile?.macroTargets || {
      calories: 2200,
      protein: 140,
      carbs: 260,
      fat: 65,
    };

    return {
      id: `mp-${selectedDate}`,
      date: selectedDate,
      targetCalories: profileTargetCal,
      targetProtein: profileMacro.protein,
      targetCarbs: profileMacro.carbs,
      targetFat: profileMacro.fat,
      plannedMeals: [],
    };
  }, [state.mealPlans, state.nutritionProfile, selectedDate]);

  // Actual consumed from diary
  const actualEntries = useMemo(() => {
    return (state.foodDiaryEntries || []).filter((e) => e.date === selectedDate);
  }, [state.foodDiaryEntries, selectedDate]);

  const actualCalories = actualEntries.reduce((sum, e) => sum + e.calories, 0);
  const actualProtein = Math.round(actualEntries.reduce((sum, e) => sum + e.protein, 0));
  const actualCarbs = Math.round(actualEntries.reduce((sum, e) => sum + e.carbs, 0));
  const actualFat = Math.round(actualEntries.reduce((sum, e) => sum + e.fat, 0));

  const plannedTotalCalories = currentPlan.plannedMeals.reduce((sum, m) => sum + m.calories, 0);
  const plannedTotalProtein = currentPlan.plannedMeals.reduce((sum, m) => sum + m.protein, 0);
  const plannedTotalCarbs = currentPlan.plannedMeals.reduce((sum, m) => sum + m.carbs, 0);
  const plannedTotalFat = currentPlan.plannedMeals.reduce((sum, m) => sum + m.fat, 0);

  const handleSavePlannedMeal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!foodName.trim()) return;

    const newMeal = {
      mealType,
      customFoodName: foodName.trim(),
      plannedQuantity: quantity,
      plannedUnit: unit,
      calories,
      protein,
      carbs,
      fat,
    };

    const updatedPlan: MealPlanDay = {
      ...currentPlan,
      plannedMeals: [...currentPlan.plannedMeals, newMeal],
    };

    saveMealPlanDay(updatedPlan);
    setFoodName('');
    setIsAddingMeal(false);
  };

  const handleRemoveMeal = (index: number) => {
    const updatedMeals = currentPlan.plannedMeals.filter((_, idx) => idx !== index);
    saveMealPlanDay({ ...currentPlan, plannedMeals: updatedMeals });
  };

  const handleCopyPlannedToActual = () => {
    const count = copyPlannedToActualDiary(selectedDate);
    if (count > 0) {
      setCopiedNotification(`Successfully logged ${count} planned meals into today's Food Diary!`);
      setTimeout(() => setCopiedNotification(null), 4000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Date Switcher & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl border border-ivory-200 dark:border-espresso-750 bg-white dark:bg-espresso-850 shadow-subtle">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-ochre-100 dark:bg-ochre-900/40 text-ochre-700 dark:text-ochre-300 flex items-center justify-center">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-base text-espresso-950 dark:text-ivory-50">
              Weekly Meal Architecture
            </h3>
            <p className="text-xs text-espresso-500 dark:text-espresso-400">
              Pre-plan macronutrients and synchronise with real-world intake
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-ivory-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-800 text-xs font-mono font-medium text-espresso-900 dark:text-ivory-100"
          />
          <Button
            variant="secondary"
            size="sm"
            icon={<Copy className="w-3.5 h-3.5" />}
            onClick={handleCopyPlannedToActual}
            disabled={currentPlan.plannedMeals.length === 0}
          >
            Log as Planned
          </Button>
        </div>
      </div>

      {copiedNotification && (
        <div className="p-3.5 rounded-xl bg-sage-50 dark:bg-sage-950/20 border border-sage-300 dark:border-sage-800 text-xs text-sage-800 dark:text-sage-200 flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-sage-600 shrink-0" />
          <span>{copiedNotification}</span>
        </div>
      )}

      {/* Planned vs Actual Comparison Card */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl border border-ivory-200 dark:border-espresso-750 bg-white dark:bg-espresso-850 shadow-subtle text-center space-y-1">
          <span className="text-[11px] font-mono uppercase text-espresso-400">Calories</span>
          <p className="font-mono text-base sm:text-lg font-bold text-espresso-900 dark:text-ivory-50">
            {plannedTotalCalories} <span className="text-xs font-normal text-espresso-400">plan</span>
          </p>
          <p className="text-xs font-mono text-espresso-500 dark:text-espresso-400">
            Actual: <span className="font-semibold text-espresso-800 dark:text-ivory-200">{actualCalories}</span> kcal
          </p>
        </div>

        <div className="p-4 rounded-2xl border border-ivory-200 dark:border-espresso-750 bg-white dark:bg-espresso-850 shadow-subtle text-center space-y-1">
          <span className="text-[11px] font-mono uppercase text-terracotta-500">Protein</span>
          <p className="font-mono text-base sm:text-lg font-bold text-terracotta-600 dark:text-terracotta-400">
            {plannedTotalProtein}g <span className="text-xs font-normal text-espresso-400">plan</span>
          </p>
          <p className="text-xs font-mono text-espresso-500 dark:text-espresso-400">
            Actual: <span className="font-semibold text-espresso-800 dark:text-ivory-200">{actualProtein}g</span>
          </p>
        </div>

        <div className="p-4 rounded-2xl border border-ivory-200 dark:border-espresso-750 bg-white dark:bg-espresso-850 shadow-subtle text-center space-y-1">
          <span className="text-[11px] font-mono uppercase text-ochre-500">Carbs</span>
          <p className="font-mono text-base sm:text-lg font-bold text-ochre-600 dark:text-ochre-400">
            {plannedTotalCarbs}g <span className="text-xs font-normal text-espresso-400">plan</span>
          </p>
          <p className="text-xs font-mono text-espresso-500 dark:text-espresso-400">
            Actual: <span className="font-semibold text-espresso-800 dark:text-ivory-200">{actualCarbs}g</span>
          </p>
        </div>

        <div className="p-4 rounded-2xl border border-ivory-200 dark:border-espresso-750 bg-white dark:bg-espresso-850 shadow-subtle text-center space-y-1">
          <span className="text-[11px] font-mono uppercase text-sage-500">Fats</span>
          <p className="font-mono text-base sm:text-lg font-bold text-sage-600 dark:text-sage-400">
            {plannedTotalFat}g <span className="text-xs font-normal text-espresso-400">plan</span>
          </p>
          <p className="text-xs font-mono text-espresso-500 dark:text-espresso-400">
            Actual: <span className="font-semibold text-espresso-800 dark:text-ivory-200">{actualFat}g</span>
          </p>
        </div>
      </div>

      {/* Planned Meals List */}
      <div className="p-5 rounded-2xl border border-ivory-200 dark:border-espresso-750 bg-white dark:bg-espresso-850 shadow-subtle space-y-4">
        <div className="flex items-center justify-between border-b border-ivory-200 dark:border-espresso-750 pb-3">
          <span className="font-bold text-sm text-espresso-950 dark:text-ivory-50">
            Planned Meals for {selectedDate}
          </span>
          <Button
            variant="secondary"
            size="sm"
            icon={<Plus className="w-3.5 h-3.5" />}
            onClick={() => setIsAddingMeal(!isAddingMeal)}
          >
            {isAddingMeal ? 'Cancel' : 'Add Planned Food'}
          </Button>
        </div>

        {/* Meal Creator Inline Form */}
        {isAddingMeal && (
          <form
            onSubmit={handleSavePlannedMeal}
            className="p-4 rounded-xl bg-ivory-50 dark:bg-espresso-800/40 border border-ivory-200 dark:border-espresso-750 space-y-3 animate-in fade-in"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-espresso-700 dark:text-ivory-200 mb-1">
                  Food or Recipe Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Oatmeal with Whey & Berries"
                  value={foodName}
                  onChange={(e) => setFoodName(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl text-xs border border-ivory-300 dark:border-espresso-700 bg-white dark:bg-espresso-800 text-espresso-900 dark:text-ivory-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-espresso-700 dark:text-ivory-200 mb-1">
                  Meal Slot
                </label>
                <select
                  value={mealType}
                  onChange={(e) => setMealType(e.target.value as MealType)}
                  className="w-full px-3 py-1.5 rounded-xl text-xs border border-ivory-300 dark:border-espresso-700 bg-white dark:bg-espresso-800 text-espresso-900 dark:text-ivory-100"
                >
                  <option value="breakfast">Breakfast</option>
                  <option value="lunch">Lunch</option>
                  <option value="dinner">Dinner</option>
                  <option value="snacks">Snacks</option>
                  <option value="pre_workout">Pre-Workout</option>
                  <option value="post_workout">Post-Workout</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-espresso-700 dark:text-ivory-200 mb-1">
                  Calories
                </label>
                <input
                  type="number"
                  min="0"
                  value={calories}
                  onChange={(e) => setCalories(parseInt(e.target.value, 10) || 0)}
                  className="w-full px-3 py-1.5 rounded-xl text-xs font-mono border border-ivory-300 dark:border-espresso-700 bg-white dark:bg-espresso-800 text-espresso-900 dark:text-ivory-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-espresso-700 dark:text-ivory-200 mb-1">
                  Protein (g)
                </label>
                <input
                  type="number"
                  min="0"
                  value={protein}
                  onChange={(e) => setProtein(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-1.5 rounded-xl text-xs font-mono border border-ivory-300 dark:border-espresso-700 bg-white dark:bg-espresso-800 text-espresso-900 dark:text-ivory-100"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="secondary" size="sm" onClick={() => setIsAddingMeal(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm">
                Save to Plan
              </Button>
            </div>
          </form>
        )}

        {/* Planned Meals Items */}
        {currentPlan.plannedMeals.length === 0 ? (
          <div className="p-8 text-center border-2 border-dashed border-ivory-200 dark:border-espresso-750 rounded-xl space-y-2">
            <Utensils className="w-8 h-8 mx-auto text-espresso-300" />
            <p className="text-xs font-medium text-espresso-600 dark:text-espresso-300">
              No planned meals for this date yet.
            </p>
            <p className="text-[11px] text-espresso-400">
              Pre-plan your meals in advance to align with busy lecture blocks.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {currentPlan.plannedMeals.map((meal, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-xl border border-ivory-200 dark:border-espresso-750 bg-ivory-50/40 dark:bg-espresso-800/30 flex items-center justify-between text-xs"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono uppercase bg-terracotta-100 dark:bg-terracotta-900/40 text-terracotta-700 dark:text-terracotta-300 font-semibold">
                      {meal.mealType.replace('_', ' ')}
                    </span>
                    <span className="font-semibold text-espresso-950 dark:text-ivory-50 truncate">
                      {meal.customFoodName}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-espresso-500 dark:text-espresso-400 font-mono text-[11px] mt-0.5">
                    <span>{meal.calories} kcal</span>
                    <span>•</span>
                    <span>{meal.protein}g P</span>
                    <span>•</span>
                    <span>{meal.carbs}g C</span>
                    <span>•</span>
                    <span>{meal.fat}g F</span>
                  </div>
                </div>

                <button
                  onClick={() => handleRemoveMeal(idx)}
                  className="p-1 rounded text-espresso-400 hover:text-rose-600 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
