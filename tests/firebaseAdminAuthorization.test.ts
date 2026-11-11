import { describe, it, expect, vi, beforeEach } from 'vitest';

// ------------------------------------------------------------------------------
// In-Memory Test State for Firestore and Auth
// ------------------------------------------------------------------------------
interface MockAdminUserRecord {
  user_id: string;
  role?: string;
  is_active?: boolean;
}

interface MockAuthUserRecord {
  uid: string;
  email?: string;
  displayName?: string;
  customClaims?: Record<string, any>;
  metadata?: {
    creationTime?: string;
    lastSignInTime?: string;
  };
}

let mockFirestoreAdminUsers = new Map<string, MockAdminUserRecord>();
let mockAuthUsers = new Map<string, MockAuthUserRecord>();
let mockAuditLogs: any[] = [];
let mockWorkspaces = new Map<string, any>();

let failNextAuditCommit = false;
let failNextTransaction = false;

const authInstance = {
  getUser: vi.fn(async (uid: string) => {
    const u = mockAuthUsers.get(uid);
    if (!u) {
      const err: any = new Error(`User not found: ${uid}`);
      err.code = 'auth/user-not-found';
      throw err;
    }
    return {
      uid: u.uid,
      email: u.email,
      displayName: u.displayName,
      customClaims: u.customClaims || {},
      metadata: u.metadata || {},
    };
  }),
  listUsers: vi.fn(async () => {
    return {
      users: Array.from(mockAuthUsers.values()).map((u) => ({
        uid: u.uid,
        email: u.email,
        displayName: u.displayName,
        metadata: u.metadata || {},
      })),
      pageToken: undefined,
    };
  }),
};

const getDoc = (collectionName: string, docId: string) => {
  if (collectionName === 'admin_users') {
    const record = mockFirestoreAdminUsers.get(docId);
    return {
      id: docId,
      exists: Boolean(record),
      data: () => record,
      get: (field: string) => (record as any)?.[field],
    };
  }
  if (collectionName === 'class_workspaces') {
    const record = mockWorkspaces.get(docId);
    return {
      id: docId,
      exists: Boolean(record),
      data: () => record,
      get: (field: string) => (record as any)?.[field],
    };
  }
  return { id: docId, exists: false, data: () => undefined, get: () => undefined };
};

const firestoreInstance = {
  collection: (col: string) => ({
    doc: (docId = `mock_id_${Math.random()}`) => ({
      id: docId,
      collection: col,
      get: vi.fn(async () => getDoc(col, docId)),
      delete: vi.fn(async () => {
        if (col === 'class_workspaces') mockWorkspaces.delete(docId);
      }),
      update: vi.fn(async (data: any) => {
        if (col === 'class_workspaces') {
          const current = mockWorkspaces.get(docId) || {};
          mockWorkspaces.set(docId, { ...current, ...data });
        }
      }),
    }),
    count: () => ({
      get: vi.fn(async () => ({ data: () => ({ count: 10 }) })),
    }),
    get: vi.fn(async () => ({
      docs: Array.from(mockWorkspaces.entries()).map(([id, d]) => ({
        id,
        data: () => d,
      })),
    })),
    where: vi.fn(() => ({
      get: vi.fn(async () => ({ docs: [] })),
    })),
  }),
  batch: () => ({
    delete: vi.fn(),
    set: vi.fn((ref: any, data: any) => {
      mockAuditLogs.push(data);
    }),
    update: vi.fn(),
    commit: vi.fn(async () => {
      if (failNextAuditCommit) {
        throw new Error('Simulated audit Firestore commit failure');
      }
    }),
  }),
  runTransaction: vi.fn(async (callback: (tx: any) => Promise<any>) => {
    if (failNextTransaction) {
      throw new Error('Simulated transaction commit failure');
    }
    const tx = {
      get: vi.fn(async (ref: any) => {
        if (ref.collection === 'class_join_codes') {
          return { exists: false, data: () => undefined, get: () => undefined };
        }
        return {
          exists: true,
          data: () => ({ name: 'Test WS', join_code: 'OLD99' }),
          get: (field: string) => (field === 'join_code' ? 'OLD99' : undefined),
        };
      }),
      update: vi.fn(),
      delete: vi.fn(),
      create: vi.fn((ref: any, data: any) => {
        if (ref.id?.startsWith('mock_id_') || data.action) {
          mockAuditLogs.push(data);
        }
      }),
    };
    return callback(tx);
  }),
  recursiveDelete: vi.fn(async (ref: any) => {
    mockWorkspaces.delete(ref.id);
  }),
};

