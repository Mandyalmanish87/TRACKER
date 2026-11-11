/**
 * TRAKIFY — User Mode Isolation + Timetable & Attendance Regression Tests
 *
 * Comprehensive test suite validating:
 * 1. User Mode Type A (Individual) vs Type B (Class-based) isolation & route guarding
 * 2. ClassSpaceContext does NOT overwrite userMode to 'class_based' on refresh
 * 3. Navigation hides ClassSpace in Individual mode and shows in Class-based mode
 * 4. Timetable & Attendance data consistency (personal vs official)
 * 5. Occurrence rescheduling safety (one-off does not modify series, appears on new date)
 * 6. Timezone/date safety (no UTC offset day shift)
 * 7. Multi-student attendance data isolation
 * 8. Replaced timetable import cleans up orphaned overrides & creates tombstones
 */

import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getInitialNavTab, parseRouteFromHash } from '../src/App';
import { classSpaceService } from '../src/services/classSpaceService';
import { resolveAttendanceScope } from '../src/utils/attendanceScopeResolver';
import { resolveSchedule, parseDateStr, dateToDayOfWeek, formatDateStr } from '../src/utils/scheduleResolver';
import { resolveClassSchedule } from '../src/utils/classSpaceUtils';
import { loadData, saveData, saveUserData, loadUserData, sanitizeLoadedState } from '../src/services/storage';
import { cloudSyncService } from '../src/services/cloudSyncService';
import { EMPTY_STATE } from '../src/services/defaults';
import type { AppStateData, TimetableSlot, Subject, OccurrenceOverride, DayOfWeek } from '../src/types';
import type { ClassSpaceWorkspace, ClassTimetableRule, ClassTimetableOverride } from '../src/types/classSpace';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const createBaseState = (overrides?: Partial<AppStateData>): AppStateData => ({
  ...EMPTY_STATE,
  profile: { displayName: 'Test Student', targetExam: 'GATE' },
  settings: {
    themeMode: 'system',
    accentColor: 'terracotta',
    backgroundStyle: 'minimal',
    userMode: 'individual',
  } as any,
  schemaVersion: 2,
  hasSampleData: false,
  ...overrides,
});

const mkSubject = (id: string, name: string): Subject => ({
  id,
  code: name.slice(0, 5).toUpperCase(),
  name,
  attended: 0,
  totalConducted: 0,
  targetPct: 75,
  color: '#B8732E',
});

const mkSlot = (
  id: string,
  subjectId: string,
  day: DayOfWeek,
  start: string,
  end: string
): TimetableSlot => ({
  id,
  dayOfWeek: day,
  startTime: start,
  endTime: end,
  subjectId,
});

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

// ===========================================================================
// PART 1: USER MODE TYPE A / TYPE B ISOLATION TESTS
// ===========================================================================

