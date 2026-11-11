import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { Dumbbell, Clock, Maximize2 } from 'lucide-react';

export const ActiveWorkoutPill: React.FC = () => {
  const { activeWorkout, isWorkoutModalMinimized, setWorkoutModalMinimized, restTimer } = useApp();
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);

  useEffect(() => {
    if (!activeWorkout || !activeWorkout.startTime) {
      setElapsedSeconds(0);
      return;
    }

    const startMs = new Date(activeWorkout.startTime).getTime();
    const interval = setInterval(() => {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startMs) / 1000)));
    }, 1000);

    return () => clearInterval(interval);
  }, [activeWorkout?.startTime]);

  if (!activeWorkout || !isWorkoutModalMinimized) {
    return null;
  }

  const formatStopwatch = (totalSec: number) => {
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (h > 0) {
      return `${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
    }
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const totalCompletedSets = activeWorkout.exercises.reduce(
    (acc, ex) => acc + (ex.sets || []).filter((s) => s.completed).length,
    0
  );
  const totalSets = activeWorkout.exercises.reduce(
    (acc, ex) => acc + (ex.sets || []).length,
    0
  );

  // Position higher if rest timer is also actively showing
  const bottomPosition = restTimer ? 'bottom-24 sm:bottom-28' : 'bottom-4 sm:bottom-6';

  return (
    <div
      className={`fixed ${bottomPosition} left-1/2 -translate-x-1/2 z-40 w-[92%] max-w-md animate-in fade-in slide-in-from-bottom-2 duration-200`}
    >
      <button
        type="button"
        onClick={() => setWorkoutModalMinimized(false)}
        className="w-full p-3 sm:p-3.5 rounded-2xl bg-espresso-950/95 dark:bg-espresso-900/95 backdrop-blur-md text-ivory-50 border border-terracotta-500/40 shadow-xl flex items-center justify-between gap-3 text-left transition hover:scale-[1.01] active:scale-[0.99] cursor-pointer group"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-terracotta-600 text-white flex items-center justify-center shrink-0">
            <Dumbbell className="w-4 h-4 animate-pulse" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-bold text-xs sm:text-sm text-white truncate">
                {activeWorkout.splitName}
              </span>
              <span className="px-1.5 py-0.2 rounded text-[9px] font-mono uppercase bg-terracotta-500/30 text-terracotta-300 font-bold">
                Active
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px] font-mono text-ivory-300/80 mt-0.5">
              <span className="flex items-center gap-1 text-ochre-400">
                <Clock className="w-3 h-3" />
                {formatStopwatch(elapsedSeconds)}
              </span>
              <span>•</span>
              <span>{totalCompletedSets}/{totalSets} sets</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/10 group-hover:bg-white/20 text-xs font-semibold shrink-0 transition">
          <Maximize2 className="w-3.5 h-3.5 text-terracotta-400" />
          <span className="text-[11px]">Expand</span>
        </div>
      </button>
    </div>
  );
};

