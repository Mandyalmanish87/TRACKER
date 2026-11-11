/**
 * Central Authoritative Feature Registry
 * TRAKIFY Commercial Policy: Basic (Free Forever) vs Pro (Paid Pass Required)
 *
 * This central registry defines every student feature, its human-readable title,
 * description, domain category, and authoritative default tier.
 *
 * ARCHITECTURAL INVARIANT:
 * 1. Components must query this registry rather than checking scattered hardcoded strings.
 * 2. Prepared for future Admin Page: Supports runtime overrides without rewriting individual components.
 * 3. Client-side tier overrides alone can NEVER grant protected server-side capabilities
 *    (which are independently verified by Firestore Security Rules and Edge Functions).
 */

export type FeatureTier = 'free' | 'paid';

export type FeatureCategory =
  | 'academic'
  | 'fitness'
  | 'nutrition'
  | 'focus'
  | 'collaboration'
  | 'system';

export interface FeatureDefinition {
  key: string;
  name: string;
  description: string;
  category: FeatureCategory;
  defaultTier: FeatureTier;
  serverProtected?: boolean;
}

export const FEATURE_REGISTRY: Record<string, FeatureDefinition> = {
  // ============================================================================
  // Basic — Free Forever (Essential Everyday Offline Student Tools)
  // ============================================================================
  timetable: {
    key: 'timetable',
    name: 'Full Timetable Management',
    description: 'Weekly recurring schedules, room numbers, professors, and bunk simulator.',
    category: 'academic',
    defaultTier: 'free',
  },
  attendance: {
    key: 'attendance',
    name: 'Attendance Tracking & Bunk Simulator',
    description: 'Attendance calculation per subject with minimum percentage thresholds.',
    category: 'academic',
    defaultTier: 'free',
  },
  syllabus_tracker: {
    key: 'syllabus_tracker',
    name: 'Syllabus Topic Tracking',
    description: 'Track subjects, chapters, topics, and spaced repetition review intervals.',
    category: 'academic',
    defaultTier: 'free',
  },
  pomodoro_timer: {
    key: 'pomodoro_timer',
    name: 'Pomodoro Focus Timer & Ambient Audio',
    description: 'Customizable study timer intervals, ambient audio sounds, and stopwatch.',
    category: 'focus',
    defaultTier: 'free',
  },
  gym_log: {
    key: 'gym_log',
    name: 'Gym Logging & Workout Tracking',
    description: 'Exercise logging, sets/reps/weights, PR detection, and custom templates.',
    category: 'fitness',
    defaultTier: 'free',
  },
  nutrition_tracker: {
    key: 'nutrition_tracker',
    name: 'Everyday Nutrition, Macro & Recipe Logging',
    description: 'Daily food diary, calorie tracking, macronutrient balance (protein, carbs, fat), and batch recipe builder.',
    category: 'nutrition',
    defaultTier: 'free',
  },
  local_backup: {
    key: 'local_backup',
    name: 'Local Storage & Offline JSON Backups',
    description: 'Offline-first storage and complete local JSON data export and import.',
    category: 'system',
    defaultTier: 'free',
  },
  classspace_member: {
    key: 'classspace_member',
    name: 'ClassSpace Member Participation',
    description: 'Join student class workspaces via join code and participate in chat/schedules.',
    category: 'collaboration',
    defaultTier: 'free',
  },

  // ============================================================================
  // Pro — Paid Pass Required (Cloud Infrastructure, 3D, and Advanced Analytics)
  // ============================================================================
  unlimited_cloud_sync: {
    key: 'unlimited_cloud_sync',
    name: 'Automated Multi-Device Cloud Sync',
    description: 'Continuous delta synchronization of student tracker data to cloud Firestore.',
    category: 'system',
    defaultTier: 'paid',
    serverProtected: true,
  },
  classspace_create_workspace: {
    key: 'classspace_create_workspace',
    name: 'ClassSpace Workspace Creation',
    description: 'Create and administer new student ClassSpace workspaces and channels.',
    category: 'collaboration',
    defaultTier: 'paid',
    serverProtected: true,
  },
  '3d_muscle_heatmaps': {
    key: '3d_muscle_heatmaps',
    name: '3D Muscle Anatomy & Heatmaps',
    description: 'Interactive 3D WebGL anatomical muscle volume and fatigue strain visualization.',
    category: 'fitness',
    defaultTier: 'paid',
  },
  micronutrient_analytics: {
    key: 'micronutrient_analytics',
    name: 'Micronutrient Analytics & RDA Tracker',
    description: 'Comprehensive micronutrient breakdown (vitamins, minerals, electrolytes) and daily RDA progress.',
    category: 'nutrition',
    defaultTier: 'paid',
  },
  advanced_recovery_readiness: {
    key: 'advanced_recovery_readiness',
    name: 'Advanced Recovery Readiness',
    description: 'Systemic recovery readiness scores, volume symmetry, and fatigue analytics.',
    category: 'fitness',
    defaultTier: 'paid',
  },
  ai_study_planner: {
    key: 'ai_study_planner',
    name: 'AI Syllabus Planning & Study Generator',
    description: 'AI-assisted syllabus parsing, exam study schedules, and planner prompts.',
    category: 'academic',
    defaultTier: 'paid',
  },
  saved_playlists_unlimited: {
    key: 'saved_playlists_unlimited',
    name: 'Unlimited Focus Radio Saved Playlists',
    description: 'Save and manage unlimited custom YouTube study playlists beyond the free 2-limit.',
    category: 'focus',
    defaultTier: 'paid',
  },
  advanced_analytics: {
    key: 'advanced_analytics',
    name: 'Advanced Focus & Study Analytics',
    description: 'Productivity heatmaps, weekly study trends, and deep-focus streak analytics.',
    category: 'focus',
    defaultTier: 'paid',
  },
  advanced_focus_heatmaps: {
    key: 'advanced_focus_heatmaps',
    name: 'Annual Focus Streak Heatmaps',
    description: 'Full 365-day historical productivity heatmap and time investment velocity.',
    category: 'focus',
    defaultTier: 'paid',
  },
  priority_export: {
    key: 'priority_export',
    name: 'Priority Cloud Data Portability',
    description: 'One-click consolidated multi-device cloud archives and formatted reports.',
    category: 'system',
    defaultTier: 'paid',
  },
};

