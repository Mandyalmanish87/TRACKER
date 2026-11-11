import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

if (!getApps().length) initializeApp();

let testDb: any = null;
let testAuth: any = null;

export function setFirebaseAdminForTesting(mocks: { db?: any; auth?: any }) {
  if (mocks.db !== undefined) testDb = mocks.db;
  if (mocks.auth !== undefined) testAuth = mocks.auth;
}

const getAuthClient = () => testAuth || getAuth();

const db: ReturnType<typeof getFirestore> = new Proxy({} as any, {
  get: (_, prop) => {
    const target = testDb || getFirestore();
    const val = (target as any)[prop];
    if (typeof val === 'function') {
      return val.bind(target);
    }
    return val;
  },
});
const memberRef = (workspaceId: string, userId: string) => db.collection('class_members').doc(`${workspaceId}__${userId}`);
const codeRef = (code: string) => db.collection('class_join_codes').doc(code);
const createCode = () => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 5 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
};
const workspaceRow = (id: string, data: any) => ({ ...data, id });
const memberRow = (id: string, data: any) => ({ ...data, id });

function userId(request: any) {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Sign in to continue.');
  return request.auth.uid as string;
}
async function requireCr(workspaceId: string, uid: string) {
  const member = await memberRef(workspaceId, uid).get();
  if (!member.exists || !['owner', 'cr'].includes(member.get('role'))) throw new HttpsError('permission-denied', 'Only the ClassSpace CR or owner can do this.');
}

export type PlatformAdminRole = 'owner' | 'super_admin' | 'support';

/**
 * Resolves the server-authoritative platform administrator role for a given user UID.
 *
 * Security Invariants:
 * 1. Firestore `admin_users/{uid}` is the SOLE authoritative source of truth.
 * 2. Missing Firestore document strictly denies admin access (custom claims are ignored).
 * 3. Inactive Firestore document (`is_active !== true`) strictly denies admin access.
 * 4. Role is resolved exclusively from `role` field in Firestore ('owner' | 'super_admin' | 'support').
 *    Any invalid or unrecognized role strictly denies access.
 * 5. Firebase Auth custom claims are NEVER used to grant, elevate, or override platform admin access.
 * 6. Returns null if the user is not an active platform administrator in Firestore.
 */
export async function getAdminRole(uid: string): Promise<PlatformAdminRole | null> {
  if (!uid || typeof uid !== 'string') return null;

  try {
    const record = await db.collection('admin_users').doc(uid).get();
    if (!record.exists) {
      return null;
    }

    const data = record.data();
    if (!data || data.is_active !== true) {
      // Inactive or explicitly deactivated admin: strictly deny
      return null;
    }

    const role = String(data.role || '').toLowerCase();
    if (role === 'owner' || role === 'super_admin' || role === 'support') {
      return role as PlatformAdminRole;
    }

    return null;
  } catch (err) {
    console.error(`[trackerRpc] Error checking admin_users for ${uid}:`, err);
    return null;
  }
}

export async function isPlatformAdmin(uid: string): Promise<boolean> {
  const role = await getAdminRole(uid);
  return role !== null;
}

export async function isPlatformOperator(uid: string): Promise<boolean> {
  const role = await getAdminRole(uid);
  return role === 'owner' || role === 'super_admin';
}

export async function isPlatformOwner(uid: string): Promise<boolean> {
  const role = await getAdminRole(uid);
  return role === 'owner';
}

async function listAllAuthUsers() {
  const users: Array<Awaited<ReturnType<ReturnType<typeof getAuth>['listUsers']>>['users'][number]> = [];
  let pageToken: string | undefined;
  do {
    const page = await getAuthClient().listUsers(1000, pageToken);
    users.push(...page.users);
    pageToken = page.pageToken;
  } while (pageToken);
  return users;
}

