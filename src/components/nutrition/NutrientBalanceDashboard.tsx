import React, { useMemo } from 'react';
import { FoodDiaryEntry } from '../../types/fitness';
import {
  Scale,
  Zap,
  Heart,
} from 'lucide-react';

interface NutrientBalanceDashboardProps {
  dayEntries: FoodDiaryEntry[];
}

export const NutrientBalanceDashboard: React.FC<NutrientBalanceDashboardProps> = ({
  dayEntries = [],
}) => {
  // Aggregate relevant balance values
  const aggregates = useMemo(() => {
    let sodium = 0;
    let potassium = 0;
    let calcium = 0;
    let magnesium = 0;
    let fiber = 0;

    dayEntries.forEach((entry) => {
      if (typeof entry.sodium === 'number') sodium += entry.sodium;
      if (typeof entry.fiber === 'number') fiber += entry.fiber;

      if (entry.micronutrients) {
        if (typeof entry.micronutrients.sodiumMg === 'number') sodium += entry.micronutrients.sodiumMg;
        if (typeof entry.micronutrients.potassiumMg === 'number') potassium += entry.micronutrients.potassiumMg;
        if (typeof entry.micronutrients.calciumMg === 'number') calcium += entry.micronutrients.calciumMg;
        if (typeof entry.micronutrients.magnesiumMg === 'number') magnesium += entry.micronutrients.magnesiumMg;
      }
    });

    return {
      sodium: Math.round(sodium),
      potassium: Math.round(potassium),
      calcium: Math.round(calcium),
      magnesium: Math.round(magnesium),
      fiber: Number(fiber.toFixed(1)),
    };
  }, [dayEntries]);

  // Derived Ratios
  const sodiumPotassiumRatio = useMemo(() => {
    if (aggregates.potassium <= 0) return null;
    return Number((aggregates.sodium / aggregates.potassium).toFixed(2));
  }, [aggregates.sodium, aggregates.potassium]);

  const calciumMagnesiumRatio = useMemo(() => {
    if (aggregates.magnesium <= 0) return null;
    return Number((aggregates.calcium / aggregates.magnesium).toFixed(2));
  }, [aggregates.calcium, aggregates.magnesium]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-4 sm:p-5 rounded-2xl border border-ivory-300 dark:border-espresso-750 bg-white dark:bg-espresso-850 shadow-subtle flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Scale className="w-5 h-5 text-terracotta-600 dark:text-terracotta-400" />
          <div>
            <h3 className="font-serif text-xl font-bold text-espresso-950 dark:text-ivory-50">
              Nutrient Balance &amp; Biomechanical Ratios
            </h3>
            <p className="text-xs text-espresso-500">
              Cronometer-style electrolyte balance, cellular ratios, and cardioprotective metrics
            </p>
          </div>
        </div>
      </div>

      {/* Balance Ratio Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Sodium : Potassium */}
        <div className="p-5 rounded-2xl border border-ivory-300 dark:border-espresso-750 bg-white dark:bg-espresso-850 shadow-subtle space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-ochre-500" />
              <h4 className="font-serif text-base font-bold text-espresso-950 dark:text-ivory-50">
                Sodium : Potassium Ratio
              </h4>
            </div>
            {sodiumPotassiumRatio !== null && (
              <span
                className={`text-xs font-mono font-bold px-2 py-0.5 rounded-lg ${
                  sodiumPotassiumRatio <= 1.0
                    ? 'bg-sage-100 text-sage-800 dark:bg-sage-900/40 dark:text-sage-200'
                    : 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200'
                }`}
              >
                {sodiumPotassiumRatio} : 1.0
              </span>
            )}
          </div>

          <p className="text-xs text-espresso-600 dark:text-espresso-400 leading-relaxed">
            Target range is ~0.5 - 1.0. A high ratio (&gt;1.5) with elevated sodium and deficient potassium elevates vascular resistance.
          </p>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-ivory-200 dark:border-espresso-800 text-center">
            <div className="p-2 rounded-xl bg-ivory-100 dark:bg-espresso-800">
              <span className="block text-[10px] font-mono uppercase text-espresso-400">Sodium</span>
              <span className="font-serif text-base font-bold text-espresso-950 dark:text-ivory-50">
                {aggregates.sodium} mg
              </span>
            </div>
            <div className="p-2 rounded-xl bg-ivory-100 dark:bg-espresso-800">
              <span className="block text-[10px] font-mono uppercase text-espresso-400">Potassium</span>
              <span className="font-serif text-base font-bold text-espresso-950 dark:text-ivory-50">
                {aggregates.potassium} mg
              </span>
            </div>
          </div>
        </div>

        {/* Calcium : Magnesium */}
        <div className="p-5 rounded-2xl border border-ivory-300 dark:border-espresso-750 bg-white dark:bg-espresso-850 shadow-subtle space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Heart className="w-4 h-4 text-rose-500" />
              <h4 className="font-serif text-base font-bold text-espresso-950 dark:text-ivory-50">
                Calcium : Magnesium Ratio
              </h4>
            </div>
            {calciumMagnesiumRatio !== null && (
              <span
                className={`text-xs font-mono font-bold px-2 py-0.5 rounded-lg ${
                  calciumMagnesiumRatio >= 1.5 && calciumMagnesiumRatio <= 2.5
                    ? 'bg-sage-100 text-sage-800 dark:bg-sage-900/40 dark:text-sage-200'
                    : 'bg-ochre-100 text-ochre-800 dark:bg-ochre-900/40 dark:text-ochre-200'
                }`}
              >
                {calciumMagnesiumRatio} : 1.0
              </span>
            )}
          </div>

          <p className="text-xs text-espresso-600 dark:text-espresso-400 leading-relaxed">
            Target ratio is ~2.0 : 1.0. Calcium regulates muscular contraction while magnesium governs cellular relaxation.
          </p>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-ivory-200 dark:border-espresso-800 text-center">
            <div className="p-2 rounded-xl bg-ivory-100 dark:bg-espresso-800">
              <span className="block text-[10px] font-mono uppercase text-espresso-400">Calcium</span>
              <span className="font-serif text-base font-bold text-espresso-950 dark:text-ivory-50">
                {aggregates.calcium} mg
              </span>
            </div>
            <div className="p-2 rounded-xl bg-ivory-100 dark:bg-espresso-800">
              <span className="block text-[10px] font-mono uppercase text-espresso-400">Magnesium</span>
              <span className="font-serif text-base font-bold text-espresso-950 dark:text-ivory-50">
                {aggregates.magnesium} mg
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
