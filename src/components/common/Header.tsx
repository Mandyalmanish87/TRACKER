import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { ThemeToggle } from './ThemeToggle';
import { Button } from './Button';
import { ConfirmModal } from './ConfirmModal';
import {
  Trash2,
  Download,
  Upload,
  Check,
  Calendar,
  RefreshCw,
  LogOut,
} from 'lucide-react';
import { exportCombinedICS, downloadICS } from '../../utils/icsExporter';

export const Header: React.FC = () => {
  const {
    state,
    clearSampleData,
    exportData,
    importData,
    authUser,
    syncStatus,
    lastSyncedAt,
    signInWithGoogle,
    signOut,
    syncNow,
  } = useApp();
  const [copiedBackup, setCopiedBackup] = useState(false);
  const [showDataMenu, setShowDataMenu] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [authErrorMessage, setAuthErrorMessage] = useState<string | null>(null);

  const formattedLastSynced = lastSyncedAt
    ? lastSyncedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  const handleSignIn = async () => {
    const res = await signInWithGoogle();
    if (res?.error) {
      setAuthErrorMessage(res.error);
    }
  };

  // Format today's date in editorial style
  const today = new Date();
  const dateStr = today.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const handleExport = () => {
    const data = exportData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tracker-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setCopiedBackup(true);
    setTimeout(() => setCopiedBackup(false), 2000);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const ok = importData(content);
        if (ok) {
          alert('Backup restored successfully!');
        } else {
          alert('Failed to restore backup: invalid format.');
        }
      }
    };
    reader.readAsText(file);
  };

  return (
    <header className="border-b border-ivory-300 dark:border-espresso-800 bg-white/70 dark:bg-espresso-900/70 backdrop-blur-md sticky top-0 z-30 transition-colors">
      <div className="w-full max-w-[1680px] 2xl:max-w-[1840px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Brand & Editorial Date */}
        <div className="flex items-center gap-4">
          <div className="flex items-baseline gap-1.5">
            <span className="font-serif text-2xl font-bold tracking-tight text-espresso-950 dark:text-ivory-50">
              TRACKER
            </span>
            <span className="w-2 h-2 rounded-full inline-block mb-1" style={{ backgroundColor: 'var(--accent)' }} />
          </div>

          <div className="h-4 w-px bg-ivory-300 dark:bg-espresso-700 hidden sm:block" />

          <p className="text-xs font-serif italic text-espresso-500 dark:text-espresso-400 hidden sm:block">
            {dateStr}
          </p>

          {/* Profile name badge */}
          {state.profile?.displayName?.trim() && (
            <span className="hidden md:inline-flex items-center gap-2 text-xs font-medium text-espresso-600 dark:text-espresso-300 bg-ivory-200 dark:bg-espresso-800 rounded-lg px-2.5 py-1">
              {state.profile?.avatarUrl ? (
                <img
                  src={state.profile.avatarUrl}
                  alt={state.profile.displayName}
                  className="w-4 h-4 rounded-full object-cover"
                />
              ) : (
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--accent)' }} />
              )}
              {state.profile.displayName.trim()}
            </span>
          )}
        </div>

        {/* Controls: Data separation banner, export/import, theme toggle */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Sample Data Purge Banner / Live Mode Indicator */}
          {state.hasSampleData ? (
            <div className="flex items-center gap-2 bg-terracotta-50 dark:bg-terracotta-900/30 border border-terracotta-200 dark:border-terracotta-800/60 rounded-xl px-2.5 py-1 text-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-terracotta-500 animate-pulse" />
              <span className="text-terracotta-700 dark:text-terracotta-300 font-medium">
                Demo Records
              </span>
              <button
                onClick={() => setShowClearConfirm(true)}
                className="text-[11px] underline font-medium text-terracotta-800 dark:text-terracotta-200 hover:text-terracotta-900 ml-1 inline-flex items-center gap-0.5 cursor-pointer"
                title="Purge sample data and start with an empty slate"
              >
                <Trash2 className="w-3 h-3 inline" />
                Clear
              </button>
            </div>
          ) : (
            <span className="sr-only">Live Data Mode</span>
          )}

          {/* Backup dropdown / buttons */}
          <div className="relative">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowDataMenu(!showDataMenu)}
              title="Backup and Restore Data"
            >
              Data
            </Button>

            {showDataMenu && (
              <div
                className="absolute right-0 mt-2 w-48 bg-white dark:bg-espresso-850 rounded-xl border border-ivory-300 dark:border-espresso-700 shadow-editorial dark:shadow-editorial-dark py-1.5 z-50 text-xs"
                onClick={() => setShowDataMenu(false)}
              >
                <button
                  onClick={handleExport}
                  className="w-full text-left px-3 py-2 flex items-center gap-2 text-espresso-700 dark:text-ivory-200 hover:bg-ivory-100 dark:hover:bg-espresso-800"
                >
                  {copiedBackup ? <Check className="w-3.5 h-3.5 text-sage-600" /> : <Download className="w-3.5 h-3.5" />}
                  Export JSON Backup
                </button>
                <button
                  onClick={() => {
                    const ics = exportCombinedICS(state.reminders, state.tasks || []);
                    downloadICS(ics, `tracker-schedule-${new Date().toISOString().split('T')[0]}.ics`);
                  }}
                  className="w-full text-left px-3 py-2 flex items-center gap-2 text-espresso-700 dark:text-ivory-200 hover:bg-ivory-100 dark:hover:bg-espresso-800"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  Export Calendar (.ics)
                </button>
                <label className="w-full text-left px-3 py-2 flex items-center gap-2 text-espresso-700 dark:text-ivory-200 hover:bg-ivory-100 dark:hover:bg-espresso-800 cursor-pointer">
                  <Upload className="w-3.5 h-3.5" />
                  Restore from JSON
                  <input
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={handleImportFile}
                  />
                </label>
              </div>
            )}
          </div>

          {/* Google Sign-in & Sync Status */}
          {authUser ? (
            <div className="flex items-center gap-2">
              {/* Dedicated Honest Sync Status Pill */}
              <button
                type="button"
                onClick={syncStatus === 'offline' || syncStatus === 'error' ? syncNow : undefined}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition ${
                  syncStatus === 'synced'
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/50 cursor-default'
                    : syncStatus === 'syncing'
                    ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/50 cursor-default'
                    : syncStatus === 'offline'
                    ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/50 hover:bg-amber-100 cursor-pointer'
                    : syncStatus === 'error'
                    ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/50 hover:bg-rose-100 cursor-pointer'
                    : 'bg-ivory-100 dark:bg-espresso-800 text-espresso-600 dark:text-ivory-300 border-ivory-300 dark:border-espresso-700 cursor-default'
                }`}
                title={
                  syncStatus === 'synced'
                    ? `Synced with cloud${formattedLastSynced ? ` at ${formattedLastSynced}` : ''}`
                    : syncStatus === 'syncing'
                    ? 'Synchronizing changes with cloud...'
                    : syncStatus === 'offline'
                    ? 'Offline: changes saved locally on this device. Click to retry sync.'
                    : syncStatus === 'error'
                    ? 'Sync error: click to retry.'
                    : 'Cloud status: idle'
                }
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    syncStatus === 'synced'
                      ? 'bg-emerald-500'
                      : syncStatus === 'syncing'
                      ? 'bg-amber-500 animate-ping'
                      : syncStatus === 'offline'
                      ? 'bg-amber-500'
                      : syncStatus === 'error'
                      ? 'bg-rose-500'
                      : 'bg-espresso-400'
                  }`}
                />
                <span className="hidden sm:inline">
                  {syncStatus === 'synced'
                    ? 'Synced'
                    : syncStatus === 'syncing'
                    ? 'Syncing...'
                    : syncStatus === 'offline'
                    ? 'Offline (Saved locally)'
                    : syncStatus === 'error'
                    ? 'Sync error (Retry)'
                    : 'Local'}
                </span>
                <span className="sm:hidden">
                  {syncStatus === 'synced'
                    ? 'Synced'
                    : syncStatus === 'syncing'
                    ? 'Syncing'
                    : syncStatus === 'offline'
                    ? 'Offline'
                    : syncStatus === 'error'
                    ? 'Error'
                    : 'Local'}
                </span>
              </button>

              <div className="relative">
                <button
                  onClick={() => setShowAccountMenu(!showAccountMenu)}
                  className="flex items-center gap-2 p-1.5 rounded-xl border border-ivory-300 dark:border-espresso-750 bg-white dark:bg-espresso-850 hover:bg-ivory-50 dark:hover:bg-espresso-800 transition cursor-pointer text-xs"
                >
                  <div className="w-6 h-6 rounded-full overflow-hidden bg-terracotta-100 dark:bg-terracotta-950 flex items-center justify-center font-bold text-terracotta-700 dark:text-terracotta-300 text-xs">
                    {state.profile?.avatarUrl || authUser.avatarUrl ? (
                      <img src={state.profile?.avatarUrl || authUser.avatarUrl} alt={authUser.name || 'User'} className="w-full h-full object-cover" />
                    ) : (
                      (authUser.name || authUser.email)[0].toUpperCase()
                    )}
                  </div>
                  <div className="hidden lg:flex items-center gap-1.5 text-xs font-medium text-espresso-800 dark:text-ivory-200">
                    <span className="truncate max-w-[120px]">{authUser.name || authUser.email.split('@')[0]}</span>
                  </div>
                </button>

                {showAccountMenu && (
                  <div
                    className="absolute right-0 mt-2 w-64 bg-white dark:bg-espresso-850 rounded-xl border border-ivory-300 dark:border-espresso-750 shadow-editorial dark:shadow-editorial-dark py-2 z-50 text-xs space-y-1"
                    onClick={() => setShowAccountMenu(false)}
                  >
                    <div className="px-3.5 py-2 border-b border-ivory-200 dark:border-espresso-800">
                      <p className="font-semibold text-espresso-950 dark:text-ivory-50 truncate">
                        {authUser.name || 'Scholar Student'}
                      </p>
                      <p className="text-[11px] font-mono text-espresso-500 dark:text-ivory-400 truncate">
                        {authUser.email}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1.5 text-[10px] font-mono text-espresso-600 dark:text-ivory-300">
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            syncStatus === 'synced'
                              ? 'bg-emerald-500'
                              : syncStatus === 'syncing'
                              ? 'bg-amber-500 animate-ping'
                              : syncStatus === 'offline'
                              ? 'bg-amber-500'
                              : 'bg-rose-500'
                          }`}
                        />
                        <span>
                          {syncStatus === 'synced'
                            ? `Synced ${formattedLastSynced ? `(${formattedLastSynced})` : ''}`
                            : syncStatus === 'syncing'
                            ? 'Syncing in progress...'
                            : syncStatus === 'offline'
                            ? 'Offline: saved locally'
                            : 'Sync error: click retry'}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={syncNow}
                      className="w-full text-left px-3.5 py-2 flex items-center gap-2 text-espresso-700 dark:text-ivory-200 hover:bg-ivory-100 dark:hover:bg-espresso-800 cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 text-terracotta-500 ${syncStatus === 'syncing' ? 'animate-spin' : ''}`} />
                      <span>{syncStatus === 'syncing' ? 'Syncing...' : 'Sync Cloud Now'}</span>
                    </button>

                    <button
                      onClick={signOut}
                      className="w-full text-left px-3.5 py-2 flex items-center gap-2 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <button
              onClick={handleSignIn}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-ivory-300 dark:border-espresso-750 bg-white dark:bg-espresso-850 hover:bg-ivory-50 dark:hover:bg-espresso-800 text-xs font-semibold text-espresso-900 dark:text-ivory-100 shadow-xs transition cursor-pointer"
              title="Sign in with Google to sync schedule and study data across devices"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Sign in with Google</span>
            </button>
          )}

          {/* Theme switcher */}
          <ThemeToggle />
        </div>
      </div>

      {/* Confirmation modal before clearing sample data */}
      <ConfirmModal
        isOpen={showClearConfirm}
        title="Clear Demo Records"
        message="Are you sure you want to remove all demonstration records? Any custom records you have created will be preserved."
        confirmLabel="Clear Demo Data"
        cancelLabel="Keep"
        variant="warning"
        onConfirm={() => {
          clearSampleData();
          setShowClearConfirm(false);
        }}
        onCancel={() => setShowClearConfirm(false)}
      />

      {/* Cloud auth error notice */}
      <ConfirmModal
        isOpen={Boolean(authErrorMessage)}
        title="Cloud Sign-In Unavailable"
        message={authErrorMessage || ''}
        confirmLabel="Understood"
        variant="warning"
        onConfirm={() => setAuthErrorMessage(null)}
        onCancel={() => setAuthErrorMessage(null)}
      />
    </header>
  );
};
