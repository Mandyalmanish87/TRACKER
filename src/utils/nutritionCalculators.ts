import {
  FitnessGoal,
  BiologicalSex,
  ActivityLevel,
  MacroTargets,
  FoodItem,
  FoodServingUnit,
  WeightLogEntry,
} from '../types';

export interface BMICalculationResult {
  bmi: number;
  category: 'Underweight' | 'Normal weight' | 'Overweight' | 'Obese' | 'Minor Assessment';
  interpretation: string;
  isMinor: boolean;
}

/**
 * Calculates BMI with distinction between adult WHO criteria and minor percentile guidance.
 */
export function calculateBMI(
  weightKg: number,
  heightCm: number,
  age?: number
): BMICalculationResult | null {
  if (
    !weightKg ||
    !heightCm ||
    isNaN(weightKg) ||
    isNaN(heightCm) ||
    weightKg < 20 ||
    weightKg > 500 ||
    heightCm < 50 ||
    heightCm > 300
  ) {
    return null;
  }

  const heightM = heightCm / 100;
  const rawBmi = weightKg / (heightM * heightM);
  const bmi = Number(rawBmi.toFixed(1));

  const isMinor = typeof age === 'number' && age >= 10 && age < 18;

  if (isMinor) {
    return {
      bmi,
      category: 'Minor Assessment',
      interpretation:
        'For individuals aged 10–17, BMI is evaluated using age-and-sex-specific growth percentiles (< 5th, 5th–85th, 85th–95th, ≥ 95th). Adult cutoff brackets do not apply. Consult a pediatrician or healthcare professional for clinical assessment.',
      isMinor: true,
    };
  }

  let category: BMICalculationResult['category'] = 'Normal weight';
  let interpretation = 'Healthy weight range according to WHO standard guidelines.';

  if (bmi < 18.5) {
    category = 'Underweight';
    interpretation = 'Below the standard adult healthy weight threshold (< 18.5).';
  } else if (bmi < 25) {
    category = 'Normal weight';
    interpretation = 'Within the standard healthy adult BMI range (18.5–24.9).';
  } else if (bmi < 30) {
    category = 'Overweight';
    interpretation = 'Above the standard adult healthy weight threshold (25.0–29.9).';
  } else {
    category = 'Obese';
    interpretation = 'Within the adult obesity threshold (≥ 30.0). Informational estimate only.';
  }

  return { bmi, category, interpretation, isMinor: false };
}

/**
 * Mifflin–St Jeor Basal Metabolic Rate calculation.
 * Returns null if biologicalSex is omitted or 'prefer_not_to_say'.
 */
export function calculateBMR(
  weightKg: number,
  heightCm: number,
  age: number,
  sex: BiologicalSex
): number | null {
  if (!weightKg || !heightCm || !age || weightKg <= 0 || heightCm <= 0 || age <= 0) {
    return null;
  }
  if (sex !== 'male' && sex !== 'female') {
    return null;
  }

  // Male: 10W + 6.25H - 5A + 5
  // Female: 10W + 6.25H - 5A - 161
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return sex === 'male' ? Math.round(base + 5) : Math.round(base - 161);
}

export const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  very: 1.725,
  extra: 1.9,
};

/**
 * Total Daily Energy Expenditure (TDEE) based on Harris–Benedict activity multipliers.
 */
export function calculateTDEE(bmr: number, activityLevel: ActivityLevel): number {
  const multiplier = ACTIVITY_MULTIPLIERS[activityLevel] ?? 1.2;
  return Math.round(bmr * multiplier);
}

/**
 * Derives target calories applying goal adjustment and minimum safety floor.
 */
export function calculateCalorieTarget(
  tdee: number,
  goal: FitnessGoal,
  customAdjustment?: number
): number {
  let adjustment = 0;
  if (typeof customAdjustment === 'number') {
    adjustment = customAdjustment;
  } else {
    if (goal === 'bulk') adjustment = 300;
    else if (goal === 'cut') adjustment = -350;
    else adjustment = 0;
  }

  // Clamp adjustments within allowable safety boundaries
  if (goal === 'bulk') {
    adjustment = Math.max(100, Math.min(1000, adjustment));
  } else if (goal === 'cut') {
    adjustment = Math.min(-100, Math.max(-750, adjustment));
  } else {
    adjustment = 0;
  }

  const target = Math.round(tdee + adjustment);
  // Absolute minimum safety floor of 1200 kcal
  return Math.max(1200, target);
}

/**
 * Derives macro targets with strict arithmetic consistency check:
 * (Protein * 4) + (Carbs * 4) + (Fat * 9) == Target Calories (+- 5 kcal)
 */
export function deriveMacroTargets(
  calorieTarget: number,
  weightKg?: number,
  goal: FitnessGoal = 'maintain'
): MacroTargets {
  let proteinGrams = 0;

  if (weightKg && weightKg > 20) {
    if (goal === 'bulk') {
      proteinGrams = Math.round(weightKg * 2.0); // 2.0 g/kg
    } else if (goal === 'cut') {
      proteinGrams = Math.round(weightKg * 2.2); // 2.2 g/kg to protect lean mass
    } else {
      proteinGrams = Math.round(weightKg * 1.8); // 1.8 g/kg
    }
  } else {
    // Default 25% of calories
    proteinGrams = Math.round((0.25 * calorieTarget) / 4);
  }

  // Fat: 25% of daily calories
  const fatCalories = 0.25 * calorieTarget;
  let fatGrams = Math.round(fatCalories / 9);

  // Carbs: Remainder calories / 4
  const usedCalories = proteinGrams * 4 + fatGrams * 9;
  let carbsGrams = Math.max(0, Math.round((calorieTarget - usedCalories) / 4));

  // Enforce calorie consistency check: |(P*4 + C*4 + F*9) - calorieTarget| <= 5 kcal
  let totalKcal = proteinGrams * 4 + carbsGrams * 4 + fatGrams * 9;
  let diff = calorieTarget - totalKcal;

  while (Math.abs(diff) > 5) {
    if (diff > 0) {
      carbsGrams += 1;
    } else {
      if (carbsGrams > 0) {
        carbsGrams -= 1;
      } else {
        fatGrams = Math.max(0, fatGrams - 1);
      }
    }
    totalKcal = proteinGrams * 4 + carbsGrams * 4 + fatGrams * 9;
    diff = calorieTarget - totalKcal;
  }

  return {
    calories: calorieTarget,
    protein: proteinGrams,
    carbs: carbsGrams,
    fat: fatGrams,
  };
}

