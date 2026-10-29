import { getSupabaseClient, isSupabaseConfigured, AuthUser } from './authService';
import {
  ClassSpaceWorkspace,
  ClassSpaceMember,
  ClassSpaceRole,
  ClassSpaceChannel,
  ClassJoinRequest,
  ClassJoinRequestStatus,
  ClassTimetableRule,
  ClassTimetableOverride,
  ClassAttendanceRecord,
  ClassMessage,
  ClassMessageType,
  ClassPoll,
  ClassPollOption,
  ClassResourceAttachment,
  ClassResourceCategory,
  ClassSavedMessage,
  ClassNotification,
  ClassUserProfile,
} from '../types/classSpace';
import {
  generateJoinCode,
  normalizeJoinCode,
  isValidJoinCode,
  canManageSchedule,
  canManageWorkspace,
  canPublishNotice,
} from '../utils/classSpaceUtils';

const LOCAL_STORE_KEY = 'tracker_classspace_data_v1';

export const DEFAULT_CHANNELS_TEMPLATE = [
  {
    name: 'The Commons',
    slug: 'the-commons',
    description: 'General class discussion, questions, and coordination',
    position: 1,
    isDefault: true,
  },
  {
    name: 'Study Vault',
    slug: 'study-vault',
    description: 'Notes, PDFs, study material, resources, and academic discussions',
    position: 2,
    isDefault: true,
  },
  {
    name: 'Class Pulse',
    slug: 'class-pulse',
    description: 'Official class updates, timetable changes, and alerts',
    position: 3,
    isDefault: true,
  },
];

export function ensureDefaultChannelsForWorkspace(
  workspaceId: string,
  existingChannels: ClassSpaceChannel[],
  createdBy?: string
): ClassSpaceChannel[] {
  const channels = [...existingChannels];
  const now = new Date().toISOString();
  for (const template of DEFAULT_CHANNELS_TEMPLATE) {
    const exists = channels.some((c) => c.workspaceId === workspaceId && c.slug === template.slug);
    if (!exists) {
      channels.push({
        id: `chan_${template.slug}_${workspaceId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8)}`,
        workspaceId,
        name: template.name,
        slug: template.slug,
        description: template.description,
        isDefault: true,
        position: template.position,
        createdBy,
        createdAt: now,
        updatedAt: now,
      });
    }
  }
  return channels;
}

interface LocalClassSpaceData {
  workspaces: ClassSpaceWorkspace[];
  members: ClassSpaceMember[];
  channels: ClassSpaceChannel[];
  joinRequests: ClassJoinRequest[];
  rules: ClassTimetableRule[];
  overrides: ClassTimetableOverride[];
  attendanceRecords: ClassAttendanceRecord[];
  messages: ClassMessage[];
  savedMessages: ClassSavedMessage[];
  notifications: ClassNotification[];
  profiles: Record<string, ClassUserProfile>;
}

// Empty local store representation generator for offline / local-first operation
function createEmptyLocalData(): LocalClassSpaceData {
  return {
    workspaces: [],
    members: [],
    channels: [],
    joinRequests: [],
    rules: [],
    overrides: [],
    attendanceRecords: [],
    messages: [],
    savedMessages: [],
    notifications: [],
    profiles: {},
  };
}

/**
 * Loads raw data from local storage with clean empty initialization (no fabricated demo data)
 */
