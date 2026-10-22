import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AppProvider } from '../src/context/AppContext';
import { ThemeProvider } from '../src/theme/ThemeContext';
import { ClassSpaceProvider } from '../src/context/ClassSpaceContext';
import { ClassSpaceView } from '../src/components/classspace/ClassSpaceView';
import {
  generateJoinCode,
  normalizeJoinCode,
  isValidJoinCode,
  validateProfileAvatar,
  canManageSchedule,
  canModerate,
  canManageWorkspace,
  resolveClassSchedule,
  JOIN_CODE_CHARACTERS,
  JOIN_CODE_LENGTH,
} from '../src/utils/classSpaceUtils';
import { classSpaceService } from '../src/services/classSpaceService';
import { ClassTimetableRule, ClassTimetableOverride } from '../src/types/classSpace';

describe('ClassSpace — Core Logic & Unit Tests', () => {
  describe('Join Code Generation & Validation', () => {
    it('generates a 5-character alphanumeric join code', () => {
      const code = generateJoinCode();
      expect(code).toHaveLength(JOIN_CODE_LENGTH);
      for (const char of code) {
        expect(JOIN_CODE_CHARACTERS.includes(char)).toBe(true);
      }
    });

    it('generates unique codes across successive calls', () => {
      const codes = new Set<string>();
      for (let i = 0; i < 50; i++) {
        codes.add(generateJoinCode());
      }
      expect(codes.size).toBe(50);
    });

    it('normalizes user input correctly (trims, uppercase, removes spaces/hyphens)', () => {
      expect(normalizeJoinCode(' ch7k2 ')).toBe('CH7K2');
      expect(normalizeJoinCode('ch-7k-2')).toBe('CH7K2');
      expect(normalizeJoinCode('c h 7 k 2')).toBe('CH7K2');
      expect(normalizeJoinCode('')).toBe('');
    });

    it('validates join codes strictly against allowed character set', () => {
      expect(isValidJoinCode('CH7K2')).toBe(true);
      expect(isValidJoinCode('9XW4M')).toBe(true);
      // Too short or too long
      expect(isValidJoinCode('CH7K')).toBe(false);
      expect(isValidJoinCode('CH7K29')).toBe(false);
      // Contains ambiguous or forbidden characters like 0, O, 1, I
      expect(isValidJoinCode('CH0K2')).toBe(false);
      expect(isValidJoinCode('CHO9K')).toBe(false);
      expect(isValidJoinCode('CH1K2')).toBe(false);
      expect(isValidJoinCode('CHIK2')).toBe(false);
    });
  });

  describe('Avatar File Upload Validation', () => {
    it('accepts valid image MIME types under 2MB', () => {
      const validJpg = new File(['dummy jpg content'], 'avatar.jpg', { type: 'image/jpeg' });
      const validPng = new File(['dummy png content'], 'avatar.png', { type: 'image/png' });
      const validWebp = new File(['dummy webp content'], 'avatar.webp', { type: 'image/webp' });

      expect(validateProfileAvatar(validJpg).valid).toBe(true);
      expect(validateProfileAvatar(validPng).valid).toBe(true);
      expect(validateProfileAvatar(validWebp).valid).toBe(true);
    });

    it('rejects unsupported file formats', () => {
      const pdfFile = new File(['dummy pdf'], 'notes.pdf', { type: 'application/pdf' });
      const textFile = new File(['dummy text'], 'notes.txt', { type: 'text/plain' });

      const pdfRes = validateProfileAvatar(pdfFile);
      expect(pdfRes.valid).toBe(false);
      expect(pdfRes.error).toMatch(/Invalid file format/i);

      const txtRes = validateProfileAvatar(textFile);
      expect(txtRes.valid).toBe(false);
      expect(txtRes.error).toMatch(/Invalid file format/i);
    });

    it('rejects files larger than 2MB', () => {
      // 2.5 MB mock file
      const bigBlob = new Blob([new Uint8Array(2.5 * 1024 * 1024)]);
      const bigFile = new File([bigBlob], 'huge_avatar.png', { type: 'image/png' });

      const res = validateProfileAvatar(bigFile);
      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/exceeds 2MB limit/i);
    });
  });

  describe('Role-Based Permissions', () => {
    it('authorizes CR and Co-Admin to manage schedules, but denies normal members', () => {
      expect(canManageSchedule('cr')).toBe(true);
      expect(canManageSchedule('co_admin')).toBe(true);
      expect(canManageSchedule('member')).toBe(false);
      expect(canManageSchedule(undefined)).toBe(false);
    });

    it('authorizes CR and Co-Admin to moderate community chat, but denies normal members', () => {
      expect(canModerate('cr')).toBe(true);
      expect(canModerate('co_admin')).toBe(true);
      expect(canModerate('member')).toBe(false);
      expect(canModerate(undefined)).toBe(false);
    });

    it('restricts workspace-level administrative actions solely to CR', () => {
      expect(canManageWorkspace('cr')).toBe(true);
      expect(canManageWorkspace('co_admin')).toBe(false);
      expect(canManageWorkspace('member')).toBe(false);
    });
  });

  describe('Authoritative Schedule Resolver with Overrides', () => {
    const mockRules: ClassTimetableRule[] = [
      {
        id: 'rule_1',
        workspaceId: 'ws_test',
        subjectName: 'Algorithms & Data Structures',
        subjectCode: 'CS301',
        subjectColor: '#DE6C47',
        dayOfWeek: 1, // Monday
        startTime: '09:00',
        endTime: '10:15',
        room: 'LH-101',
        instructor: 'Prof. Raman',
        createdBy: 'usr_cr',
        createdAt: '2026-10-01T00:00:00Z',
        updatedAt: '2026-10-01T00:00:00Z',
      },
    ];

    it('generates standard recurring occurrences when no overrides exist', () => {
      // Monday Oct 26, 2026 to Sunday Nov 1, 2026
      const start = new Date(2026, 9, 26);
      const end = new Date(2026, 10, 1);

      const occurrences = resolveClassSchedule(mockRules, [], start, end);
      expect(occurrences.length).toBe(1);
      expect(occurrences[0].subjectCode).toBe('CS301');
      expect(occurrences[0].date).toBe('2026-10-26');
      expect(occurrences[0].startTime).toBe('09:00');
      expect(occurrences[0].source).toBe('recurring');
      expect(occurrences[0].isCancelled).toBe(false);
    });

    it('applies occurrence-level reschedule override without altering base rule', () => {
      const overrides: ClassTimetableOverride[] = [
        {
          id: 'ov_reschedule_1',
          workspaceId: 'ws_test',
          ruleId: 'rule_1',
          originalDate: '2026-10-26',
          type: 'reschedule',
          newDate: '2026-10-26',
          newStartTime: '11:00',
          newEndTime: '12:15',
          newRoom: 'Lab 4',
          changeNote: 'Shifted 2 hours later due to faculty symposium',
          createdBy: 'usr_cr',
          createdAt: '2026-10-01T00:00:00Z',
        },
      ];

      const start = new Date(2026, 9, 26);
      const end = new Date(2026, 10, 1);

      const occurrences = resolveClassSchedule(mockRules, overrides, start, end);
      expect(occurrences.length).toBe(1);
      const resched = occurrences[0];
      expect(resched.startTime).toBe('11:00');
      expect(resched.endTime).toBe('12:15');
      expect(resched.room).toBe('Lab 4');
      expect(resched.source).toBe('rescheduled');
      expect(resched.changeNote).toBe('Shifted 2 hours later due to faculty symposium');

      // The original recurring rule parameters remain unchanged
      expect(mockRules[0].startTime).toBe('09:00');
      expect(mockRules[0].room).toBe('LH-101');
    });

    it('applies cancellation override and marks occurrence cancelled', () => {
      const overrides: ClassTimetableOverride[] = [
        {
          id: 'ov_cancel_1',
          workspaceId: 'ws_test',
          ruleId: 'rule_1',
          originalDate: '2026-10-26',
          type: 'cancel',
          newDate: '2026-10-26',
          changeNote: 'Cancelled due to national holiday',
          createdBy: 'usr_cr',
          createdAt: '2026-10-01T00:00:00Z',
        },
      ];

      const start = new Date(2026, 9, 26);
      const end = new Date(2026, 10, 1);

      const occurrences = resolveClassSchedule(mockRules, overrides, start, end);
      expect(occurrences.length).toBe(1);
      expect(occurrences[0].isCancelled).toBe(true);
      expect(occurrences[0].changeNote).toBe('Cancelled due to national holiday');
    });

    it('integrates extra one-off class occurrences into schedule', () => {
      const overrides: ClassTimetableOverride[] = [
        {
          id: 'ov_extra_1',
          workspaceId: 'ws_test',
          type: 'extra',
          newDate: '2026-10-28', // Wednesday
          newStartTime: '15:00',
          newEndTime: '16:30',
          newRoom: 'Auditorium',
          subjectName: 'Special Guest Lecture on AI',
          subjectCode: 'SEMINAR',
          changeNote: 'Mandatory seminar for all batch members',
          createdBy: 'usr_cr',
          createdAt: '2026-10-01T00:00:00Z',
        },
      ];

      const start = new Date(2026, 9, 26);
      const end = new Date(2026, 10, 1);

      const occurrences = resolveClassSchedule(mockRules, overrides, start, end);
      expect(occurrences.length).toBe(2);
      const extra = occurrences.find((o) => o.source === 'extra');
      expect(extra).toBeDefined();
      expect(extra?.subjectName).toBe('Special Guest Lecture on AI');
      expect(extra?.date).toBe('2026-10-28');
    });
  });
});

