import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { storageService, loadData, saveData, sanitizeEduHubCourses } from '../src/services/storage';
import { cloudSyncService } from '../src/services/cloudSyncService';
import { authService } from '../src/services/authService';
import { EMPTY_STATE, DEFAULT_PROFILE } from '../src/services/defaults';
import { AppStateData, EduHubCourse } from '../src/types';
import { SAMPLE_EDUHUB_COURSE } from '../src/services/eduhubStorage';

describe('EduHub Cloud Sync & Data Safety Suite', () => {
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
  // 1. Local Persistence & Sanitization
  // ───────────────────────────────────────────────────────────────────────────
  describe('1. Local Persistence & Sanitization', () => {
    it('persists eduhubCourses inside AppStateData and restores them safely', () => {
      const course: EduHubCourse = {
        id: 'course-calc-101',
        title: 'Calculus I: Limits & Derivatives',
        description: 'Complete MIT 18.01 single variable calculus lectures',
        color: 'dusty-blue',
        playlistId: 'PL1234567890',
        playlistUrl: 'https://youtube.com/playlist?list=PL1234567890',
        createdAt: '2026-10-20T10:00:00.000Z',
        updatedAt: '2026-10-20T10:00:00.000Z',
        isSample: false,
        lectures: [
          {
            id: 'lec-1',
            title: 'Lecture 1: The Geometry of Derivatives',
            youtubeUrl: 'https://www.youtube.com/watch?v=derivative123',
            videoId: 'derivative123',
            durationSeconds: 3000,
            lastPositionSeconds: 1500,
            completed: false,
            notes: 'Remember tangent line equation: y - y1 = m(x - x1)',
            addedAt: '2026-10-20T10:00:00.000Z',
          },
        ],
      };

      const testState: AppStateData = {
        ...EMPTY_STATE,
        profile: { ...DEFAULT_PROFILE, displayName: 'Alice' },
        eduhubCourses: [course],
      };

      saveData(testState);
      const loaded = loadData();

      expect(loaded.eduhubCourses).toBeDefined();
      expect(loaded.eduhubCourses?.length).toBe(1);
      const loadedCourse = loaded.eduhubCourses![0];
      expect(loadedCourse.id).toBe('course-calc-101');
      expect(loadedCourse.title).toBe('Calculus I: Limits & Derivatives');
      expect(loadedCourse.playlistId).toBe('PL1234567890');
      expect(loadedCourse.lectures.length).toBe(1);
      expect(loadedCourse.lectures[0].lastPositionSeconds).toBe(1500);
      expect(loadedCourse.lectures[0].notes).toBe('Remember tangent line equation: y - y1 = m(x - x1)');
    });

    it('sanitizes corrupt or malformed lecture data gracefully', () => {
      const corruptCourses = [
        null,
        'string instead of course',
        {
          id: 'course-bad',
          title: 'Valid Title',
          lectures: [
            null,
            { id: '', title: 'Missing ID' },
            {
              id: 'lec-good',
              title: 'Good Lecture',
              youtubeUrl: 'https://youtube.com/watch?v=abc',
              videoId: 'abc',
              durationSeconds: -50, // invalid negative
              lastPositionSeconds: NaN, // invalid NaN
              completed: 1, // truthy non-boolean
            },
          ],
        },
      ];

      const sanitized = sanitizeEduHubCourses(corruptCourses);
      expect(sanitized.length).toBe(1);
      expect(sanitized[0].id).toBe('course-bad');
      expect(sanitized[0].lectures.length).toBe(1);
      expect(sanitized[0].lectures[0].id).toBe('lec-good');
      expect(sanitized[0].lectures[0].durationSeconds).toBe(0);
      expect(sanitized[0].lectures[0].lastPositionSeconds).toBe(0);
      expect(sanitized[0].lectures[0].completed).toBe(true);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. Backwards Compatibility with tracker_eduhub_courses_v1
  // ───────────────────────────────────────────────────────────────────────────
  describe('2. Backwards Compatibility with tracker_eduhub_courses_v1', () => {
    it('seamlessly imports existing courses from tracker_eduhub_courses_v1 on first launch', () => {
      const legacyCourse: EduHubCourse = {
        id: 'legacy-course-99',
        title: 'Legacy Python Crash Course',
        description: 'Existing course before cloud sync upgrade',
        color: 'ochre',
        createdAt: '2026-10-15T00:00:00.000Z',
        updatedAt: '2026-10-15T00:00:00.000Z',
        isSample: false,
        lectures: [
          {
            id: 'legacy-lec-1',
            title: 'Variables and Loops',
            youtubeUrl: 'https://youtube.com/watch?v=python123',
            videoId: 'python123',
            durationSeconds: 1200,
            lastPositionSeconds: 600,
            completed: true,
            addedAt: '2026-10-15T00:00:00.000Z',
            completedAt: '2026-10-15T01:00:00.000Z',
          },
        ],
      };

      // User has existing data under the standalone legacy key
      localStorage.setItem('tracker_eduhub_courses_v1', JSON.stringify([legacyCourse]));

      // App initializes via loadData()
      const state = loadData();

      expect(state.eduhubCourses).toBeDefined();
      expect(state.eduhubCourses?.length).toBe(1);
      expect(state.eduhubCourses![0].id).toBe('legacy-course-99');
      expect(state.eduhubCourses![0].lectures[0].completed).toBe(true);
      expect(state.eduhubCourses![0].lectures[0].completedAt).toBe('2026-10-15T01:00:00.000Z');
    });

    it('syncs AppStateData changes back to tracker_eduhub_courses_v1 for backwards compatibility', () => {
      const newCourse: EduHubCourse = {
        id: 'sync-course-42',
        title: 'Data Structures and Algorithms',
        createdAt: '2026-10-21T00:00:00.000Z',
        updatedAt: '2026-10-21T00:00:00.000Z',
        isSample: false,
        lectures: [],
      };

      const testState: AppStateData = {
        ...EMPTY_STATE,
        eduhubCourses: [newCourse],
      };

      saveData(testState);

      const legacyRaw = localStorage.getItem('tracker_eduhub_courses_v1');
      expect(legacyRaw).toBeDefined();
      const legacyParsed = JSON.parse(legacyRaw!);
      expect(legacyParsed.length).toBe(1);
      expect(legacyParsed[0].id).toBe('sync-course-42');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. Multi-Device Merging Correctness
  // ───────────────────────────────────────────────────────────────────────────
  describe('3. Multi-Device Merging Correctness', () => {
    it('merges disjoint courses from two devices without dropping any', () => {
      const localState: AppStateData = {
        ...EMPTY_STATE,
        eduhubCourses: [
          {
            id: 'course-device-1',
            title: 'Linear Algebra',
            createdAt: '2026-10-20T00:00:00.000Z',
            updatedAt: '2026-10-20T00:00:00.000Z',
            isSample: false,
            lectures: [],
          },
        ],
      };

      const cloudState: AppStateData = {
        ...EMPTY_STATE,
        eduhubCourses: [
          {
            id: 'course-device-2',
            title: 'Operating Systems',
            createdAt: '2026-10-21T00:00:00.000Z',
            updatedAt: '2026-10-21T00:00:00.000Z',
            isSample: false,
            lectures: [],
          },
        ],
      };

      const merged = cloudSyncService.mergeDatasets(localState, cloudState);

      expect(merged.eduhubCourses?.length).toBe(2);
      const ids = merged.eduhubCourses?.map((c) => c.id);
      expect(ids).toContain('course-device-1');
      expect(ids).toContain('course-device-2');
    });

    it('preserves lecture completions across multiple devices', () => {
      // Scenario:
      // Device 1 completed Lecture 1
      // Device 2 completed Lecture 2
      const courseId = 'course-distributed-systems';

      const localCourse: EduHubCourse = {
        id: courseId,
        title: 'Distributed Systems',
        createdAt: '2026-10-20T00:00:00.000Z',
        updatedAt: '2026-10-22T10:00:00.000Z',
        isSample: false,
        lectures: [
          {
            id: 'lec-1',
            title: 'MapReduce & GFS',
            youtubeUrl: 'https://youtube.com/watch?v=mr1',
            videoId: 'mr1',
            durationSeconds: 3600,
            lastPositionSeconds: 3600,
            completed: true,
            completedAt: '2026-10-22T09:00:00.000Z',
            addedAt: '2026-10-20T00:00:00.000Z',
          },
          {
            id: 'lec-2',
            title: 'Raft Consensus',
            youtubeUrl: 'https://youtube.com/watch?v=raft2',
            videoId: 'raft2',
            durationSeconds: 4000,
            lastPositionSeconds: 500,
            completed: false,
            addedAt: '2026-10-20T00:00:00.000Z',
          },
        ],
      };

      const cloudCourse: EduHubCourse = {
        id: courseId,
        title: 'Distributed Systems (Cloud)',
        createdAt: '2026-10-20T00:00:00.000Z',
        updatedAt: '2026-10-22T15:00:00.000Z',
        isSample: false,
        lectures: [
          {
            id: 'lec-1',
            title: 'MapReduce & GFS',
            youtubeUrl: 'https://youtube.com/watch?v=mr1',
            videoId: 'mr1',
            durationSeconds: 3600,
            lastPositionSeconds: 1000,
            completed: false,
            addedAt: '2026-10-20T00:00:00.000Z',
          },
          {
            id: 'lec-2',
            title: 'Raft Consensus',
            youtubeUrl: 'https://youtube.com/watch?v=raft2',
            videoId: 'raft2',
            durationSeconds: 4000,
            lastPositionSeconds: 4000,
            completed: true,
            completedAt: '2026-10-22T14:30:00.000Z',
            notes: 'Split brain is prevented by majority quorum (2f + 1)',
            addedAt: '2026-10-20T00:00:00.000Z',
          },
        ],
      };

      const merged = cloudSyncService.mergeDatasets(
        { ...EMPTY_STATE, eduhubCourses: [localCourse] },
        { ...EMPTY_STATE, eduhubCourses: [cloudCourse] }
      );

      expect(merged.eduhubCourses?.length).toBe(1);
      const lectures = merged.eduhubCourses![0].lectures;
      expect(lectures.length).toBe(2);

      const lec1 = lectures.find((l) => l.id === 'lec-1');
      const lec2 = lectures.find((l) => l.id === 'lec-2');

      // Both lectures must remain completed!
      expect(lec1?.completed).toBe(true);
      expect(lec1?.lastPositionSeconds).toBe(3600); // Max position retained

      expect(lec2?.completed).toBe(true);
      expect(lec2?.lastPositionSeconds).toBe(4000);
      expect(lec2?.notes).toBe('Split brain is prevented by majority quorum (2f + 1)');
    });

    it('real user courses take precedence over sample placeholder courses', () => {
      const localSample: EduHubCourse = {
        ...SAMPLE_EDUHUB_COURSE,
      };

      const cloudRealCourse: EduHubCourse = {
        id: 'real-course-user',
        title: 'User Real Course',
        createdAt: '2026-10-21T00:00:00.000Z',
        updatedAt: '2026-10-21T00:00:00.000Z',
        isSample: false,
        lectures: [],
      };

      const merged = cloudSyncService.mergeDatasets(
        { ...EMPTY_STATE, eduhubCourses: [localSample] },
        { ...EMPTY_STATE, eduhubCourses: [cloudRealCourse] }
      );

      expect(merged.eduhubCourses?.length).toBe(1);
      expect(merged.eduhubCourses![0].id).toBe('real-course-user');
      expect(merged.eduhubCourses![0].isSample).toBe(false);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 4. Tombstone Deletion Correctness
  // ───────────────────────────────────────────────────────────────────────────
  describe('4. Tombstone Deletion Correctness', () => {
    it('prevents deleted courses from resurrecting upon syncing with stale devices', () => {
      const deletedCourseId = 'course-to-be-deleted';
      const deletionTime = '2026-10-25T12:00:00.000Z';
      const creationTime = '2026-10-25T10:00:00.000Z';

      const localState: AppStateData = {
        ...EMPTY_STATE,
        eduhubCourses: [],
        tombstones: [
          {
            id: deletedCourseId,
            collection: 'eduhubCourses',
            deletedAt: deletionTime,
          },
        ],
      };

      const staleRemoteState: AppStateData = {
        ...EMPTY_STATE,
        eduhubCourses: [
          {
            id: deletedCourseId,
            title: 'Stale Course That Was Deleted',
            createdAt: creationTime,
            updatedAt: creationTime,
            isSample: false,
            lectures: [],
          },
        ],
        tombstones: [],
      };

      const merged = cloudSyncService.mergeDatasets(localState, staleRemoteState);

      // Must NOT be resurrected
      expect((merged.eduhubCourses || []).find((c) => c.id === deletedCourseId)).toBeUndefined();
      // Tombstone must be preserved
      expect(merged.tombstones?.some((t) => t.id === deletedCourseId && t.collection === 'eduhubCourses')).toBe(true);
    });

    it('allows recreating a course with the same ID after deletion timestamp', () => {
      const courseId = 'recreated-course-id';
      const deletionTime = '2026-10-25T12:00:00.000Z';
      const recreationTime = '2026-10-25T14:00:00.000Z'; // 2 hours after deletion

      const localWithTombstone: AppStateData = {
        ...EMPTY_STATE,
        eduhubCourses: [],
        tombstones: [
          {
            id: courseId,
            collection: 'eduhubCourses',
            deletedAt: deletionTime,
          },
        ],
      };

      const remoteRecreated: AppStateData = {
        ...EMPTY_STATE,
        eduhubCourses: [
          {
            id: courseId,
            title: 'Recreated Fresh Course',
            createdAt: recreationTime,
            updatedAt: recreationTime,
            isSample: false,
            lectures: [],
          },
        ],
        tombstones: [],
      };

      const merged = cloudSyncService.mergeDatasets(localWithTombstone, remoteRecreated);

      // Recreated course is kept because its updatedAt > deletedAt
      expect(merged.eduhubCourses?.length).toBe(1);
      expect(merged.eduhubCourses![0].title).toBe('Recreated Fresh Course');
      // Obsolete tombstone is purged
      expect(merged.tombstones?.some((t) => t.id === courseId && t.collection === 'eduhubCourses')).toBe(false);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 5. Account Partitioning & Data Isolation
  // ───────────────────────────────────────────────────────────────────────────
  describe('5. Account Partitioning & Data Isolation', () => {
    it('isolates EduHub courses between User A and User B on a shared device', () => {
      const userA = 'aaaa1111-1111-4111-8111-111111111111';
      const userB = 'bbbb2222-2222-4222-8222-222222222222';

      const stateA: AppStateData = {
        ...EMPTY_STATE,
        profile: { ...DEFAULT_PROFILE, displayName: 'Alice' },
        eduhubCourses: [
          {
            id: 'alice-course',
            title: "Alice's Quantum Physics",
            createdAt: '2026-10-20T00:00:00.000Z',
            updatedAt: '2026-10-20T00:00:00.000Z',
            isSample: false,
            lectures: [],
          },
        ],
      };

      const stateB: AppStateData = {
        ...EMPTY_STATE,
        profile: { ...DEFAULT_PROFILE, displayName: 'Bob' },
        eduhubCourses: [
          {
            id: 'bob-course',
            title: "Bob's Microeconomics",
            createdAt: '2026-10-21T00:00:00.000Z',
            updatedAt: '2026-10-21T00:00:00.000Z',
            isSample: false,
            lectures: [],
          },
        ],
      };

      // Save user-partitioned states
      storageService.saveUserData(userA, stateA);
      storageService.saveUserData(userB, stateB);

      // Verify Alice only loads Alice's courses
      const loadedA = storageService.loadUserData(userA);
      expect(loadedA?.eduhubCourses?.length).toBe(1);
      expect(loadedA?.eduhubCourses![0].title).toBe("Alice's Quantum Physics");

      // Verify Bob only loads Bob's courses
      const loadedB = storageService.loadUserData(userB);
      expect(loadedB?.eduhubCourses?.length).toBe(1);
      expect(loadedB?.eduhubCourses![0].title).toBe("Bob's Microeconomics");
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 6. Complete Cross-Domain Account Switching & Restoration Lifecycle
  // ───────────────────────────────────────────────────────────────────────────
  describe('6. Complete Cross-Domain Account Switching & Restoration Lifecycle', () => {
    it('User A signs out, User B signs in: No User A data is visible to User B', () => {
      const userA = 'aaaa1111-1111-4111-8111-111111111111';
      const userB = 'bbbb2222-2222-4222-8222-222222222222';

      const fullUserAState: AppStateData = {
        ...EMPTY_STATE,
        profile: { ...DEFAULT_PROFILE, displayName: 'Alice' },
        subjects: [{ id: 'sub-a', code: 'CS101', name: 'Intro CS', attended: 10, totalConducted: 12, targetPct: 75, color: 'terracotta' }],
        timetable: [{ id: 'slot-a', dayOfWeek: 1, startTime: '09:00', endTime: '10:00', subjectId: 'sub-a' }],
        tasks: [{ id: 'task-a', title: "Alice's Project", status: 'in_progress', priority: 'high', createdAt: '2026-10-20T00:00:00.000Z' }],
        attendanceLogs: [{ id: 'log-a', slotId: 'slot-a', subjectId: 'sub-a', date: '2026-10-20', status: 'present', timestamp: '2026-10-20T09:05:00.000Z' }],
        events: [{ id: 'event-a', title: "Alice's Midterm", category: 'exam', date: '2026-10-28', priority: 'high', createdAt: '2026-10-20T00:00:00.000Z' }],
        eduhubCourses: [
          {
            id: 'course-a',
            title: "Alice's Quantum Mechanics",
            color: 'terracotta',
            createdAt: '2026-10-20T00:00:00.000Z',
            updatedAt: '2026-10-20T00:00:00.000Z',
            isSample: false,
            lectures: [
              {
                id: 'lec-a1',
                title: 'Wave Functions',
                youtubeUrl: 'https://youtube.com/watch?v=qm1',
                videoId: 'qm1',
                durationSeconds: 3600,
                lastPositionSeconds: 1800,
                completed: true,
                completedAt: '2026-10-20T10:00:00.000Z',
                notes: 'Schrodinger equation derivation note',
                addedAt: '2026-10-20T00:00:00.000Z',
              },
            ],
          },
        ],
      };

      // 1. User A is active and their state is saved to their user partition
      storageService.saveUserData(userA, fullUserAState);

      // 2. User A signs out: active store is cleared to clean guest state
      const cleanGuestState: AppStateData = {
        ...EMPTY_STATE,
        profile: { ...DEFAULT_PROFILE },
        eduhubCourses: [SAMPLE_EDUHUB_COURSE],
        hasSampleData: false,
        schemaVersion: 2,
      };
      saveData(cleanGuestState);
      localStorage.setItem('tracker_eduhub_courses_v1', JSON.stringify([SAMPLE_EDUHUB_COURSE]));

      // 3. User B signs in (User B has their own empty or distinct state)
      const userBState: AppStateData = {
        ...EMPTY_STATE,
        profile: { ...DEFAULT_PROFILE, displayName: 'Bob' },
        subjects: [{ id: 'sub-b', code: 'ECON101', name: 'Microeconomics', attended: 4, totalConducted: 5, targetPct: 75, color: 'sage' }],
        eduhubCourses: [
          {
            id: 'course-b',
            title: "Bob's Microeconomics Course",
            createdAt: '2026-10-21T00:00:00.000Z',
            updatedAt: '2026-10-21T00:00:00.000Z',
            isSample: false,
            lectures: [],
          },
        ],
      };
      storageService.saveUserData(userB, userBState);
      saveData(userBState);

      // Verify active state seen by User B
      const activeStateForB = loadData();
      expect(activeStateForB.profile?.displayName).toBe('Bob');
      expect(activeStateForB.subjects.some((s) => s.id === 'sub-a')).toBe(false);
      expect(activeStateForB.timetable.some((t) => t.id === 'slot-a')).toBe(false);
      expect((activeStateForB.tasks || []).some((t) => t.id === 'task-a')).toBe(false);
      expect((activeStateForB.events || []).some((e) => e.id === 'event-a')).toBe(false);
      expect((activeStateForB.attendanceLogs || []).some((l) => l.id === 'log-a')).toBe(false);

      // Crucial: No User A EduHub courses or notes exist in User B's state!
      expect((activeStateForB.eduhubCourses || []).some((c) => c.id === 'course-a')).toBe(false);
      expect((activeStateForB.eduhubCourses || []).some((c) => c.title.includes('Alice'))).toBe(false);

      // 4. User B signs out; User A signs back in
      const restoredA = storageService.loadUserData(userA);
      expect(restoredA).toBeDefined();
      expect(restoredA?.profile?.displayName).toBe('Alice');
      expect(restoredA?.eduhubCourses?.length).toBe(1);
      expect(restoredA?.eduhubCourses![0].id).toBe('course-a');
      expect(restoredA?.eduhubCourses![0].lectures[0].notes).toBe('Schrodinger equation derivation note');
      expect(restoredA?.eduhubCourses![0].lectures[0].completed).toBe(true);
      expect(restoredA?.subjects[0].id).toBe('sub-a');
      expect(restoredA?.events![0].id).toBe('event-a');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 7. Guest Data Detection & Conflict Merge Behavior
  // ───────────────────────────────────────────────────────────────────────────
  describe('7. Guest Data Detection & Conflict Merge Behavior', () => {
    it('detects unauthenticated guest EduHub courses and merges them into existing cloud account without loss', () => {
      const guestState: AppStateData = {
        ...EMPTY_STATE,
        hasSampleData: false,
        eduhubCourses: [
          {
            id: 'guest-imported-course',
            title: 'Guest Offline React Mastery',
            createdAt: '2026-10-23T00:00:00.000Z',
            updatedAt: '2026-10-23T00:00:00.000Z',
            isSample: false,
            lectures: [
              {
                id: 'guest-lec-1',
                title: 'Hooks & State',
                youtubeUrl: 'https://youtube.com/watch?v=react1',
                videoId: 'react1',
                durationSeconds: 1800,
                lastPositionSeconds: 900,
                completed: false,
                notes: 'Guest note before signing in',
                addedAt: '2026-10-23T00:00:00.000Z',
              },
            ],
          },
        ],
        tasks: [
          {
            id: 'guest-task-1',
            title: 'Guest Study Task',
            status: 'todo',
            priority: 'medium',
            createdAt: '2026-10-23T00:00:00.000Z',
          },
        ],
      };

      const cloudAccountState: AppStateData = {
        ...EMPTY_STATE,
        profile: { ...DEFAULT_PROFILE, displayName: 'Cloud Student' },
        eduhubCourses: [
          {
            id: 'cloud-existing-course',
            title: 'Existing Cloud Algorithms',
            createdAt: '2026-10-10T00:00:00.000Z',
            updatedAt: '2026-10-10T00:00:00.000Z',
            isSample: false,
            lectures: [],
          },
        ],
        tasks: [
          {
            id: 'cloud-task-1',
            title: 'Cloud Exam Prep',
            status: 'in_progress',
            priority: 'high',
            createdAt: '2026-10-10T00:00:00.000Z',
          },
        ],
      };

      // Merge both datasets
      const merged = cloudSyncService.mergeDatasets(guestState, cloudAccountState);

      // Verify both courses are present
      expect(merged.eduhubCourses?.length).toBe(2);
      const courseIds = merged.eduhubCourses?.map((c) => c.id);
      expect(courseIds).toContain('guest-imported-course');
      expect(courseIds).toContain('cloud-existing-course');

      // Verify guest notes and lecture progress were not lost
      const guestCourse = merged.eduhubCourses?.find((c) => c.id === 'guest-imported-course');
      expect(guestCourse?.lectures[0].notes).toBe('Guest note before signing in');
      expect(guestCourse?.lectures[0].lastPositionSeconds).toBe(900);

      // Verify tasks were merged without losing either
      expect(merged.tasks?.length).toBe(2);
      const taskIds = merged.tasks?.map((t) => t.id);
      expect(taskIds).toContain('guest-task-1');
      expect(taskIds).toContain('cloud-task-1');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 8. Offline State Retention on Cloud Failure & Network Reconnection
  // ───────────────────────────────────────────────────────────────────────────
  describe('8. Offline State Retention on Cloud Failure & Network Reconnection', () => {
    it('failed upload retains offline changes and sets pending sync flag', async () => {
      const userId = '11112222-3333-4444-5555-666677778888';
      const offlineCourse: EduHubCourse = {
        id: 'offline-course-1',
        title: 'Offline Video Course',
        createdAt: '2026-10-24T00:00:00.000Z',
        updatedAt: '2026-10-24T00:00:00.000Z',
        isSample: false,
        lectures: [
          {
            id: 'lec-off-1',
            title: 'Lecture Watched on Plane',
            youtubeUrl: 'https://youtube.com/watch?v=plane1',
            videoId: 'plane1',
            durationSeconds: 2400,
            lastPositionSeconds: 2400,
            completed: true,
            completedAt: '2026-10-24T12:00:00.000Z',
            notes: 'Saved while offline without wifi',
            addedAt: '2026-10-24T00:00:00.000Z',
          },
        ],
      };

      const testState: AppStateData = {
        ...EMPTY_STATE,
        eduhubCourses: [offlineCourse],
      };

      // Save locally
      saveData(testState);
      storageService.saveUserData(userId, testState);

      // Simulate network failure by marking pending sync
      cloudSyncService.markPendingSync(userId);
      expect(cloudSyncService.hasPendingSync(userId)).toBe(true);

      // Verify local data is 100% intact
      const local = loadData();
      expect(local.eduhubCourses?.[0].lectures[0].notes).toBe('Saved while offline without wifi');
      expect(local.eduhubCourses?.[0].lectures[0].completed).toBe(true);

      // Reconnection callback clears pending sync when successful
      cloudSyncService.clearPendingSync(userId);
      expect(cloudSyncService.hasPendingSync(userId)).toBe(false);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 9. Cloud Safety on Signout
  // ───────────────────────────────────────────────────────────────────────────
  describe('9. Cloud Safety on Signout', () => {
    it('verifies that signing out archives local state without deleting remote cloud records', () => {
      const userId = '99998888-7777-6666-5555-444433332222';
      const userState: AppStateData = {
        ...EMPTY_STATE,
        profile: { ...DEFAULT_PROFILE, displayName: 'Cloud User' },
        eduhubCourses: [
          {
            id: 'cloud-valuable-course',
            title: 'Valuable Course',
            createdAt: '2026-10-20T00:00:00.000Z',
            updatedAt: '2026-10-20T00:00:00.000Z',
            isSample: false,
            lectures: [],
          },
        ],
      };

      // User archives their state on logout
      storageService.saveUserData(userId, userState);

      // Local active state resets to clean guest state
      const cleanGuestState: AppStateData = {
        ...EMPTY_STATE,
        profile: { ...DEFAULT_PROFILE },
        eduhubCourses: [SAMPLE_EDUHUB_COURSE],
        hasSampleData: false,
        schemaVersion: 2,
      };
      saveData(cleanGuestState);

      // Active state is clean
      expect(loadData().eduhubCourses?.length).toBe(0);

      // But user's partitioned archive is preserved and never deleted
      const userArchive = storageService.loadUserData(userId);
      expect(userArchive).not.toBeNull();
      expect(userArchive?.eduhubCourses?.[0].id).toBe('cloud-valuable-course');
    });
  });
});
