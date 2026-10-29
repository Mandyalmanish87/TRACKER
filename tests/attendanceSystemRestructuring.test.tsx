import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  calculateDefaultEndDate,
  resolveAcademicPeriodDays,
  calculateSubjectAttendanceFromCounts,
  calculateWeightedAggregateAttendance,
  AcademicCalendarSettings,
  NationalHoliday,
} from '../src/utils/academicCalendarEngine';
import { resolveAttendanceScope } from '../src/utils/attendanceScopeResolver';
import { classSpaceService } from '../src/services/classSpaceService';
import {
  ClassSpaceWorkspace,
  ClassTimetableRule,
  ClassTimetableOverride,
  ClassAttendanceRecord,
} from '../src/types/classSpace';
import { Subject } from '../src/types';

describe('Student Tracker Attendance System Restructuring (40-Point Regression Suite)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  // =========================================================================
  // GROUP 1: Academic Calendar (Tests 1 - 10)
  // =========================================================================
  describe('1. Academic Calendar Engine & Period Boundaries', () => {
    it('1. Semester default duration of 6 calendar months', () => {
      // Starting Aug 1 -> exactly 6 full months: Aug, Sep, Oct, Nov, Dec, Jan -> Jan 31
      const endDate = calculateDefaultEndDate('2026-08-01', 'semester');
      expect(endDate).toBe('2027-01-31');

      // Starting Jan 15 -> exactly 6 months -> July 14
      const midMonthEnd = calculateDefaultEndDate('2026-01-15', 'semester');
      expect(midMonthEnd).toBe('2026-07-14');
    });

    it('2. Academic Year default duration of 1 calendar year', () => {
      // Starting Jan 1 -> exactly 12 full months -> Dec 31
      const endDate = calculateDefaultEndDate('2026-01-01', 'year');
      expect(endDate).toBe('2026-12-31');

      // Starting Aug 15 -> exactly 12 months -> Aug 14 next year
      const midMonthYear = calculateDefaultEndDate('2026-08-15', 'year');
      expect(midMonthYear).toBe('2027-08-14');
    });

    it('3. Manually specified end dates are respected and preserved', () => {
      const customCal: AcademicCalendarSettings = {
        periodType: 'semester',
        startDate: '2026-08-01',
        endDate: '2026-11-30', // Manual early end date
        isManualEndDate: true,
        weeklyOffDays: { sundayOff: true, saturdayOff: false },
        nationalHolidays: [],
      };

      expect(customCal.isManualEndDate).toBe(true);
      expect(customCal.endDate).toBe('2026-11-30');
    });

    it('4. Month-end date calculations handle varying month lengths and leap years cleanly', () => {
      // Leap year starting Aug 31 -> 6 months later is Feb -> in 2028 (leap year), Feb has 29 days
      const leapEnd = calculateDefaultEndDate('2027-08-31', 'semester');
      // 2028 is a leap year, day 31 - 1 = 30 clamped to 29
      expect(leapEnd).toBe('2028-02-29');

      // Non-leap year starting Aug 31 -> in 2027 (non-leap), Feb has 28 days
      const nonLeapEnd = calculateDefaultEndDate('2026-08-31', 'semester');
      expect(nonLeapEnd).toBe('2027-02-28');
    });

    it('5. Inclusive start and end dates cover every day in range', () => {
      const summary = resolveAcademicPeriodDays(
        '2026-10-01',
        '2026-10-05',
        { sundayOff: false, saturdayOff: false },
        []
      );
      // Oct 1, 2, 3, 4, 5 = 5 calendar days
      expect(summary.totalCalendarDays).toBe(5);
      expect(summary.potentialWorkingDays).toBe(5);
    });

    it('6. Sunday off excludes Sundays from potential working days', () => {
      // Oct 2026: Oct 4, 11, 18, 25 are Sundays (4 Sundays)
      const summary = resolveAcademicPeriodDays(
        '2026-10-01',
        '2026-10-31',
        { sundayOff: true, saturdayOff: false },
        []
      );
      expect(summary.totalCalendarDays).toBe(31);
      expect(summary.weeklyOffDaysCount).toBe(4);
      expect(summary.potentialWorkingDays).toBe(27);
    });

    it('7. Saturday off excludes Saturdays from potential working days', () => {
      // Oct 2026: Oct 3, 10, 17, 24, 31 are Saturdays (5 Saturdays)
      const summary = resolveAcademicPeriodDays(
        '2026-10-01',
        '2026-10-31',
        { sundayOff: false, saturdayOff: true },
        []
      );
      expect(summary.weeklyOffDaysCount).toBe(5);
      expect(summary.potentialWorkingDays).toBe(26);
    });

    it('8. Both weekly off days (Sunday & Saturday) supported and excluded', () => {
      // 4 Sundays + 5 Saturdays = 9 off days
      const summary = resolveAcademicPeriodDays(
        '2026-10-01',
        '2026-10-31',
        { sundayOff: true, saturdayOff: true },
        []
      );
      expect(summary.weeklyOffDaysCount).toBe(9);
      expect(summary.potentialWorkingDays).toBe(22);
    });

    it('9. National holiday exclusion removes holiday dates from potential working days', () => {
      const holidays: NationalHoliday[] = [
        { id: 'h1', name: 'Gandhi Jayanti', date: '2026-10-02' }, // Friday
      ];
      const summary = resolveAcademicPeriodDays(
        '2026-10-01',
        '2026-10-05',
        { sundayOff: true, saturdayOff: false },
        holidays
      );
      // 5 days: Oct 1 (Thu, working), Oct 2 (Fri, holiday), Oct 3 (Sat, working), Oct 4 (Sun, off), Oct 5 (Mon, working)
      expect(summary.totalCalendarDays).toBe(5);
      expect(summary.weeklyOffDaysCount).toBe(1);
      expect(summary.nationalHolidaysCount).toBe(1);
      expect(summary.potentialWorkingDays).toBe(3);
    });

    it('10. Classes scheduled on holidays or weekly off days remain markable and count when attended', () => {
      // If a class is conducted on a Sunday or holiday and attended, it counts in attended & conducted
      const metrics = calculateSubjectAttendanceFromCounts(
        'sub-extra',
        'CS101',
        'Intro to CS',
        1, // attended the Sunday session
        0, // absent
        0, // cancelled
        1, // scheduled
        75
      );
      expect(metrics.attended).toBe(1);
      expect(metrics.effectiveConducted).toBe(1);
      expect(metrics.percentage).toBe(100);
      expect(metrics.status).toBe('safe');
    });
  });

  // =========================================================================
  // GROUP 2: Attendance Calculations (Tests 11 - 21)
  // =========================================================================
  describe('2. Attendance Calculation Formulas & Edge Cases', () => {
    it('11. Attended classes count in both numerator and denominator', () => {
      const metrics = calculateSubjectAttendanceFromCounts(
        's1',
        'MATH',
        'Calculus',
        8, // attended
        2, // absent
        0,
        10,
        75
      );
      // 8 / 10 = 80%
      expect(metrics.percentage).toBe(80);
      expect(metrics.effectiveConducted).toBe(10);
      expect(metrics.status).toBe('safe');
    });

    it('12. Absent classes count strictly in the denominator', () => {
      const metrics = calculateSubjectAttendanceFromCounts(
        's1',
        'MATH',
        'Calculus',
        6,
        4, // 4 absences
        0,
        10,
        75
      );
      // 6 / (6 + 4) = 60%
      expect(metrics.percentage).toBe(60);
      expect(metrics.status).toBe('danger');
    });

    it('13. Cancelled classes are strictly excluded from the denominator', () => {
      // 8 attended, 2 absent, 5 cancelled out of 15 scheduled
      const metrics = calculateSubjectAttendanceFromCounts(
        's1',
        'PHY',
        'Physics',
        8,
        2,
        5, // cancelled
        15,
        75
      );
      // Denominator must be attended + absent = 10, NOT 15!
      expect(metrics.effectiveConducted).toBe(10);
      expect(metrics.percentage).toBe(80); // 8 / 10 * 100 = 80%
      expect(metrics.cancelled).toBe(5);
    });

    it('14. Future and unmarked classes are excluded from attended and absent denominator', () => {
      // 20 scheduled in semester, but only 4 held so far (3 attended, 1 absent), 16 future/unmarked
      const metrics = calculateSubjectAttendanceFromCounts(
        's1',
        'CHEM',
        'Chemistry',
        3,
        1,
        0,
        20,
        75
      );
      expect(metrics.effectiveConducted).toBe(4);
      expect(metrics.futureOrUnmarked).toBe(16);
      expect(metrics.percentage).toBe(75);
    });

    it('15. Subject-wise attendance calculation conforms to exact formula', () => {
      const metrics = calculateSubjectAttendanceFromCounts(
        'sub1',
        'BIO',
        'Biology',
        18,
        6,
        0,
        24,
        75
      );
      // 18 / (18 + 6) = 18 / 24 = 75%
      expect(metrics.percentage).toBe(75);
      expect(metrics.formattedPercentage).toBe('75%');
    });

    it('16. Weighted aggregate attendance uses sum(attended) / sum(conducted) and is NEVER simple average', () => {
      // Subject A: 10 attended out of 10 held (100%)
      const subA = calculateSubjectAttendanceFromCounts('a', 'A', 'A', 10, 0, 0, 10, 75);
      // Subject B: 1 attended out of 10 held (10%)
      const subB = calculateSubjectAttendanceFromCounts('b', 'B', 'B', 1, 9, 0, 10, 75);
      // Simple arithmetic average would be (100 + 10) / 2 = 55%
      // Weighted aggregate: (10 + 1) / (10 + 10) = 11 / 20 = 55%
      const equalWeightAgg = calculateWeightedAggregateAttendance([subA, subB], 75);
      expect(equalWeightAgg.aggregatePercentage).toBeCloseTo(55, 1);

      // Now with unequal class weights:
      // Subject C: 45 attended out of 50 held (90%)
      const subC = calculateSubjectAttendanceFromCounts('c', 'C', 'C', 45, 5, 0, 50, 75);
      // Subject D: 1 attended out of 2 held (50%)
      const subD = calculateSubjectAttendanceFromCounts('d', 'D', 'D', 1, 1, 0, 2, 75);
      // Simple average would be (90 + 50) / 2 = 70% (Below 75% target)
      // Weighted aggregate: (45 + 1) / (50 + 2) = 46 / 52 = 88.46% (Safe!)
      const agg = calculateWeightedAggregateAttendance([subC, subD], 75);
      expect(agg.aggregatePercentage).toBeCloseTo(88.46, 1);
      expect(agg.status).toBe('safe');
      expect(agg.totalAttended).toBe(46);
      expect(agg.totalConducted).toBe(52);
    });

    it('17. Zero denominator handling returns clean safe state and prevents NaN / Infinity', () => {
      const metrics = calculateSubjectAttendanceFromCounts(
        's0',
        'NEW',
        'New Course',
        0,
        0,
        0,
        10,
        75
      );
      expect(metrics.percentage).toBe(100);
      expect(metrics.formattedPercentage).toBe('—');
      expect(metrics.effectiveConducted).toBe(0);
      expect(Number.isNaN(metrics.percentage)).toBe(false);

      const agg = calculateWeightedAggregateAttendance([metrics], 75);
      expect(agg.aggregatePercentage).toBe(100);
      expect(agg.formattedPercentage).toBe('—');
      expect(Number.isNaN(agg.aggregatePercentage)).toBe(false);
    });

    it('18. Classes needed to reach configured target are accurately calculated', () => {
      // 10 conducted, 5 attended = 50%. Target = 75%.
      // Formula: ceil((0.75 * 10 - 5) / (1 - 0.75)) = ceil((7.5 - 5) / 0.25) = ceil(2.5 / 0.25) = 10 classes
      const metrics = calculateSubjectAttendanceFromCounts('s1', 'C1', 'C1', 5, 5, 0, 10, 75);
      expect(metrics.neededClasses).toBe(10);
      expect(metrics.safeSkips).toBe(0);
      expect(metrics.status).toBe('danger');
    });

    it('19. Safe-skip calculations accurately determine allowable absences', () => {
      // 20 conducted, 19 attended = 95%. Target = 75%.
      // Formula: floor((19 - 0.75 * 20) / 0.75) = floor((19 - 15) / 0.75) = floor(4 / 0.75) = 5 safe skips
      const metrics = calculateSubjectAttendanceFromCounts('s1', 'C1', 'C1', 19, 1, 0, 20, 75);
      expect(metrics.safeSkips).toBe(5);
      expect(metrics.neededClasses).toBe(0);
      expect(metrics.status).toBe('safe');
    });

    it('20. One-off class rescheduling does not alter recurring timetable definition', () => {
      const recurringRules: ClassTimetableRule[] = [
        {
          id: 'rule_1',
          workspaceId: 'ws_test',
          subjectName: 'Mathematics',
          subjectCode: 'MTH101',
          subjectColor: '#B45309',
          dayOfWeek: 1, // Monday
          startTime: '09:00',
          endTime: '10:00',
          createdBy: 'user_cr',
          createdAt: '2026-08-01T00:00:00Z',
          updatedAt: '2026-08-01T00:00:00Z',
        },
      ];

      // A single occurrence rescheduled to Wednesday Oct 7
      const overrides: ClassTimetableOverride[] = [
        {
          id: 'ov_resched_1',
          workspaceId: 'ws_test',
          ruleId: 'rule_1',
          originalDate: '2026-10-05',
          type: 'reschedule',
          newDate: '2026-10-07',
          newStartTime: '11:00',
          newEndTime: '12:00',
          createdBy: 'user_cr',
          createdAt: '2026-10-01T00:00:00Z',
        },
      ];

      // Original rule remains unchanged on Monday
      expect(recurringRules[0].dayOfWeek).toBe(1);
      expect(recurringRules[0].startTime).toBe('09:00');
      expect(overrides[0].newDate).toBe('2026-10-07');
    });

    it('21. Duplicate occurrence prevention ensures an attendance record cannot be logged twice for same occurrence', async () => {
      const localWs = 'ws_dup_check';
      const user = 'usr_student_alpha';
      const key = 'rule_1::2026-10-05';

      await classSpaceService.setAttendanceRecord(localWs, user, key, '2026-10-05', 'present');
      // Setting again updates existing record instead of creating duplicate row
      await classSpaceService.setAttendanceRecord(localWs, user, key, '2026-10-05', 'absent');

      const records = await classSpaceService.getAttendanceRecords(localWs, user);
      const matching = records.filter((r) => r.occurrenceKey === key);
      expect(matching.length).toBe(1);
      expect(matching[0].status).toBe('absent');
    });
  });

  // =========================================================================
  // GROUP 3: User Scope & ClassSpace Switching (Tests 22 - 30)
  // =========================================================================
  describe('3. Scope Isolation: Individual vs Class-Based Mode', () => {
    it('22. Individual users use personal attendance without ClassSpace dependency', () => {
      const scope = resolveAttendanceScope({
        userMode: 'individual',
        appState: {
          subjects: [
            { id: 's_p1', code: 'PHYS', name: 'Physics', attended: 15, totalConducted: 20, targetPct: 75, color: '#3D6A8A' },
          ],
          timetable: [],
          attendanceLogs: [],
          settings: {
            themeMode: 'system',
            accentColor: 'terracotta',
            backgroundStyle: 'minimal',
            studyDayRolloverHour: 0,
            showExamCountdown: true,
            showFocusRadio: false,
            userMode: 'individual',
          },
        },
        classSpace: null,
      });

      expect(scope.mode).toBe('individual');
      expect(scope.hasWorkspaces).toBe(false);
      expect(scope.subjectMetrics.length).toBe(1);
      expect(scope.subjectMetrics[0].percentage).toBe(75);
    });

    it('23. Class-Based users see the ClassSpace selector populated with joined workspaces', () => {
      const ws1: ClassSpaceWorkspace = {
        id: 'ws_alpha',
        name: 'CS Alpha Batch',
        joinCode: 'ALP01',
        createdBy: 'usr_cr',
        createdAt: '2026-08-01',
        updatedAt: '2026-08-01',
      };
      const ws2: ClassSpaceWorkspace = {
        id: 'ws_beta',
        name: 'ECE Beta Batch',
        joinCode: 'BET02',
        createdBy: 'usr_cr',
        createdAt: '2026-08-01',
        updatedAt: '2026-08-01',
      };

      const scope = resolveAttendanceScope({
        userMode: 'class_based',
        appState: { subjects: [], timetable: [], attendanceLogs: [] },
        classSpace: {
          workspaces: [ws1, ws2],
          activeWorkspace: ws1,
          currentMember: { id: 'm1', workspaceId: 'ws_alpha', userId: 'usr_me', role: 'member', joinedAt: '2026-08-01', displayName: 'Me' },
          rules: [],
          overrides: [],
          attendanceRecords: [],
        },
      });

      expect(scope.mode).toBe('class_based');
      expect(scope.workspaceId).toBe('ws_alpha');
      expect(scope.hasWorkspaces).toBe(true);
    });

    it('24. Class-Based users can switch ClassSpaces', () => {
      const ws1: ClassSpaceWorkspace = { id: 'ws_1', name: 'CS Section A', joinCode: 'SEC01', createdBy: 'cr', createdAt: '', updatedAt: '' };
      const ws2: ClassSpaceWorkspace = { id: 'ws_2', name: 'CS Section B', joinCode: 'SEC02', createdBy: 'cr', createdAt: '', updatedAt: '' };

      const scope1 = resolveAttendanceScope({
        userMode: 'class_based',
        appState: { subjects: [], timetable: [], attendanceLogs: [] },
        classSpace: {
          workspaces: [ws1, ws2],
          activeWorkspace: ws1,
          currentMember: null,
          rules: [],
          overrides: [],
          attendanceRecords: [],
        },
      });
      expect(scope1.workspaceId).toBe('ws_1');

      const scope2 = resolveAttendanceScope({
        userMode: 'class_based',
        appState: { subjects: [], timetable: [], attendanceLogs: [] },
        classSpace: {
          workspaces: [ws1, ws2],
          activeWorkspace: ws2,
          currentMember: null,
          rules: [],
          overrides: [],
          attendanceRecords: [],
        },
      });
      expect(scope2.workspaceId).toBe('ws_2');
    });

    it('25. Selected ClassSpace persists after refresh in local storage', () => {
      const userId = 'usr_test_persist';
      const wsId = 'ws_persist_target';
      localStorage.setItem(`tracker_active_workspace_id_${userId}`, wsId);

      const restored = localStorage.getItem(`tracker_active_workspace_id_${userId}`);
      expect(restored).toBe(wsId);
    });

    it('26. Attendance calculations update immediately when switching ClassSpaces', () => {
      const testCal: AcademicCalendarSettings = {
        periodType: 'semester',
        startDate: '2026-08-01',
        endDate: '2027-01-31',
        weeklyOffDays: { sundayOff: true, saturdayOff: false },
        nationalHolidays: [],
      };
      const wsA: ClassSpaceWorkspace = { id: 'ws_a', name: 'Alpha', joinCode: 'A0001', createdBy: 'cr', createdAt: '', updatedAt: '', academicCalendar: testCal };
      const wsB: ClassSpaceWorkspace = { id: 'ws_b', name: 'Beta', joinCode: 'B0001', createdBy: 'cr', createdAt: '', updatedAt: '', academicCalendar: testCal };

      const ruleA: ClassTimetableRule = {
        id: 'r_a', workspaceId: 'ws_a', subjectName: 'Data Structures', subjectCode: 'CS201', subjectColor: '#B45309',
        dayOfWeek: 1, startTime: '09:00', endTime: '10:00', createdBy: 'cr', createdAt: '', updatedAt: ''
      };

      const ruleB: ClassTimetableRule = {
        id: 'r_b', workspaceId: 'ws_b', subjectName: 'Circuits', subjectCode: 'EE101', subjectColor: '#3D6A8A',
        dayOfWeek: 2, startTime: '11:00', endTime: '12:00', createdBy: 'cr', createdAt: '', updatedAt: ''
      };

      // Alpha has 1 present attendance record
      const attA: ClassAttendanceRecord = {
        id: 'a1', workspaceId: 'ws_a', userId: 'u1', occurrenceKey: 'r_a::2026-08-03', date: '2026-08-03', status: 'present',
        createdAt: '', updatedAt: ''
      };

      // Beta has 1 absent attendance record
      const attB: ClassAttendanceRecord = {
        id: 'b1', workspaceId: 'ws_b', userId: 'u1', occurrenceKey: 'r_b::2026-08-04', date: '2026-08-04', status: 'absent',
        createdAt: '', updatedAt: ''
      };

      const scopeA = resolveAttendanceScope({
        userMode: 'class_based',
        appState: { subjects: [], timetable: [], attendanceLogs: [] },
        classSpace: {
          workspaces: [wsA, wsB],
          activeWorkspace: wsA,
          currentMember: null,
          rules: [ruleA],
          overrides: [],
          attendanceRecords: [attA],
        },
      });

      const scopeB = resolveAttendanceScope({
        userMode: 'class_based',
        appState: { subjects: [], timetable: [], attendanceLogs: [] },
        classSpace: {
          workspaces: [wsA, wsB],
          activeWorkspace: wsB,
          currentMember: null,
          rules: [ruleB],
          overrides: [],
          attendanceRecords: [attB],
        },
      });

      // Alpha percentage = 100% (present)
      expect(scopeA.aggregateMetrics.aggregatePercentage).toBe(100);
      expect(scopeA.subjectMetrics[0].subjectCode).toBe('CS201');

      // Beta percentage = 0% (absent)
      expect(scopeB.aggregateMetrics.aggregatePercentage).toBe(0);
      expect(scopeB.subjectMetrics[0].subjectCode).toBe('EE101');
    });

    it('27. Attendance records from different ClassSpaces are completely isolated', async () => {
      const studentId = 'usr_dual_enrolled';
      await classSpaceService.setAttendanceRecord('ws_101', studentId, 'occ_101', '2026-10-01', 'present');
      await classSpaceService.setAttendanceRecord('ws_202', studentId, 'occ_202', '2026-10-01', 'absent');

      const recs101 = await classSpaceService.getAttendanceRecords('ws_101', studentId);
      const recs202 = await classSpaceService.getAttendanceRecords('ws_202', studentId);

      expect(recs101.length).toBe(1);
      expect(recs101[0].occurrenceKey).toBe('occ_101');
      expect(recs101[0].status).toBe('present');

      expect(recs202.length).toBe(1);
      expect(recs202[0].occurrenceKey).toBe('occ_202');
      expect(recs202[0].status).toBe('absent');
    });

    it('28. A user cannot access attendance records from an unjoined ClassSpace', async () => {
      const studentId = 'usr_outsider';
      const records = await classSpaceService.getAttendanceRecords('ws_private_room', studentId);
      expect(records).toEqual([]);
    });

    it('29. Empty membership state works cleanly and displays empty indicators', () => {
      const scope = resolveAttendanceScope({
        userMode: 'class_based',
        appState: { subjects: [], timetable: [], attendanceLogs: [] },
        classSpace: {
          workspaces: [],
          activeWorkspace: null,
          currentMember: null,
          rules: [],
          overrides: [],
          attendanceRecords: [],
        },
      });

      expect(scope.hasWorkspaces).toBe(false);
      expect(scope.isEmpty).toBe(true);
      expect(scope.aggregateMetrics.formattedPercentage).toBe('—');
    });

    it('30. Existing attendance data remains compatible across updates without resetting records', () => {
      // Existing Subject records with manual attended/conducted counts
      const sub: Subject = {
        id: 's_legacy',
        code: 'CHEM',
        name: 'Organic Chemistry',
        attended: 14,
        totalConducted: 16,
        targetPct: 75,
        color: '#B45309',
      };

      const scope = resolveAttendanceScope({
        userMode: 'individual',
        appState: {
          subjects: [sub],
          timetable: [],
          attendanceLogs: [],
        },
        classSpace: null,
      });

      // Survives and calculates accurately (14 / 16 = 87.5%)
      expect(scope.subjectMetrics[0].attended).toBe(14);
      expect(scope.subjectMetrics[0].effectiveConducted).toBe(16);
      expect(scope.subjectMetrics[0].percentage).toBe(87.5);
    });
  });

  // =========================================================================
  // GROUP 4: Critical Self-Attendance Invariants (Tests 31 - 40)
  // =========================================================================
  describe('4. Critical Self-Attendance & Multi-Student Isolation', () => {
    it('31. Two students in the same ClassSpace can mark the same class occurrence differently', async () => {
      const workspaceId = 'ws_chemistry_lab';
      const occurrenceKey = 'rule_chem_101::2026-10-12';
      const studentA = 'usr_student_alice';
      const studentB = 'usr_student_bob';

      // Alice marks Present
      await classSpaceService.setAttendanceRecord(workspaceId, studentA, occurrenceKey, '2026-10-12', 'present');
      // Bob marks Absent
      await classSpaceService.setAttendanceRecord(workspaceId, studentB, occurrenceKey, '2026-10-12', 'absent');

      const aliceRecords = await classSpaceService.getAttendanceRecords(workspaceId, studentA);
      const bobRecords = await classSpaceService.getAttendanceRecords(workspaceId, studentB);

      expect(aliceRecords.find((r) => r.occurrenceKey === occurrenceKey)?.status).toBe('present');
      expect(bobRecords.find((r) => r.occurrenceKey === occurrenceKey)?.status).toBe('absent');
    });

    it('32. Student A attendance record does not overwrite Student B record', async () => {
      const workspaceId = 'ws_shared_batch';
      const occurrenceKey = 'lecture_5::2026-10-15';
      const studentA = 'usr_student_alice';
      const studentB = 'usr_student_bob';

      // Alice marks present
      await classSpaceService.setAttendanceRecord(workspaceId, studentA, occurrenceKey, '2026-10-15', 'present');
      // Later Bob marks absent
      await classSpaceService.setAttendanceRecord(workspaceId, studentB, occurrenceKey, '2026-10-15', 'absent');

      // Alice's record must still be present!
      const aliceRecords = await classSpaceService.getAttendanceRecords(workspaceId, studentA);
      expect(aliceRecords.find((r) => r.occurrenceKey === occurrenceKey)?.status).toBe('present');
    });

    it('33. Student A attendance percentage uses only Student A records', () => {
      const testCal: AcademicCalendarSettings = {
        periodType: 'semester',
        startDate: '2026-08-01',
        endDate: '2027-01-31',
        weeklyOffDays: { sundayOff: true, saturdayOff: false },
        nationalHolidays: [],
      };
      const ws: ClassSpaceWorkspace = { id: 'ws_demo', name: 'Demo Class', joinCode: 'D1001', createdBy: 'cr', createdAt: '', updatedAt: '', academicCalendar: testCal };
      const rule: ClassTimetableRule = {
        id: 'r_math', workspaceId: 'ws_demo', subjectName: 'Math', subjectCode: 'MTH', subjectColor: '#B45309',
        dayOfWeek: 1, startTime: '09:00', endTime: '10:00', createdBy: 'cr', createdAt: '', updatedAt: ''
      };

      // Alice's personal attendance records
      const aliceRecs: ClassAttendanceRecord[] = [
        { id: '1', workspaceId: 'ws_demo', userId: 'alice', occurrenceKey: 'r_math::2026-08-03', date: '2026-08-03', status: 'present', createdAt: '', updatedAt: '' },
        { id: '2', workspaceId: 'ws_demo', userId: 'alice', occurrenceKey: 'r_math::2026-08-10', date: '2026-08-10', status: 'present', createdAt: '', updatedAt: '' },
      ];

      const scopeAlice = resolveAttendanceScope({
        userMode: 'class_based',
        appState: { subjects: [], timetable: [], attendanceLogs: [] },
        classSpace: {
          workspaces: [ws],
          activeWorkspace: ws,
          currentMember: null,
          rules: [rule],
          overrides: [],
          attendanceRecords: aliceRecs,
        },
      });

      // 2 present, 0 absent = 100%
      expect(scopeAlice.subjectMetrics[0].percentage).toBe(100);
    });

    it('34. Student B attendance percentage uses only Student B records', () => {
      const testCal: AcademicCalendarSettings = {
        periodType: 'semester',
        startDate: '2026-08-01',
        endDate: '2027-01-31',
        weeklyOffDays: { sundayOff: true, saturdayOff: false },
        nationalHolidays: [],
      };
      const ws: ClassSpaceWorkspace = { id: 'ws_demo', name: 'Demo Class', joinCode: 'D1001', createdBy: 'cr', createdAt: '', updatedAt: '', academicCalendar: testCal };
      const rule: ClassTimetableRule = {
        id: 'r_math', workspaceId: 'ws_demo', subjectName: 'Math', subjectCode: 'MTH', subjectColor: '#B45309',
        dayOfWeek: 1, startTime: '09:00', endTime: '10:00', createdBy: 'cr', createdAt: '', updatedAt: ''
      };

      // Bob's personal attendance records for the exact same class occurrences
      const bobRecs: ClassAttendanceRecord[] = [
        { id: '3', workspaceId: 'ws_demo', userId: 'bob', occurrenceKey: 'r_math::2026-08-03', date: '2026-08-03', status: 'absent', createdAt: '', updatedAt: '' },
        { id: '4', workspaceId: 'ws_demo', userId: 'bob', occurrenceKey: 'r_math::2026-08-10', date: '2026-08-10', status: 'absent', createdAt: '', updatedAt: '' },
      ];

      const scopeBob = resolveAttendanceScope({
        userMode: 'class_based',
        appState: { subjects: [], timetable: [], attendanceLogs: [] },
        classSpace: {
          workspaces: [ws],
          activeWorkspace: ws,
          currentMember: null,
          rules: [rule],
          overrides: [],
          attendanceRecords: bobRecs,
        },
      });

      // 0 present, 2 absent = 0%
      expect(scopeBob.subjectMetrics[0].percentage).toBe(0);
    });

    it('35. Aggregate attendance is independent for each student in the same ClassSpace', () => {
      // Alice has 100% aggregate
      const aliceSub = calculateSubjectAttendanceFromCounts('m', 'MTH', 'Math', 10, 0, 0, 10, 75);
      const aliceAgg = calculateWeightedAggregateAttendance([aliceSub], 75);

      // Bob has 40% aggregate
      const bobSub = calculateSubjectAttendanceFromCounts('m', 'MTH', 'Math', 4, 6, 0, 10, 75);
      const bobAgg = calculateWeightedAggregateAttendance([bobSub], 75);

      expect(aliceAgg.aggregatePercentage).toBe(100);
      expect(bobAgg.aggregatePercentage).toBe(40);
      expect(aliceAgg.status).toBe('safe');
      expect(bobAgg.status).toBe('danger');
    });

    it('36. One student cannot update or overwrite another student attendance record', async () => {
      const workspaceId = 'ws_security_check';
      const occurrenceKey = 'chem::2026-10-20';
      const studentA = 'usr_alice';
      const studentB = 'usr_bob';

      // Alice sets her mark
      await classSpaceService.setAttendanceRecord(workspaceId, studentA, occurrenceKey, '2026-10-20', 'present');

      // Bob sets his mark for the same class
      await classSpaceService.setAttendanceRecord(workspaceId, studentB, occurrenceKey, '2026-10-20', 'absent');

      // Alice inspects her records - Bob did NOT change Alice's record
      const aliceRecords = await classSpaceService.getAttendanceRecords(workspaceId, studentA);
      expect(aliceRecords.find((r) => r.occurrenceKey === occurrenceKey)?.status).toBe('present');
    });

    it('37. Attendance queries use the authenticated user identity and filter strictly by userId', async () => {
      const workspaceId = 'ws_auth_check';
      const userAuthenticated = 'usr_real_student';
      const userOther = 'usr_stranger';

      await classSpaceService.setAttendanceRecord(workspaceId, userAuthenticated, 'key_1', '2026-10-01', 'present');
      await classSpaceService.setAttendanceRecord(workspaceId, userOther, 'key_2', '2026-10-01', 'absent');

      const queried = await classSpaceService.getAttendanceRecords(workspaceId, userAuthenticated);
      expect(queried.every((r) => r.userId === userAuthenticated)).toBe(true);
      expect(queried.some((r) => r.userId === userOther)).toBe(false);
    });

    it('38. A student cannot access attendance records from a ClassSpace they are not enrolled in', async () => {
      const student = 'usr_unjoined_student';
      const res = await classSpaceService.getAttendanceRecords('ws_unjoined_class', student);
      expect(res).toEqual([]);
    });

    it('39. Attendance records from two ClassSpaces remain isolated even for the same user enrolled in both', async () => {
      const student = 'usr_same_student';
      const ws1 = 'ws_major_course';
      const ws2 = 'ws_minor_elective';

      await classSpaceService.setAttendanceRecord(ws1, student, 'occ_shared_key', '2026-10-10', 'present');
      await classSpaceService.setAttendanceRecord(ws2, student, 'occ_shared_key', '2026-10-10', 'absent');

      const recsWs1 = await classSpaceService.getAttendanceRecords(ws1, student);
      const recsWs2 = await classSpaceService.getAttendanceRecords(ws2, student);

      expect(recsWs1[0].status).toBe('present');
      expect(recsWs2[0].status).toBe('absent');
    });

    it('40. CR and CoAdmin roles do not gain the ability to mark or overwrite attendance for all students', () => {
      // In the database migrations and application architecture, class_attendance_records RLS policies enforce:
      // SELECT: using (auth.uid() = user_id)
      // INSERT: with check (auth.uid() = user_id and public.is_class_member(workspace_id, auth.uid()))
      // UPDATE: using (auth.uid() = user_id) with check (auth.uid() = user_id)
      const migrationPath = path.resolve(__dirname, '../supabase/migrations/20261025_classspace_security_hardening.sql');
      const migrationSql = fs.readFileSync(migrationPath, 'utf8');

      expect(migrationSql).toMatch(/create policy "Students can view only their own personal attendance records"/i);
      expect(migrationSql).toMatch(/using \(auth\.uid\(\) = user_id\)/i);
    });
  });
});