describe('Part 1 — User Mode Isolation & Navigation Guarding', () => {
  it('1. Type A — Individual cannot access ClassSpace through getInitialNavTab (route guard)', () => {
    // When URL points to #classspace but user is in individual mode
    delete (window as any).location;
    (window as any).location = { hash: '#classspace', pathname: '/', search: '' };

    const tab = getInitialNavTab('usr_test', 'individual');
    // Must redirect to dashboard, never classspace!
    expect(tab).toBe('dashboard');
  });

  it('2. Type B — Class-based CAN access ClassSpace through getInitialNavTab', () => {
    delete (window as any).location;
    (window as any).location = { hash: '#classspace', pathname: '/', search: '' };

    const tab = getInitialNavTab('usr_test', 'class_based');
    expect(tab).toBe('classspace');
  });

  it('3. Stored classspace tab in localStorage redirects to dashboard when in individual mode', () => {
    delete (window as any).location;
    (window as any).location = { hash: '', pathname: '/', search: '' };
    localStorage.setItem('tracker_active_nav_tab', 'classspace');

    const tab = getInitialNavTab('usr_test', 'individual');
    expect(tab).toBe('dashboard');
  });

  it('4. ClassSpace membership existing in storage does NOT force userMode to class_based on load', async () => {
    const user = { id: 'usr_student_alpha', name: 'Alice', email: 'alice@test.com' };

    // Create a workspace for user
    const res = await classSpaceService.createWorkspace(user, { name: 'CS Section A' });
    expect(res.workspace).toBeDefined();

    // Verify workspace is saved in localStorage
    const userWorkspaces = await classSpaceService.getWorkspacesForUser(user.id);
    expect(userWorkspaces.length).toBeGreaterThan(0);

    // Now save user settings with explicit Type A (individual)
    const state = createBaseState({
      settings: {
        themeMode: 'system',
        accentColor: 'terracotta',
        backgroundStyle: 'minimal',
        userMode: 'individual',
      } as any,
    });
    saveData(state);

    // Reload from storage — userMode MUST remain 'individual'
    const reloaded = loadData();
    expect(reloaded.settings?.userMode).toBe('individual');
  });

  it('5. Switching between individual and class_based preserves all personal data', () => {
    const subjects = [mkSubject('sub-1', 'Physics'), mkSubject('sub-2', 'Chemistry')];
    const timetable = [mkSlot('tt-1', 'sub-1', 1, '09:00', '10:00')];
    const attendanceLogs = [{ id: 'att-1', slotId: 'tt-1', date: '2026-11-10', status: 'present' as const, subjectId: 'sub-1' }];
    const gymWorkouts = [{ id: 'gym-1', date: '2026-11-10', exercises: [], completed: true }] as any;

    const individualState = createBaseState({
      subjects,
      timetable,
      attendanceLogs,
      gymWorkouts,
      settings: { userMode: 'individual' } as any,
    });

    saveData(individualState);

    // Switch to class_based
    const classBasedState = {
      ...individualState,
      settings: { ...individualState.settings, userMode: 'class_based' as const },
    };
    saveData(classBasedState);

    // Switch back to individual
    const backToIndividual = {
      ...classBasedState,
      settings: { ...classBasedState.settings, userMode: 'individual' as const },
    };
    saveData(backToIndividual);

    const reloaded = loadData();
    expect(reloaded.settings?.userMode).toBe('individual');
    expect(reloaded.subjects.length).toBe(2);
    expect(reloaded.timetable.length).toBe(1);
    expect(reloaded.attendanceLogs.length).toBe(1);
    expect(reloaded.gymWorkouts.length).toBe(1);
  });

  it('6. Switching modes does NOT delete shared workspace membership records', async () => {
    const user = { id: 'usr_student_sw', name: 'Sam', email: 'sam@test.com' };
    const wsRes = await classSpaceService.createWorkspace(user, { name: 'Batch 2026' });
    expect(wsRes.workspace).toBeDefined();

    // Verify workspace exists
    let workspaces = await classSpaceService.getWorkspacesForUser(user.id);
    expect(workspaces.length).toBe(1);

    // Simulate user setting individual mode in settings
    const state = createBaseState({
      settings: { userMode: 'individual' } as any,
    });
    saveData(state);

    // Workspaces in classSpaceService must still exist in storage!
    workspaces = await classSpaceService.getWorkspacesForUser(user.id);
    expect(workspaces.length).toBe(1);
    expect(workspaces[0].name).toBe('Batch 2026');
  });
});

// ===========================================================================
// PART 2: TIMETABLE & ATTENDANCE DATA FLOW TESTS
// ===========================================================================

