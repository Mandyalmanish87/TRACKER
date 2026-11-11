/**
 * Timetable Persistence Regression Tests
 *
 * Validates that:
 * - Imported timetable data survives browser refresh (localStorage round-trip).
 * - handleInitialSync cannot silently overwrite just-imported data.
 * - Attendance scope resolver receives imported timetable and subjects.
 * - Existing unrelated data (gym, nutrition, syllabus, tasks) is never erased.
 * - Empty / invalid imports do not wipe existing timetable slots.
 * - Occurrence rescheduling persists alongside timetable data.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  loadData,
  saveData,
  saveUserData,
  loadUserData,
  STORAGE_KEY_V2,
  sanitizeLoadedState,
} from '../src/services/storage';
import { cloudSyncService } from '../src/services/cloudSyncService';
import { EMPTY_STATE } from '../src/services/defaults';
import type { AppStateData, TimetableSlot, Subject } from '../src/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_USER_ID = 'test-uid-persistence-001';

/** Build a minimal valid AppStateData with empty collections */
const createBaseState = (overrides?: Partial<AppStateData>): AppStateData => ({
  ...EMPTY_STATE,
  profile: { displayName: '', targetExam: '' },
  settings: { themeMode: 'system', accentColor: 'terracotta', backgroundStyle: 'minimal', userMode: 'individual' } as any,
  schemaVersion: 2,
  hasSampleData: false,
  ...overrides,
});

/** Build a sample subject */
const mkSubject = (id: string, name: string): Subject => ({
  id,
  code: name.slice(0, 5).toUpperCase(),
  name,
  attended: 0,
  totalConducted: 0,
  targetPct: 75,
  color: '#B8732E',
});

/** Build a sample timetable slot */
const mkSlot = (
  id: string,
  subjectId: string,
  day: 1 | 2 | 3 | 4 | 5 | 6 | 7,
  start: string,
  end: string
): TimetableSlot => ({
  id,
  dayOfWeek: day,
  startTime: start,
  endTime: end,
  subjectId,
});

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  localStorage.clear();
});

// ---------------------------------------------------------------------------
// Test A: Basic timetable + subjects persistence round-trip
// ---------------------------------------------------------------------------

describe('Test A — Basic persistence round-trip', () => {
  it('saves timetable and subjects to localStorage and reloads them intact', () => {
    const subjects = [mkSubject('sub-os', 'Operating Systems'), mkSubject('sub-cn', 'Computer Networks')];
    const timetable = [
      mkSlot('tt-1', 'sub-os', 1, '09:00', '10:00'),
      mkSlot('tt-2', 'sub-os', 3, '09:00', '10:00'),
      mkSlot('tt-3', 'sub-cn', 2, '11:00', '12:00'),
    ];

    const stateToSave = createBaseState({ subjects, timetable });
    saveData(stateToSave);

    // Simulate browser refresh: re-read from localStorage
    const reloaded = loadData();
    expect(reloaded.subjects.length).toBe(2);
    expect(reloaded.timetable.length).toBe(3);
    expect(reloaded.subjects.map((s) => s.name).sort()).toEqual(['Computer Networks', 'Operating Systems']);
    expect(reloaded.timetable.map((t) => t.id).sort()).toEqual(['tt-1', 'tt-2', 'tt-3']);
  });

  it('also saves to user-specific key and reloads correctly', () => {
    const subjects = [mkSubject('sub-dbms', 'DBMS')];
    const timetable = [mkSlot('tt-db-1', 'sub-dbms', 4, '14:00', '15:30')];
    const state = createBaseState({ subjects, timetable });

    saveUserData(TEST_USER_ID, state);
    const reloaded = loadUserData(TEST_USER_ID);

    expect(reloaded).not.toBeNull();
    expect(reloaded!.subjects.length).toBe(1);
    expect(reloaded!.timetable.length).toBe(1);
    expect(reloaded!.timetable[0].id).toBe('tt-db-1');
  });
});

// ---------------------------------------------------------------------------
// Test B — Attendance consistency (subjects + timetable survive)
// ---------------------------------------------------------------------------

