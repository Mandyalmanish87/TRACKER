import React, { useState, useEffect } from 'react';
import { ThemeProvider } from './theme/ThemeContext';
import { AppProvider, useApp } from './context/AppContext';
import { AppearanceManager } from './theme/AppearanceManager';
import { Header } from './components/common/Header';
import { NutritionView } from './components/views/NutritionView';
import { Navigation, NavTab } from './components/common/Navigation';
import { Dashboard } from './components/dashboard/Dashboard';
import { TimetableView } from './components/views/TimetableView';
import { SyllabusView } from './components/views/SyllabusView';
import { AttendanceView } from './components/views/AttendanceView';
import { FocusView } from './components/views/FocusView';
import { GymView } from './components/views/GymView';
import { RemindersView } from './components/views/RemindersView';
import { PlannerView } from './components/views/PlannerView';
import { TestsView } from './components/views/TestsView';
import { SettingsView } from './components/views/SettingsView';
import { ClassSpaceView } from './components/classspace/ClassSpaceView';
import { ClassSpaceProvider } from './context/ClassSpaceContext';
import { AdminRoute } from './components/admin/AdminRoute';
import { EduHubView } from './components/eduhub/EduHubView';

import { FocusRadioProvider, MiniPlayer } from './components/focus-radio';
import { motion } from 'motion/react';

export const MainApp: React.FC = () => {
  const { state } = useApp();
  const [currentTab, setCurrentTab] = useState<NavTab>(() => {
    if (typeof window !== 'undefined') {
      if (window.location.pathname === '/admin' || window.location.hash === '#admin') {
        return 'admin';
      }
    }
    return 'dashboard';
  });

  useEffect(() => {
    const handleLocationChange = () => {
      if (typeof window !== 'undefined') {
        if (window.location.pathname === '/admin' || window.location.hash === '#admin') {
          setCurrentTab('admin');
        }
      }
    };

    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('hashchange', handleLocationChange);
    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('hashchange', handleLocationChange);
    };
  }, []);

  // Guard: if user is in Individual mode, redirect 'classspace' requests to dashboard
  const effectiveTab: NavTab = currentTab === 'classspace' && state.settings?.userMode !== 'class_based'
    ? 'dashboard'
    : currentTab;

  return (
    <>
      {/* Syncs accent colour + background style from settings → DOM */}
      <AppearanceManager />

      <div className="min-h-screen flex flex-col bg-transparent text-espresso-950 dark:text-ivory-100 transition-colors duration-200 relative z-10 selection:bg-terracotta-100 selection:text-terracotta-700">
        {/* Clean Editorial Application Header */}
        <Header />

        {/* Horizontal Fast Tab Strip */}
        <Navigation currentTab={effectiveTab} onSelectTab={setCurrentTab} />

        {/* Main Content Area */}
        <main className="flex-1 w-full max-w-[1680px] 2xl:max-w-[1840px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 py-6 sm:py-8">
          <motion.div
            key={effectiveTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="w-full"
          >
            {effectiveTab === 'dashboard' && (
              <Dashboard
                onNavigateToSyllabus={() => setCurrentTab('syllabus')}
                onNavigateToFocus={() => setCurrentTab('focus')}
                onNavigateToPlanner={() => setCurrentTab('planner')}
                onNavigateToNutrition={() => setCurrentTab('nutrition')}
                onNavigateToTests={() => setCurrentTab('tests')}
                onSelectTab={setCurrentTab}
              />
            )}
            {effectiveTab === 'timetable'  && <TimetableView />}
            {effectiveTab === 'syllabus'   && <SyllabusView onNavigateToPlanner={() => setCurrentTab('planner')} />}
            {effectiveTab === 'planner'    && <PlannerView onNavigateToSyllabus={() => setCurrentTab('syllabus')} />}
            {effectiveTab === 'tests'      && <TestsView onNavigateToPlanner={() => setCurrentTab('planner')} />}
            {effectiveTab === 'attendance' && <AttendanceView />}
            {effectiveTab === 'focus'      && <FocusView />}
            {effectiveTab === 'gym'        && <GymView />}
            {effectiveTab === 'nutrition'  && <NutritionView />}
            {effectiveTab === 'reminders'  && <RemindersView />}
            {effectiveTab === 'eduhub'     && <EduHubView />}
            {effectiveTab === 'classspace' && <ClassSpaceView onNavigateToSettings={() => setCurrentTab('settings')} />}
            {effectiveTab === 'settings'   && (
              <SettingsView
                onNavigateToClassSpace={() => setCurrentTab('classspace')}
                onNavigateToAdmin={() => setCurrentTab('admin')}
              />
            )}
            {effectiveTab === 'admin'      && (
              <AdminRoute
                onExit={() => {
                  if (typeof window !== 'undefined' && window.location.hash === '#admin') {
                    window.location.hash = '';
                  }
                  setCurrentTab('dashboard');
                }}
              />
            )}
          </motion.div>
        </main>

        {/* Global Persistent Floating Focus Radio 2.0 */}
        <MiniPlayer />

        {/* Standard Editorial Footer */}
        <footer className="border-t border-ivory-300 dark:border-espresso-800 py-6 text-center text-xs text-espresso-400 dark:text-espresso-500 font-serif italic">
          <p>
            <span>Personal Daily Operating System</span> · Local-First &amp; Confidential
          </p>
        </footer>
      </div>
    </>
  );
};

export default function App() {
  return (
    <ThemeProvider>
      <AppProvider>
        <ClassSpaceProvider>
          <FocusRadioProvider>
            <MainApp />
          </FocusRadioProvider>
        </ClassSpaceProvider>
      </AppProvider>
    </ThemeProvider>
  );
}
