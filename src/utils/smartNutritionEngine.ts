/**
 * Student Tracker — Advanced Micronutrient, Adaptive TDEE & Smart Recalibration Engine
 * Document ID: FITNESS-M03-ADVANCED-NUTRITION
 *
 * Core Philosophies:
 * - Missing micronutrient data is represented as unknown, never falsely 0.
 * - Raw vs. cooked conversion factors.
 * - Empirical rolling-average TDEE calculation based on scale weight change.
 * - User-approved adaptive target recalibration respecting a 1,200 kcal safety floor.
 */

import {
  FoodDiaryEntry,
  WeightLogEntry,
  NutritionProfile,
  MacroTargets,
} from '../types';

export interface MicronutrientAggregateItem {
  name: string;
  unit: string;
  totalAmount: number;
  knownEntriesCount: number;
  totalEntriesCount: number;
  rdaReference: number;
  percentageOfRda: number;
  status: 'optimal' | 'below_reference' | 'above_reference' | 'insufficient_data';
}

export interface DailyMicronutrientSummary {
  vitaminsAndMinerals: Record<string, MicronutrientAggregateItem>;
  fatsBreakdown: {
    saturatedGrams: number;
    monounsaturatedGrams: number;
    polyunsaturatedGrams: number;
    transGrams: number;
    cholesterolMg: number;
  };
  carbsBreakdown: {
    fiberGrams: number;
    sugarGrams: number;
  };
}

export const STANDARD_RDA_GUIDELINES: Record<string, { name: string; unit: string; rdaMale: number; rdaFemale: number }> = {
  vitaminA: { name: 'Vitamin A', unit: 'IU', rdaMale: 3000, rdaFemale: 2333 },
  vitaminB1: { name: 'Vitamin B1 (Thiamine)', unit: 'mg', rdaMale: 1.2, rdaFemale: 1.1 },
  vitaminB2: { name: 'Vitamin B2 (Riboflavin)', unit: 'mg', rdaMale: 1.3, rdaFemale: 1.1 },
  vitaminB3: { name: 'Vitamin B3 (Niacin)', unit: 'mg', rdaMale: 16, rdaFemale: 14 },
  vitaminB6: { name: 'Vitamin B6', unit: 'mg', rdaMale: 1.7, rdaFemale: 1.5 },
  vitaminB9: { name: 'Folate (B9)', unit: 'mcg', rdaMale: 400, rdaFemale: 400 },
  vitaminB12: { name: 'Vitamin B12', unit: 'mcg', rdaMale: 2.4, rdaFemale: 2.4 },
  vitaminC: { name: 'Vitamin C', unit: 'mg', rdaMale: 90, rdaFemale: 75 },
  vitaminD: { name: 'Vitamin D', unit: 'IU', rdaMale: 600, rdaFemale: 600 },
  vitaminE: { name: 'Vitamin E', unit: 'mg', rdaMale: 15, rdaFemale: 15 },
  vitaminK: { name: 'Vitamin K', unit: 'mcg', rdaMale: 120, rdaFemale: 90 },
  calcium: { name: 'Calcium', unit: 'mg', rdaMale: 1000, rdaFemale: 1000 },
  iron: { name: 'Iron', unit: 'mg', rdaMale: 8, rdaFemale: 18 },
  magnesium: { name: 'Magnesium', unit: 'mg', rdaMale: 420, rdaFemale: 320 },
  zinc: { name: 'Zinc', unit: 'mg', rdaMale: 11, rdaFemale: 8 },
  potassium: { name: 'Potassium', unit: 'mg', rdaMale: 3400, rdaFemale: 2600 },
  sodium: { name: 'Sodium (Upper Limit)', unit: 'mg', rdaMale: 2300, rdaFemale: 2300 },
  phosphorus: { name: 'Phosphorus', unit: 'mg', rdaMale: 700, rdaFemale: 700 },
};

/**
 * Aggregates all micronutrients for a given list of food diary entries.
 * Properly computes known vs missing coverage per nutrient.
 */
