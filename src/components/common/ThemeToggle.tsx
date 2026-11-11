import React from 'react';
import { BookOpen, Laptop, Monitor, Moon, Sun } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useTheme } from '../../theme/ThemeContext';
import { ThemeMode } from '../../types';

export const ThemeToggle: React.FC = () => {
  const { state, updateSettings } = useApp();
  const { mode, setMode } = useTheme();
  const isPaper = state.settings?.appearanceMode === 'digital-paper';
  const options: { mode: ThemeMode; label: string; icon: React.ReactNode }[] = [
    { mode: 'light', label: 'Light', icon: <Sun className="w-3.5 h-3.5" /> },
    { mode: 'dark', label: 'Dark', icon: <Moon className="w-3.5 h-3.5" /> },
    { mode: 'system', label: 'System', icon: <Laptop className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="inline-flex items-center gap-1">
    <div className="inline-flex items-center p-1 bg-ivory-200/80 dark:bg-espresso-800 rounded-xl border border-ivory-300 dark:border-espresso-700">
      {options.map((opt) => <button key={opt.mode} type="button" onClick={() => setMode(opt.mode)} title={`Switch to ${opt.label} theme`} aria-label={opt.label}
        className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium transition-all duration-150 ${mode === opt.mode ? 'bg-white dark:bg-espresso-700 text-espresso-950 dark:text-ivory-50 shadow-subtle' : 'text-espresso-500 dark:text-espresso-400 hover:text-espresso-800 dark:hover:text-ivory-200'}`}>
        {opt.icon}<span className="hidden sm:inline">{opt.label}</span>
      </button>)}
    </div>
    <button type="button" onClick={() => updateSettings({ appearanceMode: isPaper ? 'classic' : 'digital-paper' })}
      aria-label={`Switch to ${isPaper ? 'Classic' : 'Digital Paper'} appearance`} aria-pressed={isPaper}
      title={`Switch to ${isPaper ? 'Classic' : 'Digital Paper'} appearance`}
      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-ivory-300 dark:border-espresso-700 bg-ivory-200/80 dark:bg-espresso-800 text-xs font-medium text-espresso-700 dark:text-ivory-200 transition-colors">
      {isPaper ? <Monitor className="w-3.5 h-3.5" /> : <BookOpen className="w-3.5 h-3.5" />}
      <span className="hidden sm:inline">{isPaper ? 'Classic' : 'Paper'}</span>
    </button>
    </div>
  );
};
