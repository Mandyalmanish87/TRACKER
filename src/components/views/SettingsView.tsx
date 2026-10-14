import React, { useState } from 'react';
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
} from 'lucide-react';

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

// ─── Section heading helper ────────────────────────────────────────────────
const SectionHeading: React.FC<{ icon: React.ReactNode; title: string; sub?: string }> = ({
  icon, title, sub,
}) => (
  <div className="flex items-start gap-3 mb-5">
    <div className="mt-0.5 p-2 rounded-xl bg-ivory-200 dark:bg-espresso-800 text-espresso-600 dark:text-espresso-300">
      {icon}
    </div>
    <div>
      <h2 className="text-sm font-semibold text-espresso-900 dark:text-ivory-100 uppercase tracking-wider font-mono">
        {title}
      </h2>
      {sub && <p className="text-xs text-espresso-500 dark:text-espresso-400 mt-0.5">{sub}</p>}
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

// ─── Main SettingsView ──────────────────────────────────────────────────────
export const SettingsView: React.FC = () => {
  const { state, updateSettings, updateProfile } = useApp();
  const { mode, setMode } = useTheme();

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
  const [displayName, setDisplayName]   = useState(profile.displayName);
  const [targetExam,  setTargetExam]    = useState(profile.targetExam ?? '');
  const [examDate,    setExamDate]      = useState(profile.examDate ?? '');
  const [profileSaved, setProfileSaved] = useState(false);

  const [customBgUrl, setCustomBgUrl] = useState(settings.customBackgroundUrl ?? '');

  // Keep local state in sync when state loads or updates
  React.useEffect(() => {
    if (state.profile) {
      setDisplayName(state.profile.displayName ?? '');
      setTargetExam(state.profile.targetExam ?? '');
      setExamDate(state.profile.examDate ?? '');
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

  const handleSaveProfile = () => {
    updateProfile({
      displayName,
      targetExam,
      examDate: examDate || undefined,
    });
    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 2000);
  };

  return (
    <div className="space-y-8 pb-20">
      {/* Page header */}
      <div className="border-b border-ivory-300 dark:border-espresso-800 pb-5">
        <p className="text-xs uppercase tracking-widest font-mono font-semibold mb-1.5" style={{ color: 'var(--accent)' }}>
          Personalisation
        </p>
        <div className="flex items-end justify-between gap-3">
          <h1 className="font-serif text-3xl sm:text-4xl font-normal tracking-tight text-espresso-950 dark:text-ivory-50">
            Settings
          </h1>
          <Settings className="w-6 h-6 text-espresso-400 dark:text-espresso-500 mb-1" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── Profile ── */}
        <Card>
          <SectionHeading
            icon={<User className="w-4 h-4" />}
            title="Profile"
            sub="Displayed across your dashboard and countdown"
          />

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-espresso-700 dark:text-espresso-300 mb-1.5 uppercase font-mono tracking-wider">
                Display Name
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

            <button
              onClick={handleSaveProfile}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-medium hover:opacity-90 transition shadow-subtle"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              {profileSaved ? (
                <><Check className="w-4 h-4" /> Saved!</>
              ) : (
                <>Save Profile</>
              )}
            </button>
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
                    Ambient music widget — planned for Milestone 5
                  </p>
                </div>
              </div>
              <button
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
      </div>
    </div>
  );
};
