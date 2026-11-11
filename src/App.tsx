import React, { useState, useEffect, useRef } from 'react';
import { ThemeProvider } from './theme/ThemeContext';
import { AppProvider, useApp } from './context/AppContext';
import { AppearanceManager } from './theme/AppearanceManager';
import { Header } from './components/common/Header';
import { NutritionView } from './components/views/NutritionView';
import { Navigation, NavTab } from './components/common/Navigation';
import { Dashboard } from './components/dashboard/Dashboard';
import { DayOSView } from './components/dayos/DayOSView';
import { TimetableView } from './components/views/TimetableView';
import { SyllabusView } from './components/views/SyllabusView';
import { AttendanceView } from './components/views/AttendanceView';
import { FocusView } from './components/views/FocusView';
import { MiniDeepFocusPanel } from './components/focus/MiniDeepFocusPanel';
import { GymView } from './components/views/GymView';
import { RemindersView } from './components/views/RemindersView';
import { PlannerView } from './components/views/PlannerView';
import { TestsView } from './components/views/TestsView';
import { SettingsView } from './components/views/SettingsView';
import { ClassSpaceView } from './components/classspace/ClassSpaceView';
import { ClassSpaceProvider, useOptionalClassSpace } from './context/ClassSpaceContext';
import { AdminRoute } from './components/admin/AdminRoute';
import { EduHubView } from './components/eduhub/EduHubView';
import { BloomView } from './components/bloom/BloomView';
import { ToastProvider } from './context/ToastContext';
import { KeyboardShortcutsDialog } from './components/common/KeyboardShortcutsDialog';
import { OnboardingWizard } from './components/onboarding/OnboardingWizard';
import { NotFoundView } from './components/common/NotFoundView';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useTheme } from './theme/ThemeContext';

import { FocusRadioProvider, MiniPlayer } from './components/focus-radio';
import { ActiveWorkoutModal } from './components/gym/ActiveWorkoutModal';
import { RestTimerBar } from './components/gym/RestTimerBar';
import { ActiveWorkoutPill } from './components/gym/ActiveWorkoutPill';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { motion } from 'motion/react';
import { PlannerFocusLaunch, PlannerTask } from './types';

