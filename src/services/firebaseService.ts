/**
 * Firebase Integration Service
 * Provides Google Authentication and Cloud Firestore Synchronization
 * Built on Google Cloud Infrastructure to support 20k+ concurrent students.
 */

import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  signOut as fbSignOut,
  onAuthStateChanged,
  User as FirebaseUser,
  Auth,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  Firestore,
} from 'firebase/firestore';
import { getFunctions, httpsCallable, Functions } from 'firebase/functions';
import { AuthUser } from './authService';
import { AppStateData } from '../types';

const env = (import.meta as unknown as { env?: Record<string, string> }).env || {};

export const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || '',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: env.VITE_FIREBASE_PROJECT_ID || '',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: env.VITE_FIREBASE_APP_ID || '',
  measurementId: env.VITE_FIREBASE_MEASUREMENT_ID || '',
};

export const isFirebaseConfigured: boolean = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.apiKey.length > 10 &&
  firebaseConfig.projectId &&
  !firebaseConfig.apiKey.includes('your-api-key') &&
  !firebaseConfig.projectId.includes('your-project-id')
);

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let functions: Functions | null = null;
let googleProvider: GoogleAuthProvider | null = null;

if (isFirebaseConfigured) {
  try {
    app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    functions = getFunctions(app);
    googleProvider = new GoogleAuthProvider();
    googleProvider.setCustomParameters({ prompt: 'select_account' });
  } catch (err) {
    console.warn('[FirebaseService] Failed to initialize Firebase:', err);
    app = null;
    auth = null;
    db = null;
    functions = null;
  }
}

export const firebaseService = {
  get isConfigured(): boolean {
    return Boolean(auth && db);
  },

  getAuth(): Auth | null {
    return auth;
  },

  getFirestore(): Firestore | null {
    return db;
  },

  async callFunction<TRequest, TResponse>(name: string, data: TRequest): Promise<TResponse> {
    if (!functions) throw new Error('Firebase Functions is not initialized.');
    const callable = httpsCallable<TRequest, TResponse>(functions, name);
    const result = await callable(data);
    return result.data;
  },

  /**
   * Transforms Firebase user to Tracker AuthUser model
   */
  mapFirebaseUser(fbUser: FirebaseUser | null): AuthUser | null {
    if (!fbUser) return null;
    return {
      id: fbUser.uid,
      email: fbUser.email || 'student@tracker.local',
      name: fbUser.displayName || fbUser.email?.split('@')[0] || 'Student',
      avatarUrl: fbUser.photoURL || undefined,
      isSimulated: false,
    };
  },

  /**
   * Initiates Google Sign-In with popup, falling back to redirect if popup is blocked
   */
  async signInWithGoogle(): Promise<{ user?: AuthUser; error?: string }> {
    if (!auth || !googleProvider) {
      return {
        error: 'Firebase is not configured. Add your Firebase credentials to .env.local to enable Google Sign-In.',
      };
    }

    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = this.mapFirebaseUser(result.user);
      return { user: user || undefined };
    } catch (popupErr: any) {
      // If popup was blocked by browser, try redirect flow
      if (
        popupErr.code === 'auth/popup-blocked' ||
        popupErr.code === 'auth/popup-closed-by-user' ||
        popupErr.code === 'auth/cancelled-popup-request'
      ) {
        try {
          await signInWithRedirect(auth, googleProvider);
          return {};
        } catch (redirectErr: any) {
          return { error: redirectErr?.message || 'Google Sign-In redirect failed.' };
        }
      }
      return { error: popupErr?.message || 'Failed to authenticate with Google.' };
    }
  },

  /**
   * Signs the user out of Firebase
   */
  async signOut(): Promise<void> {
    if (auth) {
      try {
        await fbSignOut(auth);
      } catch (err) {
        console.warn('[FirebaseService] Sign-out error:', err);
      }
    }
  },

  /**
   * Listens for Firebase auth state changes
   */
  onAuthStateChange(callback: (user: AuthUser | null) => void): () => void {
    if (!auth) return () => {};
    const unsubscribe = onAuthStateChanged(auth, (fbUser) => {
      callback(this.mapFirebaseUser(fbUser));
    });
    return unsubscribe;
  },

  /**
   * Loads user tracker data from Firestore collection `user_trackers`
   */
  async fetchCloudData(userId: string): Promise<{ data: AppStateData | null; updatedAt?: string; error?: string }> {
    if (!db) {
      return { data: null, error: 'Firestore is not initialized.' };
    }

    try {
      const docRef = doc(db, 'user_trackers', userId);
      const snap = await getDoc(docRef);

      if (!snap.exists()) {
        return { data: null };
      }

      const docData = snap.data();
      const personalData = (docData?.data as AppStateData) || null;
      if (personalData && Object.prototype.hasOwnProperty.call(personalData, 'progressPhotos')) {
        const withoutPhotos = { ...personalData };
        delete withoutPhotos.progressPhotos;
        try {
          await setDoc(docRef, { userId, data: withoutPhotos, updatedAt: new Date().toISOString() });
        } catch (cleanupError) {
          console.warn('[FirebaseService] Could not remove paused photo metadata from cloud data:', cleanupError);
        }
      }
      return {
        data: personalData ? Object.fromEntries(Object.entries(personalData).filter(([key]) => key !== 'progressPhotos')) as AppStateData : null,
        updatedAt: docData?.updatedAt || undefined,
      };
    } catch (err: any) {
      return { data: null, error: err?.message || 'Failed to fetch Firestore data.' };
    }
  },

  /**
   * Saves user tracker data to Firestore document `user_trackers/{userId}`
   */
  async uploadToCloud(userId: string, data: AppStateData): Promise<{ success: boolean; error?: string }> {
    if (!db) {
      return { success: false, error: 'Firestore is not initialized.' };
    }

    try {
      const docRef = doc(db, 'user_trackers', userId);
      const personalData = { ...data };
      // Progress photos are paused while the project is on Firebase's free plan.
      // Keep on-device copies intact, but never upload photo metadata or thumbnails.
      delete personalData.progressPhotos;
      await setDoc(
        docRef,
        {
          userId,
          data: personalData,
          updatedAt: new Date().toISOString(),
        }
      );
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to save data to Firestore.' };
    }
  },
};

