import React from 'react';
import { useApp } from '../../../context/AppContext';
import { Card } from '../../common/Card';

export const BodyCompositionWidget: React.FC = () => {
  const { state } = useApp();

  const latestComp = (state.bodyCompositions || [])[0];
  const latestWeight = (state.weightLogs || [])[0]?.weightKg || state.nutritionProfile?.weightKg || 70;

  return (
    <Card
      eyebrow="Body OS"
      title="Body Composition"
      subtitle="Weight and Navy anthropometric estimates"
    >
      <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono">
        <div className="p-2.5 rounded-xl bg-ivory-50 dark:bg-espresso-800/40 border border-ivory-200 dark:border-espresso-700">
          <span className="text-[10px] text-espresso-400 uppercase">Weight</span>
          <p className="font-bold text-espresso-900 dark:text-ivory-100 text-sm mt-0.5">
            {latestWeight} <span className="text-[10px] font-normal text-espresso-400">kg</span>
          </p>
        </div>

        <div className="p-2.5 rounded-xl bg-ivory-50 dark:bg-espresso-800/40 border border-ivory-200 dark:border-espresso-700">
          <span className="text-[10px] text-terracotta-600 dark:text-terracotta-400 uppercase">Body Fat</span>
          <p className="font-bold text-terracotta-600 dark:text-terracotta-400 text-sm mt-0.5">
            {latestComp ? `${latestComp.bodyFatPercentage}%` : '--'}
          </p>
        </div>

        <div className="p-2.5 rounded-xl bg-ivory-50 dark:bg-espresso-800/40 border border-ivory-200 dark:border-espresso-700">
          <span className="text-[10px] text-sage-600 dark:text-sage-400 uppercase">Lean Mass</span>
          <p className="font-bold text-sage-600 dark:text-sage-400 text-sm mt-0.5">
            {latestComp ? `${latestComp.leanMassKg}kg` : '--'}
          </p>
        </div>
      </div>
    </Card>
  );
};

