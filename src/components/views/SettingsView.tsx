import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { useTheme } from '../../theme/ThemeContext';
import { AccentColor, BackgroundStyle, ThemeMode } from '../../types';
import {
  Sun,
  Moon,
  Monitor,
  Check,
  User,
  Palette,
  Settings,
  Eye,
  Radio,
  CalendarClock,
  Clock,
  GraduationCap,
  RotateCcw,
  Info,
  Target,
  BookOpen,
  Cloud,
  RefreshCw,
  Building,
  Users,
  ArrowRight,
  KeyRound,
  Copy,
  ShieldCheck,
  Trash2,
  LogOut,
  CheckCircle2,
  Plus,
  LogIn,
  Camera,
  Upload,
  Mail,
  School,
  Hash,
} from 'lucide-react';
import { useOptionalClassSpace } from '../../context/ClassSpaceContext';
import { getAvatarBgColor, getAvatarInitials } from '../../utils/classSpaceUtils';
import { CreateWorkspaceModal } from '../classspace/CreateWorkspaceModal';
import { JoinWorkspaceModal } from '../classspace/JoinWorkspaceModal';
import { ConfirmModal } from '../common/ConfirmModal';

// ─── Accent Color Catalogue ────────────────────────────────────────────────
const ACCENT_OPTIONS: { id: AccentColor; label: string; hex: string }[] = [
  { id: 'terracotta', label: 'Terracotta', hex: '#C45532' },
  { id: 'sage',       label: 'Forest Sage', hex: '#436650' },
  { id: 'ochre',      label: 'Ochre',       hex: '#B8732E' },
  { id: 'dusty-blue', label: 'Dusty Blue',  hex: '#4A6FA5' },
  { id: 'plum',       label: 'Plum',        hex: '#7B4F8A' },
  { id: 'slate',      label: 'Slate',       hex: '#5A6E7F' },
];

// ─── Background Style Catalogue ───────────────────────────────────────────
const BG_OPTIONS: { id: BackgroundStyle; label: string; desc: string }[] = [
  { id: 'minimal',  label: 'Minimal',  desc: 'Clean flat surface' },
  { id: 'abstract', label: 'Abstract', desc: 'Subtle geometric pattern' },
  { id: 'space',    label: 'Space',    desc: 'Deep-space gradient' },
  { id: 'ocean',    label: 'Ocean',    desc: 'Serene coastal gradient' },
  { id: 'custom',   label: 'Custom',   desc: 'Your own image URL' },
];

// ─── Preset Avatars Catalogue ─────────────────────────────────────────────
const PRESET_AVATARS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=160&h=160&fit=crop&crop=faces',
  'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=160&h=160&fit=crop&crop=faces',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=160&h=160&fit=crop&crop=faces',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=160&h=160&fit=crop&crop=faces',
  'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=160&h=160&fit=crop&crop=faces',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=160&h=160&fit=crop&crop=faces',
];

// ─── Section heading helper ────────────────────────────────────────────────
const SectionHeading: React.FC<{ icon: React.ReactNode; title: string; sub?: string }> = ({
  icon, title, sub,
}) => (
  <div className="flex items-start gap-3 mb-5">
    <div className="mt-0.5 p-2 rounded-xl bg-ivory-100 dark:bg-espresso-800 text-espresso-700 dark:text-espresso-300">
      {icon}
    </div>
    <div>
      <h2 className="text-sm font-semibold text-espresso-950 dark:text-ivory-50">
        {title}
      </h2>
      {sub && <p className="text-xs text-espresso-400 dark:text-espresso-500 mt-0.5">{sub}</p>}
    </div>
  </div>
);

// ─── Card wrapper ──────────────────────────────────────────────────────────
const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div
    className={`p-5 sm:p-6 rounded-2xl border border-ivory-300 dark:border-espresso-750 bg-white dark:bg-espresso-850 shadow-subtle ${className}`}
  >
    {children}
  </div>
);

// ─── App Version ──────────────────────────────────────────────────────────────
const APP_VERSION = '0.8.0';

interface SettingsViewProps {
  onNavigateToClassSpace?: () => void;
}

