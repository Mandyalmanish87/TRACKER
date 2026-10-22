import { getSupabaseClient, isSupabaseConfigured, AuthUser } from './authService';
import {
  ClassSpaceWorkspace,
  ClassSpaceMember,
  ClassSpaceRole,
  ClassTimetableRule,
  ClassTimetableOverride,
  ClassAttendanceRecord,
  ClassMessage,
  ClassSavedMessage,
  ClassNotification,
  ClassUserProfile,
} from '../types/classSpace';
import { generateJoinCode, normalizeJoinCode, isValidJoinCode } from '../utils/classSpaceUtils';

const LOCAL_STORE_KEY = 'tracker_classspace_data_v1';

interface LocalClassSpaceData {
  workspaces: ClassSpaceWorkspace[];
  members: ClassSpaceMember[];
  rules: ClassTimetableRule[];
  overrides: ClassTimetableOverride[];
  attendanceRecords: ClassAttendanceRecord[];
  messages: ClassMessage[];
  savedMessages: ClassSavedMessage[];
  notifications: ClassNotification[];
  profiles: Record<string, ClassUserProfile>;
}

// Starter demo workspace for offline and initial test-drive
const INITIAL_DEMO_DATA: LocalClassSpaceData = {
  workspaces: [
    {
      id: 'ws_demo_cs2026',
      name: 'B.Tech CSE — Batch 2026 (Sec A)',
      department: 'Computer Science & Engineering',
      section: 'Section A',
      batch: '2022-2026',
      description: 'Official shared workspace for lectures, labs, CR announcements & reschedule notices.',
      joinCode: 'CH7K2',
      createdBy: 'usr_cr_aarav',
      createdAt: '2026-09-01T08:00:00.000Z',
      updatedAt: '2026-10-22T08:00:00.000Z',
    },
  ],
  members: [
    {
      id: 'mem_1',
      workspaceId: 'ws_demo_cs2026',
      userId: 'usr_cr_aarav',
      role: 'cr',
      joinedAt: '2026-09-01T08:00:00.000Z',
      displayName: 'Aarav Sharma (CR)',
      avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=96&h=96&fit=crop&crop=faces',
    },
    {
      id: 'mem_2',
      workspaceId: 'ws_demo_cs2026',
      userId: 'usr_coadmin_priya',
      role: 'co_admin',
      joinedAt: '2026-09-02T09:30:00.000Z',
      displayName: 'Priya Nair (Co-Admin)',
      avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=96&h=96&fit=crop&crop=faces',
    },
    {
      id: 'mem_3',
      workspaceId: 'ws_demo_cs2026',
      userId: 'usr_google_student_demo',
      role: 'member',
      joinedAt: '2026-09-03T11:15:00.000Z',
      displayName: 'Scholar Student',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=96&h=96&fit=crop&crop=faces',
    },
  ],
  rules: [
    {
      id: 'rule_dsa',
      workspaceId: 'ws_demo_cs2026',
      subjectName: 'Data Structures & Algorithms',
      subjectCode: 'CS301',
      subjectColor: '#DE6C47',
      dayOfWeek: 1, // Mon
      startTime: '09:00',
      endTime: '10:15',
      room: 'LH-101',
      instructor: 'Prof. V. Raman',
      notes: 'Bring graph traversal assignments',
      createdBy: 'usr_cr_aarav',
      createdAt: '2026-09-01T08:00:00.000Z',
      updatedAt: '2026-09-01T08:00:00.000Z',
    },
    {
      id: 'rule_os',
      workspaceId: 'ws_demo_cs2026',
      subjectName: 'Operating Systems & Kernels',
      subjectCode: 'CS302',
      subjectColor: '#3D6A8A',
      dayOfWeek: 3, // Wed
      startTime: '10:30',
      endTime: '11:45',
      room: 'CS-Lab 2',
      instructor: 'Dr. Anita Desai',
      notes: 'Linux concurrency exercises',
      createdBy: 'usr_cr_aarav',
      createdAt: '2026-09-01T08:00:00.000Z',
      updatedAt: '2026-09-01T08:00:00.000Z',
    },
    {
      id: 'rule_dbms',
      workspaceId: 'ws_demo_cs2026',
      subjectName: 'Database Management Systems',
      subjectCode: 'CS303',
      subjectColor: '#436650',
      dayOfWeek: 4, // Thu
      startTime: '14:00',
      endTime: '15:15',
      room: 'LH-104',
      instructor: 'Prof. K. Sen',
      notes: 'Normalization & B+ Trees',
      createdBy: 'usr_cr_aarav',
      createdAt: '2026-09-01T08:00:00.000Z',
      updatedAt: '2026-09-01T08:00:00.000Z',
    },
    {
      id: 'rule_networks',
      workspaceId: 'ws_demo_cs2026',
      subjectName: 'Computer Networks',
      subjectCode: 'CS304',
      subjectColor: '#B8732E',
      dayOfWeek: 5, // Fri
      startTime: '11:00',
      endTime: '12:15',
      room: 'LH-201',
      instructor: 'Dr. R. Gupta',
      notes: 'TCP handshake analysis',
      createdBy: 'usr_cr_aarav',
      createdAt: '2026-09-01T08:00:00.000Z',
      updatedAt: '2026-09-01T08:00:00.000Z',
    },
  ],
  overrides: [
    {
      id: 'ov_sample_extra',
      workspaceId: 'ws_demo_cs2026',
      type: 'extra',
      newDate: new Date().toISOString().split('T')[0], // today
      newStartTime: '16:00',
      newEndTime: '17:15',
      newRoom: 'Seminar Hall 3',
      subjectName: 'Special DSA Problem Solving Workshop',
      subjectCode: 'CS301-EXTRA',
      subjectColor: '#DE6C47',
      changeNote: 'CR Announcement: Extra revision session on Dynamic Programming & Trees.',
      createdBy: 'usr_cr_aarav',
      createdAt: '2026-10-20T10:00:00.000Z',
    },
  ],
  attendanceRecords: [],
  messages: [
    {
      id: 'msg_welcome',
      workspaceId: 'ws_demo_cs2026',
      senderId: 'usr_cr_aarav',
      senderName: 'Aarav Sharma (CR)',
      senderRole: 'cr',
      senderAvatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=96&h=96&fit=crop&crop=faces',
      content: 'Welcome to our official ClassSpace! The weekly timetable and official reschedule notices are published here.',
      reactions: { '🙌': ['usr_cr_aarav', 'usr_coadmin_priya'], '🔥': ['usr_google_student_demo'] },
      isPinned: true,
      createdAt: '2026-10-21T09:00:00.000Z',
      updatedAt: '2026-10-21T09:00:00.000Z',
    },
    {
      id: 'msg_notes',
      workspaceId: 'ws_demo_cs2026',
      senderId: 'usr_coadmin_priya',
      senderName: 'Priya Nair (Co-Admin)',
      senderRole: 'co_admin',
      senderAvatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=96&h=96&fit=crop&crop=faces',
      content: 'Reminder: Operating Systems lab report deadline is this Friday at 5 PM on the department portal.',
      reactions: { '👍': ['usr_google_student_demo'] },
      createdAt: '2026-10-22T08:30:00.000Z',
      updatedAt: '2026-10-22T08:30:00.000Z',
    },
  ],
  savedMessages: [],
  notifications: [
    {
      id: 'notif_init',
      workspaceId: 'ws_demo_cs2026',
      userId: 'usr_google_student_demo',
      title: 'Official Timetable Published',
      body: 'CR Aarav Sharma has published the official semester schedule.',
      type: 'schedule_change',
      isRead: false,
      createdAt: '2026-10-21T09:05:00.000Z',
    },
    {
      id: 'notif_extra',
      workspaceId: 'ws_demo_cs2026',
      userId: 'usr_google_student_demo',
      title: 'Extra Class Added: DSA Workshop',
      body: 'Today at 16:00 in Seminar Hall 3.',
      type: 'extra_class',
      isRead: false,
      createdAt: '2026-10-22T08:00:00.000Z',
    },
  ],
  profiles: {
    usr_google_student_demo: {
      userId: 'usr_google_student_demo',
      displayName: 'Scholar Student',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=96&h=96&fit=crop&crop=faces',
      notificationPreferences: {
        timetableAlerts: true,
        extraClasses: true,
        cancellations: true,
        communityReplies: true,
      },
    },
  },
};

