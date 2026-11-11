import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  calculateAdaptiveTDEE,
  calculateSmartRecalibration,
} from '../../utils/smartNutritionEngine';
import { Sparkles, Check, ArrowRight } from 'lucide-react';
import { Button } from '../common/Button';

export const SmartRecalibrationCard: React.FC = () => {
  const { state, updateNutritionProfile } = useApp();
  const [isApplied, setIsApplied] = useState(false);

  const profile = state.nutritionProfile;

  // Calculate empirical TDEE based on rolling weight + intake data
  const adaptiveResult = useMemo(() => {
    return calculateAdaptiveTDEE(
      state.weightLogs || [],
      state.foodDiaryEntries || [],
      profile?.calculatedTdee || 2200
    );
  }, [state.weightLogs, state.foodDiaryEntries, profile?.calculatedTdee]);

  const recalibration = useMemo(() => {
    if (!profile) return null;
    return calculateSmartRecalibration(
      adaptiveResult,
      profile,
      state.weightLogs || [],
      state.foodDiaryEntries || []
    );
  }, [adaptiveResult, profile, state.weightLogs, state.foodDiaryEntries]);

  if (!recalibration || !profile) return null;

  const currentCal = profile.targetCalories || 2200;
  const recommendedCal = recalibration.recommendedTargetCalories;
  const isAdjustmentNeeded = Math.abs(recommendedCal - currentCal) >= 50;

  const handleApply = () => {
    updateNutritionProfile({
      calculatedTdee: adaptiveResult.estimatedTdee,
      targetCalories: recalibration.recommendedTargetCalories,
      macroTargets: recalibration.recommendedMacros,
    });
    setIsApplied(true);
    setTimeout(() => setIsApplied(false), 3000);
  };

  return (
    <div className="p-5 rounded-2xl border border-ivory-200 dark:border-espresso-750 bg-white dark:bg-espresso-850 shadow-subtle space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-ochre-100 dark:bg-ochre-900/40 text-ochre-700 dark:text-ochre-300 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-base text-espresso-950 dark:text-ivory-50">
                Adaptive TDEE &amp; Smart Recalibration
              </h3>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-ochre-100 dark:bg-ochre-950/40 text-ochre-800 dark:text-ochre-200 font-semibold">
                {adaptiveResult.confidenceLevel} confidence
              </span>
            </div>
            <p className="text-xs text-espresso-500 dark:text-espresso-400 mt-0.5">
              Empirical expenditure calculated from {adaptiveResult.dataPointsCount} days of logged calories and scale weight
            </p>
          </div>
        </div>
      </div>

      {/* Recalibration Metrics Comparison */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-xl bg-ivory-50/70 dark:bg-espresso-800/40 border border-ivory-200 dark:border-espresso-750">
        <div>
          <span className="text-[11px] font-mono uppercase text-espresso-400">
            Empirical Maintenance (TDEE)
          </span>
          <p className="text-lg font-bold font-mono text-espresso-900 dark:text-ivory-50 mt-0.5">
            {adaptiveResult.estimatedTdee.toLocaleString()} <span className="text-xs font-normal text-espresso-500">kcal/day</span>
          </p>
          <p className="text-[11px] text-espresso-400 font-mono mt-0.5">
            Formula Mifflin-St Jeor estimate: {profile.calculatedTdee || 2200} kcal
          </p>
        </div>

        <div>
          <span className="text-[11px] font-mono uppercase text-espresso-400">
            Recommended Daily Calorie Target
          </span>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="font-mono text-base text-espresso-400 line-through">
              {currentCal} kcal
            </span>
            <ArrowRight className="w-4 h-4 text-terracotta-500" />
            <span className="font-mono text-lg font-bold text-terracotta-600 dark:text-terracotta-400">
              {recommendedCal} kcal
            </span>
          </div>
          <p className="text-[11px] text-espresso-400 font-mono mt-0.5">
            Aligned with goal: <span className="capitalize font-semibold text-espresso-700 dark:text-ivory-200">{profile.goal}</span>
          </p>
        </div>
      </div>

      {/* Rationale & Safety Floor */}
      <div className="p-3.5 rounded-xl border border-ivory-200 dark:border-espresso-750 bg-white dark:bg-espresso-900 text-xs text-espresso-600 dark:text-espresso-300 space-y-1">
        <p className="font-semibold text-espresso-900 dark:text-ivory-100">
          Engine Recommendation Rationale:
        </p>
        <p>{recalibration.reasoning}</p>
        <p className="text-[11px] text-espresso-400 font-mono pt-1">
          ✓ Enforces 1,200 kcal safety metabolic floor to prevent endocrine suppression.
        </p>
      </div>

      {/* Action CTA */}
      <div className="flex items-center justify-between pt-1">
        {isApplied ? (
          <span className="text-xs font-semibold text-sage-600 dark:text-sage-400 flex items-center gap-1.5 font-mono">
            <Check className="w-4 h-4" /> Targets successfully updated!
          </span>
        ) : (
          <span className="text-xs text-espresso-400">
            {isAdjustmentNeeded
              ? 'New target calibrated from recent metabolic rate.'
              : 'Current targets closely track your empirical expenditure.'}
          </span>
        )}

        {isAdjustmentNeeded && !isApplied && (
          <Button
            variant="primary"
            size="sm"
            icon={<Check className="w-4 h-4" />}
            onClick={handleApply}
          >
            Apply Recalibration
          </Button>
        )}
      </div>
    </div>
  );
};
