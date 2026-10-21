import React, { useState } from 'react';
import { ThemeProvider } from './theme/ThemeContext';
import { AppProvider } from './context/AppContext';
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

import { FocusRadioPopout } from './components/focus/FocusRadioPopout';
import { Lusion3DBackdrop } from './components/canvas3d/Lusion3DBackdrop';
import { motion } from 'motion/react';

export const MainApp: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');

  return (
    <>
      {/* 3D Scroll-reactive WebGL Ambient Canvas */}
      <Lusion3DBackdrop />

      {/* Syncs accent colour + background style from settings → DOM */}
      <AppearanceManager />

      <div className="min-h-screen flex flex-col bg-ivory-100 dark:bg-espresso-950 text-espresso-950 dark:text-ivory-100 transition-colors duration-200 relative z-10 selection:bg-terracotta-100 selection:text-terracotta-700">
        {/* Clean Editorial Application Header */}
        <Header />

        {/* Horizontal Fast Tab Strip */}
        <Navigation currentTab={currentTab} onSelectTab={setCurrentTab} />

        {/* Main Content Area */}
        <main className="flex-1 w-full max-w-[1680px] 2xl:max-w-[1840px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 py-6 sm:py-8">
          <motion.div
            key={currentTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="w-full"
          >
            {currentTab === 'dashboard' && (
              <Dashboard
                onNavigateToSyllabus={() => setCurrentTab('syllabus')}
                onNavigateToFocus={() => setCurrentTab('focus')}
                onNavigateToPlanner={() => setCurrentTab('planner')}
                onNavigateToNutrition={() => setCurrentTab('nutrition')}
                onNavigateToTests={() => setCurrentTab('tests')}
                onSelectTab={setCurrentTab}
              />
            )}
            {currentTab === 'timetable'  && <TimetableView />}
            {currentTab === 'syllabus'   && <SyllabusView onNavigateToPlanner={() => setCurrentTab('planner')} />}
            {currentTab === 'planner'    && <PlannerView onNavigateToSyllabus={() => setCurrentTab('syllabus')} />}
            {currentTab === 'tests'      && <TestsView onNavigateToPlanner={() => setCurrentTab('planner')} />}
            {currentTab === 'attendance' && <AttendanceView />}
            {currentTab === 'focus'      && <FocusView />}
            {currentTab === 'gym'        && <GymView />}
            {currentTab === 'nutrition'  && <NutritionView />}
            {currentTab === 'reminders'  && <RemindersView />}
            {currentTab === 'settings'   && <SettingsView />}
          </motion.div>
        </main>

        {/* Global Persistent Popout Focus Radio Player */}
        <FocusRadioPopout />

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
        <MainApp />
      </AppProvider>
    </ThemeProvider>
  );
}
