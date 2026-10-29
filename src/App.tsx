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
import { ClassSpaceProvider, useOptionalClassSpace } from './context/ClassSpaceContext';
import { AdminRoute } from './components/admin/AdminRoute';
import { EduHubView } from './components/eduhub/EduHubView';

import { FocusRadioProvider, MiniPlayer } from './components/focus-radio';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { motion } from 'motion/react';

export const VALID_NAV_TABS: Record<string, NavTab> = {
  dashboard: 'dashboard',
  today: 'dashboard',
  timetable: 'timetable',
  attendance: 'attendance',
  syllabus: 'syllabus',
  planner: 'planner',
  tests: 'tests',
  focus: 'focus',
  gym: 'gym',
  reminders: 'reminders',
  nutrition: 'nutrition',
  eduhub: 'eduhub',
  classspace: 'classspace',
  settings: 'settings',
  admin: 'admin',
};

export const ACTIVE_TAB_STORAGE_KEY = 'tracker_active_nav_tab';

export const getActiveTabStorageKey = (userId?: string | null): string =>
  userId && userId !== 'usr_local_student'
    ? `tracker_active_nav_tab_${userId}`
    : ACTIVE_TAB_STORAGE_KEY;

export function parseRouteFromHash(hash: string): { tab: NavTab | null; subRoute?: string } {
  if (!hash) return { tab: null };
  const clean = hash.replace(/^#\/?/, '').trim();
  if (!clean || clean.includes('=') || clean.includes('&')) {
    // Ensure we ignore OAuth query-like hash fragments (e.g. #access_token=... or #error=...)
    return { tab: null };
  }
  const [tabPart, ...rest] = clean.split(/[/?]/);
  const normalized = tabPart.toLowerCase();
  if (normalized in VALID_NAV_TABS) {
    return {
      tab: VALID_NAV_TABS[normalized],
      subRoute: rest.join('/'),
    };
  }
  return { tab: null };
}

export function resolveNavTabFromLocation(): NavTab | null {
  if (typeof window === 'undefined') return null;

  // 1. Pathname check (e.g. /admin, /eduhub, /attendance)
  const pathClean = window.location.pathname.replace(/^\/+|\/+$/g, '').toLowerCase();
  const [firstSegment] = pathClean.split(/[/?]/);
  if (firstSegment && firstSegment in VALID_NAV_TABS) {
    return VALID_NAV_TABS[firstSegment];
  }

  // 2. Hash check (e.g. #eduhub, #classspace/the-commons, #attendance)
  const { tab } = parseRouteFromHash(window.location.hash);
  if (tab) {
    return tab;
  }

  return null;
}

export function getInitialNavTab(userId?: string | null): NavTab {
  // Check location first (URL takes precedence)
  const fromLocation = resolveNavTabFromLocation();
  if (fromLocation) return fromLocation;

  // Check persisted storage
  try {
    if (typeof window !== 'undefined') {
      if (userId && userId !== 'usr_local_student') {
        const userSaved = localStorage.getItem(getActiveTabStorageKey(userId));
        if (userSaved && userSaved in VALID_NAV_TABS) {
          return VALID_NAV_TABS[userSaved];
        }
      }
      const saved = localStorage.getItem(ACTIVE_TAB_STORAGE_KEY);
      if (saved && saved in VALID_NAV_TABS) {
        return VALID_NAV_TABS[saved];
      }
    }
  } catch {}

  return 'dashboard';
}

export const MainApp: React.FC = () => {
  const { authUser } = useApp();
  const classSpace = useOptionalClassSpace();
  const [currentTab, setCurrentTab] = useState<NavTab>(() => getInitialNavTab(authUser?.id));

  // Sync URL hash with currentTab on mount if no hash exists yet
  useEffect(() => {
    if (typeof window !== 'undefined' && !window.location.hash && currentTab !== 'dashboard') {
      try {
        if (currentTab === 'classspace' && classSpace?.activeChannel) {
          const slug = classSpace.activeChannel.slug || classSpace.activeChannel.id;
          window.history.replaceState(null, '', `#classspace/${slug}`);
        } else {
          window.history.replaceState(null, '', `#${currentTab}`);
        }
      } catch {}
    }
  }, [currentTab, classSpace?.activeChannel]);

  // When auth resolves or switches, restore user-scoped tab if present and no explicit URL route
  useEffect(() => {
    if (authUser?.id && authUser.id !== 'usr_local_student') {
      const userTab = localStorage.getItem(getActiveTabStorageKey(authUser.id));
      if (userTab && userTab in VALID_NAV_TABS && !resolveNavTabFromLocation()) {
        setCurrentTab(VALID_NAV_TABS[userTab]);
      }
    }
  }, [authUser?.id]);

  const handleSelectTab = (tab: NavTab) => {
    setCurrentTab(tab);

    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(ACTIVE_TAB_STORAGE_KEY, tab);
        if (authUser?.id && authUser.id !== 'usr_local_student') {
          localStorage.setItem(getActiveTabStorageKey(authUser.id), tab);
        }

        // Keep URL hash in sync with active tab (leaving clean URL for dashboard)
        if (tab === 'dashboard') {
          if (window.location.hash && !window.location.hash.includes('=')) {
            window.history.replaceState(null, '', '/' + (window.location.search || ''));
          } else if (window.location.pathname !== '/') {
            window.history.replaceState(null, '', '/' + (window.location.search || ''));
          }
        } else {
          // Avoid overwriting OAuth hashes
          if (!window.location.hash.includes('=')) {
            if (tab === 'classspace' && classSpace?.activeChannel) {
              const slug = classSpace.activeChannel.slug || classSpace.activeChannel.id;
              window.history.replaceState(null, '', `#classspace/${slug}`);
            } else {
              window.history.replaceState(null, '', `#${tab}`);
            }
          }
        }
      }
    } catch {}
  };

  useEffect(() => {
    const handleLocationChange = () => {
      const tabFromLoc = resolveNavTabFromLocation();
      if (tabFromLoc) {
        setCurrentTab(tabFromLoc);
        try {
          localStorage.setItem(ACTIVE_TAB_STORAGE_KEY, tabFromLoc);
          if (authUser?.id && authUser.id !== 'usr_local_student') {
            localStorage.setItem(getActiveTabStorageKey(authUser.id), tabFromLoc);
          }
        } catch {}
      }
    };

    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('hashchange', handleLocationChange);
    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('hashchange', handleLocationChange);
    };
  }, [authUser?.id]);

  // Tab rendering: respect currentTab. Do not override or force redirect to dashboard.
  const effectiveTab: NavTab = currentTab;

  return (
    <>
      {/* Syncs accent colour + background style from settings → DOM */}
      <AppearanceManager />

      <div className="min-h-screen flex flex-col bg-transparent text-espresso-950 dark:text-ivory-100 transition-colors duration-200 relative z-10 selection:bg-terracotta-100 selection:text-terracotta-700">
        {/* Clean Editorial Application Header */}
        <Header />

        {/* Horizontal Fast Tab Strip */}
        <Navigation currentTab={effectiveTab} onSelectTab={handleSelectTab} />

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
                onNavigateToSyllabus={() => handleSelectTab('syllabus')}
                onNavigateToFocus={() => handleSelectTab('focus')}
                onNavigateToPlanner={() => handleSelectTab('planner')}
                onNavigateToNutrition={() => handleSelectTab('nutrition')}
                onNavigateToTests={() => handleSelectTab('tests')}
                onSelectTab={handleSelectTab}
              />
            )}
            {effectiveTab === 'timetable'  && <TimetableView />}
            {effectiveTab === 'syllabus'   && <SyllabusView onNavigateToPlanner={() => handleSelectTab('planner')} />}
            {effectiveTab === 'planner'    && <PlannerView onNavigateToSyllabus={() => handleSelectTab('syllabus')} />}
            {effectiveTab === 'tests'      && <TestsView onNavigateToPlanner={() => handleSelectTab('planner')} />}
            {effectiveTab === 'attendance' && <AttendanceView />}
            {effectiveTab === 'focus'      && <FocusView />}
            {effectiveTab === 'gym'        && <GymView />}
            {effectiveTab === 'nutrition'  && <NutritionView />}
            {effectiveTab === 'reminders'  && <RemindersView />}
            {effectiveTab === 'eduhub'     && <EduHubView />}
            {effectiveTab === 'classspace' && <ClassSpaceView onNavigateToSettings={() => handleSelectTab('settings')} />}
            {effectiveTab === 'settings'   && (
              <SettingsView
                onNavigateToClassSpace={() => handleSelectTab('classspace')}
              />
            )}
            {effectiveTab === 'admin'      && (
              <AdminRoute
                onExit={() => {
                  if (typeof window !== 'undefined') {
                    try {
                      window.history.replaceState(null, '', '/' + (window.location.search || ''));
                    } catch {}
                  }
                  handleSelectTab('dashboard');
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
    <ErrorBoundary>
      <ThemeProvider>
        <AppProvider>
          <ClassSpaceProvider>
            <FocusRadioProvider>
              <MainApp />
            </FocusRadioProvider>
          </ClassSpaceProvider>
        </AppProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