describe('ClassSpace Service & Multi-Student Attendance Isolation', () => {
  beforeEach(async () => {
    localStorage.clear();
  });

  it('provides a seeded default workspace with join code CH7K2 for student demo', async () => {
    const workspaces = await classSpaceService.getWorkspacesForUser('usr_google_student_demo');
    expect(workspaces.length).toBeGreaterThan(0);
    const demoWs = workspaces.find((w) => w.joinCode === 'CH7K2');
    expect(demoWs).toBeDefined();
    expect(demoWs?.name).toContain('B.Tech CSE');
  });

  it('creates new workspaces with uppercase 5-char code and sets user as CR', async () => {
    const user = {
      id: 'usr_cr_test',
      email: 'cr.test@college.edu',
      name: 'Test CR',
    };

    const res = await classSpaceService.createWorkspace(user, {
      name: 'Electrical Engineering — Batch 2027',
      section: 'EE-1',
      department: 'Electrical Engineering',
    });

    expect(res.workspace).toBeDefined();
    expect(res.workspace?.id).toBeDefined();
    expect(res.workspace?.joinCode).toHaveLength(5);
    expect(isValidJoinCode(res.workspace!.joinCode)).toBe(true);

    const members = await classSpaceService.getMembers(res.workspace!.id);
    const crMember = members.find((m) => m.userId === user.id);
    expect(crMember).toBeDefined();
    expect(crMember?.role).toBe('cr');
  });

  it('allows student to join with code and prevents duplicate membership', async () => {
    const studentUser = {
      id: 'usr_student_alice',
      email: 'alice@college.edu',
      name: 'Alice Scholar',
    };

    // Join default workspace CH7K2
    const joinRes = await classSpaceService.joinWorkspaceByCode(studentUser, 'CH7K2');
    expect(joinRes.workspace).toBeDefined();
    expect(joinRes.workspace?.joinCode).toBe('CH7K2');

    const members = await classSpaceService.getMembers(joinRes.workspace!.id);
    const alice = members.find((m) => m.userId === studentUser.id);
    expect(alice).toBeDefined();
    expect(alice?.role).toBe('member');

    // Attempting to join again should reject gracefully with already-a-member error
    const duplicateRes = await classSpaceService.joinWorkspaceByCode(studentUser, 'CH7K2');
    expect(duplicateRes.error).toMatch(/Already a member/i);
  });

  it('rotates join code securely, invalidating the old code', async () => {
    const crUser = {
      id: 'usr_cr_owner',
      email: 'cr.owner@college.edu',
      name: 'CR Owner',
    };

    const createRes = await classSpaceService.createWorkspace(crUser, {
      name: 'Mechanical Batch 2026',
    });
    const ws = createRes.workspace!;
    const originalCode = ws.joinCode;

    const rotateRes = await classSpaceService.rotateJoinCode(ws.id, crUser.id);
    expect(rotateRes.newCode).toBeDefined();
    expect(rotateRes.newCode).not.toBe(originalCode);
    expect(rotateRes.newCode).toHaveLength(5);

    // Old code lookup returns error
    const joiningUser = { id: 'usr_other', email: 'o@c.edu', name: 'Other' };
    const lookupOld = await classSpaceService.joinWorkspaceByCode(joiningUser, originalCode);
    expect(lookupOld.error).toMatch(/No ClassSpace found/i);

    // New code lookup succeeds
    const lookupNew = await classSpaceService.joinWorkspaceByCode(joiningUser, rotateRes.newCode!);
    expect(lookupNew.workspace?.id).toBe(ws.id);
  });

  it('strictly isolates personal attendance records between different students', async () => {
    const studentA = 'usr_alice';
    const studentB = 'usr_bob';
    const occurrenceKey = 'rule_1::2026-10-26';

    // Alice marks herself PRESENT
    await classSpaceService.setAttendanceRecord(
      'ws_demo_cs2026',
      studentA,
      occurrenceKey,
      '2026-10-26',
      'present'
    );

    // Bob marks himself ABSENT
    await classSpaceService.setAttendanceRecord(
      'ws_demo_cs2026',
      studentB,
      occurrenceKey,
      '2026-10-26',
      'absent'
    );

    // Alice queries her attendance: only sees PRESENT for herself
    const aliceRecords = await classSpaceService.getAttendanceRecords('ws_demo_cs2026', studentA);
    const aliceRecord = aliceRecords.find((r) => r.occurrenceKey === occurrenceKey);
    expect(aliceRecord?.status).toBe('present');
    expect(aliceRecord?.userId).toBe(studentA);

    // Bob queries his attendance: only sees ABSENT for himself
    const bobRecords = await classSpaceService.getAttendanceRecords('ws_demo_cs2026', studentB);
    const bobRecord = bobRecords.find((r) => r.occurrenceKey === occurrenceKey);
    expect(bobRecord?.status).toBe('absent');
    expect(bobRecord?.userId).toBe(studentB);

    // Updating Alice's attendance does not mutate Bob's attendance
    await classSpaceService.setAttendanceRecord(
      'ws_demo_cs2026',
      studentA,
      occurrenceKey,
      '2026-10-26',
      'absent'
    );

    const aliceUpdated = await classSpaceService.getAttendanceRecords('ws_demo_cs2026', studentA);
    expect(aliceUpdated.find((r) => r.occurrenceKey === occurrenceKey)?.status).toBe('absent');

    const bobCheck = await classSpaceService.getAttendanceRecords('ws_demo_cs2026', studentB);
    expect(bobCheck.find((r) => r.occurrenceKey === occurrenceKey)?.status).toBe('absent');
  });

  describe('Community Messaging, Replies & Emoji Reactions', () => {
    it('sends messages and supports threaded quoted replies', async () => {
      const sendRes = await classSpaceService.sendMessage(
        'ws_demo_cs2026',
        { id: 'usr_student_1', name: 'Maya Patel' },
        'Does anyone have the lecture slides for unit 3?'
      );

      expect(sendRes.message).toBeDefined();
      expect(sendRes.message?.content).toBe('Does anyone have the lecture slides for unit 3?');

      const replyRes = await classSpaceService.sendMessage(
        'ws_demo_cs2026',
        { id: 'usr_cr_test', name: 'Class Rep' },
        'Uploaded to the shared Google Drive link!',
        {
          id: sendRes.message!.id,
          content: sendRes.message!.content,
          senderName: sendRes.message!.senderName,
        }
      );

      expect(replyRes.message?.replyToId).toBe(sendRes.message!.id);
      expect(replyRes.message?.replyToSenderName).toBe('Maya Patel');
    });

    it('toggles emoji reactions cleanly per user without duplicates', async () => {
      const sendRes = await classSpaceService.sendMessage(
        'ws_demo_cs2026',
        { id: 'usr_test', name: 'Test' },
        'Assignment 2 deadline is postponed to Friday.'
      );
      const msgId = sendRes.message!.id;

      // User A adds thumbs up
      await classSpaceService.addReaction(msgId, 'usr_user_a', '👍');
      let messages = await classSpaceService.getMessages('ws_demo_cs2026');
      let updatedMsg = messages.find((m) => m.id === msgId);
      expect(updatedMsg?.reactions['👍']).toContain('usr_user_a');

      // User B adds thumbs up
      await classSpaceService.addReaction(msgId, 'usr_user_b', '👍');
      messages = await classSpaceService.getMessages('ws_demo_cs2026');
      updatedMsg = messages.find((m) => m.id === msgId);
      expect(updatedMsg?.reactions['👍']).toHaveLength(2);

      // User A removes reaction
      await classSpaceService.removeReaction(msgId, 'usr_user_a', '👍');
      messages = await classSpaceService.getMessages('ws_demo_cs2026');
      updatedMsg = messages.find((m) => m.id === msgId);
      expect(updatedMsg?.reactions['👍']).toEqual(['usr_user_b']);
    });
  });
});

