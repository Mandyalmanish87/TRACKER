import React from 'react';
import { LayoutDashboard, Calendar, GraduationCap, BookOpen, Flame, Dumbbell, CheckSquare, Salad, Settings } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export type NavTab = 'dashboard' | 'timetable' | 'attendance' | 'syllabus' | 'focus' | 'gym' | 'reminders' | 'nutrition' | 'settings';

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
      label: 'Reminders',
      icon: <CheckSquare className="w-4 h-4" />,
      badge: pendingRemindersCount > 0 ? pendingRemindersCount : undefined,
      badgeVariant: 'neutral',
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: <Settings className="w-4 h-4" />,
    },
  ];

  return (
    <nav className="border-b border-ivory-300 dark:border-espresso-800 bg-white/40 dark:bg-espresso-900/40 backdrop-blur-sm sticky top-[61px] z-20 overflow-x-auto no-scrollbar">
      <div className="w-full max-w-[1680px] 2xl:max-w-[1840px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 flex items-center gap-1.5 sm:gap-2.5 py-2">
        {tabs.map((tab) => {
          const isActive = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-medium whitespace-nowrap shrink-0 transition-all duration-150 ${
                isActive
                  ? 'text-white shadow-subtle'
                  : 'text-espresso-600 dark:text-espresso-300 hover:bg-ivory-200 dark:hover:bg-espresso-800'
              }`}
              style={isActive ? { backgroundColor: 'var(--accent)' } : undefined}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {tab.badge !== undefined && (
                <span
                  className={`text-[11px] tabular-nums px-2 py-0.5 rounded-full font-bold leading-none ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : tab.badgeVariant === 'danger'
                      ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
                      : 'bg-ivory-300 text-espresso-700 dark:bg-espresso-700 dark:text-ivory-200'
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
