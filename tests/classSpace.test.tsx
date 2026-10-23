import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AppProvider } from '../src/context/AppContext';
import { ThemeProvider } from '../src/theme/ThemeContext';
import { ClassSpaceProvider } from '../src/context/ClassSpaceContext';
import { ClassSpaceView } from '../src/components/classspace/ClassSpaceView';
import { Navigation } from '../src/components/common/Navigation';
import { SettingsView } from '../src/components/views/SettingsView';
import {
  generateJoinCode,
  normalizeJoinCode,
  isValidJoinCode,
  validateProfileAvatar,
  canManageSchedule,
  canModerate,
  canManageWorkspace,
  isWorkspaceOwner,
  resolveClassSchedule,
  JOIN_CODE_CHARACTERS,
  JOIN_CODE_LENGTH,
} from '../src/utils/classSpaceUtils';
import { classSpaceService } from '../src/services/classSpaceService';
import { ClassTimetableRule, ClassTimetableOverride } from '../src/types/classSpace';
import { storageService } from '../src/services/storage';

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
      const bigBlob = new Blob([new Uint8Array(2.5 * 1024 * 1024)]);
      const bigFile = new File([bigBlob], 'huge_avatar.png', { type: 'image/png' });

      const res = validateProfileAvatar(bigFile);
      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/exceeds 2MB limit/i);
    });
  });

  describe('Role-Based Permissions', () => {
    it('authorizes Owner, CR, and Co-Admin to manage schedules, but denies normal members', () => {
      expect(canManageSchedule('owner')).toBe(true);
      expect(canManageSchedule('cr')).toBe(true);
      expect(canManageSchedule('co_admin')).toBe(true);
      expect(canManageSchedule('member')).toBe(false);
      expect(canManageSchedule(undefined)).toBe(false);
    });

    it('authorizes Owner, CR, and Co-Admin to moderate community chat, but denies normal members', () => {
      expect(canModerate('owner')).toBe(true);
      expect(canModerate('cr')).toBe(true);
      expect(canModerate('co_admin')).toBe(true);
      expect(canModerate('member')).toBe(false);
      expect(canModerate(undefined)).toBe(false);
    });

    it('restricts workspace-level administrative actions solely to Owner and CR', () => {
      expect(canManageWorkspace('owner')).toBe(true);
      expect(canManageWorkspace('cr')).toBe(true);
      expect(canManageWorkspace('co_admin')).toBe(false);
      expect(canManageWorkspace('member')).toBe(false);
      expect(isWorkspaceOwner('owner')).toBe(true);
      expect(isWorkspaceOwner('cr')).toBe(false);
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
          newDate: '2026-10-28',
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

describe('ClassSpace Service — No Mock Data & Multi-Student Attendance Isolation', () => {
  beforeEach(async () => {
    localStorage.clear();
  });

  it('starts completely clean with no fake demo workspaces, classes or members in production', async () => {
    const workspaces = await classSpaceService.getWorkspacesForUser('any_user');
    expect(workspaces).toEqual([]);
  });

  it('creates new workspaces with uppercase 5-char code and sets creator as CR/Owner', async () => {
    const user = {
      id: 'usr_cr_test',
      email: 'cr.test@college.edu',
      name: 'Test CR',
    };

    const res = await classSpaceService.createWorkspace(user, {
      name: 'Electrical Engineering — Batch 2027',
      section: 'EE-1',
      department: 'Electrical Engineering',
      institution: 'State Engineering College',
    });

    expect(res.workspace).toBeDefined();
    expect(res.workspace?.id).toBeDefined();
    expect(res.workspace?.name).toBe('Electrical Engineering — Batch 2027');
    expect(res.workspace?.joinCode).toHaveLength(5);
    expect(isValidJoinCode(res.workspace!.joinCode)).toBe(true);

    const members = await classSpaceService.getMembers(res.workspace!.id);
    const crMember = members.find((m) => m.userId === user.id);
    expect(crMember).toBeDefined();
    expect(crMember?.role).toBe('cr');
  });

  it('allows student to join real workspace with code and prevents duplicate membership', async () => {
    const creatorUser = {
      id: 'usr_creator',
      email: 'creator@college.edu',
      name: 'Creator CR',
    };

    const createRes = await classSpaceService.createWorkspace(creatorUser, {
      name: 'Civil Engineering — Batch 2026',
    });
    const joinCode = createRes.workspace!.joinCode;

    const studentUser = {
      id: 'usr_student_alice',
      email: 'alice@college.edu',
      name: 'Alice Scholar',
    };

    // Join the newly created real workspace
    const joinRes = await classSpaceService.joinWorkspaceByCode(studentUser, joinCode);
    expect(joinRes.workspace).toBeDefined();
    expect(joinRes.workspace?.joinCode).toBe(joinCode);

    const members = await classSpaceService.getMembers(joinRes.workspace!.id);
    const alice = members.find((m) => m.userId === studentUser.id);
    expect(alice).toBeDefined();
    expect(alice?.role).toBe('member');

    // Attempting to join again should reject gracefully with already-a-member error
    const duplicateRes = await classSpaceService.joinWorkspaceByCode(studentUser, joinCode);
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

  it('strictly isolates personal attendance records between different students in same class', async () => {
    const creatorUser = { id: 'usr_cr', email: 'cr@c.edu', name: 'CR' };
    const wsRes = await classSpaceService.createWorkspace(creatorUser, { name: 'Batch 2026' });
    const wsId = wsRes.workspace!.id;

    const studentA = 'usr_alice';
    const studentB = 'usr_bob';
    const occurrenceKey = 'rule_1::2026-10-26';

    // Alice marks herself PRESENT
    await classSpaceService.setAttendanceRecord(
      wsId,
      studentA,
      occurrenceKey,
      '2026-10-26',
      'present'
    );

    // Bob marks himself ABSENT
    await classSpaceService.setAttendanceRecord(
      wsId,
      studentB,
      occurrenceKey,
      '2026-10-26',
      'absent'
    );

    // Alice queries her attendance: only sees PRESENT for herself
    const aliceRecords = await classSpaceService.getAttendanceRecords(wsId, studentA);
    const aliceRecord = aliceRecords.find((r) => r.occurrenceKey === occurrenceKey);
    expect(aliceRecord?.status).toBe('present');
    expect(aliceRecord?.userId).toBe(studentA);

    // Bob queries his attendance: only sees ABSENT for himself
    const bobRecords = await classSpaceService.getAttendanceRecords(wsId, studentB);
    const bobRecord = bobRecords.find((r) => r.occurrenceKey === occurrenceKey);
    expect(bobRecord?.status).toBe('absent');
    expect(bobRecord?.userId).toBe(studentB);

    // Updating Alice's attendance does not mutate Bob's attendance
    await classSpaceService.setAttendanceRecord(
      wsId,
      studentA,
      occurrenceKey,
      '2026-10-26',
      'absent'
    );

    const aliceUpdated = await classSpaceService.getAttendanceRecords(wsId, studentA);
    expect(aliceUpdated.find((r) => r.occurrenceKey === occurrenceKey)?.status).toBe('absent');

    const bobCheck = await classSpaceService.getAttendanceRecords(wsId, studentB);
    expect(bobCheck.find((r) => r.occurrenceKey === occurrenceKey)?.status).toBe('absent');
  });

  describe('Community Messaging, Replies & Emoji Reactions', () => {
    it('sends messages and supports threaded quoted replies', async () => {
      const creatorUser = { id: 'usr_cr', email: 'cr@c.edu', name: 'CR' };
      const wsRes = await classSpaceService.createWorkspace(creatorUser, { name: 'Batch 2026' });
      const wsId = wsRes.workspace!.id;

      const sendRes = await classSpaceService.sendMessage(
        wsId,
        { id: 'usr_student_1', name: 'Maya Patel' },
        'Does anyone have the lecture slides for unit 3?'
      );

      expect(sendRes.message).toBeDefined();
      expect(sendRes.message?.content).toBe('Does anyone have the lecture slides for unit 3?');

      const replyRes = await classSpaceService.sendMessage(
        wsId,
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
      const creatorUser = { id: 'usr_cr', email: 'cr@c.edu', name: 'CR' };
      const wsRes = await classSpaceService.createWorkspace(creatorUser, { name: 'Batch 2026' });
      const wsId = wsRes.workspace!.id;

      const sendRes = await classSpaceService.sendMessage(
        wsId,
        { id: 'usr_test', name: 'Test' },
        'Assignment 2 deadline is postponed to Friday.'
      );
      const msgId = sendRes.message!.id;

      // User A adds thumbs up
      await classSpaceService.addReaction(msgId, 'usr_user_a', '👍');
      let messages = await classSpaceService.getMessages(wsId);
      let updatedMsg = messages.find((m) => m.id === msgId);
      expect(updatedMsg?.reactions['👍']).toContain('usr_user_a');

      // User B adds thumbs up
      await classSpaceService.addReaction(msgId, 'usr_user_b', '👍');
      messages = await classSpaceService.getMessages(wsId);
      updatedMsg = messages.find((m) => m.id === msgId);
      expect(updatedMsg?.reactions['👍']).toHaveLength(2);

      // User A removes reaction
      await classSpaceService.removeReaction(msgId, 'usr_user_a', '👍');
      messages = await classSpaceService.getMessages(wsId);
      updatedMsg = messages.find((m) => m.id === msgId);
      expect(updatedMsg?.reactions['👍']).toEqual(['usr_user_b']);
    });
  });

  describe('Class Polls System (Single & Multi-Option) & Study Resource Tools', () => {
    it('creates a single-choice poll and enforces exclusive single selection per voter', async () => {
      const creatorUser = { id: 'usr_cr', email: 'cr@c.edu', name: 'CR' };
      const wsRes = await classSpaceService.createWorkspace(creatorUser, { name: 'Batch 2026' });
      const wsId = wsRes.workspace!.id;

      // 1. Create a single-choice poll
      const pollRes = await classSpaceService.createPoll(
        wsId,
        { id: 'usr_cr', name: 'CR' },
        'When should we hold the extra DSA review?',
        ['Friday 4 PM', 'Saturday 10 AM', 'Sunday 2 PM'],
        false // allowMultipleAnswers = false (single choice)
      );

      expect(pollRes.message).toBeDefined();
      expect(pollRes.message?.messageType).toBe('poll');
      const poll = pollRes.message!.poll!;
      expect(poll.question).toBe('When should we hold the extra DSA review?');
      expect(poll.options).toHaveLength(3);
      expect(poll.allowMultipleAnswers).toBe(false);

      const msgId = pollRes.message!.id;
      const opt1Id = poll.options[0].id;
      const opt2Id = poll.options[1].id;

      // 2. Student votes for Option 1
      const vote1 = await classSpaceService.votePoll(wsId, msgId, opt1Id, 'usr_student_1');
      expect(vote1.success).toBe(true);
      expect(vote1.poll?.options[0].votes).toContain('usr_student_1');
      expect(vote1.poll?.totalVotes).toBe(1);

      // 3. Same student switches vote to Option 2 in single-choice mode
      const vote2 = await classSpaceService.votePoll(wsId, msgId, opt2Id, 'usr_student_1');
      expect(vote2.success).toBe(true);
      expect(vote2.poll?.options[0].votes).not.toContain('usr_student_1');
      expect(vote2.poll?.options[1].votes).toContain('usr_student_1');
      expect(vote2.poll?.totalVotes).toBe(1);
    });

    it('creates a multi-option poll allowing students to select multiple preferred options', async () => {
      const creatorUser = { id: 'usr_cr', email: 'cr@c.edu', name: 'CR' };
      const wsRes = await classSpaceService.createWorkspace(creatorUser, { name: 'Batch 2026' });
      const wsId = wsRes.workspace!.id;

      // 1. Create a multi-choice poll
      const pollRes = await classSpaceService.createPoll(
        wsId,
        { id: 'usr_student_leader', name: 'Aanya' },
        'Select all topics you want covered in revision:',
        ['Dynamic Programming', 'Graph Theory', 'Trie / Segment Tree'],
        true // allowMultipleAnswers = true
      );

      const msgId = pollRes.message!.id;
      const [opt1, opt2, opt3] = pollRes.message!.poll!.options;

      // 2. Student votes for Option 1 and Option 2
      await classSpaceService.votePoll(wsId, msgId, opt1.id, 'usr_student_1');
      const voteRes = await classSpaceService.votePoll(wsId, msgId, opt2.id, 'usr_student_1');

      expect(voteRes.poll?.options[0].votes).toContain('usr_student_1');
      expect(voteRes.poll?.options[1].votes).toContain('usr_student_1');
      expect(voteRes.poll?.options[2].votes).toHaveLength(0);
      expect(voteRes.poll?.totalVotes).toBe(1); // 1 unique voter

      // 3. Second student votes for Option 2 and Option 3
      await classSpaceService.votePoll(wsId, msgId, opt2.id, 'usr_student_2');
      await classSpaceService.votePoll(wsId, msgId, opt3.id, 'usr_student_2');

      const messages = await classSpaceService.getMessages(wsId);
      const updatedPoll = messages.find((m) => m.id === msgId)!.poll!;
      expect(updatedPoll.options[1].votes).toHaveLength(2); // Option 2 has 2 votes
      expect(updatedPoll.totalVotes).toBe(2); // 2 unique voters
    });

    it('allows closing a poll and prevents further voting', async () => {
      const creatorUser = { id: 'usr_cr', email: 'cr@c.edu', name: 'CR' };
      const wsRes = await classSpaceService.createWorkspace(creatorUser, { name: 'Batch 2026' });
      const wsId = wsRes.workspace!.id;

      const pollRes = await classSpaceService.createPoll(
        wsId,
        { id: 'usr_cr', name: 'CR', role: 'cr' },
        'Close voting deadline test',
        ['Yes', 'No'],
        false
      );

      const msgId = pollRes.message!.id;
      const optId = pollRes.message!.poll!.options[0].id;

      // Close poll
      const closeRes = await classSpaceService.closePoll(wsId, msgId, 'usr_cr', 'cr');
      expect(closeRes.success).toBe(true);

      // Attempt to vote on closed poll
      const voteAttempt = await classSpaceService.votePoll(wsId, msgId, optId, 'usr_student_3');
      expect(voteAttempt.success).toBe(false);
      expect(voteAttempt.error).toMatch(/ended|closed/i);
    });

    it('shares study resources with categorized links', async () => {
      const creatorUser = { id: 'usr_cr', email: 'cr@c.edu', name: 'CR' };
      const wsRes = await classSpaceService.createWorkspace(creatorUser, { name: 'Batch 2026' });
      const wsId = wsRes.workspace!.id;

      const res = await classSpaceService.shareResource(
        wsId,
        { id: 'usr_cr', name: 'CR' },
        'Unit 4 - Database Normalization Deck',
        'https://drive.google.com/dbms-unit-4.pdf',
        'slides',
        'Essential for mid-semester exams.'
      );

      expect(res.message).toBeDefined();
      expect(res.message?.messageType).toBe('resource');
      expect(res.message?.resource?.title).toBe('Unit 4 - Database Normalization Deck');
      expect(res.message?.resource?.category).toBe('slides');
      expect(res.message?.resource?.url).toBe('https://drive.google.com/dbms-unit-4.pdf');
    });
  });
});

describe('ClassSpace UI Component Integration & User Mode', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders welcome empty hero with Create and Join buttons when not enrolled', async () => {
    render(
      <ThemeProvider>
        <AppProvider>
          <ClassSpaceProvider>
            <ClassSpaceView />
          </ClassSpaceProvider>
        </AppProvider>
      </ThemeProvider>
    );

    // Displays welcome hero explaining ClassSpace with 0 fake data
    await waitFor(() => {
      expect(screen.getByText(/Welcome to/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Create ClassSpace/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Join with Code/i })).toBeInTheDocument();
    });

    // Overview, Timetable, My Attendance, Settings tabs must NOT be present in ClassSpace
    expect(screen.queryByText('Overview')).not.toBeInTheDocument();
    expect(screen.queryByText('My Attendance')).not.toBeInTheDocument();
  });

  it('renders only Community and Classmates sub-tabs when user is enrolled', async () => {
    // Seed real user-created workspace
    const creatorUser = { id: 'usr_google_student_demo', email: 'demo@c.edu', name: 'Demo Student' };
    await classSpaceService.createWorkspace(creatorUser, { name: 'Robotics Engineering — Sec A' });

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
      expect(screen.getByText('Robotics Engineering — Sec A')).toBeInTheDocument();
    });

    // Sub-tab navigation contains ONLY Community and Classmates
    expect(screen.getByText(/Community & Notices/i)).toBeInTheDocument();
    expect(screen.getByText('Classmates')).toBeInTheDocument();

    // Redundant duplicate tabs are gone
    expect(screen.queryByText('Overview')).not.toBeInTheDocument();
    expect(screen.queryByText('My Attendance')).not.toBeInTheDocument();
  });

  it('hides ClassSpace navigation tab when in Individual user mode', async () => {
    render(
      <ThemeProvider>
        <AppProvider>
          <Navigation currentTab="dashboard" onSelectTab={() => {}} />
        </AppProvider>
      </ThemeProvider>
    );

    // Default mode is Individual -> ClassSpace tab is hidden
    expect(screen.queryByText('ClassSpace')).not.toBeInTheDocument();
    expect(screen.getByText('Today')).toBeInTheDocument();
    expect(screen.getByText('Timetable')).toBeInTheDocument();
    expect(screen.getByText('Attendance')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('renders User Mode selector in Settings and allows switching between Individual and Class-based', async () => {
    render(
      <ThemeProvider>
        <AppProvider>
          <ClassSpaceProvider>
            <SettingsView />
          </ClassSpaceProvider>
        </AppProvider>
      </ThemeProvider>
    );

    // User Mode heading and options exist
    expect(screen.getByText('User Mode')).toBeInTheDocument();
    expect(screen.getByText(/Type A — Individual/i)).toBeInTheDocument();
    expect(screen.getByText(/Type B — Class-based/i)).toBeInTheDocument();

    // Clicking Type B — Class-based activates Class-based mode and reveals ClassSpace settings
    const classBasedCard = screen.getByText(/Type B — Class-based/i).closest('div')!;
    fireEvent.click(classBasedCard);

    await waitFor(() => {
      expect(screen.getByText(/ClassSpace Management & Membership/i)).toBeInTheDocument();
    });
  });

  it('persists Type B — Class-based user mode across storage reload and page refresh', () => {
    // 1. Simulate saving state with Type B (Class-based)
    const currentState = storageService.loadData();
    currentState.settings.userMode = 'class_based';
    storageService.saveData(currentState);

    // 2. Simulate page refresh / unmount & remount from storage
    const reloaded = storageService.loadData();
    expect(reloaded.settings.userMode).toBe('class_based');

    // 3. Switching to individual mode also persists cleanly
    reloaded.settings.userMode = 'individual';
    storageService.saveData(reloaded);
    const reloaded2 = storageService.loadData();
    expect(reloaded2.settings.userMode).toBe('individual');
  });

  it('synchronizes email between main Settings profile and ClassSpace directory', async () => {
    localStorage.clear();
    // 1. Set a distinct custom student email in profile
    const currentState = storageService.loadData();
    currentState.profile.displayName = 'Aanya Sharma';
    currentState.profile.email = 'aanya.sharma@iitd.ac.in';
    currentState.settings.userMode = 'class_based';
    storageService.saveData(currentState);

    // 2. Create workspace as this student
    const creatorUser = { id: 'usr_google_student_demo', email: 'aanya.sharma@iitd.ac.in', name: 'Aanya Sharma' };
    await classSpaceService.createWorkspace(creatorUser, { name: 'CSE Batch 2026' });

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
      expect(screen.getByText('CSE Batch 2026')).toBeInTheDocument();
    });

    // 3. Switch to Classmates tab
    const classmatesTab = screen.getByText('Classmates');
    fireEvent.click(classmatesTab);

    // 4. Verify the exact email from Main Settings profile is displayed in Community Classmates directory
    await waitFor(() => {
      expect(screen.getByText('aanya.sharma@iitd.ac.in')).toBeInTheDocument();
    });
  });
});
