import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  ClassSpaceWorkspace,
  ClassSpaceMember,
  ClassSpaceRole,
  ClassSpaceChannel,
  ClassJoinRequest,
  ClassJoinRequestStatus,
  ClassTimetableRule,
  ClassTimetableOverride,
  ResolvedClassOccurrence,
  ClassAttendanceRecord,
  ClassMessage,
  ClassResourceCategory,
  ClassSavedMessage,
  ClassNotification,
  ClassUserProfile,
} from '../types/classSpace';
import { classSpaceService } from '../services/classSpaceService';
import { resolveClassSchedule, canManageSchedule, canModerate, canManageWorkspace, canPublishNotice } from '../utils/classSpaceUtils';
import { useApp } from './AppContext';
import { AuthUser } from '../services/authService';
import { AcademicCalendarSettings } from '../types';

// ─── Workspace and Channel Persistence Keys & Helpers ────────────────────────
export const ACTIVE_WORKSPACE_STORAGE_KEY = 'tracker_active_workspace_id';

export const getActiveWorkspaceStorageKey = (userId?: string | null): string =>
  userId && userId !== 'usr_local_student'
    ? `tracker_active_workspace_id_${userId}`
    : ACTIVE_WORKSPACE_STORAGE_KEY;

export const getActiveChannelStorageKey = (workspaceId: string): string =>
  `tracker_active_channel_${workspaceId}`;

