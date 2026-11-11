import { useState, useCallback, useRef } from 'react';
import { useToast } from '../context/ToastContext';

export interface UseOptimisticActionOptions<T> {
  onSuccess?: (result: any) => void;
  onError?: (err: unknown, rollbackState: T) => void;
  successMessage?: string;
  errorMessage?: string;
  showSuccessToast?: boolean;
}

export function useOptimisticAction<T>(
  currentState: T,
  applyState: (newState: T) => void
) {
  const [isPending, setIsPending] = useState(false);
  const previousStateRef = useRef<T>(currentState);
  const toast = useToast();

  const executeOptimistic = useCallback(
    async (
      optimisticUpdate: (prev: T) => T,
      asyncOperation: () => Promise<any>,
      options: UseOptimisticActionOptions<T> = {}
    ) => {
      // 1. Snapshot previous state before optimistic mutation
      previousStateRef.current = currentState;
      const optimisticState = optimisticUpdate(currentState);

      // 2. Immediately reflect optimistic state in UI
      applyState(optimisticState);
      setIsPending(true);

      try {
        // 3. Perform underlying persistence
        const result = await asyncOperation();
        setIsPending(false);

        if (options.showSuccessToast && options.successMessage) {
          toast.success(options.successMessage);
        }

        options.onSuccess?.(result);
        return { success: true, result };
      } catch (err: any) {
        // 4. Safe Rollback on error
        setIsPending(false);
        applyState(previousStateRef.current);

        const errMsg =
          options.errorMessage ||
          err?.message ||
          'Operation failed. Reverted to previous state.';

        toast.error(errMsg);
        options.onError?.(err, previousStateRef.current);

        return { success: false, error: err };
      }
    },
    [currentState, applyState, toast]
  );

  return {
    executeOptimistic,
    isPending,
  };
}
