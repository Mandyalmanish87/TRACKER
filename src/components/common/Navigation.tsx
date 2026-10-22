import React from 'react';
import { LayoutDashboard, Calendar, GraduationCap, BookOpen, Flame, Dumbbell, Salad, Settings, ListTodo, Award, Building } from 'lucide-react';
import { motion } from 'motion/react';
import { useApp } from '../../context/AppContext';
import { isTaskOverdue } from '../../utils/plannerUtils';
import { detectRecurringWeaknesses } from '../../utils/testAnalytics';

export type NavTab = 'dashboard' | 'timetable' | 'attendance' | 'syllabus' | 'planner' | 'tests' | 'focus' | 'gym' | 'reminders' | 'nutrition' | 'classspace' | 'settings';

interface NavigationProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
}

export const Navigation: React.FC<NavigationProps> = ({ currentTab, onSelectTab }) => {
  const { state } = useApp();

  // Compute live contextual badges
  const pendingRemindersCount = state.reminders.filter((r) => !r.isCompleted).length;
  const todayClassesCount = state.timetable.filter((t) => t.dayOfWeek === 3).length; // Day 3 = Wednesday
  const atRiskCount = state.subjects.filter((s) => {
    if (s.totalConducted === 0) return false;
    return (s.attended / s.totalConducted) * 100 < s.targetPct;
  }).length;
  const pendingTasksCount = (state.tasks || []).filter((t) => t.status !== 'done').length;
  const overdueTasksCount = (state.tasks || []).filter((t) => isTaskOverdue(t)).length;
  const recurringWeaknessCount = detectRecurringWeaknesses(state.errorLogs || []).filter((w) => w.isRecurring).length;

  const tabs: { id: NavTab; label: string; icon: React.ReactNode; badge?: number; badgeVariant?: 'sage' | 'danger' | 'neutral' }[] = [
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
      id: 'gym',
      label: 'Gym & Split',
      icon: <Dumbbell className="w-4 h-4" />,
    },
    {
      id: 'nutrition',
      label: 'Nutrition',
      icon: <Salad className="w-4 h-4" />,
    },
    {
      id: 'reminders',
      label: 'Events & Tasks',
      icon: <Calendar className="w-4 h-4" />,
      badge: pendingRemindersCount > 0 ? pendingRemindersCount : undefined,
      badgeVariant: 'neutral',
    },
    ...(state.settings?.userMode === 'class_based'
      ? [
          {
            id: 'classspace' as NavTab,
            label: 'ClassSpace',
            icon: <Building className="w-4 h-4" />,
          },
        ]
      : []),
    {
      id: 'settings',
      label: 'Settings',
      icon: <Settings className="w-4 h-4" />,
    },
  ];

  return (
    <nav className="border-b border-ivory-300 dark:border-espresso-800 bg-white/70 dark:bg-espresso-900/70 backdrop-blur-md sticky top-[57px] sm:top-[61px] z-20 overflow-x-auto no-scrollbar">
      <div className="w-full max-w-[1680px] 2xl:max-w-[1840px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 flex items-center gap-1 sm:gap-2 py-2">
        {tabs.map((tab) => {
          const isActive = currentTab === tab.id;
          return (
            <motion.button
              key={tab.id}
              aria-label={tab.id === 'classspace' ? 'Classroom Hub' : tab.label}
              onClick={() => onSelectTab(tab.id)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`relative flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-medium whitespace-nowrap shrink-0 transition-colors duration-150 ${
                isActive
                  ? 'text-white shadow-xs'
                  : 'text-espresso-600 dark:text-espresso-300 hover:text-espresso-900 dark:hover:text-ivory-100 hover:bg-ivory-200/60 dark:hover:bg-espresso-800/60'
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

              {/* Tab Content */}
              <span className="relative z-10 flex items-center gap-2">
                {tab.icon}
                <span>{tab.label}</span>
                {tab.id === 'reminders' && <span className="sr-only">Reminders</span>}
                {tab.badge !== undefined && (
                  <span
                    className={`text-[11px] font-mono tabular-nums px-1.5 py-0.2 rounded-full font-semibold leading-none ${
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
      </div>
    </nav>
  );
};

