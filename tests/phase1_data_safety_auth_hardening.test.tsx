import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { storageService, EMPTY_STATE, DEFAULT_SETTINGS } from '../src/services/storage';
import { authService, AuthUser } from '../src/services/authService';
import { cloudSyncService } from '../src/services/cloudSyncService';
import { classSpaceService } from '../src/services/classSpaceService';
import { AppStateData } from '../src/types';

describe('Phase 1 — Production Data Safety & Authentication Hardening', () => {
  beforeEach(async () => {
    localStorage.clear();
    await authService.signOut();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // 1. Fresh installation initializes a valid empty state without sample records
  it('1. Fresh installation initializes a valid empty state without sample records', () => {
    const freshData = storageService.loadData();

    expect(freshData.hasSampleData).toBe(false);
    expect(freshData.subjects).toEqual([]);
    expect(freshData.timetable).toEqual([]);
    expect(freshData.attendanceLogs).toEqual([]);
    expect(freshData.tasks).toEqual([]);
    expect(freshData.events).toEqual([]);
    expect(freshData.mockTests).toEqual([]);
    expect(freshData.errorLogs).toEqual([]);
    expect(freshData.gymWorkouts).toEqual([]);
    expect(freshData.studySessions).toEqual([]);
    expect(freshData.foodDiaryEntries).toEqual([]);
    expect(freshData.customFoods).toEqual([]);
    expect(freshData.recipes).toEqual([]);
    expect(freshData.weightLogs).toEqual([]);
    expect(freshData.spacedReviews).toEqual([]);
    expect(freshData.dailyQuestions).toEqual([]);
    expect(freshData.profile).toBeDefined();
    expect(freshData.settings).toBeDefined();
    expect(freshData.schemaVersion).toBe(2);
  });

  // 2. Valid existing local dataset loads unchanged
  it('2. Valid existing local dataset loads unchanged', () => {
    const existingData: AppStateData = {
      ...EMPTY_STATE,
      hasSampleData: false,
      profile: {
        displayName: 'Jane Doe',
        targetExam: 'GATE 2027',
        examDate: '2027-02-05',
      },
      settings: {
        ...DEFAULT_SETTINGS,
        accentColor: 'sage',
        themeMode: 'dark',
      },
      subjects: [
        {
          id: 'sub-user-1',
          code: 'CS101',
          name: 'Computer Networks',
          attended: 14,
          totalConducted: 15,
          targetPct: 80,
          color: '#3D6A8A',
        },
      ],
      timetable: [
        {
          id: 'slot-user-1',
          subjectId: 'sub-user-1',
          dayOfWeek: 1,
          startTime: '10:00',
          endTime: '11:00',
        },
      ],
      attendanceLogs: [
        {
          id: 'log-user-1',
          slotId: 'slot-user-1',
          subjectId: 'sub-user-1',
          date: '2026-10-23',
          status: 'present',
          timestamp: '2026-10-23T10:05:00Z',
        },
      ],
      tasks: [
        {
          id: 'task-user-1',
          title: 'Implement sliding window protocol',
          status: 'in_progress',
          priority: 'high',
          createdAt: '2026-10-23T08:00:00Z',
        },
      ],
    };

    storageService.saveData(existingData);
    const loaded = storageService.loadData();

    expect(loaded.profile?.displayName).toBe('Jane Doe');
    expect(loaded.profile?.targetExam).toBe('GATE 2027');
    expect(loaded.settings?.accentColor).toBe('sage');
    expect(loaded.settings?.themeMode).toBe('dark');
    expect(loaded.subjects.length).toBe(1);
    expect(loaded.subjects[0].name).toBe('Computer Networks');
    expect(loaded.timetable.length).toBe(1);
    expect(loaded.timetable[0].startTime).toBe('10:00');
    expect(loaded.attendanceLogs.length).toBe(1);
    expect(loaded.tasks?.length).toBe(1);
    expect(loaded.tasks?.[0].title).toBe('Implement sliding window protocol');
  });

  // 3. Existing user data survives normal initialization and migrations
  it('3. Existing user data survives v1 to v2 migration intact', () => {
    const v1Data = {
      subjects: [
        {
          id: 'v1-sub-1',
          code: 'EE101',
          name: 'Circuit Theory',
          attended: 8,
          totalConducted: 10,
          targetPct: 75,
          color: '#C45532',
        },
      ],
      timetable: [
        {
          id: 'v1-tt-1',
          subjectId: 'v1-sub-1',
          dayOfWeek: 2,
          startTime: '09:00',
          endTime: '10:00',
        },
      ],
      attendanceLogs: [
        {
          id: 'v1-log-1',
          slotId: 'v1-tt-1',
          subjectId: 'v1-sub-1',
          date: '2026-09-01',
          status: 'present',
          timestamp: '2026-09-01T09:00:00Z',
        },
      ],
      studySessions: [],
      gymWorkouts: [],
      reminders: [],
      profile: {
        displayName: 'V1 Senior Scholar',
        targetExam: 'Semester Finals',
      },
      settings: {
        themeMode: 'light',
        accentColor: 'terracotta',
      },
    };

    localStorage.setItem('tracker_app_data_v1', JSON.stringify(v1Data));

    const migrated = storageService.loadData();

    expect(migrated.schemaVersion).toBe(2);
    expect(migrated.profile?.displayName).toBe('V1 Senior Scholar');
    expect(migrated.subjects.length).toBe(1);
    expect(migrated.subjects[0].name).toBe('Circuit Theory');
    expect(migrated.timetable.length).toBe(1);
    expect(migrated.attendanceLogs.length).toBe(1);
    // V2 collections are initialized cleanly
    expect(Array.isArray(migrated.tasks)).toBe(true);
    expect(Array.isArray(migrated.events)).toBe(true);
    expect(Array.isArray(migrated.mockTests)).toBe(true);
  });

  // 4. Missing demo flags do not trigger destructive behavior
  it('4. Missing demo flags do not trigger destructive behavior', () => {
    const dataWithoutDemoFlag = {
      profile: { displayName: 'Real User', targetExam: 'University Exams' },
      settings: { themeMode: 'system' },
      subjects: [
        {
          id: 'user-sub-100',
          code: 'CS401',
          name: 'Distributed Systems',
          attended: 20,
          totalConducted: 20,
          targetPct: 75,
          color: '#3D6A8A',
        },
      ],
      timetable: [],
      attendanceLogs: [],
      schemaVersion: 2,
    };

    localStorage.setItem('tracker_app_data_v2', JSON.stringify(dataWithoutDemoFlag));
    const loaded = storageService.loadData();

    expect(loaded.hasSampleData).toBe(false);
    expect(loaded.subjects.length).toBe(1);
    expect(loaded.subjects[0].id).toBe('user-sub-100');
    expect(loaded.subjects[0].name).toBe('Distributed Systems');
  });

  // 5. Legacy demo-like records are not automatically deleted on startup
  it('5. Legacy demo-like records are not automatically deleted on startup', () => {
    const datasetWithCommonIds = {
      ...EMPTY_STATE,
      hasSampleData: false,
      subjects: [
        {
          id: 'sub-1',
          code: 'CS201',
          name: 'My Actual Data Structures Class',
          attended: 10,
          totalConducted: 12,
          targetPct: 75,
          color: '#C45532',
        },
      ],
      tasks: [
        {
          id: 'task-1',
          title: 'My Custom Homework',
          status: 'todo',
          priority: 'high',
          createdAt: '2026-10-23T00:00:00Z',
        },
      ],
    };

    localStorage.setItem('tracker_app_data_v2', JSON.stringify(datasetWithCommonIds));
    const loaded = storageService.loadData();

    expect(loaded.subjects.length).toBe(1);
    expect(loaded.subjects[0].name).toBe('My Actual Data Structures Class');
    expect(loaded.tasks?.length).toBe(1);
    expect(loaded.tasks?.[0].title).toBe('My Custom Homework');
  });

  // 6. Missing Supabase configuration preserves offline personal usage
  it('6. Missing Supabase configuration preserves offline personal usage', async () => {
    expect(authService.isConfigured).toBe(false);

    // Personal user can save and retrieve data locally without internet/cloud
    const data = storageService.loadData();
    data.subjects.push({
      id: 'sub-offline-1',
      code: 'OFF101',
      name: 'Offline Engineering',
      attended: 5,
      totalConducted: 5,
      targetPct: 75,
      color: '#436650',
    });
    storageService.saveData(data);

    const reloaded = storageService.loadData();
    expect(reloaded.subjects.some((s) => s.id === 'sub-offline-1')).toBe(true);

    const currentUser = await authService.getCurrentUser();
    expect(currentUser).toBeNull();
  });

  // 7. Google Sign-In returns error and does NOT fabricate a user when cloud is unconfigured
  it('7. Google Sign-In returns error and does NOT fabricate a user when cloud is unconfigured', async () => {
    const result = await authService.signInWithGoogle();

    expect(result.user).toBeUndefined();
    expect(result.error).toBeDefined();
    expect(result.error).toMatch(/cloud services are not configured/i);

    const currentUser = await authService.getCurrentUser();
    expect(currentUser).toBeNull();
    // Ensure mock key is never written in localStorage
    expect(localStorage.getItem('tracker_mock_auth_user')).toBeNull();
  });

  // 8. OAuth failure does NOT create a mock authenticated session
  it('8. OAuth failure does NOT create a mock authenticated session', async () => {
    // If signInWithGoogle fails or throws
    const res = await authService.signInWithGoogle();
    expect(res.error).toBeTruthy();
    expect(res.user).toBeUndefined();

    // Verify session state is completely unauthenticated
    const user = await authService.getCurrentUser();
    expect(user).toBeNull();
  });

  // 9. Mock identity cannot authorize remote ClassSpace mutations
  it('9. Mock identity cannot authorize remote ClassSpace mutations', async () => {
    const mockUser: AuthUser = {
      id: 'usr_local_student',
      email: 'student.local@tracker.dev',
      name: 'Local Student',
      isSimulated: true,
    };

    // Cloud sync rejects simulated identity
    const uploadResult = await cloudSyncService.uploadToCloud(mockUser.id, EMPTY_STATE);
    expect(uploadResult.success).toBe(false);
    expect(uploadResult.error).toBeDefined();

    // fetchCloudData returns null for simulated identity
    const fetched = await cloudSyncService.fetchCloudData(mockUser.id);
    expect(fetched).toBeNull();
  });

  // 10. Cloud-sync failure preserves genuine local data
  it('10. Cloud-sync failure preserves genuine local data', async () => {
    const originalLocalData: AppStateData = {
      ...EMPTY_STATE,
      profile: { displayName: 'Preserved Student', targetExam: 'Semester Exam' },
      subjects: [
        {
          id: 'sub-preserve-1',
          code: 'CS301',
          name: 'Critical Notes Subject',
          attended: 25,
          totalConducted: 25,
          targetPct: 85,
          color: '#3D6A8A',
        },
      ],
    };
    storageService.saveData(originalLocalData);

    // Attempting upload when unconfigured or simulated fails
    const result = await cloudSyncService.uploadToCloud('usr_local_student', originalLocalData);
    expect(result.success).toBe(false);

    // Local data remains identical
    const current = storageService.loadData();
    expect(current.profile?.displayName).toBe('Preserved Student');
    expect(current.subjects.length).toBe(1);
    expect(current.subjects[0].id).toBe('sub-preserve-1');
  });

  // 11. Existing ClassSpace, attendance, timetable, syllabus, focus, nutrition, gym, and settings behavior remains intact
  it('11. Existing ClassSpace local operations work offline without regressions', async () => {
    const localUser: AuthUser = {
      id: 'usr_local_test_cr',
      email: 'cr@test.local',
      name: 'Test CR',
      isSimulated: true,
    };

    // Create workspace locally
    const created = await classSpaceService.createWorkspace(localUser, {
      name: 'CS 2026 Batch Alpha',
      department: 'Computer Science',
      section: 'A',
      batch: '2026',
    });

    expect(created.error).toBeUndefined();
    expect(created.workspace).toBeDefined();
    expect(created.workspace?.name).toBe('CS 2026 Batch Alpha');
    expect(created.workspace?.joinCode).toHaveLength(5);
    expect(created.member?.role).toBe('cr');

    // Retrieve workspaces for user locally
    const workspaces = await classSpaceService.getWorkspacesForUser(localUser.id);
    expect(workspaces.length).toBe(1);
    expect(workspaces[0].name).toBe('CS 2026 Batch Alpha');

    // Join workspace by code
    const studentUser: AuthUser = {
      id: 'usr_local_test_student',
      email: 'student@test.local',
      name: 'Test Student',
      isSimulated: true,
    };

    const joined = await classSpaceService.joinWorkspaceByCode(studentUser, created.workspace!.joinCode);
    expect(joined.error).toBeUndefined();
    expect(joined.workspace?.id).toBe(created.workspace?.id);
    expect(joined.member?.role).toBe('member');
  });

  // 12. Existing conflict-resolution behavior remains available
  it('12. Existing conflict-resolution behavior merges local and cloud datasets without losing records', () => {
    const localData: AppStateData = {
      ...EMPTY_STATE,
      timetable: [
        {
          id: 'tt-local-1',
          subjectId: 'sub-local',
          dayOfWeek: 1,
          startTime: '08:00',
          endTime: '09:00',
        },
      ],
      attendanceLogs: [
        {
          id: 'att-local-1',
          slotId: 'tt-local-1',
          subjectId: 'sub-local',
          date: '2026-10-21',
          status: 'present',
          timestamp: '2026-10-21T08:00:00Z',
        },
      ],
      tasks: [
        {
          id: 'task-local-1',
          title: 'Local task',
          status: 'todo',
          priority: 'medium',
          createdAt: '2026-10-21T08:00:00Z',
        },
      ],
    };

    const cloudData: AppStateData = {
      ...EMPTY_STATE,
      timetable: [
        {
          id: 'tt-cloud-1',
          subjectId: 'sub-cloud',
          dayOfWeek: 2,
          startTime: '10:00',
          endTime: '11:00',
        },
      ],
      attendanceLogs: [
        {
          id: 'att-cloud-1',
          slotId: 'tt-cloud-1',
          subjectId: 'sub-cloud',
          date: '2026-10-22',
          status: 'present',
          timestamp: '2026-10-22T10:00:00Z',
        },
      ],
      tasks: [
        {
          id: 'task-cloud-1',
          title: 'Cloud synced task',
          status: 'done',
          priority: 'high',
          createdAt: '2026-10-22T10:00:00Z',
        },
      ],
    };

    const merged = cloudSyncService.mergeDatasets(localData, cloudData);

    expect(merged.timetable.length).toBe(2);
    expect(merged.timetable.map((t) => t.id)).toContain('tt-local-1');
    expect(merged.timetable.map((t) => t.id)).toContain('tt-cloud-1');

    expect(merged.attendanceLogs.length).toBe(2);
    expect(merged.attendanceLogs.map((a) => a.id)).toContain('att-local-1');
    expect(merged.attendanceLogs.map((a) => a.id)).toContain('att-cloud-1');

    expect(merged.tasks?.length).toBe(2);
    expect(merged.tasks?.map((t) => t.id)).toContain('task-local-1');
    expect(merged.tasks?.map((t) => t.id)).toContain('task-cloud-1');
  });
});
