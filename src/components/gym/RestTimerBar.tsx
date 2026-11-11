import React, { useEffect, useState, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { Play, Pause, SkipForward, Plus, Minus, Timer } from 'lucide-react';

export const RestTimerBar: React.FC = () => {
  const { restTimer, adjustRestTimer, clearRestTimer } = useApp();
  const [secondsRemaining, setSecondsRemaining] = useState<number>(0);
  const [isPaused, setIsPaused] = useState(false);
  const pausedTimeLeftRef = useRef<number>(0);
  const chimePlayedRef = useRef(false);

  // Synthesize soft pleasant completion chime via Web Audio API
  const playChime = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();

      // Play 2-tone melodic chime: C5 (523Hz) -> G5 (784Hz)
      const now = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(523.25, now);
      osc1.frequency.exponentialRampToValueAtTime(783.99, now + 0.2);

      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(783.99, now + 0.2);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc1.stop(now + 0.8);
      osc2.start(now + 0.2);
      osc2.stop(now + 0.8);
    } catch {
      // AudioContext unavailable or autoplay blocked
    }
  };

  useEffect(() => {
    if (!restTimer) {
      setSecondsRemaining(0);
      setIsPaused(false);
      chimePlayedRef.current = false;
      return;
    }

    chimePlayedRef.current = false;

    const interval = setInterval(() => {
      if (isPaused) return;

      const remaining = Math.max(0, Math.ceil((restTimer.targetEndTimeMs - Date.now()) / 1000));
      setSecondsRemaining(remaining);

      if (remaining === 0) {
        if (!chimePlayedRef.current) {
          chimePlayedRef.current = true;
          playChime();
        }
        clearInterval(interval);
      }
    }, 250);

    return () => clearInterval(interval);
  }, [restTimer, isPaused]);

  if (!restTimer || secondsRemaining <= 0) return null;

  const totalSec = Math.max(1, restTimer.totalSeconds || 90);
  const progressPercent = Math.min(100, Math.max(0, ((totalSec - secondsRemaining) / totalSec) * 100));

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleTogglePause = () => {
    if (isPaused) {
      // Resume
      adjustRestTimer(pausedTimeLeftRef.current);
      setIsPaused(false);
    } else {
      // Pause
      pausedTimeLeftRef.current = secondsRemaining;
      setIsPaused(true);
    }
  };

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-lg animate-in fade-in slide-in-from-bottom-3 duration-200">
      <div className="relative overflow-hidden rounded-2xl bg-espresso-900/95 dark:bg-espresso-950/95 backdrop-blur-md text-ivory-50 border border-ivory-200/20 shadow-2xl p-3.5 sm:p-4">
        {/* Progress bar background fill */}
        <div
          className="absolute inset-0 bg-terracotta-600/15 pointer-events-none transition-all duration-300"
          style={{ width: `${progressPercent}%` }}
        />

        <div className="relative flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-terracotta-500/20 flex items-center justify-center text-terracotta-400 shrink-0">
              <Timer className="w-4 h-4 animate-pulse" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono text-lg font-bold tabular-nums tracking-tight text-white">
                  {formatTime(secondsRemaining)}
                </span>
                <span className="text-[11px] uppercase tracking-wider font-semibold text-terracotta-400">
                  Rest
                </span>
              </div>
              <p className="text-[11px] text-ivory-200/70 truncate">
                {restTimer.exerciseName ? `Next set: ${restTimer.exerciseName}` : 'Recovery in progress'}
              </p>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => adjustRestTimer(-15)}
              title="Minus 15s"
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-ivory-200 transition-colors text-xs flex items-center"
            >
              <Minus className="w-3.5 h-3.5" />
              <span className="text-[10px] font-mono ml-0.5">15</span>
            </button>
            <button
              onClick={() => adjustRestTimer(30)}
              title="Add 30s"
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-ivory-200 transition-colors text-xs flex items-center"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="text-[10px] font-mono ml-0.5">30</span>
            </button>
            <button
              onClick={handleTogglePause}
              title={isPaused ? 'Resume' : 'Pause'}
              className="p-2 rounded-xl bg-white/15 hover:bg-white/25 text-white transition-colors"
            >
              {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
            </button>
            <button
              onClick={clearRestTimer}
              title="Skip Rest"
              className="p-2 rounded-xl bg-terracotta-600 hover:bg-terracotta-500 text-white transition-colors font-medium text-xs flex items-center gap-1"
            >
              <SkipForward className="w-4 h-4" />
              <span className="hidden sm:inline">Skip</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
