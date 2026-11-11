import React, { useState, useEffect, useMemo, useRef } from 'react';
import { usePlatform } from '../../hooks/usePlatform';
import { Search, X, Keyboard } from 'lucide-react';

export interface ShortcutItem {
  id: string;
  keys: { ctrlOrCmd?: boolean; alt?: boolean; shift?: boolean; key: string };
  description: string;
  category:
    | 'Global Navigation'
    | 'Dashboard & Today'
    | 'Academics & Timetable'
    | 'Tasks & Events'
    | 'Deep Focus'
    | 'Workouts & Nutrition'
    | 'System & Settings';
}

export const APP_SHORTCUTS: ShortcutItem[] = [
  // Global Navigation
  { id: 'sc-cmd-k', keys: { ctrlOrCmd: true, key: 'k' }, description: 'Open command palette / spotlight search', category: 'Global Navigation' },
  { id: 'sc-shortcuts', keys: { ctrlOrCmd: true, key: '/' }, description: 'Show keyboard shortcuts reference', category: 'Global Navigation' },
  { id: 'sc-settings', keys: { ctrlOrCmd: true, key: ',' }, description: 'Open application settings', category: 'Global Navigation' },
  { id: 'sc-esc', keys: { key: 'Escape' }, description: 'Close active modal, drawer, or palette', category: 'Global Navigation' },

  // Dashboard & Today
  { id: 'sc-nav-today', keys: { alt: true, key: '1' }, description: 'Jump to Today Overview', category: 'Dashboard & Today' },
  { id: 'sc-nav-dayplanner', keys: { alt: true, key: '2' }, description: 'Jump to Day Planner', category: 'Dashboard & Today' },

  // Academics & Timetable
  { id: 'sc-nav-timetable', keys: { alt: true, key: '3' }, description: 'Jump to Timetable & Calendar', category: 'Academics & Timetable' },
  { id: 'sc-nav-attendance', keys: { alt: true, key: '4' }, description: 'Jump to Attendance Tracker', category: 'Academics & Timetable' },
  { id: 'sc-nav-syllabus', keys: { alt: true, key: '5' }, description: 'Jump to Syllabus Tracker', category: 'Academics & Timetable' },
  { id: 'sc-nav-lectures', keys: { alt: true, key: '6' }, description: 'Jump to Lectures', category: 'Academics & Timetable' },

  // Tasks & Events
  { id: 'sc-new-task', keys: { ctrlOrCmd: true, shift: true, key: 'n' }, description: 'Quick create new study task', category: 'Tasks & Events' },
  { id: 'sc-nav-planner', keys: { alt: true, key: '7' }, description: 'Jump to Study Planner', category: 'Tasks & Events' },
  { id: 'sc-nav-events', keys: { alt: true, key: '8' }, description: 'Jump to Events & Tasks', category: 'Tasks & Events' },

  // Deep Focus
  { id: 'sc-nav-focus', keys: { alt: true, key: '9' }, description: 'Open Deep Focus timer', category: 'Deep Focus' },
  { id: 'sc-focus-play', keys: { ctrlOrCmd: true, shift: true, key: 'p' }, description: 'Toggle Focus Radio playback', category: 'Deep Focus' },

  // Workouts & Nutrition
  { id: 'sc-nav-workouts', keys: { alt: true, key: 'w' }, description: 'Jump to Workouts & Split', category: 'Workouts & Nutrition' },
  { id: 'sc-nav-nutrition', keys: { alt: true, key: 'm' }, description: 'Jump to Nutrition & Macros', category: 'Workouts & Nutrition' },

  // System & Settings
  { id: 'sc-toggle-theme', keys: { ctrlOrCmd: true, shift: true, key: 'd' }, description: 'Toggle Dark / Light theme', category: 'System & Settings' },
  { id: 'sc-sync-cloud', keys: { ctrlOrCmd: true, shift: true, key: 's' }, description: 'Trigger immediate cloud sync', category: 'System & Settings' },
];

