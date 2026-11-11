import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { MealType, Recipe } from '../../types';
import { FoodDiary } from '../nutrition/FoodDiary';
import { MacroDonutChart } from '../nutrition/MacroDonutChart';
import { WeightTracker } from '../nutrition/WeightTracker';
import { FoodSearchModal, LoggedFoodPayload } from '../nutrition/FoodSearchModal';
import { CustomFoodModal } from '../nutrition/CustomFoodModal';
import { FitnessOnboardingModal } from '../nutrition/FitnessOnboardingModal';
import { NutritionAnalytics } from '../nutrition/NutritionAnalytics';
import { MealPlanningView } from '../nutrition/MealPlanningView';
import { SmartRecalibrationCard } from '../nutrition/SmartRecalibrationCard';
import { MicronutrientDrawer } from '../nutrition/MicronutrientDrawer';
import { BarcodeScannerModal } from '../nutrition/BarcodeScannerModal';
import { CronometerMicronutrientDashboard } from '../nutrition/CronometerMicronutrientDashboard';
import { NutrientBalanceDashboard } from '../nutrition/NutrientBalanceDashboard';
import { HydrationTrackerCard } from '../nutrition/HydrationTrackerCard';
import { RecipeBuilderModal } from '../nutrition/RecipeBuilderModal';
import { DEFAULT_NUTRITION_PROFILE } from '../../services/storage';
import { ProFeatureGate } from '../common/ProFeatureGate';
import {
  Calculator,
  Plus,
  Calendar,
  Utensils,
  ScanBarcode,
  Sparkles,
  Droplet,
  Scale,
  Apple,
  ChefHat,
} from 'lucide-react';

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
    logHydration,
    deleteHydrationLog,
  } = useApp();

  const [activeViewTab, setActiveViewTab] = useState<
    'diary' | 'micros' | 'balance' | 'hydration' | 'planner' | 'recalibration' | 'analytics'
  >('diary');

  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  const [activeMealType, setActiveMealType] = useState<MealType>('breakfast');
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);
  const [isOnboardingModalOpen, setIsOnboardingModalOpen] = useState(false);
  const [isBarcodeScannerOpen, setIsBarcodeScannerOpen] = useState(false);
  const [isMicrosDrawerOpen, setIsMicrosDrawerOpen] = useState(false);
  const [isRecipeModalOpen, setIsRecipeModalOpen] = useState(false);

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

  const waterIntakeMl = useMemo(() => {
    return (state.hydrationLogs || [])
      .filter((h) => h.date === selectedDate)
      .reduce((sum, item) => sum + item.amountMl, 0);
  }, [state.hydrationLogs, selectedDate]);

  const handleUpdateWater = (newTotal: number) => {
    const delta = newTotal - waterIntakeMl;
    if (delta > 0) {
      logHydration(delta, selectedDate);
    } else if (delta < 0) {
      const entries = (state.hydrationLogs || []).filter((h) => h.date === selectedDate);
      if (entries.length > 0) {
        const latest = entries[0];
        const absDelta = Math.abs(delta);
        if (latest.amountMl <= absDelta) {
          deleteHydrationLog(latest.id);
        } else {
          deleteHydrationLog(latest.id);
          logHydration(latest.amountMl - absDelta, selectedDate);
        }
      }
    }
  };

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

  const handleSaveRecipe = (recipe: Recipe) => {
    // Add recipe as a custom food item into library
    addCustomFood({
      name: recipe.name,
      category: 'Custom',
      servingSize: 1,
      servingUnit: 'serving',
      calories: recipe.caloriesPerServing,
      protein: recipe.proteinPerServing,
      carbs: recipe.carbsPerServing,
      fat: recipe.fatPerServing,
      notes: `Batch recipe (${recipe.totalServings} servings). Ingredients: ${recipe.ingredients.map((i) => i.foodName).join(', ')}`,
    });
  };

  // Macro progress percentages (clamped to 100 for visual bars)
  const calPct = Math.round((consumedCalories / targetCalories) * 100);
  const protPct = Math.round((consumedProtein / macroTargets.protein) * 100);
  const carbPct = Math.round((consumedCarbs / macroTargets.carbs) * 100);
  const fatPct = Math.round((consumedFat / macroTargets.fat) * 100);

  return (
    <div className="nutrition-page flex flex-col gap-6 pb-12">
      {/* Top Header */}
      <div className="my-space-header flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <span className="text-xs font-mono font-semibold uppercase tracking-wider text-terracotta-600 dark:text-terracotta-400">
            Fuel OS · Metabolic Calibration &amp; Nutrition
          </span>
          <div className="flex items-center gap-3 mt-1">
            <h1 className="font-serif text-3xl sm:text-4xl font-normal text-espresso-950 dark:text-ivory-50 tracking-tight">
              Nutrition &amp; Fuel Architecture
            </h1>
            <span className="text-[10px] uppercase font-mono px-2.5 py-0.5 rounded-md bg-ivory-200 dark:bg-espresso-800 text-espresso-800 dark:text-ivory-200 font-semibold">
              {profile.goal.toUpperCase()}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-espresso-500 dark:text-espresso-400 mt-1">
            Food diary, offline barcode scanner, Cronometer micronutrients, nutrient balance, and adaptive TDEE.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="my-space-header-actions flex flex-wrap items-center gap-2">
          {/* Barcode Scanner Modal Trigger */}
          <button
            onClick={() => setIsBarcodeScannerOpen(true)}
            className="px-3.5 py-2 rounded-xl border border-ivory-300 dark:border-espresso-750 bg-white dark:bg-espresso-850 hover:bg-ivory-50 dark:hover:bg-espresso-800 text-espresso-800 dark:text-ivory-100 text-xs font-semibold flex items-center gap-1.5 shadow-subtle transition"
          >
            <ScanBarcode className="w-3.5 h-3.5 text-terracotta-500" />
            <span>Scan Barcode</span>
          </button>

          {/* Recipe Builder Trigger */}
          <button
            onClick={() => setIsRecipeModalOpen(true)}
            className="px-3.5 py-2 rounded-xl border border-ivory-300 dark:border-espresso-750 bg-white dark:bg-espresso-850 hover:bg-ivory-50 dark:hover:bg-espresso-800 text-espresso-800 dark:text-ivory-100 text-xs font-semibold flex items-center gap-1.5 shadow-subtle transition"
          >
            <ChefHat className="w-3.5 h-3.5 text-ochre-500" />
            <span>Build Recipe</span>
          </button>

          <button
            onClick={() => setIsCustomModalOpen(true)}
            className="px-3.5 py-2 rounded-xl border border-ivory-300 dark:border-espresso-750 bg-white dark:bg-espresso-850 hover:bg-ivory-50 dark:hover:bg-espresso-800 text-espresso-800 dark:text-ivory-100 text-xs font-semibold flex items-center gap-1.5 shadow-subtle transition"
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

      {/* ── Top 4 Macro Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Calories */}
        <div className="p-4 rounded-2xl border border-ivory-300 dark:border-espresso-750 bg-white dark:bg-espresso-850 shadow-subtle space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-mono text-[10px] uppercase font-bold text-espresso-400">Calories</span>
            <span className="font-bold text-espresso-950 dark:text-ivory-50 text-[11px]">
              {targetCalories - consumedCalories} kcal left
            </span>
          </div>
          <p className="font-serif text-2xl font-bold text-espresso-950 dark:text-ivory-50">
            {consumedCalories}{' '}
            <span className="text-xs font-sans font-normal text-espresso-500">/ {targetCalories}</span>
          </p>
          <div className="w-full bg-ivory-200 dark:bg-espresso-800 h-2 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${Math.min(100, calPct)}%`,
                backgroundColor: calPct > 105 ? '#ef4444' : 'var(--accent, #C45532)',
              }}
            />
          </div>
        </div>

        {/* Protein */}
        <div className="p-4 rounded-2xl border border-ivory-300 dark:border-espresso-750 bg-white dark:bg-espresso-850 shadow-subtle space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-mono text-[10px] uppercase font-bold text-terracotta-600 dark:text-terracotta-400">
              Protein
            </span>
            <span className="font-bold text-terracotta-600 text-[11px]">{protPct}%</span>
          </div>
          <p className="font-serif text-2xl font-bold text-espresso-950 dark:text-ivory-50">
            {consumedProtein}g{' '}
            <span className="text-xs font-sans font-normal text-espresso-500">/ {macroTargets.protein}g</span>
          </p>
          <div className="w-full bg-ivory-200 dark:bg-espresso-800 h-2 rounded-full overflow-hidden">
            <div
              className="h-full bg-terracotta-500 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, protPct)}%` }}
            />
          </div>
        </div>

        {/* Carbohydrates */}
        <div className="p-4 rounded-2xl border border-ivory-300 dark:border-espresso-750 bg-white dark:bg-espresso-850 shadow-subtle space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-mono text-[10px] uppercase font-bold text-ochre-600 dark:text-ochre-400">
              Carbs
            </span>
            <span className="font-bold text-ochre-600 text-[11px]">{carbPct}%</span>
          </div>
          <p className="font-serif text-2xl font-bold text-espresso-950 dark:text-ivory-50">
            {consumedCarbs}g{' '}
            <span className="text-xs font-sans font-normal text-espresso-500">/ {macroTargets.carbs}g</span>
          </p>
          <div className="w-full bg-ivory-200 dark:bg-espresso-800 h-2 rounded-full overflow-hidden">
            <div
              className="h-full bg-ochre-500 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, carbPct)}%` }}
            />
          </div>
        </div>

        {/* Fats */}
        <div className="p-4 rounded-2xl border border-ivory-300 dark:border-espresso-750 bg-white dark:bg-espresso-850 shadow-subtle space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-mono text-[10px] uppercase font-bold text-dusty-600 dark:text-dusty-400">
              Fats
            </span>
            <span className="font-bold text-dusty-600 text-[11px]">{fatPct}%</span>
          </div>
          <p className="font-serif text-2xl font-bold text-espresso-950 dark:text-ivory-50">
            {consumedFat}g{' '}
            <span className="text-xs font-sans font-normal text-espresso-500">/ {macroTargets.fat}g</span>
          </p>
          <div className="w-full bg-ivory-200 dark:bg-espresso-800 h-2 rounded-full overflow-hidden">
            <div
              className="h-full bg-dusty-500 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, fatPct)}%` }}
            />
          </div>
        </div>
      </div>

      {/* View Mode Tabs */}
      <div className="my-space-section-tabs flex items-center gap-1.5 overflow-x-auto border-b border-ivory-200 dark:border-espresso-750 pb-2 text-xs font-semibold">
        {[
          { id: 'diary', label: 'Daily Diary', icon: <Utensils className="w-3.5 h-3.5" /> },
          { id: 'micros', label: 'Micronutrients', icon: <Apple className="w-3.5 h-3.5" /> },
          { id: 'balance', label: 'Nutrient Ratios', icon: <Scale className="w-3.5 h-3.5" /> },
          { id: 'hydration', label: 'Hydration', icon: <Droplet className="w-3.5 h-3.5" /> },
          { id: 'planner', label: '7-Day Meal Architecture', icon: <Calendar className="w-3.5 h-3.5" /> },
          { id: 'analytics', label: 'Trends & Weight Tracker', icon: <Calendar className="w-3.5 h-3.5" /> },
          { id: 'recalibration', label: 'Adaptive TDEE & Recalibration', icon: <Sparkles className="w-3.5 h-3.5" /> },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveViewTab(tab.id as any)}
            aria-pressed={activeViewTab === tab.id}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all whitespace-nowrap ${
              activeViewTab === tab.id
                ? 'bg-espresso-900 text-white dark:bg-ivory-100 dark:text-espresso-950 shadow-sm'
                : 'text-espresso-600 dark:text-espresso-400 hover:text-espresso-950 dark:hover:text-ivory-100'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Main View Tab Content */}
      {activeViewTab === 'diary' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.8fr)] gap-6 items-start">
            <div className="min-w-0 space-y-6">
              <FoodDiary
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
                entries={dayEntries}
                onOpenSearchModal={handleOpenSearchModal}
                onDeleteEntry={deleteFoodDiaryEntry}
              />
            </div>

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
                waterIntakeMl={waterIntakeMl}
                waterTargetMl={profile.waterTargetMl || 3000}
                onUpdateWater={handleUpdateWater}
                incompleteFoodsCount={incompleteFoodsCount}
              />

              <HydrationTrackerCard
                currentWaterMl={waterIntakeMl}
                targetWaterMl={profile.waterTargetMl || 3000}
                onUpdateWater={handleUpdateWater}
              />

              <WeightTracker
                weightLogs={state.weightLogs || []}
                currentGoal={profile.goal}
                selectedDate={selectedDate}
                onLogWeight={(weight, date, notes) => logWeight(weight, date, notes)}
                onDeleteWeight={deleteWeightLog}
                onOpenTargetModal={() => setIsOnboardingModalOpen(true)}
              />
            </div>
          </div>
        </div>
      )}

      {activeViewTab === 'micros' && (
        <ProFeatureGate featureKey="micronutrient_analytics">
          <div className="space-y-6">
            <CronometerMicronutrientDashboard dayEntries={dayEntries} />
          </div>
        </ProFeatureGate>
      )}

      {activeViewTab === 'balance' && (
        <div className="space-y-6">
          <NutrientBalanceDashboard dayEntries={dayEntries} />
        </div>
      )}

      {activeViewTab === 'hydration' && (
        <div className="space-y-6">
          <HydrationTrackerCard
            currentWaterMl={waterIntakeMl}
            targetWaterMl={profile.waterTargetMl || 3000}
            onUpdateWater={handleUpdateWater}
          />
        </div>
      )}

      {activeViewTab === 'planner' && (
        <div className="space-y-6">
          <MealPlanningView />
        </div>
      )}

      {activeViewTab === 'recalibration' && (
        <div className="space-y-6">
          <SmartRecalibrationCard />
        </div>
      )}

      {activeViewTab === 'analytics' && (
        <div className="space-y-6">
          <NutritionAnalytics
            entries={state.foodDiaryEntries || []}
            profile={profile}
            onSelectDate={setSelectedDate}
            onSwitchToDayView={() => setActiveViewTab('diary')}
          />
          <WeightTracker
            weightLogs={state.weightLogs || []}
            currentGoal={profile.goal}
            selectedDate={selectedDate}
            onLogWeight={(weight, date, notes) => logWeight(weight, date, notes)}
            onDeleteWeight={deleteWeightLog}
            onOpenTargetModal={() => setIsOnboardingModalOpen(true)}
          />
        </div>
      )}

      {/* Modals */}
      <FoodSearchModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
        onLogFood={handleLogFood}
        onLogMultipleFoods={handleLogMultipleFoods}
        mealType={activeMealType}
        customFoods={state.customFoods || []}
        recipes={state.recipes || []}
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
          setIsCustomModalOpen(false);
        }}
      />

      <FitnessOnboardingModal
        isOpen={isOnboardingModalOpen}
        onClose={() => setIsOnboardingModalOpen(false)}
        currentProfile={profile}
        onSaveProfile={updateNutritionProfile}
      />

      <BarcodeScannerModal
        isOpen={isBarcodeScannerOpen}
        onClose={() => setIsBarcodeScannerOpen(false)}
        selectedDate={selectedDate}
        activeMealType={activeMealType}
      />

      <MicronutrientDrawer
        isOpen={isMicrosDrawerOpen}
        onClose={() => setIsMicrosDrawerOpen(false)}
        entries={dayEntries}
        dateStr={selectedDate}
      />

      <RecipeBuilderModal
        isOpen={isRecipeModalOpen}
        onClose={() => setIsRecipeModalOpen(false)}
        onSaveRecipe={handleSaveRecipe}
      />
    </div>
  );
};
