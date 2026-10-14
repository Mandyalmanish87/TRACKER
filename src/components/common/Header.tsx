import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { ThemeToggle } from './ThemeToggle';
import { Button } from './Button';
import { Trash2, Sparkles, Download, Upload, Check } from 'lucide-react';

export const Header: React.FC = () => {
  const { state, clearSampleData, restoreSampleData, exportData, importData } = useApp();
  const [copiedBackup, setCopiedBackup] = useState(false);
  const [showDataMenu, setShowDataMenu] = useState(false);

  // Format today's date in editorial style
  const today = new Date();
  const dateStr = today.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const handleExport = () => {
    const data = exportData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tracker-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setCopiedBackup(true);
    setTimeout(() => setCopiedBackup(false), 2000);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const ok = importData(content);
        if (ok) {
          alert('Backup restored successfully!');
        } else {
          alert('Failed to restore backup: invalid format.');
        }
      }
    };
    reader.readAsText(file);
  };

  return (
    <header className="border-b border-ivory-300 dark:border-espresso-800 bg-white/70 dark:bg-espresso-900/70 backdrop-blur-md sticky top-0 z-30 transition-colors">
      <div className="w-full max-w-[1680px] 2xl:max-w-[1840px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Brand & Editorial Date */}
        <div className="flex items-center gap-4">
          <div className="flex items-baseline gap-1.5">
            <span className="font-serif text-2xl font-bold tracking-tight text-espresso-950 dark:text-ivory-50">
              TRACKER
            </span>
            <span className="w-2 h-2 rounded-full inline-block mb-1" style={{ backgroundColor: 'var(--accent)' }} />
          </div>

          <div className="h-4 w-px bg-ivory-300 dark:bg-espresso-700 hidden sm:block" />

          <p className="text-xs font-serif italic text-espresso-500 dark:text-espresso-400 hidden sm:block">
            {dateStr}
          </p>

          {/* Profile name badge */}
          {state.profile?.displayName?.trim() && (
            <span className="hidden md:inline-flex items-center gap-1.5 text-xs font-medium text-espresso-600 dark:text-espresso-300 bg-ivory-200 dark:bg-espresso-800 rounded-lg px-2.5 py-1">
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--accent)' }} />
              {state.profile.displayName.trim()}
            </span>
          )}
        </div>

        {/* Controls: Data separation banner, export/import, theme toggle */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Sample Data Toggle Banner */}
          {state.hasSampleData ? (
            <div className="flex items-center gap-2 bg-terracotta-50 dark:bg-terracotta-900/30 border border-terracotta-200 dark:border-terracotta-800/60 rounded-xl px-2.5 py-1 text-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-terracotta-500 animate-pulse" />
              <span className="text-terracotta-700 dark:text-terracotta-300 font-medium">
                Demo Records
              </span>
              <button
                onClick={clearSampleData}
                className="text-[11px] underline font-medium text-terracotta-800 dark:text-terracotta-200 hover:text-terracotta-900 ml-1 inline-flex items-center gap-0.5"
                title="Purge sample data and start with an empty slate"
              >
                <Trash2 className="w-3 h-3 inline" />
                Clear
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-sage-50 dark:bg-sage-700/20 border border-sage-200 dark:border-sage-700/50 rounded-xl px-2.5 py-1 text-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-sage-500" />
              <span className="text-sage-700 dark:text-sage-200 font-medium">
                Live Data Mode
              </span>
              <button
                onClick={restoreSampleData}
                className="text-[11px] underline font-medium text-sage-800 dark:text-sage-100 hover:text-sage-900 ml-1 inline-flex items-center gap-0.5"
                title="Reload realistic sample demonstration data"
              >
                <Sparkles className="w-3 h-3 inline" />
                Load Demo
              </button>
            </div>
          )}

          {/* Backup dropdown / buttons */}
          <div className="relative">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowDataMenu(!showDataMenu)}
              title="Backup and Restore Data"
            >
              Data
            </Button>

            {showDataMenu && (
              <div
                className="absolute right-0 mt-2 w-48 bg-white dark:bg-espresso-850 rounded-xl border border-ivory-300 dark:border-espresso-700 shadow-editorial dark:shadow-editorial-dark py-1.5 z-50 text-xs"
                onClick={() => setShowDataMenu(false)}
              >
                <button
                  onClick={handleExport}
                  className="w-full text-left px-3 py-2 flex items-center gap-2 text-espresso-700 dark:text-ivory-200 hover:bg-ivory-100 dark:hover:bg-espresso-800"
                >
                  {copiedBackup ? <Check className="w-3.5 h-3.5 text-sage-600" /> : <Download className="w-3.5 h-3.5" />}
                  Export JSON Backup
                </button>
                <label className="w-full text-left px-3 py-2 flex items-center gap-2 text-espresso-700 dark:text-ivory-200 hover:bg-ivory-100 dark:hover:bg-espresso-800 cursor-pointer">
                  <Upload className="w-3.5 h-3.5" />
                  Restore from JSON
                  <input
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={handleImportFile}
                  />
                </label>
              </div>
            )}
          </div>

          {/* Theme switcher */}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
};
