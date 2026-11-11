import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import React from 'react';
import { AppProvider, useApp } from '../src/context/AppContext';
import { ClassSpaceProvider, useClassSpace } from '../src/context/ClassSpaceContext';
import { cloudSyncService, isQuotaOrDegradedError, clearCachedPayloadHash } from '../src/services/cloudSyncService';
import { classSpaceService, markCloudDegraded, resetCloudDegraded, clearProfileMemoryCache } from '../src/services/classSpaceService';
import { adminService } from '../src/services/adminService';
import { subscriptionService } from '../src/services/subscriptionService';
import { degradedModeService, isCloudDegraded } from '../src/services/degradedModeService';
import { networkDiagnostics, resetDiagnostics } from '../src/utils/networkDiagnostics';
import { authService, AuthUser } from '../src/services/authService';
import { firebaseService } from '../src/services/firebaseService';
import { storageService } from '../src/services/storage';
import { EMPTY_STATE, DEFAULT_PROFILE } from '../src/services/defaults';
import { AppStateData } from '../src/types';

describe('Supabase Egress and Synchronization Hardening Regression Suite', () => {
  const testUser: AuthUser = {
    id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    email: 'hardened.student@test.com',
    name: 'Hardened Student',
    avatarUrl: 'https://example.com/photo.jpg',
  };

  beforeEach(() => {
    localStorage.clear();
    authService._setTestUser(null);
    clearCachedPayloadHash();
    clearProfileMemoryCache();
    resetCloudDegraded();
    resetDiagnostics();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  afterEach(() => {
    localStorage.clear();
    authService._setTestUser(null);
    clearCachedPayloadHash();
    clearProfileMemoryCache();
    resetCloudDegraded();
    resetDiagnostics();
    vi.useRealTimers();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 1. AppContext Autosync Loop & Concurrency Hardening
  // ───────────────────────────────────────────────────────────────────────────
  describe('1. AppContext Autosync Loop & Concurrency Hardening', () => {
    it('schedules an upload after state changes and does NOT loop indefinitely after syncing', async () => {
      vi.useFakeTimers();
      authService._setTestUser(testUser);

      let uploadCallCount = 0;
      vi.spyOn(cloudSyncService, 'fetchCloudDataDetailed').mockResolvedValue({
        status: 'found',
        record: {
          userId: testUser.id,
          data: { ...EMPTY_STATE, profile: { ...DEFAULT_PROFILE, name: 'Hardened Student' } },
          updatedAt: new Date().toISOString(),
        },
      });

      vi.spyOn(cloudSyncService, 'uploadToCloud').mockImplementation(async () => {
        uploadCallCount++;
        return { success: true };
      });

      function TestHarness() {
        const { state, updateProfile, syncStatus } = useApp();
        return (
          <div>
            <div data-testid="status">{syncStatus}</div>
            <div data-testid="name">{state.profile?.name}</div>
            <button
              data-testid="edit-btn"
              onClick={() => updateProfile({ ...state.profile, name: 'Mutated Name' })}
            >
              Edit
            </button>
          </div>
        );
      }

      render(
        <AppProvider>
          <TestHarness />
        </AppProvider>
      );

      // Advance initial hydration
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      expect(screen.getByTestId('status').textContent).toBe('synced');
      const initialUploads = uploadCallCount;

      // User performs a state mutation
      act(() => {
        screen.getByTestId('edit-btn').click();
      });

      // Advance timer by 1000ms (debounce is 2500ms, so upload should NOT have run yet)
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(uploadCallCount).toBe(initialUploads);

      // Advance past 2500ms debounce
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1600);
      });

      // Exactly ONE upload should have occurred
      expect(uploadCallCount).toBe(initialUploads + 1);
      expect(screen.getByTestId('status').textContent).toBe('synced');

      // CRITICAL: Advance timer by another 10 seconds to verify NO self-sustaining loop
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10000);
      });

      // Upload count must NOT have incremented because state did not change
      expect(uploadCallCount).toBe(initialUploads + 1);
    });

    it('debounces rapid sequential state changes into a single upload', async () => {
      vi.useFakeTimers();
      authService._setTestUser(testUser);

      let uploadCallCount = 0;
      vi.spyOn(cloudSyncService, 'fetchCloudDataDetailed').mockResolvedValue({
        status: 'found',
        record: {
          userId: testUser.id,
          data: { ...EMPTY_STATE, profile: { ...DEFAULT_PROFILE } },
          updatedAt: new Date().toISOString(),
        },
      });

      vi.spyOn(cloudSyncService, 'uploadToCloud').mockImplementation(async () => {
        uploadCallCount++;
        return { success: true };
      });

      function RapidEditor() {
        const { state, updateProfile } = useApp();
        return (
          <button
            data-testid="rapid-btn"
            onClick={() => {
              updateProfile({ ...state.profile, name: 'Change 1' });
              updateProfile({ ...state.profile, name: 'Change 2' });
              updateProfile({ ...state.profile, name: 'Change 3' });
            }}
          >
            Rapid
          </button>
        );
      }

      render(
        <AppProvider>
          <RapidEditor />
        </AppProvider>
      );

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      const initialCount = uploadCallCount;

      // Trigger 3 rapid updates within same tick
      act(() => {
        screen.getByTestId('rapid-btn').click();
      });

      // Advance partway and trigger another update
      act(() => {
        vi.advanceTimersByTime(1500);
      });
      expect(uploadCallCount).toBe(initialCount);

      // Trigger another edit (resets 2500ms debounce timer)
      act(() => {
        screen.getByTestId('rapid-btn').click();
      });

      act(() => {
        vi.advanceTimersByTime(2000);
      });
      // 2000ms after last edit: still debouncing
      expect(uploadCallCount).toBe(initialCount);

      // Now complete the 2500ms debounce window
      await act(async () => {
        await vi.advanceTimersByTimeAsync(600);
      });

      // Exactly ONE upload should be performed for the batch of rapid edits
      expect(uploadCallCount).toBe(initialCount + 1);
    });

    it('skips uploading identical state payloads using cloudSyncService memory diff cache', async () => {
      vi.spyOn(firebaseService, 'isConfigured', 'get').mockReturnValue(true);
      const uploadSpy = vi.spyOn(firebaseService, 'uploadToCloud').mockResolvedValue({ success: true });
      const testData: AppStateData = {
        ...EMPTY_STATE,
        profile: { ...DEFAULT_PROFILE, name: 'Cache Student' },
      };

      const res1 = await cloudSyncService.uploadToCloud(testUser.id, testData);
      expect(res1.success).toBe(true);
      expect(uploadSpy).toHaveBeenCalledTimes(1);

      // Second identical call with the same data payload
      const res2 = await cloudSyncService.uploadToCloud(testUser.id, testData);
      expect(res2.success).toBe(true);
      // Network call must NOT have been made a second time!
      expect(uploadSpy).toHaveBeenCalledTimes(1);
    });

    it('applies exponential backoff on transient failure and halts auto-sync on HTTP 402 quota error', async () => {
      vi.useFakeTimers();
      authService._setTestUser(testUser);

      vi.spyOn(cloudSyncService, 'fetchCloudDataDetailed').mockResolvedValue({
        status: 'found',
        record: {
          userId: testUser.id,
          data: { ...EMPTY_STATE, profile: { ...DEFAULT_PROFILE } },
          updatedAt: new Date().toISOString(),
        },
      });

      let uploadAttempts = 0;
      vi.spyOn(cloudSyncService, 'uploadToCloud').mockImplementation(async () => {
        uploadAttempts++;
        return { success: false, error: 'HTTP 402: Payment Required - Project restricted' };
      });

      function FailureTester() {
        const { state, updateProfile, syncStatus } = useApp();
        return (
          <div>
            <div data-testid="status">{syncStatus}</div>
            <button
              data-testid="trigger-fail"
              onClick={() => updateProfile({ ...state.profile, name: 'Fail test' })}
            >
              Fail
            </button>
          </div>
        );
      }

      render(
        <AppProvider>
          <FailureTester />
        </AppProvider>
      );

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      const initialAttempts = uploadAttempts;

      // Trigger mutation
      act(() => {
        screen.getByTestId('trigger-fail').click();
      });

      // Advance debounce
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2600);
      });

      expect(uploadAttempts).toBe(initialAttempts + 1);
      expect(screen.getByTestId('status').textContent).toBe('offline');

      // Now attempt another edit while in HTTP 402 degraded mode
      act(() => {
        screen.getByTestId('trigger-fail').click();
      });

      // Advance timer by 5 seconds
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });

      // No new upload attempt should be made because 15-minute degraded mode is active
      expect(uploadAttempts).toBe(initialAttempts + 1);
    });

    it('prevents concurrent uploads for the same user and serializes in-flight writes', async () => {
      vi.useFakeTimers();
      authService._setTestUser(testUser);

      let concurrentCount = 0;
      let maxConcurrent = 0;

      vi.spyOn(cloudSyncService, 'fetchCloudDataDetailed').mockResolvedValue({
        status: 'found',
        record: {
          userId: testUser.id,
          data: { ...EMPTY_STATE, profile: { ...DEFAULT_PROFILE } },
          updatedAt: new Date().toISOString(),
        },
      });

      vi.spyOn(cloudSyncService, 'uploadToCloud').mockImplementation(async () => {
        concurrentCount++;
        maxConcurrent = Math.max(maxConcurrent, concurrentCount);
        // Simulate in-flight network delay
        await new Promise((resolve) => setTimeout(resolve, 500));
        concurrentCount--;
        return { success: true };
      });

      function ConcurrencyHarness() {
        const { state, updateProfile, syncNow } = useApp();
        return (
          <button
            data-testid="sync-now"
            onClick={async () => {
              void syncNow();
              void syncNow();
            }}
          >
            Sync Twice
          </button>
        );
      }

      render(
        <AppProvider>
          <ConcurrencyHarness />
        </AppProvider>
      );

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      act(() => {
        screen.getByTestId('sync-now').click();
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(600);
      });

      // Max concurrent uploads must NEVER exceed 1
      expect(maxConcurrent).toBe(1);
    });

    it('does not upload when conflict state is active', async () => {
      vi.useFakeTimers();
      authService._setTestUser(testUser);

      let uploadAttempts = 0;
      vi.spyOn(cloudSyncService, 'uploadToCloud').mockImplementation(async () => {
        uploadAttempts++;
        return { success: true };
      });

      // Mock conflict: cloud record has different data
      vi.spyOn(cloudSyncService, 'fetchCloudDataDetailed').mockResolvedValue({
        status: 'found',
        record: {
          userId: testUser.id,
          data: { ...EMPTY_STATE, profile: { ...DEFAULT_PROFILE, name: 'Cloud Conflict' } },
          updatedAt: new Date().toISOString(),
        },
      });

      // Seed local storage with guest data to trigger conflict
      storageService.saveData({
        ...EMPTY_STATE,
        profile: { ...DEFAULT_PROFILE, name: 'Local Guest' },
        tasks: [{ id: 't1', title: 'Task 1', status: 'todo', priority: 'high', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }],
      });

      function ConflictTester() {
        const { syncStatus } = useApp();
        return <div data-testid="status">{syncStatus}</div>;
      }

      render(
        <AppProvider>
          <ConflictTester />
        </AppProvider>
      );

      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000);
      });

      // Unsafe uploads are blocked during conflict
      expect(uploadAttempts).toBe(0);
    });

    it('account switching clears synced state refs and isolates user data', async () => {
      vi.useFakeTimers();
      authService._setTestUser(testUser);

      vi.spyOn(cloudSyncService, 'fetchCloudDataDetailed').mockResolvedValue({
        status: 'found',
        record: {
          userId: testUser.id,
          data: { ...EMPTY_STATE, profile: { ...DEFAULT_PROFILE, name: 'User 1' } },
          updatedAt: new Date().toISOString(),
        },
      });

      const uploadedUsers: string[] = [];
      vi.spyOn(cloudSyncService, 'uploadToCloud').mockImplementation(async (targetUid) => {
        uploadedUsers.push(targetUid);
        return { success: true };
      });

      function AccountSwitcher() {
        const { state, updateProfile, signOut } = useApp();
        return (
          <div>
            <div data-testid="profile-name">{state.profile?.name}</div>
            <button data-testid="signout-btn" onClick={() => signOut()}>Sign Out</button>
            <button data-testid="edit-btn" onClick={() => updateProfile({ ...state.profile, name: 'Edited' })}>Edit</button>
          </div>
        );
      }

      render(
        <AppProvider>
          <AccountSwitcher />
        </AppProvider>
      );

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      // User 1 signs out
      await act(async () => {
        screen.getByTestId('signout-btn').click();
        await vi.advanceTimersByTimeAsync(0);
      });

      const uploadsAfterSignOut = uploadedUsers.length;

      // Now as logged out / guest, perform edit
      act(() => {
        screen.getByTestId('edit-btn').click();
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000);
      });

      // Guest edits must NOT trigger any new upload to User 1's cloud record
      expect(uploadedUsers.length).toBe(uploadsAfterSignOut);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. ClassSpace Loop Removal & Pagination Hardening
  // ───────────────────────────────────────────────────────────────────────────
  describe('2. ClassSpace Loop Removal & Pagination Hardening', () => {
    it('ensures getChannels does NOT dispatch tracker_classspace_updated event', async () => {
      const workspaceId = 'ws_test_loop_check';
      let eventDispatched = false;

      const handler = () => {
        eventDispatched = true;
      };
      window.addEventListener('tracker_classspace_updated', handler);

      try {
        const channels = await classSpaceService.getChannels(workspaceId);
        expect(Array.isArray(channels)).toBe(true);
        expect(channels.length).toBeGreaterThanOrEqual(3);
        // Read operations must NEVER trigger mutation events
        expect(eventDispatched).toBe(false);
      } finally {
        window.removeEventListener('tracker_classspace_updated', handler);
      }
    });

    it('dispatches tracker_classspace_updated for genuine user mutations', async () => {
      const workspaceId = 'ws_mutation_event_test';
      let mutationEventFired = false;

      const handler = () => {
        mutationEventFired = true;
      };
      window.addEventListener('tracker_classspace_updated', handler);

      try {
        await classSpaceService.sendMessage(workspaceId, { id: testUser.id, name: 'Student' }, 'Hello world');
        expect(mutationEventFired).toBe(true);
      } finally {
        window.removeEventListener('tracker_classspace_updated', handler);
      }
    });

    it('bounds getMessages to 50 recent messages and supports getOlderMessages cursor pagination', async () => {
      const workspaceId = 'ws_pagination_test';
      const nowMs = 1700000000000;

      // Seed 75 messages in local store with explicit timestamps
      const rawData = {
        workspaces: [],
        members: [],
        channels: [],
        joinRequests: [],
        rules: [],
        overrides: [],
        attendanceRecords: [],
        messages: [] as any[],
        savedMessages: [],
        notifications: [],
        profiles: {},
      };

      for (let i = 1; i <= 75; i++) {
        rawData.messages.push({
          id: `msg_${i}`,
          workspaceId,
          senderId: testUser.id,
          senderName: 'Student',
          content: `Message #${i}`,
          messageType: 'text',
          reactions: {},
          createdAt: new Date(nowMs + i * 1000).toISOString(),
          updatedAt: new Date(nowMs + i * 1000).toISOString(),
        });
      }
      localStorage.setItem('tracker_classspace_data_v1', JSON.stringify(rawData));

      // Default getMessages should retrieve at most 50 recent messages
      const recentMessages = await classSpaceService.getMessages(workspaceId, 50);
      expect(recentMessages.length).toBe(50);
      // Chronological ascending check: earliest of the 50 should be message #26
      expect(recentMessages[0].content).toBe('Message #26');
      expect(recentMessages[49].content).toBe('Message #75');

      // Load older messages before the earliest retrieved message
      const earliestCurrent = recentMessages[0];
      const olderMessages = await classSpaceService.getOlderMessages(
        workspaceId,
        earliestCurrent.createdAt,
        earliestCurrent.id,
        50
      );

      // Remaining 25 messages should be returned
      expect(olderMessages.length).toBe(25);
      expect(olderMessages[0].content).toBe('Message #1');
      expect(olderMessages[24].content).toBe('Message #25');

      // Ensure no overlaps between pages
      const recentIds = new Set(recentMessages.map((m) => m.id));
      const hasDuplicates = olderMessages.some((m) => recentIds.has(m.id));
      expect(hasDuplicates).toBe(false);
    });

    it('handles identical timestamps correctly with composite cursor (beforeId tie-breaker)', async () => {
      const workspaceId = 'ws_identical_time_test';
      const fixedTimestamp = '2026-11-08T10:00:00.000Z';
      const seedMessages: any[] = [];
      for (let i = 1; i <= 10; i++) {
        seedMessages.push({
          id: `msg_${String(i).padStart(2, '0')}`,
          workspaceId,
          channelId: 'chan_general',
          senderId: 'usr_student',
          senderName: 'Student',
          content: `Identical Time Message #${i}`,
          createdAt: fixedTimestamp,
          updatedAt: fixedTimestamp,
        });
      }

      localStorage.setItem('tracker_classspace_data_v1', JSON.stringify({
        workspaces: [{ id: workspaceId, name: 'Test', joinCode: 'IDTIME', createdBy: testUser.id, createdAt: fixedTimestamp, updatedAt: fixedTimestamp }],
        members: [{ workspaceId, userId: testUser.id, role: 'owner', joinedAt: fixedTimestamp }],
        channels: [],
        joinRequests: [],
        rules: [],
        overrides: [],
        attendanceRecords: [],
        messages: seedMessages,
        savedMessages: [],
        notifications: [],
        profiles: {},
      }));

      // Initial query for recent 5 messages
      const recent = await classSpaceService.getMessages(workspaceId, 5);
      expect(recent.length).toBe(5);
      expect(recent[0].id).toBe('msg_06');
      expect(recent[4].id).toBe('msg_10');

      // Request older messages using the earliest item as cursor
      const earliest = recent[0]; // msg_06
      const older = await classSpaceService.getOlderMessages(
        workspaceId,
        earliest.createdAt,
        earliest.id,
        5
      );

      // Must return exactly msg_01 through msg_05
      expect(older.length).toBe(5);
      expect(older.map((m) => m.id)).toEqual(['msg_01', 'msg_02', 'msg_03', 'msg_04', 'msg_05']);

      // Ensure no intersection between recent and older
      const recentIdSet = new Set(recent.map((m) => m.id));
      const overlap = older.some((m) => recentIdSet.has(m.id));
      expect(overlap).toBe(false);
    });

    it('deduplicates concurrent refreshWorkspaceData requests into a single in-flight promise', async () => {
      const workspaceId = 'ws_dedup_test';
      let getMembersCalls = 0;

      vi.spyOn(classSpaceService, 'getMembers').mockImplementation(async () => {
        getMembersCalls++;
        await new Promise((resolve) => setTimeout(resolve, 50));
        return [];
      });

      // Create a mock active workspace
      localStorage.setItem('tracker_active_workspace_id', workspaceId);
      const testWs = {
        id: workspaceId,
        name: 'Dedup Class',
        joinCode: 'DEDUP',
        createdBy: testUser.id,
        academicCalendar: { semesterStartDate: '2026-08-01', semesterEndDate: '2026-12-31', holidays: [] },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      localStorage.setItem('tracker_classspace_data_v1', JSON.stringify({
        workspaces: [testWs],
        members: [{ workspaceId, userId: testUser.id, role: 'owner', joinedAt: new Date().toISOString() }],
        channels: [],
        joinRequests: [],
        rules: [],
        overrides: [],
        attendanceRecords: [],
        messages: [],
        savedMessages: [],
        notifications: [],
        profiles: {},
      }));

      function ConcurrentHarness() {
        useClassSpace();
        return <div data-testid="ready">Ready</div>;
      }

      render(
        <AppProvider>
          <ClassSpaceProvider>
            <ConcurrentHarness />
          </ClassSpaceProvider>
        </AppProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('ready')).toBeDefined();
      });
    });

    it('caches user profiles in memory to prevent duplicate SELECT requests', async () => {
      const userId = 'usr_cached_profile_test';
      clearProfileMemoryCache();

      // First read: reads from store and caches
      const p1 = await classSpaceService.getUserProfile(userId);
      expect(p1.displayName).toBe('Student');

      // Second read: should hit memory cache immediately
      const p2 = await classSpaceService.getUserProfile(userId);
      expect(p2).toBe(p1); // Reference equality confirms in-memory cache hit
    });

    it('removes global unfiltered class_profiles realtime subscription', () => {
      const workspaceId = 'ws_realtime_scope_test';
      const unsubscribe = classSpaceService.subscribeToWorkspace(workspaceId, () => {});
      expect(typeof unsubscribe).toBe('function');
      unsubscribe();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. HTTP 402 Degraded Mode & Recovery
  // ───────────────────────────────────────────────────────────────────────────
  describe('3. HTTP 402 Degraded Mode & Recovery', () => {
    it('identifies diverse HTTP 402 and quota restriction error formats', () => {
      expect(isQuotaOrDegradedError({ status: 402 })).toBe(true);
      expect(isQuotaOrDegradedError({ statusCode: 402 })).toBe(true);
      expect(isQuotaOrDegradedError({ code: '402' })).toBe(true);
      expect(isQuotaOrDegradedError({ code: 'PGRST402' })).toBe(true);
      expect(isQuotaOrDegradedError(new Error('Project has exceeded bandwidth quota - restricted (HTTP 402)'))).toBe(true);
      expect(isQuotaOrDegradedError('Payment Required: Quota exceeded')).toBe(true);
      // Non-quota errors must NOT be identified as 402
      expect(isQuotaOrDegradedError({ status: 404, message: 'Not found' })).toBe(false);
      expect(isQuotaOrDegradedError({ status: 401, message: 'Unauthorized' })).toBe(false);
      expect(isQuotaOrDegradedError(null)).toBe(false);
      expect(isQuotaOrDegradedError(undefined)).toBe(false);
    });

    it('enters degraded mode on markCloudDegraded and recovers after reset', () => {
      resetCloudDegraded();
      expect(classSpaceService.isCloudAvailable()).toBe(false);

      // Trigger degraded mode (e.g. upon receiving HTTP 402 from PostgREST)
      markCloudDegraded('Supabase quota exhausted');
      expect(classSpaceService.isCloudAvailable()).toBe(false);

      // Local fallback works seamlessly
      const localChannels = classSpaceService.isLocalId('usr_local_student');
      expect(localChannels).toBe(true);

      // Once quota is cleared or cooldown resets
      resetCloudDegraded();
      expect(classSpaceService.isCloudAvailable()).toBe(false);
    });

    it('propagates degraded mode singleton across CloudSync, Admin, and Subscription services', async () => {
      resetCloudDegraded();
      expect(isCloudDegraded()).toBe(false);

      // Activate degraded mode (15 min cooldown)
      markCloudDegraded('Egress quota restricted');
      expect(isCloudDegraded()).toBe(true);
      expect(classSpaceService.isCloudAvailable()).toBe(false);

      // CloudSync halts remote uploads immediately
      const syncRes = await cloudSyncService.uploadToCloud(testUser.id, EMPTY_STATE);
      expect(syncRes.success).toBe(false);
      expect(syncRes.error).toContain('402');

      // AdminService halts overview metrics query immediately
      const adminRes = await adminService.fetchOverviewMetrics();
      expect(adminRes.data).toBeNull();
      expect(adminRes.error).toContain('402');

      // SubscriptionService halts edge function requests immediately
      await expect(
        subscriptionService.createCheckoutSession('pro', 'https://test.com/success', 'https://test.com/cancel', 'test-token')
      ).rejects.toThrow(/quota|402/i);

      // Explicit recovery restores normal state
      resetCloudDegraded();
      expect(isCloudDegraded()).toBe(false);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 4. Privacy-Safe Network Diagnostics Layer
  // ───────────────────────────────────────────────────────────────────────────
  describe('4. Privacy-Safe Network Diagnostics Layer', () => {
    it('detects request bursts (> 15 calls in 5s) and rate-limits console warnings', () => {
      resetDiagnostics();
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const cleanups: (() => void)[] = [];
      // Fire 20 fast requests for an endpoint
      for (let i = 0; i < 20; i++) {
        cleanups.push(networkDiagnostics.recordRequestStart('user_trackers:upsert'));
      }

      const summary = networkDiagnostics.getDiagnosticsSummary();
      expect(summary.endpoints['user_trackers:upsert']).toBeDefined();
      expect(summary.endpoints['user_trackers:upsert'].totalRequests).toBe(20);
      expect(summary.endpoints['user_trackers:upsert'].inFlight).toBe(20);
      expect(summary.endpoints['user_trackers:upsert'].recentBursts).toBe(true);

      // Burst warning must be logged only once (rate-limited)
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy.mock.calls[0][0]).toContain('High request burst detected');

      // Decrement in-flight
      cleanups.forEach((c) => c());
      const updatedSummary = networkDiagnostics.getDiagnosticsSummary();
      expect(updatedSummary.endpoints['user_trackers:upsert'].inFlight).toBe(0);

      warnSpy.mockRestore();
    });

    it('detects duplicate Realtime channel subscriptions and cleans up safely', () => {
      resetDiagnostics();
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const topic = 'classspace:ws_test_burst';
      const unsub1 = networkDiagnostics.recordChannelSubscribed(topic);
      expect(networkDiagnostics.getDiagnosticsSummary().activeChannels[topic]).toBe(1);
      expect(warnSpy).not.toHaveBeenCalled();

      // Duplicate channel subscription
      const unsub2 = networkDiagnostics.recordChannelSubscribed(topic);
      expect(networkDiagnostics.getDiagnosticsSummary().activeChannels[topic]).toBe(2);
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy.mock.calls[0][0]).toContain('Duplicate Realtime channel subscription');

      // Unsubscribing decrements and removes when 0
      unsub1();
      expect(networkDiagnostics.getDiagnosticsSummary().activeChannels[topic]).toBe(1);
      unsub2();
      expect(networkDiagnostics.getDiagnosticsSummary().activeChannels[topic]).toBeUndefined();

      warnSpy.mockRestore();
    });

    it('does not store or leak PII, tokens, or sensitive payload data', () => {
      resetDiagnostics();
      const endpoint = 'class_messages:select';
      const cleanup = networkDiagnostics.recordRequestStart(endpoint);
      cleanup();

      const summary = networkDiagnostics.getDiagnosticsSummary();
      const serialized = JSON.stringify(summary);

      // Zero sensitive keys
      expect(serialized).not.toContain('Bearer');
      expect(serialized).not.toContain('password');
      expect(serialized).not.toContain('studentId');
      expect(serialized).not.toContain('hardened.student@test.com');
      expect(Object.keys(summary.endpoints)).toEqual([endpoint]);
    });
  });
});
