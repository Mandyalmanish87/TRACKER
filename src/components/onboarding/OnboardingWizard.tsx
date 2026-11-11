import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { useTheme } from '../../theme/ThemeContext';
import { AccentColor } from '../../types';
import {
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Check,
  GraduationCap,
  Calendar,
  BookOpen,
  Palette,
  Sun,
  Moon,
  Shield,
} from 'lucide-react';

export const ONBOARDING_COMPLETED_KEY = 'tracker_onboarding_completed';
export const ONBOARDING_DRAFT_KEY = 'tracker_onboarding_draft';

const ACCENT_COLORS: { name: string; id: AccentColor; hex: string }[] = [
  { name: 'Terracotta', id: 'terracotta', hex: '#C85A32' },
  { name: 'Sage Green', id: 'sage', hex: '#5A7D60' },
  { name: 'Dusty Blue', id: 'dusty-blue', hex: '#4A6FA5' },
  { name: 'Amber Ochre', id: 'ochre', hex: '#D97706' },
  { name: 'Plum Mulberry', id: 'plum', hex: '#834775' },
];

export const OnboardingWizard: React.FC = () => {
  const { state, updateProfile, updateSettings, addSubject } = useApp();
  const { mode, setMode } = useTheme();

  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);

  // Form state
  const [name, setName] = useState('');
  const [targetPct, setTargetPct] = useState(75);
  const [subjectName, setSubjectName] = useState('');
  const [subjectCode, setSubjectCode] = useState('');
  const [subjectColor, setSubjectColor] = useState(ACCENT_COLORS[0].hex);
  const [selectedAccent, setSelectedAccent] = useState<AccentColor>(ACCENT_COLORS[0].id);

  // Check if onboarding should be shown
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check completion flag
    const isCompleted = localStorage.getItem(ONBOARDING_COMPLETED_KEY) === 'true';
    if (isCompleted) {
      setIsOpen(false);
      return;
    }

    // Auto-complete if existing data already present
    const hasExistingData =
      (state.subjects && state.subjects.length > 0) ||
      (state.timetable && state.timetable.length > 0) ||
      (state.profile?.displayName && state.profile.displayName !== 'Scholar' && state.profile.displayName.trim().length > 0);

    if (hasExistingData) {
      localStorage.setItem(ONBOARDING_COMPLETED_KEY, 'true');
      setIsOpen(false);
      return;
    }

    // Restore draft step if saved
    try {
      const draft = localStorage.getItem(ONBOARDING_DRAFT_KEY);
      if (draft) {
        const parsed = JSON.parse(draft);
        if (parsed.currentStep) setCurrentStep(parsed.currentStep);
        if (parsed.name) setName(parsed.name);
        if (parsed.targetPct) setTargetPct(parsed.targetPct);
      }
    } catch {}

    setIsOpen(true);
  }, [state.subjects, state.timetable, state.profile]);

  const saveDraft = (step: number) => {
    try {
      localStorage.setItem(
        ONBOARDING_DRAFT_KEY,
        JSON.stringify({ currentStep: step, name, targetPct })
      );
    } catch {}
  };

  const handleNext = () => {
    const nextStep = currentStep + 1;
    setCurrentStep(nextStep);
    saveDraft(nextStep);
  };

  const handleBack = () => {
    const prevStep = Math.max(1, currentStep - 1);
    setCurrentStep(prevStep);
    saveDraft(prevStep);
  };

  const handleFinish = () => {
    if (name.trim()) {
      updateProfile({
        targetExam: 'Semester Finals',
        ...(state.profile || {}),
        displayName: name.trim(),
      });
    }

    updateSettings({
      attendanceRequirement: targetPct,
      accentColor: selectedAccent,
    });

    if (subjectName.trim()) {
      addSubject({
        name: subjectName.trim(),
        code: subjectCode.trim() || subjectName.trim().slice(0, 5).toUpperCase(),
        color: subjectColor,
        targetPct,
        attended: 0,
        totalConducted: 0,
      });
    }

    localStorage.setItem(ONBOARDING_COMPLETED_KEY, 'true');
    localStorage.removeItem(ONBOARDING_DRAFT_KEY);
    setIsOpen(false);
  };

  const handleDismiss = () => {
    localStorage.setItem(ONBOARDING_COMPLETED_KEY, 'true');
    localStorage.removeItem(ONBOARDING_DRAFT_KEY);
    setIsOpen(false);
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
      className="fixed inset-0 z-[9998] flex items-center justify-center p-4 bg-espresso-950/70 dark:bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div className="w-full max-w-lg bg-white dark:bg-[#18151D] rounded-3xl border border-ivory-300 dark:border-white/10 shadow-2xl p-6 sm:p-8 flex flex-col space-y-6 relative">
        {/* Progress header & Skip button */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {[1, 2, 3, 4, 5].map((s) => (
              <div
                key={s}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  s === currentStep
                    ? 'w-8 bg-[var(--accent)]'
                    : s < currentStep
                    ? 'w-4 bg-emerald-500'
                    : 'w-4 bg-ivory-300 dark:bg-white/10'
                }`}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={handleDismiss}
            className="text-xs font-semibold text-espresso-400 hover:text-espresso-700 dark:hover:text-ivory-200 transition cursor-pointer"
          >
            Skip setup
          </button>
        </div>

        {/* Step 1: Welcome */}
        {currentStep === 1 && (
          <div className="space-y-4 py-2 animate-in fade-in duration-150">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <Sparkles className="w-7 h-7" />
            </div>
            <h2 id="onboarding-title" className="font-serif text-2xl font-bold text-espresso-950 dark:text-ivory-50 tracking-tight">
              Welcome to TRAKIFY
            </h2>
            <p className="text-xs sm:text-sm text-espresso-600 dark:text-espresso-300 leading-relaxed">
              Your local-first, distraction-free companion for university lectures, timetable schedules, attendance compliance, and study planning.
            </p>
            <div className="p-3.5 rounded-2xl bg-ivory-100/60 dark:bg-white/[0.03] border border-ivory-200 dark:border-white/10 flex items-start gap-3">
              <Shield className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
              <div className="text-xs text-espresso-700 dark:text-ivory-200">
                <span className="font-semibold block">Confidential &amp; Local-First</span>
                Your academic data stays on your device by default, with optional cloud backup whenever you choose.
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Student Name */}
        {currentStep === 2 && (
          <div className="space-y-4 py-2 animate-in fade-in duration-150">
            <div className="w-14 h-14 rounded-2xl bg-sky-500/10 text-sky-500 flex items-center justify-center">
              <GraduationCap className="w-7 h-7" />
            </div>
            <h2 id="onboarding-title" className="font-serif text-2xl font-bold text-espresso-950 dark:text-ivory-50 tracking-tight">
              What should we call you?
            </h2>
            <p className="text-xs sm:text-sm text-espresso-600 dark:text-espresso-300">
              Personalize your briefing headers and daily motivational overview.
            </p>
            <div className="space-y-1.5">
              <label htmlFor="student-name" className="text-xs font-semibold text-espresso-800 dark:text-ivory-100">
                Your Preferred Name
              </label>
              <input
                id="student-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Alex"
                className="w-full px-4 py-2.5 text-xs sm:text-sm rounded-xl border border-ivory-300 dark:border-white/10 bg-white dark:bg-white/5 text-espresso-950 dark:text-ivory-50 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              />
            </div>
          </div>
        )}

        {/* Step 3: Attendance Target */}
        {currentStep === 3 && (
          <div className="space-y-4 py-2 animate-in fade-in duration-150">
            <div className="w-14 h-14 rounded-2xl bg-sage-500/10 text-sage-600 flex items-center justify-center">
              <Calendar className="w-7 h-7" />
            </div>
            <h2 id="onboarding-title" className="font-serif text-2xl font-bold text-espresso-950 dark:text-ivory-50 tracking-tight">
              Attendance Target
            </h2>
            <p className="text-xs sm:text-sm text-espresso-600 dark:text-espresso-300">
              Set your college threshold. We will calculate exact safety margins and safe skips for each course.
            </p>
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span>Minimum Required:</span>
                <span className="font-mono text-base font-bold text-[var(--accent)]">{targetPct}%</span>
              </div>
              <input
                type="range"
                min={50}
                max={95}
                step={5}
                value={targetPct}
                onChange={(e) => setTargetPct(Number(e.target.value))}
                className="w-full accent-[var(--accent)] cursor-pointer"
              />
              <div className="flex justify-between text-[11px] font-mono text-espresso-400">
                <span>50%</span>
                <span className="font-bold text-espresso-700 dark:text-ivory-200">75% (Standard)</span>
                <span>95%</span>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Add First Subject */}
        {currentStep === 4 && (
          <div className="space-y-4 py-2 animate-in fade-in duration-150">
            <div className="w-14 h-14 rounded-2xl bg-purple-500/10 text-purple-500 flex items-center justify-center">
              <BookOpen className="w-7 h-7" />
            </div>
            <h2 id="onboarding-title" className="font-serif text-2xl font-bold text-espresso-950 dark:text-ivory-50 tracking-tight">
              Add your first course (Optional)
            </h2>
            <p className="text-xs sm:text-sm text-espresso-600 dark:text-espresso-300">
              Start building your semester ledger. You can import full timetables anytime.
            </p>
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-espresso-800 dark:text-ivory-100">
                  Subject Name
                </label>
                <input
                  type="text"
                  value={subjectName}
                  onChange={(e) => setSubjectName(e.target.value)}
                  placeholder="e.g. Data Structures & Algorithms"
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-ivory-300 dark:border-white/10 bg-white dark:bg-white/5 text-espresso-950 dark:text-ivory-50 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-espresso-800 dark:text-ivory-100">
                    Course Code
                  </label>
                  <input
                    type="text"
                    value={subjectCode}
                    onChange={(e) => setSubjectCode(e.target.value)}
                    placeholder="e.g. CS201"
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-ivory-300 dark:border-white/10 bg-white dark:bg-white/5 text-espresso-950 dark:text-ivory-50 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-espresso-800 dark:text-ivory-100">
                    Badge Color
                  </label>
                  <div className="flex items-center gap-2 pt-1">
                    {ACCENT_COLORS.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setSubjectColor(c.hex)}
                        className={`w-6 h-6 rounded-full transition-transform ${
                          subjectColor === c.hex ? 'scale-125 ring-2 ring-offset-2 ring-[var(--accent)]' : ''
                        }`}
                        style={{ backgroundColor: c.hex }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 5: Personalization & Theme */}
        {currentStep === 5 && (
          <div className="space-y-4 py-2 animate-in fade-in duration-150">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <Palette className="w-7 h-7" />
            </div>
            <h2 id="onboarding-title" className="font-serif text-2xl font-bold text-espresso-950 dark:text-ivory-50 tracking-tight">
              Personalize Appearance
            </h2>
            <p className="text-xs sm:text-sm text-espresso-600 dark:text-espresso-300">
              Choose your surface theme and signature editorial accent color.
            </p>
            <div className="space-y-3 pt-1">
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setMode('light')}
                  className={`p-3 rounded-xl border flex items-center justify-center gap-2 text-xs font-semibold transition cursor-pointer ${
                    mode === 'light'
                      ? 'border-[var(--accent)] bg-ivory-100 text-espresso-950 font-bold'
                      : 'border-ivory-300 dark:border-white/10 text-espresso-600'
                  }`}
                >
                  <Sun className="w-4 h-4 text-amber-500" />
                  <span>Ivory Light</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMode('dark')}
                  className={`p-3 rounded-xl border flex items-center justify-center gap-2 text-xs font-semibold transition cursor-pointer ${
                    mode === 'dark'
                      ? 'border-[var(--accent)] bg-white/10 text-white font-bold'
                      : 'border-ivory-300 dark:border-white/10 text-espresso-400'
                  }`}
                >
                  <Moon className="w-4 h-4 text-sky-400" />
                  <span>Obsidian Dark</span>
                </button>
              </div>

              <div className="pt-2">
                <label className="text-xs font-semibold text-espresso-800 dark:text-ivory-100 block mb-2">
                  Accent Shade
                </label>
                <div className="flex items-center gap-3">
                  {ACCENT_COLORS.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setSelectedAccent(c.id);
                        document.documentElement.style.setProperty('--accent', c.hex);
                      }}
                      className={`w-7 h-7 rounded-full flex items-center justify-center transition-transform ${
                        selectedAccent === c.id ? 'scale-125 ring-2 ring-offset-2 ring-espresso-400' : ''
                      }`}
                      style={{ backgroundColor: c.hex }}
                    >
                      {selectedAccent === c.id && <Check className="w-3.5 h-3.5 text-white" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer Navigation Buttons */}
        <div className="flex items-center justify-between pt-4 border-t border-ivory-200 dark:border-white/10">
          {currentStep > 1 ? (
            <button
              type="button"
              onClick={handleBack}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl border border-ivory-300 dark:border-white/10 text-espresso-700 dark:text-ivory-200 hover:bg-ivory-100 dark:hover:bg-white/5 transition cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>
          ) : (
            <div />
          )}

          {currentStep < 5 ? (
            <button
              type="button"
              onClick={handleNext}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl text-white transition cursor-pointer shadow-subtle hover:opacity-95"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              <span>Continue</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleFinish}
              className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold rounded-xl text-white transition cursor-pointer shadow-subtle hover:opacity-95"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              <Check className="w-4 h-4" />
              <span>Start Tracking</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
