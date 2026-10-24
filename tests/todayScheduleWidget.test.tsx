import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { AppProvider } from '../src/context/AppContext';
import { TodayScheduleWidget } from '../src/components/dashboard/TodayScheduleWidget';
import { storageService, EMPTY_STATE } from '../src/services/storage';
import {
  AppStateData,
  Subject,
  TimetableSlot,
  OccurrenceOverride,
  ExtraClass,
} from '../src/types';

describe('Phase 4A.1: TodayScheduleWidget Accuracy & Overrides', () => {
  const testSubjectCS: Subject = {
    id: 'sub-cs101',
    code: 'CS101',
    name: 'Data Structures & Algorithms',
    color: '#C45532',
    attended: 10,
    totalConducted: 12,
    targetPct: 75,
  };

  const testSubjectMath: Subject = {
    id: 'sub-ma201',
    code: 'MA201',
    name: 'Discrete Mathematics',
    color: '#2A9D8F',
    attended: 8,
    totalConducted: 10,
    targetPct: 75,
  };

  const wednesdaySlot: TimetableSlot = {
    id: 'slot-wed-algo',
    dayOfWeek: 3, // Wednesday
    startTime: '10:00',
    endTime: '11:15',
    subjectId: 'sub-cs101',
    room: 'Auditorium 1',
    instructor: 'Dr. Knuth',
  };

  const mondaySlot: TimetableSlot = {
    id: 'slot-mon-algo',
    dayOfWeek: 1, // Monday
    startTime: '09:00',
    endTime: '10:15',
    subjectId: 'sub-cs101',
    room: 'Room 101',
    instructor: 'Dr. Knuth',
  };

  const tuesdaySlot: TimetableSlot = {
    id: 'slot-tue-math',
    dayOfWeek: 2, // Tuesday
    startTime: '11:30',
    endTime: '12:45',
    subjectId: 'sub-ma201',
    room: 'Math Lab 2',
    instructor: 'Prof. Euler',
  };

  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // 1. A day with no classes displays the empty state and never displays Wednesday's classes
  it('1. A day with no classes displays the empty state and never displays Wednesdays classes', () => {
    // 2026-10-18 is Sunday (Day 7). Timetable only has Wednesday and Monday classes.
    vi.setSystemTime(new Date('2026-10-18T10:00:00Z'));

    const data: AppStateData = {
      ...EMPTY_STATE,
      subjects: [testSubjectCS],
      timetable: [wednesdaySlot, mondaySlot],
      attendanceLogs: [],
    };
    storageService.saveData(data);

    render(
      <AppProvider>
        <TodayScheduleWidget />
      </AppProvider>
    );

    expect(screen.getByText('No lectures scheduled today')).toBeInTheDocument();
    expect(
      screen.getByText('Enjoy your open day or plan self-directed study and project work.')
    ).toBeInTheDocument();

    // Verify Wednesday classes are NEVER leaked into Sunday
    expect(screen.queryByText('Auditorium 1')).not.toBeInTheDocument();
    expect(screen.queryByText('10:00 — 11:15')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /present/i })).not.toBeInTheDocument();
  });

  // 2. Normal recurring classes scheduled today appear correctly
  it('2. Normal recurring classes scheduled today appear correctly', () => {
    // 2026-10-19 is Monday (Day 1)
    vi.setSystemTime(new Date('2026-10-19T08:30:00Z'));

    const data: AppStateData = {
      ...EMPTY_STATE,
      subjects: [testSubjectCS, testSubjectMath],
      timetable: [mondaySlot, tuesdaySlot, wednesdaySlot],
      attendanceLogs: [],
    };
    storageService.saveData(data);

    render(
      <AppProvider>
        <TodayScheduleWidget />
      </AppProvider>
    );

    // Monday class should appear
    expect(screen.getByText('Data Structures & Algorithms')).toBeInTheDocument();
    expect(screen.getByText('CS101')).toBeInTheDocument();
    expect(screen.getByText(/09:00 — 10:15/)).toBeInTheDocument();
    expect(screen.getByText('Room 101')).toBeInTheDocument();
    expect(screen.getByText('Dr. Knuth')).toBeInTheDocument();

    // Tuesday and Wednesday classes should not appear
    expect(screen.queryByText('Discrete Mathematics')).not.toBeInTheDocument();
    expect(screen.queryByText('Auditorium 1')).not.toBeInTheDocument();

    // Attendance buttons should be active
    const presentBtn = screen.getByRole('button', { name: /present/i });
    expect(presentBtn).toBeInTheDocument();
    expect(presentBtn).not.toBeDisabled();
  });

  // 3. An extra class scheduled for today appears
  it('3. An extra class scheduled for today appears', () => {
    // 2026-10-19 is Monday
    vi.setSystemTime(new Date('2026-10-19T08:30:00Z'));

    const extraClass: ExtraClass = {
      id: 'extra-algo-workshop',
      subjectId: 'sub-cs101',
      date: '2026-10-19',
      startTime: '14:00',
      endTime: '16:00',
      room: 'Hackathon Lab',
      notes: 'Competitive programming drill',
    };

    const data: AppStateData = {
      ...EMPTY_STATE,
      subjects: [testSubjectCS],
      timetable: [mondaySlot],
      extraClasses: [extraClass],
      attendanceLogs: [],
    };
    storageService.saveData(data);

    render(
      <AppProvider>
        <TodayScheduleWidget />
      </AppProvider>
    );

    expect(screen.getByText('Extra Class')).toBeInTheDocument();
    expect(screen.getByText(/14:00 — 16:00/)).toBeInTheDocument();
    expect(screen.getByText('Hackathon Lab')).toBeInTheDocument();
    expect(screen.getByText('Competitive programming drill')).toBeInTheDocument();

    // Header should reflect 2 classes (1 recurring + 1 extra)
    expect(screen.getByText('2 Classes')).toBeInTheDocument();
  });

  // 4. A class rescheduled to today appears at its overridden time
  it('4. A class rescheduled to today appears at its overridden time', () => {
    // 2026-10-19 is Monday. Tuesday slot (Math) is rescheduled to Monday 16:30.
    vi.setSystemTime(new Date('2026-10-19T08:30:00Z'));

    const rescheduleOverride: OccurrenceOverride = {
      id: 'ovr-tue-to-mon',
      slotId: tuesdaySlot.id,
      originalDate: '2026-10-20',
      type: 'reschedule',
      newDate: '2026-10-19',
      newStartTime: '16:30',
      newEndTime: '17:45',
      newRoom: 'Room 305',
      newNotes: 'Shifted due to faculty meeting',
    };

    const data: AppStateData = {
      ...EMPTY_STATE,
      subjects: [testSubjectCS, testSubjectMath],
      timetable: [mondaySlot, tuesdaySlot],
      occurrenceOverrides: [rescheduleOverride],
      attendanceLogs: [],
    };
    storageService.saveData(data);

    render(
      <AppProvider>
        <TodayScheduleWidget />
      </AppProvider>
    );

    expect(screen.getByText('Rescheduled')).toBeInTheDocument();
    expect(screen.getByText('Discrete Mathematics')).toBeInTheDocument();
    expect(screen.getByText('MA201')).toBeInTheDocument();
    expect(screen.getByText(/16:30 — 17:45/)).toBeInTheDocument();
    expect(screen.getByText('Room 305')).toBeInTheDocument();
    expect(screen.getByText('Shifted due to faculty meeting')).toBeInTheDocument();
  });

  // 5. A cancelled class is clearly marked and cannot be marked present/absent
  it('5. A cancelled class is clearly marked and cannot be marked present/absent', () => {
    // 2026-10-19 is Monday. Monday class is cancelled for today.
    vi.setSystemTime(new Date('2026-10-19T08:30:00Z'));

    const cancelOverride: OccurrenceOverride = {
      id: 'ovr-cancel-mon',
      slotId: mondaySlot.id,
      originalDate: '2026-10-19',
      type: 'cancel',
    };

    const data: AppStateData = {
      ...EMPTY_STATE,
      subjects: [testSubjectCS],
      timetable: [mondaySlot],
      occurrenceOverrides: [cancelOverride],
      attendanceLogs: [],
    };
    storageService.saveData(data);

    render(
      <AppProvider>
        <TodayScheduleWidget />
      </AppProvider>
    );

    // Cancelled badge should be clearly rendered
    expect(screen.getByText('Cancelled')).toBeInTheDocument();

    // Buttons should exist but be disabled
    const presentBtn = screen.getByRole('button', { name: /present/i });
    const absentBtn = screen.getByRole('button', { name: /absent/i });
    const offBtn = screen.getByRole('button', { name: /off/i });

    expect(presentBtn).toBeDisabled();
    expect(absentBtn).toBeDisabled();
    expect(offBtn).toBeDisabled();

    // Clicking disabled button must not log attendance or mutate subject counts
    fireEvent.click(presentBtn);

    const saved = storageService.loadData();
    expect(saved.attendanceLogs.length).toBe(0);
    const sub = saved.subjects.find((s) => s.id === 'sub-cs101');
    expect(sub?.attended).toBe(10);
    expect(sub?.totalConducted).toBe(12);
  });

  // 6. Marking attendance records the correct slot/occurrence ID and date
  it('6. Marking attendance records the correct slot/occurrence ID and date', () => {
    // 2026-10-19 is Monday
    vi.setSystemTime(new Date('2026-10-19T08:30:00Z'));

    const extraClass: ExtraClass = {
      id: 'extra-drill-1',
      subjectId: 'sub-cs101',
      date: '2026-10-19',
      startTime: '15:00',
      endTime: '16:00',
      room: 'Lab 1',
    };

    const data: AppStateData = {
      ...EMPTY_STATE,
      subjects: [testSubjectCS],
      timetable: [mondaySlot],
      extraClasses: [extraClass],
      attendanceLogs: [],
    };
    storageService.saveData(data);

    render(
      <AppProvider>
        <TodayScheduleWidget />
      </AppProvider>
    );

    const presentButtons = screen.getAllByRole('button', { name: /present/i });
    expect(presentButtons.length).toBe(2);

    // 1. Mark present on the recurring class (first item, 09:00)
    act(() => {
      fireEvent.click(presentButtons[0]);
    });

    let saved = storageService.loadData();
    expect(saved.attendanceLogs.length).toBe(1);
    expect(saved.attendanceLogs[0].slotId).toBe('slot-mon-algo');
    expect(saved.attendanceLogs[0].date).toBe('2026-10-19');
    expect(saved.attendanceLogs[0].status).toBe('present');
    expect(saved.attendanceLogs[0].subjectId).toBe('sub-cs101');

    // Subject counts should be updated (+1 attended, +1 conducted)
    let sub = saved.subjects.find((s) => s.id === 'sub-cs101');
    expect(sub?.attended).toBe(11);
    expect(sub?.totalConducted).toBe(13);

    // 2. Mark present on the extra class (second item, 15:00)
    act(() => {
      fireEvent.click(presentButtons[1]);
    });

    saved = storageService.loadData();
    expect(saved.attendanceLogs.length).toBe(2);
    const extraLog = saved.attendanceLogs.find((l) => l.extraClassId === 'extra-drill-1');
    expect(extraLog).toBeDefined();
    expect(extraLog?.date).toBe('2026-10-19');
    expect(extraLog?.status).toBe('present');

    sub = saved.subjects.find((s) => s.id === 'sub-cs101');
    expect(sub?.attended).toBe(12);
    expect(sub?.totalConducted).toBe(14);
  });

  // 7. Room/time overrides are displayed correctly if those fields are supported by the current resolver
  it('7. Room/time overrides are displayed correctly if those fields are supported by the current resolver', () => {
    // 2026-10-19 is Monday. Reschedule Monday class to later time with new room and notes
    vi.setSystemTime(new Date('2026-10-19T08:30:00Z'));

    const roomTimeOverride: OccurrenceOverride = {
      id: 'ovr-mon-room-time',
      slotId: mondaySlot.id,
      originalDate: '2026-10-19',
      type: 'reschedule',
      newDate: '2026-10-19',
      newStartTime: '13:00',
      newEndTime: '14:15',
      newRoom: 'Auditorium Special C',
      newNotes: 'Special guest session',
    };

    const data: AppStateData = {
      ...EMPTY_STATE,
      subjects: [testSubjectCS],
      timetable: [mondaySlot],
      occurrenceOverrides: [roomTimeOverride],
      attendanceLogs: [],
    };
    storageService.saveData(data);

    render(
      <AppProvider>
        <TodayScheduleWidget />
      </AppProvider>
    );

    // Overridden room and time should be shown
    expect(screen.getByText('Auditorium Special C')).toBeInTheDocument();
    expect(screen.getByText(/13:00 — 14:15/)).toBeInTheDocument();
    expect(screen.getByText('Special guest session')).toBeInTheDocument();

    // Original room and time must NOT be shown
    expect(screen.queryByText('Room 101')).not.toBeInTheDocument();
    expect(screen.queryByText('09:00 — 10:15')).not.toBeInTheDocument();
  });
});
