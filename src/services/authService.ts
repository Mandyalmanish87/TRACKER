import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { firebaseService } from './firebaseService';
import { getFirebaseDataClient } from './firebaseDataClient';

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  avatarUrl?: string;
  isSimulated?: boolean;
}

const env = (import.meta as unknown as { env?: Record<string, string> }).env || {};
const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseAnonKey = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY;

const isValidSupabaseUrl = (url?: string): boolean => {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (
    trimmed === '' ||
    trimmed === 'https://your-project.supabase.co' ||
    trimmed === 'https://xyzcompany.supabase.co' ||
    trimmed === 'your-supabase-url'
  ) {
    return false;
  }
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
};

const isValidSupabaseKey = (key?: string): boolean => {
  if (!key || typeof key !== 'string') return false;
  const trimmed = key.trim();
  if (trimmed === '' || trimmed === 'your-anon-key' || trimmed === 'your-anon-public-key') {
    return false;
  }
  return trimmed.length > 20;
};

let supabaseClient: SupabaseClient | null = null;
if (isValidSupabaseUrl(supabaseUrl) && isValidSupabaseKey(supabaseAnonKey)) {
  try {
    supabaseClient = createClient(supabaseUrl!, supabaseAnonKey!);
  } catch (err) {
    console.warn('[AuthService] Failed to initialize Supabase client:', err);
    supabaseClient = null;
  }
}

export const isSupabaseConfigured = Boolean(supabaseClient);
export const getSupabaseClient = () => supabaseClient;

// Test-only user fixture container (strictly isolated to test environments).
let testUserFixture: AuthUser | null = null;

function isTestEnvironment(): boolean {
  return Boolean(
    ((typeof process !== 'undefined' && (process.env?.NODE_ENV === 'test' || Boolean(process.env?.VITEST))) ||
      (typeof import.meta !== 'undefined' && (import.meta as any).env?.MODE === 'test'))
  );
}

export const isFirebaseDataConfigured = firebaseService.isConfigured;
export const getFirebaseDataClientForServices = () =>
  getFirebaseDataClient() || (isTestEnvironment() ? getSupabaseClient() : null);

export const authService = {
  get isConfigured(): boolean { return firebaseService.isConfigured; },
  get provider(): 'firebase' | 'none' { return firebaseService.isConfigured ? 'firebase' : 'none'; },

  _setTestUser(user: AuthUser | null): void {
    if (isTestEnvironment()) testUserFixture = user;
  },

  async getCurrentUser(): Promise<AuthUser | null> {
    if (isTestEnvironment() && testUserFixture) return testUserFixture;
    const fbUser = firebaseService.getAuth()?.currentUser;
    return firebaseService.mapFirebaseUser(fbUser || null);
  },

  async signInWithGoogle(): Promise<{ user?: AuthUser; error?: string }> {
    if (!firebaseService.isConfigured) {
      return { error: 'Google Sign-In is unavailable: Cloud services are not configured. Configure Firebase credentials in .env.local to enable Google Sign-In.' };
    }
    return firebaseService.signInWithGoogle();
  },

  async signOut(): Promise<void> {
    testUserFixture = null;
    await firebaseService.signOut();
  },

  onAuthStateChange(callback: (user: AuthUser | null) => void): () => void {
    if (!firebaseService.isConfigured) {
      if (isTestEnvironment() && testUserFixture) callback(testUserFixture);
      return () => {};
    }
    return firebaseService.onAuthStateChange((user) => {
      callback(user || (isTestEnvironment() ? testUserFixture : null));
    });
  },
};