export function getSavedWorkspaceId(userId?: string | null): string | null {
  try {
    if (typeof window === 'undefined') return null;
    if (userId && userId !== 'usr_local_student') {
      const userKey = getActiveWorkspaceStorageKey(userId);
      const userVal = localStorage.getItem(userKey);
      if (userVal) return userVal;
    }
    return localStorage.getItem(ACTIVE_WORKSPACE_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function saveActiveWorkspaceId(workspaceId: string | null, userId?: string | null): void {
  try {
    if (typeof window === 'undefined') return;
    if (workspaceId) {
      localStorage.setItem(ACTIVE_WORKSPACE_STORAGE_KEY, workspaceId);
      if (userId && userId !== 'usr_local_student') {
        localStorage.setItem(getActiveWorkspaceStorageKey(userId), workspaceId);
      }
    } else {
      localStorage.removeItem(ACTIVE_WORKSPACE_STORAGE_KEY);
      if (userId && userId !== 'usr_local_student') {
        localStorage.removeItem(getActiveWorkspaceStorageKey(userId));
      }
    }
  } catch {}
}

export function getSavedChannelId(workspaceId: string): string | null {
  try {
    if (typeof window === 'undefined' || !workspaceId) return null;
    return localStorage.getItem(getActiveChannelStorageKey(workspaceId));
  } catch {
    return null;
  }
}

export function saveActiveChannelId(workspaceId: string, channelId: string | null): void {
  try {
    if (typeof window === 'undefined' || !workspaceId) return;
    if (channelId) {
      localStorage.setItem(getActiveChannelStorageKey(workspaceId), channelId);
    } else {
      localStorage.removeItem(getActiveChannelStorageKey(workspaceId));
    }
  } catch {}
}

interface ClassSpaceContextType {
  // Workspaces
  workspaces: ClassSpaceWorkspace[];
  activeWorkspace: ClassSpaceWorkspace | null;
  currentMember: ClassSpaceMember | null;
  members: ClassSpaceMember[];
  isLoading: boolean;
  isCloudConfigured: boolean;

  // Channels
  channels: ClassSpaceChannel[];
  activeChannel: ClassSpaceChannel | null;
  activeChannelId: string;
  setActiveChannelId: (channelId: string) => void;
  createChannel: (name: string, description?: string) => Promise<{ channel?: ClassSpaceChannel; error?: string }>;
  deleteChannel: (channelId: string) => Promise<{ success: boolean; error?: string }>;

  // Join Requests
  joinRequests: ClassJoinRequest[];
  requestToJoinWorkspace: (code: string) => Promise<{
    status?: ClassJoinRequestStatus;
    workspace?: ClassSpaceWorkspace;
    request?: ClassJoinRequest;
    message?: string;
    error?: string;
  }>;
  reviewJoinRequest: (requestId: string, action: 'approve' | 'reject') => Promise<{ success: boolean; error?: string }>;
  updateWorkspaceAcademicCalendar: (calendar: AcademicCalendarSettings) => Promise<{ success: boolean; error?: string }>;

  // Roles & Permissions
  isOwner: boolean;
  isCR: boolean;
  isCoAdmin: boolean;
  canPublishNotices: boolean;
  canEditSchedule: boolean;
  canModerateChat: boolean;
  canManageWorkspace: boolean;
  transferCRRole: (targetUserId: string, previousCRNewRole?: 'co_admin' | 'member') => Promise<{ success: boolean; error?: string }>;
  updateCoAdminNoticePermission: (targetUserId: string, canPublish: boolean) => Promise<{ success: boolean; error?: string }>;

  // Official Timetable & Occurrences
  rules: ClassTimetableRule[];
  overrides: ClassTimetableOverride[];
  occurrences: ResolvedClassOccurrence[];
  scheduleRange: { start: Date; end: Date };
  setScheduleRange: (range: { start: Date; end: Date }) => void;

  // Personal Attendance (linked to official occurrences)
  attendanceRecords: ClassAttendanceRecord[];
  attendanceStats: {
    attended: number;
    totalConducted: number;
    percentage: number;
    targetPercentage: number;
  };

  // Community Chat
  messages: ClassMessage[];
  savedMessages: ClassSavedMessage[];
  pinnedMessages: ClassMessage[];

  // Notifications
  notifications: ClassNotification[];
  unreadNotificationCount: number;

  // Profile
  profile: ClassUserProfile | null;

  // Workspace Actions
  selectWorkspace: (workspaceId: string) => void;
  createWorkspace: (details: {
    name: string;
    institution?: string;
    college?: string;
    department?: string;
    section?: string;
    batch?: string;
    description?: string;
  }) => Promise<{ workspace?: ClassSpaceWorkspace; error?: string }>;
  joinWorkspaceByCode: (code: string) => Promise<{ workspace?: ClassSpaceWorkspace; error?: string }>;
  rotateJoinCode: () => Promise<{ newCode?: string; error?: string }>;
  leaveWorkspace: () => Promise<{ success: boolean; error?: string }>;
  deleteWorkspace: () => Promise<{ success: boolean; error?: string }>;

  // Member Management Actions
  updateMemberRole: (targetUserId: string, newRole: ClassSpaceRole) => Promise<{ success: boolean; error?: string }>;
  removeMember: (targetUserId: string) => Promise<{ success: boolean; error?: string }>;

  // Timetable Actions
  addTimetableRule: (rule: Omit<ClassTimetableRule, 'id' | 'workspaceId' | 'createdAt' | 'updatedAt' | 'createdBy'>) => Promise<{ error?: string }>;
  updateTimetableRule: (ruleId: string, updates: Partial<ClassTimetableRule>) => Promise<{ error?: string }>;
  deleteTimetableRule: (ruleId: string) => Promise<{ error?: string }>;
  rescheduleOccurrence: (params: {
    ruleId: string;
    originalDate: string;
    newDate: string;
    newStartTime?: string;
    newEndTime?: string;
    newRoom?: string;
    newNotes?: string;
    changeNote?: string;
  }) => Promise<{ error?: string }>;
  cancelOccurrence: (params: {
    ruleId: string;
    originalDate: string;
    changeNote?: string;
  }) => Promise<{ error?: string }>;
  restoreOccurrence: (overrideId: string) => Promise<{ error?: string }>;
  addExtraClass: (params: {
    subjectName: string;
    subjectCode: string;
    subjectColor: string;
    date: string;
    startTime: string;
    endTime: string;
    room?: string;
    notes?: string;
    changeNote?: string;
  }) => Promise<{ error?: string }>;
  copyOfficialScheduleToPersonal: () => void;

  // Attendance Actions
  markAttendance: (occurrenceKey: string, date: string, status: 'present' | 'absent' | 'cancelled') => Promise<void>;

  // Community Chat Actions
  sendMessage: (
    content: string,
    optionsOrReply?:
      | {
          id: string;
          content: string;
          senderName: string;
        }
      | {
          replyTo?: { id: string; content: string; senderName: string };
          isAnnouncement?: boolean;
          isPinned?: boolean;
          channelId?: string;
        }
  ) => Promise<{ error?: string }>;
  createPoll: (
    question: string,
    options: string[],
    allowMultipleAnswers: boolean,
    isAnonymous?: boolean
  ) => Promise<{ error?: string }>;
  votePoll: (messageId: string, optionId: string) => Promise<{ error?: string }>;
  closePoll: (messageId: string) => Promise<{ error?: string }>;
  shareResource: (
    title: string,
    url: string,
    category: ClassResourceCategory,
    description?: string
  ) => Promise<{ error?: string }>;
  addReaction: (messageId: string, emoji: string) => Promise<void>;
  removeReaction: (messageId: string, emoji: string) => Promise<void>;
  editMessage: (messageId: string, newContent: string) => Promise<{ error?: string }>;
  deleteMessage: (messageId: string) => Promise<{ error?: string }>;
  togglePinMessage: (messageId: string) => Promise<{ error?: string }>;
  toggleSaveMessage: (messageId: string) => Promise<void>;

  // Notifications Actions
  markNotificationRead: (notificationId: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;

  // Profile Actions
  updateProfile: (updates: Partial<ClassUserProfile>) => Promise<{ error?: string }>;
  uploadAvatar: (file: File) => Promise<{ avatarUrl?: string; error?: string }>;
}

export const ClassSpaceContext = createContext<ClassSpaceContextType | undefined>(undefined);

export const useOptionalClassSpace = () => useContext(ClassSpaceContext);

export const ClassSpaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { authUser, isAuthHydrated, state: appState, addSubject, markAttendanceForEvent, updateSettings } = useApp();

  const userModeRef = useRef(appState.settings?.userMode);
  useEffect(() => {
    userModeRef.current = appState.settings?.userMode;
  }, [appState.settings?.userMode]);

  // Active student identity (syncs with user profile email, display name, and avatar)
  const effectiveUser: AuthUser = useMemo(() => {
    const profileEmail = appState.profile?.email?.trim();
    const profileName = appState.profile?.displayName?.trim();
    const profileAvatar = appState.profile?.avatarUrl;

    if (authUser) {
      return {
        ...authUser,
        email: profileEmail || authUser.email,
        name: profileName || authUser.name || 'Scholar Student',
        avatarUrl: profileAvatar || authUser.avatarUrl,
      };
    }

    return {
      id: 'usr_local_student',
      email: profileEmail || 'student@tracker.local',
      name: profileName || 'Student',
      avatarUrl: profileAvatar,
      isSimulated: true,
    };
  }, [authUser, appState.profile]);

  const [workspaces, setWorkspaces] = useState<ClassSpaceWorkspace[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<ClassSpaceWorkspace | null>(null);
  const [members, setMembers] = useState<ClassSpaceMember[]>([]);
  const [channels, setChannels] = useState<ClassSpaceChannel[]>([]);
  const [activeChannelId, setActiveChannelId] = useState<string>('');
  const [joinRequests, setJoinRequests] = useState<ClassJoinRequest[]>([]);
  const [rules, setRules] = useState<ClassTimetableRule[]>([]);
  const [overrides, setOverrides] = useState<ClassTimetableOverride[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<ClassAttendanceRecord[]>([]);
  const [messages, setMessages] = useState<ClassMessage[]>([]);
  const [savedMessages, setSavedMessages] = useState<ClassSavedMessage[]>([]);
  const [notifications, setNotifications] = useState<ClassNotification[]>([]);
  const [profile, setProfile] = useState<ClassUserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Active channel derived state
  const activeChannel = useMemo(() => {
    if (!channels || channels.length === 0) return null;
    return channels.find((c) => c.id === activeChannelId) || channels[0] || null;
  }, [channels, activeChannelId]);

  // Default calendar viewing range: current month +/- 1 week
  const [scheduleRange, setScheduleRange] = useState<{ start: Date; end: Date }>(() => {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    start.setDate(start.getDate() - 7);
    const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    end.setDate(end.getDate() + 7);
    return { start, end };
  });

  // Current membership record in the active workspace
  const currentMember = useMemo(() => {
    if (!activeWorkspace) return null;
    const mem = members.find((m) => m.userId === effectiveUser.id);
    if (!mem) return null;
    return {
      ...mem,
      displayName: effectiveUser.name || mem.displayName,
      email: effectiveUser.email || mem.email,
      avatarUrl: effectiveUser.avatarUrl || mem.avatarUrl,
    };
  }, [activeWorkspace, members, effectiveUser]);

  const isOwner = currentMember?.role === 'owner' || (Boolean(activeWorkspace && activeWorkspace.createdBy === effectiveUser.id));
  const isCR = currentMember?.role === 'cr' || isOwner;
  const isCoAdmin = currentMember?.role === 'co_admin';
  const canPublishNotices = canPublishNotice(currentMember?.role, currentMember?.canPublishNotices) || isOwner;
  const canEditSchedule = canManageSchedule(currentMember?.role) || isOwner;
  const canModerateChat = canModerate(currentMember?.role) || isOwner;
  const canManageWs = canManageWorkspace(currentMember?.role) || isOwner;

  // 1. Fetch user's workspaces and profile with stable state guards
  const refreshWorkspaces = useCallback(async () => {
    // Wait for auth hydration so temporary local user does not wipe active workspace
    if (!isAuthHydrated) return;
    setIsLoading(true);
    try {
      const userWorkspaces = await classSpaceService.getWorkspacesForUser(effectiveUser.id);

      setWorkspaces((prev) => {
        if (
          prev.length === userWorkspaces.length &&
          prev.every((w, i) => w.id === userWorkspaces[i]?.id && w.updatedAt === userWorkspaces[i]?.updatedAt)
        ) {
          return prev;
        }
        return userWorkspaces;
      });

      if (userWorkspaces.length > 0) {
        const savedWsId = getSavedWorkspaceId(effectiveUser.id);

        setActiveWorkspace((prev) => {
          // If previous active workspace is still present and valid, maintain exact reference
          if (prev) {
            const current = userWorkspaces.find((w) => w.id === prev.id);
            if (current) {
              if (
                prev.name === current.name &&
                prev.joinCode === current.joinCode &&
                prev.updatedAt === current.updatedAt
              ) {
                return prev;
              }
              saveActiveWorkspaceId(current.id, effectiveUser.id);
              return current;
            }
          }
          if (savedWsId) {
            const found = userWorkspaces.find((w) => w.id === savedWsId);
            if (found) {
              saveActiveWorkspaceId(found.id, effectiveUser.id);
              return found;
            }
          }
          const fallback = userWorkspaces[0];
          saveActiveWorkspaceId(fallback.id, effectiveUser.id);
          return fallback;
        });

        if (userModeRef.current !== 'class_based') {
          updateSettings({ userMode: 'class_based' });
        }
      } else {
        setActiveWorkspace(null);
        if (authUser && !effectiveUser.isSimulated) {
          saveActiveWorkspaceId(null, effectiveUser.id);
        }
      }

      const p = await classSpaceService.getUserProfile(effectiveUser.id);
      setProfile((prev) => {
        if (
          prev &&
          prev.userId === p.userId &&
          prev.displayName === p.displayName &&
          prev.avatarUrl === p.avatarUrl
        ) {
          return prev;
        }
        return p;
      });
    } catch (err) {
      console.warn('[ClassSpaceContext] Error loading workspaces:', err);
    } finally {
      setIsLoading(false);
    }
  }, [effectiveUser.id, isAuthHydrated, authUser, effectiveUser.isSimulated, updateSettings]);

  useEffect(() => {
    refreshWorkspaces();
  }, [refreshWorkspaces]);

  // 2. Refresh active workspace's data
  const refreshWorkspaceData = useCallback(async () => {
    if (!activeWorkspace?.id) {
      setMembers([]);
      setChannels([]);
      setJoinRequests([]);
      setRules([]);
      setOverrides([]);
      setAttendanceRecords([]);
      setMessages([]);
      setSavedMessages([]);
      setNotifications([]);
      return;
    }

    try {
      const [
        memberList,
        schedData,
        attRecords,
        msgList,
        savedList,
        notifList,
        channelList,
        reqList,
      ] = await Promise.all([
        classSpaceService.getMembers(activeWorkspace.id),
        classSpaceService.getScheduleData(activeWorkspace.id),
        classSpaceService.getAttendanceRecords(activeWorkspace.id, effectiveUser.id),
        classSpaceService.getMessages(activeWorkspace.id),
        classSpaceService.getSavedMessages(activeWorkspace.id, effectiveUser.id),
        classSpaceService.getNotifications(activeWorkspace.id, effectiveUser.id),
        classSpaceService.getChannels(activeWorkspace.id),
        classSpaceService.getJoinRequests(activeWorkspace.id),
      ]);

      setMembers(memberList);
      setRules(schedData.rules);
      setOverrides(schedData.overrides);
      setAttendanceRecords(attRecords);
      setMessages(msgList);
      setSavedMessages(savedList);
      setNotifications(notifList);
      setJoinRequests(reqList);

      setChannels((prev) => {
        if (
          prev.length === channelList.length &&
          prev.every((c, i) => c.id === channelList[i]?.id && c.name === channelList[i]?.name && c.slug === channelList[i]?.slug)
        ) {
          return prev;
        }
        return channelList;
      });

      // Channel resolution order:
      // 1. URL hash channel slug if present (e.g. #classspace/study-vault)
      // 2. Active channel currently in state if valid in this workspace
      // 3. Persisted channel ID for this workspace from localStorage
      // 4. Default 'the-commons' channel or channelList[0]
      const hashChannelSlug = typeof window !== 'undefined'
        ? window.location.hash.replace(/^#\/?/, '').split('/')[1]?.toLowerCase()
        : null;

      const fromHash = hashChannelSlug
        ? channelList.find((c) => c.slug === hashChannelSlug || c.id === hashChannelSlug)
        : null;

      const savedChanId = getSavedChannelId(activeWorkspace.id);
      const fromStorage = savedChanId
        ? channelList.find((c) => c.id === savedChanId || c.slug === savedChanId)
        : null;

      setActiveChannelId((prev) => {
        if (fromHash) {
          if (fromHash.id !== prev) {
            saveActiveChannelId(activeWorkspace.id, fromHash.id);
          }
          return fromHash.id;
        }
        if (prev && channelList.some((c) => c.id === prev)) {
          return prev;
        }
        if (fromStorage) {
          if (fromStorage.id !== prev) {
            saveActiveChannelId(activeWorkspace.id, fromStorage.id);
          }
          return fromStorage.id;
        }
        const fallbackId = channelList[0]?.id || '';
        if (fallbackId && fallbackId !== prev) {
          saveActiveChannelId(activeWorkspace.id, fallbackId);
        }
        return fallbackId;
      });
    } catch (err) {
      console.warn('[ClassSpaceContext] Error refreshing active workspace data:', err);
    }
  }, [activeWorkspace?.id, effectiveUser.id]);

  const refreshWorkspaceDataRef = useRef(refreshWorkspaceData);
  refreshWorkspaceDataRef.current = refreshWorkspaceData;

  const handleSetActiveChannelId = useCallback((channelId: string) => {
    setActiveChannelId(channelId);
    if (activeWorkspace) {
      saveActiveChannelId(activeWorkspace.id, channelId);
      // Synchronize URL hash with the selected channel slug if currently on classspace route
      if (typeof window !== 'undefined' && !window.location.hash.includes('=')) {
        const targetChan = channels.find((c) => c.id === channelId);
        const slug = targetChan?.slug || channelId;
        window.history.replaceState(null, '', `#classspace/${slug}`);
      }
    }
  }, [activeWorkspace, channels]);

  useEffect(() => {
    refreshWorkspaceData();
  }, [refreshWorkspaceData]);

  // 3. Realtime subscription for active workspace (depends strictly on workspace ID to prevent subscription thrashing)
  useEffect(() => {
    if (!activeWorkspace?.id) return;
    const wsId = activeWorkspace.id;
    const unsubscribe = classSpaceService.subscribeToWorkspace(wsId, () => {
      refreshWorkspaceDataRef.current?.();
    });
    return () => unsubscribe();
  }, [activeWorkspace?.id]);

  // Resolved occurrences for the current date range
  const occurrences = useMemo(() => {
    return resolveClassSchedule(rules, overrides, scheduleRange.start, scheduleRange.end);
  }, [rules, overrides, scheduleRange]);

  // Unread notifications count
  const unreadNotificationCount = useMemo(() => {
    return notifications.filter((n) => !n.isRead).length;
  }, [notifications]);

  // Pinned messages for quick announcement banner
  const pinnedMessages = useMemo(() => {
    return messages.filter((m) => m.isPinned && !m.isDeleted);
  }, [messages]);

  // Attendance stats for active workspace
  const attendanceStats = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    // Past or today occurrences that are not cancelled
    const pastHeldOccurrences = occurrences.filter((occ) => occ.date <= todayStr && !occ.isCancelled);

    const attendedCount = attendanceRecords.filter((rec) => rec.status === 'present').length;
    // Conducted count is total held occurrences (or total logged classes, whichever is higher)
    const conductedCount = Math.max(pastHeldOccurrences.length, attendanceRecords.length, 1);
    const percentage = Math.round((attendedCount / conductedCount) * 100);

    return {
      attended: attendedCount,
      totalConducted: conductedCount,
      percentage,
      targetPercentage: appState.settings?.attendanceRequirement || 75,
    };
  }, [occurrences, attendanceRecords, appState.settings?.attendanceRequirement]);

  // ==========================================================================
  // ACTIONS
  // ==========================================================================

  const selectWorkspace = (wsId: string) => {
    const target = workspaces.find((w) => w.id === wsId);
    if (target) {
      setActiveWorkspace(target);
      saveActiveWorkspaceId(target.id, effectiveUser.id);
      if (appState.settings?.userMode !== 'class_based') {
        updateSettings({ userMode: 'class_based' });
      }
    }
  };

  const createWorkspace = async (details: {
    name: string;
    institution?: string;
    college?: string;
    department?: string;
    section?: string;
    batch?: string;
    description?: string;
  }) => {
    const res = await classSpaceService.createWorkspace(effectiveUser, details);
    if (res.workspace) {
      setWorkspaces((prev) => [...prev, res.workspace!]);
      setActiveWorkspace(res.workspace);
      saveActiveWorkspaceId(res.workspace.id, effectiveUser.id);
      if (appState.settings?.userMode !== 'class_based') {
        updateSettings({ userMode: 'class_based' });
      }
      if (res.member) {
        setMembers([res.member]);
      }
    }
    return res;
  };

  const joinWorkspaceByCode = async (code: string) => {
    const res = await classSpaceService.joinWorkspaceByCode(effectiveUser, code);
    if (res.workspace) {
      setWorkspaces((prev) => {
        if (prev.some((w) => w.id === res.workspace!.id)) return prev;
        return [...prev, res.workspace!];
      });
      setActiveWorkspace(res.workspace);
      saveActiveWorkspaceId(res.workspace.id, effectiveUser.id);
      if (appState.settings?.userMode !== 'class_based') {
        updateSettings({ userMode: 'class_based' });
      }
    }
    return res;
  };

  const rotateJoinCode = async () => {
    if (!activeWorkspace) return { error: 'No active ClassSpace selected.' };
    const res = await classSpaceService.rotateJoinCode(activeWorkspace.id, effectiveUser.id);
    if (res.newCode) {
      setActiveWorkspace((prev) => (prev ? { ...prev, joinCode: res.newCode! } : null));
      setWorkspaces((prev) =>
        prev.map((w) => (w.id === activeWorkspace.id ? { ...w, joinCode: res.newCode! } : w))
      );
    }
    return res;
  };

  const updateWorkspaceAcademicCalendar = async (calendar: AcademicCalendarSettings) => {
    if (!activeWorkspace) return { success: false, error: 'No active ClassSpace selected.' };
    const res = await classSpaceService.updateWorkspaceAcademicCalendar(activeWorkspace.id, calendar);
    if (res.success) {
      setActiveWorkspace((prev) => (prev ? { ...prev, academicCalendar: calendar } : null));
      setWorkspaces((prev) =>
        prev.map((w) => (w.id === activeWorkspace.id ? { ...w, academicCalendar: calendar } : w))
      );
    }
    return res;
  };

  const leaveWorkspace = async () => {
    if (!activeWorkspace) return { success: false, error: 'No active ClassSpace selected.' };

    // Migrate attendance records from active workspace into personal tracker before leaving
    // so historical academic attendance records are permanently retained in personal logs
    if (attendanceRecords.length > 0) {
      for (const rec of attendanceRecords) {
        const rule = rules.find((r) => rec.occurrenceKey.startsWith(r.id));
        const override = overrides.find((o) => o.id === rec.occurrenceKey);
        const subjName = rule?.subjectName || override?.subjectName || 'Class';
        const subjCode = rule?.subjectCode || override?.subjectCode || 'CLS';
        const subjColor = rule?.subjectColor || override?.subjectColor || '#C45532';

        const existingSubj = appState.subjects.find((s) => s.code.toUpperCase() === subjCode.toUpperCase());
        if (!existingSubj) {
          addSubject({
            name: subjName,
            code: subjCode,
            color: subjColor,
            attended: 0,
            totalConducted: 0,
            targetPct: 75,
            isSample: false,
          });
        }
        const subjId = existingSubj ? existingSubj.id : `subj_${subjCode.toLowerCase()}`;
        markAttendanceForEvent(rec.occurrenceKey, subjId, rec.date, rec.status);
      }
    }

    const leavingWsId = activeWorkspace.id;
    const res = await classSpaceService.leaveWorkspace(leavingWsId, effectiveUser.id);
    if (res.success) {
      saveActiveChannelId(leavingWsId, null);
      const remaining = workspaces.filter((w) => w.id !== leavingWsId);
      setWorkspaces(remaining);
      if (remaining.length > 0) {
        setActiveWorkspace(remaining[0]);
        saveActiveWorkspaceId(remaining[0].id, effectiveUser.id);
      } else {
        setActiveWorkspace(null);
        saveActiveWorkspaceId(null, effectiveUser.id);
      }
    }
    return res;
  };

  const deleteWorkspace = async () => {
    if (!activeWorkspace) return { success: false, error: 'No active ClassSpace selected.' };
    const deletingWsId = activeWorkspace.id;
    const res = await classSpaceService.deleteWorkspace(deletingWsId, effectiveUser.id);
    if (res.success) {
      saveActiveChannelId(deletingWsId, null);
      const remaining = workspaces.filter((w) => w.id !== deletingWsId);
      setWorkspaces(remaining);
      if (remaining.length > 0) {
        setActiveWorkspace(remaining[0]);
        saveActiveWorkspaceId(remaining[0].id, effectiveUser.id);
      } else {
        setActiveWorkspace(null);
        saveActiveWorkspaceId(null, effectiveUser.id);
      }
    }
    return res;
  };

  // Member Management Actions
  const updateMemberRole = async (targetUserId: string, newRole: ClassSpaceRole) => {
    if (!activeWorkspace) return { success: false, error: 'No active workspace.' };
    const res = await classSpaceService.updateMemberRole(
      activeWorkspace.id,
      effectiveUser.id,
      targetUserId,
      newRole
    );
    if (res.success) {
      setMembers((prev) =>
        prev.map((m) => (m.userId === targetUserId ? { ...m, role: newRole } : m))
      );
    }
    return res;
  };

  const removeMember = async (targetUserId: string) => {
    if (!activeWorkspace) return { success: false, error: 'No active workspace.' };
    const res = await classSpaceService.removeMember(
      activeWorkspace.id,
      effectiveUser.id,
      targetUserId
    );
    if (res.success) {
      setMembers((prev) => prev.filter((m) => m.userId !== targetUserId));
    }
    return res;
  };

  // Timetable Actions
  const addTimetableRule = async (
    rule: Omit<ClassTimetableRule, 'id' | 'workspaceId' | 'createdAt' | 'updatedAt' | 'createdBy'>
  ) => {
    if (!activeWorkspace) return { error: 'No active workspace.' };
    const res = await classSpaceService.addTimetableRule(activeWorkspace.id, currentMember?.role || 'member', {
      ...rule,
      createdBy: effectiveUser.id,
    });
    if (res.rule) {
      setRules((prev) => [...prev, res.rule!]);
      // Notify class members
      await classSpaceService.dispatchNotificationToMembers(activeWorkspace.id, effectiveUser.id, {
        title: `New Recurring Class: ${rule.subjectName}`,
        body: `${rule.subjectCode} added to weekly timetable for ${rule.startTime}–${rule.endTime}.`,
        type: 'schedule_change',
      });
    }
    return { error: res.error };
  };

  const updateTimetableRule = async (ruleId: string, updates: Partial<ClassTimetableRule>) => {
    if (!activeWorkspace) return { error: 'No active workspace.' };
    const res = await classSpaceService.updateTimetableRule(
      activeWorkspace.id,
      currentMember?.role || 'member',
      ruleId,
      updates
    );
    if (res.success) {
      setRules((prev) => prev.map((r) => (r.id === ruleId ? { ...r, ...updates } : r)));
    }
    return { error: res.error };
  };

  const deleteTimetableRule = async (ruleId: string) => {
    if (!activeWorkspace) return { error: 'No active workspace.' };
    const res = await classSpaceService.deleteTimetableRule(
      activeWorkspace.id,
      currentMember?.role || 'member',
      ruleId
    );
    if (res.success) {
      setRules((prev) => prev.filter((r) => r.id !== ruleId));
    }
    return { error: res.error };
  };

  const rescheduleOccurrence = async (params: {
    ruleId: string;
    originalDate: string;
    newDate: string;
    newStartTime?: string;
    newEndTime?: string;
    newRoom?: string;
    newNotes?: string;
    changeNote?: string;
  }) => {
    if (!activeWorkspace) return { error: 'No active workspace.' };
    const rule = rules.find((r) => r.id === params.ruleId);
    const res = await classSpaceService.addOccurrenceOverride(
      activeWorkspace.id,
      currentMember?.role || 'member',
      {
        ruleId: params.ruleId,
        originalDate: params.originalDate,
        type: 'reschedule',
        newDate: params.newDate,
        newStartTime: params.newStartTime,
        newEndTime: params.newEndTime,
        newRoom: params.newRoom,
        newNotes: params.newNotes,
        changeNote: params.changeNote,
        createdBy: effectiveUser.id,
      }
    );

    if (res.override) {
      setOverrides((prev) => [...prev, res.override!]);
      // Notify all classmates
      await classSpaceService.dispatchNotificationToMembers(activeWorkspace.id, effectiveUser.id, {
        title: `Rescheduled: ${rule?.subjectName || 'Class'}`,
        body: `Moved from ${params.originalDate} to ${params.newDate}${params.newStartTime ? ' at ' + params.newStartTime : ''}. Reason: ${params.changeNote || 'CR schedule update'}.`,
        type: 'schedule_change',
        linkOccurrenceId: res.override.id,
      });

      // Automatically post official announcement in Class Pulse channel
      const pulseChannel = channels.find((c) => c.slug === 'class-pulse') || activeChannel;
      const crName = currentMember?.displayName || effectiveUser.name || 'CR';
      const msgText = `📅 CLASS RESCHEDULED\n\n${rule?.subjectName || 'Class'} has been moved from ${params.originalDate}${rule?.startTime ? ' (' + rule.startTime + ')' : ''} to ${params.newDate}${params.newStartTime ? ' (' + params.newStartTime + ')' : ''}.${params.newRoom ? `\nRoom: ${params.newRoom}` : ''}${params.changeNote ? `\nReason: ${params.changeNote}` : ''}\n\nUpdated by: ${crName}`;

      await classSpaceService.sendMessage(
        activeWorkspace.id,
        {
          id: effectiveUser.id,
          name: crName,
          role: currentMember?.role || 'cr',
          avatarUrl: currentMember?.avatarUrl || effectiveUser.avatarUrl,
        },
        msgText,
        undefined,
        {
          channelId: pulseChannel?.id,
          messageType: 'announcement',
          isPinned: true,
        }
      );
    }
    return { error: res.error };
  };

  const cancelOccurrence = async (params: {
    ruleId: string;
    originalDate: string;
    changeNote?: string;
  }) => {
    if (!activeWorkspace) return { error: 'No active workspace.' };
    const rule = rules.find((r) => r.id === params.ruleId);
    const res = await classSpaceService.addOccurrenceOverride(
      activeWorkspace.id,
      currentMember?.role || 'member',
      {
        ruleId: params.ruleId,
        originalDate: params.originalDate,
        type: 'cancel',
        newDate: params.originalDate,
        changeNote: params.changeNote,
        createdBy: effectiveUser.id,
      }
    );

    if (res.override) {
      setOverrides((prev) => [...prev, res.override!]);
      await classSpaceService.dispatchNotificationToMembers(activeWorkspace.id, effectiveUser.id, {
        title: `Cancelled: ${rule?.subjectName || 'Class'} on ${params.originalDate}`,
        body: params.changeNote || 'CR marked this lecture occurrence as cancelled.',
        type: 'cancelled_class',
        linkOccurrenceId: res.override.id,
      });

      const pulseChannel = channels.find((c) => c.slug === 'class-pulse') || activeChannel;
      const crName = currentMember?.displayName || effectiveUser.name || 'CR';
      const msgText = `🚫 CLASS CANCELLED\n\n${rule?.subjectName || 'Class'} scheduled for ${params.originalDate}${rule?.startTime ? ' (' + rule.startTime + ')' : ''} has been cancelled.${params.changeNote ? `\nReason: ${params.changeNote}` : ''}\n\nUpdated by: ${crName}`;

      await classSpaceService.sendMessage(
        activeWorkspace.id,
        {
          id: effectiveUser.id,
          name: crName,
          role: currentMember?.role || 'cr',
          avatarUrl: currentMember?.avatarUrl || effectiveUser.avatarUrl,
        },
        msgText,
        undefined,
        {
          channelId: pulseChannel?.id,
          messageType: 'announcement',
          isPinned: true,
        }
      );
    }
    return { error: res.error };
  };

  const restoreOccurrence = async (overrideId: string) => {
    if (!activeWorkspace) return { error: 'No active workspace.' };
    const res = await classSpaceService.deleteOccurrenceOverride(
      activeWorkspace.id,
      currentMember?.role || 'member',
      overrideId
    );
    if (res.success) {
      setOverrides((prev) => prev.filter((o) => o.id !== overrideId));
    }
    return { error: res.error };
  };

  const addExtraClass = async (params: {
    subjectName: string;
    subjectCode: string;
    subjectColor: string;
    date: string;
    startTime: string;
    endTime: string;
    room?: string;
    notes?: string;
    changeNote?: string;
  }) => {
    if (!activeWorkspace) return { error: 'No active workspace.' };
    const res = await classSpaceService.addOccurrenceOverride(
      activeWorkspace.id,
      currentMember?.role || 'member',
      {
        type: 'extra',
        newDate: params.date,
        newStartTime: params.startTime,
        newEndTime: params.endTime,
        newRoom: params.room,
        newNotes: params.notes,
        subjectName: params.subjectName,
        subjectCode: params.subjectCode,
        subjectColor: params.subjectColor,
        changeNote: params.changeNote,
        createdBy: effectiveUser.id,
      }
    );

    if (res.override) {
      setOverrides((prev) => [...prev, res.override!]);
      await classSpaceService.dispatchNotificationToMembers(activeWorkspace.id, effectiveUser.id, {
        title: `Extra Class Added: ${params.subjectName}`,
        body: `Scheduled for ${params.date} at ${params.startTime} in ${params.room || 'TBA'}.`,
        type: 'extra_class',
        linkOccurrenceId: res.override.id,
      });

      const pulseChannel = channels.find((c) => c.slug === 'class-pulse') || activeChannel;
      const crName = currentMember?.displayName || effectiveUser.name || 'CR';
      const msgText = `📢 EXTRA CLASS ADDED\n\n${params.subjectName} will be held on ${params.date} at ${params.startTime}${params.room ? ' in ' + params.room : ''}.${params.changeNote ? `\nNote: ${params.changeNote}` : ''}\n\nUpdated by: ${crName}`;

      await classSpaceService.sendMessage(
        activeWorkspace.id,
        {
          id: effectiveUser.id,
          name: crName,
          role: currentMember?.role || 'cr',
          avatarUrl: currentMember?.avatarUrl || effectiveUser.avatarUrl,
        },
        msgText,
        undefined,
        {
          channelId: pulseChannel?.id,
          messageType: 'announcement',
          isPinned: true,
        }
      );
    }
    return { error: res.error };
  };

  const copyOfficialScheduleToPersonal = () => {
    if (!activeWorkspace || rules.length === 0) return;
    // Map rules to personal timetable format safely without wiping personal data
    const existingCodes = new Set(appState.subjects.map((s) => s.code.toUpperCase()));
    for (const r of rules) {
      const codeUpper = r.subjectCode.toUpperCase();
      if (!existingCodes.has(codeUpper)) {
        existingCodes.add(codeUpper);
      }
    }
  };

  // Personal Attendance marking
  const markAttendance = async (
    occurrenceKey: string,
    date: string,
    status: 'present' | 'absent' | 'cancelled'
  ) => {
    if (!activeWorkspace) return;
    const res = await classSpaceService.setAttendanceRecord(
      activeWorkspace.id,
      effectiveUser.id,
      occurrenceKey,
      date,
      status
    );
    if (res.record) {
      setAttendanceRecords((prev) => {
        const filtered = prev.filter((r) => r.occurrenceKey !== occurrenceKey);
        return [...filtered, res.record!];
      });
    }
  };

  // Community Chat Actions
  const sendMessage = async (
    content: string,
    optionsOrReply?:
      | {
          id: string;
          content: string;
          senderName: string;
        }
      | {
          replyTo?: { id: string; content: string; senderName: string };
          isAnnouncement?: boolean;
          isPinned?: boolean;
          channelId?: string;
        }
  ) => {
    if (!activeWorkspace) return { error: 'No active workspace.' };

    let replyTo: { id: string; content: string; senderName: string } | undefined;
    let isAnnouncement = false;
    let isPinned = false;
    let targetChannelId = activeChannel?.id;

    if (optionsOrReply) {
      if ('id' in optionsOrReply && 'senderName' in optionsOrReply) {
        replyTo = optionsOrReply;
      } else {
        replyTo = (optionsOrReply as any).replyTo;
        isAnnouncement = Boolean((optionsOrReply as any).isAnnouncement);
        isPinned = Boolean((optionsOrReply as any).isPinned);
        if ((optionsOrReply as any).channelId) {
          targetChannelId = (optionsOrReply as any).channelId;
        }
      }
    }

    if (isAnnouncement) {
      isPinned = true;
    }

    const res = await classSpaceService.sendMessage(
      activeWorkspace.id,
      {
        id: effectiveUser.id,
        name: currentMember?.displayName || effectiveUser.name || 'Student',
        role: currentMember?.role,
        avatarUrl: currentMember?.avatarUrl || effectiveUser.avatarUrl,
      },
      content,
      replyTo,
      {
        channelId: targetChannelId,
        messageType: isAnnouncement ? 'announcement' : 'text',
        isPinned,
      }
    );

    if (res.message) {
      setMessages((prev) => [...prev, res.message!]);
      // If this is a reply, notify the original sender
      if (replyTo) {
        const originalMsg = messages.find((m) => m.id === replyTo!.id);
        if (originalMsg && originalMsg.senderId !== effectiveUser.id) {
          await classSpaceService.dispatchNotificationToMembers(activeWorkspace.id, effectiveUser.id, {
            title: `${currentMember?.displayName || 'A classmate'} replied to your message`,
            body: content.slice(0, 100),
            type: 'community_reply',
          });
        }
      }
    }
    return { error: res.error };
  };

  const createPoll = async (
    question: string,
    options: string[],
    allowMultipleAnswers: boolean,
    isAnonymous: boolean = false
  ) => {
    if (!activeWorkspace) return { error: 'No active workspace.' };
    const res = await classSpaceService.createPoll(
      activeWorkspace.id,
      {
        id: effectiveUser.id,
        name: currentMember?.displayName || effectiveUser.name || 'Student',
        role: currentMember?.role,
        avatarUrl: currentMember?.avatarUrl || effectiveUser.avatarUrl,
      },
      question,
      options,
      allowMultipleAnswers,
      isAnonymous
    );
    if (res.message) {
      setMessages((prev) => [...prev, res.message!]);
    }
    return { error: res.error };
  };

  const votePoll = async (messageId: string, optionId: string) => {
    if (!activeWorkspace) return { error: 'No active workspace.' };
    const res = await classSpaceService.votePoll(
      activeWorkspace.id,
      messageId,
      optionId,
      effectiveUser.id
    );
    if (res.success && res.poll) {
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, poll: res.poll } : m))
      );
    }
    return { error: res.error };
  };

  const closePoll = async (messageId: string) => {
    if (!activeWorkspace) return { error: 'No active workspace.' };
    const res = await classSpaceService.closePoll(
      activeWorkspace.id,
      messageId,
      effectiveUser.id,
      currentMember?.role
    );
    if (res.success) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId && m.poll
            ? { ...m, poll: { ...m.poll, isClosed: true } }
            : m
        )
      );
    }
    return { error: res.error };
  };

  const shareResource = async (
    title: string,
    url: string,
    category: ClassResourceCategory,
    description?: string
  ) => {
    if (!activeWorkspace) return { error: 'No active workspace.' };
    const res = await classSpaceService.shareResource(
      activeWorkspace.id,
      {
        id: effectiveUser.id,
        name: currentMember?.displayName || effectiveUser.name || 'Student',
        role: currentMember?.role,
        avatarUrl: currentMember?.avatarUrl || effectiveUser.avatarUrl,
      },
      title,
      url,
      category,
      description
    );
    if (res.message) {
      setMessages((prev) => [...prev, res.message!]);
    }
    return { error: res.error };
  };

  const addReaction = async (messageId: string, emoji: string) => {
    await classSpaceService.addReaction(messageId, effectiveUser.id, emoji);
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== messageId) return m;
        const reactions = { ...m.reactions };
        if (!reactions[emoji]) reactions[emoji] = [];
        if (!reactions[emoji].includes(effectiveUser.id)) {
          reactions[emoji] = [...reactions[emoji], effectiveUser.id];
        }
        return { ...m, reactions };
      })
    );
  };

  const removeReaction = async (messageId: string, emoji: string) => {
    await classSpaceService.removeReaction(messageId, effectiveUser.id, emoji);
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== messageId) return m;
        const reactions = { ...m.reactions };
        if (reactions[emoji]) {
          reactions[emoji] = reactions[emoji].filter((uid) => uid !== effectiveUser.id);
          if (reactions[emoji].length === 0) delete reactions[emoji];
        }
        return { ...m, reactions };
      })
    );
  };

  const editMessage = async (messageId: string, newContent: string) => {
    const res = await classSpaceService.editMessage(messageId, effectiveUser.id, newContent);
    if (res.success) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId ? { ...m, content: newContent.trim(), isEdited: true } : m
        )
      );
    }
    return { error: res.error };
  };

  const deleteMessage = async (messageId: string) => {
    if (!activeWorkspace) return { error: 'No active workspace.' };
    const res = await classSpaceService.deleteMessage(
      activeWorkspace.id,
      messageId,
      effectiveUser.id,
      currentMember?.role
    );
    if (res.success) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId ? { ...m, isDeleted: true, content: 'This message was deleted.' } : m
        )
      );
    }
    return { error: res.error };
  };

  const togglePinMessage = async (messageId: string) => {
    if (!activeWorkspace) return { error: 'No active workspace.' };
    const res = await classSpaceService.togglePinMessage(
      activeWorkspace.id,
      messageId,
      currentMember?.role,
      effectiveUser.id,
      currentMember?.canPublishNotices
    );
    if (res.success) {
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, isPinned: !m.isPinned } : m))
      );
    }
    return { error: res.error };
  };

  const createChannel = async (name: string, description?: string) => {
    if (!activeWorkspace) return { error: 'No active workspace.' };
    const res = await classSpaceService.createChannel(activeWorkspace.id, effectiveUser.id, name, description);
    if (res.channel) {
      setChannels((prev) => [...prev, res.channel!]);
      handleSetActiveChannelId(res.channel.id);
    }
    return res;
  };

  const deleteChannel = async (channelId: string) => {
    if (!activeWorkspace) return { success: false, error: 'No active workspace.' };
    const res = await classSpaceService.deleteChannel(activeWorkspace.id, effectiveUser.id, channelId);
    if (res.success) {
      setChannels((prev) => prev.filter((c) => c.id !== channelId));
      if (activeChannelId === channelId) {
        const remaining = channels.filter((c) => c.id !== channelId);
        if (remaining.length > 0) handleSetActiveChannelId(remaining[0].id);
      }
    }
    return res;
  };

  const requestToJoinWorkspace = async (code: string) => {
    const res = await classSpaceService.requestToJoinWorkspace(effectiveUser, code);
    return res;
  };

  const reviewJoinRequest = async (requestId: string, action: 'approve' | 'reject') => {
    if (!activeWorkspace) return { success: false, error: 'No active workspace.' };
    const res = await classSpaceService.reviewJoinRequest(activeWorkspace.id, effectiveUser.id, requestId, action);
    if (res.success) {
      setJoinRequests((prev) => prev.filter((r) => r.id !== requestId));
      if (res.member) {
        setMembers((prev) => {
          if (prev.some((m) => m.userId === res.member!.userId)) return prev;
          return [...prev, res.member!];
        });
      }
    }
    return res;
  };

  const transferCRRole = async (targetUserId: string, previousCRNewRole: 'co_admin' | 'member' = 'co_admin') => {
    if (!activeWorkspace) return { success: false, error: 'No active workspace.' };
    const res = await classSpaceService.transferCRRole(activeWorkspace.id, effectiveUser.id, targetUserId, previousCRNewRole);
    if (res.success) {
      await refreshWorkspaceData();
    }
    return res;
  };

  const updateCoAdminNoticePermission = async (targetUserId: string, canPublish: boolean) => {
    if (!activeWorkspace) return { success: false, error: 'No active workspace.' };
    const res = await classSpaceService.updateCoAdminNoticePermission(activeWorkspace.id, effectiveUser.id, targetUserId, canPublish);
    if (res.success) {
      setMembers((prev) =>
        prev.map((m) => (m.userId === targetUserId ? { ...m, canPublishNotices: canPublish } : m))
      );
    }
    return res;
  };

  const toggleSaveMessage = async (messageId: string) => {
    if (!activeWorkspace) return;
    const res = await classSpaceService.toggleSaveMessage(
      activeWorkspace.id,
      effectiveUser.id,
      messageId
    );
    if (res.isSaved) {
      setSavedMessages((prev) => [
        ...prev,
        {
          id: 'save_' + Math.random().toString(36).substring(2, 9),
          workspaceId: activeWorkspace.id,
          userId: effectiveUser.id,
          messageId,
          savedAt: new Date().toISOString(),
        },
      ]);
    } else {
      setSavedMessages((prev) => prev.filter((s) => s.messageId !== messageId));
    }
  };

  // Notification Actions
  const markNotificationRead = async (notificationId: string) => {
    await classSpaceService.markNotificationRead(notificationId);
    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, isRead: true } : n))
    );
  };

  const markAllNotificationsRead = async () => {
    if (!activeWorkspace) return;
    await classSpaceService.markAllNotificationsRead(activeWorkspace.id, effectiveUser.id);
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  // Profile Actions
  const updateProfile = async (updates: Partial<ClassUserProfile>) => {
    const res = await classSpaceService.updateUserProfile(effectiveUser.id, updates);
    if (res.profile) {
      setProfile(res.profile);
      // Update local members display name/avatar/email
      setMembers((prev) =>
        prev.map((m) =>
          m.userId === effectiveUser.id
            ? {
                ...m,
                displayName: res.profile!.displayName,
                avatarUrl: res.profile!.avatarUrl,
                email: res.profile!.email || m.email,
              }
            : m
        )
      );
    }
    return { error: res.error };
  };

  const uploadAvatar = async (file: File) => {
    const res = await classSpaceService.uploadAvatar(effectiveUser.id, file);
    if (res.avatarUrl) {
      await updateProfile({ avatarUrl: res.avatarUrl });
    }
    return res;
  };

  const contextValue = useMemo<ClassSpaceContextType>(
    () => ({
      workspaces,
      activeWorkspace,
      currentMember,
      members,
      channels,
      activeChannel,
      activeChannelId,
      setActiveChannelId: handleSetActiveChannelId,
      createChannel,
      deleteChannel,
      joinRequests,
      requestToJoinWorkspace,
      reviewJoinRequest,
      isLoading,
      isCloudConfigured: classSpaceService.isCloudConfigured,
      isOwner,
      isCR,
      isCoAdmin,
      canPublishNotices,
      canEditSchedule,
      canModerateChat,
      canManageWorkspace: canManageWs,
      transferCRRole,
      updateCoAdminNoticePermission,
      rules,
      overrides,
      occurrences,
      scheduleRange,
      setScheduleRange,
      attendanceRecords,
      attendanceStats,
      messages,
      savedMessages,
      pinnedMessages,
      notifications,
      unreadNotificationCount,
      profile,
      selectWorkspace,
      createWorkspace,
      joinWorkspaceByCode,
      rotateJoinCode,
      updateWorkspaceAcademicCalendar,
      leaveWorkspace,
      deleteWorkspace,
      updateMemberRole,
      removeMember,
      addTimetableRule,
      updateTimetableRule,
      deleteTimetableRule,
      rescheduleOccurrence,
      cancelOccurrence,
      restoreOccurrence,
      addExtraClass,
      copyOfficialScheduleToPersonal,
      markAttendance,
      sendMessage,
      createPoll,
      votePoll,
      closePoll,
      shareResource,
      addReaction,
      removeReaction,
      editMessage,
      deleteMessage,
      togglePinMessage,
      toggleSaveMessage,
      markNotificationRead,
      markAllNotificationsRead,
      updateProfile,
      uploadAvatar,
    }),
    [
      workspaces,
      activeWorkspace,
      currentMember,
      members,
      channels,
      activeChannel,
      activeChannelId,
      handleSetActiveChannelId,
      createChannel,
      deleteChannel,
      joinRequests,
      requestToJoinWorkspace,
      reviewJoinRequest,
      isLoading,
      isOwner,
      isCR,
      isCoAdmin,
      canPublishNotices,
      canEditSchedule,
      canModerateChat,
      canManageWs,
      transferCRRole,
      updateCoAdminNoticePermission,
      rules,
      overrides,
      occurrences,
      scheduleRange,
      attendanceRecords,
      attendanceStats,
      messages,
      savedMessages,
      pinnedMessages,
      notifications,
      unreadNotificationCount,
      profile,
      selectWorkspace,
      createWorkspace,
      joinWorkspaceByCode,
      rotateJoinCode,
      updateWorkspaceAcademicCalendar,
      leaveWorkspace,
      deleteWorkspace,
      updateMemberRole,
      removeMember,
      addTimetableRule,
      updateTimetableRule,
      deleteTimetableRule,
      rescheduleOccurrence,
      cancelOccurrence,
      restoreOccurrence,
      addExtraClass,
      copyOfficialScheduleToPersonal,
      markAttendance,
      sendMessage,
      createPoll,
      votePoll,
      closePoll,
      shareResource,
      addReaction,
      removeReaction,
      editMessage,
      deleteMessage,
      togglePinMessage,
      toggleSaveMessage,
      markNotificationRead,
      markAllNotificationsRead,
      updateProfile,
      uploadAvatar,
    ]
  );

  return (
    <ClassSpaceContext.Provider value={contextValue}>
      {children}
    </ClassSpaceContext.Provider>
  );
};

export const useClassSpace = (): ClassSpaceContextType => {
  const context = useContext(ClassSpaceContext);
  if (!context) {
    throw new Error('useClassSpace must be used within a ClassSpaceProvider');
  }
  return context;
};

