/**
 * Shared Cloud Degraded-Mode Controller & Quota Exhaustion Guard
 *
 * Centralized singleton that detects Supabase HTTP 402 / PostgREST bandwidth restrictions,
 * activates a 15-minute cooldown, pauses aggressive retries, and protects local-first functionality.
 */

const DEFAULT_COOLDOWN_MS = 15 * 60 * 1000; // 15 minutes
let isDegraded = false;
let degradedUntil = 0;
let lastDegradedReason = '';
let lastLogTimestamp = 0;
const listeners = new Set<(degraded: boolean, reason?: string) => void>();

/**
 * Robustly detects whether an error represents Supabase / PostgREST quota exhaustion or bandwidth restriction (HTTP 402).
 * Strictly differentiates between quota errors (402) vs authentication (401), permission (403), or not-found (404).
 */
export function isQuotaOrDegradedError(errorOrMessage?: unknown): boolean {
  if (!errorOrMessage) return false;

  if (typeof errorOrMessage === 'object') {
    const obj = errorOrMessage as Record<string, any>;
    if (obj.status === 402 || obj.statusCode === 402 || obj.code === '402' || obj.code === 'PGRST402') {
      return true;
    }
    const msg = String(obj.message || obj.error_description || obj.details || obj.hint || '');
    if (/402|payment\s*required|quota.*exceeded|bandwidth.*exceeded|project.*restricted|service.*restricted/i.test(msg)) {
      return true;
    }
  }

  if (typeof errorOrMessage === 'string') {
    return /402|payment\s*required|quota.*exceeded|bandwidth.*exceeded|project.*restricted|service.*restricted/i.test(errorOrMessage);
  }

  return false;
}

/**
 * Activates degraded mode with bounded cooldown and rate-limited logging.
 */
export function markCloudDegraded(reason = 'HTTP 402: Service restricted', durationMs = DEFAULT_COOLDOWN_MS): void {
  isDegraded = true;
  degradedUntil = Date.now() + durationMs;
  lastDegradedReason = reason;

  // Rate-limit console warnings to once per 60 seconds to prevent log flood
  const now = Date.now();
  if (now - lastLogTimestamp > 60000) {
    lastLogTimestamp = now;
    console.warn(`[CloudDegradedGuard] Cloud services degraded or quota-restricted (${reason}). Operating local-first for ${Math.round(durationMs / 60000)}m.`);
  }

  listeners.forEach((listener) => {
    try {
      listener(true, reason);
    } catch {}
  });

  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent('tracker_cloud_degraded_changed', { detail: { degraded: true, reason } }));
    } catch {}
  }
}

/**
 * Resets degraded mode explicitly (e.g. for testing or after connectivity confirmation).
 */
export function resetCloudDegraded(): void {
  isDegraded = false;
  degradedUntil = 0;
  lastDegradedReason = '';

  listeners.forEach((listener) => {
    try {
      listener(false);
    } catch {}
  });

  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent('tracker_cloud_degraded_changed', { detail: { degraded: false } }));
    } catch {}
  }
}

/**
 * Returns whether cloud services are currently restricted / in degraded cooldown.
 * Automatically recovers when the cooldown window has elapsed.
 */
export function isCloudDegraded(): boolean {
  if (!isDegraded) return false;

  if (Date.now() >= degradedUntil) {
    // Cooldown expired; tentatively allow next request to test connectivity
    isDegraded = false;
    degradedUntil = 0;
    lastDegradedReason = '';
    listeners.forEach((listener) => {
      try {
        listener(false);
      } catch {}
    });
    return false;
  }

  return true;
}

/**
 * Returns the timestamp (ms) when current degraded cooldown will expire, or 0 if not degraded.
 */
export function getCloudDegradedUntil(): number {
  return isCloudDegraded() ? degradedUntil : 0;
}

/**
 * Returns the human-readable reason why degraded mode was activated.
 */
export function getCloudDegradedReason(): string {
  return lastDegradedReason;
}

/**
 * Subscribes to degraded mode state transitions.
 */
export function onCloudDegradedChange(callback: (degraded: boolean, reason?: string) => void): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

/**
 * Wraps an asynchronous network operation with the degraded mode guard.
 * If already degraded, immediately returns the fallback value without executing the network call.
 * If the operation throws or returns a 402 error, triggers degraded mode and returns the fallback.
 */
export async function withDegradedGuard<T>(
  operation: () => Promise<T>,
  fallback: T | (() => Promise<T>),
  contextName = 'CloudOperation'
): Promise<T> {
  if (isCloudDegraded()) {
    return typeof fallback === 'function' ? (fallback as () => Promise<T>)() : fallback;
  }

  try {
    const result = await operation();
    // In case the returned result object itself holds an error with code 402
    if (result && typeof result === 'object' && 'error' in (result as any)) {
      const err = (result as any).error;
      if (isQuotaOrDegradedError(err)) {
        markCloudDegraded(`Quota exceeded in ${contextName}`);
        return typeof fallback === 'function' ? (fallback as () => Promise<T>)() : fallback;
      }
    }
    return result;
  } catch (error: any) {
    if (isQuotaOrDegradedError(error)) {
      markCloudDegraded(`Quota exceeded in ${contextName}`);
      return typeof fallback === 'function' ? (fallback as () => Promise<T>)() : fallback;
    }
    throw error;
  }
}

export const degradedModeService = {
  isQuotaOrDegradedError,
  markCloudDegraded,
  resetCloudDegraded,
  isCloudDegraded,
  getCloudDegradedUntil,
  getCloudDegradedReason,
  onCloudDegradedChange,
  withDegradedGuard,
};