async function requireActivePass(uid: string) {
  const subDoc = await db.collection('user_subscriptions').doc(uid).get();
  if (!subDoc.exists) {
    throw new HttpsError('permission-denied', 'An active TRAKIFY pass is required to create a ClassSpace.');
  }
  const sub = subDoc.data() || {};
  if (sub.status !== 'active') {
    throw new HttpsError('permission-denied', 'An active TRAKIFY pass is required to create a ClassSpace.');
  }
  const now = Date.now();
  let expiryTime = 0;
  if (sub.period_end_timestamp?.toDate) {
    expiryTime = sub.period_end_timestamp.toDate().getTime();
  } else if (sub.current_period_end) {
    expiryTime = new Date(sub.current_period_end).getTime();
  }
  if (!expiryTime || isNaN(expiryTime) || expiryTime <= now) {
    throw new HttpsError('permission-denied', 'Your TRAKIFY pass has expired. Please renew to create a ClassSpace.');
  }
}

async function createWorkspace(uid: string, a: any) {
  await requireActivePass(uid);
  const id = db.collection('class_workspaces').doc().id;
  const ws = db.collection('class_workspaces').doc(id);
  const member = memberRef(id, uid);
  const now = new Date().toISOString();
  const data = { name: String(a.p_name || '').trim(), institution: a.p_institution || null, department: a.p_department || null, section: a.p_section || null, batch: a.p_batch || null, description: a.p_description || null, join_code: createCode(), created_by: uid, created_at: now, updated_at: now };
  if (!data.name) throw new HttpsError('invalid-argument', 'ClassSpace name is required.');
  const memberData = { workspace_id: id, user_id: uid, role: 'owner', display_name: String(a.p_display_name || 'Student'), avatar_url: a.p_avatar_url || null, joined_at: now };
  const joinCode = codeRef(data.join_code);
  await db.runTransaction(async (tx) => {
    if ((await tx.get(joinCode)).exists) throw new HttpsError('aborted', 'Join code collision. Try again.');
    tx.create(ws, data);
    tx.create(member, memberData);
    tx.create(joinCode, { workspace_id: id });
    const defaults = [
      { name: 'The Commons', slug: 'the-commons', description: 'General class discussion, questions, and coordination', position: 1 },
      { name: 'Study Vault', slug: 'study-vault', description: 'Notes, PDFs, study material, resources, and academic discussions', position: 2 },
      { name: 'Class Pulse', slug: 'class-pulse', description: 'Official class updates, timetable changes, and alerts', position: 3 },
    ];
    for (const channel of defaults) {
      tx.create(db.collection('class_channels').doc(), {
        workspace_id: id,
        ...channel,
        is_default: true,
        created_by: uid,
        created_at: now,
        updated_at: now,
      });
    }
  });
  return { workspace: workspaceRow(id, data), member: memberRow(member.id, memberData) };
}

async function joinWorkspace(uid: string, a: any) {
  const code = String(a.p_join_code || '').trim().toUpperCase();
  const index = await codeRef(code).get();
  if (!index.exists) throw new HttpsError('not-found', 'No ClassSpace found with this Join Code.');
  const id = index.get('workspace_id');
  const wsRef = db.collection('class_workspaces').doc(id);
  const mRef = memberRef(id, uid);
  const now = new Date().toISOString();
  const mData = { workspace_id: id, user_id: uid, role: 'member', display_name: String(a.p_display_name || 'Student'), avatar_url: a.p_avatar_url || null, joined_at: now };
  const wsData = await db.runTransaction(async (tx) => {
    const [ws, existing] = await Promise.all([tx.get(wsRef), tx.get(mRef)]);
    if (!ws.exists) throw new HttpsError('not-found', 'ClassSpace no longer exists.');
    if (existing.exists) throw new HttpsError('already-exists', 'You are already a member of this ClassSpace.');
    tx.create(mRef, mData);
    return ws.data();
  });
  return { workspace: workspaceRow(id, wsData), member: memberRow(mRef.id, mData) };
}

