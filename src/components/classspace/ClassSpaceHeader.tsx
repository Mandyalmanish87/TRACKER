import React, { useState } from 'react';
import {
  Users,
  Copy,
  Check,
  Bell,
  Plus,
  LogIn,
  ChevronDown,
  Shield,
  ShieldCheck,
  GraduationCap,
  Sparkles,
} from 'lucide-react';
import { useClassSpace } from '../../context/ClassSpaceContext';

interface ClassSpaceHeaderProps {
  onCreateClick: () => void;
  onJoinClick: () => void;
  onToggleNotifications: () => void;
}

export const ClassSpaceHeader: React.FC<ClassSpaceHeaderProps> = ({
  onCreateClick,
  onJoinClick,
  onToggleNotifications,
}) => {
  const {
    workspaces,
    activeWorkspace,
    selectWorkspace,
    currentMember,
    unreadNotificationCount,
    isCloudConfigured,
  } = useClassSpace();

  const [copiedCode, setCopiedCode] = useState(false);
  const [showWorkspaceMenu, setShowWorkspaceMenu] = useState(false);

  const handleCopyCode = async () => {
    if (!activeWorkspace?.joinCode) return;
    try {
      await navigator.clipboard.writeText(activeWorkspace.joinCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      // Fallback
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  return (
    <div className="border-b border-ivory-300 dark:border-espresso-750 pb-5">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Workspace Brand & Info */}
        <div className="space-y-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="p-2 rounded-xl bg-terracotta-100 dark:bg-terracotta-950/60 text-terracotta-700 dark:text-terracotta-300">
              <Users className="w-5 h-5" />
            </span>

            {/* Workspace Selector or Title */}
            {workspaces.length > 1 ? (
              <div className="relative">
                <button
                  onClick={() => setShowWorkspaceMenu(!showWorkspaceMenu)}
                  className="flex items-center gap-1.5 font-serif text-2xl sm:text-3xl font-bold tracking-tight text-espresso-950 dark:text-ivory-50 hover:opacity-85 transition"
                >
                  <span>{activeWorkspace?.name || 'ClassSpace'}</span>
                  <ChevronDown className="w-5 h-5 text-espresso-400" />
                </button>

                {showWorkspaceMenu && (
                  <div className="absolute left-0 mt-2 w-72 rounded-2xl bg-white dark:bg-espresso-850 border border-ivory-300 dark:border-espresso-750 shadow-lg p-2 z-30 space-y-1">
                    <p className="px-3 py-1.5 text-[11px] font-mono font-semibold text-espresso-400 uppercase tracking-wider">
                      My Workspaces
                    </p>
                    {workspaces.map((w) => (
                      <button
                        key={w.id}
                        onClick={() => {
                          selectWorkspace(w.id);
                          setShowWorkspaceMenu(false);
                        }}
                        className={`w-full text-left px-3 py-2 rounded-xl text-xs font-medium transition flex items-center justify-between ${
                          w.id === activeWorkspace?.id
                            ? 'bg-espresso-100 dark:bg-espresso-750 text-espresso-950 dark:text-ivory-50 font-semibold'
                            : 'text-espresso-700 dark:text-espresso-300 hover:bg-ivory-100 dark:hover:bg-espresso-800'
                        }`}
                      >
                        <span className="truncate">{w.name}</span>
                        <span className="text-[10px] font-mono text-espresso-400 font-normal">
                          {w.joinCode}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-espresso-950 dark:text-ivory-50">
                {activeWorkspace?.name || 'ClassSpace'}
              </h1>
            )}

            {/* Role Badge */}
            {currentMember && (
              <span
                className={`text-[11px] font-mono font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full inline-flex items-center gap-1 ${
                  currentMember.role === 'cr'
                    ? 'bg-terracotta-100 text-terracotta-800 dark:bg-terracotta-950/70 dark:text-terracotta-300 border border-terracotta-200 dark:border-terracotta-900'
                    : currentMember.role === 'co_admin'
                    ? 'bg-sage-100 text-sage-800 dark:bg-sage-950/70 dark:text-sage-300 border border-sage-200 dark:border-sage-900'
                    : 'bg-ivory-200 text-espresso-700 dark:bg-espresso-800 dark:text-ivory-200 border border-ivory-300 dark:border-espresso-700'
                }`}
              >
                {currentMember.role === 'cr' ? (
                  <>
                    <ShieldCheck className="w-3 h-3 text-terracotta-600 dark:text-terracotta-400" />
                    <span>CR / Admin</span>
                  </>
                ) : currentMember.role === 'co_admin' ? (
                  <>
                    <Shield className="w-3 h-3 text-sage-600 dark:text-sage-400" />
                    <span>Co-Admin</span>
                  </>
                ) : (
                  <>
                    <GraduationCap className="w-3 h-3 text-espresso-500" />
                    <span>Student Member</span>
                  </>
                )}
              </span>
            )}

            {!isCloudConfigured && (
              <span className="text-[10px] font-mono text-ochre-700 dark:text-ochre-300 bg-ochre-50 dark:bg-ochre-950/50 border border-ochre-200 dark:border-ochre-800 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                <Sparkles className="w-2.5 h-2.5" /> Offline Test-Drive Mode
              </span>
            )}
          </div>

          {activeWorkspace && (
            <p className="text-xs text-espresso-500 dark:text-espresso-400 max-w-2xl">
              {[activeWorkspace.department, activeWorkspace.section, activeWorkspace.batch]
                .filter(Boolean)
                .join(' · ')}
              {activeWorkspace.description ? ` — ${activeWorkspace.description}` : ''}
            </p>
          )}
        </div>

        {/* Action Controls & Join Code */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {activeWorkspace && (
            <div className="flex items-center gap-1.5 p-1 pl-3 rounded-xl border border-ivory-300 dark:border-espresso-700 bg-white dark:bg-espresso-850 shadow-subtle">
              <div className="text-left">
                <span className="block text-[9px] font-mono uppercase tracking-wider text-espresso-400 dark:text-espresso-500 leading-tight">
                  Join Code
                </span>
                <span className="font-mono text-sm font-bold tracking-widest text-espresso-950 dark:text-ivory-50 select-all">
                  {activeWorkspace.joinCode}
                </span>
              </div>
              <button
                onClick={handleCopyCode}
                className="p-2 rounded-lg hover:bg-ivory-100 dark:hover:bg-espresso-800 text-espresso-600 dark:text-espresso-300 transition cursor-pointer"
                title="Copy Join Code to share with classmates"
              >
                {copiedCode ? (
                  <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>
          )}

          {/* Notifications Button */}
          <button
            onClick={onToggleNotifications}
            className="relative p-2.5 rounded-xl border border-ivory-300 dark:border-espresso-700 bg-white dark:bg-espresso-850 hover:bg-ivory-50 dark:hover:bg-espresso-800 text-espresso-700 dark:text-ivory-200 shadow-subtle transition cursor-pointer"
            title="ClassSpace Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadNotificationCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-600 text-white font-mono text-[10px] font-bold flex items-center justify-center animate-pulse">
                {unreadNotificationCount > 9 ? '9+' : unreadNotificationCount}
              </span>
            )}
          </button>

          {/* Join Another Class */}
          <button
            onClick={onJoinClick}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-ivory-300 dark:border-espresso-700 bg-white dark:bg-espresso-850 hover:bg-ivory-50 dark:hover:bg-espresso-800 text-xs font-semibold text-espresso-800 dark:text-ivory-100 shadow-subtle transition cursor-pointer"
          >
            <LogIn className="w-3.5 h-3.5 text-espresso-500" />
            <span>Join Class</span>
          </button>

          {/* Create New ClassSpace */}
          <button
            onClick={onCreateClick}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-terracotta-600 hover:bg-terracotta-700 text-white text-xs font-semibold shadow-subtle transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create ClassSpace</span>
          </button>
        </div>
      </div>
    </div>
  );
};