export function aggregateMicronutrients(
  entries: FoodDiaryEntry[],
  isFemale: boolean = false
): DailyMicronutrientSummary {
  const result: Record<string, MicronutrientAggregateItem> = {};
  const totalEntries = entries.length;

  for (const [key, meta] of Object.entries(STANDARD_RDA_GUIDELINES)) {
    const rda = isFemale ? meta.rdaFemale : meta.rdaMale;
    const item: MicronutrientAggregateItem = {
      name: meta.name,
      unit: meta.unit,
      totalAmount: 0,
      knownEntriesCount: 0,
      totalEntriesCount: totalEntries,
      rdaReference: rda,
      percentageOfRda: 0,
      status: 'insufficient_data',
    };
    result[key] = item;
    result[meta.name] = item;
  }

  const fats = {
    saturatedGrams: 0,
    monounsaturatedGrams: 0,
    polyunsaturatedGrams: 0,
    transGrams: 0,
    cholesterolMg: 0,
  };

  const carbs = {
    fiberGrams: 0,
    sugarGrams: 0,
  };

  for (const entry of entries) {
    const micro = entry.micronutrients;
    if (typeof entry.fiber === 'number') carbs.fiberGrams += entry.fiber;
    if (typeof entry.sugar === 'number') carbs.sugarGrams += entry.sugar;

    if (!micro) continue;

    if (typeof micro.fiberGrams === 'number') carbs.fiberGrams += micro.fiberGrams;
    if (typeof micro.sugarGrams === 'number') carbs.sugarGrams += micro.sugarGrams;
    if (typeof micro.saturatedFatGrams === 'number') fats.saturatedGrams += micro.saturatedFatGrams;
    if (typeof micro.monounsaturatedFatGrams === 'number') fats.monounsaturatedGrams += micro.monounsaturatedFatGrams;
    if (typeof micro.polyunsaturatedFatGrams === 'number') fats.polyunsaturatedGrams += micro.polyunsaturatedFatGrams;
    if (typeof micro.transFatGrams === 'number') fats.transGrams += micro.transFatGrams;
    if (typeof micro.cholesterolMg === 'number') fats.cholesterolMg += micro.cholesterolMg;

    const mapping: Record<string, number | undefined> = {
      vitaminA: micro.vitaminAIU,
      vitaminB1: micro.vitaminB1Mg,
      vitaminB2: micro.vitaminB2Mg,
      vitaminB3: micro.vitaminB3Mg,
      vitaminB6: micro.vitaminB6Mg,
      vitaminB9: micro.vitaminB9Mcg,
      vitaminB12: micro.vitaminB12Mcg,
      vitaminC: micro.vitaminCMg,
      vitaminD: micro.vitaminDIU,
      vitaminE: micro.vitaminEMg,
      vitaminK: micro.vitaminKMcg,
      calcium: micro.calciumMg,
      iron: micro.ironMg,
      magnesium: micro.magnesiumMg,
      zinc: micro.zincMg,
      potassium: micro.potassiumMg,
      sodium: micro.sodiumMg ?? entry.sodium,
      phosphorus: micro.phosphorusMg,
    };

    for (const [key, val] of Object.entries(mapping)) {
      if (typeof val === 'number' && !isNaN(val)) {
        result[key].totalAmount += val;
        result[key].knownEntriesCount += 1;
      }
    }
  }

  // Calculate final status and percentages
  for (const key of Object.keys(STANDARD_RDA_GUIDELINES)) {
    const item = result[key];
    item.totalAmount = Number(item.totalAmount.toFixed(1));
    if (item.totalEntriesCount === 0 || item.knownEntriesCount === 0) {
      item.status = 'insufficient_data';
      item.percentageOfRda = 0;
    } else {
      const pct = Math.round((item.totalAmount / item.rdaReference) * 100);
      item.percentageOfRda = pct;
      if (key === 'sodium') {
        item.status = pct > 100 ? 'above_reference' : 'optimal';
      } else if (pct < 75) {
        item.status = 'below_reference';
      } else if (pct <= 150) {
        item.status = 'optimal';
      } else {
        item.status = 'above_reference';
      }
    }
  }

  return {
    vitaminsAndMinerals: result,
    fatsBreakdown: {
      saturatedGrams: Number(fats.saturatedGrams.toFixed(1)),
      monounsaturatedGrams: Number(fats.monounsaturatedGrams.toFixed(1)),
      polyunsaturatedGrams: Number(fats.polyunsaturatedGrams.toFixed(1)),
      transGrams: Number(fats.transGrams.toFixed(1)),
      cholesterolMg: Math.round(fats.cholesterolMg),
    },
    carbsBreakdown: {
      fiberGrams: Number(carbs.fiberGrams.toFixed(1)),
      sugarGrams: Number(carbs.sugarGrams.toFixed(1)),
    },
  };
}

/**
 * Raw vs. Cooked conversion factors for common food staples.
 */