/**
 * Returns all feature keys that belong to the Basic (Free) tier by default.
 */
export function getDefaultFreeFeatures(): string[] {
  return Object.values(FEATURE_REGISTRY)
    .filter((f) => f.defaultTier === 'free')
    .map((f) => f.key);
}

/**
 * Returns all feature keys that require a Pro Pass by default.
 */
export function getDefaultPaidFeatures(): string[] {
  return Object.values(FEATURE_REGISTRY)
    .filter((f) => f.defaultTier === 'paid')
    .map((f) => f.key);
}

/**
 * Determines whether a specific feature is classified as Paid (Pro).
 * Supports optional runtime administrator overrides for the future Admin Page.
 */
export function isFeaturePaid(
  featureKey: string,
  adminOverrides?: Record<string, FeatureTier>
): boolean {
  if (adminOverrides && adminOverrides[featureKey]) {
    return adminOverrides[featureKey] === 'paid';
  }
  const def = FEATURE_REGISTRY[featureKey];
  if (!def) return false;
  return def.defaultTier === 'paid';
}

/**
 * Retrieves the complete feature definition metadata.
 */
export function getFeatureDefinition(featureKey: string): FeatureDefinition | undefined {
  return FEATURE_REGISTRY[featureKey];
}

/**
 * Returns all registered features as an array.
 */
export function getAllFeatures(): FeatureDefinition[] {
  return Object.values(FEATURE_REGISTRY);
}
