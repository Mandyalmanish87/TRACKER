import React, { useState, useEffect, useRef, useMemo, useCallback, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Maximize2,
  Minimize2,
  Play,
  Pause,
  RotateCcw,
  Check,
  StopCircle,
  Volume2,
  VolumeX,
  SkipForward,
  Music,
  BookOpen,
  Clock,
  Timer,
  Flame,
  Flag,
  Minus,
  Plus,
  Settings2,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  saveActiveTimer,
  loadActiveTimer,
  clearActiveTimer,
  calculateActiveElapsedSeconds,
  secondsToLoggedMinutes,
  formatFocusTime,
} from '../../utils/focusTimer';
import { ActiveTimerState, StopwatchLap } from '../../types';
import { PlannerFocusLaunch } from '../../types';
import { getActiveAccentRgba } from '../../utils/themeColors';
import { useFocusRadio, Visualizer } from '../focus-radio';

interface DeepFocusFullscreenProps {
  isOpen: boolean;
  onClose: (timerSnapshot: ActiveTimerState) => void;
  initialMinutes?: number;
  initialMode?: 'pomodoro' | 'timer' | 'stopwatch';
  plannerFocusLaunch?: PlannerFocusLaunch | null;
}

const SplitFlapDigit: React.FC<{ value: string }> = React.memo(({ value }) => {
  const [settledValue, setSettledValue] = useState(value);

  useLayoutEffect(() => {
    if (settledValue === value) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setSettledValue(value);
      return;
    }
    const timeout = window.setTimeout(() => setSettledValue(value), 360);
    return () => window.clearTimeout(timeout);
  }, [value, settledValue]);

  return (
    <span className="deep-focus-flip-digit" aria-hidden="true">
      <span className="deep-focus-flip-half deep-focus-flip-static-top"><span className="deep-focus-flip-glyph">{value}</span></span>
      <span className="deep-focus-flip-half deep-focus-flip-static-bottom"><span className="deep-focus-flip-glyph">{settledValue}</span></span>
      {settledValue !== value && (
        <span key={value} className="deep-focus-flip-motion" aria-hidden="true">
          <span className="deep-focus-flip-half deep-focus-flip-motion-upper"><span className="deep-focus-flip-glyph">{settledValue}</span></span>
          <span className="deep-focus-flip-half deep-focus-flip-motion-lower"><span className="deep-focus-flip-glyph">{value}</span></span>
        </span>
      )}
    </span>
  );
});

const FlipClockDisplay: React.FC<{ time: string; embedded?: boolean }> = ({ time, embedded = false }) => {
  if (embedded) {
    const groups = time.split(':');
    const leftValue = groups.length > 2 ? groups.slice(0, -1).join(':') : groups[0];
    const rightValue = groups[groups.length - 1];
    const renderDigits = (value: string, keyPrefix: string) => value.split('').map((digit, digitIndex) => (
      digit === ':'
        ? <span className="deep-focus-analog-flip-hour-separator" key={`${keyPrefix}-separator-${digitIndex}`}>:</span>
        : <SplitFlapDigit key={`${keyPrefix}-${digitIndex}`} value={digit} />
    ));

    return (
      <div className="deep-focus-analog-flip-display" aria-hidden="true">
        <span className="deep-focus-analog-flip-group is-left">{renderDigits(leftValue, 'left')}</span>
        <span className="deep-focus-analog-flip-group is-right">{renderDigits(rightValue, 'right')}</span>
      </div>
    );
  }

  return (
    <div className="deep-focus-flip-display" role="timer" aria-label={time}>
      <span className="deep-focus-flip-groups">
        {time.split(':').map((group, groupIndex, groups) => (
          <React.Fragment key={`flip-group-${groupIndex}`}>
            <span className="deep-focus-flip-group">
              {group.split('').map((digit, digitIndex) => <SplitFlapDigit key={`${groupIndex}-${digitIndex}`} value={digit} />)}
            </span>
            {groupIndex < groups.length - 1 && <span className="deep-focus-flip-separator">:</span>}
          </React.Fragment>
        ))}
      </span>
    </div>
  );
};

const AnalogClock: React.FC<{ time: string; progress: number; flipClock?: boolean }> = ({ time, progress, flipClock = false }) => {
  const parts = time.split(':').map((part) => Number.parseInt(part, 10) || 0);
  const [hours, minutes, seconds] = parts.length === 3 ? parts : [0, parts[0] || 0, parts[1] || 0];
  const ticks = Array.from({ length: 60 }, (_, index) => index);
  const hourNumbers = Array.from({ length: 12 }, (_, index) => index + 1);
  const circumference = 2 * Math.PI * 178;

  return (
    <div className="deep-focus-analog" role="timer" aria-label={time}>
      <svg className="deep-focus-analog-svg" viewBox="0 0 400 400" aria-hidden="true">
        <defs>
          <radialGradient id="focus-dial-face" cx="46%" cy="38%" r="72%">
            <stop offset="0%" stopColor="#303638" />
            <stop offset="72%" stopColor="#1b2022" />
            <stop offset="100%" stopColor="#101314" />
          </radialGradient>
        </defs>
        <circle className="deep-focus-analog-track" cx="200" cy="200" r="178" />
        <circle className="deep-focus-analog-progress" cx="200" cy="200" r="178" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - progress)} />
        <circle className="deep-focus-analog-rim" cx="200" cy="200" r="165" />
        {ticks.map((tick) => <line key={tick} className={`deep-focus-analog-tick ${tick % 5 === 0 ? 'is-major' : ''}`} x1="200" y1={tick % 5 === 0 ? '68' : '72'} x2="200" y2={tick % 5 === 0 ? '84' : '80'} transform={`rotate(${tick * 6} 200 200)`} />)}
        {hourNumbers.map((number) => {
          const angle = ((number % 12) * 30 - 90) * (Math.PI / 180);
          const radius = 151;
          return (
            <text
              key={number}
              className="deep-focus-analog-number"
              x={200 + Math.cos(angle) * radius}
              y={200 + Math.sin(angle) * radius}
              textAnchor="middle"
              dominantBaseline="central"
            >
              {number}
            </text>
          );
        })}
      </svg>
      {flipClock
        ? <FlipClockDisplay time={time} embedded />
        : <span className="deep-focus-analog-digital" aria-hidden="true">{time}</span>}
      <svg className="deep-focus-analog-hands" viewBox="0 0 400 400" aria-hidden="true">
        <line className="deep-focus-analog-hand is-hour" x1="200" y1="215" x2="200" y2="112" style={{ transform: `rotate(${(hours % 12) * 30 + minutes * 0.5}deg)` }} />
        <line className="deep-focus-analog-hand is-minute" x1="200" y1="215" x2="200" y2="76" style={{ transform: `rotate(${minutes * 6 + seconds * 0.1}deg)` }} />
        <line className="deep-focus-analog-hand is-second" x1="200" y1="222" x2="200" y2="61" style={{ transform: `rotate(${seconds * 6}deg)` }} />
        <circle className="deep-focus-analog-pin" cx="200" cy="200" r="8" />
      </svg>
    </div>
  );
};

