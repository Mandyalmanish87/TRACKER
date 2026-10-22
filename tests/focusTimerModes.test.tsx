import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AppProvider } from '../src/context/AppContext';
import { FocusRadioProvider } from '../src/components/focus-radio';
import { FocusWidget } from '../src/components/dashboard/FocusWidget';
import { calculateActiveElapsedSeconds, formatFocusTime } from '../src/utils/focusTimer';

describe('Deep Focus Timer, Pomodoro & Stopwatch Features', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('formats focus time correctly for countdown and stopwatch', () => {
    expect(formatFocusTime(25 * 60)).toBe('25:00');
    expect(formatFocusTime(59)).toBe('00:59');
    expect(formatFocusTime(3665, true)).toBe('01:01:05');
    expect(formatFocusTime(45, true)).toBe('00:00:45');
  });

  it('calculates active elapsed seconds without clamping when plannedSeconds is 0 (stopwatch)', () => {
    const elapsed = calculateActiveElapsedSeconds(0, 120, null, false);
    expect(elapsed).toBe(120);
  });

  it('renders mode switcher tabs with Pomodoro, Timer, and Stopwatch', () => {
    render(
      <AppProvider>
        <FocusRadioProvider>
          <FocusWidget />
        </FocusRadioProvider>
      </AppProvider>
    );

    expect(screen.getByRole('button', { name: /^pomodoro$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^timer$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^stopwatch$/i })).toBeInTheDocument();
  });

  it('switches to Timer mode and displays countdown presets and stepper', () => {
    render(
      <AppProvider>
        <FocusRadioProvider>
          <FocusWidget />
        </FocusRadioProvider>
      </AppProvider>
    );

    const timerTab = screen.getByRole('button', { name: /^timer$/i });
    fireEvent.click(timerTab);

    // Should display custom duration controls and presets
    expect(screen.getByText(/Custom Duration:/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /start timer/i })).toBeInTheDocument();
  });

  it('switches to Stopwatch mode and provides start, lap, and log controls', () => {
    render(
      <AppProvider>
        <FocusRadioProvider>
          <FocusWidget />
        </FocusRadioProvider>
      </AppProvider>
    );

    const stopwatchTab = screen.getByRole('button', { name: /^stopwatch$/i });
    fireEvent.click(stopwatchTab);

    expect(screen.getByText(/Active Count-Up Stopwatch/i)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /start stopwatch/i }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByRole('button', { name: /lap/i }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByRole('button', { name: /log session/i }).length).toBeGreaterThanOrEqual(1);
  });
});
