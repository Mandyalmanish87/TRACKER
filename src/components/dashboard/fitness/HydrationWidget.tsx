import React from 'react';
import { useApp } from '../../../context/AppContext';
import { Card } from '../../common/Card';
import { Droplets, Plus } from 'lucide-react';
import { Button } from '../../common/Button';

export const HydrationWidget: React.FC = () => {
  const { state, logHydration, getTodayHydration } = useApp();

  const todayMl = getTodayHydration();
  const targetMl = state.nutritionProfile?.waterTargetMl || 2500;
  const percent = Math.min(100, Math.round((todayMl / targetMl) * 100));

  return (
    <Card
      eyebrow="Hydration"
      title="Daily Water Intake"
      subtitle={`${todayMl.toLocaleString()} / ${targetMl.toLocaleString()} ml consumed`}
    >
      <div className="space-y-4">
        {/* Progress Fill */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="font-semibold text-espresso-900 dark:text-ivory-50 flex items-center gap-1">
              <Droplets className="w-3.5 h-3.5 text-indigo-500" />
              Target Progress
            </span>
            <span className="text-espresso-500">{percent}%</span>
          </div>
          <div className="w-full h-2 rounded-full bg-ivory-200 dark:bg-espresso-750 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-indigo-500 transition-all duration-300"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>

        {/* Quick Add Buttons */}
        <div className="flex items-center gap-2 pt-1">
          <Button
            variant="secondary"
            size="sm"
            className="flex-1 text-xs"
            icon={<Plus className="w-3.5 h-3.5" />}
            onClick={() => logHydration(250)}
          >
            +250 ml (Glass)
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="flex-1 text-xs"
            icon={<Plus className="w-3.5 h-3.5" />}
            onClick={() => logHydration(500)}
          >
            +500 ml (Bottle)
          </Button>
        </div>
      </div>
    </Card>
  );
};