async function lookupWorkspace(a: any) {
  const index = await codeRef(String(a.p_join_code || '').trim().toUpperCase()).get();
  if (!index.exists) throw new HttpsError('not-found', 'No ClassSpace found with this Join Code.');
  const snap = await db.collection('class_workspaces').doc(index.get('workspace_id')).get();
  if (!snap.exists) throw new HttpsError('not-found', 'ClassSpace no longer exists.');
  const w = snap.data()!;
  return [{ id: snap.id, name: w.name, institution: w.institution, department: w.department, section: w.section, batch: w.batch, description: w.description }];
}

async function requestJoin(uid: string, a: any) {
  const index = await codeRef(String(a.p_join_code || '').trim().toUpperCase()).get();
  if (!index.exists) throw new HttpsError('not-found', 'No ClassSpace found with this Join Code.');
  const workspaceId = index.get('workspace_id');
  const membership = await memberRef(workspaceId, uid).get();
  if (membership.exists) throw new HttpsError('already-exists', 'You are already enrolled in this ClassSpace.');
  const reqRef = db.collection('class_join_requests').doc(`${workspaceId}__${uid}`);
  const previous = await reqRef.get();
  const now = new Date().toISOString();
  const data = { workspace_id: workspaceId, user_id: uid, display_name: String(a.p_display_name || 'Student'), avatar_url: a.p_avatar_url || null, status: 'pending', created_at: previous.exists ? previous.get('created_at') : now, updated_at: now };
  await reqRef.set(data, { merge: true });
  const ws = await db.collection('class_workspaces').doc(workspaceId).get();
  return { status: 'pending', message: 'Join request submitted! Awaiting CR approval.', workspace: workspaceRow(workspaceId, ws.data()), request: memberRow(reqRef.id, data) };
}

async function reviewJoinRequest(uid: string, a: any) {
  const reqRef = db.collection('class_join_requests').doc(String(a.p_request_id || ''));
  const req = await reqRef.get();
  if (!req.exists) throw new HttpsError('not-found', 'Join request was not found.');
  const data = req.data()!;
  await requireCr(data.workspace_id, uid);
  const approved = a.p_action === 'approve';
  if (!approved && a.p_action !== 'reject') throw new HttpsError('invalid-argument', 'Invalid request action.');
  const now = new Date().toISOString();
  const batch = db.batch();
  batch.update(reqRef, { status: approved ? 'approved' : 'rejected', reviewed_by: uid, reviewed_at: now, updated_at: now });
  let member: any;
  if (approved) {
    member = { workspace_id: data.workspace_id, user_id: data.user_id, role: 'member', display_name: data.display_name, avatar_url: data.avatar_url || null, joined_at: now };
    batch.set(memberRef(data.workspace_id, data.user_id), member);
  }
  await batch.commit();
  return { success: true, member: member ? memberRow(memberRef(data.workspace_id, data.user_id).id, member) : undefined };
}

async function transferCr(uid: string, a: any) {
  const ws = String(a.p_workspace_id || ''), target = String(a.p_target_user_id || '');
  await requireCr(ws, uid);
  const oldRef = memberRef(ws, uid), newRef = memberRef(ws, target);
  await db.runTransaction(async (tx) => {
    const [old, next] = await Promise.all([tx.get(oldRef), tx.get(newRef)]);
    if (!old.exists || !next.exists) throw new HttpsError('not-found', 'Both members must belong to this ClassSpace.');
    tx.update(newRef, { role: 'cr' });
    tx.update(oldRef, { role: String(a.p_previous_cr_new_role || 'member') });
  });
  return { success: true };
}

async function updateCoAdmin(uid: string, a: any) {
  const ws = String(a.p_workspace_id || '');
  await requireCr(ws, uid);
  const ref = memberRef(ws, String(a.p_target_user_id || ''));
  const snap = await ref.get();
  if (!snap.exists || snap.get('role') !== 'co_admin') throw new HttpsError('not-found', 'Co-admin was not found.');
  await ref.update({ can_publish_notices: Boolean(a.p_can_publish) });
  return { success: true };
}

