/**
 * React Hook for Real-Time Entitlement & Monetization State
 * TRAKIFY Commercial Model: One-Time Passes, Free Forever Basic Tier
 *
 * Responsibilities:
 * 1. Fetches server-authoritative entitlements from subscriptionService.
 * 2. Provides `isPro`: true only when user has an active, unexpired paid pass.
 * 3. Provides `canAccess(featureKey)`: queries the central featureRegistry and active pass.
 * 4. Reactive wakeup: immediately refreshes without page reload when:
 *    - 'tracker:entitlements-updated' window event fires (after payment or recovery)
 *    - browser window regains focus ('focus')
 * 5. Dynamic clock check: invalidates Pro access the moment `currentPeriodEnd` passes,
 *    preventing expired users from retaining access in long-lived browser sessions.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { subscriptionService, DEFAULT_FREE_ENTITLEMENTS } from '../services/subscriptionService';
import { UserEntitlements } from '../types/subscription';
import { isFeaturePaid } from '../services/featureRegistry';

export interface UseEntitlementsResult {
  entitlements: UserEntitlements;
  loading: boolean;
  isPro: boolean;
  canAccess: (featureKey: string) => boolean;
  refresh: () => Promise<void>;
}

export function useEntitlements(): UseEntitlementsResult {
  const [entitlements, setEntitlements] = useState<UserEntitlements>(DEFAULT_FREE_ENTITLEMENTS);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchEntitlements = useCallback(async () => {
    try {
      const ent = await subscriptionService.getUserEntitlements();
      setEntitlements(ent);
    } catch (err) {
      console.warn('[useEntitlements] Failed to fetch entitlements, falling back to free baseline:', err);
      setEntitlements(DEFAULT_FREE_ENTITLEMENTS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEntitlements();

    // 1. Listen for immediate post-payment and post-recovery broadcast
    const handleUpdate = () => {
      fetchEntitlements();
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('tracker:entitlements-updated', handleUpdate);
      window.addEventListener('focus', handleUpdate);
    }

    // 2. Periodic check every 60 seconds to catch real-time pass expiration
    const interval = setInterval(() => {
      if (entitlements.currentPeriodEnd) {
        const periodEnd = new Date(entitlements.currentPeriodEnd).getTime();
        if (!isNaN(periodEnd) && Date.now() >= periodEnd) {
          fetchEntitlements();
        }
      }
    }, 60000);

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('tracker:entitlements-updated', handleUpdate);
        window.removeEventListener('focus', handleUpdate);
      }
      clearInterval(interval);
    };
  }, [fetchEntitlements, entitlements.currentPeriodEnd]);

  // Dynamic pass validity check
  const isPro = useMemo(() => {
    if (!entitlements.isActive && !entitlements.hasActivePass) {
      return false;
    }
    if (entitlements.currentPeriodEnd) {
      const periodEnd = new Date(entitlements.currentPeriodEnd).getTime();
      if (!isNaN(periodEnd) && Date.now() >= periodEnd) {
        return false;
      }
    }
    return true;
  }, [entitlements]);

  const canAccess = useCallback(
    (featureKey: string) => {
      // Basic free features never require a pass
      if (!isFeaturePaid(featureKey)) {
        return true;
      }
      // Pro features require active pass
      if (!isPro) {
        return false;
      }
      return subscriptionService.canAccessFeature(featureKey, entitlements);
    },
    [isPro, entitlements]
  );

  return {
    entitlements,
    loading,
    isPro,
    canAccess,
    refresh: fetchEntitlements,
  };
}
