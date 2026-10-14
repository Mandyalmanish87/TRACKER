import { RemindersWidget } from '../dashboard/RemindersWidget';
import { useApp } from '../../context/AppContext';

export const RemindersView: React.FC = () => {
  const { state } = useApp();

  const total = state.reminders.length;
  const completed = state.reminders.filter((r) => r.isCompleted).length;
  const pending = total - completed;

  return (
    <div className="space-y-6 pb-16">
      <div className="border-b border-ivory-300 dark:border-espresso-800 pb-4">
        <h1 className="font-serif text-3xl font-normal text-espresso-950 dark:text-ivory-50">
          Reminders & Action Items
        </h1>
        <p className="text-xs text-espresso-500 dark:text-espresso-400 mt-1">
          {pending} pending, {completed} completed across academic, fitness, and personal pillars.
        </p>
      </div>

      <div className="max-w-4xl mx-auto">
        <RemindersWidget />
      </div>
    </div>
  );
};
