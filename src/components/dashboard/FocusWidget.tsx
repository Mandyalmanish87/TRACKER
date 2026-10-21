import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { useApp } from '../../context/AppContext';
import { ActiveTimerState } from '../../types';
import {
  saveActiveTimer,
  loadActiveTimer,
  clearActiveTimer,
  calculateTimerProgress,
  requestTimerPip,
  isPipSupported,
  PipController,
} from '../../utils/focusTimer';
import { calculateStudyStreaks, calculateFocusSummaries } from '../../utils/focusAnalytics';
import {
  Play,
  Pause,
  RotateCcw,
  Check,
  BookOpen,
  Tv,
  Flame,
  ArrowRight,
  StopCircle,
} from 'lucide-react';
import { Focus3DVisualizer } from '../focus/Focus3DVisualizer';

interface FocusWidgetProps {
  onNavigateToFocus?: () => void;
  showExtendedAnalyticsLink?: boolean;
}

export const FocusWidget: React.FC<FocusWidgetProps> = ({
  onNavigateToFocus,
  showExtendedAnalyticsLink = false,
}) => {
  const { state, logStudySession } = useApp();

  // Unified Subject List: Institutional Timetable subjects + Syllabus subjects
  const unifiedSubjects = useMemo(() => {
    const list: { id: string; name: string; source: 'institutional' | 'syllabus' }[] = [];
    (state.subjects || []).forEach((s) => {
      list.push({ id: s.id, name: `${s.code} — ${s.name}`, source: 'institutional' });
    });
    (state.syllabusSubjects || []).forEach((s) => {
      // Don't duplicate if exact same ID exists
      if (!list.some((item) => item.id === s.id)) {
        list.push({ id: s.id, name: `${s.name} (Syllabus)`, source: 'syllabus' });
      }
    });
    return list;
  }, [state.subjects, state.syllabusSubjects]);

  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [sessionMinutes, setSessionMinutes] = useState<number>(25);
  const [timeLeft, setTimeLeft] = useState<number>(25 * 60);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [notes, setNotes] = useState<string>('');
  const [loggedToast, setLoggedToast] = useState<string | null>(null);

  // Precision timestamp tracking refs
  const accumulatedSecondsRef = useRef<number>(0);
  const lastStartedTimestampRef = useRef<number | null>(null);
  const sessionStartedAtRef = useRef<string | null>(null);

  // Picture-in-Picture controller ref
  const pipControllerRef = useRef<PipController | null>(null);
  const [isPipActive, setIsPipActive] = useState<boolean>(false);
  const pipSupported = useMemo(() => isPipSupported(), []);

  // Set default subject if available
  useEffect(() => {
    if (!selectedSubjectId && unifiedSubjects.length > 0) {
      setSelectedSubjectId(unifiedSubjects[0].id);
    }
  }, [unifiedSubjects, selectedSubjectId]);

  // ── Recovery on initial mount ──
  useEffect(() => {
    const saved = loadActiveTimer();
    if (saved) {
      setSessionMinutes(Math.round(saved.plannedSeconds / 60));
      if (saved.subjectId) setSelectedSubjectId(saved.subjectId);
      if (saved.notes) setNotes(saved.notes);
      sessionStartedAtRef.current = saved.sessionStartedAt || new Date().toISOString();

      const progress = calculateTimerProgress(saved);
      if (saved.isRunning && progress.timeLeftSeconds === 0) {
        // Tab was closed and timer expired while away: DO NOT fabricate completed study session
        // Instead restore accumulated time and pause with an honest notice
        setTimeLeft(0);
        accumulatedSecondsRef.current = saved.plannedSeconds;
        setIsRunning(false);
        lastStartedTimestampRef.current = null;
        setLoggedToast('Timer completed while away. Click "Log Focus" to record your session.');
      } else {
        setTimeLeft(progress.timeLeftSeconds);
        accumulatedSecondsRef.current = progress.elapsedFocusSeconds;
        // Resume if it was actively running, otherwise keep paused
        setIsRunning(saved.isRunning);
        lastStartedTimestampRef.current = saved.isRunning ? Date.now() : null;
      }
    }
  }, []);

  // Web Audio Chime for Session Completion
  const playCompletionSound = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15); // A5
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.8);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.8);
    } catch {
      // Audio autoplay policy handled gracefully
    }
  };

  // ── High-Precision Live Timer Loop ──
  useEffect(() => {
    if (!isRunning) return;

    if (!lastStartedTimestampRef.current) {
      lastStartedTimestampRef.current = Date.now();
    }
    if (!sessionStartedAtRef.current) {
      sessionStartedAtRef.current = new Date().toISOString();
    }

    const interval = setInterval(() => {
      const now = Date.now();
      const deltaSec = Math.floor((now - (lastStartedTimestampRef.current || now)) / 1000);
      const totalElapsed = accumulatedSecondsRef.current + deltaSec;
      const plannedSec = sessionMinutes * 60;
      const remaining = Math.max(0, plannedSec - totalElapsed);

      setTimeLeft(remaining);

      // Persist active timer state
      const activeState: ActiveTimerState = {
        mode: 'pomodoro',
        plannedSeconds: plannedSec,
        accumulatedSeconds: accumulatedSecondsRef.current,
        lastStartedTimestamp: lastStartedTimestampRef.current,
        isRunning: true,
        subjectId: selectedSubjectId,
        notes,
        sessionStartedAt: sessionStartedAtRef.current || undefined,
      };
      saveActiveTimer(activeState);

      // Update PiP display if active
      if (pipControllerRef.current?.isActive) {
        const m = String(Math.floor(remaining / 60)).padStart(2, '0');
        const s = String(remaining % 60).padStart(2, '0');
        const subName =
          unifiedSubjects.find((sub) => sub.id === selectedSubjectId)?.name || 'General Focus';
        pipControllerRef.current.update(`${m}:${s}`, subName, true);
      }

      // Check completion
      if (remaining === 0) {
        setIsRunning(false);
        lastStartedTimestampRef.current = null;
        accumulatedSecondsRef.current = plannedSec;
        clearActiveTimer();
        playCompletionSound();

        // Automatically log completed session with duplicate protection
        handleLogSession(sessionMinutes, 'completed');
      }
    }, 500);

    return () => clearInterval(interval);
  }, [isRunning, sessionMinutes, selectedSubjectId, notes, unifiedSubjects]);

  const handleSelectPreset = (mins: number) => {
    // If was running, accumulate before switching
    if (isRunning && lastStartedTimestampRef.current) {
      accumulatedSecondsRef.current += Math.floor(
        (Date.now() - lastStartedTimestampRef.current) / 1000
      );
    }
    setIsRunning(false);
    lastStartedTimestampRef.current = null;
    accumulatedSecondsRef.current = 0;
    sessionStartedAtRef.current = null;
    setSessionMinutes(mins);
    setTimeLeft(mins * 60);
    clearActiveTimer();
  };

  const handleToggleTimer = () => {
    if (isRunning) {
      // Pausing: commit elapsed time into accumulatedSeconds
      if (lastStartedTimestampRef.current) {
        accumulatedSecondsRef.current += Math.floor(
          (Date.now() - lastStartedTimestampRef.current) / 1000
        );
      }
      lastStartedTimestampRef.current = null;
      setIsRunning(false);

      const activeState: ActiveTimerState = {
        mode: 'pomodoro',
        plannedSeconds: sessionMinutes * 60,
        accumulatedSeconds: accumulatedSecondsRef.current,
        lastStartedTimestamp: null,
        isRunning: false,
        subjectId: selectedSubjectId,
        notes,
        sessionStartedAt: sessionStartedAtRef.current || undefined,
      };
      saveActiveTimer(activeState);

      if (pipControllerRef.current?.isActive) {
        const m = String(Math.floor(timeLeft / 60)).padStart(2, '0');
        const s = String(timeLeft % 60).padStart(2, '0');
        const subName =
          unifiedSubjects.find((sub) => sub.id === selectedSubjectId)?.name || 'General Focus';
        pipControllerRef.current.update(`${m}:${s}`, subName, false);
      }
    } else {
      // Resuming
      lastStartedTimestampRef.current = Date.now();
      if (!sessionStartedAtRef.current) {
        sessionStartedAtRef.current = new Date().toISOString();
      }
      setIsRunning(true);
    }
  };

  const handleReset = () => {
    setIsRunning(false);
    lastStartedTimestampRef.current = null;
    accumulatedSecondsRef.current = 0;
    sessionStartedAtRef.current = null;
    setTimeLeft(sessionMinutes * 60);
    clearActiveTimer();

    if (pipControllerRef.current?.isActive) {
      pipControllerRef.current.close();
      setIsPipActive(false);
    }
  };

  // Stop & Log Early as 'interrupted' session using actual elapsed time
  const handleStopAndLogEarly = () => {
    if (isRunning && lastStartedTimestampRef.current) {
      accumulatedSecondsRef.current += Math.floor(
        (Date.now() - lastStartedTimestampRef.current) / 1000
      );
    }
    setIsRunning(false);
    lastStartedTimestampRef.current = null;

    const actualMinutes = Math.max(1, Math.round(accumulatedSecondsRef.current / 60));
    handleLogSession(actualMinutes, 'interrupted');
    handleReset();
  };

  const handleLogSession = (minsToLog: number, status: 'completed' | 'interrupted' = 'completed') => {
    if (minsToLog <= 0) return;

    const nowIso = new Date().toISOString();
    const startIso = sessionStartedAtRef.current || nowIso;

    logStudySession(minsToLog, selectedSubjectId || undefined, notes || undefined, {
      plannedDurationMinutes: sessionMinutes,
      status,
      startTime: startIso,
      endTime: nowIso,
      id: `study-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    });

    setNotes('');
    setLoggedToast(
      status === 'completed'
        ? `Logged full ${minsToLog}m deep-focus session!`
        : `Logged ${minsToLog}m focused time (stopped early).`
    );
    setTimeout(() => setLoggedToast(null), 3500);
  };

  // ── Picture-in-Picture Toggle ──
  const handleTogglePip = async () => {
    if (isPipActive && pipControllerRef.current) {
      pipControllerRef.current.close();
      setIsPipActive(false);
      return;
    }

    const minutesFormatted = String(Math.floor(timeLeft / 60)).padStart(2, '0');
    const secondsFormatted = String(timeLeft % 60).padStart(2, '0');
    const timeStr = `${minutesFormatted}:${secondsFormatted}`;
    const subName =
      unifiedSubjects.find((s) => s.id === selectedSubjectId)?.name || 'General Focus';

    const controller = await requestTimerPip(timeStr, subName, isRunning, () => {
      setIsPipActive(false);
      pipControllerRef.current = null;
    });

    if (controller) {
      pipControllerRef.current = controller;
      setIsPipActive(true);
    }
  };

  // Clean up PiP on unmount
  useEffect(() => {
    return () => {
      if (pipControllerRef.current?.isActive) {
        pipControllerRef.current.close();
      }
    };
  }, []);

  const minutesFormatted = String(Math.floor(timeLeft / 60)).padStart(2, '0');
  const secondsFormatted = String(timeLeft % 60).padStart(2, '0');

  // Compute live focus summaries & streaks
  const rolloverHour = state.settings?.studyDayRolloverHour ?? 0;
  const summary = calculateFocusSummaries(state.studySessions, new Date(), rolloverHour);
  const streaks = calculateStudyStreaks(state.studySessions, new Date(), rolloverHour);

  return (
    <Card
      eyebrow="Cognitive Energy"
      title="Deep Focus & Study"
      subtitle="Structured Pomodoro intervals tied to your academic curriculum"
      action={
        <div className="flex items-center gap-2">
          {streaks.currentStreak > 0 && (
            <Badge variant="ochre" size="sm">
              <Flame className="w-3 h-3 mr-1 fill-current" />
              {streaks.currentStreak}d Streak
            </Badge>
          )}
          <Badge variant="sage" size="sm">
            {summary.todayMinutes}m Today
          </Badge>
        </div>
      }
    >
      {/* Timer Display */}
      <div
        className={`flex flex-col items-center justify-center py-6 px-4 rounded-2xl bg-ivory-100/90 dark:bg-espresso-800/90 border transition-all duration-300 text-center mb-6 relative overflow-hidden ${
          isRunning
            ? 'border-transparent neon-ring shadow-[0_0_30px_-5px_color-mix(in_srgb,var(--accent)_40%,transparent)]'
            : 'border-ivory-200 dark:border-espresso-750'
        }`}
      >
        {/* Floating PiP Button */}
        {pipSupported && (
          <button
            onClick={handleTogglePip}
            title={isPipActive ? 'Close floating Picture-in-Picture window' : 'Pop out floating Picture-in-Picture timer'}
            className={`absolute top-3 right-3 p-2 rounded-xl transition ${
              isPipActive
                ? 'bg-espresso-800 text-ivory-50 dark:bg-ivory-100 dark:text-espresso-950 shadow-subtle'
                : 'bg-white/80 dark:bg-espresso-700/80 text-espresso-600 dark:text-espresso-300 hover:text-espresso-900 border border-ivory-300 dark:border-espresso-600'
            }`}
          >
            <Tv className="w-3.5 h-3.5" />
          </button>
        )}

        {/* 3D Focus Polyhedron Sculpture */}
        <Focus3DVisualizer
          isRunning={isRunning}
          timeLeft={timeLeft}
          totalTime={sessionMinutes * 60}
          mode="work"
          isCompleted={timeLeft === 0 && !isRunning}
        />

        <div className="relative my-2">
          {isRunning && (
            <div
              className="absolute -inset-4 rounded-full blur-xl animate-pulse pointer-events-none"
              style={{ backgroundColor: 'color-mix(in srgb, var(--accent) 25%, transparent)' }}
            />
          )}
          <span className="relative z-10 font-mono tabular-nums text-5xl sm:text-6xl font-bold tracking-tight text-espresso-950 dark:text-ivory-50 select-none">
            {minutesFormatted}:{secondsFormatted}
          </span>
        </div>

        {/* Presets */}
        <div className="flex items-center gap-2 mb-5">
          {[15, 25, 45, 60].map((mins) => (
            <button
              key={mins}
              onClick={() => handleSelectPreset(mins)}
              className={`px-3 py-1.5 text-xs font-mono tabular-nums font-semibold rounded-xl border transition-all ${
                sessionMinutes === mins
                  ? 'bg-espresso-800 text-ivory-50 border-espresso-800 dark:bg-ivory-100 dark:text-espresso-900 shadow-subtle'
                  : 'bg-white dark:bg-espresso-700 text-espresso-600 dark:text-espresso-300 border-ivory-300 dark:border-espresso-600 hover:border-ivory-400'
              }`}
            >
              {mins}m
            </button>
          ))}
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center justify-center gap-2.5">
          <Button
            variant={isRunning ? 'secondary' : 'terracotta'}
            size="md"
            onClick={handleToggleTimer}
            icon={isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          >
            {isRunning ? 'Pause' : timeLeft === sessionMinutes * 60 ? 'Start Focus' : 'Resume'}
          </Button>

          {/* If running or paused mid-session, allow Stop & Log Early */}
          {(isRunning || timeLeft < sessionMinutes * 60) && (
            <Button
              variant="secondary"
              size="md"
              onClick={handleStopAndLogEarly}
              title="Stop session early and log actual focused minutes"
              icon={<StopCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />}
            >
              Stop & Log
            </Button>
          )}

          <Button
            variant="ghost"
            size="md"
            onClick={handleReset}
            title="Reset timer"
            icon={<RotateCcw className="w-4 h-4" />}
          />

          <Button
            variant="secondary"
            size="md"
            onClick={() => handleLogSession(sessionMinutes, 'completed')}
            title="Quick log full session minutes directly"
            icon={<Check className="w-4 h-4 text-sage-600 dark:text-sage-400" />}
          >
            Log Now
          </Button>
        </div>

        {loggedToast && (
          <p className="text-xs text-sage-600 dark:text-sage-400 font-semibold mt-3 animate-fade-in flex items-center gap-1.5">
            <Check className="w-4 h-4" /> {loggedToast}
          </p>
        )}
      </div>

      {/* Association: Subject & Notes */}
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-espresso-700 dark:text-espresso-300 mb-1.5">
            Link to Course / Syllabus Subject
          </label>
          <select
            value={selectedSubjectId}
            onChange={(e) => setSelectedSubjectId(e.target.value)}
            className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-ivory-300 dark:border-espresso-700 bg-white dark:bg-espresso-800 text-espresso-900 dark:text-ivory-100 focus:outline-none focus:ring-2 focus:ring-terracotta-500 font-medium"
          >
            <option value="">General Self-Directed Study</option>
            {unifiedSubjects.map((sub) => (
              <option key={sub.id} value={sub.id}>
                {sub.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-espresso-700 dark:text-espresso-300 mb-1.5">
            Focus Intention / Notes (Optional)
          </label>
          <input
            type="text"
            placeholder="e.g. Solved 5 algorithmic graph problems..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-ivory-300 dark:border-espresso-700 bg-white dark:bg-espresso-800 text-espresso-900 dark:text-ivory-100 focus:outline-none focus:ring-2 focus:ring-terracotta-500"
          />
        </div>
      </div>

      {/* Quick link to Focus View if on Dashboard */}
      {showExtendedAnalyticsLink && onNavigateToFocus && (
        <div className="mt-5 pt-4 border-t border-ivory-200 dark:border-espresso-750 flex items-center justify-between">
          <span className="text-xs text-espresso-500 dark:text-espresso-400">
            View 7-day analytics & streaks
          </span>
          <button
            onClick={onNavigateToFocus}
            className="inline-flex items-center gap-1 text-xs font-bold transition hover:underline"
            style={{ color: 'var(--accent)' }}
          >
            Open Focus Hub <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Recent Study History */}
      {!showExtendedAnalyticsLink && state.studySessions.length > 0 && (
        <div className="mt-6 pt-5 border-t border-ivory-200 dark:border-espresso-750">
          <p className="text-xs font-mono uppercase tracking-wider text-espresso-400 dark:text-espresso-500 mb-2.5 font-semibold">
            Recent Sessions
          </p>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {state.studySessions.slice(0, 3).map((session) => (
              <div
                key={session.id}
                className="flex items-center justify-between text-xs py-2 px-3 rounded-xl bg-ivory-50 dark:bg-espresso-800/50 border border-ivory-200 dark:border-espresso-750"
              >
                <div className="flex items-center gap-2.5 truncate">
                  <BookOpen className="w-3.5 h-3.5 text-terracotta-500 shrink-0" />
                  <span className="font-medium text-espresso-800 dark:text-ivory-200 truncate">
                    {session.subjectName || 'General Focus'}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {session.status === 'interrupted' && (
                    <span className="text-[10px] text-amber-600 dark:text-amber-400 font-mono">
                      (early)
                    </span>
                  )}
                  <span className="font-mono tabular-nums text-xs font-bold text-terracotta-600 dark:text-terracotta-400">
                    {session.durationMinutes} min
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
};
