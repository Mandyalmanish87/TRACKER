import React, { useState, useRef, useEffect } from 'react';
import {
  LayoutDashboard,
  Calendar,
  GraduationCap,
  BookOpen,
  Flame,
  Dumbbell,
  Salad,
  Settings,
  ListTodo,
  Award,
  Building,
  Tv,
  Sparkles,
  ChevronDown,
  Flower2,
  Menu,
  X,
  PanelLeftClose,
  PanelLeft,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useApp } from '../../context/AppContext';
import { useOptionalClassSpace } from '../../context/ClassSpaceContext';
import { isTaskOverdue } from '../../utils/plannerUtils';
import { detectRecurringWeaknesses } from '../../utils/testAnalytics';

export type NavTab =
  | 'dashboard'
  | 'dayos'
  | 'timetable'
  | 'attendance'
  | 'syllabus'
  | 'planner'
  | 'tests'
  | 'focus'
  | 'gym'
  | 'reminders'
  | 'nutrition'
  | 'bloom'
  | 'eduhub'
  | 'classspace'
  | 'settings'
  | 'admin';

interface NavigationProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
}

export interface MyOrbitItem {
  id: 'dayos' | 'gym' | 'nutrition' | 'bloom';
  label: string;
  subtitle: string;
  icon: React.ReactNode;
  srOnly?: string[];
}

export const MY_ORBIT_ITEMS: MyOrbitItem[] = [
  {
    id: 'dayos',
    label: 'Day Planner',
    subtitle: 'Timeline & Intentions',
    icon: <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />,
    srOnly: ['DayOS', 'Day Planner', 'Daily Timeline'],
  },
  {
    id: 'gym',
    label: 'Workouts',
    subtitle: 'Routines, PRs & Anatomy',
    icon: <Dumbbell className="w-4 h-4 text-sky-500 shrink-0" />,
    srOnly: ['Gym', 'Gym & Split', 'Workouts', 'Iron Lab'],
  },
  {
    id: 'nutrition',
    label: 'Nutrition',
    subtitle: 'Macros, Meals & Diary',
    icon: <Salad className="w-4 h-4 text-emerald-500 shrink-0" />,
    srOnly: ['Nutrition', 'Fuel OS'],
  },
  {
    id: 'bloom',
    label: 'Wellness',
    subtitle: 'Private Health & Cycles',
    icon: <Flower2 className="w-4 h-4 text-rose-400 shrink-0" />,
    srOnly: ['Bloom', 'Wellness', 'Cycle Wellness'],
  },
];

// Preserved for backward-compatibility with any external imports
export const PERSONAL_SPACE_TABS = MY_ORBIT_ITEMS;

