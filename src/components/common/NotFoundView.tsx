import React from 'react';
import { NavTab } from './Navigation';
import {
  Home,
  ArrowLeft,
  Calendar,
  GraduationCap,
  BookOpen,
  ListTodo,
  Dumbbell,
  Salad,
  Settings,
} from 'lucide-react';

interface NotFoundViewProps {
  invalidRoute?: string;
  onNavigate: (tab: NavTab) => void;
}

export const NotFoundView: React.FC<NotFoundViewProps> = ({
  invalidRoute,
  onNavigate,
}) => {
  const quickLinks: { tab: NavTab; label: string; icon: React.ReactNode }[] = [
    { tab: 'dashboard', label: 'Today Dashboard', icon: <Home className="w-4 h-4" /> },
    { tab: 'timetable', label: 'Timetable', icon: <Calendar className="w-4 h-4" /> },
    { tab: 'attendance', label: 'Attendance', icon: <GraduationCap className="w-4 h-4" /> },
    { tab: 'planner', label: 'Study Planner', icon: <ListTodo className="w-4 h-4" /> },
    { tab: 'syllabus', label: 'Syllabus', icon: <BookOpen className="w-4 h-4" /> },
    { tab: 'gym', label: 'Workouts', icon: <Dumbbell className="w-4 h-4" /> },
    { tab: 'nutrition', label: 'Nutrition', icon: <Salad className="w-4 h-4" /> },
    { tab: 'settings', label: 'Settings', icon: <Settings className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center px-4 py-12 text-center animate-in fade-in duration-200">
      <div className="max-w-lg w-full space-y-6">
        {/* 404 Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800/60">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
          404 · PAGE NOT FOUND
        </div>

        {/* Editorial Title */}
        <div className="space-y-2">
          <h1 className="font-serif text-3xl sm:text-4xl font-normal text-espresso-950 dark:text-ivory-50 tracking-tight">
            Lost in the Academic Void
          </h1>
          <p className="text-xs sm:text-sm text-espresso-600 dark:text-espresso-300 max-w-md mx-auto leading-relaxed">
            The destination <code className="px-1.5 py-0.5 rounded bg-ivory-200 dark:bg-white/10 font-mono text-xs">{invalidRoute || window.location.hash || window.location.pathname}</code> does not exist or has moved.
          </p>
        </div>

        {/* Primary Action Button */}
        <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => onNavigate('dashboard')}
            className="px-5 py-2.5 rounded-2xl text-xs font-semibold text-white shadow-subtle flex items-center gap-2 transition hover:opacity-95 active:scale-[0.98] cursor-pointer"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            <Home className="w-4 h-4" />
            <span>Return to Dashboard</span>
          </button>
          <button
            type="button"
            onClick={() => window.history.back()}
            className="px-4 py-2.5 rounded-2xl text-xs font-semibold border border-ivory-300 dark:border-white/10 bg-white/80 dark:bg-white/5 text-espresso-800 dark:text-ivory-100 hover:bg-ivory-100 dark:hover:bg-white/10 transition cursor-pointer flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Go Back</span>
          </button>
        </div>

        {/* Quick Jump Directory */}
        <div className="pt-6 border-t border-ivory-200 dark:border-white/10 space-y-3">
          <span className="text-[11px] font-mono text-espresso-400 uppercase tracking-wider block">
            Jump to Active Module:
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {quickLinks.map((link) => (
              <button
                key={link.tab}
                type="button"
                onClick={() => onNavigate(link.tab)}
                className="flex items-center gap-2 p-2.5 rounded-xl border border-ivory-200 dark:border-white/5 bg-white/60 dark:bg-white/[0.02] hover:bg-ivory-100 dark:hover:bg-white/5 transition text-xs font-medium text-espresso-800 dark:text-ivory-200 cursor-pointer text-left"
              >
                <span className="shrink-0 text-espresso-500 dark:text-espresso-400">{link.icon}</span>
                <span className="truncate">{link.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
