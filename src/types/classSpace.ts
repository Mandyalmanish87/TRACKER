import { DayOfWeek } from './index';

export type ClassSpaceRole = 'owner' | 'cr' | 'co_admin' | 'member';

export interface ClassSpaceWorkspace {
  id: string;
  name: string;
  college?: string;
  institution?: string;
  department?: string;
  section?: string;
  batch?: string;
  description?: string;
  joinCode: string; // 5-character uppercase alphanumeric (e.g. CH7K2)
  createdBy: string; // userId of Owner / CR
  createdAt: string;
  updatedAt: string;
}

export interface ClassSpaceMember {
  id: string;
  workspaceId: string;
  userId: string;
  role: ClassSpaceRole;
  joinedAt: string;
  displayName: string;
  email?: string;
  avatarUrl?: string;
  isMuted?: boolean;
}

export interface ClassTimetableRule {
  id: string;
  workspaceId: string;
  subjectName: string;
  subjectCode: string;
  subjectColor: string;
  dayOfWeek: DayOfWeek; // 1 = Monday, 7 = Sunday
  startTime: string; // "09:00"
  endTime: string;   // "10:15"
  room?: string;
  instructor?: string;
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export type ClassOverrideType = 'reschedule' | 'cancel' | 'extra';

export interface ClassTimetableOverride {
  id: string;
  workspaceId: string;
  ruleId?: string; // null if extra class
  originalDate?: string; // YYYY-MM-DD
  type: ClassOverrideType;
  newDate: string; // YYYY-MM-DD
  newStartTime?: string;
  newEndTime?: string;
  newRoom?: string;
  newNotes?: string;
  changeNote?: string; // Reason / announcement by CR
  subjectName?: string; // For extra classes
  subjectCode?: string;
  subjectColor?: string;
  createdBy: string;
  createdAt: string;
}

export interface ResolvedClassOccurrence {
  occurrenceKey: string; // ruleId::date or overrideId
  workspaceId: string;
  subjectName: string;
  subjectCode: string;
  subjectColor: string;
  date: string; // YYYY-MM-DD
  startTime: string;
  endTime: string;
  room?: string;
  instructor?: string;
  notes?: string;
  source: 'recurring' | 'rescheduled' | 'extra';
  ruleId?: string;
  overrideId?: string;
  isCancelled?: boolean;
  changeNote?: string;
}

export type ClassAttendanceStatus = 'present' | 'absent' | 'cancelled';

export interface ClassAttendanceRecord {
  id: string;
  workspaceId: string;
  userId: string; // isolated per student!
  occurrenceKey: string;
  date: string; // YYYY-MM-DD
  status: ClassAttendanceStatus;
  createdAt: string;
  updatedAt: string;
}

export type ClassMessageType = 'text' | 'poll' | 'resource' | 'announcement';

export interface ClassPollOption {
  id: string;
  text: string;
  votes: string[]; // array of userIds
}

export interface ClassPoll {
  id: string;
  question: string;
  options: ClassPollOption[];
  allowMultipleAnswers: boolean; // multi-choice support
  isAnonymous?: boolean;
  isClosed?: boolean;
  totalVotes: number;
}

export type ClassResourceCategory = 'notes' | 'slides' | 'assignment' | 'reference' | 'recording';

export interface ClassResourceAttachment {
  title: string;
  url: string;
  category: ClassResourceCategory;
  description?: string;
}

export interface ClassMessage {
  id: string;
  workspaceId: string;
  senderId: string;
  senderName: string;
  senderRole?: ClassSpaceRole;
  senderAvatarUrl?: string;
  content: string;
  messageType?: ClassMessageType;
  poll?: ClassPoll;
  resource?: ClassResourceAttachment;
  replyToId?: string;
  replyToContent?: string;
  replyToSenderName?: string;
  reactions: Record<string, string[]>; // emoji -> array of userIds
  isPinned?: boolean;
  isEdited?: boolean;
  isDeleted?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ClassSavedMessage {
  id: string;
  workspaceId: string;
  userId: string;
  messageId: string;
  savedAt: string;
}

export type ClassNotificationType =
  | 'schedule_change'
  | 'extra_class'
  | 'cancelled_class'
  | 'community_reply'
  | 'announcement'
  | 'membership';

export interface ClassNotification {
  id: string;
  workspaceId: string;
  userId: string;
  title: string;
  body: string;
  type: ClassNotificationType;
  isRead: boolean;
  linkOccurrenceId?: string;
  createdAt: string;
}

export interface ClassUserProfile {
  userId: string;
  displayName: string;
  email?: string;
  avatarUrl?: string;
  notificationPreferences: {
    timetableAlerts: boolean;
    extraClasses: boolean;
    cancellations: boolean;
    communityReplies: boolean;
  };
}