/**
 * Loads raw data from local storage with initial demo data hydration
 */
function getLocalData(): LocalClassSpaceData {
  try {
    const raw = localStorage.getItem(LOCAL_STORE_KEY);
    if (!raw) {
      localStorage.setItem(LOCAL_STORE_KEY, JSON.stringify(INITIAL_DEMO_DATA));
      return INITIAL_DEMO_DATA;
    }
    const parsed = JSON.parse(raw) as Partial<LocalClassSpaceData>;
    return {
      workspaces: parsed.workspaces || INITIAL_DEMO_DATA.workspaces,
      members: parsed.members || INITIAL_DEMO_DATA.members,
      rules: parsed.rules || INITIAL_DEMO_DATA.rules,
      overrides: parsed.overrides || INITIAL_DEMO_DATA.overrides,
      attendanceRecords: parsed.attendanceRecords || [],
      messages: parsed.messages || INITIAL_DEMO_DATA.messages,
      savedMessages: parsed.savedMessages || [],
      notifications: parsed.notifications || INITIAL_DEMO_DATA.notifications,
      profiles: parsed.profiles || INITIAL_DEMO_DATA.profiles,
    };
  } catch {
    return INITIAL_DEMO_DATA;
  }
}

function saveLocalData(data: LocalClassSpaceData): void {
  try {
    localStorage.setItem(LOCAL_STORE_KEY, JSON.stringify(data));
    // Trigger cross-tab sync
    window.dispatchEvent(new Event('tracker_classspace_updated'));
  } catch (err) {
    console.warn('[ClassSpaceService] Failed to save local state:', err);
  }
}

