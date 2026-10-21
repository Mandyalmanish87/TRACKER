import React, { useState, useMemo } from 'react';
import { Search, X, Plus, Check, Trash2, ShoppingBag } from 'lucide-react';
import { FoodItem, FoodServingUnit, MealType, CustomFood, Recipe } from '../../types';
import { OFFLINE_FOOD_CATALOGUE } from '../../data/foodCatalogue';
import { scaleNutrients } from '../../utils/nutritionCalculators';

export interface StagedFoodItem {
  food: FoodItem;
  quantity: number;
  servingUnit: FoodServingUnit;
}

export interface LoggedFoodPayload {
  name: string;
  foodId?: string;
  quantity: number;
  servingUnit: FoodServingUnit;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  sugar?: number;
  sodium?: number;
}

interface FoodSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  mealType: MealType;
  customFoods?: CustomFood[];
  recipes?: Recipe[];
  onLogFood: (food: LoggedFoodPayload) => void;
  onLogMultipleFoods?: (foods: LoggedFoodPayload[]) => void;
  onOpenCustomModal: () => void;
}

export const FoodSearchModal: React.FC<FoodSearchModalProps> = ({
  isOpen,
  onClose,
  mealType,
  customFoods = [],
  recipes: _recipes = [],
  onLogFood,
  onLogMultipleFoods,
  onOpenCustomModal,
}) => {
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [stagedItems, setStagedItems] = useState<StagedFoodItem[]>([]);
  const [activeEditingFoodId, setActiveEditingFoodId] = useState<string | null>(null);

  // Combine standard catalogue with custom foods
  const allFoods: FoodItem[] = useMemo(() => {
    const list: FoodItem[] = [...OFFLINE_FOOD_CATALOGUE];
    if (customFoods.length > 0) {
      list.unshift(...customFoods);
    }
    return list;
  }, [customFoods]);

  // Categories list
  const categories = useMemo(() => {
    const set = new Set<string>();
    allFoods.forEach((f) => set.add(f.category));
    return ['All', ...Array.from(set)];
  }, [allFoods]);

  // Filtered foods
  const filteredFoods = useMemo(() => {
    let result = allFoods;
    if (selectedCategory !== 'All') {
      result = result.filter((f) => f.category === selectedCategory);
    }
    if (query.trim()) {
      const q = query.toLowerCase().trim();
      result = result.filter(
        (f) =>
          f.name.toLowerCase().includes(q) ||
          f.category.toLowerCase().includes(q)
      );
    }
    return result.slice(0, 50); // limit to top 50 matches for instant UI response
  }, [allFoods, selectedCategory, query]);

  // Toggle selection of a food item
  const handleToggleFood = (food: FoodItem) => {
    setStagedItems((prev) => {
      const existing = prev.find((item) => item.food.id === food.id);
      if (existing) {
        // If clicking existing and not active editing, make it active
        if (activeEditingFoodId !== food.id) {
          setActiveEditingFoodId(food.id);
          return prev;
        }
        // Deselect if already active
        const next = prev.filter((item) => item.food.id !== food.id);
        if (activeEditingFoodId === food.id) {
          setActiveEditingFoodId(next.length > 0 ? next[0].food.id : null);
        }
        return next;
      } else {
        setActiveEditingFoodId(food.id);
        return [
          ...prev,
          {
            food,
            quantity: food.servingSize || 100,
            servingUnit: food.servingUnit || 'g',
          },
        ];
      }
    });
  };

  // Update quantity/unit for an item in staged list
  const handleUpdateStaged = (
    foodId: string,
    updates: { quantity?: number; servingUnit?: FoodServingUnit }
  ) => {
    setStagedItems((prev) =>
      prev.map((item) =>
        item.food.id === foodId
          ? {
              ...item,
              quantity: updates.quantity !== undefined ? updates.quantity : item.quantity,
              servingUnit: updates.servingUnit !== undefined ? updates.servingUnit : item.servingUnit,
            }
          : item
      )
    );
  };

  // Remove a staged item
  const handleRemoveStaged = (foodId: string) => {
    setStagedItems((prev) => {
      const next = prev.filter((item) => item.food.id !== foodId);
      if (activeEditingFoodId === foodId) {
        setActiveEditingFoodId(next.length > 0 ? next[0].food.id : null);
      }
      return next;
    });
  };

  // Compute aggregated totals of all staged items
  const aggregatedStaged = useMemo(() => {
    let totalCals = 0;
    let totalP = 0;
    let totalC = 0;
    let totalF = 0;

    const scaledItems: LoggedFoodPayload[] = stagedItems.map((item) => {
      const scaled = scaleNutrients(item.food, item.quantity, item.servingUnit);
      totalCals += scaled.calories;
      totalP += scaled.protein;
      totalC += scaled.carbs;
      totalF += scaled.fat;
      return {
        foodId: item.food.id,
        name: item.food.name,
        quantity: item.quantity,
        servingUnit: item.servingUnit,
        calories: scaled.calories,
        protein: scaled.protein,
        carbs: scaled.carbs,
        fat: scaled.fat,
        fiber: scaled.fiber,
        sugar: scaled.sugar,
        sodium: scaled.sodium,
      };
    });

    return {
      items: scaledItems,
      calories: totalCals,
      protein: Number(totalP.toFixed(1)),
      carbs: Number(totalC.toFixed(1)),
      fat: Number(totalF.toFixed(1)),
    };
  }, [stagedItems]);

  // Submit all staged items
  const handleConfirmLog = () => {
    if (aggregatedStaged.items.length === 0) return;

    if (onLogMultipleFoods) {
      onLogMultipleFoods(aggregatedStaged.items);
    } else {
      aggregatedStaged.items.forEach((item) => onLogFood(item));
    }

    setStagedItems([]);
    setActiveEditingFoodId(null);
    onClose();
  };

  if (!isOpen) return null;

  const mealLabels: Record<MealType, string> = {
    breakfast: 'Breakfast',
    lunch: 'Lunch',
    dinner: 'Dinner',
    snacks: 'Snacks',
    pre_workout: 'Pre-Workout',
    post_workout: 'Post-Workout',
  };

  const activeEditingItem = stagedItems.find((i) => i.food.id === activeEditingFoodId);
  const activeScaled = activeEditingItem
    ? scaleNutrients(activeEditingItem.food, activeEditingItem.quantity, activeEditingItem.servingUnit)
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-espresso-900 border border-ivory-300 dark:border-espresso-750 w-full max-w-2xl rounded-2xl shadow-xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-ivory-200 dark:border-espresso-800 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-serif text-xl font-bold text-espresso-950 dark:text-ivory-50">
                Log to {mealLabels[mealType]}
              </h2>
              {stagedItems.length > 0 && (
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-terracotta-100 text-terracotta-800 dark:bg-terracotta-950 dark:text-terracotta-300 font-semibold">
                  {stagedItems.length} selected
                </span>
              )}
            </div>
            <p className="text-xs text-espresso-500 dark:text-espresso-400 mt-0.5">
              Select one or multiple foods to log together in a single batch.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-espresso-500 hover:text-espresso-800 dark:text-espresso-400 dark:hover:text-ivory-200 hover:bg-ivory-100 dark:hover:bg-espresso-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Bar & Custom Food Trigger */}
        <div className="p-4 border-b border-ivory-200 dark:border-espresso-800 space-y-3 bg-ivory-50/50 dark:bg-espresso-950/40">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-espresso-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search roti, oats, eggs, paneer, chicken..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoFocus
                className="w-full pl-9 pr-3 py-2 bg-white dark:bg-espresso-850 border border-ivory-300 dark:border-espresso-750 rounded-xl text-xs sm:text-sm text-espresso-900 dark:text-ivory-100 focus:outline-none focus:ring-2 focus:ring-terracotta-500/50 transition"
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-espresso-400 hover:text-espresso-700"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <button
              onClick={onOpenCustomModal}
              className="px-3 py-2 bg-ivory-200 dark:bg-espresso-800 hover:bg-ivory-300 dark:hover:bg-espresso-750 text-espresso-800 dark:text-ivory-200 text-xs font-medium rounded-xl flex items-center gap-1.5 shrink-0 transition"
              title="Add Custom Food"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Custom Food</span>
            </button>
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs scrollbar-none">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition text-[11px] ${
                  selectedCategory === cat
                    ? 'bg-espresso-900 dark:bg-ivory-100 text-white dark:text-espresso-950 font-semibold shadow-xs'
                    : 'bg-white dark:bg-espresso-850 text-espresso-600 dark:text-espresso-300 hover:bg-ivory-200 dark:hover:bg-espresso-800 border border-ivory-200 dark:border-espresso-750'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Food List with Multiselect Checkbox */}
        <div className="flex-1 overflow-y-auto divide-y divide-ivory-200 dark:divide-espresso-800/80 p-2">
          {filteredFoods.length === 0 ? (
            <div className="py-12 text-center text-espresso-500 dark:text-espresso-400">
              <p className="text-sm">No foods matched "{query}"</p>
              <button
                onClick={onOpenCustomModal}
                className="mt-3 inline-flex items-center gap-1.5 text-xs text-terracotta-600 dark:text-terracotta-400 underline font-semibold"
              >
                <Plus className="w-3 h-3" />
                Create "{query}" as a custom food
              </button>
            </div>
          ) : (
            filteredFoods.map((food) => {
              const isStaged = stagedItems.some((item) => item.food.id === food.id);
              const isActive = activeEditingFoodId === food.id;

              return (
                <div
                  key={food.id}
                  onClick={() => handleToggleFood(food)}
                  className={`p-3 rounded-xl cursor-pointer transition flex items-center justify-between ${
                    isActive
                      ? 'bg-terracotta-50/70 dark:bg-terracotta-950/40 border border-terracotta-300 dark:border-terracotta-800'
                      : isStaged
                      ? 'bg-ivory-100/80 dark:bg-espresso-800/70'
                      : 'hover:bg-ivory-100/70 dark:hover:bg-espresso-850/60'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 pr-3">
                    {/* Checkbox */}
                    <div
                      className={`w-5 h-5 rounded-md border flex items-center justify-center transition shrink-0 ${
                        isStaged
                          ? 'bg-terracotta-600 border-terracotta-600 text-white'
                          : 'border-ivory-300 dark:border-espresso-700 bg-white dark:bg-espresso-850'
                      }`}
                    >
                      {isStaged && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs sm:text-sm text-espresso-900 dark:text-ivory-100 truncate">
                          {food.name}
                        </span>
                        {food.isCustom && (
                          <span className="text-[10px] bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 px-1.5 py-0.5 rounded font-mono font-medium">
                            Custom
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-espresso-500 dark:text-espresso-400 mt-0.5">
                        {food.servingSize} {food.servingUnit} ·{' '}
                        <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                          {food.protein}g P
                        </span>{' '}
                        ·{' '}
                        <span className="text-blue-700 dark:text-blue-400 font-medium">
                          {food.carbs}g C
                        </span>{' '}
                        ·{' '}
                        <span className="text-amber-700 dark:text-amber-400 font-medium">
                          {food.fat}g F
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="font-serif font-bold text-xs sm:text-sm text-espresso-950 dark:text-ivory-50 tabular-nums">
                      {food.calories} kcal
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Active Item Portion Adjuster (if an item is currently active for editing) */}
        {activeEditingItem && activeScaled && (
          <div className="p-3.5 bg-ivory-100/90 dark:bg-espresso-950 border-t border-ivory-300 dark:border-espresso-750 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-espresso-950 dark:text-ivory-100 truncate">
                Adjust Portion: {activeEditingItem.food.name}
              </span>
              <span className="text-xs font-serif font-bold text-terracotta-600 dark:text-terracotta-400 tabular-nums">
                {activeScaled.calories} kcal ({activeScaled.protein}g P · {activeScaled.carbs}g C · {activeScaled.fat}g F)
              </span>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex-1 flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  step="any"
                  value={activeEditingItem.quantity}
                  onChange={(e) =>
                    handleUpdateStaged(activeEditingItem.food.id, {
                      quantity: Math.max(1, Number(e.target.value)),
                    })
                  }
                  className="w-24 px-2.5 py-1.5 rounded-lg border border-ivory-300 dark:border-espresso-700 bg-white dark:bg-espresso-900 text-xs font-bold"
                />
                <select
                  value={activeEditingItem.servingUnit}
                  onChange={(e) =>
                    handleUpdateStaged(activeEditingItem.food.id, {
                      servingUnit: e.target.value as FoodServingUnit,
                    })
                  }
                  className="px-2.5 py-1.5 rounded-lg border border-ivory-300 dark:border-espresso-700 bg-white dark:bg-espresso-900 text-xs"
                >
                  <option value={activeEditingItem.food.servingUnit}>
                    {activeEditingItem.food.servingUnit}
                  </option>
                  {activeEditingItem.food.servingUnit !== 'g' && <option value="g">g</option>}
                  {activeEditingItem.food.servingUnit !== 'piece' && <option value="piece">piece</option>}
                  {activeEditingItem.food.servingUnit !== 'cup' && <option value="cup">cup</option>}
                  {activeEditingItem.food.servingUnit !== 'tbsp' && <option value="tbsp">tbsp</option>}
                </select>
              </div>

              <button
                type="button"
                onClick={() => handleRemoveStaged(activeEditingItem.food.id)}
                className="p-1.5 text-espresso-400 hover:text-red-600 transition"
                title="Remove from batch"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Bottom Tray & Batch Log Button */}
        {stagedItems.length > 0 && (
          <div className="p-4 bg-white dark:bg-espresso-900 border-t border-ivory-300 dark:border-espresso-750 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-terracotta-100 dark:bg-terracotta-950 text-terracotta-600 dark:text-terracotta-400 flex items-center justify-center">
                <ShoppingBag className="w-3.5 h-3.5" />
              </div>
              <div className="text-xs">
                <span className="font-bold text-espresso-900 dark:text-ivory-100">
                  {stagedItems.length} {stagedItems.length === 1 ? 'item' : 'items'} selected
                </span>
                <p className="text-[11px] text-espresso-500 dark:text-espresso-400 font-mono">
                  {aggregatedStaged.calories} kcal · {aggregatedStaged.protein}g P · {aggregatedStaged.carbs}g C · {aggregatedStaged.fat}g F
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setStagedItems([])}
                className="px-3 py-2 rounded-xl text-xs font-medium text-espresso-600 dark:text-espresso-400 hover:bg-ivory-100 dark:hover:bg-espresso-800 transition"
              >
                Clear
              </button>
              <button
                onClick={handleConfirmLog}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-terracotta-600 hover:bg-terracotta-700 text-white flex items-center justify-center gap-1.5 shadow-sm transition active:scale-[0.98]"
              >
                <Check className="w-4 h-4" />
                <span>
                  Add {stagedItems.length > 1 ? `${stagedItems.length} Items` : ''} to {mealLabels[mealType]}
                </span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