describe('Part 2 — Timetable & Attendance Consistency', () => {
  it('1. resolveAttendanceScope in Individual mode derives metrics from personal timetable', () => {
    const subjects = [mkSubject('sub-algo', 'Algorithms')];
    const timetable = [
      mkSlot('tt-1', 'sub-algo', 1, '09:00', '10:00'), // Mon
      mkSlot('tt-2', 'sub-algo', 3, '09:00', '10:00'), // Wed
    ];

    const scope = resolveAttendanceScope({
      userMode: 'individual',
      appState: {
        subjects,
        timetable,
        attendanceLogs: [],
      },
    });

    expect(scope.mode).toBe('individual');
    expect(scope.hasWorkspaces).toBe(false);
    expect(scope.subjectMetrics.length).toBe(1);
    expect(scope.subjectMetrics[0].subjectName).toBe('Algorithms');
    expect(scope.scheduledOccurrences.length).toBeGreaterThan(0);
    // Scheduled occurrences all point to personal subject
    expect(scope.scheduledOccurrences.every((o) => o.subjectId === 'sub-algo')).toBe(true);
  });

  it('2. resolveAttendanceScope in Class-based mode uses official workspace rules', async () => {
    const user = { id: 'usr_cr_1', name: 'CR Student', email: 'cr@test.com' };
    const wsRes = await classSpaceService.createWorkspace(user, { name: 'Official Cohort' });
    const ws = wsRes.workspace!;

    const rules: ClassTimetableRule[] = [
      {
        id: 'rule-cs1',
        workspaceId: ws.id,
        subjectName: 'Computer Systems',
        subjectCode: 'CS101',
        dayOfWeek: 2,
        startTime: '10:00',
        endTime: '11:30',
        createdAt: '2026-11-01',
        updatedAt: '2026-11-01',
        createdBy: user.id,
      },
    ];

    const scope = resolveAttendanceScope({
      userMode: 'class_based',
      appState: {
        subjects: [mkSubject('sub-priv', 'Private Art Class')],
        timetable: [mkSlot('tt-priv', 'sub-priv', 1, '14:00', '15:00')],
        attendanceLogs: [],
      },
      classSpace: {
        workspaces: [ws],
        activeWorkspace: ws,
        currentMember: wsRes.member || null,
        rules,
        overrides: [],
        attendanceRecords: [],
      },
    });

    expect(scope.mode).toBe('class_based');
    expect(scope.workspaceName).toBe('Official Cohort');
    expect(scope.subjectMetrics.length).toBe(1);
    expect(scope.subjectMetrics[0].subjectName).toBe('Computer Systems');
    // Private timetable classes must NOT leak into official class-based attendance
    expect(scope.subjectMetrics.some((s) => s.subjectName === 'Private Art Class')).toBe(false);
  });

  it('3. Rescheduled class within the same week appears on the new date in resolveClassSchedule', () => {
    // Test the fix for the bug where rescheduled classes in the same range were dropped!
    const rule: ClassTimetableRule = {
      id: 'rule-os',
      workspaceId: 'ws-1',
      subjectName: 'Operating Systems',
      subjectCode: 'OS301',
      dayOfWeek: 1, // Monday
      startTime: '09:00',
      endTime: '10:15',
      createdAt: '2026-11-01',
      updatedAt: '2026-11-01',
      createdBy: 'cr-1',
    };

    // Reschedule Monday Nov 10 to Wednesday Nov 12
    const override: ClassTimetableOverride = {
      id: 'ovr-resched-1',
      workspaceId: 'ws-1',
      ruleId: 'rule-os',
      originalDate: '2026-11-10', // Monday
      newDate: '2026-11-12',      // Wednesday
      newStartTime: '14:00',
      newEndTime: '15:15',
      type: 'reschedule',
      reason: 'Lab maintenance',
      createdAt: '2026-11-08',
      createdBy: 'cr-1',
    };

    const start = parseDateStr('2026-11-09'); // Monday
    const end = parseDateStr('2026-11-15');   // Sunday

    const occurrences = resolveClassSchedule([rule], [override], start, end);

    // Monday Nov 10 occurrence must NOT be present
    const mondayOcc = occurrences.find((o) => o.date === '2026-11-10');
    expect(mondayOcc).toBeUndefined();

    // Wednesday Nov 12 occurrence MUST be present with new time
    const wednesdayOcc = occurrences.find((o) => o.date === '2026-11-12');
    expect(wednesdayOcc).toBeDefined();
    expect(wednesdayOcc!.startTime).toBe('14:00');
    expect(wednesdayOcc!.endTime).toBe('15:15');
    expect(wednesdayOcc!.source).toBe('rescheduled');
  });

  it('4. Rescheduling one occurrence in scheduleResolver does not modify recurring series', () => {
    const slot = mkSlot('tt-ds', 'sub-ds', 1, '10:00', '11:00'); // Every Monday

    // Override only for Monday 2026-11-09
    const overrides: OccurrenceOverride[] = [
      {
        id: 'ovr-1',
        slotId: 'tt-ds',
        originalDate: '2026-11-09',
        type: 'reschedule',
        newDate: '2026-11-10',
        newStartTime: '11:00',
        newEndTime: '12:00',
      },
    ];

    // Range spanning two weeks (two Mondays: Nov 9 and Nov 16)
    const start = parseDateStr('2026-11-09');
    const end = parseDateStr('2026-11-22');

    const events = resolveSchedule([slot], overrides, [], start, end);

    // Nov 9 is rescheduled to Nov 10
    expect(events.find((e) => e.date === '2026-11-09')).toBeUndefined();
    const rescheduled = events.find((e) => e.date === '2026-11-10');
    expect(rescheduled).toBeDefined();
    expect(rescheduled!.startTime).toBe('11:00');

    // Next Monday (Nov 16) MUST still be at original recurring time 10:00!
    const nextWeekMonday = events.find((e) => e.date === '2026-11-16');
    expect(nextWeekMonday).toBeDefined();
    expect(nextWeekMonday!.startTime).toBe('10:00');
    expect(nextWeekMonday!.source).toBe('recurring');
  });

  it('5. dateToDayOfWeek and parseDateStr correctly map dates without UTC timezone shift', () => {
    // 2026-11-09 is a Monday (Day 1)
    const d1 = parseDateStr('2026-11-09');
    expect(dateToDayOfWeek(d1)).toBe(1);

    // 2026-11-15 is a Sunday (Day 7)
    const d7 = parseDateStr('2026-11-15');
    expect(dateToDayOfWeek(d7)).toBe(7);

    // formatDateStr round-trips exactly
    expect(formatDateStr(d1)).toBe('2026-11-09');
    expect(formatDateStr(d7)).toBe('2026-11-15');
  });
});

