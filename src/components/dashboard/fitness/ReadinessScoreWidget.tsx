import React, { useMemo } from 'react';
import { useApp } from '../../../context/AppContext';
import { Card } from '../../common/Card';
import { calculateDailyReadiness } from '../../../utils/readinessEngine';

export const ReadinessScoreWidget: React.FC = () => {
  const { state } = useApp();
  const todayStr = new Date().toISOString().split('T')[0];

  const todayRecovery = useMemo(() => {
    return (state.sleepRecoveryLogs || []).find((s) => s.date === todayStr);
  }, [state.sleepRecoveryLogs, todayStr]);

  const readiness = useMemo(() => {
    if (todayRecovery) {
      return calculateDailyReadiness(todayRecovery);
    }
    return {
      readinessScore: 82,
      tier: 'optimal' as const,
      headline: 'System primed for training',
      recommendation: 'Log morning check-in to calibrate your exact daily readiness score.',
      disclaimer: 'Calculated using sleep and autonomic recovery parameters.',
    };
  }, [todayRecovery]);

  return (
    <Card
      eyebrow="Recovery & Sleep"
      title="Daily Readiness Index"
      subtitle={readiness.headline}
    >
      <div className="flex items-center gap-4">
        <div
          className={`w-14 h-14 rounded-2xl flex items-center justify-center font-mono text-xl font-bold shrink-0 ${
            readiness.tier === 'optimal'
              ? 'bg-sage-100 dark:bg-sage-900/40 text-sage-600 dark:text-sage-400'
              : readiness.tier === 'moderate'
              ? 'bg-ochre-100 dark:bg-ochre-900/40 text-ochre-600 dark:text-ochre-400'
              : 'bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400'
          }`}
        >
          {readiness.readinessScore}
        </div>
        <div className="min-w-0">
          <p className="text-xs text-espresso-600 dark:text-espresso-300 line-clamp-2">
            {readiness.recommendation}
          </p>
          {todayRecovery && (
            <p className="text-[11px] font-mono text-espresso-400 mt-1">
              Sleep: {Math.round(todayRecovery.sleepDurationMinutes / 60)}h logged
            </p>
          )}
        </div>
      </div>
    </Card>
  );
};

