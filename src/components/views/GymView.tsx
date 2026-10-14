import { GymSplitWidget } from '../dashboard/GymSplitWidget';
import { Card } from '../common/Card';

export const GymView: React.FC = () => {

  return (
    <div className="space-y-6 pb-16">
      <div className="border-b border-ivory-300 dark:border-espresso-800 pb-4">
        <h1 className="font-serif text-3xl font-normal text-espresso-950 dark:text-ivory-50">
          Physical Conditioning & Splits
        </h1>
        <p className="text-xs text-espresso-500 dark:text-espresso-400 mt-1">
          Weekly resistance training routines, working sets, and progressive overload tracking.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)] gap-6 lg:gap-8 items-start">
        <div className="min-w-0">
          <GymSplitWidget />
        </div>

        <div className="min-w-0">
          <Card
            eyebrow="Split Schedule"
            title="Weekly Muscle Group Protocol"
            subtitle="Push / Pull / Legs Hypertrophy Split"
          >
            <div className="space-y-2.5 text-xs">
              {[
                { day: 'Monday', split: 'Push Day (Chest, Shoulders, Triceps)', focus: 'Bench, OHP, Dips' },
                { day: 'Tuesday', split: 'Pull Day (Back, Rear Delts, Biceps)', focus: 'Barbell Rows, Pullups' },
                { day: 'Wednesday', split: 'Legs & Core (Quad dominant)', focus: 'Squats, Romanian Deadlifts' },
                { day: 'Thursday', split: 'Active Recovery & Zone 2 Cardio', focus: 'Mobility, Incline Walk' },
                { day: 'Friday', split: 'Upper Hypertrophy', focus: 'Incline Dumbbell, Lat Pulldowns' },
                { day: 'Saturday', split: 'Lower Hypertrophy & Hamstrings', focus: 'Leg Press, Ham Curls' },
                { day: 'Sunday', split: 'Rest & Nutrition Prep', focus: 'Hydration, Sleep' },
              ].map((item) => (
                <div
                  key={item.day}
                  className="p-2.5 rounded-lg border border-ivory-200 dark:border-espresso-750 bg-white dark:bg-espresso-850 flex items-center justify-between"
                >
                  <div>
                    <span className="font-semibold text-espresso-900 dark:text-ivory-100">
                      {item.day}:
                    </span>{' '}
                    <span className="text-espresso-600 dark:text-espresso-300">{item.split}</span>
                    <p className="text-[10px] text-espresso-400 font-mono mt-0.5">{item.focus}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
