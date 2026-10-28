/**
 * Platform Administration Service
 * Milestone 04: Owner & Platform Administrative Portal
 *
 * Implements client-side calls to server-authoritative administrative RPCs
 * and Row Level Security guarded tables.
 *
 * NOTE: UI gating is UX-only. All data mutations and reads are strictly
 * enforced by Postgres SECURITY DEFINER procedures and RLS policies.
 */

import { getSupabaseClient } from './authService';
import {
  AdminVerificationResult,
  AdminOverviewMetrics,
  UserSupportRecord,
  AdminWorkspaceRecord,
  AdminAuditLogEntry,
  PlatformAdminRole,
} from '../types/admin';

export class AdminService {
  /**
   * Verifies whether the currently authenticated user is an active platform administrator.
   * Calls the server-side RPC public.is_platform_admin().
   */
  async verifyPlatformAdmin(): Promise<AdminVerificationResult> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return { isAdmin: false, error: 'Cloud backend is not configured' };
    }

    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.user) {
        return { isAdmin: false, error: 'Authentication required' };
      }

      const { data, error } = await supabase.rpc('is_platform_admin');

      if (error) {
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
      const { data: adminRecord } = await supabase
        .from('admin_users')
        .select('role')
        .eq('user_id', session.user.id)
        .eq('is_active', true)
        .maybeSingle();

      return {
        isAdmin: true,
        userId: session.user.id,
        role: (adminRecord?.role as PlatformAdminRole) || 'support',
      };
    } catch (err: any) {
      return {
        isAdmin: false,
        error: err?.message || 'Network or authorization error during admin check',
      };
    }
  }

  /**
   * Fetches high-level operational metrics (active users, total workspaces, system health).
   * Guarded by server-side public.get_admin_overview_metrics() RPC.
   */
  async fetchOverviewMetrics(): Promise<{ data: AdminOverviewMetrics | null; error?: string }> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return { data: null, error: 'Backend unconfigured' };
    }

    try {
      const { data, error } = await supabase.rpc('get_admin_overview_metrics');
      if (error) {
        return { data: null, error: error.message };
      }
      return { data: data as AdminOverviewMetrics };
    } catch (err: any) {
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
    const supabase = getSupabaseClient();
    if (!supabase) {
      return { data: [], error: 'Backend unconfigured' };
    }

    try {
      const { data, error } = await supabase.rpc('search_users_for_support', {
        p_query: query.trim(),
        p_limit: limit,
        p_offset: offset,
      });

      if (error) {
        return { data: [], error: error.message };
      }
      return { data: (data as UserSupportRecord[]) || [] };
    } catch (err: any) {
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
    const supabase = getSupabaseClient();
    if (!supabase) {
      return { data: [], error: 'Backend unconfigured' };
    }

    try {
      const { data, error } = await supabase.rpc('search_workspaces_for_admin', {
        p_query: query.trim(),
        p_limit: limit,
        p_offset: offset,
      });

      if (error) {
        return { data: [], error: error.message };
      }
      return { data: (data as AdminWorkspaceRecord[]) || [] };
    } catch (err: any) {
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

    const supabase = getSupabaseClient();
    if (!supabase) {
      return { newCode: null, error: 'Backend unconfigured' };
    }

    try {
      const { data, error } = await supabase.rpc('admin_rotate_workspace_join_code', {
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

    const supabase = getSupabaseClient();
    if (!supabase) {
      return { success: false, error: 'Backend unconfigured' };
    }

    try {
      const { data, error } = await supabase.rpc('admin_delete_workspace', {
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
    const supabase = getSupabaseClient();
    if (!supabase) {
      return { data: [], error: 'Backend unconfigured' };
    }

    try {
      const { data, error } = await supabase
        .from('admin_audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        return { data: [], error: error.message };
      }
      return { data: (data as AdminAuditLogEntry[]) || [] };
    } catch (err: any) {
      return { data: [], error: err?.message || 'Audit log query failed' };
    }
  }
}

export const adminService = new AdminService();