interface KeyboardShortcutsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KeyboardShortcutsDialog: React.FC<KeyboardShortcutsDialogProps> = ({
  isOpen,
  onClose,
}) => {
  const { isMac, platform, formatKeyCombo, override, setPlatformOverride } = usePlatform();
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const filteredShortcuts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return APP_SHORTCUTS;
    return APP_SHORTCUTS.filter(
      (s) =>
        s.description.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q) ||
        s.keys.key.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  const grouped = useMemo(() => {
    const map = new Map<string, ShortcutItem[]>();
    for (const item of filteredShortcuts) {
      const list = map.get(item.category) || [];
      list.push(item);
      map.set(item.category, list);
    }
    return Array.from(map.entries());
  }, [filteredShortcuts]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-dialog-title"
      className="fixed inset-0 z-[9995] flex items-center justify-center p-4 bg-espresso-950/60 dark:bg-black/70 backdrop-blur-sm animate-in fade-in duration-150"
    >
      <div className="w-full max-w-2xl bg-white dark:bg-[#18151D] rounded-3xl border border-ivory-300 dark:border-white/10 shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-ivory-200 dark:border-white/10 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-ivory-100 dark:bg-white/5 text-espresso-700 dark:text-ivory-200">
              <Keyboard className="w-5 h-5" />
            </div>
            <div>
              <h2
                id="shortcuts-dialog-title"
                className="font-serif text-lg font-bold text-espresso-950 dark:text-ivory-50 tracking-tight"
              >
                Keyboard Shortcuts
              </h2>
              <p className="text-xs text-espresso-500 dark:text-espresso-400">
                Operating System Mode:{' '}
                <span className="font-semibold text-espresso-800 dark:text-ivory-200">
                  {isMac ? 'Apple macOS (⌘)' : 'Windows / Linux (Ctrl)'}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Platform override selector */}
            <select
              value={override}
              onChange={(e) => setPlatformOverride(e.target.value as any)}
              className="text-[11px] font-mono px-2 py-1 rounded-lg border border-ivory-300 dark:border-espresso-700 bg-ivory-50 dark:bg-white/5 text-espresso-700 dark:text-ivory-200 focus:outline-none"
              title="Change keyboard shortcut style"
            >
              <option value="auto">Auto ({platform})</option>
              <option value="mac">macOS (⌘)</option>
              <option value="windows">Windows (Ctrl)</option>
            </select>

            <button
              type="button"
              aria-label="Close shortcuts dialog"
              onClick={onClose}
              className="p-1.5 rounded-xl text-espresso-400 hover:text-espresso-800 dark:hover:text-ivory-100 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Search Input */}
        <div className="p-4 border-b border-ivory-200 dark:border-white/10 bg-ivory-50/60 dark:bg-white/[0.02]">
          <div className="relative">
            <Search className="w-4 h-4 text-espresso-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter shortcuts by name or key..."
              className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-ivory-300 dark:border-white/10 bg-white dark:bg-white/5 text-espresso-950 dark:text-ivory-50 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
          </div>
        </div>

        {/* Shortcuts List */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {grouped.length === 0 ? (
            <div className="text-center py-8 text-espresso-400 dark:text-espresso-500 text-xs">
              No shortcuts found matching "{searchQuery}"
            </div>
          ) : (
            grouped.map(([category, items]) => (
              <div key={category} className="space-y-2.5">
                <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-espresso-400 dark:text-espresso-500">
                  {category}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-3 p-2.5 rounded-xl border border-ivory-200/80 dark:border-white/5 bg-ivory-50/40 dark:bg-white/[0.02] text-xs"
                    >
                      <span className="text-espresso-700 dark:text-ivory-200 truncate">
                        {item.description}
                      </span>
                      <kbd className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white dark:bg-white/10 border border-ivory-300 dark:border-white/15 font-mono text-[11px] font-semibold text-espresso-800 dark:text-ivory-100 shadow-xs shrink-0">
                        {formatKeyCombo(item.keys)}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer info */}
        <div className="p-3.5 border-t border-ivory-200 dark:border-white/10 bg-ivory-50/50 dark:bg-white/[0.02] text-center text-[11px] font-mono text-espresso-500 dark:text-espresso-400">
          Tip: Shortcuts are safely disabled while typing in text inputs or forms.
        </div>
      </div>
    </div>
  );
};
