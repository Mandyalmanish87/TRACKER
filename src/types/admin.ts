/**
 * Admin Portal Types & Domain Models
 * Milestone 04: Owner & Platform Administrative Portal
 * Cirrel-Inspired Admin Control Center + Apple × Spatial UI
 */

export type PlatformAdminRole = 'owner' | 'super_admin' | 'support';

export type AdminNavTab =
  // OVERVIEW
  | 'overview'
  // COMMERCE & REVENUE
  | 'payments'
  | 'analytics'
  | 'licenses'
  // USERS & COHORTS
  | 'users'
  | 'workspaces'
  // CONTENT & STUDIO TOOLS
  | 'website_editor'
  | 'nutrition_recalibrator'
  // SYSTEM & GOVERNANCE
  | 'audit'
  | 'data_management'
  | 'configuration'
  | 'security'
  // ACCOUNT
  | 'profile'
  | 'admin_settings'
  // Deprecated/Legacy aliases for backwards-compatibility
  | 'academics'
  | 'timetable'
  | 'attendance'
  | 'syllabus'
  | 'events_tasks'
  | 'fitness'
  | 'nutrition';

export type AdminTimeframe = 'today' | '7d' | '30d' | '90d' | 'all';

export type AdminCurrency = 'INR' | 'USD';

export interface AdminSubscriptionPass {
  id: string;
  name: string;
  price: number; // Primary/Default price (in INR ₹)
  priceINR: number; // Price in Indian Rupees (₹)
  priceUSD: number; // Purchasing Power Parity (PPP) inflation-adjusted equivalent in US Dollars ($)
  currency: AdminCurrency;
  interval: 'month' | 'semester' | 'year' | 'forever';
  description: string;
  features: string[];
  badge?: string;
  isActive: boolean;
}

export interface AdminPaymentTransaction {
  id: string;
  customerName: string;
  customerEmail: string;
  planId: string;
  planName: string;
  amount: number;
  currency: AdminCurrency;
  status: 'completed' | 'pending' | 'refunded';
  paymentMethod: string;
  timestamp: string;
}

export interface AdminLicenseKey {
  id: string;
  key: string;
  tier: 'pro' | 'semester' | 'cohort' | 'lifetime';
  institution?: string;
  maxUses: number;
  usedCount: number;
  expiresAt: string;
  status: 'active' | 'expired' | 'revoked';
}

export interface AdminPromoCoupon {
  code: string;
  discountPercent: number;
  expiresAt: string;
  usageCount: number;
  maxUsage: number;
  active: boolean;
}

export interface AdminWebsiteBrandingConfig {
  appTitle: string;
  tagline: string;
  heroHeading: string;
  announcementBanner: {
    enabled: boolean;
    text: string;
    variant: 'info' | 'sale' | 'alert';
  };
  dailyMotd: string;
  primaryAccent: string;
  borderRadiusPreset: 'sharp' | 'subtle' | 'rounded' | 'spatial' | 'pill';
  fontFamily: 'serif' | 'sans' | 'mono';
  glassIntensity: 'low' | 'medium' | 'high';
}

export interface AdminFoodRecalibrationRecord {
  id: string;
  name: string;
  category: string;
  servingSize: number;
  servingUnit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  isCustomOrModified: boolean;
}

export interface AdminVerificationResult {
  isAdmin: boolean;
  role?: PlatformAdminRole;
  userId?: string;
  error?: string;
  isLocalMode?: boolean;
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
  role?: string;
  is_local_owner?: boolean;
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

export interface LocalActivityLogEntry {
  id: string;
  timestamp: string;
  action: string;
  category: 'academic' | 'timetable' | 'attendance' | 'task' | 'fitness' | 'nutrition' | 'system' | 'admin';
  details: string;
  status: 'success' | 'warning' | 'info' | 'error';
  actor: string;
}

export interface DataIntegrityReport {
  isValid: boolean;
  checkedAt: string;
  storageSizeBytes: number;
  storageSizeFormatted: string;
  schemaVersion: number;
  issues: {
    category: string;
    level: 'error' | 'warning' | 'info';
    message: string;
    affectedId?: string;
  }[];
  counts: {
    subjects: number;
    timetableSlots: number;
    attendanceLogs: number;
    syllabusSubjects: number;
    tasks: number;
    reminders: number;
    workouts: number;
    foodEntries: number;
    studySessions: number;
  };
}

export interface AdminSystemHealth {
  databaseStatus: 'operational' | 'degraded' | 'offline';
  localStorageStatus: 'healthy' | 'warning' | 'exceeded';
  storageQuotaPct: number;
  syncEngineStatus: 'idle' | 'syncing' | 'synced' | 'error' | 'offline';
  lastSyncedAt: string | null;
  schemaCompatibility: boolean;
  version: string;
}

export interface YouTubeQuotaAlert {
  level: 'info' | 'warning' | 'critical';
  threshold: number;
  message: string;
}

export interface YouTubeImportQuotaStatus {
  quota_date: string;
  timezone: string;
  units_used: number;
  units_reserved: number;
  remaining_safety_budget: number;
  daily_budget: number;
  request_count: number;
  cache_hits: number;
  cache_misses: number;
  successful_imports: number;
  failed_imports: number;
  quota_blocked_imports: number;
  rate_limited_imports: number;
  rss_fallback_imports: number;
  active_cached_playlists: number;
  alerts: YouTubeQuotaAlert[];
  config: {
    cache_enabled?: boolean;
    cache_ttl_hours?: number;
    user_limit_minute?: number;
    user_limit_hour?: number;
    user_limit_day?: number;
    daily_quota_budget?: number;
    quota_monitoring_threshold?: number;
    quota_warning_threshold?: number;
    quota_hard_safety_threshold?: number;
    max_playlist_size?: number;
    rss_fallback_enabled?: boolean;
    max_rss_videos?: number;
    api_retry_count?: number;
    [key: string]: any;
  };
}