export const classSpaceService = {
  isCloudConfigured: isSupabaseConfigured,

  // ==========================================================================
  // WORKSPACES
  // ==========================================================================

  async getWorkspacesForUser(userId: string): Promise<ClassSpaceWorkspace[]> {
    const supabase = getSupabaseClient();
    if (supabase && isSupabaseConfigured) {
      try {
        const { data: memberRows, error: mError } = await supabase
          .from('class_members')
          .select('workspace_id')
          .eq('user_id', userId);

        if (mError || !memberRows || memberRows.length === 0) return [];
        const wsIds = memberRows.map((r: { workspace_id: string }) => r.workspace_id);

        const { data: workspaces, error: wsError } = await supabase
          .from('class_workspaces')
          .select('*')
          .in('id', wsIds);

        if (wsError || !workspaces) return [];
        return workspaces.map(mapWorkspaceFromDb);
      } catch (err) {
        console.warn('[ClassSpaceService] Supabase getWorkspaces error:', err);
      }
    }

    // Local fallback
    const local = getLocalData();
    const joinedWsIds = new Set(
      local.members.filter((m) => m.userId === userId).map((m) => m.workspaceId)
    );
    return local.workspaces.filter((w) => joinedWsIds.has(w.id));
  },

  async createWorkspace(
    user: AuthUser,
    details: {
      name: string;
      department?: string;
      section?: string;
      batch?: string;
      description?: string;
    }
  ): Promise<{ workspace?: ClassSpaceWorkspace; member?: ClassSpaceMember; error?: string }> {
    if (!user || !user.id) {
      return { error: 'You must be signed in to create a ClassSpace.' };
    }

    if (!details.name || !details.name.trim()) {
      return { error: 'ClassSpace name is required.' };
    }

    const local = getLocalData();
    // Generate unique 5-char join code (race-safe)
    let joinCode = generateJoinCode();
    let attempts = 0;
    while (local.workspaces.some((w) => w.joinCode === joinCode) && attempts < 10) {
      joinCode = generateJoinCode();
      attempts++;
    }

    const now = new Date().toISOString();
    const wsId = 'ws_' + Math.random().toString(36).substring(2, 11);

    const newWorkspace: ClassSpaceWorkspace = {
      id: wsId,
      name: details.name.trim(),
      department: details.department?.trim(),
      section: details.section?.trim(),
      batch: details.batch?.trim(),
      description: details.description?.trim(),
      joinCode,
      createdBy: user.id,
      createdAt: now,
      updatedAt: now,
    };

    const crMember: ClassSpaceMember = {
      id: 'mem_' + Math.random().toString(36).substring(2, 11),
      workspaceId: wsId,
      userId: user.id,
      role: 'cr',
      joinedAt: now,
      displayName: user.name || user.email.split('@')[0],
      avatarUrl: user.avatarUrl,
    };

    const supabase = getSupabaseClient();
    if (supabase && isSupabaseConfigured) {
      try {
        const { data: wsData, error: wsError } = await supabase
          .from('class_workspaces')
          .insert({
            name: newWorkspace.name,
            department: newWorkspace.department,
            section: newWorkspace.section,
            batch: newWorkspace.batch,
            description: newWorkspace.description,
            join_code: newWorkspace.joinCode,
            created_by: user.id,
          })
          .select()
          .single();

        if (wsError) return { error: wsError.message };

        const insertedWs = mapWorkspaceFromDb(wsData);

        const { data: mData, error: mError } = await supabase
          .from('class_members')
          .insert({
            workspace_id: insertedWs.id,
            user_id: user.id,
            role: 'cr',
            display_name: crMember.displayName,
            avatar_url: crMember.avatarUrl,
          })
          .select()
          .single();

        if (mError) return { error: mError.message };

        return { workspace: insertedWs, member: mapMemberFromDb(mData) };
      } catch (err) {
        console.warn('[ClassSpaceService] Supabase createWorkspace error:', err);
      }
    }

    // Local fallback
    local.workspaces.push(newWorkspace);
    local.members.push(crMember);
    saveLocalData(local);

    return { workspace: newWorkspace, member: crMember };
  },

  async joinWorkspaceByCode(
    user: AuthUser,
    rawCode: string
  ): Promise<{ workspace?: ClassSpaceWorkspace; member?: ClassSpaceMember; error?: string }> {
    if (!user || !user.id) {
      return { error: 'You must be signed in to join a ClassSpace.' };
    }

    const normalized = normalizeJoinCode(rawCode);
    if (!isValidJoinCode(normalized)) {
      return { error: 'Invalid ClassSpace code format. Must be 5 alphanumeric characters.' };
    }

    const supabase = getSupabaseClient();
    if (supabase && isSupabaseConfigured) {
      try {
        const { data: wsData, error: wsError } = await supabase
          .from('class_workspaces')
          .select('*')
          .eq('join_code', normalized)
          .single();

        if (wsError || !wsData) {
          return { error: 'No ClassSpace found with this Join Code. Please verify with your CR.' };
        }

        const workspace = mapWorkspaceFromDb(wsData);

        // Check if already a member
        const { data: existingMember } = await supabase
          .from('class_members')
          .select('*')
          .eq('workspace_id', workspace.id)
          .eq('user_id', user.id)
          .maybeSingle();

        if (existingMember) {
          return { error: 'You are already a member of this ClassSpace.' };
        }

        const { data: mData, error: mError } = await supabase
          .from('class_members')
          .insert({
            workspace_id: workspace.id,
            user_id: user.id,
            role: 'member',
            display_name: user.name || user.email.split('@')[0],
            avatar_url: user.avatarUrl,
          })
          .select()
          .single();

        if (mError) return { error: mError.message };

        return { workspace, member: mapMemberFromDb(mData) };
      } catch (err) {
        console.warn('[ClassSpaceService] Supabase joinWorkspace error:', err);
      }
    }

    // Local fallback
    const local = getLocalData();
    const workspace = local.workspaces.find((w) => w.joinCode === normalized);

    if (!workspace) {
      return { error: 'No ClassSpace found with this Join Code. Please verify with your CR.' };
    }

    const alreadyMember = local.members.some(
      (m) => m.workspaceId === workspace.id && m.userId === user.id
    );

    if (alreadyMember) {
      return { error: 'You are already a member of this ClassSpace.' };
    }

    const newMember: ClassSpaceMember = {
      id: 'mem_' + Math.random().toString(36).substring(2, 11),
      workspaceId: workspace.id,
      userId: user.id,
      role: 'member',
      joinedAt: new Date().toISOString(),
      displayName: user.name || user.email.split('@')[0],
      avatarUrl: user.avatarUrl,
    };

    local.members.push(newMember);
    saveLocalData(local);

    return { workspace, member: newMember };
  },

  async rotateJoinCode(
    workspaceId: string,
    userId: string
  ): Promise<{ newCode?: string; error?: string }> {
    const local = getLocalData();
    const ws = local.workspaces.find((w) => w.id === workspaceId);
    if (!ws) return { error: 'ClassSpace not found.' };

    const member = local.members.find((m) => m.workspaceId === workspaceId && m.userId === userId);
    if (!member || member.role !== 'cr') {
      return { error: 'Only the Class Representative (CR) can rotate the join code.' };
    }

    const newCode = generateJoinCode();

    const supabase = getSupabaseClient();
    if (supabase && isSupabaseConfigured) {
      try {
        const { error } = await supabase
          .from('class_workspaces')
          .update({ join_code: newCode, updated_at: new Date().toISOString() })
          .eq('id', workspaceId);

        if (error) return { error: error.message };
        return { newCode };
      } catch (err) {
        console.warn('[ClassSpaceService] rotateJoinCode error:', err);
      }
    }

    ws.joinCode = newCode;
    ws.updatedAt = new Date().toISOString();
    saveLocalData(local);

    return { newCode };
  },

  async leaveWorkspace(workspaceId: string, userId: string): Promise<{ success: boolean; error?: string }> {
    const supabase = getSupabaseClient();
    if (supabase && isSupabaseConfigured) {
      try {
        const { error } = await supabase
          .from('class_members')
          .delete()
          .eq('workspace_id', workspaceId)
          .eq('user_id', userId);

        if (error) return { success: false, error: error.message };
        return { success: true };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    }

    const local = getLocalData();
    local.members = local.members.filter(
      (m) => !(m.workspaceId === workspaceId && m.userId === userId)
    );
    saveLocalData(local);
    return { success: true };
  },

  // ==========================================================================
  // MEMBERS & ROLES
  // ==========================================================================

  async getMembers(workspaceId: string): Promise<ClassSpaceMember[]> {
    const supabase = getSupabaseClient();
    if (supabase && isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('class_members')
          .select('*')
          .eq('workspace_id', workspaceId);

        if (error || !data) return [];
        return data.map(mapMemberFromDb);
      } catch {
        return [];
      }
    }

    const local = getLocalData();
    return local.members.filter((m) => m.workspaceId === workspaceId);
  },

  async updateMemberRole(
    workspaceId: string,
    actingUserId: string,
    targetUserId: string,
    newRole: ClassSpaceRole
  ): Promise<{ success: boolean; error?: string }> {
    const local = getLocalData();
    const actor = local.members.find((m) => m.workspaceId === workspaceId && m.userId === actingUserId);
    if (!actor || actor.role !== 'cr') {
      return { success: false, error: 'Only the CR can assign co-admins or roles.' };
    }

    const supabase = getSupabaseClient();
    if (supabase && isSupabaseConfigured) {
      try {
        const { error } = await supabase
          .from('class_members')
          .update({ role: newRole })
          .eq('workspace_id', workspaceId)
          .eq('user_id', targetUserId);

        if (error) return { success: false, error: error.message };
        return { success: true };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    }

    const target = local.members.find((m) => m.workspaceId === workspaceId && m.userId === targetUserId);
    if (target) {
      target.role = newRole;
      saveLocalData(local);
    }
    return { success: true };
  },

  // ==========================================================================
  // OFFICIAL TIMETABLE & OVERRIDES
  // ==========================================================================

  async getScheduleData(workspaceId: string): Promise<{
    rules: ClassTimetableRule[];
    overrides: ClassTimetableOverride[];
  }> {
    const supabase = getSupabaseClient();
    if (supabase && isSupabaseConfigured) {
      try {
        const [rulesRes, overridesRes] = await Promise.all([
          supabase.from('class_timetable_rules').select('*').eq('workspace_id', workspaceId),
          supabase.from('class_timetable_overrides').select('*').eq('workspace_id', workspaceId),
        ]);

        return {
          rules: (rulesRes.data || []).map(mapRuleFromDb),
          overrides: (overridesRes.data || []).map(mapOverrideFromDb),
        };
      } catch {
        return { rules: [], overrides: [] };
      }
    }

    const local = getLocalData();
    return {
      rules: local.rules.filter((r) => r.workspaceId === workspaceId),
      overrides: local.overrides.filter((o) => o.workspaceId === workspaceId),
    };
  },

  async addTimetableRule(
    workspaceId: string,
    actorRole: ClassSpaceRole,
    rule: Omit<ClassTimetableRule, 'id' | 'workspaceId' | 'createdAt' | 'updatedAt'>
  ): Promise<{ rule?: ClassTimetableRule; error?: string }> {
    if (actorRole !== 'cr' && actorRole !== 'co_admin') {
      return { error: 'Unauthorized: Only CR or Co-Admin can add official recurring classes.' };
    }

    const now = new Date().toISOString();
    const newRule: ClassTimetableRule = {
      ...rule,
      id: 'rule_' + Math.random().toString(36).substring(2, 11),
      workspaceId,
      createdAt: now,
      updatedAt: now,
    };

    const supabase = getSupabaseClient();
    if (supabase && isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('class_timetable_rules')
          .insert({
            workspace_id: workspaceId,
            subject_name: rule.subjectName,
            subject_code: rule.subjectCode,
            subject_color: rule.subjectColor,
            day_of_week: rule.dayOfWeek,
            start_time: rule.startTime,
            end_time: rule.endTime,
            room: rule.room,
            instructor: rule.instructor,
            notes: rule.notes,
            created_by: rule.createdBy,
          })
          .select()
          .single();

        if (error) return { error: error.message };
        return { rule: mapRuleFromDb(data) };
      } catch (err) {
        return { error: (err as Error).message };
      }
    }

    const local = getLocalData();
    local.rules.push(newRule);
    saveLocalData(local);

    return { rule: newRule };
  },

  async updateTimetableRule(
    workspaceId: string,
    actorRole: ClassSpaceRole,
    ruleId: string,
    updates: Partial<ClassTimetableRule>
  ): Promise<{ success: boolean; error?: string }> {
    if (actorRole !== 'cr' && actorRole !== 'co_admin') {
      return { success: false, error: 'Unauthorized: Only CR or Co-Admin can update recurring class rules.' };
    }

    const supabase = getSupabaseClient();
    if (supabase && isSupabaseConfigured) {
      try {
        const { error } = await supabase
          .from('class_timetable_rules')
          .update({
            subject_name: updates.subjectName,
            subject_code: updates.subjectCode,
            subject_color: updates.subjectColor,
            day_of_week: updates.dayOfWeek,
            start_time: updates.startTime,
            end_time: updates.endTime,
            room: updates.room,
            instructor: updates.instructor,
            notes: updates.notes,
            updated_at: new Date().toISOString(),
          })
          .eq('id', ruleId)
          .eq('workspace_id', workspaceId);

        if (error) return { success: false, error: error.message };
        return { success: true };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    }

    const local = getLocalData();
    const existing = local.rules.find((r) => r.id === ruleId && r.workspaceId === workspaceId);
    if (existing) {
      Object.assign(existing, updates, { updatedAt: new Date().toISOString() });
      saveLocalData(local);
    }
    return { success: true };
  },

  async deleteTimetableRule(
    workspaceId: string,
    actorRole: ClassSpaceRole,
    ruleId: string
  ): Promise<{ success: boolean; error?: string }> {
    if (actorRole !== 'cr' && actorRole !== 'co_admin') {
      return { success: false, error: 'Unauthorized: Only CR or Co-Admin can delete class rules.' };
    }

    const supabase = getSupabaseClient();
    if (supabase && isSupabaseConfigured) {
      try {
        const { error } = await supabase
          .from('class_timetable_rules')
          .delete()
          .eq('id', ruleId)
          .eq('workspace_id', workspaceId);

        if (error) return { success: false, error: error.message };
        return { success: true };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    }

    const local = getLocalData();
    local.rules = local.rules.filter((r) => !(r.id === ruleId && r.workspaceId === workspaceId));
    saveLocalData(local);
    return { success: true };
  },

  async addOccurrenceOverride(
    workspaceId: string,
    actorRole: ClassSpaceRole,
    override: Omit<ClassTimetableOverride, 'id' | 'workspaceId' | 'createdAt'>
  ): Promise<{ override?: ClassTimetableOverride; error?: string }> {
    if (actorRole !== 'cr' && actorRole !== 'co_admin') {
      return { error: 'Unauthorized: Only CR or Co-Admin can reschedule, cancel or add extra classes.' };
    }

    const now = new Date().toISOString();
    const newOverride: ClassTimetableOverride = {
      ...override,
      id: 'ov_' + Math.random().toString(36).substring(2, 11),
      workspaceId,
      createdAt: now,
    };

    const supabase = getSupabaseClient();
    if (supabase && isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('class_timetable_overrides')
          .insert({
            workspace_id: workspaceId,
            rule_id: override.ruleId,
            original_date: override.originalDate,
            type: override.type,
            new_date: override.newDate,
            new_start_time: override.newStartTime,
            new_end_time: override.newEndTime,
            new_room: override.newRoom,
            new_notes: override.newNotes,
            change_note: override.changeNote,
            subject_name: override.subjectName,
            subject_code: override.subjectCode,
            subject_color: override.subjectColor,
            created_by: override.createdBy,
          })
          .select()
          .single();

        if (error) return { error: error.message };
        return { override: mapOverrideFromDb(data) };
      } catch (err) {
        return { error: (err as Error).message };
      }
    }

    const local = getLocalData();
    local.overrides.push(newOverride);
    saveLocalData(local);

    return { override: newOverride };
  },

  async deleteOccurrenceOverride(
    workspaceId: string,
    actorRole: ClassSpaceRole,
    overrideId: string
  ): Promise<{ success: boolean; error?: string }> {
    if (actorRole !== 'cr' && actorRole !== 'co_admin') {
      return { success: false, error: 'Unauthorized: Only CR or Co-Admin can restore or revert overrides.' };
    }

    const supabase = getSupabaseClient();
    if (supabase && isSupabaseConfigured) {
      try {
        const { error } = await supabase
          .from('class_timetable_overrides')
          .delete()
          .eq('id', overrideId)
          .eq('workspace_id', workspaceId);

        if (error) return { success: false, error: error.message };
        return { success: true };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    }

    const local = getLocalData();
    local.overrides = local.overrides.filter((o) => !(o.id === overrideId && o.workspaceId === workspaceId));
    saveLocalData(local);
    return { success: true };
  },

  // ==========================================================================
  // PERSONAL ATTENDANCE RECORDS (ISOLATED PER STUDENT)
  // ==========================================================================

  async getAttendanceRecords(workspaceId: string, userId: string): Promise<ClassAttendanceRecord[]> {
    const supabase = getSupabaseClient();
    if (supabase && isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('class_attendance_records')
          .select('*')
          .eq('workspace_id', workspaceId)
          .eq('user_id', userId);

        if (error || !data) return [];
        return data.map(mapAttendanceFromDb);
      } catch {
        return [];
      }
    }

    const local = getLocalData();
    return local.attendanceRecords.filter(
      (a) => a.workspaceId === workspaceId && a.userId === userId
    );
  },

  async setAttendanceRecord(
    workspaceId: string,
    userId: string,
    occurrenceKey: string,
    date: string,
    status: 'present' | 'absent' | 'cancelled'
  ): Promise<{ record?: ClassAttendanceRecord; error?: string }> {
    const now = new Date().toISOString();

    const supabase = getSupabaseClient();
    if (supabase && isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('class_attendance_records')
          .upsert({
            workspace_id: workspaceId,
            user_id: userId,
            occurrence_key: occurrenceKey,
            date,
            status,
            updated_at: now,
          }, { onConflict: 'workspace_id,user_id,occurrence_key' })
          .select()
          .single();

        if (error) return { error: error.message };
        return { record: mapAttendanceFromDb(data) };
      } catch (err) {
        return { error: (err as Error).message };
      }
    }

    const local = getLocalData();
    let existing = local.attendanceRecords.find(
      (a) => a.workspaceId === workspaceId && a.userId === userId && a.occurrenceKey === occurrenceKey
    );

    if (existing) {
      existing.status = status;
      existing.updatedAt = now;
    } else {
      existing = {
        id: 'att_' + Math.random().toString(36).substring(2, 11),
        workspaceId,
        userId,
        occurrenceKey,
        date,
        status,
        createdAt: now,
        updatedAt: now,
      };
      local.attendanceRecords.push(existing);
    }

    saveLocalData(local);
    return { record: existing };
  },

  // ==========================================================================
  // COMMUNITY CHAT MESSAGES & REACTIONS
  // ==========================================================================

  async getMessages(workspaceId: string): Promise<ClassMessage[]> {
    const supabase = getSupabaseClient();
    if (supabase && isSupabaseConfigured) {
      try {
        const { data: msgRows, error: mErr } = await supabase
          .from('class_messages')
          .select('*')
          .eq('workspace_id', workspaceId)
          .order('created_at', { ascending: true });

        if (mErr || !msgRows) return [];

        const msgIds = msgRows.map((m: { id: string }) => m.id);
        const { data: reactionsData } = await supabase
          .from('class_message_reactions')
          .select('*')
          .in('message_id', msgIds);

        // Group reactions
        const reactionMap = new Map<string, Record<string, string[]>>();
        for (const r of reactionsData || []) {
          if (!reactionMap.has(r.message_id)) reactionMap.set(r.message_id, {});
          const obj = reactionMap.get(r.message_id)!;
          if (!obj[r.emoji]) obj[r.emoji] = [];
          obj[r.emoji].push(r.user_id);
        }

        return msgRows.map((m: any) => ({
          ...mapMessageFromDb(m),
          reactions: reactionMap.get(m.id) || {},
        }));
      } catch {
        return [];
      }
    }

    const local = getLocalData();
    return local.messages.filter((m) => m.workspaceId === workspaceId);
  },

  async sendMessage(
    workspaceId: string,
    sender: { id: string; name: string; role?: ClassSpaceRole; avatarUrl?: string },
    content: string,
    replyTo?: { id: string; content: string; senderName: string }
  ): Promise<{ message?: ClassMessage; error?: string }> {
    if (!content || !content.trim()) {
      return { error: 'Message cannot be empty.' };
    }

    const now = new Date().toISOString();
    const newMsg: ClassMessage = {
      id: 'msg_' + Math.random().toString(36).substring(2, 11),
      workspaceId,
      senderId: sender.id,
      senderName: sender.name,
      senderRole: sender.role,
      senderAvatarUrl: sender.avatarUrl,
      content: content.trim(),
      replyToId: replyTo?.id,
      replyToContent: replyTo?.content,
      replyToSenderName: replyTo?.senderName,
      reactions: {},
      isPinned: false,
      isEdited: false,
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
    };

    const supabase = getSupabaseClient();
    if (supabase && isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('class_messages')
          .insert({
            workspace_id: workspaceId,
            sender_id: sender.id,
            sender_name: sender.name,
            sender_role: sender.role,
            sender_avatar_url: sender.avatarUrl,
            content: newMsg.content,
            reply_to_id: replyTo?.id,
            reply_to_content: replyTo?.content,
            reply_to_sender_name: replyTo?.senderName,
          })
          .select()
          .single();

        if (error) return { error: error.message };
        return { message: { ...mapMessageFromDb(data), reactions: {} } };
      } catch (err) {
        return { error: (err as Error).message };
      }
    }

    const local = getLocalData();
    local.messages.push(newMsg);
    saveLocalData(local);

    return { message: newMsg };
  },

  async addReaction(
    messageId: string,
    userId: string,
    emoji: string
  ): Promise<{ success: boolean; error?: string }> {
    const supabase = getSupabaseClient();
    if (supabase && isSupabaseConfigured) {
      try {
        const { error } = await supabase
          .from('class_message_reactions')
          .insert({ message_id: messageId, user_id: userId, emoji });

        if (error && !error.message.includes('duplicate')) {
          return { success: false, error: error.message };
        }
        return { success: true };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    }

    const local = getLocalData();
    const msg = local.messages.find((m) => m.id === messageId);
    if (msg) {
      if (!msg.reactions[emoji]) msg.reactions[emoji] = [];
      if (!msg.reactions[emoji].includes(userId)) {
        msg.reactions[emoji].push(userId);
        saveLocalData(local);
      }
    }
    return { success: true };
  },

  async removeReaction(
    messageId: string,
    userId: string,
    emoji: string
  ): Promise<{ success: boolean }> {
    const supabase = getSupabaseClient();
    if (supabase && isSupabaseConfigured) {
      try {
        await supabase
          .from('class_message_reactions')
          .delete()
          .eq('message_id', messageId)
          .eq('user_id', userId)
          .eq('emoji', emoji);
        return { success: true };
      } catch {
        return { success: false };
      }
    }

    const local = getLocalData();
    const msg = local.messages.find((m) => m.id === messageId);
    if (msg && msg.reactions[emoji]) {
      msg.reactions[emoji] = msg.reactions[emoji].filter((uid) => uid !== userId);
      if (msg.reactions[emoji].length === 0) delete msg.reactions[emoji];
      saveLocalData(local);
    }
    return { success: true };
  },

  async editMessage(
    messageId: string,
    userId: string,
    newContent: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!newContent.trim()) return { success: false, error: 'Message cannot be empty.' };

    const supabase = getSupabaseClient();
    if (supabase && isSupabaseConfigured) {
      try {
        const { error } = await supabase
          .from('class_messages')
          .update({ content: newContent.trim(), is_edited: true, updated_at: new Date().toISOString() })
          .eq('id', messageId)
          .eq('sender_id', userId);

        if (error) return { success: false, error: error.message };
        return { success: true };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    }

    const local = getLocalData();
    const msg = local.messages.find((m) => m.id === messageId);
    if (msg && msg.senderId === userId) {
      msg.content = newContent.trim();
      msg.isEdited = true;
      msg.updatedAt = new Date().toISOString();
      saveLocalData(local);
      return { success: true };
    }
    return { success: false, error: 'Unauthorized or message not found.' };
  },

  async deleteMessage(
    workspaceId: string,
    messageId: string,
    actorUserId: string,
    actorRole?: ClassSpaceRole
  ): Promise<{ success: boolean; error?: string }> {
    const isCRorAdmin = actorRole === 'cr' || actorRole === 'co_admin';

    const supabase = getSupabaseClient();
    if (supabase && isSupabaseConfigured) {
      try {
        let query = supabase.from('class_messages').update({
          is_deleted: true,
          content: 'This message was deleted.',
          updated_at: new Date().toISOString(),
        }).eq('id', messageId);

        if (!isCRorAdmin) {
          query = query.eq('sender_id', actorUserId);
        }

        const { error } = await query;
        if (error) return { success: false, error: error.message };
        return { success: true };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    }

    const local = getLocalData();
    const msg = local.messages.find((m) => m.id === messageId && m.workspaceId === workspaceId);
    if (msg && (msg.senderId === actorUserId || isCRorAdmin)) {
      msg.isDeleted = true;
      msg.content = 'This message was deleted.';
      msg.updatedAt = new Date().toISOString();
      saveLocalData(local);
      return { success: true };
    }
    return { success: false, error: 'Unauthorized.' };
  },

  async togglePinMessage(
    workspaceId: string,
    messageId: string,
    actorRole?: ClassSpaceRole
  ): Promise<{ success: boolean; error?: string }> {
    if (actorRole !== 'cr' && actorRole !== 'co_admin') {
      return { success: false, error: 'Only CR or Co-Admin can pin announcements.' };
    }

    const local = getLocalData();
    const msg = local.messages.find((m) => m.id === messageId && m.workspaceId === workspaceId);
    if (!msg) return { success: false, error: 'Message not found.' };

    const newPinned = !msg.isPinned;

    const supabase = getSupabaseClient();
    if (supabase && isSupabaseConfigured) {
      try {
        const { error } = await supabase
          .from('class_messages')
          .update({ is_pinned: newPinned })
          .eq('id', messageId);

        if (error) return { success: false, error: error.message };
        return { success: true };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    }

    msg.isPinned = newPinned;
    saveLocalData(local);
    return { success: true };
  },

  // ==========================================================================
  // SAVED / BOOKMARKED MESSAGES
  // ==========================================================================

  async getSavedMessages(workspaceId: string, userId: string): Promise<ClassSavedMessage[]> {
    const supabase = getSupabaseClient();
    if (supabase && isSupabaseConfigured) {
      try {
        const { data } = await supabase
          .from('class_saved_messages')
          .select('*')
          .eq('workspace_id', workspaceId)
          .eq('user_id', userId);
        return (data || []).map(mapSavedMessageFromDb);
      } catch {
        return [];
      }
    }

    const local = getLocalData();
    return local.savedMessages.filter((s) => s.workspaceId === workspaceId && s.userId === userId);
  },

  async toggleSaveMessage(
    workspaceId: string,
    userId: string,
    messageId: string
  ): Promise<{ isSaved: boolean }> {
    const local = getLocalData();
    const existingIndex = local.savedMessages.findIndex(
      (s) => s.workspaceId === workspaceId && s.userId === userId && s.messageId === messageId
    );

    const isAlreadySaved = existingIndex >= 0;

    const supabase = getSupabaseClient();
    if (supabase && isSupabaseConfigured) {
      try {
        if (isAlreadySaved) {
          await supabase
            .from('class_saved_messages')
            .delete()
            .eq('workspace_id', workspaceId)
            .eq('user_id', userId)
            .eq('message_id', messageId);
          return { isSaved: false };
        } else {
          await supabase
            .from('class_saved_messages')
            .insert({ workspace_id: workspaceId, user_id: userId, message_id: messageId });
          return { isSaved: true };
        }
      } catch {
        // Fallback to local
      }
    }

    if (isAlreadySaved) {
      local.savedMessages.splice(existingIndex, 1);
    } else {
      local.savedMessages.push({
        id: 'save_' + Math.random().toString(36).substring(2, 9),
        workspaceId,
        userId,
        messageId,
        savedAt: new Date().toISOString(),
      });
    }
    saveLocalData(local);

    return { isSaved: !isAlreadySaved };
  },

  // ==========================================================================
  // NOTIFICATIONS
  // ==========================================================================

  async getNotifications(workspaceId: string, userId: string): Promise<ClassNotification[]> {
    const supabase = getSupabaseClient();
    if (supabase && isSupabaseConfigured) {
      try {
        const { data } = await supabase
          .from('class_notifications')
          .select('*')
          .eq('workspace_id', workspaceId)
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(50);
        return (data || []).map(mapNotificationFromDb);
      } catch {
        return [];
      }
    }

    const local = getLocalData();
    return local.notifications
      .filter((n) => n.workspaceId === workspaceId && n.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async markNotificationRead(notificationId: string): Promise<void> {
    const supabase = getSupabaseClient();
    if (supabase && isSupabaseConfigured) {
      try {
        await supabase
          .from('class_notifications')
          .update({ is_read: true })
          .eq('id', notificationId);
      } catch {
        // Ignored
      }
    }

    const local = getLocalData();
    const notif = local.notifications.find((n) => n.id === notificationId);
    if (notif) {
      notif.isRead = true;
      saveLocalData(local);
    }
  },

  async markAllNotificationsRead(workspaceId: string, userId: string): Promise<void> {
    const supabase = getSupabaseClient();
    if (supabase && isSupabaseConfigured) {
      try {
        await supabase
          .from('class_notifications')
          .update({ is_read: true })
          .eq('workspace_id', workspaceId)
          .eq('user_id', userId);
      } catch {
        // Ignored
      }
    }

    const local = getLocalData();
    for (const n of local.notifications) {
      if (n.workspaceId === workspaceId && n.userId === userId) {
        n.isRead = true;
      }
    }
    saveLocalData(local);
  },

  async dispatchNotificationToMembers(
    workspaceId: string,
    originatorUserId: string,
    payload: { title: string; body: string; type: ClassNotification['type']; linkOccurrenceId?: string }
  ): Promise<void> {
    const members = await this.getMembers(workspaceId);
    const recipients = members.filter((m) => m.userId !== originatorUserId);

    const now = new Date().toISOString();
    const newNotifs: ClassNotification[] = recipients.map((r) => ({
      id: 'notif_' + Math.random().toString(36).substring(2, 11),
      workspaceId,
      userId: r.userId,
      title: payload.title,
      body: payload.body,
      type: payload.type,
      isRead: false,
      linkOccurrenceId: payload.linkOccurrenceId,
      createdAt: now,
    }));

    const supabase = getSupabaseClient();
    if (supabase && isSupabaseConfigured && newNotifs.length > 0) {
      try {
        await supabase.from('class_notifications').insert(
          newNotifs.map((n) => ({
            workspace_id: n.workspaceId,
            user_id: n.userId,
            title: n.title,
            body: n.body,
            type: n.type,
            is_read: false,
            link_occurrence_id: n.linkOccurrenceId,
          }))
        );
        return;
      } catch (err) {
        console.warn('[ClassSpaceService] dispatchNotification error:', err);
      }
    }

    const local = getLocalData();
    local.notifications.push(...newNotifs);
    saveLocalData(local);
  },

  // ==========================================================================
  // PROFILE & AVATAR HANDLING
  // ==========================================================================

  async getUserProfile(userId: string): Promise<ClassUserProfile> {
    const defaultProfile: ClassUserProfile = {
      userId,
      displayName: 'Student',
      notificationPreferences: {
        timetableAlerts: true,
        extraClasses: true,
        cancellations: true,
        communityReplies: true,
      },
    };

    const supabase = getSupabaseClient();
    if (supabase && isSupabaseConfigured) {
      try {
        const { data } = await supabase
          .from('class_profiles')
          .select('*')
          .eq('user_id', userId)
          .single();

        if (data) {
          return {
            userId: data.user_id,
            displayName: data.display_name,
            avatarUrl: data.avatar_url,
            notificationPreferences: data.notification_preferences || defaultProfile.notificationPreferences,
          };
        }
      } catch {
        // Fallback
      }
    }

    const local = getLocalData();
    return local.profiles[userId] || defaultProfile;
  },

  async updateUserProfile(
    userId: string,
    updates: Partial<ClassUserProfile>
  ): Promise<{ profile?: ClassUserProfile; error?: string }> {
    const current = await this.getUserProfile(userId);
    const updated: ClassUserProfile = {
      ...current,
      ...updates,
      notificationPreferences: {
        ...current.notificationPreferences,
        ...(updates.notificationPreferences || {}),
      },
    };

    const supabase = getSupabaseClient();
    if (supabase && isSupabaseConfigured) {
      try {
        const { error } = await supabase
          .from('class_profiles')
          .upsert({
            user_id: userId,
            display_name: updated.displayName,
            avatar_url: updated.avatarUrl,
            notification_preferences: updated.notificationPreferences,
            updated_at: new Date().toISOString(),
          });

        if (error) return { error: error.message };
      } catch (err) {
        return { error: (err as Error).message };
      }
    }

    const local = getLocalData();
    local.profiles[userId] = updated;
    // Update matching members
    for (const m of local.members) {
      if (m.userId === userId) {
        m.displayName = updated.displayName;
        m.avatarUrl = updated.avatarUrl;
      }
    }
    saveLocalData(local);

    return { profile: updated };
  },

  async uploadAvatar(
    userId: string,
    file: File
  ): Promise<{ avatarUrl?: string; error?: string }> {
    const supabase = getSupabaseClient();
    if (supabase && isSupabaseConfigured) {
      try {
        const fileExt = file.name.split('.').pop() || 'png';
        const filePath = `${userId}/avatar_${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('classspace-avatars')
          .upload(filePath, file, { upsert: true });

        if (uploadError) return { error: uploadError.message };

        const { data } = supabase.storage
          .from('classspace-avatars')
          .getPublicUrl(filePath);

        return { avatarUrl: data.publicUrl };
      } catch (err) {
        return { error: (err as Error).message };
      }
    }

    // Local DataURL fallback
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve({ avatarUrl: reader.result as string });
      reader.onerror = () => resolve({ error: 'Failed to read avatar file.' });
      reader.readAsDataURL(file);
    });
  },

  // ==========================================================================
  // REALTIME SUBSCRIPTION
  // ==========================================================================

  subscribeToWorkspace(workspaceId: string, onUpdate: () => void): () => void {
    const supabase = getSupabaseClient();
    if (supabase && isSupabaseConfigured) {
      try {
        const channel = supabase
          .channel(`classspace:${workspaceId}`)
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', filter: `workspace_id=eq.${workspaceId}` },
            () => onUpdate()
          )
          .subscribe();

        return () => {
          supabase.removeChannel(channel);
        };
      } catch {
        // Fallback to storage listener below
      }
    }

    // Cross-tab local storage update listener
    const handler = () => onUpdate();
    window.addEventListener('tracker_classspace_updated', handler);
    window.addEventListener('storage', handler);

    return () => {
      window.removeEventListener('tracker_classspace_updated', handler);
      window.removeEventListener('storage', handler);
    };
  },
};

// ==============================================================================
// DATABASE ROW MAPPERS
// ==============================================================================

function mapWorkspaceFromDb(row: any): ClassSpaceWorkspace {
  return {
    id: row.id,
    name: row.name,
    department: row.department,
    section: row.section,
    batch: row.batch,
    description: row.description,
    joinCode: row.join_code,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapMemberFromDb(row: any): ClassSpaceMember {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    userId: row.user_id,
    role: row.role,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    isMuted: row.is_muted,
    joinedAt: row.joined_at,
  };
}

function mapRuleFromDb(row: any): ClassTimetableRule {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    subjectName: row.subject_name,
    subjectCode: row.subject_code,
    subjectColor: row.subject_color,
    dayOfWeek: row.day_of_week,
    startTime: row.start_time,
    endTime: row.end_time,
    room: row.room,
    instructor: row.instructor,
    notes: row.notes,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapOverrideFromDb(row: any): ClassTimetableOverride {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    ruleId: row.rule_id,
    originalDate: row.original_date,
    type: row.type,
    newDate: row.new_date,
    newStartTime: row.new_start_time,
    newEndTime: row.new_end_time,
    newRoom: row.new_room,
    newNotes: row.new_notes,
    changeNote: row.change_note,
    subjectName: row.subject_name,
    subjectCode: row.subject_code,
    subjectColor: row.subject_color,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

function mapAttendanceFromDb(row: any): ClassAttendanceRecord {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    userId: row.user_id,
    occurrenceKey: row.occurrence_key,
    date: row.date,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapMessageFromDb(row: any): ClassMessage {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    senderId: row.sender_id,
    senderName: row.sender_name,
    senderRole: row.sender_role,
    senderAvatarUrl: row.sender_avatar_url,
    content: row.content,
    replyToId: row.reply_to_id,
    replyToContent: row.reply_to_content,
    replyToSenderName: row.reply_to_sender_name,
    reactions: {},
    isPinned: row.is_pinned,
    isEdited: row.is_edited,
    isDeleted: row.is_deleted,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapSavedMessageFromDb(row: any): ClassSavedMessage {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    userId: row.user_id,
    messageId: row.message_id,
    savedAt: row.saved_at,
  };
}

function mapNotificationFromDb(row: any): ClassNotification {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    userId: row.user_id,
    title: row.title,
    body: row.body,
    type: row.type,
    isRead: row.is_read,
    linkOccurrenceId: row.link_occurrence_id,
    createdAt: row.created_at,
  };
}