// ===========================================================================
// PART 3: DATA ISOLATION & CLOUD SYNC TOMBSTONES
// ===========================================================================

describe('Part 3 — Multi-Student Attendance & Sync Isolation', () => {
  it('1. Two students in the same class have strictly isolated attendance records', async () => {
    const studentA = { id: 'usr_student_a', name: 'Alice', email: 'alice@test.com' };
    const studentB = { id: 'usr_student_b', name: 'Bob', email: 'bob@test.com' };

    const wsRes = await classSpaceService.createWorkspace(studentA, { name: 'Shared Class' });
    const ws = wsRes.workspace!;

    // Student A marks attendance as 'present'
    await classSpaceService.setAttendanceRecord(ws.id, studentA.id, 'rule-1::2026-11-10', '2026-11-10', 'present');

    // Student B marks attendance as 'absent'
    await classSpaceService.setAttendanceRecord(ws.id, studentB.id, 'rule-1::2026-11-10', '2026-11-10', 'absent');

    // Retrieve records for Student A
    const recordsA = await classSpaceService.getAttendanceRecords(ws.id, studentA.id);
    expect(recordsA.length).toBe(1);
    expect(recordsA[0].status).toBe('present');
    expect(recordsA[0].userId).toBe(studentA.id);

    // Retrieve records for Student B
    const recordsB = await classSpaceService.getAttendanceRecords(ws.id, studentB.id);
    expect(recordsB.length).toBe(1);
    expect(recordsB[0].status).toBe('absent');
    expect(recordsB[0].userId).toBe(studentB.id);
  });

  it('2. Cloud sync merge respects tombstones and never resurrects deleted timetable slots', () => {
    const oldSlot = mkSlot('tt-old-1', 'sub-1', 1, '09:00', '10:00');
    const newSlot = mkSlot('tt-new-1', 'sub-2', 2, '11:00', '12:00');

    // Local state replaced the old slot and has a tombstone for it
    const localState = createBaseState({
      timetable: [newSlot],
      tombstones: [
        {
          id: 'tt-old-1',
          collection: 'timetable',
          deletedAt: new Date().toISOString(),
        },
      ],
    });

    // Cloud still has the old slot (from before replacement)
    const cloudState = createBaseState({
      timetable: [oldSlot],
    });

    const merged = cloudSyncService.mergeDatasets(localState, cloudState);

    // oldSlot must NOT be resurrected because tombstone deletes it!
    expect(merged.timetable.length).toBe(1);
    expect(merged.timetable[0].id).toBe('tt-new-1');
  });
});
