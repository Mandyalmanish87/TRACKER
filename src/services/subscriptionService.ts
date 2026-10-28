/**
 * Subscription & Payment Service
 * Milestone 05: Subscriptions & Payment Foundation
 *
 * Implements server-authoritative entitlement resolution, payment checkout flow,
 * customer billing portal redirection, and cryptographic HMAC-SHA256 webhook signature verification.
 *
 * INVARIANT: Entitlements are evaluated exclusively against database-backed records
 * and server RPCs. Client-side local storage or URL flags are strictly untrusted.
 */

import { getSupabaseClient } from './authService';
import {
  SubscriptionTier,
  UserSubscription,
  UserEntitlements,
  PlanCatalogueItem,
  WebhookVerificationResult,
  CheckoutSessionResponse,
  CustomerPortalResponse,
} from '../types/subscription';

export const DEFAULT_FREE_ENTITLEMENTS: UserEntitlements = {
  tier: 'free',
  isActive: false,
  features: [
    'timetable',
    'attendance',
    'pomodoro_timer',
    'gym_log',
    'syllabus_tracker',
    'local_backup',
    'classspace_member',
  ],
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
  status: 'free',
};

export const PLANS_CATALOGUE: PlanCatalogueItem[] = [
  {
    id: 'free',
    name: 'Student Free',
    priceFormatted: '$0',
    interval: 'forever',
    description: 'Essential offline-first academic management for every student.',
    features: [
      'Full Timetable Management',
      'Attendance Calculation & Bunk Simulator',
      'Pomodoro Focus Timer & Ambient Sounds',
      'Syllabus Topic Tracking',
      'Gym & Workout Logging',
      'Local Offline Backups',
      'ClassSpace Workspace Member Access',
    ],
  },
  {
    id: 'pro',
    name: 'Tracker Pro',
    priceFormatted: '$4.99',
    interval: 'month',
    description: 'Automated multi-device cloud synchronization and academic analytics.',
    features: [
      'All Free Tier Features',
      'Automated Cloud Sync Across All Devices',
      'Advanced Academic Trend Analytics',
      'AI-Powered Exam & Study Planner',
      'Priority PDF & CSV Reports Export',
      'Early Access to New Modules',
    ],
    highlighted: true,
    badge: 'Most Popular',
  },
  {
    id: 'cohort',
    name: 'Cohort Sponsor',
    priceFormatted: '$19.99',
    interval: 'month',
    description: 'For Class Representatives and academic leaders powering their entire batch.',
    features: [
      'All Tracker Pro Features',
      'Sponsor Workspace Storage for Classmates',
      'Verified Class Rep & Cohort Badge',
      'Shared Timetable Announcements',
      'Dedicated Community Support',
    ],
    badge: 'For Class Reps',
  },
];

/**
 * Constant-time comparison to prevent timing attacks when comparing cryptographic signatures.
 */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

