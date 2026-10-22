import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  calculateActiveElapsedSeconds,
  secondsToLoggedMinutes,
  calculateTimerProgress,
  saveActiveTimer,
  loadActiveTimer,
  clearActiveTimer,
} from '../src/utils/focusTimer';
import { ActiveTimerState } from '../src/types';

describe('Deep Focus Timer Model & Duration Accuracy', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useRealTimers();
  });

  describe('25:00 → 24:09 Countdown Elapsed Duration Bug Fix', () => {
    it('accurately calculates elapsed active focus time when paused at 24:09 (51s active, 0.85m), NEVER 24:09', () => {
      const plannedSeconds = 25 * 60; // 1500 seconds
      // Timer ran for 51 seconds: remaining is 1449 seconds (24:09)
      const accumulatedSeconds = 51;
      const isRunning = false;
      const lastStartedTimestamp = null;

      const elapsed = calculateActiveElapsedSeconds(
        plannedSeconds,
        accumulatedSeconds,
        lastStartedTimestamp,
        isRunning
      );

      expect(elapsed).toBe(51);

      // Verify remaining seconds = 1449 (24:09)
      const remaining = plannedSeconds - elapsed;
      expect(remaining).toBe(1449);
      expect(Math.floor(remaining / 60)).toBe(24);
      expect(remaining % 60).toBe(9);

      // Verify logged duration is 51 seconds / 0.85 minutes (NOT 24:09 / 24.15m)
      const loggedMinutes = secondsToLoggedMinutes(elapsed, plannedSeconds);
      expect(loggedMinutes).toBe(0.85);
      expect(loggedMinutes).not.toBe(24.09);
      expect(loggedMinutes).not.toBe(24.15);
      expect(loggedMinutes).not.toBe(25);
    });

    it('accurately excludes paused intervals across multiple pause/resume cycles', () => {
      const plannedSeconds = 25 * 60; // 1500 seconds
      const now = Date.now();

      // Cycle 1: Ran 30 seconds, then paused
      let accumulated = 30;

      // Cycle 2: Resumed 20 seconds ago and still running
      const lastStarted = now - 20 * 1000;
      const isRunning = true;

      const elapsed = calculateActiveElapsedSeconds(
        plannedSeconds,
        accumulated,
        lastStarted,
        isRunning
      );

      // 30s accumulated + 20s active in current interval = 50s total active focus
      expect(elapsed).toBe(50);

      const loggedMinutes = secondsToLoggedMinutes(elapsed, plannedSeconds);
      expect(loggedMinutes).toBe(0.83); // 50 / 60 = 0.833... -> 0.83
    });

    it('returns exact planned integer minutes when session runs to completion', () => {
      const plannedSeconds = 25 * 60; // 1500 seconds
      const accumulated = 1500;
      const elapsed = calculateActiveElapsedSeconds(plannedSeconds, accumulated, null, false);

      expect(elapsed).toBe(1500);
      const loggedMinutes = secondsToLoggedMinutes(elapsed, plannedSeconds);
      expect(loggedMinutes).toBe(25);
    });

    it('handles timer reset without producing negative or invalid durations', () => {
      const plannedSeconds = 25 * 60;
      const elapsed = calculateActiveElapsedSeconds(plannedSeconds, 0, null, false);
      expect(elapsed).toBe(0);
      expect(secondsToLoggedMinutes(elapsed, plannedSeconds)).toBe(0);
    });

    it('persists and recovers active timer state accurately across refresh', () => {
      const activeState: ActiveTimerState = {
        mode: 'pomodoro',
        plannedSeconds: 1500,
        accumulatedSeconds: 51,
        lastStartedTimestamp: null,
        isRunning: false,
        subjectId: 'sub-math',
        notes: 'Chapter 4 problems',
        status: 'paused',
      };

      saveActiveTimer(activeState);
      const loaded = loadActiveTimer();

      expect(loaded).not.toBeNull();
      expect(loaded?.plannedSeconds).toBe(1500);
      expect(loaded?.accumulatedSeconds).toBe(51);
      expect(loaded?.isRunning).toBe(false);

      if (loaded) {
        const progress = calculateTimerProgress(loaded);
        expect(progress.elapsedFocusSeconds).toBe(51);
        expect(progress.timeLeftSeconds).toBe(1449);
        expect(progress.isComplete).toBe(false);
      }

      clearActiveTimer();
      expect(loadActiveTimer()).toBeNull();
    });
  });
});

