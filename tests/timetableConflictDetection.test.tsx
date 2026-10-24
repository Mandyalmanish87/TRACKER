import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import {
  findScheduleConflicts,
  doIntervalsOverlap,
  ScheduleConflict,
} from '../src/utils/scheduleResolver';
import { ClassOccurrenceModal } from '../src/components/timetable/ClassOccurrenceModal';
import { ScheduleConflictBanner } from '../src/components/timetable/ScheduleConflictBanner';
import {
  TimetableSlot,
  OccurrenceOverride,
  ExtraClass,
  Subject,
  ResolvedCalendarEvent,
} from '../src/types';

describe('Phase 4B.1: Timetable Conflict Detection', () => {
  const subjectAlgorithms: Subject = {
    id: 'sub-algo',
    code: 'CS101',
    name: 'Data Structures & Algorithms',
    color: '#C45532',
    attended: 10,
    totalConducted: 12,
    targetPct: 75,
  };

  const subjectDatabase: Subject = {
    id: 'sub-db',
    code: 'CS102',
    name: 'Database Management Systems',
    color: '#2A9D8F',
    attended: 8,
    totalConducted: 10,
    targetPct: 75,
  };

  const subjectNetworks: Subject = {
    id: 'sub-net',
    code: 'CS103',
    name: 'Computer Networks',
    color: '#E76F51',
    attended: 6,
    totalConducted: 8,
    targetPct: 75,
  };

  // Monday 09:00 - 10:30 (Algorithms)
  const mondaySlotAlgo: TimetableSlot = {
    id: 'slot-algo',
    dayOfWeek: 1, // Monday
    startTime: '09:00',
    endTime: '10:30',
    subjectId: 'sub-algo',
    room: 'Hall A',
  };

  // Monday 10:30 - 12:00 (Database) - Adjacent to Algorithms
  const mondaySlotDb: TimetableSlot = {
    id: 'slot-db',
    dayOfWeek: 1, // Monday
    startTime: '10:30',
    endTime: '12:00',
    subjectId: 'sub-db',
    room: 'Lab 1',
  };

  // Tuesday 14:00 - 15:30 (Networks)
  const tuesdaySlotNet: TimetableSlot = {
    id: 'slot-net',
    dayOfWeek: 2, // Tuesday
    startTime: '14:00',
    endTime: '15:30',
    subjectId: 'sub-net',
    room: 'Hall B',
  };

  // 1. doIntervalsOverlap helper accuracy
  describe('Interval overlap math (doIntervalsOverlap)', () => {
    it('detects intersecting intervals', () => {
      expect(doIntervalsOverlap('10:00', '11:30', '11:00', '12:00')).toBe(true);
      expect(doIntervalsOverlap('11:00', '12:00', '10:00', '11:30')).toBe(true);
      expect(doIntervalsOverlap('10:00', '12:00', '10:30', '11:30')).toBe(true);
    });

    it('treats adjacent touching intervals as non-overlapping', () => {
      // 10:00 - 11:00 and 11:00 - 12:00 must NOT conflict
      expect(doIntervalsOverlap('10:00', '11:00', '11:00', '12:00')).toBe(false);
      expect(doIntervalsOverlap('11:00', '12:00', '10:00', '11:00')).toBe(false);
    });

    it('treats non-intersecting intervals as non-overlapping', () => {
      expect(doIntervalsOverlap('09:00', '10:00', '11:00', '12:00')).toBe(false);
    });

    it('returns false for invalid intervals (start >= end)', () => {
      expect(doIntervalsOverlap('11:00', '10:00', '10:00', '12:00')).toBe(false);
      expect(doIntervalsOverlap('10:00', '10:00', '10:00', '12:00')).toBe(false);
    });
  });

  // 2. Proposed class overlapping an existing recurring class
  it('detects a proposed class overlapping an existing recurring class', () => {
    // 2026-10-19 is Monday. Existing class is 09:00 - 10:30 (Algorithms)
    const conflicts = findScheduleConflicts({
      date: '2026-10-19',
      startTime: '10:00',
      endTime: '11:00',
      timetable: [mondaySlotAlgo],
      subjects: [subjectAlgorithms],
    });

    expect(conflicts.length).toBe(1);
    expect(conflicts[0].subjectName).toBe('Data Structures & Algorithms');
    expect(conflicts[0].subjectCode).toBe('CS101');
    expect(conflicts[0].startTime).toBe('09:00');
    expect(conflicts[0].endTime).toBe('10:30');
  });

  // 3. Proposed class overlapping a rescheduled or extra class
  it('detects a proposed class overlapping a rescheduled or extra class', () => {
    // Reschedule Tuesday Networks slot to Monday 2026-10-19 at 13:00 - 14:30
    const rescheduleOverride: OccurrenceOverride = {
      id: 'ovr-net-to-mon',
      slotId: tuesdaySlotNet.id,
      originalDate: '2026-10-20',
      type: 'reschedule',
      newDate: '2026-10-19',
      newStartTime: '13:00',
      newEndTime: '14:30',
    };

    // Extra class on Monday 2026-10-19 at 15:00 - 16:30
    const extraClass: ExtraClass = {
      id: 'extra-drill',
      subjectId: 'sub-algo',
      date: '2026-10-19',
      startTime: '15:00',
      endTime: '16:30',
    };

    // Check overlap with rescheduled class (13:30 - 14:00)
    const conflictsRescheduled = findScheduleConflicts({
      date: '2026-10-19',
      startTime: '13:30',
      endTime: '14:00',
      timetable: [tuesdaySlotNet],
      overrides: [rescheduleOverride],
      subjects: [subjectNetworks],
    });

    expect(conflictsRescheduled.length).toBe(1);
    expect(conflictsRescheduled[0].subjectName).toBe('Computer Networks');
    expect(conflictsRescheduled[0].startTime).toBe('13:00');
    expect(conflictsRescheduled[0].endTime).toBe('14:30');

    // Check overlap with extra class (16:00 - 17:00)
    const conflictsExtra = findScheduleConflicts({
      date: '2026-10-19',
      startTime: '16:00',
      endTime: '17:00',
      timetable: [],
      extraClasses: [extraClass],
      subjects: [subjectAlgorithms],
    });

    expect(conflictsExtra.length).toBe(1);
    expect(conflictsExtra[0].subjectName).toBe('Data Structures & Algorithms');
    expect(conflictsExtra[0].startTime).toBe('15:00');
    expect(conflictsExtra[0].endTime).toBe('16:30');
  });

  // 4. Cancelled class does NOT cause a conflict
  it('does NOT report a cancelled class as a conflict', () => {
    // Monday Algorithms (09:00 - 10:30) is cancelled for 2026-10-19
    const cancelOverride: OccurrenceOverride = {
      id: 'ovr-cancel-algo',
      slotId: mondaySlotAlgo.id,
      originalDate: '2026-10-19',
      type: 'cancel',
    };

    // Proposing 09:30 - 10:30 on Monday 2026-10-19
    const conflicts = findScheduleConflicts({
      date: '2026-10-19',
      startTime: '09:30',
      endTime: '10:30',
      timetable: [mondaySlotAlgo],
      overrides: [cancelOverride],
      subjects: [subjectAlgorithms],
    });

    expect(conflicts.length).toBe(0);
  });

  // 5. The class being edited does not conflict with itself
  it('does NOT report the class being edited as conflicting with itself', () => {
    // When rescheduling Monday Algorithms (09:00 - 10:30) to 09:30 - 11:00 on the same date,
    // it should not report Algorithms itself as a conflict
    const conflicts = findScheduleConflicts({
      date: '2026-10-19',
      startTime: '09:30',
      endTime: '11:00',
      timetable: [mondaySlotAlgo],
      subjects: [subjectAlgorithms],
      ignoreEvent: {
        slotId: mondaySlotAlgo.id,
        occurrenceKey: `${mondaySlotAlgo.id}::2026-10-19`,
      },
    });

    expect(conflicts.length).toBe(0);
  });

  // 6. Adjacent classes do NOT trigger a warning
  it('does NOT trigger a conflict for adjacent back-to-back classes', () => {
    // Monday Algorithms is 09:00 - 10:30
    // Proposing exactly 10:30 - 11:30 (starts right when Algorithms ends)
    const conflictsAfter = findScheduleConflicts({
      date: '2026-10-19',
      startTime: '10:30',
      endTime: '11:30',
      timetable: [mondaySlotAlgo],
      subjects: [subjectAlgorithms],
    });

    expect(conflictsAfter.length).toBe(0);

    // Proposing exactly 08:00 - 09:00 (ends right when Algorithms starts)
    const conflictsBefore = findScheduleConflicts({
      date: '2026-10-19',
      startTime: '08:00',
      endTime: '09:00',
      timetable: [mondaySlotAlgo],
      subjects: [subjectAlgorithms],
    });

    expect(conflictsBefore.length).toBe(0);
  });

  // 7. Multiple overlapping classes appear in the warning
  it('identifies multiple overlapping classes in the warning', () => {
    // Monday Algorithms (09:00 - 10:30) and Database (10:00 - 11:30, overlapping)
    const slotOverlappingDb: TimetableSlot = {
      id: 'slot-db-overlap',
      dayOfWeek: 1,
      startTime: '10:00',
      endTime: '11:30',
      subjectId: 'sub-db',
    };

    // Proposed class spans 09:30 - 10:45 (intersects BOTH Algorithms and Database)
    const conflicts = findScheduleConflicts({
      date: '2026-10-19',
      startTime: '09:30',
      endTime: '10:45',
      timetable: [mondaySlotAlgo, slotOverlappingDb],
      subjects: [subjectAlgorithms, subjectDatabase],
    });

    expect(conflicts.length).toBe(2);
    expect(conflicts.map((c) => c.subjectCode)).toContain('CS101');
    expect(conflicts.map((c) => c.subjectCode)).toContain('CS102');
  });

  // 8. Invalid time intervals are handled gracefully
  it('returns empty conflicts for invalid intervals (startTime >= endTime)', () => {
    const conflictsReversed = findScheduleConflicts({
      date: '2026-10-19',
      startTime: '11:00',
      endTime: '10:00',
      timetable: [mondaySlotAlgo],
      subjects: [subjectAlgorithms],
    });
    expect(conflictsReversed.length).toBe(0);

    const conflictsEqual = findScheduleConflicts({
      date: '2026-10-19',
      startTime: '10:00',
      endTime: '10:00',
      timetable: [mondaySlotAlgo],
      subjects: [subjectAlgorithms],
    });
    expect(conflictsEqual.length).toBe(0);
  });

  // 9. ScheduleConflictBanner renders accurately
  it('renders ScheduleConflictBanner with all conflicting items and times', () => {
    const mockConflicts: ScheduleConflict[] = [
      {
        event: {
          occurrenceKey: 'slot-algo::2026-10-19',
          subjectId: 'sub-algo',
          date: '2026-10-19',
          startTime: '09:00',
          endTime: '10:30',
          source: 'recurring',
        },
        subjectName: 'Data Structures & Algorithms',
        subjectCode: 'CS101',
        startTime: '09:00',
        endTime: '10:30',
      },
    ];

    render(<ScheduleConflictBanner conflicts={mockConflicts} />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/Schedule Conflict Detected \(1\)/i)).toBeInTheDocument();
    expect(screen.getByText('Data Structures & Algorithms')).toBeInTheDocument();
    expect(screen.getByText(/09:00 — 10:30/)).toBeInTheDocument();
    expect(
      screen.getByText(/You can still proceed if this overlap is intentional/i)
    ).toBeInTheDocument();
  });

  // 10. ClassOccurrenceModal displays warning dynamically and allows intentional overlap
  it('ClassOccurrenceModal dynamically displays conflict warning and allows intentional overlap', () => {
    const currentEvent: ResolvedCalendarEvent = {
      occurrenceKey: 'slot-algo::2026-10-19',
      slotId: mondaySlotAlgo.id,
      subjectId: 'sub-algo',
      date: '2026-10-19',
      startTime: '09:00',
      endTime: '10:30',
      source: 'recurring',
    };

    const handleReschedule = vi.fn();
    const handleClose = vi.fn();

    render(
      <ClassOccurrenceModal
        isOpen={true}
        event={currentEvent}
        subjectName={subjectAlgorithms.name}
        subjectCode={subjectAlgorithms.code}
        onClose={handleClose}
        onRescheduleOccurrence={handleReschedule}
        onCancelOccurrence={vi.fn()}
        onRestoreOccurrence={vi.fn()}
        timetable={[mondaySlotAlgo, mondaySlotDb]}
        subjects={[subjectAlgorithms, subjectDatabase]}
      />
    );

    // Switch to reschedule mode
    fireEvent.click(screen.getByRole('button', { name: /reschedule this date only/i }));

    // Input new time that overlaps with Database (10:30 - 12:00): set 11:00 to 12:30
    const startInput = screen.getByLabelText(/start time/i);
    const endInput = screen.getByLabelText(/end time/i);

    fireEvent.change(startInput, { target: { value: '11:00' } });
    fireEvent.change(endInput, { target: { value: '12:30' } });

    // Conflict warning should appear identifying Database Management Systems
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/Schedule Conflict Detected/i)).toBeInTheDocument();
    expect(screen.getByText('Database Management Systems')).toBeInTheDocument();
    expect(screen.getByText(/10:30 — 12:00/)).toBeInTheDocument();

    // Verify intentional overlap can be saved (Requirement 6)
    const saveButton = screen.getByRole('button', { name: /save rescheduled occurrence/i });
    expect(saveButton).toBeEnabled();

    act(() => {
      fireEvent.click(saveButton);
    });

    expect(handleReschedule).toHaveBeenCalledWith(
      mondaySlotAlgo.id,
      '2026-10-19',
      '2026-10-19',
      '11:00',
      '12:30',
      undefined,
      undefined
    );
    expect(handleClose).toHaveBeenCalled();
  });

  // 11. Changing proposed time or date in ClassOccurrenceModal clears warning
  it('clears warning in ClassOccurrenceModal when non-conflicting time or date is entered', () => {
    const currentEvent: ResolvedCalendarEvent = {
      occurrenceKey: 'slot-algo::2026-10-19',
      slotId: mondaySlotAlgo.id,
      subjectId: 'sub-algo',
      date: '2026-10-19',
      startTime: '09:00',
      endTime: '10:30',
      source: 'recurring',
    };

    render(
      <ClassOccurrenceModal
        isOpen={true}
        event={currentEvent}
        subjectName={subjectAlgorithms.name}
        subjectCode={subjectAlgorithms.code}
        onClose={vi.fn()}
        onRescheduleOccurrence={vi.fn()}
        onCancelOccurrence={vi.fn()}
        onRestoreOccurrence={vi.fn()}
        timetable={[mondaySlotAlgo, mondaySlotDb]}
        subjects={[subjectAlgorithms, subjectDatabase]}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /reschedule this date only/i }));

    const startInput = screen.getByLabelText(/start time/i);
    const endInput = screen.getByLabelText(/end time/i);

    // Overlapping time
    fireEvent.change(startInput, { target: { value: '11:00' } });
    fireEvent.change(endInput, { target: { value: '12:30' } });
    expect(screen.getByRole('alert')).toBeInTheDocument();

    // Change to free evening slot (16:00 - 17:30)
    fireEvent.change(startInput, { target: { value: '16:00' } });
    fireEvent.change(endInput, { target: { value: '17:30' } });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  // 12. Invalid interval in ClassOccurrenceModal blocks submission with error
  it('blocks saving and shows error when end time is at or before start time', () => {
    const currentEvent: ResolvedCalendarEvent = {
      occurrenceKey: 'slot-algo::2026-10-19',
      slotId: mondaySlotAlgo.id,
      subjectId: 'sub-algo',
      date: '2026-10-19',
      startTime: '09:00',
      endTime: '10:30',
      source: 'recurring',
    };

    const handleReschedule = vi.fn();

    render(
      <ClassOccurrenceModal
        isOpen={true}
        event={currentEvent}
        subjectName={subjectAlgorithms.name}
        subjectCode={subjectAlgorithms.code}
        onClose={vi.fn()}
        onRescheduleOccurrence={handleReschedule}
        onCancelOccurrence={vi.fn()}
        onRestoreOccurrence={vi.fn()}
        timetable={[mondaySlotAlgo]}
        subjects={[subjectAlgorithms]}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /reschedule this date only/i }));

    const startInput = screen.getByLabelText(/start time/i);
    const endInput = screen.getByLabelText(/end time/i);

    // Invalid interval: 14:00 to 13:00
    fireEvent.change(startInput, { target: { value: '14:00' } });
    fireEvent.change(endInput, { target: { value: '13:00' } });

    // Conflict banner should NOT be rendered for invalid intervals
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    // Click submit
    fireEvent.click(screen.getByRole('button', { name: /save rescheduled occurrence/i }));

    // Error message displayed
    expect(screen.getByText('End time must be after start time.')).toBeInTheDocument();
    expect(handleReschedule).not.toHaveBeenCalled();
  });
});

