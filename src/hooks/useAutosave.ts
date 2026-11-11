import { useState, useEffect, useRef, useCallback } from 'react';

export type SaveStatus = 'idle' | 'unsaved' | 'saving' | 'saved' | 'error';

export interface UseAutosaveOptions<T> {
  delay?: number;
  draftKey?: string;
  enabled?: boolean;
  onSuccess?: () => void;
  onError?: (err: unknown) => void;
  isEqual?: (a: T, b: T) => boolean;
}

export interface UseAutosaveReturn<T> {
  status: SaveStatus;
  errorMessage: string | null;
  lastSavedAt: Date | null;
  forceSave: () => Promise<void>;
  hasDraft: boolean;
  restoreDraft: () => T | null;
  clearDraft: () => void;
}

const defaultIsEqual = <T>(a: T, b: T): boolean => {
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return a === b;
  }
};

/**
 * useAutosave Hook
 * Reliably debounces saves for forms, notes, journals, and descriptions.
 * Saves local drafts to prevent data loss on unexpected reload.
 */
export function useAutosave<T>(
  data: T,
  onSave: (data: T) => Promise<void> | void,
  options: UseAutosaveOptions<T> = {}
): UseAutosaveReturn<T> {
  const {
    delay = 1000,
    draftKey,
    enabled = true,
    onSuccess,
    onError,
    isEqual = defaultIsEqual,
  } = options;

  const [status, setStatus] = useState<SaveStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [hasDraft, setHasDraft] = useState<boolean>(false);

  const lastSavedDataRef = useRef<T>(data);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInitialMount = useRef(true);

  // Check if draft exists on mount
  useEffect(() => {
    if (draftKey && typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(`tracker_draft_${draftKey}`);
        setHasDraft(Boolean(stored));
      } catch {
        setHasDraft(false);
      }
    }
  }, [draftKey]);

  const clearDraft = useCallback(() => {
    if (draftKey && typeof window !== 'undefined') {
      try {
        localStorage.removeItem(`tracker_draft_${draftKey}`);
        setHasDraft(false);
      } catch {}
    }
  }, [draftKey]);

  const restoreDraft = useCallback((): T | null => {
    if (!draftKey || typeof window === 'undefined') return null;
    try {
      const stored = localStorage.getItem(`tracker_draft_${draftKey}`);
      if (stored) {
        return JSON.parse(stored) as T;
      }
    } catch (e) {
      console.warn('[useAutosave] Failed to parse draft:', e);
    }
    return null;
  }, [draftKey]);

  const executeSave = useCallback(
    async (dataToSave: T) => {
      setStatus('saving');
      setErrorMessage(null);
      try {
        await onSave(dataToSave);
        lastSavedDataRef.current = dataToSave;
        setStatus('saved');
        setLastSavedAt(new Date());
        clearDraft();
        onSuccess?.();

        // Revert to 'idle' after 2.5 seconds
        setTimeout(() => {
          setStatus((current) => (current === 'saved' ? 'idle' : current));
        }, 2500);
      } catch (err: any) {
        setStatus('error');
        setErrorMessage(err?.message || 'Failed to save changes');
        onError?.(err);
      }
    },
    [onSave, clearDraft, onSuccess, onError]
  );

  const forceSave = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    await executeSave(data);
  }, [data, executeSave]);

  useEffect(() => {
    // Avoid triggering autosave on initial component render
    if (isInitialMount.current) {
      isInitialMount.current = false;
      lastSavedDataRef.current = data;
      return;
    }

    if (!enabled) return;

    if (isEqual(data, lastSavedDataRef.current)) {
      return;
    }

    setStatus('unsaved');

    // Save instant local draft
    if (draftKey && typeof window !== 'undefined') {
      try {
        localStorage.setItem(`tracker_draft_${draftKey}`, JSON.stringify(data));
        setHasDraft(true);
      } catch {}
    }

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      executeSave(data);
    }, delay);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [data, delay, enabled, draftKey, isEqual, executeSave]);

  return {
    status,
    errorMessage,
    lastSavedAt,
    forceSave,
    hasDraft,
    restoreDraft,
    clearDraft,
  };
}
