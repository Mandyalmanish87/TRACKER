import React, { useState } from 'react';
import { X, Check, Calculator, Sparkles, Info, Edit3 } from 'lucide-react';
import {
  FitnessGoal,
  BiologicalSex,
  ActivityLevel,
  NutritionProfile,
  MacroTargets,
} from '../../types';
import {
  calculateBMI,
  calculateBMR,
  calculateTDEE,
  calculateCalorieTarget,
  deriveMacroTargets,
} from '../../utils/nutritionCalculators';

interface FitnessOnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentProfile?: NutritionProfile;
  onSaveProfile: (profile: NutritionProfile) => void;
}

export const FitnessOnboardingModal: React.FC<FitnessOnboardingModalProps> = ({
  isOpen,
  onClose,
  currentProfile,
  onSaveProfile,
}) => {
  const [goal, setGoal] = useState<FitnessGoal>(currentProfile?.goal || 'maintain');
  const [age, setAge] = useState<number | undefined>(currentProfile?.age || 20);
  const [heightCm, setHeightCm] = useState<number | undefined>(currentProfile?.heightCm || 175);
  const [weightKg, setWeightKg] = useState<number | undefined>(currentProfile?.weightKg || 72);
  const [sex, setSex] = useState<BiologicalSex>(currentProfile?.sex || 'male');
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>(
    currentProfile?.activityLevel || 'moderate'
  );
  const [isManualOverride, setIsManualOverride] = useState<boolean>(
    Boolean(currentProfile?.macroTargets?.isManualOverride)
  );

  // Manual target fields
  const [manualCalories, setManualCalories] = useState<number>(
    currentProfile?.targetCalories || 2200
  );
  const [manualProtein, setManualProtein] = useState<number>(
    currentProfile?.macroTargets?.protein || 140
  );
  const [manualCarbs, setManualCarbs] = useState<number>(
    currentProfile?.macroTargets?.carbs || 260
  );
  const [manualFat, setManualFat] = useState<number>(
    currentProfile?.macroTargets?.fat || 65
  );

  if (!isOpen) return null;

  // Live Calculations
  const bmiResult = weightKg && heightCm ? calculateBMI(weightKg, heightCm, age) : null;
  const calculatedBmr =
    weightKg && heightCm && age && sex !== 'prefer_not_to_say'
      ? calculateBMR(weightKg, heightCm, age, sex)
      : null;
  const calculatedTdee = calculatedBmr ? calculateTDEE(calculatedBmr, activityLevel) : null;
  const autoCalorieTarget = calculatedTdee
    ? calculateCalorieTarget(calculatedTdee, goal)
    : 2200;
  const autoMacros: MacroTargets = deriveMacroTargets(autoCalorieTarget, weightKg, goal);

  const activeCalories = isManualOverride ? manualCalories : autoCalorieTarget;
  const activeMacros = isManualOverride
    ? {
        protein: manualProtein,
        carbs: manualCarbs,
        fat: manualFat,
        calories: manualCalories,
        isManualOverride: true,
      }
    : autoMacros;

  const handleSave = () => {
    const updated: NutritionProfile = {
      goal,
      age,
      heightCm,
      weightKg,
      sex,
      activityLevel,
      calculatedBmr: calculatedBmr || undefined,
      calculatedTdee: calculatedTdee || undefined,
      targetCalories: activeCalories,
      macroTargets: activeMacros,
      waterTargetMl: currentProfile?.waterTargetMl || 2500,
      enabledMealTypes: currentProfile?.enabledMealTypes || [
        'breakfast',
        'lunch',
        'dinner',
        'snacks',
        'pre_workout',
        'post_workout',
      ],
      updatedAt: new Date().toISOString(),
    };
    onSaveProfile(updated);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-espresso-900 border border-ivory-300 dark:border-espresso-750 w-full max-w-xl rounded-2xl shadow-xl flex flex-col overflow-hidden max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-ivory-200 dark:border-espresso-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-terracotta-100 dark:bg-terracotta-950 flex items-center justify-center text-terracotta-600 dark:text-terracotta-400">
              <Calculator className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-serif text-xl font-bold text-espresso-950 dark:text-ivory-50">
                Fitness & Nutrition Targets
              </h2>
              <p className="text-xs text-espresso-500 dark:text-espresso-400">
                Mifflin–St Jeor BMR, TDEE, and macro targets calibrated for your goals.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-espresso-500 hover:text-espresso-800 dark:text-espresso-400 dark:hover:text-ivory-200 hover:bg-ivory-100 dark:hover:bg-espresso-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-5 text-xs sm:text-sm">
          {/* Goal Selector */}
          <div>
            <label className="block text-xs font-semibold text-espresso-800 dark:text-ivory-200 mb-2">
              Primary Objective
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'bulk' as FitnessGoal, title: 'Bulk / Gain', desc: '+300 kcal, High Protein' },
                { id: 'cut' as FitnessGoal, title: 'Cut / Lean', desc: '−350 kcal, Protect Muscle' },
                { id: 'maintain' as FitnessGoal, title: 'Maintenance', desc: 'Equilibrium TDEE' },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setGoal(item.id)}
                  className={`p-3 rounded-xl border text-left transition ${
                    goal === item.id
                      ? 'border-terracotta-500 bg-terracotta-50/50 dark:bg-terracotta-950/40 text-espresso-950 dark:text-ivory-50 shadow-xs'
                      : 'border-ivory-300 dark:border-espresso-750 bg-white dark:bg-espresso-850 hover:bg-ivory-100/60 dark:hover:bg-espresso-800 text-espresso-700 dark:text-espresso-300'
                  }`}
                >
                  <p className="font-bold text-xs sm:text-sm">{item.title}</p>
                  <p className="text-[10px] text-espresso-500 dark:text-espresso-400 mt-0.5">{item.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Physical Measurements Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-espresso-700 dark:text-espresso-300 mb-1">
                Age
              </label>
              <input
                type="number"
                min="10"
                max="100"
                value={age || ''}
                onChange={(e) => setAge(e.target.value ? Number(e.target.value) : undefined)}
                className="w-full px-3 py-1.5 rounded-lg border border-ivory-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-950 text-espresso-900 dark:text-ivory-100"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-espresso-700 dark:text-espresso-300 mb-1">
                Height (cm)
              </label>
              <input
                type="number"
                min="50"
                max="250"
                value={heightCm || ''}
                onChange={(e) => setHeightCm(e.target.value ? Number(e.target.value) : undefined)}
                className="w-full px-3 py-1.5 rounded-lg border border-ivory-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-950 text-espresso-900 dark:text-ivory-100"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-espresso-700 dark:text-espresso-300 mb-1">
                Weight (kg)
              </label>
              <input
                type="number"
                min="20"
                max="300"
                step="0.1"
                value={weightKg || ''}
                onChange={(e) => setWeightKg(e.target.value ? Number(e.target.value) : undefined)}
                className="w-full px-3 py-1.5 rounded-lg border border-ivory-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-950 text-espresso-900 dark:text-ivory-100"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-espresso-700 dark:text-espresso-300 mb-1">
                Biological Sex
              </label>
              <select
                value={sex}
                onChange={(e) => setSex(e.target.value as BiologicalSex)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-ivory-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-950 text-espresso-900 dark:text-ivory-100 text-xs"
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="prefer_not_to_say">Neutral / Custom</option>
              </select>
            </div>
          </div>

          {/* Activity Multiplier */}
          <div>
            <label className="block text-[11px] font-medium text-espresso-700 dark:text-espresso-300 mb-1">
              Daily Physical Activity Level
            </label>
            <select
              value={activityLevel}
              onChange={(e) => setActivityLevel(e.target.value as ActivityLevel)}
              className="w-full px-3 py-2 rounded-xl border border-ivory-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-950 text-espresso-900 dark:text-ivory-100 text-xs"
            >
              <option value="sedentary">Sedentary (Desk student, little exercise) — 1.2x</option>
              <option value="light">Lightly Active (Workouts 1–3 days/week) — 1.375x</option>
              <option value="moderate">Moderately Active (Workouts 3–5 days/week) — 1.55x</option>
              <option value="very">Very Active (Hard training 6–7 days/week) — 1.725x</option>
              <option value="extra">Extra Active (Athlete / Physical job + 2x training) — 1.9x</option>
            </select>
          </div>

          {/* Live Calculated Stats Card */}
          <div className="p-4 rounded-xl bg-ivory-100/70 dark:bg-espresso-850/60 border border-ivory-200 dark:border-espresso-750 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-espresso-950 dark:text-ivory-50 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-500" />
                Calculated Metabolic Profile
              </span>
              <button
                type="button"
                onClick={() => setIsManualOverride(!isManualOverride)}
                className="text-[11px] text-terracotta-600 dark:text-terracotta-400 font-semibold underline flex items-center gap-1"
              >
                <Edit3 className="w-3 h-3" />
                {isManualOverride ? 'Use Auto-Calculation' : 'Override Manually'}
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2.5 bg-white dark:bg-espresso-900 rounded-lg border border-ivory-200 dark:border-espresso-750">
                <span className="text-[10px] text-espresso-400 font-mono uppercase block">Body Mass Index</span>
                <span className="font-serif font-bold text-sm text-espresso-900 dark:text-ivory-100 tabular-nums">
                  {bmiResult ? bmiResult.bmi : '—'}
                </span>
                <p className="text-[10px] text-espresso-500 dark:text-espresso-400 truncate">
                  {bmiResult ? bmiResult.category : 'Needs H/W'}
                </p>
              </div>

              <div className="p-2.5 bg-white dark:bg-espresso-900 rounded-lg border border-ivory-200 dark:border-espresso-750">
                <span className="text-[10px] text-espresso-400 font-mono uppercase block">BMR (Basal)</span>
                <span className="font-serif font-bold text-sm text-espresso-900 dark:text-ivory-100 tabular-nums">
                  {calculatedBmr ? `${calculatedBmr} kcal` : 'Manual'}
                </span>
                <p className="text-[10px] text-espresso-500 dark:text-espresso-400">At rest</p>
              </div>

              <div className="p-2.5 bg-white dark:bg-espresso-900 rounded-lg border border-ivory-200 dark:border-espresso-750">
                <span className="text-[10px] text-espresso-400 font-mono uppercase block">Daily TDEE</span>
                <span className="font-serif font-bold text-sm text-espresso-900 dark:text-ivory-100 tabular-nums">
                  {calculatedTdee ? `${calculatedTdee} kcal` : 'Manual'}
                </span>
                <p className="text-[10px] text-espresso-500 dark:text-espresso-400">Maintenance</p>
              </div>
            </div>

            {bmiResult?.isMinor && (
              <p className="text-[11px] text-amber-700 dark:text-amber-400 italic bg-amber-50 dark:bg-amber-950/40 p-2 rounded-lg border border-amber-200 dark:border-amber-800">
                {bmiResult.interpretation}
              </p>
            )}
          </div>

          {/* Active Target Preview or Manual Inputs */}
          {isManualOverride ? (
            <div className="p-4 rounded-xl border border-terracotta-300 dark:border-terracotta-800/80 bg-terracotta-50/30 dark:bg-terracotta-950/20 space-y-3">
              <span className="text-xs font-bold text-terracotta-800 dark:text-terracotta-300 block">
                Custom Target Overrides
              </span>
              <div className="grid grid-cols-4 gap-2">
                <div>
                  <label className="block text-[10px] font-medium text-espresso-600 dark:text-espresso-400 mb-1">
                    Calories (kcal)
                  </label>
                  <input
                    type="number"
                    value={manualCalories}
                    onChange={(e) => setManualCalories(Number(e.target.value))}
                    className="w-full px-2 py-1.5 rounded-lg border border-ivory-300 dark:border-espresso-700 bg-white dark:bg-espresso-900 font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-emerald-700 dark:text-emerald-400 mb-1">
                    Protein (g)
                  </label>
                  <input
                    type="number"
                    value={manualProtein}
                    onChange={(e) => setManualProtein(Number(e.target.value))}
                    className="w-full px-2 py-1.5 rounded-lg border border-ivory-300 dark:border-espresso-700 bg-white dark:bg-espresso-900 font-bold text-emerald-700 dark:text-emerald-300"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-blue-700 dark:text-blue-400 mb-1">
                    Carbs (g)
                  </label>
                  <input
                    type="number"
                    value={manualCarbs}
                    onChange={(e) => setManualCarbs(Number(e.target.value))}
                    className="w-full px-2 py-1.5 rounded-lg border border-ivory-300 dark:border-espresso-700 bg-white dark:bg-espresso-900 font-bold text-blue-700 dark:text-blue-300"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-amber-700 dark:text-amber-400 mb-1">
                    Fat (g)
                  </label>
                  <input
                    type="number"
                    value={manualFat}
                    onChange={(e) => setManualFat(Number(e.target.value))}
                    className="w-full px-2 py-1.5 rounded-lg border border-ivory-300 dark:border-espresso-700 bg-white dark:bg-espresso-900 font-bold text-amber-700 dark:text-amber-300"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl border border-ivory-200 dark:border-espresso-750 bg-white dark:bg-espresso-850 flex items-center justify-between">
              <div>
                <span className="text-[11px] text-espresso-400 font-mono uppercase">
                  Calibrated Daily Target
                </span>
                <p className="font-serif text-2xl font-bold text-espresso-950 dark:text-ivory-50">
                  {autoCalorieTarget} <span className="text-sm font-normal text-espresso-500">kcal/day</span>
                </p>
              </div>
              <div className="text-right text-xs space-y-0.5">
                <p className="text-emerald-700 dark:text-emerald-400 font-medium">
                  {autoMacros.protein}g Protein
                </p>
                <p className="text-blue-700 dark:text-blue-400 font-medium">
                  {autoMacros.carbs}g Carbs
                </p>
                <p className="text-amber-700 dark:text-amber-400 font-medium">
                  {autoMacros.fat}g Fat
                </p>
              </div>
            </div>
          )}

          {/* Medical Disclaimer Note */}
          <div className="flex items-start gap-2 p-3 rounded-xl bg-ivory-100/60 dark:bg-espresso-950/60 text-[11px] text-espresso-500 dark:text-espresso-400">
            <Info className="w-4 h-4 shrink-0 text-espresso-400 mt-0.5" />
            <span>
              Estimated daily calorie target — consult a registered dietitian or healthcare provider for medical advice or clinical diets.
            </span>
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
              type="button"
              onClick={handleSave}
              className="flex-1 py-2.5 rounded-xl text-xs font-semibold bg-terracotta-600 hover:bg-terracotta-700 text-white flex items-center justify-center gap-1.5 shadow-sm transition active:scale-[0.98]"
            >
              <Check className="w-4 h-4" />
              Apply Targets
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

