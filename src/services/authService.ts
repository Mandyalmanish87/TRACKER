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

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl !== 'https://your-project.supabase.co' &&
  supabaseAnonKey !== 'your-anon-key'
);

let supabaseClient: SupabaseClient | null = null;

if (isSupabaseConfigured) {
  try {
    supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
  } catch (err) {
    console.warn('[AuthService] Failed to initialize Supabase client:', err);
  }
}

export const getSupabaseClient = () => supabaseClient;

// Simulated storage key for offline test-drive mode
const MOCK_AUTH_STORAGE_KEY = 'tracker_mock_auth_user';

export const authService = {
  isConfigured: isSupabaseConfigured,

  /**
   * Get currently authenticated user
   */
  async getCurrentUser(): Promise<AuthUser | null> {
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

    // Check simulated user
    try {
      const stored = localStorage.getItem(MOCK_AUTH_STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored) as AuthUser;
      }
    } catch {
      // Ignored
    }

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

    // Fallback: Test-drive simulated Google account
    const simulatedUser: AuthUser = {
      id: 'usr_google_student_demo',
      email: 'student.scholar@gmail.com',
      name: 'Scholar Student',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=96&h=96&fit=crop&crop=faces',
      isSimulated: true,
    };

    try {
      localStorage.setItem(MOCK_AUTH_STORAGE_KEY, JSON.stringify(simulatedUser));
    } catch {
      // Ignored
    }

    return { user: simulatedUser };
  },

  /**
   * Sign out
   */
  async signOut(): Promise<void> {
    if (supabaseClient) {
      try {
        await supabaseClient.auth.signOut();
      } catch (err) {
        console.warn('[AuthService] Supabase sign out error:', err);
      }
    }

    try {
      localStorage.removeItem(MOCK_AUTH_STORAGE_KEY);
    } catch {
      // Ignored
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

    // Local storage listener for simulated auth across tabs
    const handleStorage = (e: StorageEvent) => {
      if (e.key === MOCK_AUTH_STORAGE_KEY) {
        if (e.newValue) {
          try {
            callback(JSON.parse(e.newValue));
          } catch {
            callback(null);
          }
        } else {
          callback(null);
        }
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  },
};
