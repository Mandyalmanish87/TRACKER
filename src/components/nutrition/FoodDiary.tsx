import React from 'react';
import {
  Coffee,
  Sun,
  Moon,
  Cookie,
  Zap,
  Dumbbell,
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { FoodDiaryEntry, MealType } from '../../types';

interface FoodDiaryProps {
  selectedDate: string;
  onSelectDate: (date: string) => void;
  entries: FoodDiaryEntry[];
  onOpenSearchModal: (meal: MealType) => void;
  onDeleteEntry: (id: string) => void;
  enabledMealTypes?: MealType[];
}

const MEAL_CONFIG: {
  id: MealType;
  label: string;
  icon: React.ReactNode;
  defaultTime: string;
}[] = [
  { id: 'breakfast', label: 'Breakfast', icon: <Coffee className="w-4 h-4 text-amber-500" />, defaultTime: '08:00' },
  { id: 'lunch', label: 'Lunch', icon: <Sun className="w-4 h-4 text-orange-500" />, defaultTime: '13:00' },
  { id: 'snacks', label: 'Snacks', icon: <Cookie className="w-4 h-4 text-yellow-600" />, defaultTime: '16:30' },
  { id: 'pre_workout', label: 'Pre-Workout Fuel', icon: <Zap className="w-4 h-4 text-red-500" />, defaultTime: '17:30' },
  { id: 'post_workout', label: 'Post-Workout Recovery', icon: <Dumbbell className="w-4 h-4 text-indigo-500" />, defaultTime: '19:30' },
  { id: 'dinner', label: 'Dinner', icon: <Moon className="w-4 h-4 text-purple-500" />, defaultTime: '21:00' },
];

export const FoodDiary: React.FC<FoodDiaryProps> = ({
  selectedDate,
  onSelectDate,
  entries,
  onOpenSearchModal,
  onDeleteEntry,
  enabledMealTypes = ['breakfast', 'lunch', 'dinner', 'snacks', 'pre_workout', 'post_workout'],
}) => {
  // Format selected date
  const dateObj = new Date(`${selectedDate}T00:00:00`);
  const isToday =
    selectedDate === new Date().toISOString().split('T')[0];

  const shiftDate = (deltaDays: number) => {
    const next = new Date(dateObj);
    next.setDate(next.getDate() + deltaDays);
    const yyyy = next.getFullYear();
    const mm = String(next.getMonth() + 1).padStart(2, '0');
    const dd = String(next.getDate()).padStart(2, '0');
    onSelectDate(`${yyyy}-${mm}-${dd}`);
  };

  const formattedDateString = dateObj.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  // Filter entries for the selected date
  const dayEntries = entries.filter((e) => e.date === selectedDate);

  // Filter meals based on enabled list
  const activeMeals = MEAL_CONFIG.filter((m) => enabledMealTypes.includes(m.id));

  return (
    <div className="space-y-6">
      {/* Date Navigation Header */}
      <div className="bg-white dark:bg-espresso-900 border border-ivory-300 dark:border-espresso-800 rounded-2xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <button
              onClick={() => shiftDate(-1)}
              className="p-1.5 rounded-lg border border-ivory-300 dark:border-espresso-750 hover:bg-ivory-100 dark:hover:bg-espresso-800 text-espresso-700 dark:text-ivory-200 transition"
              title="Previous Day"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => shiftDate(1)}
              className="p-1.5 rounded-lg border border-ivory-300 dark:border-espresso-750 hover:bg-ivory-100 dark:hover:bg-espresso-800 text-espresso-700 dark:text-ivory-200 transition"
              title="Next Day"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-baseline gap-2">
            <h2 className="font-serif text-lg sm:text-xl font-bold text-espresso-950 dark:text-ivory-50">
              {formattedDateString}
            </h2>
            {isToday && (
              <span className="text-[11px] font-semibold bg-terracotta-100 dark:bg-terracotta-950 text-terracotta-800 dark:text-terracotta-300 px-2 py-0.5 rounded-md font-mono">
                Today
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isToday && (
            <button
              onClick={() => onSelectDate(new Date().toISOString().split('T')[0])}
              className="px-3 py-1.5 rounded-xl border border-ivory-300 dark:border-espresso-750 hover:bg-ivory-100 dark:hover:bg-espresso-800 text-xs font-medium text-espresso-700 dark:text-ivory-200 transition"
            >
              Jump to Today
            </button>
          )}
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => e.target.value && onSelectDate(e.target.value)}
            className="px-2.5 py-1.5 rounded-xl border border-ivory-300 dark:border-espresso-750 bg-ivory-50 dark:bg-espresso-950 text-xs font-mono text-espresso-800 dark:text-ivory-200 focus:outline-none"
          />
        </div>
      </div>

      {/* Meals Grid */}
      <div className="space-y-4">
        {activeMeals.map((meal) => {
          const mealEntries = dayEntries.filter((e) => e.mealType === meal.id);
          const mealCalories = mealEntries.reduce((acc, cur) => acc + cur.calories, 0);
          const mealProtein = Number(
            mealEntries.reduce((acc, cur) => acc + cur.protein, 0).toFixed(1)
          );
          const mealCarbs = Number(
            mealEntries.reduce((acc, cur) => acc + cur.carbs, 0).toFixed(1)
          );
          const mealFat = Number(
            mealEntries.reduce((acc, cur) => acc + cur.fat, 0).toFixed(1)
          );

          return (
            <div
              key={meal.id}
              className="bg-white dark:bg-espresso-900 border border-ivory-300 dark:border-espresso-800 rounded-2xl overflow-hidden shadow-sm"
            >
              {/* Meal Header */}
              <div className="p-4 sm:p-5 flex items-center justify-between border-b border-ivory-200 dark:border-espresso-800/80 bg-ivory-50/50 dark:bg-espresso-950/30">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-white dark:bg-espresso-850 border border-ivory-200 dark:border-espresso-750 flex items-center justify-center shadow-xs">
                    {meal.icon}
                  </div>
                  <div>
                    <h3 className="font-serif text-base font-bold text-espresso-950 dark:text-ivory-50">
                      {meal.label}
                    </h3>
                    <p className="text-[11px] text-espresso-500 dark:text-espresso-400">
                      {mealEntries.length} {mealEntries.length === 1 ? 'item' : 'items'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 sm:gap-4">
                  {mealCalories > 0 && (
                    <div className="text-right hidden sm:block">
                      <span className="font-serif font-bold text-sm text-espresso-950 dark:text-ivory-50 tabular-nums">
                        {mealCalories} kcal
                      </span>
                      <p className="text-[10px] text-espresso-500 dark:text-espresso-400 font-mono">
                        {mealProtein}g P · {mealCarbs}g C · {mealFat}g F
                      </p>
                    </div>
                  )}
                  <button
                    onClick={() => onOpenSearchModal(meal.id)}
                    className="px-3 py-1.5 bg-ivory-200 dark:bg-espresso-800 hover:bg-terracotta-50 hover:border-terracotta-300 dark:hover:bg-espresso-750 text-espresso-800 dark:text-ivory-100 hover:text-terracotta-700 text-xs font-semibold rounded-xl flex items-center gap-1 transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Food</span>
                  </button>
                </div>
              </div>

              {/* Logged items list */}
              {mealEntries.length === 0 ? (
                <div className="p-5 text-center text-xs text-espresso-400 dark:text-espresso-500 italic">
                  Nothing logged for {meal.label.toLowerCase()} yet.
                </div>
              ) : (
                <div className="divide-y divide-ivory-100 dark:divide-espresso-850">
                  {mealEntries.map((item) => (
                    <div
                      key={item.id}
                      className="p-3.5 sm:px-5 flex items-center justify-between hover:bg-ivory-50/50 dark:hover:bg-espresso-850/40 transition group"
                    >
                      <div className="min-w-0 pr-3">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs sm:text-sm text-espresso-900 dark:text-ivory-100 truncate">
                            {item.name}
                          </span>
                          {item.isSample && (
                            <span className="text-[9px] bg-terracotta-50 text-terracotta-700 dark:bg-terracotta-950 dark:text-terracotta-300 px-1 py-0.2 rounded font-mono">
                              Demo
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-espresso-500 dark:text-espresso-400 mt-0.5">
                          {item.quantity} {item.servingUnit} ·{' '}
                          <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                            {item.protein}g P
                          </span>{' '}
                          ·{' '}
                          <span className="text-blue-700 dark:text-blue-400 font-medium">
                            {item.carbs}g C
                          </span>{' '}
                          ·{' '}
                          <span className="text-amber-700 dark:text-amber-400 font-medium">
                            {item.fat}g F
                          </span>
                          {item.fiber !== undefined && ` · ${item.fiber}g fiber`}
                        </p>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span className="font-serif font-bold text-xs sm:text-sm text-espresso-950 dark:text-ivory-50 tabular-nums">
                          {item.calories} kcal
                        </span>
                        <button
                          onClick={() => onDeleteEntry(item.id)}
                          className="p-1 rounded text-espresso-400 hover:text-red-600 dark:hover:text-red-400 transition"
                          title="Remove item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

