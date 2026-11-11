import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { useApp } from '../../context/AppContext';
import { ActiveTimerState, StopwatchLap, FocusTimerMode } from '../../types';
import {
  saveActiveTimer,
  loadActiveTimer,
  clearActiveTimer,
  calculateTimerProgress,
  formatFocusTime,
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
  Maximize2,
  Clock,
  Timer,
  Flag,
  Coffee,
} from 'lucide-react';
import { Focus3DVisualizer } from '../focus/Focus3DVisualizer';
import { DeepFocusFullscreen } from '../focus/DeepFocusFullscreen';
import { PlannerFocusLaunch } from '../../types';

interface FocusWidgetProps {
  onNavigateToFocus?: () => void;
  showExtendedAnalyticsLink?: boolean;
  plannerFocusLaunch?: PlannerFocusLaunch | null;
  onPlannerFocusLaunchConsumed?: () => void;
}

export const FocusWidget: React.FC<FocusWidgetProps> = ({
  onNavigateToFocus,
  showExtendedAnalyticsLink = false,
  plannerFocusLaunch,
  onPlannerFocusLaunchConsumed,
}) => {
  const { state, logStudySession } = useApp();

  // Mode: Pomodoro, Custom Countdown Timer, or Stopwatch
  const [timerMode, setTimerMode] = useState<'pomodoro' | 'timer' | 'stopwatch'>('pomodoro');
  const [pomodoroPhase, setPomodoroPhase] = useState<'work' | 'short_break' | 'long_break'>('work');

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
  const [isFullscreenOpen, setIsFullscreenOpen] = useState<boolean>(false);
  const handledPlannerFocusLaunchRef = useRef<string | null>(null);

  // Stopwatch state & recorded laps
  const [stopwatchSeconds, setStopwatchSeconds] = useState<number>(0);
  const [laps, setLaps] = useState<StopwatchLap[]>([]);

  // Precision timestamp tracking refs
  const accumulatedSecondsRef = useRef<number>(0);
  const lastStartedTimestampRef = useRef<number | null>(null);
  const sessionStartedAtRef = useRef<string | null>(null);

  // Set default subject if available
  useEffect(() => {
    if (!selectedSubjectId && unifiedSubjects.length > 0) {
      setSelectedSubjectId(unifiedSubjects[0].id);
    }
  }, [unifiedSubjects, selectedSubjectId]);

  useEffect(() => {
    if (!plannerFocusLaunch || handledPlannerFocusLaunchRef.current === plannerFocusLaunch.id) return;
    handledPlannerFocusLaunchRef.current = plannerFocusLaunch.id;
    const hasDuration = Boolean(plannerFocusLaunch.estimatedDuration && plannerFocusLaunch.estimatedDuration > 0);
    const nextMode = hasDuration ? 'timer' : 'stopwatch';
    const nextMinutes = hasDuration ? Math.max(1, Math.round(plannerFocusLaunch.estimatedDuration!)) : 25;
    setTimerMode(nextMode);
    setSessionMinutes(nextMinutes);
    setTimeLeft(nextMinutes * 60);
    if (plannerFocusLaunch.subjectId) setSelectedSubjectId(plannerFocusLaunch.subjectId);
    setIsRunning(false);
    setIsFullscreenOpen(true);
  }, [plannerFocusLaunch]);

  // ── Recovery on initial mount ──
  useEffect(() => {
    const saved = loadActiveTimer();
    if (saved) {
      if (saved.mode === 'stopwatch') {
        setTimerMode('stopwatch');
        if (saved.subjectId) setSelectedSubjectId(saved.subjectId);
        if (saved.notes) setNotes(saved.notes);
        if (saved.laps) setLaps(saved.laps);
        sessionStartedAtRef.current = saved.sessionStartedAt || new Date().toISOString();

        const progress = calculateTimerProgress(saved);
        setStopwatchSeconds(progress.elapsedFocusSeconds);
        accumulatedSecondsRef.current = progress.elapsedFocusSeconds;
        setIsRunning(saved.isRunning);
        lastStartedTimestampRef.current = saved.isRunning ? Date.now() : null;
      } else {
        if (saved.mode === 'timer') {
          setTimerMode('timer');
        } else {
          setTimerMode('pomodoro');
          if (saved.mode === 'short_break') setPomodoroPhase('short_break');
          else if (saved.mode === 'long_break') setPomodoroPhase('long_break');
          else setPomodoroPhase('work');
        }

        const mins = Math.max(1, Math.round(saved.plannedSeconds / 60));
        setSessionMinutes(mins);
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
    }
  }, []);

  // Open immersive mode after the global mini-player navigates here.
  const openDeepFocusFullscreen = () => {
    window.dispatchEvent(new CustomEvent('tracker:mini-focus-close'));
    // Request from the same user gesture. If the browser declines, the body-level
    // portal still provides a viewport-filling CSS fallback.
    try {
      const request = document.documentElement.requestFullscreen?.();
      if (request) void request.catch(() => undefined);
    } catch { /* The CSS immersive fallback remains available. */ }
    setIsFullscreenOpen(true);
  };

  useEffect(() => {
    const openFullscreen = () => {
      try { window.sessionStorage.removeItem('tracker_open_focus_fullscreen_after_nav'); } catch {}
      openDeepFocusFullscreen();
    };
    try {
      if (window.sessionStorage.getItem('tracker_open_focus_fullscreen_after_nav') === '1') {
        openFullscreen();
      }
    } catch {}
    window.addEventListener('tracker:open-focus-fullscreen', openFullscreen);
    return () => window.removeEventListener('tracker:open-focus-fullscreen', openFullscreen);
  }, []);

  useEffect(() => {
    const syncFromMiniPlayer = () => {
      const saved = loadActiveTimer();
      if (!saved) return;
      const progress = calculateTimerProgress(saved);
      if (saved.mode === 'stopwatch') {
        setTimerMode('stopwatch');
        setStopwatchSeconds(progress.elapsedFocusSeconds);
        if (saved.laps) setLaps(saved.laps);
      } else {
        setTimerMode(saved.mode === 'timer' ? 'timer' : 'pomodoro');
        if (saved.mode === 'short_break') setPomodoroPhase('short_break');
        else if (saved.mode === 'long_break') setPomodoroPhase('long_break');
        else setPomodoroPhase('work');
        setSessionMinutes(Math.max(1, Math.round(saved.plannedSeconds / 60)));
        setTimeLeft(progress.timeLeftSeconds);
      }
      accumulatedSecondsRef.current = progress.elapsedFocusSeconds;
      lastStartedTimestampRef.current = saved.isRunning ? saved.lastStartedTimestamp : null;
      sessionStartedAtRef.current = saved.sessionStartedAt || null;
      setIsRunning(saved.isRunning);
    };
    window.addEventListener('tracker:active-timer-updated', syncFromMiniPlayer);
    return () => window.removeEventListener('tracker:active-timer-updated', syncFromMiniPlayer);
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
    if (!isRunning || isFullscreenOpen) return;

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

      if (timerMode === 'stopwatch') {
        setStopwatchSeconds(totalElapsed);

        // Persist active stopwatch state
        const activeState: ActiveTimerState = {
          mode: 'stopwatch',
          plannedSeconds: 0,
          accumulatedSeconds: accumulatedSecondsRef.current,
          lastStartedTimestamp: lastStartedTimestampRef.current,
          isRunning: true,
          subjectId: selectedSubjectId,
          notes,
          sessionStartedAt: sessionStartedAtRef.current || undefined,
          laps,
        };
        saveActiveTimer(activeState);

      } else {
        // Pomodoro or Timer countdown
        const plannedSec = sessionMinutes * 60;
        const remaining = Math.max(0, plannedSec - totalElapsed);

        setTimeLeft(remaining);

        // Persist active timer state
        const activeMode: FocusTimerMode =
          timerMode === 'pomodoro'
            ? pomodoroPhase === 'work'
              ? 'pomodoro'
              : pomodoroPhase
            : 'timer';

        const activeState: ActiveTimerState = {
          mode: activeMode,
          plannedSeconds: plannedSec,
          accumulatedSeconds: accumulatedSecondsRef.current,
          lastStartedTimestamp: lastStartedTimestampRef.current,
          isRunning: true,
          subjectId: selectedSubjectId,
          notes,
          sessionStartedAt: sessionStartedAtRef.current || undefined,
        };
        saveActiveTimer(activeState);

        // Check completion
        if (remaining === 0) {
          setIsRunning(false);
          lastStartedTimestampRef.current = null;
          accumulatedSecondsRef.current = plannedSec;
          clearActiveTimer();
          playCompletionSound();

          if (timerMode === 'pomodoro' && pomodoroPhase !== 'work') {
            setLoggedToast('Break completed! Ready to begin your next deep focus sprint.');
            setTimeout(() => setLoggedToast(null), 4000);
          } else {
            // Automatically log completed session with duplicate protection
            handleLogSession(sessionMinutes, 'completed', plannedSec);
          }
        }
      }
    }, 500);

    return () => clearInterval(interval);
  }, [
    isRunning,
    isFullscreenOpen,
    timerMode,
    pomodoroPhase,
    sessionMinutes,
    selectedSubjectId,
    notes,
    unifiedSubjects,
    laps,
  ]);

  // Switch between Pomodoro, Timer, and Stopwatch
  const handleSwitchMode = (newMode: 'pomodoro' | 'timer' | 'stopwatch') => {
    if (newMode === timerMode) return;

    // Pause cleanly before switching
    if (isRunning && lastStartedTimestampRef.current) {
      accumulatedSecondsRef.current += Math.floor(
        (Date.now() - lastStartedTimestampRef.current) / 1000
      );
    }
    setIsRunning(false);
    lastStartedTimestampRef.current = null;
    clearActiveTimer();
    window.dispatchEvent(new CustomEvent('tracker:mini-focus-close'));

    setTimerMode(newMode);

    if (newMode === 'stopwatch') {
      accumulatedSecondsRef.current = 0;
      setStopwatchSeconds(0);
      setLaps([]);
    } else if (newMode === 'timer') {
      accumulatedSecondsRef.current = 0;
      const defMins = sessionMinutes >= 5 ? sessionMinutes : 30;
      setSessionMinutes(defMins);
      setTimeLeft(defMins * 60);
    } else {
      // pomodoro
      accumulatedSecondsRef.current = 0;
      setPomodoroPhase('work');
      setSessionMinutes(25);
      setTimeLeft(25 * 60);
    }

  };

  const handleSelectPreset = (mins: number, phase: 'work' | 'short_break' | 'long_break' = 'work') => {
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
    setPomodoroPhase(phase);
    setSessionMinutes(mins);
    setTimeLeft(mins * 60);
    clearActiveTimer();
    window.dispatchEvent(new CustomEvent('tracker:mini-focus-close'));
  };

  const handleAdjustCustomMinutes = (delta: number) => {
    if (isRunning) return;
    const nextMins = Math.max(5, Math.min(360, sessionMinutes + delta));
    setSessionMinutes(nextMins);
    setTimeLeft(nextMins * 60);
    accumulatedSecondsRef.current = 0;
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

      if (timerMode === 'stopwatch') {
        const activeState: ActiveTimerState = {
          mode: 'stopwatch',
          plannedSeconds: 0,
          accumulatedSeconds: accumulatedSecondsRef.current,
          lastStartedTimestamp: null,
          isRunning: false,
          subjectId: selectedSubjectId,
          notes,
          sessionStartedAt: sessionStartedAtRef.current || undefined,
          laps,
        };
        saveActiveTimer(activeState);

      } else {
        const activeMode: FocusTimerMode =
          timerMode === 'pomodoro'
            ? pomodoroPhase === 'work'
              ? 'pomodoro'
              : pomodoroPhase
            : 'timer';

        const activeState: ActiveTimerState = {
          mode: activeMode,
          plannedSeconds: sessionMinutes * 60,
          accumulatedSeconds: accumulatedSecondsRef.current,
          lastStartedTimestamp: null,
          isRunning: false,
          subjectId: selectedSubjectId,
          notes,
          sessionStartedAt: sessionStartedAtRef.current || undefined,
        };
        saveActiveTimer(activeState);

      }
    } else {
      // Resuming / Starting
      lastStartedTimestampRef.current = Date.now();
      if (!sessionStartedAtRef.current) {
        sessionStartedAtRef.current = new Date().toISOString();
      }
      setIsRunning(true);
    }
  };

  // Record a split / lap in stopwatch mode
  const handleLap = () => {
    let currentTotal = accumulatedSecondsRef.current;
    if (isRunning && lastStartedTimestampRef.current) {
      currentTotal += Math.floor((Date.now() - lastStartedTimestampRef.current) / 1000);
    }
    if (currentTotal <= 0) return;

    const prevLapTotal = laps.length > 0 ? laps[0].totalTimeSeconds : 0;
    const split = Math.max(0, currentTotal - prevLapTotal);

    const newLap: StopwatchLap = {
      id: `lap-${Date.now()}-${laps.length + 1}`,
      lapNumber: laps.length + 1,
      lapTimeSeconds: split,
      totalTimeSeconds: currentTotal,
    };

    setLaps((prev) => [newLap, ...prev]);
  };

  const handleReset = () => {
    setIsRunning(false);
    lastStartedTimestampRef.current = null;
    accumulatedSecondsRef.current = 0;
    sessionStartedAtRef.current = null;
    clearActiveTimer();

    if (timerMode === 'stopwatch') {
      setStopwatchSeconds(0);
      setLaps([]);
    } else {
      setTimeLeft(sessionMinutes * 60);
    }

    window.dispatchEvent(new CustomEvent('tracker:mini-focus-close'));
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

    const actualSeconds = accumulatedSecondsRef.current;
    if (actualSeconds <= 0) {
      handleReset();
      return;
    }
    const actualMinutes = Number((actualSeconds / 60).toFixed(2));
    handleLogSession(actualMinutes, 'interrupted', actualSeconds);
    handleReset();
  };

  // Log active stopwatch time directly into study sessions
  const handleLogStopwatchSession = () => {
    let activeSec = accumulatedSecondsRef.current;
    if (isRunning && lastStartedTimestampRef.current) {
      activeSec += Math.floor((Date.now() - lastStartedTimestampRef.current) / 1000);
    }
    if (activeSec <= 0) {
      setLoggedToast('Start the stopwatch to record active focus time.');
      setTimeout(() => setLoggedToast(null), 3000);
      return;
    }

    const actualMins = Number((activeSec / 60).toFixed(2));
    handleLogSession(actualMins, 'completed', activeSec);
    handleReset();
  };

  const handleLogSession = (
    minsToLog: number,
    status: 'completed' | 'interrupted' = 'completed',
    secondsToLog?: number
  ) => {
    const actualSeconds = secondsToLog ?? Math.round(minsToLog * 60);
    if (actualSeconds <= 0 && minsToLog <= 0) return;

    const nowIso = new Date().toISOString();
    const startIso = sessionStartedAtRef.current || nowIso;

    const planned = timerMode === 'stopwatch' ? Math.round(minsToLog) : sessionMinutes;

    logStudySession(minsToLog, selectedSubjectId || undefined, notes || undefined, {
      plannedDurationMinutes: planned,
      durationSeconds: actualSeconds,
      status,
      startTime: startIso,
      endTime: nowIso,
      id: `study-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    });

    setNotes('');
    setLoggedToast(
      timerMode === 'stopwatch'
        ? `Logged ${minsToLog}m stopwatch focus session (${actualSeconds}s active).`
        : status === 'completed'
        ? `Logged full ${minsToLog}m deep-focus session!`
        : `Logged ${minsToLog}m focused time (${actualSeconds}s active).`
    );
    setTimeout(() => setLoggedToast(null), 3500);
  };

  const handleLogCurrentActiveOrFull = () => {
    if (timerMode === 'stopwatch') {
      handleLogStopwatchSession();
      return;
    }

    let activeSec = accumulatedSecondsRef.current;
    if (isRunning && lastStartedTimestampRef.current) {
      activeSec += Math.floor((Date.now() - lastStartedTimestampRef.current) / 1000);
    }
    if (activeSec > 0) {
      const mins = Number((activeSec / 60).toFixed(2));
      handleLogSession(mins, activeSec >= sessionMinutes * 60 ? 'completed' : 'interrupted', activeSec);
      handleReset();
    } else {
      // Direct quick-log of full preset session
      handleLogSession(sessionMinutes, 'completed', sessionMinutes * 60);
    }
  };

  const handleOpenMiniFocus = () => {
    let elapsedSeconds = accumulatedSecondsRef.current;
    if (isRunning && lastStartedTimestampRef.current) {
      elapsedSeconds += Math.floor((Date.now() - lastStartedTimestampRef.current) / 1000);
    }
    const mode: FocusTimerMode = timerMode === 'pomodoro'
      ? pomodoroPhase === 'work' ? 'pomodoro' : pomodoroPhase
      : timerMode;
    const subjectName = unifiedSubjects.find((subject) => subject.id === selectedSubjectId)?.name || 'General Focus';
    const timerState: ActiveTimerState = {
      mode,
      plannedSeconds: timerMode === 'stopwatch' ? 0 : sessionMinutes * 60,
      accumulatedSeconds: elapsedSeconds,
      lastStartedTimestamp: isRunning ? Date.now() : null,
      isRunning,
      subjectId: selectedSubjectId || undefined,
      subjectName,
      notes: notes || undefined,
      sessionStartedAt: sessionStartedAtRef.current || undefined,
      status: isRunning ? 'running' : elapsedSeconds > 0 ? 'paused' : 'idle',
      laps: timerMode === 'stopwatch' ? laps : undefined,
    };
    saveActiveTimer(timerState);
    window.dispatchEvent(new CustomEvent('tracker:mini-focus-open'));
  };

  // Compute live focus summaries & streaks
  const rolloverHour = state.settings?.studyDayRolloverHour ?? 0;
  const summary = calculateFocusSummaries(state.studySessions, new Date(), rolloverHour);
  const streaks = calculateStudyStreaks(state.studySessions, new Date(), rolloverHour);

  // Time display strings
  const formattedCountdown = formatFocusTime(timeLeft, sessionMinutes >= 60);
  const formattedStopwatch = formatFocusTime(stopwatchSeconds, true);
  const clockProgress = timerMode === 'stopwatch'
    ? (stopwatchSeconds % 3600) / 3600
    : Math.max(0, Math.min(1, (sessionMinutes * 60 - timeLeft) / Math.max(sessionMinutes * 60, 1)));

  return (
    <Card
      className="focus-studio-card"
      eyebrow="Cognitive Energy"
      title="Deep Focus & Study"
      subtitle={
        timerMode === 'pomodoro'
          ? 'Structured Pomodoro intervals tied to your academic curriculum'
          : timerMode === 'timer'
          ? 'Custom countdown timer tailored to your study goals'
          : 'Unconstrained count-up stopwatch with lap split tracking'
      }
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
      {/* ── Mode Switcher Tab Bar ───────────────────────────────── */}
      <div className="focus-mode-switch flex items-center justify-center p-1 rounded-xl bg-ivory-150 dark:bg-espresso-900 border border-ivory-300 dark:border-espresso-750 mb-4 max-w-sm mx-auto w-full select-none" role="group" aria-label="Choose focus clock mode">
        <button
          type="button"
          onClick={() => handleSwitchMode('pomodoro')}
          aria-pressed={timerMode === 'pomodoro'}
          className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
            timerMode === 'pomodoro'
              ? 'bg-white dark:bg-espresso-750 text-espresso-950 dark:text-ivory-50 shadow-xs'
              : 'text-espresso-600 dark:text-espresso-400 hover:text-espresso-900 dark:hover:text-ivory-100'
          }`}
        >
          <Flame className="w-3.5 h-3.5 text-terracotta-500" />
          <span>Pomodoro</span>
        </button>

        <button
          type="button"
          onClick={() => handleSwitchMode('timer')}
          aria-pressed={timerMode === 'timer'}
          className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
            timerMode === 'timer'
              ? 'bg-white dark:bg-espresso-750 text-espresso-950 dark:text-ivory-50 shadow-xs'
              : 'text-espresso-600 dark:text-espresso-400 hover:text-espresso-900 dark:hover:text-ivory-100'
          }`}
        >
          <Clock className="w-3.5 h-3.5 text-sage-500" />
          <span>Timer</span>
        </button>

        <button
          type="button"
          onClick={() => handleSwitchMode('stopwatch')}
          aria-pressed={timerMode === 'stopwatch'}
          className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
            timerMode === 'stopwatch'
              ? 'bg-white dark:bg-espresso-750 text-espresso-950 dark:text-ivory-50 shadow-xs'
              : 'text-espresso-600 dark:text-espresso-400 hover:text-espresso-900 dark:hover:text-ivory-100'
          }`}
        >
          <Timer className="w-3.5 h-3.5 text-ochre-500" />
          <span>Stopwatch</span>
        </button>
      </div>

      {/* Timer / Stopwatch Display Box */}
      <div
        className={`focus-clock-stage flex flex-col items-center justify-center py-6 px-4 rounded-2xl bg-ivory-100/90 dark:bg-espresso-800/90 border transition-all duration-300 text-center mb-6 relative overflow-hidden ${
          isRunning
            ? 'border-transparent neon-ring shadow-[0_0_30px_-5px_color-mix(in_srgb,var(--accent)_40%,transparent)]'
            : 'border-ivory-200 dark:border-espresso-750'
        }`}
      >
        {/* Fullscreen & in-app mini player controls */}
        <div className="absolute top-3 right-3 flex items-center gap-1.5 z-10">
          <button
            onClick={openDeepFocusFullscreen}
            title="Enter Fullscreen Mode"
            aria-label="Enter Fullscreen Mode"
            className="p-2 rounded-xl transition bg-white/80 dark:bg-espresso-700/80 text-espresso-700 dark:text-espresso-200 hover:text-espresso-950 dark:hover:text-white border border-ivory-300 dark:border-espresso-600 shadow-xs flex items-center gap-1 text-xs font-semibold cursor-pointer"
          >
            <Maximize2 className="w-3.5 h-3.5 text-terracotta-500" />
          </button>
          <button
            onClick={handleOpenMiniFocus}
            aria-label="Open mini focus panel"
            title="Open mini focus panel"
            className="p-2 rounded-xl transition bg-white/80 dark:bg-espresso-700/80 text-espresso-600 dark:text-espresso-300 hover:text-espresso-900 border border-ivory-300 dark:border-espresso-600 shadow-xs flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
          >
            <Tv className="w-3.5 h-3.5 text-terracotta-500" />
          </button>
        </div>

        {/* 3D Focus Polyhedron Sculpture */}
        <Focus3DVisualizer
          isRunning={isRunning}
          timeLeft={timerMode === 'stopwatch' ? stopwatchSeconds : timeLeft}
          totalTime={timerMode === 'stopwatch' ? Math.max(stopwatchSeconds, 3600) : sessionMinutes * 60}
          mode={timerMode === 'pomodoro' && pomodoroPhase !== 'work' ? 'break' : 'work'}
          isCompleted={timerMode !== 'stopwatch' && timeLeft === 0 && !isRunning}
        />

        {/* Mode & Break Banner */}
        {timerMode === 'pomodoro' && pomodoroPhase !== 'work' && (
          <div className="mb-1 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-semibold bg-sage-100 dark:bg-sage-900/50 text-sage-700 dark:text-sage-300 border border-sage-200 dark:border-sage-800 animate-pulse">
            <Coffee className="w-3.5 h-3.5" />
            <span>Break Time · Relax &amp; Recharge</span>
          </div>
        )}

        {timerMode === 'stopwatch' && (
          <div className="mb-1 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-mono font-semibold bg-ochre-100 dark:bg-ochre-900/40 text-ochre-800 dark:text-ochre-300 border border-ochre-200 dark:border-ochre-800">
            <Timer className="w-3 h-3" />
            <span>Active Count-Up Stopwatch</span>
          </div>
        )}

        {/* High contrast interval clock */}
        <div className="focus-clock-face relative my-3 flex h-44 w-44 items-center justify-center rounded-full">
          <svg viewBox="0 0 180 180" className="absolute inset-0 h-full w-full -rotate-90" aria-hidden="true">
            <circle cx="90" cy="90" r="77" fill="none" stroke="rgba(255,255,255,0.09)" strokeWidth="2" />
            <circle cx="90" cy="90" r="77" fill="none" stroke="url(#focus-clock-gradient)" strokeWidth="4" strokeLinecap="round" strokeDasharray="483.8" strokeDashoffset={483.8 * (1 - clockProgress)} className="transition-[stroke-dashoffset] duration-500" />
            <defs><linearGradient id="focus-clock-gradient" x1="0" y1="0" x2="1" y2="1"><stop stopColor="var(--accent)" /><stop offset="1" stopColor="var(--accent-dark-resolved)" /></linearGradient></defs>
          </svg>
          <div className="absolute inset-5 rounded-full border border-white/[0.08] bg-white/[0.035] shadow-[inset_0_1px_18px_rgba(255,255,255,0.04)]" />
          <div className="relative z-10 text-center">
            <span role="timer" aria-label={`${timerMode === 'stopwatch' ? 'Elapsed' : 'Remaining'} ${timerMode === 'stopwatch' ? formattedStopwatch : formattedCountdown}`} className="focus-clock-digits block font-mono tabular-nums text-[2.6rem] sm:text-5xl font-semibold tracking-[-0.08em] text-white select-none">
              {timerMode === 'stopwatch' ? formattedStopwatch : formattedCountdown}
            </span>
            <span className="mt-1 block text-[9px] font-mono uppercase tracking-[0.24em] text-violet-200/60">
              {timerMode === 'stopwatch' ? 'Elapsed' : isRunning ? 'Remaining' : 'Minutes'}
            </span>
          </div>
        </div>

        {/* ── Mode-Specific Sub-Controls & Presets ────────────── */}

        {/* 1. Pomodoro Work & Break Presets */}
        {timerMode === 'pomodoro' && (
          <div className="flex flex-wrap items-center justify-center gap-2 mb-5">
            <button
              onClick={() => handleSelectPreset(25, 'work')}
              className={`px-3 py-1.5 text-xs font-mono tabular-nums font-semibold rounded-xl border transition-all cursor-pointer ${
                sessionMinutes === 25 && pomodoroPhase === 'work'
                  ? 'bg-espresso-800 text-ivory-50 border-espresso-800 dark:bg-ivory-100 dark:text-espresso-900 shadow-subtle'
                  : 'bg-white dark:bg-espresso-700 text-espresso-600 dark:text-espresso-300 border-ivory-300 dark:border-espresso-600 hover:border-ivory-400'
              }`}
            >
              25m Work
            </button>
            <button
              onClick={() => handleSelectPreset(50, 'work')}
              className={`px-3 py-1.5 text-xs font-mono tabular-nums font-semibold rounded-xl border transition-all cursor-pointer ${
                sessionMinutes === 50 && pomodoroPhase === 'work'
                  ? 'bg-espresso-800 text-ivory-50 border-espresso-800 dark:bg-ivory-100 dark:text-espresso-900 shadow-subtle'
                  : 'bg-white dark:bg-espresso-700 text-espresso-600 dark:text-espresso-300 border-ivory-300 dark:border-espresso-600 hover:border-ivory-400'
              }`}
            >
              50m Deep
            </button>
            <button
              onClick={() => handleSelectPreset(5, 'short_break')}
              className={`px-3 py-1.5 text-xs font-mono tabular-nums font-semibold rounded-xl border transition-all cursor-pointer ${
                sessionMinutes === 5 && pomodoroPhase === 'short_break'
                  ? 'bg-sage-600 text-white border-sage-600 shadow-subtle'
                  : 'bg-white dark:bg-espresso-700 text-sage-700 dark:text-sage-300 border-ivory-300 dark:border-espresso-600 hover:border-ivory-400'
              }`}
            >
              5m Break
            </button>
            <button
              onClick={() => handleSelectPreset(15, 'long_break')}
              className={`px-3 py-1.5 text-xs font-mono tabular-nums font-semibold rounded-xl border transition-all cursor-pointer ${
                sessionMinutes === 15 && pomodoroPhase === 'long_break'
                  ? 'bg-sage-600 text-white border-sage-600 shadow-subtle'
                  : 'bg-white dark:bg-espresso-700 text-sage-700 dark:text-sage-300 border-ivory-300 dark:border-espresso-600 hover:border-ivory-400'
              }`}
            >
              15m Long Break
            </button>
          </div>
        )}

        {/* 2. Custom Countdown Timer Presets & Stepper */}
        {timerMode === 'timer' && (
          <div className="flex flex-col items-center gap-3 mb-5 w-full">
            <div className="flex flex-wrap items-center justify-center gap-1.5">
              {[15, 30, 45, 60, 90, 120].map((mins) => (
                <button
                  key={mins}
                  onClick={() => handleSelectPreset(mins)}
                  className={`px-2.5 py-1 text-xs font-mono tabular-nums font-semibold rounded-xl border transition-all cursor-pointer ${
                    sessionMinutes === mins
                      ? 'bg-espresso-800 text-ivory-50 border-espresso-800 dark:bg-ivory-100 dark:text-espresso-900 shadow-subtle'
                      : 'bg-white dark:bg-espresso-700 text-espresso-600 dark:text-espresso-300 border-ivory-300 dark:border-espresso-600 hover:border-ivory-400'
                  }`}
                >
                  {mins}m
                </button>
              ))}
            </div>

            {/* Custom minute stepper adjuster */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleAdjustCustomMinutes(-5)}
                disabled={isRunning || sessionMinutes <= 5}
                aria-label="Decrease duration by 5 minutes"
                title="Decrease 5 minutes"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border-0 bg-transparent text-2xl leading-none font-medium text-espresso-700 dark:text-ivory-200 hover:text-[var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:opacity-35 transition-colors cursor-pointer"
              >
                −
              </button>

              <span className="text-xs font-mono font-semibold text-espresso-700 dark:text-espresso-300">
                Custom Duration: <strong className="text-espresso-950 dark:text-ivory-50 font-bold">{sessionMinutes} mins</strong>
              </span>

              <button
                type="button"
                onClick={() => handleAdjustCustomMinutes(5)}
                disabled={isRunning || sessionMinutes >= 360}
                aria-label="Increase duration by 5 minutes"
                title="Increase 5 minutes"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border-0 bg-transparent text-2xl leading-none font-medium text-espresso-700 dark:text-ivory-200 hover:text-[var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:opacity-35 transition-colors cursor-pointer"
              >
                +
              </button>
            </div>
          </div>
        )}

        {/* 3. Action Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-2.5">
          {timerMode === 'stopwatch' ? (
            <>
              {/* Stopwatch Start / Pause */}
              <Button
                variant={isRunning ? 'secondary' : 'terracotta'}
                size="md"
                onClick={handleToggleTimer}
                icon={isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              >
                {isRunning ? 'Pause' : stopwatchSeconds === 0 ? 'Start Stopwatch' : 'Resume'}
              </Button>

              {/* Lap Split Button */}
              <Button
                variant="secondary"
                size="md"
                onClick={handleLap}
                disabled={stopwatchSeconds === 0}
                title="Record split lap time"
                icon={<Flag className="w-4 h-4 text-ochre-600 dark:text-ochre-400" />}
              >
                Lap
              </Button>

              {/* Log Stopwatch Session */}
              <Button
                variant="secondary"
                size="md"
                onClick={handleLogStopwatchSession}
                disabled={stopwatchSeconds === 0}
                title="Log elapsed stopwatch focus time"
                icon={<Check className="w-4 h-4 text-sage-600 dark:text-sage-400" />}
              >
                Log Session
              </Button>

              {/* Reset */}
              <Button
                variant="ghost"
                size="md"
                onClick={handleReset}
                title="Reset stopwatch and laps"
                icon={<RotateCcw className="w-4 h-4" />}
              />
            </>
          ) : (
            <>
              {/* Pomodoro & Countdown Timer Controls */}
              <Button
                variant={isRunning ? 'secondary' : 'terracotta'}
                size="md"
                onClick={handleToggleTimer}
                icon={isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              >
                {isRunning
                  ? 'Pause'
                  : timeLeft === sessionMinutes * 60
                  ? timerMode === 'pomodoro'
                    ? 'Start Focus'
                    : 'Start Timer'
                  : 'Resume'}
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
                  Stop &amp; Log
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
                onClick={handleLogCurrentActiveOrFull}
                title="Log actual focused time (or full preset if not running)"
                icon={<Check className="w-4 h-4 text-sage-600 dark:text-sage-400" />}
              >
                Log Now
              </Button>
            </>
          )}
        </div>

        {/* Stopwatch Recorded Laps Table */}
        {timerMode === 'stopwatch' && laps.length > 0 && (
          <div className="w-full mt-4 max-h-40 overflow-y-auto rounded-xl border border-ivory-200 dark:border-espresso-750 bg-white/70 dark:bg-espresso-850/70 p-2.5 text-xs text-left">
            <div className="flex items-center justify-between pb-1.5 border-b border-ivory-200 dark:border-espresso-750 font-mono text-[10px] uppercase text-espresso-400 dark:text-espresso-500 font-semibold px-2">
              <span>Lap #</span>
              <span>Split</span>
              <span>Total Elapsed</span>
            </div>
            <div className="divide-y divide-ivory-150 dark:divide-espresso-800">
              {laps.map((lap) => (
                <div
                  key={lap.id}
                  className="flex items-center justify-between py-1.5 px-2 font-mono tabular-nums text-espresso-800 dark:text-ivory-200"
                >
                  <span className="font-semibold text-terracotta-600 dark:text-terracotta-400">
                    Lap {lap.lapNumber}
                  </span>
                  <span className="text-espresso-500 dark:text-espresso-400">
                    +{formatFocusTime(lap.lapTimeSeconds)}
                  </span>
                  <span className="font-bold">{formatFocusTime(lap.totalTimeSeconds, true)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

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
            placeholder={
              timerMode === 'stopwatch'
                ? 'e.g. Uncut deep problem solving marathon...'
                : 'e.g. Solved 5 algorithmic graph problems...'
            }
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
            View 7-day analytics &amp; streaks
          </span>
          <button
            onClick={onNavigateToFocus}
            className="inline-flex items-center gap-1 text-xs font-bold transition hover:underline cursor-pointer"
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

      {/* Deep Focus 3.0 is portaled to document.body by the immersive component. */}
      <DeepFocusFullscreen
        isOpen={isFullscreenOpen}
        plannerFocusLaunch={plannerFocusLaunch}
        onClose={(snapshot) => {
          setIsFullscreenOpen(false);
          const progress = calculateTimerProgress(snapshot);
          if (snapshot.mode === 'stopwatch') {
            setTimerMode('stopwatch');
            setStopwatchSeconds(progress.elapsedFocusSeconds);
            if (snapshot.laps) setLaps(snapshot.laps);
          } else {
            setTimerMode(snapshot.mode === 'timer' ? 'timer' : 'pomodoro');
            setSessionMinutes(Math.max(1, Math.round(snapshot.plannedSeconds / 60)));
            setTimeLeft(progress.timeLeftSeconds);
          }
          if (snapshot.subjectId) setSelectedSubjectId(snapshot.subjectId);
          accumulatedSecondsRef.current = progress.elapsedFocusSeconds;
          lastStartedTimestampRef.current = snapshot.isRunning ? Date.now() : null;
          sessionStartedAtRef.current = snapshot.sessionStartedAt || null;
          setIsRunning(snapshot.isRunning);
          if (!snapshot.isRunning && snapshot.status === 'completed') clearActiveTimer();
          if (plannerFocusLaunch) onPlannerFocusLaunchConsumed?.();
        }}
        initialMinutes={sessionMinutes}
        initialMode={timerMode}
      />
    </Card>
  );
};
