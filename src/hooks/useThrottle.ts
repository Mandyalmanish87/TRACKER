import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * useThrottle Hook
 * Throttles a fast-updating value so that it updates at most once every `limit` ms.
 */
export function useThrottle<T>(value: T, limit: number = 300): T {
  const [throttledValue, setThrottledValue] = useState<T>(value);
  const lastRan = useRef<number>(Date.now());

  useEffect(() => {
    const handler = setTimeout(() => {
      if (Date.now() - lastRan.current >= limit) {
        setThrottledValue(value);
        lastRan.current = Date.now();
      }
    }, limit - (Date.now() - lastRan.current));

    return () => {
      clearTimeout(handler);
    };
  }, [value, limit]);

  return throttledValue;
}

/**
 * useThrottledCallback Hook
 * Returns a throttled callback that invokes at most once per specified interval.
 * Supports leading and trailing invocation.
 */
export function useThrottledCallback<T extends (...args: any[]) => any>(
  callback: T,
  limit: number = 200,
  options: { leading?: boolean; trailing?: boolean } = { leading: true, trailing: true }
): ((...args: Parameters<T>) => void) & { cancel: () => void } {
  const { leading = true, trailing = true } = options;
  const callbackRef = useRef<T>(callback);
  const lastRanRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const trailingArgsRef = useRef<Parameters<T> | null>(null);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    trailingArgsRef.current = null;
  }, []);

  const throttled = useCallback(
    (...args: Parameters<T>) => {
      const now = Date.now();

      if (!lastRanRef.current && !leading) {
        lastRanRef.current = now;
      }

      const remaining = limit - (now - lastRanRef.current);

      if (remaining <= 0 || remaining > limit) {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
        lastRanRef.current = now;
        callbackRef.current(...args);
        trailingArgsRef.current = null;
      } else if (trailing) {
        trailingArgsRef.current = args;
        if (!timerRef.current) {
          timerRef.current = setTimeout(() => {
            lastRanRef.current = leading ? Date.now() : 0;
            timerRef.current = null;
            if (trailingArgsRef.current) {
              callbackRef.current(...trailingArgsRef.current);
              trailingArgsRef.current = null;
            }
          }, remaining);
        }
      }
    },
    [leading, trailing, limit]
  );

  useEffect(() => {
    return cancel;
  }, [cancel]);

  return Object.assign(throttled, { cancel });
}
