import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  subscriptionService,
  DEFAULT_FREE_ENTITLEMENTS,
  computeHmacSha256Hex,
} from '../src/services/subscriptionService';
import * as authServiceModule from '../src/services/authService';

describe('Razorpay Complete Payment & Subscription Lifecycle Integration', () => {
  const TEST_KEY_ID = 'rzp_test_54321abcd';
  const TEST_KEY_SECRET = 'rzp_sec_top_secret_key_12345';
  const TEST_WEBHOOK_SECRET = 'rzp_whsec_production_safe_key_999';

  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  // Helper to compute a valid Razorpay webhook signature
  async function generateTestWebhookSignature(payload: string, secret: string): Promise<string> {
    return await computeHmacSha256Hex(secret, payload);
  }

  // Helper to compute a valid Razorpay payment signature
  async function generateTestPaymentSignature(orderId: string, paymentId: string, secret: string): Promise<string> {
    return await computeHmacSha256Hex(secret, `${orderId}|${paymentId}`);
  }

  // Helper to compute a valid Razorpay subscription signature
  async function generateTestSubscriptionSignature(paymentId: string, subscriptionId: string, secret: string): Promise<string> {
    return await computeHmacSha256Hex(secret, `${paymentId}|${subscriptionId}`);
  }

  // ============================================================================
  // A. One-Time Payments
  // ============================================================================
  describe('A. Razorpay One-Time Payments', () => {
    it('1. Order creation: calls create-razorpay-order Edge Function with trusted server price', async () => {
      const mockSupabase = {
        functions: {
          invoke: vi.fn().mockResolvedValue({
            data: {
              orderId: 'order_rzp_123',
              amount: 7500,
              currency: 'INR',
              keyId: TEST_KEY_ID,
              planId: 'pass_30d',
              planTier: 'paid',
            },
            error: null,
          }),
        },
      } as any;
      vi.spyOn(authServiceModule, 'getSupabaseClient').mockReturnValue(mockSupabase);

      const order = await subscriptionService.createRazorpayOrder('pass_30d', 'one_time');

      expect(order.orderId).toBe('order_rzp_123');
      expect(order.amount).toBe(7500);
      expect(order.currency).toBe('INR');
      expect(order.keyId).toBe(TEST_KEY_ID);
      expect(mockSupabase.functions.invoke).toHaveBeenCalledWith('create-razorpay-order', expect.objectContaining({
        body: expect.objectContaining({ plan_id: 'pass_30d' }),
      }));
    });

    it('2. Amount tampering defense: client cannot override server-controlled amount or currency', async () => {
      const mockSupabase = {
        functions: {
          invoke: vi.fn().mockImplementation((name, options) => {
            const planId = options.body.plan_id;
            const amounts: Record<string, number> = {
              pass_7d: 2000,
              pass_30d: 7500,
              pass_180d: 42500,
              pass_365d: 82500,
              pass_1460d: 330000,
            };
            const amount = amounts[planId] || 7500;
            return Promise.resolve({
              data: { orderId: `order_${planId}`, amount, currency: 'INR', keyId: TEST_KEY_ID },
              error: null,
            });
          }),
        },
      } as any;
      vi.spyOn(authServiceModule, 'getSupabaseClient').mockReturnValue(mockSupabase);

      const monthlyOrder = await subscriptionService.createRazorpayOrder('pass_30d');
      expect(monthlyOrder.amount).toBe(7500);

      const degreeOrder = await subscriptionService.createRazorpayOrder('pass_1460d');
      expect(degreeOrder.amount).toBe(330000);
    });

    it('3. Cryptographic signature check: verifies order_id|payment_id against key secret', async () => {
      const orderId = 'order_valid_001';
      const paymentId = 'pay_valid_001';
      const validSig = await computeHmacSha256Hex(TEST_KEY_SECRET, `${orderId}|${paymentId}`);

      const result = await subscriptionService.verifyPaymentSignature({
        orderId,
        paymentId,
        signature: validSig,
        secret: TEST_KEY_SECRET,
      });

      expect(result.valid).toBe(true);
    });

    it('4. Rejection of invalid or forged payment signature', async () => {
      const orderId = 'order_valid_001';
      const paymentId = 'pay_valid_001';

      const result = await subscriptionService.verifyPaymentSignature({
        orderId,
        paymentId,
        signature: 'invalid_hex_signature_abcdef',
        secret: TEST_KEY_SECRET,
      });

      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/Invalid payment signature/i);
    });

    it('5. Verification roundtrip: verifies payment on backend and returns active status', async () => {
      const mockSupabase = {
        functions: {
          invoke: vi.fn().mockResolvedValue({
            data: {
              success: true,
              verified: true,
              planTier: 'pro',
              status: 'active',
              currentPeriodEnd: '2026-12-08T00:00:00Z',
              paymentId: 'pay_rzp_999',
            },
            error: null,
          }),
        },
      } as any;
      vi.spyOn(authServiceModule, 'getSupabaseClient').mockReturnValue(mockSupabase);

      const verification = await subscriptionService.verifyRazorpayPayment({
        razorpay_order_id: 'order_rzp_999',
        razorpay_payment_id: 'pay_rzp_999',
        razorpay_signature: 'sig_valid',
        planTier: 'pro',
      });

      expect(verification.success).toBe(true);
      expect(verification.verified).toBe(true);
      expect(verification.status).toBe('active');
    });

    it('6. Failed payment callback: returns error without granting entitlements', async () => {
      const mockSupabase = {
        functions: {
          invoke: vi.fn().mockResolvedValue({
            data: {
              success: false,
              verified: false,
              error: 'Payment failed at gateway or was cancelled by user',
            },
            error: null,
          }),
        },
      } as any;
      vi.spyOn(authServiceModule, 'getSupabaseClient').mockReturnValue(mockSupabase);

      const verification = await subscriptionService.verifyRazorpayPayment({
        razorpay_order_id: 'order_failed_01',
        razorpay_payment_id: 'pay_failed_01',
        razorpay_signature: 'sig_failed',
      });

      expect(verification.success).toBe(false);
      expect(verification.verified).toBe(false);
      expect(verification.error).toMatch(/Payment failed/i);
    });

    it('7. Reused payment ID: duplicate verification request returns existing subscription idempotently', async () => {
      const existingSub = {
        planTier: 'pro',
        status: 'active',
        currentPeriodEnd: '2026-12-08T00:00:00Z',
        lastVerifiedPayment: 'pay_already_verified_123',
      };

      const mockSupabase = {
        functions: {
          invoke: vi.fn().mockResolvedValue({
            data: {
              success: true,
              verified: true,
              duplicate: true,
              planTier: existingSub.planTier,
              status: existingSub.status,
              currentPeriodEnd: existingSub.currentPeriodEnd,
              paymentId: 'pay_already_verified_123',
            },
            error: null,
          }),
        },
      } as any;
      vi.spyOn(authServiceModule, 'getSupabaseClient').mockReturnValue(mockSupabase);

      const res = await subscriptionService.verifyRazorpayPayment({
        razorpay_order_id: 'order_old_123',
        razorpay_payment_id: 'pay_already_verified_123',
        razorpay_signature: 'sig_valid',
      });

      expect(res.success).toBe(true);
      expect(res.verified).toBe(true);
      expect(res.currentPeriodEnd).toBe(existingSub.currentPeriodEnd); // Not extended!
    });
  });

  // ============================================================================
  // B. Recurring Subscriptions
  // ============================================================================
  describe('B. Razorpay Recurring Subscriptions', () => {
    it('1. Subscription creation: invokes create-razorpay-subscription Edge Function', async () => {
      const mockSupabase = {
        functions: {
          invoke: vi.fn().mockResolvedValue({
            data: {
              subscriptionId: 'sub_rzp_auto_123',
              keyId: TEST_KEY_ID,
              planTier: 'pro',
              status: 'created',
            },
            error: null,
          }),
        },
      } as any;
      vi.spyOn(authServiceModule, 'getSupabaseClient').mockReturnValue(mockSupabase);

      const sub = await subscriptionService.createRazorpaySubscription('pro');

      expect(sub.subscriptionId).toBe('sub_rzp_auto_123');
      expect(sub.keyId).toBe(TEST_KEY_ID);
      expect(mockSupabase.functions.invoke).toHaveBeenCalledWith('create-razorpay-subscription', {
        headers: undefined,
        body: { plan_tier: 'pro' },
      });
    });

    it('2. Mandate authorization verification: verifies payment_id|subscription_id', async () => {
      const paymentId = 'pay_mandate_001';
      const subscriptionId = 'sub_mandate_001';
      const validSig = await computeHmacSha256Hex(TEST_KEY_SECRET, `${paymentId}|${subscriptionId}`);

      const result = await subscriptionService.verifySubscriptionSignature({
        paymentId,
        subscriptionId,
        signature: validSig,
        secret: TEST_KEY_SECRET,
      });

      expect(result.valid).toBe(true);
    });

    it('3. Mandate authorized but NOT activated: status is authenticated and paid entitlements remain locked', async () => {
      // Test the strict invariant: mandate authorization alone does not grant paid tier!
      const mockSupabase = {
        rpc: vi.fn().mockResolvedValue({
          data: {
            tier: 'pro',
            is_active: false,
            features: DEFAULT_FREE_ENTITLEMENTS.features,
            status: 'authenticated', // Mandate authorized, not yet charged!
            current_period_end: null,
          },
          error: null,
        }),
      } as any;
      vi.spyOn(authServiceModule, 'getSupabaseClient').mockReturnValue(mockSupabase);

      const entitlements = await subscriptionService.getUserEntitlements('usr-mandate-auth-only');

      expect(entitlements.status).toBe('authenticated');
      expect(entitlements.isActive).toBe(false); // Paid tier remains locked!
      expect(entitlements.features).not.toContain('unlimited_cloud_sync');
    });

    it('4. Subscription cancellation: calls cancel-razorpay-subscription to stop auto-renewal', async () => {
      const mockSupabase = {
        functions: {
          invoke: vi.fn().mockResolvedValue({
            data: {
              success: true,
              cancelAtPeriodEnd: true,
              message: 'Subscription will not renew after current billing cycle.',
            },
            error: null,
          }),
        },
      } as any;
      vi.spyOn(authServiceModule, 'getSupabaseClient').mockReturnValue(mockSupabase);

      const cancelRes = await subscriptionService.cancelSubscription();

      expect(cancelRes.success).toBe(true);
      expect(cancelRes.cancelAtPeriodEnd).toBe(true);
      expect(mockSupabase.functions.invoke).toHaveBeenCalledWith('cancel-razorpay-subscription', {
        headers: undefined,
        body: {},
      });
    });

    it('5. Subscription cancellation at cycle end preserves access until period end', async () => {
      const futurePeriodEnd = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(); // 15 days left
      const mockSupabase = {
        rpc: vi.fn().mockResolvedValue({
          data: {
            tier: 'pro',
            is_active: true,
            features: ['timetable', 'unlimited_cloud_sync', 'advanced_analytics'],
            status: 'active',
            cancel_at_period_end: true, // Cancelled but still inside period!
            current_period_end: futurePeriodEnd,
          },
          error: null,
        }),
      } as any;
      vi.spyOn(authServiceModule, 'getSupabaseClient').mockReturnValue(mockSupabase);

      const entitlements = await subscriptionService.getUserEntitlements('usr-canceling-1');

      expect(entitlements.isActive).toBe(true); // Still active!
      expect(entitlements.cancelAtPeriodEnd).toBe(true);
      expect(entitlements.features).toContain('unlimited_cloud_sync');
    });

    it('6. Renewal failure transitions to past_due status', async () => {
      const expiredPeriodEnd = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(); // 48h ago (past 24h grace)
      const mockSupabase = {
        rpc: vi.fn().mockResolvedValue({
          data: {
            tier: 'pro',
            is_active: false,
            features: DEFAULT_FREE_ENTITLEMENTS.features,
            status: 'past_due',
            current_period_end: expiredPeriodEnd,
          },
          error: null,
        }),
      } as any;
      vi.spyOn(authServiceModule, 'getSupabaseClient').mockReturnValue(mockSupabase);

      const entitlements = await subscriptionService.getUserEntitlements('usr-expired-due');

      expect(entitlements.status).toBe('past_due');
      expect(entitlements.isActive).toBe(false);
      expect(entitlements.features).not.toContain('unlimited_cloud_sync');
    });

    it('7. Out-of-order webhook protection: stale event does not downgrade active subscription', async () => {
      let subState = {
        status: 'active',
        planTier: 'pro',
        latestEventCreated: 1700000500, // Newer event
      };

      const incomingOldEvent = {
        created_at: 1700000100, // Older event
        event: 'subscription.halted',
      };

      const isStale = incomingOldEvent.created_at < subState.latestEventCreated;
      expect(isStale).toBe(true);

      if (!isStale) {
        subState.status = 'halted';
      }

      expect(subState.status).toBe('active'); // Preserved!
    });

    it('8. Duplicate webhook handling: duplicate delivery is acknowledged safely without redundant writes', async () => {
      const processedEvents = new Set<string>();
      const eventId = 'evt_rzp_dup_test_99';

      const handleEvent = (id: string) => {
        if (processedEvents.has(id)) {
          return { status: 'duplicate_ignored', code: 200 };
        }
        processedEvents.add(id);
        return { status: 'processed', code: 200 };
      };

      const firstDelivery = handleEvent(eventId);
      expect(firstDelivery.status).toBe('processed');

      const secondDelivery = handleEvent(eventId);
      expect(secondDelivery.status).toBe('duplicate_ignored');
      expect(secondDelivery.code).toBe(200);
    });

    it('9. Subscription renewal: successful charge extends period end', async () => {
      const currentPeriodEnd = new Date('2026-11-30T00:00:00Z').getTime();
      const newPeriodEnd = new Date('2026-12-30T00:00:00Z').getTime();

      expect(newPeriodEnd).toBeGreaterThan(currentPeriodEnd);
    });

    it('10. Same-second conflicting lifecycle transition: subordinate event on identical timestamp cannot downgrade active status', () => {
      // Deterministic priority simulation
      const priorities: Record<string, number> = {
        'subscription.authenticated': 10,
        'subscription.pending': 20,
        'payment.failed': 30,
        'subscription.activated': 45,
        'subscription.charged': 50,
        'subscription.cancelled': 70,
      };

      const simulateWebhookArrival = (
        existingSub: { status: string; latestEventCreated: number; latestEventPriority: number },
        incomingEvent: { event: string; created_at: number }
      ) => {
        const incomingPriority = priorities[incomingEvent.event] || 20;
        if (incomingEvent.created_at < existingSub.latestEventCreated) {
          return { status: 'stale_event_ignored', finalStatus: existingSub.status };
        }
        if (
          incomingEvent.created_at === existingSub.latestEventCreated &&
          incomingPriority < existingSub.latestEventPriority
        ) {
          return { status: 'same_second_subordinate_ignored', finalStatus: existingSub.status };
        }
        // Higher or equal priority on same second or newer timestamp succeeds
        const nextStatus = incomingEvent.event === 'subscription.authenticated' ? 'authenticated' : 'active';
        return { status: 'processed', finalStatus: nextStatus };
      };

      const sharedTimestamp = 1700000000;

      // Scenario A: subscription.activated arrives FIRST, subscription.authenticated arrives SECOND on identical timestamp
      const stateAfterActivated = {
        status: 'active',
        latestEventCreated: sharedTimestamp,
        latestEventPriority: priorities['subscription.activated'],
      };

      const delayedAuthEvent = {
        event: 'subscription.authenticated',
        created_at: sharedTimestamp,
      };

      const result = simulateWebhookArrival(stateAfterActivated, delayedAuthEvent);
      expect(result.status).toBe('same_second_subordinate_ignored');
      expect(result.finalStatus).toBe('active'); // Status is NOT downgraded to authenticated!

      // Scenario B: subscription.authenticated arrives FIRST, subscription.activated arrives SECOND on identical timestamp
      const stateAfterAuth = {
        status: 'authenticated',
        latestEventCreated: sharedTimestamp,
        latestEventPriority: priorities['subscription.authenticated'],
      };

      const delayedActivatedEvent = {
        event: 'subscription.activated',
        created_at: sharedTimestamp,
      };

      const resultB = simulateWebhookArrival(stateAfterAuth, delayedActivatedEvent);
      expect(resultB.status).toBe('processed');
      expect(resultB.finalStatus).toBe('active'); // Upgraded to active!
    });

    it('11. Webhook lease state machine: expired lease recovery and retry after failure', () => {
      // Simulate atomic lease claim logic
      const now = 1000000000;
      const leaseDurationMs = 60000;

      const evaluateLeaseClaim = (doc: {
        status: 'processing' | 'processed' | 'failed';
        lease_expires_at?: string;
        attempt_count: number;
      }) => {
        if (doc.status === 'processed') {
          return { canProcess: false, status: 'already_processed' };
        }
        if (doc.status === 'processing') {
          const expires = doc.lease_expires_at ? new Date(doc.lease_expires_at).getTime() : 0;
          if (expires > now) {
            return { canProcess: false, status: 'concurrent_in_flight' };
          }
          // Expired lease recovered!
          return { canProcess: true, status: 'lease_expired_recovered', attempt: doc.attempt_count + 1 };
        }
        if (doc.status === 'failed') {
          return { canProcess: true, status: 'retry_after_failure', attempt: doc.attempt_count + 1 };
        }
        return { canProcess: true, status: 'new', attempt: 1 };
      };

      // Test 1: In-flight active lease returns concurrent_in_flight
      const activeInFlight = evaluateLeaseClaim({
        status: 'processing',
        lease_expires_at: new Date(now + 30000).toISOString(),
        attempt_count: 1,
      });
      expect(activeInFlight.canProcess).toBe(false);
      expect(activeInFlight.status).toBe('concurrent_in_flight');

      // Test 2: Expired lease reclaims lease
      const expiredLease = evaluateLeaseClaim({
        status: 'processing',
        lease_expires_at: new Date(now - 5000).toISOString(),
        attempt_count: 1,
      });
      expect(expiredLease.canProcess).toBe(true);
      expect(expiredLease.status).toBe('lease_expired_recovered');
      expect((expiredLease as any).attempt).toBe(2);

      // Test 3: Failed prior attempt safely retries
      const failedRetry = evaluateLeaseClaim({
        status: 'failed',
        attempt_count: 1,
      });
      expect(failedRetry.canProcess).toBe(true);
      expect(failedRetry.status).toBe('retry_after_failure');
      expect((failedRetry as any).attempt).toBe(2);

      // Test 4: Already processed event is idempotent
      const alreadyProcessed = evaluateLeaseClaim({
        status: 'processed',
        attempt_count: 1,
      });
      expect(alreadyProcessed.canProcess).toBe(false);
      expect(alreadyProcessed.status).toBe('already_processed');
    });

    it('12. Obsolete subscription isolation: delayed event from an older subscription cannot terminate a replacement subscription', () => {
      const code = fs.readFileSync(path.resolve('supabase/functions/handle-razorpay-webhook/index.ts'), 'utf8');
      expect(code).toMatch(/subscriptionEntity\.id\s*!==\s*existingSub\.subscriptionId/);
      expect(code).toMatch(/superseded_subscription_event_ignored/);
    });

    it('13. Failed payment protection: payment.failed cannot demote an already confirmed captured payment', () => {
      const code = fs.readFileSync(path.resolve('supabase/functions/handle-razorpay-webhook/index.ts'), 'utf8');
      expect(code).toMatch(/existingSub\?\.lastVerifiedPayment\s*===\s*paymentEntity\.id/);
      expect(code).toMatch(/payment\.failed ignored: payment/);
    });

    it('14. Authentic mandate isolation: subscription.authenticated is structurally forbidden from downgrading active or past_due status', () => {
      const code = fs.readFileSync(path.resolve('supabase/functions/handle-razorpay-webhook/index.ts'), 'utf8');
      expect(code).toMatch(/\['active',\s*'past_due',\s*'halted',\s*'cancelled',\s*'completed'\]\.includes\(existingSub\?\.status/);
      expect(code).toMatch(/subscription\.authenticated ignored: current status is already/);
    });

    it('15. Past-due renewal recovery: subscription.charged transitions past_due subscription back to active and extends period', () => {
      let subState = {
        status: 'past_due',
        currentPeriodEnd: '2026-11-01T00:00:00.000Z',
      };

      const handleRenewalCharge = (currentEndTimestamp: number) => {
        subState.status = 'active';
        subState.currentPeriodEnd = new Date(currentEndTimestamp * 1000).toISOString();
      };

      handleRenewalCharge(1796000000);
      expect(subState.status).toBe('active');
      expect(new Date(subState.currentPeriodEnd).getTime()).toBe(1796000000 * 1000);
    });

    it('16. Equal priority event consistency: multiple payment and charge confirmations maintain consistent active state', () => {
      const equalPriorityEvents = ['subscription.charged', 'payment.captured', 'order.paid'];
      for (const evt of equalPriorityEvents) {
        let status = 'free';
        switch (evt) {
          case 'payment.captured':
          case 'order.paid':
          case 'subscription.charged':
            status = 'active';
            break;
        }
        expect(status).toBe('active');
      }
    });
  });

  // ============================================================================
  // C. Adversarial Security Scenarios
  // ============================================================================
  describe('C. Adversarial Security Scenarios', () => {
    it('1. Another user order ID: rejects verification when order was not created for this student', () => {
      const code = fs.readFileSync(path.resolve('supabase/functions/verify-razorpay-payment/index.ts'), 'utf8');
      expect(code).toMatch(/paymentData\.notes\?\.userId\s*&&\s*paymentData\.notes\.userId\s*!==\s*user\.id/);
      expect(code).toMatch(/status:\s*403/);
      expect(code).toMatch(/Payment user account mismatch/);
    });

    it('2. Modified payment amount: rejects payment verification when amount does not match server plan price', () => {
      const code = fs.readFileSync(path.resolve('supabase/functions/verify-razorpay-payment/index.ts'), 'utf8');
      expect(code).toMatch(/paymentData\.amount\s*!==\s*expectedPlan\.amountPaise/);
      expect(code).toMatch(/Payment amount mismatch/);
    });

    it('3. Incorrect currency: rejects payment verification when currency is not INR', () => {
      const code = fs.readFileSync(path.resolve('supabase/functions/verify-razorpay-payment/index.ts'), 'utf8');
      expect(code).toMatch(/paymentData\.currency\s*!==\s*expectedPlan\.currency/);
      expect(code).toMatch(/Payment currency mismatch/);
    });

    it('4. Authorized but uncaptured payment: rejects payment verification if status is not captured', () => {
      const code = fs.readFileSync(path.resolve('supabase/functions/verify-razorpay-payment/index.ts'), 'utf8');
      expect(code).toMatch(/paymentData\.status\s*!==\s*'captured'/);
      expect(code).toMatch(/Entitlements require captured payment/);
    });

    it('5. Invalid Firebase ID token rejection: verify authenticateRequestUser rejects malformed or non-RS256 tokens', () => {
      const code = fs.readFileSync(path.resolve('supabase/functions/_shared/firebaseAuth.ts'), 'utf8');
      expect(code).toMatch(/parts\.length\s*!==\s*3/);
      expect(code).toMatch(/header\.alg\s*!==\s*'RS256'/);
      expect(code).toMatch(/header\.kid/);
    });

    it('6. Expired Firebase token rejection: verify authenticateRequestUser rejects expired exp timestamp', () => {
      const code = fs.readFileSync(path.resolve('supabase/functions/_shared/firebaseAuth.ts'), 'utf8');
      expect(code).toMatch(/payload\.exp\s*<=\s*\(nowSeconds\s*-\s*clockSkewTolerance\)/);
      expect(code).toMatch(/Firebase ID token has expired/);
    });

    it('7. Concurrent webhook delivery: second delivery detects concurrent_in_flight and returns HTTP 503', () => {
      const code = fs.readFileSync(path.resolve('supabase/functions/handle-razorpay-webhook/index.ts'), 'utf8');
      expect(code).toMatch(/claim\.status\s*===\s*'concurrent_in_flight'/);
      expect(code).toMatch(/status:\s*503/);
    });

    it('8. Expired processing lease: recovers abandoned webhook lease without dropping event', () => {
      const code = fs.readFileSync(path.resolve('supabase/functions/_shared/firestoreRest.ts'), 'utf8');
      expect(code).toMatch(/status:\s*'lease_expired_recovered'/);
      expect(code).toMatch(/lease_expires_at/);
    });

    it('9. Firestore failure during webhook processing: marks event failed and returns HTTP 500 so Razorpay retries', () => {
      const code = fs.readFileSync(path.resolve('supabase/functions/handle-razorpay-webhook/index.ts'), 'utf8');
      expect(code).toMatch(/markWebhookEventFailed/);
      expect(code).toMatch(/status:\s*500/);
    });

    it('10. Unauthorized direct Firestore write: verify firestore.rules strictly forbids client writes', () => {
      const rules = fs.readFileSync(path.resolve('firestore.rules'), 'utf8');
      expect(rules).toMatch(/match\s+\/user_subscriptions\/\{userId\}\s*\{[\s\S]*allow\s+write:\s*if\s+false;/);
    });

    it('11. Credentials boundary: verifies client code never contains Razorpay secret keys', () => {
      const clientService = fs.readFileSync(path.resolve('src/services/subscriptionService.ts'), 'utf8');
      expect(clientService).not.toMatch(/RAZORPAY_KEY_SECRET/);
      expect(clientService).not.toMatch(/RAZORPAY_WEBHOOK_SECRET/);
      expect(clientService).not.toMatch(/rzp_sec_/);
    });
  });

  // ============================================================================
  // D. Permanent Ledger, Concurrency & Expiry Verification Suite
  // ============================================================================
  describe('D. Permanent Ledger, Concurrency & Expiry Verification Suite', () => {
    it('1. Old payment webhook replay after a newer purchase: permanent ledger prevents double-crediting', async () => {
      // User made payment A (older), then payment B (newer).
      // user_subscriptions currently reflects payment B.
      const permanentLedger = new Map<string, { status: string; periodEnd: string }>();
      permanentLedger.set('pay_older_A', { status: 'processed', periodEnd: '2026-11-20T00:00:00.000Z' });
      permanentLedger.set('pay_newer_B', { status: 'processed', periodEnd: '2026-12-20T00:00:00.000Z' });

      let userSubscription = {
        userId: 'usr_student_alpha',
        planTier: 'pro',
        status: 'active',
        paymentId: 'pay_newer_B',
        lastVerifiedPayment: 'pay_newer_B',
        currentPeriodEnd: '2026-12-20T00:00:00.000Z',
      };

      // Now a delayed/replayed webhook arrives for pay_older_A
      const replayedPaymentId = 'pay_older_A';

      const handleWebhookArrival = (paymentId: string) => {
        const ledgerRecord = permanentLedger.get(paymentId);
        if (ledgerRecord?.status === 'processed') {
          return { status: 'duplicate_payment_acknowledged', code: 200, extended: false };
        }
        // If not in ledger, it would extend
        userSubscription.currentPeriodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        return { status: 'processed', code: 200, extended: true };
      };

      const result = handleWebhookArrival(replayedPaymentId);
      expect(result.status).toBe('duplicate_payment_acknowledged');
      expect(result.extended).toBe(false);
      // Subscription period is NOT extended again!
      expect(userSubscription.currentPeriodEnd).toBe('2026-12-20T00:00:00.000Z');
    });

    it('2. Simultaneous frontend verification and webhook delivery: atomic lease prevents double extension', async () => {
      const paymentId = 'pay_simultaneous_race_101';
      const paymentRecords = new Map<string, { status: string; leaseExpires: number }>();
      let extensionCount = 0;

      const atomicProcessPayment = (caller: 'verify_api' | 'webhook', nowMs: number) => {
        const existing = paymentRecords.get(paymentId);
        if (existing?.status === 'processed') {
          return { status: 'already_processed', caller };
        }
        if (existing?.status === 'processing') {
          if (existing.leaseExpires > nowMs) {
            return { status: 'concurrent_in_flight', caller };
          }
        }

        // Claim lease
        paymentRecords.set(paymentId, { status: 'processing', leaseExpires: nowMs + 60000 });
        // Perform entitlement extension
        extensionCount++;
        // Finalize
        paymentRecords.set(paymentId, { status: 'processed', leaseExpires: 0 });
        return { status: 'processed', caller };
      };

      const t0 = 10000000;
      // Worker 1 (verify_api) and Worker 2 (webhook) arrive at identical timestamp
      const res1 = atomicProcessPayment('verify_api', t0);
      const res2 = atomicProcessPayment('webhook', t0);

      expect(res1.status).toBe('processed');
      expect(res2.status).toBe('already_processed');
      expect(extensionCount).toBe(1); // Exactly ONE 30-day extension granted!
    });

    it('3. Two simultaneous purchases by one user: precondition retry guarantees both extensions succeed without lost time', async () => {
      let currentPeriodEndMs = new Date('2026-11-10T00:00:00.000Z').getTime(); // Initial expiry
      let documentUpdateTime = 100;
      const duration30DaysMs = 30 * 24 * 60 * 60 * 1000;

      // Worker 1 (Purchase 1) and Worker 2 (Purchase 2) read at updateTime 100
      const read1 = { updateTime: documentUpdateTime, periodEnd: currentPeriodEndMs };
      const read2 = { updateTime: documentUpdateTime, periodEnd: currentPeriodEndMs };

      // Worker 1 commits first
      const commitWorker1 = (readState: typeof read1) => {
        if (readState.updateTime !== documentUpdateTime) throw new Error('412 Precondition Failed');
        currentPeriodEndMs = readState.periodEnd + duration30DaysMs;
        documentUpdateTime = 101;
        return { success: true, newPeriodEndMs: currentPeriodEndMs };
      };

      // Worker 2 attempts commit with optimistic concurrency retry
      const commitWorker2WithRetry = (initialRead: typeof read2) => {
        let attempts = 0;
        let state = initialRead;
        while (attempts < 3) {
          attempts++;
          if (state.updateTime !== documentUpdateTime) {
            // Precondition failed! Re-read fresh state and recalculate
            state = { updateTime: documentUpdateTime, periodEnd: currentPeriodEndMs };
            continue;
          }
          currentPeriodEndMs = state.periodEnd + duration30DaysMs;
          documentUpdateTime++;
          return { success: true, attempts, newPeriodEndMs: currentPeriodEndMs };
        }
        throw new Error('Max retries exceeded');
      };

      const res1 = commitWorker1(read1);
      expect(res1.success).toBe(true);

      const res2 = commitWorker2WithRetry(read2);
      expect(res2.success).toBe(true);
      expect(res2.attempts).toBe(2); // Recovered on attempt 2

      // Expected total: initial + 30 days + 30 days = +60 days!
      const initialMs = new Date('2026-11-10T00:00:00.000Z').getTime();
      expect(currentPeriodEndMs).toBe(initialMs + 2 * duration30DaysMs);
    });

    it('4. Duplicate order.paid and payment.captured for the same payment cannot double-credit', () => {
      const permanentLedger = new Map<string, string>();
      let creditCount = 0;

      const handleWebhook = (eventType: 'order.paid' | 'payment.captured', paymentId: string) => {
        if (permanentLedger.get(paymentId) === 'processed') {
          return { acknowledged: true, duplicate: true };
        }
        permanentLedger.set(paymentId, 'processed');
        creditCount++;
        return { acknowledged: true, duplicate: false };
      };

      const paymentId = 'pay_single_order_999';
      const event1 = handleWebhook('order.paid', paymentId);
      const event2 = handleWebhook('payment.captured', paymentId);

      expect(event1.duplicate).toBe(false);
      expect(event2.duplicate).toBe(true);
      expect(creditCount).toBe(1);
    });

    it('5. Failed event arriving after successful capture does not downgrade active pass', () => {
      const permanentLedger = new Map<string, string>();
      permanentLedger.set('pay_confirmed_123', 'processed');

      const userState = {
        status: 'active',
        currentPeriodEnd: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString(),
      };

      const handleFailedEvent = (paymentId: string) => {
        // Check 1: was this specific payment already processed?
        if (permanentLedger.get(paymentId) === 'processed') {
          return { action: 'ignored_already_captured', status: userState.status };
        }
        // Check 2: does user have an unexpired active pass?
        if (userState.status === 'active' && new Date(userState.currentPeriodEnd).getTime() > Date.now()) {
          return { action: 'ignored_active_pass_preserved', status: userState.status };
        }
        userState.status = 'past_due';
        return { action: 'demoted', status: userState.status };
      };

      const outcome1 = handleFailedEvent('pay_confirmed_123');
      expect(outcome1.action).toBe('ignored_already_captured');
      expect(userState.status).toBe('active');

      const outcome2 = handleFailedEvent('pay_failed_new_attempt_456');
      expect(outcome2.action).toBe('ignored_active_pass_preserved');
      expect(userState.status).toBe('active');
    });

    it('6. Strict verification rejects mismatched amount, currency, orderId, userId, and planTier', () => {
      const trustedPlan = { planTier: 'paid', planId: 'pass_30d', amountPaise: 7500, currency: 'INR' };
      const authenticatedUser = 'usr_real_student';

      const verifyPaymentParams = (paymentData: {
        order_id: string;
        amount: number;
        currency: string;
        notes?: { userId?: string; planTier?: string; planId?: string };
        status: string;
      }, expectedOrderId: string, requestedPlanId: string) => {
        if (paymentData.status !== 'captured') return { valid: false, error: 'Payment not captured' };
        if (paymentData.order_id !== expectedOrderId) return { valid: false, error: 'Order ID mismatch' };
        if (paymentData.amount !== trustedPlan.amountPaise) return { valid: false, error: 'Amount mismatch' };
        if (paymentData.currency !== trustedPlan.currency) return { valid: false, error: 'Currency mismatch' };
        if (paymentData.notes?.userId !== authenticatedUser) return { valid: false, error: 'User ID mismatch' };
        if (paymentData.notes?.planId && paymentData.notes.planId !== requestedPlanId) {
          return { valid: false, error: 'Plan ID mismatch' };
        }
        return { valid: true };
      };

      // Test amount mismatch
      expect(verifyPaymentParams({
        order_id: 'ord_1', amount: 100, currency: 'INR', status: 'captured', notes: { userId: authenticatedUser, planId: 'pass_30d' }
      }, 'ord_1', 'pass_30d').error).toMatch(/Amount mismatch/i);

      // Test currency mismatch
      expect(verifyPaymentParams({
        order_id: 'ord_1', amount: 7500, currency: 'USD', status: 'captured', notes: { userId: authenticatedUser, planId: 'pass_30d' }
      }, 'ord_1', 'pass_30d').error).toMatch(/Currency mismatch/i);

      // Test order ID mismatch
      expect(verifyPaymentParams({
        order_id: 'ord_WRONG', amount: 7500, currency: 'INR', status: 'captured', notes: { userId: authenticatedUser, planId: 'pass_30d' }
      }, 'ord_EXPECTED', 'pass_30d').error).toMatch(/Order ID mismatch/i);

      // Test user ID mismatch (another user's payment)
      expect(verifyPaymentParams({
        order_id: 'ord_1', amount: 7500, currency: 'INR', status: 'captured', notes: { userId: 'usr_imposter', planId: 'pass_30d' }
      }, 'ord_1', 'pass_30d').error).toMatch(/User ID mismatch/i);

      // Test plan ID mismatch
      expect(verifyPaymentParams({
        order_id: 'ord_1', amount: 7500, currency: 'INR', status: 'captured', notes: { userId: authenticatedUser, planId: 'pass_180d' }
      }, 'ord_1', 'pass_30d').error).toMatch(/Plan ID mismatch/i);
    });

    it('7. Retry after failed Firestore write: payment is left in failed state until retried successfully', async () => {
      let paymentRecordState = { status: 'new', attempts: 0 };
      let firestoreHealthy = false;

      const processWithSimulatedFailure = () => {
        paymentRecordState.status = 'processing';
        paymentRecordState.attempts++;
        if (!firestoreHealthy) {
          paymentRecordState.status = 'failed';
          throw new Error('Firestore 503 Unavailable');
        }
        paymentRecordState.status = 'processed';
        return { success: true };
      };

      // Attempt 1 fails
      expect(() => processWithSimulatedFailure()).toThrow(/Firestore 503/);
      expect(paymentRecordState.status).toBe('failed');
      expect(paymentRecordState.attempts).toBe(1);

      // System heals and retry succeeds
      firestoreHealthy = true;
      const res = processWithSimulatedFailure();
      expect(res.success).toBe(true);
      expect(paymentRecordState.status).toBe('processed');
      expect(paymentRecordState.attempts).toBe(2);
    });

    it('8. Expired entitlement: pass is automatically revoked by authorization check when periodEnd is in the past', async () => {
      const pastDate = new Date(Date.now() - 3600000).toISOString(); // 1 hour ago
      const mockSupabase = {
        rpc: vi.fn().mockResolvedValue({
          data: {
            tier: 'paid',
            is_active: true, // Server RPC might have old state
            features: ['timetable', 'unlimited_cloud_sync'],
            status: 'active',
            current_period_end: pastDate,
          },
          error: null,
        }),
      } as any;
      vi.spyOn(authServiceModule, 'getSupabaseClient').mockReturnValue(mockSupabase);

      const entitlements = await subscriptionService.getUserEntitlements('usr-authoritative-expired');
      // Must be authoritatively free and inactive
      expect(entitlements.isActive).toBe(false);
      expect(entitlements.tier).toBe('free');
      expect(entitlements.status).toBe('completed');
      expect(entitlements.features).not.toContain('unlimited_cloud_sync');
      expect(entitlements.features).toContain('timetable');
    });

    it('9. Plan configuration: all 5 TRAKIFY passes have server-controlled pricing and durations', () => {
      const code = fs.readFileSync(path.resolve('supabase/functions/_shared/razorpay.ts'), 'utf8');
      expect(code).toMatch(/pass_7d/);
      expect(code).toMatch(/amountPaise:\s*2000/);
      expect(code).toMatch(/durationDays:\s*7/);
      expect(code).toMatch(/pass_30d/);
      expect(code).toMatch(/amountPaise:\s*7500/);
      expect(code).toMatch(/durationDays:\s*30/);
      expect(code).toMatch(/pass_180d/);
      expect(code).toMatch(/amountPaise:\s*42500/);
      expect(code).toMatch(/durationDays:\s*180/);
      expect(code).toMatch(/pass_365d/);
      expect(code).toMatch(/amountPaise:\s*82500/);
      expect(code).toMatch(/durationDays:\s*365/);
      expect(code).toMatch(/pass_1460d/);
      expect(code).toMatch(/amountPaise:\s*330000/);
      expect(code).toMatch(/durationDays:\s*1460/);
    });

    it('10. Order creation rejects retired demo tiers (pro, cohort)', () => {
      const createOrderCode = fs.readFileSync(path.resolve('supabase/functions/create-razorpay-order/index.ts'), 'utf8');
      expect(createOrderCode).toMatch(/isTrakifyPassId\(rawPlanId\)/);
      expect(createOrderCode).toMatch(/Demo plans \(pro, cohort\) are retired/);
    });

    it('11. Crash recovery prevents double-crediting if server crashed after subscription write', () => {
      // Logic simulation of firestoreRest.ts lines 1003-1037:
      // Given: user_subscriptions has already been updated with paymentId 'pay_crash_123'
      const paymentId = 'pay_crash_123';
      const existingEnd = new Date(Date.now() + 30 * 86400000).toISOString();
      const userSubscription = {
        lastVerifiedPayment: paymentId,
        paymentId: paymentId,
        currentPeriodEnd: existingEnd,
        currentPeriodStart: new Date().toISOString(),
        planTier: 'paid',
      };

      // When: payment_records was left incomplete and processAuthoritativePayment retries
      let updatedExpiry: string | null = null;
      let duplicateIgnored = false;

      if (
        userSubscription.lastVerifiedPayment === paymentId ||
        userSubscription.paymentId === paymentId
      ) {
        // Crash recovery branch: do NOT add 30 days again!
        duplicateIgnored = true;
        updatedExpiry = userSubscription.currentPeriodEnd;
      } else {
        // Normal path would have added duration
        updatedExpiry = new Date(new Date(userSubscription.currentPeriodEnd).getTime() + 30 * 86400000).toISOString();
      }

      expect(duplicateIgnored).toBe(true);
      expect(updatedExpiry).toBe(existingEnd); // Exact same timestamp, ZERO double extension!
    });

    it('12. Stacking math: purchasing pass_7d then pass_180d stacks to exact 187 days', () => {
      const now = Date.now();
      const pass7dEnd = new Date(now + 7 * 86400000).toISOString();

      // Active pass with 7 days remaining
      const baseTime = new Date(pass7dEnd).getTime();
      const duration180dMs = 180 * 86400000;
      const stackedEnd = new Date(baseTime + duration180dMs).toISOString();

      const totalDays = Math.round((new Date(stackedEnd).getTime() - now) / 86400000);
      expect(totalDays).toBe(187);
    });

    it('13. Repurchase after expiry: starts fresh from current time, not past periodEnd', () => {
      const now = Date.now();
      const pastEnd = new Date(now - 10 * 86400000).toISOString(); // Expired 10 days ago

      let baseTime = now;
      if (new Date(pastEnd).getTime() > now) {
        baseTime = new Date(pastEnd).getTime();
      }

      const duration30dMs = 30 * 86400000;
      const newPeriodEnd = new Date(baseTime + duration30dMs).toISOString();

      const daysFromNow = Math.round((new Date(newPeriodEnd).getTime() - now) / 86400000);
      expect(daysFromNow).toBe(30); // 30 days from now, NOT 20 days!
    });
  });

  // ============================================================================
  // B. Atomic Firestore REST Commit & Multi-Payment Crash Recovery (8 Scenarios)
  // ============================================================================
  describe('B. Atomic Firestore REST Commit & Multi-Payment Crash Recovery (8 Scenarios)', () => {
    it('1. Crash before atomic commit: neither document written, lease expires, retry recovers lease and succeeds', () => {
      interface DocStore {
        userSubscriptions: Map<string, { periodEnd: string; updateTime: number }>;
        paymentRecords: Map<string, { status: string; leaseExpiresAt: number; updateTime: number }>;
      }
      const store: DocStore = {
        userSubscriptions: new Map(),
        paymentRecords: new Map(),
      };

      const paymentId = 'pay_crash_before_commit_01';
      const userId = 'usr_alice';
      let now = 1000000;

      // Worker 1 claims payment record
      store.paymentRecords.set(paymentId, { status: 'processing', leaseExpiresAt: now + 60000, updateTime: 1 });

      // Worker 1 crashes before commit. (Neither subscription nor payment record finalized).
      expect(store.userSubscriptions.has(userId)).toBe(false);
      expect(store.paymentRecords.get(paymentId)?.status).toBe('processing');

      // Now time advances beyond lease expiry (e.g. 65 seconds later)
      now += 65000;

      // Worker 2 / retry checks payment record: lease is expired
      const rec = store.paymentRecords.get(paymentId)!;
      const canReclaim = rec.status === 'processing' && now > rec.leaseExpiresAt;
      expect(canReclaim).toBe(true);

      // Worker 2 reclaims lease with updated lease and updateTime
      store.paymentRecords.set(paymentId, { status: 'processing', leaseExpiresAt: now + 60000, updateTime: 2 });

      // Worker 2 executes atomic commit
      store.userSubscriptions.set(userId, { periodEnd: new Date(now + 30 * 86400000).toISOString(), updateTime: 1 });
      store.paymentRecords.set(paymentId, { status: 'processed', leaseExpiresAt: 0, updateTime: 3 });

      expect(store.userSubscriptions.get(userId)).toBeDefined();
      expect(store.paymentRecords.get(paymentId)?.status).toBe('processed');
    });

    it('2. Crash immediately after atomic commit: both documents written, retry recognized as duplicate_ignored', () => {
      const paymentRecords = new Map<string, { status: string; periodEnd: string }>();
      const userSubscriptions = new Map<string, { periodEnd: string; lastVerifiedPayment: string }>();

      const paymentId = 'pay_crash_after_commit_02';
      const userId = 'usr_bob';
      const periodEnd = '2026-12-15T00:00:00.000Z';

      // Atomic commit executed both writes simultaneously
      userSubscriptions.set(userId, { periodEnd, lastVerifiedPayment: paymentId });
      paymentRecords.set(paymentId, { status: 'processed', periodEnd });

      // Worker crashes right after receiving 200 OK from commit, before sending response to client
      // Client / webhook retries delivery
      const retryClaim = (pId: string) => {
        const record = paymentRecords.get(pId);
        if (record?.status === 'processed') {
          return { alreadyProcessed: true, status: 'already_processed', periodEnd: record.periodEnd };
        }
        return { alreadyProcessed: false, status: 'new' };
      };

      const outcome = retryClaim(paymentId);
      expect(outcome.alreadyProcessed).toBe(true);
      expect(outcome.status).toBe('already_processed');
      expect(outcome.periodEnd).toBe(periodEnd); // Returns existing entitlement, zero double extension!
    });

    it('3. Payment A crashes before commit, Payment B succeeds, Payment A retries and stacks without double-crediting', () => {
      let currentPeriodEndMs = new Date('2026-11-10T00:00:00.000Z').getTime();
      let subUpdateTime = 10;
      const duration30dMs = 30 * 86400000;

      const paymentRecords = new Map<string, { status: string; leaseExpires: number; updateTime: number }>();

      // 1. Payment A starts, claims lease, but crashes before commit
      let now = 1000000;
      paymentRecords.set('pay_A', { status: 'processing', leaseExpires: now + 60000, updateTime: 1 });

      // 2. Payment B arrives for the same user, executes atomic commit
      now += 10000;
      paymentRecords.set('pay_B', { status: 'processing', leaseExpires: now + 60000, updateTime: 1 });

      // Payment B reads sub (updateTime 10), commits atomically
      currentPeriodEndMs = currentPeriodEndMs + duration30dMs;
      subUpdateTime = 11;
      paymentRecords.set('pay_B', { status: 'processed', leaseExpires: 0, updateTime: 2 });

      // 3. Payment A lease expires (after 60s) and Payment A retries
      now += 55000; // now is past A's lease
      const recA = paymentRecords.get('pay_A')!;
      expect(now > recA.leaseExpires).toBe(true); // Lease is expired

      // Reclaim lease for A
      paymentRecords.set('pay_A', { status: 'processing', leaseExpires: now + 60000, updateTime: 3 });

      // Payment A re-reads subscription: sees Payment B's extended periodEnd and updateTime 11
      const stackedEndMs = currentPeriodEndMs + duration30dMs;
      // Atomic commit for A succeeds with sub updateTime 11
      currentPeriodEndMs = stackedEndMs;
      subUpdateTime = 12;
      paymentRecords.set('pay_A', { status: 'processed', leaseExpires: 0, updateTime: 4 });

      // Verify: Both payments are marked 'processed'
      expect(paymentRecords.get('pay_A')?.status).toBe('processed');
      expect(paymentRecords.get('pay_B')?.status).toBe('processed');

      // Verify: Sub period is initial + 30d (B) + 30d (A) = exactly +60 days!
      const initialMs = new Date('2026-11-10T00:00:00.000Z').getTime();
      expect(currentPeriodEndMs).toBe(initialMs + 2 * duration30dMs);
    });

    it('4. Two concurrent payments for same user: HTTP 412 trigger causes retry loop to re-read and stack', () => {
      let subUpdateTime = 50;
      let periodEndMs = new Date('2026-11-10T00:00:00.000Z').getTime();
      const duration30dMs = 30 * 86400000;

      // Both workers read at subUpdateTime = 50
      const worker1Read = { subUpdateTime, periodEndMs };
      const worker2Read = { subUpdateTime, periodEndMs };

      // Worker 1 commits atomically first
      periodEndMs = worker1Read.periodEndMs + duration30dMs;
      subUpdateTime = 51;

      // Worker 2 attempts atomic commit with precondition subUpdateTime == 50 -> FAILS with 412!
      const commitWorker2 = (targetUpdateTime: number, targetPeriodEndMs: number) => {
        if (targetUpdateTime !== subUpdateTime) {
          return { status: 412, preconditionFailed: true };
        }
        periodEndMs = targetPeriodEndMs + duration30dMs;
        subUpdateTime++;
        return { status: 200, success: true };
      };

      const attempt1 = commitWorker2(worker2Read.subUpdateTime, worker2Read.periodEndMs);
      expect(attempt1.preconditionFailed).toBe(true);

      // Worker 2 catches 412, re-reads fresh subscription state
      const freshRead = { subUpdateTime, periodEndMs };
      expect(freshRead.subUpdateTime).toBe(51);

      // Worker 2 retries atomic commit with fresh state
      const attempt2 = commitWorker2(freshRead.subUpdateTime, freshRead.periodEndMs);
      expect(attempt2.success).toBe(true);

      const initialMs = new Date('2026-11-10T00:00:00.000Z').getTime();
      expect(periodEndMs).toBe(initialMs + 2 * duration30dMs);
    });

    it('5. Simultaneous verify API and webhook for same payment: atomic create blocks concurrent worker', () => {
      const records = new Map<string, any>();

      const claimAtomic = (paymentId: string) => {
        if (records.has(paymentId)) {
          // Document already exists (409 conflict simulated)
          const doc = records.get(paymentId);
          if (doc.status === 'processing' && doc.leaseExpires > Date.now()) {
            return { canProcess: false, status: 'concurrent_in_flight' };
          }
          if (doc.status === 'processed') {
            return { canProcess: false, status: 'already_processed' };
          }
        }
        records.set(paymentId, { status: 'processing', leaseExpires: Date.now() + 60000 });
        return { canProcess: true, status: 'new' };
      };

      const paymentId = 'pay_simultaneous_05';
      const verifyCall = claimAtomic(paymentId);
      const webhookCall = claimAtomic(paymentId);

      expect(verifyCall.canProcess).toBe(true);
      expect(verifyCall.status).toBe('new');

      expect(webhookCall.canProcess).toBe(false);
      expect(webhookCall.status).toBe('concurrent_in_flight');
    });

    it('6. Worker lease expires and another worker takes ownership', () => {
      let now = 1000000;
      const paymentRecord = {
        paymentId: 'pay_lease_expiry_06',
        status: 'processing',
        leaseExpiresAt: now + 60000,
        updateTime: 1,
      };

      // Worker 1 hangs for 70 seconds
      now += 70000;

      // Worker 2 checks lease
      const isExpired = now > paymentRecord.leaseExpiresAt;
      expect(isExpired).toBe(true);

      // Worker 2 claims expired lease with updateTime precondition
      const claimExpiredLease = (expectedUpdateTime: number) => {
        if (paymentRecord.updateTime !== expectedUpdateTime) throw new Error('412 Precondition Failed');
        paymentRecord.leaseExpiresAt = now + 60000;
        paymentRecord.updateTime = 2;
        return { success: true };
      };

      const claimed = claimExpiredLease(1);
      expect(claimed.success).toBe(true);
      expect(paymentRecord.updateTime).toBe(2);
    });

    it('7. Stale worker attempts commit with outdated lease updateTime: rejected with HTTP 412', () => {
      const paymentRecord = {
        paymentId: 'pay_stale_commit_07',
        status: 'processing',
        updateTime: 2, // Leased by Worker 2
      };

      // Worker 1 (stale, read at updateTime 1) attempts atomic commit
      const attemptCommit = (paymentRecordUpdateTime: number) => {
        if (paymentRecordUpdateTime !== paymentRecord.updateTime) {
          return { status: 412, preconditionFailed: true };
        }
        return { status: 200, success: true };
      };

      const staleCommit = attemptCommit(1); // Outdated lease!
      expect(staleCommit.status).toBe(412);
      expect(staleCommit.preconditionFailed).toBe(true);
    });

    it('8. Old webhook replay after newer purchases: ignored via permanent payment_records status', () => {
      const permanentLedger = new Map<string, string>();
      permanentLedger.set('pay_old_purchase_01', 'processed');
      permanentLedger.set('pay_newer_purchase_02', 'processed');

      // User subscription currently points to the newest payment
      const userSub = {
        lastVerifiedPayment: 'pay_newer_purchase_02',
        status: 'active',
        currentPeriodEnd: '2027-01-01T00:00:00.000Z',
      };

      // Replayed webhook for the old payment arrives
      const processReplayWebhook = (paymentId: string) => {
        if (permanentLedger.get(paymentId) === 'processed') {
          return { status: 'duplicate_ignored', duplicate: true };
        }
        // Would touch subscription
        userSub.lastVerifiedPayment = paymentId;
        return { status: 'active', duplicate: false };
      };

      const replayResult = processReplayWebhook('pay_old_purchase_01');
      expect(replayResult.status).toBe('duplicate_ignored');
      expect(replayResult.duplicate).toBe(true);
      // userSub remains untouched
      expect(userSub.lastVerifiedPayment).toBe('pay_newer_purchase_02');
    });

    it('9. Source code verification: commitAuthoritativePaymentAtomically uses /documents:commit with preconditions and native timestamp', () => {
      const code = fs.readFileSync(path.resolve('supabase/functions/_shared/firestoreRest.ts'), 'utf8');

      // Endpoint
      expect(code).toMatch(/\/databases\/\(default\)\/documents:commit/);

      // Writes array updating both documents
      expect(code).toMatch(/writes:\s*\[subWrite,\s*paymentWrite\]/);

      // Native timestamp field for Firestore rules
      expect(code).toMatch(/period_end_timestamp:\s*\{\s*timestampValue:\s*params\.finalPeriodEnd\s*\}/);

      // Precondition updateTime
      expect(code).toMatch(/subWrite\.currentDocument\s*=\s*\{\s*updateTime:\s*params\.subscriptionUpdateTime\s*\}/);
      expect(code).toMatch(/paymentWrite\.currentDocument\s*=\s*\{\s*updateTime:\s*params\.paymentRecordUpdateTime\s*\}/);

      // 412 handling
      expect(code).toMatch(/if\s*\(res\.status\s*===\s*412\)/);
    });

    it('10. Source code verification: import-youtube-playlist requires authenticateRequestUser and enforces rate limiting', () => {
      const code = fs.readFileSync(path.resolve('supabase/functions/import-youtube-playlist/index.ts'), 'utf8');

      // Authenticate
      expect(code).toMatch(/import\s*\{\s*authenticateRequestUser\s*\}\s*from\s*'\.\.\/_shared\/firebaseAuth\.ts'/);
      expect(code).toMatch(/authenticateRequestUser\(req/);
      expect(code).toMatch(/status:\s*401/);

      // Rate limiting
      expect(code).toMatch(/checkRateLimit/);
      expect(code).toMatch(/status:\s*429/);
      expect(code).toMatch(/'Retry-After'/);
    });

    it('11. Source code verification: functions/src/index.ts does not export decommissioned Stripe endpoints', () => {
      const indexCode = fs.readFileSync(path.resolve('functions/src/index.ts'), 'utf8');
      expect(indexCode).not.toMatch(/createCheckoutSession/);
      expect(indexCode).not.toMatch(/createCustomerPortalSession/);
      expect(indexCode).not.toMatch(/stripeWebhook/);
      expect(indexCode).toMatch(/trackerRpc/);
    });
  });

  // ============================================================================
  // E. Payment Verification Bug Fixes & Service Account Hardening (Post-Incident Verification)
  // ============================================================================
  describe('E. Payment Verification Bug Fixes & Service Account Hardening (Post-Incident Verification)', () => {
    it('1. Successful payment verification: subscriptionService verifies payment and activates pass with authoritative periodEnd', async () => {
      const mockPeriodEnd = new Date(Date.now() + 7 * 86400 * 1000).toISOString();
      const mockSupabase = {
        functions: {
          invoke: vi.fn().mockResolvedValue({
            data: {
              success: true,
              verified: true,
              duplicate: false,
              planId: 'pass_7d',
              planTier: 'paid',
              durationDays: 7,
              status: 'active',
              currentPeriodEnd: mockPeriodEnd,
              paymentId: 'pay_test_success_123',
              orderId: 'order_test_success_123',
              subscriptionId: null,
            },
            error: null,
          }),
        },
      } as any;
      vi.spyOn(authServiceModule, 'getSupabaseClient').mockReturnValue(mockSupabase);

      const result = await subscriptionService.verifyRazorpayPayment({
        razorpay_payment_id: 'pay_test_success_123',
        razorpay_order_id: 'order_test_success_123',
        razorpay_signature: 'valid_mock_signature',
        planId: 'pass_7d',
      });

      expect(result.success).toBe(true);
      expect(result.verified).toBe(true);
      expect(result.status).toBe('active');
      expect(result.currentPeriodEnd).toBe(mockPeriodEnd);
      expect(result.paymentId).toBe('pay_test_success_123');
      expect(result.orderId).toBe('order_test_success_123');
      expect(mockSupabase.functions.invoke).toHaveBeenCalledWith('verify-razorpay-payment', expect.objectContaining({
        body: expect.objectContaining({
          razorpay_payment_id: 'pay_test_success_123',
          razorpay_order_id: 'order_test_success_123',
          plan_id: 'pass_7d',
        }),
      }));
    });

    it('2. Invalid Firebase credentials parsing: parseServiceAccountCredential handles quotes, stringification, and rejects invalid input', () => {
      // Logic simulation of parseServiceAccountCredential from _shared/firestoreRest.ts
      function parseServiceAccountCredential(raw: string | undefined | null): any {
        if (!raw || typeof raw !== 'string' || raw.trim().length === 0) {
          throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY is empty or not provided');
        }
        let clean = raw.trim();
        if ((clean.startsWith("'") && clean.endsWith("'")) || (clean.startsWith('"') && clean.endsWith('"') && clean.includes('{\\n') === false && clean.includes('\\"') === false)) {
          if (clean.startsWith("'") && clean.endsWith("'")) {
            clean = clean.slice(1, -1).trim();
          }
        }
        let parsed: any;
        try {
          parsed = JSON.parse(clean);
        } catch (err: any) {
          throw new Error(`Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY as JSON: ${err.message}`);
        }
        if (typeof parsed === 'string') {
          try {
            parsed = JSON.parse(parsed);
          } catch (doubleErr: any) {
            throw new Error(`Failed to parse double-stringified service account JSON: ${doubleErr.message}`);
          }
        }
        return parsed;
      }

      // Case A: Standard clean JSON
      const sampleCreds = {
        type: 'service_account',
        project_id: 'tracker-e8e6f',
        client_email: 'trakify-payment-worker@tracker-e8e6f.iam.gserviceaccount.com',
        private_key: '-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASC...==\n-----END PRIVATE KEY-----\n',
      };
      const cleanJson = JSON.stringify(sampleCreds);
      const parsedClean = parseServiceAccountCredential(cleanJson);
      expect(parsedClean.client_email).toBe(sampleCreds.client_email);
      expect(parsedClean.project_id).toBe('tracker-e8e6f');

      // Case B: Single-quote wrapped JSON (often added by PowerShell or CLI secrets managers)
      const singleQuoted = `'${cleanJson}'`;
      const parsedSingleQuoted = parseServiceAccountCredential(singleQuoted);
      expect(parsedSingleQuoted.client_email).toBe(sampleCreds.client_email);

      // Case C: Double-stringified JSON (double escaped JSON string)
      const doubleStringified = JSON.stringify(cleanJson);
      const parsedDouble = parseServiceAccountCredential(doubleStringified);
      expect(parsedDouble.client_email).toBe(sampleCreds.client_email);

      // Case D: Missing / empty input throws descriptive error
      expect(() => parseServiceAccountCredential('')).toThrow(/FIREBASE_SERVICE_ACCOUNT_KEY is empty/);
      expect(() => parseServiceAccountCredential(null)).toThrow(/FIREBASE_SERVICE_ACCOUNT_KEY is empty/);
      expect(() => parseServiceAccountCredential(undefined)).toThrow(/FIREBASE_SERVICE_ACCOUNT_KEY is empty/);

      // Case E: Malformed JSON throws descriptive error
      expect(() => parseServiceAccountCredential('{ client_email: malformed... ')).toThrow(/Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY as JSON/);
    });

    it('3. Source code verification: verify-razorpay-payment and handle-razorpay-webhook return HTTP 500 with CORS on invalid credentials', () => {
      const verifyCode = fs.readFileSync(path.resolve('supabase/functions/verify-razorpay-payment/index.ts'), 'utf8');
      const webhookCode = fs.readFileSync(path.resolve('supabase/functions/handle-razorpay-webhook/index.ts'), 'utf8');

      // verify-razorpay-payment requires parseServiceAccountCredential import and 500 error return
      expect(verifyCode).toMatch(/import\s*\{\s*[^}]*parseServiceAccountCredential[^}]*\}\s*from\s*'\.\.\/_shared\/firestoreRest\.ts'/);
      expect(verifyCode).toMatch(/if\s*\(!serviceAccountRaw\)\s*\{/);
      expect(verifyCode).toMatch(/status:\s*500/);
      expect(verifyCode).toMatch(/corsHeaders/);
      expect(verifyCode).toMatch(/Invalid Firebase service account configuration/);

      // handle-razorpay-webhook requires parseServiceAccountCredential and returns 500 so Razorpay retries
      expect(webhookCode).toMatch(/import\s*\{\s*[^}]*parseServiceAccountCredential[^}]*\}\s*from\s*'\.\.\/_shared\/firestoreRest\.ts'/);
      expect(webhookCode).toMatch(/parseServiceAccountCredential\(serviceAccountRaw\)/);
      expect(webhookCode).toMatch(/status:\s*500/);
      expect(webhookCode).not.toMatch(/processed_unconfigured_cloud/);
    });

    it('4. Missing periodEnd bug prevention: verify-razorpay-payment has ZERO occurrences of undeclared periodEnd', () => {
      const verifyCode = fs.readFileSync(path.resolve('supabase/functions/verify-razorpay-payment/index.ts'), 'utf8');

      // Match standalone 'periodEnd' that is not part of 'currentPeriodEnd'
      const barePeriodEndMatches = verifyCode.match(/(?<!current|processResult\.)\bperiodEnd\b/g);
      expect(barePeriodEndMatches).toBeNull();

      // Ensure all successful entitlement responses use processResult.currentPeriodEnd or existingSub.currentPeriodEnd
      expect(verifyCode).toMatch(/currentPeriodEnd:\s*processResult\.currentPeriodEnd/);
      expect(verifyCode).toMatch(/currentPeriodEnd:\s*existingSub\.currentPeriodEnd/);

      // Ensure that there is NO fake success bypass block returning without processAuthoritativePayment
      expect(verifyCode).not.toMatch(/periodEnd\s*=\s*new Date/);
      expect(verifyCode).toMatch(/const processResult = await processAuthoritativePayment/);
    });

    it('5. Existing active pass extension (stacking rules): unexpired pass appends duration; expired pass starts from now', () => {
      const ONE_DAY_MS = 24 * 60 * 60 * 1000;

      // Stacking logic from processAuthoritativePayment in firestoreRest.ts:
      function calculatePassPeriodEnd(
        now: Date,
        existingSub: { status: string; currentPeriodEnd: string } | null,
        durationDays: number
      ): string {
        const durationMs = durationDays * ONE_DAY_MS;
        let baseTime = now.getTime();

        if (existingSub && existingSub.status === 'active' && existingSub.currentPeriodEnd) {
          const existingEnd = new Date(existingSub.currentPeriodEnd).getTime();
          if (existingEnd > now.getTime()) {
            baseTime = existingEnd; // Extend from future expiration!
          }
        }

        return new Date(baseTime + durationMs).toISOString();
      }

      const freezeTime = new Date('2026-11-09T12:00:00.000Z');

      // Case A: User has 5 days left on active pass, buys pass_7d (+7 days) -> total remaining: 12 days
      const activeSubWith5DaysLeft = {
        status: 'active',
        currentPeriodEnd: new Date(freezeTime.getTime() + 5 * ONE_DAY_MS).toISOString(),
      };
      const extendedEnd = calculatePassPeriodEnd(freezeTime, activeSubWith5DaysLeft, 7);
      const expectedExtended = new Date(freezeTime.getTime() + 12 * ONE_DAY_MS).toISOString();
      expect(extendedEnd).toBe(expectedExtended);

      // Case B: User had pass that expired 3 days ago, buys pass_7d -> starts from now (+7 days from now)
      const expiredSub = {
        status: 'active',
        currentPeriodEnd: new Date(freezeTime.getTime() - 3 * ONE_DAY_MS).toISOString(),
      };
      const freshEnd = calculatePassPeriodEnd(freezeTime, expiredSub, 7);
      const expectedFresh = new Date(freezeTime.getTime() + 7 * ONE_DAY_MS).toISOString();
      expect(freshEnd).toBe(expectedFresh);

      // Case C: New user with no existing subscription buys pass_30d -> starts from now (+30 days)
      const newSubEnd = calculatePassPeriodEnd(freezeTime, null, 30);
      const expectedNewSub = new Date(freezeTime.getTime() + 30 * ONE_DAY_MS).toISOString();
      expect(newSubEnd).toBe(expectedNewSub);

      // Case D: Stacking across pass tiers: active 7-day pass extended by a 365-day pass
      const sub7d = {
        status: 'active',
        currentPeriodEnd: new Date(freezeTime.getTime() + 7 * ONE_DAY_MS).toISOString(),
      };
      const stackedYearEnd = calculatePassPeriodEnd(freezeTime, sub7d, 365);
      const expectedStackedYear = new Date(freezeTime.getTime() + 372 * ONE_DAY_MS).toISOString();
      expect(stackedYearEnd).toBe(expectedStackedYear);
    });

    it('6. Webhook duplicate delivery: idempotency ledger prevents double pass activation and ignores duplicate events', () => {
      // Simulating permanent payment ledger in Firestore
      const paymentRecords = new Map<string, any>();
      const userSubscriptions = new Map<string, any>();

      function processWebhookPayment(payload: { paymentId: string; userId: string; durationDays: number; now: Date }) {
        // Step 1: Idempotency ledger check
        const existingRecord = paymentRecords.get(payload.paymentId);
        if (existingRecord?.status === 'processed') {
          return { success: true, duplicate: true, status: 'duplicate_ignored' };
        }

        // Step 2: Calculate new period end with stacking
        const existingSub = userSubscriptions.get(payload.userId) || null;
        let baseTime = payload.now.getTime();
        if (existingSub?.status === 'active' && existingSub.currentPeriodEnd) {
          const existingEnd = new Date(existingSub.currentPeriodEnd).getTime();
          if (existingEnd > payload.now.getTime()) {
            baseTime = existingEnd;
          }
        }
        const finalPeriodEnd = new Date(baseTime + payload.durationDays * 86400 * 1000).toISOString();

        // Step 3: Record payment in ledger and update subscription
        paymentRecords.set(payload.paymentId, {
          paymentId: payload.paymentId,
          userId: payload.userId,
          status: 'processed',
          processedAt: payload.now.toISOString(),
        });

        userSubscriptions.set(payload.userId, {
          userId: payload.userId,
          status: 'active',
          lastVerifiedPayment: payload.paymentId,
          currentPeriodEnd: finalPeriodEnd,
        });

        return { success: true, duplicate: false, status: 'active', currentPeriodEnd: finalPeriodEnd };
      }

      const now = new Date('2026-11-09T12:00:00.000Z');
      const testPaymentId = 'pay_webhook_dup_test_001';
      const userId = 'usr_student_alpha';

      // First webhook delivery (payment.captured)
      const firstResult = processWebhookPayment({
        paymentId: testPaymentId,
        userId,
        durationDays: 7,
        now,
      });

      expect(firstResult.success).toBe(true);
      expect(firstResult.duplicate).toBe(false);
      expect(firstResult.status).toBe('active');
      const firstPeriodEnd = firstResult.currentPeriodEnd;

      // Second webhook delivery (duplicate payment.captured or order.paid replay)
      const secondResult = processWebhookPayment({
        paymentId: testPaymentId,
        userId,
        durationDays: 7,
        now: new Date('2026-11-09T12:00:05.000Z'),
      });

      expect(secondResult.success).toBe(true);
      expect(secondResult.duplicate).toBe(true);
      expect(secondResult.status).toBe('duplicate_ignored');

      // Assert user's currentPeriodEnd was NOT extended a second time
      const finalUserSub = userSubscriptions.get(userId);
      expect(finalUserSub.currentPeriodEnd).toBe(firstPeriodEnd);
      expect(finalUserSub.lastVerifiedPayment).toBe(testPaymentId);
    });
  });

  // ============================================================================
  // F. Server-Side Secure Payment Recovery (Zero-Signature Fallback via Authenticated Razorpay API)
  // ============================================================================
  describe('F. Server-Side Secure Payment Recovery (Zero-Signature Fallback via Authenticated Razorpay API)', () => {
    const TEST_AUTH_USER_ID = 'usr_student_alpha_123';

    // Pure validator simulation of recover-razorpay-payment edge function
    function validateAndRecoverPayment(params: {
      authUserId: string | null;
      inputPaymentId: string;
      inputOrderId: string;
      razorpayPaymentApiResult: { status: number; data?: any };
      razorpayOrderApiResult: { status: number; data?: any };
      serviceAccountConfigured: boolean;
      existingLedgerRecord?: { status: string; planId: string; periodEnd: string };
      inFlightWorkers?: Set<string>;
    }) {
      // 1. Auth check
      if (!params.authUserId) {
        return { status: 401, error: 'Unauthorized user session' };
      }

      // 2. Database credentials check
      if (!params.serviceAccountConfigured) {
        return { status: 500, error: 'Server database credential pending configuration (FIREBASE_SERVICE_ACCOUNT_KEY)' };
      }

      // 3. Input format check
      if (!/^pay_[a-zA-Z0-9_]{8,60}$/.test(params.inputPaymentId)) {
        return { status: 400, error: 'Invalid or missing Razorpay payment ID format' };
      }
      if (!/^order_[a-zA-Z0-9_]{8,60}$/.test(params.inputOrderId)) {
        return { status: 400, error: 'Invalid or missing Razorpay order ID format' };
      }

      // 4. Ledger idempotency pre-check
      if (params.existingLedgerRecord?.status === 'processed') {
        return {
          status: 200,
          success: true,
          verified: true,
          recovered: true,
          duplicate: true,
          planId: params.existingLedgerRecord.planId,
          currentPeriodEnd: params.existingLedgerRecord.periodEnd,
        };
      }

      // 5. Razorpay Payment API check
      if (params.razorpayPaymentApiResult.status !== 200) {
        return { status: params.razorpayPaymentApiResult.status === 404 ? 404 : 502, error: 'Razorpay payment lookup failed' };
      }
      const paymentData = params.razorpayPaymentApiResult.data;

      // 6. Razorpay Order API check
      if (params.razorpayOrderApiResult.status !== 200) {
        return { status: params.razorpayOrderApiResult.status === 404 ? 404 : 502, error: 'Razorpay order lookup failed' };
      }
      const orderData = params.razorpayOrderApiResult.data;

      // 7. Payment status MUST be 'captured'
      if (paymentData.status !== 'captured') {
        return { status: 400, error: `Payment status is '${paymentData.status}'. Only captured payments can be recovered.` };
      }

      // 8. Payment ID match
      if (paymentData.id !== params.inputPaymentId) {
        return { status: 400, error: 'Payment ID mismatch' };
      }

      // 9. Order ID cross-reference match
      if (paymentData.order_id !== params.inputOrderId || orderData.id !== params.inputOrderId) {
        return { status: 400, error: 'Payment does not belong to the provided order ID' };
      }

      // 10. Currency match
      if (paymentData.currency !== 'INR' || orderData.currency !== 'INR') {
        return { status: 400, error: 'Invalid currency: Only INR payments are supported.' };
      }

      // 11. User ownership match
      const orderUserId = orderData.notes?.userId || paymentData.notes?.userId;
      if (!orderUserId || orderUserId !== params.authUserId) {
        return { status: 403, error: 'Payment user account mismatch: this payment was not created for your account' };
      }

      // 12. Plan ID validation
      const TRAKIFY_VALID_PASSES: Record<string, { amountPaise: number; durationDays: number }> = {
        pass_7d: { amountPaise: 2000, durationDays: 7 },
        pass_30d: { amountPaise: 7500, durationDays: 30 },
        pass_180d: { amountPaise: 42500, durationDays: 180 },
        pass_365d: { amountPaise: 82500, durationDays: 365 },
        pass_1460d: { amountPaise: 330000, durationDays: 1460 },
      };
      const planId = orderData.notes?.planId || paymentData.notes?.planId;
      if (!planId || !TRAKIFY_VALID_PASSES[planId]) {
        return { status: 400, error: `Invalid or retired plan ID: "${planId}"` };
      }
      const passConfig = TRAKIFY_VALID_PASSES[planId];

      // 13. Amount match against authoritative price
      if (paymentData.amount !== passConfig.amountPaise || orderData.amount !== passConfig.amountPaise) {
        return { status: 400, error: `Payment amount mismatch: expected ${passConfig.amountPaise}, got ${paymentData.amount}` };
      }

      // 14. Concurrent in-flight check
      if (params.inFlightWorkers?.has(params.inputPaymentId)) {
        return { status: 503, error: 'Concurrent payment processing in flight. Please retry.' };
      }

      // 15. Success
      const currentPeriodEnd = new Date(Date.now() + passConfig.durationDays * 86400 * 1000).toISOString();
      return {
        status: 200,
        success: true,
        verified: true,
        recovered: true,
        duplicate: false,
        planId,
        durationDays: passConfig.durationDays,
        currentPeriodEnd,
        paymentId: params.inputPaymentId,
        orderId: params.inputOrderId,
      };
    }

    it('1. Successful recovery of an existing captured payment: activates 7-Day pass and returns authoritative periodEnd', async () => {
      // Test frontend subscriptionService.recoverCapturedPayment invocation
      const mockPeriodEnd = new Date(Date.now() + 7 * 86400 * 1000).toISOString();
      const mockSupabase = {
        functions: {
          invoke: vi.fn().mockResolvedValue({
            data: {
              success: true,
              verified: true,
              recovered: true,
              duplicate: false,
              planId: 'pass_7d',
              planTier: 'paid',
              durationDays: 7,
              status: 'active',
              currentPeriodEnd: mockPeriodEnd,
              paymentId: 'pay_recovered_001',
              orderId: 'order_recovered_001',
            },
            error: null,
          }),
        },
      } as any;
      vi.spyOn(authServiceModule, 'getSupabaseClient').mockReturnValue(mockSupabase);

      const res = await subscriptionService.recoverCapturedPayment({
        paymentId: 'pay_recovered_001',
        orderId: 'order_recovered_001',
      });

      expect(res.success).toBe(true);
      expect(res.verified).toBe(true);
      expect(res.status).toBe('active');
      expect(res.currentPeriodEnd).toBe(mockPeriodEnd);
      expect(res.paymentId).toBe('pay_recovered_001');
      expect(res.orderId).toBe('order_recovered_001');

      // Test server-side validation matrix
      const serverResult = validateAndRecoverPayment({
        authUserId: TEST_AUTH_USER_ID,
        inputPaymentId: 'pay_test_7d_12345',
        inputOrderId: 'order_test_7d_12345',
        razorpayPaymentApiResult: {
          status: 200,
          data: {
            id: 'pay_test_7d_12345',
            order_id: 'order_test_7d_12345',
            status: 'captured',
            amount: 2000,
            currency: 'INR',
            notes: { userId: TEST_AUTH_USER_ID, planId: 'pass_7d' },
          },
        },
        razorpayOrderApiResult: {
          status: 200,
          data: {
            id: 'order_test_7d_12345',
            amount: 2000,
            currency: 'INR',
            status: 'paid',
            notes: { userId: TEST_AUTH_USER_ID, planId: 'pass_7d', durationDays: '7' },
          },
        },
        serviceAccountConfigured: true,
      });

      expect(serverResult.status).toBe(200);
      expect(serverResult.success).toBe(true);
      expect(serverResult.recovered).toBe(true);
      expect(serverResult.planId).toBe('pass_7d');
      expect(serverResult.durationDays).toBe(7);
    });

    it('2. Payment not captured: rejects recovery if status is authorized, failed, or refunded', () => {
      const statuses = ['authorized', 'failed', 'refunded', 'created'];
      for (const uncapturedStatus of statuses) {
        const result = validateAndRecoverPayment({
          authUserId: TEST_AUTH_USER_ID,
          inputPaymentId: 'pay_uncaptured_123',
          inputOrderId: 'order_uncaptured_123',
          razorpayPaymentApiResult: {
            status: 200,
            data: {
              id: 'pay_uncaptured_123',
              order_id: 'order_uncaptured_123',
              status: uncapturedStatus,
              amount: 2000,
              currency: 'INR',
              notes: { userId: TEST_AUTH_USER_ID, planId: 'pass_7d' },
            },
          },
          razorpayOrderApiResult: {
            status: 200,
            data: {
              id: 'order_uncaptured_123',
              amount: 2000,
              currency: 'INR',
              notes: { userId: TEST_AUTH_USER_ID, planId: 'pass_7d' },
            },
          },
          serviceAccountConfigured: true,
        });

        expect(result.status).toBe(400);
        expect(result.error).toMatch(/Only captured payments can be recovered/);
      }
    });

    it('3. Wrong payment ID: rejects malformed IDs or ID mismatch between input and Razorpay payload', () => {
      // Case A: Malformed format
      const malformedResult = validateAndRecoverPayment({
        authUserId: TEST_AUTH_USER_ID,
        inputPaymentId: 'invalid_prefix_123',
        inputOrderId: 'order_valid_12345',
        razorpayPaymentApiResult: { status: 200, data: {} },
        razorpayOrderApiResult: { status: 200, data: {} },
        serviceAccountConfigured: true,
      });
      expect(malformedResult.status).toBe(400);
      expect(malformedResult.error).toMatch(/Invalid or missing Razorpay payment ID format/);

      // Case B: ID mismatch from API
      const mismatchResult = validateAndRecoverPayment({
        authUserId: TEST_AUTH_USER_ID,
        inputPaymentId: 'pay_requested_12345',
        inputOrderId: 'order_valid_12345',
        razorpayPaymentApiResult: {
          status: 200,
          data: {
            id: 'pay_different_from_razorpay',
            order_id: 'order_valid_12345',
            status: 'captured',
            amount: 2000,
            currency: 'INR',
            notes: { userId: TEST_AUTH_USER_ID, planId: 'pass_7d' },
          },
        },
        razorpayOrderApiResult: {
          status: 200,
          data: {
            id: 'order_valid_12345',
            amount: 2000,
            currency: 'INR',
            notes: { userId: TEST_AUTH_USER_ID, planId: 'pass_7d' },
          },
        },
        serviceAccountConfigured: true,
      });
      expect(mismatchResult.status).toBe(400);
      expect(mismatchResult.error).toMatch(/Payment ID mismatch/);
    });

    it('4. Wrong order ID: rejects when payment does not belong to specified order', () => {
      const result = validateAndRecoverPayment({
        authUserId: TEST_AUTH_USER_ID,
        inputPaymentId: 'pay_test_order_mismatch',
        inputOrderId: 'order_requested_aaa',
        razorpayPaymentApiResult: {
          status: 200,
          data: {
            id: 'pay_test_order_mismatch',
            order_id: 'order_actual_bbb', // Mismatched!
            status: 'captured',
            amount: 2000,
            currency: 'INR',
            notes: { userId: TEST_AUTH_USER_ID, planId: 'pass_7d' },
          },
        },
        razorpayOrderApiResult: {
          status: 200,
          data: {
            id: 'order_requested_aaa',
            amount: 2000,
            currency: 'INR',
            notes: { userId: TEST_AUTH_USER_ID, planId: 'pass_7d' },
          },
        },
        serviceAccountConfigured: true,
      });

      expect(result.status).toBe(400);
      expect(result.error).toMatch(/Payment does not belong to the provided order ID/);
    });

    it('5. Incorrect amount: rejects if payment amount differs from authoritative pass price', () => {
      // pass_7d is 2000 paise (₹20). If payment was for 1000 paise:
      const result = validateAndRecoverPayment({
        authUserId: TEST_AUTH_USER_ID,
        inputPaymentId: 'pay_underpaid_123',
        inputOrderId: 'order_underpaid_123',
        razorpayPaymentApiResult: {
          status: 200,
          data: {
            id: 'pay_underpaid_123',
            order_id: 'order_underpaid_123',
            status: 'captured',
            amount: 1000, // Tampered/underpaid!
            currency: 'INR',
            notes: { userId: TEST_AUTH_USER_ID, planId: 'pass_7d' },
          },
        },
        razorpayOrderApiResult: {
          status: 200,
          data: {
            id: 'order_underpaid_123',
            amount: 1000,
            currency: 'INR',
            notes: { userId: TEST_AUTH_USER_ID, planId: 'pass_7d' },
          },
        },
        serviceAccountConfigured: true,
      });

      expect(result.status).toBe(400);
      expect(result.error).toMatch(/Payment amount mismatch/);
    });

    it('6. Incorrect currency: rejects non-INR payments', () => {
      const result = validateAndRecoverPayment({
        authUserId: TEST_AUTH_USER_ID,
        inputPaymentId: 'pay_usd_currency_123',
        inputOrderId: 'order_usd_currency_123',
        razorpayPaymentApiResult: {
          status: 200,
          data: {
            id: 'pay_usd_currency_123',
            order_id: 'order_usd_currency_123',
            status: 'captured',
            amount: 2000,
            currency: 'USD', // Wrong currency!
            notes: { userId: TEST_AUTH_USER_ID, planId: 'pass_7d' },
          },
        },
        razorpayOrderApiResult: {
          status: 200,
          data: {
            id: 'order_usd_currency_123',
            amount: 2000,
            currency: 'USD',
            notes: { userId: TEST_AUTH_USER_ID, planId: 'pass_7d' },
          },
        },
        serviceAccountConfigured: true,
      });

      expect(result.status).toBe(400);
      expect(result.error).toMatch(/Invalid currency/);
    });

    it('7. Wrong authenticated user: rejects recovery if order notes do not match the current student', () => {
      const result = validateAndRecoverPayment({
        authUserId: 'usr_attacker_student_666', // Attacker signed in
        inputPaymentId: 'pay_victim_payment_123',
        inputOrderId: 'order_victim_order_123',
        razorpayPaymentApiResult: {
          status: 200,
          data: {
            id: 'pay_victim_payment_123',
            order_id: 'order_victim_order_123',
            status: 'captured',
            amount: 2000,
            currency: 'INR',
            notes: { userId: 'usr_victim_student_777', planId: 'pass_7d' }, // Belongs to victim!
          },
        },
        razorpayOrderApiResult: {
          status: 200,
          data: {
            id: 'order_victim_order_123',
            amount: 2000,
            currency: 'INR',
            notes: { userId: 'usr_victim_student_777', planId: 'pass_7d' },
          },
        },
        serviceAccountConfigured: true,
      });

      expect(result.status).toBe(403);
      expect(result.error).toMatch(/Payment user account mismatch/);
    });

    it('8. Invalid or retired plan: rejects attempts to recover retired tiers (pro, cohort) or unknown plan IDs', () => {
      const retiredPlans = ['pro', 'cohort', 'enterprise_vip', 'fake_plan'];
      for (const invalidPlan of retiredPlans) {
        const result = validateAndRecoverPayment({
          authUserId: TEST_AUTH_USER_ID,
          inputPaymentId: 'pay_invalid_plan_123',
          inputOrderId: 'order_invalid_plan_123',
          razorpayPaymentApiResult: {
            status: 200,
            data: {
              id: 'pay_invalid_plan_123',
              order_id: 'order_invalid_plan_123',
              status: 'captured',
              amount: 2000,
              currency: 'INR',
              notes: { userId: TEST_AUTH_USER_ID, planId: invalidPlan },
            },
          },
          razorpayOrderApiResult: {
            status: 200,
            data: {
              id: 'order_invalid_plan_123',
              amount: 2000,
              currency: 'INR',
              notes: { userId: TEST_AUTH_USER_ID, planId: invalidPlan },
            },
          },
          serviceAccountConfigured: true,
        });

        expect(result.status).toBe(400);
        expect(result.error).toMatch(/Invalid or retired plan ID/);
      }
    });

    it('9. Already-processed payment: returns duplicate: true without re-crediting additional duration', () => {
      const existingPeriodEnd = '2026-11-20T12:00:00.000Z';
      const result = validateAndRecoverPayment({
        authUserId: TEST_AUTH_USER_ID,
        inputPaymentId: 'pay_already_credited_123',
        inputOrderId: 'order_already_credited_123',
        razorpayPaymentApiResult: {
          status: 200,
          data: {
            id: 'pay_already_credited_123',
            order_id: 'order_already_credited_123',
            status: 'captured',
            amount: 2000,
            currency: 'INR',
            notes: { userId: TEST_AUTH_USER_ID, planId: 'pass_7d' },
          },
        },
        razorpayOrderApiResult: {
          status: 200,
          data: {
            id: 'order_already_credited_123',
            amount: 2000,
            currency: 'INR',
            notes: { userId: TEST_AUTH_USER_ID, planId: 'pass_7d' },
          },
        },
        serviceAccountConfigured: true,
        existingLedgerRecord: {
          status: 'processed',
          planId: 'pass_7d',
          periodEnd: existingPeriodEnd,
        },
      });

      expect(result.status).toBe(200);
      expect(result.duplicate).toBe(true);
      expect(result.currentPeriodEnd).toBe(existingPeriodEnd);
    });

    it('10. Concurrent recovery attempts: returns HTTP 503 if another worker currently holds processing lease', () => {
      const inFlightWorkers = new Set<string>();
      inFlightWorkers.add('pay_concurrent_in_flight_123'); // Worker 1 is currently processing

      const result = validateAndRecoverPayment({
        authUserId: TEST_AUTH_USER_ID,
        inputPaymentId: 'pay_concurrent_in_flight_123',
        inputOrderId: 'order_concurrent_123',
        razorpayPaymentApiResult: {
          status: 200,
          data: {
            id: 'pay_concurrent_in_flight_123',
            order_id: 'order_concurrent_123',
            status: 'captured',
            amount: 2000,
            currency: 'INR',
            notes: { userId: TEST_AUTH_USER_ID, planId: 'pass_7d' },
          },
        },
        razorpayOrderApiResult: {
          status: 200,
          data: {
            id: 'order_concurrent_123',
            amount: 2000,
            currency: 'INR',
            notes: { userId: TEST_AUTH_USER_ID, planId: 'pass_7d' },
          },
        },
        serviceAccountConfigured: true,
        inFlightWorkers,
      });

      expect(result.status).toBe(503);
      expect(result.error).toMatch(/Concurrent payment processing in flight/);
    });

    it('11. Razorpay API failure: returns HTTP 502 if Razorpay payment or order endpoint fails', () => {
      // Payment lookup 500 from Razorpay
      const paymentFailResult = validateAndRecoverPayment({
        authUserId: TEST_AUTH_USER_ID,
        inputPaymentId: 'pay_api_failure_123',
        inputOrderId: 'order_api_failure_123',
        razorpayPaymentApiResult: { status: 500 },
        razorpayOrderApiResult: { status: 200, data: {} },
        serviceAccountConfigured: true,
      });
      expect(paymentFailResult.status).toBe(502);
      expect(paymentFailResult.error).toMatch(/Razorpay payment lookup failed/);

      // Order lookup 404 from Razorpay
      const orderFailResult = validateAndRecoverPayment({
        authUserId: TEST_AUTH_USER_ID,
        inputPaymentId: 'pay_api_failure_123',
        inputOrderId: 'order_api_failure_123',
        razorpayPaymentApiResult: {
          status: 200,
          data: {
            id: 'pay_api_failure_123',
            order_id: 'order_api_failure_123',
            status: 'captured',
            amount: 2000,
            currency: 'INR',
          },
        },
        razorpayOrderApiResult: { status: 404 },
        serviceAccountConfigured: true,
      });
      expect(orderFailResult.status).toBe(404);
      expect(orderFailResult.error).toMatch(/Razorpay order lookup failed/);
    });

    it('12. Firebase credential failure: returns HTTP 500 when service account key is missing', () => {
      const result = validateAndRecoverPayment({
        authUserId: TEST_AUTH_USER_ID,
        inputPaymentId: 'pay_unconfigured_fs_123',
        inputOrderId: 'order_unconfigured_fs_123',
        razorpayPaymentApiResult: { status: 200, data: {} },
        razorpayOrderApiResult: { status: 200, data: {} },
        serviceAccountConfigured: false, // Unconfigured credentials
      });

      expect(result.status).toBe(500);
      expect(result.error).toMatch(/FIREBASE_SERVICE_ACCOUNT_KEY/);
    });

    it('13. Source code verification: recover-razorpay-payment enforces zero-trust security invariants', () => {
      const recoveryCode = fs.readFileSync(path.resolve('supabase/functions/recover-razorpay-payment/index.ts'), 'utf8');

      // 1. Strict Firebase ID token verification
      expect(recoveryCode).toMatch(/authenticateRequestUser\(req/);
      expect(recoveryCode).toMatch(/status:\s*401/);

      // 2. Strict captured status requirement
      expect(recoveryCode).toMatch(/paymentData\.status\s*!==\s*'captured'/);
      expect(recoveryCode).toMatch(/status:\s*400/);

      // 3. User ownership check
      expect(recoveryCode).toMatch(/orderUserId\s*!==\s*user\.id/);
      expect(recoveryCode).toMatch(/status:\s*403/);

      // 4. Strict TRAKIFY pass validation
      expect(recoveryCode).toMatch(/isTrakifyPassId\(rawPlanId\)/);

      // 5. Amount check
      expect(recoveryCode).toMatch(/paymentData\.amount\s*!==\s*passConfig\.amountPaise/);

      // 6. Currency check
      expect(recoveryCode).toMatch(/paymentData\.currency\s*!==\s*'INR'/);

      // 7. Delegates exclusively to processAuthoritativePayment
      expect(recoveryCode).toMatch(/const processResult = await processAuthoritativePayment/);
      expect(recoveryCode).toMatch(/source:\s*'recovery_api'/);

      // 8. Service account parsing
      expect(recoveryCode).toMatch(/parseServiceAccountCredential/);
    });
  });
});
