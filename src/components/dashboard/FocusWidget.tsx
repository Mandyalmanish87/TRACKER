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
  requestTimerPip,
  isPipSupported,
  formatFocusTime,
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
  Maximize2,
  Clock,
  Timer,
  Flag,
  Plus,
  Minus,
  Coffee,
} from 'lucide-react';
import { Focus3DVisualizer } from '../focus/Focus3DVisualizer';
import { DeepFocusFullscreen } from '../focus/DeepFocusFullscreen';

interface FocusWidgetProps {
  onNavigateToFocus?: () => void;
  showExtendedAnalyticsLink?: boolean;
}

export const FocusWidget: React.FC<FocusWidgetProps> = ({
  onNavigateToFocus,
  showExtendedAnalyticsLink = false,
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

  // Stopwatch state & recorded laps
  const [stopwatchSeconds, setStopwatchSeconds] = useState<number>(0);
  const [laps, setLaps] = useState<StopwatchLap[]>([]);

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

        // Update PiP display if active
        if (pipControllerRef.current?.isActive) {
          const timeStr = formatFocusTime(totalElapsed, true);
          const subName =
            unifiedSubjects.find((sub) => sub.id === selectedSubjectId)?.name || 'General Focus';
          pipControllerRef.current.update(timeStr, `⏱ Stopwatch · ${subName}`, true);
        }
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

        // Update PiP display if active
        if (pipControllerRef.current?.isActive) {
          const timeStr = formatFocusTime(remaining, sessionMinutes >= 60);
          const subName =
            unifiedSubjects.find((sub) => sub.id === selectedSubjectId)?.name || 'General Focus';
          const modeLabel =
            timerMode === 'pomodoro'
              ? pomodoroPhase === 'work'
                ? '🍅 Pomodoro'
                : '☕ Break'
              : '⏳ Timer';
          pipControllerRef.current.update(timeStr, `${modeLabel} · ${subName}`, true);
        }

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

    if (pipControllerRef.current?.isActive) {
      pipControllerRef.current.close();
      setIsPipActive(false);
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

        if (pipControllerRef.current?.isActive) {
          const timeStr = formatFocusTime(stopwatchSeconds, true);
          const subName =
            unifiedSubjects.find((sub) => sub.id === selectedSubjectId)?.name || 'General Focus';
          pipControllerRef.current.update(timeStr, `⏸ Stopwatch · ${subName}`, false);
        }
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

        if (pipControllerRef.current?.isActive) {
          const timeStr = formatFocusTime(timeLeft, sessionMinutes >= 60);
          const subName =
            unifiedSubjects.find((sub) => sub.id === selectedSubjectId)?.name || 'General Focus';
          pipControllerRef.current.update(timeStr, subName, false);
        }
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

  // ── Picture-in-Picture Toggle ──
  const handleTogglePip = async () => {
    if (isPipActive && pipControllerRef.current) {
      pipControllerRef.current.close();
      setIsPipActive(false);
      return;
    }

    const timeStr =
      timerMode === 'stopwatch'
        ? formatFocusTime(stopwatchSeconds, true)
        : formatFocusTime(timeLeft, sessionMinutes >= 60);

    const subName =
      unifiedSubjects.find((s) => s.id === selectedSubjectId)?.name || 'General Focus';
    const modeLabel =
      timerMode === 'pomodoro'
        ? '🍅 Pomodoro'
        : timerMode === 'timer'
        ? '⏳ Timer'
        : '⏱ Stopwatch';

    const controller = await requestTimerPip(`${modeLabel} ${timeStr}`, subName, isRunning, () => {
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

  // Compute live focus summaries & streaks
  const rolloverHour = state.settings?.studyDayRolloverHour ?? 0;
  const summary = calculateFocusSummaries(state.studySessions, new Date(), rolloverHour);
  const streaks = calculateStudyStreaks(state.studySessions, new Date(), rolloverHour);

  // Time display strings
  const formattedCountdown = formatFocusTime(timeLeft, sessionMinutes >= 60);
  const formattedStopwatch = formatFocusTime(stopwatchSeconds, true);

  return (
    <Card
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
      <div className="flex items-center justify-center p-1 rounded-xl bg-ivory-150 dark:bg-espresso-900 border border-ivory-300 dark:border-espresso-750 mb-4 max-w-sm mx-auto w-full select-none">
        <button
          type="button"
          onClick={() => handleSwitchMode('pomodoro')}
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
        className={`flex flex-col items-center justify-center py-6 px-4 rounded-2xl bg-ivory-100/90 dark:bg-espresso-800/90 border transition-all duration-300 text-center mb-6 relative overflow-hidden ${
          isRunning
            ? 'border-transparent neon-ring shadow-[0_0_30px_-5px_color-mix(in_srgb,var(--accent)_40%,transparent)]'
            : 'border-ivory-200 dark:border-espresso-750'
        }`}
      >
        {/* Fullscreen & PiP Controls */}
        <div className="absolute top-3 right-3 flex items-center gap-1.5 z-10">
          <button
            onClick={() => setIsFullscreenOpen(true)}
            title="Enter Fullscreen Mode"
            aria-label="Enter Fullscreen Mode"
            className="p-2 rounded-xl transition bg-white/80 dark:bg-espresso-700/80 text-espresso-700 dark:text-espresso-200 hover:text-espresso-950 dark:hover:text-white border border-ivory-300 dark:border-espresso-600 shadow-xs flex items-center gap-1 text-xs font-semibold cursor-pointer"
          >
            <Maximize2 className="w-3.5 h-3.5 text-terracotta-500" />
            <span className="hidden sm:inline">Fullscreen</span>
          </button>
          {pipSupported && (
            <button
              onClick={handleTogglePip}
              title={
                isPipActive
                  ? 'Close floating Picture-in-Picture window'
                  : 'Pop out floating Picture-in-Picture timer'
              }
              className={`p-2 rounded-xl transition cursor-pointer ${
                isPipActive
                  ? 'bg-espresso-800 text-ivory-50 dark:bg-ivory-100 dark:text-espresso-950 shadow-subtle'
                  : 'bg-white/80 dark:bg-espresso-700/80 text-espresso-600 dark:text-espresso-300 hover:text-espresso-900 border border-ivory-300 dark:border-espresso-600'
              }`}
            >
              <Tv className="w-3.5 h-3.5" />
            </button>
          )}
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

        {/* Large Digits */}
        <div className="relative my-2">
          {isRunning && (
            <div
              className="absolute -inset-4 rounded-full blur-xl animate-pulse pointer-events-none"
              style={{ backgroundColor: 'color-mix(in srgb, var(--accent) 25%, transparent)' }}
            />
          )}
          <span className="relative z-10 font-mono tabular-nums text-5xl sm:text-6xl font-bold tracking-tight text-espresso-950 dark:text-ivory-50 select-none">
            {timerMode === 'stopwatch' ? formattedStopwatch : formattedCountdown}
          </span>
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
                title="Decrease 5 minutes"
                className="p-1.5 rounded-lg border border-ivory-300 dark:border-espresso-600 bg-white dark:bg-espresso-700 text-espresso-700 dark:text-espresso-200 hover:bg-ivory-100 dark:hover:bg-espresso-600 disabled:opacity-40 transition cursor-pointer"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>

              <span className="text-xs font-mono font-semibold text-espresso-700 dark:text-espresso-300">
                Custom Duration: <strong className="text-espresso-950 dark:text-ivory-50 font-bold">{sessionMinutes} mins</strong>
              </span>

              <button
                type="button"
                onClick={() => handleAdjustCustomMinutes(5)}
                disabled={isRunning || sessionMinutes >= 360}
                title="Increase 5 minutes"
                className="p-1.5 rounded-lg border border-ivory-300 dark:border-espresso-600 bg-white dark:bg-espresso-700 text-espresso-700 dark:text-espresso-200 hover:bg-ivory-100 dark:hover:bg-espresso-600 disabled:opacity-40 transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
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

      {/* Deep Focus 2.0 Fullscreen Immersive Mode */}
      <DeepFocusFullscreen
        isOpen={isFullscreenOpen}
        onClose={() => {
          setIsFullscreenOpen(false);
          const saved = loadActiveTimer();
          if (saved) {
            if (saved.mode === 'stopwatch') {
              setTimerMode('stopwatch');
              const progress = calculateTimerProgress(saved);
              setStopwatchSeconds(progress.elapsedFocusSeconds);
              accumulatedSecondsRef.current = progress.elapsedFocusSeconds;
              setIsRunning(saved.isRunning);
              lastStartedTimestampRef.current = saved.isRunning ? Date.now() : null;
              if (saved.laps) setLaps(saved.laps);
            } else {
              if (saved.mode === 'timer') setTimerMode('timer');
              else setTimerMode('pomodoro');
              const progress = calculateTimerProgress(saved);
              setTimeLeft(progress.timeLeftSeconds);
              accumulatedSecondsRef.current = progress.elapsedFocusSeconds;
              setIsRunning(saved.isRunning);
              lastStartedTimestampRef.current = saved.isRunning ? Date.now() : null;
            }
          }
        }}
        initialMinutes={sessionMinutes}
        initialMode={timerMode}
      />
    </Card>
  );
};
