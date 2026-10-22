import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AppProvider } from '../src/context/AppContext';
import { FocusRadioProvider } from '../src/components/focus-radio';
import { Dashboard } from '../src/components/dashboard/Dashboard';
import { JourneySummaryWidget } from '../src/components/dashboard/JourneySummaryWidget';

describe('Dashboard Widget Rearrangement & Journey Summary', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders default dashboard widgets and Reset Layout control', () => {
    render(
      <AppProvider>
        <FocusRadioProvider>
          <Dashboard />
        </FocusRadioProvider>
      </AppProvider>
    );

    // Active Command Center header
    expect(screen.getByText(/Active Command Center/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reset layout/i })).toBeInTheDocument();

    // Verify key widgets are rendered (allow multiple matching texts between drag handle & card heading)
    expect(screen.getAllByText(/Today's Timetable/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Attendance Health/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Focus Journey/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Focus Radio/i).length).toBeGreaterThanOrEqual(1);
  });

  it('renders JourneySummaryWidget with 12 weeks summary', () => {
    render(
      <AppProvider>
        <JourneySummaryWidget />
      </AppProvider>
    );

    expect(screen.getByText(/Focus Journey/i)).toBeInTheDocument();
    expect(screen.getByText(/Last 12 weeks activity/i)).toBeInTheDocument();
    expect(screen.getByText(/of 84 days active/i)).toBeInTheDocument();
  });

  it('allows moving a widget down with accessible keyboard control', () => {
    render(
      <AppProvider>
        <FocusRadioProvider>
          <Dashboard />
        </FocusRadioProvider>
      </AppProvider>
    );

    // First widget move down button
    const moveDownBtn = screen.getAllByRole('button', { name: /move widget down/i })[0];
    expect(moveDownBtn).toBeInTheDocument();
    expect(moveDownBtn).not.toBeDisabled();

    fireEvent.click(moveDownBtn);

    // Reset layout restores original order
    const resetBtn = screen.getByRole('button', { name: /reset layout/i });
    fireEvent.click(resetBtn);
  });
});
