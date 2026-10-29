import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import {
  AppStateData,
  AttendanceMark,
  StudySession,
  SessionStatus,
  Reminder,
  GymWorkout,
  GymExercise,
  Subject,
  UserProfile,
  AppSettings,
  SyllabusSubject,
  SyllabusChapter,
  Subtopic,
  TopicStatus,
  TimetableSlot,
  TimetableImportClass,
  DayOfWeek,
  OccurrenceOverride,
  ExtraClass,
  SyllabusImportPayload,
  PlannerTask,
  TaskStatus,
  SpacedReview,
  DailyQuestionEntry,
  FoodDiaryEntry,
  CustomFood,
  Recipe,
  WeightLogEntry,
  NutritionProfile,
  RadioUrl,
  RadioLoopMode,
  CustomPlaylist,
  CustomPlaylistItem,
  MockTest,
  ErrorLogEntry,
  CalendarEvent,
} from '../types';
import {
  storageService,
  STORAGE_KEY_V2,
  DEFAULT_PROFILE,
  DEFAULT_SETTINGS,
  DEFAULT_CUSTOM_PLAYLISTS,
  EMPTY_STATE,
} from '../services/storage';
import { getAttendanceRequirement } from '../utils/scheduleResolver';
import { completeReviewStep, DEFAULT_REVIEW_INTERVALS, hasActiveReviewForTopic } from '../utils/spacedRepetitionUtils';
import {
  toYouTubeEmbedUrl,
  toYouTubeEmbedUrlWithControls,
  isYouTubePlaylistUrl,
  isValidYouTubeUrl,
  extractYouTubeVideoId,
  extractYouTubePlaylistId,
  buildCustomPlaylistEmbedUrl,
} from '../utils/youtubeValidator';
import { authService, AuthUser } from '../services/authService';
import { cloudSyncService, CloudRecord } from '../services/cloudSyncService';
import { classSpaceService } from '../services/classSpaceService';
import { SAMPLE_EDUHUB_COURSE } from '../services/eduhubStorage';
import { SyncConflictModal } from '../components/common/SyncConflictModal';

interface AppContextType {
  state: AppStateData;
  // Google Auth & Cloud Synchronization
  authUser: AuthUser | null;
  syncStatus: 'idle' | 'syncing' | 'synced' | 'error' | 'offline';
  lastSyncedAt: Date | null;
  signInWithGoogle: () => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  syncNow: () => Promise<void>;
  // Attendance actions
  markAttendance: (slotId: string, status: AttendanceMark, date?: string) => void;
  markAttendanceForEvent: (occurrenceKey: string, subjectId: string, date: string, status: AttendanceMark, slotId?: string, extraClassId?: string, overrideId?: string, isPlanned?: boolean) => void;
  // Study timer actions
  logStudySession: (
    durationMinutes: number,
    subjectId?: string,
    notes?: string,
    options?: {
      plannedDurationMinutes?: number;
      status?: SessionStatus;
      startTime?: string;
      endTime?: string;
      id?: string;
      durationSeconds?: number;
    }
  ) => void;
  deleteStudySession: (id: string) => void;
  // Gym workout actions
  toggleGymSet: (exerciseIndex: number, setIndex: number) => void;
  toggleGymWorkoutComplete: () => void;
  startTodayWorkout: (splitTitle?: string) => void;
  addGymExercise: (exerciseName: string, setsCount?: number) => void;
  // Reminder actions
  toggleReminder: (id: string) => void;
  addReminder: (reminder: Omit<Reminder, 'id' | 'isCompleted'>) => void;
  deleteReminder: (id: string) => void;
  // Subject quick add
  addSubject: (subject: Omit<Subject, 'id'>) => void;
  // Sample data management
  clearSampleData: () => void;
  restoreSampleData: () => void;
  // Storage operations
  exportData: () => string;
  importData: (json: string) => boolean;
  // Profile & Settings
  updateProfile: (profile: UserProfile) => void;
  updateSettings: (settings: Partial<AppSettings>) => void;
  // Syllabus Tracker actions
  addSyllabusSubject: (name: string, color?: string) => void;
  updateSyllabusSubject: (id: string, name: string, color?: string) => void;
  deleteSyllabusSubject: (id: string) => void;
  addChapter: (subjectId: string, name: string) => void;
  updateChapter: (subjectId: string, chapterId: string, name: string) => void;
  deleteChapter: (subjectId: string, chapterId: string) => void;
  addSubtopic: (subjectId: string, chapterId: string, subtopic: Omit<Subtopic, 'id' | 'revisionCount'>) => void;
  updateSubtopic: (subjectId: string, chapterId: string, subtopicId: string, updates: Partial<Subtopic>) => void;
  deleteSubtopic: (subjectId: string, chapterId: string, subtopicId: string) => void;
  setTopicStatus: (subjectId: string, chapterId: string, subtopicId: string, status: TopicStatus) => void;
  incrementRevision: (subjectId: string, chapterId: string, subtopicId: string) => void;
  // Timetable & Calendar actions
  addTimetableSlot: (slot: Omit<TimetableSlot, 'id'>, customSubjectName?: string) => void;
  updateTimetableSlot: (id: string, updates: Partial<TimetableSlot>) => void;
  deleteTimetableSlot: (id: string) => void;
  importTimetableClasses: (classes: TimetableImportClass[], replaceExisting?: boolean) => { importedCount: number; skippedCount: number };
  // Occurrence overrides (fix recurring rescheduling)
  rescheduleOccurrence: (slotId: string, originalDate: string, newDate: string, newStartTime?: string, newEndTime?: string, newRoom?: string, newNotes?: string) => void;
  cancelOccurrence: (slotId: string, originalDate: string) => void;
  restoreOccurrence: (slotId: string, originalDate: string) => void;
  // Extra classes
  addExtraClass: (extra: Omit<ExtraClass, 'id'>) => void;
  deleteExtraClass: (id: string) => void;
  // Syllabus import
  importSyllabus: (payload: SyllabusImportPayload, targetSubjectId?: string) => { chaptersAdded: number; topicsAdded: number; subjectName: string };
  // Shared attendance requirement helper
  getAttendanceReq: () => number;
  // Milestone 5: Planner Task actions
  addTask: (task: Omit<PlannerTask, 'id' | 'createdAt'>) => string;
  updateTask: (id: string, updates: Partial<PlannerTask>) => void;
  deleteTask: (id: string) => void;
  setTaskStatus: (id: string, status: TaskStatus) => void;
  toggleTaskSubtask: (taskId: string, subtaskId: string) => void;
  // Milestone 5: Spaced Repetition actions
  addSpacedReview: (review: Omit<SpacedReview, 'id'>) => string;
  updateSpacedReview: (id: string, updates: Partial<SpacedReview>) => void;
  deleteSpacedReview: (id: string) => void;
  completeSpacedReview: (id: string) => void;
  rescheduleSpacedReview: (id: string, newDueDate: string) => void;
  updateReviewIntervals: (intervals: number[]) => void;
  // Milestone 5: Daily Questions actions
  addDailyQuestionEntry: (entry: Omit<DailyQuestionEntry, 'id' | 'createdAt'>) => string;
  updateDailyQuestionEntry: (id: string, updates: Partial<DailyQuestionEntry>) => void;
  deleteDailyQuestionEntry: (id: string) => void;
  setDailyQuestionTarget: (target: number) => void;
  // Milestone 7: Nutrition actions
  addFoodDiaryEntry: (entry: Omit<FoodDiaryEntry, 'id' | 'lastEditedAt'>) => string;
  addMultipleFoodDiaryEntries: (entries: Omit<FoodDiaryEntry, 'id' | 'lastEditedAt'>[]) => void;
  updateFoodDiaryEntry: (id: string, updates: Partial<FoodDiaryEntry>) => void;
  deleteFoodDiaryEntry: (id: string) => void;
  addCustomFood: (food: Omit<CustomFood, 'id' | 'isCustom' | 'createdAt'>) => string;
  deleteCustomFood: (id: string) => void;
  addRecipe: (recipe: Omit<Recipe, 'id' | 'createdAt'>) => string;
  deleteRecipe: (id: string) => void;
  logWeight: (weightKg: number, date?: string, notes?: string) => void;
  deleteWeightLog: (id: string) => void;
  updateNutritionProfile: (updates: Partial<NutritionProfile>) => void;
  // Milestone 8: Focus Radio, Queue, Loop & Shuffle
  addRadioUrl: (label: string, url: string) => void;
  removeRadioUrl: (id: string) => void;
  reorderRadioUrl: (id: string, direction: 'up' | 'down') => void;
  radioQueue: RadioUrl[];
  radioLoopMode: RadioLoopMode;
  radioIsShuffle: boolean;
  activeRadioStation: RadioUrl | null;
  activeRadioIndex: number | null;
  activeRadioSource: 'stations' | 'queue' | 'playlist';
  setActiveRadio: (index: number | null, source?: 'stations' | 'queue' | 'playlist') => void;
  addToRadioQueue: (item: { label: string; url: string; type?: 'video' | 'playlist' }) => void;
  removeFromRadioQueue: (index: number) => void;
  clearRadioQueue: () => void;
  reorderRadioQueue: (fromIndex: number, toIndex: number) => void;
  cycleRadioLoopMode: () => void;
  setRadioLoopMode: (mode: RadioLoopMode) => void;
  toggleRadioShuffle: () => void;
  playNextTrack: () => void;
  playPrevTrack: () => void;
  // Milestone 8: Custom Playlists ("Make My Own Playlist")
  customPlaylists: CustomPlaylist[];
  activeCustomPlaylistId: string | null;
  createCustomPlaylist: (name: string, description?: string, youtubePlaylistUrl?: string) => string;
  deleteCustomPlaylist: (playlistId: string) => void;
  addTrackToCustomPlaylist: (playlistId: string, track: { title: string; url: string }) => boolean;
  removeTrackFromCustomPlaylist: (playlistId: string, trackId: string) => void;
  reorderTrackInCustomPlaylist: (playlistId: string, fromIndex: number, toIndex: number) => void;
  playCustomPlaylist: (playlistId: string, shuffle?: boolean) => void;
  addPlaylistToRadioQueue: (playlistId: string) => void;
  // Milestone 6: Mock-Test Analytics & Error Log
  addMockTest: (test: Omit<MockTest, 'id' | 'createdAt'>) => string;
  updateMockTest: (id: string, updates: Partial<MockTest>) => void;
  deleteMockTest: (id: string) => void;
  addErrorLogEntry: (entry: Omit<ErrorLogEntry, 'id' | 'createdAt' | 'reviewedCount'>) => string;
  updateErrorLogEntry: (id: string, updates: Partial<ErrorLogEntry>) => void;
  deleteErrorLogEntry: (id: string) => void;
  resolveErrorLogEntry: (id: string, resolved?: boolean) => void;
  convertErrorToPlannerTask: (errorId: string) => { success: boolean; taskId?: string; message?: string };
  // Events & Tasks Calendar Planner
  events: CalendarEvent[];
  addEvent: (event: Omit<CalendarEvent, 'id' | 'createdAt'>) => string;
  updateEvent: (id: string, updates: Partial<CalendarEvent>) => void;
  deleteEvent: (id: string) => void;
  toggleEventComplete: (id: string) => void;
  toggleEventSubtask: (eventId: string, subtaskId: string) => void;
  fullReset: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// Import SyllabusChapter type for internal use
type SyllabusChapterType = SyllabusChapter;

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AppStateData>(() => storageService.loadData());
  const [activeRadioIndex, setActiveRadioIndex] = useState<number | null>(null);
  const [activeRadioSource, setActiveRadioSource] = useState<'stations' | 'queue' | 'playlist'>('stations');
  const [activeCustomPlaylistId, setActiveCustomPlaylistId] = useState<string | null>(null);

  // Google Auth & Cloud Sync States
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error' | 'offline'>('idle');
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [conflictData, setConflictData] = useState<{
    cloudRecord: CloudRecord;
  } | null>(null);
  const initialSyncedUserIdRef = useRef<string | null>(null);
  const stateVersionRef = useRef<number>(0);

  // Automatically track state mutations for upload in-flight correctness
  useEffect(() => {
    stateVersionRef.current += 1;
  }, [state]);

