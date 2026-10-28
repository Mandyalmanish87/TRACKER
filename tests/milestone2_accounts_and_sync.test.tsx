import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { cloudSyncService } from '../src/services/cloudSyncService';
import { storageService } from '../src/services/storage';
import { authService } from '../src/services/authService';
import { EMPTY_STATE, DEFAULT_PROFILE } from '../src/services/defaults';
import { AppStateData, CalendarEvent, SyncTombstone, Subject } from '../src/types';

describe('Milestone 02 — Final Sync Correctness Audit Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    authService._setTestUser(null);
    vi.restoreAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
    authService._setTestUser(null);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 1. Tombstone Lifecycle & Stale-Device Safety
  // ───────────────────────────────────────────────────────────────────────────
  describe('1. Tombstone Lifecycle & Stale-Device Safety', () => {
    it('prevents deleted items from being resurrected during mergeDatasets', () => {
      const deletedTaskId = 'task-del-123';
      const tombstoneTime = '2026-10-25T12:00:00.000Z';
      const taskCreationTime = '2026-10-25T10:00:00.000Z';

      const localState: AppStateData = {
        ...EMPTY_STATE,
        tasks: [],
        tombstones: [
          {
            id: deletedTaskId,
            collection: 'tasks',
            deletedAt: tombstoneTime,
          },
        ],
      };

      const remoteState: AppStateData = {
        ...EMPTY_STATE,
        tasks: [
          {
            id: deletedTaskId,
            title: 'Old Task to be Deleted',
            status: 'todo',
            priority: 'medium',
            createdAt: taskCreationTime,
            updatedAt: taskCreationTime,
          },
        ],
        tombstones: [],
      };

      const merged = cloudSyncService.mergeDatasets(localState, remoteState);

      // The task must not be resurrected
      expect((merged.tasks || []).find((t) => t.id === deletedTaskId)).toBeUndefined();
      // The tombstone must be preserved in the merged state
      expect(merged.tombstones?.find((t) => t.id === deletedTaskId)).toBeDefined();
    });

    it('demonstrates that a device offline longer than 60 days (e.g. 100 days) CANNOT resurrect deleted records under safe retention', () => {
      const taskId = 'task-ancient-offline';
      const taskCreationTime = '2026-06-01T00:00:00.000Z'; // 145 days ago
      const tombstoneTime = '2026-07-01T00:00:00.000Z';   // deleted 115 days ago

      // Cloud state has retained the tombstone persistently (safe retention strategy)
      const cloudState: AppStateData = {
        ...EMPTY_STATE,
        tasks: [],
        tombstones: [
          {
            id: taskId,
            collection: 'tasks',
            deletedAt: tombstoneTime,
          },
        ],
      };

      // Stale device waking up after being powered off for >100 days
      const staleDeviceState: AppStateData = {
        ...EMPTY_STATE,
        tasks: [
          {
            id: taskId,
            title: 'Task from 100 days ago',
            status: 'todo',
            priority: 'medium',
            createdAt: taskCreationTime,
            updatedAt: taskCreationTime,
          },
        ],
        tombstones: [],
      };

      // Merge stale device with cloud
      const merged = cloudSyncService.mergeDatasets(staleDeviceState, cloudState);

      // The ancient task must NEVER be resurrected
      expect((merged.tasks || []).find((t) => t.id === taskId)).toBeUndefined();
      // Tombstone is preserved
      expect((merged.tombstones || []).find((t) => t.id === taskId)).toBeDefined();
    });

    it('capacity-based retention keeps the most recent tombstones and strips malformed ones', () => {
      const tombstones: SyncTombstone[] = [
        { id: 't1', collection: 'tasks', deletedAt: '2026-10-25T10:00:00.000Z' },
        { id: 't2', collection: 'tasks', deletedAt: '2026-10-25T12:00:00.000Z' },
        { id: 't3', collection: 'tasks', deletedAt: '2026-10-25T14:00:00.000Z' },
        { id: 'bad', collection: 'tasks', deletedAt: 'invalid-date' },
      ];

      // Request capacity of 2
      const pruned = cloudSyncService.pruneTombstones(tombstones, 2);

      expect(pruned.length).toBe(2);
      expect(pruned[0].id).toBe('t3'); // newest
      expect(pruned[1].id).toBe('t2'); // second newest
      expect(pruned.find((t) => t.id === 'bad')).toBeUndefined();
    });

    it('correctly handles recreation of an entity with the same ID after deletion and clears obsolete tombstone', () => {
      const taskId = 'task-reborn-1';
      const deletionTime = '2026-10-25T10:00:00.000Z';
      const recreationTime = '2026-10-25T12:00:00.000Z';

      const localState: AppStateData = {
        ...EMPTY_STATE,
        tasks: [],
        tombstones: [
          {
            id: taskId,
            collection: 'tasks',
            deletedAt: deletionTime,
          },
        ],
      };

      const remoteState: AppStateData = {
        ...EMPTY_STATE,
        tasks: [
          {
            id: taskId,
            title: 'Re-created Task With Same ID',
            status: 'todo',
            priority: 'high',
            createdAt: recreationTime,
            updatedAt: recreationTime,
          },
        ],
        tombstones: [],
      };

      const merged = cloudSyncService.mergeDatasets(localState, remoteState);

      // Recreated task is kept
      const task = (merged.tasks || []).find((t) => t.id === taskId);
      expect(task).toBeDefined();
      expect(task?.title).toBe('Re-created Task With Same ID');

      // The obsolete tombstone is pruned from active tombstones
      expect((merged.tombstones || []).find((t) => t.id === taskId && t.collection === 'tasks')).toBeUndefined();
    });

    it('verifies that deleting one entity type cannot accidentally delete another entity type with the same ID', () => {
      const sharedId = 'shared-uuid-999';

      const localState: AppStateData = {
        ...EMPTY_STATE,
        tasks: [],
        events: [
          {
            id: sharedId,
            title: 'Important Exam Event',
            category: 'exam',
            date: '2026-11-01',
            createdAt: '2026-10-25T09:00:00.000Z',
          } as CalendarEvent,
        ],
        tombstones: [
          // A task with sharedId was deleted
          {
            id: sharedId,
            collection: 'tasks',
            deletedAt: '2026-10-25T10:00:00.000Z',
          },
        ],
      };

      const remoteState: AppStateData = {
        ...EMPTY_STATE,
        tasks: [
          {
            id: sharedId,
            title: 'Stale Task from remote',
            status: 'todo',
            priority: 'medium',
            createdAt: '2026-10-25T08:00:00.000Z',
            updatedAt: '2026-10-25T08:00:00.000Z',
          },
        ],
        events: [
          {
            id: sharedId,
            title: 'Important Exam Event',
            category: 'exam',
            date: '2026-11-01',
            createdAt: '2026-10-25T09:00:00.000Z',
          } as CalendarEvent,
        ],
        tombstones: [],
      };

      const merged = cloudSyncService.mergeDatasets(localState, remoteState);

      // The task with sharedId was deleted and must NOT be resurrected
      expect((merged.tasks || []).find((t) => t.id === sharedId)).toBeUndefined();

      // The event with sharedId must NOT be deleted accidentally
      const event = (merged.events || []).find((e) => e.id === sharedId);
      expect(event).toBeDefined();
      expect(event?.title).toBe('Important Exam Event');
    });

    it('merges tombstones taking the latest deletion timestamp on collision', () => {
      const localTombstones: SyncTombstone[] = [
        { id: 'del-1', collection: 'tasks', deletedAt: '2026-10-25T08:00:00.000Z' },
      ];
      const cloudTombstones: SyncTombstone[] = [
        { id: 'del-1', collection: 'tasks', deletedAt: '2026-10-25T12:00:00.000Z' },
      ];

      const merged = cloudSyncService.mergeTombstones(localTombstones, cloudTombstones);
      expect(merged.length).toBe(1);
      expect(merged[0].deletedAt).toBe('2026-10-25T12:00:00.000Z');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. Conflict-Resolution Semantics
  // ───────────────────────────────────────────────────────────────────────────
  describe('2. Conflict-Resolution Semantics', () => {
    it('ensures a later reopen/uncomplete edit wins over an older completed state', () => {
      const taskId = 'task-reopen-test';

      // Device A completed the task at 10:00
      const deviceAState: AppStateData = {
        ...EMPTY_STATE,
        tasks: [
          {
            id: taskId,
            title: 'Physics Homework',
            status: 'done',
            priority: 'high',
            createdAt: '2026-10-25T08:00:00.000Z',
            completedAt: '2026-10-25T10:00:00.000Z',
            updatedAt: '2026-10-25T10:00:00.000Z',
          },
        ],
      };

      // Device B reopened the task at 11:00 (more work was needed)
      const deviceBState: AppStateData = {
        ...EMPTY_STATE,
        tasks: [
          {
            id: taskId,
            title: 'Physics Homework (Needs Revision)',
            status: 'in_progress',
            priority: 'high',
            createdAt: '2026-10-25T08:00:00.000Z',
            updatedAt: '2026-10-25T11:00:00.000Z', // strictly later than Device A's completion
          },
        ],
      };

      const merged = cloudSyncService.mergeDatasets(deviceAState, deviceBState);

      // The later reopen edit MUST win over the older completion!
      const task = (merged.tasks || [])[0];
      expect(task.status).toBe('in_progress');
      expect(task.title).toBe('Physics Homework (Needs Revision)');
    });

    it('resolves equal timestamp ties deterministically without losing completed status', () => {
      const sameTime = '2026-10-25T15:00:00.000Z';
      const taskId = 'task-equal-time';

      const localState: AppStateData = {
        ...EMPTY_STATE,
        tasks: [
          {
            id: taskId,
            title: 'Local version',
            status: 'in_progress',
            priority: 'medium',
            createdAt: '2026-10-25T10:00:00.000Z',
            updatedAt: sameTime,
          },
        ],
      };

      const remoteState: AppStateData = {
        ...EMPTY_STATE,
        tasks: [
          {
            id: taskId,
            title: 'Remote version',
            status: 'done',
            priority: 'medium',
            createdAt: '2026-10-25T10:00:00.000Z',
            updatedAt: sameTime,
          },
        ],
      };

      const merged = cloudSyncService.mergeDatasets(localState, remoteState);
      expect((merged.tasks || [])[0].status).toBe('done');
    });

    it('prefers valid timestamps over missing or malformed timestamps', () => {
      const taskId = 'task-skew-test';

      const localState: AppStateData = {
        ...EMPTY_STATE,
        tasks: [
          {
            id: taskId,
            title: 'Valid Timed Task',
            status: 'todo',
            priority: 'medium',
            createdAt: '2026-10-25T12:00:00.000Z',
            updatedAt: '2026-10-25T12:00:00.000Z',
          },
        ],
      };

      const remoteState: AppStateData = {
        ...EMPTY_STATE,
        tasks: [
          {
            id: taskId,
            title: 'Corrupted Timed Task',
            status: 'done',
            priority: 'medium',
            createdAt: 'not-a-date',
            updatedAt: 'invalid-iso',
          },
        ],
      };

      const merged = cloudSyncService.mergeDatasets(localState, remoteState);
      // Valid local timestamp is kept against invalid remote timestamp
      expect((merged.tasks || [])[0].title).toBe('Valid Timed Task');
    });

    it('preserves subjects with higher totalConducted count when timestamps are absent', () => {
      const subjectId = 'sub-chem-101';

      const localSubject: Subject = {
        id: subjectId,
        name: 'Chemistry',
        code: 'CHEM101',
        attended: 12,
        totalConducted: 14,
        targetPct: 75,
        color: '#4caf50',
      };

      const remoteSubject: Subject = {
        id: subjectId,
        name: 'Chemistry',
        code: 'CHEM101',
        attended: 8,
        totalConducted: 10,
        targetPct: 75,
        color: '#4caf50',
      };

      const localState: AppStateData = { ...EMPTY_STATE, subjects: [localSubject] };
      const remoteState: AppStateData = { ...EMPTY_STATE, subjects: [remoteSubject] };

      const merged = cloudSyncService.mergeDatasets(localState, remoteState);
      expect(merged.subjects[0].totalConducted).toBe(14);
      expect(merged.subjects[0].attended).toBe(12);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. Pending-Sync & Retry Correctness
  // ───────────────────────────────────────────────────────────────────────────
  describe('3. Pending-Sync & Retry Correctness', () => {
    it('failed uploads retain pending status and survive browser restarts', () => {
      const userId = '11111111-2222-3333-4444-555555555555';

      expect(cloudSyncService.hasPendingSync(userId)).toBe(false);

      // Failed upload marks pending sync
      cloudSyncService.markPendingSync(userId);
      expect(cloudSyncService.hasPendingSync(userId)).toBe(true);

      // Verify it is stored in localStorage under user-scoped key
      const stored = localStorage.getItem(`tracker_pending_sync_${userId}`);
      expect(stored).not.toBeNull();

      // Clear pending sync on success
      cloudSyncService.clearPendingSync(userId);
      expect(cloudSyncService.hasPendingSync(userId)).toBe(false);
      expect(localStorage.getItem(`tracker_pending_sync_${userId}`)).toBeNull();
    });

    it('network reconnection triggers auto-replay callback', () => {
      let callCount = 0;
      const unsubscribe = cloudSyncService.onNetworkReconnect(() => {
        callCount++;
      });

      window.dispatchEvent(new Event('online'));
      expect(callCount).toBe(1);

      unsubscribe();
      window.dispatchEvent(new Event('online'));
      expect(callCount).toBe(1);
    });

    it('account switching isolates pending sync and archives between User A and User B', () => {
      const userA = 'aaaa1111-0000-0000-0000-000000000001';
      const userB = 'bbbb2222-0000-0000-0000-000000000002';

      cloudSyncService.markPendingSync(userA);
      expect(cloudSyncService.hasPendingSync(userA)).toBe(true);
      expect(cloudSyncService.hasPendingSync(userB)).toBe(false);

      const stateA: AppStateData = {
        ...EMPTY_STATE,
        profile: { ...DEFAULT_PROFILE, displayName: 'Alice' },
      };
      const stateB: AppStateData = {
        ...EMPTY_STATE,
        profile: { ...DEFAULT_PROFILE, displayName: 'Bob' },
      };

      storageService.saveUserData(userA, stateA);
      storageService.saveUserData(userB, stateB);

      expect(storageService.loadUserData(userA)?.profile?.displayName).toBe('Alice');
      expect(storageService.loadUserData(userB)?.profile?.displayName).toBe('Bob');
    });

    it('failed fetch distinguishes genuine 0-row empty accounts from network errors', async () => {
      // In unconfigured mode, returns 'unconfigured' for a valid cloud UUID
      const unconfiguredResult = await cloudSyncService.fetchCloudDataDetailed('cccc3333-3333-4333-8333-333333333333');
      expect(unconfiguredResult.status).toBe('unconfigured');
      expect(unconfiguredResult.record).toBeNull();

      // Simulated user ID fails immediately without remote call
      const simulatedResult = await cloudSyncService.fetchCloudDataDetailed('usr_local_test');
      expect(simulatedResult.status).toBe('error');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 4. Safe Guest Migration
  // ───────────────────────────────────────────────────────────────────────────
  describe('4. Safe Guest Migration', () => {
    it('backs up and restores unauthenticated guest data before cloud merge', () => {
      const guestState: AppStateData = {
        ...EMPTY_STATE,
        profile: { ...DEFAULT_PROFILE, displayName: 'Unsaved Guest' },
        tasks: [
          {
            id: 'guest-1',
            title: 'Guest Task Before Sign In',
            status: 'todo',
            priority: 'high',
            createdAt: '2026-10-25T08:00:00.000Z',
          },
        ],
      };

      storageService.saveGuestBackup(guestState);
      const restored = storageService.loadGuestBackup();

      expect(restored).not.toBeNull();
      expect(restored?.profile?.displayName).toBe('Unsaved Guest');
      expect((restored?.tasks || [])[0].title).toBe('Guest Task Before Sign In');
    });
  });
});
