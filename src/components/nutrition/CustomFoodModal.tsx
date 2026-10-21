import React, { useState } from 'react';
import { X, Check, AlertCircle } from 'lucide-react';
import { FoodServingUnit } from '../../types';

interface CustomFoodModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveCustomFood: (food: {
    name: string;
    category: 'Custom';
    servingSize: number;
    servingUnit: FoodServingUnit;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber?: number;
    sugar?: number;
    sodium?: number;
  }) => void;
}

export const CustomFoodModal: React.FC<CustomFoodModalProps> = ({
  isOpen,
  onClose,
  onSaveCustomFood,
}) => {
  const [name, setName] = useState('');
  const [servingSize, setServingSize] = useState<number>(100);
  const [servingUnit, setServingUnit] = useState<FoodServingUnit>('g');
  const [calories, setCalories] = useState<number>(0);
  const [protein, setProtein] = useState<number>(0);
  const [carbs, setCarbs] = useState<number>(0);
  const [fat, setFat] = useState<number>(0);
  const [fiber, setFiber] = useState<string>('');
  const [sodium, setSodium] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  // Auto-suggest calories if user enters macros and calories is 0
  const computedMacroCalories = protein * 4 + carbs * 4 + fat * 9;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please provide a food name.');
      return;
    }
    if (servingSize <= 0) {
      setError('Serving size must be greater than zero.');
      return;
    }

    const finalCalories = calories > 0 ? calories : computedMacroCalories;

    onSaveCustomFood({
      name: name.trim(),
      category: 'Custom',
      servingSize,
      servingUnit,
      calories: Math.round(finalCalories),
      protein: Number(protein.toFixed(1)),
      carbs: Number(carbs.toFixed(1)),
      fat: Number(fat.toFixed(1)),
      fiber: fiber.trim() ? Number(fiber) : undefined,
      sodium: sodium.trim() ? Number(sodium) : undefined,
    });

    // Reset & close
    setName('');
    setCalories(0);
    setProtein(0);
    setCarbs(0);
    setFat(0);
    setFiber('');
    setSodium('');
    setError(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-espresso-900 border border-ivory-300 dark:border-espresso-750 w-full max-w-lg rounded-2xl shadow-xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-ivory-200 dark:border-espresso-800 flex items-center justify-between">
          <div>
            <h2 className="font-serif text-xl font-bold text-espresso-950 dark:text-ivory-50">
              Create Custom Food
            </h2>
            <p className="text-xs text-espresso-500 dark:text-espresso-400 mt-0.5">
              Add foods with your specific nutritional labels or homemade recipes.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-espresso-500 hover:text-espresso-800 dark:text-espresso-400 dark:hover:text-ivory-200 hover:bg-ivory-100 dark:hover:bg-espresso-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs sm:text-sm overflow-y-auto max-h-[75vh]">
          {error && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block font-medium text-espresso-800 dark:text-ivory-200 mb-1">
              Food or Recipe Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Grandma's Besan Ladoo, Homemade Mass Gainer"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-ivory-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-950 text-espresso-900 dark:text-ivory-100 focus:outline-none focus:ring-1 focus:ring-terracotta-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-espresso-800 dark:text-ivory-200 mb-1">
                Serving Size *
              </label>
              <input
                type="number"
                min="0.1"
                step="any"
                required
                value={servingSize}
                onChange={(e) => setServingSize(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-ivory-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-950 text-espresso-900 dark:text-ivory-100 focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-medium text-espresso-800 dark:text-ivory-200 mb-1">
                Serving Unit *
              </label>
              <select
                value={servingUnit}
                onChange={(e) => setServingUnit(e.target.value as FoodServingUnit)}
                className="w-full px-3 py-2 rounded-xl border border-ivory-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-950 text-espresso-900 dark:text-ivory-100 focus:outline-none"
              >
                <option value="g">grams (g)</option>
                <option value="ml">milliliters (ml)</option>
                <option value="piece">piece / item</option>
                <option value="serving">serving</option>
                <option value="cup">cup</option>
                <option value="tbsp">tablespoon (tbsp)</option>
              </select>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-ivory-100/70 dark:bg-espresso-850/60 border border-ivory-200 dark:border-espresso-750 space-y-3">
            <span className="text-[11px] font-mono uppercase tracking-wider text-espresso-500 dark:text-espresso-400 font-semibold block">
              Macronutrients per serving
            </span>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[11px] font-medium text-emerald-700 dark:text-emerald-400 mb-1">
                  Protein (g)
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={protein}
                  onChange={(e) => setProtein(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-ivory-300 dark:border-espresso-700 bg-white dark:bg-espresso-900 text-espresso-900 dark:text-ivory-100 text-xs font-bold"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-blue-700 dark:text-blue-400 mb-1">
                  Carbs (g)
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={carbs}
                  onChange={(e) => setCarbs(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-ivory-300 dark:border-espresso-700 bg-white dark:bg-espresso-900 text-espresso-900 dark:text-ivory-100 text-xs font-bold"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-amber-700 dark:text-amber-400 mb-1">
                  Fat (g)
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={fat}
                  onChange={(e) => setFat(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-ivory-300 dark:border-espresso-700 bg-white dark:bg-espresso-900 text-espresso-900 dark:text-ivory-100 text-xs font-bold"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-medium text-espresso-800 dark:text-ivory-200">
                  Total Calories (kcal)
                </label>
                {computedMacroCalories > 0 && calories === 0 && (
                  <span className="text-[10px] text-terracotta-600 dark:text-terracotta-400 font-mono">
                    Auto-calc: ~{computedMacroCalories} kcal
                  </span>
                )}
              </div>
              <input
                type="number"
                min="0"
                placeholder={computedMacroCalories > 0 ? String(computedMacroCalories) : '0'}
                value={calories || ''}
                onChange={(e) => setCalories(Number(e.target.value))}
                className="w-full px-3 py-1.5 rounded-lg border border-ivory-300 dark:border-espresso-700 bg-white dark:bg-espresso-900 text-espresso-900 dark:text-ivory-100 font-bold"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-espresso-600 dark:text-espresso-400 mb-1">
                Fiber (g, optional)
              </label>
              <input
                type="number"
                min="0"
                step="any"
                placeholder="—"
                value={fiber}
                onChange={(e) => setFiber(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-ivory-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-950 text-espresso-900 dark:text-ivory-100"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-espresso-600 dark:text-espresso-400 mb-1">
                Sodium (mg, optional)
              </label>
              <input
                type="number"
                min="0"
                placeholder="—"
                value={sodium}
                onChange={(e) => setSodium(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-ivory-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-950 text-espresso-900 dark:text-ivory-100"
              />
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-xs font-medium text-espresso-600 dark:text-espresso-400 hover:bg-ivory-200 dark:hover:bg-espresso-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 rounded-xl text-xs font-semibold bg-terracotta-600 hover:bg-terracotta-700 text-white flex items-center justify-center gap-1.5 shadow-sm transition active:scale-[0.98]"
            >
              <Check className="w-4 h-4" />
              Save Food
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

