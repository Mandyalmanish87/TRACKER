import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { NavTab } from './Navigation';
import { usePlatform } from '../../hooks/usePlatform';
import {
  Search,
  LayoutDashboard,
  Sparkles,
  Calendar,
  Dumbbell,
  Salad,
  Flame,
  GraduationCap,
  BookOpen,
  ListTodo,
  Award,
  Tv,
  Building,
  CheckSquare,
  Settings,
  ArrowRight,
  Sun,
  Moon,
  Plus,
  Play,
  Keyboard,
  RefreshCw,
  Flower2,
} from 'lucide-react';
import { useTheme } from '../../theme/ThemeContext';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTab: (tab: NavTab) => void;
  onOpenShortcuts?: () => void;
}

interface CommandItem {
  id: string;
  title: string;
  subtitle?: string;
  category: 'Navigation' | 'Quick Actions' | 'Academics & Content' | 'Tasks & Reminders' | 'System';
  icon: React.ReactNode;
  action: () => void;
  keywords?: string[];
}

const RECENT_COMMANDS_KEY = 'tracker_recent_commands_v1';

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onSelectTab,
  onOpenShortcuts,
}) => {
  const { state, syncNow } = useApp();
  const { resolvedTheme, setMode } = useTheme();
  const { modKey, isMac } = usePlatform();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentIds, setRecentIds] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const stored = localStorage.getItem(RECENT_COMMANDS_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const recordExecution = useCallback((id: string) => {
    setRecentIds((prev) => {
      const updated = [id, ...prev.filter((i) => i !== id)].slice(0, 5);
      try {
        localStorage.setItem(RECENT_COMMANDS_KEY, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  }, []);

  const commands: CommandItem[] = useMemo(() => {
    const list: CommandItem[] = [
      // Navigation
      {
        id: 'nav-dashboard',
        title: 'Today — Command Center',
        subtitle: 'Overview of day, active classes, streaks & metrics',
        category: 'Navigation',
        icon: <LayoutDashboard className="w-4 h-4 text-terracotta-600" />,
        action: () => { recordExecution('nav-dashboard'); onSelectTab('dashboard'); onClose(); },
        keywords: ['home', 'today', 'briefing', 'main'],
      },
      {
        id: 'nav-dayos',
        title: 'Day Planner — Unified Timeline',
        subtitle: 'Unified schedule blending classes, tasks & intentions',
        category: 'Navigation',
        icon: <Sparkles className="w-4 h-4 text-amber-500" />,
        action: () => { recordExecution('nav-dayos'); onSelectTab('dayos'); onClose(); },
        keywords: ['timeline', 'personal', 'schedule', 'dayos', 'planner'],
      },
      {
        id: 'nav-timetable',
        title: 'Timetable — Academic Schedule & Calendar',
        subtitle: 'Weekly lecture timetable, rooms & instructors',
        category: 'Navigation',
        icon: <Calendar className="w-4 h-4 text-sky-500" />,
        action: () => { recordExecution('nav-timetable'); onSelectTab('timetable'); onClose(); },
        keywords: ['calendar', 'classes', 'lectures', 'timetable', 'schedule'],
      },
      {
        id: 'nav-attendance',
        title: 'Attendance Health Matrix',
        subtitle: 'Subject compliance, skip margins & required threshold',
        category: 'Navigation',
        icon: <GraduationCap className="w-4 h-4 text-sage-600" />,
        action: () => { recordExecution('nav-attendance'); onSelectTab('attendance'); onClose(); },
        keywords: ['bunk', 'classes', 'percentage', '75', 'attendance'],
      },
      {
        id: 'nav-syllabus',
        title: 'Syllabus Tracker & Mastery',
        subtitle: 'Course chapters, topics, subtopics & completion progress',
        category: 'Navigation',
        icon: <BookOpen className="w-4 h-4 text-purple-500" />,
        action: () => { recordExecution('nav-syllabus'); onSelectTab('syllabus'); onClose(); },
        keywords: ['chapters', 'topics', 'exam', 'prep', 'syllabus'],
      },
      {
        id: 'nav-planner',
        title: 'Study Planner & Revision Calendar',
        subtitle: 'Task prioritization, deadlines & study plans',
        category: 'Navigation',
        icon: <ListTodo className="w-4 h-4 text-terracotta-600" />,
        action: () => { recordExecution('nav-planner'); onSelectTab('planner'); onClose(); },
        keywords: ['tasks', 'todo', 'homework', 'planner'],
      },
      {
        id: 'nav-tests',
        title: 'Tests & Error Analytics Ledger',
        subtitle: 'Mock scores, test percentiles & recurring weaknesses',
        category: 'Navigation',
        icon: <Award className="w-4 h-4 text-ochre-600" />,
        action: () => { recordExecution('nav-tests'); onSelectTab('tests'); onClose(); },
        keywords: ['mocks', 'scores', 'mistakes', 'errors', 'tests'],
      },
      {
        id: 'nav-focus',
        title: 'Deep Focus — Cognitive Immersion',
        subtitle: 'Pomodoro timer, focus streaks & study audio',
        category: 'Navigation',
        icon: <Flame className="w-4 h-4 text-amber-500" />,
        action: () => { recordExecution('nav-focus'); onSelectTab('focus'); onClose(); },
        keywords: ['timer', 'study', 'pomodoro', 'radio', 'focus'],
      },
      {
        id: 'nav-gym',
        title: 'Workouts — 3D Anatomy & Training Log',
        subtitle: 'Routines, muscle heatmaps, PRs & progressive overload',
        category: 'Navigation',
        icon: <Dumbbell className="w-4 h-4 text-sky-500" />,
        action: () => { recordExecution('nav-gym'); onSelectTab('gym'); onClose(); },
        keywords: ['gym', 'workout', 'muscle', 'heatmap', 'training', 'iron lab'],
      },
      {
        id: 'nav-nutrition',
        title: 'Nutrition — Macros & Food Diary',
        subtitle: 'Macro distribution, micronutrients, hydration & meals',
        category: 'Navigation',
        icon: <Salad className="w-4 h-4 text-emerald-500" />,
        action: () => { recordExecution('nav-nutrition'); onSelectTab('nutrition'); onClose(); },
        keywords: ['food', 'calories', 'protein', 'macros', 'hydration', 'diet', 'fuel'],
      },
      {
        id: 'nav-bloom',
        title: 'Wellness — Private Cycle & Health Vault',
        subtitle: 'Encrypted hormonal cycles, symptoms & energy mapping',
        category: 'Navigation',
        icon: <Flower2 className="w-4 h-4 text-rose-400" />,
        action: () => { recordExecution('nav-bloom'); onSelectTab('bloom'); onClose(); },
        keywords: ['bloom', 'wellness', 'cycle', 'health'],
      },
      {
        id: 'nav-eduhub',
        title: 'Lectures — Video Learning Hub',
        subtitle: 'Curated playlists, lecture notes & academic video player',
        category: 'Navigation',
        icon: <Tv className="w-4 h-4 text-terracotta-600" />,
        action: () => { recordExecution('nav-eduhub'); onSelectTab('eduhub'); onClose(); },
        keywords: ['youtube', 'lectures', 'video', 'eduhub'],
      },
      ...(state.settings?.userMode === 'class_based'
        ? [
            {
              id: 'nav-classspace',
              title: 'Classroom — Collaborative Workspace',
              subtitle: 'Shared cohort timetables, notes & class channels',
              category: 'Navigation' as const,
              icon: <Building className="w-4 h-4 text-sky-600" />,
              action: () => { recordExecution('nav-classspace'); onSelectTab('classspace'); onClose(); },
              keywords: ['cohort', 'class', 'batch', 'group', 'classspace'],
            },
          ]
        : []),
      {
        id: 'nav-reminders',
        title: 'Events & Tasks — Timeline Calendar',
        subtitle: 'Deadlines, calendar milestones & scheduled alerts',
        category: 'Navigation',
        icon: <CheckSquare className="w-4 h-4 text-sage-600" />,
        action: () => { recordExecution('nav-reminders'); onSelectTab('reminders'); onClose(); },
        keywords: ['deadlines', 'events', 'calendar', 'reminders'],
      },
      {
        id: 'nav-settings',
        title: 'Settings & Appearance Preferences',
        subtitle: 'Theme, accent colors, dashboard layout, platform shortcuts & data export',
        category: 'Navigation',
        icon: <Settings className="w-4 h-4 text-espresso-600 dark:text-ivory-300" />,
        action: () => { recordExecution('nav-settings'); onSelectTab('settings'); onClose(); },
        keywords: ['theme', 'dark mode', 'color', 'backup', 'export', 'settings'],
      },

      // Quick Actions
      {
        id: 'action-open-shortcuts',
        title: 'Show Keyboard Shortcuts Reference',
        subtitle: `Browse all global ${modKey} shortcuts and hotkeys`,
        category: 'Quick Actions',
        icon: <Keyboard className="w-4 h-4 text-sky-500" />,
        action: () => {
          recordExecution('action-open-shortcuts');
          onClose();
          onOpenShortcuts?.();
        },
        keywords: ['shortcuts', 'hotkeys', 'keyboard', 'help'],
      },
      {
        id: 'action-start-focus',
        title: 'Start 25m Deep Focus Session',
        subtitle: 'Jump immediately into a distraction-free study session',
        category: 'Quick Actions',
        icon: <Play className="w-4 h-4 text-amber-500" />,
        action: () => { recordExecution('action-start-focus'); onSelectTab('focus'); onClose(); },
        keywords: ['timer', 'start', 'pomodoro', 'focus'],
      },
      {
        id: 'action-toggle-theme',
        title: `Switch to ${resolvedTheme === 'dark' ? 'Light' : 'Dark'} Mode`,
        subtitle: 'Toggle between Ivory light and Obsidian dark surfaces',
        category: 'Quick Actions',
        icon: resolvedTheme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-sky-400" />,
        action: () => {
          recordExecution('action-toggle-theme');
          setMode(resolvedTheme === 'dark' ? 'light' : 'dark');
          onClose();
        },
        keywords: ['theme', 'mode', 'night', 'dark', 'light'],
      },
      {
        id: 'action-cloud-sync',
        title: 'Sync Now with Cloud',
        subtitle: 'Initiate immediate cloud backup and pull latest changes',
        category: 'Quick Actions',
        icon: <RefreshCw className="w-4 h-4 text-emerald-500" />,
        action: () => {
          recordExecution('action-cloud-sync');
          syncNow();
          onClose();
        },
        keywords: ['sync', 'cloud', 'backup', 'refresh'],
      },
      {
        id: 'action-new-task',
        title: 'Create New Study Task',
        subtitle: 'Add a new deadline or homework item to planner',
        category: 'Quick Actions',
        icon: <Plus className="w-4 h-4 text-terracotta-600" />,
        action: () => {
          recordExecution('action-new-task');
          onSelectTab('planner');
          onClose();
        },
        keywords: ['task', 'new', 'add', 'todo'],
      },
    ];

    // Inject registered Subjects
    (state.subjects || []).forEach((subject) => {
      const pct = subject.totalConducted > 0 ? Math.round((subject.attended / subject.totalConducted) * 100) : 0;
      list.push({
        id: `subject-${subject.id}`,
        title: `${subject.name} (${subject.code})`,
        subtitle: `Attendance: ${pct}% · Target: ${subject.targetPct}%`,
        category: 'Academics & Content',
        icon: <GraduationCap className="w-4 h-4" style={{ color: subject.color || 'var(--accent)' }} />,
        action: () => {
          recordExecution(`subject-${subject.id}`);
          onSelectTab('attendance');
          onClose();
        },
        keywords: [subject.name.toLowerCase(), subject.code.toLowerCase(), 'subject', 'course'],
      });
    });

    // Inject active Tasks
    (state.tasks || []).slice(0, 10).forEach((task) => {
      list.push({
        id: `task-${task.id}`,
        title: task.title,
        subtitle: `Priority: ${task.priority.toUpperCase()} · Status: ${task.status}`,
        category: 'Tasks & Reminders',
        icon: <CheckSquare className="w-4 h-4 text-espresso-400" />,
        action: () => {
          recordExecution(`task-${task.id}`);
          onSelectTab('planner');
          onClose();
        },
        keywords: [task.title.toLowerCase(), 'task', task.priority],
      });
    });

    return list;
  }, [state.settings?.userMode, state.subjects, state.tasks, resolvedTheme, onSelectTab, onClose, setMode, syncNow, onOpenShortcuts, modKey, recordExecution]);

  // Filter based on search query
  const filteredCommands = useMemo(() => {
    if (!query.trim()) {
      // If query is empty, sort recently used items to the top!
      if (recentIds.length > 0) {
        const recentMap = new Map(recentIds.map((id, index) => [id, index]));
        return [...commands].sort((a, b) => {
          const rankA = recentMap.has(a.id) ? recentMap.get(a.id)! : 999;
          const rankB = recentMap.has(b.id) ? recentMap.get(b.id)! : 999;
          return rankA - rankB;
        });
      }
      return commands;
    }

    const q = query.toLowerCase().trim();
    return commands.filter((cmd) => {
      const matchTitle = cmd.title.toLowerCase().includes(q);
      const matchSubtitle = cmd.subtitle?.toLowerCase().includes(q);
      const matchKeywords = cmd.keywords?.some((k) => k.includes(q));
      return matchTitle || matchSubtitle || matchKeywords;
    });
  }, [commands, query, recentIds]);

  // Keyboard navigation within results
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredCommands.length));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % Math.max(1, filteredCommands.length));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const active = filteredCommands[selectedIndex];
        if (active) {
          active.action();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredCommands, selectedIndex, onClose]);

  // Group filtered commands by category
  const groupedCommands = useMemo(() => {
    const groups: Record<string, CommandItem[]> = {};
    filteredCommands.forEach((cmd) => {
      if (!groups[cmd.category]) groups[cmd.category] = [];
      groups[cmd.category].push(cmd);
    });
    return groups;
  }, [filteredCommands]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Spotlight Command Palette"
      className="fixed inset-0 z-[9990] flex items-start justify-center pt-[10vh] sm:pt-[12vh] px-4 bg-espresso-950/60 dark:bg-black/75 backdrop-blur-md animate-in fade-in duration-150"
    >
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

      <div className="relative w-full max-w-xl bg-white/95 dark:bg-[#14121A]/95 border border-ivory-300/80 dark:border-white/10 rounded-2xl shadow-2xl backdrop-blur-2xl overflow-hidden flex flex-col max-h-[75vh] z-10">
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-ivory-200/80 dark:border-white/10 bg-ivory-50/70 dark:bg-white/[0.03]">
          <Search className="w-5 h-5 text-espresso-400 dark:text-espresso-500 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Type a command, course, task or destination... (↑↓ to select)"
            className="w-full text-xs sm:text-sm bg-transparent text-espresso-950 dark:text-ivory-50 placeholder:text-espresso-400 dark:placeholder:text-espresso-500 focus:outline-none"
          />
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-2 py-0.5 text-[10px] font-mono text-espresso-400 dark:text-espresso-500 bg-ivory-200/80 dark:bg-white/10 border border-ivory-300 dark:border-white/10 rounded-md">
            {isMac ? '⎋ ESC' : 'ESC'}
          </kbd>
        </div>

        {/* Results List */}
        <div ref={listRef} className="overflow-y-auto p-2 space-y-4 flex-1">
          {filteredCommands.length === 0 ? (
            <div className="p-8 text-center text-xs text-espresso-400 dark:text-espresso-500">
              No matching commands or destinations found for "{query}".
            </div>
          ) : (
            Object.entries(groupedCommands).map(([category, items]) => (
              <div key={category} className="space-y-1">
                <span className="px-3 text-[10px] font-mono font-bold uppercase tracking-wider text-espresso-400 dark:text-espresso-500">
                  {category}
                </span>

                <div className="space-y-0.5">
                  {items.map((item) => {
                    const isSelected = filteredCommands[selectedIndex]?.id === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={item.action}
                        onMouseEnter={() => {
                          const idx = filteredCommands.findIndex((c) => c.id === item.id);
                          if (idx !== -1) setSelectedIndex(idx);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left transition cursor-pointer text-xs ${
                          isSelected
                            ? 'bg-ivory-200/80 dark:bg-white/10 text-espresso-950 dark:text-ivory-50 font-medium'
                            : 'text-espresso-700 dark:text-ivory-300 hover:bg-ivory-100 dark:hover:bg-white/5'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="p-1.5 rounded-lg bg-ivory-100 dark:bg-white/5 shrink-0">
                            {item.icon}
                          </div>
                          <div className="min-w-0">
                            <span className="block truncate font-medium text-espresso-950 dark:text-ivory-100">
                              {item.title}
                            </span>
                            {item.subtitle && (
                              <span className="block truncate text-[11px] text-espresso-400 dark:text-espresso-500">
                                {item.subtitle}
                              </span>
                            )}
                          </div>
                        </div>

                        {isSelected && (
                          <ArrowRight className="w-3.5 h-3.5 text-terracotta-600 dark:text-terracotta-400 shrink-0 ml-2" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer Shortcut Bar */}
        <div className="px-4 py-2.5 border-t border-ivory-200 dark:border-white/10 bg-ivory-50/80 dark:bg-white/[0.02] flex items-center justify-between text-[11px] text-espresso-400 dark:text-espresso-500">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="font-mono bg-ivory-200/80 dark:bg-white/10 px-1 rounded text-[10px]">↑↓</kbd> navigate
            </span>
            <span>
              <kbd className="font-mono bg-ivory-200/80 dark:bg-white/10 px-1 rounded text-[10px]">↵</kbd> select
            </span>
          </div>
          <span className="font-mono text-[10.5px]">
            {filteredCommands.length} commands available
          </span>
        </div>
      </div>
    </div>
  );
};