async function rotateWorkspaceJoinCode(uid: string, a: any) {
  const workspaceId = String(a.p_workspace_id || '');
  await requireCr(workspaceId, uid);
  const wsRef = db.collection('class_workspaces').doc(workspaceId);
  const newCode = createCode();
  await db.runTransaction(async (tx) => {
    const [ws, code] = await Promise.all([tx.get(wsRef), tx.get(codeRef(newCode))]);
    if (!ws.exists) throw new HttpsError('not-found', 'ClassSpace not found.');
    if (code.exists) throw new HttpsError('aborted', 'Join code collision. Try again.');
    const oldCode = ws.get('join_code');
    tx.update(wsRef, { join_code: newCode, updated_at: new Date().toISOString() });
    if (oldCode) tx.delete(codeRef(oldCode));
    tx.create(codeRef(newCode), { workspace_id: workspaceId });
  });
  return newCode;
}

async function deleteWorkspace(uid: string, a: any) {
  const workspaceId = String(a.p_workspace_id || '');
  const workspaceRef = db.collection('class_workspaces').doc(workspaceId);
  const workspace = await workspaceRef.get();
  if (!workspace.exists) return { success: false };
  const member = await memberRef(workspaceId, uid).get();
  if (workspace.get('created_by') !== uid && (!member.exists || member.get('role') !== 'owner')) {
    throw new HttpsError('permission-denied', 'Only the ClassSpace owner can delete this workspace.');
  }
  const joinCode = workspace.get('join_code');
  if (joinCode) await codeRef(joinCode).delete();
  const messages = await db.collection('class_messages').where('workspace_id', '==', workspaceId).get();
  const messageIds = messages.docs.map((item) => item.id);
  for (let i = 0; i < messageIds.length; i += 30) {
    const reactions = await db.collection('class_message_reactions').where('message_id', 'in', messageIds.slice(i, i + 30)).get();
    for (let j = 0; j < reactions.docs.length; j += 400) {
      const batch = db.batch();
      reactions.docs.slice(j, j + 400).forEach((item) => batch.delete(item.ref));
      await batch.commit();
    }
  }
  const tables = ['class_members', 'class_channels', 'class_join_requests', 'class_timetable_rules', 'class_timetable_overrides', 'class_attendance_records', 'class_messages', 'class_saved_messages', 'class_notifications'];
  for (const table of tables) {
    const docs = await db.collection(table).where('workspace_id', '==', workspaceId).get();
    for (let i = 0; i < docs.docs.length; i += 400) {
      const batch = db.batch();
      docs.docs.slice(i, i + 400).forEach((item) => batch.delete(item.ref));
      await batch.commit();
    }
  }
  await workspaceRef.delete();
  return { success: true };
}