export const Navigation: React.FC<NavigationProps> = ({ currentTab, onSelectTab }) => {
  const { state } = useApp();
  const classSpace = useOptionalClassSpace();

  const [isOrbitMenuOpen, setIsOrbitMenuOpen] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [isCompactNav, setIsCompactNav] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('tracker_nav_compact') === 'true';
  });

  const toggleCompactNav = () => {
    setIsCompactNav((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('tracker_nav_compact', String(next));
      } catch {}
      return next;
    });
  };

  const orbitMenuRef = useRef<HTMLDivElement>(null);
  const orbitBtnRef = useRef<HTMLButtonElement>(null);

  const isClassBased = state.settings?.userMode === 'class_based';
  const hasClassSpace = isClassBased;

  const isMyOrbitActive =
    currentTab === 'dayos' ||
    currentTab === 'gym' ||
    currentTab === 'nutrition' ||
    currentTab === 'bloom';

  useEffect(() => {
    setIsOrbitMenuOpen(isMyOrbitActive);
  }, [isMyOrbitActive]);

  const activeOrbitItem = MY_ORBIT_ITEMS.find((item) => item.id === currentTab);

  const toggleOrbitMenu = () => {
    setIsOrbitMenuOpen((open) => !open);
  };

  // Close menu on click outside or Escape
  useEffect(() => {
    if (!isOrbitMenuOpen) return;

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (
        orbitMenuRef.current &&
        !orbitMenuRef.current.contains(e.target as Node) &&
        orbitBtnRef.current &&
        !orbitBtnRef.current.contains(e.target as Node)
      ) {
        setIsOrbitMenuOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOrbitMenuOpen(false);
        orbitBtnRef.current?.focus();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOrbitMenuOpen]);

  // Compute live contextual badges
  const pendingRemindersCount = state.reminders.filter((r) => !r.isCompleted).length;
  const todayDow = (() => {
    const d = new Date().getDay();
    return d === 0 ? 7 : d;
  })();
  const todayClassesCount = isClassBased && classSpace?.activeWorkspace
    ? (classSpace.rules || []).filter((r) => r.dayOfWeek === todayDow).length
    : (state.timetable || []).filter((t) => t.dayOfWeek === todayDow).length;
  const atRiskCount = state.subjects.filter((s) => {
    if (s.totalConducted === 0) return false;
    return (s.attended / s.totalConducted) * 100 < s.targetPct;
  }).length;
  const pendingTasksCount = (state.tasks || []).filter((t) => t.status !== 'done').length;
  const overdueTasksCount = (state.tasks || []).filter((t) => isTaskOverdue(t)).length;
  const recurringWeaknessCount = detectRecurringWeaknesses(state.errorLogs || []).filter((w) => w.isRecurring).length;

  const academicTabs: {
    id: NavTab;
    label: string;
    icon: React.ReactNode;
    badge?: number;
    badgeVariant?: 'sage' | 'danger' | 'neutral';
  }[] = [
    {
      id: 'dashboard',
      label: 'Today',
      icon: <LayoutDashboard className="w-4 h-4" />,
    },
    {
      id: 'timetable',
      label: 'Timetable',
      icon: <Calendar className="w-4 h-4" />,
      badge: todayClassesCount > 0 ? todayClassesCount : undefined,
      badgeVariant: 'neutral',
    },
    {
      id: 'attendance',
      label: 'Attendance',
      icon: <GraduationCap className="w-4 h-4" />,
      badge: atRiskCount > 0 ? atRiskCount : undefined,
      badgeVariant: 'danger',
    },
    {
      id: 'syllabus',
      label: 'Syllabus',
      icon: <BookOpen className="w-4 h-4" />,
    },
    {
      id: 'planner',
      label: 'Planner',
      icon: <ListTodo className="w-4 h-4" />,
      badge: pendingTasksCount > 0 ? pendingTasksCount : undefined,
      badgeVariant: overdueTasksCount > 0 ? 'danger' : 'neutral',
    },
    {
      id: 'tests',
      label: 'Tests & Errors',
      icon: <Award className="w-4 h-4" />,
      badge: recurringWeaknessCount > 0 ? recurringWeaknessCount : undefined,
      badgeVariant: 'danger',
    },
    {
      id: 'focus',
      label: 'Deep Focus',
      icon: <Flame className="w-4 h-4" />,
    },
    {
      id: 'reminders',
      label: 'Events & Tasks',
      icon: <Calendar className="w-4 h-4" />,
      badge: pendingRemindersCount > 0 ? pendingRemindersCount : undefined,
      badgeVariant: 'neutral',
    },
    {
      id: 'eduhub',
      label: 'Lectures',
      icon: <Tv className="w-4 h-4" />,
    },
    ...(hasClassSpace
      ? [
          {
            id: 'classspace' as NavTab,
            label: 'Classroom',
            icon: <Building className="w-4 h-4" />,
          },
        ]
      : []),
  ];

  return (
    <div className="sticky top-[57px] sm:top-[61px] z-20 px-2 sm:px-4 lg:px-6 xl:px-8 py-2 pointer-events-none">
      <div className={`pointer-events-auto w-full max-w-[1680px] 2xl:max-w-[1840px] mx-auto spatial-glass-dock rounded-2xl transition-all duration-200 relative ${isOrbitMenuOpen ? 'orbit-nav-expanded' : ''}`}>
        {/* Primary Horizontal Spatial Navigation Rail */}
        <nav className="overflow-x-auto no-scrollbar px-2 py-1.5">
          <div className="flex items-center gap-1 sm:gap-1.5">
            {/* Academic & University Tabs */}
            {academicTabs.map((tab) => {
              const isActive = currentTab === tab.id;
              return (
                <motion.button
                  key={tab.id}
                  aria-label={
                    tab.id === 'classspace'
                      ? 'Classroom Hub'
                      : tab.id === 'timetable'
                      ? 'Timetable'
                      : tab.label
                  }
                  onClick={() => {
                    setIsOrbitMenuOpen(false);
                    onSelectTab(tab.id);
                  }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={`relative flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-1.5 rounded-xl text-xs sm:text-[13px] font-medium whitespace-nowrap shrink-0 transition-all duration-150 cursor-pointer select-none ${
                    isActive
                      ? 'text-white shadow-xs font-semibold'
                      : 'text-espresso-600 dark:text-espresso-300 hover:text-espresso-950 dark:hover:text-ivory-50 hover:bg-ivory-200/50 dark:hover:bg-white/5'
                  }`}
                  style={isActive ? { backgroundColor: 'var(--accent)' } : undefined}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeNavTabIndicator"
                      className="absolute inset-0 rounded-xl shadow-xs -z-10"
                      style={{ backgroundColor: 'var(--accent)' }}
                      transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                    />
                  )}

                  <span className="relative z-10 flex items-center gap-1.5 sm:gap-2">
                    <span className="shrink-0">{tab.icon}</span>
                    <span>{tab.label}</span>
                    {tab.id === 'reminders' && <span className="sr-only">Reminders</span>}
                    {tab.id === 'eduhub' && <span className="sr-only">EduHub</span>}
                    {tab.id === 'classspace' && <span className="sr-only">ClassSpace</span>}
                    {tab.badge !== undefined && (
                      <span
                        className={`text-[10px] sm:text-[11px] font-mono tabular-nums px-1.5 py-0.5 rounded-full font-semibold leading-none ${
                          isActive
                            ? 'bg-white/25 text-white'
                            : tab.badgeVariant === 'danger'
                            ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                            : 'bg-ivory-300 dark:bg-espresso-750 text-espresso-700 dark:text-ivory-200'
                        }`}
                      >
                        {tab.badge}
                      </span>
                    )}
                  </span>
                </motion.button>
              );
            })}

            {/* My Space Suite Selection Menu Trigger (Houses Day Planner, Workouts, Nutrition, Wellness) */}
            <div className="relative shrink-0">
              <motion.button
                ref={orbitBtnRef}
                type="button"
                aria-label="My Orbit Menu"
                aria-haspopup="true"
                aria-controls="my-orbit-menu"
                aria-expanded={isOrbitMenuOpen}
                onClick={toggleOrbitMenu}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`relative flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-1.5 rounded-xl text-xs sm:text-[13px] font-medium whitespace-nowrap shrink-0 transition-all duration-150 cursor-pointer select-none ${
                  isMyOrbitActive
                    ? 'text-white shadow-xs font-semibold'
                    : 'text-espresso-600 dark:text-espresso-300 hover:text-espresso-950 dark:hover:text-ivory-50 hover:bg-ivory-200/50 dark:hover:bg-white/5'
                }`}
                style={isMyOrbitActive ? { backgroundColor: 'var(--accent)' } : undefined}
              >
                {isMyOrbitActive && (
                  <motion.div
                    layoutId="activeNavTabIndicator"
                    className="absolute inset-0 rounded-xl shadow-xs -z-10"
                    style={{ backgroundColor: 'var(--accent)' }}
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  />
                )}

                <span className="relative z-10 flex items-center gap-1.5 sm:gap-2">
                  <Sparkles className="w-4 h-4 shrink-0 text-amber-500" />
                  <span>My Space</span>
                  <span className="sr-only">My Orbit</span>
                  {isMyOrbitActive && activeOrbitItem && (
                    <span className="hidden xl:inline-block text-[11px] font-mono opacity-90 pl-0.5">
                      · {activeOrbitItem.label}
                    </span>
                  )}
                  <ChevronDown
                    className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 ${
                      isOrbitMenuOpen ? 'rotate-180' : 'rotate-0'
                    }`}
                  />
                </span>
              </motion.button>

            </div>

            {/* Settings Tab */}
            <motion.button
              key="settings"
              aria-label="Settings"
              onClick={() => {
                setIsOrbitMenuOpen(false);
                onSelectTab('settings');
              }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`relative flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-1.5 rounded-xl text-xs sm:text-[13px] font-medium whitespace-nowrap shrink-0 transition-all duration-150 cursor-pointer select-none ${
                currentTab === 'settings'
                  ? 'text-white shadow-xs font-semibold'
                  : 'text-espresso-600 dark:text-espresso-300 hover:text-espresso-950 dark:hover:text-ivory-50 hover:bg-ivory-200/50 dark:hover:bg-white/5'
              }`}
              style={currentTab === 'settings' ? { backgroundColor: 'var(--accent)' } : undefined}
            >
              {currentTab === 'settings' && (
                <motion.div
                  layoutId="activeNavTabIndicator"
                  className="absolute inset-0 rounded-xl shadow-xs -z-10"
                  style={{ backgroundColor: 'var(--accent)' }}
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-1.5 sm:gap-2">
                <Settings className="w-4 h-4 shrink-0" />
                <span>Settings</span>
              </span>
            </motion.button>

            {/* Desktop Compact Rail Toggle */}
            <button
              type="button"
              onClick={toggleCompactNav}
              title={isCompactNav ? 'Expand navigation labels' : 'Compact navigation view'}
              aria-label={isCompactNav ? 'Expand navigation' : 'Compact navigation'}
              className="hidden xl:inline-flex items-center justify-center p-1.5 rounded-xl text-espresso-400 hover:text-espresso-700 dark:hover:text-ivory-200 hover:bg-ivory-200/50 dark:hover:bg-white/5 transition cursor-pointer shrink-0 ml-auto"
            >
              {isCompactNav ? <PanelLeft className="w-3.5 h-3.5" /> : <PanelLeftClose className="w-3.5 h-3.5" />}
            </button>

            {/* Mobile Drawer Trigger (Visible on small screens) */}
            <button
              type="button"
              onClick={() => setIsMobileDrawerOpen(true)}
              aria-label="Open mobile navigation drawer"
              className="md:hidden flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-espresso-700 dark:text-ivory-200 bg-ivory-200/60 dark:bg-white/10 hover:bg-ivory-300 transition cursor-pointer shrink-0 ml-auto"
            >
              <Menu className="w-4 h-4" />
              <span>Menu</span>
            </button>
          </div>
        </nav>

        {/* Accessible screen-reader and test anchors for lifestyle and academic modules */}
        <div className="sr-only" aria-hidden="false">
          <button type="button" aria-label="Gym & Split" onClick={() => onSelectTab('gym')}>Gym &amp; Split</button>
          <button type="button" aria-label="Workouts" onClick={() => onSelectTab('gym')}>Workouts</button>
          <button type="button" aria-label="Nutrition" onClick={() => onSelectTab('nutrition')}>Nutrition</button>
          <button type="button" aria-label="DayOS" onClick={() => onSelectTab('dayos')}>DayOS</button>
          <button type="button" aria-label="Day Planner" onClick={() => onSelectTab('dayos')}>Day Planner</button>
          <button type="button" aria-label="EduHub" onClick={() => onSelectTab('eduhub')}>EduHub</button>
          <button type="button" aria-label="Lectures" onClick={() => onSelectTab('eduhub')}>Lectures</button>
          <button type="button" aria-label="Bloom" onClick={() => onSelectTab('bloom')}>Bloom</button>
          <button type="button" aria-label="Wellness" onClick={() => onSelectTab('bloom')}>Wellness</button>
          <button type="button" aria-label="My Orbit" onClick={toggleOrbitMenu}>My Orbit</button>
          <button type="button" aria-label="Lifestyle Orbit" onClick={toggleOrbitMenu}>Lifestyle Orbit</button>
        </div>

        {isOrbitMenuOpen && (
          <div
            ref={orbitMenuRef}
            id="my-orbit-menu"
            role="group"
            aria-label="My Space spaces"
            className="orbit-subnav-row"
          >
            <div className="orbit-subnav-label"><span className="orbit-live-dot" /> My Space</div>
            <div className="orbit-subnav-items">
              {MY_ORBIT_ITEMS.filter((item) => item.id !== 'bloom' || ((state.settings?.gender ?? state.settings?.bodyModelPreference ?? 'male') === 'female' && state.settings?.bloomEnabled)).map((item) => {
                const isSubActive = currentTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-label={`${item.label}, ${item.subtitle}`}
                    aria-current={isSubActive ? 'page' : undefined}
                    onClick={() => {
                      onSelectTab(item.id);
                      setIsOrbitMenuOpen(true);
                    }}
                    className={`orbit-subnav-item ${isSubActive ? 'is-active' : ''}`}
                  >
                    <span className="orbit-subnav-icon">{item.icon}</span>
                    <span>{item.label}</span>
                    {isSubActive && <span className="orbit-subnav-indicator" aria-hidden="true" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Mobile Slide-Over Navigation Drawer */}
        {isMobileDrawerOpen && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Mobile Navigation Menu"
            className="fixed inset-0 z-[9990] flex md:hidden pointer-events-auto"
          >
            <div
              className="fixed inset-0 bg-espresso-950/60 dark:bg-black/75 backdrop-blur-sm transition-opacity"
              onClick={() => setIsMobileDrawerOpen(false)}
            />

            <div className="relative w-4/5 max-w-xs bg-white dark:bg-[#18151D] border-r border-ivory-300 dark:border-white/10 shadow-2xl h-full flex flex-col z-10 animate-in slide-in-from-left duration-200">
              {/* Drawer Header */}
              <div className="p-4 border-b border-ivory-200 dark:border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-serif text-lg font-bold text-espresso-950 dark:text-ivory-50">
                    TRAKIFY
                  </span>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--accent)' }} />
                </div>
                <button
                  type="button"
                  aria-label="Close navigation drawer"
                  onClick={() => setIsMobileDrawerOpen(false)}
                  className="p-1.5 rounded-xl text-espresso-400 hover:text-espresso-800 dark:hover:text-ivory-100 transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Drawer Menu Items */}
              <div className="flex-1 overflow-y-auto p-3 space-y-5">
                {/* Academic Section */}
                <div className="space-y-1">
                  <span className="px-3 text-[10.5px] font-mono font-bold text-espresso-400 dark:text-espresso-500 uppercase tracking-wider block">
                    Academics
                  </span>
                  {academicTabs.map((tab) => {
                    const isActive = currentTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => {
                          setIsMobileDrawerOpen(false);
                          onSelectTab(tab.id);
                        }}
                        className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-xs font-semibold transition cursor-pointer min-h-[44px] ${
                          isActive
                            ? 'text-white shadow-xs'
                            : 'text-espresso-700 dark:text-ivory-200 hover:bg-ivory-100 dark:hover:bg-white/5'
                        }`}
                        style={isActive ? { backgroundColor: 'var(--accent)' } : undefined}
                      >
                        <div className="flex items-center gap-3">
                          <span className="shrink-0">{tab.icon}</span>
                          <span>{tab.label}</span>
                        </div>
                        {tab.badge !== undefined && (
                          <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${isActive ? 'bg-white/20 text-white' : 'bg-ivory-200 dark:bg-white/10 text-espresso-600 dark:text-ivory-300'}`}>
                            {tab.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* My Space Section */}
                <div className="space-y-1">
                  <span className="px-3 text-[10.5px] font-mono font-bold text-espresso-400 dark:text-espresso-500 uppercase tracking-wider block">
                    My Space
                  </span>
                  {MY_ORBIT_ITEMS.filter((item) => item.id !== 'bloom' || ((state.settings?.gender ?? state.settings?.bodyModelPreference ?? 'male') === 'female' && state.settings?.bloomEnabled)).map((item) => {
                    const isActive = currentTab === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setIsMobileDrawerOpen(false);
                          onSelectTab(item.id);
                        }}
                        className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-xs font-semibold transition cursor-pointer min-h-[44px] ${
                          isActive
                            ? 'text-white shadow-xs'
                            : 'text-espresso-700 dark:text-ivory-200 hover:bg-ivory-100 dark:hover:bg-white/5'
                        }`}
                        style={isActive ? { backgroundColor: 'var(--accent)' } : undefined}
                      >
                        <div className="flex items-center gap-3">
                          <span className="shrink-0">{item.icon}</span>
                          <div className="text-left">
                            <span className="block">{item.label}</span>
                            <span className="block text-[10px] font-normal opacity-75">{item.subtitle}</span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Settings Section */}
                <div className="pt-2 border-t border-ivory-200 dark:border-white/10 space-y-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsMobileDrawerOpen(false);
                      onSelectTab('settings');
                    }}
                    className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-semibold transition cursor-pointer min-h-[44px] ${
                      currentTab === 'settings'
                        ? 'text-white shadow-xs'
                        : 'text-espresso-700 dark:text-ivory-200 hover:bg-ivory-100 dark:hover:bg-white/5'
                    }`}
                    style={currentTab === 'settings' ? { backgroundColor: 'var(--accent)' } : undefined}
                  >
                    <Settings className="w-4 h-4 shrink-0" />
                    <span>Settings</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
