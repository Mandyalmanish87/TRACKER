import React, { useEffect, useRef, useState } from 'react';
import { BookOpen, Flame, Grip, Maximize2, Pause, Play, X } from 'lucide-react';
import { ActiveTimerState } from '../../types';
import {
  adjustActiveTimerFromMini,
  calculateTimerProgress,
  formatFocusTime,
  loadActiveTimer,
  toggleActiveTimerFromMini,
} from '../../utils/focusTimer';

export const MiniDeepFocusPanel: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [clockStyle, setClockStyle] = useState<'orbit' | 'flip' | 'clean'>(() => {
    try {
      const saved = window.localStorage.getItem('deep-focus-clock-style');
      return saved === 'flip' || saved === 'clean' ? saved : 'orbit';
    } catch { return 'orbit'; }
  });
  const [panelPosition, setPanelPosition] = useState<{ left: number; top: number } | null>(null);
  const panelRef = useRef<HTMLElement>(null);
  const dragOffsetRef = useRef<{ x: number; y: number } | null>(null);
  const [, setRefreshKey] = useState(0);
  const refresh = () => setRefreshKey((value) => value + 1);

  useEffect(() => {
    const handleOpen = () => { setIsOpen(true); refresh(); };
    const handleClose = () => setIsOpen(false);
    const handleTimerUpdate = () => refresh();
    const handleClockStyleUpdate = () => {
      const saved = window.localStorage.getItem('deep-focus-clock-style');
      setClockStyle(saved === 'flip' || saved === 'clean' ? saved : 'orbit');
    };
    window.addEventListener('tracker:mini-focus-open', handleOpen);
    window.addEventListener('tracker:mini-focus-close', handleClose);
    window.addEventListener('tracker:active-timer-updated', handleTimerUpdate);
    window.addEventListener('tracker:focus-clock-style-updated', handleClockStyleUpdate);
    const interval = window.setInterval(() => {
      if (isOpen) refresh();
    }, 500);
    return () => {
      window.removeEventListener('tracker:mini-focus-open', handleOpen);
      window.removeEventListener('tracker:mini-focus-close', handleClose);
      window.removeEventListener('tracker:active-timer-updated', handleTimerUpdate);
      window.removeEventListener('tracker:focus-clock-style-updated', handleClockStyleUpdate);
      window.clearInterval(interval);
    };
  }, [isOpen]);

  if (!isOpen) return null;
  const timer: ActiveTimerState | null = loadActiveTimer();
  if (!timer) return null;

  const progress = calculateTimerProgress(timer);
  const isStopwatch = timer.mode === 'stopwatch';
  const time = isStopwatch
    ? formatFocusTime(progress.elapsedFocusSeconds, true)
    : formatFocusTime(progress.timeLeftSeconds, timer.plannedSeconds >= 3600);
  const progressRatio = isStopwatch
    ? (progress.elapsedFocusSeconds % 3600) / 3600
    : Math.max(0, Math.min(1, (timer.plannedSeconds - progress.timeLeftSeconds) / Math.max(timer.plannedSeconds, 1)));
  const modeLabel = timer.mode === 'stopwatch'
    ? 'Stopwatch'
    : timer.mode === 'short_break' || timer.mode === 'long_break'
      ? 'Break'
      : timer.mode === 'timer' ? 'Countdown' : 'Pomodoro';
  const isComplete = !isStopwatch && progress.isComplete;
  const minimumMinutes = Math.max(1, Math.ceil(progress.elapsedFocusSeconds / 60));
  const currentMinutes = Math.round(timer.plannedSeconds / 60);
  const flipGroups = time.split(':').length === 2 ? ['00', ...time.split(':')] : time.split(':');

  const toggleFlipClock = () => {
    const nextStyle = clockStyle === 'flip' ? 'orbit' : 'flip';
    setClockStyle(nextStyle);
    try { window.localStorage.setItem('deep-focus-clock-style', nextStyle); } catch {}
    window.dispatchEvent(new CustomEvent('tracker:focus-clock-style-updated'));
  };

  const openFullFocus = () => {
    try { window.sessionStorage.setItem('tracker_open_focus_fullscreen_after_nav', '1'); } catch {}
    window.dispatchEvent(new CustomEvent('tracker:open-focus-from-mini'));
    setIsOpen(false);
  };

  const movePanelTo = (left: number, top: number) => {
    const panel = panelRef.current;
    if (!panel) return;
    const bounds = panel.getBoundingClientRect();
    const gutter = 8;
    setPanelPosition({
      left: Math.max(gutter, Math.min(window.innerWidth - bounds.width - gutter, left)),
      top: Math.max(gutter, Math.min(window.innerHeight - bounds.height - gutter, top)),
    });
  };

  const handleDragStart = (event: React.PointerEvent<HTMLElement>) => {
    if ((event.target as HTMLElement).closest('button')) return;
    const panel = panelRef.current?.getBoundingClientRect();
    if (!panel) return;
    setPanelPosition({ left: panel.left, top: panel.top });
    dragOffsetRef.current = { x: event.clientX - panel.left, y: event.clientY - panel.top };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleDragMove = (event: React.PointerEvent<HTMLElement>) => {
    if (!dragOffsetRef.current) return;
    movePanelTo(event.clientX - dragOffsetRef.current.x, event.clientY - dragOffsetRef.current.y);
  };

  const handleDragEnd = (event: React.PointerEvent<HTMLElement>) => {
    dragOffsetRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const handleMoveKey = (event: React.KeyboardEvent<HTMLElement>) => {
    if ((event.target as HTMLElement).closest('button')) return;
    const step = event.shiftKey ? 32 : 12;
    const bounds = panelRef.current?.getBoundingClientRect();
    if (!bounds) return;
    const offsets: Record<string, [number, number]> = {
      ArrowUp: [0, -step], ArrowDown: [0, step], ArrowLeft: [-step, 0], ArrowRight: [step, 0],
    };
    const offset = offsets[event.key];
    if (!offset) return;
    event.preventDefault();
    movePanelTo(bounds.left + offset[0], bounds.top + offset[1]);
  };

  return (
    <aside ref={panelRef} className="mini-deep-focus fixed z-[60]" style={panelPosition ? { left: panelPosition.left, top: panelPosition.top, right: 'auto', bottom: 'auto' } : undefined} aria-label="Mini Deep Focus player">
      <div className="mini-deep-focus-head" onPointerDown={handleDragStart} onPointerMove={handleDragMove} onPointerUp={handleDragEnd} onPointerCancel={handleDragEnd} onKeyDown={handleMoveKey} tabIndex={0} aria-label="Move mini Deep Focus panel with arrow keys; hold Shift to move farther">
        <div className="mini-deep-focus-brand">
          <span className={`mini-deep-focus-indicator ${timer.isRunning ? 'is-running' : ''}`} aria-hidden="true"><Flame size={15} /></span>
          <div>
            <p>Deep Focus</p>
            <span>{isComplete ? 'SESSION COMPLETE' : timer.isRunning ? 'IN SESSION' : 'READY WHEN YOU ARE'}</span>
          </div>
        </div>
        <div className="mini-deep-focus-head-actions">
          <span className="mini-deep-focus-mode">{modeLabel}</span>
          <button className="mini-deep-focus-clock-switch" type="button" onClick={toggleFlipClock} aria-pressed={clockStyle === 'flip'} aria-label={clockStyle === 'flip' ? 'Turn off flip clock' : 'Turn on flip clock'} title={clockStyle === 'flip' ? 'Use digital clock' : 'Use flip clock'}>FLIP</button>
          <Grip className="mini-deep-focus-grip" size={15} aria-hidden="true" />
          <button type="button" onClick={() => setIsOpen(false)} aria-label="Close mini Deep Focus" title="Close mini player"><X size={15} /></button>
        </div>
      </div>

      <div className="mini-deep-focus-main">
        <div className={`mini-deep-focus-time ${clockStyle === 'flip' ? 'is-flip' : ''}`} aria-label={time} aria-live="off">
          {clockStyle === 'flip' ? <>
            <span className="mini-deep-focus-flip-caption" aria-hidden="true">FOCUS</span>
            <span className="mini-deep-focus-flip-groups" aria-hidden="true">
              {flipGroups.map((group, groupIndex) => <span className="mini-deep-focus-flip-group" key={`group-${groupIndex}`}>
                {group.split('').map((digit, digitIndex) => <span className="mini-deep-focus-flip-digit" key={`${groupIndex}-${digitIndex}-${digit}`}>{digit}</span>)}
              </span>)}
            </span>
          </> : time}
        </div>
        <div className="mini-deep-focus-subject" title={timer.subjectName || undefined}>
          <BookOpen size={13} aria-hidden="true" />
          <span>{timer.subjectName || 'General Focus'}</span>
        </div>
      </div>

      <div className="mini-deep-focus-progress" role="progressbar" aria-label="Focus session progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progressRatio * 100)}>
        <span style={{ width: `${progressRatio * 100}%` }} />
      </div>

      <div className="mini-deep-focus-controls">
        <div className="mini-deep-focus-adjust" aria-label="Adjust focus time">
          {!isStopwatch && <>
            <button type="button" onClick={() => { adjustActiveTimerFromMini(-5); refresh(); }} disabled={isComplete || currentMinutes - 5 < minimumMinutes} aria-label="Reduce five minutes" title="−5 minutes">−5</button>
            <button type="button" onClick={() => { adjustActiveTimerFromMini(-1); refresh(); }} disabled={isComplete || currentMinutes - 1 < minimumMinutes} aria-label="Reduce one minute" title="−1 minute">−1</button>
            <button type="button" onClick={() => { adjustActiveTimerFromMini(1); refresh(); }} disabled={isComplete || currentMinutes >= 240} aria-label="Add one minute" title="+1 minute">+1</button>
            <button type="button" onClick={() => { adjustActiveTimerFromMini(5); refresh(); }} disabled={isComplete || currentMinutes + 5 > 240} aria-label="Add five minutes" title="+5 minutes">+5</button>
          </>}
        </div>
        <div className="mini-deep-focus-actions">
          <button className="mini-deep-focus-toggle" type="button" onClick={() => { toggleActiveTimerFromMini(); refresh(); }} disabled={isComplete}>
            {timer.isRunning && !isComplete ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
            {isComplete ? 'Complete' : timer.isRunning ? 'Pause' : timer.accumulatedSeconds > 0 ? 'Resume' : 'Start'}
          </button>
          <button className="mini-deep-focus-expand" type="button" onClick={openFullFocus} aria-label="Open full Deep Focus" title="Open full Deep Focus"><Maximize2 size={15} /></button>
        </div>
      </div>
    </aside>
  );
};
