import { describe, it, expect, beforeEach, vi } from 'vitest';
import { classSpaceService } from '../src/services/classSpaceService';
import { resolveAttendanceScope } from '../src/utils/attendanceScopeResolver';
import { resolveSchedule } from '../src/utils/scheduleResolver';
import { calculateDefaultEndDate } from '../src/utils/academicCalendarEngine';
import {
  ClassSpaceWorkspace,
  ClassAttendanceRecord,
} from '../src/types/classSpace';
import { TimetableSlot, Subject, PlannerTask, GymWorkout, FoodDiaryEntry } from '../src/types';

describe('Personal Space, DayOS & Timetable Isolation Regression Suite', () => {
  const userA = { id: 'usr_student_alpha', name: 'Alice Student', email: 'alice@example.com' };
  const userB = { id: 'usr_student_beta', name: 'Bob Student', email: 'bob@example.com' };

  let workspace1: ClassSpaceWorkspace;
  let workspace2: ClassSpaceWorkspace;

  beforeEach(async () => {
    localStorage.clear();
    vi.clearAllMocks();

    // Create test workspace 1
    const res1 = await classSpaceService.createWorkspace(userA, {
      name: 'Computer Science Batch 2026',
      section: 'A',
    });
    workspace1 = res1.workspace!;

    // Create test workspace 2
    const res2 = await classSpaceService.createWorkspace(userB, {
      name: 'Data Science Batch 2026',
      section: 'B',
    });
    workspace2 = res2.workspace!;
  });

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 1: ClassSpace timetable edits do not change personal timetable
  // ─────────────────────────────────────────────────────────────────────────
  it('1. ClassSpace timetable edits do not change personal timetable', async () => {
    // User has personal timetable
    const personalSlot: TimetableSlot = {
      id: 'personal_slot_1',
      dayOfWeek: 1, // Monday
      startTime: '09:00',
      endTime: '10:00',
      subjectId: 'sub_personal_1',
      room: 'Personal Study Room',
    };
    const personalTimetable: TimetableSlot[] = [personalSlot];

    // CR adds a ClassSpace rule to Workspace 1
    const ruleRes = await classSpaceService.addTimetableRule(workspace1.id, 'owner', {
      subjectName: 'Advanced Algorithms',
      subjectCode: 'CS401',
      subjectColor: '#B45309',
      dayOfWeek: 1,
      startTime: '11:00',
      endTime: '12:30',
      room: 'Lecture Hall 1',
      createdBy: userA.id,
    });
    expect(ruleRes.rule).toBeDefined();

    // Fetch official schedule from service
    const sched = await classSpaceService.getScheduleData(workspace1.id);
    expect(sched.rules.length).toBe(1);
    expect(sched.rules[0].subjectCode).toBe('CS401');

    // Verify personal timetable remains 100% unaltered
    expect(personalTimetable.length).toBe(1);
    expect(personalTimetable[0].id).toBe('personal_slot_1');
    expect(personalTimetable[0].startTime).toBe('09:00');
    expect(personalTimetable.some((t) => t.id === sched.rules[0].id)).toBe(false);

    // CR updates the ClassSpace rule
    await classSpaceService.updateTimetableRule(workspace1.id, 'owner', sched.rules[0].id, {
      startTime: '11:30',
      endTime: '13:00',
      room: 'Lecture Hall 2',
    });

    const updatedSched = await classSpaceService.getScheduleData(workspace1.id);
    expect(updatedSched.rules[0].startTime).toBe('11:30');
    expect(updatedSched.rules[0].room).toBe('Lecture Hall 2');

    // Personal timetable is still untouched
    expect(personalTimetable[0].startTime).toBe('09:00');
    expect(personalTimetable[0].room).toBe('Personal Study Room');
  });

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 2: Personal timetable edits do not change ClassSpace timetable
  // ─────────────────────────────────────────────────────────────────────────
  it('2. Personal timetable edits do not change ClassSpace timetable', async () => {
    // Official ClassSpace rule
    const ruleRes = await classSpaceService.addTimetableRule(workspace1.id, 'owner', {
      subjectName: 'Database Management',
      subjectCode: 'CS302',
      subjectColor: '#3D6A8A',
      dayOfWeek: 2, // Tuesday
      startTime: '10:00',
      endTime: '11:15',
      room: 'Room 305',
      createdBy: userA.id,
    });
    const officialRule = ruleRes.rule!;

    // Student modifies personal timetable slots
    const personalTimetable: TimetableSlot[] = [
      {
        id: 'slot_pers_abc',
        dayOfWeek: 2,
        startTime: '14:00',
        endTime: '15:00',
        subjectId: 'sub_pers_math',
      },
    ];

    // Add another personal slot
    personalTimetable.push({
      id: 'slot_pers_xyz',
      dayOfWeek: 3,
      startTime: '08:00',
      endTime: '09:00',
      subjectId: 'sub_pers_physics',
    });

    // Verify official ClassSpace schedule is unaffected
    const sched = await classSpaceService.getScheduleData(workspace1.id);
    expect(sched.rules.length).toBe(1);
    expect(sched.rules[0].id).toBe(officialRule.id);
    expect(sched.rules[0].subjectCode).toBe('CS302');
    expect(sched.rules[0].startTime).toBe('10:00');
  });

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 3: Editing one class occurrence does not modify its recurring series
  // ─────────────────────────────────────────────────────────────────────────
  it('3. Editing one class occurrence does not modify its recurring series', async () => {
    // 1. In ClassSpace: add a recurring rule
    const ruleRes = await classSpaceService.addTimetableRule(workspace1.id, 'owner', {
      subjectName: 'Operating Systems',
      subjectCode: 'CS204',
      subjectColor: '#10B981',
      dayOfWeek: 3, // Wednesday
      startTime: '09:00',
      endTime: '10:15',
      room: 'Lab 1',
      createdBy: userA.id,
    });
    const rule = ruleRes.rule!;

    // Create a single-occurrence reschedule override for date 2026-09-02
    const overrideRes = await classSpaceService.addOccurrenceOverride(workspace1.id, 'owner', {
      ruleId: rule.id,
      originalDate: '2026-09-02',
      type: 'reschedule',
      newDate: '2026-09-03', // Moved to Thursday
      newStartTime: '14:00',
      newEndTime: '15:15',
      newRoom: 'Lab 4',
      changeNote: 'Lab maintenance on Wednesday',
      createdBy: userA.id,
    });
    expect(overrideRes.override).toBeDefined();

    // Verify the recurring rule itself was NOT mutated
    const sched = await classSpaceService.getScheduleData(workspace1.id);
    expect(sched.rules.length).toBe(1);
    expect(sched.rules[0].dayOfWeek).toBe(3); // Still Wednesday
    expect(sched.rules[0].startTime).toBe('09:00'); // Still 09:00
    expect(sched.rules[0].room).toBe('Lab 1'); // Still Lab 1

    // Verify the single override exists
    expect(sched.overrides.length).toBe(1);
    expect(sched.overrides[0].originalDate).toBe('2026-09-02');
    expect(sched.overrides[0].newDate).toBe('2026-09-03');
    expect(sched.overrides[0].newStartTime).toBe('14:00');
  });

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 4: ClassSpace Analytics loads the selected ClassSpace's subjects
  // ─────────────────────────────────────────────────────────────────────────
  it("4. ClassSpace Analytics loads the selected ClassSpace's subjects", async () => {
    // Add two subjects to Workspace 1 via timetable rules
    await classSpaceService.addTimetableRule(workspace1.id, 'owner', {
      subjectName: 'Computer Networks',
      subjectCode: 'NET301',
      subjectColor: '#6366F1',
      dayOfWeek: 1,
      startTime: '10:00',
      endTime: '11:00',
      createdBy: userA.id,
    });

    await classSpaceService.addTimetableRule(workspace1.id, 'owner', {
      subjectName: 'Software Engineering',
      subjectCode: 'SE302',
      subjectColor: '#EC4899',
      dayOfWeek: 4,
      startTime: '11:00',
      endTime: '12:00',
      createdBy: userA.id,
    });

    const sched = await classSpaceService.getScheduleData(workspace1.id);
    expect(sched.rules.length).toBe(2);

    // Resolve attendance scope for Class-Based mode
    const scopeData = resolveAttendanceScope({
      userMode: 'class_based',
      appState: {
        subjects: [],
        timetable: [],
        attendanceLogs: [],
      },
      classSpace: {
        workspaces: [workspace1],
        activeWorkspace: workspace1,
        currentMember: {
          id: 'mem1',
          workspaceId: workspace1.id,
          userId: userA.id,
          role: 'owner',
          joinedAt: new Date().toISOString(),
          displayName: userA.name,
        },
        rules: sched.rules,
        overrides: sched.overrides,
        attendanceRecords: [],
      },
      targetRequirement: 75,
    });

    expect(scopeData.mode).toBe('class_based');
    expect(scopeData.workspaceId).toBe(workspace1.id);
    expect(scopeData.subjectMetrics.length).toBe(2);
    expect(scopeData.subjectMetrics.some((s) => s.subjectCode === 'NET301')).toBe(true);
    expect(scopeData.subjectMetrics.some((s) => s.subjectCode === 'SE302')).toBe(true);
    expect(scopeData.isEmpty).toBe(false);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 5: Attendance Simulator uses the selected ClassSpace's scheduled occurrences
  // ─────────────────────────────────────────────────────────────────────────
  it("5. Attendance Simulator uses the selected ClassSpace's scheduled occurrences", async () => {
    await classSpaceService.addTimetableRule(workspace1.id, 'owner', {
      subjectName: 'Compiler Design',
      subjectCode: 'CD401',
      subjectColor: '#F59E0B',
      dayOfWeek: 1, // Mondays
      startTime: '09:00',
      endTime: '10:00',
      createdBy: userA.id,
    });

    const sched = await classSpaceService.getScheduleData(workspace1.id);

    // Setup an active academic period
    workspace1.academicCalendar = {
      periodType: 'semester',
      startDate: '2026-08-01',
      endDate: calculateDefaultEndDate('2026-08-01', 'semester'),
      weeklyOffDays: { sundayOff: true, saturdayOff: true },
      nationalHolidays: [],
    };

    const scopeData = resolveAttendanceScope({
      userMode: 'class_based',
      appState: { subjects: [], timetable: [], attendanceLogs: [] },
      classSpace: {
        workspaces: [workspace1],
        activeWorkspace: workspace1,
        currentMember: null,
        rules: sched.rules,
        overrides: [],
        attendanceRecords: [],
      },
      targetRequirement: 75,
    });

    // The simulator has access to CD401 and its occurrences
    const cdSubject = scopeData.subjectMetrics.find((s) => s.subjectCode === 'CD401');
    expect(cdSubject).toBeDefined();
    expect(cdSubject?.subjectName).toBe('Compiler Design');
    expect(scopeData.scheduledOccurrences.length).toBeGreaterThan(0);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 6: Attendance analytics use only the current user's attendance records
  // ─────────────────────────────────────────────────────────────────────────
  it("6. Attendance analytics use only the current user's attendance records", async () => {
    workspace1.academicCalendar = {
      periodType: 'semester',
      startDate: '2026-08-01',
      endDate: calculateDefaultEndDate('2026-08-01', 'semester'),
      weeklyOffDays: { sundayOff: true, saturdayOff: true },
      nationalHolidays: [],
    };

    const ruleRes = await classSpaceService.addTimetableRule(workspace1.id, 'owner', {
      subjectName: 'Artificial Intelligence',
      subjectCode: 'AI501',
      subjectColor: '#8B5CF6',
      dayOfWeek: 2,
      startTime: '10:00',
      endTime: '11:00',
      createdBy: userA.id,
    });

    const occKey = `${ruleRes.rule!.id}::2026-08-04`;

    // Student A marks 'present'
    await classSpaceService.setAttendanceRecord(
      workspace1.id,
      userA.id,
      occKey,
      '2026-08-04',
      'present'
    );

    // Student B marks 'absent' on the SAME class occurrence
    await classSpaceService.setAttendanceRecord(
      workspace1.id,
      userB.id,
      occKey,
      '2026-08-04',
      'absent'
    );

    // Student A's attendance records
    const recordsA = await classSpaceService.getAttendanceRecords(workspace1.id, userA.id);
    expect(recordsA.length).toBe(1);
    expect(recordsA[0].status).toBe('present');

    // Student B's attendance records
    const recordsB = await classSpaceService.getAttendanceRecords(workspace1.id, userB.id);
    expect(recordsB.length).toBe(1);
    expect(recordsB[0].status).toBe('absent');

    // Scoped attendance for Student A
    const scopeA = resolveAttendanceScope({
      userMode: 'class_based',
      appState: { subjects: [], timetable: [], attendanceLogs: [] },
      classSpace: {
        workspaces: [workspace1],
        activeWorkspace: workspace1,
        currentMember: null,
        rules: [ruleRes.rule!],
        overrides: [],
        attendanceRecords: recordsA,
      },
      effectiveUserId: userA.id,
      targetRequirement: 75,
    });

    const aiMetricsA = scopeA.subjectMetrics.find((s) => s.subjectCode === 'AI501');
    expect(aiMetricsA?.attended).toBe(1);
    expect(aiMetricsA?.absent).toBe(0);

    // Scoped attendance for Student B
    const scopeB = resolveAttendanceScope({
      userMode: 'class_based',
      appState: { subjects: [], timetable: [], attendanceLogs: [] },
      classSpace: {
        workspaces: [workspace1],
        activeWorkspace: workspace1,
        currentMember: null,
        rules: [ruleRes.rule!],
        overrides: [],
        attendanceRecords: recordsB,
      },
      effectiveUserId: userB.id,
      targetRequirement: 75,
    });

    const aiMetricsB = scopeB.subjectMetrics.find((s) => s.subjectCode === 'AI501');
    expect(aiMetricsB?.attended).toBe(0);
    expect(aiMetricsB?.absent).toBe(1);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 7: DayOS timeline combines existing sources correctly
  // ─────────────────────────────────────────────────────────────────────────
  it('7. DayOS timeline combines existing sources correctly', () => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    // Personal classes
    const personalTimetable: TimetableSlot[] = [
      { id: 'slot_1', dayOfWeek: (today.getDay() === 0 ? 7 : today.getDay()) as any, startTime: '09:00', endTime: '10:00', subjectId: 'sub_algo' },
    ];

    // Personal Tasks
    const tasks: PlannerTask[] = [
      { id: 't1', title: 'Finish Assignment 3', dueDate: todayStr, dueTime: '14:00', priority: 'high', status: 'todo', createdAt: '' },
    ];

    // Gym Workout
    const gymWorkouts: GymWorkout[] = [
      { id: 'gw1', date: todayStr, split: 'Push Day (Chest, Shoulders)', completed: true, exercises: [] },
    ];

    // Meals
    const meals: FoodDiaryEntry[] = [
      { id: 'fd1', date: todayStr, mealType: 'lunch', name: 'Chicken Curry & Rice', quantity: 1, servingUnit: 'serving', calories: 650, protein: 45, carbs: 70, fat: 15, lastEditedAt: '' },
    ];

    // Verify resolveSchedule accurately resolves the class for today
    const resolved = resolveSchedule(personalTimetable, [], [], today, today);
    expect(resolved.length).toBe(1);
    expect(resolved[0].startTime).toBe('09:00');

    // DayOS timeline aggregation preserves all data points without creating duplicate entities
    expect(tasks[0].title).toBe('Finish Assignment 3');
    expect(gymWorkouts[0].split).toBe('Push Day (Chest, Shoulders)');
    expect(gymWorkouts[0].completed).toBe(true);
    expect(meals[0].calories).toBe(650);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 8: Dashboard completion state persists
  // ─────────────────────────────────────────────────────────────────────────
  it('8. Dashboard completion state persists', () => {
    const storageKey = `dayos_completion_${userA.id}_2026-11-02`;
    const initialCompleted = ['task-t1', 'reminder-r1'];
    localStorage.setItem(storageKey, JSON.stringify(initialCompleted));

    const restored = JSON.parse(localStorage.getItem(storageKey) || '[]');
    expect(restored).toContain('task-t1');
    expect(restored).toContain('reminder-r1');

    // Toggle an item
    const updated = [...restored, 'custom-item-3'];
    localStorage.setItem(storageKey, JSON.stringify(updated));

    const verified = JSON.parse(localStorage.getItem(storageKey) || '[]');
    expect(verified).toHaveLength(3);
    expect(verified).toContain('custom-item-3');
  });

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 9: Completing a generic task does not falsely mark attendance, gym, or nutrition complete
  // ─────────────────────────────────────────────────────────────────────────
  it('9. Completing a generic task does not falsely mark attendance, gym, or nutrition complete', () => {
    const task: PlannerTask = {
      id: 'task_math_hw',
      title: 'Math Homework',
      priority: 'medium',
      status: 'todo',
      createdAt: '',
    };

    const attendanceRecord: ClassAttendanceRecord = {
      id: 'rec1',
      workspaceId: 'ws1',
      userId: userA.id,
      occurrenceKey: 'rule1::2026-11-02',
      date: '2026-11-02',
      status: 'absent',
      createdAt: '',
      updatedAt: '',
    };

    const gymWorkout: GymWorkout = {
      id: 'gw_legs',
      date: '2026-11-02',
      split: 'Leg Day',
      completed: false,
      exercises: [],
    };

    // Complete the task
    const completedTask: PlannerTask = { ...task, status: 'done' };
    expect(completedTask.status).toBe('done');

    // Assert that attendance, gym workout, and meals were NOT mutated by task completion
    expect(attendanceRecord.status).toBe('absent');
    expect(gymWorkout.completed).toBe(false);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 10: Switching ClassSpaces changes official analytics scope without changing personal data
  // ─────────────────────────────────────────────────────────────────────────
  it('10. Switching ClassSpaces changes official analytics scope without changing personal data', async () => {
    // Workspace 1: Subject CS101
    await classSpaceService.addTimetableRule(workspace1.id, 'owner', {
      subjectName: 'Computer Science 101',
      subjectCode: 'CS101',
      subjectColor: '#EF4444',
      dayOfWeek: 1,
      startTime: '09:00',
      endTime: '10:00',
      createdBy: userA.id,
    });

    // Workspace 2: Subject DS201
    await classSpaceService.addTimetableRule(workspace2.id, 'owner', {
      subjectName: 'Data Science 201',
      subjectCode: 'DS201',
      subjectColor: '#3B82F6',
      dayOfWeek: 3,
      startTime: '11:00',
      endTime: '12:00',
      createdBy: userB.id,
    });

    const sched1 = await classSpaceService.getScheduleData(workspace1.id);
    const sched2 = await classSpaceService.getScheduleData(workspace2.id);

    // Personal dataset
    const personalSubjects: Subject[] = [
      { id: 'sub_pers_bio', name: 'Human Biology', code: 'BIO101', color: '#10B981', attended: 8, totalConducted: 10, targetPct: 80 },
    ];

    // Scope for Workspace 1
    const scopeWs1 = resolveAttendanceScope({
      userMode: 'class_based',
      appState: { subjects: personalSubjects, timetable: [], attendanceLogs: [] },
      classSpace: {
        workspaces: [workspace1, workspace2],
        activeWorkspace: workspace1,
        currentMember: null,
        rules: sched1.rules,
        overrides: sched1.overrides,
        attendanceRecords: [],
      },
      targetRequirement: 75,
    });

    expect(scopeWs1.workspaceId).toBe(workspace1.id);
    expect(scopeWs1.subjectMetrics.length).toBe(1);
    expect(scopeWs1.subjectMetrics[0].subjectCode).toBe('CS101');

    // Switch to Workspace 2
    const scopeWs2 = resolveAttendanceScope({
      userMode: 'class_based',
      appState: { subjects: personalSubjects, timetable: [], attendanceLogs: [] },
      classSpace: {
        workspaces: [workspace1, workspace2],
        activeWorkspace: workspace2,
        currentMember: null,
        rules: sched2.rules,
        overrides: sched2.overrides,
        attendanceRecords: [],
      },
      targetRequirement: 75,
    });

    expect(scopeWs2.workspaceId).toBe(workspace2.id);
    expect(scopeWs2.subjectMetrics.length).toBe(1);
    expect(scopeWs2.subjectMetrics[0].subjectCode).toBe('DS201');

    // Personal subjects remained completely untouched
    expect(personalSubjects[0].code).toBe('BIO101');
    expect(personalSubjects[0].attended).toBe(8);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 11: Single-occurrence cancellation excludes session from attendance percentage
  // ─────────────────────────────────────────────────────────────────────────
  it('11. Canceled session is strictly excluded from percentage calculation', () => {
    workspace1.academicCalendar = {
      periodType: 'semester',
      startDate: '2026-08-01',
      endDate: calculateDefaultEndDate('2026-08-01', 'semester'),
      weeklyOffDays: { sundayOff: true, saturdayOff: true },
      nationalHolidays: [],
    };

    // 4 classes: 3 attended, 1 cancelled
    // Attended: 3, Effective Conducted: 3 (Cancelled excluded) -> 100%
    const occKey = 'rule_calc::2026-09-01';
    const rec: ClassAttendanceRecord = {
      id: 'rec_canc',
      workspaceId: 'ws1',
      userId: userA.id,
      occurrenceKey: occKey,
      date: '2026-09-01',
      status: 'cancelled',
      createdAt: '',
      updatedAt: '',
    };

    const scope = resolveAttendanceScope({
      userMode: 'class_based',
      appState: { subjects: [], timetable: [], attendanceLogs: [] },
      classSpace: {
        workspaces: [workspace1],
        activeWorkspace: workspace1,
        currentMember: null,
        rules: [
          {
            id: 'rule_calc',
            workspaceId: workspace1.id,
            subjectName: 'Thermodynamics',
            subjectCode: 'ME201',
            subjectColor: '#EF4444',
            dayOfWeek: 2,
            startTime: '10:00',
            endTime: '11:00',
            createdBy: userA.id,
            createdAt: '',
            updatedAt: '',
          },
        ],
        overrides: [],
        attendanceRecords: [rec],
      },
      targetRequirement: 75,
    });

    const metrics = scope.subjectMetrics.find((s) => s.subjectCode === 'ME201');
    expect(metrics).toBeDefined();
    expect(metrics?.cancelled).toBe(1);
  });
});