export const VALID_NAV_TABS: Record<string, NavTab> = {
  dashboard: 'dashboard',
  today: 'dashboard',
  dayos: 'dayos',
  'day-os': 'dayos',
  personal: 'dayos',
  'personal-space': 'dayos',
  timetable: 'timetable',
  'my-orbit': 'timetable',
  orbit: 'timetable',
  attendance: 'attendance',
  syllabus: 'syllabus',
  planner: 'planner',
  tests: 'tests',
  focus: 'focus',
  gym: 'gym',
  'iron-lab': 'gym',
  reminders: 'reminders',
  nutrition: 'nutrition',
  'fuel-os': 'nutrition',
  bloom: 'bloom',
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

export function getInitialNavTab(userId?: string | null, userMode?: string): NavTab {
  const isClassBased = userMode === 'class_based';

  // Check location first (URL takes precedence)
  const fromLocation = resolveNavTabFromLocation();
  if (fromLocation) {
    if (fromLocation === 'classspace' && !isClassBased) {
      return 'dashboard';
    }
    return fromLocation;
  }

  // Check persisted storage
  try {
    if (typeof window !== 'undefined') {
      if (userId && userId !== 'usr_local_student') {
        const userSaved = localStorage.getItem(getActiveTabStorageKey(userId));
        if (userSaved && userSaved in VALID_NAV_TABS) {
          const tab = VALID_NAV_TABS[userSaved];
          if (tab === 'classspace' && !isClassBased) return 'dashboard';
          return tab;
        }
      }
      const saved = localStorage.getItem(ACTIVE_TAB_STORAGE_KEY);
      if (saved && saved in VALID_NAV_TABS) {
        const tab = VALID_NAV_TABS[saved];
        if (tab === 'classspace' && !isClassBased) return 'dashboard';
        return tab;
      }
    }
  } catch {}

  return 'dashboard';
}

export const MainApp: React.FC = () => {
  const { authUser, state, syncNow } = useApp();
  const { mode, setMode } = useTheme();
  const classSpace = useOptionalClassSpace();
  const isClassBased = state.settings?.userMode === 'class_based';

  const isInvalidInitialRoute = () => {
    if (typeof window === 'undefined') return false;
    const cleanHash = window.location.hash.replace(/^#\/?/, '').trim();
    if (cleanHash && !cleanHash.includes('=') && !cleanHash.includes('&')) {
      const [tabPart] = cleanHash.split(/[/?]/);
      return !(tabPart.toLowerCase() in VALID_NAV_TABS);
    }
    return false;
  };

  const [isNotFound, setIsNotFound] = useState<boolean>(() => isInvalidInitialRoute());
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [plannerFocusLaunch, setPlannerFocusLaunch] = useState<PlannerFocusLaunch | null>(null);
  const [currentTab, setCurrentTab] = useState<NavTab>(() => getInitialNavTab(authUser?.id, state.settings?.userMode));
  const workspaceBounds = useRef<DOMRect | null>(null);

  // Global Keyboard Shortcuts
  useKeyboardShortcuts([
    {
      id: 'sc-cmd-slash',
      key: '/',
      ctrlOrCmd: true,
      description: 'Show keyboard shortcuts reference',
      category: 'Global Navigation',
      handler: () => setIsShortcutsOpen((prev) => !prev),
    },
    {
      id: 'sc-cmd-settings',
      key: ',',
      ctrlOrCmd: true,
      description: 'Open Settings',
      category: 'Global Navigation',
      handler: () => handleSelectTab('settings'),
    },
    {
      id: 'sc-cmd-theme',
      key: 'd',
      ctrlOrCmd: true,
      shift: true,
      description: 'Toggle Dark / Light theme',
      category: 'System & Settings',
      handler: () => setMode(mode === 'dark' ? 'light' : 'dark'),
    },
    {
      id: 'sc-cmd-sync',
      key: 's',
      ctrlOrCmd: true,
      shift: true,
      description: 'Trigger cloud sync',
      category: 'System & Settings',
      handler: () => syncNow(),
    },
    {
      id: 'sc-cmd-new-task',
      key: 'n',
      ctrlOrCmd: true,
      shift: true,
      description: 'Create new task',
      category: 'Tasks & Events',
      handler: () => handleSelectTab('planner'),
    },
    {
      id: 'sc-jump-today',
      key: '1',
      alt: true,
      description: 'Jump to Today Dashboard',
      category: 'Dashboard & Today',
      handler: () => handleSelectTab('dashboard'),
    },
    {
      id: 'sc-jump-dayos',
      key: '2',
      alt: true,
      description: 'Jump to Day Planner',
      category: 'Dashboard & Today',
      handler: () => handleSelectTab('dayos'),
    },
    {
      id: 'sc-jump-timetable',
      key: '3',
      alt: true,
      description: 'Jump to Timetable',
      category: 'Academics & Timetable',
      handler: () => handleSelectTab('timetable'),
    },
    {
      id: 'sc-jump-attendance',
      key: '4',
      alt: true,
      description: 'Jump to Attendance',
      category: 'Academics & Timetable',
      handler: () => handleSelectTab('attendance'),
    },
    {
      id: 'sc-jump-syllabus',
      key: '5',
      alt: true,
      description: 'Jump to Syllabus',
      category: 'Academics & Timetable',
      handler: () => handleSelectTab('syllabus'),
    },
    {
      id: 'sc-jump-lectures',
      key: '6',
      alt: true,
      description: 'Jump to Lectures',
      category: 'Academics & Timetable',
      handler: () => handleSelectTab('eduhub'),
    },
    {
      id: 'sc-jump-planner',
      key: '7',
      alt: true,
      description: 'Jump to Planner',
      category: 'Tasks & Events',
      handler: () => handleSelectTab('planner'),
    },
    {
      id: 'sc-jump-events',
      key: '8',
      alt: true,
      description: 'Jump to Events & Tasks',
      category: 'Tasks & Events',
      handler: () => handleSelectTab('reminders'),
    },
    {
      id: 'sc-jump-focus',
      key: '9',
      alt: true,
      description: 'Jump to Deep Focus',
      category: 'Deep Focus',
      handler: () => handleSelectTab('focus'),
    },
    {
      id: 'sc-jump-workouts',
      key: 'w',
      alt: true,
      description: 'Jump to Workouts',
      category: 'Workouts & Nutrition',
      handler: () => handleSelectTab('gym'),
    },
    {
      id: 'sc-jump-nutrition',
      key: 'm',
      alt: true,
      description: 'Jump to Nutrition',
      category: 'Workouts & Nutrition',
      handler: () => handleSelectTab('nutrition'),
    },
  ]);

  const trackWorkspacePointer = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'touch' || !event.currentTarget.classList.contains('app-theme-surface')) return;
    const bounds = workspaceBounds.current || event.currentTarget.getBoundingClientRect();
    workspaceBounds.current = bounds;
    const x = Math.max(0, Math.min(100, ((event.clientX - bounds.left) / bounds.width) * 100));
    const y = Math.max(0, Math.min(100, ((event.clientY - bounds.top) / bounds.height) * 100));
    event.currentTarget.style.setProperty('--cursor-x', `${x}%`);
    event.currentTarget.style.setProperty('--cursor-y', `${y}%`);
    event.currentTarget.style.setProperty('--cursor-glow-opacity', '1');
  };

  const clearWorkspacePointer = (event: React.PointerEvent<HTMLDivElement>) => {
    workspaceBounds.current = null;
    event.currentTarget.style.setProperty('--cursor-glow-opacity', '0');
  };

  const activeChannelSlug = classSpace?.activeChannel?.slug || classSpace?.activeChannel?.id;

  // Sync URL hash with currentTab without triggering continuous navigation or re-render loops
  useEffect(() => {
    const handleNavEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ tab?: string }>;
      const targetTab = customEvent.detail?.tab;
      if (targetTab && targetTab in VALID_NAV_TABS) {
        handleSelectTab(VALID_NAV_TABS[targetTab]);
      }
    };
    window.addEventListener('tracker:navigate-tab', handleNavEvent);
    return () => window.removeEventListener('tracker:navigate-tab', handleNavEvent);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const currentHash = window.location.hash;
    if (currentHash.includes('=')) return; // Ignore OAuth fragments

    if (currentTab === 'classspace') {
      if (activeChannelSlug) {
        const expected = `#classspace/${activeChannelSlug}`;
        if (currentHash === '' || currentHash === '#classspace') {
          window.history.replaceState(null, '', expected);
        }
      } else if (!currentHash) {
        window.history.replaceState(null, '', '#classspace');
      }
    } else if (currentTab !== 'dashboard') {
      if (!currentHash) {
        window.history.replaceState(null, '', `#${currentTab}`);
      }
    }
  }, [currentTab, activeChannelSlug]);

  // When auth resolves or switches, restore user-scoped tab if present and no explicit URL route
  useEffect(() => {
    if (authUser?.id && authUser.id !== 'usr_local_student') {
      const userTab = localStorage.getItem(getActiveTabStorageKey(authUser.id));
      if (userTab && userTab in VALID_NAV_TABS && !resolveNavTabFromLocation()) {
        setCurrentTab(VALID_NAV_TABS[userTab]);
      }
    }
  }, [authUser?.id]);

  // Route guard: auto-redirect away from ClassSpace if in Individual mode
  useEffect(() => {
    if (currentTab === 'classspace' && !isClassBased) {
      setCurrentTab('dashboard');
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(ACTIVE_TAB_STORAGE_KEY, 'dashboard');
          if (authUser?.id && authUser.id !== 'usr_local_student') {
            localStorage.setItem(getActiveTabStorageKey(authUser.id), 'dashboard');
          }
          if (window.location.hash.startsWith('#classspace')) {
            window.history.replaceState(null, '', '/' + (window.location.search || ''));
          }
        } catch {}
      }
    }
  }, [currentTab, isClassBased, authUser?.id]);

  const handleSelectTab = (tab: NavTab) => {
    if (tab === 'classspace' && !isClassBased) {
      return; // Route guard: Type A cannot navigate to ClassSpace
    }
    setIsNotFound(false);
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

  const handleOpenTaskFocus = (task: PlannerTask) => {
    setPlannerFocusLaunch({
      id: `${task.id}-${Date.now()}`,
      taskId: task.id,
      estimatedDuration: task.estimatedDuration && task.estimatedDuration > 0 ? task.estimatedDuration : undefined,
      subjectId: task.syllabusSubjectId || task.subjectId,
    });
    handleSelectTab('focus');
  };

  useEffect(() => {
    const handleOpenFocusFromMini = () => {
      setCurrentTab('focus');
      try {
        localStorage.setItem(ACTIVE_TAB_STORAGE_KEY, 'focus');
        if (authUser?.id && authUser.id !== 'usr_local_student') {
          localStorage.setItem(getActiveTabStorageKey(authUser.id), 'focus');
        }
        if (!window.location.hash.includes('=')) window.history.replaceState(null, '', '#focus');
      } catch {}
      window.setTimeout(() => window.dispatchEvent(new CustomEvent('tracker:open-focus-fullscreen')), 50);
    };
    const handleLocationChange = () => {
      const tabFromLoc = resolveNavTabFromLocation();
      if (tabFromLoc) {
        if (tabFromLoc === 'classspace' && !isClassBased) {
          setCurrentTab('dashboard');
          if (window.location.hash.startsWith('#classspace')) {
            window.history.replaceState(null, '', '/' + (window.location.search || ''));
          }
          return;
        }
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
    window.addEventListener('tracker:open-focus-from-mini', handleOpenFocusFromMini);
    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('hashchange', handleLocationChange);
      window.removeEventListener('tracker:open-focus-from-mini', handleOpenFocusFromMini);
    };
  }, [authUser?.id, isClassBased]);

  const bloomAllowed = (state.settings?.gender ?? state.settings?.bodyModelPreference ?? 'male') === 'female' && Boolean(state.settings?.bloomEnabled);
  // Route guards: Bloom requires female profile opt-in; ClassSpace requires class_based userMode.
  const effectiveTab: NavTab =
    (currentTab === 'bloom' && !bloomAllowed) || (currentTab === 'classspace' && !isClassBased)
      ? 'dashboard'
      : currentTab;

  // Standalone Fullscreen View for Admin Control Center (removes upper student tab/nav clutter)
  if (effectiveTab === 'admin') {
    return (
      <>
        <AppearanceManager />
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
      </>
    );
  }

  return (
    <>
      {/* Syncs accent colour + background style from settings → DOM */}
      <AppearanceManager />

      <div data-active-tab={effectiveTab} className="tracker-app-shell min-h-screen flex flex-col bg-transparent text-espresso-950 dark:text-ivory-100 transition-colors duration-200 relative z-10 selection:bg-terracotta-100 selection:text-terracotta-700">
        {/* Clean Editorial Application Header */}
        <Header currentTab={effectiveTab} onSelectTab={handleSelectTab} />

        {/* Horizontal Fast Tab Strip */}
        <Navigation currentTab={effectiveTab} onSelectTab={handleSelectTab} />

        {/* Main Content Area */}
        <main className="flex-1 w-full max-w-[1680px] 2xl:max-w-[1840px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 py-6 sm:py-8">
          {isNotFound ? (
            <NotFoundView
              invalidRoute={window.location.hash || window.location.pathname}
              onNavigate={handleSelectTab}
            />
          ) : (
            <motion.div
              key={effectiveTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className={`w-full page-arrival ${['timetable', 'attendance', 'tests', 'planner', 'syllabus', 'reminders', 'classspace', 'dayos', 'gym', 'nutrition', 'eduhub'].includes(effectiveTab) ? 'app-theme-surface' : ''}`}
              onPointerEnter={trackWorkspacePointer}
              onPointerMove={trackWorkspacePointer}
              onPointerLeave={clearWorkspacePointer}
            >
              {effectiveTab === 'dashboard' && (
                <Dashboard
                  onNavigateToSyllabus={() => handleSelectTab('syllabus')}
                  onNavigateToFocus={() => handleSelectTab('focus')}
                  onNavigateToPlanner={() => handleSelectTab('planner')}
                  onNavigateToNutrition={() => handleSelectTab('nutrition')}
                  onNavigateToTests={() => handleSelectTab('tests')}
                  onNavigateToDayOS={() => handleSelectTab('dayos')}
                  onSelectTab={handleSelectTab}
                />
              )}
              {effectiveTab === 'dayos'      && <DayOSView onNavigateToTab={handleSelectTab} />}
              {effectiveTab === 'timetable'  && <TimetableView />}
              {effectiveTab === 'syllabus'   && <SyllabusView onNavigateToPlanner={() => handleSelectTab('planner')} />}
              {effectiveTab === 'planner'    && <PlannerView onNavigateToSyllabus={() => handleSelectTab('syllabus')} onOpenTaskFocus={handleOpenTaskFocus} />}
              {effectiveTab === 'tests'      && <TestsView onNavigateToPlanner={() => handleSelectTab('planner')} />}
              {effectiveTab === 'attendance' && <AttendanceView />}
              {effectiveTab === 'focus'      && <FocusView plannerFocusLaunch={plannerFocusLaunch} onPlannerFocusLaunchConsumed={() => setPlannerFocusLaunch(null)} />}
              {effectiveTab === 'gym'        && <GymView />}
              {effectiveTab === 'nutrition'  && <NutritionView />}
              {effectiveTab === 'bloom'      && <BloomView />}
              {effectiveTab === 'reminders'  && <RemindersView />}
              {effectiveTab === 'eduhub'     && <EduHubView />}
              {effectiveTab === 'classspace' && <ClassSpaceView onNavigateToSettings={() => handleSelectTab('settings')} />}
              {effectiveTab === 'settings'   && (
                <SettingsView
                  onNavigateToClassSpace={() => handleSelectTab('classspace')}
                />
              )}
            </motion.div>
          )}
        </main>

        <MiniDeepFocusPanel />

        {/* Global Persistent Floating Focus Radio 2.0 */}
        <MiniPlayer />

        {/* Global Persistent Active Workout Execution & Non-blocking Rest Timer */}
        <ActiveWorkoutModal />
        <ActiveWorkoutPill />
        <RestTimerBar />

        {/* Global Keyboard Shortcuts Dialog */}
        <KeyboardShortcutsDialog
          isOpen={isShortcutsOpen}
          onClose={() => setIsShortcutsOpen(false)}
        />

        {/* Interactive First-Time Student Onboarding Wizard */}
        <OnboardingWizard />

        {/* Standard Editorial Footer */}
        <footer className="border-t border-ivory-300/80 dark:border-white/10 py-6 text-center text-xs text-espresso-400 dark:text-espresso-500 font-serif italic">
          <p>
            <span>TRAKIFY</span> · Local-First &amp; Confidential
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
          <ToastProvider>
            <ClassSpaceProvider>
              <FocusRadioProvider>
                <MainApp />
              </FocusRadioProvider>
            </ClassSpaceProvider>
          </ToastProvider>
        </AppProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
