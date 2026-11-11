import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { lookupBarcode } from '../../utils/barcodeEngine';
import { FoodItem, MealType } from '../../types';
import { ScanBarcode, Camera, Search, Check, X, AlertCircle } from 'lucide-react';
import { Button } from '../common/Button';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: string;
  activeMealType: MealType;
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  selectedDate,
  activeMealType,
}) => {
  const { state, addFoodDiaryEntry } = useApp();

  const [barcodeInput, setBarcodeInput] = useState('');
  const [matchedFood, setMatchedFood] = useState<FoodItem | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [quantity, setQuantity] = useState<number>(1);

  if (!isOpen) return null;

  const handleLookup = (codeToLookup: string) => {
    const code = codeToLookup.trim();
    if (!code) return;

    setLookupError(null);

    const result = lookupBarcode(code, state.customBarcodes || []);

    if (result.found && result.foodName) {
      const foodItem: FoodItem = {
        id: result.foodId || `food-bc-${code}`,
        name: result.foodName,
        category: 'Supplements',
        servingSize: result.servingSize || 100,
        servingUnit: (result.servingUnit as any) || 'g',
        calories: result.calories || 0,
        protein: result.protein || 0,
        carbs: result.carbs || 0,
        fat: result.fat || 0,
      };
      setMatchedFood(foodItem);
      setQuantity(result.servingSize || 100);
    } else {
      setMatchedFood(null);
      setLookupError(`Barcode ${code} not found in offline database.`);
    }
  };

  const handleLogFood = () => {
    if (!matchedFood) return;

    const scale = quantity / (matchedFood.servingSize || 100);
    const calories = Math.round(matchedFood.calories * scale);
    const protein = Number((matchedFood.protein * scale).toFixed(1));
    const carbs = Number((matchedFood.carbs * scale).toFixed(1));
    const fat = Number((matchedFood.fat * scale).toFixed(1));
    const fiber = matchedFood.fiber !== undefined ? Number((matchedFood.fiber * scale).toFixed(1)) : undefined;

    addFoodDiaryEntry({
      date: selectedDate,
      mealType: activeMealType,
      foodId: matchedFood.id,
      name: matchedFood.name,
      quantity,
      servingUnit: matchedFood.servingUnit || 'g',
      calories,
      protein,
      carbs,
      fat,
      fiber,
      isSample: false,
    });

    onClose();
  };

  const sampleBarcodes = [
    { code: '8901233024011', label: 'Amul High Protein Lassi' },
    { code: '8901030875412', label: 'Quaker Whole Rolled Oats' },
    { code: '748927028669', label: 'ON Gold Standard 100% Whey' },
    { code: '8901725181223', label: 'Tata Sampann Brown Chana' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-espresso-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-espresso-900 border border-ivory-300 dark:border-espresso-750 shadow-2xl p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-terracotta-100 dark:bg-terracotta-900/40 text-terracotta-600 dark:text-terracotta-400 flex items-center justify-center">
              <ScanBarcode className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-espresso-950 dark:text-ivory-50">
                Offline Barcode Scanner
              </h2>
              <p className="text-xs text-espresso-500 dark:text-espresso-400">
                Instant nutritional lookup without external cloud APIs
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-espresso-400 hover:text-espresso-700 dark:hover:text-ivory-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Viewfinder Simulation / Barcode Input */}
        <div className="space-y-3">
          <div className="relative rounded-2xl overflow-hidden bg-espresso-950 border border-ivory-200/10 p-6 text-center text-ivory-50 space-y-3">
            <div className="mx-auto w-48 h-28 border-2 border-dashed border-terracotta-400/80 rounded-xl flex items-center justify-center relative">
              <div className="absolute inset-x-2 top-1/2 -translate-y-1/2 h-0.5 bg-terracotta-500 shadow-[0_0_8px_#f43f5e] animate-pulse" />
              <Camera className="w-8 h-8 text-ivory-200/40" />
            </div>
            <p className="text-[11px] text-ivory-200/70 font-mono">
              Align barcode in viewfinder or enter numeric code below
            </p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleLookup(barcodeInput);
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              placeholder="e.g. 8901233024011 (EAN / UPC code)"
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              className="flex-1 px-3 py-2 rounded-xl text-xs font-mono border border-ivory-300 dark:border-espresso-700 bg-white dark:bg-espresso-800 text-espresso-900 dark:text-ivory-100 focus:outline-none focus:ring-2 focus:ring-terracotta-500"
            />
            <Button
              type="submit"
              variant="primary"
              size="md"
              icon={<Search className="w-4 h-4" />}
            >
              Lookup
            </Button>
          </form>

          {/* Quick Test Samples */}
          <div className="space-y-1.5 pt-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-espresso-400">
              Quick Test Barcodes:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {sampleBarcodes.map((item) => (
                <button
                  key={item.code}
                  type="button"
                  onClick={() => {
                    setBarcodeInput(item.code);
                    handleLookup(item.code);
                  }}
                  className="px-2 py-1 rounded-lg text-[11px] font-mono border border-ivory-200 dark:border-espresso-750 bg-ivory-50 dark:bg-espresso-850 hover:border-terracotta-400 text-espresso-700 dark:text-ivory-200 transition-colors"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Lookup Results */}
        {lookupError && (
          <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{lookupError}</span>
          </div>
        )}

        {matchedFood && (
          <div className="p-4 rounded-xl border border-sage-300 dark:border-sage-800 bg-sage-50/50 dark:bg-sage-950/20 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold text-sm text-espresso-950 dark:text-ivory-50">
                  {matchedFood.name}
                </p>
                <p className="text-xs text-espresso-500 dark:text-espresso-400 font-mono">
                  {matchedFood.category}
                </p>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase bg-sage-200 dark:bg-sage-900 text-sage-800 dark:text-sage-200">
                Verified
              </span>
            </div>

            {/* Nutrition per 100g */}
            <div className="grid grid-cols-4 gap-2 text-center text-xs font-mono">
              <div className="p-2 rounded-lg bg-white dark:bg-espresso-800 border border-ivory-200 dark:border-espresso-700">
                <span className="text-[10px] text-espresso-400 uppercase">Calories</span>
                <p className="font-bold text-espresso-900 dark:text-ivory-100">
                  {matchedFood.calories}
                </p>
              </div>
              <div className="p-2 rounded-lg bg-white dark:bg-espresso-800 border border-ivory-200 dark:border-espresso-700">
                <span className="text-[10px] text-espresso-400 uppercase">Protein</span>
                <p className="font-bold text-terracotta-600 dark:text-terracotta-400">
                  {matchedFood.protein}g
                </p>
              </div>
              <div className="p-2 rounded-lg bg-white dark:bg-espresso-800 border border-ivory-200 dark:border-espresso-700">
                <span className="text-[10px] text-espresso-400 uppercase">Carbs</span>
                <p className="font-bold text-ochre-600 dark:text-ochre-400">
                  {matchedFood.carbs}g
                </p>
              </div>
              <div className="p-2 rounded-lg bg-white dark:bg-espresso-800 border border-ivory-200 dark:border-espresso-700">
                <span className="text-[10px] text-espresso-400 uppercase">Fat</span>
                <p className="font-bold text-sage-600 dark:text-sage-400">
                  {matchedFood.fat}g
                </p>
              </div>
            </div>

            {/* Quantity Input */}
            <div className="flex items-center gap-3 pt-1">
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-espresso-700 dark:text-ivory-200">
                  Portion:
                </label>
                <input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseFloat(e.target.value) || 0))}
                  className="w-20 px-2 py-1 rounded-lg text-xs font-mono text-center border border-ivory-300 dark:border-espresso-700 bg-white dark:bg-espresso-800 text-espresso-950 dark:text-ivory-50"
                />
                <span className="text-xs font-mono text-espresso-400">
                  {matchedFood.servingUnit || 'g'}
                </span>
              </div>

              <Button
                variant="primary"
                size="sm"
                className="ml-auto"
                icon={<Check className="w-4 h-4" />}
                onClick={handleLogFood}
              >
                Log to Diary
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