// ------------------------------------------------------------------------------
// Mocks for firebase-admin and firebase-functions
// ------------------------------------------------------------------------------
vi.mock('firebase-admin/app', () => ({
  initializeApp: vi.fn(),
  getApps: vi.fn(() => [{ name: '[DEFAULT]' }]),
}));

vi.mock('firebase-admin/auth', () => ({
  getAuth: () => authInstance,
}));

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: () => firestoreInstance,
}));

vi.mock('firebase-functions/v2/https', () => ({
  HttpsError: class HttpsError extends Error {
    constructor(public code: string, message: string) {
      super(message);
      this.name = 'HttpsError';
    }
  },
  onCall: (handler: any) => handler,
}));

// Import after mocks are established
import {
  getAdminRole,
  isPlatformAdmin,
  isPlatformOperator,
  isPlatformOwner,
  handleTrackerRpc,
  setFirebaseAdminForTesting,
} from '../functions/src/trackerRpc';

setFirebaseAdminForTesting({
  db: firestoreInstance,
  auth: authInstance,
});

describe('Firebase Platform Admin Authorization (trackerRpc)', () => {
  const ownerUid = 'usr_owner_sarah';
  const superAdminUid = 'usr_super_admin_alex';
  const supportUid = 'usr_support_dan';
  const studentUid = 'usr_student_bob';
  const deactivatedUid = 'usr_deactivated_dave';
  const legacyClaimUid = 'usr_legacy_claim_admin';

  beforeEach(() => {
    failNextAuditCommit = false;
    failNextTransaction = false;
    mockFirestoreAdminUsers.clear();
    mockAuthUsers.clear();
    mockAuditLogs = [];
    mockWorkspaces.clear();
    setFirebaseAdminForTesting({
      db: firestoreInstance,
      auth: authInstance,
    });

    // 1. Setup Owner in Firestore
    mockFirestoreAdminUsers.set(ownerUid, {
      user_id: ownerUid,
      role: 'owner',
      is_active: true,
    });
    mockAuthUsers.set(ownerUid, {
      uid: ownerUid,
      email: 'owner@trakify.com',
      displayName: 'Sarah Owner',
    });

    // 2. Setup Super Admin in Firestore
    mockFirestoreAdminUsers.set(superAdminUid, {
      user_id: superAdminUid,
      role: 'super_admin',
      is_active: true,
    });
    mockAuthUsers.set(superAdminUid, {
      uid: superAdminUid,
      email: 'superadmin@trakify.com',
      displayName: 'Alex SuperAdmin',
    });

    // 3. Setup Support User in Firestore
    mockFirestoreAdminUsers.set(supportUid, {
      user_id: supportUid,
      role: 'support',
      is_active: true,
    });
    mockAuthUsers.set(supportUid, {
      uid: supportUid,
      email: 'support@trakify.com',
      displayName: 'Dan Support',
    });

    // 4. Setup Ordinary Student
    mockAuthUsers.set(studentUid, {
      uid: studentUid,
      email: 'bob@university.edu',
      displayName: 'Bob Student',
    });

    // 5. Setup Deactivated Admin (exists in Firestore, is_active: false, but has legacy custom claim)
    mockFirestoreAdminUsers.set(deactivatedUid, {
      user_id: deactivatedUid,
      role: 'super_admin',
      is_active: false,
    });
    mockAuthUsers.set(deactivatedUid, {
      uid: deactivatedUid,
      email: 'dave@compromised.com',
      customClaims: { admin: true, role: 'super_admin' },
    });

    // 6. Setup Legacy Claim User (no Firestore record, customClaims: { admin: true })
    mockAuthUsers.set(legacyClaimUid, {
      uid: legacyClaimUid,
      email: 'legacy@trakify.com',
      customClaims: { admin: true },
    });

    // Setup a sample workspace for testing deletion and rotation
    mockWorkspaces.set('ws_cs101', {
      name: 'CS101 Intro to Computer Science',
      institution: 'MIT',
      join_code: 'CS101',
      created_by: 'some_cr_uid',
    });
  });

  describe('1. Role Resolution & Invariants (getAdminRole)', () => {
    it('resolves owner role correctly from Firestore record', async () => {
      const role = await getAdminRole(ownerUid);
      expect(role).toBe('owner');
      expect(await isPlatformAdmin(ownerUid)).toBe(true);
      expect(await isPlatformOperator(ownerUid)).toBe(true);
      expect(await isPlatformOwner(ownerUid)).toBe(true);
    });

    it('resolves super_admin role correctly from Firestore record', async () => {
      const role = await getAdminRole(superAdminUid);
      expect(role).toBe('super_admin');
      expect(await isPlatformAdmin(superAdminUid)).toBe(true);
      expect(await isPlatformOperator(superAdminUid)).toBe(true);
      expect(await isPlatformOwner(superAdminUid)).toBe(false);
    });

    it('resolves support role correctly from Firestore record', async () => {
      const role = await getAdminRole(supportUid);
      expect(role).toBe('support');
      expect(await isPlatformAdmin(supportUid)).toBe(true);
      expect(await isPlatformOperator(supportUid)).toBe(false);
      expect(await isPlatformOwner(supportUid)).toBe(false);
    });

    it('returns null for ordinary students without admin records or claims', async () => {
      const role = await getAdminRole(studentUid);
      expect(role).toBeNull();
      expect(await isPlatformAdmin(studentUid)).toBe(false);
      expect(await isPlatformOperator(studentUid)).toBe(false);
      expect(await isPlatformOwner(studentUid)).toBe(false);
    });

    it('STRICTLY DENIES deactivated admins even if Firebase token has customClaims: admin=true', async () => {
      // Security Invariant: Firestore is_active=false overrides any custom claims
      const role = await getAdminRole(deactivatedUid);
      expect(role).toBeNull();
      expect(await isPlatformAdmin(deactivatedUid)).toBe(false);
      expect(await isPlatformOperator(deactivatedUid)).toBe(false);
    });

    it('STRICTLY DENIES user with only legacy customClaims: admin=true when Firestore document is missing', async () => {
      // Security Invariant: Firestore is the sole authority; custom claims without a Firestore record are denied
      const role = await getAdminRole(legacyClaimUid);
      expect(role).toBeNull();
      expect(await isPlatformAdmin(legacyClaimUid)).toBe(false);
      expect(await isPlatformOperator(legacyClaimUid)).toBe(false);
    });

    it('returns null if role in Firestore is invalid or unrecognized', async () => {
      mockFirestoreAdminUsers.set('usr_corrupt_role', {
        user_id: 'usr_corrupt_role',
        role: 'god_mode', // Invalid role
        is_active: true,
      });
      const role = await getAdminRole('usr_corrupt_role');
      expect(role).toBeNull();
    });
  });

  describe('2. Unauthenticated Users', () => {
    it('rejects unauthenticated requests with unauthenticated error', async () => {
      await expect(
        handleTrackerRpc({
          auth: null,
          data: { name: 'is_platform_admin' },
        })
      ).rejects.toThrow(/Sign in to continue/i);
    });

    it('rejects requests with missing or empty uid', async () => {
      await expect(
        handleTrackerRpc({
          auth: { uid: '' },
          data: { name: 'get_admin_overview_metrics' },
        })
      ).rejects.toThrow(/Sign in to continue/i);
    });
  });

  describe('3. Ordinary Students (Unauthorized Invocation Attempts)', () => {
    it('returns false without throwing when ordinary student queries is_platform_admin', async () => {
      const res = await handleTrackerRpc({
        auth: { uid: studentUid },
        data: { name: 'is_platform_admin' },
      });
      expect(res).toBe(false);
    });

    it('denies ordinary student from calling get_admin_overview_metrics', async () => {
      await expect(
        handleTrackerRpc({
          auth: { uid: studentUid },
          data: { name: 'get_admin_overview_metrics' },
        })
      ).rejects.toThrow(/Platform administrator access is required/i);
    });

    it('denies ordinary student from calling search_users_for_support', async () => {
      await expect(
        handleTrackerRpc({
          auth: { uid: studentUid },
          data: { name: 'search_users_for_support', args: { p_query: 'test' } },
        })
      ).rejects.toThrow(/Platform administrator access is required/i);
    });

    it('denies ordinary student from calling search_workspaces_for_admin', async () => {
      await expect(
        handleTrackerRpc({
          auth: { uid: studentUid },
          data: { name: 'search_workspaces_for_admin', args: { p_query: 'test' } },
        })
      ).rejects.toThrow(/Platform administrator access is required/i);
    });

    it('denies ordinary student from calling admin_rotate_workspace_join_code', async () => {
      await expect(
        handleTrackerRpc({
          auth: { uid: studentUid },
          data: { name: 'admin_rotate_workspace_join_code', args: { p_workspace_id: 'ws_cs101' } },
        })
      ).rejects.toThrow(/Platform administrator access is required/i);
    });

    it('denies ordinary student from calling admin_delete_workspace', async () => {
      await expect(
        handleTrackerRpc({
          auth: { uid: studentUid },
          data: { name: 'admin_delete_workspace', args: { p_workspace_id: 'ws_cs101' } },
        })
      ).rejects.toThrow(/Platform administrator access is required/i);
    });
  });

  describe('4. Parameter Forgery & Role Injection Prevention', () => {
    it('ignores client-supplied role or admin parameters in args', async () => {
      // Attacker attempts to forge arguments pretending to be an owner
      await expect(
        handleTrackerRpc({
          auth: { uid: studentUid },
          data: {
            name: 'admin_delete_workspace',
            args: {
              p_workspace_id: 'ws_cs101',
              role: 'owner',
              p_role: 'owner',
              is_admin: true,
              admin: true,
            },
          },
        })
      ).rejects.toThrow(/Platform administrator access is required/i);
    });

    it('ignores client-supplied is_admin parameters in is_platform_admin check', async () => {
      const res = await handleTrackerRpc({
        auth: { uid: studentUid },
        data: {
          name: 'is_platform_admin',
          args: { is_admin: true, role: 'owner' },
        },
      });
      expect(res).toBe(false);
    });
  });

  describe('5. Support Role: Read-Only Access & Destructive Denial', () => {
    it('permits support user to query is_platform_admin (returns true)', async () => {
      const res = await handleTrackerRpc({
        auth: { uid: supportUid },
        data: { name: 'is_platform_admin' },
      });
      expect(res).toBe(true);
    });

    it('permits support user to inspect admin overview metrics', async () => {
      const res = await handleTrackerRpc({
        auth: { uid: supportUid },
        data: { name: 'get_admin_overview_metrics' },
      });
      expect(res).toHaveProperty('total_users');
      expect(res).toHaveProperty('total_workspaces');
    });

    it('permits support user to search users for support', async () => {
      const res = await handleTrackerRpc({
        auth: { uid: supportUid },
        data: { name: 'search_users_for_support', args: { p_query: 'bob' } },
      });
      expect(Array.isArray(res)).toBe(true);
    });

    it('permits support user to search workspaces for admin inspection', async () => {
      const res = await handleTrackerRpc({
        auth: { uid: supportUid },
        data: { name: 'search_workspaces_for_admin', args: { p_query: 'cs101' } },
      });
      expect(Array.isArray(res)).toBe(true);
    });

    it('STRICTLY BLOCKS support user from rotating workspace join code', async () => {
      // Security Invariant: Support role cannot execute operator actions
      await expect(
        handleTrackerRpc({
          auth: { uid: supportUid },
          data: {
            name: 'admin_rotate_workspace_join_code',
            args: { p_workspace_id: 'ws_cs101', p_reason: 'Testing support block' },
          },
        })
      ).rejects.toThrow(/rotating workspace join codes requires owner or super_admin privileges/i);
    });

    it('STRICTLY BLOCKS support user from deleting workspaces', async () => {
      // Security Invariant: Support role cannot execute destructive actions
      await expect(
        handleTrackerRpc({
          auth: { uid: supportUid },
          data: {
            name: 'admin_delete_workspace',
            args: { p_workspace_id: 'ws_cs101', p_reason: 'Attempted support deletion' },
          },
        })
      ).rejects.toThrow(/deleting workspaces requires owner or super_admin privileges/i);
    });
  });

  describe('6. Super Admin & Owner Roles: Full Administration', () => {
    it('permits super_admin to rotate workspace join code and logs audit trail', async () => {
      const res = await handleTrackerRpc({
        auth: { uid: superAdminUid },
        data: {
          name: 'admin_rotate_workspace_join_code',
          args: { p_workspace_id: 'ws_cs101', p_reason: 'Compromised join code' },
        },
      });
      expect(typeof res).toBe('string');
      expect(res.length).toBe(5);

      const auditLog = mockAuditLogs.find((l) => l.action === 'admin_rotate_workspace_join_code');
      expect(auditLog).toBeDefined();
      expect(auditLog.actor_id).toBe(superAdminUid);
      expect(auditLog.actor_role).toBe('super_admin');
    });

    it('permits super_admin to delete workspace and logs audit trail', async () => {
      const res = await handleTrackerRpc({
        auth: { uid: superAdminUid },
        data: {
          name: 'admin_delete_workspace',
          args: { p_workspace_id: 'ws_cs101', p_reason: 'Violated terms of service' },
        },
      });
      expect(res).toBe(true);

      const auditLog = mockAuditLogs.find((l) => l.action === 'admin_delete_workspace');
      expect(auditLog).toBeDefined();
      expect(auditLog.actor_id).toBe(superAdminUid);
      expect(auditLog.actor_role).toBe('super_admin');
    });

    it('permits owner full administration for all operations', async () => {
      const metrics = await handleTrackerRpc({
        auth: { uid: ownerUid },
        data: { name: 'get_admin_overview_metrics' },
      });
      expect(metrics).toHaveProperty('total_users');

      const rotateRes = await handleTrackerRpc({
        auth: { uid: ownerUid },
        data: {
          name: 'admin_rotate_workspace_join_code',
          args: { p_workspace_id: 'ws_cs101', p_reason: 'Owner rotation' },
        },
      });
      expect(typeof rotateRes).toBe('string');

      const deleteRes = await handleTrackerRpc({
        auth: { uid: ownerUid },
        data: {
          name: 'admin_delete_workspace',
          args: { p_workspace_id: 'ws_cs101', p_reason: 'Owner cleanup' },
        },
      });
      expect(deleteRes).toBe(true);

      const deleteLog = mockAuditLogs.find((l) => l.actor_id === ownerUid && l.action === 'admin_delete_workspace');
      expect(deleteLog).toBeDefined();
      expect(deleteLog.actor_role).toBe('owner');
    });
  });

  describe('7. Unknown Actions', () => {
    it('throws not-found error when an unknown admin action is called', async () => {
      await expect(
        handleTrackerRpc({
          auth: { uid: ownerUid },
          data: { name: 'admin_hack_database' },
        })
      ).rejects.toThrow(/Unknown Tracker action/i);
    });
  });

  describe('8. Firestore Sole Authority & Custom Claim Isolation (Pre-Deployment Hardening)', () => {
    it('STRICTLY DENIES when Firestore record is missing, even with owner custom claim', async () => {
      const missingDocUid = 'usr_claim_only_owner';
      mockAuthUsers.set(missingDocUid, {
        uid: missingDocUid,
        email: 'attacker_claim_owner@test.com',
        customClaims: { role: 'owner', owner: true, admin: true },
      });

      const role = await getAdminRole(missingDocUid);
      expect(role).toBeNull();
      expect(await isPlatformAdmin(missingDocUid)).toBe(false);

      await expect(
        handleTrackerRpc({
          auth: { uid: missingDocUid },
          data: { name: 'admin_delete_workspace', args: { p_workspace_id: 'ws_cs101' } },
        })
      ).rejects.toThrow(/Platform administrator access is required/i);
    });

    it('STRICTLY DENIES when Firestore record is missing, even with super_admin custom claim', async () => {
      const missingDocUid = 'usr_claim_only_super_admin';
      mockAuthUsers.set(missingDocUid, {
        uid: missingDocUid,
        email: 'attacker_claim_sa@test.com',
        customClaims: { role: 'super_admin', admin: true },
      });

      const role = await getAdminRole(missingDocUid);
      expect(role).toBeNull();
      expect(await isPlatformAdmin(missingDocUid)).toBe(false);

      await expect(
        handleTrackerRpc({
          auth: { uid: missingDocUid },
          data: { name: 'get_admin_overview_metrics' },
        })
      ).rejects.toThrow(/Platform administrator access is required/i);
    });

    it('STRICTLY DENIES when Firestore record is missing, even with admin: true custom claim', async () => {
      const missingDocUid = 'usr_claim_only_admin_flag';
      mockAuthUsers.set(missingDocUid, {
        uid: missingDocUid,
        email: 'attacker_claim_admin@test.com',
        customClaims: { admin: true },
      });

      const role = await getAdminRole(missingDocUid);
      expect(role).toBeNull();
      expect(await isPlatformAdmin(missingDocUid)).toBe(false);
    });

    it('STRICTLY DENIES inactive Firestore record, regardless of any custom claims', async () => {
      const inactiveWithClaimUid = 'usr_inactive_with_owner_claim';
      mockFirestoreAdminUsers.set(inactiveWithClaimUid, {
        user_id: inactiveWithClaimUid,
        role: 'owner',
        is_active: false,
      });
      mockAuthUsers.set(inactiveWithClaimUid, {
        uid: inactiveWithClaimUid,
        customClaims: { role: 'owner', owner: true, admin: true },
      });

      const role = await getAdminRole(inactiveWithClaimUid);
      expect(role).toBeNull();
      expect(await isPlatformAdmin(inactiveWithClaimUid)).toBe(false);

      await expect(
        handleTrackerRpc({
          auth: { uid: inactiveWithClaimUid },
          data: { name: 'admin_delete_workspace', args: { p_workspace_id: 'ws_cs101' } },
        })
      ).rejects.toThrow(/Platform administrator access is required/i);
    });

    it('PRESERVES support role from Firestore even if caller has owner custom claim', async () => {
      const supportWithElevationUid = 'usr_support_spoofed_claim';
      mockFirestoreAdminUsers.set(supportWithElevationUid, {
        user_id: supportWithElevationUid,
        role: 'support',
        is_active: true,
      });
      mockAuthUsers.set(supportWithElevationUid, {
        uid: supportWithElevationUid,
        customClaims: { role: 'owner', owner: true, admin: true },
      });

      // Role must strictly resolve to 'support', NOT 'owner'
      const role = await getAdminRole(supportWithElevationUid);
      expect(role).toBe('support');
      expect(await isPlatformAdmin(supportWithElevationUid)).toBe(true);
      expect(await isPlatformOperator(supportWithElevationUid)).toBe(false);
      expect(await isPlatformOwner(supportWithElevationUid)).toBe(false);

      // Support user must still be BLOCKED from destructive actions despite owner claim
      await expect(
        handleTrackerRpc({
          auth: { uid: supportWithElevationUid },
          data: { name: 'admin_delete_workspace', args: { p_workspace_id: 'ws_cs101' } },
        })
      ).rejects.toThrow(/deleting workspaces requires owner or super_admin privileges/i);
    });

    it('PRESERVES owner role from Firestore even if caller has conflicting support custom claim', async () => {
      const ownerWithSupportClaimUid = 'usr_owner_with_support_claim';
      mockFirestoreAdminUsers.set(ownerWithSupportClaimUid, {
        user_id: ownerWithSupportClaimUid,
        role: 'owner',
        is_active: true,
      });
      mockAuthUsers.set(ownerWithSupportClaimUid, {
        uid: ownerWithSupportClaimUid,
        customClaims: { role: 'support' },
      });

      // Role must strictly resolve to 'owner' based on authoritative Firestore
      const role = await getAdminRole(ownerWithSupportClaimUid);
      expect(role).toBe('owner');
      expect(await isPlatformAdmin(ownerWithSupportClaimUid)).toBe(true);
      expect(await isPlatformOperator(ownerWithSupportClaimUid)).toBe(true);
      expect(await isPlatformOwner(ownerWithSupportClaimUid)).toBe(true);

      // Owner should successfully perform operator actions
      const res = await handleTrackerRpc({
        auth: { uid: ownerWithSupportClaimUid },
        data: {
          name: 'admin_rotate_workspace_join_code',
          args: { p_workspace_id: 'ws_cs101', p_reason: 'Owner verification' },
        },
      });
      expect(typeof res).toBe('string');
    });

    it('RETAINS permitted administrative access for active Firestore super_admin', async () => {
      const role = await getAdminRole(superAdminUid);
      expect(role).toBe('super_admin');
      expect(await isPlatformOperator(superAdminUid)).toBe(true);

      // Super admin can rotate join codes and delete workspaces
      const rotateRes = await handleTrackerRpc({
        auth: { uid: superAdminUid },
        data: {
          name: 'admin_rotate_workspace_join_code',
          args: { p_workspace_id: 'ws_cs101', p_reason: 'Admin audit' },
        },
      });
      expect(typeof rotateRes).toBe('string');

      const deleteRes = await handleTrackerRpc({
        auth: { uid: superAdminUid },
        data: {
          name: 'admin_delete_workspace',
          args: { p_workspace_id: 'ws_cs101', p_reason: 'Admin audit delete' },
        },
      });
      expect(deleteRes).toBe(true);
    });
  });

  describe('9. Audit Log Persistence Failure Resilience', () => {
    it('aborts workspace deletion and throws internal error if audit log write fails', async () => {
      // Simulate audit log write failure
      failNextAuditCommit = true;

      await expect(
        handleTrackerRpc({
          auth: { uid: superAdminUid },
          data: {
            name: 'admin_delete_workspace',
            args: { p_workspace_id: 'ws_cs101', p_reason: 'Testing audit resilience' },
          },
        })
      ).rejects.toThrow(/Failed to persist admin audit log/i);

      // Critical invariant: Workspace was NOT deleted because audit log failed
      expect(mockWorkspaces.has('ws_cs101')).toBe(true);
    });

    it('aborts workspace join code rotation and throws internal error if transaction/audit fails', async () => {
      // Simulate transaction/audit write failure
      failNextTransaction = true;

      await expect(
        handleTrackerRpc({
          auth: { uid: superAdminUid },
          data: {
            name: 'admin_rotate_workspace_join_code',
            args: { p_workspace_id: 'ws_cs101', p_reason: 'Testing audit failure' },
          },
        })
      ).rejects.toThrow(/Failed to rotate workspace join code or persist audit record/i);

      // Invariant: Workspace join code was NOT modified
      const ws = mockWorkspaces.get('ws_cs101');
      expect(ws.join_code).toBe('CS101');
    });
  });
});

