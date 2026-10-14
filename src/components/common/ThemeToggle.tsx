import React from 'react';
import { Sun, Moon, Laptop } from 'lucide-react';
import { useTheme } from '../../theme/ThemeContext';
import { ThemeMode } from '../../types';

export const ThemeToggle: React.FC = () => {
  const { mode, setMode } = useTheme();

  const options: { mode: ThemeMode; label: string; icon: React.ReactNode }[] = [
    { mode: 'light', label: 'Light', icon: <Sun className="w-3.5 h-3.5" /> },
    { mode: 'dark', label: 'Dark', icon: <Moon className="w-3.5 h-3.5" /> },
    { mode: 'system', label: 'System', icon: <Laptop className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="inline-flex items-center p-1 bg-ivory-200/80 dark:bg-espresso-800 rounded-xl border border-ivory-300 dark:border-espresso-700">
      {options.map((opt) => {
        const isActive = mode === opt.mode;
        return (
          <button
            key={opt.mode}
            onClick={() => setMode(opt.mode)}
            title={`Switch to ${opt.label} theme`}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all duration-150 ${
              isActive
                ? 'bg-white dark:bg-espresso-700 text-espresso-950 dark:text-ivory-50 shadow-subtle'
                : 'text-espresso-500 dark:text-espresso-400 hover:text-espresso-800 dark:hover:text-ivory-200'
            }`}
          >
            {opt.icon}
            <span className="hidden sm:inline">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
};