  // Listen for EduHub storage updates to keep AppStateData synchronized
  useEffect(() => {
    const handleEduHubUpdate = (e: any) => {
      const updatedCourses = e.detail;
      if (!Array.isArray(updatedCourses)) return;
      setState((prev) => {
        if (JSON.stringify(prev.eduhubCourses) === JSON.stringify(updatedCourses)) {
          return prev;
        }
        return {
          ...prev,
          eduhubCourses: updatedCourses,
        };
      });
    };

    const handleEduHubDelete = (e: any) => {
      const courseId = e.detail?.courseId;
      if (!courseId || typeof courseId !== 'string') return;
      setState((prev) => {
        const updatedTombstones = cloudSyncService.addTombstone(prev.tombstones, courseId, 'eduhubCourses');
        return {
          ...prev,
          tombstones: updatedTombstones,
        };
      });
    };

    window.addEventListener('tracker_eduhub_updated', handleEduHubUpdate as EventListener);
    window.addEventListener('tracker_eduhub_deleted', handleEduHubDelete as EventListener);
    return () => {
      window.removeEventListener('tracker_eduhub_updated', handleEduHubUpdate as EventListener);
      window.removeEventListener('tracker_eduhub_deleted', handleEduHubDelete as EventListener);
    };
  }, []);

  // Automatically persist to storage layer whenever state changes
  useEffect(() => {
    storageService.saveData(state);
    if (authUser?.id && initialSyncedUserIdRef.current === authUser.id) {
      storageService.saveUserData(authUser.id, state);
    }
  }, [state, authUser]);

  // Helper to determine if unauthenticated guest user has created real local work
  const checkHasGuestData = (data: AppStateData): boolean => {
    if (data.hasSampleData) return false;
    return Boolean(
      (data.timetable?.length || 0) > 0 ||
      (data.tasks?.length || 0) > 0 ||
      (data.subjects?.length || 0) > 0 ||
      (data.extraClasses?.length || 0) > 0 ||
      (data.attendanceLogs?.length || 0) > 0 ||
      (data.studySessions?.length || 0) > 0 ||
      (data.gymWorkouts?.length || 0) > 0 ||
      (data.reminders?.length || 0) > 0 ||
      (data.eduhubCourses?.some((c) => !c.isSample) ?? false) ||
      (data.events?.some((e) => !e.isSample) ?? false) ||
      (data.mockTests?.some((m) => !m.isSample) ?? false) ||
      (data.errorLogs?.some((e) => !e.isSample) ?? false) ||
      (data.foodDiaryEntries?.length || 0) > 0 ||
      (data.customFoods?.length || 0) > 0 ||
      (data.recipes?.length || 0) > 0 ||
      (data.weightLogs?.length || 0) > 0
    );
  };

  // Handle Initial Sync when user logs in
  const handleInitialSync = async (user: AuthUser) => {
    setSyncStatus('syncing');
    classSpaceService.restoreArchivedData(user.id);
    try {
      const userArchive = storageService.loadUserData(user.id);
      const fetchResult = await cloudSyncService.fetchCloudDataDetailed(user.id);

      // Scenario 1: Network, auth, timeout, or RLS error
      // We MUST NOT assume remote is empty and MUST NOT overwrite remote data with empty/guest state!
      if (fetchResult.status === 'error') {
        if (userArchive) {
          // Serve local user archive offline, but DO NOT upload to cloud
          setState(userArchive);
          storageService.saveData(userArchive);
          setSyncStatus('offline');
          initialSyncedUserIdRef.current = user.id;
        } else {
          // No local archive and cloud fetch failed: preserve state, flag error
          setSyncStatus('error');
        }
        return;
      }

      // Scenario 2: Cloud services unconfigured (local-only mode)
      if (fetchResult.status === 'unconfigured') {
        if (userArchive) {
          setState(userArchive);
          storageService.saveData(userArchive);
        }
        setSyncStatus('offline');
        initialSyncedUserIdRef.current = user.id;
        return;
      }

      // Scenario 3: Cloud record genuinely exists
      if (fetchResult.status === 'found' && fetchResult.record) {
        const cloudRecord = fetchResult.record;
        if (userArchive) {
          // Merge local archived edits with cloud dataset without losing any records
          const merged = cloudSyncService.mergeDatasets(userArchive, cloudRecord.data);
          setState(merged);
          storageService.saveData(merged);
          storageService.saveUserData(user.id, merged);
          if (Array.isArray(merged.eduhubCourses)) {
            try {
              localStorage.setItem('tracker_eduhub_courses_v1', JSON.stringify(merged.eduhubCourses));
              window.dispatchEvent(new CustomEvent('tracker_eduhub_updated', { detail: merged.eduhubCourses }));
            } catch {}
          }
          const uploadRes = await cloudSyncService.uploadToCloud(user.id, merged);
          if (uploadRes.success) {
            cloudSyncService.clearPendingSync(user.id);
            setSyncStatus('synced');
            setLastSyncedAt(new Date());
          } else {
            cloudSyncService.markPendingSync(user.id);
            setSyncStatus('offline');
          }
          initialSyncedUserIdRef.current = user.id;
          return;
        }

        // No prior local archive on this device: check for guest data conflict
        const hasLocalGuestData = checkHasGuestData(state);

        if (hasLocalGuestData) {
          storageService.saveGuestBackup(state);
          setConflictData({ cloudRecord });
          setSyncStatus('idle');
        } else {
          setState(cloudRecord.data);
          storageService.saveData(cloudRecord.data);
          storageService.saveUserData(user.id, cloudRecord.data);
          if (Array.isArray(cloudRecord.data.eduhubCourses)) {
            try {
              localStorage.setItem('tracker_eduhub_courses_v1', JSON.stringify(cloudRecord.data.eduhubCourses));
              window.dispatchEvent(new CustomEvent('tracker_eduhub_updated', { detail: cloudRecord.data.eduhubCourses }));
            } catch {}
          }
          cloudSyncService.clearPendingSync(user.id);
          setSyncStatus('synced');
          setLastSyncedAt(new Date(cloudRecord.updatedAt));
          initialSyncedUserIdRef.current = user.id;
        }
        return;
      }

      // Scenario 4: Confirmed empty cloud account (brand new user with no row in database)
      if (fetchResult.status === 'not_found') {
        if (userArchive) {
          setState(userArchive);
          storageService.saveData(userArchive);
          if (Array.isArray(userArchive.eduhubCourses)) {
            try {
              localStorage.setItem('tracker_eduhub_courses_v1', JSON.stringify(userArchive.eduhubCourses));
              window.dispatchEvent(new CustomEvent('tracker_eduhub_updated', { detail: userArchive.eduhubCourses }));
            } catch {}
          }
          const uploadRes = await cloudSyncService.uploadToCloud(user.id, userArchive);
          if (uploadRes.success) {
            cloudSyncService.clearPendingSync(user.id);
            setSyncStatus('synced');
            setLastSyncedAt(new Date());
          } else {
            cloudSyncService.markPendingSync(user.id);
            setSyncStatus('offline');
          }
          initialSyncedUserIdRef.current = user.id;
          return;
        }

        // Brand new user with no cloud record and no prior archive on this device
        // Check if they created guest data offline before signing in for the first time
        const hasLocalGuestData = checkHasGuestData(state);
        if (hasLocalGuestData) {
          storageService.saveGuestBackup(state);
          storageService.saveUserData(user.id, state);
          const uploadRes = await cloudSyncService.uploadToCloud(user.id, state);
          if (uploadRes.success) {
            cloudSyncService.clearPendingSync(user.id);
            setSyncStatus('synced');
            setLastSyncedAt(new Date());
          } else {
            cloudSyncService.markPendingSync(user.id);
            setSyncStatus('offline');
          }
          initialSyncedUserIdRef.current = user.id;
        } else {
          cloudSyncService.clearPendingSync(user.id);
          setSyncStatus('synced');
          setLastSyncedAt(new Date());
          initialSyncedUserIdRef.current = user.id;
        }
        return;
      }
    } catch {
      setSyncStatus('error');
    }
  };