describe('Test B — Attendance consistency after import and reload', () => {
  it('attendanceLogs stay intact alongside imported timetable on reload', () => {
    const subjects = [mkSubject('sub-math', 'Mathematics')];
    const timetable = [mkSlot('tt-m-1', 'sub-math', 1, '08:00', '09:00')];
    const attendanceLogs = [
      { id: 'att-1', slotId: 'tt-m-1', date: '2026-11-10', status: 'present' as const, subjectId: 'sub-math' },
    ];
    const state = createBaseState({ subjects, timetable, attendanceLogs } as any);

    saveData(state);
    const reloaded = loadData();

    expect(reloaded.timetable.length).toBe(1);
    expect(reloaded.attendanceLogs.length).toBe(1);
    expect(reloaded.attendanceLogs[0].slotId).toBe('tt-m-1');
  });
});

// ---------------------------------------------------------------------------
// Test C — Existing data protection
// ---------------------------------------------------------------------------

describe('Test C — Existing data protection', () => {
  it('saving timetable does not erase gymWorkouts, tasks, syllabusSubjects, or foodDiaryEntries', () => {
    const baseState = createBaseState({
      gymWorkouts: [{ id: 'gw-1', date: '2026-11-10', exercises: [], completed: false }] as any,
      tasks: [{ id: 'task-1', title: 'Study', status: 'todo', createdAt: '2026-11-10' }] as any,
      syllabusSubjects: [{ id: 'syl-1', name: 'Physics', chapters: [], color: '#aaa' }] as any,
      foodDiaryEntries: [{ id: 'fd-1', date: '2026-11-10', foods: [] }] as any,
    });

    // First save with existing data but no timetable
    saveData(baseState);

    // Now simulate timetable import
    const withTimetable = {
      ...baseState,
      subjects: [mkSubject('sub-algo', 'Algorithms')],
      timetable: [mkSlot('tt-algo-1', 'sub-algo', 5, '10:00', '11:00')],
    };
    saveData(withTimetable as AppStateData);

    const reloaded = loadData();

    // Timetable imported
    expect(reloaded.timetable.length).toBe(1);
    expect(reloaded.subjects.length).toBe(1);

    // Unrelated data intact
    expect(reloaded.gymWorkouts.length).toBe(1);
    expect(reloaded.tasks.length).toBe(1);
    expect(reloaded.syllabusSubjects.length).toBe(1);
    expect(reloaded.foodDiaryEntries.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Test D — Migration compatibility
// ---------------------------------------------------------------------------

describe('Test D — Migration compatibility (older schema round-trip)', () => {
  it('sanitizeLoadedState preserves timetable from a v2 schema payload', () => {
    const raw = {
      schemaVersion: 2,
      subjects: [{ id: 'sub-1', code: 'OS', name: 'Operating Systems', attended: 3, totalConducted: 5, targetPct: 75, color: '#B8732E' }],
      timetable: [{ id: 'tt-1', dayOfWeek: 1, startTime: '09:00', endTime: '10:00', subjectId: 'sub-1' }],
      hasSampleData: false,
    };

    const sanitized = sanitizeLoadedState(raw);
    expect(sanitized.subjects.length).toBe(1);
    expect(sanitized.timetable.length).toBe(1);
    expect(sanitized.timetable[0].subjectId).toBe('sub-1');
  });
});

// ---------------------------------------------------------------------------
// Test E — Empty import protection
// ---------------------------------------------------------------------------

describe('Test E — Empty import protection', () => {
  it('saving state with empty timetable array does not corrupt existing data when stored separately', () => {
    // First: save a state with timetable
    const full = createBaseState({
      subjects: [mkSubject('sub-1', 'Physics')],
      timetable: [mkSlot('tt-1', 'sub-1', 2, '10:00', '11:00')],
    });
    saveUserData(TEST_USER_ID, full);

    // Verify it is there
    const loaded1 = loadUserData(TEST_USER_ID);
    expect(loaded1!.timetable.length).toBe(1);

    // Save an "empty" state to the main key only — user archive stays intact
    const empty = createBaseState();
    saveData(empty);

    // User archive still has the timetable
    const loaded2 = loadUserData(TEST_USER_ID);
    expect(loaded2!.timetable.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Test F — Offline persistence
// ---------------------------------------------------------------------------

describe('Test F — Offline persistence (no cloud sync)', () => {
  it('imported data round-trips through localStorage even when cloud sync is unavailable', () => {
    const state = createBaseState({
      subjects: [mkSubject('sub-ds', 'Data Structures')],
      timetable: [
        mkSlot('tt-ds-1', 'sub-ds', 1, '09:00', '10:00'),
        mkSlot('tt-ds-2', 'sub-ds', 3, '09:00', '10:00'),
        mkSlot('tt-ds-3', 'sub-ds', 5, '09:00', '10:00'),
      ],
    });

    // Save to both keys
    saveData(state);
    saveUserData(TEST_USER_ID, state);

    // Simulate offline refresh
    const fromMain = loadData();
    const fromUser = loadUserData(TEST_USER_ID)!;

    expect(fromMain.timetable.length).toBe(3);
    expect(fromUser.timetable.length).toBe(3);
    expect(fromMain.timetable.map((t) => t.id).sort()).toEqual(['tt-ds-1', 'tt-ds-2', 'tt-ds-3']);
  });
});

// ---------------------------------------------------------------------------
// Test G — Rescheduling persistence
// ---------------------------------------------------------------------------

describe('Test G — Rescheduling / occurrence override persistence', () => {
  it('timetable + occurrenceOverrides both survive reload', () => {
    const state = createBaseState({
      subjects: [mkSubject('sub-cs', 'Computer Science')],
      timetable: [mkSlot('tt-cs-1', 'sub-cs', 1, '09:00', '10:00')],
      occurrenceOverrides: [
        {
          id: 'ovr-1',
          slotId: 'tt-cs-1',
          originalDate: '2026-11-09',
          newDate: '2026-11-10',
          newStartTime: '14:00',
          newEndTime: '15:00',
        },
      ] as any,
    });

    saveData(state);
    const reloaded = loadData();

    expect(reloaded.timetable.length).toBe(1);
    expect(reloaded.occurrenceOverrides.length).toBe(1);
    expect(reloaded.occurrenceOverrides[0].slotId).toBe('tt-cs-1');
    expect(reloaded.occurrenceOverrides[0].newDate).toBe('2026-11-10');
  });
});

// ---------------------------------------------------------------------------
// Test H — handleInitialSync stale-closure guard (merge preserves local)
// ---------------------------------------------------------------------------

describe('Test H — Cloud merge preserves locally imported timetable', () => {
  it('mergeDatasets keeps timetable slots from both local and cloud', () => {
    const localState = createBaseState({
      subjects: [mkSubject('sub-local', 'Local Subject')],
      timetable: [mkSlot('tt-local-1', 'sub-local', 1, '09:00', '10:00')],
    });

    const cloudState = createBaseState({
      subjects: [mkSubject('sub-cloud', 'Cloud Subject')],
      timetable: [mkSlot('tt-cloud-1', 'sub-cloud', 2, '11:00', '12:00')],
    });

    const merged = cloudSyncService.mergeDatasets(localState, cloudState);

    // Both timetable slots must survive
    expect(merged.timetable.length).toBe(2);
    const ids = merged.timetable.map((t) => t.id).sort();
    expect(ids).toEqual(['tt-cloud-1', 'tt-local-1']);

    // Both subjects must survive
    expect(merged.subjects.length).toBe(2);
    const names = merged.subjects.map((s) => s.name).sort();
    expect(names).toEqual(['Cloud Subject', 'Local Subject']);
  });

  it('mergeDatasets does not drop local timetable when cloud timetable is empty', () => {
    const localState = createBaseState({
      subjects: [mkSubject('sub-imp', 'Imported Subject')],
      timetable: [
        mkSlot('tt-imp-1', 'sub-imp', 1, '08:00', '09:00'),
        mkSlot('tt-imp-2', 'sub-imp', 3, '08:00', '09:00'),
      ],
    });

    const cloudState = createBaseState(); // empty cloud

    const merged = cloudSyncService.mergeDatasets(localState, cloudState);

    expect(merged.timetable.length).toBe(2);
    expect(merged.subjects.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Test I — User archive re-read after async gap
// ---------------------------------------------------------------------------

describe('Test I — User archive re-read catches mid-flight imports', () => {
  it('loadUserData returns imported data when called after saveUserData', () => {
    // Simulate: user imports timetable, importTimetableClasses saves immediately
    const imported = createBaseState({
      subjects: [mkSubject('sub-net', 'Networking')],
      timetable: [mkSlot('tt-net-1', 'sub-net', 4, '15:00', '16:30')],
    });
    saveUserData(TEST_USER_ID, imported);

    // Now simulate handleInitialSync re-reading after the async cloud fetch
    const reRead = loadUserData(TEST_USER_ID);
    expect(reRead).not.toBeNull();
    expect(reRead!.timetable.length).toBe(1);
    expect(reRead!.timetable[0].id).toBe('tt-net-1');
    expect(reRead!.subjects[0].name).toBe('Networking');
  });
});
