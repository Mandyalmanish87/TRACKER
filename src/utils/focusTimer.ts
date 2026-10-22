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

// ── Picture-in-Picture Controller ────────────────────────────

export interface PipController {
  isActive: boolean;
  close: () => void;
  update: (timeStr: string, subjectName: string, isRunning: boolean) => void;
}

export function isPipSupported(): boolean {
  if (typeof window === 'undefined') return false;
  // Check Document PiP or Video PiP with canvas stream support
  const hasDocPip = 'documentPictureInPicture' in window;
  const hasVideoPip =
    typeof document !== 'undefined' &&
    'pictureInPictureEnabled' in document &&
    Boolean(document.pictureInPictureEnabled);
  const hasCanvasStream =
    typeof HTMLCanvasElement !== 'undefined' &&
    typeof HTMLCanvasElement.prototype.captureStream === 'function';

  return hasDocPip || (hasVideoPip && hasCanvasStream);
}

/**
 * Request floating Picture-in-Picture window for the timer.
 */
export async function requestTimerPip(
  initialTimeStr: string,
  subjectName: string,
  isRunning: boolean,
  onClose?: () => void
): Promise<PipController | null> {
  if (!isPipSupported()) return null;

  try {
    // Check if HTML5 Canvas-in-Video PiP is viable
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 240;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const renderFrame = (time: string, subject: string, running: boolean) => {
      // Dark slate background
      ctx.fillStyle = '#100E0D';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Accent border
      ctx.strokeStyle = '#DE6C47';
      ctx.lineWidth = 4;
      ctx.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);

      // App Label
      ctx.fillStyle = '#C45532';
      ctx.font = 'bold 13px monospace';
      ctx.fillText('TRACKER · DEEP FOCUS', 20, 36);

      // Status pill
      ctx.fillStyle = running ? '#436650' : '#705746';
      ctx.beginPath();
      ctx.arc(canvas.width - 30, 30, 6, 0, Math.PI * 2);
      ctx.fill();

      // Main Timer Display
      ctx.fillStyle = '#F7F4EF';
      ctx.font = 'bold 64px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(time, canvas.width / 2, 126);

      // Subject / Task name
      ctx.fillStyle = '#A8A096';
      ctx.font = '16px serif';
      const cleanSub = subject.length > 32 ? subject.slice(0, 30) + '...' : subject;
      ctx.fillText(cleanSub, canvas.width / 2, 172);

      // Status subtitle
      ctx.fillStyle = running ? '#689778' : '#D9944D';
      ctx.font = '12px sans-serif';
      ctx.fillText(running ? '• Session in progress' : '⏸ Paused', canvas.width / 2, 206);
      ctx.textAlign = 'start';
    };

    renderFrame(initialTimeStr, subjectName, isRunning);

    const stream = canvas.captureStream(30);
    const video = document.createElement('video');
    video.muted = true;
    video.srcObject = stream;
    await video.play();

    void video.requestPictureInPicture();

    let active = true;

    const handleLeave = () => {
      active = false;
      video.srcObject = null;
      if (onClose) onClose();
    };

    video.addEventListener('leavepictureinpicture', handleLeave, { once: true });

    return {
      get isActive() {
        return active;
      },
      close: () => {
        if (document.pictureInPictureElement === video) {
          document.exitPictureInPicture().catch(() => {});
        }
        active = false;
        video.srcObject = null;
      },
      update: (timeStr: string, sub: string, running: boolean) => {
        if (!active) return;
        renderFrame(timeStr, sub, running);
      },
    };
  } catch (err) {
    console.warn('PiP initiation failed or was dismissed:', err);
    return null;
  }
}
