import React, { useState } from 'react';
import { Recipe, RecipeIngredient } from '../../types/fitness';
import { OFFLINE_FOOD_CATALOGUE } from '../../data/foodCatalogue';
import {
  X,
  Plus,
  Trash2,
  Utensils,
  Save,
  Search,
} from 'lucide-react';
import { Button } from '../common/Button';

interface RecipeBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveRecipe: (recipe: Recipe) => void;
}

export const RecipeBuilderModal: React.FC<RecipeBuilderModalProps> = ({
  isOpen,
  onClose,
  onSaveRecipe,
}) => {
  const [recipeName, setRecipeName] = useState('');
  const [totalServings, setTotalServings] = useState<number>(2);
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([]);
  const [notes, setNotes] = useState('');

  // Search ingredient selector
  const [foodSearch, setFoodSearch] = useState('');
  const [selectedFoodId, setSelectedFoodId] = useState(OFFLINE_FOOD_CATALOGUE[0]?.id || '');
  const [addQty, setAddQty] = useState<number>(100);

  if (!isOpen) return null;

  // Search filtered catalogue
  const searchResults = OFFLINE_FOOD_CATALOGUE.filter((f) =>
    f.name.toLowerCase().includes(foodSearch.toLowerCase())
  ).slice(0, 15);

  const handleAddIngredient = () => {
    const food = OFFLINE_FOOD_CATALOGUE.find((f) => f.id === selectedFoodId);
    if (!food || addQty <= 0) return;

    const scale = addQty / (food.servingSize || 100);
    const newIngredient: RecipeIngredient = {
      foodId: food.id,
      foodName: food.name,
      quantity: addQty,
      servingUnit: food.servingUnit,
      calories: Math.round(food.calories * scale),
      protein: Number((food.protein * scale).toFixed(1)),
      carbs: Number((food.carbs * scale).toFixed(1)),
      fat: Number((food.fat * scale).toFixed(1)),
    };

    setIngredients([...ingredients, newIngredient]);
  };

  const handleRemoveIngredient = (index: number) => {
    setIngredients(ingredients.filter((_, i) => i !== index));
  };

  // Recipe totals
  const totalCals = ingredients.reduce((sum, item) => sum + item.calories, 0);
  const totalProtein = Number(ingredients.reduce((sum, item) => sum + item.protein, 0).toFixed(1));
  const totalCarbs = Number(ingredients.reduce((sum, item) => sum + item.carbs, 0).toFixed(1));
  const totalFat = Number(ingredients.reduce((sum, item) => sum + item.fat, 0).toFixed(1));

  const validServings = Math.max(1, totalServings);
  const calsPerServing = Math.round(totalCals / validServings);
  const proteinPerServing = Number((totalProtein / validServings).toFixed(1));
  const carbsPerServing = Number((totalCarbs / validServings).toFixed(1));
  const fatPerServing = Number((totalFat / validServings).toFixed(1));

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipeName.trim() || ingredients.length === 0) return;

    const newRecipe: Recipe = {
      id: `recipe-${Date.now()}`,
      name: recipeName.trim(),
      ingredients,
      totalServings: validServings,
      caloriesPerServing: calsPerServing,
      proteinPerServing: proteinPerServing,
      carbsPerServing: carbsPerServing,
      fatPerServing: fatPerServing,
      notes: notes.trim() || undefined,
      createdAt: new Date().toISOString(),
    };

    onSaveRecipe(newRecipe);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-espresso-950/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-2xl bg-white dark:bg-espresso-850 rounded-3xl border border-ivory-300 dark:border-espresso-750 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-ivory-200 dark:border-espresso-750 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Utensils className="w-5 h-5 text-terracotta-600" />
            <h3 className="font-serif text-xl font-bold text-espresso-950 dark:text-ivory-50">
              Recipe Builder &amp; Batch Nutrition Calculator
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-xl text-espresso-400 hover:text-espresso-700 dark:hover:text-ivory-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-5 overflow-y-auto space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 space-y-1">
              <label className="text-xs font-mono font-bold uppercase text-espresso-500">
                Recipe Name
              </label>
              <input
                type="text"
                required
                value={recipeName}
                onChange={(e) => setRecipeName(e.target.value)}
                placeholder="e.g. High-Protein Chicken Biryani, Overnight Oats..."
                className="w-full px-3 py-2 text-xs rounded-xl border border-ivory-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-900 text-espresso-950 dark:text-ivory-100 placeholder:text-espresso-400 focus:outline-none focus:ring-2 focus:ring-terracotta-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-mono font-bold uppercase text-espresso-500">
                Yield (Servings)
              </label>
              <input
                type="number"
                min="1"
                max="20"
                value={totalServings}
                onChange={(e) => setTotalServings(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs rounded-xl border border-ivory-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-900 text-espresso-950 dark:text-ivory-100 focus:outline-none focus:ring-2 focus:ring-terracotta-500"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-mono font-bold uppercase text-espresso-500">
              Notes &amp; Instructions (Optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Cook chicken in olive oil, boil basmati rice..."
              className="w-full px-3 py-2 text-xs rounded-xl border border-ivory-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-900 text-espresso-950 dark:text-ivory-100 placeholder:text-espresso-400 focus:outline-none focus:ring-2 focus:ring-terracotta-500"
            />
          </div>

          {/* Add Ingredient Section */}
          <div className="p-4 rounded-2xl bg-ivory-50 dark:bg-espresso-900/60 border border-ivory-200 dark:border-espresso-800 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-espresso-950 dark:text-ivory-50">
                Add Ingredient
              </h4>
              <div className="relative w-48">
                <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-espresso-400" />
                <input
                  type="text"
                  value={foodSearch}
                  onChange={(e) => setFoodSearch(e.target.value)}
                  placeholder="Filter foods..."
                  className="w-full pl-8 pr-2.5 py-1 text-xs rounded-xl border border-ivory-300 dark:border-espresso-700 bg-white dark:bg-espresso-800 text-espresso-950 dark:text-ivory-100 placeholder:text-espresso-400"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px_auto] gap-2">
              <select
                value={selectedFoodId}
                onChange={(e) => setSelectedFoodId(e.target.value)}
                className="px-3 py-1.5 text-xs rounded-xl border border-ivory-300 dark:border-espresso-700 bg-white dark:bg-espresso-800 text-espresso-900 dark:text-ivory-100"
              >
                {searchResults.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} ({f.calories} kcal / {f.servingSize} {f.servingUnit})
                  </option>
                ))}
              </select>

              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min="1"
                  value={addQty}
                  onChange={(e) => setAddQty(Number(e.target.value))}
                  className="w-full px-2 py-1.5 text-xs rounded-xl border border-ivory-300 dark:border-espresso-700 bg-white dark:bg-espresso-800 text-espresso-900 dark:text-ivory-100"
                />
                <span className="text-xs font-mono text-espresso-400">unit</span>
              </div>

              <Button
                type="button"
                variant="secondary"
                size="sm"
                icon={<Plus className="w-3.5 h-3.5" />}
                onClick={handleAddIngredient}
              >
                Add
              </Button>
            </div>
          </div>

          {/* Ingredients List */}
          <div className="space-y-2">
            <span className="text-xs font-mono font-bold uppercase text-espresso-400">
              Included Ingredients ({ingredients.length})
            </span>

            {ingredients.length > 0 ? (
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {ingredients.map((ing, i) => (
                  <div
                    key={i}
                    className="p-2.5 rounded-xl border border-ivory-200 dark:border-espresso-800 bg-white dark:bg-espresso-800 flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-semibold text-espresso-950 dark:text-ivory-100">
                        {ing.foodName}
                      </span>
                      <span className="text-[11px] text-espresso-500 block">
                        {ing.quantity} {ing.servingUnit} · {ing.calories} kcal (P: {ing.protein}g, C: {ing.carbs}g, F: {ing.fat}g)
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveIngredient(i)}
                      className="p-1 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-espresso-400 py-4 text-center border border-dashed border-ivory-300 dark:border-espresso-750 rounded-xl">
                Add ingredients above to compute macro breakdown per serving.
              </p>
            )}
          </div>

          {/* Computed Per-Serving Summary */}
          {ingredients.length > 0 && (
            <div className="p-4 rounded-2xl bg-terracotta-50/70 dark:bg-terracotta-900/30 border border-terracotta-200 dark:border-terracotta-800/60 space-y-2">
              <span className="text-xs font-mono font-bold uppercase text-terracotta-700 dark:text-terracotta-300">
                Calculated Per Serving (Yield: {validServings} Servings)
              </span>

              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="p-2 rounded-xl bg-white/80 dark:bg-espresso-800/80">
                  <span className="block text-[10px] font-mono text-espresso-400">Calories</span>
                  <span className="font-serif text-lg font-bold text-espresso-950 dark:text-ivory-50">
                    {calsPerServing} <span className="text-[10px] font-normal">kcal</span>
                  </span>
                </div>
                <div className="p-2 rounded-xl bg-white/80 dark:bg-espresso-800/80">
                  <span className="block text-[10px] font-mono text-espresso-400">Protein</span>
                  <span className="font-serif text-lg font-bold text-terracotta-600">
                    {proteinPerServing} <span className="text-[10px] font-normal">g</span>
                  </span>
                </div>
                <div className="p-2 rounded-xl bg-white/80 dark:bg-espresso-800/80">
                  <span className="block text-[10px] font-mono text-espresso-400">Carbs</span>
                  <span className="font-serif text-lg font-bold text-ochre-600">
                    {carbsPerServing} <span className="text-[10px] font-normal">g</span>
                  </span>
                </div>
                <div className="p-2 rounded-xl bg-white/80 dark:bg-espresso-800/80">
                  <span className="block text-[10px] font-mono text-espresso-400">Fat</span>
                  <span className="font-serif text-lg font-bold text-dusty-600">
                    {fatPerServing} <span className="text-[10px] font-normal">g</span>
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Action Footer */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-ivory-200 dark:border-espresso-750">
            <Button type="button" variant="ghost" size="md" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              icon={<Save className="w-4 h-4" />}
              disabled={ingredients.length === 0 || !recipeName.trim()}
            >
              Save Recipe
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
