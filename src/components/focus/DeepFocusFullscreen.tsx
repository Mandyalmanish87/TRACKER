import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
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
import { useFocusRadio, Visualizer } from '../focus-radio';

interface DeepFocusFullscreenProps {
  isOpen: boolean;
  onClose: () => void;
  initialMinutes?: number;
  initialMode?: 'pomodoro' | 'timer' | 'stopwatch';
}

export const DeepFocusFullscreen: React.FC<DeepFocusFullscreenProps> = ({
  isOpen,
  onClose,
  initialMinutes = 25,
  initialMode = 'pomodoro',
}) => {
  const {
    state,
    logStudySession,
  } = useApp();

  // Mode: Pomodoro, Timer, or Stopwatch
  const [timerMode, setTimerMode] = useState<'pomodoro' | 'timer' | 'stopwatch'>(initialMode);

  // Fullscreen browser state
  const [isBrowserFullscreen, setIsBrowserFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

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
  }, [isOpen, initialMode]);

  // Fullscreen request & exit helpers
  const enterFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement && containerRef.current) {
        if (containerRef.current.requestFullscreen) {
          await containerRef.current.requestFullscreen();
          setIsBrowserFullscreen(true);
        }
      }
    } catch {
      // Graceful fallback: modal covers full screen via fixed inset-0
      setIsBrowserFullscreen(false);
    }
  }, []);

  const exitFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement && document.exitFullscreen) {
        await document.exitFullscreen();
      }
    } catch {
      // Graceful fallback
    }
    setIsBrowserFullscreen(false);
  }, []);

  const handleToggleBrowserFullscreen = () => {
    if (document.fullscreenElement) {
      exitFullscreen();
    } else {
      enterFullscreen();
    }
  };

  // Keyboard shortcut listener (Escape to exit)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (document.fullscreenElement) {
          exitFullscreen();
        }
        onClose();
      } else if (e.code === 'Space' && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement)) {
        e.preventDefault();
        handleToggleTimer();
      }
    };

    const handleFullscreenChange = () => {
      setIsBrowserFullscreen(Boolean(document.fullscreenElement));
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [isOpen, isRunning]);

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

          // Log exact completed duration
          handleLogSession(sessionMinutes, 'completed', plannedSec);
        }
      }
    }, 500);

    return () => clearInterval(interval);
  }, [isOpen, isRunning, timerMode, sessionMinutes, selectedSubjectId, laps]);

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

  const handleReset = () => {
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
      nebulaGradient.addColorStop(0, 'rgba(196, 85, 50, 0.08)');
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

  if (!isOpen) return null;

  const progressRatio =
    timerMode === 'stopwatch'
      ? (stopwatchSeconds % 60) / 60
      : Math.max(0, Math.min(1, 1 - timeLeft / (sessionMinutes * 60)));

  const displayTime =
    timerMode === 'stopwatch'
      ? formatFocusTime(stopwatchSeconds, true)
      : formatFocusTime(timeLeft, sessionMinutes >= 60);

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-label="Deep Focus Fullscreen Environment"
      className="fixed inset-0 z-50 flex flex-col justify-between bg-[#08060D] text-ivory-100 select-none overflow-hidden"
    >
      {/* Background Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none z-0"
      />

      {/* Top Header Navigation */}
      <div className="relative z-10 flex items-center justify-between p-6 sm:p-8 backdrop-blur-xs">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-terracotta-500 animate-pulse" />
          <span className="font-mono text-xs uppercase tracking-widest text-ivory-200/80 font-semibold">
            Deep Focus 2.0 · Immersive Space
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
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
            onClick={() => {
              if (document.fullscreenElement) exitFullscreen();
              onClose();
            }}
            title="Exit Deep Focus (Esc)"
            aria-label="Exit Deep Focus"
            className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-ivory-100 transition backdrop-blur-md border border-white/10 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Central Interactive Focus Core */}
      <div className="relative z-10 flex flex-col items-center justify-center my-auto px-4 max-w-xl mx-auto w-full text-center">
        {/* Mode Switcher Tabs */}
        <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 mb-4 select-none">
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
        <div className="mb-2">
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
        </div>

        {/* Luminous Central Orbital Ring */}
        <div className="relative flex items-center justify-center my-6">
          <svg className="w-64 h-64 sm:w-80 sm:h-80 -rotate-90">
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
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="font-mono tabular-nums text-5xl sm:text-6xl md:text-7xl font-bold tracking-tight text-white drop-shadow-[0_4px_24px_rgba(0,0,0,0.8)]">
              {displayTime}
            </span>

            {/* Subject Linkage */}
            {selectedSubjectId ? (
              <span className="text-xs sm:text-sm font-medium text-ivory-300 mt-2 flex items-center gap-1.5 max-w-[200px] truncate">
                <BookOpen className="w-3.5 h-3.5 text-terracotta-400 shrink-0" />
                <span className="truncate">
                  {unifiedSubjects.find((s) => s.id === selectedSubjectId)?.name || 'Subject Linked'}
                </span>
              </span>
            ) : (
              <span className="text-xs font-mono text-ivory-400/80 mt-2">
                {timerMode === 'stopwatch' ? 'Elapsed Active Study' : 'General Deep Focus'}
              </span>
            )}
          </div>
        </div>

        {/* Duration Presets for Countdown Modes */}
        {timerMode !== 'stopwatch' && !isRunning && timeLeft === sessionMinutes * 60 && (
          <div className="flex flex-wrap items-center justify-center gap-2 mb-6">
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

        {/* Subject selector (if not running) */}
        {!isRunning && (
          <div className="mb-6 w-full max-w-xs">
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

              {(isRunning || timeLeft < sessionMinutes * 60) && (
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
      <div className="relative z-10 p-4 sm:p-6 backdrop-blur-xs flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-white/5 bg-[#0B0D0C]/80">
        {/* Track info & simulated visualizer */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center border border-white/10 shrink-0">
            <Music className="w-4 h-4 text-[#C8FF45]" />
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
          <Visualizer isPlaying={radio.isPlaying} variant="bars" color="#C8FF45" />
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
  );
};