  // Initialize auth
  useEffect(() => {
    let mounted = true;
    authService.getCurrentUser().then((user) => {
      if (mounted && user) {
        setAuthUser(user);
        handleInitialSync(user);
      }
    });

    const unsubscribe = authService.onAuthStateChange((user) => {
      setAuthUser(user);
      if (user) {
        handleInitialSync(user);
      } else {
        setSyncStatus('idle');
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  // Auto-sync debounced when state changes and user is signed in
  useEffect(() => {
    if (!authUser || conflictData || syncStatus === 'syncing' || initialSyncedUserIdRef.current !== authUser.id) return;
    const versionAtStart = stateVersionRef.current;
    const targetUserId = authUser.id;
    const timeout = setTimeout(async () => {
      if (initialSyncedUserIdRef.current !== targetUserId) return;
      setSyncStatus('syncing');
      const res = await cloudSyncService.uploadToCloud(targetUserId, state);
      if (initialSyncedUserIdRef.current !== targetUserId) return;
      if (res.success) {
        // If state was modified while this upload was in flight, preserve pending sync
        if (stateVersionRef.current === versionAtStart) {
          cloudSyncService.clearPendingSync(targetUserId);
          setSyncStatus('synced');
          setLastSyncedAt(new Date());
        } else {
          cloudSyncService.markPendingSync(targetUserId);
        }
      } else {
        cloudSyncService.markPendingSync(targetUserId);
        setSyncStatus('offline');
      }
    }, 2500);

    return () => clearTimeout(timeout);
  }, [state, authUser, conflictData, syncStatus]);

  // Network reconnect listener to auto-flush pending syncs when connection is restored
  useEffect(() => {
    const unsubscribe = cloudSyncService.onNetworkReconnect(async () => {
      if (authUser?.id && (cloudSyncService.hasPendingSync(authUser.id) || syncStatus === 'offline')) {
        await syncNow();
      }
    });
    return () => {
      unsubscribe();
    };
  }, [authUser, syncStatus, state]);

  const signInWithGoogle = async (): Promise<{ success: boolean; error?: string }> => {
    setSyncStatus('syncing');
    const res = await authService.signInWithGoogle();
    if (res.user) {
      setAuthUser(res.user);
      await handleInitialSync(res.user);
      return { success: true };
    }
    setSyncStatus('idle');
    if (res.error) {
      return { success: false, error: res.error };
    }
    return { success: false };
  };

  const signOut = async () => {
    if (authUser?.id) {
      // 1. Safely archive this user's current data so any unsynced offline changes
      // are never destroyed if the same user signs back in on this device.
      storageService.saveUserData(authUser.id, state);

      // Attempt to sync to cloud if network is available
      try {
        await cloudSyncService.uploadToCloud(authUser.id, state);
      } catch {
        // Safe to ignore network failure: local user archive preserves unsynced edits
      }
    }

    initialSyncedUserIdRef.current = null;
    classSpaceService.archiveAndClearLocalData(authUser?.id);
    await authService.signOut();
    setAuthUser(null);
    setSyncStatus('idle');
    setConflictData(null);

    // 2. Eradicate active session from shared guest store so User B does not inherit User A's data
    const cleanGuestState: AppStateData = {
      ...EMPTY_STATE,
      profile: { ...DEFAULT_PROFILE },
      settings: { ...DEFAULT_SETTINGS },
      customPlaylists: JSON.parse(JSON.stringify(DEFAULT_CUSTOM_PLAYLISTS)),
      eduhubCourses: [SAMPLE_EDUHUB_COURSE],
      hasSampleData: false,
      schemaVersion: 2,
    };
    setState(cleanGuestState);
    storageService.saveData(cleanGuestState);
    try {
      localStorage.setItem('tracker_eduhub_courses_v1', JSON.stringify([SAMPLE_EDUHUB_COURSE]));
      window.dispatchEvent(new CustomEvent('tracker_eduhub_updated', { detail: [SAMPLE_EDUHUB_COURSE] }));
    } catch {}
  };

  const syncNow = async () => {
    if (!authUser || initialSyncedUserIdRef.current !== authUser.id) return;
    const targetUserId = authUser.id;
    const versionAtStart = stateVersionRef.current;
    setSyncStatus('syncing');
    const res = await cloudSyncService.uploadToCloud(targetUserId, state);
    if (initialSyncedUserIdRef.current !== targetUserId) return;
    if (res.success) {
      if (stateVersionRef.current === versionAtStart) {
        cloudSyncService.clearPendingSync(targetUserId);
        setSyncStatus('synced');
        setLastSyncedAt(new Date());
      } else {
        cloudSyncService.markPendingSync(targetUserId);
      }
    } else {
      cloudSyncService.markPendingSync(targetUserId);
      setSyncStatus('offline');
    }
  };

  const handleKeepLocal = async () => {
    if (!authUser) return;
    setSyncStatus('syncing');
    storageService.saveUserData(authUser.id, state);
    const res = await cloudSyncService.uploadToCloud(authUser.id, state);
    setConflictData(null);
    if (res.success) {
      cloudSyncService.clearPendingSync(authUser.id);
      setSyncStatus('synced');
      setLastSyncedAt(new Date());
    } else {
      cloudSyncService.markPendingSync(authUser.id);
      setSyncStatus('offline');
    }
    initialSyncedUserIdRef.current = authUser.id;
  };

  const handleLoadCloud = async () => {
    if (!conflictData || !authUser) return;
    setState(conflictData.cloudRecord.data);
    storageService.saveData(conflictData.cloudRecord.data);
    storageService.saveUserData(authUser.id, conflictData.cloudRecord.data);
    if (Array.isArray(conflictData.cloudRecord.data.eduhubCourses)) {
      try {
        localStorage.setItem('tracker_eduhub_courses_v1', JSON.stringify(conflictData.cloudRecord.data.eduhubCourses));
        window.dispatchEvent(new CustomEvent('tracker_eduhub_updated', { detail: conflictData.cloudRecord.data.eduhubCourses }));
      } catch {}
    }
    setConflictData(null);
    cloudSyncService.clearPendingSync(authUser.id);
    setSyncStatus('synced');
    setLastSyncedAt(new Date(conflictData.cloudRecord.updatedAt));
    initialSyncedUserIdRef.current = authUser.id;
  };

  const handleMergeBoth = async () => {
    if (!authUser || !conflictData) return;
    setSyncStatus('syncing');
    const merged = cloudSyncService.mergeDatasets(state, conflictData.cloudRecord.data);
    setState(merged);
    storageService.saveData(merged);
    storageService.saveUserData(authUser.id, merged);
    if (Array.isArray(merged.eduhubCourses)) {
      try {
        localStorage.setItem('tracker_eduhub_courses_v1', JSON.stringify(merged.eduhubCourses));
        window.dispatchEvent(new CustomEvent('tracker_eduhub_updated', { detail: merged.eduhubCourses }));
      } catch {}
    }
    const res = await cloudSyncService.uploadToCloud(authUser.id, merged);
    setConflictData(null);
    if (res.success) {
      cloudSyncService.clearPendingSync(authUser.id);
      setSyncStatus('synced');
      setLastSyncedAt(new Date());
    } else {
      cloudSyncService.markPendingSync(authUser.id);
      setSyncStatus('offline');
    }
    initialSyncedUserIdRef.current = authUser.id;
  };

  const handleCancelConflict = async () => {
    await signOut();
    setConflictData(null);
  };

  /** Get the shared attendance requirement */
  const getAttendanceReq = (): number => {
    return getAttendanceRequirement(state.settings?.attendanceRequirement);
  };

  /**
   * Mark attendance for today's lecture slot.
   * Accurately updates both the attendanceLog and the linked subject's attended / totalConducted counts.
   */
  const markAttendance = (slotId: string, status: AttendanceMark, date?: string) => {
    setState((prev) => {
      const todayStr = date || new Date().toISOString().split('T')[0];
      const slot = prev.timetable.find((t) => t.id === slotId);
      if (!slot) return prev;

      // Check if an existing log for today & this slot exists
      const existingLogIdx = prev.attendanceLogs.findIndex(
        (log) => log.slotId === slotId && log.date === todayStr
      );

      const oldStatus = existingLogIdx >= 0 ? prev.attendanceLogs[existingLogIdx].status : null;
      if (oldStatus === status) return prev; // No change

      // Update subject counts
      const updatedSubjects = prev.subjects.map((sub) => {
        if (sub.id !== slot.subjectId) return sub;

        let attended = sub.attended;
        let totalConducted = sub.totalConducted;

        // Revert previous mark if there was one
        if (oldStatus === 'present') {
          attended = Math.max(0, attended - 1);
          totalConducted = Math.max(0, totalConducted - 1);
        } else if (oldStatus === 'absent') {
          totalConducted = Math.max(0, totalConducted - 1);
        }

        // Apply new mark
        if (status === 'present') {
          attended += 1;
          totalConducted += 1;
        } else if (status === 'absent') {
          totalConducted += 1;
        }
        // If cancelled, neither increments

        return {
          ...sub,
          attended,
          totalConducted,
          isSample: false, // User mutation turns record into real user record!
        };
      });

      // Update or create log
      let updatedLogs = [...prev.attendanceLogs];
      if (existingLogIdx >= 0) {
        updatedLogs[existingLogIdx] = {
          ...updatedLogs[existingLogIdx],
          status,
          timestamp: new Date().toISOString(),
          isSample: false,
        };
      } else {
        updatedLogs.push({
          id: `att-log-${Date.now()}`,
          date: todayStr,
          slotId,
          subjectId: slot.subjectId,
          status,
          timestamp: new Date().toISOString(),
          isSample: false,
        });
      }

      return {
        ...prev,
        subjects: updatedSubjects,
        attendanceLogs: updatedLogs,
      };
    });
  };

  /**
   * Mark attendance for a resolved calendar event (used by attendance calendar).
   * Supports recurring, rescheduled, and extra class events.
   */
  const markAttendanceForEvent = (
    _occurrenceKey: string,
    subjectId: string,
    date: string,
    status: AttendanceMark,
    slotId?: string,
    extraClassId?: string,
    overrideId?: string,
    isPlanned?: boolean,
  ) => {
    setState((prev) => {
      // Find existing log for this occurrence
      const existingLogIdx = prev.attendanceLogs.findIndex(
        (log) => {
          if (extraClassId) return log.extraClassId === extraClassId && log.date === date;
          if (slotId) return log.slotId === slotId && log.date === date;
          return false;
        }
      );

      const oldStatus = existingLogIdx >= 0 ? prev.attendanceLogs[existingLogIdx].status : null;
      const wasPlanned = existingLogIdx >= 0 ? prev.attendanceLogs[existingLogIdx].isPlanned : false;
      if (oldStatus === status && wasPlanned === (isPlanned || false)) return prev;

      // Update subject counts (only for non-planned marks)
      const updatedSubjects = prev.subjects.map((sub) => {
        if (sub.id !== subjectId) return sub;

        let attended = sub.attended;
        let totalConducted = sub.totalConducted;

        // Revert previous mark if it was NOT planned
        if (!wasPlanned) {
          if (oldStatus === 'present') {
            attended = Math.max(0, attended - 1);
            totalConducted = Math.max(0, totalConducted - 1);
          } else if (oldStatus === 'absent') {
            totalConducted = Math.max(0, totalConducted - 1);
          }
        }

        // Apply new mark only if not planned
        if (!isPlanned) {
          if (status === 'present') {
            attended += 1;
            totalConducted += 1;
          } else if (status === 'absent') {
            totalConducted += 1;
          }
        }

        return { ...sub, attended, totalConducted, isSample: false };
      });

      let updatedLogs = [...prev.attendanceLogs];
      if (existingLogIdx >= 0) {
        updatedLogs[existingLogIdx] = {
          ...updatedLogs[existingLogIdx],
          status,
          timestamp: new Date().toISOString(),
          isSample: false,
          isPlanned: isPlanned || false,
        };
      } else {
        updatedLogs.push({
          id: `att-log-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
          date,
          slotId: slotId || '',
          subjectId,
          status,
          timestamp: new Date().toISOString(),
          isSample: false,
          overrideId,
          extraClassId,
          isPlanned: isPlanned || false,
        });
      }

      return { ...prev, subjects: updatedSubjects, attendanceLogs: updatedLogs };
    });
  };

  /**
   * Log a completed or interrupted study/focus session.
   */
  const logStudySession = (
    durationMinutes: number,
    subjectId?: string,
    notes?: string,
    options?: {
      plannedDurationMinutes?: number;
      status?: SessionStatus;
      startTime?: string;
      endTime?: string;
      id?: string;
      durationSeconds?: number;
    }
  ) => {
    const status = options?.status ?? 'completed';
    // If cancelled or non-positive duration, don't record unless explicitly needed
    if (status === 'cancelled') return;
    if (durationMinutes <= 0 && (!options?.durationSeconds || options.durationSeconds <= 0)) return;

    setState((prev) => {
      // Idempotency: prevent duplicates by ID if session ID is provided
      const sessionId = options?.id || `study-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      if (prev.studySessions.some((s) => s.id === sessionId)) {
        return prev;
      }

      // Resolve subject name from attendance subjects OR syllabus subjects
      let subjectName: string | undefined;
      const sub = prev.subjects.find((s) => s.id === subjectId);
      if (sub) {
        subjectName = `${sub.code} — ${sub.name}`;
      } else {
        const sylSub = (prev.syllabusSubjects || []).find((s) => s.id === subjectId);
        if (sylSub) {
          subjectName = sylSub.name;
        }
      }

      const nowIso = new Date().toISOString();
      const finalDurationMinutes = options?.durationSeconds !== undefined
        ? Number((options.durationSeconds / 60).toFixed(2))
        : Number(durationMinutes.toFixed(2));
      const finalDurationSeconds = options?.durationSeconds ?? Math.round(durationMinutes * 60);

      const newSession: StudySession = {
        id: sessionId,
        subjectId,
        subjectName,
        durationMinutes: finalDurationMinutes,
        durationSeconds: finalDurationSeconds,
        plannedDurationMinutes: options?.plannedDurationMinutes,
        timestamp: options?.endTime || nowIso,
        startTime: options?.startTime,
        endTime: options?.endTime || nowIso,
        status,
        notes,
        isSample: false,
      };

      return {
        ...prev,
        studySessions: [newSession, ...prev.studySessions],
      };
    });
  };

  /**
   * Delete a focus study session from ledger.
   */
  const deleteStudySession = (id: string) => {
    setState((prev) => ({
      ...prev,
      studySessions: prev.studySessions.filter((s) => s.id !== id),
      tombstones: cloudSyncService.addTombstone(prev.tombstones, id, 'studySessions'),
    }));
  };

  /**
   * Toggle a gym exercise set for today's workout.
   */
  const toggleGymSet = (exerciseIndex: number, setIndex: number) => {
    setState((prev) => {
      const todayStr = new Date().toISOString().split('T')[0];
      const workoutIdx = prev.gymWorkouts.findIndex((w) => w.date === todayStr);

      if (workoutIdx < 0) return prev;

      const currentWorkout = prev.gymWorkouts[workoutIdx];
      const updatedExercises = currentWorkout.exercises.map((ex, exIdx) => {
        if (exIdx !== exerciseIndex) return ex;
        const updatedSets = ex.sets.map((set, sIdx) => {
          if (sIdx !== setIndex) return set;
          return { ...set, completed: !set.completed };
        });
        return { ...ex, sets: updatedSets };
      });

      // Check if all sets in all exercises are completed
      const allSetsDone = updatedExercises.every((ex) =>
        ex.sets.every((s) => s.completed)
      );

      const updatedWorkout = {
        ...currentWorkout,
        exercises: updatedExercises,
        completed: allSetsDone,
        isSample: false,
      };

      const newWorkouts = [...prev.gymWorkouts];
      newWorkouts[workoutIdx] = updatedWorkout;

      return {
        ...prev,
        gymWorkouts: newWorkouts,
      };
    });
  };

  /**
   * Mark the whole workout for today as completed or uncompleted.
   */
  const toggleGymWorkoutComplete = () => {
    setState((prev) => {
      const todayStr = new Date().toISOString().split('T')[0];
      const workoutIdx = prev.gymWorkouts.findIndex((w) => w.date === todayStr);
      if (workoutIdx < 0) return prev;

      const current = prev.gymWorkouts[workoutIdx];
      const nextCompleted = !current.completed;
      const updatedExercises = current.exercises.map((ex) => ({
        ...ex,
        sets: ex.sets.map((s) => ({ ...s, completed: nextCompleted })),
      }));

      const newWorkouts = [...prev.gymWorkouts];
      newWorkouts[workoutIdx] = {
        ...current,
        completed: nextCompleted,
        exercises: updatedExercises,
        isSample: false,
      };

      return {
        ...prev,
        gymWorkouts: newWorkouts,
      };
    });
  };

  const startTodayWorkout = (splitTitle?: string) => {
    setState((prev) => {
      const todayStr = new Date().toISOString().split('T')[0];
      const existingIdx = prev.gymWorkouts.findIndex((w) => w.date === todayStr);
      if (existingIdx >= 0) return prev;

      const dayOfWeek = new Date().getDay();
      const defaultSplits: Record<number, string> = {
        0: 'Rest & Recovery',
        1: 'Push Day (Chest, Shoulders, Triceps)',
        2: 'Pull Day (Back, Rear Delts, Biceps)',
        3: 'Legs & Core',
        4: 'Active Recovery & Cardio',
        5: 'Upper Hypertrophy',
        6: 'Lower Hypertrophy',
      };

      const newWorkout: GymWorkout = {
        id: 'gym-' + Date.now(),
        date: todayStr,
        split: splitTitle || defaultSplits[dayOfWeek] || 'Daily Training Session',
        completed: false,
        durationMinutes: 45,
        exercises: [],
        isSample: false,
      };

      return {
        ...prev,
        gymWorkouts: [newWorkout, ...prev.gymWorkouts],
      };
    });
  };

  const addGymExercise = (exerciseName: string, setsCount: number = 3) => {
    setState((prev) => {
      const todayStr = new Date().toISOString().split('T')[0];
      let workoutIdx = prev.gymWorkouts.findIndex((w) => w.date === todayStr);
      let newWorkouts = [...prev.gymWorkouts];

      const newExercise: GymExercise = {
        name: exerciseName.trim(),
        sets: Array.from({ length: Math.max(1, setsCount) }, () => ({
          reps: 10,
          weightKg: 20,
          completed: false,
        })),
      };

      if (workoutIdx < 0) {
        const newWorkout: GymWorkout = {
          id: 'gym-' + Date.now(),
          date: todayStr,
          split: 'Custom Workout',
          completed: false,
          durationMinutes: 45,
          exercises: [newExercise],
          isSample: false,
        };
        newWorkouts = [newWorkout, ...newWorkouts];
      } else {
        const current = newWorkouts[workoutIdx];
        newWorkouts[workoutIdx] = {
          ...current,
          exercises: [...current.exercises, newExercise],
          isSample: false,
        };
      }

      return {
        ...prev,
        gymWorkouts: newWorkouts,
      };
    });
  };

  /**
   * Toggle completion of a reminder task.
   */
  const toggleReminder = (id: string) => {
    setState((prev) => {
      const target = prev.reminders.find((r) => r.id === id);
      const nextCompleted = target ? !target.isCompleted : false;
      return {
        ...prev,
        reminders: prev.reminders.map((r) =>
          r.id === id ? { ...r, isCompleted: !r.isCompleted, isSample: false } : r
        ),
        events: (prev.events || []).map((e) =>
          e.id === id
            ? {
                ...e,
                isCompleted: nextCompleted,
                status: (nextCompleted ? 'done' : 'todo') as TaskStatus,
                completedAt: nextCompleted ? new Date().toISOString() : undefined,
                isSample: false,
              }
            : e
        ),
      };
    });
  };

  /**
   * Add a new reminder task.
   */
  const addReminder = (item: Omit<Reminder, 'id' | 'isCompleted'>) => {
    setState((prev) => {
      const id = `rem-${Date.now()}`;
      const nowIso = new Date().toISOString();
      const newReminder: Reminder = {
        ...item,
        id,
        isCompleted: false,
        isSample: false,
      };
      const mirrorEvent: CalendarEvent = {
        id,
        title: item.title,
        category: 'reminder',
        date: item.dueDate,
        isAllDay: true,
        priority: item.priority,
        isCompleted: false,
        status: 'todo',
        createdAt: nowIso,
        updatedAt: nowIso,
        isSample: false,
      };
      const cleanTombstones = (prev.tombstones || []).filter(
        (t) => !(t.id === id && (t.collection === 'reminders' || t.collection === 'events'))
      );
      return {
        ...prev,
        reminders: [newReminder, ...prev.reminders],
        events: [mirrorEvent, ...(prev.events || [])],
        tombstones: cleanTombstones,
      };
    });
  };

  /**
   * Delete a reminder task.
   */
  const deleteReminder = (id: string) => {
    setState((prev) => ({
      ...prev,
      reminders: prev.reminders.filter((r) => r.id !== id),
      events: (prev.events || []).filter((e) => e.id !== id),
      tombstones: cloudSyncService.addTombstone(
        cloudSyncService.addTombstone(prev.tombstones, id, 'reminders'),
        id,
        'events'
      ),
    }));
  };

  /**
   * Events & Tasks Calendar: Add Event
   */
  const addEvent = (item: Omit<CalendarEvent, 'id' | 'createdAt'>): string => {
    const id = (item as any).id || `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const nowIso = new Date().toISOString();
    const isCompleted = item.isCompleted ?? (item.status === 'done');
    const status = item.status ?? (isCompleted ? 'done' : 'todo');
    const completedAt = item.completedAt !== undefined
      ? item.completedAt
      : isCompleted ? nowIso : undefined;
    const newEvent: CalendarEvent = {
      ...item,
      id,
      createdAt: nowIso,
      updatedAt: nowIso,
      isSample: false,
      isCompleted,
      status,
      completedAt,
    };

    setState((prev) => {
      let updatedReminders = prev.reminders;
      if (item.category === 'reminder') {
        const mirrorReminder: Reminder = {
          id,
          title: item.title,
          category: 'academic',
          dueDate: item.date,
          priority: item.priority ?? 'medium',
          isCompleted: Boolean(isCompleted),
          isSample: false,
        };
        updatedReminders = [mirrorReminder, ...prev.reminders];
      }
      const cleanTombstones = (prev.tombstones || []).filter(
        (t) => !(t.id === id && (t.collection === 'events' || t.collection === 'reminders'))
      );
      return {
        ...prev,
        events: [newEvent, ...(prev.events || [])],
        reminders: updatedReminders,
        tombstones: cleanTombstones,
      };
    });
    return id;
  };

  /**
   * Events & Tasks Calendar: Update Event
   */
  const updateEvent = (id: string, updates: Partial<CalendarEvent>) => {
    setState((prev) => {
      const nowIso = new Date().toISOString();
      const updatedEvents = (prev.events || []).map((evt) => {
        if (evt.id !== id) return evt;
        const isDone = updates.status === 'done' || updates.isCompleted === true;
        const isNotDone = (updates.status && updates.status !== 'done') || updates.isCompleted === false;

        let completedAt = updates.completedAt !== undefined ? updates.completedAt : evt.completedAt;
        if (isDone && !completedAt) {
          completedAt = nowIso;
        } else if (isNotDone) {
          completedAt = undefined;
        }

        const nextStatus = updates.status ?? (updates.isCompleted !== undefined ? (updates.isCompleted ? 'done' : 'todo') : evt.status);
        const nextIsCompleted = updates.isCompleted !== undefined ? updates.isCompleted : (updates.status ? updates.status === 'done' : evt.isCompleted);

        const updated = {
          ...evt,
          ...updates,
          status: nextStatus,
          isCompleted: nextIsCompleted,
          completedAt,
          updatedAt: nowIso,
          isSample: false,
        };
        return updated;
      });

      const updatedReminders = prev.reminders.map((rem) => {
        if (rem.id !== id) return rem;
        return {
          ...rem,
          title: updates.title ?? rem.title,
          dueDate: updates.date ?? rem.dueDate,
          priority: updates.priority ?? rem.priority,
          isCompleted: updates.isCompleted !== undefined ? updates.isCompleted : rem.isCompleted,
          isSample: false,
        };
      });

      return {
        ...prev,
        events: updatedEvents,
        reminders: updatedReminders,
      };
    });
  };

  const toggleEventSubtask = (eventId: string, subtaskId: string) => {
    setState((prev) => {
      const target = (prev.events || []).find((e) => e.id === eventId);
      if (!target || !target.subtasks) return prev;
      const nowIso = new Date().toISOString();

      const updatedSubtasks = target.subtasks.map((st) => {
        if (st.id !== subtaskId) return st;
        const nextCompleted = !st.isCompleted;
        return {
          ...st,
          isCompleted: nextCompleted,
          completedAt: nextCompleted ? nowIso : undefined,
        };
      });

      const updatedEvents = (prev.events || []).map((e) =>
        e.id === eventId ? { ...e, subtasks: updatedSubtasks, updatedAt: nowIso, isSample: false } : e
      );
      return { ...prev, events: updatedEvents };
    });
  };

  /**
   * Events & Tasks Calendar: Delete Event
   */
  const deleteEvent = (id: string) => {
    setState((prev) => ({
      ...prev,
      events: (prev.events || []).filter((e) => e.id !== id),
      reminders: prev.reminders.filter((r) => r.id !== id),
      tombstones: cloudSyncService.addTombstone(
        cloudSyncService.addTombstone(prev.tombstones, id, 'events'),
        id,
        'reminders'
      ),
    }));
  };

  /**
   * Events & Tasks Calendar: Toggle Complete
   */
  const toggleEventComplete = (id: string) => {
    setState((prev) => {
      const target = (prev.events || []).find((e) => e.id === id);
      const nextCompleted = target ? !target.isCompleted : false;
      const nowIso = new Date().toISOString();
      const updatedEvents = (prev.events || []).map((evt) => {
        if (evt.id !== id) return evt;
        return {
          ...evt,
          isCompleted: nextCompleted,
          status: (nextCompleted ? 'done' : 'todo') as TaskStatus,
          completedAt: nextCompleted ? nowIso : undefined,
          updatedAt: nowIso,
        };
      });
      const updatedReminders = prev.reminders.map((r) =>
        r.id === id ? { ...r, isCompleted: !r.isCompleted } : r
      );
      return {
        ...prev,
        events: updatedEvents,
        reminders: updatedReminders,
      };
    });
  };

  /**
   * Quick add a subject.
   */
  const addSubject = (subject: Omit<Subject, 'id'>) => {
    setState((prev) => {
      const newSub: Subject = {
        ...subject,
        id: `sub-${Date.now()}`,
        isSample: false,
      };
      return {
        ...prev,
        subjects: [...prev.subjects, newSub],
      };
    });
  };

  /**
   * Cleanly purge all sample demonstration data while leaving real user data intact.
   */
  const clearSampleData = () => {
    setState((prev) => storageService.clearSampleData(prev));
  };

  /**
   * Populate realistic editorial sample data.
   */
  const restoreSampleData = () => {
    const loaded = storageService.populateSampleData();
    setState(loaded);
  };

  // Export current state for backup
  const exportData = () => {
    return storageService.exportBackup(state);
  };

  // Import backup JSON and replace state
  const importData = (json: string): boolean => {
    try {
      const imported = storageService.importBackup(json);
      setState(imported);
      return true;
    } catch {
      return false;
    }
  };

  // Update user profile (replace entire profile object)
  const updateProfile = (profile: UserProfile) => {
    setState((prev) => ({
      ...prev,
      profile,
    }));
  };

  // Update settings partially (merge with existing settings)
  const updateSettings = (settings: Partial<AppSettings>) => {
    setState((prev) => {
      const existing: AppSettings = prev.settings ?? {
        themeMode: 'system',
        accentColor: 'terracotta',
        backgroundStyle: 'minimal',
        studyDayRolloverHour: 0,
        showExamCountdown: true,
        showFocusRadio: false,
      };
      return {
        ...prev,
        settings: { ...existing, ...settings } as AppSettings,
      };
    });
  };

  // ── Syllabus Tracker Actions ──
  const addSyllabusSubject = (name: string, color?: string) => {
    setState((prev) => {
      const currentList = prev.syllabusSubjects ?? [];
      const newSubject: SyllabusSubject = {
        id: 'syl-' + Date.now() + '-' + Math.random().toString(36).slice(2, 5),
        name: name.trim(),
        color: color || '#C45532',
        chapters: [],
      };
      return {
        ...prev,
        syllabusSubjects: [...currentList, newSubject],
      };
    });
  };

  const updateSyllabusSubject = (id: string, name: string, color?: string) => {
    setState((prev) => {
      const currentList = prev.syllabusSubjects ?? [];
      return {
        ...prev,
        syllabusSubjects: currentList.map((s) =>
          s.id === id ? { ...s, name: name.trim(), color: color || s.color } : s
        ),
      };
    });
  };

  const deleteSyllabusSubject = (id: string) => {
    setState((prev) => {
      const currentList = prev.syllabusSubjects ?? [];
      return {
        ...prev,
        syllabusSubjects: currentList.filter((s) => s.id !== id),
        tombstones: cloudSyncService.addTombstone(prev.tombstones, id, 'syllabusSubjects'),
      };
    });
  };

  const addChapter = (subjectId: string, name: string) => {
    setState((prev) => {
      const currentList = prev.syllabusSubjects ?? [];
      return {
        ...prev,
        syllabusSubjects: currentList.map((s) => {
          if (s.id !== subjectId) return s;
          const newChapter: SyllabusChapterType = {
            id: 'chap-' + Date.now() + '-' + Math.random().toString(36).slice(2, 5),
            name: name.trim(),
            subtopics: [],
          };
          return {
            ...s,
            chapters: [...s.chapters, newChapter],
          };
        }),
      };
    });
  };

  const updateChapter = (subjectId: string, chapterId: string, name: string) => {
    setState((prev) => {
      const currentList = prev.syllabusSubjects ?? [];
      return {
        ...prev,
        syllabusSubjects: currentList.map((s) => {
          if (s.id !== subjectId) return s;
          return {
            ...s,
            chapters: s.chapters.map((c) =>
              c.id === chapterId ? { ...c, name: name.trim() } : c
            ),
          };
        }),
      };
    });
  };

  const deleteChapter = (subjectId: string, chapterId: string) => {
    setState((prev) => {
      const currentList = prev.syllabusSubjects ?? [];
      return {
        ...prev,
        syllabusSubjects: currentList.map((s) => {
          if (s.id !== subjectId) return s;
          return {
            ...s,
            chapters: s.chapters.filter((c) => c.id !== chapterId),
          };
        }),
      };
    });
  };

  const addSubtopic = (
    subjectId: string,
    chapterId: string,
    subtopic: Omit<Subtopic, 'id' | 'revisionCount'>
  ) => {
    setState((prev) => {
      const currentList = prev.syllabusSubjects ?? [];
      return {
        ...prev,
        syllabusSubjects: currentList.map((s) => {
          if (s.id !== subjectId) return s;
          return {
            ...s,
            chapters: s.chapters.map((c) => {
              if (c.id !== chapterId) return c;
              const newSubtopic: Subtopic = {
                ...subtopic,
                id: 'top-' + Date.now() + '-' + Math.random().toString(36).slice(2, 5),
                revisionCount: 0,
              };
              return {
                ...c,
                subtopics: [...c.subtopics, newSubtopic],
              };
            }),
          };
        }),
      };
    });
  };

  const updateSubtopic = (
    subjectId: string,
    chapterId: string,
    subtopicId: string,
    updates: Partial<Subtopic>
  ) => {
    setState((prev) => {
      const currentList = prev.syllabusSubjects ?? [];
      return {
        ...prev,
        syllabusSubjects: currentList.map((s) => {
          if (s.id !== subjectId) return s;
          return {
            ...s,
            chapters: s.chapters.map((c) => {
              if (c.id !== chapterId) return c;
              return {
                ...c,
                subtopics: c.subtopics.map((t) =>
                  t.id === subtopicId ? { ...t, ...updates } : t
                ),
              };
            }),
          };
        }),
      };
    });
  };

  const deleteSubtopic = (subjectId: string, chapterId: string, subtopicId: string) => {
    setState((prev) => {
      const currentList = prev.syllabusSubjects ?? [];
      return {
        ...prev,
        syllabusSubjects: currentList.map((s) => {
          if (s.id !== subjectId) return s;
          return {
            ...s,
            chapters: s.chapters.map((c) => {
              if (c.id !== chapterId) return c;
              return {
                ...c,
                subtopics: c.subtopics.filter((t) => t.id !== subtopicId),
              };
            }),
          };
        }),
      };
    });
  };

  const setTopicStatus = (
    subjectId: string,
    chapterId: string,
    subtopicId: string,
    status: TopicStatus
  ) => {
    updateSubtopic(subjectId, chapterId, subtopicId, { status });
  };

  const incrementRevision = (subjectId: string, chapterId: string, subtopicId: string) => {
    setState((prev) => {
      const currentList = prev.syllabusSubjects ?? [];
      const todayStr = new Date().toISOString().split('T')[0];
      return {
        ...prev,
        syllabusSubjects: currentList.map((s) => {
          if (s.id !== subjectId) return s;
          return {
            ...s,
            chapters: s.chapters.map((c) => {
              if (c.id !== chapterId) return c;
              return {
                ...c,
                subtopics: c.subtopics.map((t) =>
                  t.id === subtopicId
                    ? {
                        ...t,
                        revisionCount: (t.revisionCount || 0) + 1,
                        lastRevised: todayStr,
                        status: t.status === 'revision_needed' ? 'done' : t.status,
                      }
                    : t
                ),
              };
            }),
          };
        }),
      };
    });
  };

  // ── Timetable & Calendar Actions ──
  const addTimetableSlot = (slot: Omit<TimetableSlot, 'id'>, customSubjectName?: string) => {
    setState((prev) => {
      let subjectId = slot.subjectId;
      let updatedSubjects = [...prev.subjects];

      // If customSubjectName is provided and subjectId is empty or 'new'
      if (customSubjectName && (!subjectId || subjectId === 'new')) {
        const existing = updatedSubjects.find(
          (s) => s.name.toLowerCase() === customSubjectName.toLowerCase()
        );
        if (existing) {
          subjectId = existing.id;
        } else {
          const req = getAttendanceReq();
          const newSub: Subject = {
            id: 'sub-' + Date.now() + '-' + Math.random().toString(36).slice(2, 5),
            code: customSubjectName.slice(0, 5).toUpperCase(),
            name: customSubjectName.trim(),
            attended: 0,
            totalConducted: 0,
            targetPct: req,
            color: '#3D6A8A',
          };
          updatedSubjects.push(newSub);
          subjectId = newSub.id;
        }
      }

      const newSlot: TimetableSlot = {
        ...slot,
        id: 'tt-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
        subjectId,
      };

      return {
        ...prev,
        subjects: updatedSubjects,
        timetable: [...prev.timetable, newSlot],
      };
    });
  };

  const updateTimetableSlot = (id: string, updates: Partial<TimetableSlot>) => {
    setState((prev) => ({
      ...prev,
      timetable: prev.timetable.map((s) => (s.id === id ? { ...s, ...updates } : s)),
    }));
  };

  const deleteTimetableSlot = (id: string) => {
    setState((prev) => {
      const removedOverrides = (prev.occurrenceOverrides || []).filter((o) => o.slotId === id);
      let updatedTombstones = cloudSyncService.addTombstone(prev.tombstones, id, 'timetable');
      for (const ovr of removedOverrides) {
        updatedTombstones = cloudSyncService.addTombstone(updatedTombstones, ovr.id, 'occurrenceOverrides');
      }
      return {
        ...prev,
        timetable: prev.timetable.filter((s) => s.id !== id),
        // Also clean up related overrides
        occurrenceOverrides: (prev.occurrenceOverrides || []).filter((o) => o.slotId !== id),
        tombstones: updatedTombstones,
      };
    });
  };

  const importTimetableClasses = (
    classes: TimetableImportClass[],
    replaceExisting = false
  ): { importedCount: number; skippedCount: number } => {
    const dayMap: Record<string, DayOfWeek> = {
      monday: 1, mon: 1, '1': 1,
      tuesday: 2, tue: 2, '2': 2,
      wednesday: 3, wed: 3, '3': 3,
      thursday: 4, thu: 4, '4': 4,
      friday: 5, fri: 5, '5': 5,
      saturday: 6, sat: 6, '6': 6,
      sunday: 7, sun: 7, '7': 7,
    };

    let importedCount = 0;
    let skippedCount = 0;

    setState((prev) => {
      const baseTimetable = replaceExisting ? [] : [...prev.timetable];
      const updatedSubjects = [...prev.subjects];
      const req = getAttendanceReq();

      classes.forEach((item) => {
        const normalizedDay = dayMap[item.day.toLowerCase().trim()];
        if (!normalizedDay) {
          skippedCount++;
          return;
        }

        // Match or create subject
        const subName = item.subject.trim();
        let subject = updatedSubjects.find(
          (s) =>
            s.name.toLowerCase() === subName.toLowerCase() ||
            s.code.toLowerCase() === subName.toLowerCase()
        );

        if (!subject) {
          subject = {
            id: 'sub-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
            code: subName.length <= 6 ? subName.toUpperCase() : subName.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 5),
            name: subName,
            attended: 0,
            totalConducted: 0,
            targetPct: req,
            color: '#B8732E',
          };
          updatedSubjects.push(subject);
        }

        // Check for duplicate in baseTimetable
        const isDuplicate = baseTimetable.some(
          (slot) =>
            slot.dayOfWeek === normalizedDay &&
            slot.startTime === item.startTime &&
            slot.subjectId === subject!.id
        );

        if (isDuplicate) {
          skippedCount++;
          return;
        }

        const newSlot: TimetableSlot = {
          id: 'tt-imp-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
          dayOfWeek: normalizedDay,
          startTime: item.startTime,
          endTime: item.endTime,
          subjectId: subject.id,
          room: item.room || item.location || undefined,
          instructor: item.instructor || undefined,
          notes: item.notes || undefined,
        };

        baseTimetable.push(newSlot);
        importedCount++;
      });

      return {
        ...prev,
        subjects: updatedSubjects,
        timetable: baseTimetable,
      };
    });

    return { importedCount, skippedCount };
  };

  // ── Occurrence Override Actions (Fix Recurring Rescheduling Bug) ──
  const rescheduleOccurrence = (
    slotId: string,
    originalDate: string,
    newDate: string,
    newStartTime?: string,
    newEndTime?: string,
    newRoom?: string,
    newNotes?: string,
  ) => {
    setState((prev) => {
      const existing = (prev.occurrenceOverrides || []);
      // Remove any existing override for this slot+date
      const filtered = existing.filter(
        (o) => !(o.slotId === slotId && o.originalDate === originalDate)
      );
      const newOverride: OccurrenceOverride = {
        id: 'ovr-' + Date.now() + '-' + Math.random().toString(36).slice(2, 5),
        slotId,
        originalDate,
        type: 'reschedule',
        newDate,
        newStartTime,
        newEndTime,
        newRoom,
        newNotes,
      };
      return {
        ...prev,
        occurrenceOverrides: [...filtered, newOverride],
      };
    });
  };

  const cancelOccurrence = (slotId: string, originalDate: string) => {
    setState((prev) => {
      const existing = (prev.occurrenceOverrides || []);
      const filtered = existing.filter(
        (o) => !(o.slotId === slotId && o.originalDate === originalDate)
      );
      const newOverride: OccurrenceOverride = {
        id: 'ovr-' + Date.now() + '-' + Math.random().toString(36).slice(2, 5),
        slotId,
        originalDate,
        type: 'cancel',
      };
      return {
        ...prev,
        occurrenceOverrides: [...filtered, newOverride],
      };
    });
  };

  const restoreOccurrence = (slotId: string, originalDate: string) => {
    setState((prev) => {
      const removedOverrides = (prev.occurrenceOverrides || []).filter(
        (o) => o.slotId === slotId && o.originalDate === originalDate
      );
      let updatedTombstones = prev.tombstones || [];
      for (const ovr of removedOverrides) {
        updatedTombstones = cloudSyncService.addTombstone(updatedTombstones, ovr.id, 'occurrenceOverrides');
      }
      return {
        ...prev,
        occurrenceOverrides: (prev.occurrenceOverrides || []).filter(
          (o) => !(o.slotId === slotId && o.originalDate === originalDate)
        ),
        tombstones: updatedTombstones,
      };
    });
  };

  // ── Extra Class Actions ──
  const addExtraClass = (extra: Omit<ExtraClass, 'id'>) => {
    setState((prev) => {
      const newExtra: ExtraClass = {
        ...extra,
        id: 'extra-' + Date.now() + '-' + Math.random().toString(36).slice(2, 5),
      };
      return {
        ...prev,
        extraClasses: [...(prev.extraClasses || []), newExtra],
      };
    });
  };

  const deleteExtraClass = (id: string) => {
    setState((prev) => ({
      ...prev,
      extraClasses: (prev.extraClasses || []).filter((e) => e.id !== id),
      tombstones: cloudSyncService.addTombstone(prev.tombstones, id, 'extraClasses'),
    }));
  };

  // ── Syllabus Import ──
  const importSyllabus = (
    payload: SyllabusImportPayload,
    targetSubjectId?: string,
  ): { chaptersAdded: number; topicsAdded: number; subjectName: string } => {
    let chaptersAdded = 0;
    let topicsAdded = 0;
    const subjectName = payload.subject.name;

    setState((prev) => {
      const currentList = [...(prev.syllabusSubjects ?? [])];
      const now = Date.now();

      // Find or create target subject
      let targetIdx = targetSubjectId
        ? currentList.findIndex((s) => s.id === targetSubjectId)
        : currentList.findIndex((s) => s.name.toLowerCase() === subjectName.toLowerCase());

      if (targetIdx < 0) {
        // Create new subject
        const newSubject: SyllabusSubject = {
          id: 'syl-' + now + '-' + Math.random().toString(36).slice(2, 5),
          name: subjectName.trim(),
          color: '#3D6A8A',
          chapters: [],
        };
        currentList.push(newSubject);
        targetIdx = currentList.length - 1;
      }

      const target = { ...currentList[targetIdx], chapters: [...currentList[targetIdx].chapters] };

      // Import chapters
      for (const importChapter of payload.subject.chapters) {
        // Check for existing chapter with same name
        const existingChapIdx = target.chapters.findIndex(
          (c) => c.name.toLowerCase() === importChapter.name.toLowerCase()
        );

        if (existingChapIdx >= 0) {
          // Merge: add new topics that don't already exist
          const existingChap = { ...target.chapters[existingChapIdx], subtopics: [...target.chapters[existingChapIdx].subtopics] };
          for (const importTopic of importChapter.topics) {
            const topicExists = existingChap.subtopics.some(
              (t) => t.name.toLowerCase() === importTopic.name.toLowerCase()
            );
            if (!topicExists) {
              existingChap.subtopics.push({
                id: 'top-' + Date.now() + '-' + Math.random().toString(36).slice(2, 5),
                name: importTopic.name,
                status: 'not_started',
                revisionCount: 0,
                estimatedLectures: importTopic.estimatedLectures,
                importance: importTopic.importance,
                notes: importTopic.subtopics?.length ? `Subtopics: ${importTopic.subtopics.join(', ')}` : undefined,
              });
              topicsAdded++;
            }
          }
          // Update chapter metadata
          existingChap.estimatedLectures = importChapter.estimatedLectures ?? existingChap.estimatedLectures;
          existingChap.importance = importChapter.importance ?? existingChap.importance;
          target.chapters[existingChapIdx] = existingChap;
        } else {
          // Create new chapter
          const newChapter: SyllabusChapterType = {
            id: 'chap-' + Date.now() + '-' + Math.random().toString(36).slice(2, 5),
            name: importChapter.name,
            estimatedLectures: importChapter.estimatedLectures,
            importance: importChapter.importance,
            subtopics: importChapter.topics.map((t) => ({
              id: 'top-' + Date.now() + '-' + Math.random().toString(36).slice(2, 5),
              name: t.name,
              status: 'not_started' as const,
              revisionCount: 0,
              estimatedLectures: t.estimatedLectures,
              importance: t.importance,
              notes: t.subtopics?.length ? `Subtopics: ${t.subtopics.join(', ')}` : undefined,
            })),
          };
          target.chapters.push(newChapter);
          chaptersAdded++;
          topicsAdded += importChapter.topics.length;
        }
      }

      currentList[targetIdx] = target;
      return { ...prev, syllabusSubjects: currentList };
    });

    return { chaptersAdded, topicsAdded, subjectName };
  };

  // ─── Milestone 5: Planner Tasks ───────────────────────────────────────────
  const addTask = (task: Omit<PlannerTask, 'id' | 'createdAt'>): string => {
    const id = (task as any).id || ('task-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7));
    const nowIso = new Date().toISOString();
    const newTask: PlannerTask = {
      ...task,
      id,
      createdAt: nowIso,
      updatedAt: nowIso,
      completedAt: task.status === 'done' ? nowIso : undefined,
    };
    setState((prev) => ({
      ...prev,
      tasks: [newTask, ...(prev.tasks || [])],
      tombstones: (prev.tombstones || []).filter((t) => !(t.id === id && t.collection === 'tasks')),
    }));
    return id;
  };

  const updateTask = (id: string, updates: Partial<PlannerTask>) => {
    setState((prev) => {
      const existing = (prev.tasks || []).find((t) => t.id === id);
      if (!existing) return prev;

      const nowIso = new Date().toISOString();
      let completedAt = updates.completedAt !== undefined ? updates.completedAt : existing.completedAt;
      if (updates.status === 'done' && existing.status !== 'done' && !completedAt) {
        completedAt = nowIso;
      } else if (updates.status && updates.status !== 'done') {
        completedAt = undefined;
      }

      const updated = (prev.tasks || []).map((t) =>
        t.id === id ? { ...t, ...updates, completedAt, updatedAt: nowIso, isSample: false } : t
      );
      return { ...prev, tasks: updated };
    });
  };

  const deleteTask = (id: string) => {
    setState((prev) => ({
      ...prev,
      tasks: (prev.tasks || []).filter((t) => t.id !== id),
      tombstones: cloudSyncService.addTombstone(prev.tombstones, id, 'tasks'),
    }));
  };

  const setTaskStatus = (id: string, status: TaskStatus) => {
    updateTask(id, { status });
  };

  const toggleTaskSubtask = (taskId: string, subtaskId: string) => {
    setState((prev) => {
      const task = (prev.tasks || []).find((t) => t.id === taskId);
      if (!task || !task.subtasks) return prev;
      const nowIso = new Date().toISOString();

      const updatedSubtasks = task.subtasks.map((st) => {
        if (st.id !== subtaskId) return st;
        const nextCompleted = !st.isCompleted;
        return {
          ...st,
          isCompleted: nextCompleted,
          completedAt: nextCompleted ? nowIso : undefined,
        };
      });

      const updatedTasks = (prev.tasks || []).map((t) =>
        t.id === taskId ? { ...t, subtasks: updatedSubtasks, updatedAt: nowIso, isSample: false } : t
      );
      return { ...prev, tasks: updatedTasks };
    });
  };

  // ─── Milestone 5: Spaced Repetition ────────────────────────────────────────
  const addSpacedReview = (review: Omit<SpacedReview, 'id'>): string => {
    // Duplicate prevention: if an active review for this topic exists, return its id
    if (hasActiveReviewForTopic(state.spacedReviews || [], review.syllabusTopicId)) {
      const existing = (state.spacedReviews || []).find(
        (r) => r.syllabusTopicId === review.syllabusTopicId && !r.isCompleted
      );
      if (existing) return existing.id;
    }

    const id = 'sr-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
    const newReview: SpacedReview = {
      ...review,
      id,
      repetitionLevel: review.repetitionLevel ?? 1,
      intervalDays: review.intervalDays ?? (state.reviewIntervals?.[0] ?? DEFAULT_REVIEW_INTERVALS[0]),
      isCompleted: false,
      history: review.history || [],
    };

    setState((prev) => ({
      ...prev,
      spacedReviews: [newReview, ...(prev.spacedReviews || [])],
    }));
    return id;
  };

  const updateSpacedReview = (id: string, updates: Partial<SpacedReview>) => {
    setState((prev) => ({
      ...prev,
      spacedReviews: (prev.spacedReviews || []).map((r) =>
        r.id === id ? { ...r, ...updates } : r
      ),
    }));
  };

  const deleteSpacedReview = (id: string) => {
    setState((prev) => ({
      ...prev,
      spacedReviews: (prev.spacedReviews || []).filter((r) => r.id !== id),
      tombstones: cloudSyncService.addTombstone(prev.tombstones, id, 'spacedReviews'),
    }));
  };

  const completeSpacedReview = (id: string) => {
    setState((prev) => {
      const review = (prev.spacedReviews || []).find((r) => r.id === id);
      if (!review) return prev;
      const updated = completeReviewStep(
        review,
        prev.reviewIntervals || DEFAULT_REVIEW_INTERVALS,
        new Date()
      );
      return {
        ...prev,
        spacedReviews: (prev.spacedReviews || []).map((r) => (r.id === id ? updated : r)),
      };
    });
  };

  const rescheduleSpacedReview = (id: string, newDueDate: string) => {
    updateSpacedReview(id, { dueDate: newDueDate });
  };

  const updateReviewIntervals = (intervals: number[]) => {
    setState((prev) => ({ ...prev, reviewIntervals: intervals }));
  };

  // ─── Milestone 5: Daily Questions ──────────────────────────────────────────
  const addDailyQuestionEntry = (entry: Omit<DailyQuestionEntry, 'id' | 'createdAt'>): string => {
    const id = 'dq-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
    const createdAt = new Date().toISOString();
    const newEntry: DailyQuestionEntry = {
      ...entry,
      id,
      createdAt,
    };
    setState((prev) => ({
      ...prev,
      dailyQuestions: [newEntry, ...(prev.dailyQuestions || [])],
    }));
    return id;
  };

  const updateDailyQuestionEntry = (id: string, updates: Partial<DailyQuestionEntry>) => {
    setState((prev) => ({
      ...prev,
      dailyQuestions: (prev.dailyQuestions || []).map((q) =>
        q.id === id ? { ...q, ...updates } : q
      ),
    }));
  };

  const deleteDailyQuestionEntry = (id: string) => {
    setState((prev) => ({
      ...prev,
      dailyQuestions: (prev.dailyQuestions || []).filter((q) => q.id !== id),
      tombstones: cloudSyncService.addTombstone(prev.tombstones, id, 'dailyQuestions'),
    }));
  };

  const setDailyQuestionTarget = (target: number) => {
    const safeTarget = Math.max(1, Math.round(target));
    setState((prev) => ({ ...prev, dailyQuestionTarget: safeTarget }));
  };

  // --- Milestone 7: Nutrition actions ---
  const addFoodDiaryEntry = (entry: Omit<FoodDiaryEntry, 'id' | 'lastEditedAt'>): string => {
    const id = 'fd-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
    const lastEditedAt = new Date().toISOString();
    const newEntry: FoodDiaryEntry = {
      ...entry,
      id,
      lastEditedAt,
    };
    setState((prev) => ({
      ...prev,
      foodDiaryEntries: [newEntry, ...(prev.foodDiaryEntries || [])],
    }));
    return id;
  };

  const addMultipleFoodDiaryEntries = (entries: Omit<FoodDiaryEntry, 'id' | 'lastEditedAt'>[]) => {
    if (!entries.length) return;
    const now = Date.now();
    const lastEditedAt = new Date().toISOString();
    const newEntries: FoodDiaryEntry[] = entries.map((entry, idx) => ({
      ...entry,
      id: 'fd-' + (now + idx) + '-' + Math.random().toString(36).slice(2, 7),
      lastEditedAt,
    }));
    setState((prev) => ({
      ...prev,
      foodDiaryEntries: [...newEntries, ...(prev.foodDiaryEntries || [])],
    }));
  };

  const updateFoodDiaryEntry = (id: string, updates: Partial<FoodDiaryEntry>) => {
    const lastEditedAt = new Date().toISOString();
    setState((prev) => ({
      ...prev,
      foodDiaryEntries: (prev.foodDiaryEntries || []).map((e) =>
        e.id === id ? { ...e, ...updates, lastEditedAt } : e
      ),
    }));
  };

  const deleteFoodDiaryEntry = (id: string) => {
    setState((prev) => ({
      ...prev,
      foodDiaryEntries: (prev.foodDiaryEntries || []).filter((e) => e.id !== id),
      tombstones: cloudSyncService.addTombstone(prev.tombstones, id, 'foodDiaryEntries'),
    }));
  };

  const addCustomFood = (food: Omit<CustomFood, 'id' | 'isCustom' | 'createdAt'>): string => {
    const id = 'cf-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
    const createdAt = new Date().toISOString();
    const newFood: CustomFood = {
      ...food,
      id,
      isCustom: true,
      createdAt,
    };
    setState((prev) => ({
      ...prev,
      customFoods: [newFood, ...(prev.customFoods || [])],
    }));
    return id;
  };

  const deleteCustomFood = (id: string) => {
    setState((prev) => ({
      ...prev,
      customFoods: (prev.customFoods || []).filter((f) => f.id !== id),
      tombstones: cloudSyncService.addTombstone(prev.tombstones, id, 'customFoods'),
    }));
  };

  const addRecipe = (recipe: Omit<Recipe, 'id' | 'createdAt'>): string => {
    const id = 'rec-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
    const createdAt = new Date().toISOString();
    const newRecipe: Recipe = {
      ...recipe,
      id,
      createdAt,
    };
    setState((prev) => ({
      ...prev,
      recipes: [newRecipe, ...(prev.recipes || [])],
    }));
    return id;
  };

  const deleteRecipe = (id: string) => {
    setState((prev) => ({
      ...prev,
      recipes: (prev.recipes || []).filter((r) => r.id !== id),
      tombstones: cloudSyncService.addTombstone(prev.tombstones, id, 'recipes'),
    }));
  };

  const logWeight = (weightKg: number, date?: string, notes?: string) => {
    const targetDate = date || new Date().toISOString().split('T')[0];
    const id = 'wt-' + targetDate;
    setState((prev) => {
      const existing = (prev.weightLogs || []).filter((w) => w.date !== targetDate);
      const newEntry: WeightLogEntry = {
        id,
        date: targetDate,
        weightKg: Number(weightKg.toFixed(1)),
        notes,
      };
      return {
        ...prev,
        weightLogs: [...existing, newEntry].sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        ),
      };
    });
  };

  const deleteWeightLog = (id: string) => {
    setState((prev) => ({
      ...prev,
      weightLogs: (prev.weightLogs || []).filter((w) => w.id !== id),
      tombstones: cloudSyncService.addTombstone(prev.tombstones, id, 'weightLogs'),
    }));
  };

  const updateNutritionProfile = (updates: Partial<NutritionProfile>) => {
    setState((prev) => {
      const current = prev.nutritionProfile || {
        goal: 'maintain',
        targetCalories: 2200,
        macroTargets: { calories: 2200, protein: 140, carbs: 260, fat: 65 },
        updatedAt: new Date().toISOString(),
      };
      const updatedProfile: NutritionProfile = {
        ...current,
        ...updates,
        updatedAt: new Date().toISOString(),
      };
      return {
        ...prev,
        nutritionProfile: updatedProfile,
      };
    });
  };

  // ── Milestone 8: Focus Radio ─────────────────────────────────────────────

  const addRadioUrl = (label: string, url: string): void => {
    const embedUrl = toYouTubeEmbedUrl(url);
    if (!embedUrl) return;
    const isPlaylist = isYouTubePlaylistUrl(url);
    const newEntry: RadioUrl = {
      id: `radio-${Date.now()}`,
      label: label.trim() || (isPlaylist ? 'My Playlist' : 'Station'),
      url,
      embedUrl,
      type: isPlaylist ? 'playlist' : 'video',
      addedAt: new Date().toISOString(),
    };
    setState((prev) => ({
      ...prev,
      radioUrls: [...(prev.radioUrls ?? []), newEntry],
    }));
  };

  const removeRadioUrl = (id: string): void => {
    setState((prev) => ({
      ...prev,
      radioUrls: (prev.radioUrls ?? []).filter((r) => r.id !== id),
      tombstones: cloudSyncService.addTombstone(prev.tombstones, id, 'radioUrls'),
    }));
  };

  const reorderRadioUrl = (id: string, direction: 'up' | 'down'): void => {
    setState((prev) => {
      const list = [...(prev.radioUrls ?? [])];
      const idx = list.findIndex((r) => r.id === id);
      if (idx < 0) return prev;
      const newIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (newIdx < 0 || newIdx >= list.length) return prev;
      [list[idx], list[newIdx]] = [list[newIdx], list[idx]];
      return { ...prev, radioUrls: list };
    });
  };

  const radioQueue = state.radioQueue ?? [];
  const radioLoopMode = state.radioLoopMode ?? 'off';
  const radioIsShuffle = state.radioIsShuffle ?? false;
  const customPlaylists = state.customPlaylists ?? [];
  const activeCustomPlaylist = customPlaylists.find((p) => p.id === activeCustomPlaylistId) ?? null;

  const activeRadioStation: RadioUrl | null = (() => {
    if (activeRadioSource === 'playlist' && activeCustomPlaylist) {
      if (activeCustomPlaylist.items.length > 0) {
        const idx =
          activeRadioIndex !== null && activeRadioIndex < activeCustomPlaylist.items.length
            ? activeRadioIndex
            : 0;
        const item = activeCustomPlaylist.items[idx];
        const allVideoIds = activeCustomPlaylist.items.map((it) => it.videoId);
        // Place the current track first in the playlist sequence
        const orderedIds = [item.videoId, ...allVideoIds.filter((id) => id !== item.videoId)];
        const embedUrl =
          buildCustomPlaylistEmbedUrl(orderedIds, {
            loopMode: radioLoopMode,
          }) || '';
        return {
          id: item.id,
          label: `${activeCustomPlaylist.name} — ${item.title}`,
          url: item.url,
          embedUrl,
          type: 'playlist',
          addedAt: item.addedAt,
        };
      }

      if (activeCustomPlaylist.youtubePlaylistUrl || activeCustomPlaylist.youtubePlaylistId) {
        const plUrl =
          activeCustomPlaylist.youtubePlaylistUrl ||
          `https://www.youtube.com/playlist?list=${activeCustomPlaylist.youtubePlaylistId}`;
        const embedUrl =
          toYouTubeEmbedUrlWithControls(plUrl, {
            loopMode: radioLoopMode,
            autoplay: true,
          }) || '';
        return {
          id: activeCustomPlaylist.id,
          label: activeCustomPlaylist.name,
          url: plUrl,
          embedUrl,
          type: 'playlist',
          addedAt: activeCustomPlaylist.createdAt,
        };
      }

      return null;
    }
    if (activeRadioIndex === null) return null;
    if (activeRadioSource === 'queue') {
      return radioQueue[activeRadioIndex] ?? null;
    }
    return (state.radioUrls ?? [])[activeRadioIndex] ?? null;
  })();

  const setActiveRadio = (
    index: number | null,
    source: 'stations' | 'queue' | 'playlist' = 'stations'
  ): void => {
    setActiveRadioIndex(index);
    setActiveRadioSource(source);
  };

  const addToRadioQueue = (item: { label: string; url: string; type?: 'video' | 'playlist' }): void => {
    const embedUrl = toYouTubeEmbedUrl(item.url);
    if (!embedUrl) return;
    const isPlaylist = isYouTubePlaylistUrl(item.url);
    const newEntry: RadioUrl = {
      id: `queue-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      label: item.label.trim() || (isPlaylist ? 'My Playlist' : 'Queued Track'),
      url: item.url,
      embedUrl,
      type: item.type ?? (isPlaylist ? 'playlist' : 'video'),
      addedAt: new Date().toISOString(),
    };
    setState((prev) => ({
      ...prev,
      radioQueue: [...(prev.radioQueue ?? []), newEntry],
    }));
  };

  const removeFromRadioQueue = (index: number): void => {
    setState((prev) => {
      const currentQueue = prev.radioQueue ?? [];
      const updated = currentQueue.filter((_, i) => i !== index);
      return { ...prev, radioQueue: updated };
    });
    if (activeRadioSource === 'queue') {
      if (activeRadioIndex === index) {
        setActiveRadioIndex(null);
      } else if (activeRadioIndex !== null && activeRadioIndex > index) {
        setActiveRadioIndex(activeRadioIndex - 1);
      }
    }
  };

  const clearRadioQueue = (): void => {
    setState((prev) => ({ ...prev, radioQueue: [] }));
    if (activeRadioSource === 'queue') {
      setActiveRadioIndex(null);
    }
  };

  const reorderRadioQueue = (fromIndex: number, toIndex: number): void => {
    setState((prev) => {
      const list = [...(prev.radioQueue ?? [])];
      if (fromIndex < 0 || fromIndex >= list.length || toIndex < 0 || toIndex >= list.length) {
        return prev;
      }
      const [moved] = list.splice(fromIndex, 1);
      list.splice(toIndex, 0, moved);
      return { ...prev, radioQueue: list };
    });
  };

  const cycleRadioLoopMode = (): void => {
    setState((prev) => {
      const cur = prev.radioLoopMode ?? 'off';
      const next: RadioLoopMode = cur === 'off' ? 'all' : cur === 'all' ? 'one' : 'off';
      return { ...prev, radioLoopMode: next };
    });
  };

  const setRadioLoopMode = (mode: RadioLoopMode): void => {
    setState((prev) => ({ ...prev, radioLoopMode: mode }));
  };

  const toggleRadioShuffle = (): void => {
    setState((prev) => ({ ...prev, radioIsShuffle: !prev.radioIsShuffle }));
  };

  const playNextTrack = (): void => {
    if (activeRadioSource === 'playlist' && activeCustomPlaylist) {
      const items = activeCustomPlaylist.items;
      if (items.length === 0) return;
      if (state.radioIsShuffle && items.length > 1) {
        const cur = activeRadioIndex ?? 0;
        let next = Math.floor(Math.random() * items.length);
        if (next === cur) next = (next + 1) % items.length;
        setActiveRadioIndex(next);
        return;
      }
      const cur = activeRadioIndex ?? 0;
      let next = cur + 1;
      if (next >= items.length) {
        next = 0;
      }
      setActiveRadioIndex(next);
      return;
    }

    const list = activeRadioSource === 'queue' ? (state.radioQueue ?? []) : (state.radioUrls ?? []);
    if (list.length === 0) return;

    if (state.radioIsShuffle && list.length > 1) {
      const cur = activeRadioIndex ?? 0;
      let next = Math.floor(Math.random() * list.length);
      if (next === cur) {
        next = (next + 1) % list.length;
      }
      setActiveRadioIndex(next);
      return;
    }

    const cur = activeRadioIndex ?? -1;
    let next = cur + 1;
    if (next >= list.length) {
      next = 0;
    }
    setActiveRadioIndex(next);
  };

  const playPrevTrack = (): void => {
    if (activeRadioSource === 'playlist' && activeCustomPlaylist) {
      const items = activeCustomPlaylist.items;
      if (items.length === 0) return;
      const cur = activeRadioIndex ?? 0;
      let prev = cur - 1;
      if (prev < 0) {
        prev = items.length - 1;
      }
      setActiveRadioIndex(prev);
      return;
    }

    const list = activeRadioSource === 'queue' ? (state.radioQueue ?? []) : (state.radioUrls ?? []);
    if (list.length === 0) return;

    const cur = activeRadioIndex ?? 0;
    let prev = cur - 1;
    if (prev < 0) {
      prev = list.length - 1;
    }
    setActiveRadioIndex(prev);
  };

  // ── Milestone 8: Custom Playlists ("Make My Own Playlist") ─────────────

  const createCustomPlaylist = (name: string, description?: string, youtubePlaylistUrl?: string): string => {
    const newId = `playlist-${Date.now()}`;
    const ytUrl = youtubePlaylistUrl?.trim();
    const ytId = ytUrl ? extractYouTubePlaylistId(ytUrl) || undefined : undefined;
    const isYt = Boolean(ytId || (ytUrl && (isYouTubePlaylistUrl(ytUrl) || isValidYouTubeUrl(ytUrl))));

    // If user provided a URL that has a video id, add it as a track
    const initialItems: CustomPlaylistItem[] = [];
    if (ytUrl) {
      const vId = extractYouTubeVideoId(ytUrl);
      if (vId) {
        initialItems.push({
          id: `track-${Date.now()}-0`,
          title: name.trim() || 'Track 1',
          url: ytUrl,
          videoId: vId,
          addedAt: new Date().toISOString(),
        });
      }
    }

    const newPl: CustomPlaylist = {
      id: newId,
      name: name.trim() || (ytId ? 'My YouTube Playlist' : 'My Focus Playlist'),
      description: description?.trim() || '',
      items: initialItems,
      createdAt: new Date().toISOString(),
      youtubePlaylistUrl: ytUrl || undefined,
      youtubePlaylistId: ytId,
      type: isYt ? 'youtube' : 'custom',
    };
    setState((prev) => ({
      ...prev,
      customPlaylists: [...(prev.customPlaylists ?? []), newPl],
    }));
    return newId;
  };

  const deleteCustomPlaylist = (playlistId: string): void => {
    setState((prev) => ({
      ...prev,
      customPlaylists: (prev.customPlaylists ?? []).filter((p) => p.id !== playlistId),
      tombstones: cloudSyncService.addTombstone(prev.tombstones, playlistId, 'customPlaylists'),
    }));
    if (activeRadioSource === 'playlist' && activeCustomPlaylistId === playlistId) {
      setActiveRadioIndex(null);
      setActiveCustomPlaylistId(null);
    }
  };

  const addTrackToCustomPlaylist = (
    playlistId: string,
    track: { title: string; url: string }
  ): boolean => {
    const videoId = extractYouTubeVideoId(track.url);
    const playlistIdMatch = extractYouTubePlaylistId(track.url);

    if (!videoId && !playlistIdMatch) return false;

    if (playlistIdMatch && !videoId) {
      // It's a pure playlist link added to this playlist
      setState((prev) => ({
        ...prev,
        customPlaylists: (prev.customPlaylists ?? []).map((p) => {
          if (p.id !== playlistId) return p;
          return {
            ...p,
            youtubePlaylistUrl: track.url,
            youtubePlaylistId: playlistIdMatch,
            type: 'youtube',
          };
        }),
      }));
      return true;
    }

    const newItem: CustomPlaylistItem = {
      id: `track-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: track.title.trim() || 'Focus Beat',
      url: track.url,
      videoId: videoId || 'dQw4w9WgXcQ',
      addedAt: new Date().toISOString(),
    };
    setState((prev) => ({
      ...prev,
      customPlaylists: (prev.customPlaylists ?? []).map((p) => {
        if (p.id !== playlistId) return p;
        return {
          ...p,
          items: [...p.items, newItem],
        };
      }),
    }));
    return true;
  };

  const removeTrackFromCustomPlaylist = (playlistId: string, trackId: string): void => {
    setState((prev) => ({
      ...prev,
      customPlaylists: (prev.customPlaylists ?? []).map((p) => {
        if (p.id !== playlistId) return p;
        return {
          ...p,
          items: p.items.filter((it) => it.id !== trackId),
        };
      }),
    }));
  };

  const reorderTrackInCustomPlaylist = (
    playlistId: string,
    fromIndex: number,
    toIndex: number
  ): void => {
    setState((prev) => ({
      ...prev,
      customPlaylists: (prev.customPlaylists ?? []).map((p) => {
        if (p.id !== playlistId) return p;
        const list = [...p.items];
        if (fromIndex < 0 || fromIndex >= list.length || toIndex < 0 || toIndex >= list.length) {
          return p;
        }
        const [moved] = list.splice(fromIndex, 1);
        list.splice(toIndex, 0, moved);
        return { ...p, items: list };
      }),
    }));
  };

  const playCustomPlaylist = (playlistId: string, shuffle = false): void => {
    const pl = (state.customPlaylists ?? []).find((p) => p.id === playlistId);
    if (!pl || (pl.items.length === 0 && !pl.youtubePlaylistUrl && !pl.youtubePlaylistId)) return;
    setActiveCustomPlaylistId(playlistId);
    setActiveRadioSource('playlist');
    if (shuffle) {
      setState((prev) => ({ ...prev, radioIsShuffle: true }));
      if (pl.items.length > 0) {
        const randomIdx = Math.floor(Math.random() * pl.items.length);
        setActiveRadioIndex(randomIdx);
      } else {
        setActiveRadioIndex(0);
      }
    } else {
      setActiveRadioIndex(0);
    }
  };

  const addPlaylistToRadioQueue = (playlistId: string): void => {
    const pl = (state.customPlaylists ?? []).find((p) => p.id === playlistId);
    if (!pl) return;
    if (pl.youtubePlaylistUrl) {
      addToRadioQueue({
        label: pl.name,
        url: pl.youtubePlaylistUrl,
        type: 'playlist',
      });
    } else if (pl.items.length > 0) {
      pl.items.forEach((item) => {
        addToRadioQueue({
          label: `${pl.name} — ${item.title}`,
          url: item.url,
          type: 'video',
        });
      });
    }
  };

  // ── Milestone 6: Mock-Test Analytics & Error Log ──────────────────────────

  const addMockTest = (test: Omit<MockTest, 'id' | 'createdAt'>): string => {
    const id = `test-${Date.now()}`;
    const newTest: MockTest = {
      ...test,
      id,
      createdAt: new Date().toISOString(),
    };
    setState((prev) => ({
      ...prev,
      mockTests: [newTest, ...(prev.mockTests || [])],
    }));
    return id;
  };

  const updateMockTest = (id: string, updates: Partial<MockTest>): void => {
    setState((prev) => ({
      ...prev,
      mockTests: (prev.mockTests || []).map((t) => (t.id === id ? { ...t, ...updates } : t)),
    }));
  };

  const deleteMockTest = (id: string): void => {
    setState((prev) => ({
      ...prev,
      mockTests: (prev.mockTests || []).filter((t) => t.id !== id),
      tombstones: cloudSyncService.addTombstone(prev.tombstones, id, 'mockTests'),
    }));
  };

  const addErrorLogEntry = (entry: Omit<ErrorLogEntry, 'id' | 'createdAt' | 'reviewedCount'>): string => {
    const id = `err-${Date.now()}`;
    const newEntry: ErrorLogEntry = {
      ...entry,
      id,
      reviewedCount: 0,
      resolved: entry.resolved ?? false,
      createdAt: new Date().toISOString(),
    };
    setState((prev) => ({
      ...prev,
      errorLogs: [newEntry, ...(prev.errorLogs || [])],
    }));
    return id;
  };

  const updateErrorLogEntry = (id: string, updates: Partial<ErrorLogEntry>): void => {
    setState((prev) => ({
      ...prev,
      errorLogs: (prev.errorLogs || []).map((e) => (e.id === id ? { ...e, ...updates } : e)),
    }));
  };

  const deleteErrorLogEntry = (id: string): void => {
    setState((prev) => ({
      ...prev,
      errorLogs: (prev.errorLogs || []).filter((e) => e.id !== id),
      tombstones: cloudSyncService.addTombstone(prev.tombstones, id, 'errorLogs'),
    }));
  };

  const resolveErrorLogEntry = (id: string, resolved: boolean = true): void => {
    setState((prev) => ({
      ...prev,
      errorLogs: (prev.errorLogs || []).map((e) => {
        if (e.id !== id) return e;
        return {
          ...e,
          resolved,
          reviewedCount: (e.reviewedCount || 0) + (resolved ? 1 : 0),
          lastReviewedAt: resolved ? new Date().toISOString() : e.lastReviewedAt,
        };
      }),
    }));
  };

  const convertErrorToPlannerTask = (errorId: string): { success: boolean; taskId?: string; message?: string } => {
    const error = (state.errorLogs || []).find((e) => e.id === errorId);
    if (!error) {
      return { success: false, message: 'Error log entry not found' };
    }

    // Duplicate detection: check if a planner task already links to this error
    const existingTask = (state.tasks || []).find((t) => t.errorLogId === errorId);
    if (existingTask) {
      return {
        success: false,
        taskId: existingTask.id,
        message: 'A revision task for this error already exists in the Study Planner',
      };
    }

    const taskId = `task-${Date.now()}`;
    const subject = (state.syllabusSubjects || []).find((s) => s.id === error.subjectId);
    const subjectName = subject?.name || 'Subject';
    const notesContent = [
      `Classification: ${error.errorType.toUpperCase()}`,
      error.description ? `Mistake: ${error.description}` : '',
      error.correctApproach ? `Correct Approach: ${error.correctApproach}` : '',
    ].filter(Boolean).join('\n');

    const newTask: PlannerTask = {
      id: taskId,
      title: `Fix Error: ${error.title} (${subjectName})`,
      description: error.description || undefined,
      status: 'todo',
      priority: 'high',
      subjectId: error.subjectId,
      syllabusSubjectId: error.subjectId,
      syllabusChapterId: error.syllabusChapterId,
      syllabusTopicId: error.syllabusTopicId,
      dueDate: new Date().toISOString().split('T')[0],
      estimatedDuration: 30,
      notes: notesContent,
      errorLogId: error.id,
      createdAt: new Date().toISOString(),
    };

    setState((prev) => ({
      ...prev,
      tasks: [newTask, ...(prev.tasks || [])],
      errorLogs: (prev.errorLogs || []).map((e) =>
        e.id === errorId
          ? {
              ...e,
              reviewedCount: (e.reviewedCount || 0) + 1,
              lastReviewedAt: new Date().toISOString(),
            }
          : e
      ),
    }));

    return {
      success: true,
      taskId,
      message: 'Successfully scheduled high-priority revision task in Study Planner',
    };
  };

  // ── Milestone 8: Full Reset ──────────────────────────────────────────────

  const fullReset = (): void => {
    localStorage.removeItem(STORAGE_KEY_V2);
    localStorage.removeItem('tracker_app_data_v1');
    localStorage.removeItem('tracker_active_focus_timer');
    setState(storageService.loadData());
    setActiveRadioIndex(null);
  };

  return (
    <AppContext.Provider
      value={{
        state,
        markAttendance,
        markAttendanceForEvent,
        logStudySession,
        deleteStudySession,
        toggleGymSet,
        toggleGymWorkoutComplete,
        startTodayWorkout,
        addGymExercise,
        toggleReminder,
        addReminder,
        deleteReminder,
        addSubject,
        clearSampleData,
        restoreSampleData,
        exportData,
        importData,
        updateProfile,
        updateSettings,
        // Syllabus actions
        addSyllabusSubject,
        updateSyllabusSubject,
        deleteSyllabusSubject,
        addChapter,
        updateChapter,
        deleteChapter,
        addSubtopic,
        updateSubtopic,
        deleteSubtopic,
        setTopicStatus,
        incrementRevision,
        // Timetable & Calendar actions
        addTimetableSlot,
        updateTimetableSlot,
        deleteTimetableSlot,
        importTimetableClasses,
        // Occurrence overrides
        rescheduleOccurrence,
        cancelOccurrence,
        restoreOccurrence,
        // Extra classes
        addExtraClass,
        deleteExtraClass,
        // Syllabus import
        importSyllabus,
        // Attendance requirement
        getAttendanceReq,
        // Milestone 5: Tasks
        addTask,
        updateTask,
        deleteTask,
        setTaskStatus,
        toggleTaskSubtask,
        // Milestone 5: Spaced Repetition
        addSpacedReview,
        updateSpacedReview,
        deleteSpacedReview,
        completeSpacedReview,
        rescheduleSpacedReview,
        updateReviewIntervals,
        // Milestone 5: Daily Questions
        addDailyQuestionEntry,
        updateDailyQuestionEntry,
        deleteDailyQuestionEntry,
        setDailyQuestionTarget,
        // Milestone 7: Nutrition actions
        addFoodDiaryEntry,
        addMultipleFoodDiaryEntries,
        updateFoodDiaryEntry,
        deleteFoodDiaryEntry,
        addCustomFood,
        deleteCustomFood,
        addRecipe,
        deleteRecipe,
        logWeight,
        deleteWeightLog,
        updateNutritionProfile,
        // Milestone 8: Focus Radio, Queue, Loop & Shuffle
        addRadioUrl,
        removeRadioUrl,
        reorderRadioUrl,
        radioQueue,
        radioLoopMode,
        radioIsShuffle,
        activeRadioStation,
        activeRadioIndex,
        activeRadioSource,
        setActiveRadio,
        addToRadioQueue,
        removeFromRadioQueue,
        clearRadioQueue,
        reorderRadioQueue,
        cycleRadioLoopMode,
        setRadioLoopMode,
        toggleRadioShuffle,
        playNextTrack,
        playPrevTrack,
        // Milestone 8: Custom Playlists ("Make My Own Playlist")
        customPlaylists,
        activeCustomPlaylistId,
        createCustomPlaylist,
        deleteCustomPlaylist,
        addTrackToCustomPlaylist,
        removeTrackFromCustomPlaylist,
        reorderTrackInCustomPlaylist,
        playCustomPlaylist,
        addPlaylistToRadioQueue,
        // Milestone 6: Mock-Test Analytics & Error Log
        addMockTest,
        updateMockTest,
        deleteMockTest,
        addErrorLogEntry,
        updateErrorLogEntry,
        deleteErrorLogEntry,
        resolveErrorLogEntry,
        convertErrorToPlannerTask,
        // Events & Tasks Calendar Planner
        events: state.events || [],
        addEvent,
        updateEvent,
        deleteEvent,
        toggleEventComplete,
        toggleEventSubtask,
        fullReset,
        // Google Auth & Cloud Sync
        authUser,
        syncStatus,
        lastSyncedAt,
        signInWithGoogle,
        signOut,
        syncNow,
      }}
    >
      {conflictData && (
        <SyncConflictModal
          isOpen={Boolean(conflictData)}
          userEmail={authUser?.email || 'User'}
          localData={state}
          cloudData={conflictData.cloudRecord.data}
          cloudUpdatedAt={conflictData.cloudRecord.updatedAt}
          onKeepLocal={handleKeepLocal}
          onLoadCloud={handleLoadCloud}
          onMergeBoth={handleMergeBoth}
          onCancel={handleCancelConflict}
        />
      )}
      {children}
    </AppContext.Provider>
  );
};

export const useApp = (): AppContextType => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};

export const useOptionalApp = (): AppContextType | undefined => {
  return useContext(AppContext);
};















