export const DeepFocusFullscreen: React.FC<DeepFocusFullscreenProps> = ({
  isOpen,
  onClose,
  initialMinutes = 25,
  initialMode = 'pomodoro',
  plannerFocusLaunch,
}) => {
  const {
    state,
    logStudySession,
    updateTask,
  } = useApp();

  // Mode: Pomodoro, Timer, or Stopwatch
  const [timerMode, setTimerMode] = useState<'pomodoro' | 'timer' | 'stopwatch'>(initialMode);

  // Fullscreen browser state
  const [isBrowserFullscreen, setIsBrowserFullscreen] = useState(false);
  const [centerScale, setCenterScale] = useState(1);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarPinned, setIsSidebarPinned] = useState(false);
  const [isClockOnly, setIsClockOnly] = useState(() => {
    const savedPreference = window.localStorage.getItem('deep-focus-clock-only');
    return savedPreference === null
      ? window.localStorage.getItem('deep-focus-flip-clock-only') === 'true'
      : savedPreference === 'true';
  });
  const [clockStyle, setClockStyle] = useState<'orbit' | 'flip' | 'clean' | 'analog-flip'>(() => {
    const saved = window.localStorage.getItem('deep-focus-clock-style');
    return saved === 'flip' || saved === 'clean' || saved === 'analog-flip' ? saved : 'orbit';
  });
  const [clockSoundOn, setClockSoundOn] = useState(() => window.localStorage.getItem('deep-focus-clock-sound') === 'on');
  const [clockVolume, setClockVolume] = useState(() => {
    const saved = Number(window.localStorage.getItem('deep-focus-clock-volume'));
    return Number.isFinite(saved) && saved >= 0 ? Math.min(100, saved) : 30;
  });
  const clockAudioRef = useRef<AudioContext | null>(null);
  const previousClockValueRef = useRef<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sidebarCloseTimerRef = useRef<number | null>(null);

  // Timer states
  const [sessionMinutes, setSessionMinutes] = useState(initialMinutes);
  const [timeLeft, setTimeLeft] = useState(initialMinutes * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [sessionStatus, setSessionStatus] = useState<'idle' | 'running' | 'paused' | 'completed'>('idle');

  // Stopwatch state & recorded laps
  const [stopwatchSeconds, setStopwatchSeconds] = useState<number>(0);
  const [laps, setLaps] = useState<StopwatchLap[]>([]);

  // Precision tracking refs
  const accumulatedSecondsRef = useRef<number>(0);
  const lastStartedTimestampRef = useRef<number | null>(null);
  const sessionStartedAtRef = useRef<string | null>(null);
  const completionHandledRef = useRef(false);
  const [loggedNotification, setLoggedNotification] = useState<string | null>(null);

  // Focus radio integration
  const radio = useFocusRadio();

  // Unified Subject options
  const unifiedSubjects = useMemo(() => {
    const list: { id: string; name: string }[] = [];
    (state.subjects || []).forEach((s) => {
      list.push({ id: s.id, name: `${s.code} — ${s.name}` });
    });
    (state.syllabusSubjects || []).forEach((s) => {
      if (!list.some((item) => item.id === s.id)) {
        list.push({ id: s.id, name: s.name });
      }
    });
    return list;
  }, [state.subjects, state.syllabusSubjects]);

  // Sync with active saved timer upon opening
  useEffect(() => {
    if (!isOpen) return;

    if (plannerFocusLaunch) {
      const hasDuration = Boolean(plannerFocusLaunch.estimatedDuration && plannerFocusLaunch.estimatedDuration > 0);
      const nextMinutes = hasDuration ? Math.max(1, Math.round(plannerFocusLaunch.estimatedDuration!)) : 25;
      setTimerMode(hasDuration ? 'timer' : 'stopwatch');
      setSessionMinutes(nextMinutes);
      setTimeLeft(nextMinutes * 60);
      setStopwatchSeconds(0);
      setSelectedSubjectId(plannerFocusLaunch.subjectId || '');
      setLaps([]);
      completionHandledRef.current = false;
      accumulatedSecondsRef.current = 0;
      lastStartedTimestampRef.current = null;
      sessionStartedAtRef.current = null;
      setIsRunning(false);
      setSessionStatus('idle');
      return;
    }

    const saved = loadActiveTimer();
    if (saved) {
      if (saved.mode === 'stopwatch') {
        setTimerMode('stopwatch');
        if (saved.subjectId) setSelectedSubjectId(saved.subjectId);
        if (saved.laps) setLaps(saved.laps);
        sessionStartedAtRef.current = saved.sessionStartedAt || new Date().toISOString();

        const elapsed = calculateActiveElapsedSeconds(
          0,
          saved.accumulatedSeconds,
          saved.lastStartedTimestamp,
          saved.isRunning
        );
        accumulatedSecondsRef.current = elapsed;
        setStopwatchSeconds(elapsed);

        if (saved.isRunning) {
          setIsRunning(true);
          setSessionStatus('running');
          lastStartedTimestampRef.current = Date.now();
        } else if (elapsed > 0) {
          setIsRunning(false);
          setSessionStatus('paused');
          lastStartedTimestampRef.current = null;
        } else {
          setIsRunning(false);
          setSessionStatus('idle');
        }
      } else {
        if (saved.mode === 'timer') {
          setTimerMode('timer');
        } else {
          setTimerMode('pomodoro');
        }

        const plannedMins = Math.max(1, Math.round(saved.plannedSeconds / 60));
        setSessionMinutes(plannedMins);
        if (saved.subjectId) setSelectedSubjectId(saved.subjectId);
        sessionStartedAtRef.current = saved.sessionStartedAt || new Date().toISOString();

        const elapsed = calculateActiveElapsedSeconds(
          saved.plannedSeconds,
          saved.accumulatedSeconds,
          saved.lastStartedTimestamp,
          saved.isRunning
        );

        accumulatedSecondsRef.current = elapsed;
        const rem = Math.max(0, saved.plannedSeconds - elapsed);
        setTimeLeft(rem);

        if (saved.isRunning && rem > 0) {
          setIsRunning(true);
          setSessionStatus('running');
          lastStartedTimestampRef.current = Date.now();
        } else if (rem === 0) {
          setIsRunning(false);
          setSessionStatus('completed');
          lastStartedTimestampRef.current = null;
        } else if (elapsed > 0) {
          setIsRunning(false);
          setSessionStatus('paused');
          lastStartedTimestampRef.current = null;
        } else {
          setIsRunning(false);
          setSessionStatus('idle');
        }
      }
    } else {
      if (initialMode === 'stopwatch') {
        setTimerMode('stopwatch');
        setStopwatchSeconds(0);
      } else {
        setTimerMode(initialMode || 'pomodoro');
        setTimeLeft(sessionMinutes * 60);
      }
      accumulatedSecondsRef.current = 0;
      lastStartedTimestampRef.current = null;
      sessionStartedAtRef.current = null;
      setIsRunning(false);
      setSessionStatus('idle');
    }
  }, [isOpen, initialMode, plannerFocusLaunch?.id]);

  // Fullscreen request & exit helpers
  const enterFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
          setIsBrowserFullscreen(true);
        }
      }
    } catch {
      // Graceful fallback: modal covers full screen via fixed inset-0
      setIsBrowserFullscreen(false);
    }
  }, []);

  const handleToggleBrowserFullscreen = () => {
    if (document.fullscreenElement) {
      void document.exitFullscreen?.().catch(() => undefined).finally(() => setIsBrowserFullscreen(false));
    } else {
      void enterFullscreen();
    }
  };

  const closeImmersive = useCallback(async () => {
    const now = Date.now();
    const rawElapsed = timerMode === 'stopwatch'
      ? accumulatedSecondsRef.current + (isRunning && lastStartedTimestampRef.current ? Math.floor((now - lastStartedTimestampRef.current) / 1000) : 0)
      : accumulatedSecondsRef.current + (isRunning && lastStartedTimestampRef.current ? Math.floor((now - lastStartedTimestampRef.current) / 1000) : 0);
    const plannedSeconds = timerMode === 'stopwatch' ? 0 : sessionMinutes * 60;
    const elapsedSeconds = timerMode === 'stopwatch' ? Math.max(0, rawElapsed) : Math.min(plannedSeconds, Math.max(0, rawElapsed));
    const remainingSeconds = timerMode === 'stopwatch' ? elapsedSeconds : Math.max(0, plannedSeconds - elapsedSeconds);
    const status = timerMode === 'stopwatch'
      ? isRunning ? 'running' : elapsedSeconds > 0 ? 'paused' : 'idle'
      : remainingSeconds === 0 || sessionStatus === 'completed' ? 'completed' : isRunning ? 'running' : elapsedSeconds > 0 ? 'paused' : 'idle';
    const snapshot: ActiveTimerState = {
      mode: timerMode,
      plannedSeconds,
      accumulatedSeconds: elapsedSeconds,
      lastStartedTimestamp: isRunning ? now : null,
      isRunning,
      subjectId: selectedSubjectId || undefined,
      sessionStartedAt: sessionStartedAtRef.current || undefined,
      status,
      laps: timerMode === 'stopwatch' ? laps : undefined,
    };
    if (document.fullscreenElement) {
      try { await document.exitFullscreen(); } catch { /* CSS scene remains available as a fallback. */ }
    }
    setIsSidebarOpen(false);
    setIsSidebarPinned(false);
    onClose(snapshot);
  }, [timerMode, isRunning, sessionMinutes, sessionStatus, selectedSubjectId, laps, onClose]);

  const setClockDisplayStyle = useCallback((style: 'analog' | 'flip' | 'clean' | 'analog-flip') => {
    const storedStyle = style === 'analog' ? 'orbit' : style;
    setClockStyle(storedStyle);
    try { window.localStorage.setItem('deep-focus-clock-style', storedStyle); } catch { /* Optional preference. */ }
    window.dispatchEvent(new CustomEvent('tracker:focus-clock-style-updated'));
  }, []);

  const openSidebar = () => {
    if (sidebarCloseTimerRef.current) window.clearTimeout(sidebarCloseTimerRef.current);
    sidebarCloseTimerRef.current = null;
    setIsSidebarOpen(true);
  };

  const scheduleSidebarClose = () => {
    if (isSidebarPinned) return;
    if (sidebarCloseTimerRef.current) window.clearTimeout(sidebarCloseTimerRef.current);
    sidebarCloseTimerRef.current = window.setTimeout(() => setIsSidebarOpen(false), 180);
  };

  // Keyboard shortcut listener (Escape to exit)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isSidebarOpen && !document.fullscreenElement) {
          setIsSidebarOpen(false);
          setIsSidebarPinned(false);
          return;
        }
        void closeImmersive();
      } else if (e.key === 'Enter' && !(e.target instanceof Element && e.target.closest('input, textarea, select, button, a, [role="button"], [contenteditable="true"]'))) {
        e.preventDefault();
        handleToggleTimer();
      }
    };

    const handleFullscreenChange = () => {
      setIsBrowserFullscreen(Boolean(document.fullscreenElement));
    };

    setIsBrowserFullscreen(Boolean(document.fullscreenElement));
    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [isOpen, isRunning, isSidebarOpen, closeImmersive]);

  // ── High-Precision Live Timer Loop ──
  useEffect(() => {
    if (!isOpen || !isRunning) return;

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
          sessionStartedAt: sessionStartedAtRef.current || undefined,
          status: 'running',
          laps,
        };
        saveActiveTimer(activeState);
      } else {
        const plannedSec = sessionMinutes * 60;
        const remaining = Math.max(0, plannedSec - totalElapsed);

        setTimeLeft(remaining);

        // Persist active timer state
        const activeState: ActiveTimerState = {
          mode: timerMode,
          plannedSeconds: plannedSec,
          accumulatedSeconds: accumulatedSecondsRef.current,
          lastStartedTimestamp: lastStartedTimestampRef.current,
          isRunning: true,
          subjectId: selectedSubjectId,
          sessionStartedAt: sessionStartedAtRef.current || undefined,
          status: 'running',
        };
        saveActiveTimer(activeState);

        // Check completion
        if (remaining === 0) {
          setIsRunning(false);
          setSessionStatus('completed');
          lastStartedTimestampRef.current = null;
          accumulatedSecondsRef.current = plannedSec;
          clearActiveTimer();

          if (!completionHandledRef.current) {
            completionHandledRef.current = true;
            // Log exact completed duration once, then finish the linked task.
            handleLogSession(sessionMinutes, 'completed', plannedSec);
            if (plannerFocusLaunch?.taskId) {
              updateTask(plannerFocusLaunch.taskId, { status: 'done' });
            }
          }
        }
      }
    }, 500);

    return () => clearInterval(interval);
  }, [isOpen, isRunning, timerMode, sessionMinutes, selectedSubjectId, laps, plannerFocusLaunch?.id, updateTask]);

  // Switch between Pomodoro, Timer, and Stopwatch
  const handleSwitchMode = (newMode: 'pomodoro' | 'timer' | 'stopwatch') => {
    if (newMode === timerMode) return;

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
      setSessionMinutes(30);
      setTimeLeft(30 * 60);
    } else {
      accumulatedSecondsRef.current = 0;
      setSessionMinutes(25);
      setTimeLeft(25 * 60);
    }
    setSessionStatus('idle');
  };

  // Timer controls
  const handleToggleTimer = () => {
    if (isRunning) {
      // Pause
      if (lastStartedTimestampRef.current) {
        accumulatedSecondsRef.current += Math.floor(
          (Date.now() - lastStartedTimestampRef.current) / 1000
        );
      }
      lastStartedTimestampRef.current = null;
      setIsRunning(false);
      setSessionStatus('paused');

      if (timerMode === 'stopwatch') {
        saveActiveTimer({
          mode: 'stopwatch',
          plannedSeconds: 0,
          accumulatedSeconds: accumulatedSecondsRef.current,
          lastStartedTimestamp: null,
          isRunning: false,
          subjectId: selectedSubjectId,
          sessionStartedAt: sessionStartedAtRef.current || undefined,
          status: 'paused',
          laps,
        });
      } else {
        saveActiveTimer({
          mode: timerMode,
          plannedSeconds: sessionMinutes * 60,
          accumulatedSeconds: accumulatedSecondsRef.current,
          lastStartedTimestamp: null,
          isRunning: false,
          subjectId: selectedSubjectId,
          sessionStartedAt: sessionStartedAtRef.current || undefined,
          status: 'paused',
        });
      }
    } else {
      // Resume / Start
      lastStartedTimestampRef.current = Date.now();
      if (!sessionStartedAtRef.current) {
        sessionStartedAtRef.current = new Date().toISOString();
      }
      setIsRunning(true);
      setSessionStatus('running');
    }
  };

  // Record a lap in stopwatch mode
  const handleLap = () => {
    let currentTotal = accumulatedSecondsRef.current;
    if (isRunning && lastStartedTimestampRef.current) {
      currentTotal += Math.floor((Date.now() - lastStartedTimestampRef.current) / 1000);
    }
    if (currentTotal <= 0) return;

    const prevLapTotal = laps.length > 0 ? laps[0].totalTimeSeconds : 0;
    const split = Math.max(0, currentTotal - prevLapTotal);

    const newLap: StopwatchLap = {
      id: `lap-fs-${Date.now()}-${laps.length + 1}`,
      lapNumber: laps.length + 1,
      lapTimeSeconds: split,
      totalTimeSeconds: currentTotal,
    };

    setLaps((prev) => [newLap, ...prev]);
  };

  // Log active stopwatch time
  const handleLogStopwatchSession = () => {
    let activeSec = accumulatedSecondsRef.current;
    if (isRunning && lastStartedTimestampRef.current) {
      activeSec += Math.floor((Date.now() - lastStartedTimestampRef.current) / 1000);
    }
    if (activeSec <= 0) return;

    const actualMins = Number((activeSec / 60).toFixed(2));
    handleLogSession(actualMins, 'completed', activeSec);
    handleReset();
  };

  const handleSelectPreset = (mins: number) => {
    if (isRunning) return;
    setSessionMinutes(mins);
    setTimeLeft(mins * 60);
    accumulatedSecondsRef.current = 0;
    lastStartedTimestampRef.current = null;
    sessionStartedAtRef.current = null;
    setSessionStatus('idle');
    clearActiveTimer();
  };

  const getMinimumTimerMinutes = () => {
    let elapsedSeconds = accumulatedSecondsRef.current;
    if (isRunning && lastStartedTimestampRef.current) {
      elapsedSeconds += Math.floor((Date.now() - lastStartedTimestampRef.current) / 1000);
    }
    return Math.max(1, Math.ceil(elapsedSeconds / 60));
  };

  const handleAdjustTimer = (minuteDelta: number) => {
    if (timerMode === 'stopwatch' || sessionStatus === 'completed') return;
    const elapsedSeconds = accumulatedSecondsRef.current + (isRunning && lastStartedTimestampRef.current
      ? Math.floor((Date.now() - lastStartedTimestampRef.current) / 1000)
      : 0);
    const minimumMinutes = getMinimumTimerMinutes();
    const requestedMinutes = sessionMinutes + minuteDelta;
    if (requestedMinutes < minimumMinutes || requestedMinutes > 240) return;
    const nextMinutes = requestedMinutes;
    if (nextMinutes === sessionMinutes) return;
    setSessionMinutes(nextMinutes);
    setTimeLeft(Math.max(0, nextMinutes * 60 - elapsedSeconds));
  };

  const handleReset = () => {
    completionHandledRef.current = false;
    setIsRunning(false);
    lastStartedTimestampRef.current = null;
    accumulatedSecondsRef.current = 0;
    sessionStartedAtRef.current = null;
    setSessionStatus('idle');
    clearActiveTimer();

    if (timerMode === 'stopwatch') {
      setStopwatchSeconds(0);
      setLaps([]);
    } else {
      setTimeLeft(sessionMinutes * 60);
    }
  };

  // Stop & Log actual active time accumulated
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

    const actualMinutes = secondsToLoggedMinutes(actualSeconds, sessionMinutes * 60);
    handleLogSession(actualMinutes, 'interrupted', actualSeconds);
    handleReset();
  };

  const handleLogSession = (
    minsToLog: number,
    status: 'completed' | 'interrupted' = 'completed',
    secondsToLog?: number
  ) => {
    const actualSeconds = secondsToLog ?? Math.round(minsToLog * 60);
    if (actualSeconds <= 0) return;

    const nowIso = new Date().toISOString();
    const startIso = sessionStartedAtRef.current || nowIso;

    logStudySession(minsToLog, selectedSubjectId || undefined, undefined, {
      plannedDurationMinutes: sessionMinutes,
      durationSeconds: actualSeconds,
      status,
      startTime: startIso,
      endTime: nowIso,
      id: `study-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    });

    setLoggedNotification(
      status === 'completed'
        ? `Logged full ${minsToLog}m Deep Focus session!`
        : `Logged ${minsToLog}m focused time (${actualSeconds}s active).`
    );
    setTimeout(() => setLoggedNotification(null), 4000);
  };

  // ── Canvas Ambient Animation (Slow Stars, Gentle Floating, Occasional Shooting Star) ──
  useEffect(() => {
    if (!isOpen) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    // Star field
    const STAR_COUNT = 90;
    const stars = Array.from({ length: STAR_COUNT }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      radius: Math.random() * 1.5 + 0.5,
      alpha: Math.random() * 0.7 + 0.3,
      speed: Math.random() * 0.15 + 0.05,
      twinkleSpeed: Math.random() * 0.02 + 0.005,
      twinklePhase: Math.random() * Math.PI * 2,
    }));

    // Shooting stars state (triggers occasionally: every 10-18 seconds)
    let shootingStar: {
      x: number;
      y: number;
      length: number;
      speed: number;
      angle: number;
      alpha: number;
      life: number;
      maxLife: number;
    } | null = null;

    let lastShootingStarTime = Date.now();

    let isDocumentVisible = !document.hidden;
    const handleVisibility = () => {
      isDocumentVisible = !document.hidden;
    };
    document.addEventListener('visibilitychange', handleVisibility);

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const render = () => {
      if (!isDocumentVisible || prefersReducedMotion) {
        animationFrameId = requestAnimationFrame(render);
        return;
      }

      ctx.clearRect(0, 0, width, height);

      // Deep night sky gradient
      const bgGradient = ctx.createRadialGradient(
        width / 2,
        height / 2,
        100,
        width / 2,
        height / 2,
        Math.max(width, height) * 0.8
      );
      bgGradient.addColorStop(0, '#120F16');
      bgGradient.addColorStop(0.5, '#0B090E');
      bgGradient.addColorStop(1, '#050407');
      ctx.fillStyle = bgGradient;
      ctx.fillRect(0, 0, width, height);

      // Subtle atmospheric nebula glow at bottom
      const nebulaGradient = ctx.createRadialGradient(
        width / 2,
        height * 0.9,
        50,
        width / 2,
        height * 0.9,
        width * 0.6
      );
      nebulaGradient.addColorStop(0, getActiveAccentRgba(0.08));
      nebulaGradient.addColorStop(1, 'transparent');
      ctx.fillStyle = nebulaGradient;
      ctx.fillRect(0, 0, width, height);

      // Draw and animate stars
      ctx.fillStyle = '#FFFFFF';
      stars.forEach((star) => {
        star.y -= star.speed;
        if (star.y < 0) {
          star.y = height;
          star.x = Math.random() * width;
        }

        star.twinklePhase += star.twinkleSpeed;
        const currentAlpha = star.alpha * (0.6 + 0.4 * Math.sin(star.twinklePhase));

        ctx.globalAlpha = currentAlpha;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;

      // Occasional Shooting Star
      const now = Date.now();
      if (!shootingStar && now - lastShootingStarTime > 12000) {
        if (Math.random() < 0.04) {
          shootingStar = {
            x: Math.random() * width * 0.7,
            y: Math.random() * height * 0.4,
            length: Math.random() * 80 + 60,
            speed: Math.random() * 7 + 8,
            angle: Math.PI / 4 + (Math.random() * 0.2 - 0.1),
            alpha: 1,
            life: 0,
            maxLife: 45,
          };
          lastShootingStarTime = now;
        }
      }

      if (shootingStar) {
        shootingStar.x += Math.cos(shootingStar.angle) * shootingStar.speed;
        shootingStar.y += Math.sin(shootingStar.angle) * shootingStar.speed;
        shootingStar.life++;
        shootingStar.alpha = Math.max(0, 1 - shootingStar.life / shootingStar.maxLife);

        const tailX = shootingStar.x - Math.cos(shootingStar.angle) * shootingStar.length;
        const tailY = shootingStar.y - Math.sin(shootingStar.angle) * shootingStar.length;

        const starGrad = ctx.createLinearGradient(tailX, tailY, shootingStar.x, shootingStar.y);
        starGrad.addColorStop(0, 'transparent');
        starGrad.addColorStop(1, `rgba(255, 230, 200, ${shootingStar.alpha})`);

        ctx.strokeStyle = starGrad;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.lineTo(shootingStar.x, shootingStar.y);
        ctx.stroke();

        if (shootingStar.life >= shootingStar.maxLife) {
          shootingStar = null;
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [isOpen]);

  const progressRatio =
    timerMode === 'stopwatch'
      ? (stopwatchSeconds % 60) / 60
      : Math.max(0, Math.min(1, 1 - timeLeft / (sessionMinutes * 60)));

  const displayTime =
    timerMode === 'stopwatch'
      ? formatFocusTime(stopwatchSeconds, true)
      : formatFocusTime(timeLeft, sessionMinutes >= 60);

  useEffect(() => {
    if (!isOpen) return;
    const syncFromMiniPanel = () => {
      const saved = loadActiveTimer();
      if (!saved) return;
      if (saved.mode === 'stopwatch') {
        setTimerMode('stopwatch');
        setStopwatchSeconds(calculateActiveElapsedSeconds(0, saved.accumulatedSeconds, saved.lastStartedTimestamp, saved.isRunning));
        if (saved.laps) setLaps(saved.laps);
      } else {
        setTimerMode(saved.mode === 'timer' ? 'timer' : 'pomodoro');
        setSessionMinutes(Math.max(1, Math.round(saved.plannedSeconds / 60)));
        setTimeLeft(Math.max(0, saved.plannedSeconds - calculateActiveElapsedSeconds(saved.plannedSeconds, saved.accumulatedSeconds, saved.lastStartedTimestamp, saved.isRunning)));
      }
      if (saved.subjectId) setSelectedSubjectId(saved.subjectId);
      accumulatedSecondsRef.current = saved.accumulatedSeconds;
      lastStartedTimestampRef.current = saved.isRunning ? saved.lastStartedTimestamp : null;
      sessionStartedAtRef.current = saved.sessionStartedAt || null;
      setIsRunning(saved.isRunning);
      setSessionStatus(saved.status || (saved.isRunning ? 'running' : 'paused'));
    };
    window.addEventListener('tracker:active-timer-updated', syncFromMiniPanel);
    return () => window.removeEventListener('tracker:active-timer-updated', syncFromMiniPanel);
  }, [isOpen]);

  useEffect(() => {
    previousClockValueRef.current = null;
  }, [clockStyle]);

  useEffect(() => {
    if (!isOpen || !isRunning || !clockSoundOn || clockVolume === 0) {
      previousClockValueRef.current = displayTime;
      return;
    }
    if (previousClockValueRef.current === null) {
      previousClockValueRef.current = displayTime;
      return;
    }
    if (previousClockValueRef.current === displayTime) return;
    previousClockValueRef.current = displayTime;

    try {
      const AudioContextClass = window.AudioContext;
      if (!AudioContextClass) return;
      const context = clockAudioRef.current || new AudioContextClass();
      clockAudioRef.current = context;
      if (context.state === 'suspended') void context.resume().catch(() => undefined);
      const now = context.currentTime;
      const peak = (clockVolume / 100) * 0.11;
      if (clockStyle === 'flip' || clockStyle === 'analog-flip') {
        // Two short mechanical clacks follow the flap's upper and lower turn.
        [0.145, 0.32].forEach((offset, index) => {
          const start = now + offset;
          const strength = index === 0 ? 1 : 0.72;
          const frameCount = Math.floor(context.sampleRate * 0.045);
          const buffer = context.createBuffer(1, frameCount, context.sampleRate);
          const channel = buffer.getChannelData(0);
          for (let frame = 0; frame < frameCount; frame += 1) {
            channel[frame] = (Math.random() * 2 - 1) * Math.pow(1 - frame / frameCount, 2);
          }
          const noise = context.createBufferSource();
          const filter = context.createBiquadFilter();
          const noiseGain = context.createGain();
          noise.buffer = buffer;
          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(1250, start);
          filter.frequency.exponentialRampToValueAtTime(520, start + 0.04);
          noiseGain.gain.setValueAtTime(0.0001, start);
          noiseGain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak * 0.5 * strength), start + 0.003);
          noiseGain.gain.exponentialRampToValueAtTime(0.0001, start + 0.045);
          noise.connect(filter); filter.connect(noiseGain); noiseGain.connect(context.destination);
          noise.start(start); noise.stop(start + 0.05);

          const knock = context.createOscillator();
          const knockGain = context.createGain();
          knock.type = 'triangle';
          knock.frequency.setValueAtTime(145, start);
          knock.frequency.exponentialRampToValueAtTime(78, start + 0.035);
          knockGain.gain.setValueAtTime(0.0001, start);
          knockGain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak * 0.42 * strength), start + 0.003);
          knockGain.gain.exponentialRampToValueAtTime(0.0001, start + 0.04);
          knock.connect(knockGain); knockGain.connect(context.destination);
          knock.start(start); knock.stop(start + 0.045);
        });
      } else {
        const gain = context.createGain();
        const oscillator = context.createOscillator();
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(920, now);
        oscillator.frequency.exponentialRampToValueAtTime(680, now + 0.025);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), now + 0.004);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);
        oscillator.connect(gain); gain.connect(context.destination);
        oscillator.start(now); oscillator.stop(now + 0.045);
      }
    } catch {
      // Sound is an optional enhancement; timer behavior continues if audio is unavailable.
    }
  }, [displayTime, isOpen, isRunning, clockSoundOn, clockVolume, clockStyle]);

  if (!isOpen) return null;

  return createPortal((
    <div
      ref={containerRef}
      data-clock-style={clockStyle === 'orbit' ? 'analog' : clockStyle}
      data-clock-only={isClockOnly ? 'true' : undefined}
      role="dialog"
      aria-modal="true"
      aria-label="Deep Focus Fullscreen Environment"
      className="deep-focus-immersive fixed inset-0 z-50 flex flex-col justify-between text-ivory-100 select-none overflow-hidden"
    >
      {/* Background Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none z-0"
      />

      {/* Top Header Navigation */}
      <div className="deep-focus-header relative z-20 flex items-center justify-between p-6 sm:p-8 backdrop-blur-xs">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-terracotta-500 animate-pulse" />
          <span className="font-mono text-xs uppercase tracking-widest text-ivory-200/80 font-semibold">
            Deep Focus 3.0 · Immersive Space
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <div className="deep-focus-size-control flex items-center gap-1 rounded-xl border border-white/10 bg-white/10 p-1 backdrop-blur-md" role="group" aria-label="Timer block size">
            <button
              type="button"
              onClick={() => setCenterScale((scale) => Math.max(0.75, Math.round((scale - 0.1) * 100) / 100))}
              disabled={centerScale <= 0.75}
              aria-label="Zoom timer block out"
              title="Zoom out"
              className="p-1.5 rounded-lg text-ivory-100 hover:bg-white/15 disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer"
            ><Minus className="w-3.5 h-3.5" /></button>
            <span className="min-w-[3.1rem] text-center font-mono text-[10px] tabular-nums text-ivory-200" aria-live="polite">{Math.round(centerScale * 100)}%</span>
            <button
              type="button"
              onClick={() => setCenterScale((scale) => Math.min(1.3, Math.round((scale + 0.1) * 100) / 100))}
              disabled={centerScale >= 1.3}
              aria-label="Zoom timer block in"
              title="Zoom in"
              className="p-1.5 rounded-lg text-ivory-100 hover:bg-white/15 disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer"
            ><Plus className="w-3.5 h-3.5" /></button>
          </div>
          <button
            type="button"
            className="deep-focus-sidebar-trigger rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-[11px] font-semibold text-ivory-100 backdrop-blur-md"
            aria-label={isSidebarOpen ? 'Close focus settings' : 'Open focus settings'}
            aria-expanded={isSidebarOpen}
            onPointerEnter={openSidebar}
            onFocus={openSidebar}
            onClick={() => { const nextPinned = !isSidebarPinned; setIsSidebarPinned(nextPinned); setIsSidebarOpen(nextPinned); }}
          ><Settings2 className="w-3.5 h-3.5" /><span>Settings</span></button>
          {/* Browser Fullscreen API Toggle */}
          <button
            onClick={handleToggleBrowserFullscreen}
            title={isBrowserFullscreen ? 'Exit Display Fullscreen' : 'Enter Display Fullscreen'}
            aria-label="Toggle Fullscreen"
            className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-ivory-100 transition backdrop-blur-md border border-white/10 cursor-pointer"
          >
            {isBrowserFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* Close / Exit Button */}
          <button
            onClick={() => { void closeImmersive(); }}
            title="Exit Deep Focus (Esc)"
            aria-label="Exit Deep Focus"
            className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-ivory-100 transition backdrop-blur-md border border-white/10 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <button
        type="button"
        className="deep-focus-sidebar-edge"
        aria-label={isSidebarOpen ? 'Close focus settings' : 'Open focus settings'}
        aria-expanded={isSidebarOpen}
        onPointerEnter={openSidebar}
        onFocus={openSidebar}
        onClick={() => { const nextPinned = !isSidebarPinned; setIsSidebarPinned(nextPinned); setIsSidebarOpen(nextPinned); }}
      ><Settings2 aria-hidden="true" /></button>
      <aside
        className={`deep-focus-settings-sidebar ${isSidebarOpen ? 'is-open' : ''}`}
        aria-label="Focus settings"
        aria-hidden={!isSidebarOpen}
        inert={!isSidebarOpen}
        onPointerEnter={openSidebar}
        onPointerLeave={scheduleSidebarClose}
      >
        <div className="deep-focus-sidebar-heading">
          <div><span>SESSION CONTROLS</span><h2>Focus settings</h2></div>
          <button type="button" onClick={() => { setIsSidebarPinned(false); setIsSidebarOpen(false); }} aria-label="Close settings"><X size={17} /></button>
        </div>
        <section className="deep-focus-sidebar-section">
          <h3>Session mode</h3>
          <div className="deep-focus-sidebar-mode-grid" role="group" aria-label="Session mode">
            {(['pomodoro', 'timer', 'stopwatch'] as const).map((mode) => (
              <button key={mode} type="button" onClick={() => handleSwitchMode(mode)} aria-pressed={timerMode === mode}>
                {mode === 'pomodoro' ? <Flame aria-hidden="true" /> : mode === 'timer' ? <Clock aria-hidden="true" /> : <Timer aria-hidden="true" />}
                <span>{mode === 'pomodoro' ? 'Pomodoro' : mode === 'timer' ? 'Timer' : 'Stopwatch'}</span>
              </button>
            ))}
          </div>
        </section>
        <section className="deep-focus-sidebar-section">
          <h3>Clock style</h3>
          <div className="deep-focus-sidebar-style-grid" role="group" aria-label="Clock style">
            {(['analog', 'flip', 'clean', 'analog-flip'] as const).map((style) => (
              <button key={style} type="button" onClick={() => setClockDisplayStyle(style)} aria-pressed={(clockStyle === 'orbit' ? 'analog' : clockStyle) === style}>
                <span className={`deep-focus-style-preview is-${style === 'flip' ? 'flip' : style === 'analog-flip' ? 'analog-flip' : style}`} aria-hidden="true" />
                <span>{style === 'analog' ? 'Analog' : style === 'flip' ? 'Flip' : style === 'analog-flip' ? 'Analog + Flip' : 'Clean'}</span>
              </button>
            ))}
          </div>
        </section>
        <section className="deep-focus-sidebar-section">
          <h3>Display</h3>
          <label className="deep-focus-sidebar-sound-toggle">
            <span>Clock only</span>
            <input type="checkbox" checked={isClockOnly} onChange={(event) => {
              const enabled = event.target.checked;
              setIsClockOnly(enabled);
              window.localStorage.setItem('deep-focus-clock-only', String(enabled));
            }} />
          </label>
          <p className="deep-focus-sidebar-hint">Hide everything except the clock and settings tab.</p>
        </section>
        {timerMode !== 'stopwatch' && <section className="deep-focus-sidebar-section">
          <div className="deep-focus-sidebar-section-head"><h3>Session length</h3><span>{sessionMinutes} min</span></div>
          {!isRunning && <div className="deep-focus-sidebar-presets">
            {(timerMode === 'pomodoro' ? [15, 25, 45, 60] : [15, 30, 45, 60, 90, 120]).map((minutes) => (
              <button key={minutes} type="button" onClick={() => handleSelectPreset(minutes)} aria-pressed={sessionMinutes === minutes}>{minutes}m</button>
            ))}
          </div>}
          <div className="deep-focus-sidebar-adjust" role="group" aria-label="Adjust session length">
            {([-5, -1, 1, 5] as const).map((amount) => (
              <button key={amount} type="button" onClick={() => handleAdjustTimer(amount)} disabled={sessionStatus === 'completed' || sessionMinutes + amount < getMinimumTimerMinutes() || sessionMinutes + amount > 240} aria-label={`${amount < 0 ? 'Reduce by' : 'Add'} ${Math.abs(amount)} minute${Math.abs(amount) === 1 ? '' : 's'}`}>
                {amount > 0 ? '+' : '−'}{Math.abs(amount)}m
              </button>
            ))}
          </div>
        </section>}
        {!isRunning && <section className="deep-focus-sidebar-section">
          <label className="deep-focus-sidebar-label" htmlFor="deep-focus-subject">Subject or activity</label>
          <select id="deep-focus-subject" value={selectedSubjectId} onChange={(event) => setSelectedSubjectId(event.target.value)}>
            <option value="">General Self-Directed Study</option>
            {unifiedSubjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
          </select>
        </section>}
        <section className="deep-focus-sidebar-section">
          <h3>Session sound</h3>
          <label className="deep-focus-sidebar-sound-toggle"><span>Clock tick sound</span><input type="checkbox" checked={clockSoundOn} onChange={(event) => { const enabled = event.target.checked; setClockSoundOn(enabled); window.localStorage.setItem('deep-focus-clock-sound', enabled ? 'on' : 'off'); }} /></label>
          <label className="deep-focus-sidebar-label" htmlFor="deep-focus-clock-volume"><span>Volume</span><output>{clockVolume}%</output></label>
          <input id="deep-focus-clock-volume" type="range" min="0" max="100" step="5" value={clockVolume} disabled={!clockSoundOn} onChange={(event) => { const volume = Number(event.target.value); setClockVolume(volume); window.localStorage.setItem('deep-focus-clock-volume', String(volume)); }} />
        </section>
      </aside>

      {/* Central Interactive Focus Core */}
      <div className="deep-focus-center relative z-10 flex flex-col items-center justify-center my-auto px-4 max-w-xl mx-auto w-full text-center" style={{ transform: `scale(${centerScale})` }}>
        {/* Mode Switcher Tabs */}
        <div className="deep-focus-center-mode-switcher flex items-center gap-1.5 p-1 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 mb-4 select-none">
          <button
            type="button"
            onClick={() => handleSwitchMode('pomodoro')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
              timerMode === 'pomodoro'
                ? 'bg-terracotta-500 text-white shadow-md'
                : 'text-ivory-300 hover:text-white hover:bg-white/10'
            }`}
          >
            <Flame className="w-3.5 h-3.5" />
            <span>Pomodoro</span>
          </button>
          <button
            type="button"
            onClick={() => handleSwitchMode('timer')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
              timerMode === 'timer'
                ? 'bg-terracotta-500 text-white shadow-md'
                : 'text-ivory-300 hover:text-white hover:bg-white/10'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Timer</span>
          </button>
          <button
            type="button"
            onClick={() => handleSwitchMode('stopwatch')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
              timerMode === 'stopwatch'
                ? 'bg-terracotta-500 text-white shadow-md'
                : 'text-ivory-300 hover:text-white hover:bg-white/10'
            }`}
          >
            <Timer className="w-3.5 h-3.5" />
            <span>Stopwatch</span>
          </button>
        </div>

        {/* Status Badge */}
        {clockStyle !== 'analog-flip' && <div className="mb-2">
          <span
            className={`px-3 py-1 rounded-full text-xs font-mono font-bold tracking-wider uppercase backdrop-blur-md border ${
              sessionStatus === 'running'
                ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40 animate-pulse'
                : sessionStatus === 'paused'
                ? 'bg-amber-950/60 text-amber-300 border-amber-500/40'
                : sessionStatus === 'completed'
                ? 'bg-terracotta-950/60 text-terracotta-300 border-terracotta-500/40'
                : 'bg-white/10 text-ivory-300 border-white/10'
            }`}
          >
            {timerMode === 'stopwatch'
              ? isRunning
                ? 'Stopwatch Active'
                : stopwatchSeconds > 0
                ? 'Stopwatch Paused'
                : 'Stopwatch Ready'
              : sessionStatus === 'running'
              ? 'Focus Running'
              : sessionStatus === 'paused'
              ? 'Session Paused'
              : sessionStatus === 'completed'
              ? 'Session Completed'
              : 'Focus Idle'}
          </span>
        </div>}

        {/* Luminous Central Orbital Ring */}
        <div className="deep-focus-orbit relative flex items-center justify-center my-6">
          <svg className="deep-focus-progress-ring w-64 h-64 sm:w-80 sm:h-80 -rotate-90">
            {/* Background Ring Track */}
            <circle
              cx="50%"
              cy="50%"
              r="44%"
              className="stroke-white/10 fill-none"
              strokeWidth="6"
            />
            {/* Active Progress Ring */}
            <circle
              cx="50%"
              cy="50%"
              r="44%"
              className="fill-none transition-all duration-700 ease-out"
              stroke={isRunning ? 'var(--accent, #C45532)' : '#A8A096'}
              strokeWidth="6"
              strokeDasharray={2 * Math.PI * 120}
              strokeDashoffset={2 * Math.PI * 120 * (1 - progressRatio)}
              strokeLinecap="round"
            />
          </svg>

          {/* Time digits & subject */}
          <div className={`deep-focus-clock absolute inset-0 flex flex-col items-center justify-center text-center is-${clockStyle === 'orbit' ? 'analog' : clockStyle}`}>
            {clockStyle === 'clean'
              ? <span role="timer" aria-label={displayTime} className="deep-focus-clean-digits">{displayTime}</span>
              : clockStyle === 'flip'
                ? <FlipClockDisplay time={displayTime} />
                : <AnalogClock time={displayTime} progress={progressRatio} flipClock={clockStyle === 'analog-flip'} />}

            {/* Subject Linkage */}
            {selectedSubjectId ? (
              <span className="deep-focus-clock-subtitle text-xs sm:text-sm font-medium text-ivory-300 mt-2 flex items-center gap-1.5 max-w-[200px] truncate">
                <BookOpen className="w-3.5 h-3.5 text-terracotta-400 shrink-0" />
                <span className="truncate">
                  {unifiedSubjects.find((s) => s.id === selectedSubjectId)?.name || 'Subject Linked'}
                </span>
              </span>
            ) : (
              <span className="deep-focus-clock-subtitle text-xs font-mono text-ivory-400/80 mt-2">
                {timerMode === 'stopwatch' ? 'Elapsed Active Study' : 'General Deep Focus'}
              </span>
            )}
          </div>
        </div>

        {/* Duration Presets for Countdown Modes */}
        {timerMode !== 'stopwatch' && !isRunning && timeLeft === sessionMinutes * 60 && (
          <div className="deep-focus-center-presets flex flex-wrap items-center justify-center gap-2 mb-6">
            {(timerMode === 'pomodoro' ? [15, 25, 45, 60] : [15, 30, 45, 60, 90, 120]).map((mins) => (
              <button
                key={mins}
                onClick={() => handleSelectPreset(mins)}
                className={`px-3.5 py-1.5 text-xs font-mono font-semibold rounded-xl border transition backdrop-blur-md cursor-pointer ${
                  sessionMinutes === mins
                    ? 'bg-terracotta-500 text-white border-terracotta-400 shadow-md'
                    : 'bg-white/10 hover:bg-white/20 text-ivory-300 border-white/10'
                }`}
              >
                {mins}m
              </button>
            ))}
          </div>
        )}

        {timerMode !== 'stopwatch' && (
          <div className="deep-focus-time-adjust mb-5 flex items-center justify-center gap-2" role="group" aria-label="Adjust focus session time">
            <span className="mr-1 font-mono text-[10px] uppercase tracking-widest text-ivory-400">Adjust time</span>
            <button
              type="button"
              onClick={() => handleAdjustTimer(-1)}
              disabled={sessionStatus === 'completed' || sessionMinutes - 1 < getMinimumTimerMinutes()}
              aria-label="Reduce focus time by one minute"
              className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-[11px] font-mono font-semibold text-ivory-200 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-35 cursor-pointer"
            >−1m</button>
            <button
              type="button"
              onClick={() => handleAdjustTimer(-5)}
              disabled={sessionStatus === 'completed' || sessionMinutes - 5 < getMinimumTimerMinutes()}
              aria-label="Reduce focus time by five minutes"
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-mono font-semibold text-ivory-200 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-35 cursor-pointer"
            >−5m</button>
            <button
              type="button"
              onClick={() => handleAdjustTimer(1)}
              disabled={sessionStatus === 'completed' || sessionMinutes + 1 > 240}
              aria-label="Extend focus time by one minute"
              className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-[11px] font-mono font-semibold text-ivory-200 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-35 cursor-pointer"
            >+1m</button>
            <button
              type="button"
              onClick={() => handleAdjustTimer(5)}
              disabled={sessionStatus === 'completed' || sessionMinutes + 5 > 240}
              aria-label="Extend focus time by five minutes"
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-mono font-semibold text-ivory-200 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-35 cursor-pointer"
            >+5m</button>
          </div>
        )}

        {/* Subject selector (if not running) */}
        {!isRunning && (
          <div className="deep-focus-center-subject mb-6 w-full max-w-xs">
            <select
              value={selectedSubjectId}
              onChange={(e) => setSelectedSubjectId(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl bg-white/10 border border-white/15 text-ivory-100 focus:outline-none focus:ring-2 focus:ring-terracotta-500 backdrop-blur-md"
            >
              <option value="" className="bg-[#181514] text-white">General Self-Directed Study</option>
              {unifiedSubjects.map((s) => (
                <option key={s.id} value={s.id} className="bg-[#181514] text-white">
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Action Controls */}
        <div className="flex items-center justify-center gap-3">
          {timerMode === 'stopwatch' ? (
            <>
              <button
                onClick={handleToggleTimer}
                className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-terracotta-500 hover:bg-terracotta-600 text-white font-semibold text-sm shadow-xl transition active:scale-95 cursor-pointer"
              >
                {isRunning ? (
                  <>
                    <Pause className="w-4 h-4" />
                    <span>Pause</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current" />
                    <span>{stopwatchSeconds === 0 ? 'Start Stopwatch' : 'Resume'}</span>
                  </>
                )}
              </button>

              <button
                onClick={handleLap}
                disabled={stopwatchSeconds === 0}
                title="Record split lap"
                className="flex items-center gap-1.5 px-4 py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-ivory-100 font-semibold text-xs border border-white/15 transition backdrop-blur-md disabled:opacity-30 cursor-pointer"
              >
                <Flag className="w-4 h-4 text-ochre-400" />
                <span>Lap</span>
              </button>

              <button
                onClick={handleLogStopwatchSession}
                disabled={stopwatchSeconds === 0}
                title="Log elapsed stopwatch focus time"
                className="flex items-center gap-1.5 px-4 py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-ivory-100 font-semibold text-xs border border-white/15 transition backdrop-blur-md disabled:opacity-30 cursor-pointer"
              >
                <Check className="w-4 h-4 text-emerald-400" />
                <span>Log Session</span>
              </button>

              <button
                onClick={handleReset}
                title="Reset stopwatch"
                className="p-3 rounded-2xl bg-white/10 hover:bg-white/20 text-ivory-300 hover:text-white border border-white/15 transition backdrop-blur-md cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleToggleTimer}
                className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-terracotta-500 hover:bg-terracotta-600 text-white font-semibold text-sm shadow-xl transition active:scale-95 cursor-pointer"
              >
                {isRunning ? (
                  <>
                    <Pause className="w-4 h-4" />
                    <span>Pause</span>
                  </>
                ) : timeLeft === sessionMinutes * 60 ? (
                  <>
                    <Play className="w-4 h-4 fill-current" />
                    <span>Start Focus</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current" />
                    <span>Resume</span>
                  </>
                )}
              </button>

              {!plannerFocusLaunch?.taskId && (isRunning || timeLeft < sessionMinutes * 60) && (
                <button
                  onClick={handleStopAndLogEarly}
                  title="Stop session early and log actual active focus time"
                  className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-ivory-100 font-semibold text-xs border border-white/15 transition backdrop-blur-md cursor-pointer"
                >
                  <StopCircle className="w-4 h-4 text-amber-400" />
                  <span>Stop &amp; Log</span>
                </button>
              )}

              <button
                onClick={handleReset}
                title="Reset timer"
                className="p-3 rounded-2xl bg-white/10 hover:bg-white/20 text-ivory-300 hover:text-white border border-white/15 transition backdrop-blur-md cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </>
          )}
        </div>

        {/* Stopwatch Laps Split in Fullscreen */}
        {timerMode === 'stopwatch' && laps.length > 0 && (
          <div className="w-full mt-5 max-h-36 overflow-y-auto rounded-2xl bg-black/40 border border-white/10 p-3 text-xs text-left backdrop-blur-md">
            <div className="flex items-center justify-between pb-1.5 border-b border-white/10 font-mono text-[10px] uppercase text-ivory-400 font-semibold px-2">
              <span>Lap</span>
              <span>Split</span>
              <span>Total Elapsed</span>
            </div>
            <div className="divide-y divide-white/5">
              {laps.map((lap) => (
                <div
                  key={lap.id}
                  className="flex items-center justify-between py-1.5 px-2 font-mono tabular-nums text-ivory-200"
                >
                  <span className="font-semibold text-terracotta-400">Lap {lap.lapNumber}</span>
                  <span className="text-ivory-400">+{formatFocusTime(lap.lapTimeSeconds)}</span>
                  <span className="font-bold">{formatFocusTime(lap.totalTimeSeconds, true)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Logged Toast Notification */}
        {loggedNotification && (
          <div className="mt-4 px-4 py-2 rounded-xl bg-emerald-950/80 border border-emerald-500/50 text-emerald-200 text-xs font-semibold flex items-center gap-2 animate-fade-in backdrop-blur-md">
            <Check className="w-4 h-4 text-emerald-400" />
            <span>{loggedNotification}</span>
          </div>
        )}
      </div>

      {/* Bottom Footer: Integrated Focus Radio & Simulated Wave Visualizer */}
      <div className="deep-focus-footer relative z-10 p-4 sm:p-6 backdrop-blur-xs flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-white/5">
        {/* Track info & simulated visualizer */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center border border-white/10 shrink-0">
            <Music className="w-4 h-4 text-[var(--accent)]" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-ivory-100 truncate">
              {radio.currentTrack?.title || 'Focus Radio · Ambient Lo-Fi Beats'}
            </p>
            <p className="text-[11px] font-mono text-ivory-400/80">
              {radio.isPlaying ? 'Focus Audio Active' : 'Radio Ready'}
            </p>
          </div>
        </div>

        {/* Decorative Simulated Audio Wave Visualizer */}
        <div className="w-36 h-6 flex items-center justify-center">
          <Visualizer isPlaying={radio.isPlaying} variant="bars" color="var(--accent)" />
        </div>

        {/* Quick Radio controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={radio.togglePlay}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-ivory-200 hover:text-white transition cursor-pointer"
            title={radio.isPlaying ? 'Pause Radio' : 'Play Radio'}
          >
            {radio.isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
          </button>
          <button
            onClick={radio.toggleMute}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-ivory-200 transition cursor-pointer"
            title={radio.isMuted ? 'Unmute' : 'Mute'}
          >
            {radio.isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <button
            onClick={radio.next}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-ivory-200 transition cursor-pointer"
            title="Next Track"
          >
            <SkipForward className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  ), document.body);
};
