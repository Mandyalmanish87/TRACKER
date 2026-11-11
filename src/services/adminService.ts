/**
 * Platform Administration Service
 * Milestone 04: Owner & Platform Administrative Portal
 * Cirrel-Inspired Admin Control Center + Apple × Spatial UI
 *
 * Uses Firebase callable functions and Firestore rules for server-authoritative administration.
 *
 * NOTE: UI gating is UX-only. All data mutations and reads are strictly
 * enforced by Firebase Functions and Firestore Security Rules.
 */

import { getFirebaseDataClientForServices, getSupabaseClient } from './authService';
import {
  isCloudDegraded,
  markCloudDegraded,
  isQuotaOrDegradedError,
} from './degradedModeService';

function isTestEnvironment(): boolean {
  return Boolean(
    (typeof process !== 'undefined' && (process.env?.NODE_ENV === 'test' || Boolean(process.env?.VITEST))) ||
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.MODE === 'test')
  );
}

function getAdminDataClient(): any {
  return getFirebaseDataClientForServices() || (isTestEnvironment() ? getSupabaseClient() : null);
}
import {
  AdminVerificationResult,
  AdminOverviewMetrics,
  UserSupportRecord,
  AdminWorkspaceRecord,
  AdminAuditLogEntry,
  PlatformAdminRole,
  LocalActivityLogEntry,
  DataIntegrityReport,
  AdminSystemHealth,
  AdminSubscriptionPass,
  AdminPaymentTransaction,
  AdminLicenseKey,
  AdminPromoCoupon,
  AdminWebsiteBrandingConfig,
  AdminFoodRecalibrationRecord,
  AdminCurrency,
  YouTubeImportQuotaStatus,
} from '../types/admin';
import { AppStateData } from '../types';
import { OFFLINE_FOOD_CATALOGUE } from '../data/foodCatalogue';

export const LOCAL_ACTIVITY_LOG_KEY = 'tracker_admin_activity_log';
export const LOCAL_ADMIN_OVERRIDE_KEY = 'tracker_local_admin_override';
export const ADMIN_SUBSCRIPTION_PASSES_KEY = 'tracker_admin_subscription_passes';
export const ADMIN_WEBSITE_BRANDING_KEY = 'tracker_admin_website_branding';
export const ADMIN_FOOD_RECALIBRATIONS_KEY = 'tracker_admin_food_recalibrations';
export const ADMIN_LICENSE_KEYS_KEY = 'tracker_admin_license_keys';
export const ADMIN_PROMO_COUPONS_KEY = 'tracker_admin_promo_coupons';
export const ADMIN_PAYMENT_TRANSACTIONS_KEY = 'tracker_admin_payment_transactions';
export const ADMIN_CURRENCY_PREF_KEY = 'tracker_admin_currency_pref';

/**
 * Calculates Purchasing Power Parity (PPP) inflation-adjusted USD price for foreign students.
 * In India, student spend parity index is approx 28-30 INR per international consumer dollar
 * (reflecting the exact economic burden an Indian student pays vs. foreign student inflation).
 */
export function calculatePppUsdPrice(inr: number): number {
  if (inr <= 0) return 0;
  const rawPpp = inr / 29.5;
  const rounded = Math.floor(rawPpp);
  return Math.max(0.99, Number((rounded + 0.99).toFixed(2)));
}

/**
 * Formats monetary amounts with appropriate currency symbol (₹ Rupees default, or $ USD for foreign parity).
 */