function getLocalData(): LocalClassSpaceData {
  try {
    const raw = localStorage.getItem(LOCAL_STORE_KEY);
    if (!raw) {
      const fresh = createEmptyLocalData();
      localStorage.setItem(LOCAL_STORE_KEY, JSON.stringify(fresh));
      return fresh;
    }
    const parsed = JSON.parse(raw) as Partial<LocalClassSpaceData>;
    // Migrate away any previous demo workspace 'ws_demo_cs2026' so production is never seeded with fake data
    const workspaces = (parsed.workspaces || []).filter((w) => w.id !== 'ws_demo_cs2026');
    const members = (parsed.members || []).filter((m) => m.workspaceId !== 'ws_demo_cs2026');
    const channels = parsed.channels || [];
    const joinRequests = parsed.joinRequests || [];
    const rules = (parsed.rules || []).filter((r) => r.workspaceId !== 'ws_demo_cs2026');
    const overrides = (parsed.overrides || []).filter((o) => o.workspaceId !== 'ws_demo_cs2026');
    const attendanceRecords = (parsed.attendanceRecords || []).filter((a) => a.workspaceId !== 'ws_demo_cs2026');
    const messages = (parsed.messages || []).filter((m) => m.workspaceId !== 'ws_demo_cs2026');
    const savedMessages = (parsed.savedMessages || []).filter((s) => s.workspaceId !== 'ws_demo_cs2026');
    const notifications = (parsed.notifications || []).filter((n) => n.workspaceId !== 'ws_demo_cs2026');
    const profiles = parsed.profiles || {};

    return {
      workspaces,
      members,
      channels,
      joinRequests,
      rules,
      overrides,
      attendanceRecords,
      messages,
      savedMessages,
      notifications,
      profiles,
    };
  } catch {
    return createEmptyLocalData();
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

let recentFailedLookups: number[] = [];
export const RATE_LIMIT_MAX_FAILED_ATTEMPTS = 5;
export const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 60 seconds

export function resetLookupRateLimiter(): void {
  recentFailedLookups = [];
}

export function isLookupRateLimited(): boolean {
  const now = Date.now();
  recentFailedLookups = recentFailedLookups.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  return recentFailedLookups.length >= RATE_LIMIT_MAX_FAILED_ATTEMPTS;
}

export function recordFailedLookup(): void {
  recentFailedLookups.push(Date.now());
}

/**
 * Checks whether an identifier is a local-only / simulated / non-UUID ID.
 * Any non-UUID (e.g. 'usr_local_*', 'ws_*', 'mem_*', 'rule_*', 'ov_*', 'att_*', 'msg_*', 'save_*', 'notif_*', etc.)
 * must never be sent to Postgres tables with UUID primary/foreign keys.
 */
export function isLocalId(id?: string | null): boolean {
  if (!id || typeof id !== 'string') return true;
  const trimmed = id.trim();
  if (
    trimmed.startsWith('usr_local_') ||
    trimmed.startsWith('ws_') ||
    trimmed.startsWith('mem_') ||
    trimmed.startsWith('rule_') ||
    trimmed.startsWith('ov_') ||
    trimmed.startsWith('ovr_') ||
    trimmed.startsWith('att_') ||
    trimmed.startsWith('msg_') ||
    trimmed.startsWith('save_') ||
    trimmed.startsWith('notif_') ||
    trimmed.startsWith('opt_') ||
    trimmed.startsWith('poll_') ||
    trimmed === 'usr_google_student_demo'
  ) {
    return true;
  }
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return !UUID_REGEX.test(trimmed);
}

/**
 * Formats Supabase PostgREST error objects with code, details, and hint.
 */
export function formatSupabaseError(err: any, fallback: string = 'An unknown cloud error occurred.'): string {
  if (!err) return fallback;
  if (typeof err === 'string') return err;
  const parts: string[] = [];
  if (err.message) parts.push(err.message);
  else parts.push(fallback);
  if (err.code) parts.push(`(code: ${err.code})`);
  if (err.details) parts.push(`details: ${err.details}`);
  if (err.hint) parts.push(`hint: ${err.hint}`);
  return parts.join(' - ');
}

/**
 * Checks whether cloud Supabase is available and ready for operation.
 * In production, strictly requires genuine credentials.
 * In test mode, permits active mocked Supabase client instances.
 */
export function isCloudAvailable(): boolean {
  const client = getSupabaseClient();
  if (!client) return false;
  return isSupabaseConfigured || (typeof process !== 'undefined' && process.env?.NODE_ENV === 'test');
}

export const classSpaceService = {
  get isCloudConfigured(): boolean {
    return isCloudAvailable();
  },
  isLocalId,
  isCloudAvailable,

  archiveAndClearLocalData(userId?: string): void {
    if (userId) {
      try {
        const raw = localStorage.getItem(LOCAL_STORE_KEY);
        if (raw) {
          localStorage.setItem(`tracker_classspace_archive_${userId}`, raw);
        }
      } catch (err) {
        console.warn('[ClassSpaceService] Failed to archive user classspace data:', err);
      }
    }
    try {
      localStorage.removeItem(LOCAL_STORE_KEY);
      localStorage.removeItem('tracker_active_workspace_id');
      localStorage.removeItem('tracker_active_nav_tab');
      window.dispatchEvent(new Event('tracker_classspace_updated'));
    } catch (err) {
      console.warn('[ClassSpaceService] Failed to clear local classspace data on signout:', err);
    }
  },

  restoreArchivedData(userId?: string): void {
    if (!userId) return;
    try {
      const archived = localStorage.getItem(`tracker_classspace_archive_${userId}`);
      if (archived) {
        localStorage.setItem(LOCAL_STORE_KEY, archived);
        window.dispatchEvent(new Event('tracker_classspace_updated'));
      }
      const userSavedWs = localStorage.getItem(`tracker_active_workspace_id_${userId}`);
      if (userSavedWs) {
        localStorage.setItem('tracker_active_workspace_id', userSavedWs);
      }
      const userSavedTab = localStorage.getItem(`tracker_active_nav_tab_${userId}`);
      if (userSavedTab) {
        localStorage.setItem('tracker_active_nav_tab', userSavedTab);
      }
    } catch (err) {
      console.warn('[ClassSpaceService] Failed to restore archived user classspace data:', err);
    }
  },

  // ==========================================================================
  // WORKSPACES
  // ==========================================================================

  async getWorkspacesForUser(userId: string): Promise<ClassSpaceWorkspace[]> {
    const local = getLocalData();
    const joinedWsIds = new Set(
      local.members.filter((m) => m.userId === userId).map((m) => m.workspaceId)
    );
    const localWorkspaces = local.workspaces.filter((w) => joinedWsIds.has(w.id));

    // Never query Supabase with non-UUID local user IDs
    if (isLocalId(userId)) {
      return localWorkspaces;
    }

    const supabase = getSupabaseClient();
    if (supabase && isCloudAvailable()) {
      try {
        const { data: memberRows, error: mError } = await supabase
          .from('class_members')
          .select('workspace_id')
          .eq('user_id', userId);

        if (!mError && memberRows && memberRows.length > 0) {
          const wsIds = memberRows.map((r: { workspace_id: string }) => r.workspace_id);

          const { data: workspaces, error: wsError } = await supabase
            .from('class_workspaces')
            .select('*')
            .in('id', wsIds);

          if (!wsError && workspaces) {
            const cloudWorkspaces = workspaces.map(mapWorkspaceFromDb);
            const combinedMap = new Map<string, ClassSpaceWorkspace>();
            cloudWorkspaces.forEach((w) => combinedMap.set(w.id, w));
            localWorkspaces.forEach((w) => combinedMap.set(w.id, w));
            return Array.from(combinedMap.values());
          }
        }
      } catch (err) {
        console.warn('[ClassSpaceService] Supabase getWorkspaces error:', err);
      }
    }

    return localWorkspaces;
  },

  async createWorkspace(
    user: AuthUser,
    details: {
      name: string;
      college?: string;
      institution?: string;
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

    const instName = details.institution?.trim() || details.college?.trim();

    const newWorkspace: ClassSpaceWorkspace = {
      id: wsId,
      name: details.name.trim(),
      institution: instName,
      college: instName,
      department: details.department?.trim(),
      section: details.section?.trim(),
      batch: details.batch?.trim(),
      description: details.description?.trim(),
      joinCode,
      createdBy: user.id,
      createdAt: now,
      updatedAt: now,
    };

    const ownerMember: ClassSpaceMember = {
      id: 'mem_' + Math.random().toString(36).substring(2, 11),
      workspaceId: wsId,
      userId: user.id,
      role: 'owner',
      joinedAt: now,
      displayName: user.name || user.email.split('@')[0],
      email: user.email,
      avatarUrl: user.avatarUrl,
    };

    const supabase = getSupabaseClient();
    if (supabase && isCloudAvailable() && !isLocalId(user.id)) {
      if (!user || user.isSimulated) {
        return { error: 'Authentication required: You must be signed in with a verified account to create cloud ClassSpace workspaces.' };
      }
      try {
        // Strategy 1: Server-authoritative atomic creation via RPC
        if (typeof supabase.rpc === 'function') {
          try {
            const { data: rpcData, error: rpcError } = await supabase.rpc('create_class_workspace', {
              p_name: newWorkspace.name,
              p_institution: instName || null,
              p_department: newWorkspace.department || null,
              p_section: newWorkspace.section || null,
              p_batch: newWorkspace.batch || null,
              p_description: newWorkspace.description || null,
              p_display_name: ownerMember.displayName,
              p_avatar_url: ownerMember.avatarUrl || null,
            });

            if (rpcError) {
              const isMissingFunction =
                rpcError.code === 'PGRST202' ||
                rpcError.code === '42883' ||
                /function .* does not exist|could not find the function/i.test(rpcError.message || '');

              // For ANY unexpected server error that is NOT a missing function, fail fast and report real Supabase error.
              // NEVER fall back to direct table insertion on permissions or database errors.
              if (!isMissingFunction) {
                console.error('[ClassSpaceService] create_class_workspace RPC error:', rpcError);
                return { error: formatSupabaseError(rpcError, 'Cloud workspace creation RPC failed') };
              }

              console.warn('[ClassSpaceService] create_class_workspace RPC missing on server, attempting fallback direct insert:', rpcError);
            } else if (rpcData && typeof rpcData === 'object') {
              if ('error' in rpcData && rpcData.error) {
                return { error: String(rpcData.error) };
              }
              if ('workspace' in rpcData && 'member' in rpcData) {
                const cloudWs = mapWorkspaceFromDb(rpcData.workspace);
                const cloudMem = mapMemberFromDb(rpcData.member);
                if (user.email && !cloudMem.email) {
                  cloudMem.email = user.email;
                }
                return { workspace: cloudWs, member: cloudMem };
              }
              return { error: 'Unexpected response format from create_class_workspace RPC.' };
            }
          } catch (rpcErr) {
            console.warn('[ClassSpaceService] create_class_workspace RPC threw unexpectedly:', rpcErr);
            return { error: rpcErr instanceof Error ? rpcErr.message : 'ClassSpace creation failed on cloud server.' };
          }
        }

        // Strategy 2: Direct table insert fallback if RPC is unconfigured/pending migration
        const { data: wsData, error: wsError } = await supabase
          .from('class_workspaces')
          .insert({
            name: newWorkspace.name,
            institution: instName,
            department: newWorkspace.department,
            section: newWorkspace.section,
            batch: newWorkspace.batch,
            description: newWorkspace.description,
            join_code: newWorkspace.joinCode,
            created_by: user.id,
          })
          .select()
          .single();

        if (wsError) {
          return { error: formatSupabaseError(wsError, 'Failed to create workspace in cloud') };
        }

        const insertedWs = mapWorkspaceFromDb(wsData);

        const { data: mData, error: mError } = await supabase
          .from('class_members')
          .insert({
            workspace_id: insertedWs.id,
            user_id: user.id,
            role: 'owner',
            display_name: ownerMember.displayName,
            avatar_url: ownerMember.avatarUrl,
          })
          .select()
          .single();

        if (mError) {
          // Clean up dangling workspace if initial member insert fails
          try {
            await supabase.from('class_workspaces').delete().eq('id', insertedWs.id);
          } catch {}
          return { error: formatSupabaseError(mError, 'Failed to create workspace owner membership in cloud') };
        }

        const insertedMember = mapMemberFromDb(mData);
        if (user.email && !insertedMember.email) {
          insertedMember.email = user.email;
        }

        return { workspace: insertedWs, member: insertedMember };
      } catch (err) {
        console.warn('[ClassSpaceService] Supabase createWorkspace error:', err);
        return { error: err instanceof Error ? err.message : 'Failed to create workspace in cloud.' };
      }
    }

    // Local fallback
    local.workspaces.push(newWorkspace);
    local.members.push(ownerMember);
    local.channels = ensureDefaultChannelsForWorkspace(newWorkspace.id, local.channels, user.id);
    saveLocalData(local);

    return { workspace: newWorkspace, member: ownerMember };
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
      recordFailedLookup();
      return { error: 'Invalid ClassSpace code format. Must be 5 alphanumeric characters.' };
    }

    if (isLookupRateLimited()) {
      return { error: 'Too many invalid attempts. Please wait 60 seconds before trying again.' };
    }

    const supabase = getSupabaseClient();
    if (supabase && isCloudAvailable() && !isLocalId(user.id) && !user.isSimulated) {
      try {
        // Enforce join-code validation at database boundary via trusted RPC
        const { data, error } = await supabase.rpc('join_class_workspace', {
          p_join_code: normalized,
          p_display_name: user.name || user.email.split('@')[0],
          p_avatar_url: user.avatarUrl || null,
        });

        if (error) {
          recordFailedLookup();
          return { error: error.message };
        }

        if (data && typeof data === 'object') {
          if ('error' in data && data.error) {
            recordFailedLookup();
            return { error: String(data.error) };
          }
          if ('workspace' in data && 'member' in data) {
            const joinedMember = mapMemberFromDb(data.member);
            if (user.email && !joinedMember.email) {
              joinedMember.email = user.email;
            }
            return {
              workspace: mapWorkspaceFromDb(data.workspace),
              member: joinedMember,
            };
          }
        }
        recordFailedLookup();
        return { error: 'Unable to join ClassSpace: unexpected response from cloud server.' };
      } catch (err) {
        recordFailedLookup();
        console.warn('[ClassSpaceService] Supabase joinWorkspace RPC error:', err);
        return { error: err instanceof Error ? err.message : 'Failed to join ClassSpace in cloud.' };
      }
    }

    // Local fallback
    const local = getLocalData();
    const workspace = local.workspaces.find((w) => w.joinCode === normalized);

    if (!workspace) {
      recordFailedLookup();
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
      email: user.email,
      avatarUrl: user.avatarUrl,
    };

    local.members.push(newMember);
    saveLocalData(local);

    return { workspace, member: newMember };
  },

  async lookupWorkspaceByCode(
    rawCode: string
  ): Promise<{ workspace?: ClassSpaceWorkspace; error?: string }> {
    const normalized = normalizeJoinCode(rawCode);
    if (!isValidJoinCode(normalized)) {
      recordFailedLookup();
      return { error: 'Invalid ClassSpace code format. Must be 5 alphanumeric characters.' };
    }

    if (isLookupRateLimited()) {
      return { error: 'Too many invalid attempts. Please wait 60 seconds before trying again.' };
    }

    const supabase = getSupabaseClient();
    if (supabase && isCloudAvailable()) {
      try {
        // Enforce minimal metadata exposure via secure RPC (prevents directory scraping)
        const { data, error } = await supabase.rpc('lookup_workspace_by_join_code', {
          p_join_code: normalized,
        });

        if (error) {
          recordFailedLookup();
          return { error: error.message };
        }

        if (Array.isArray(data) && data.length > 0) {
          const row = data[0];
          const inst = row.institution || row.college || undefined;
          return {
            workspace: {
              id: row.id,
              name: row.name,
              college: inst,
              institution: inst,
              department: row.department,
              section: row.section,
              batch: row.batch,
              description: row.description,
              joinCode: normalized,
              createdBy: '',
              createdAt: '',
              updatedAt: '',
            },
          };
        }

        // When cloud is active and query returns empty, workspace is not in cloud database
        recordFailedLookup();
        return { error: 'No ClassSpace found with this Join Code.' };
      } catch (err) {
        recordFailedLookup();
        console.warn('[ClassSpaceService] lookupWorkspace RPC error:', err);
        return { error: err instanceof Error ? err.message : 'Failed to lookup workspace in cloud.' };
      }
    }

    const local = getLocalData();
    const ws = local.workspaces.find((w) => w.joinCode === normalized);
    if (!ws) {
      recordFailedLookup();
      return { error: 'No ClassSpace found with this Join Code.' };
    }
    return { workspace: ws };
  },

  async rotateJoinCode(
    workspaceId: string,
    userId: string
  ): Promise<{ newCode?: string; error?: string }> {
    const supabase = getSupabaseClient();
    const isCloud = supabase && isCloudAvailable() && !isLocalId(workspaceId) && !isLocalId(userId);

    const newCode = generateJoinCode();

    if (isCloud) {
      try {
        // Enforce database-level authorization: RLS policy "Only CR can update workspace details or rotate code"
        // checks public.is_class_cr(id, auth.uid()). If unauthorized in database, 0 rows are updated.
        const { data, error } = await supabase
          .from('class_workspaces')
          .update({ join_code: newCode, updated_at: new Date().toISOString() })
          .eq('id', workspaceId)
          .select('id, join_code');

        if (error) return { error: error.message };
        if (!data || data.length === 0) {
          return { error: 'Unauthorized: Only the Class Representative (CR) or Owner can rotate the join code.' };
        }

        // Keep local cache in sync if present
        const local = getLocalData();
        const ws = local.workspaces.find((w) => w.id === workspaceId);
        if (ws) {
          ws.joinCode = newCode;
          ws.updatedAt = new Date().toISOString();
          saveLocalData(local);
        }

        return { newCode };
      } catch (err) {
        console.warn('[ClassSpaceService] rotateJoinCode error:', err);
        return { error: err instanceof Error ? err.message : 'Failed to rotate join code in cloud.' };
      }
    }

    // Local / Offline fallback
    const local = getLocalData();
    const ws = local.workspaces.find((w) => w.id === workspaceId);
    if (!ws) return { error: 'ClassSpace not found.' };

    const member = local.members.find((m) => m.workspaceId === workspaceId && m.userId === userId);
    if (!member || (member.role !== 'cr' && member.role !== 'owner')) {
      return { error: 'Only the Class Representative (CR) or Owner can rotate the join code.' };
    }

    ws.joinCode = newCode;
    ws.updatedAt = new Date().toISOString();
    saveLocalData(local);

    return { newCode };
  },

  async deleteWorkspace(workspaceId: string, userId: string): Promise<{ success: boolean; error?: string }> {
    const local = getLocalData();
    const ws = local.workspaces.find((w) => w.id === workspaceId);
    if (!ws) return { success: false, error: 'ClassSpace not found.' };

    const member = local.members.find((m) => m.workspaceId === workspaceId && m.userId === userId);
    if (ws.createdBy !== userId && member?.role !== 'owner') {
      return { success: false, error: 'Only the ClassSpace Owner can delete this workspace.' };
    }

    const supabase = getSupabaseClient();
    if (supabase && isCloudAvailable() && !isLocalId(workspaceId) && !isLocalId(userId)) {
      try {
        const { error } = await supabase
          .from('class_workspaces')
          .delete()
          .eq('id', workspaceId);

        if (error) return { success: false, error: error.message };
        return { success: true };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    }

    local.workspaces = local.workspaces.filter((w) => w.id !== workspaceId);
    local.members = local.members.filter((m) => m.workspaceId !== workspaceId);
    local.rules = local.rules.filter((r) => r.workspaceId !== workspaceId);
    local.overrides = local.overrides.filter((o) => o.workspaceId !== workspaceId);
    local.attendanceRecords = local.attendanceRecords.filter((a) => a.workspaceId !== workspaceId);
    local.messages = local.messages.filter((m) => m.workspaceId !== workspaceId);
    local.savedMessages = local.savedMessages.filter((s) => s.workspaceId !== workspaceId);
    local.notifications = local.notifications.filter((n) => n.workspaceId !== workspaceId);
    saveLocalData(local);

    return { success: true };
  },

  async leaveWorkspace(workspaceId: string, userId: string): Promise<{ success: boolean; error?: string }> {
    const supabase = getSupabaseClient();
    if (supabase && isCloudAvailable() && !isLocalId(workspaceId) && !isLocalId(userId)) {
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
  // CHANNELS (THE COMMONS, STUDY VAULT, CLASS PULSE, & CUSTOM)
  // ==========================================================================

  async getChannels(workspaceId: string): Promise<ClassSpaceChannel[]> {
    const supabase = getSupabaseClient();
    if (supabase && isCloudAvailable() && !isLocalId(workspaceId)) {
      try {
        const { data, error } = await supabase
          .from('class_channels')
          .select('*')
          .eq('workspace_id', workspaceId)
          .order('position', { ascending: true });

        if (!error && data && data.length > 0) {
          return data.map(mapChannelFromDb);
        }
      } catch (err) {
        console.warn('[ClassSpaceService] getChannels cloud error:', err);
      }
    }

    const local = getLocalData();
    local.channels = ensureDefaultChannelsForWorkspace(workspaceId, local.channels || []);
    saveLocalData(local);
    return (local.channels || [])
      .filter((c) => c.workspaceId === workspaceId)
      .sort((a, b) => a.position - b.position);
  },

  async createChannel(
    workspaceId: string,
    actingUserId: string,
    name: string,
    description?: string
  ): Promise<{ channel?: ClassSpaceChannel; error?: string }> {
    if (!name || !name.trim()) return { error: 'Channel name is required.' };
    const trimmedName = name.trim();
    const slug = trimmedName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    if (!slug) return { error: 'Invalid channel name.' };

    const now = new Date().toISOString();
    const newChan: ClassSpaceChannel = {
      id: 'chan_' + Math.random().toString(36).substring(2, 11),
      workspaceId,
      name: trimmedName,
      slug,
      description: description?.trim(),
      isDefault: false,
      position: 10,
      createdBy: actingUserId,
      createdAt: now,
      updatedAt: now,
    };

    const supabase = getSupabaseClient();
    if (supabase && isCloudAvailable() && !isLocalId(workspaceId)) {
      try {
        const { data, error } = await supabase
          .from('class_channels')
          .insert({
            workspace_id: workspaceId,
            name: newChan.name,
            slug: newChan.slug,
            description: newChan.description,
            is_default: false,
            position: newChan.position,
            created_by: actingUserId,
          })
          .select()
          .single();

        if (error) return { error: error.message };
        return { channel: mapChannelFromDb(data) };
      } catch (err) {
        return { error: (err as Error).message };
      }
    }

    const local = getLocalData();
    if (!local.channels) local.channels = [];
    const exists = local.channels.some((c) => c.workspaceId === workspaceId && c.slug === slug);
    if (exists) return { error: 'A channel with this name already exists in this ClassSpace.' };

    local.channels.push(newChan);
    saveLocalData(local);
    return { channel: newChan };
  },

  async deleteChannel(
    workspaceId: string,
    _actingUserId: string,
    channelId: string
  ): Promise<{ success: boolean; error?: string }> {
    const supabase = getSupabaseClient();
    if (supabase && isCloudAvailable() && !isLocalId(workspaceId) && !isLocalId(channelId)) {
      try {
        const { error } = await supabase
          .from('class_channels')
          .delete()
          .eq('id', channelId)
          .eq('workspace_id', workspaceId)
          .eq('is_default', false);

        if (error) return { success: false, error: error.message };
        return { success: true };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    }

    const local = getLocalData();
    if (!local.channels) local.channels = [];
    const chan = local.channels.find((c) => c.id === channelId && c.workspaceId === workspaceId);
    if (!chan) return { success: false, error: 'Channel not found.' };
    if (chan.isDefault) return { success: false, error: 'Cannot delete default channels.' };

    local.channels = local.channels.filter((c) => c.id !== channelId);
    saveLocalData(local);
    return { success: true };
  },

  // ==========================================================================
  // JOIN REQUESTS (CODE-BASED APPROVALS)
  // ==========================================================================

  async requestToJoinWorkspace(
    user: AuthUser,
    rawCode: string
  ): Promise<{
    status?: ClassJoinRequestStatus;
    workspace?: ClassSpaceWorkspace;
    request?: ClassJoinRequest;
    message?: string;
    error?: string;
  }> {
    if (!user || !user.id) {
      return { error: 'You must be signed in to submit a join request.' };
    }

    const normalized = normalizeJoinCode(rawCode);
    if (!isValidJoinCode(normalized)) {
      recordFailedLookup();
      return { error: 'Invalid ClassSpace code format. Must be 5 alphanumeric characters.' };
    }

    if (isLookupRateLimited()) {
      return { error: 'Too many invalid attempts. Please wait 60 seconds before trying again.' };
    }

    const supabase = getSupabaseClient();
    if (supabase && isCloudAvailable() && !isLocalId(user.id) && !user.isSimulated) {
      try {
        const { data, error } = await supabase.rpc('request_to_join_workspace', {
          p_join_code: normalized,
          p_display_name: user.name || user.email.split('@')[0],
          p_avatar_url: user.avatarUrl || null,
        });

        if (!error && data && typeof data === 'object') {
          if ('error' in data && data.error) {
            recordFailedLookup();
            return { error: String(data.error) };
          }
          return {
            status: data.status || 'pending',
            message: data.message || 'Join request submitted! Awaiting CR approval.',
            workspace: data.workspace ? mapWorkspaceFromDb(data.workspace) : undefined,
            request: data.request ? mapJoinRequestFromDb(data.request) : undefined,
          };
        }
      } catch (err) {
        console.warn('[ClassSpaceService] Supabase requestToJoinWorkspace RPC error:', err);
      }
    }

    // Local / Offline fallback
    const local = getLocalData();
    const workspace = local.workspaces.find((w) => w.joinCode === normalized);
    if (!workspace) {
      recordFailedLookup();
      return { error: 'No ClassSpace found with this Join Code. Please verify with your CR.' };
    }

    const isMember = local.members.some((m) => m.workspaceId === workspace.id && m.userId === user.id);
    if (isMember) {
      return { error: 'You are already an enrolled member of this ClassSpace.' };
    }

    if (!local.joinRequests) local.joinRequests = [];
    let req = local.joinRequests.find((r) => r.workspaceId === workspace.id && r.userId === user.id);
    const now = new Date().toISOString();
    const reqName = user.name || user.email.split('@')[0] || 'Student';

    if (req) {
      if (req.status === 'pending') {
        return {
          status: 'pending',
          message: 'Your join request is already pending approval by the Class Representative.',
          workspace,
          request: req,
        };
      }
      req.status = 'pending';
      req.displayName = reqName;
      req.avatarUrl = user.avatarUrl;
      req.updatedAt = now;
    } else {
      req = {
        id: 'req_' + Math.random().toString(36).substring(2, 11),
        workspaceId: workspace.id,
        userId: user.id,
        displayName: reqName,
        avatarUrl: user.avatarUrl,
        status: 'pending',
        createdAt: now,
        updatedAt: now,
      };
      local.joinRequests.push(req);
    }

    // Notify CR
    const crMember = local.members.find(
      (m) => m.workspaceId === workspace.id && (m.role === 'owner' || m.role === 'cr')
    );
    if (crMember && crMember.userId !== user.id) {
      local.notifications.push({
        id: 'notif_' + Math.random().toString(36).substring(2, 11),
        workspaceId: workspace.id,
        userId: crMember.userId,
        title: 'New Join Request',
        body: `${reqName} requested to join ${workspace.name}.`,
        type: 'membership',
        isRead: false,
        createdAt: now,
      });
    }

    saveLocalData(local);
    return {
      status: 'pending',
      message: 'Join request submitted! Awaiting approval from the Class Representative.',
      workspace,
      request: req,
    };
  },

  async getJoinRequests(workspaceId: string): Promise<ClassJoinRequest[]> {
    const supabase = getSupabaseClient();
    if (supabase && isCloudAvailable() && !isLocalId(workspaceId)) {
      try {
        const { data, error } = await supabase
          .from('class_join_requests')
          .select('*')
          .eq('workspace_id', workspaceId)
          .eq('status', 'pending')
          .order('created_at', { ascending: false });

        if (!error && data) {
          return data.map(mapJoinRequestFromDb);
        }
      } catch (err) {
        console.warn('[ClassSpaceService] getJoinRequests cloud error:', err);
      }
    }

    const local = getLocalData();
    return (local.joinRequests || []).filter((r) => r.workspaceId === workspaceId && r.status === 'pending');
  },

  async reviewJoinRequest(
    workspaceId: string,
    actingUserId: string,
    requestId: string,
    action: 'approve' | 'reject'
  ): Promise<{ success: boolean; member?: ClassSpaceMember; error?: string }> {
    const supabase = getSupabaseClient();
    if (supabase && isCloudAvailable() && !isLocalId(workspaceId) && !isLocalId(requestId)) {
      try {
        const { data, error } = await supabase.rpc('review_join_request', {
          p_request_id: requestId,
          p_action: action,
        });

        if (error) return { success: false, error: error.message };
        if (data && typeof data === 'object') {
          if ('error' in data && data.error) return { success: false, error: String(data.error) };
          return {
            success: true,
            member: data.member ? mapMemberFromDb(data.member) : undefined,
          };
        }
      } catch (err) {
        console.warn('[ClassSpaceService] reviewJoinRequest RPC error:', err);
      }
    }

    // Local fallback
    const local = getLocalData();
    const ws = local.workspaces.find((w) => w.id === workspaceId);
    if (!ws) return { success: false, error: 'ClassSpace not found.' };

    const actingMember = local.members.find((m) => m.workspaceId === workspaceId && m.userId === actingUserId);
    if (!actingMember || (actingMember.role !== 'cr' && actingMember.role !== 'owner' && ws.createdBy !== actingUserId)) {
      return { success: false, error: 'Unauthorized: Only the Class Representative (CR) or Owner can review join requests.' };
    }

    if (!local.joinRequests) local.joinRequests = [];
    const req = local.joinRequests.find((r) => r.id === requestId && r.workspaceId === workspaceId);
    if (!req) return { success: false, error: 'Join request not found.' };

    const now = new Date().toISOString();

    if (action === 'approve') {
      req.status = 'approved';
      req.reviewedBy = actingUserId;
      req.reviewedAt = now;
      req.updatedAt = now;

      let newMem = local.members.find((m) => m.workspaceId === workspaceId && m.userId === req.userId);
      if (!newMem) {
        newMem = {
          id: 'mem_' + Math.random().toString(36).substring(2, 11),
          workspaceId,
          userId: req.userId,
          role: 'member',
          displayName: req.displayName,
          avatarUrl: req.avatarUrl,
          joinedAt: now,
        };
        local.members.push(newMem);
      }

      local.notifications.push({
        id: 'notif_' + Math.random().toString(36).substring(2, 11),
        workspaceId,
        userId: req.userId,
        title: 'Join Request Approved',
        body: `You are now a student in ${ws?.name || 'the class'}. Welcome!`,
        type: 'membership',
        isRead: false,
        createdAt: now,
      });

      saveLocalData(local);
      return { success: true, member: newMem };
    } else {
      req.status = 'rejected';
      req.reviewedBy = actingUserId;
      req.reviewedAt = now;
      req.updatedAt = now;

      local.notifications.push({
        id: 'notif_' + Math.random().toString(36).substring(2, 11),
        workspaceId,
        userId: req.userId,
        title: 'Join Request Declined',
        body: `Your request to join ${ws?.name || 'the class'} was declined by the Class Representative.`,
        type: 'membership',
        isRead: false,
        createdAt: now,
      });

      saveLocalData(local);
      return { success: true };
    }
  },

  // ==========================================================================
  // MEMBERS & ROLES
  // ==========================================================================

  async getMembers(workspaceId: string): Promise<ClassSpaceMember[]> {
    const supabase = getSupabaseClient();
    if (supabase && isCloudAvailable() && !isLocalId(workspaceId)) {
      try {
        const { data, error } = await supabase
          .from('class_members')
          .select('*')
          .eq('workspace_id', workspaceId);

        if (error || !data) return [];
        const members = data.map(mapMemberFromDb);
        // Enrich with latest public profiles
        try {
          const userIds = members.map((m) => m.userId).filter((id) => !isLocalId(id));
          if (userIds.length > 0) {
            const { data: profiles } = await supabase
              .from('class_profiles')
              .select('user_id, display_name, avatar_url')
              .in('user_id', userIds);

            if (profiles && profiles.length > 0) {
              const profileMap = new Map(profiles.map((p) => [p.user_id, p]));
              for (const m of members) {
                const p = profileMap.get(m.userId);
                if (p) {
                  if (p.display_name) m.displayName = p.display_name;
                  if (p.avatar_url) m.avatarUrl = p.avatar_url;
                }
              }
            }
          }
        } catch {
          // Non-blocking enrichment
        }
        return members;
      } catch {
        return [];
      }
    }

    const local = getLocalData();
    const members = (local.members || []).filter((m) => m.workspaceId === workspaceId);
    for (const m of members) {
      const p = local.profiles[m.userId];
      if (p) {
        if (p.displayName) m.displayName = p.displayName;
        if (p.avatarUrl) m.avatarUrl = p.avatarUrl;
      }
    }
    return members;
  },

  async transferCRRole(
    workspaceId: string,
    currentCRUserId: string,
    targetUserId: string,
    previousCRNewRole: 'co_admin' | 'member' = 'co_admin'
  ): Promise<{ success: boolean; error?: string }> {
    if (currentCRUserId === targetUserId) {
      return { success: false, error: 'Cannot transfer the CR role to yourself.' };
    }

    const supabase = getSupabaseClient();
    if (supabase && isCloudAvailable() && !isLocalId(workspaceId)) {
      try {
        const { data, error } = await supabase.rpc('transfer_cr_role', {
          p_workspace_id: workspaceId,
          p_target_user_id: targetUserId,
          p_previous_cr_new_role: previousCRNewRole,
        });

        if (error) return { success: false, error: error.message };
        if (data && typeof data === 'object' && 'error' in data && data.error) {
          return { success: false, error: String(data.error) };
        }
        return { success: true };
      } catch (err) {
        console.warn('[ClassSpaceService] transferCRRole RPC error:', err);
      }
    }

    // Local fallback
    const local = getLocalData();
    const targetMember = local.members.find((m) => m.workspaceId === workspaceId && m.userId === targetUserId);
    if (!targetMember) return { success: false, error: 'Target student not found in this ClassSpace.' };

    if (currentCRUserId === targetUserId) {
      return { success: false, error: 'Cannot transfer the CR role to yourself.' };
    }

    const currentCR = local.members.find((m) => m.workspaceId === workspaceId && m.userId === currentCRUserId);
    if (!currentCR || (currentCR.role !== 'owner' && currentCR.role !== 'cr')) {
      return { success: false, error: 'Only the current Class Representative can transfer this role.' };
    }

    targetMember.role = 'cr';
    targetMember.canPublishNotices = true;

    currentCR.role = previousCRNewRole;
    currentCR.canPublishNotices = previousCRNewRole === 'co_admin';

    const ws = local.workspaces.find((w) => w.id === workspaceId);
    if (ws) {
      ws.createdBy = targetUserId;
    }

    // Notify all members
    const now = new Date().toISOString();
    for (const m of local.members.filter((mem) => mem.workspaceId === workspaceId)) {
      local.notifications.push({
        id: 'notif_' + Math.random().toString(36).substring(2, 11),
        workspaceId,
        userId: m.userId,
        title: 'Class Representative Updated',
        body: `${targetMember.displayName} is now the official Class Representative.`,
        type: 'membership',
        isRead: false,
        createdAt: now,
      });
    }

    saveLocalData(local);
    return { success: true };
  },

  async updateCoAdminNoticePermission(
    workspaceId: string,
    _actingCRUserId: string,
    targetUserId: string,
    canPublish: boolean
  ): Promise<{ success: boolean; error?: string }> {
    const supabase = getSupabaseClient();
    if (supabase && isCloudAvailable() && !isLocalId(workspaceId)) {
      try {
        const { data, error } = await supabase.rpc('update_co_admin_notice_permission', {
          p_workspace_id: workspaceId,
          p_target_user_id: targetUserId,
          p_can_publish: canPublish,
        });

        if (error) return { success: false, error: error.message };
        if (data && typeof data === 'object' && 'error' in data && data.error) {
          return { success: false, error: String(data.error) };
        }
        return { success: true };
      } catch (err) {
        console.warn('[ClassSpaceService] updateCoAdminNoticePermission error:', err);
      }
    }

    // Local fallback
    const local = getLocalData();
    const actingMember = local.members.find((m) => m.workspaceId === workspaceId && m.userId === _actingCRUserId);
    const ws = local.workspaces.find((w) => w.id === workspaceId);
    if (!actingMember || (actingMember.role !== 'cr' && actingMember.role !== 'owner' && ws?.createdBy !== _actingCRUserId)) {
      return { success: false, error: 'Only the Class Representative can configure Co-Admin permissions.' };
    }

    const target = local.members.find((m) => m.workspaceId === workspaceId && m.userId === targetUserId);
    if (!target) return { success: false, error: 'Member not found.' };
    if (target.role !== 'co_admin') {
      return { success: false, error: 'Notice publishing permissions can only be granted to Co-Admins.' };
    }

    target.canPublishNotices = canPublish;
    saveLocalData(local);
    return { success: true };
  },

  async updateMemberRole(
    workspaceId: string,
    actingUserId: string,
    targetUserId: string,
    newRole: ClassSpaceRole
  ): Promise<{ success: boolean; error?: string }> {
    const local = getLocalData();
    const actor = local.members.find((m) => m.workspaceId === workspaceId && m.userId === actingUserId);
    if (!actor || !canManageWorkspace(actor.role)) {
      return { success: false, error: 'Only the Workspace Owner or CR can assign roles.' };
    }

    const supabase = getSupabaseClient();
    if (
      supabase &&
      isCloudAvailable() &&
      !isLocalId(workspaceId) &&
      !isLocalId(actingUserId) &&
      !isLocalId(targetUserId)
    ) {
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

  async removeMember(
    workspaceId: string,
    actingUserId: string,
    targetUserId: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!workspaceId || !actingUserId || !targetUserId) {
      return { success: false, error: 'Workspace ID, acting user ID, and target user ID are required.' };
    }

    if (actingUserId === targetUserId) {
      return { success: false, error: 'Cannot remove yourself using member removal. Use leave workspace instead.' };
    }

    const local = getLocalData();
    const ws = local.workspaces.find((w) => w.id === workspaceId);
    const actor = local.members.find((m) => m.workspaceId === workspaceId && m.userId === actingUserId);
    if (actor && !canManageWorkspace(actor.role)) {
      return { success: false, error: 'Unauthorized: Only the Workspace Owner or CR can remove members.' };
    }

    const target = local.members.find((m) => m.workspaceId === workspaceId && m.userId === targetUserId);
    if (target?.role === 'owner' || ws?.createdBy === targetUserId) {
      return { success: false, error: 'Cannot remove the workspace owner.' };
    }

    const supabase = getSupabaseClient();
    if (
      supabase &&
      isCloudAvailable() &&
      !isLocalId(workspaceId) &&
      !isLocalId(actingUserId) &&
      !isLocalId(targetUserId)
    ) {
      try {
        const { error } = await supabase
          .from('class_members')
          .delete()
          .eq('workspace_id', workspaceId)
          .eq('user_id', targetUserId);

        if (error) return { success: false, error: error.message };

        local.members = local.members.filter(
          (m) => !(m.workspaceId === workspaceId && m.userId === targetUserId)
        );
        saveLocalData(local);

        return { success: true };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    }

    if (!actor || !canManageWorkspace(actor.role)) {
      return { success: false, error: 'Unauthorized: Only the Workspace Owner or CR can remove members.' };
    }

    local.members = local.members.filter(
      (m) => !(m.workspaceId === workspaceId && m.userId === targetUserId)
    );
    saveLocalData(local);

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
    if (supabase && isCloudAvailable() && !isLocalId(workspaceId)) {
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
    if (!canManageSchedule(actorRole)) {
      return { error: 'Unauthorized: Only Owner, CR or Co-Admin can add official recurring classes.' };
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
    if (supabase && isCloudAvailable() && !isLocalId(workspaceId) && !isLocalId(rule.createdBy)) {
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
    if (!canManageSchedule(actorRole)) {
      return { success: false, error: 'Unauthorized: Only Owner, CR or Co-Admin can update recurring class rules.' };
    }

    const supabase = getSupabaseClient();
    if (supabase && isCloudAvailable() && !isLocalId(workspaceId) && !isLocalId(ruleId)) {
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
    if (!canManageSchedule(actorRole)) {
      return { success: false, error: 'Unauthorized: Only Owner, CR or Co-Admin can delete class rules.' };
    }

    const supabase = getSupabaseClient();
    if (supabase && isCloudAvailable() && !isLocalId(workspaceId) && !isLocalId(ruleId)) {
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
    if (!canManageSchedule(actorRole)) {
      return { error: 'Unauthorized: Only Owner, CR or Co-Admin can reschedule, cancel or add extra classes.' };
    }

    const now = new Date().toISOString();
    const newOverride: ClassTimetableOverride = {
      ...override,
      id: 'ov_' + Math.random().toString(36).substring(2, 11),
      workspaceId,
      createdAt: now,
    };

    const supabase = getSupabaseClient();
    if (
      supabase &&
      isCloudAvailable() &&
      !isLocalId(workspaceId) &&
      (!override.ruleId || !isLocalId(override.ruleId)) &&
      !isLocalId(override.createdBy)
    ) {
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
    if (!canManageSchedule(actorRole)) {
      return { success: false, error: 'Unauthorized: Only Owner, CR or Co-Admin can restore or revert overrides.' };
    }

    const supabase = getSupabaseClient();
    if (supabase && isCloudAvailable() && !isLocalId(workspaceId) && !isLocalId(overrideId)) {
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
    if (supabase && isCloudAvailable() && !isLocalId(workspaceId) && !isLocalId(userId)) {
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
    if (supabase && isCloudAvailable() && !isLocalId(workspaceId) && !isLocalId(userId)) {
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
    if (supabase && isCloudAvailable() && !isLocalId(workspaceId)) {
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
    replyTo?: { id: string; content: string; senderName: string },
    extra?: {
      channelId?: string;
      messageType?: ClassMessageType;
      poll?: ClassPoll;
      resource?: ClassResourceAttachment;
      isPinned?: boolean;
    }
  ): Promise<{ message?: ClassMessage; error?: string }> {
    if (!content || !content.trim()) {
      return { error: 'Message cannot be empty.' };
    }

    if (extra?.isPinned || extra?.messageType === 'announcement') {
      const local = getLocalData();
      const senderMem = local.members.find((m) => m.workspaceId === workspaceId && m.userId === sender.id);
      if (!canPublishNotice(sender.role || senderMem?.role, senderMem?.canPublishNotices)) {
        return { error: 'Unauthorized: Only the Class Representative or permitted Co-Admins can publish official notices or pin messages.' };
      }
    }

    const now = new Date().toISOString();
    const newMsg: ClassMessage = {
      id: 'msg_' + Math.random().toString(36).substring(2, 11),
      workspaceId,
      channelId: extra?.channelId,
      senderId: sender.id,
      senderName: sender.name,
      senderRole: sender.role,
      senderAvatarUrl: sender.avatarUrl,
      content: content.trim(),
      messageType: extra?.messageType || 'text',
      poll: extra?.poll,
      resource: extra?.resource,
      replyToId: replyTo?.id,
      replyToContent: replyTo?.content,
      replyToSenderName: replyTo?.senderName,
      reactions: {},
      isPinned: extra?.isPinned ?? false,
      isEdited: false,
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
    };

    const supabase = getSupabaseClient();
    if (
      supabase &&
      isCloudAvailable() &&
      !isLocalId(workspaceId) &&
      !isLocalId(sender.id) &&
      (!replyTo?.id || !isLocalId(replyTo.id))
    ) {
      try {
        const { data, error } = await supabase
          .from('class_messages')
          .insert({
            workspace_id: workspaceId,
            channel_id: extra?.channelId || null,
            sender_id: sender.id,
            sender_name: sender.name,
            sender_role: sender.role,
            sender_avatar_url: sender.avatarUrl,
            content: newMsg.content,
            message_type: newMsg.messageType,
            poll: newMsg.poll,
            resource: newMsg.resource,
            is_pinned: newMsg.isPinned,
            reply_to_id: replyTo?.id,
            reply_to_content: replyTo?.content,
            reply_to_sender_name: replyTo?.senderName,
          })
          .select()
          .single();

        if (error) return { error: error.message };

        if (extra?.isPinned || extra?.messageType === 'announcement') {
          try {
            await this.dispatchNotificationToMembers(workspaceId, sender.id, {
              title: `📢 Official Notice: ${sender.name}`,
              body: newMsg.content.slice(0, 100),
              type: 'announcement',
            });
          } catch {
            // Non-blocking notification dispatch
          }
        }

        return { message: { ...mapMessageFromDb(data), reactions: {} } };
      } catch (err) {
        return { error: (err as Error).message };
      }
    }

    const local = getLocalData();
    local.messages.push(newMsg);

    if (extra?.isPinned || extra?.messageType === 'announcement') {
      const nowTs = new Date().toISOString();
      for (const m of local.members.filter((mem) => mem.workspaceId === workspaceId && mem.userId !== sender.id)) {
        local.notifications.push({
          id: 'notif_' + Math.random().toString(36).substring(2, 11),
          workspaceId,
          userId: m.userId,
          title: `📢 Official Notice: ${sender.name}`,
          body: newMsg.content.slice(0, 100),
          type: 'announcement',
          isRead: false,
          createdAt: nowTs,
        });
      }
    }

    saveLocalData(local);
    return { message: newMsg };
  },

  async createPoll(
    workspaceId: string,
    sender: { id: string; name: string; role?: ClassSpaceRole; avatarUrl?: string },
    question: string,
    optionTexts: string[],
    allowMultipleAnswers: boolean,
    isAnonymous: boolean = false
  ): Promise<{ message?: ClassMessage; error?: string }> {
    if (!question || !question.trim()) {
      return { error: 'Poll question cannot be empty.' };
    }
    const cleanOptions = optionTexts.map((t) => t.trim()).filter(Boolean);
    if (cleanOptions.length < 2) {
      return { error: 'A poll must have at least 2 non-empty options.' };
    }

    const pollId = 'poll_' + Math.random().toString(36).substring(2, 10);
    const options: ClassPollOption[] = cleanOptions.map((text, idx) => ({
      id: `opt_${idx + 1}_${Math.random().toString(36).substring(2, 6)}`,
      text,
      votes: [],
    }));

    const poll: ClassPoll = {
      id: pollId,
      question: question.trim(),
      options,
      allowMultipleAnswers,
      isAnonymous,
      isClosed: false,
      totalVotes: 0,
    };

    return this.sendMessage(
      workspaceId,
      sender,
      question.trim(),
      undefined,
      {
        messageType: 'poll',
        poll,
      }
    );
  },

  async votePoll(
    workspaceId: string,
    messageId: string,
    optionId: string,
    userId: string
  ): Promise<{ success: boolean; poll?: ClassPoll; error?: string }> {
    const local = getLocalData();
    const msg = local.messages.find((m) => m.id === messageId && m.workspaceId === workspaceId);
    if (!msg || !msg.poll) {
      return { success: false, error: 'Poll message not found.' };
    }

    if (msg.poll.isClosed) {
      return { success: false, error: 'This poll has ended.' };
    }

    const poll = msg.poll;
    const targetOption = poll.options.find((o) => o.id === optionId);
    if (!targetOption) {
      return { success: false, error: 'Poll option not found.' };
    }

    if (poll.allowMultipleAnswers) {
      // Multi-option: toggle user's vote on this option
      if (targetOption.votes.includes(userId)) {
        targetOption.votes = targetOption.votes.filter((uid) => uid !== userId);
      } else {
        targetOption.votes.push(userId);
      }
    } else {
      // Single choice: if clicking already selected, toggle off; otherwise clear all and select this
      const hasVotedThis = targetOption.votes.includes(userId);
      poll.options.forEach((opt) => {
        opt.votes = opt.votes.filter((uid) => uid !== userId);
      });
      if (!hasVotedThis) {
        targetOption.votes.push(userId);
      }
    }

    // Recompute total votes (unique users)
    const uniqueVoters = new Set<string>();
    poll.options.forEach((opt) => opt.votes.forEach((uid) => uniqueVoters.add(uid)));
    poll.totalVotes = uniqueVoters.size;

    msg.updatedAt = new Date().toISOString();
    saveLocalData(local);

    const supabase = getSupabaseClient();
    if (
      supabase &&
      isCloudAvailable() &&
      !isLocalId(workspaceId) &&
      !isLocalId(messageId) &&
      !isLocalId(userId)
    ) {
      try {
        await supabase
          .from('class_messages')
          .update({ poll, updated_at: msg.updatedAt })
          .eq('id', messageId);
      } catch {
        // continue
      }
    }

    return { success: true, poll };
  },

  async closePoll(
    workspaceId: string,
    messageId: string,
    actorUserId: string,
    actorRole?: ClassSpaceRole
  ): Promise<{ success: boolean; error?: string }> {
    const local = getLocalData();
    const msg = local.messages.find((m) => m.id === messageId && m.workspaceId === workspaceId);
    if (!msg || !msg.poll) {
      return { success: false, error: 'Poll message not found.' };
    }

    const isAuthorized =
      msg.senderId === actorUserId ||
      actorRole === 'owner' ||
      actorRole === 'cr' ||
      actorRole === 'co_admin';

    if (!isAuthorized) {
      return { success: false, error: 'Only the poll creator or CR/Admins can close this poll.' };
    }

    msg.poll.isClosed = true;
    msg.updatedAt = new Date().toISOString();
    saveLocalData(local);

    const supabase = getSupabaseClient();
    if (
      supabase &&
      isCloudAvailable() &&
      !isLocalId(workspaceId) &&
      !isLocalId(messageId) &&
      !isLocalId(actorUserId)
    ) {
      try {
        await supabase
          .from('class_messages')
          .update({ poll: msg.poll, updated_at: msg.updatedAt })
          .eq('id', messageId);
      } catch {
        // continue
      }
    }

    return { success: true };
  },

  async shareResource(
    workspaceId: string,
    sender: { id: string; name: string; role?: ClassSpaceRole; avatarUrl?: string },
    title: string,
    url: string,
    category: ClassResourceCategory,
    description?: string
  ): Promise<{ message?: ClassMessage; error?: string }> {
    if (!title || !title.trim()) {
      return { error: 'Resource title cannot be empty.' };
    }
    if (!url || !url.trim()) {
      return { error: 'Resource URL cannot be empty.' };
    }

    return this.sendMessage(
      workspaceId,
      sender,
      description?.trim() || title.trim(),
      undefined,
      {
        messageType: 'resource',
        resource: {
          title: title.trim(),
          url: url.trim(),
          category,
          description: description?.trim(),
        },
      }
    );
  },

  async addReaction(
    messageId: string,
    userId: string,
    emoji: string
  ): Promise<{ success: boolean; error?: string }> {
    const supabase = getSupabaseClient();
    if (supabase && isCloudAvailable() && !isLocalId(messageId) && !isLocalId(userId)) {
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
    if (supabase && isCloudAvailable() && !isLocalId(messageId) && !isLocalId(userId)) {
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
    if (supabase && isCloudAvailable() && !isLocalId(messageId) && !isLocalId(userId)) {
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
    if (
      supabase &&
      isCloudAvailable() &&
      !isLocalId(workspaceId) &&
      !isLocalId(messageId) &&
      !isLocalId(actorUserId)
    ) {
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
    actorRole?: ClassSpaceRole,
    actingUserId?: string,
    canPublishNoticesFlag?: boolean
  ): Promise<{ success: boolean; error?: string }> {
    if (!canPublishNotice(actorRole, canPublishNoticesFlag)) {
      return { success: false, error: 'Only the CR or authorized Co-Admins can pin official notices.' };
    }

    const local = getLocalData();
    const msg = local.messages.find((m) => m.id === messageId && m.workspaceId === workspaceId);
    if (!msg) return { success: false, error: 'Message not found.' };

    const newPinned = !msg.isPinned;

    const supabase = getSupabaseClient();
    if (supabase && isCloudAvailable() && !isLocalId(workspaceId) && !isLocalId(messageId)) {
      try {
        const { error } = await supabase
          .from('class_messages')
          .update({ is_pinned: newPinned })
          .eq('id', messageId);

        if (error) return { success: false, error: error.message };

        if (newPinned && actingUserId) {
          try {
            await this.dispatchNotificationToMembers(workspaceId, actingUserId, {
              title: '📌 Announcement Pinned',
              body: msg.content.slice(0, 100),
              type: 'announcement',
            });
          } catch {
            // Non-blocking notification dispatch
          }
        }

        return { success: true };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    }

    msg.isPinned = newPinned;

    if (newPinned && actingUserId) {
      const nowTs = new Date().toISOString();
      for (const m of local.members.filter((mem) => mem.workspaceId === workspaceId && mem.userId !== actingUserId)) {
        local.notifications.push({
          id: 'notif_' + Math.random().toString(36).substring(2, 11),
          workspaceId,
          userId: m.userId,
          title: '📌 Announcement Pinned',
          body: msg.content.slice(0, 100),
          type: 'announcement',
          isRead: false,
          createdAt: nowTs,
        });
      }
    }

    saveLocalData(local);
    return { success: true };
  },

  // ==========================================================================
  // SAVED / BOOKMARKED MESSAGES
  // ==========================================================================

  async getSavedMessages(workspaceId: string, userId: string): Promise<ClassSavedMessage[]> {
    const supabase = getSupabaseClient();
    if (supabase && isCloudAvailable() && !isLocalId(workspaceId) && !isLocalId(userId)) {
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
    if (
      supabase &&
      isCloudAvailable() &&
      !isLocalId(workspaceId) &&
      !isLocalId(userId) &&
      !isLocalId(messageId)
    ) {
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
    if (supabase && isCloudAvailable() && !isLocalId(workspaceId) && !isLocalId(userId)) {
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
    if (supabase && isCloudAvailable() && !isLocalId(notificationId)) {
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
    if (supabase && isCloudAvailable() && !isLocalId(workspaceId) && !isLocalId(userId)) {
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
    if (
      supabase &&
      isCloudAvailable() &&
      !isLocalId(workspaceId) &&
      !isLocalId(originatorUserId) &&
      newNotifs.length > 0 &&
      !newNotifs.some((n) => isLocalId(n.userId))
    ) {
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
    if (supabase && isCloudAvailable() && !isLocalId(userId)) {
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
    if (supabase && isCloudAvailable() && !isLocalId(userId)) {
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

        // Synchronize display_name and avatar_url to class_members to trigger live Realtime updates
        try {
          await supabase
            .from('class_members')
            .update({
              display_name: updated.displayName,
              avatar_url: updated.avatarUrl,
            })
            .eq('user_id', userId);
        } catch {
          // Non-blocking sync
        }
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
        if (updated.email) m.email = updated.email;
      }
    }
    // Update matching join requests
    if (local.joinRequests) {
      for (const req of local.joinRequests) {
        if (req.userId === userId) {
          req.displayName = updated.displayName;
          req.avatarUrl = updated.avatarUrl;
        }
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
    if (supabase && isCloudAvailable() && !isLocalId(userId)) {
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
    let supabaseChannel: any = null;

    if (supabase && isCloudAvailable() && !isLocalId(workspaceId)) {
      try {
        supabaseChannel = supabase
          .channel(`classspace:${workspaceId}`)
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'class_messages', filter: `workspace_id=eq.${workspaceId}` },
            () => onUpdate()
          )
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'class_members', filter: `workspace_id=eq.${workspaceId}` },
            () => onUpdate()
          )
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'class_channels', filter: `workspace_id=eq.${workspaceId}` },
            () => onUpdate()
          )
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'class_join_requests', filter: `workspace_id=eq.${workspaceId}` },
            () => onUpdate()
          )
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'class_timetable_overrides', filter: `workspace_id=eq.${workspaceId}` },
            () => onUpdate()
          )
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'class_notifications', filter: `workspace_id=eq.${workspaceId}` },
            () => onUpdate()
          )
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'class_profiles' },
            () => onUpdate()
          )
          .subscribe();
      } catch (err) {
        console.warn('[ClassSpaceService] Realtime subscription error:', err);
      }
    }

    // Cross-tab local storage update listener
    const storageHandler = () => onUpdate();
    if (typeof window !== 'undefined') {
      window.addEventListener('tracker_classspace_updated', storageHandler);
      window.addEventListener('storage', storageHandler);
    }

    // Gentle fallback heartbeat polling (every 60 seconds, only when tab is visible)
    let pollInterval: any = null;
    let visibilityHandler: any = null;

    if (typeof document !== 'undefined' && typeof window !== 'undefined') {
      pollInterval = setInterval(() => {
        if (document.visibilityState === 'visible') {
          onUpdate();
        }
      }, 60000);

      visibilityHandler = () => {
        if (document.visibilityState === 'visible') {
          onUpdate();
        }
      };
      document.addEventListener('visibilitychange', visibilityHandler);
    }

    return () => {
      if (supabase && supabaseChannel) {
        try {
          supabase.removeChannel(supabaseChannel);
        } catch {
          // Ignore cleanup error
        }
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener('tracker_classspace_updated', storageHandler);
        window.removeEventListener('storage', storageHandler);
      }
      if (pollInterval) clearInterval(pollInterval);
      if (visibilityHandler && typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', visibilityHandler);
      }
    };
  },
};

// ==============================================================================
// DATABASE ROW MAPPERS
// ==============================================================================

function mapWorkspaceFromDb(row: any): ClassSpaceWorkspace {
  const inst = row.institution || row.college || undefined;
  return {
    id: row.id,
    name: row.name,
    college: inst,
    institution: inst,
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
    email: row.email,
    avatarUrl: row.avatar_url,
    isMuted: row.is_muted,
    canPublishNotices: row.can_publish_notices ?? (row.role === 'cr' || row.role === 'owner'),
    joinedAt: row.joined_at,
  };
}

function mapChannelFromDb(row: any): ClassSpaceChannel {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    isDefault: row.is_default,
    isSystem: row.is_system,
    position: row.position ?? 0,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapJoinRequestFromDb(row: any): ClassJoinRequest {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    userId: row.user_id,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    status: row.status,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
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
    channelId: row.channel_id,
    senderId: row.sender_id,
    senderName: row.sender_name,
    senderRole: row.sender_role,
    senderAvatarUrl: row.sender_avatar_url,
    content: row.content,
    messageType: row.message_type || (row.poll ? 'poll' : row.resource ? 'resource' : 'text'),
    poll: row.poll || undefined,
    resource: row.resource || undefined,
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

