import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AppProvider, useApp } from '../src/context/AppContext';
import { RecurrencePromptModal, RescheduleProposal } from '../src/components/timetable/RecurrencePromptModal';
import { resolveSchedule } from '../src/utils/scheduleResolver';
import { TimetableSlot, OccurrenceOverride } from '../src/types';

// Harness component to test scheduling actions through AppContext
const TestSchedulerHarness: React.FC = () => {
  const {
    state,
    addTimetableSlot,
    rescheduleOccurrence,
    updateTimetableSlot,
  } = useApp();

  return (
    <div>
      <div data-testid="timetable-count">{state.timetable.length}</div>
      <div data-testid="overrides-count">{(state.occurrenceOverrides || []).length}</div>
      <button
        onClick={() => {
          addTimetableSlot({
            subjectId: 'sub-math',
            dayOfWeek: 1, // Monday
            startTime: '09:00',
            endTime: '10:30',
            room: 'Hall A',
          });
        }}
      >
        Add Class
      </button>

      <button
        onClick={() => {
          const slot = state.timetable[0];
          if (slot) {
            // Dragged to Wednesday 11:00 - 12:30 (Single occurrence)
            rescheduleOccurrence(
              slot.id,
              '2026-10-19', // Monday
              '2026-10-21', // Wednesday
              '11:00',
              '12:30'
            );
          }
        }}
      >
        Reschedule Single Occurrence
      </button>

      <button
        onClick={() => {
          const slot = state.timetable[0];
          if (slot) {
            // Dragged to Friday 14:00 - 15:30 (Master schedule update)
            updateTimetableSlot(slot.id, {
              dayOfWeek: 5,
              startTime: '14:00',
              endTime: '15:30',
            });
          }
        }}
      >
        Reschedule All Occurrences
      </button>

      {/* Render overrides for verification */}
      <div data-testid="overrides-list">
        {(state.occurrenceOverrides || []).map((ov) => (
          <div key={ov.id} data-testid={`override-${ov.slotId}`}>
            {ov.originalDate} - {ov.newDate} ({ov.newStartTime}-{ov.newEndTime})
          </div>
        ))}
      </div>
    </div>
  );
};

describe('Drag-and-Drop Timetable Rescheduling & Recurrence Safety', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('reschedules a single occurrence without mutating the recurring slot rule', () => {
    render(
      <AppProvider>
        <TestSchedulerHarness />
      </AppProvider>
    );

    const initialTimetableCount = Number(screen.getByTestId('timetable-count').textContent);

    // Reschedule single occurrence of the first slot to Wednesday 11:00-12:30
    fireEvent.click(screen.getByText('Reschedule Single Occurrence'));

    // Verify override was recorded
    expect(Number(screen.getByTestId('overrides-count').textContent)).toBeGreaterThan(0);
    expect(screen.getByTestId('overrides-list')).toHaveTextContent('2026-10-19 - 2026-10-21 (11:00-12:30)');

    // Verify master timetable slots count remains unchanged
    expect(Number(screen.getByTestId('timetable-count').textContent)).toBe(initialTimetableCount);
  });

  it('updates the master slot rule when user confirms changing all occurrences', () => {
    render(
      <AppProvider>
        <TestSchedulerHarness />
      </AppProvider>
    );

    const initialTimetableCount = Number(screen.getByTestId('timetable-count').textContent);
    const initialOverridesCount = Number(screen.getByTestId('overrides-count').textContent);

    fireEvent.click(screen.getByText('Reschedule All Occurrences'));

    // Master slot updated, no new single-occurrence overrides created
    expect(Number(screen.getByTestId('timetable-count').textContent)).toBe(initialTimetableCount);
    expect(Number(screen.getByTestId('overrides-count').textContent)).toBe(initialOverridesCount);
  });

  it('resolves schedule accurately with single occurrence override applied', () => {
    const slots: TimetableSlot[] = [
      {
        id: 'slot-phys',
        subjectId: 'phys',
        dayOfWeek: 1, // Mon
        startTime: '10:00',
        endTime: '11:00',
      },
    ];

    const overrides: OccurrenceOverride[] = [
      {
        id: 'ov-1',
        slotId: 'slot-phys',
        originalDate: '2026-10-19', // Mon
        type: 'reschedule',
        newDate: '2026-10-21',       // Wed
        newStartTime: '14:00',
        newEndTime: '15:00',
      },
    ];

    // Range: Mon 2026-10-19 to Sun 2026-10-25
    const start = new Date(2026, 9, 19);
    const end = new Date(2026, 9, 25);

    const resolved = resolveSchedule(slots, overrides, [], start, end);

    // Monday 2026-10-19 should NOT have the slot because it was rescheduled away
    const monEvent = resolved.find((e) => e.date === '2026-10-19');
    expect(monEvent).toBeUndefined();

    // Wednesday 2026-10-21 SHOULD have the rescheduled occurrence at 14:00-15:00
    const wedEvent = resolved.find((e) => e.date === '2026-10-21');
    expect(wedEvent).toBeDefined();
    expect(wedEvent?.startTime).toBe('14:00');
    expect(wedEvent?.endTime).toBe('15:00');
    expect(wedEvent?.source).toBe('rescheduled');
  });

  it('renders RecurrencePromptModal and fires callbacks correctly', () => {
    let singleConfirmed = false;
    let allConfirmed = false;
    let cancelled = false;

    const sampleProposal: RescheduleProposal = {
      slotId: 'slot-chem',
      title: 'Organic Chemistry',
      originalDate: '2026-10-19',
      newDate: '2026-10-22',
      originalStartTime: '09:00',
      newStartTime: '11:00',
      originalEndTime: '10:00',
      newEndTime: '12:00',
      newDayOfWeek: 4,
    };

    const { rerender } = render(
      <RecurrencePromptModal
        isOpen={true}
        proposal={sampleProposal}
        onConfirmSingle={() => { singleConfirmed = true; }}
        onConfirmAll={() => { allConfirmed = true; }}
        onCancel={() => { cancelled = true; }}
      />
    );

    expect(screen.getByText('Reschedule Recurring Class')).toBeInTheDocument();
    expect(screen.getByText('Organic Chemistry')).toBeInTheDocument();
    expect(screen.getByText(/2026-10-19 \(09:00 - 10:00\)/)).toBeInTheDocument();
    expect(screen.getByText(/2026-10-22 \(11:00 - 12:00\)/)).toBeInTheDocument();

    // Click "This occurrence only"
    fireEvent.click(screen.getByText(/This occurrence only/i));
    expect(singleConfirmed).toBe(true);

    // Click "All future occurrences"
    rerender(
      <RecurrencePromptModal
        isOpen={true}
        proposal={sampleProposal}
        onConfirmSingle={() => { singleConfirmed = true; }}
        onConfirmAll={() => { allConfirmed = true; }}
        onCancel={() => { cancelled = true; }}
      />
    );
    fireEvent.click(screen.getByText(/All future occurrences/i));
    expect(allConfirmed).toBe(true);

    // Click "Cancel"
    rerender(
      <RecurrencePromptModal
        isOpen={true}
        proposal={sampleProposal}
        onConfirmSingle={() => { singleConfirmed = true; }}
        onConfirmAll={() => { allConfirmed = true; }}
        onCancel={() => { cancelled = true; }}
      />
    );
    fireEvent.click(screen.getByText('Cancel'));
    expect(cancelled).toBe(true);
  });
});
