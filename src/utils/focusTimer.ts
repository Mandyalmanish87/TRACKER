import { ActiveTimerState } from '../types';

export const ACTIVE_TIMER_STORAGE_KEY = 'tracker_active_focus_timer';

export function saveActiveTimer(state: ActiveTimerState): void {
  try {
    localStorage.setItem(ACTIVE_TIMER_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // LocalStorage quota or access error handled gracefully
  }
}

export function loadActiveTimer(): ActiveTimerState | null {
  try {
    const raw = localStorage.getItem(ACTIVE_TIMER_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.plannedSeconds === 'number') {
      return parsed as ActiveTimerState;
    }
  } catch {
    // Ignore corrupt state
  }
  return null;
}

export function clearActiveTimer(): void {
  try {
    localStorage.removeItem(ACTIVE_TIMER_STORAGE_KEY);
  } catch {
    // Graceful
  }
}

/**
 * Calculates total active elapsed focus seconds accumulated across running intervals,
 * strictly excluding paused periods.
 */
export function calculateActiveElapsedSeconds(
  plannedSeconds: number,
  accumulatedSeconds: number,
  lastStartedTimestamp: number | null,
  isRunning: boolean
): number {
  let elapsed = accumulatedSeconds || 0;
  if (isRunning && lastStartedTimestamp) {
    const deltaMs = Math.max(0, Date.now() - lastStartedTimestamp);
    elapsed += Math.floor(deltaMs / 1000);
  }
  return plannedSeconds > 0 ? Math.min(plannedSeconds, Math.max(0, elapsed)) : Math.max(0, elapsed);
}

/**
 * Formats seconds into HH:MM:SS or MM:SS string with tabular formatting
 */
export function formatFocusTime(totalSeconds: number, forceHours = false): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;

  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');

  if (hours > 0 || forceHours) {
    const hh = String(hours).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  }
  return `${mm}:${ss}`;
}

/**
 * Converts elapsed seconds into logged duration minutes.
 * When a session runs for 51 seconds, this returns 0.85 minutes (never 24.15m or 24m).
 * If exactly matches planned minutes, returns integer planned minutes.
 */
export function secondsToLoggedMinutes(seconds: number, plannedSeconds?: number): number {
  if (seconds <= 0) return 0;
  if (plannedSeconds && seconds >= plannedSeconds) {
    return Math.round(plannedSeconds / 60);
  }
  // Fractional minutes with 2 decimal precision (e.g. 51s -> 0.85m)
  const mins = Number((seconds / 60).toFixed(2));
  return mins;
}

/**
 * Calculates current seconds remaining and total elapsed focus seconds
 * accurately using Date.now() timestamps. Paused intervals are never counted.
 */
export function calculateTimerProgress(timer: ActiveTimerState): {
  timeLeftSeconds: number;
  elapsedFocusSeconds: number;
  isComplete: boolean;
} {
  const elapsed = calculateActiveElapsedSeconds(
    timer.plannedSeconds,
    timer.accumulatedSeconds,
    timer.lastStartedTimestamp,
    timer.isRunning
  );

  if (timer.mode === 'stopwatch') {
    return {
      timeLeftSeconds: elapsed,
      elapsedFocusSeconds: elapsed,
      isComplete: false,
    };
  }

  const timeLeftSeconds = Math.max(0, timer.plannedSeconds - elapsed);
  const isComplete = timeLeftSeconds === 0 && timer.plannedSeconds > 0;

  return {
    timeLeftSeconds,
    elapsedFocusSeconds: elapsed,
    isComplete,
  };
}

/** Adjust the stored timer from the app-wide mini focus panel. */
export function toggleActiveTimerFromMini(): ActiveTimerState | null {
  const saved = loadActiveTimer();
  if (!saved) return null;
  const progress = calculateTimerProgress(saved);
  if (saved.mode !== 'stopwatch' && progress.isComplete) return null;
  const isRunning = !saved.isRunning;
  const updated: ActiveTimerState = {
    ...saved,
    accumulatedSeconds: progress.elapsedFocusSeconds,
    lastStartedTimestamp: isRunning ? Date.now() : null,
    isRunning,
    status: isRunning ? 'running' : 'paused',
  };
  saveActiveTimer(updated);
  window.dispatchEvent(new CustomEvent('tracker:active-timer-updated'));
  return updated;
}

export function adjustActiveTimerFromMini(minutesDelta: number): ActiveTimerState | null {
  const saved = loadActiveTimer();
  if (!saved || saved.mode === 'stopwatch') return null;
  const progress = calculateTimerProgress(saved);
  if (progress.isComplete) return null;
  const currentMinutes = Math.round(saved.plannedSeconds / 60);
  const minimumMinutes = Math.max(1, Math.ceil(progress.elapsedFocusSeconds / 60));
  const nextMinutes = currentMinutes + minutesDelta;
  if (nextMinutes < minimumMinutes || nextMinutes > 240) return null;
  const updated: ActiveTimerState = {
    ...saved,
    plannedSeconds: nextMinutes * 60,
    accumulatedSeconds: progress.elapsedFocusSeconds,
    lastStartedTimestamp: saved.isRunning ? Date.now() : null,
  };
  saveActiveTimer(updated);
  window.dispatchEvent(new CustomEvent('tracker:active-timer-updated'));
  return updated;
}
