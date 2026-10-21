import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { MealType, NutritionProfile } from '../../types';
import { FoodDiary } from '../nutrition/FoodDiary';
import { MacroDonutChart } from '../nutrition/MacroDonutChart';
import { WeightTracker } from '../nutrition/WeightTracker';
import { FoodSearchModal, LoggedFoodPayload } from '../nutrition/FoodSearchModal';
import { CustomFoodModal } from '../nutrition/CustomFoodModal';
import { FitnessOnboardingModal } from '../nutrition/FitnessOnboardingModal';
import { NutritionAnalytics } from '../nutrition/NutritionAnalytics';
import { DEFAULT_NUTRITION_PROFILE } from '../../services/storage';
import { Calculator, Plus, Calendar, Utensils } from 'lucide-react';

export const NutritionView: React.FC = () => {
  const {
    state,
    addFoodDiaryEntry,
    addMultipleFoodDiaryEntries,
    deleteFoodDiaryEntry,
    addCustomFood,
    logWeight,
    deleteWeightLog,
    updateNutritionProfile,
  } = useApp();

  const [activeViewTab, setActiveViewTab] = useState<'diary' | 'analytics'>('diary');

  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  const [activeMealType, setActiveMealType] = useState<MealType>('breakfast');
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);
  const [isOnboardingModalOpen, setIsOnboardingModalOpen] = useState(false);

  const profile = state.nutritionProfile || DEFAULT_NUTRITION_PROFILE;
  const targetCalories = profile.targetCalories || 2200;
  const macroTargets = profile.macroTargets || {
    calories: 2200,
    protein: 140,
    carbs: 260,
    fat: 65,
  };

  // Compute daily totals for selected date
  const dayEntries = useMemo(() => {
    return (state.foodDiaryEntries || []).filter((e) => e.date === selectedDate);
  }, [state.foodDiaryEntries, selectedDate]);

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
  const consumedFiber = Number(
    dayEntries
      .reduce((acc, cur) => acc + (cur.fiber || 0), 0)
      .toFixed(1)
  );
  const consumedSodium = Math.round(
    dayEntries.reduce((acc, cur) => acc + (cur.sodium || 0), 0)
  );

  const incompleteFoodsCount = dayEntries.filter((e) => e.fiber === undefined).length;

  const handleOpenSearchModal = (meal: MealType) => {
    setActiveMealType(meal);
    setIsSearchModalOpen(true);
  };

  const handleLogFood = (foodData: LoggedFoodPayload) => {
    addFoodDiaryEntry({
      ...foodData,
      date: selectedDate,
      mealType: activeMealType,
      isSample: false,
    });
  };

  const handleLogMultipleFoods = (foods: LoggedFoodPayload[]) => {
    const payloads = foods.map((food) => ({
      ...food,
      date: selectedDate,
      mealType: activeMealType,
      isSample: false,
    }));
    addMultipleFoodDiaryEntries(payloads);
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Top Header */}
      <div className="border-b border-ivory-300 dark:border-espresso-800 pb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <span className="text-xs font-mono font-semibold uppercase tracking-wider text-terracotta-600 dark:text-terracotta-400">
            Metabolic Calibration & Fuel
          </span>
          <div className="flex items-center gap-3 mt-1">
            <h1 className="font-serif text-3xl sm:text-4xl font-normal text-espresso-950 dark:text-ivory-50 tracking-tight">
              Nutrition & Fuel
            </h1>
            <span className="text-[10px] uppercase font-mono px-2.5 py-0.5 rounded-md bg-ivory-200 dark:bg-espresso-800 text-espresso-800 dark:text-ivory-200 font-semibold">
              {profile.goal.toUpperCase()}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-espresso-500 dark:text-espresso-400 mt-1">
            Batch multiselect food logging, macro charts, annual calendar heatmaps, and body composition tracking.
          </p>
        </div>

        {/* View Switcher & Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* View Mode Toggle: Diary vs Trends & Heatmap */}
          <div className="inline-flex p-1 bg-ivory-100 dark:bg-espresso-800 rounded-xl border border-ivory-300 dark:border-espresso-700 mr-1">
            <button
              onClick={() => setActiveViewTab('diary')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition ${
                activeViewTab === 'diary'
                  ? 'bg-white dark:bg-espresso-700 text-espresso-950 dark:text-ivory-50 shadow-subtle'
                  : 'text-espresso-600 dark:text-espresso-300 hover:text-espresso-900 dark:hover:text-ivory-100'
              }`}
            >
              <Utensils className="w-3.5 h-3.5" />
              <span>Daily Diary</span>
            </button>
            <button
              onClick={() => setActiveViewTab('analytics')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition ${
                activeViewTab === 'analytics'
                  ? 'bg-white dark:bg-espresso-700 text-espresso-950 dark:text-ivory-50 shadow-subtle'
                  : 'text-espresso-600 dark:text-espresso-300 hover:text-espresso-900 dark:hover:text-ivory-100'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Trends & Heatmap</span>
            </button>
          </div>

          <button
            onClick={() => setIsCustomModalOpen(true)}
            className="px-3.5 py-2 rounded-xl border border-ivory-300 dark:border-espresso-700 bg-white dark:bg-espresso-850 hover:bg-ivory-50 dark:hover:bg-espresso-800 text-espresso-800 dark:text-ivory-100 text-xs font-semibold flex items-center gap-1.5 shadow-subtle transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Custom Food</span>
          </button>
          <button
            onClick={() => setIsOnboardingModalOpen(true)}
            className="px-4 py-2 rounded-xl text-white text-xs font-semibold flex items-center gap-1.5 shadow-subtle transition hover:opacity-95"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            <Calculator className="w-3.5 h-3.5" />
            <span>Calibrate Targets</span>
          </button>
        </div>
      </div>

      {/* Main View Tab Content */}
      {activeViewTab === 'analytics' ? (
        <NutritionAnalytics
          entries={state.foodDiaryEntries || []}
          profile={profile}
          onSelectDate={(date) => setSelectedDate(date)}
          onSwitchToDayView={() => setActiveViewTab('diary')}
        />
      ) : (
        /* Diary View: Two-Column Layout */
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.25fr)_minmax(340px,0.75fr)] gap-6 lg:gap-8 items-start">
          {/* Left Column: Food Diary */}
          <div className="min-w-0">
            <FoodDiary
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
              entries={state.foodDiaryEntries || []}
              onOpenSearchModal={handleOpenSearchModal}
              onDeleteEntry={deleteFoodDiaryEntry}
              enabledMealTypes={profile.enabledMealTypes}
            />
          </div>

          {/* Right Column: Macro Donut Chart & Weight Tracker */}
          <div className="min-w-0 space-y-6">
            <MacroDonutChart
              consumedCalories={consumedCalories}
              consumedProtein={consumedProtein}
              consumedCarbs={consumedCarbs}
              consumedFat={consumedFat}
              consumedFiber={consumedFiber}
              consumedSodium={consumedSodium}
              targetCalories={targetCalories}
              macroTargets={macroTargets}
              incompleteFoodsCount={incompleteFoodsCount}
              waterTargetMl={profile.waterTargetMl || 2500}
              waterIntakeMl={2000}
            />

            <WeightTracker
              weightLogs={state.weightLogs || []}
              currentGoal={profile.goal}
              selectedDate={selectedDate}
              onLogWeight={logWeight}
              onDeleteWeight={deleteWeightLog}
              onOpenTargetModal={() => setIsOnboardingModalOpen(true)}
            />
          </div>
        </div>
      )}

      {/* Modals */}
      <FoodSearchModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
        mealType={activeMealType}
        customFoods={state.customFoods}
        recipes={state.recipes}
        onLogFood={handleLogFood}
        onLogMultipleFoods={handleLogMultipleFoods}
        onOpenCustomModal={() => {
          setIsSearchModalOpen(false);
          setIsCustomModalOpen(true);
        }}
      />

      <CustomFoodModal
        isOpen={isCustomModalOpen}
        onClose={() => setIsCustomModalOpen(false)}
        onSaveCustomFood={(food) => {
          addCustomFood(food);
        }}
      />

      <FitnessOnboardingModal
        isOpen={isOnboardingModalOpen}
        onClose={() => setIsOnboardingModalOpen(false)}
        currentProfile={profile}
        onSaveProfile={(updatedProfile: NutritionProfile) => {
          updateNutritionProfile(updatedProfile);
        }}
      />
    </div>
  );
};