/**
 * Proportionally scales a food's nutrient values based on user-entered quantity and unit.
 */
export function scaleNutrients(
  food: FoodItem,
  quantity: number,
  unit: FoodServingUnit = food.servingUnit
): {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  sugar?: number;
  sodium?: number;
} {
  if (quantity <= 0) {
    return { calories: 0, protein: 0, carbs: 0, fat: 0 };
  }

  // Base ratio: quantity relative to reference serving size
  let ratio = quantity / (food.servingSize || 100);

  // If unit differs from reference unit and standard conversion applies
  if (unit !== food.servingUnit) {
    if (food.servingUnit === 'g' && unit === 'tbsp') ratio = (quantity * 15) / food.servingSize;
    else if (food.servingUnit === 'g' && unit === 'cup') ratio = (quantity * 200) / food.servingSize;
    else if (food.servingUnit === 'ml' && unit === 'cup') ratio = (quantity * 240) / food.servingSize;
    else if (food.servingUnit === 'ml' && unit === 'tbsp') ratio = (quantity * 15) / food.servingSize;
  }

  return {
    calories: Math.round(food.calories * ratio),
    protein: Number((food.protein * ratio).toFixed(1)),
    carbs: Number((food.carbs * ratio).toFixed(1)),
    fat: Number((food.fat * ratio).toFixed(1)),
    fiber: food.fiber !== undefined ? Number((food.fiber * ratio).toFixed(1)) : undefined,
    sugar: food.sugar !== undefined ? Number((food.sugar * ratio).toFixed(1)) : undefined,
    sodium: food.sodium !== undefined ? Math.round(food.sodium * ratio) : undefined,
  };
}

export interface WeightTrendAnalysis {
  hasSufficientData: boolean;
  totalDays: number;
  firstDate?: string;
  lastDate?: string;
  startWeight?: number;
  currentWeight?: number;
  netChangeKg?: number;
  weeklyRateKg?: number; // kg per week
  recalibrationSuggested: boolean;
  suggestionMessage?: string;
}

/**
 * Performs trend evaluation and checks if 2-week recalibration is warranted.
 */
export function evaluateWeightTrend(
  weightLogs: WeightLogEntry[],
  currentGoal: FitnessGoal = 'maintain'
): WeightTrendAnalysis {
  if (!weightLogs || weightLogs.length < 2) {
    return { hasSufficientData: false, totalDays: 0, recalibrationSuggested: false };
  }

  const sorted = [...weightLogs].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  const firstMs = new Date(first.date).getTime();
  const lastMs = new Date(last.date).getTime();
  const diffDays = Math.max(1, Math.round((lastMs - firstMs) / (1000 * 60 * 60 * 24)));

  if (diffDays < 14) {
    return {
      hasSufficientData: false,
      totalDays: diffDays,
      startWeight: first.weightKg,
      currentWeight: last.weightKg,
      netChangeKg: Number((last.weightKg - first.weightKg).toFixed(1)),
      recalibrationSuggested: false,
    };
  }

  // Linear regression slope
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  const n = sorted.length;

  for (let i = 0; i < n; i++) {
    const day = (new Date(sorted[i].date).getTime() - firstMs) / (1000 * 60 * 60 * 24);
    const weight = sorted[i].weightKg;
    sumX += day;
    sumY += weight;
    sumXY += day * weight;
    sumXX += day * day;
  }

  const denominator = n * sumXX - sumX * sumX;
  const dailySlope = denominator !== 0 ? (n * sumXY - sumX * sumY) / denominator : 0;
  const weeklyRateKg = Number((dailySlope * 7).toFixed(2));
  const netChangeKg = Number((last.weightKg - first.weightKg).toFixed(1));

  let recalibrationSuggested = false;
  let suggestionMessage: string | undefined;

  if (currentGoal === 'bulk' && weeklyRateKg < 0.1) {
    recalibrationSuggested = true;
    suggestionMessage = `Your 2-week weight gain trend is ${weeklyRateKg} kg/week (expected +0.25 to +0.5 kg/week). Consider bumping target calories by 150–200 kcal.`;
  } else if (currentGoal === 'cut' && weeklyRateKg > -0.1) {
    recalibrationSuggested = true;
    suggestionMessage = `Your 2-week rate of change is ${weeklyRateKg} kg/week (expected −0.25 to −0.75 kg/week). Consider reducing target calories by 150–200 kcal.`;
  } else if (currentGoal === 'maintain' && Math.abs(weeklyRateKg) > 0.4) {
    recalibrationSuggested = true;
    suggestionMessage = `Your weight trend has shifted by ${weeklyRateKg} kg/week while on maintenance. Consider adjusting your calorie target.`;
  }

  return {
    hasSufficientData: true,
    totalDays: diffDays,
    firstDate: first.date,
    lastDate: last.date,
    startWeight: first.weightKg,
    currentWeight: last.weightKg,
    netChangeKg,
    weeklyRateKg,
    recalibrationSuggested,
    suggestionMessage,
  };
}

