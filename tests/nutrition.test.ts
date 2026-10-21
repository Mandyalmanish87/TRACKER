import { describe, it, expect } from 'vitest';
import {
  calculateBMI,
  calculateBMR,
  calculateTDEE,
  calculateCalorieTarget,
  deriveMacroTargets,
  scaleNutrients,
  evaluateWeightTrend,
} from '../src/utils/nutritionCalculators';
import { FoodItem } from '../src/types';

describe('Nutrition & Fitness Calculation Engine (Milestone 7)', () => {
  describe('BMI Calculation', () => {
    it('calculates adult BMI correctly with appropriate WHO brackets', () => {
      // 70 kg, 175 cm => 70 / (1.75^2) = 22.86 => 22.9 (Normal)
      const normal = calculateBMI(70, 175, 25);
      expect(normal).not.toBeNull();
      expect(normal?.bmi).toBe(22.9);
      expect(normal?.category).toBe('Normal weight');
      expect(normal?.isMinor).toBe(false);

      // 50 kg, 175 cm => 16.3 (Underweight)
      const under = calculateBMI(50, 175, 30);
      expect(under?.category).toBe('Underweight');

      // 85 kg, 175 cm => 27.8 (Overweight)
      const over = calculateBMI(85, 175, 30);
      expect(over?.category).toBe('Overweight');

      // 105 kg, 175 cm => 34.3 (Obese)
      const obese = calculateBMI(105, 175, 30);
      expect(obese?.category).toBe('Obese');
    });

    it('safely handles minors (age 10-17) with pediatrician notice', () => {
      const minor = calculateBMI(55, 165, 15);
      expect(minor).not.toBeNull();
      expect(minor?.isMinor).toBe(true);
      expect(minor?.category).toBe('Minor Assessment');
      expect(minor?.interpretation).toContain('growth percentiles');
    });

    it('guards against invalid, zero, or negative inputs', () => {
      expect(calculateBMI(0, 170)).toBeNull();
      expect(calculateBMI(-50, 170)).toBeNull();
      expect(calculateBMI(70, 0)).toBeNull();
      expect(calculateBMI(NaN, 170)).toBeNull();
    });
  });

  describe('Mifflin–St Jeor BMR & TDEE', () => {
    it('calculates male BMR accurately according to Mifflin–St Jeor', () => {
      // Male: 10(75) + 6.25(180) - 5(25) + 5 = 750 + 1125 - 125 + 5 = 1755
      const bmrMale = calculateBMR(75, 180, 25, 'male');
      expect(bmrMale).toBe(1755);
    });

    it('calculates female BMR accurately according to Mifflin–St Jeor', () => {
      // Female: 10(60) + 6.25(165) - 5(28) - 161 = 600 + 1031.25 - 140 - 161 = 1330.25 => 1330
      const bmrFemale = calculateBMR(60, 165, 28, 'female');
      expect(bmrFemale).toBe(1330);
    });

    it('returns null if biological sex is prefer_not_to_say (requires manual target)', () => {
      const bmrNeutral = calculateBMR(70, 175, 25, 'prefer_not_to_say');
      expect(bmrNeutral).toBeNull();
    });

    it('applies Harris–Benedict activity multipliers correctly to TDEE', () => {
      const bmr = 1800;
      expect(calculateTDEE(bmr, 'sedentary')).toBe(Math.round(1800 * 1.2)); // 2160
      expect(calculateTDEE(bmr, 'light')).toBe(Math.round(1800 * 1.375)); // 2475
      expect(calculateTDEE(bmr, 'moderate')).toBe(Math.round(1800 * 1.55)); // 2790
      expect(calculateTDEE(bmr, 'very')).toBe(Math.round(1800 * 1.725)); // 3105
      expect(calculateTDEE(bmr, 'extra')).toBe(Math.round(1800 * 1.9)); // 3420
    });
  });

  describe('Calorie Target & Macro Consistency', () => {
    it('applies bulk, cut, and maintain calorie adjustments with safety clamp', () => {
      const tdee = 2500;
      expect(calculateCalorieTarget(tdee, 'bulk')).toBe(2800); // +300
      expect(calculateCalorieTarget(tdee, 'cut')).toBe(2150); // -350
      expect(calculateCalorieTarget(tdee, 'maintain')).toBe(2500);

      // Clamps extreme cut to minimum floor
      expect(calculateCalorieTarget(1300, 'cut', -500)).toBe(1200); // floor is 1200
    });

    it('enforces arithmetic consistency: (P*4 + C*4 + F*9) == targetCalories +- 5 kcal', () => {
      const targets = [
        { cals: 2000, wt: 70, goal: 'bulk' as const },
        { cals: 1800, wt: 80, goal: 'cut' as const },
        { cals: 2450, wt: 65, goal: 'maintain' as const },
        { cals: 3100, wt: 90, goal: 'bulk' as const },
        { cals: 1450, wt: 55, goal: 'cut' as const },
      ];

      for (const t of targets) {
        const macros = deriveMacroTargets(t.cals, t.wt, t.goal);
        const actualKcal = macros.protein * 4 + macros.carbs * 4 + macros.fat * 9;
        const diff = Math.abs(actualKcal - t.cals);
        expect(diff).toBeLessThanOrEqual(5);
      }
    });

    it('sets higher protein on cut to preserve lean muscle', () => {
      const weight = 80;
      const cutMacros = deriveMacroTargets(2000, weight, 'cut');
      const bulkMacros = deriveMacroTargets(2000, weight, 'bulk');
      // Cut protein (2.2 g/kg = 176g) >= Bulk protein (2.0 g/kg = 160g)
      expect(cutMacros.protein).toBeGreaterThanOrEqual(bulkMacros.protein);
    });
  });

  describe('Nutrient Scaling', () => {
    const testFood: FoodItem = {
      id: 'food-test',
      name: 'Rolled Oats',
      category: 'Grains & Cereals',
      servingSize: 40,
      servingUnit: 'g',
      calories: 150,
      protein: 5,
      carbs: 27,
      fat: 2.5,
      fiber: 4,
      sodium: 2,
    };

    it('scales proportionally based on quantity', () => {
      // 80g is 2x serving
      const scaled = scaleNutrients(testFood, 80, 'g');
      expect(scaled.calories).toBe(300);
      expect(scaled.protein).toBe(10);
      expect(scaled.carbs).toBe(54);
      expect(scaled.fat).toBe(5);
      expect(scaled.fiber).toBe(8);
      expect(scaled.sodium).toBe(4);
    });

    it('handles zero quantity gracefully', () => {
      const scaled = scaleNutrients(testFood, 0, 'g');
      expect(scaled.calories).toBe(0);
      expect(scaled.protein).toBe(0);
      expect(scaled.carbs).toBe(0);
      expect(scaled.fat).toBe(0);
    });
  });

  describe('Weight Trend Evaluation & 2-Week Recalibration', () => {
    it('requires at least 14 days of data before suggesting recalibration', () => {
      const shortLogs = [
        { id: '1', date: '2026-10-01', weightKg: 75 },
        { id: '2', date: '2026-10-07', weightKg: 75.2 },
      ];
      const result = evaluateWeightTrend(shortLogs, 'bulk');
      expect(result.hasSufficientData).toBe(false);
      expect(result.recalibrationSuggested).toBe(false);
    });

    it('suggests recalibration when bulk weight trend is stalling over 2+ weeks', () => {
      const stallingBulkLogs = [
        { id: '1', date: '2026-10-01', weightKg: 75.0 },
        { id: '2', date: '2026-10-05', weightKg: 75.0 },
        { id: '3', date: '2026-10-10', weightKg: 75.1 },
        { id: '4', date: '2026-10-16', weightKg: 75.0 },
      ];
      const result = evaluateWeightTrend(stallingBulkLogs, 'bulk');
      expect(result.hasSufficientData).toBe(true);
      expect(result.recalibrationSuggested).toBe(true);
      expect(result.suggestionMessage).toContain('bump');
    });
  });
});

