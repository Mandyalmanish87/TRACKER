import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  avatarUrl?: string;
  isSimulated?: boolean;
}

const env = (import.meta as unknown as { env?: Record<string, string> }).env || {};
const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY;

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

// Test-only user fixture container (strictly isolated to test environments)
let testUserFixture: AuthUser | null = null;

export const authService = {
  get isConfigured(): boolean {
    return Boolean(supabaseClient);
  },

  /**
   * Test-only helper: strictly isolated to test runs and ignored in production builds.
   */
  _setTestUser(user: AuthUser | null): void {
    if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'test') {
      testUserFixture = user;
    }
  },

  /**
   * Get currently authenticated user
   */
  async getCurrentUser(): Promise<AuthUser | null> {
    // In test environment, return test fixture if set
    if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'test' && testUserFixture) {
      return testUserFixture;
    }

    if (supabaseClient) {
      try {
        const { data: { user }, error } = await supabaseClient.auth.getUser();
        if (error || !user) return null;
        return {
          id: user.id,
          email: user.email || 'user@example.com',
          name: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0],
          avatarUrl: user.user_metadata?.avatar_url,
          isSimulated: false,
        };
      } catch {
        return null;
      }
    }

    // No simulated user in production: unconfigured means unauthenticated
    return null;
  },

  /**
   * Initiate Google Sign-In
   */
  async signInWithGoogle(): Promise<{ user?: AuthUser; error?: string }> {
    if (supabaseClient) {
      try {
        const { error } = await supabaseClient.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: window.location.origin,
          },
        });
        if (error) return { error: error.message };
        return {};
      } catch (err) {
        return { error: (err as Error).message };
      }
    }

    // Never fabricate a mock Google session when cloud is unconfigured
    return {
      error: 'Google Sign-In is unavailable: Cloud services are not configured. To enable cloud synchronization, configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
    };
  },

  /**
   * Sign out
   */
  async signOut(): Promise<void> {
    testUserFixture = null;
    if (supabaseClient) {
      try {
        await supabaseClient.auth.signOut();
      } catch (err) {
        console.warn('[AuthService] Supabase sign out error:', err);
      }
    }
  },

  /**
   * Subscribe to auth changes
   */
  onAuthStateChange(callback: (user: AuthUser | null) => void): () => void {
    if (supabaseClient) {
      const { data: { subscription } } = supabaseClient.auth.onAuthStateChange(
        async (_event, session) => {
          if (session?.user) {
            callback({
              id: session.user.id,
              email: session.user.email || 'user@example.com',
              name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0],
              avatarUrl: session.user.user_metadata?.avatar_url,
              isSimulated: false,
            });
          } else {
            callback(null);
          }
        }
      );
      return () => subscription.unsubscribe();
    }

    // Unconfigured environment: no-op unsubscribe
    return () => {};
  },
};