export function formatAdminCurrency(amount: number, currency: AdminCurrency = 'INR'): string {
  if (currency === 'INR') {
    return `₹${Math.round(amount).toLocaleString('en-IN')}`;
  }
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export class AdminService {
  /**
   * Verifies whether the currently authenticated user is an active platform administrator.
   * Calls the server-side RPC public.is_platform_admin().
   */
  async verifyPlatformAdmin(): Promise<AdminVerificationResult> {
    if (isCloudDegraded()) {
      return { isAdmin: false, error: 'HTTP 402: Service restricted' };
    }

    const firebaseDb = getAdminDataClient();
    if (!firebaseDb) {
      // Check if local owner override is active for local-first administration
      try {
        if (typeof window !== 'undefined' && localStorage.getItem(LOCAL_ADMIN_OVERRIDE_KEY) === 'true') {
          return {
            isAdmin: true,
            role: 'owner',
            userId: 'usr_local_student',
            isLocalMode: true,
          };
        }
      } catch {}
      return { isAdmin: false, error: 'Cloud backend is not configured' };
    }

    try {
      const { data: { session }, error: sessionError } = await firebaseDb.auth.getSession();
      if (sessionError || !session?.user) {
        return { isAdmin: false, error: 'Authentication required' };
      }

      const { data, error } = await firebaseDb.rpc('is_platform_admin');

      if (error) {
        if (isQuotaOrDegradedError(error)) {
          markCloudDegraded('HTTP 402 on verifyPlatformAdmin');
        }
        return {
          isAdmin: false,
          userId: session.user.id,
          error: error.message || 'Access verification failed',
        };
      }

      if (!data) {
        return {
          isAdmin: false,
          userId: session.user.id,
          error: 'Forbidden: Current account is not an authorized platform administrator',
        };
      }

      // Fetch admin role if authorized
      const { data: adminRecord } = await firebaseDb
        .from('admin_users')
        .select('role')
        .eq('user_id', session.user.id)
        .eq('is_active', true)
        .maybeSingle();

      return {
        isAdmin: true,
        userId: session.user.id,
        role: (adminRecord?.role as PlatformAdminRole) || 'support',
        isLocalMode: false,
      };
    } catch (err: any) {
      if (isQuotaOrDegradedError(err)) {
        markCloudDegraded('HTTP 402 on verifyPlatformAdmin');
      }
      return {
        isAdmin: false,
        error: err?.message || 'Network or authorization error during admin check',
      };
    }
  }

  /**
   * Enables local instance owner administration mode for local-first testing and oversight.
   */
  enableLocalAdminMode(): void {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(LOCAL_ADMIN_OVERRIDE_KEY, 'true');
      }
    } catch {}
  }

  /**
   * Disables local instance owner administration mode.
   */
  disableLocalAdminMode(): void {
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(LOCAL_ADMIN_OVERRIDE_KEY);
      }
    } catch {}
  }

  /**
   * Fetches high-level operational metrics (active users, total workspaces, system health).
   * Guarded by server-side public.get_admin_overview_metrics() RPC.
   */
  async fetchOverviewMetrics(): Promise<{ data: AdminOverviewMetrics | null; error?: string }> {
    if (isCloudDegraded()) {
      return { data: null, error: 'HTTP 402: Cloud database quota exceeded' };
    }

    const firebaseDb = getAdminDataClient();
    if (!firebaseDb) {
      return { data: null, error: 'Backend unconfigured' };
    }

    try {
      const { data, error } = await firebaseDb.rpc('get_admin_overview_metrics');
      if (error) {
        if (isQuotaOrDegradedError(error)) {
          markCloudDegraded('HTTP 402 on fetchOverviewMetrics');
          return { data: null, error: 'HTTP 402: Cloud database quota exceeded' };
        }
        return { data: null, error: error.message };
      }
      return { data: data as AdminOverviewMetrics };
    } catch (err: any) {
      if (isQuotaOrDegradedError(err)) {
        markCloudDegraded('HTTP 402 on fetchOverviewMetrics');
        return { data: null, error: 'HTTP 402: Cloud database quota exceeded' };
      }
      return { data: null, error: err?.message || 'Failed to fetch admin metrics' };
    }
  }

  /**
   * Searches registered users by email or ID for customer support inquiries.
   * Does NOT return student attendance, notes, gym, or tracker JSON.
   */
  async searchUsers(
    query = '',
    limit = 20,
    offset = 0
  ): Promise<{ data: UserSupportRecord[]; error?: string }> {
    if (isCloudDegraded()) {
      return { data: [], error: 'HTTP 402: Cloud database quota exceeded' };
    }

    const firebaseDb = getAdminDataClient();
    if (!firebaseDb) {
      return { data: [], error: 'Backend unconfigured' };
    }

    try {
      const { data, error } = await firebaseDb.rpc('search_users_for_support', {
        p_query: query.trim(),
        p_limit: limit,
        p_offset: offset,
      });

      if (error) {
        if (isQuotaOrDegradedError(error)) {
          markCloudDegraded('HTTP 402 on searchUsers');
          return { data: [], error: 'HTTP 402: Cloud database quota exceeded' };
        }
        return { data: [], error: error.message };
      }
      return { data: (data as UserSupportRecord[]) || [] };
    } catch (err: any) {
      if (isQuotaOrDegradedError(err)) {
        markCloudDegraded('HTTP 402 on searchUsers');
        return { data: [], error: 'HTTP 402: Cloud database quota exceeded' };
      }
      return { data: [], error: err?.message || 'User search failed' };
    }
  }

  /**
   * Searches ClassSpace workspaces for administrative moderation.
   */
  async searchWorkspaces(
    query = '',
    limit = 20,
    offset = 0
  ): Promise<{ data: AdminWorkspaceRecord[]; error?: string }> {
    if (isCloudDegraded()) {
      return { data: [], error: 'HTTP 402: Cloud database quota exceeded' };
    }

    const firebaseDb = getAdminDataClient();
    if (!firebaseDb) {
      return { data: [], error: 'Backend unconfigured' };
    }

    try {
      const { data, error } = await firebaseDb.rpc('search_workspaces_for_admin', {
        p_query: query.trim(),
        p_limit: limit,
        p_offset: offset,
      });

      if (error) {
        if (isQuotaOrDegradedError(error)) {
          markCloudDegraded('HTTP 402 on searchWorkspaces');
          return { data: [], error: 'HTTP 402: Cloud database quota exceeded' };
        }
        return { data: [], error: error.message };
      }
      return { data: (data as AdminWorkspaceRecord[]) || [] };
    } catch (err: any) {
      if (isQuotaOrDegradedError(err)) {
        markCloudDegraded('HTTP 402 on searchWorkspaces');
        return { data: [], error: 'HTTP 402: Cloud database quota exceeded' };
      }
      return { data: [], error: err?.message || 'Workspace search failed' };
    }
  }

  /**
   * Generates a new join code for a compromised ClassSpace workspace and logs to audit trail.
   */
  async rotateWorkspaceJoinCode(
    workspaceId: string,
    reason: string
  ): Promise<{ newCode: string | null; error?: string }> {
    if (!reason || reason.trim().length < 3) {
      return { newCode: null, error: 'A valid administrative reason is required' };
    }

    const firebaseDb = getAdminDataClient();
    if (!firebaseDb) {
      return { newCode: null, error: 'Backend unconfigured' };
    }

    try {
      const { data, error } = await firebaseDb.rpc('admin_rotate_workspace_join_code', {
        p_workspace_id: workspaceId,
        p_reason: reason.trim(),
      });

      if (error) {
        return { newCode: null, error: error.message };
      }
      return { newCode: data as string };
    } catch (err: any) {
      return { newCode: null, error: err?.message || 'Join code rotation failed' };
    }
  }

  /**
   * Permanently deletes a malicious or abusive workspace with mandatory audit logging.
   */
  async deleteWorkspace(
    workspaceId: string,
    reason: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!reason || reason.trim().length < 5) {
      return { success: false, error: 'A detailed reason (at least 5 characters) is required' };
    }

    const firebaseDb = getAdminDataClient();
    if (!firebaseDb) {
      return { success: false, error: 'Backend unconfigured' };
    }

    try {
      const { data, error } = await firebaseDb.rpc('admin_delete_workspace', {
        p_workspace_id: workspaceId,
        p_reason: reason.trim(),
      });

      if (error) {
        return { success: false, error: error.message };
      }
      return { success: Boolean(data) };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Workspace deletion failed' };
    }
  }

  /**
   * Fetches paginated immutable audit logs for administrative inspection.
   */
  async fetchAuditLogs(
    limit = 50,
    offset = 0
  ): Promise<{ data: AdminAuditLogEntry[]; error?: string }> {
    if (isCloudDegraded()) {
      return { data: [], error: 'HTTP 402: Cloud database quota exceeded' };
    }

    const firebaseDb = getAdminDataClient();
    if (!firebaseDb) {
      return { data: [], error: 'Backend unconfigured' };
    }

    try {
      const { data, error } = await firebaseDb
        .from('admin_audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        if (isQuotaOrDegradedError(error)) {
          markCloudDegraded('HTTP 402 on fetchAuditLogs');
          return { data: [], error: 'HTTP 402: Cloud database quota exceeded' };
        }
        return { data: [], error: error.message };
      }
      return { data: (data as AdminAuditLogEntry[]) || [] };
    } catch (err: any) {
      if (isQuotaOrDegradedError(err)) {
        markCloudDegraded('HTTP 402 on fetchAuditLogs');
        return { data: [], error: 'HTTP 402: Cloud database quota exceeded' };
      }
      return { data: [], error: err?.message || 'Audit log query failed' };
    }
  }

  /**
   * Records a local administrative or application event to localStorage audit trail.
   */
  logLocalActivity(
    action: string,
    category: LocalActivityLogEntry['category'],
    details: string,
    status: LocalActivityLogEntry['status'] = 'info',
    actor = 'admin'
  ): void {
    try {
      if (typeof window === 'undefined') return;
      const existing = this.getLocalActivityLogs();
      const newEntry: LocalActivityLogEntry = {
        id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        timestamp: new Date().toISOString(),
        action,
        category,
        details,
        status,
        actor,
      };
      const updated = [newEntry, ...existing].slice(0, 200);
      localStorage.setItem(LOCAL_ACTIVITY_LOG_KEY, JSON.stringify(updated));
    } catch (err) {
      console.warn('[AdminService] logLocalActivity error:', err);
    }
  }

  /**
   * Retrieves prospective local administrative activity logs.
   */
  getLocalActivityLogs(): LocalActivityLogEntry[] {
    try {
      if (typeof window === 'undefined') return [];
      const raw = localStorage.getItem(LOCAL_ACTIVITY_LOG_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  /**
   * Validates application-wide data integrity without mutating records.
   */
  validateDataIntegrity(state: AppStateData): DataIntegrityReport {
    const issues: DataIntegrityReport['issues'] = [];
    const subjects = state.subjects || [];
    const subjectIds = new Set(subjects.map((s) => s.id));

    // Check subjects
    subjects.forEach((s) => {
      if (!s.name || s.name.trim() === '') {
        issues.push({ category: 'Subjects', level: 'error', message: 'Subject missing name', affectedId: s.id });
      }
      if (s.targetPct < 0 || s.targetPct > 100) {
        issues.push({ category: 'Subjects', level: 'warning', message: `Subject target attendance out of bounds (${s.targetPct}%)`, affectedId: s.id });
      }
    });

    // Check timetable slots
    const timetable = state.timetable || [];
    timetable.forEach((slot) => {
      if (slot.subjectId && !subjectIds.has(slot.subjectId)) {
        issues.push({ category: 'Timetable', level: 'warning', message: `Timetable slot references missing subjectId: ${slot.subjectId}`, affectedId: slot.id });
      }
      if (slot.dayOfWeek < 0 || slot.dayOfWeek > 6) {
        issues.push({ category: 'Timetable', level: 'error', message: `Invalid dayOfWeek: ${slot.dayOfWeek}`, affectedId: slot.id });
      }
    });

    // Check attendance logs
    const attendance = state.attendanceLogs || [];
    attendance.forEach((log) => {
      if (!subjectIds.has(log.subjectId)) {
        issues.push({ category: 'Attendance', level: 'warning', message: `Attendance log references unindexed subject: ${log.subjectId}`, affectedId: log.id });
      }
    });

    // Check syllabus
    const syllabus = state.syllabusSubjects || [];
    syllabus.forEach((s) => {
      (s.chapters || []).forEach((c) => {
        (c.subtopics || []).forEach((t) => {
          if (!t.name || t.name.trim() === '') {
            issues.push({ category: 'Syllabus', level: 'info', message: 'Syllabus subtopic has empty name', affectedId: t.id });
          }
        });
      });
    });

    // Storage size estimate
    let sizeBytes = 0;
    try {
      if (typeof window !== 'undefined') {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key) {
            const val = localStorage.getItem(key) || '';
            sizeBytes += (key.length + val.length) * 2; // UTF-16
          }
        }
      }
    } catch {}

    const formatBytes = (bytes: number): string => {
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
      return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    };

    return {
      isValid: issues.filter((i) => i.level === 'error').length === 0,
      checkedAt: new Date().toISOString(),
      storageSizeBytes: sizeBytes,
      storageSizeFormatted: formatBytes(sizeBytes),
      schemaVersion: state.schemaVersion || 2,
      issues,
      counts: {
        subjects: subjects.length,
        timetableSlots: timetable.length,
        attendanceLogs: attendance.length,
        syllabusSubjects: syllabus.length,
        tasks: (state.tasks || []).length,
        reminders: (state.reminders || []).length,
        workouts: (state.gymWorkouts || state.workoutSessions || []).length,
        foodEntries: (state.foodDiaryEntries || []).length,
        studySessions: (state.studySessions || []).length,
      },
    };
  }

  /**
   * Inspects overall system health and database integration.
   */
  async getSystemHealth(): Promise<AdminSystemHealth> {
    const firebaseDb = getAdminDataClient();
    let dbStatus: AdminSystemHealth['databaseStatus'] = 'offline';
    let quotaPct = 0;

    if (firebaseDb) {
      try {
        const { error } = await firebaseDb.from('admin_audit_logs').select('id').limit(1);
        dbStatus = error ? 'degraded' : 'operational';
      } catch {
        dbStatus = 'offline';
      }
    }

    try {
      if (typeof window !== 'undefined') {
        let used = 0;
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k) used += (k.length + (localStorage.getItem(k)?.length || 0)) * 2;
        }
        quotaPct = Math.min(100, Math.round((used / (5 * 1024 * 1024)) * 100));
      }
    } catch {}

    return {
      databaseStatus: dbStatus,
      localStorageStatus: quotaPct > 90 ? 'warning' : 'healthy',
      storageQuotaPct: quotaPct,
      syncEngineStatus: dbStatus === 'operational' ? 'synced' : 'offline',
      lastSyncedAt: typeof window !== 'undefined' ? localStorage.getItem('tracker_last_sync_timestamp') : null,
      schemaCompatibility: true,
      version: '2.4.0',
    };
  }

  /**
   * Fetches real-time YouTube API quota usage, cache metrics, and threshold alerts.
   * Guarded by server-side RPC public.get_youtube_import_status().
   */
  async getYouTubeQuotaStatus(): Promise<{ data: YouTubeImportQuotaStatus | null; error?: string }> {
    if (isCloudDegraded()) {
      return { data: null, error: 'HTTP 402: Service restricted' };
    }

    const client = getSupabaseClient() || getAdminDataClient();
    if (!client) {
      return { data: null, error: 'Database backend unconfigured' };
    }

    try {
      const { data, error } = await client.rpc('get_youtube_import_status');
      if (error) {
        if (isQuotaOrDegradedError(error)) {
          markCloudDegraded('HTTP 402 on getYouTubeQuotaStatus');
          return { data: null, error: 'HTTP 402: Cloud database quota exceeded' };
        }
        return { data: null, error: error.message || 'Failed to fetch YouTube quota status' };
      }

      if (data && typeof data === 'object' && (data as any).error) {
        return { data: null, error: (data as any).error };
      }

      return { data: data as YouTubeImportQuotaStatus };
    } catch (err: any) {
      if (isQuotaOrDegradedError(err)) {
        markCloudDegraded('HTTP 402 on getYouTubeQuotaStatus');
        return { data: null, error: 'HTTP 402: Cloud database quota exceeded' };
      }
      return { data: null, error: err?.message || 'Network error querying YouTube quota status' };
    }
  }

  // =========================================================================
  // COMMERCIAL: SUBSCRIPTION PASSES & PRICING CONTROLLER (INR DEFAULT + PPP USD)
  // =========================================================================

  /**
   * Retrieves active subscription passes catalogue with admin pricing overrides.
   * Default currency is Indian Rupees (₹ INR), with PPP inflation-adjusted USD for foreign users.
   */
  getSubscriptionPasses(): AdminSubscriptionPass[] {
    const defaultPasses: AdminSubscriptionPass[] = [
      {
        id: 'free',
        name: 'Free Student Tier',
        price: 0,
        priceINR: 0,
        priceUSD: 0,
        currency: 'INR',
        interval: 'forever',
        description: 'Essential offline-first study, bunk simulator, and timetable tracking for scholars.',
        features: [
          'Full Timetable Management',
          'Attendance Bunk Simulator',
          'Pomodoro Deep Focus Timer',
          'Local Device Backups',
          'Single ClassSpace Workspace Member',
        ],
        isActive: true,
      },
      {
        id: 'pro_monthly',
        name: 'Pro Scholar Monthly',
        price: 199,
        priceINR: 199,
        priceUSD: 7.99,
        currency: 'INR',
        interval: 'month',
        description: 'Automated multi-device cloud synchronization, AI exam insights, and fitness intelligence.',
        features: [
          'All Free Features Included',
          'Continuous Cloud Backup Across Devices',
          'Predictive Attendance Risk Modeling',
          'AI-Powered Exam & Revision Planner',
          'Full Iron Lab & Macro Calorie Engine',
          'Priority Customer Support',
        ],
        badge: 'Most Popular',
        isActive: true,
      },
      {
        id: 'semester_pass',
        name: 'Semester Pass (6 Months)',
        price: 599,
        priceINR: 599,
        priceUSD: 19.99,
        currency: 'INR',
        interval: 'semester',
        description: 'Complete academic term access with zero monthly recurring worries.',
        features: [
          'All Pro Monthly Features',
          'Unlimited ClassSpace Communities',
          'Full EduHub Course Exporter',
          'Custom Audio & Visual Themes',
          '1-on-1 Class Representative Setup Assistance',
        ],
        badge: 'Best Value for Term',
        isActive: true,
      },
      {
        id: 'lifetime_pass',
        name: 'Campus Founder Lifetime',
        price: 1999,
        priceINR: 1999,
        priceUSD: 69.99,
        currency: 'INR',
        interval: 'forever',
        description: 'Permanent VIP access to TRAKIFY OS with all future module updates.',
        features: [
          'Lifetime Access to All Pro & Enterprise Features',
          'Zero Subscription Renewals Ever',
          'Verified Gold Founder Badge in ClassSpace',
          'Direct Access to Core Feature Roadmap',
          'VIP Cloud Infrastructure Tier',
        ],
        badge: 'VIP Lifetime',
        isActive: true,
      },
    ];

    try {
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem(ADMIN_SUBSCRIPTION_PASSES_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed.map((p) => {
              const inr = p.priceINR ?? (p.price && p.price >= 50 ? p.price : Math.round((p.price || 0) * 80));
              const usd = p.priceUSD ?? (p.price && p.price < 50 ? p.price : calculatePppUsdPrice(inr));
              return {
                ...p,
                price: inr,
                priceINR: inr,
                priceUSD: usd,
                currency: 'INR',
              };
            });
          }
        }
      }
    } catch {}

    return defaultPasses;
  }

  /**
   * Updates pricing, feature list, or active status of a subscription pass.
   * Keeps Indian Rupee (₹) price and foreign PPP USD ($) price coordinated.
   */
  saveSubscriptionPass(updatedPass: AdminSubscriptionPass): void {
    const inr = updatedPass.priceINR ?? updatedPass.price;
    const usd = updatedPass.priceUSD ?? calculatePppUsdPrice(inr);

    const normalizedPass: AdminSubscriptionPass = {
      ...updatedPass,
      price: inr,
      priceINR: inr,
      priceUSD: usd,
      currency: 'INR',
    };

    const current = this.getSubscriptionPasses();
    const idx = current.findIndex((p) => p.id === normalizedPass.id);
    let next: AdminSubscriptionPass[];
    if (idx >= 0) {
      next = [...current];
      next[idx] = normalizedPass;
    } else {
      next = [...current, normalizedPass];
    }

    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(ADMIN_SUBSCRIPTION_PASSES_KEY, JSON.stringify(next));
      }
    } catch {}

    this.logLocalActivity(
      'Update Pass Pricing',
      'admin',
      `Modified pricing for pass "${normalizedPass.name}": ₹${normalizedPass.priceINR} (Foreign PPP: $${normalizedPass.priceUSD}) / ${normalizedPass.interval}`,
      'success'
    );
  }

  /**
   * Retrieves real customer payment transactions from local storage.
   * Returns empty array if no transactions have occurred yet (no fabricated demo data).
   */
  getPaymentTransactions(): AdminPaymentTransaction[] {
    try {
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem(ADMIN_PAYMENT_TRANSACTIONS_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            return parsed;
          }
        }
      }
    } catch {}

    return [];
  }

  /**
   * Records a genuine customer payment transaction (e.g. UPI, cash, card, Razorpay).
   */
  recordPaymentTransaction(
    tx: Omit<AdminPaymentTransaction, 'id' | 'timestamp'>
  ): AdminPaymentTransaction {
    const newTx: AdminPaymentTransaction = {
      id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      ...tx,
    };

    const current = this.getPaymentTransactions();
    const next = [newTx, ...current];
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(ADMIN_PAYMENT_TRANSACTIONS_KEY, JSON.stringify(next));
      }
    } catch {}

    this.logLocalActivity(
      'Payment Received',
      'admin',
      `Logged ${tx.currency === 'INR' ? '₹' : '$'}${tx.amount} from ${tx.customerEmail} (${tx.planName}) via ${tx.paymentMethod}`,
      'success'
    );

    return newTx;
  }

  /**
   * Deletes a payment transaction by ID.
   */
  deletePaymentTransaction(id: string): void {
    const current = this.getPaymentTransactions();
    const next = current.filter((t) => t.id !== id);
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(ADMIN_PAYMENT_TRANSACTIONS_KEY, JSON.stringify(next));
      }
    } catch {}

    this.logLocalActivity('Delete Transaction', 'admin', `Removed transaction record ${id}`, 'warning');
  }

  /**
   * Clears all recorded customer transactions.
   */
  clearAllPaymentTransactions(): void {
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(ADMIN_PAYMENT_TRANSACTIONS_KEY);
      }
    } catch {}

    this.logLocalActivity('Clear Ledger', 'admin', 'Customer transaction ledger reset to zero', 'info');
  }

  /**
   * Gets administrator active currency preference ('INR' default).
   */
  getAdminCurrency(): AdminCurrency {
    try {
      if (typeof window !== 'undefined') {
        const pref = localStorage.getItem(ADMIN_CURRENCY_PREF_KEY);
        if (pref === 'USD' || pref === 'INR') return pref;
      }
    } catch {}
    return 'INR';
  }

  /**
   * Sets administrator active currency preference.
   */
  setAdminCurrency(currency: AdminCurrency): void {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(ADMIN_CURRENCY_PREF_KEY, currency);
      }
    } catch {}
  }

  // =========================================================================
  // LIVE WEBSITE & CANVA-STYLE STUDIO BRANDING CONTROLLER
  // =========================================================================

  /**
   * Retrieves live website branding, copy text, accent color, and shape styling.
   */
  getWebsiteBrandingConfig(): AdminWebsiteBrandingConfig {
    const defaultConfig: AdminWebsiteBrandingConfig = {
      appTitle: 'TRAKIFY',
      tagline: 'Apple × Spatial Personal Intelligence OS',
      heroHeading: 'Spatial Personal Intelligence Active',
      announcementBanner: {
        enabled: true,
        text: '🚀 Welcome to TRAKIFY 2.4 — Semester Pass & AI Academic Intelligence are now live!',
        variant: 'sale',
      },
      dailyMotd: 'Do the next useful thing. Then do it again.',
      primaryAccent: '#2563EB',
      borderRadiusPreset: 'rounded',
      fontFamily: 'sans',
      glassIntensity: 'medium',
    };

    try {
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem(ADMIN_WEBSITE_BRANDING_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          return { ...defaultConfig, ...parsed };
        }
      }
    } catch {}

    return defaultConfig;
  }

  /**
   * Saves live branding, announcement text, shapes, and colors; propagates to DOM root instantly.
   */
  saveWebsiteBrandingConfig(config: AdminWebsiteBrandingConfig): void {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(ADMIN_WEBSITE_BRANDING_KEY, JSON.stringify(config));

        // Dynamically apply visual tokens to document root
        const root = document.documentElement;
        if (config.primaryAccent) {
          root.style.setProperty('--admin-primary-accent', config.primaryAccent);
        }

        // Apply border radius presets
        let radiusPx = '16px';
        if (config.borderRadiusPreset === 'sharp') radiusPx = '2px';
        if (config.borderRadiusPreset === 'subtle') radiusPx = '8px';
        if (config.borderRadiusPreset === 'spatial') radiusPx = '24px';
        if (config.borderRadiusPreset === 'pill') radiusPx = '9999px';
        root.style.setProperty('--admin-custom-radius', radiusPx);
      }
    } catch {}

    this.logLocalActivity(
      'Live Studio Update',
      'admin',
      `Updated website branding copy & visual tokens: "${config.appTitle}" (Accent: ${config.primaryAccent})`,
      'success'
    );
  }

  // =========================================================================
  // GLOBAL NUTRITION CATALOG RECALIBRATION ENGINE
  // =========================================================================

  /**
   * Retrieves food catalog with admin custom additions and recalibrations.
   */
  getFoodCatalogForRecalibration(): AdminFoodRecalibrationRecord[] {
    const baseItems: AdminFoodRecalibrationRecord[] = OFFLINE_FOOD_CATALOGUE.map((f) => ({
      id: f.id,
      name: f.name,
      category: f.category || 'General Foods',
      servingSize: f.servingSize || 100,
      servingUnit: f.servingUnit || 'g',
      calories: f.calories || 0,
      protein: f.protein || 0,
      carbs: f.carbs || 0,
      fat: f.fat || 0,
      fiber: (f as any).fiber || 0,
      isCustomOrModified: false,
    }));

    try {
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem(ADMIN_FOOD_RECALIBRATIONS_KEY);
        if (stored) {
          const recalibrations: Record<string, AdminFoodRecalibrationRecord> = JSON.parse(stored);
          const map = new Map<string, AdminFoodRecalibrationRecord>();
          baseItems.forEach((item) => map.set(item.id, item));

          Object.values(recalibrations).forEach((customItem) => {
            map.set(customItem.id, customItem);
          });

          return Array.from(map.values());
        }
      }
    } catch {}

    return baseItems;
  }

  /**
   * Saves or updates a recalibrated food item in the master catalog.
   */
  saveRecalibratedFood(item: AdminFoodRecalibrationRecord): void {
    try {
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem(ADMIN_FOOD_RECALIBRATIONS_KEY);
        const map: Record<string, AdminFoodRecalibrationRecord> = stored ? JSON.parse(stored) : {};
        map[item.id] = { ...item, isCustomOrModified: true };
        localStorage.setItem(ADMIN_FOOD_RECALIBRATIONS_KEY, JSON.stringify(map));
      }
    } catch {}

    this.logLocalActivity(
      'Recalibrate Food Item',
      'nutrition',
      `Recalibrated nutritional values for "${item.name}": ${item.calories} kcal, ${item.protein}p / ${item.carbs}c / ${item.fat}f`,
      'success'
    );
  }

  /**
   * Deletes a food item from the recalibration catalog.
   */
  deleteFoodFromCatalog(id: string): void {
    try {
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem(ADMIN_FOOD_RECALIBRATIONS_KEY);
        if (stored) {
          const map: Record<string, AdminFoodRecalibrationRecord> = JSON.parse(stored);
          delete map[id];
          localStorage.setItem(ADMIN_FOOD_RECALIBRATIONS_KEY, JSON.stringify(map));
        }
      }
    } catch {}

    this.logLocalActivity(
      'Delete Food Item',
      'nutrition',
      `Removed food entity ${id} from catalog`,
      'warning'
    );
  }

  /**
   * Resets all nutritional recalibrations back to original verified USDA/Indian baseline data.
   */
  resetFoodCatalog(): void {
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(ADMIN_FOOD_RECALIBRATIONS_KEY);
      }
    } catch {}

    this.logLocalActivity(
      'Reset Food Catalog',
      'nutrition',
      'Restored food database to standard verified baseline',
      'info'
    );
  }

  // =========================================================================
  // COMMERCIAL SAAS TOOLS: LICENSE KEYS & PROMO COUPONS
  // =========================================================================

  /**
   * Retrieves all issued offline/institutional student license keys.
   * Returns empty array if none have been created yet (zero demo data).
   */
  getLicenseKeys(): AdminLicenseKey[] {
    try {
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem(ADMIN_LICENSE_KEYS_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) return parsed;
        }
      }
    } catch {}

    return [];
  }

  /**
   * Generates a new license key for offline batch student sales or campus distribution.
   */
  generateLicenseKey(tier: 'pro' | 'semester' | 'cohort' | 'lifetime', institution: string, maxUses: number): AdminLicenseKey {
    const randomHex = Math.random().toString(36).substring(2, 6).toUpperCase();
    const newKey: AdminLicenseKey = {
      id: `lic_${Date.now()}`,
      key: `TRACKER-${tier.toUpperCase()}-${randomHex}-${new Date().getFullYear()}`,
      tier,
      institution: institution || 'Individual Scholar License',
      maxUses: maxUses || 1,
      usedCount: 0,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365).toISOString(),
      status: 'active',
    };

    const current = this.getLicenseKeys();
    const next = [newKey, ...current];
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(ADMIN_LICENSE_KEYS_KEY, JSON.stringify(next));
      }
    } catch {}

    this.logLocalActivity(
      'Generate License Key',
      'admin',
      `Issued key ${newKey.key} for ${institution} (${maxUses} seats, tier: ${tier})`,
      'success'
    );

    return newKey;
  }

  /**
   * Revokes an active license key.
   */
  revokeLicenseKey(id: string): void {
    const current = this.getLicenseKeys();
    const next = current.map((k) => (k.id === id ? { ...k, status: 'revoked' as const } : k));
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(ADMIN_LICENSE_KEYS_KEY, JSON.stringify(next));
      }
    } catch {}

    this.logLocalActivity('Revoke License Key', 'admin', `Revoked license key ID ${id}`, 'warning');
  }

  /**
   * Retrieves promotional discount coupon codes.
   * Returns empty array if none have been created yet (zero demo data).
   */
  getPromoCoupons(): AdminPromoCoupon[] {
    try {
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem(ADMIN_PROMO_COUPONS_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) return parsed;
        }
      }
    } catch {}

    return [];
  }

  /**
   * Creates a new promotional discount coupon code.
   */
  createPromoCoupon(code: string, discountPercent: number, maxUsage: number): AdminPromoCoupon {
    const cleanCode = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    const newCoupon: AdminPromoCoupon = {
      code: cleanCode,
      discountPercent: Math.min(100, Math.max(5, discountPercent)),
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 90).toISOString(),
      usageCount: 0,
      maxUsage: maxUsage || 100,
      active: true,
    };

    const current = this.getPromoCoupons();
    const next = [newCoupon, ...current];
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(ADMIN_PROMO_COUPONS_KEY, JSON.stringify(next));
      }
    } catch {}

    this.logLocalActivity(
      'Create Promo Coupon',
      'admin',
      `Created coupon "${cleanCode}" (${discountPercent}% OFF, max ${maxUsage} redemptions)`,
      'success'
    );

    return newCoupon;
  }
}

export const adminService = new AdminService();
