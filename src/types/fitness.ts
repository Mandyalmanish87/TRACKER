/**
 * Student Tracker — Fitness Ecosystem Core Type Definitions
 * Document ID: FITNESS-SPEC-2026-V1
 * 
 * Centralized, standardized types for Resistance Training, Exercise Library,
 * Programs, Nutrition & Micronutrients, Body Tracking, Recovery, Cardio,
 * and In-App Fitness Intelligence.
 */

// ============================================================================
// 1. RESISTANCE TRAINING & WORKOUT EXECUTION
// ============================================================================

export type SetType = 'warmup' | 'working' | 'drop' | 'failure' | 'amrap';

export interface ExerciseSet {
  id: string;
  setNumber: number;
  type: SetType;
  targetWeightKg?: number;
  targetReps?: number;
  actualWeightKg: number;
  actualReps: number;
  rpe?: number; // Rate of Perceived Exertion: 6.0 to 10.0 (0.5 increments)
  rir?: number; // Reps in Reserve: 0 to 5
  completed: boolean;
  restTimeSeconds?: number;
  notes?: string;
  isPersonalRecord?: boolean;
}

export interface WorkoutExercise {
  id: string;
  exerciseId: string; // Links to ExerciseLibraryItem or custom ID
  exerciseName: string;
  supersetGroupId?: string; // Grouping ID for supersets, giant sets, or circuits
  order: number;
  isUnilateral?: boolean;
  side?: 'left' | 'right' | 'both';
  sets: ExerciseSet[];
  notes?: string;
  substitutionOriginalExerciseId?: string;
}

export interface WorkoutSession {
  id: string;
  date: string; // YYYY-MM-DD local calendar date
  startTime?: string; // ISO string or HH:mm
  endTime?: string; // ISO string or HH:mm
  durationMinutes?: number;
  programId?: string;
  templateId?: string;
  splitName: string; // e.g. "Push Day (Chest, Shoulders, Triceps)"
  exercises: WorkoutExercise[];
  completed: boolean;
  readinessRating?: number; // 1 to 5
  overallRpe?: number; // 1 to 10
  notes?: string;
  isInterrupted?: boolean;
  isSample?: boolean;
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
}

// Legacy Gym Types (Strictly preserved for 100% backward compatibility)
export interface GymExerciseSet {
  reps: number;
  weightKg: number;
  completed: boolean;
}

export interface GymExercise {
  name: string;
  sets: GymExerciseSet[];
}

