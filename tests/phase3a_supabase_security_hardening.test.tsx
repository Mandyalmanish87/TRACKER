import { describe, it, expect, beforeEach, vi } from 'vitest';
import { classSpaceService, isLocalId } from '../src/services/classSpaceService';
import * as authServiceModule from '../src/services/authService';
import { AuthUser } from '../src/services/authService';
import { JOIN_CODE_CHARACTERS, isValidJoinCode } from '../src/utils/classSpaceUtils';

describe('Phase 3A — Supabase Security Fix & Local-ID Hardening', () => {
  const LOCAL_STORE_KEY = 'tracker_classspace_data_v1';

  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  // ============================================================================
  // 1. isLocalId Invariance & Validation
  // ============================================================================
  describe('1. isLocalId Invariance & Validation', () => {
    it('correctly identifies local-prefixed IDs as local', () => {
      expect(isLocalId('usr_local_student')).toBe(true);
      expect(isLocalId('usr_local_cr_123')).toBe(true);
      expect(isLocalId('ws_abcdef123')).toBe(true);
      expect(isLocalId('mem_987654321')).toBe(true);
      expect(isLocalId('rule_abc123')).toBe(true);
      expect(isLocalId('ov_xyz789')).toBe(true);
      expect(isLocalId('ovr_xyz789')).toBe(true);
      expect(isLocalId('att_record123')).toBe(true);
      expect(isLocalId('msg_hello456')).toBe(true);
      expect(isLocalId('save_bookmark1')).toBe(true);
      expect(isLocalId('notif_alert99')).toBe(true);
      expect(isLocalId('opt_1_vote')).toBe(true);
      expect(isLocalId('poll_question7')).toBe(true);
      expect(isLocalId('usr_google_student_demo')).toBe(true);
    });

    it('identifies non-UUID arbitrary strings and nil values as local', () => {
      expect(isLocalId('')).toBe(true);
      expect(isLocalId(null)).toBe(true);
      expect(isLocalId(undefined)).toBe(true);
      expect(isLocalId('not-a-uuid')).toBe(true);
      expect(isLocalId('12345')).toBe(true);
      expect(isLocalId('user-alpha-bravo')).toBe(true);
    });

    it('identifies genuine standard UUIDs as cloud (non-local)', () => {
      expect(isLocalId('c56a4180-65aa-42ec-a945-5fd21dec0538')).toBe(false);
      expect(isLocalId('123e4567-e89b-12d3-a456-426614174000')).toBe(false);
      expect(isLocalId('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11')).toBe(false);
      expect(isLocalId('6ba7b810-9dad-11d1-80b4-00c04fd430c8')).toBe(false);
    });
  });

  // ============================================================================
  // 2. Interception of Non-UUID IDs (Preventing Postgres UUID Syntax Errors)
  // ============================================================================
  describe('2. Non-UUID Supabase Query Interception', () => {
    it('does not send non-UUID user IDs to Supabase in getWorkspacesForUser', async () => {
      const fromSpy = vi.fn();
      const mockSupabase = { from: fromSpy } as any;

      vi.spyOn(authServiceModule, 'getSupabaseClient').mockReturnValue(mockSupabase);

      // Seed local storage with a local workspace
      const localData = {
        workspaces: [
          {
            id: 'ws_local_1',
            name: 'Local Class 1',
            joinCode: 'LC001',
            createdBy: 'usr_local_student',
            createdAt: '2026-10-24T00:00:00.000Z',
            updatedAt: '2026-10-24T00:00:00.000Z',
          },
        ],
        members: [
          {
            id: 'mem_1',
            workspaceId: 'ws_local_1',
            userId: 'usr_local_student',
            role: 'member' as const,
            displayName: 'Local Student',
            joinedAt: '2026-10-24T00:00:00.000Z',
          },
        ],
        rules: [],
        overrides: [],
        attendanceRecords: [],
        messages: [],
        savedMessages: [],
        notifications: [],
        profiles: {},
      };
      localStorage.setItem(LOCAL_STORE_KEY, JSON.stringify(localData));

      // Call with local user ID
      const workspaces = await classSpaceService.getWorkspacesForUser('usr_local_student');

      // Verified: Supabase was NOT called with non-UUID 'usr_local_student'
      expect(fromSpy).not.toHaveBeenCalled();
      expect(workspaces.length).toBe(1);
      expect(workspaces[0].id).toBe('ws_local_1');
      expect(workspaces[0].name).toBe('Local Class 1');
    });

    it('does not query Supabase for members, schedule, attendance, messages with local workspace IDs', async () => {
      const fromSpy = vi.fn();
      const mockSupabase = { from: fromSpy } as any;

      vi.spyOn(authServiceModule, 'getSupabaseClient').mockReturnValue(mockSupabase);

      // Seed local storage with workspace and items
      const localData = {
        workspaces: [
          {
            id: 'ws_local_offline',
            name: 'Offline Space',
            joinCode: 'OFF01',
            createdBy: 'usr_local_cr',
            createdAt: '2026-10-24T00:00:00.000Z',
            updatedAt: '2026-10-24T00:00:00.000Z',
          },
        ],
        members: [
          {
            id: 'mem_local_1',
            workspaceId: 'ws_local_offline',
            userId: 'usr_local_cr',
            role: 'cr' as const,
            displayName: 'CR Local',
            joinedAt: '2026-10-24T00:00:00.000Z',
          },
        ],
        rules: [
          {
            id: 'rule_1',
            workspaceId: 'ws_local_offline',
            subjectName: 'Distributed Systems',
            dayOfWeek: 1,
            startTime: '09:00',
            endTime: '10:00',
            createdBy: 'usr_local_cr',
            createdAt: '2026-10-24T00:00:00.000Z',
            updatedAt: '2026-10-24T00:00:00.000Z',
          },
        ],
        overrides: [],
        attendanceRecords: [
          {
            id: 'att_1',
            workspaceId: 'ws_local_offline',
            userId: 'usr_local_student',
            occurrenceKey: 'rule_1_2026-10-26',
            date: '2026-10-26',
            status: 'present' as const,
            createdAt: '2026-10-24T00:00:00.000Z',
            updatedAt: '2026-10-24T00:00:00.000Z',
          },
        ],
        messages: [
          {
            id: 'msg_1',
            workspaceId: 'ws_local_offline',
            senderId: 'usr_local_cr',
            senderName: 'CR Local',
            content: 'Welcome to offline ClassSpace',
            reactions: {},
            isPinned: false,
            isEdited: false,
            isDeleted: false,
            createdAt: '2026-10-24T00:00:00.000Z',
            updatedAt: '2026-10-24T00:00:00.000Z',
          },
        ],
        savedMessages: [],
        notifications: [],
        profiles: {},
      };
      localStorage.setItem(LOCAL_STORE_KEY, JSON.stringify(localData));

      // Test getMembers
      const members = await classSpaceService.getMembers('ws_local_offline');
      expect(fromSpy).not.toHaveBeenCalled();
      expect(members.length).toBe(1);

      // Test getScheduleData
      const schedule = await classSpaceService.getScheduleData('ws_local_offline');
      expect(fromSpy).not.toHaveBeenCalled();
      expect(schedule.rules.length).toBe(1);

      // Test getAttendanceRecords
      const attendance = await classSpaceService.getAttendanceRecords('ws_local_offline', 'usr_local_student');
      expect(fromSpy).not.toHaveBeenCalled();
      expect(attendance.length).toBe(1);

      // Test getMessages
      const messages = await classSpaceService.getMessages('ws_local_offline');
      expect(fromSpy).not.toHaveBeenCalled();
      expect(messages.length).toBe(1);
    });

    it('intercepts local IDs across roles, profiles, avatars, notifications, and saved messages', async () => {
      const fromSpy = vi.fn();
      const storageSpy = { from: vi.fn() };
      const mockSupabase = { from: fromSpy, storage: storageSpy } as any;

      vi.spyOn(authServiceModule, 'getSupabaseClient').mockReturnValue(mockSupabase);

      const localData = {
        workspaces: [
          {
            id: 'ws_local_test',
            name: 'Local Test Space',
            joinCode: 'LT001',
            createdBy: 'usr_local_cr',
            createdAt: '2026-10-24T00:00:00.000Z',
            updatedAt: '2026-10-24T00:00:00.000Z',
          },
        ],
        members: [
          {
            id: 'mem_local_1',
            workspaceId: 'ws_local_test',
            userId: 'usr_local_cr',
            role: 'cr' as const,
            displayName: 'CR User',
            joinedAt: '2026-10-24T00:00:00.000Z',
          },
          {
            id: 'mem_local_2',
            workspaceId: 'ws_local_test',
            userId: 'usr_local_student',
            role: 'member' as const,
            displayName: 'Student User',
            joinedAt: '2026-10-24T00:00:00.000Z',
          },
        ],
        rules: [],
        overrides: [],
        attendanceRecords: [],
        messages: [],
        savedMessages: [],
        notifications: [],
        profiles: {
          usr_local_student: {
            userId: 'usr_local_student',
            displayName: 'Student Local',
            notificationPreferences: {
              timetableAlerts: true,
              extraClasses: true,
              cancellations: true,
              communityReplies: true,
            },
          },
        },
      };
      localStorage.setItem(LOCAL_STORE_KEY, JSON.stringify(localData));

      // 1. updateMemberRole with local IDs (acting user is CR, target is student)
      const roleRes = await classSpaceService.updateMemberRole('ws_local_test', 'usr_local_cr', 'usr_local_student', 'co_admin');
      expect(fromSpy).not.toHaveBeenCalled();
      expect(roleRes.error).toBeUndefined();
      expect(roleRes.success).toBe(true);

      // 2. getUserProfile with local ID
      const profile = await classSpaceService.getUserProfile('usr_local_student');
      expect(fromSpy).not.toHaveBeenCalled();
      expect(profile.displayName).toBe('Student Local');

      // 3. updateUserProfile with local ID
      const updateRes = await classSpaceService.updateUserProfile('usr_local_student', { displayName: 'Updated Local' });
      expect(fromSpy).not.toHaveBeenCalled();
      expect(updateRes.profile?.displayName).toBe('Updated Local');

      // 4. markNotificationRead with local ID
      await classSpaceService.markNotificationRead('notif_local_123');
      expect(fromSpy).not.toHaveBeenCalled();

      // 5. toggleSaveMessage with local IDs
      const saveRes = await classSpaceService.toggleSaveMessage('ws_local_test', 'usr_local_student', 'msg_local_1');
      expect(fromSpy).not.toHaveBeenCalled();
      expect(saveRes.isSaved).toBe(true);

      // 6. uploadAvatar with local ID (uses local FileReader fallback, not Supabase storage)
      const fakeFile = new File(['test'], 'avatar.png', { type: 'image/png' });
      const avatarRes = await classSpaceService.uploadAvatar('usr_local_student', fakeFile);
      expect(storageSpy.from).not.toHaveBeenCalled();
      expect(avatarRes.avatarUrl).toBeDefined();

      // 7. deleteWorkspace with local IDs
      const delRes = await classSpaceService.deleteWorkspace('ws_local_test', 'usr_local_cr');
      expect(fromSpy).not.toHaveBeenCalled();
      expect(delRes.success).toBe(true);
    });
  });

  // ============================================================================
  // 3. Database RPC Wiring, Error Handling & Fallback Hardening
  // ============================================================================
  describe('3. Database RPC Wiring, Error Handling & Fallback Hardening', () => {
    it('uses lookup_workspace_by_join_code RPC when Supabase is active', async () => {
      const rpcSpy = vi.fn().mockResolvedValue({
        data: [
          {
            id: 'b819f71c-3b98-4c12-b91c-7fd4c2ef6571',
            name: 'Cloud Database Systems',
            department: 'Computer Science',
            section: 'A',
            batch: '2026',
            description: 'Cloud workspace preview',
          },
        ],
        error: null,
      });

      const mockSupabase = { rpc: rpcSpy } as any;
      vi.spyOn(authServiceModule, 'getSupabaseClient').mockReturnValue(mockSupabase);

      const res = await classSpaceService.lookupWorkspaceByCode('CKD26');

      expect(rpcSpy).toHaveBeenCalledWith('lookup_workspace_by_join_code', {
        p_join_code: 'CKD26',
      });
      expect(res.workspace).toBeDefined();
      expect(res.workspace?.id).toBe('b819f71c-3b98-4c12-b91c-7fd4c2ef6571');
      expect(res.workspace?.name).toBe('Cloud Database Systems');
    });

    it('does not return misleading local workspace when cloud lookup returns an error', async () => {
      // Seed a local workspace with code CKD26
      const localData = {
        workspaces: [
          {
            id: 'ws_local_deceptive',
            name: 'Deceptive Local Space',
            joinCode: 'CKD26',
            createdBy: 'usr_local_cr',
            createdAt: '2026-10-24T00:00:00.000Z',
            updatedAt: '2026-10-24T00:00:00.000Z',
          },
        ],
        members: [],
        rules: [],
        overrides: [],
        attendanceRecords: [],
        messages: [],
        savedMessages: [],
        notifications: [],
        profiles: {},
      };
      localStorage.setItem(LOCAL_STORE_KEY, JSON.stringify(localData));

      // Mock cloud lookup error
      const rpcSpy = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Supabase permission denied' },
      });
      const mockSupabase = { rpc: rpcSpy } as any;
      vi.spyOn(authServiceModule, 'getSupabaseClient').mockReturnValue(mockSupabase);

      const res = await classSpaceService.lookupWorkspaceByCode('CKD26');

      expect(rpcSpy).toHaveBeenCalledWith('lookup_workspace_by_join_code', {
        p_join_code: 'CKD26',
      });
      // Verified: returns cloud error and does NOT return the local workspace
      expect(res.error).toBe('Supabase permission denied');
      expect(res.workspace).toBeUndefined();
    });

    it('does not return misleading local workspace when cloud lookup network request throws', async () => {
      const localData = {
        workspaces: [
          {
            id: 'ws_local_deceptive',
            name: 'Deceptive Local Space',
            joinCode: 'CKD26',
            createdBy: 'usr_local_cr',
            createdAt: '2026-10-24T00:00:00.000Z',
            updatedAt: '2026-10-24T00:00:00.000Z',
          },
        ],
        members: [],
        rules: [],
        overrides: [],
        attendanceRecords: [],
        messages: [],
        savedMessages: [],
        notifications: [],
        profiles: {},
      };
      localStorage.setItem(LOCAL_STORE_KEY, JSON.stringify(localData));

      const rpcSpy = vi.fn().mockRejectedValue(new Error('Network error: server unreachable'));
      const mockSupabase = { rpc: rpcSpy } as any;
      vi.spyOn(authServiceModule, 'getSupabaseClient').mockReturnValue(mockSupabase);

      const res = await classSpaceService.lookupWorkspaceByCode('CKD26');

      expect(rpcSpy).toHaveBeenCalled();
      expect(res.error).toMatch(/Network error: server unreachable/i);
      expect(res.workspace).toBeUndefined();
    });

    it('uses join_class_workspace RPC for verified cloud users', async () => {
      const cloudUser: AuthUser = {
        id: '92d1c68e-9407-4bf6-90c0-67c6999a46ea',
        email: 'cloud.student@university.edu',
        name: 'Cloud Student',
        avatarUrl: 'https://avatar.test/student.png',
      };

      const rpcSpy = vi.fn().mockResolvedValue({
        data: {
          workspace: {
            id: 'b819f71c-3b98-4c12-b91c-7fd4c2ef6571',
            name: 'Cloud Database Systems',
            department: 'Computer Science',
            section: 'A',
            batch: '2026',
            description: 'Cloud workspace preview',
            join_code: 'CKD26',
            created_by: '11111111-1111-1111-1111-111111111111',
            created_at: '2026-10-24T00:00:00.000Z',
            updated_at: '2026-10-24T00:00:00.000Z',
          },
          member: {
            id: '33333333-3333-3333-3333-333333333333',
            workspace_id: 'b819f71c-3b98-4c12-b91c-7fd4c2ef6571',
            user_id: cloudUser.id,
            role: 'member',
            display_name: 'Cloud Student',
            avatar_url: 'https://avatar.test/student.png',
            joined_at: '2026-10-24T00:00:00.000Z',
          },
        },
        error: null,
      });

      const mockSupabase = { rpc: rpcSpy } as any;
      vi.spyOn(authServiceModule, 'getSupabaseClient').mockReturnValue(mockSupabase);

      const joinRes = await classSpaceService.joinWorkspaceByCode(cloudUser, 'CKD26');

      expect(rpcSpy).toHaveBeenCalledWith('join_class_workspace', {
        p_join_code: 'CKD26',
        p_display_name: 'Cloud Student',
        p_avatar_url: 'https://avatar.test/student.png',
      });
      expect(joinRes.error).toBeUndefined();
      expect(joinRes.workspace?.id).toBe('b819f71c-3b98-4c12-b91c-7fd4c2ef6571');
      expect(joinRes.member?.role).toBe('member');
    });

    it('does not fall back to local storage when cloud join RPC fails for a genuine cloud user', async () => {
      // Seed local storage with a matching workspace code
      const localData = {
        workspaces: [
          {
            id: 'ws_local_offline_dup',
            name: 'Local Offline Space',
            joinCode: 'CKD26',
            createdBy: 'usr_local_cr',
            createdAt: '2026-10-24T00:00:00.000Z',
            updatedAt: '2026-10-24T00:00:00.000Z',
          },
        ],
        members: [],
        rules: [],
        overrides: [],
        attendanceRecords: [],
        messages: [],
        savedMessages: [],
        notifications: [],
        profiles: {},
      };
      localStorage.setItem(LOCAL_STORE_KEY, JSON.stringify(localData));

      const cloudUser: AuthUser = {
        id: '92d1c68e-9407-4bf6-90c0-67c6999a46ea',
        email: 'cloud.student@university.edu',
        name: 'Cloud Student',
        isSimulated: false,
      };

      // Mock cloud join returning an explicit error
      const rpcSpy = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Database constraint violation' },
      });
      const mockSupabase = { rpc: rpcSpy } as any;
      vi.spyOn(authServiceModule, 'getSupabaseClient').mockReturnValue(mockSupabase);

      const joinRes = await classSpaceService.joinWorkspaceByCode(cloudUser, 'CKD26');

      expect(rpcSpy).toHaveBeenCalled();
      expect(joinRes.error).toBe('Database constraint violation');
      expect(joinRes.workspace).toBeUndefined();
      expect(joinRes.member).toBeUndefined();

      // Verify user was NOT added to local storage
      const stored = JSON.parse(localStorage.getItem(LOCAL_STORE_KEY)!);
      expect(stored.members.length).toBe(0);
    });

    it('does not fall back to local storage when cloud join RPC throws an exception for a genuine cloud user', async () => {
      const localData = {
        workspaces: [
          {
            id: 'ws_local_offline_dup',
            name: 'Local Offline Space',
            joinCode: 'CKD26',
            createdBy: 'usr_local_cr',
            createdAt: '2026-10-24T00:00:00.000Z',
            updatedAt: '2026-10-24T00:00:00.000Z',
          },
        ],
        members: [],
        rules: [],
        overrides: [],
        attendanceRecords: [],
        messages: [],
        savedMessages: [],
        notifications: [],
        profiles: {},
      };
      localStorage.setItem(LOCAL_STORE_KEY, JSON.stringify(localData));

      const cloudUser: AuthUser = {
        id: '92d1c68e-9407-4bf6-90c0-67c6999a46ea',
        email: 'cloud.student@university.edu',
        name: 'Cloud Student',
        isSimulated: false,
      };

      const rpcSpy = vi.fn().mockRejectedValue(new Error('Connection terminated unexpectedly'));
      const mockSupabase = { rpc: rpcSpy } as any;
      vi.spyOn(authServiceModule, 'getSupabaseClient').mockReturnValue(mockSupabase);

      const joinRes = await classSpaceService.joinWorkspaceByCode(cloudUser, 'CKD26');

      expect(rpcSpy).toHaveBeenCalled();
      expect(joinRes.error).toMatch(/Connection terminated unexpectedly/i);
      expect(joinRes.workspace).toBeUndefined();

      // Verify no local member was created
      const stored = JSON.parse(localStorage.getItem(LOCAL_STORE_KEY)!);
      expect(stored.members.length).toBe(0);
    });

    it('does not invoke RPC join_class_workspace for local users, joining locally instead', async () => {
      const rpcSpy = vi.fn();
      const mockSupabase = { rpc: rpcSpy } as any;
      vi.spyOn(authServiceModule, 'getSupabaseClient').mockReturnValue(mockSupabase);

      const localUser: AuthUser = {
        id: 'usr_local_joiner',
        email: 'joiner@local.dev',
        name: 'Local Joiner',
        isSimulated: true,
      };

      // Seed local workspace
      const localData = {
        workspaces: [
          {
            id: 'ws_local_code_1',
            name: 'Local Robotics',
            joinCode: 'RMB26',
            createdBy: 'usr_local_cr',
            createdAt: '2026-10-24T00:00:00.000Z',
            updatedAt: '2026-10-24T00:00:00.000Z',
          },
        ],
        members: [],
        rules: [],
        overrides: [],
        attendanceRecords: [],
        messages: [],
        savedMessages: [],
        notifications: [],
        profiles: {},
      };
      localStorage.setItem(LOCAL_STORE_KEY, JSON.stringify(localData));

      const joinRes = await classSpaceService.joinWorkspaceByCode(localUser, 'RMB26');

      // RPC was NOT called because user is local
      expect(rpcSpy).not.toHaveBeenCalled();
      expect(joinRes.error).toBeUndefined();
      expect(joinRes.workspace?.id).toBe('ws_local_code_1');
      expect(joinRes.member?.userId).toBe('usr_local_joiner');
      expect(joinRes.member?.role).toBe('member');
    });

    it('does not create local workspace when cloud creation throws for a genuine cloud user', async () => {
      const cloudCR: AuthUser = {
        id: '92d1c68e-9407-4bf6-90c0-67c6999a46ea',
        email: 'cr.cloud@university.edu',
        name: 'Cloud CR',
        isSimulated: false,
      };

      const fromSpy = vi.fn().mockImplementation(() => {
        throw new Error('Supabase network error during workspace insert');
      });
      const mockSupabase = { from: fromSpy } as any;
      vi.spyOn(authServiceModule, 'getSupabaseClient').mockReturnValue(mockSupabase);

      const createRes = await classSpaceService.createWorkspace(cloudCR, {
        name: 'Cloud Advanced Networks',
        department: 'CS',
        batch: '2026',
      });

      expect(fromSpy).toHaveBeenCalled();
      expect(createRes.error).toMatch(/Supabase network error during workspace insert/i);
      expect(createRes.workspace).toBeUndefined();

      // Verified: no local workspace was silently inserted
      const stored = JSON.parse(localStorage.getItem(LOCAL_STORE_KEY) || '{"workspaces":[]}');
      expect(stored.workspaces.length).toBe(0);
    });

    it('creates a cloud workspace and initial owner membership using only valid database columns (no email in class_members insert)', async () => {
      const cloudCR: authServiceModule.AuthUser = {
        id: '92d1c68e-9407-4bf6-90c0-67c6999a46ea',
        email: 'prof.cr@university.edu',
        name: 'Professor Jane CR',
        isSimulated: false,
      };

      const insertedWorkspaceRow = {
        id: 'b819f71c-3b98-4c12-b91c-7fd4c2ef6571',
        name: 'Cloud Distributed Systems',
        institution: 'Tech Institute',
        department: 'CS',
        section: 'A',
        batch: '2026',
        description: 'Advanced distributed systems cohort',
        join_code: '4B8XY',
        created_by: cloudCR.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const insertedMemberRow = {
        id: 'e2a3c4d5-6789-4abc-8def-0123456789ab',
        workspace_id: 'b819f71c-3b98-4c12-b91c-7fd4c2ef6571',
        user_id: cloudCR.id,
        role: 'owner',
        display_name: 'Professor Jane CR',
        avatar_url: null,
        is_muted: false,
        joined_at: new Date().toISOString(),
      };

      let capturedMemberPayload: any = null;
      let capturedWorkspacePayload: any = null;

      const mockSupabase = {
        from: vi.fn().mockImplementation((table: string) => {
          if (table === 'class_workspaces') {
            return {
              insert: vi.fn().mockImplementation((payload: any) => {
                capturedWorkspacePayload = payload;
                return {
                  select: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({ data: insertedWorkspaceRow, error: null }),
                  }),
                };
              }),
            };
          }
          if (table === 'class_members') {
            return {
              insert: vi.fn().mockImplementation((payload: any) => {
                capturedMemberPayload = payload;
                return {
                  select: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({ data: insertedMemberRow, error: null }),
                  }),
                };
              }),
            };
          }
          throw new Error(`Unexpected table: ${table}`);
        }),
      } as any;

      vi.spyOn(authServiceModule, 'getSupabaseClient').mockReturnValue(mockSupabase);

      const createRes = await classSpaceService.createWorkspace(cloudCR, {
        name: 'Cloud Distributed Systems',
        institution: 'Tech Institute',
        department: 'CS',
        section: 'A',
        batch: '2026',
        description: 'Advanced distributed systems cohort',
      });

      // 1. Success assertions
      expect(createRes.error).toBeUndefined();
      expect(createRes.workspace).toBeDefined();
      expect(createRes.workspace?.id).toBe('b819f71c-3b98-4c12-b91c-7fd4c2ef6571');
      expect(createRes.member).toBeDefined();
      expect(createRes.member?.role).toBe('owner');

      // 2. Strict database schema payload assertions
      expect(capturedWorkspacePayload).toBeDefined();
      expect(capturedWorkspacePayload.name).toBe('Cloud Distributed Systems');
      expect(capturedWorkspacePayload.institution).toBe('Tech Institute');
      expect(capturedWorkspacePayload.created_by).toBe(cloudCR.id);

      expect(capturedMemberPayload).toBeDefined();
      expect(capturedMemberPayload.workspace_id).toBe('b819f71c-3b98-4c12-b91c-7fd4c2ef6571');
      expect(capturedMemberPayload.user_id).toBe(cloudCR.id);
      expect(capturedMemberPayload.role).toBe('owner');
      expect(capturedMemberPayload.display_name).toBe('Professor Jane CR');

      // CRITICAL: Ensure 'email' column is NOT sent in the database insert payload
      expect(capturedMemberPayload).not.toHaveProperty('email');
      expect(Object.keys(capturedMemberPayload)).not.toContain('email');

      // 3. Current user session preserves email locally for client UI
      expect(createRes.member?.email).toBe('prof.cr@university.edu');
    });

    it('creates a cloud workspace atomically via create_class_workspace RPC when available', async () => {
      const cloudCR: authServiceModule.AuthUser = {
        id: '92d1c68e-9407-4bf6-90c0-67c6999a46ea',
        email: 'prof.atomic@university.edu',
        name: 'Professor Atomic CR',
        isSimulated: false,
      };

      let capturedRpcParams: any = null;
      const mockSupabase = {
        rpc: vi.fn().mockImplementation((fnName: string, params: any) => {
          if (fnName === 'create_class_workspace') {
            capturedRpcParams = params;
            return Promise.resolve({
              data: {
                workspace: {
                  id: 'a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d',
                  name: params.p_name,
                  institution: params.p_institution,
                  department: params.p_department,
                  section: params.p_section,
                  batch: params.p_batch,
                  description: params.p_description,
                  join_code: 'AT001',
                  created_by: cloudCR.id,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                },
                member: {
                  id: 'm1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d',
                  workspace_id: 'a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d',
                  user_id: cloudCR.id,
                  role: 'owner',
                  display_name: params.p_display_name,
                  avatar_url: params.p_avatar_url,
                  is_muted: false,
                  joined_at: new Date().toISOString(),
                },
              },
              error: null,
            });
          }
          throw new Error(`Unexpected RPC: ${fnName}`);
        }),
      } as any;

      vi.spyOn(authServiceModule, 'getSupabaseClient').mockReturnValue(mockSupabase);

      const res = await classSpaceService.createWorkspace(cloudCR, {
        name: 'Atomic Cloud Workspace',
        institution: 'MIT',
        department: 'EECS',
        section: '6-3',
        batch: '2026',
        description: 'Atomic creation test',
      });

      expect(res.error).toBeUndefined();
      expect(res.workspace).toBeDefined();
      expect(res.workspace?.id).toBe('a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d');
      expect(res.workspace?.institution).toBe('MIT');
      expect(res.workspace?.college).toBe('MIT');
      expect(res.member?.role).toBe('owner');
      expect(res.member?.email).toBe('prof.atomic@university.edu');

      expect(capturedRpcParams).toEqual({
        p_name: 'Atomic Cloud Workspace',
        p_institution: 'MIT',
        p_department: 'EECS',
        p_section: '6-3',
        p_batch: '2026',
        p_description: 'Atomic creation test',
        p_display_name: 'Professor Atomic CR',
        p_avatar_url: null,
      });
    });

    it('cleans up dangling workspace when direct member insert fails in fallback mode', async () => {
      const cloudCR: authServiceModule.AuthUser = {
        id: '92d1c68e-9407-4bf6-90c0-67c6999a46ea',
        email: 'prof.cleanup@university.edu',
        name: 'Professor Cleanup',
        isSimulated: false,
      };

      let deletedWorkspaceId: string | null = null;

      const mockSupabase = {
        from: vi.fn().mockImplementation((table: string) => {
          if (table === 'class_workspaces') {
            return {
              insert: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: {
                      id: 'orphan-workspace-uuid-1234',
                      name: 'Orphan Space',
                      created_by: cloudCR.id,
                      created_at: new Date().toISOString(),
                      updated_at: new Date().toISOString(),
                    },
                    error: null,
                  }),
                }),
              }),
              delete: vi.fn().mockReturnValue({
                eq: vi.fn().mockImplementation((col: string, val: string) => {
                  if (col === 'id') deletedWorkspaceId = val;
                  return Promise.resolve({ error: null });
                }),
              }),
            };
          }
          if (table === 'class_members') {
            return {
              insert: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: null,
                    error: { message: 'RLS policy violation for class_members' },
                  }),
                }),
              }),
            };
          }
          throw new Error(`Unexpected table: ${table}`);
        }),
      } as any;

      vi.spyOn(authServiceModule, 'getSupabaseClient').mockReturnValue(mockSupabase);

      const res = await classSpaceService.createWorkspace(cloudCR, {
        name: 'Orphan Space',
      });

      expect(res.error).toMatch(/RLS policy violation for class_members/);
      expect(res.workspace).toBeUndefined();
      expect(deletedWorkspaceId).toBe('orphan-workspace-uuid-1234');
    });

    it('fails fast with formatted error and does NOT fall back to direct table insert when RPC returns unexpected server error', async () => {
      const cloudCR: authServiceModule.AuthUser = {
        id: '92d1c68e-9407-4bf6-90c0-67c6999a46ea',
        email: 'prof.error@university.edu',
        name: 'Professor Error',
        isSimulated: false,
      };

      const fromSpy = vi.fn();
      const mockSupabase = {
        rpc: vi.fn().mockResolvedValue({
          data: null,
          error: {
            code: '42501',
            message: 'permission denied for schema public',
            details: 'Role authenticated does not have USAGE on schema public',
            hint: 'Grant usage on schema public to authenticated',
          },
        }),
        from: fromSpy,
      } as any;

      vi.spyOn(authServiceModule, 'getSupabaseClient').mockReturnValue(mockSupabase);

      const res = await classSpaceService.createWorkspace(cloudCR, {
        name: 'Perm Denied Space',
      });

      expect(res.workspace).toBeUndefined();
      expect(res.error).toContain('permission denied for schema public');
      expect(res.error).toContain('(code: 42501)');
      expect(res.error).toContain('details: Role authenticated does not have USAGE on schema public');
      expect(res.error).toContain('hint: Grant usage on schema public to authenticated');

      // CRITICAL: Ensure fallback direct table insert was NEVER executed
      expect(fromSpy).not.toHaveBeenCalled();
    });

    it('rejects join-code rotation when database RLS denies update (0 rows returned)', async () => {
      const workspaceUuid = 'b819f71c-3b98-4c12-b91c-7fd4c2ef6571';
      const userUuid = '92d1c68e-9407-4bf6-90c0-67c6999a46ea';

      // Seed local storage with a workspace that deceptively marks user as 'cr' locally
      const localData = {
        workspaces: [
          {
            id: workspaceUuid,
            name: 'Cloud Database Systems',
            joinCode: 'OLD26',
            createdBy: 'other-user-uuid',
            createdAt: '2026-10-24T00:00:00.000Z',
            updatedAt: '2026-10-24T00:00:00.000Z',
          },
        ],
        members: [
          {
            id: 'mem_local_hack',
            workspaceId: workspaceUuid,
            userId: userUuid,
            role: 'cr' as const,
            displayName: 'Hacked Local Role',
            joinedAt: '2026-10-24T00:00:00.000Z',
          },
        ],
        rules: [],
        overrides: [],
        attendanceRecords: [],
        messages: [],
        savedMessages: [],
        notifications: [],
        profiles: {},
      };
      localStorage.setItem(LOCAL_STORE_KEY, JSON.stringify(localData));

      // Mock PostgREST update returning 0 rows because database RLS rejected the update
      const selectSpy = vi.fn().mockResolvedValue({ data: [], error: null });
      const eqSpy = vi.fn().mockReturnValue({ select: selectSpy });
      const updateSpy = vi.fn().mockReturnValue({ eq: eqSpy });
      const fromSpy = vi.fn().mockReturnValue({ update: updateSpy });
      const mockSupabase = { from: fromSpy } as any;

      vi.spyOn(authServiceModule, 'getSupabaseClient').mockReturnValue(mockSupabase);

      const rotateRes = await classSpaceService.rotateJoinCode(workspaceUuid, userUuid);

      expect(fromSpy).toHaveBeenCalledWith('class_workspaces');
      expect(rotateRes.error).toMatch(/Unauthorized: Only the Class Representative \(CR\) or Owner can rotate the join code/i);
      expect(rotateRes.newCode).toBeUndefined();

      // Ensure local cache was NOT updated
      const stored = JSON.parse(localStorage.getItem(LOCAL_STORE_KEY)!);
      expect(stored.workspaces[0].joinCode).toBe('OLD26');
    });

    it('allows join-code rotation when database RLS update succeeds and returns updated row', async () => {
      const workspaceUuid = 'b819f71c-3b98-4c12-b91c-7fd4c2ef6571';
      const userUuid = '92d1c68e-9407-4bf6-90c0-67c6999a46ea';

      const selectSpy = vi.fn().mockResolvedValue({
        data: [{ id: workspaceUuid, join_code: 'NEW26' }],
        error: null,
      });
      const eqSpy = vi.fn().mockReturnValue({ select: selectSpy });
      const updateSpy = vi.fn().mockReturnValue({ eq: eqSpy });
      const fromSpy = vi.fn().mockReturnValue({ update: updateSpy });
      const mockSupabase = { from: fromSpy } as any;

      vi.spyOn(authServiceModule, 'getSupabaseClient').mockReturnValue(mockSupabase);

      const rotateRes = await classSpaceService.rotateJoinCode(workspaceUuid, userUuid);

      expect(fromSpy).toHaveBeenCalledWith('class_workspaces');
      expect(rotateRes.error).toBeUndefined();
      expect(rotateRes.newCode).toBeDefined();
      expect(rotateRes.newCode).toHaveLength(5);
    });
  });

  // ============================================================================
  // 4. Offline & Local Storage Preservation
  // ============================================================================
  describe('4. Local-First & Offline Data Preservation', () => {
    it('creates local workspace and persists all class components offline', async () => {
      const crUser: AuthUser = {
        id: 'usr_local_cr_offline',
        email: 'cr@offline.edu',
        name: 'Offline CR',
        isSimulated: true,
      };

      // 1. Create workspace
      const created = await classSpaceService.createWorkspace(crUser, {
        name: 'Offline Software Eng 2026',
        department: 'CS',
        batch: '2026',
      });

      expect(created.error).toBeUndefined();
      expect(created.workspace).toBeDefined();
      expect(created.workspace?.id).toMatch(/^ws_/);
      expect(created.member?.role).toBe('owner');

      const wsId = created.workspace!.id;

      // 2. Add timetable rule locally
      const ruleRes = await classSpaceService.addTimetableRule(wsId, 'cr', {
        subjectName: 'Compilers',
        subjectCode: 'CS401',
        subjectColor: '#3B82F6',
        dayOfWeek: 2,
        startTime: '10:00',
        endTime: '11:00',
        createdBy: crUser.id,
      });

      expect(ruleRes.error).toBeUndefined();
      expect(ruleRes.rule?.subjectName).toBe('Compilers');

      // 3. Mark attendance locally
      const attRes = await classSpaceService.setAttendanceRecord(
        wsId,
        crUser.id,
        `${ruleRes.rule!.id}_2026-10-27`,
        '2026-10-27',
        'present'
      );
      expect(attRes.error).toBeUndefined();
      expect(attRes.record?.status).toBe('present');

      // 4. Send message locally
      const msgRes = await classSpaceService.sendMessage(
        wsId,
        { id: crUser.id, name: crUser.name || 'Offline CR', role: 'cr' },
        'Initial offline class note'
      );
      expect(msgRes.error).toBeUndefined();
      expect(msgRes.message?.content).toBe('Initial offline class note');

      // Verify that getWorkspacesForUser returns it
      const userWorkspaces = await classSpaceService.getWorkspacesForUser(crUser.id);
      expect(userWorkspaces.length).toBe(1);
      expect(userWorkspaces[0].name).toBe('Offline Software Eng 2026');
    });
  });

  // ============================================================================
  // 5. Database Schema & Privilege Policy Invariants (Static SQL Inspection)
  // ============================================================================
  describe('5. SQL Privilege Grants, RLS Invariants & Role Hardening', () => {
    it('verifies SQL migration enforces SET search_path = public, REVOKE and GRANT on all 5 SECURITY DEFINER functions', async () => {
      // NOTE: This test asserts static SQL guarantees in the migration file.
      // Real live PostgreSQL runtime execution will occur when the migration is deployed to remote Supabase.
      const fs = await import('fs');
      const sqlContent = fs.readFileSync('supabase/migrations/20261022_classspace_schema.sql', 'utf8');

      const securityDefinerFns = [
        'is_class_member',
        'is_class_admin',
        'is_class_cr',
        'lookup_workspace_by_join_code',
        'join_class_workspace',
      ];

      // 1. Verify EACH of the 5 security definer functions has explicit SET search_path = public
      for (const fn of securityDefinerFns) {
        const fnPattern = new RegExp(
          `create\\s+or\\s+replace\\s+function\\s+public\\.${fn}\\b[\\s\\S]*?security\\s+definer[\\s\\S]*?set\\s+search_path\\s*=\\s*public[\\s\\S]*?as\\s*\\$\\$`,
          'i'
        );
        expect(sqlContent).toMatch(fnPattern);
      }

      // 2. Verify EACH function explicitly revokes from public/anon and grants to authenticated/service_role
      for (const fn of securityDefinerFns) {
        const revokePattern = new RegExp(
          `revoke\\s+all\\s+on\\s+function\\s+public\\.${fn}\\b[\\s\\S]*?from\\s+public\\s*,\\s*anon\\s*;`,
          'i'
        );
        expect(sqlContent).toMatch(revokePattern);

        const grantPattern = new RegExp(
          `grant\\s+execute\\s+on\\s+function\\s+public\\.${fn}\\b[\\s\\S]*?to\\s+authenticated\\s*,\\s*service_role\\s*;`,
          'i'
        );
        expect(sqlContent).toMatch(grantPattern);
      }

      // 3. Permissive "join_code is not null" must be absent from class_workspaces SELECT policy
      expect(sqlContent).not.toMatch(/join_code\s+is\s+not\s+null/i);

      // 4. class_profiles must be restricted to owner and common workspace members (not global public select)
      expect(sqlContent).not.toContain('create policy "Anyone can read member profiles"');
      expect(sqlContent).toContain('create policy "Users can view their own profile or co-members can view profile"');

      // 5. Avatar storage update must contain with check clause
      expect(sqlContent).toContain('create policy "Users can update their own avatar"');
      expect(sqlContent).toMatch(/with\s+check\s*\(\s*bucket_id\s*=\s*'classspace-avatars'/);
    });

    it('verifies frontend and SQL agree on valid join-code character set and length', async () => {
      const fs = await import('fs');
      const sqlContent = fs.readFileSync('supabase/migrations/20261022_classspace_schema.sql', 'utf8');

      // 1. Frontend rule: exactly 31 allowed characters (excluding 0, O, 1, I, L)
      expect(JOIN_CODE_CHARACTERS).toBe('23456789ABCDEFGHJKMNPQRSTUVWXYZ');
      expect(JOIN_CODE_CHARACTERS.length).toBe(31);

      // Ensure ambiguous characters are rejected by frontend validator
      expect(isValidJoinCode('A10IL')).toBe(false); // contains 1, 0, I, L
      expect(isValidJoinCode('00000')).toBe(false);
      expect(isValidJoinCode('11111')).toBe(false);
      expect(isValidJoinCode('IIIII')).toBe(false);
      expect(isValidJoinCode('LLLLL')).toBe(false);
      expect(isValidJoinCode('OOOOO')).toBe(false);

      // Ensure valid codes pass
      expect(isValidJoinCode('CKD26')).toBe(true);
      expect(isValidJoinCode('RMB26')).toBe(true);

      // 2. SQL schema rule: SQL migration must use the exact same character set regex in both RPCs
      const expectedRegex = '^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{5}$';
      expect(sqlContent).toContain(expectedRegex);

      // Verify that lookup_workspace_by_join_code enforces the exact regex
      const lookupRegexCheck = new RegExp(
        `create\\s+or\\s+replace\\s+function\\s+public\\.lookup_workspace_by_join_code[\\s\\S]*?\\!~\\s*'\\^\\[${JOIN_CODE_CHARACTERS}\\]\\{5\\}\\$'`,
        'i'
      );
      expect(sqlContent).toMatch(lookupRegexCheck);

      // Verify that join_class_workspace enforces the exact regex
      const joinRegexCheck = new RegExp(
        `create\\s+or\\s+replace\\s+function\\s+public\\.join_class_workspace[\\s\\S]*?\\!~\\s*'\\^\\[${JOIN_CODE_CHARACTERS}\\]\\{5\\}\\$'`,
        'i'
      );
      expect(sqlContent).toMatch(joinRegexCheck);
    });

    it('rejects invalid or non-alphanumeric join codes before attempting database operations', async () => {
      // 4 chars (too short)
      const resShort = await classSpaceService.lookupWorkspaceByCode('A123');
      expect(resShort.error).toMatch(/Invalid ClassSpace code format/i);

      // 6 chars (too long)
      const resLong = await classSpaceService.lookupWorkspaceByCode('ABCDEF');
      expect(resLong.error).toMatch(/Invalid ClassSpace code format/i);

      // Invalid characters (ambiguous characters 'O', 'I', 'L', '0', '1' are excluded)
      const resAmbiguous = await classSpaceService.lookupWorkspaceByCode('A10IL');
      expect(resAmbiguous.error).toMatch(/Invalid ClassSpace code format/i);
    });
  });
});
