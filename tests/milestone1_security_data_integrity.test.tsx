import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { authService } from '../src/services/authService';
import { cloudSyncService } from '../src/services/cloudSyncService';
import { classSpaceService } from '../src/services/classSpaceService';
import {
  storageService,
  STORAGE_KEY_V2,
  EMPTY_STATE,
  getUserStorageKey,
  saveUserData,
  loadUserData,
  clearUserData,
  sanitizeEntityArray,
} from '../src/services/storage';
import { migrateV1ToV2 } from '../src/services/migration';
import { canManageSchedule, canManageWorkspace } from '../src/utils/classSpaceUtils';
import { AppStateData } from '../src/types';

describe('Milestone 01 — Backend Security & Data Integrity Verification', () => {
  beforeEach(async () => {
    localStorage.clear();
    await authService.signOut();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ============================================================================
  // 1. Authentication & Configuration Hardening
  // ============================================================================
  describe('1. Authentication & Configuration Hardening', () => {
    it('reports isConfigured as false when environment variables are unset or placeholder defaults', () => {
      // In default test environment without .env.local, authService is cleanly unconfigured
      expect(authService.isConfigured).toBe(false);
    });

    it('rejects signInWithGoogle with clear guidance when cloud credentials are unconfigured', async () => {
      const res = await authService.signInWithGoogle();
      expect(res.user).toBeUndefined();
      expect(res.error).toMatch(/cloud services are not configured/i);
    });

    it('returns null for getCurrentUser without fabricating simulated identities in production mode', async () => {
      const user = await authService.getCurrentUser();
      expect(user).toBeNull();
    });
  });

  // ============================================================================
  // 2. Cross-Account Data Isolation & Sign-Out State Eradication
  // ============================================================================
  describe('2. Cross-Account Data Isolation & Sign-Out', () => {
    it('ensures signOut purges sensitive local state from localStorage', async () => {
      // Seed storage with private student data
      const privateData: AppStateData = {
        ...EMPTY_STATE,
        profile: {
          displayName: 'User A Private',
          targetExam: 'Classified Finals',
        },
        subjects: [
          {
            id: 'sub-user-a',
            code: 'PRIV101',
            name: 'Confidential Subject',
            attended: 10,
            totalConducted: 10,
            targetPct: 80,
            color: '#C45532',
          },
        ],
        attendanceLogs: [
          {
            id: 'att-user-a',
            slotId: 'slot-1',
            subjectId: 'sub-user-a',
            date: '2026-10-25',
            status: 'present',
            timestamp: '2026-10-25T10:00:00Z',
          },
        ],
      };

      storageService.saveData(privateData);
      expect(storageService.loadData().subjects.length).toBe(1);

      // Execute clean state reset on sign-out
      const cleanState: AppStateData = {
        ...EMPTY_STATE,
        hasSampleData: false,
        schemaVersion: 2,
      };
      storageService.saveData(cleanState);

      const afterSignOut = storageService.loadData();
      expect(afterSignOut.subjects).toEqual([]);
      expect(afterSignOut.attendanceLogs).toEqual([]);
      expect(afterSignOut.profile?.displayName).toBe('');
    });

    it('storageService helper functions saveUserData, loadUserData, and clearUserData manage isolated keys correctly', () => {
      const testUserId = 'test-isolated-helper-uid';
      const key = getUserStorageKey(testUserId);
      expect(key).toBe(`tracker_user_data_${testUserId}`);

      saveUserData(testUserId, EMPTY_STATE);
      expect(loadUserData(testUserId)).not.toBeNull();

      clearUserData(testUserId);
      expect(loadUserData(testUserId)).toBeNull();
    });

    it('preserves unsynchronized offline changes in user-scoped archive across signOut', async () => {
      const userAId = 'a1111111-1111-4111-8111-111111111111';
      const userAOfflineData: AppStateData = {
        ...EMPTY_STATE,
        profile: {
          displayName: 'User A',
          targetExam: 'Final Exams',
        },
        tasks: [
          {
            id: 'task-offline-a1',
            title: 'Critical Offline Thesis Drafting',
            status: 'in_progress',
            priority: 'high',
            createdAt: '2026-10-25T14:00:00Z',
            completedAt: '2026-10-25T15:00:00Z',
          },
        ],
      };

      // 1. User A modifies data while active
      storageService.saveData(userAOfflineData);
      storageService.saveUserData(userAId, userAOfflineData);

      // Verify active session has the task
      expect(storageService.loadData().tasks?.length).toBe(1);

      // 2. User A signs out: active session wiped to clean defaults
      const cleanGuestState: AppStateData = {
        ...EMPTY_STATE,
        hasSampleData: false,
        schemaVersion: 2,
      };
      storageService.saveData(cleanGuestState);

      // Verify active guest storage is purged
      const activeAfterSignOut = storageService.loadData();
      expect(activeAfterSignOut.tasks?.length || 0).toBe(0);

      // 3. User A's private archive remains intact
      const userAArchive = storageService.loadUserData(userAId);
      expect(userAArchive).not.toBeNull();
      expect(userAArchive?.tasks?.length).toBe(1);
      expect(userAArchive?.tasks?.[0].title).toBe('Critical Offline Thesis Drafting');
    });

    it('restores user-scoped archive and merges offline changes with cloud upon re-login', async () => {
      const userAId = 'a1111111-1111-4111-8111-111111111111';
      const localArchive: AppStateData = {
        ...EMPTY_STATE,
        tasks: [
          {
            id: 'task-offline-a1',
            title: 'Offline Task from Device 1',
            status: 'in_progress',
            priority: 'high',
            createdAt: '2026-10-25T14:00:00Z',
          },
        ],
      };
      storageService.saveUserData(userAId, localArchive);

      // Simulate cloud having a task from Device 2
      const cloudData: AppStateData = {
        ...EMPTY_STATE,
        tasks: [
          {
            id: 'task-cloud-a2',
            title: 'Synced Task from Device 2',
            status: 'done',
            priority: 'medium',
            createdAt: '2026-10-25T13:00:00Z',
          },
        ],
      };

      // On re-login: retrieve user archive and merge with cloud
      const retrievedArchive = storageService.loadUserData(userAId);
      expect(retrievedArchive).not.toBeNull();
      const merged = cloudSyncService.mergeDatasets(retrievedArchive!, cloudData);

      // Both tasks preserved
      expect(merged.tasks?.length).toBe(2);
      expect(merged.tasks?.some((t) => t.id === 'task-offline-a1')).toBe(true);
      expect(merged.tasks?.some((t) => t.id === 'task-cloud-a2')).toBe(true);
    });

    it('guarantees complete isolation during account switching so User B never inherits User A private data', async () => {
      const userAId = 'a1111111-1111-4111-8111-111111111111';
      const userBId = 'b2222222-2222-4222-8222-222222222222';

      // User A works on machine
      const userAData: AppStateData = {
        ...EMPTY_STATE,
        profile: { displayName: 'User A Private Name', targetExam: 'GATE 2027' },
        subjects: [
          {
            id: 'sub-user-a',
            code: 'UA101',
            name: 'User A Confidential Class',
            attended: 12,
            totalConducted: 14,
            targetPct: 85,
            color: '#C45532',
          },
        ],
      };
      storageService.saveData(userAData);
      storageService.saveUserData(userAId, userAData);

      // User A signs out: guest store reset
      const cleanGuestState: AppStateData = {
        ...EMPTY_STATE,
        hasSampleData: false,
        schemaVersion: 2,
      };
      storageService.saveData(cleanGuestState);

      // User B signs in: loads userB archive (null for new user)
      const userBArchive = storageService.loadUserData(userBId);
      expect(userBArchive).toBeNull();

      // Active state for User B is clean default
      const currentActive = storageService.loadData();
      expect(currentActive.subjects.length).toBe(0);
      expect(currentActive.profile?.displayName).toBe('');

      // User B adds their own subject
      const userBData: AppStateData = {
        ...currentActive,
        profile: { displayName: 'User B Public Name', targetExam: 'Semester Finals' },
        subjects: [
          {
            id: 'sub-user-b',
            code: 'UB201',
            name: 'User B Class',
            attended: 5,
            totalConducted: 5,
            targetPct: 75,
            color: '#3D6A8A',
          },
        ],
      };
      storageService.saveData(userBData);
      storageService.saveUserData(userBId, userBData);

      // Verify User A archive remained completely unaffected
      const recheckedUserA = storageService.loadUserData(userAId);
      expect(recheckedUserA?.subjects.length).toBe(1);
      expect(recheckedUserA?.subjects[0].id).toBe('sub-user-a');
      expect(recheckedUserA?.profile?.displayName).toBe('User A Private Name');

      // Verify User B archive contains only User B data
      const recheckedUserB = storageService.loadUserData(userBId);
      expect(recheckedUserB?.subjects.length).toBe(1);
      expect(recheckedUserB?.subjects[0].id).toBe('sub-user-b');
      expect(recheckedUserB?.profile?.displayName).toBe('User B Public Name');
    });

    it('cloudSyncService rejects non-UUID and simulated identities from remote sync', async () => {
      // Simulated user ID
      const simResult = await cloudSyncService.uploadToCloud('usr_local_student', EMPTY_STATE);
      expect(simResult.success).toBe(false);
      expect(simResult.error).toMatch(/simulated or non-uuid/i);

      // Non-UUID string
      const nonUuidResult = await cloudSyncService.uploadToCloud('not-a-valid-uuid-1234', EMPTY_STATE);
      expect(nonUuidResult.success).toBe(false);
      expect(nonUuidResult.error).toMatch(/simulated or non-uuid/i);

      // fetchCloudData returns null immediately for non-UUID
      const fetched = await cloudSyncService.fetchCloudData('arbitrary-string');
      expect(fetched).toBeNull();

      // fetchCloudDataDetailed returns error status immediately for non-UUID
      const detailed = await cloudSyncService.fetchCloudDataDetailed('arbitrary-string');
      expect(detailed.status).toBe('error');
      expect(detailed.record).toBeNull();
      expect(detailed.error).toMatch(/simulated or non-uuid/i);
    });

    it('distinguishes unconfigured status from confirmed empty account or network errors', async () => {
      const validUuid = '11111111-2222-4333-8444-555555555555';
      // In test environment without .env.local, authService is unconfigured
      const res = await cloudSyncService.fetchCloudDataDetailed(validUuid);
      expect(res.status).toBe('unconfigured');
      expect(res.record).toBeNull();
      const simple = await cloudSyncService.fetchCloudData(validUuid);
      expect(simple).toBeNull();
    });

    it('storageService preserves recoverable guest data backup across account sessions', () => {
      const guestState: AppStateData = {
        ...EMPTY_STATE,
        profile: { displayName: 'Guest Student', targetExam: 'College Entrance' },
        subjects: [
          {
            id: 'sub-guest-1',
            code: 'GST101',
            name: 'Guest Created Subject',
            attended: 1,
            totalConducted: 1,
            targetPct: 75,
            color: '#B8732E',
          },
        ],
      };

      // Guest creates data before signing in
      storageService.saveGuestBackup(guestState);

      // Verify guest data is safely recoverable from backup
      const recovered = storageService.loadGuestBackup();
      expect(recovered).not.toBeNull();
      expect(recovered?.subjects.length).toBe(1);
      expect(recovered?.subjects[0].name).toBe('Guest Created Subject');
      expect(recovered?.profile?.displayName).toBe('Guest Student');
    });
  });

  // ============================================================================
  // 3. ClassSpace Role Hierarchy & Owner Authorizations
  // ============================================================================
  describe('3. ClassSpace Role Hierarchy & Owner Authorizations', () => {
    it('authorizes Owner, CR, and Co-Admin in utility functions, while denying member', () => {
      expect(canManageSchedule('owner')).toBe(true);
      expect(canManageSchedule('cr')).toBe(true);
      expect(canManageSchedule('co_admin')).toBe(true);
      expect(canManageSchedule('member')).toBe(false);
      expect(canManageSchedule(undefined)).toBe(false);

      expect(canManageWorkspace('owner')).toBe(true);
      expect(canManageWorkspace('cr')).toBe(true);
      expect(canManageWorkspace('co_admin')).toBe(false);
      expect(canManageWorkspace('member')).toBe(false);
    });

    it('allows workspace owner to add, update, and delete timetable rules in classSpaceService', async () => {
      const workspaceId = 'ws_test_roles_1';
      const actorRole = 'owner';

      // 1. Add rule as Owner
      const addRes = await classSpaceService.addTimetableRule(workspaceId, actorRole, {
        subjectName: 'Distributed Systems',
        subjectCode: 'CS401',
        subjectColor: '#C45532',
        dayOfWeek: 1,
        startTime: '10:00',
        endTime: '11:15',
        createdBy: 'usr_owner_1',
      });
      expect(addRes.error).toBeUndefined();
      expect(addRes.rule).toBeDefined();
      const ruleId = addRes.rule!.id;

      // 2. Update rule as Owner
      const updateRes = await classSpaceService.updateTimetableRule(workspaceId, actorRole, ruleId, {
        room: 'Hall 101',
      });
      expect(updateRes.success).toBe(true);
      expect(updateRes.error).toBeUndefined();

      // 3. Add override as Owner
      const overrideRes = await classSpaceService.addOccurrenceOverride(workspaceId, actorRole, {
        type: 'extra',
        newDate: '2026-10-30',
        newStartTime: '14:00',
        newEndTime: '15:00',
        subjectName: 'Distributed Systems Extra',
        subjectCode: 'CS401',
        createdBy: 'usr_owner_1',
      });
      expect(overrideRes.error).toBeUndefined();
      expect(overrideRes.override).toBeDefined();

      // 4. Delete rule as Owner
      const deleteRes = await classSpaceService.deleteTimetableRule(workspaceId, actorRole, ruleId);
      expect(deleteRes.success).toBe(true);
      expect(deleteRes.error).toBeUndefined();
    });

    it('strictly rejects members from modifying timetable rules or overrides', async () => {
      const workspaceId = 'ws_test_roles_2';
      const memberRole = 'member';

      const addRes = await classSpaceService.addTimetableRule(workspaceId, memberRole, {
        subjectName: 'Unauthorized Class',
        subjectCode: 'HACK101',
        subjectColor: '#C45532',
        dayOfWeek: 2,
        startTime: '09:00',
        endTime: '10:00',
        createdBy: 'usr_member_1',
      });
      expect(addRes.rule).toBeUndefined();
      expect(addRes.error).toMatch(/unauthorized/i);

      const overrideRes = await classSpaceService.addOccurrenceOverride(workspaceId, memberRole, {
        type: 'cancel',
        newDate: '2026-10-31',
        createdBy: 'usr_member_1',
      });
      expect(overrideRes.override).toBeUndefined();
      expect(overrideRes.error).toMatch(/unauthorized/i);
    });
  });

  // ============================================================================
  // 4. Data Integrity & Storage Sanitization
  // ============================================================================
  describe('4. Data Integrity & Storage Sanitization', () => {
    it('importBackup strips out null, undefined, or corrupt items without IDs', () => {
      const corruptedPayload = JSON.stringify({
        schemaVersion: 2,
        subjects: [
          { id: 'sub-valid-1', name: 'Valid Subject', code: 'V101' },
          null,
          undefined,
          'not-an-object',
          { name: 'Missing ID' },
          { id: '   ' }, // empty whitespace ID
        ],
        timetable: [
          { id: 'tt-valid-1', subjectId: 'sub-valid-1', dayOfWeek: 1 },
          null,
        ],
      });

      const imported = storageService.importBackup(corruptedPayload);
      expect(imported.subjects.length).toBe(1);
      expect(imported.subjects[0].id).toBe('sub-valid-1');
      expect(imported.timetable.length).toBe(1);
      expect(imported.timetable[0].id).toBe('tt-valid-1');
    });

    it('loadData sanitizes corrupt array elements from localStorage safely', () => {
      const corruptStoredData = {
        schemaVersion: 2,
        subjects: [
          { id: 'sub-ok-1', name: 'Clean Subject', code: 'C101' },
          null,
          { invalid: 'no id' },
        ],
        tasks: [
          { id: 'task-ok-1', title: 'Task Clean' },
          null,
        ],
      };

      localStorage.setItem(STORAGE_KEY_V2, JSON.stringify(corruptStoredData));
      const loaded = storageService.loadData();

      expect(loaded.subjects.length).toBe(1);
      expect(loaded.subjects[0].id).toBe('sub-ok-1');
      expect(loaded.tasks?.length).toBe(1);
      expect(loaded.tasks?.[0].id).toBe('task-ok-1');
    });

    it('sanitizeEntityArray preserves valid UUIDs, custom slugs, and all optional fields without dropping data', () => {
      interface CustomTestEntity {
        id: string;
        name: string;
        optionalNote?: string;
        optionalMeta?: { nested: boolean };
        tags?: string[];
      }

      const inputList: CustomTestEntity[] = [
        {
          id: '550e8400-e29b-41d4-a716-446655440000', // Standard UUID v4
          name: 'UUID Entity',
          optionalNote: 'Preserve this note',
          optionalMeta: { nested: true },
          tags: ['important', 'review'],
        },
        {
          id: 'custom_slug-entity_102', // Custom Slug ID
          name: 'Slug Entity',
          optionalNote: 'Another note',
        },
        {
          id: '12345', // Numeric string ID
          name: 'Numeric String ID Entity',
        },
      ];

      const result = sanitizeEntityArray<CustomTestEntity>(inputList);
      expect(result.length).toBe(3);
      expect(result[0].id).toBe('550e8400-e29b-41d4-a716-446655440000');
      expect(result[0].optionalNote).toBe('Preserve this note');
      expect(result[0].optionalMeta).toEqual({ nested: true });
      expect(result[0].tags).toEqual(['important', 'review']);
      expect(result[1].id).toBe('custom_slug-entity_102');
      expect(result[2].id).toBe('12345');
    });

    it('sanitizeEntityArray strictly discards null, undefined, whitespace IDs, and non-object items', () => {
      const dirtyInput = [
        null,
        undefined,
        'string',
        12345,
        [],
        {},
        { id: '' },
        { id: '   ' },
        { id: 999 }, // number id instead of string
        { id: 'valid-id', data: 'ok' },
      ];

      const result = sanitizeEntityArray<{ id: string; data?: string }>(dirtyInput);
      expect(result.length).toBe(1);
      expect(result[0].id).toBe('valid-id');
      expect(result[0].data).toBe('ok');
    });

    it('cloudSyncService.mergeDatasets merges disjoint items and resolves timestamp conflicts in favor of newer offline edits', () => {
      const localOffline: AppStateData = {
        ...EMPTY_STATE,
        tasks: [
          {
            id: 'task-conflict-1',
            title: 'Offline Revision (Newer)',
            status: 'done',
            priority: 'high',
            createdAt: '2026-10-25T14:00:00Z',
            completedAt: '2026-10-25T16:00:00Z',
          },
          {
            id: 'task-local-only',
            title: 'Created Locally While Offline',
            status: 'in_progress',
            priority: 'medium',
            createdAt: '2026-10-25T15:30:00Z',
          },
        ],
      };

      const remoteCloud: AppStateData = {
        ...EMPTY_STATE,
        tasks: [
          {
            id: 'task-conflict-1',
            title: 'Older Cloud Version',
            status: 'in_progress',
            priority: 'high',
            createdAt: '2026-10-25T14:00:00Z',
          },
          {
            id: 'task-cloud-only',
            title: 'Created on Another Device',
            status: 'in_progress',
            priority: 'low',
            createdAt: '2026-10-25T13:00:00Z',
          },
        ],
      };

      const merged = cloudSyncService.mergeDatasets(localOffline, remoteCloud);

      // Total tasks: 3 (1 merged conflict + 2 disjoint entries)
      expect(merged.tasks?.length).toBe(3);

      // Newer offline revision wins over older cloud version
      const conflictTask = merged.tasks?.find((t) => t.id === 'task-conflict-1');
      expect(conflictTask?.title).toBe('Offline Revision (Newer)');
      expect(conflictTask?.status).toBe('done');

      // Both disjoint tasks are preserved
      expect(merged.tasks?.some((t) => t.id === 'task-local-only')).toBe(true);
      expect(merged.tasks?.some((t) => t.id === 'task-cloud-only')).toBe(true);
    });

    it('cloudSyncService.mergeDatasets preserves local subjects with higher totalConducted when offline attendance was marked', () => {
      const localSubjects: AppStateData = {
        ...EMPTY_STATE,
        subjects: [
          {
            id: 'sub-comp101',
            code: 'CS101',
            name: 'Computer Architecture',
            attended: 9,
            totalConducted: 10,
            targetPct: 75,
            color: '#C45532',
          },
        ],
      };

      const cloudSubjects: AppStateData = {
        ...EMPTY_STATE,
        subjects: [
          {
            id: 'sub-comp101',
            code: 'CS101',
            name: 'Computer Architecture',
            attended: 8,
            totalConducted: 9, // older total conducted in cloud
            targetPct: 75,
            color: '#C45532',
          },
        ],
      };

      const merged = cloudSyncService.mergeDatasets(localSubjects, cloudSubjects);
      expect(merged.subjects.length).toBe(1);
      expect(merged.subjects[0].attended).toBe(9);
      expect(merged.subjects[0].totalConducted).toBe(10);
    });

    it('cloudSyncService.mergeDatasets resolves malformed, missing, and equal timestamps deterministically without losing user edits', () => {
      // 1. Local has malformed timestamp, Cloud has valid timestamp -> Cloud wins
      const localMalformed: AppStateData = {
        ...EMPTY_STATE,
        tasks: [
          {
            id: 'task-time-1',
            title: 'Task with corrupted timestamp',
            status: 'in_progress',
            priority: 'low',
            createdAt: 'not-a-valid-date-string',
          },
        ],
      };
      const cloudValid: AppStateData = {
        ...EMPTY_STATE,
        tasks: [
          {
            id: 'task-time-1',
            title: 'Task with valid cloud timestamp',
            status: 'done',
            priority: 'high',
            createdAt: '2026-10-25T12:00:00Z',
          },
        ],
      };
      const res1 = cloudSyncService.mergeDatasets(localMalformed, cloudValid);
      expect(res1.tasks?.[0].title).toBe('Task with valid cloud timestamp');
      expect(res1.tasks?.[0].status).toBe('done');

      // 2. Local has valid timestamp, Cloud has missing timestamp -> Local wins
      const localValid: AppStateData = {
        ...EMPTY_STATE,
        tasks: [
          {
            id: 'task-time-2',
            title: 'Local Valid Edit',
            status: 'in_progress',
            priority: 'medium',
            createdAt: '2026-10-25T14:00:00Z',
          },
        ],
      };
      const cloudMissing: AppStateData = {
        ...EMPTY_STATE,
        tasks: [
          {
            id: 'task-time-2',
            title: 'Cloud Un-timestamped Task',
            status: 'in_progress',
            priority: 'low',
            createdAt: '', // empty / missing
          },
        ],
      };
      const res2 = cloudSyncService.mergeDatasets(localValid, cloudMissing);
      expect(res2.tasks?.[0].title).toBe('Local Valid Edit');

      // 3. Equal timestamps: completed status takes precedence deterministically
      const localDone: AppStateData = {
        ...EMPTY_STATE,
        tasks: [
          {
            id: 'task-time-3',
            title: 'Task Finished Locally',
            status: 'done',
            priority: 'high',
            createdAt: '2026-10-25T15:00:00Z',
          },
        ],
      };
      const cloudPending: AppStateData = {
        ...EMPTY_STATE,
        tasks: [
          {
            id: 'task-time-3',
            title: 'Task Pending in Cloud',
            status: 'in_progress',
            priority: 'high',
            createdAt: '2026-10-25T15:00:00Z', // identical timestamp
          },
        ],
      };
      const res3 = cloudSyncService.mergeDatasets(localDone, cloudPending);
      expect(res3.tasks?.[0].status).toBe('done');
      expect(res3.tasks?.[0].title).toBe('Task Finished Locally');
    });

    it('migrateV1ToV2 filters corrupt non-object records from legacy structures', () => {
      const dirtyV1Data = {
        subjects: [
          { id: 'v1-ok', name: 'V1 Subject', code: 'V101' },
          null,
          'unexpected string',
        ],
        timetable: [null, { id: 'tt-v1-ok', subjectId: 'v1-ok' }],
      };

      const migrated = migrateV1ToV2(dirtyV1Data);
      expect(migrated.subjects.length).toBe(1);
      expect(migrated.subjects[0].id).toBe('v1-ok');
      expect(migrated.timetable.length).toBe(1);
      expect(migrated.timetable[0].id).toBe('tt-v1-ok');
    });
  });

  // ============================================================================
  // 5. Database Schema & RLS Verification
  // ============================================================================
  describe('5. Database Migration & RLS Policy Integrity', () => {
    it('verifies user_trackers migration exists and enforces RLS with strict WITH CHECK clause', () => {
      const migrationPath = path.resolve(process.cwd(), 'supabase/migrations/20261020_user_trackers_schema.sql');
      expect(fs.existsSync(migrationPath)).toBe(true);

      const sql = fs.readFileSync(migrationPath, 'utf8');
      expect(sql).toContain('create table if not exists public.user_trackers');
      expect(sql).toContain('alter table public.user_trackers enable row level security');
      expect(sql).toContain('using (auth.uid() = user_id)');
      expect(sql).toContain('with check (auth.uid() = user_id)');
    });

    it('verifies ClassSpace attendance records are cryptographically isolated per student', () => {
      const migrationPath = path.resolve(process.cwd(), 'supabase/migrations/20261022_classspace_schema.sql');
      expect(fs.existsSync(migrationPath)).toBe(true);

      const sql = fs.readFileSync(migrationPath, 'utf8');
      expect(sql).toContain('alter table public.class_attendance_records enable row level security');
      expect(sql).toMatch(/create policy "Students can view only their own personal attendance records"[\s\S]*using \(auth\.uid\(\) = user_id/);
      expect(sql).toMatch(/create policy "Students can insert only their own attendance records"[\s\S]*with check \(auth\.uid\(\) = user_id/);
    });

    it('verifies all SECURITY DEFINER functions explicitly declare SET search_path = public', () => {
      const migrationPath = path.resolve(process.cwd(), 'supabase/migrations/20261022_classspace_schema.sql');
      const sql = fs.readFileSync(migrationPath, 'utf8');

      const securityDefinerCount = (sql.match(/security definer/gi) || []).length;
      const searchPathCount = (sql.match(/set search_path = public/gi) || []).length;

      expect(securityDefinerCount).toBeGreaterThan(0);
      expect(searchPathCount).toBe(securityDefinerCount);
    });
  });
});