export class SubscriptionService {
  /**
   * Resolves the server-authoritative entitlements for a user.
   * If unauthenticated, offline, or cloud is unconfigured, defaults safely to Free tier.
   */
  async getUserEntitlements(userId?: string): Promise<UserEntitlements> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return { ...DEFAULT_FREE_ENTITLEMENTS };
    }

    try {
      const { data, error } = await supabase.rpc('get_user_entitlements', {
        p_user_id: userId || null,
      });

      if (error) {
        // Cross-account access denied error (code 42501)
        if (error.message?.includes('42501') || error.code === '42501') {
          throw new Error('Access denied: cannot inspect another user entitlements (42501)');
        }
        console.warn('[SubscriptionService] Entitlements RPC error, falling back to free:', error);
        return { ...DEFAULT_FREE_ENTITLEMENTS };
      }

      if (!data) {
        return { ...DEFAULT_FREE_ENTITLEMENTS };
      }

      return {
        tier: (data.tier as SubscriptionTier) || 'free',
        isActive: Boolean(data.is_active),
        features: Array.isArray(data.features) ? data.features : DEFAULT_FREE_ENTITLEMENTS.features,
        currentPeriodEnd: data.current_period_end || null,
        cancelAtPeriodEnd: Boolean(data.cancel_at_period_end),
        status: data.status || 'free',
      };
    } catch (err: any) {
      if (err.message?.includes('42501')) {
        throw err;
      }
      console.warn('[SubscriptionService] Failed to fetch entitlements:', err);
      return { ...DEFAULT_FREE_ENTITLEMENTS };
    }
  }

  /**
   * Fetches the current user's subscription record directly from public.user_subscriptions.
   */
  async getUserSubscription(): Promise<UserSubscription | null> {
    const supabase = getSupabaseClient();
    if (!supabase) return null;

    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.user) return null;

      const { data, error } = await supabase
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (error || !data) return null;

      return {
        id: data.id,
        userId: data.user_id,
        customerId: data.customer_id,
        subscriptionId: data.subscription_id,
        status: data.status,
        planTier: data.plan_tier,
        currentPeriodStart: data.current_period_start,
        currentPeriodEnd: data.current_period_end,
        cancelAtPeriodEnd: data.cancel_at_period_end,
        latestEventCreated: data.latest_event_created || null,
        updatedAt: data.updated_at,
      };
    } catch (err) {
      console.warn('[SubscriptionService] Error fetching user subscription:', err);
      return null;
    }
  }

  /**
   * Requests a secure hosted checkout session from the server.
   */
  async createCheckoutSession(
    planTier: 'pro' | 'cohort',
    returnUrl?: string
  ): Promise<CheckoutSessionResponse> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      throw new Error('Cloud backend is not configured.');
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      throw new Error('You must be signed in to purchase a subscription.');
    }

    try {
      const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: {
          plan_tier: planTier,
          return_url: returnUrl || window.location.origin,
        },
      });

      if (error) {
        throw new Error(error.message || 'Failed to create checkout session.');
      }

      return {
        checkoutUrl: data.checkout_url,
        sessionId: data.session_id,
      };
    } catch (err: any) {
      // In development or when provider credentials are not yet deployed
      console.warn('[SubscriptionService] Hosted checkout pending provider configuration:', err.message);
      throw new Error(
        'Payment provider integration is pending live credentials deployment (DEC-04 / DEC-05).'
      );
    }
  }

  /**
   * Requests a customer billing portal URL to manage active subscriptions and payment methods.
   */
  async createCustomerPortalSession(returnUrl?: string): Promise<CustomerPortalResponse> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      throw new Error('Cloud backend is not configured.');
    }

    try {
      const { data, error } = await supabase.functions.invoke('create-customer-portal-session', {
        body: {
          return_url: returnUrl || window.location.origin,
        },
      });

      if (error) {
        throw new Error(error.message || 'Failed to create customer portal session.');
      }

      return {
        portalUrl: data.portal_url,
      };
    } catch (err: any) {
      console.warn('[SubscriptionService] Customer portal pending provider configuration:', err.message);
      throw new Error(
        'Billing portal integration is pending live credentials deployment (DEC-04).'
      );
    }
  }

  /**
   * Verifies an incoming webhook request signature using HMAC-SHA256.
   * Format: stripe-signature: t=timestamp,v1=signature
   *
   * Rejects if:
   * 1. Header is missing or malformed.
   * 2. Signature timestamp is outside the allowed tolerance window (default 300s) to prevent replay attacks.
   * 3. HMAC-SHA256 signature does not match computed value.
   */
  async verifyWebhookSignature(
    rawBody: string,
    signatureHeader: string,
    secret: string,
    toleranceSeconds = 300
  ): Promise<WebhookVerificationResult> {
    if (!signatureHeader || !secret) {
      return { valid: false, error: 'Missing signature header or signing secret' };
    }

    // Extract t and v1 from header
    const tMatch = signatureHeader.match(/(?:^|,)t=(\d+)/);
    const v1Match = signatureHeader.match(/(?:^|,)v1=([a-fA-F0-9]+)/);

    if (!tMatch || !v1Match) {
      return { valid: false, error: 'Malformed stripe-signature header format' };
    }

    const timestamp = parseInt(tMatch[1], 10);
    const signature = v1Match[1].toLowerCase();

    // Check timestamp tolerance
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - timestamp) > toleranceSeconds) {
      return {
        valid: false,
        error: `Signature timestamp ${timestamp} is outside tolerance window (${toleranceSeconds}s)`,
        timestamp,
      };
    }

    try {
      const encoder = new TextEncoder();
      const keyData = encoder.encode(secret);
      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );

      const signedPayload = encoder.encode(`${timestamp}.${rawBody}`);
      const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, signedPayload);
      const computedHex = Array.from(new Uint8Array(signatureBuffer))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

      if (!constantTimeEqual(computedHex, signature)) {
        return {
          valid: false,
          error: 'Cryptographic signature mismatch (forged or tampered payload)',
          timestamp,
          signature,
        };
      }

      return {
        valid: true,
        timestamp,
        signature,
      };
    } catch (err: any) {
      return {
        valid: false,
        error: `Signature verification exception: ${err?.message || 'unknown error'}`,
      };
    }
  }

  /**
   * Server-authoritative webhook dispatcher calling process_subscription_webhook_event RPC.
   */
  async processWebhookEvent(eventId: string, eventType: string, payload: any): Promise<any> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      throw new Error('Cloud backend is not configured.');
    }

    const { data, error } = await supabase.rpc('process_subscription_webhook_event', {
      p_event_id: eventId,
      p_event_type: eventType,
      p_payload: payload,
    });

    if (error) {
      throw error;
    }

    return data;
  }

  /**
   * Helper to check whether a specific feature is unlocked given current entitlements.
   */
  canAccessFeature(featureKey: string, entitlements?: UserEntitlements): boolean {
    const activeEntitlements = entitlements || DEFAULT_FREE_ENTITLEMENTS;
    return activeEntitlements.features.includes(featureKey);
  }
}

export const subscriptionService = new SubscriptionService();