export const RAW_TO_COOKED_YIELD_FACTORS: Record<string, number> = {
  rice: 2.5,       // 100g raw white/brown rice -> 250g cooked
  oats: 2.5,       // 100g raw rolled oats -> 250g cooked oatmeal
  dal: 2.4,        // 100g raw yellow/toor lentils -> 240g cooked dal
  chicken: 0.75,   // 100g raw chicken breast -> 75g cooked (moisture loss)
  paneer: 0.95,    // minimal moisture loss
  egg: 1.0,
  potato: 1.0,
};

export interface RawCookedConversionResult {
  convertedGrams: number;
  factor: number;
}

/**
 * Converts quantity between raw and cooked weights.
 * Supports both call conventions:
 * (grams, 'raw_to_cooked', 'rice') and (grams, 'rice', 'raw_to_cooked')
 */
export function convertRawCookedWeight(
  quantityGrams: number,
  arg2: 'raw_to_cooked' | 'cooked_to_raw' | string,
  arg3?: 'raw_to_cooked' | 'cooked_to_raw' | string
): RawCookedConversionResult {
  let direction: 'raw_to_cooked' | 'cooked_to_raw' = 'raw_to_cooked';
  let foodType = '';

  if (arg2 === 'raw_to_cooked' || arg2 === 'cooked_to_raw') {
    direction = arg2;
    foodType = arg3 || '';
  } else {
    foodType = arg2;
    direction = (arg3 as 'raw_to_cooked' | 'cooked_to_raw') || 'raw_to_cooked';
  }

  const normalized = foodType.toLowerCase();
  const matchedKey = Object.keys(RAW_TO_COOKED_YIELD_FACTORS).find((k) => normalized.includes(k));
  const factor = matchedKey ? RAW_TO_COOKED_YIELD_FACTORS[matchedKey] : 1.0;

  const convertedGrams =
    direction === 'raw_to_cooked'
      ? Math.round(quantityGrams * factor)
      : Math.round(quantityGrams / factor);

  return { convertedGrams, factor };
}

/**
 * Calculates empirical TDEE using 14-day rolling average calorie intake
 * and 14-day scale weight delta (7700 kcal per kg of tissue).
 */
export function calculateEmpiricalTDEE(
  dailyCalories: { date: string; calories: number }[],
  weightLogs: WeightLogEntry[]
): { empiricalTdee: number; deltaWeightKg: number; averageCalories: number; daysCount: number } | null {
  if (weightLogs.length < 2 || dailyCalories.length < 5) return null;

  const sortedWeights = [...weightLogs].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const firstWeight = sortedWeights[0];
  const lastWeight = sortedWeights[sortedWeights.length - 1];

  const firstDate = new Date(firstWeight.date);
  const lastDate = new Date(lastWeight.date);
  const diffDays = Math.max(1, Math.round((lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24)));

  if (diffDays < 7) return null; // Need at least 7 days of data for stability

  // Calculate average daily calories between firstDate and lastDate
  const relevantCalories = dailyCalories.filter((c) => {
    const d = new Date(c.date);
    return d >= firstDate && d <= lastDate && c.calories > 500;
  });

  if (relevantCalories.length === 0) return null;

  const avgCalories = relevantCalories.reduce((sum, c) => sum + c.calories, 0) / relevantCalories.length;
  const deltaWeight = lastWeight.weightKg - firstWeight.weightKg;

  // 1 kg of body tissue is approximately 7,700 kcal
  const dailyCalorieDeficitOrSurplus = (deltaWeight * 7700) / diffDays;
  const empiricalTdee = Math.round(avgCalories - dailyCalorieDeficitOrSurplus);

  return {
    empiricalTdee: Math.max(1200, Math.min(5000, empiricalTdee)),
    deltaWeightKg: Number(deltaWeight.toFixed(2)),
    averageCalories: Math.round(avgCalories),
    daysCount: diffDays,
  };
}

/**
 * Generates an adaptive nutrition recalibration recommendation.
 * Enforces the strict 1,200 kcal safety floor and preserves macro proportions.
 */