describe('ClassSpace UI Component Integration', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders ClassSpace header, join code, and sub-tabs navigation', async () => {
    render(
      <ThemeProvider>
        <AppProvider>
          <ClassSpaceProvider>
            <ClassSpaceView />
          </ClassSpaceProvider>
        </AppProvider>
      </ThemeProvider>
    );

    // Header displays workspace name and join code
    await waitFor(() => {
      expect(screen.getByText(/B\.Tech CSE — Batch 2026/i)).toBeInTheDocument();
      expect(screen.getByText('CH7K2')).toBeInTheDocument();
    });

    // Sub-tab navigation is present
    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.getByText('Timetable')).toBeInTheDocument();
    expect(screen.getByText('My Attendance')).toBeInTheDocument();
    expect(screen.getByText('Community')).toBeInTheDocument();
    expect(screen.getByText('Classmates')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('switches between ClassSpace sub-tabs smoothly', async () => {
    render(
      <ThemeProvider>
        <AppProvider>
          <ClassSpaceProvider>
            <ClassSpaceView />
          </ClassSpaceProvider>
        </AppProvider>
      </ThemeProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('CH7K2')).toBeInTheDocument();
    });

    // Switch to Classmates tab using exact tab button
    const classmatesTab = screen.getByText('Classmates').closest('button')!;
    fireEvent.click(classmatesTab);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Search by student name or email/i)).toBeInTheDocument();
    });

    // Switch to Settings tab
    const settingsTab = screen.getByText('Settings').closest('button')!;
    fireEvent.click(settingsTab);

    await waitFor(() => {
      expect(screen.getByText(/ClassSpace Details/i)).toBeInTheDocument();
      expect(screen.getByText(/Your Student Profile in this Class/i)).toBeInTheDocument();
    });
  });
});
