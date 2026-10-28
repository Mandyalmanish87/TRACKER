/**
 * Admin Portal Types & Domain Models
 * Milestone 04: Owner & Platform Administrative Portal
 */

export type PlatformAdminRole = 'owner' | 'super_admin' | 'support';

export interface AdminVerificationResult {
  isAdmin: boolean;
  role?: PlatformAdminRole;
  userId?: string;
  error?: string;
}

export interface AdminOverviewMetrics {
  total_users: number;
  total_workspaces: number;
  total_attendance_records: number;
  active_users_7d: number;
  system_status: 'operational' | 'degraded' | 'maintenance';
  timestamp: string;
}

export interface UserSupportRecord {
  user_id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  last_synced_at: string | null;
  subscription_tier: string;
}

export interface AdminWorkspaceRecord {
  id: string;
  name: string;
  institution: string | null;
  join_code: string;
  created_by: string;
  created_at: string;
  member_count: number;
}

export interface AdminAuditLogEntry {
  id: string;
  actor_id: string;
  action: string;
  target_type: string;
  target_id: string | null;
  metadata: Record<string, any>;
  ip_address: string | null;
  created_at: string;
}