export async function adminAction(uid: string, name: string, a: any) {
  // 1. Authoritative Server-Side Role Check
  // Note: Request arguments 'a' are strictly ignored for authorization to prevent parameter injection.
  const adminRole = await getAdminRole(uid);

  // Status check RPC: returns boolean without throwing for unprivileged users
  if (name === 'is_platform_admin') {
    return adminRole !== null;
  }

  // All other admin operations require an active platform administrator role
  if (!adminRole) {
    throw new HttpsError('permission-denied', 'Platform administrator access is required.');
  }

  // 2. Read-Only / Support Operations: Allowed for 'owner', 'super_admin', and 'support'
  if (name === 'get_admin_overview_metrics') {
    const [users, workspaces, messages] = await Promise.all([
      listAllAuthUsers(),
      db.collection('class_workspaces').count().get(),
      db.collection('class_messages').count().get(),
    ]);
    return {
      total_users: users.length,
      total_workspaces: workspaces.data().count,
      total_messages: messages.data().count,
    };
  }

  if (name === 'search_users_for_support') {
    const users = await listAllAuthUsers();
    const q = String(a.p_query || '').toLowerCase();
    return users
      .filter((u) => !q || `${u.email || ''} ${u.uid} ${u.displayName || ''}`.toLowerCase().includes(q))
      .slice(Number(a.p_offset || 0), Number(a.p_offset || 0) + Number(a.p_limit || 20))
      .map((u) => ({
        user_id: u.uid,
        email: u.email || '',
        display_name: u.displayName || '',
        created_at: u.metadata.creationTime,
        last_sign_in_at: u.metadata.lastSignInTime,
      }));
  }

  if (name === 'search_workspaces_for_admin') {
    const result = await db.collection('class_workspaces').get();
    const q = String(a.p_query || '').toLowerCase();
    return result.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((w: any) => !q || `${w.name} ${w.institution || ''} ${w.join_code || ''}`.toLowerCase().includes(q))
      .slice(Number(a.p_offset || 0), Number(a.p_offset || 0) + Number(a.p_limit || 20));
  }

  // 3. Modifying / Sensitive Operations: Strictly require 'owner' or 'super_admin' (Operators)
  // Support role is strictly forbidden from mutating workspace join codes.
  if (name === 'admin_rotate_workspace_join_code') {
    if (adminRole !== 'owner' && adminRole !== 'super_admin') {
      throw new HttpsError(
        'permission-denied',
        'Access denied: rotating workspace join codes requires owner or super_admin privileges.'
      );
    }

    const wsRef = db.collection('class_workspaces').doc(String(a.p_workspace_id || ''));
    const newCode = createCode();
    try {
      await db.runTransaction(async (tx) => {
        const [ws, code] = await Promise.all([tx.get(wsRef), tx.get(codeRef(newCode))]);
        if (!ws.exists) throw new HttpsError('not-found', 'ClassSpace not found.');
        if (code.exists) throw new HttpsError('aborted', 'Join code collision. Try again.');
        const oldCode = ws.get('join_code');
        tx.update(wsRef, { join_code: newCode, updated_at: new Date().toISOString() });
        if (oldCode) tx.delete(codeRef(oldCode));
        tx.create(codeRef(newCode), { workspace_id: wsRef.id });
        tx.create(db.collection('admin_audit_logs').doc(), {
          actor_id: uid,
          actor_role: adminRole,
          action: name,
          workspace_id: wsRef.id,
          reason: String(a.p_reason || ''),
          created_at: new Date().toISOString(),
        });
      });
    } catch (err: any) {
      if (err instanceof HttpsError) throw err;
      console.error(`[trackerRpc] Failed to rotate workspace join code or persist audit log for ${wsRef.id}:`, err);
      throw new HttpsError('internal', 'Failed to rotate workspace join code or persist audit record.');
    }
    return newCode;
  }

  // 4. Destructive Operations: Strictly require 'owner' or 'super_admin' (Operators)
  // Support role is strictly forbidden from deleting workspaces.
  if (name === 'admin_delete_workspace') {
    if (adminRole !== 'owner' && adminRole !== 'super_admin') {
      throw new HttpsError(
        'permission-denied',
        'Access denied: deleting workspaces requires owner or super_admin privileges.'
      );
    }

    const wsRef = db.collection('class_workspaces').doc(String(a.p_workspace_id || ''));
    const ws = await wsRef.get();
    if (!ws.exists) return false;
    const batch = db.batch();
    if (ws.get('join_code')) batch.delete(codeRef(ws.get('join_code')));
    batch.set(db.collection('admin_audit_logs').doc(), {
      actor_id: uid,
      actor_role: adminRole,
      action: name,
      workspace_id: wsRef.id,
      reason: String(a.p_reason || ''),
      created_at: new Date().toISOString(),
    });
    try {
      await batch.commit();
    } catch (auditErr: any) {
      console.error(`[trackerRpc] Failed to persist audit log for workspace deletion ${wsRef.id}:`, auditErr);
      throw new HttpsError('internal', 'Failed to persist admin audit log. Workspace deletion aborted.');
    }

    try {
      await db.recursiveDelete(wsRef);
      const messages = await db.collection('class_messages').where('workspace_id', '==', wsRef.id).get();
      for (const message of messages.docs) {
        const reactions = await db.collection('class_message_reactions').where('message_id', '==', message.id).get();
        for (let i = 0; i < reactions.docs.length; i += 400) {
          const chunk = db.batch();
          reactions.docs.slice(i, i + 400).forEach((reaction) => chunk.delete(reaction.ref));
          await chunk.commit();
        }
      }
      for (const table of [
        'class_members',
        'class_channels',
        'class_join_requests',
        'class_timetable_rules',
        'class_timetable_overrides',
        'class_attendance_records',
        'class_messages',
        'class_saved_messages',
        'class_notifications',
      ]) {
        const rows = await db.collection(table).where('workspace_id', '==', wsRef.id).get();
        for (let i = 0; i < rows.docs.length; i += 400) {
          const chunk = db.batch();
          rows.docs.slice(i, i + 400).forEach((row) => chunk.delete(row.ref));
          await chunk.commit();
        }
      }
      return true;
    } catch (delErr: any) {
      console.error(`[trackerRpc] Error during cascading workspace deletion for ${wsRef.id}:`, delErr);
      throw new HttpsError('internal', 'Failed to completely delete workspace resources.');
    }
  }

  throw new HttpsError('not-found', `Admin action ${name} is not implemented.`);
}