export interface GymWorkout {
  id: string;
  date: string; // YYYY-MM-DD
  split: string;
  completed: boolean;
  durationMinutes?: number;
  exercises: GymExercise[];
  notes?: string;
  isSample?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

// ============================================================================
// 2. EXERCISE LIBRARY & WORKOUT PROGRAMS
// ============================================================================

export type MuscleGroup =
  | 'chest'
  | 'upper_back'
  | 'lats'
  | 'traps'
  | 'front_delts'
  | 'side_delts'
  | 'rear_delts'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'calves'
  | 'abs'
  | 'obliques'
  | 'lower_back';

export type EquipmentRequired =
  | 'barbell'
  | 'dumbbell'
  | 'cable'
  | 'machine'
  | 'bodyweight'
  | 'kettlebell'
  | 'resistance_band'
  | 'bench'
  | 'other';

export interface ExerciseLibraryItem {
  id: string;
  name: string;
  category: 'strength' | 'hypertrophy' | 'calisthenics' | 'cardio' | 'mobility';
  primaryMuscle: MuscleGroup;
  secondaryMuscles: MuscleGroup[];
  equipment: EquipmentRequired;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  instructions: string[];
  coachingCues: string[];
  commonMistakes: string[];
  recommendedRepRange: { min: number; max: number };
  defaultRestSeconds: number;
  isCustom?: boolean;
  isFavorite?: boolean;
  alternativeExerciseIds: string[];
  localIllustrationPath?: string;
}

export interface WorkoutTemplate {
  id: string;
  name: string;
  splitCategory: 'ppl' | 'upper_lower' | 'full_body' | 'bro_split' | 'arnold' | 'home' | 'custom';
  description?: string;
  exercises: {
    exerciseId: string;
    exerciseName: string;
    targetSets: number;
    recommendedRepRange: { min: number; max: number };
    defaultRestSeconds: number;
  }[];
  createdAt: string;
}

export interface WorkoutProgram {
  id: string;
  name: string;
  splitType: 'ppl' | 'upper_lower' | 'full_body' | 'bro_split' | 'arnold' | 'home' | 'custom';
  description: string;
  daysPerWeek: number;
  schedule: {
    dayOfWeek: 1 | 2 | 3 | 4 | 5 | 6 | 7; // 1=Mon..7=Sun
    isRestDay: boolean;
    templateId?: string;
    customName?: string;
  }[];
  isActive: boolean;
  createdAt: string;
}

// ============================================================================
// 3. ADVANCED NUTRITION & MICRONUTRIENTS
// ============================================================================

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snacks' | 'pre_workout' | 'post_workout';
export type FoodServingUnit = 'g' | 'ml' | 'piece' | 'cup' | 'tbsp' | 'serving';

export interface MicronutrientProfile {
  fiberGrams?: number;
  sugarGrams?: number;
  saturatedFatGrams?: number;
  monounsaturatedFatGrams?: number;
  polyunsaturatedFatGrams?: number;
  transFatGrams?: number;
  cholesterolMg?: number;
  sodiumMg?: number;
  potassiumMg?: number;
  calciumMg?: number;
  ironMg?: number;
  magnesiumMg?: number;
  zincMg?: number;
  phosphorusMg?: number;
  vitaminAIU?: number;
  vitaminB1Mg?: number;
  vitaminB2Mg?: number;
  vitaminB3Mg?: number;
  vitaminB6Mg?: number;
  vitaminB9Mcg?: number; // Folate
  vitaminB12Mcg?: number;
  vitaminCMg?: number;
  vitaminDIU?: number;
  vitaminEMg?: number;
  vitaminKMcg?: number;
}

export interface FoodItem {
  id: string;
  name: string;
  category:
    | 'Grains & Cereals'
    | 'Dairy & Eggs'
    | 'Legumes & Pulses'
    | 'Poultry & Meat'
    | 'Vegetables'
    | 'Fruits'
    | 'Nuts & Seeds'
    | 'Fats & Oils'
    | 'Snacks & Beverages'
    | 'Supplements'
    | 'Custom';
  servingSize: number;
  servingUnit: FoodServingUnit;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  sugar?: number;
  sodium?: number;
  saturatedFat?: number;
  potassium?: number;
  micronutrients?: MicronutrientProfile;
  isCustom?: boolean;
  notes?: string;
}

export interface CustomFood extends FoodItem {
  isCustom: true;
  createdAt: string; // ISO string
  isSample?: boolean;
}

export interface RecipeIngredient {
  foodId: string;
  foodName: string;
  quantity: number;
  servingUnit: FoodServingUnit;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface Recipe {
  id: string;
  name: string;
  ingredients: RecipeIngredient[];
  totalServings: number;
  caloriesPerServing: number;
  proteinPerServing: number;
  carbsPerServing: number;
  fatPerServing: number;
  notes?: string;
  createdAt: string;
  isSample?: boolean;
}

export interface FoodDiaryEntry {
  id: string;
  date: string; // YYYY-MM-DD local calendar date
  mealType: MealType;
  foodId?: string;
  name: string;
  quantity: number;
  servingUnit: FoodServingUnit;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  sugar?: number;
  sodium?: number;
  micronutrients?: MicronutrientProfile;
  lastEditedAt: string; // ISO string
  isSample?: boolean;
}

export interface LocalBarcodeMapping {
  id: string;
  barcode: string; // EAN-13, EAN-8, UPC-A, UPC-E
  foodId: string;
  brand?: string;
  verified: boolean;
  createdAt: string;
}

export interface MealPlanDay {
  id: string;
  date: string; // YYYY-MM-DD
  targetCalories: number;
  targetProtein: number;
  targetCarbs: number;
  targetFat: number;
  plannedMeals: {
    mealType: MealType;
    recipeId?: string;
    foodId?: string;
    customFoodName?: string;
    plannedQuantity: number;
    plannedUnit: FoodServingUnit;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  }[];
  prepReminders?: string[];
}

export interface WeightLogEntry {
  id: string;
  date: string; // YYYY-MM-DD local calendar date (one per day)
  weightKg: number;
  notes?: string;
  isSample?: boolean;
}

export type FitnessGoal = 'bulk' | 'cut' | 'maintain';
export type BiologicalSex = 'male' | 'female' | 'prefer_not_to_say';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'very' | 'extra';

export interface MacroTargets {
  protein: number; // in grams
  carbs: number; // in grams
  fat: number; // in grams
  calories: number; // in kcal
  isManualOverride?: boolean;
}

export interface NutritionProfile {
  goal: FitnessGoal;
  age?: number;
  heightCm?: number;
  weightKg?: number;
  sex?: BiologicalSex;
  activityLevel?: ActivityLevel;
  calorieAdjustment?: number; // e.g. +300 for bulk, -300 for cut
  calculatedBmr?: number;
  calculatedTdee?: number;
  targetCalories: number;
  macroTargets: MacroTargets;
  waterTargetMl?: number;
  enabledMealTypes?: MealType[];
  updatedAt: string;
}

// ============================================================================
// 4. BODY MEASUREMENTS, COMPOSITION & PROGRESS PHOTOS
// ============================================================================

export interface BodyMeasurementEntry {
  id: string;
  date: string; // YYYY-MM-DD
  weightKg: number;
  waistCm?: number;
  chestCm?: number;
  hipsCm?: number;
  neckCm?: number;
  bicepLeftCm?: number;
  bicepRightCm?: number;
  thighLeftCm?: number;
  thighRightCm?: number;
  calvesCm?: number;
  shouldersCm?: number;
  notes?: string;
  createdAt: string;
}

export interface BodyCompositionEntry {
  id: string;
  date: string; // YYYY-MM-DD
  method: 'navy_circumference' | 'calipers' | 'bioimpedance_manual' | 'dexa_manual';
  bodyFatPercentage: number;
  leanMassKg: number;
  fatMassKg: number;
  skeletalMuscleMassKg?: number;
  waistToHeightRatio: number;
  isEstimated: boolean;
}

export interface ProgressPhotoEntry {
  id: string;
  date: string; // YYYY-MM-DD
  category: 'front' | 'side' | 'back' | 'custom';
  storagePath: string; // Local IndexedDB key
  cloudPath?: string; // Optional remote cloud storage path
  thumbnailDataUrl?: string; // Cached low-res thumbnail
  weightKgAtCapture?: number;
  notes?: string;
  isPrivateLocked: boolean; // Blurs in gallery until unlocked
  createdAt: string;
}

// ============================================================================
// 5. RECOVERY, SLEEP & CARDIO ACTIVITY
// ============================================================================

export interface SleepRecoveryEntry {
  id: string;
  date: string; // YYYY-MM-DD
  sleepDurationMinutes: number;
  bedTime: string; // HH:mm
  wakeTime: string; // HH:mm
  sleepQualityRating: 1 | 2 | 3 | 4 | 5; // 1=Terrible, 5=Deep & Restorative
  restingHeartRateBpm?: number; // Manually entered
  hrvMs?: number; // Manually entered rMSSD (ms)
  energyLevel: 1 | 2 | 3 | 4 | 5;
  stressLevel: 1 | 2 | 3 | 4 | 5;
  muscleSorenessMap: Partial<Record<MuscleGroup, 0 | 1 | 2 | 3>>; // 0=None, 3=Severe DOMS
  estimatedReadinessScore: number; // 0 to 100 calculated score
  notes?: string;
  createdAt: string;
}

export type CardioType =
  | 'walking'
  | 'running'
  | 'cycling'
  | 'treadmill'
  | 'swimming'
  | 'rowing'
  | 'stair_climbing'
  | 'hiit';

export interface CardioSession {
  id: string;
  date: string; // YYYY-MM-DD
  cardioType: CardioType;
  durationMinutes: number;
  distanceKm?: number;
  averagePaceMinPerKm?: number;
  averageSpeedKmh?: number;
  elevationGainMeters?: number;
  averageHeartRateBpm?: number;
  zone2Minutes?: number;
  estimatedCaloriesBurned?: number;
  calorieCalculationSource: 'pace_weight_formula' | 'heart_rate_formula' | 'manual_entry';
  notes?: string;
  createdAt: string;
}

// ============================================================================
// 6. IN-APP FITNESS INTELLIGENCE & HYDRATION
// ============================================================================

export interface FitnessInsight {
  id: string;
  category: 'strength' | 'nutrition' | 'recovery' | 'academic_synergy';
  title: string;
  summary: string;
  derivationExplanation: string;
  actionLabel?: string;
  actionPayload?: { type: string; data: any };
  isDismissed?: boolean;
  createdAt: string;
}

export interface HydrationLogEntry {
  id: string;
  date: string; // YYYY-MM-DD
  amountMl: number;
  timestamp: string; // ISO string
}

export interface FitnessSyncStatus {
  lastSyncedAt?: string;
  isSyncing: boolean;
  pendingChangesCount: number;
  syncError?: string;
  storageUsageBytes?: number;
}

