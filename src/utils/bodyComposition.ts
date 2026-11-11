/**
 * Student Tracker — Body Composition & Anthropometric Engine
 * Document ID: FITNESS-M04-BODY-TRACKING
 *
 * Mathematical formulas:
 * - U.S. Navy Circumference Body Fat % (Male and Female variants)
 * - Lean Mass & Fat Mass calculation
 * - Waist-to-Height Ratio (WHtR) and cardiovascular risk categorization
 * - Data provenance labeling
 */


export interface NavyBodyCompositionResult {
  bodyFatPercentage: number;
  leanMassKg: number;
  fatMassKg: number;
  waistToHeightRatio: number;
  whtrCategory: 'underweight' | 'healthy' | 'increased_risk' | 'high_risk';
  categoryLabel: string;
  provenance: string;
}

export interface NavyInputParams {
  sex: 'male' | 'female' | 'prefer_not_to_say';
  heightCm: number;
  weightKg: number;
  waistCm: number;
  neckCm: number;
  hipsCm?: number; // Required for females
}

/**
 * Calculates Body Composition using the U.S. Navy Circumference Method.
 * Strict mathematical validations preventing log10 of negative or zero numbers.
 */
export function calculateNavyBodyComposition(
  params: NavyInputParams
): { success: true; data: NavyBodyCompositionResult } | { success: false; error: string } {
  const { sex, heightCm, weightKg, waistCm, neckCm, hipsCm } = params;

  if (!heightCm || heightCm < 80 || heightCm > 260) {
    return { success: false, error: 'Valid height between 80cm and 260cm is required.' };
  }

  if (!weightKg || weightKg < 25 || weightKg > 350) {
    return { success: false, error: 'Valid body weight between 25kg and 350kg is required.' };
  }

  if (!waistCm || waistCm < 40 || waistCm > 220) {
    return { success: false, error: 'Valid waist circumference between 40cm and 220cm is required.' };
  }

  if (!neckCm || neckCm < 20 || neckCm > 65) {
    return { success: false, error: 'Valid neck circumference between 20cm and 65cm is required.' };
  }

  const isFemale = sex === 'female';
  let bodyFatPct = 0;

  if (isFemale) {
    if (!hipsCm || hipsCm < 50 || hipsCm > 250) {
      return { success: false, error: 'Hip circumference between 50cm and 250cm is required for female body fat calculation.' };
    }

    const hipWaistDiff = waistCm + hipsCm - neckCm;
    if (hipWaistDiff <= 0) {
      return { success: false, error: 'Waist + Hips must be greater than neck circumference.' };
    }

    // Female DoD Metric Formula (Siri equation)
    const density =
      1.29579 -
      0.35004 * Math.log10(hipWaistDiff) +
      0.221 * Math.log10(heightCm);
    bodyFatPct = 495 / density - 450;
  } else {
    // Male formula
    const waistNeckDiff = waistCm - neckCm;
    if (waistNeckDiff <= 0) {
      return { success: false, error: 'Waist circumference must be strictly greater than neck circumference.' };
    }

    // Male DoD Metric Formula (Siri equation)
    const density =
      1.0324 -
      0.19077 * Math.log10(waistNeckDiff) +
      0.15456 * Math.log10(heightCm);
    bodyFatPct = 495 / density - 450;
  }

  // Clamp body fat percentage to physiologically possible ranges (3% to 65%)
  const clampedBF = Math.max(3.0, Math.min(65.0, Number(bodyFatPct.toFixed(1))));

  const fatMass = Number((weightKg * (clampedBF / 100)).toFixed(1));
  const leanMass = Number((weightKg - fatMass).toFixed(1));

  // Waist-to-Height Ratio (WHtR)
  const whtr = Number((waistCm / heightCm).toFixed(2));
  let whtrCategory: NavyBodyCompositionResult['whtrCategory'] = 'healthy';
  let categoryLabel = 'Healthy (Low Health Risk)';

  if (whtr < 0.4) {
    whtrCategory = 'underweight';
    categoryLabel = 'Underweight (Below Healthy Waist Ratio)';
  } else if (whtr < 0.5) {
    whtrCategory = 'healthy';
    categoryLabel = 'Healthy / Lean (Optimal Health Ratio)';
  } else if (whtr < 0.6) {
    whtrCategory = 'increased_risk';
    categoryLabel = 'Increased Cardiovascular Risk';
  } else {
    whtrCategory = 'high_risk';
    categoryLabel = 'High Cardiovascular & Metabolic Risk';
  }

  return {
    success: true,
    data: {
      bodyFatPercentage: clampedBF,
      leanMassKg: leanMass,
      fatMassKg: fatMass,
      waistToHeightRatio: whtr,
      whtrCategory,
      categoryLabel,
      provenance: 'Calculated: U.S. Navy Circumference Method',
    },
  };
}

/**
 * Converts inches to centimeters and vice versa.
 */
export function convertLength(val: number, from: 'cm' | 'in', to: 'cm' | 'in'): number {
  if (from === to) return val;
  if (from === 'in' && to === 'cm') return Number((val * 2.54).toFixed(1));
  return Number((val / 2.54).toFixed(1));
}