export async function handleTrackerRpc(request: any) {
  const uid = userId(request), { name, args = {} } = request.data || {};
  switch (name) {
    case 'create_class_workspace': return createWorkspace(uid, args);
    case 'join_class_workspace': return joinWorkspace(uid, args);
    case 'lookup_workspace_by_join_code': return lookupWorkspace(args);
    case 'request_to_join_workspace': return requestJoin(uid, args);
    case 'review_join_request': return reviewJoinRequest(uid, args);
    case 'transfer_cr_role': return transferCr(uid, args);
    case 'update_co_admin_notice_permission': return updateCoAdmin(uid, args);
    case 'rotate_class_workspace_join_code': return rotateWorkspaceJoinCode(uid, args);
    case 'delete_class_workspace': return deleteWorkspace(uid, args);
    case 'is_platform_admin':
    case 'get_admin_overview_metrics':
    case 'search_users_for_support':
    case 'search_workspaces_for_admin':
    case 'admin_rotate_workspace_join_code':
    case 'admin_delete_workspace': return adminAction(uid, name, args);
    case 'get_user_entitlements': {
      const targetId = String(args.p_user_id || uid);
      if (targetId !== uid) throw new HttpsError('permission-denied', 'Cannot inspect another user subscription.');
      const sub = await db.collection('user_subscriptions').doc(uid).get();
      if (!sub.exists) return null;
      const record = sub.data()!;
      const tier = record.plan_tier || 'free';
      const active = ['active', 'trialing'].includes(String(record.status));
      const features = [
        'timetable', 'attendance', 'pomodoro_timer', 'gym_log', 'syllabus_tracker', 'local_backup', 'classspace_member',
      ];
      if (active && tier !== 'free') features.push('cloud_sync', 'advanced_analytics', 'ai_planner', 'priority_exports', 'early_access');
      if (active && tier === 'cohort') features.push('cohort_storage', 'verified_cr', 'shared_timetable_announcements');
      return {
        tier: active ? tier : 'free',
        is_active: active,
        features,
        current_period_end: record.current_period_end || null,
        cancel_at_period_end: Boolean(record.cancel_at_period_end),
        status: record.status || 'free',
      };
    }
    case 'process_subscription_webhook_event':
      throw new HttpsError('permission-denied', 'Only the verified payment webhook can update subscriptions.');
    default: throw new HttpsError('not-found', `Unknown Tracker action: ${String(name)}`);
  }
}

export const trackerRpc = onCall(handleTrackerRpc);

