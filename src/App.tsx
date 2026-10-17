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
import { SettingsView } from './components/views/SettingsView';
import { BackgroundGradient } from './components/ui/background-gradient';

export const MainApp: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');

  return (
    <>
      {/* Syncs accent colour + background style from settings → DOM */}
      <AppearanceManager />

      <div className="min-h-screen flex flex-col text-espresso-800 dark:text-ivory-100 transition-colors duration-200 relative z-10">
        <Header />
        <Navigation currentTab={currentTab} onSelectTab={setCurrentTab} />

        <main className="flex-1 w-full max-w-[1680px] 2xl:max-w-[1840px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 pt-6 sm:pt-8 pb-10">
          <BackgroundGradient
            containerClassName="w-full rounded-[26px]"
            className="w-full bg-[#FAF7F2]/95 dark:bg-[#100E0D]/95 backdrop-blur-md rounded-[22px] p-4 sm:p-6 lg:p-8 border border-ivory-300/40 dark:border-espresso-800/40 shadow-sm"
          >
            {currentTab === 'dashboard'  && <Dashboard onNavigateToSyllabus={() => setCurrentTab('syllabus')} />}
            {currentTab === 'timetable'  && <TimetableView />}
            {currentTab === 'syllabus'   && <SyllabusView />}
            {currentTab === 'attendance' && <AttendanceView />}
            {currentTab === 'focus'      && <FocusView />}
            {currentTab === 'gym'        && <GymView />}
            {currentTab === 'nutrition'  && <NutritionView />}
            {currentTab === 'reminders'  && <RemindersView />}
            {currentTab === 'settings'   && <SettingsView />}
          </BackgroundGradient>
        </main>

        <footer className="border-t border-ivory-300 dark:border-espresso-800 py-6 text-center text-xs text-espresso-400 dark:text-espresso-500 font-serif italic">
          <p>TRACKER · Personal Daily Operating System · Local-First & Confidential</p>
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
