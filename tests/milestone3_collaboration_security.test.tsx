import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  classSpaceService,
  resetLookupRateLimiter,
  isLookupRateLimited,
} from '../src/services/classSpaceService';
import {
  isValidJoinCode,
  canManageSchedule,
  resolveClassSchedule,
} from '../src/utils/classSpaceUtils';
import { authService, AuthUser } from '../src/services/authService';
import { ClassTimetableRule, ClassSpaceRole } from '../src/types/classSpace';

describe('Milestone 03 — ClassSpace Collaboration & Security Suite', () => {
  const mockOwnerUser: AuthUser = {
    id: 'usr_owner_001',
    email: 'owner@college.edu',
    name: 'Classspace Creator',
    isSimulated: false,
  };

  const mockCrUser: AuthUser = {
    id: 'usr_cr_002',
    email: 'cr@college.edu',
    name: 'Class Representative',
    isSimulated: false,
  };

  const mockCoAdminUser: AuthUser = {
    id: 'usr_coadmin_003',
    email: 'coadmin@college.edu',
    name: 'Assistant CR',
    isSimulated: false,
  };

  const mockStudentUser: AuthUser = {
    id: 'usr_student_004',
    email: 'student@college.edu',
    name: 'Enrolled Student',
    isSimulated: false,
  };

  const mockPeerUser: AuthUser = {
    id: 'usr_peer_005',
    email: 'peer@college.edu',
    name: 'Class Peer',
    isSimulated: false,
  };

  beforeEach(() => {
    localStorage.clear();
    authService._setTestUser(null);
    resetLookupRateLimiter();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
    authService._setTestUser(null);
    resetLookupRateLimiter();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 1. Role Permission Matrix & Server-Side Invariants
  // ───────────────────────────────────────────────────────────────────────────
  describe('1. Role Permission Matrix & Mutation Authorization', () => {
    it('authorizes Owner, CR, and Co-Admin to manage schedule rules and overrides', () => {
      const allowedRoles: ClassSpaceRole[] = ['owner', 'cr', 'co_admin'];
      for (const role of allowedRoles) {
        expect(canManageSchedule(role)).toBe(true);
      }
    });

    it('denies regular enrolled students (members) from managing timetable rules', async () => {
      const ws = await classSpaceService.createWorkspace(mockOwnerUser, {
        name: 'Computer Science Batch 2026',
        department: 'CSE',
        section: 'A',
      });
      const wsId = ws.workspace!.id;

      // Regular member attempts to add a timetable rule
      const res = await classSpaceService.addTimetableRule(wsId, 'member', {
        subjectName: 'Compilers',
        subjectCode: 'CS401',
        subjectColor: '#4F46E5',
        dayOfWeek: 1,
        startTime: '10:00',
        endTime: '11:15',
        createdBy: mockStudentUser.id,
      });

      expect(res.error).toBe('Unauthorized: Only Owner, CR or Co-Admin can add official recurring classes.');
      expect(res.rule).toBeUndefined();

      // Verify no rule was stored in schedule
      const sched = await classSpaceService.getScheduleData(wsId);
      expect(sched.rules.length).toBe(0);
    });

    it('denies regular members from modifying or deleting existing timetable rules', async () => {
      const ws = await classSpaceService.createWorkspace(mockOwnerUser, {
        name: 'Mechanical Batch 2026',
      });
      const wsId = ws.workspace!.id;

      // CR creates official rule
      const ruleRes = await classSpaceService.addTimetableRule(wsId, 'cr', {
        subjectName: 'Thermodynamics',
        subjectCode: 'ME201',
        subjectColor: '#EF4444',
        dayOfWeek: 2,
        startTime: '09:00',
        endTime: '10:15',
        createdBy: mockOwnerUser.id,
      });
      expect(ruleRes.rule).toBeDefined();
      const ruleId = ruleRes.rule!.id;

      // Member attempts to update rule
      const updateRes = await classSpaceService.updateTimetableRule(wsId, 'member', ruleId, {
        subjectName: 'Hacked Subject',
      });
      expect(updateRes.success).toBe(false);
      expect(updateRes.error).toMatch(/Unauthorized/i);

      // Member attempts to delete rule
      const deleteRes = await classSpaceService.deleteTimetableRule(wsId, 'member', ruleId);
      expect(deleteRes.success).toBe(false);
      expect(deleteRes.error).toMatch(/Unauthorized/i);

      // Verify original rule remains untouched
      const sched = await classSpaceService.getScheduleData(wsId);
      expect(sched.rules.length).toBe(1);
      expect(sched.rules[0].subjectName).toBe('Thermodynamics');
    });

    it('denies regular members from creating, cancelling, or restoring occurrence overrides', async () => {
      const ws = await classSpaceService.createWorkspace(mockOwnerUser, {
        name: 'Electrical Batch 2026',
      });
      const wsId = ws.workspace!.id;

      // Member attempts to cancel a class
      const cancelRes = await classSpaceService.addOccurrenceOverride(wsId, 'member', {
        type: 'cancel',
        originalDate: '2026-10-26',
        newDate: '2026-10-26',
        changeNote: 'Member unauthorized cancel attempt',
        createdBy: mockStudentUser.id,
      });
      expect(cancelRes.error).toBe('Unauthorized: Only Owner, CR or Co-Admin can reschedule, cancel or add extra classes.');
      expect(cancelRes.override).toBeUndefined();

      // Member attempts to delete/restore an override
      const restoreRes = await classSpaceService.deleteOccurrenceOverride(wsId, 'member', 'ov_nonexistent');
      expect(restoreRes.success).toBe(false);
      expect(restoreRes.error).toMatch(/Unauthorized/i);
    });

    it('permits only CR or Owner to rotate workspace join code or delete workspace', async () => {
      const ws = await classSpaceService.createWorkspace(mockOwnerUser, {
        name: 'Civil Engineering 2026',
      });
      const wsId = ws.workspace!.id;

      // Add co_admin and student members
      await classSpaceService.joinWorkspaceByCode(mockCoAdminUser, ws.workspace!.joinCode);
      await classSpaceService.updateMemberRole(wsId, mockOwnerUser.id, mockCoAdminUser.id, 'co_admin');

      await classSpaceService.joinWorkspaceByCode(mockStudentUser, ws.workspace!.joinCode);

      // Co-admin cannot rotate code
      const coAdminRotate = await classSpaceService.rotateJoinCode(wsId, mockCoAdminUser.id);
      expect(coAdminRotate.error).toMatch(/Only the Class Representative \(CR\) or Owner/i);

      // Member cannot rotate code
      const memberRotate = await classSpaceService.rotateJoinCode(wsId, mockStudentUser.id);
      expect(memberRotate.error).toMatch(/Only the Class Representative \(CR\) or Owner/i);

      // Member cannot delete workspace
      const memberDelete = await classSpaceService.deleteWorkspace(wsId, mockStudentUser.id);
      expect(memberDelete.success).toBe(false);
      expect(memberDelete.error).toMatch(/Only the ClassSpace Owner/i);

      // Owner can rotate join code
      const ownerRotate = await classSpaceService.rotateJoinCode(wsId, mockOwnerUser.id);
      expect(ownerRotate.newCode).toBeDefined();
      expect(isValidJoinCode(ownerRotate.newCode!)).toBe(true);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. Member Management & Removal Protection
  // ───────────────────────────────────────────────────────────────────────────
  describe('2. Member Management & Removal Protection', () => {
    it('allows CR or Owner to remove a regular student member from the workspace', async () => {
      const ws = await classSpaceService.createWorkspace(mockOwnerUser, {
        name: 'Biotechnology Batch 2026',
      });
      const wsId = ws.workspace!.id;

      // Student joins
      await classSpaceService.joinWorkspaceByCode(mockStudentUser, ws.workspace!.joinCode);

      const beforeMembers = await classSpaceService.getMembers(wsId);
      expect(beforeMembers.some((m) => m.userId === mockStudentUser.id)).toBe(true);

      // Owner removes the student
      const removeRes = await classSpaceService.removeMember(wsId, mockOwnerUser.id, mockStudentUser.id);
      expect(removeRes.success).toBe(true);

      // Student should no longer appear in member roster
      const afterMembers = await classSpaceService.getMembers(wsId);
      expect(afterMembers.some((m) => m.userId === mockStudentUser.id)).toBe(false);
    });

    it('prevents regular members from removing other classmates', async () => {
      const ws = await classSpaceService.createWorkspace(mockOwnerUser, {
        name: 'Aerospace Batch 2026',
      });
      const wsId = ws.workspace!.id;

      // Two students join
      await classSpaceService.joinWorkspaceByCode(mockStudentUser, ws.workspace!.joinCode);
      await classSpaceService.joinWorkspaceByCode(mockPeerUser, ws.workspace!.joinCode);

      // Student attempts to remove peer
      const removeRes = await classSpaceService.removeMember(wsId, mockStudentUser.id, mockPeerUser.id);
      expect(removeRes.success).toBe(false);
      expect(removeRes.error).toBe('Unauthorized: Only the Workspace Owner or CR can remove members.');

      // Peer must still be enrolled
      const members = await classSpaceService.getMembers(wsId);
      expect(members.some((m) => m.userId === mockPeerUser.id)).toBe(true);
    });

    it('strictly forbids removing the workspace creator/owner', async () => {
      const ws = await classSpaceService.createWorkspace(mockOwnerUser, {
        name: 'Chemical Batch 2026',
      });
      const wsId = ws.workspace!.id;

      // CR joins
      await classSpaceService.joinWorkspaceByCode(mockCrUser, ws.workspace!.joinCode);
      await classSpaceService.updateMemberRole(wsId, mockOwnerUser.id, mockCrUser.id, 'cr');

      // CR attempts to remove owner
      const kickOwnerRes = await classSpaceService.removeMember(wsId, mockCrUser.id, mockOwnerUser.id);
      expect(kickOwnerRes.success).toBe(false);
      expect(kickOwnerRes.error).toBe('Cannot remove the workspace owner.');
    });

    it('rejects self-removal via removeMember and directs to leaveWorkspace', async () => {
      const ws = await classSpaceService.createWorkspace(mockOwnerUser, {
        name: 'Mathematics Batch 2026',
      });
      const wsId = ws.workspace!.id;

      const selfRemove = await classSpaceService.removeMember(wsId, mockOwnerUser.id, mockOwnerUser.id);
      expect(selfRemove.success).toBe(false);
      expect(selfRemove.error).toMatch(/Cannot remove yourself.*leave workspace/i);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. Join Code Brute-Force Rate Limiting
  // ───────────────────────────────────────────────────────────────────────────
  describe('3. Join Code Exhaustion & Brute-Force Rate Limiting', () => {
    it('throttles rapid invalid join-code lookups after 5 failed attempts within 60s', async () => {
      expect(isLookupRateLimited()).toBe(false);

      // Attempt 5 non-existent codes with valid 5-char format
      const nonExistentCodes = ['BD2X4', 'BD3X5', 'BD4X6', 'BD5X7', 'BD6X8'];
      for (const code of nonExistentCodes) {
        const res = await classSpaceService.lookupWorkspaceByCode(code);
        expect(res.error).toBe('No ClassSpace found with this Join Code.');
      }

      // 6th lookup must be blocked by rate limiter without checking database
      expect(isLookupRateLimited()).toBe(true);
      const blockedRes = await classSpaceService.lookupWorkspaceByCode('9XW4M');
      expect(blockedRes.error).toBe('Too many invalid attempts. Please wait 60 seconds before trying again.');
      expect(blockedRes.workspace).toBeUndefined();
    });

    it('blocks joinWorkspaceByCode when rate limited', async () => {
      // Trigger rate limit via 5 failed attempts with valid-format non-existent codes
      const nonExistentCodes = ['BD2X4', 'BD3X5', 'BD4X6', 'BD5X7', 'BD6X8'];
      for (const code of nonExistentCodes) {
        await classSpaceService.lookupWorkspaceByCode(code);
      }

      // joinWorkspaceByCode must immediately reject due to active rate limit
      const joinRes = await classSpaceService.joinWorkspaceByCode(mockStudentUser, '7K4MN');
      expect(joinRes.error).toBe('Too many invalid attempts. Please wait 60 seconds before trying again.');
      expect(joinRes.workspace).toBeUndefined();
    });

    it('resets rate limit cleanly after explicit reset or window expiry', async () => {
      const nonExistentCodes = ['BD2X4', 'BD3X5', 'BD4X6', 'BD5X7', 'BD6X8'];
      for (const code of nonExistentCodes) {
        await classSpaceService.lookupWorkspaceByCode(code);
      }
      expect(isLookupRateLimited()).toBe(true);

      // Reset rate limiter
      resetLookupRateLimiter();
      expect(isLookupRateLimited()).toBe(false);

      // Valid lookup format now proceeds normally
      const res = await classSpaceService.lookupWorkspaceByCode('7K4MN');
      // Returns not found error rather than rate limited error
      expect(res.error).toBe('No ClassSpace found with this Join Code.');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 4. Personal Attendance Isolation & Privacy
  // ───────────────────────────────────────────────────────────────────────────
  describe('4. Personal Attendance Isolation & Privacy', () => {
    it('isolates personal attendance records strictly to each individual student', async () => {
      const ws = await classSpaceService.createWorkspace(mockOwnerUser, {
        name: 'Information Science 2026',
      });
      const wsId = ws.workspace!.id;

      // Student A and Student B join
      await classSpaceService.joinWorkspaceByCode(mockStudentUser, ws.workspace!.joinCode);
      await classSpaceService.joinWorkspaceByCode(mockPeerUser, ws.workspace!.joinCode);

      const occurrenceKey = 'rule_algos_1::2026-10-26';

      // Student A marks attendance as present
      await classSpaceService.setAttendanceRecord(
        wsId,
        mockStudentUser.id,
        occurrenceKey,
        '2026-10-26',
        'present'
      );

      // Student A can read their own attendance
      const studentARecords = await classSpaceService.getAttendanceRecords(wsId, mockStudentUser.id);
      expect(studentARecords.length).toBe(1);
      expect(studentARecords[0].status).toBe('present');

      // Student B queries attendance: returns 0 records (Student B has not marked any)
      const studentBRecords = await classSpaceService.getAttendanceRecords(wsId, mockPeerUser.id);
      expect(studentBRecords.length).toBe(0);

      // CR / Owner queries attendance: returns 0 records (CR cannot view Student A's attendance)
      const ownerRecords = await classSpaceService.getAttendanceRecords(wsId, mockOwnerUser.id);
      expect(ownerRecords.length).toBe(0);
    });

    it('preserves historical attendance records locally when a student leaves a workspace', async () => {
      const ws = await classSpaceService.createWorkspace(mockOwnerUser, {
        name: 'Data Science Batch 2026',
      });
      const wsId = ws.workspace!.id;

      await classSpaceService.joinWorkspaceByCode(mockStudentUser, ws.workspace!.joinCode);

      // Student logs attendance
      await classSpaceService.setAttendanceRecord(
        wsId,
        mockStudentUser.id,
        'rule_stats_1::2026-10-27',
        '2026-10-27',
        'present'
      );

      // Student leaves workspace
      const leaveRes = await classSpaceService.leaveWorkspace(wsId, mockStudentUser.id);
      expect(leaveRes.success).toBe(true);

      // Verify student is removed from active workspace members
      const members = await classSpaceService.getMembers(wsId);
      expect(members.some((m) => m.userId === mockStudentUser.id)).toBe(false);

      // Student's historical attendance records remain preserved in local storage
      const retainedRecords = await classSpaceService.getAttendanceRecords(wsId, mockStudentUser.id);
      expect(retainedRecords.length).toBe(1);
      expect(retainedRecords[0].status).toBe('present');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 5. Cross-Class Isolation & Multi-Tenant Separation
  // ───────────────────────────────────────────────────────────────────────────
  describe('5. Cross-Class Isolation & Multi-Tenant Boundaries', () => {
    it('keeps schedule rules, overrides, and messages completely isolated between workspaces', async () => {
      // Create Workspace A
      const wsA = await classSpaceService.createWorkspace(mockOwnerUser, {
        name: 'Section A - CS',
      });
      const wsAId = wsA.workspace!.id;

      // Create Workspace B
      const wsB = await classSpaceService.createWorkspace(mockOwnerUser, {
        name: 'Section B - CS',
      });
      const wsBId = wsB.workspace!.id;

      // Add rule to Workspace A
      await classSpaceService.addTimetableRule(wsAId, 'cr', {
        subjectName: 'Artificial Intelligence',
        subjectCode: 'CS501',
        subjectColor: '#10B981',
        dayOfWeek: 3,
        startTime: '11:30',
        endTime: '12:45',
        createdBy: mockOwnerUser.id,
      });

      // Query Workspace B schedule: must be empty
      const schedB = await classSpaceService.getScheduleData(wsBId);
      expect(schedB.rules.length).toBe(0);

      // Query Workspace A schedule: must contain the rule
      const schedA = await classSpaceService.getScheduleData(wsAId);
      expect(schedA.rules.length).toBe(1);
      expect(schedA.rules[0].subjectName).toBe('Artificial Intelligence');

      // Post message in Workspace A
      await classSpaceService.sendMessage(
        wsAId,
        { id: mockOwnerUser.id, name: 'Owner', role: 'cr' },
        'Section A Announcement: Project deadline is Monday'
      );

      // Workspace B community messages must remain clean
      const msgsB = await classSpaceService.getMessages(wsBId);
      expect(msgsB.length).toBe(0);

      // Workspace A contains the message
      const msgsA = await classSpaceService.getMessages(wsAId);
      expect(msgsA.length).toBe(1);
      expect(msgsA[0].content).toContain('Section A Announcement');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 6. Schedule Resolver Offline Correctness
  // ───────────────────────────────────────────────────────────────────────────
  describe('6. Offline Schedule Resolution with Overrides', () => {
    it('merges recurring rules, one-off overrides, and extra classes into a coherent timeline', () => {
      const mockRules: ClassTimetableRule[] = [
        {
          id: 'rule_db_1',
          workspaceId: 'ws_offline_test',
          subjectName: 'Database Management',
          subjectCode: 'CS204',
          subjectColor: '#3B82F6',
          dayOfWeek: 1, // Monday
          startTime: '09:00',
          endTime: '10:15',
          room: 'LH-201',
          instructor: 'Dr. Varma',
          createdBy: mockCrUser.id,
          createdAt: '2026-10-01T00:00:00Z',
          updatedAt: '2026-10-01T00:00:00Z',
        },
      ];

      // Monday Oct 26, 2026 is rescheduled to 14:00 in Room Audi-1
      const mockOverrides = [
        {
          id: 'ov_resched_1',
          workspaceId: 'ws_offline_test',
          ruleId: 'rule_db_1',
          originalDate: '2026-10-26',
          type: 'reschedule' as const,
          newDate: '2026-10-26',
          newStartTime: '14:00',
          newEndTime: '15:15',
          newRoom: 'Audi-1',
          changeNote: 'Shifted to afternoon',
          createdBy: mockCrUser.id,
          createdAt: '2026-10-20T00:00:00Z',
        },
        // Extra tutorial on Wednesday Oct 28, 2026
        {
          id: 'ov_extra_1',
          workspaceId: 'ws_offline_test',
          type: 'extra' as const,
          newDate: '2026-10-28',
          newStartTime: '16:00',
          newEndTime: '17:00',
          newRoom: 'Lab-3',
          subjectName: 'DBMS Lab Tutorial',
          subjectCode: 'CS204-L',
          subjectColor: '#6366F1',
          changeNote: 'Special SQL practice session',
          createdBy: mockCrUser.id,
          createdAt: '2026-10-21T00:00:00Z',
        },
      ];

      const start = new Date(2026, 9, 26); // Oct 26, 2026 (Mon)
      const end = new Date(2026, 9, 31);   // Oct 31, 2026 (Sat)

      const occurrences = resolveClassSchedule(mockRules, mockOverrides, start, end);
      expect(occurrences.length).toBe(2);

      // Verify rescheduled Monday class
      const mondayClass = occurrences.find((o) => o.date === '2026-10-26');
      expect(mondayClass).toBeDefined();
      expect(mondayClass?.startTime).toBe('14:00');
      expect(mondayClass?.room).toBe('Audi-1');
      expect(mondayClass?.source).toBe('rescheduled');

      // Verify extra Wednesday tutorial
      const wednesdayClass = occurrences.find((o) => o.date === '2026-10-28');
      expect(wednesdayClass).toBeDefined();
      expect(wednesdayClass?.source).toBe('extra');
      expect(wednesdayClass?.subjectName).toBe('DBMS Lab Tutorial');
      expect(wednesdayClass?.room).toBe('Lab-3');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 7. Database RLS Invariants & Policy Protection Checks
  // ───────────────────────────────────────────────────────────────────────────
  describe('7. Database RLS Invariants & Policy Protection Checks', () => {
    it('verifies SQL migration restricts workspace deletion exclusively to the owner/creator', async () => {
      const fs = await import('fs');
      const sqlContent = fs.readFileSync('supabase/migrations/20261022_classspace_schema.sql', 'utf8');

      // 1. Must drop old permissive policy "Only CR can delete workspace"
      expect(sqlContent).toContain('drop policy if exists "Only CR can delete workspace" on public.class_workspaces');
      expect(sqlContent).toContain('create policy "Only workspace owner can delete workspace"');

      // 2. Must explicitly require auth.uid() = created_by or role = 'owner'
      expect(sqlContent).toMatch(/on public\.class_workspaces[\s\S]*?for delete[\s\S]*?using \([\s\S]*?auth\.uid\(\) = created_by/);
    });

    it('verifies SQL migration protects workspace owner from member removal by CR', async () => {
      const fs = await import('fs');
      const sqlContent = fs.readFileSync('supabase/migrations/20261022_classspace_schema.sql', 'utf8');

      // Must drop old policy and enforce non-owner member removal
      expect(sqlContent).toContain('create policy "Users can leave workspace; CR can remove non-owner members"');
      expect(sqlContent).toMatch(/w\.created_by = class_members\.user_id/);
      expect(sqlContent).toMatch(/class_members\.role <> 'owner'/);
    });

    it('verifies SQL migration prevents CR from elevating themselves or others to owner', async () => {
      const fs = await import('fs');
      const sqlContent = fs.readFileSync('supabase/migrations/20261022_classspace_schema.sql', 'utf8');

      // Under class_members update check, CR can only assign ('cr', 'co_admin', 'member') and cannot touch owner
      expect(sqlContent).toMatch(/role in \('cr', 'co_admin', 'member'\)/);
    });

    it('verifies personal attendance select policy is bound to auth.uid() = user_id', async () => {
      const fs = await import('fs');
      const sqlContent = fs.readFileSync('supabase/migrations/20261022_classspace_schema.sql', 'utf8');

      // Attendance records are isolated strictly to each student
      expect(sqlContent).toContain('create policy "Students can view only their own personal attendance records"');
      expect(sqlContent).toMatch(/on public\.class_attendance_records[\s\S]*?for select[\s\S]*?using \(auth\.uid\(\) = user_id\);/);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 8. Multi-Account Local Isolation on Sign-out & Restoration
  // ───────────────────────────────────────────────────────────────────────────
  describe('8. Multi-Account Local Isolation on Sign-out & Restoration', () => {
    it('archives ClassSpace data on signout and isolates guest/subsequent accounts', async () => {
      // 1. User A creates a workspace in local storage
      const wsA = await classSpaceService.createWorkspace(mockOwnerUser, {
        name: 'User A Workspace',
      });
      const wsAId = wsA.workspace!.id;

      // User A marks attendance
      await classSpaceService.setAttendanceRecord(
        wsAId,
        mockOwnerUser.id,
        'rule_test_1::2026-10-26',
        '2026-10-26',
        'present'
      );

      // Verify User A has workspaces
      const beforeSignOut = await classSpaceService.getWorkspacesForUser(mockOwnerUser.id);
      expect(beforeSignOut.length).toBe(1);

      // 2. User A signs out: archives and clears local ClassSpace data
      classSpaceService.archiveAndClearLocalData(mockOwnerUser.id);

      // 3. User B (or guest) accesses ClassSpace: active store is empty
      const userBWorkspaces = await classSpaceService.getWorkspacesForUser(mockStudentUser.id);
      expect(userBWorkspaces.length).toBe(0);

      // 4. User A logs back in: restored from archive
      classSpaceService.restoreArchivedData(mockOwnerUser.id);
      const restored = await classSpaceService.getWorkspacesForUser(mockOwnerUser.id);
      expect(restored.length).toBe(1);
      expect(restored[0].name).toBe('User A Workspace');
    });
  });
});
