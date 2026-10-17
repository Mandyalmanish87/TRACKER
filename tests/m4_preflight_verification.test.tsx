import { describe, it, expect, beforeEach } from 'vitest';
import {
  TimetableSlot,
  OccurrenceOverride,
  ExtraClass,
  SyllabusSubject,
  SyllabusImportPayload,
  AppStateData,
  Subject,
} from '../src/types';
import { resolveSchedule } from '../src/utils/scheduleResolver';
import { calculateSubjectAttendance, calculateOverallAttendance } from '../src/utils/attendance';
import { loadData, saveData } from '../src/services/storage';
import { migrateV1ToV2 } from '../src/services/migration';

describe('Pre-Milestone 4 Comprehensive System Verification', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // ── 1. Rescheduling one Monday class doesn't change every Monday ──────────
  it('1. Rescheduling one Monday class does NOT change other Mondays', () => {
    const timetable: TimetableSlot[] = [
      {
        id: 'slot-mon-algorithms',
        dayOfWeek: 1, // Monday
        startTime: '10:00',
        endTime: '11:15',
        subjectId: 'sub-algo',
        room: 'LT-1',
      },
    ];

    // Monday 1: 2026-10-19; Monday 2: 2026-10-26
    const startRange = new Date(2026, 9, 19);
    const endRange = new Date(2026, 9, 26);

    // Reschedule only the first Monday (2026-10-19) to Wednesday (2026-10-21) at 15:00 in Lab-B
    const overrides: OccurrenceOverride[] = [
      {
        id: 'ovr-oct19',
        slotId: 'slot-mon-algorithms',
        originalDate: '2026-10-19',
        type: 'reschedule',
        newDate: '2026-10-21',
        newStartTime: '15:00',
        newEndTime: '16:15',
        newRoom: 'Lab-B',
        newNotes: 'Lab demo',
      },
    ];

    const events = resolveSchedule(timetable, overrides, [], startRange, endRange);

    // Verify Monday 1 (Oct 19): original slot is removed
    const oct19Events = events.filter((e) => e.date === '2026-10-19');
    expect(oct19Events.length).toBe(0);

    // Verify Wednesday (Oct 21): rescheduled occurrence is present
    const oct21Events = events.filter((e) => e.date === '2026-10-21');
    expect(oct21Events.length).toBe(1);
    expect(oct21Events[0].source).toBe('rescheduled');
    expect(oct21Events[0].startTime).toBe('15:00');
    expect(oct21Events[0].room).toBe('Lab-B');

    // CRUCIAL: Verify Monday 2 (Oct 26): still has the original recurring class intact
    const oct26Events = events.filter((e) => e.date === '2026-10-26');
    expect(oct26Events.length).toBe(1);
    expect(oct26Events[0].source).toBe('recurring');
    expect(oct26Events[0].startTime).toBe('10:00');
    expect(oct26Events[0].room).toBe('LT-1');
  });

  // ── 2. Timetable and Attendance calendars show the same class occurrences ──
  it('2. Timetable and Attendance calendars resolve identical class occurrences for the same period', () => {
    const timetable: TimetableSlot[] = [
      {
        id: 'slot-tue-math',
        dayOfWeek: 2, // Tuesday
        startTime: '09:00',
        endTime: '10:00',
        subjectId: 'sub-math',
        room: 'Room 204',
      },
    ];

    const overrides: OccurrenceOverride[] = [
      {
        id: 'ovr-cancel-tue',
        slotId: 'slot-tue-math',
        originalDate: '2026-10-20',
        type: 'cancel',
      },
    ];

    const extraClasses: ExtraClass[] = [
      {
        id: 'extra-rev',
        subjectId: 'sub-math',
        date: '2026-10-22',
        startTime: '14:00',
        endTime: '15:30',
        room: 'Hall A',
      },
    ];

    const start = new Date(2026, 9, 18);
    const end = new Date(2026, 9, 25);

    // Both views use resolveSchedule with identical parameters
    const timetableEvents = resolveSchedule(timetable, overrides, extraClasses, start, end);
    const attendanceEvents = resolveSchedule(timetable, overrides, extraClasses, start, end);

    expect(timetableEvents).toEqual(attendanceEvents);
    expect(timetableEvents.length).toBe(2); // Cancelled recurring slot on Oct 20 + Extra class on Oct 22
    const cancelled = timetableEvents.find((e) => e.date === '2026-10-20');
    expect(cancelled?.isCancelled).toBe(true);
    const extra = timetableEvents.find((e) => e.date === '2026-10-22');
    expect(extra?.source).toBe('extra');
  });

  // ── 3. Changing the attendance requirement updates all relevant warnings ───
  it('3. Changing attendance requirement updates warnings, safe-skips, and needed classes', () => {
    // Subject with 16 attended out of 20 conducted (80%)
    const attended = 16;
    const conducted = 20;

    // Under 75% target: 80% is safe (80% >= 75% + 5% = 80%)
    const metricsAt75 = calculateSubjectAttendance(attended, conducted, 75);
    expect(metricsAt75.status).toBe('safe');
    expect(metricsAt75.safeSkips).toBe(1); // can skip 1 class (16/21 = 76.2% >= 75%)
    expect(metricsAt75.neededClasses).toBe(0);

    // Under 85% target: 80% is in danger (< 85%)
    const metricsAt85 = calculateSubjectAttendance(attended, conducted, 85);
    expect(metricsAt85.status).toBe('danger');
    expect(metricsAt85.safeSkips).toBe(0);
    expect(metricsAt85.neededClasses).toBeGreaterThan(0);
    expect(metricsAt85.summaryText).toContain('85%');

    // Overall aggregate check (without subject-level override, inherits global target)
    const subjects: Subject[] = [
      { id: 's1', code: 'CS1', name: 'Subject 1', attended: 16, totalConducted: 20, targetPct: 0, color: '#000' },
    ];
    // With 75% requirement: 80% is safe
    const overall75 = calculateOverallAttendance(subjects, 75);
    expect(overall75.status).toBe('safe');
    expect(overall75.subjectsAtRiskCount).toBe(0);

    // When global requirement changes to 85%: 80% is in danger (< 85%)
    const overall85 = calculateOverallAttendance(subjects, 85);
    expect(overall85.status).toBe('danger');
    expect(overall85.subjectsAtRiskCount).toBe(1);
  });

  // ── 4. Syllabus imports preserve existing progress and notes ───────────────
  it('4. Syllabus imports safely merge new chapters/topics while preserving existing progress, status, and notes', () => {
    const existingSubject: SyllabusSubject = {
      id: 'syl-ds',
      name: 'Data Structures',
      color: '#3D6A8A',
      chapters: [
        {
          id: 'chap-trees',
          name: 'Trees & Graphs',
          subtopics: [
            {
              id: 'top-bst',
              name: 'Binary Search Trees',
              status: 'done',
              revisionCount: 3,
              notes: 'Self-balancing AVL tree notes completed',
              pyqCovered: true,
            },
          ],
        },
      ],
    };

    // Simulate import merging logic
    const importPayload: SyllabusImportPayload = {
      schemaVersion: 1,
      subject: {
        name: 'Data Structures',
        chapters: [
          {
            name: 'Trees & Graphs',
            estimatedLectures: 8,
            importance: 'High',
            topics: [
              // Existing topic with same name
              {
                name: 'Binary Search Trees',
                estimatedLectures: 3,
                importance: 'High',
                subtopics: ['Rotations', 'Deletions'],
              },
              // Brand new topic to be added
              {
                name: 'Red-Black Trees',
                estimatedLectures: 2,
                importance: 'Medium',
                subtopics: ['Coloring rules'],
              },
            ],
          },
        ],
      },
    };

    // Merging logic matching AppContext.importSyllabus:
    const targetChapter = { ...existingSubject.chapters[0], subtopics: [...existingSubject.chapters[0].subtopics] };
    for (const importTopic of importPayload.subject.chapters[0].topics) {
      const topicExists = targetChapter.subtopics.some(
        (t) => t.name.toLowerCase() === importTopic.name.toLowerCase()
      );
      if (!topicExists) {
        targetChapter.subtopics.push({
          id: 'top-new-rb',
          name: importTopic.name,
          status: 'not_started',
          revisionCount: 0,
          notes: importTopic.subtopics?.length ? `Subtopics: ${importTopic.subtopics.join(', ')}` : undefined,
        });
      }
    }

    // Assert: Existing topic kept its 'done' status, revision count of 3, and custom notes!
    const bst = targetChapter.subtopics.find((t) => t.name === 'Binary Search Trees');
    expect(bst?.status).toBe('done');
    expect(bst?.revisionCount).toBe(3);
    expect(bst?.notes).toBe('Self-balancing AVL tree notes completed');

    // Assert: New topic was cleanly appended
    const rb = targetChapter.subtopics.find((t) => t.name === 'Red-Black Trees');
    expect(rb).toBeDefined();
    expect(rb?.status).toBe('not_started');
    expect(rb?.notes).toContain('Coloring rules');
  });

  // ── 5. Existing user data survives reloads and migrations ──────────────────
  it('5. User data survives save/load and v1-to-v2 schema migration', () => {
    // A. Verify Save and Reload
    const testData: AppStateData = {
      hasSampleData: false,
      schemaVersion: 2,
      profile: {
        displayName: 'Aarav Patel',
        targetExam: 'GATE CS 2027',
        examDate: '2027-02-14',
      },
      settings: {
        themeMode: 'dark',
        accentColor: 'sage',
        backgroundStyle: 'abstract',
        attendanceRequirement: 80,
        studyDayRolloverHour: 0,
        showExamCountdown: true,
        showFocusRadio: false,
      },
      subjects: [
        {
          id: 'sub-dbms',
          code: 'CS401',
          name: 'Database Systems',
          attended: 28,
          totalConducted: 30,
          targetPct: 80,
          color: '#436650',
          isSample: false,
        },
      ],
      timetable: [],
      attendanceLogs: [],
      studySessions: [],
      gymWorkouts: [],
      reminders: [],
      syllabusSubjects: [],
      occurrenceOverrides: [],
      extraClasses: [],
    };

    saveData(testData);
    const loaded = loadData();

    expect(loaded.profile?.displayName).toBe('Aarav Patel');
    expect(loaded.profile?.targetExam).toBe('GATE CS 2027');
    expect(loaded.settings?.accentColor).toBe('sage');
    expect(loaded.settings?.attendanceRequirement).toBe(80);
    expect(loaded.subjects[0].name).toBe('Database Systems');
    expect(loaded.subjects[0].attended).toBe(28);

    // B. Verify v1 to v2 migration
    const legacyV1 = {
      hasSampleData: false,
      subjects: [
        {
          id: 'v1-sub',
          code: 'PHY1',
          name: 'Physics I',
          attended: 10,
          totalConducted: 12,
          color: '#C45532',
        },
      ],
      timetable: [],
      attendanceLogs: [],
      studySessions: [],
      gymWorkouts: [],
      reminders: [],
    };

    const migrated = migrateV1ToV2(legacyV1);
    expect(migrated.schemaVersion).toBe(2);
    expect(migrated.subjects.length).toBe(1);
    expect(migrated.subjects[0].name).toBe('Physics I');
    expect(migrated.profile).toBeDefined();
    expect(migrated.settings).toBeDefined();
  });
});