// ─── Main SettingsView ──────────────────────────────────────────────────────
export const SettingsView: React.FC<SettingsViewProps> = ({ onNavigateToClassSpace }) => {
  const {
    state,
    updateSettings,
    updateProfile,
    fullReset,
    setDailyQuestionTarget,
    updateReviewIntervals,
    authUser,
    syncStatus,
    lastSyncedAt,
    signInWithGoogle,
    signOut,
    syncNow,
  } = useApp();
  const { mode, setMode } = useTheme();
  const classSpace = useOptionalClassSpace();
  const activeWorkspace = classSpace?.activeWorkspace || null;
  const isOwner = classSpace?.isOwner || false;
  const isCR = classSpace?.isCR || false;
  const isCoAdmin = classSpace?.isCoAdmin || false;
  const members = classSpace?.members || [];

  const [showCreateWsModal, setShowCreateWsModal] = useState(false);
  const [showJoinWsModal, setShowJoinWsModal] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [confirmLeaveOpen, setConfirmLeaveOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [confirmRotateOpen, setConfirmRotateOpen] = useState(false);
  const [classActionError, setClassActionError] = useState<string | null>(null);

  const settings = state.settings ?? {
    themeMode: 'system' as ThemeMode,
    accentColor: 'terracotta' as AccentColor,
    backgroundStyle: 'minimal' as BackgroundStyle,
    studyDayRolloverHour: 0,
    showExamCountdown: true,
    showFocusRadio: false,
  };

  const profile = state.profile ?? { displayName: '', targetExam: '' };

  // Local profile edit state
  const [displayName, setDisplayName]   = useState(profile.displayName || '');
  const [targetExam,  setTargetExam]    = useState(profile.targetExam ?? '');
  const [examDate,    setExamDate]      = useState(profile.examDate ?? '');
  const [avatarUrl,   setAvatarUrl]     = useState(profile.avatarUrl ?? '');
  const [email,       setEmail]         = useState(profile.email ?? '');
  const [institution, setInstitution]   = useState(profile.institution ?? '');
  const [department,  setDepartment]    = useState(profile.department ?? '');
  const [studentId,   setStudentId]     = useState(profile.studentId ?? '');
  const [bio,         setBio]           = useState(profile.bio ?? '');
  const [profileSaved, setProfileSaved] = useState(false);
  const [avatarError, setAvatarError]   = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [customBgUrl, setCustomBgUrl] = useState(settings.customBackgroundUrl ?? '');

  // Full reset state
  const [resetText, setResetText] = useState('');
  const [resetDone, setResetDone] = useState(false);

  // Daily question target local state
  const [questionTarget, setQuestionTarget] = useState(state.dailyQuestionTarget ?? 25);
  const [qtSaved, setQtSaved] = useState(false);

  // Review intervals local state
  const DEFAULT_INTERVALS = state.reviewIntervals ?? [1, 3, 7, 14, 30];
  const [intervalInput, setIntervalInput] = useState(DEFAULT_INTERVALS.join(', '));
  const [intervalError, setIntervalError] = useState('');
  const [intervalSaved, setIntervalSaved] = useState(false);

  // Keep local state in sync when state loads or updates
  React.useEffect(() => {
    if (state.profile) {
      setDisplayName(state.profile.displayName ?? '');
      setTargetExam(state.profile.targetExam ?? '');
      setExamDate(state.profile.examDate ?? '');
      setAvatarUrl(state.profile.avatarUrl ?? '');
      setEmail(state.profile.email ?? '');
      setInstitution(state.profile.institution ?? '');
      setDepartment(state.profile.department ?? '');
      setStudentId(state.profile.studentId ?? '');
      setBio(state.profile.bio ?? '');
    }
  }, [state.profile]);

  React.useEffect(() => {
    if (state.settings?.customBackgroundUrl !== undefined) {
      setCustomBgUrl(state.settings.customBackgroundUrl);
    }
  }, [state.settings?.customBackgroundUrl]);

  const handleThemeChange = (newMode: ThemeMode) => {
    setMode(newMode);
    updateSettings({ themeMode: newMode });
  };

  const handleAccentChange = (accent: AccentColor) => {
    updateSettings({ accentColor: accent });
  };

  const handleBgChange = (bg: BackgroundStyle) => {
    updateSettings({ backgroundStyle: bg });
  };

  const profileTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const qtTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (profileTimeoutRef.current) clearTimeout(profileTimeoutRef.current);
      if (qtTimeoutRef.current) clearTimeout(qtTimeoutRef.current);
    };
  }, []);

  const handleSaveProfile = () => {
    updateProfile({
      displayName,
      targetExam,
      examDate: examDate || undefined,
      avatarUrl: avatarUrl || undefined,
      email: email || undefined,
      institution: institution || undefined,
      department: department || undefined,
      studentId: studentId || undefined,
      bio: bio || undefined,
    });
    // Sync with ClassSpace profile if connected
    if (classSpace?.updateProfile) {
      classSpace.updateProfile({
        displayName,
        avatarUrl: avatarUrl || undefined,
      }).catch(() => {});
    }
    if (profileTimeoutRef.current) clearTimeout(profileTimeoutRef.current);
    setProfileSaved(true);
    profileTimeoutRef.current = setTimeout(() => {
      if (typeof window !== 'undefined') setProfileSaved(false);
    }, 2000);
  };

  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setAvatarError('Please select a valid image file (PNG, JPG, WebP, etc.)');
      return;
    }

    if (file.size > 4 * 1024 * 1024) {
      setAvatarError('Image must be under 4MB');
      return;
    }

    setAvatarError(null);
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setAvatarUrl(result);
      updateProfile({
        displayName,
        targetExam,
        examDate: examDate || undefined,
        avatarUrl: result,
        email: email || undefined,
        institution: institution || undefined,
        department: department || undefined,
        studentId: studentId || undefined,
        bio: bio || undefined,
      });
      if (classSpace?.updateProfile) {
        classSpace.updateProfile({ displayName, avatarUrl: result }).catch(() => {});
      }
      setProfileSaved(true);
      if (profileTimeoutRef.current) clearTimeout(profileTimeoutRef.current);
      profileTimeoutRef.current = setTimeout(() => {
        if (typeof window !== 'undefined') setProfileSaved(false);
      }, 2000);
    };
    reader.onerror = () => {
      setAvatarError('Failed to read image file');
    };
    reader.readAsDataURL(file);
  };

  const handleSelectPresetAvatar = (url: string) => {
    setAvatarUrl(url);
    setAvatarError(null);
    updateProfile({
      displayName,
      targetExam,
      examDate: examDate || undefined,
      avatarUrl: url,
      email: email || undefined,
      institution: institution || undefined,
      department: department || undefined,
      studentId: studentId || undefined,
      bio: bio || undefined,
    });
    if (classSpace?.updateProfile) {
      classSpace.updateProfile({ displayName, avatarUrl: url }).catch(() => {});
    }
    setProfileSaved(true);
    if (profileTimeoutRef.current) clearTimeout(profileTimeoutRef.current);
    profileTimeoutRef.current = setTimeout(() => {
      if (typeof window !== 'undefined') setProfileSaved(false);
    }, 2000);
  };

  const handleRemoveAvatar = () => {
    setAvatarUrl('');
    setAvatarError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    updateProfile({
      displayName,
      targetExam,
      examDate: examDate || undefined,
      avatarUrl: undefined,
      email: email || undefined,
      institution: institution || undefined,
      department: department || undefined,
      studentId: studentId || undefined,
      bio: bio || undefined,
    });
    if (classSpace?.updateProfile) {
      classSpace.updateProfile({ displayName, avatarUrl: undefined }).catch(() => {});
    }
  };

  return (
    <div className="space-y-8 pb-20">
      {/* Page header */}
      <div className="border-b border-ivory-300 dark:border-espresso-800 pb-6">
        <span className="text-xs font-mono font-semibold uppercase tracking-wider text-terracotta-600 dark:text-terracotta-400">
          Personalisation &amp; Appearance
        </span>
        <div className="flex items-end justify-between gap-3 mt-1">
          <h1 className="font-serif text-3xl sm:text-4xl font-normal text-espresso-950 dark:text-ivory-50 tracking-tight">
            Settings
          </h1>
          <Settings className="w-6 h-6 text-espresso-400 dark:text-espresso-500 mb-1" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── Google Account & Cloud Synchronization ── */}
        <Card className="lg:col-span-2">
          <SectionHeading
            icon={<Cloud className="w-4 h-4" />}
            title="Google Account & Cloud Synchronization"
            sub="Sync your timetable, study tasks, and attendance across all devices"
          />

          {authUser ? (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-ivory-100 dark:bg-espresso-800 border border-ivory-200 dark:border-espresso-750">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full overflow-hidden bg-terracotta-100 dark:bg-terracotta-900 text-terracotta-700 dark:text-terracotta-300 font-bold flex items-center justify-center text-sm">
                    {authUser.avatarUrl ? (
                      <img src={authUser.avatarUrl} alt={authUser.name || 'User'} className="w-full h-full object-cover" />
                    ) : (
                      (authUser.name || authUser.email)[0].toUpperCase()
                    )}
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-espresso-950 dark:text-ivory-50">
                      {authUser.name || 'Scholar Student'}
                    </h4>
                    <p className="text-xs font-mono text-espresso-500 dark:text-ivory-400">
                      {authUser.email}
                    </p>
                  </div>
                </div>

                <div className="sm:text-right">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-semibold bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    {syncStatus === 'syncing' ? 'Syncing...' : 'Connected'}
                  </span>
                  {lastSyncedAt && (
                    <p className="text-[10px] text-espresso-400 dark:text-ivory-400 font-mono mt-1">
                      Last sync: {lastSyncedAt.toLocaleTimeString()}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={syncNow}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-terracotta-600 hover:bg-terracotta-700 text-white shadow-subtle transition flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Sync Cloud Now</span>
                </button>
                <button
                  onClick={signOut}
                  className="px-4 py-2 rounded-xl text-xs font-medium border border-rose-200 dark:border-rose-900 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition cursor-pointer"
                >
                  Sign Out
                </button>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-ivory-100/70 dark:bg-espresso-800/70 border border-ivory-200 dark:border-espresso-750 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-espresso-950 dark:text-ivory-50">
                  Enable Google Multi-Device Cloud Sync
                </p>
                <p className="text-xs text-espresso-500 dark:text-ivory-400 mt-0.5 max-w-xl">
                  Sign in with your Google account to automatically back up and access your timetable, syllabus tracker, and study streaks from any phone, tablet, or browser.
                </p>
              </div>
              <button
                onClick={signInWithGoogle}
                className="shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl border border-ivory-300 dark:border-espresso-700 bg-white dark:bg-espresso-850 hover:bg-ivory-50 dark:hover:bg-espresso-800 text-xs font-semibold text-espresso-900 dark:text-ivory-100 shadow-subtle transition cursor-pointer"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span>Sign in with Google</span>
              </button>
            </div>
          )}
        </Card>

        {/* ── User Mode (Type A — Individual vs Type B — Class-based) ── */}
        <Card className="lg:col-span-2">
          <SectionHeading
            icon={<Users className="w-4 h-4 text-terracotta-600 dark:text-terracotta-400" />}
            title="User Mode"
            sub="Choose your student experience: private self-study or collaborative class workspace"
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Mode A: Individual */}
            <div
              onClick={() => updateSettings({ userMode: 'individual' })}
              className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                (settings.userMode || 'individual') === 'individual'
                  ? 'border-terracotta-500 bg-terracotta-50/40 dark:bg-terracotta-950/20 shadow-xs'
                  : 'border-ivory-200 dark:border-espresso-750 bg-ivory-50/50 dark:bg-espresso-900/50 hover:border-ivory-300'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-terracotta-600 dark:text-terracotta-400" />
                    <h4 className="font-semibold text-sm text-espresso-950 dark:text-ivory-50">
                      Type A — Individual
                    </h4>
                  </div>
                  {(settings.userMode || 'individual') === 'individual' && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-terracotta-600 text-white">
                      Active
                    </span>
                  )}
                </div>
                <p className="text-xs text-espresso-600 dark:text-ivory-300 leading-relaxed">
                  For self-directed students who study independently. Manage your own private timetable, custom subjects, personal attendance, and study logs without belonging to a shared batch.
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-ivory-200 dark:border-espresso-800 text-[11px] text-espresso-400 dark:text-espresso-500">
                ClassSpace navigation and shared class controls are hidden. All personal data is 100% private.
              </div>
            </div>

            {/* Mode B: Class-based */}
            <div
              onClick={() => updateSettings({ userMode: 'class_based' })}
              className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                settings.userMode === 'class_based'
                  ? 'border-terracotta-500 bg-terracotta-50/40 dark:bg-terracotta-950/20 shadow-xs'
                  : 'border-ivory-200 dark:border-espresso-750 bg-ivory-50/50 dark:bg-espresso-900/50 hover:border-ivory-300'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Building className="w-4 h-4 text-terracotta-600 dark:text-terracotta-400" />
                    <h4 className="font-semibold text-sm text-espresso-950 dark:text-ivory-50">
                      Type B — Class-based
                    </h4>
                  </div>
                  {settings.userMode === 'class_based' && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-terracotta-600 text-white">
                      Active
                    </span>
                  )}
                </div>
                <p className="text-xs text-espresso-600 dark:text-ivory-300 leading-relaxed">
                  For students who belong to a shared college class, section, or batch. Synchronizes the official CR timetable and class reschedule alerts, unlocks the student community and directory.
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-ivory-200 dark:border-espresso-800 text-[11px] text-espresso-400 dark:text-espresso-500">
                Personal attendance remains strictly isolated to your own account.
              </div>
            </div>
          </div>
        </Card>

        {/* ── ClassSpace Workspace & Configuration (Visible ONLY in Class-based mode) ── */}
        {settings.userMode === 'class_based' && (
          <Card className="lg:col-span-2">
            <SectionHeading
              icon={<Building className="w-4 h-4 text-terracotta-600 dark:text-terracotta-400" />}
              title="ClassSpace Management & Membership"
              sub="Manage your class workspace, Join Code, member roles, and community status"
            />

            {classActionError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300 font-medium">
                {classActionError}
              </div>
            )}

            {activeWorkspace ? (
              <div className="space-y-6">
                {/* 1. Class Info & Role Banner */}
                <div className="p-4 sm:p-5 rounded-xl bg-ivory-100/70 dark:bg-espresso-800/70 border border-ivory-200 dark:border-espresso-750 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-bold text-espresso-950 dark:text-ivory-50 truncate">
                        {activeWorkspace.name}
                      </h3>
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-terracotta-100 dark:bg-terracotta-950/60 text-terracotta-700 dark:text-terracotta-300 border border-terracotta-200 dark:border-terracotta-800">
                        {isOwner ? 'Workspace Owner' : isCR ? 'CR / Administrator' : isCoAdmin ? 'Co-Admin' : 'Student Member'}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-espresso-500 dark:text-espresso-400">
                      {activeWorkspace.institution && (
                        <span>{activeWorkspace.institution}</span>
                      )}
                      {activeWorkspace.department && (
                        <span>{activeWorkspace.department}</span>
                      )}
                      {activeWorkspace.section && (
                        <span>{activeWorkspace.section}</span>
                      )}
                      {activeWorkspace.batch && (
                        <span>Batch: {activeWorkspace.batch}</span>
                      )}
                    </div>
                  </div>

                  {onNavigateToClassSpace && (
                    <button
                      onClick={onNavigateToClassSpace}
                      className="shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-terracotta-600 hover:bg-terracotta-700 text-white shadow-subtle transition cursor-pointer"
                    >
                      <span>Open Community &amp; Classmates</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* 2. Permissions explanation */}
                <div className="p-4 rounded-xl bg-ivory-50 dark:bg-espresso-900 border border-ivory-200 dark:border-espresso-800 flex items-start gap-3">
                  <ShieldCheck className="w-5 h-5 text-terracotta-600 shrink-0 mt-0.5" />
                  <div className="text-xs space-y-1">
                    <p className="font-semibold text-espresso-950 dark:text-ivory-50">
                      Permissions for your role ({isOwner ? 'Owner' : isCR ? 'CR' : isCoAdmin ? 'Co-Admin' : 'Member'}):
                    </p>
                    <p className="text-espresso-600 dark:text-ivory-300 leading-relaxed">
                      {isOwner
                        ? 'Full administrative control: You can manage official timetables, rotate join codes, manage members, and delete or archive this workspace.'
                        : isCR || isCoAdmin
                        ? 'Timetable & Community authority: You can add official recurring classes, add extra sessions, reschedule or cancel occurrences with reason notes, and moderate chat messages.'
                        : 'Member access: You view the official shared timetable and receive instant reschedule alerts. Your attendance records remain strictly private to your own account.'}
                    </p>
                  </div>
                </div>

                {/* 3. Join Code & Member Management */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl border border-ivory-200 dark:border-espresso-750 bg-white dark:bg-espresso-850 space-y-3">
                    <span className="text-xs font-mono font-semibold uppercase tracking-wider text-espresso-500 dark:text-espresso-400 flex items-center gap-1.5">
                      <KeyRound className="w-3.5 h-3.5 text-terracotta-600" />
                      ClassSpace Join Code
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-2xl font-bold tracking-widest text-espresso-950 dark:text-ivory-50 bg-ivory-100 dark:bg-espresso-800 px-3 py-1 rounded-lg">
                        {activeWorkspace.joinCode}
                      </span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(activeWorkspace.joinCode);
                          setCodeCopied(true);
                          setTimeout(() => setCodeCopied(false), 2000);
                        }}
                        className="px-3 py-1.5 rounded-lg border border-ivory-300 dark:border-espresso-700 text-xs font-semibold hover:bg-ivory-100 dark:hover:bg-espresso-800 transition flex items-center gap-1.5 cursor-pointer"
                      >
                        {codeCopied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{codeCopied ? 'Copied!' : 'Copy Code'}</span>
                      </button>
                    </div>
                    {(isOwner || isCR) && (
                      <div className="pt-1">
                        <button
                          onClick={() => setConfirmRotateOpen(true)}
                          className="text-xs text-terracotta-600 dark:text-terracotta-400 hover:underline cursor-pointer flex items-center gap-1"
                        >
                          <RefreshCw className="w-3 h-3" />
                          <span>Rotate Join Code (if compromised)</span>
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="p-4 rounded-xl border border-ivory-200 dark:border-espresso-750 bg-white dark:bg-espresso-850 space-y-3 flex flex-col justify-between">
                    <div>
                      <span className="text-xs font-mono font-semibold uppercase tracking-wider text-espresso-500 dark:text-espresso-400 flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-terracotta-600" />
                        Class Roster
                      </span>
                      <p className="font-semibold text-lg text-espresso-950 dark:text-ivory-50 mt-1">
                        {members.length} enrolled student{members.length !== 1 ? 's' : ''}
                      </p>
                      <p className="text-xs text-espresso-500 dark:text-espresso-400">
                        View profiles, role badges, and classmate contact information.
                      </p>
                    </div>
                    {onNavigateToClassSpace && (
                      <button
                        onClick={onNavigateToClassSpace}
                        className="text-xs font-semibold text-terracotta-600 dark:text-terracotta-400 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <span>View Class Directory</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>

                {/* 4. Danger Zone: Leave or Delete ClassSpace */}
                <div className="pt-3 border-t border-ivory-200 dark:border-espresso-800 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => setShowJoinWsModal(true)}
                      className="px-3.5 py-2 rounded-xl text-xs font-semibold border border-ivory-300 dark:border-espresso-700 hover:bg-ivory-100 dark:hover:bg-espresso-800 text-espresso-800 dark:text-ivory-100 transition cursor-pointer flex items-center gap-1.5"
                    >
                      <LogIn className="w-3.5 h-3.5" />
                      <span>Join Another Class</span>
                    </button>
                    <button
                      onClick={() => setShowCreateWsModal(true)}
                      className="px-3.5 py-2 rounded-xl text-xs font-semibold border border-ivory-300 dark:border-espresso-700 hover:bg-ivory-100 dark:hover:bg-espresso-800 text-espresso-800 dark:text-ivory-100 transition cursor-pointer flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Create Another Class</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    {!isOwner ? (
                      <button
                        onClick={() => setConfirmLeaveOpen(true)}
                        className="px-3.5 py-2 rounded-xl text-xs font-semibold border border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition cursor-pointer flex items-center gap-1.5"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Leave ClassSpace</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteOpen(true)}
                        className="px-3.5 py-2 rounded-xl text-xs font-semibold border border-rose-300 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition cursor-pointer flex items-center gap-1.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete ClassSpace</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-6 rounded-xl bg-ivory-100/70 dark:bg-espresso-800/70 border border-ivory-200 dark:border-espresso-750 text-center space-y-4">
                <div className="max-w-md mx-auto space-y-1.5">
                  <h4 className="text-base font-bold text-espresso-950 dark:text-ivory-50">
                    Not Enrolled in a ClassSpace Yet
                  </h4>
                  <p className="text-xs text-espresso-500 dark:text-espresso-400 leading-relaxed">
                    You have selected Class-based mode. Connect with your class batch to synchronize your daily lecture timetable and join class discussions.
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                  <button
                    onClick={() => setShowJoinWsModal(true)}
                    className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-terracotta-600 hover:bg-terracotta-700 text-white shadow-subtle transition flex items-center gap-2 cursor-pointer"
                  >
                    <LogIn className="w-4 h-4" />
                    <span>Join Class with Code</span>
                  </button>
                  <button
                    onClick={() => setShowCreateWsModal(true)}
                    className="px-5 py-2.5 rounded-xl text-xs font-semibold border border-ivory-300 dark:border-espresso-700 bg-white dark:bg-espresso-850 hover:bg-ivory-50 dark:hover:bg-espresso-800 text-espresso-900 dark:text-ivory-100 shadow-subtle transition flex items-center gap-2 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Create ClassSpace (for CRs)</span>
                  </button>
                </div>
              </div>
            )}
          </Card>
        )}

        {/* ── Personal Info & Profile Picture (PFP) ── */}
        <Card className="lg:col-span-2">
          <SectionHeading
            icon={<User className="w-4 h-4 text-terracotta-600 dark:text-terracotta-400" />}
            title="Personal Info & Profile Picture (PFP)"
            sub="Customize your avatar photo, student details, contact info, and academic target"
          />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left Column: Profile Picture (PFP) */}
            <div className="lg:col-span-4 flex flex-col items-center p-5 rounded-2xl bg-ivory-50/70 dark:bg-espresso-900/60 border border-ivory-200 dark:border-espresso-750 text-center">
              <span className="text-xs font-mono font-semibold uppercase tracking-wider text-espresso-500 dark:text-espresso-400 mb-3">
                Profile Picture (PFP)
              </span>

              {/* Avatar Preview */}
              <div className="relative group mb-3">
                <div
                  className="w-28 h-28 rounded-full overflow-hidden border-4 border-white dark:border-espresso-800 shadow-md flex items-center justify-center text-3xl font-bold transition"
                  style={{
                    backgroundColor: avatarUrl ? 'transparent' : getAvatarBgColor(displayName || 'Scholar'),
                    color: '#ffffff',
                  }}
                >
                  {avatarUrl ? (
                    <img src={avatarUrl} alt={displayName || 'User'} className="w-full h-full object-cover" />
                  ) : authUser?.avatarUrl ? (
                    <img src={authUser.avatarUrl} alt={displayName || 'User'} className="w-full h-full object-cover" />
                  ) : (
                    getAvatarInitials(displayName || 'Scholar')
                  )}
                </div>

                {/* Upload overlay button */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-0 right-0 p-2 rounded-full bg-terracotta-600 hover:bg-terracotta-700 text-white shadow-md transition cursor-pointer"
                  title="Upload profile picture"
                >
                  <Camera className="w-4 h-4" />
                </button>
              </div>

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarFileChange}
                className="hidden"
                aria-label="Upload profile picture"
              />

              <div className="flex flex-wrap items-center justify-center gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1.5 rounded-xl border border-ivory-300 dark:border-espresso-700 bg-white dark:bg-espresso-850 hover:bg-ivory-100 dark:hover:bg-espresso-800 text-xs font-semibold text-espresso-800 dark:text-ivory-200 shadow-xs transition cursor-pointer flex items-center gap-1.5"
                >
                  <Upload className="w-3.5 h-3.5 text-terracotta-600" />
                  <span>Upload Photo</span>
                </button>

                {(avatarUrl || authUser?.avatarUrl) && (
                  <button
                    type="button"
                    onClick={handleRemoveAvatar}
                    className="px-2.5 py-1.5 rounded-xl border border-rose-200 dark:border-rose-900/50 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-xs font-medium transition cursor-pointer"
                    title="Remove custom avatar"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {avatarError && (
                <p className="text-xs text-rose-600 dark:text-rose-400 mb-3">{avatarError}</p>
              )}

              {/* Preset Avatars */}
              <div className="w-full pt-3 border-t border-ivory-200 dark:border-espresso-800">
                <p className="text-[11px] font-mono uppercase tracking-wider text-espresso-400 dark:text-espresso-500 mb-2">
                  Or pick a preset avatar
                </p>
                <div className="flex items-center justify-center gap-2">
                  {PRESET_AVATARS.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSelectPresetAvatar(preset)}
                      className={`w-8 h-8 rounded-full overflow-hidden border-2 transition-transform hover:scale-110 cursor-pointer ${
                        avatarUrl === preset ? 'border-terracotta-500 ring-2 ring-terracotta-300 ring-offset-1' : 'border-ivory-300 dark:border-espresso-700'
                      }`}
                      title={`Preset avatar ${idx + 1}`}
                    >
                      <img src={preset} alt={`Preset ${idx + 1}`} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column: Personal Information Fields */}
            <div className="lg:col-span-8 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Display Name */}
                <div>
                  <label className="block text-xs font-semibold text-espresso-700 dark:text-espresso-300 mb-1.5 uppercase font-mono tracking-wider">
                    Full / Display Name
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    onBlur={handleSaveProfile}
                    placeholder="e.g. Aanya"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-ivory-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-900 text-espresso-900 dark:text-ivory-100 text-sm placeholder:text-espresso-400 dark:placeholder:text-espresso-600 focus:outline-none focus:ring-2 focus:ring-terracotta-400 dark:focus:ring-terracotta-600 transition"
                  />
                </div>

                {/* Personal Email */}
                <div>
                  <label className="block text-xs font-semibold text-espresso-700 dark:text-espresso-300 mb-1.5 uppercase font-mono tracking-wider flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5" /> Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onBlur={handleSaveProfile}
                    placeholder="e.g. student@university.edu"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-ivory-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-900 text-espresso-900 dark:text-ivory-100 text-sm placeholder:text-espresso-400 dark:placeholder:text-espresso-600 focus:outline-none focus:ring-2 focus:ring-terracotta-400 dark:focus:ring-terracotta-600 transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* College / Institution */}
                <div>
                  <label className="block text-xs font-semibold text-espresso-700 dark:text-espresso-300 mb-1.5 uppercase font-mono tracking-wider flex items-center gap-1.5">
                    <School className="w-3.5 h-3.5" /> Institution / College
                  </label>
                  <input
                    type="text"
                    value={institution}
                    onChange={(e) => setInstitution(e.target.value)}
                    onBlur={handleSaveProfile}
                    placeholder="e.g. IIT Delhi, MIT"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-ivory-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-900 text-espresso-900 dark:text-ivory-100 text-sm placeholder:text-espresso-400 dark:placeholder:text-espresso-600 focus:outline-none focus:ring-2 focus:ring-terracotta-400 dark:focus:ring-terracotta-600 transition"
                  />
                </div>

                {/* Department */}
                <div>
                  <label className="block text-xs font-semibold text-espresso-700 dark:text-espresso-300 mb-1.5 uppercase font-mono tracking-wider flex items-center gap-1.5">
                    <GraduationCap className="w-3.5 h-3.5" /> Major / Dept
                  </label>
                  <input
                    type="text"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    onBlur={handleSaveProfile}
                    placeholder="e.g. Computer Science"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-ivory-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-900 text-espresso-900 dark:text-ivory-100 text-sm placeholder:text-espresso-400 dark:placeholder:text-espresso-600 focus:outline-none focus:ring-2 focus:ring-terracotta-400 dark:focus:ring-terracotta-600 transition"
                  />
                </div>

                {/* Student ID / Roll No */}
                <div>
                  <label className="block text-xs font-semibold text-espresso-700 dark:text-espresso-300 mb-1.5 uppercase font-mono tracking-wider flex items-center gap-1.5">
                    <Hash className="w-3.5 h-3.5" /> Roll / Student ID
                  </label>
                  <input
                    type="text"
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value)}
                    onBlur={handleSaveProfile}
                    placeholder="e.g. 2024CS042"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-ivory-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-900 text-espresso-900 dark:text-ivory-100 text-sm placeholder:text-espresso-400 dark:placeholder:text-espresso-600 focus:outline-none focus:ring-2 focus:ring-terracotta-400 dark:focus:ring-terracotta-600 transition"
                  />
                </div>
              </div>

              {/* Bio / About */}
              <div>
                <label className="block text-xs font-semibold text-espresso-700 dark:text-espresso-300 mb-1.5 uppercase font-mono tracking-wider">
                  Bio / Academic Focus
                </label>
                <textarea
                  rows={2}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  onBlur={handleSaveProfile}
                  placeholder="e.g. 3rd year student focusing on systems, DSA, and daily consistency."
                  className="w-full px-3.5 py-2 rounded-xl border border-ivory-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-900 text-espresso-900 dark:text-ivory-100 text-sm placeholder:text-espresso-400 dark:placeholder:text-espresso-600 focus:outline-none focus:ring-2 focus:ring-terracotta-400 dark:focus:ring-terracotta-600 transition resize-none"
                />
              </div>

              {/* Academic Target & Countdown */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-ivory-200 dark:border-espresso-800">
                <div>
                  <label className="block text-xs font-semibold text-espresso-700 dark:text-espresso-300 mb-1.5 uppercase font-mono tracking-wider">
                    Academic Target / Goal
                  </label>
                  <input
                    type="text"
                    value={targetExam}
                    onChange={(e) => setTargetExam(e.target.value)}
                    onBlur={handleSaveProfile}
                    placeholder="e.g. End-Semester Exams, DSA Interview Prep…"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-ivory-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-900 text-espresso-900 dark:text-ivory-100 text-sm placeholder:text-espresso-400 dark:placeholder:text-espresso-600 focus:outline-none focus:ring-2 focus:ring-terracotta-400 dark:focus:ring-terracotta-600 transition"
                  />
                  <p className="text-xs text-espresso-400 dark:text-espresso-500 mt-1">
                    Any personal academic goal — no exam name is required.
                  </p>
                </div>

                <div>
                  <label htmlFor="target-date" className="block text-xs font-semibold text-espresso-700 dark:text-espresso-300 mb-1.5 uppercase font-mono tracking-wider flex items-center gap-1.5">
                    <CalendarClock className="w-3.5 h-3.5" /> Target Date
                  </label>
                  <input
                    id="target-date"
                    type="date"
                    value={examDate}
                    onChange={(e) => setExamDate(e.target.value)}
                    onBlur={handleSaveProfile}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-ivory-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-900 text-espresso-900 dark:text-ivory-100 text-sm focus:outline-none focus:ring-2 focus:ring-terracotta-400 dark:focus:ring-terracotta-600 transition"
                  />
                  <p className="text-xs text-espresso-400 dark:text-espresso-500 mt-1">
                    Used to power the exam-countdown panel on the dashboard.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={handleSaveProfile}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-semibold hover:opacity-90 transition shadow-subtle cursor-pointer"
                  style={{ backgroundColor: 'var(--accent)' }}
                >
                  {profileSaved ? (
                    <><Check className="w-4 h-4" /> Saved!</>
                  ) : (
                    <>Save Profile</>
                  )}
                </button>
                <span className="text-xs text-espresso-400 dark:text-espresso-500 font-mono">
                  Changes save automatically on exit
                </span>
              </div>
            </div>
          </div>
        </Card>

        {/* ── Appearance ── */}
        <Card>
          <SectionHeading
            icon={<Palette className="w-4 h-4" />}
            title="Appearance"
            sub="Theme, accent colour, and background style"
          />

          {/* Theme Mode */}
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase font-mono tracking-wider text-espresso-700 dark:text-espresso-300 mb-3">
              Colour Scheme
            </p>
            <div className="flex gap-2.5">
              {(
                [
                  { id: 'light',  label: 'Light',  icon: <Sun  className="w-4 h-4" /> },
                  { id: 'dark',   label: 'Dark',   icon: <Moon className="w-4 h-4" /> },
                  { id: 'system', label: 'System', icon: <Monitor className="w-4 h-4" /> },
                ] as { id: ThemeMode; label: string; icon: React.ReactNode }[]
              ).map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => handleThemeChange(opt.id)}
                  className={`flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl border text-xs font-medium transition ${
                    mode === opt.id
                      ? 'border-espresso-800 dark:border-ivory-200 bg-espresso-50 dark:bg-espresso-800 text-espresso-900 dark:text-ivory-100'
                      : 'border-ivory-300 dark:border-espresso-700 text-espresso-500 dark:text-espresso-400 hover:border-ivory-400 dark:hover:border-espresso-600'
                  }`}
                >
                  {opt.icon}
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Accent Colour */}
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase font-mono tracking-wider text-espresso-700 dark:text-espresso-300 mb-3">
              Accent Colour
            </p>
            <div className="grid grid-cols-3 gap-2.5">
              {ACCENT_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => handleAccentChange(opt.id)}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-xs font-medium transition ${
                    settings.accentColor === opt.id
                      ? 'border-espresso-800 dark:border-ivory-300 bg-espresso-50 dark:bg-espresso-800'
                      : 'border-ivory-300 dark:border-espresso-700 hover:border-ivory-400 dark:hover:border-espresso-600'
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded-full shrink-0 ring-2 ring-offset-1 ring-offset-white dark:ring-offset-espresso-850 ${
                      settings.accentColor === opt.id ? 'ring-current' : 'ring-transparent'
                    }`}
                    style={{ backgroundColor: opt.hex, color: opt.hex }}
                  />
                  <span className="text-espresso-800 dark:text-ivory-200 truncate">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Background Style */}
          <div>
            <p className="text-xs font-semibold uppercase font-mono tracking-wider text-espresso-700 dark:text-espresso-300 mb-3">
              Background Style
            </p>
            <div className="space-y-2">
              {BG_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => handleBgChange(opt.id)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-left text-sm transition ${
                    settings.backgroundStyle === opt.id
                      ? 'border-espresso-800 dark:border-ivory-300 bg-espresso-50 dark:bg-espresso-800'
                      : 'border-ivory-300 dark:border-espresso-700 hover:border-ivory-400 dark:hover:border-espresso-600'
                  }`}
                >
                  <div>
                    <p className="font-medium text-espresso-900 dark:text-ivory-100 text-xs">{opt.label}</p>
                    <p className="text-xs text-espresso-400 dark:text-espresso-500 mt-0.5">{opt.desc}</p>
                  </div>
                  {settings.backgroundStyle === opt.id && (
                    <Check className="w-4 h-4 text-espresso-800 dark:text-ivory-200 shrink-0" />
                  )}
                </button>
              ))}

              {/* Custom URL input */}
              {settings.backgroundStyle === 'custom' && (
                <div className="mt-3 space-y-2.5">
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={customBgUrl}
                      onChange={(e) => {
                        setCustomBgUrl(e.target.value);
                        updateSettings({ customBackgroundUrl: e.target.value });
                      }}
                      placeholder="https://example.com/wallpaper.jpg"
                      className="flex-1 px-3.5 py-2.5 rounded-xl border border-ivory-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-900 text-espresso-900 dark:text-ivory-100 text-sm placeholder:text-espresso-400 dark:placeholder:text-espresso-600 focus:outline-none focus:ring-2 focus:ring-terracotta-400 transition"
                    />
                    {customBgUrl && (
                      <button
                        type="button"
                        onClick={() => {
                          setCustomBgUrl('');
                          updateSettings({ customBackgroundUrl: '' });
                        }}
                        className="px-3 py-2 text-xs rounded-xl border border-ivory-300 dark:border-espresso-700 text-espresso-600 dark:text-espresso-300 hover:bg-ivory-200 dark:hover:bg-espresso-800"
                        title="Reset to default custom image"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                  <div>
                    <p className="text-[11px] font-mono uppercase tracking-wider text-espresso-500 dark:text-espresso-400 mb-1.5 font-semibold">
                      Quick Presets:
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { label: '📚 Quiet Library', url: 'https://images.unsplash.com/photo-1521587760476-6c12a4b040da?auto=format&fit=crop&w=1600&q=80' },
                        { label: '☕ Study Desk', url: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&w=1600&q=80' },
                        { label: '🏔️ Misty Mountain', url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1600&q=80' },
                      ].map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => {
                            setCustomBgUrl(preset.url);
                            updateSettings({ customBackgroundUrl: preset.url });
                          }}
                          className={`text-xs px-2.5 py-1.5 rounded-lg border transition ${
                            customBgUrl === preset.url
                              ? 'border-espresso-800 dark:border-ivory-300 bg-espresso-100 dark:bg-espresso-800 font-semibold text-espresso-950 dark:text-ivory-50'
                              : 'border-ivory-300 dark:border-espresso-700 bg-white/60 dark:bg-espresso-900/60 text-espresso-700 dark:text-ivory-200 hover:bg-ivory-100 dark:hover:bg-espresso-800'
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <p className="text-xs text-espresso-400 dark:text-espresso-500">
                    Applied with contrast-preserving readability wash. Automatic fallback if image is missing.
                  </p>
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* ── Dashboard Preferences ── */}
        <Card>
          <SectionHeading
            icon={<Eye className="w-4 h-4" />}
            title="Dashboard"
            sub="Control which panels are visible"
          />

          <div className="space-y-4">
            {/* Show Exam Countdown */}
            <div className="flex items-center justify-between py-3 border-b border-ivory-200 dark:border-espresso-800">
              <div>
                <p className="text-sm font-medium text-espresso-900 dark:text-ivory-100">Academic Countdown</p>
                <p className="text-xs text-espresso-400 dark:text-espresso-500 mt-0.5">
                  Days remaining to your target date
                </p>
              </div>
              <button
                aria-label="Toggle Academic Countdown"
                onClick={() => updateSettings({ showExamCountdown: !settings.showExamCountdown })}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  settings.showExamCountdown
                    ? 'bg-espresso-800 dark:bg-ivory-200'
                    : 'bg-ivory-300 dark:bg-espresso-700'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white dark:bg-espresso-900 shadow transition-transform ${
                    settings.showExamCountdown ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Show Focus Radio */}
            <div className="flex items-center justify-between py-3">
              <div className="flex items-start gap-2">
                <Radio className="w-4 h-4 mt-0.5 text-espresso-500 dark:text-espresso-400 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-espresso-900 dark:text-ivory-100">Focus Radio</p>
                  <p className="text-xs text-espresso-400 dark:text-espresso-500 mt-0.5">
                    YouTube ambient music player — shown in the Deep Focus view
                  </p>
                </div>
              </div>
              <button
                aria-label="Toggle Focus Radio"
                onClick={() => updateSettings({ showFocusRadio: !settings.showFocusRadio })}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  settings.showFocusRadio
                    ? 'bg-espresso-800 dark:bg-ivory-200'
                    : 'bg-ivory-300 dark:bg-espresso-700'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white dark:bg-espresso-900 shadow transition-transform ${
                    settings.showFocusRadio ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        </Card>

        {/* ── Study Day Rollover ── */}
        <Card>
          <SectionHeading
            icon={<Clock className="w-4 h-4" />}
            title="Study Day Rollover"
            sub="Hour at which a new study day begins (24-hour clock)"
          />

          <div className="space-y-3">
            <div className="flex items-center gap-4">
              <input
                type="range"
                min={0}
                max={6}
                step={1}
                value={settings.studyDayRolloverHour}
                onChange={(e) =>
                  updateSettings({ studyDayRolloverHour: Number(e.target.value) })
                }
                className="flex-1 accent-terracotta-500"
              />
              <span className="font-mono text-xl font-bold text-espresso-900 dark:text-ivory-100 tabular-nums w-14 text-center">
                {String(settings.studyDayRolloverHour).padStart(2, '0')}:00
              </span>
            </div>
            <p className="text-xs text-espresso-400 dark:text-espresso-500">
              Study sessions after midnight will count toward the previous day if the rollover
              hour is set above 0. Range: 00:00 – 06:00.
            </p>
          </div>
        </Card>

        {/* ── Attendance Requirement Setting ── */}
        <Card>
          <SectionHeading
            icon={<GraduationCap className="w-4 h-4" />}
            title="Attendance Requirement"
            sub="Global target threshold percentage applied across all courses and calculations"
          />

          <div className="space-y-3">
            <div className="flex items-center gap-4">
              <input
                type="range"
                min={50}
                max={100}
                step={1}
                value={settings.attendanceRequirement ?? 75}
                onChange={(e) =>
                  updateSettings({ attendanceRequirement: Number(e.target.value) })
                }
                className="flex-1 accent-terracotta-500 cursor-pointer"
              />
              <span className="font-mono text-xl font-bold text-espresso-950 dark:text-ivory-50 tabular-nums w-14 text-center">
                {settings.attendanceRequirement ?? 75}%
              </span>
            </div>
            <div className="flex justify-between text-[11px] text-espresso-400 font-mono">
              <span>50%</span>
              <span className="text-terracotta-600 dark:text-terracotta-400 font-bold">Standard: 75%</span>
              <span>100%</span>
            </div>
            <p className="text-xs text-espresso-400 dark:text-espresso-500">
              This threshold is the single source of truth for safety margin warnings, bunk cushions,
              and attendance recovery plans throughout the application.
            </p>
          </div>
        </Card>

        {/* ── Daily Question Target ── */}
        <Card>
          <SectionHeading
            icon={<Target className="w-4 h-4" />}
            title="Daily Question Target"
            sub="Questions to attempt per study day — shown in the Planner & Dashboard"
          />
          <div className="space-y-3">
            <div className="flex items-center gap-4">
              <input
                type="range"
                min={5}
                max={200}
                step={5}
                value={questionTarget}
                onChange={(e) => setQuestionTarget(Number(e.target.value))}
                className="flex-1 accent-terracotta-500 cursor-pointer"
              />
              <span className="font-mono text-xl font-bold text-espresso-950 dark:text-ivory-50 tabular-nums w-14 text-center">
                {questionTarget}
              </span>
            </div>
            <div className="flex justify-between text-[11px] text-espresso-400 font-mono">
              <span>5 / day</span>
              <span className="text-terracotta-600 dark:text-terracotta-400 font-bold">Default: 25</span>
              <span>200 / day</span>
            </div>
            <button
              onClick={() => {
                setDailyQuestionTarget(questionTarget);
                if (qtTimeoutRef.current) clearTimeout(qtTimeoutRef.current);
                setQtSaved(true);
                qtTimeoutRef.current = setTimeout(() => {
                  if (typeof window !== 'undefined') setQtSaved(false);
                }, 2000);
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-medium hover:opacity-90 transition shadow-subtle"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              {qtSaved ? <><Check className="w-4 h-4" /> Saved!</> : 'Save Target'}
            </button>
          </div>
        </Card>

        {/* ── Spaced Review Intervals ── */}
        <Card>
          <SectionHeading
            icon={<BookOpen className="w-4 h-4" />}
            title="Spaced Review Intervals"
            sub="Days between repetitions — comma-separated integers (e.g. 1, 3, 7, 14, 30)"
          />
          <div className="space-y-3">
            <input
              type="text"
              value={intervalInput}
              onChange={(e) => { setIntervalInput(e.target.value); setIntervalError(''); }}
              placeholder="1, 3, 7, 14, 30"
              className="w-full px-3.5 py-2.5 rounded-xl border border-ivory-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-900 text-espresso-900 dark:text-ivory-100 text-sm font-mono placeholder:text-espresso-400 focus:outline-none focus:ring-2 focus:ring-terracotta-400 transition"
            />
            {intervalError && (
              <p className="text-xs text-red-600 dark:text-red-400">{intervalError}</p>
            )}
            <button
              onClick={() => {
                const parts = intervalInput.split(',').map((s) => parseInt(s.trim(), 10));
                if (parts.some(isNaN) || parts.some((n) => n <= 0)) {
                  setIntervalError('All values must be positive integers separated by commas.');
                  return;
                }
                updateReviewIntervals(parts);
                setIntervalSaved(true);
                setTimeout(() => setIntervalSaved(false), 2000);
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-medium hover:opacity-90 transition shadow-subtle"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              {intervalSaved ? <><Check className="w-4 h-4" /> Saved!</> : 'Save Intervals'}
            </button>
            <p className="text-xs text-espresso-400 dark:text-espresso-500">
              Applied to all new spaced review schedules. Existing reviews are not retroactively changed.
            </p>
          </div>
        </Card>

        {/* ── Full Reset ── */}
        <Card className="border-red-200 dark:border-red-900/50">
          <SectionHeading
            icon={<RotateCcw className="w-4 h-4 text-red-600 dark:text-red-400" />}
            title="Full Reset"
            sub="Permanently wipe ALL app data. This action cannot be undone."
          />
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50">
              <p className="text-xs text-red-700 dark:text-red-300 font-medium">
                ⚠️ This will delete all subjects, attendance logs, gym workouts, food diary, focus sessions, tasks, syllabus, and settings. There is no undo.
              </p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-espresso-700 dark:text-espresso-300 mb-1.5 uppercase font-mono tracking-wider">
                Type <span className="text-red-600 dark:text-red-400 font-mono">RESET</span> to confirm
              </label>
              <input
                type="text"
                value={resetText}
                onChange={(e) => setResetText(e.target.value)}
                placeholder="RESET"
                className="w-full px-3.5 py-2.5 rounded-xl border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/20 text-espresso-900 dark:text-ivory-100 text-sm font-mono placeholder:text-espresso-400 focus:outline-none focus:ring-2 focus:ring-red-400 transition"
              />
            </div>
            {resetDone ? (
              <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">✓ App data has been reset to defaults.</p>
            ) : (
              <button
                disabled={resetText !== 'RESET'}
                onClick={() => {
                  fullReset();
                  setResetText('');
                  setResetDone(true);
                  setTimeout(() => setResetDone(false), 4000);
                }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition disabled:opacity-30 disabled:cursor-not-allowed bg-red-600 hover:bg-red-700 text-white"
              >
                <RotateCcw className="w-4 h-4" />
                Reset All Data
              </button>
            )}
          </div>
        </Card>

      </div>

      {/* ── App Version ── */}
      <div className="flex items-center justify-between py-4 border-t border-ivory-300 dark:border-espresso-800 text-xs text-espresso-400 dark:text-espresso-500 font-mono">
        <span className="flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5" />
          TRACKER v{APP_VERSION} · Local-First · No Cloud Sync
        </span>
        <span>All data stored in your browser&apos;s localStorage</span>
      </div>

      {/* ClassSpace Dialog Modals */}
      <CreateWorkspaceModal
        isOpen={showCreateWsModal}
        onClose={() => setShowCreateWsModal(false)}
        onCreated={() => {
          setShowCreateWsModal(false);
        }}
      />

      <JoinWorkspaceModal
        isOpen={showJoinWsModal}
        onClose={() => setShowJoinWsModal(false)}
        onJoined={() => {
          setShowJoinWsModal(false);
        }}
      />

      {/* Confirm Rotate Code */}
      <ConfirmModal
        isOpen={confirmRotateOpen}
        title="Rotate Join Code"
        message="Are you sure you want to rotate the Join Code? The existing code will be immediately revoked and cannot be used by new students."
        confirmLabel="Rotate Code"
        variant="warning"
        onConfirm={async () => {
          setConfirmRotateOpen(false);
          if (classSpace?.rotateJoinCode) {
            const res = await classSpace.rotateJoinCode();
            if (res.error) setClassActionError(res.error);
          }
        }}
        onCancel={() => setConfirmRotateOpen(false)}
      />

      {/* Confirm Leave ClassSpace */}
      <ConfirmModal
        isOpen={confirmLeaveOpen}
        title="Leave ClassSpace"
        message="Are you sure you want to leave this ClassSpace? Your personal attendance logs and notes will remain safely preserved in your private Tracker."
        confirmLabel="Leave Workspace"
        variant="danger"
        onConfirm={async () => {
          setConfirmLeaveOpen(false);
          if (classSpace?.leaveWorkspace) {
            const res = await classSpace.leaveWorkspace();
            if (res.error) setClassActionError(res.error);
          }
        }}
        onCancel={() => setConfirmLeaveOpen(false)}
      />

      {/* Confirm Delete ClassSpace */}
      <ConfirmModal
        isOpen={confirmDeleteOpen}
        title="Delete ClassSpace"
        message="Are you sure you want to permanently delete this ClassSpace? This will delete the shared schedule and disconnect all enrolled classmates. This action cannot be undone."
        confirmLabel="Delete Workspace"
        variant="danger"
        onConfirm={async () => {
          setConfirmDeleteOpen(false);
          if (classSpace?.deleteWorkspace) {
            const res = await classSpace.deleteWorkspace();
            if (res.error) setClassActionError(res.error);
          }
        }}
        onCancel={() => setConfirmDeleteOpen(false)}
      />
    </div>
  );
};