export function evaluateSmartTargetRecalibration(
  profile: NutritionProfile,
  weightLogs: WeightLogEntry[],
  dailyCalories: { date: string; calories: number }[]
): {
  shouldRecalibrate: boolean;
  recommendedCalories: number;
  recommendedMacros: MacroTargets;
  reason: string;
} | null {
  const empirical = calculateEmpiricalTDEE(dailyCalories, weightLogs);
  if (!empirical || empirical.daysCount < 14) return null;

  const currentTarget = profile.targetCalories;
  const currentMacros = profile.macroTargets;
  const goal = profile.goal;

  const SAFETY_FLOOR = 1200;

  // Case 1: Cutting phase, but weight has stalled or increased over 14 days
  if (goal === 'cut' && empirical.deltaWeightKg >= 0) {
    const adjustment = -150;
    const newCalories = Math.max(SAFETY_FLOOR, currentTarget + adjustment);
    if (newCalories !== currentTarget) {
      const ratio = newCalories / currentTarget;
      return {
        shouldRecalibrate: true,
        recommendedCalories: newCalories,
        recommendedMacros: {
          calories: newCalories,
          protein: currentMacros.protein, // Protect muscle: keep protein constant
          fat: Math.max(35, Math.round(currentMacros.fat * ratio)),
          carbs: Math.max(50, Math.round(currentMacros.carbs * ratio)),
        },
        reason: `Weight plateau detected (+${empirical.deltaWeightKg}kg over ${empirical.daysCount} days). Empirical TDEE is approximately ${empirical.empiricalTdee} kcal. We recommend reducing daily intake by 150 kcal to resume fat loss.`,
      };
    }
  }

  // Case 2: Bulking phase, but weight has stalled or dropped over 14 days
  if (goal === 'bulk' && empirical.deltaWeightKg <= 0.1) {
    const adjustment = 150;
    const newCalories = currentTarget + adjustment;
    const ratio = newCalories / currentTarget;
    return {
      shouldRecalibrate: true,
      recommendedCalories: newCalories,
      recommendedMacros: {
        calories: newCalories,
        protein: currentMacros.protein,
        fat: Math.round(currentMacros.fat * ratio),
        carbs: Math.round(currentMacros.carbs * ratio),
      },
      reason: `Surplus insufficient (${empirical.deltaWeightKg}kg gained over ${empirical.daysCount} days). Empirical TDEE is approximately ${empirical.empiricalTdee} kcal. We recommend increasing daily intake by 150 kcal to stimulate muscle growth.`,
    };
  }

  return null;
}

export const aggregateDailyMicronutrients = aggregateMicronutrients;

export function calculateAdaptiveTDEE(
  weightLogs: WeightLogEntry[],
  diaryEntries: FoodDiaryEntry[],
  fallbackTdee: number = 2200
): { estimatedTdee: number; confidenceLevel: string; dataPointsCount: number } {
  const caloriesByDate = new Map<string, number>();
  for (const entry of diaryEntries) {
    caloriesByDate.set(entry.date, (caloriesByDate.get(entry.date) || 0) + (entry.calories || 0));
  }
  const dailyCalories = Array.from(caloriesByDate.entries()).map(([date, calories]) => ({ date, calories }));

  const result = calculateEmpiricalTDEE(dailyCalories, weightLogs);
  if (!result) {
    return {
      estimatedTdee: fallbackTdee,
      confidenceLevel: 'baseline',
      dataPointsCount: weightLogs.length,
    };
  }

  const confidence = result.daysCount >= 14 ? 'high' : result.daysCount >= 7 ? 'moderate' : 'low';
  return {
    estimatedTdee: result.empiricalTdee,
    confidenceLevel: confidence,
    dataPointsCount: result.daysCount,
  };
}

export function calculateSmartRecalibration(
  adaptiveResult: { estimatedTdee: number; confidenceLevel: string; dataPointsCount: number },
  profile: NutritionProfile,
  weightLogs: WeightLogEntry[] = [],
  diaryEntries: FoodDiaryEntry[] = []
): { recommendedTargetCalories: number; recommendedMacros: MacroTargets; reasoning: string } {
  const caloriesByDate = new Map<string, number>();
  for (const entry of diaryEntries) {
    caloriesByDate.set(entry.date, (caloriesByDate.get(entry.date) || 0) + (entry.calories || 0));
  }
  const dailyCalories = Array.from(caloriesByDate.entries()).map(([date, calories]) => ({ date, calories }));

  const rec = evaluateSmartTargetRecalibration(profile, weightLogs, dailyCalories);
  if (rec && rec.shouldRecalibrate) {
    return {
      recommendedTargetCalories: rec.recommendedCalories,
      recommendedMacros: rec.recommendedMacros,
      reasoning: rec.reason,
    };
  }

  return {
    recommendedTargetCalories: profile.targetCalories,
    recommendedMacros: profile.macroTargets,
    reasoning: `Your daily caloric intake is currently well-calibrated against your estimated expenditure of ~${adaptiveResult.estimatedTdee} kcal/day.`,
  };
}

