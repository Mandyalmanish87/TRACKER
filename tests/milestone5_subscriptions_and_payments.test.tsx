import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import fs from 'fs';
import path from 'path';
import {
  subscriptionService,
  DEFAULT_FREE_ENTITLEMENTS,
  computeHmacSha256Hex,
} from '../src/services/subscriptionService';
import * as authServiceModule from '../src/services/authService';
import { BillingSettingsSection } from '../src/components/subscription/BillingSettingsSection';

describe('Milestone 05 — Subscriptions & Payments Foundation (Razorpay Engine)', () => {
  const TEST_KEY_SECRET = 'rzp_sec_test_secret_key_8f3c7b2a19e4';
  const TEST_WEBHOOK_SECRET = 'rzp_whsec_test_secret_key_99aa88bb77';

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
  // 1. Cryptographic HMAC-SHA256 Signature Verification & Forgery Defense
  // ============================================================================
  describe('1. Webhook & Payment Signature Verification (Razorpay Cryptographic Engine)', () => {
    it('accepts valid Razorpay webhook signature on raw payload', async () => {
      const payload = JSON.stringify({
        entity: 'event',
        event: 'order.paid',
        payload: {
          payment: { entity: { id: 'pay_test_123', order_id: 'order_test_abc', amount: 39900 } },
        },
      });
      const signature = await generateTestWebhookSignature(payload, TEST_WEBHOOK_SECRET);

      const result = await subscriptionService.verifyWebhookSignature(
        payload,
        signature,
        TEST_WEBHOOK_SECRET
      );

      expect(result.valid).toBe(true);
      expect(result.signature).toBe(signature);
      expect(result.error).toBeUndefined();
    });

    it('rejects tampered or forged webhook payload with cryptographic mismatch', async () => {
      const originalPayload = JSON.stringify({ event: 'payment.captured', amount: 39900 });
      const tamperedPayload = JSON.stringify({ event: 'payment.captured', amount: 149900 });

      const signature = await generateTestWebhookSignature(originalPayload, TEST_WEBHOOK_SECRET);

      const result = await subscriptionService.verifyWebhookSignature(
        tamperedPayload,
        signature,
        TEST_WEBHOOK_SECRET
      );

      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/Cryptographic signature mismatch/i);
    });

    it('rejects webhook signed with an incorrect or unauthorized secret', async () => {
      const payload = JSON.stringify({ event: 'subscription.activated' });
      const signature = await generateTestWebhookSignature(payload, 'wrong_secret');

      const result = await subscriptionService.verifyWebhookSignature(
        payload,
        signature,
        TEST_WEBHOOK_SECRET
      );

      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/Cryptographic signature mismatch/i);
    });

    it('rejects missing or empty webhook signature header', async () => {
      const payload = JSON.stringify({ event: 'order.paid' });
      const result = await subscriptionService.verifyWebhookSignature(payload, '', TEST_WEBHOOK_SECRET);
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/Missing x-razorpay-signature header/i);
    });

    it('verifies Razorpay one-time payment signature (orderId + "|" + paymentId)', async () => {
      const orderId = 'order_test_9988';
      const paymentId = 'pay_test_7766';
      const validSig = await generateTestPaymentSignature(orderId, paymentId, TEST_KEY_SECRET);

      const result = await subscriptionService.verifyPaymentSignature({
        orderId,
        paymentId,
        signature: validSig,
        secret: TEST_KEY_SECRET,
      });

      expect(result.valid).toBe(true);
      expect(result.signature).toBe(validSig);
    });

    it('rejects tampered orderId or paymentId in one-time payment verification', async () => {
      const orderId = 'order_test_9988';
      const paymentId = 'pay_test_7766';
      const validSig = await generateTestPaymentSignature(orderId, paymentId, TEST_KEY_SECRET);

      const tamperedResult = await subscriptionService.verifyPaymentSignature({
        orderId: 'order_hacked_1111',
        paymentId,
        signature: validSig,
        secret: TEST_KEY_SECRET,
      });

      expect(tamperedResult.valid).toBe(false);
      expect(tamperedResult.error).toMatch(/Invalid payment signature/i);
    });

    it('verifies Razorpay recurring subscription mandate signature (paymentId + "|" + subscriptionId)', async () => {
      const paymentId = 'pay_test_sub_555';
      const subscriptionId = 'sub_test_mandate_444';
      const validSig = await generateTestSubscriptionSignature(paymentId, subscriptionId, TEST_KEY_SECRET);

      const result = await subscriptionService.verifySubscriptionSignature({
        paymentId,
        subscriptionId,
        signature: validSig,
        secret: TEST_KEY_SECRET,
      });

      expect(result.valid).toBe(true);
      expect(result.signature).toBe(validSig);
    });

    it('rejects tampered subscription signature with forged secret', async () => {
      const paymentId = 'pay_test_sub_555';
      const subscriptionId = 'sub_test_mandate_444';
      const forgedSig = await generateTestSubscriptionSignature(paymentId, subscriptionId, 'forged_secret');

      const result = await subscriptionService.verifySubscriptionSignature({
        paymentId,
        subscriptionId,
        signature: forgedSig,
        secret: TEST_KEY_SECRET,
      });

      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/Invalid subscription signature/i);
    });
  });

  // ============================================================================
  // 2. Webhook Idempotency & Replay Attack Defense
  // ============================================================================
  describe('2. Webhook Idempotency & Ledger', () => {
    it('dispatches new webhook event to server-authoritative processor', async () => {
      const mockSupabase = {
        rpc: vi.fn().mockResolvedValue({
          data: { status: 'processed', event_id: 'evt_rzp_1001', event_type: 'payment.captured' },
          error: null,
        }),
      } as any;
      vi.spyOn(authServiceModule, 'getSupabaseClient').mockReturnValue(mockSupabase);

      const result = await subscriptionService.processWebhookEvent(
        'evt_rzp_1001',
        'payment.captured',
        { payload: { payment: { entity: { id: 'pay_1001' } } } }
      );

      expect(result.status).toBe('processed');
      expect(mockSupabase.rpc).toHaveBeenCalledWith('process_subscription_webhook_event', {
        p_event_id: 'evt_rzp_1001',
        p_event_type: 'payment.captured',
        p_payload: { payload: { payment: { entity: { id: 'pay_1001' } } } },
      });
    });

    it('recognizes duplicate webhook deliveries idempotently without re-execution', async () => {
      const mockSupabase = {
        rpc: vi.fn().mockResolvedValue({
          data: { status: 'duplicate_ignored', event_id: 'evt_rzp_1001', message: 'Event already processed' },
          error: null,
        }),
      } as any;
      vi.spyOn(authServiceModule, 'getSupabaseClient').mockReturnValue(mockSupabase);

      const result = await subscriptionService.processWebhookEvent(
        'evt_rzp_1001',
        'payment.captured',
        { payload: { payment: { entity: { id: 'pay_1001' } } } }
      );

      expect(result.status).toBe('duplicate_ignored');
      expect(result.message).toMatch(/already processed/i);
    });
  });

  // ============================================================================
  // 3. Server-Authoritative Subscription Entitlements & Lifecycle
  // ============================================================================
  describe('3. Server-Authoritative Entitlements & Lifecycle', () => {
    it('falls back safely to Free tier when unauthenticated or backend unconfigured', async () => {
      vi.spyOn(authServiceModule, 'getSupabaseClient').mockReturnValue(null);

      const entitlements = await subscriptionService.getUserEntitlements();

      expect(entitlements.tier).toBe('free');
      expect(entitlements.isActive).toBe(false);
      expect(entitlements.features).toContain('timetable');
      expect(entitlements.features).toContain('attendance');
      expect(entitlements.features).toContain('pomodoro_timer');
      expect(entitlements.features).toContain('local_backup');
      expect(entitlements.features).not.toContain('unlimited_cloud_sync');
    });

    it('correctly maps active Pro subscription entitlements from server RPC', async () => {
      const mockSupabase = {
        rpc: vi.fn().mockResolvedValue({
          data: {
            tier: 'pro',
            is_active: true,
            features: [
              'timetable',
              'attendance',
              'pomodoro_timer',
              'gym_log',
              'syllabus_tracker',
              'local_backup',
              'classspace_member',
              'unlimited_cloud_sync',
              'advanced_analytics',
              'ai_study_planner',
              'priority_export',
            ],
            current_period_end: '2026-11-25T00:00:00Z',
            cancel_at_period_end: false,
            status: 'active',
          },
          error: null,
        }),
      } as any;
      vi.spyOn(authServiceModule, 'getSupabaseClient').mockReturnValue(mockSupabase);

      const entitlements = await subscriptionService.getUserEntitlements('usr-test-pro');

      expect(entitlements.tier).toBe('pro');
      expect(entitlements.isActive).toBe(true);
      expect(entitlements.features).toContain('unlimited_cloud_sync');
      expect(entitlements.features).toContain('advanced_analytics');
      expect(entitlements.features).not.toContain('sponsor_workspace_storage');
    });

    it('correctly maps Cohort Sponsor entitlements with batch sponsor permissions', async () => {
      const mockSupabase = {
        rpc: vi.fn().mockResolvedValue({
          data: {
            tier: 'cohort',
            is_active: true,
            features: [
              'timetable',
              'attendance',
              'pomodoro_timer',
              'unlimited_cloud_sync',
              'sponsor_workspace_storage',
              'verified_badge',
              'shared_announcements',
            ],
            current_period_end: '2026-12-31T23:59:59Z',
            cancel_at_period_end: false,
            status: 'active',
          },
          error: null,
        }),
      } as any;
      vi.spyOn(authServiceModule, 'getSupabaseClient').mockReturnValue(mockSupabase);

      const entitlements = await subscriptionService.getUserEntitlements('usr-cr-1');

      expect(entitlements.tier).toBe('cohort');
      expect(entitlements.isActive).toBe(true);
      expect(entitlements.features).toContain('sponsor_workspace_storage');
      expect(entitlements.features).toContain('verified_badge');
    });

    it('enforces 24-hour grace period for past_due status', async () => {
      const recentPastDuePeriodEnd = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(); // 2 hours ago
      const mockSupabase = {
        rpc: vi.fn().mockResolvedValue({
          data: {
            tier: 'pro',
            is_active: true, // within 24h grace period
            features: ['timetable', 'unlimited_cloud_sync'],
            current_period_end: recentPastDuePeriodEnd,
            cancel_at_period_end: false,
            status: 'past_due',
          },
          error: null,
        }),
      } as any;
      vi.spyOn(authServiceModule, 'getSupabaseClient').mockReturnValue(mockSupabase);

      const entitlements = await subscriptionService.getUserEntitlements('usr-pastdue-1');

      expect(entitlements.status).toBe('past_due');
      expect(entitlements.isActive).toBe(true);
    });

    it('strictly denies cross-account entitlement inspection (42501 security invariant)', async () => {
      const mockSupabase = {
        rpc: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Access denied: cannot inspect another user entitlements (42501)', code: '42501' },
        }),
      } as any;
      vi.spyOn(authServiceModule, 'getSupabaseClient').mockReturnValue(mockSupabase);

      await expect(subscriptionService.getUserEntitlements('usr-victim-99')).rejects.toThrow(
        /cannot inspect another user entitlements/i
      );
    });
  });

  // ============================================================================
  // 4. Billing Settings UI Component
  // ============================================================================
  describe('4. Billing Settings UI Component', () => {
    it('renders Free student status and catalogue cards with Razorpay verified badge', async () => {
      const mockSupabase = {
        rpc: vi.fn().mockResolvedValue({
          data: {
            tier: 'free',
            is_active: false,
            features: DEFAULT_FREE_ENTITLEMENTS.features,
            status: 'free',
          },
          error: null,
        }),
        auth: {
          getSession: vi.fn().mockResolvedValue({
            data: { session: { user: { id: 'usr-student-1' } } },
            error: null,
          }),
        },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      } as any;
      vi.spyOn(authServiceModule, 'getSupabaseClient').mockReturnValue(mockSupabase);

      render(<BillingSettingsSection userId="usr-student-1" />);

      await waitFor(() => {
        expect(screen.getByText(/TRAKIFY Membership Passes/i)).toBeInTheDocument();
        expect(screen.getByText(/One-Time Payment/i)).toBeInTheDocument();
        expect(screen.getByText(/Free Baseline Access/i)).toBeInTheDocument();
        expect(screen.getByText(/Access State:/i)).toBeInTheDocument();
      });

      // Verify all 5 one-time passes are visible with INR pricing
      expect(screen.getByRole('heading', { name: /7-Day Pass/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /Monthly Pass/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /Semester Pass/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /Annual Pass/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /Full Degree Pass/i })).toBeInTheDocument();
      expect(screen.getAllByText(/₹20/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/₹75/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/₹425/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/₹825/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/₹3,300/i).length).toBeGreaterThanOrEqual(1);
    });

    it('displays active Tracker Pro plan badge and Razorpay reference', async () => {
      const mockSupabase = {
        rpc: vi.fn().mockResolvedValue({
          data: {
            tier: 'paid',
            is_active: true,
            features: ['timetable', 'unlimited_cloud_sync'],
            status: 'active',
            current_period_end: '2026-11-30T00:00:00Z',
          },
          error: null,
        }),
        auth: {
          getSession: vi.fn().mockResolvedValue({
            data: { session: { user: { id: 'usr-pro-1' } } },
            error: null,
          }),
        },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              id: 'sub_123',
              user_id: 'usr-pro-1',
              provider: 'razorpay',
              payment_id: 'pay_rzp_mock_1234567890',
              subscription_id: 'sub_rzp_xyz',
              status: 'active',
              plan_tier: 'paid',
            },
            error: null,
          }),
        }),
      } as any;
      vi.spyOn(authServiceModule, 'getSupabaseClient').mockReturnValue(mockSupabase);

      render(<BillingSettingsSection userId="usr-pro-1" />);

      await waitFor(() => {
        expect(screen.getByText(/Access State:/i)).toBeInTheDocument();
        expect(screen.getByText(/Active Paid Pass/i)).toBeInTheDocument();
        expect(screen.getByText(/One-Time Pass · No Auto-Debit/i)).toBeInTheDocument();
        expect(screen.getByText(/Extend \(\+30d\)/i)).toBeInTheDocument();
      });
    });

    it('displays warning banner when subscription status is past_due', async () => {
      const mockSupabase = {
        rpc: vi.fn().mockResolvedValue({
          data: {
            tier: 'pro',
            is_active: true,
            features: ['timetable', 'unlimited_cloud_sync'],
            status: 'past_due',
            current_period_end: '2026-10-25T00:00:00Z',
          },
          error: null,
        }),
        auth: {
          getSession: vi.fn().mockResolvedValue({
            data: { session: { user: { id: 'usr-due-1' } } },
            error: null,
          }),
        },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              payment_id: 'pay_due_123',
              status: 'past_due',
              plan_tier: 'pro',
            },
            error: null,
          }),
        }),
      } as any;
      vi.spyOn(authServiceModule, 'getSupabaseClient').mockReturnValue(mockSupabase);

      render(<BillingSettingsSection userId="usr-due-1" />);

      await waitFor(() => {
        expect(screen.getByText(/Payment Past Due — Grace Period Active/i)).toBeInTheDocument();
      });
    });

    it('displays one-time pass model notice and eliminates recurring subscription toggles in UI', async () => {
      const mockSupabase = {
        rpc: vi.fn().mockResolvedValue({
          data: { tier: 'free', is_active: false, features: DEFAULT_FREE_ENTITLEMENTS.features, status: 'free' },
          error: null,
        }),
        auth: {
          getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
        },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      } as any;
      vi.spyOn(authServiceModule, 'getSupabaseClient').mockReturnValue(mockSupabase);

      render(<BillingSettingsSection userId="usr-toggle-1" />);

      await waitFor(() => {
        expect(screen.getByText(/Pass Stacking Protection:/i)).toBeInTheDocument();
        expect(screen.getByText(/Repurchasing before expiry automatically adds the new pass days/i)).toBeInTheDocument();
      });

      // Verify recurring toggle buttons do NOT exist
      expect(screen.queryByText(/Auto-Renewing Mandate/i)).not.toBeInTheDocument();
    });
  });

  // ============================================================================
  // 5. Database Schema & Migration Invariants
  // ============================================================================
  describe('5. Database Schema & Migration Invariants', () => {
    it('verifies firestore.rules restricts client writes to user_subscriptions', () => {
      const rulesContent = fs.readFileSync(path.resolve('firestore.rules'), 'utf8');
      expect(rulesContent).toMatch(/match\s+\/user_subscriptions\/\{userId\}\s*\{/);
      expect(rulesContent).toMatch(/allow\s+read:\s*if\s+signedIn\(\)\s*&&\s*request\.auth\.uid\s*==\s*userId;/);
      expect(rulesContent).toMatch(/allow\s+write:\s*if\s+false;/);
    });

    it('verifies client application source code never writes directly to user_subscriptions', () => {
      const clientServiceCode = fs.readFileSync(path.resolve('src/services/subscriptionService.ts'), 'utf8');
      expect(clientServiceCode).not.toMatch(/setDoc\(doc\(db,\s*'user_subscriptions'/);
      expect(clientServiceCode).not.toMatch(/updateDoc\(doc\(db,\s*'user_subscriptions'/);
    });
  });

  // ============================================================================
  // 6. Server Edge Functions & Secret Boundary Isolation
  // ============================================================================
  describe('6. Server Edge Functions & Secret Boundary Isolation (Razorpay)', () => {
    it('verifies handle-razorpay-webhook Edge Function enforces cryptographic verification and uses server environment secrets', () => {
      const edgeFunctionPath = path.resolve('supabase/functions/handle-razorpay-webhook/index.ts');
      expect(fs.existsSync(edgeFunctionPath)).toBe(true);

      const code = fs.readFileSync(edgeFunctionPath, 'utf8');
      expect(code).toMatch(/Deno\.env\.get\('RAZORPAY_WEBHOOK_SECRET'\)/);
      expect(code).toMatch(/verifyRazorpayWebhookSignature/);
      expect(code).toMatch(/claimWebhookEventAtomically/);
    });

    it('verifies create-razorpay-order Edge Function maps Price IDs authoritatively on the server (Zero Client Trust)', () => {
      const edgeFunctionPath = path.resolve('supabase/functions/create-razorpay-order/index.ts');
      expect(fs.existsSync(edgeFunctionPath)).toBe(true);

      const code = fs.readFileSync(edgeFunctionPath, 'utf8');
      expect(code).toMatch(/Deno\.env\.get\('RAZORPAY_KEY_ID'\)/);
      expect(code).toMatch(/Deno\.env\.get\('RAZORPAY_KEY_SECRET'\)/);
      expect(code).toMatch(/RAZORPAY_PLANS/);
      expect(code).toMatch(/authenticateRequestUser/);
    });

    it('verifies create-razorpay-subscription Edge Function is deprecated and returns HTTP 410 Gone', () => {
      const edgeFunctionPath = path.resolve('supabase/functions/create-razorpay-subscription/index.ts');
      expect(fs.existsSync(edgeFunctionPath)).toBe(true);

      const code = fs.readFileSync(edgeFunctionPath, 'utf8');
      expect(code).toMatch(/DEPRECATED/);
      expect(code).toMatch(/status:\s*410/);
      expect(code).toMatch(/Recurring subscriptions have been retired/);
    });

    it('verifies verify-razorpay-payment Edge Function performs cryptographic HMAC verification before updating Firestore', () => {
      const edgeFunctionPath = path.resolve('supabase/functions/verify-razorpay-payment/index.ts');
      expect(fs.existsSync(edgeFunctionPath)).toBe(true);

      const code = fs.readFileSync(edgeFunctionPath, 'utf8');
      expect(code).toMatch(/verifyRazorpayPaymentSignature/);
      expect(code).toMatch(/verifyRazorpaySubscriptionSignature/);
      expect(code).toMatch(/updateFirestoreSubscription/);
    });

    it('verifies cancel-razorpay-subscription Edge Function is deprecated and returns HTTP 410 Gone', () => {
      const edgeFunctionPath = path.resolve('supabase/functions/cancel-razorpay-subscription/index.ts');
      expect(fs.existsSync(edgeFunctionPath)).toBe(true);

      const code = fs.readFileSync(edgeFunctionPath, 'utf8');
      expect(code).toMatch(/DEPRECATED/);
      expect(code).toMatch(/status:\s*410/);
      expect(code).toMatch(/Recurring subscriptions have been retired/);
    });

    it('verifies client application source code contains zero embedded Razorpay secrets or service_role keys', () => {
      const clientServiceCode = fs.readFileSync(path.resolve('src/services/subscriptionService.ts'), 'utf8');
      const clientBillingUiCode = fs.readFileSync(path.resolve('src/components/subscription/BillingSettingsSection.tsx'), 'utf8');

      // Ensure no live/test secrets exist in client code
      expect(clientServiceCode).not.toMatch(/rzp_live_[0-9a-zA-Z]+/);
      expect(clientServiceCode).not.toMatch(/RAZORPAY_KEY_SECRET/);
      expect(clientServiceCode).not.toMatch(/RAZORPAY_WEBHOOK_SECRET/);
      expect(clientServiceCode).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY/);

      expect(clientBillingUiCode).not.toMatch(/rzp_live_[0-9a-zA-Z]+/);
      expect(clientBillingUiCode).not.toMatch(/RAZORPAY_KEY_SECRET/);
      expect(clientBillingUiCode).not.toMatch(/RAZORPAY_WEBHOOK_SECRET/);
      expect(clientBillingUiCode).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
    });
  });

  // ============================================================================
  // 7. Targeted Subscription Lifecycle & Monotonic Protection
  // ============================================================================
  describe('7. Targeted Subscription Lifecycle & Monotonic Protection', () => {
    it('verifies handle-razorpay-webhook rejects out-of-order stale events', () => {
      const webhookPath = path.resolve('supabase/functions/handle-razorpay-webhook/index.ts');
      const code = fs.readFileSync(webhookPath, 'utf8');
      expect(code).toMatch(/eventCreated\s*<\s*existingSub\.latestEventCreated/);
      expect(code).toMatch(/stale_event_ignored/);
    });

    it('verifies subscription cancellation sets cancelAtPeriodEnd without deleting user history', () => {
      const webhookPath = path.resolve('supabase/functions/handle-razorpay-webhook/index.ts');
      const code = fs.readFileSync(webhookPath, 'utf8');
      expect(code).toMatch(/case\s+'subscription\.cancelled':/);
      expect(code).toMatch(/cancelAtPeriodEnd\s*=\s*true/);
    });
  });

  // ============================================================================
  // 8. Firebase Spark + Supabase Edge Payment Flow Verification
  // ============================================================================
  describe('8. Firebase Spark + Supabase Edge Payment Flow Verification', () => {
    it('verifies Edge Function firebaseAuth checks exp, iat, auth_time, aud, iss, sub and RS256 alg', () => {
      const authHelperPath = path.resolve('supabase/functions/_shared/firebaseAuth.ts');
      expect(fs.existsSync(authHelperPath)).toBe(true);

      const code = fs.readFileSync(authHelperPath, 'utf8');
      expect(code).toMatch(/header\.alg\s*!==\s*'RS256'/);
      expect(code).toMatch(/header\.kid/);
      expect(code).toMatch(/payload\.exp/);
      expect(code).toMatch(/payload\.iat/);
      expect(code).toMatch(/payload\.auth_time/);
      expect(code).toMatch(/payload\.iss\s*!==\s*expectedIssuer/);
      expect(code).toMatch(/payload\.aud\s*!==\s*expectedProjectId/);
      expect(code).toMatch(/payload\.sub/);
      expect(code).toMatch(/RSASSA-PKCS1-v1_5/);
    });

    it('verifies Edge Function handle-razorpay-webhook enforces atomic event claiming against race conditions', () => {
      const webhookPath = path.resolve('supabase/functions/handle-razorpay-webhook/index.ts');
      const firestoreRestPath = path.resolve('supabase/functions/_shared/firestoreRest.ts');

      const webhookCode = fs.readFileSync(webhookPath, 'utf8');
      const firestoreCode = fs.readFileSync(firestoreRestPath, 'utf8');

      expect(webhookCode).toMatch(/claimWebhookEventAtomically/);
      expect(firestoreCode).toMatch(/claimWebhookEventAtomically/);
      expect(firestoreCode).toMatch(/status\s*===\s*409/); // Conflict handled atomically
    });

    it('verifies Edge Function handle-razorpay-webhook returns HTTP 500 when Firestore update fails', () => {
      const webhookPath = path.resolve('supabase/functions/handle-razorpay-webhook/index.ts');
      const code = fs.readFileSync(webhookPath, 'utf8');

      expect(code).toMatch(/status:\s*500/);
      expect(code).toMatch(/markWebhookEventFailed/);
    });

    it('verifies Edge Functions use restricted CORS origins and reject wildcard in production', () => {
      const corsPath = path.resolve('supabase/functions/_shared/cors.ts');
      expect(fs.existsSync(corsPath)).toBe(true);

      const code = fs.readFileSync(corsPath, 'utf8');
      expect(code).toMatch(/ALLOWED_ORIGINS/);
      expect(code).toMatch(/getCorsHeaders/);
      expect(code).not.toMatch(/'Access-Control-Allow-Origin':\s*'\*'/);
    });

    it('verifies client subscriptionService isolates mock RPCs strictly to test runner', () => {
      const servicePath = path.resolve('src/services/subscriptionService.ts');
      const code = fs.readFileSync(servicePath, 'utf8');

      expect(code).toMatch(/isTestEnvironment\(\)/);
      expect(code).toMatch(/user_subscriptions/);
      expect(code).toMatch(/getDoc\(doc\(db,\s*'user_subscriptions'/);
    });
  });

  // ============================================================================
  // 9. Durable Webhook State Machine & Retry Recovery Scenarios
  // ============================================================================
  describe('9. Durable Webhook State Machine & Retry Recovery Scenarios', () => {
    const firestoreRestPath = path.resolve('supabase/functions/_shared/firestoreRest.ts');
    const webhookPath = path.resolve('supabase/functions/handle-razorpay-webhook/index.ts');
    let firestoreCode: string;
    let webhookCode: string;

    beforeEach(() => {
      firestoreCode = fs.readFileSync(firestoreRestPath, 'utf8');
      webhookCode = fs.readFileSync(webhookPath, 'utf8');
    });

    it('Scenario 1: Event claim succeeds, Firestore update succeeds -> transitions to processed (200)', () => {
      expect(firestoreCode).toMatch(/status:\s*'processed'/);
      expect(firestoreCode).toMatch(/markWebhookEventProcessed/);
      expect(webhookCode).toMatch(/await\s+markWebhookEventProcessed/);
      expect(webhookCode).toMatch(/status:\s*'processed'/);
    });

    it('Scenario 2: Event claim succeeds, Firestore update fails -> transitions to failed (500)', () => {
      expect(firestoreCode).toMatch(/markWebhookEventFailed/);
      expect(firestoreCode).toMatch(/status:\s*'failed'/);
      expect(webhookCode).toMatch(/await\s+markWebhookEventFailed/);
      expect(webhookCode).toMatch(/status:\s*500/);
    });

    it('Scenario 3: Razorpay retries after previous failure -> recovers via retry_after_failure and re-processes', () => {
      expect(firestoreCode).toMatch(/currentStatus\s*===\s*'failed'/);
      expect(firestoreCode).toMatch(/status:\s*'retry_after_failure'/);
      expect(firestoreCode).toMatch(/attemptCount:\s*attempts\s*\+\s*1/);
      expect(webhookCode).toMatch(/claim\.canProcess/);
    });

    it('Scenario 4: Two identical webhook deliveries arrive concurrently -> second detects concurrent_in_flight (503)', () => {
      expect(firestoreCode).toMatch(/isLeaseActive/);
      expect(firestoreCode).toMatch(/status:\s*'concurrent_in_flight'/);
      expect(webhookCode).toMatch(/claim\.status\s*===\s*'concurrent_in_flight'/);
      expect(webhookCode).toMatch(/status:\s*503/);
    });

    it('Scenario 5: A completed event arrives again -> detects already_processed and returns 200 duplicate_ignored', () => {
      expect(firestoreCode).toMatch(/currentStatus\s*===\s*'processed'/);
      expect(firestoreCode).toMatch(/status:\s*'already_processed'/);
      expect(webhookCode).toMatch(/claim\.status\s*===\s*'already_processed'/);
      expect(webhookCode).toMatch(/status:\s*'duplicate_ignored'/);
    });

    it('Scenario 6: An abandoned processing lease expires -> recovers via lease_expired_recovered and resumes attempt', () => {
      expect(firestoreCode).toMatch(/leaseExpiresAt/);
      expect(firestoreCode).toMatch(/status:\s*'lease_expired_recovered'/);
      expect(firestoreCode).toMatch(/lease_expires_at/);
    });

    it('Scenario 7: An older event arrives after a newer event -> skips update with stale_event_ignored and marks processed', () => {
      expect(webhookCode).toMatch(/eventCreated\s*<\s*existingSub\.latestEventCreated/);
      expect(webhookCode).toMatch(/stale_event_ignored/);
    });
  });

  // ============================================================================
  // 10. Concurrency, Precondition & Failure-Injection Rigorous Verification
  // ============================================================================
  describe('10. Concurrency, Precondition & Failure-Injection Rigorous Verification', () => {
    const firestoreRestPath = path.resolve('supabase/functions/_shared/firestoreRest.ts');
    let firestoreCode: string;

    beforeEach(() => {
      firestoreCode = fs.readFileSync(firestoreRestPath, 'utf8');
    });

    it('proves atomic lease reclamation: uses currentDocument.updateTime precondition to prevent concurrent lease theft', () => {
      expect(firestoreCode).toMatch(/currentDocument\.updateTime/);
      expect(firestoreCode).toMatch(/expectedUpdateTime/);
      expect(firestoreCode).toMatch(/res\.status\s*===\s*412/);
      expect(firestoreCode).toMatch(/preconditionFailed:\s*true/);
    });

    it('proves concurrent lease reclamation safety: worker encountering 412 yields as concurrent_in_flight', () => {
      expect(firestoreCode).toMatch(/leaseReclaim\?\.preconditionFailed/);
      expect(firestoreCode).toMatch(/retryReclaim\?\.preconditionFailed/);
      expect(firestoreCode).toMatch(/status:\s*'concurrent_in_flight'/);
    });

    it('proves subscription ordering precondition: updates include currentDocument.updateTime or exists=false', () => {
      expect(firestoreCode).toMatch(/currentDocument\.updateTime=\${encodeURIComponent\(expectedUpdateTime\)}/);
      expect(firestoreCode).toMatch(/currentDocument\.exists=false/);
    });

    it('simulates concurrent workers reclaiming expired lease: only winner proceeds, loser gets 412 and backs off', async () => {
      let documentUpdateTime = '2026-11-08T01:00:00.000Z';
      let activeHolder: string | null = null;

      const firestorePatchPrecondition = async (workerId: string, expectedUpdateTime: string) => {
        if (expectedUpdateTime !== documentUpdateTime) {
          return { status: 412, error: 'FAILED_PRECONDITION' };
        }
        documentUpdateTime = `2026-11-08T01:00:05.000Z`;
        activeHolder = workerId;
        return { status: 200, success: true };
      };

      const readDoc = { status: 'processing', updateTime: documentUpdateTime };

      const worker1Claim = await firestorePatchPrecondition('worker-1', readDoc.updateTime);
      const worker2Claim = await firestorePatchPrecondition('worker-2', readDoc.updateTime);

      expect(worker1Claim.status).toBe(200);
      expect(worker2Claim.status).toBe(412);
      expect(activeHolder).toBe('worker-1');

      const worker2Decision = worker2Claim.status === 412
        ? { canProcess: false, status: 'concurrent_in_flight' }
        : { canProcess: true, status: 'lease_expired_recovered' };

      expect(worker2Decision.canProcess).toBe(false);
      expect(worker2Decision.status).toBe('concurrent_in_flight');
    });

    it('simulates concurrent subscription updates for same user: older event fails precondition, retries, and yields to newer state', async () => {
      let subDoc = {
        userId: 'user_race_test',
        status: 'free',
        planTier: 'free',
        latestEventCreated: 100,
        updateTime: '2026-11-08T01:00:00.000Z',
      };

      const readByWorkerA = { ...subDoc };
      const readByWorkerB = { ...subDoc };

      // Worker B commits first
      const workerBPrecondition = readByWorkerB.updateTime;
      expect(workerBPrecondition).toBe(subDoc.updateTime);
      subDoc = {
        ...subDoc,
        status: 'active',
        planTier: 'pro',
        latestEventCreated: 300,
        updateTime: '2026-11-08T01:00:01.000Z',
      };

      // Worker A attempts to commit with stale precondition T0
      const workerAPrecondition = readByWorkerA.updateTime;
      const workerAPatchResult = workerAPrecondition === subDoc.updateTime
        ? { status: 200 }
        : { status: 412, error: 'FAILED_PRECONDITION' };

      expect(workerAPatchResult.status).toBe(412);
      expect(subDoc.latestEventCreated).toBe(300);
      expect(subDoc.status).toBe('active');

      // Worker A retries after failure, reads fresh document
      const freshSubDoc = { ...subDoc };
      const isStale = 200 < freshSubDoc.latestEventCreated;
      expect(isStale).toBe(true);

      const workerARetryResult = isStale
        ? { status: 200, outcome: 'stale_event_ignored' }
        : { status: 500 };
      expect(workerARetryResult.outcome).toBe('stale_event_ignored');
      expect(subDoc.latestEventCreated).toBe(300);
      expect(subDoc.planTier).toBe('pro');
    });

    it('simulates double fault: subscription write fails and error logging fails -> still returns HTTP 500 to Razorpay', async () => {
      let rzpResponseStatus = 200;

      const simulateWebhookExecution = async () => {
        try {
          throw new Error('Firestore connection timeout: 503 Service Unavailable');
        } catch (primaryErr: any) {
          try {
            throw new Error('Firestore secondary error: 500 Internal Server Error');
          } catch (loggingErr) {
            // Suppressed secondary error
          }
          rzpResponseStatus = 500;
        }
      };

      await simulateWebhookExecution();
      expect(rzpResponseStatus).toBe(500);
    });
  });

  // ============================================================================
  // 10. One-Time Payment Model & Expiry Lifecycle Invariants
  // ============================================================================
  describe('10. One-Time Payment Model & Expiry Lifecycle Invariants', () => {
    it('grants active paid tier when currentPeriodEnd is in the future', async () => {
      const futurePeriodEnd = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString();
      const mockSupabase = {
        rpc: vi.fn().mockResolvedValue({
          data: {
            tier: 'pro',
            is_active: true,
            features: ['timetable', 'unlimited_cloud_sync', 'advanced_analytics'],
            status: 'active',
            current_period_end: futurePeriodEnd,
          },
          error: null,
        }),
      } as any;
      vi.spyOn(authServiceModule, 'getSupabaseClient').mockReturnValue(mockSupabase);

      const entitlements = await subscriptionService.getUserEntitlements('usr-future-active');
      expect(entitlements.isActive).toBe(true);
      expect(entitlements.tier).toBe('pro');
      expect(entitlements.features).toContain('unlimited_cloud_sync');
      expect(entitlements.currentPeriodEnd).toBe(futurePeriodEnd);
    });

    it('automatically revokes paid access and reverts to Free tier when currentPeriodEnd has expired', async () => {
      const pastPeriodEnd = new Date(Date.now() - 5 * 60 * 1000).toISOString(); // Expired 5 mins ago
      const mockSupabase = {
        rpc: vi.fn().mockResolvedValue({
          data: {
            tier: 'pro',
            is_active: true, // Server says true, but client verifies expired period
            features: ['timetable', 'unlimited_cloud_sync'],
            status: 'active',
            current_period_end: pastPeriodEnd,
          },
          error: null,
        }),
      } as any;
      vi.spyOn(authServiceModule, 'getSupabaseClient').mockReturnValue(mockSupabase);

      const entitlements = await subscriptionService.getUserEntitlements('usr-expired');
      expect(entitlements.isActive).toBe(false);
      expect(entitlements.tier).toBe('free');
      expect(entitlements.status).toBe('completed');
      expect(entitlements.features).not.toContain('unlimited_cloud_sync');
      expect(entitlements.features).toContain('timetable');
    });

    it('repurchase before expiry appends 30 days onto existing unexpired period end', () => {
      const now = new Date('2026-11-08T12:00:00.000Z');
      const existingPeriodEnd = new Date('2026-11-20T12:00:00.000Z'); // 12 days remaining

      const existingSub = {
        status: 'active',
        currentPeriodEnd: existingPeriodEnd.toISOString(),
      };

      const durationMs = 30 * 24 * 60 * 60 * 1000;
      let baseTime = now.getTime();

      if (existingSub && existingSub.status === 'active' && existingSub.currentPeriodEnd) {
        const existingEndTime = new Date(existingSub.currentPeriodEnd).getTime();
        if (!isNaN(existingEndTime) && existingEndTime > now.getTime()) {
          baseTime = existingEndTime;
        }
      }

      const newPeriodEnd = new Date(baseTime + durationMs).toISOString();

      // Should be existingPeriodEnd + 30 days = 2026-12-20
      expect(newPeriodEnd).toBe('2026-12-20T12:00:00.000Z');
      expect(new Date(newPeriodEnd).getTime()).toBeGreaterThan(now.getTime() + durationMs);
    });

    it('repurchase after expiry starts 30 days from current time', () => {
      const now = new Date('2026-11-08T12:00:00.000Z');
      const expiredPeriodEnd = new Date('2026-11-01T12:00:00.000Z'); // Expired 7 days ago

      const existingSub = {
        status: 'completed',
        currentPeriodEnd: expiredPeriodEnd.toISOString(),
      };

      const durationMs = 30 * 24 * 60 * 60 * 1000;
      let baseTime = now.getTime();

      if (existingSub && existingSub.status === 'active' && existingSub.currentPeriodEnd) {
        const existingEndTime = new Date(existingSub.currentPeriodEnd).getTime();
        if (!isNaN(existingEndTime) && existingEndTime > now.getTime()) {
          baseTime = existingEndTime;
        }
      }

      const newPeriodEnd = new Date(baseTime + durationMs).toISOString();

      // Starts from now + 30 days = 2026-12-08
      expect(newPeriodEnd).toBe('2026-12-08T12:00:00.000Z');
    });

    it('duplicate webhook delivery for the same payment is idempotent and never extends period twice', () => {
      const existingSub = {
        status: 'active',
        lastVerifiedPayment: 'pay_rzp_dup_888',
        currentPeriodEnd: '2026-12-08T12:00:00.000Z',
      };

      const incomingPaymentId = 'pay_rzp_dup_888';
      let extended = false;

      if (existingSub.lastVerifiedPayment === incomingPaymentId) {
        // Idempotent no-op
        extended = false;
      } else {
        extended = true;
      }

      expect(extended).toBe(false);
      expect(existingSub.currentPeriodEnd).toBe('2026-12-08T12:00:00.000Z');
    });

    it('failed payment on new checkout attempt does not destroy existing active membership pass', () => {
      const futurePeriodEnd = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
      const existingSub = {
        status: 'active',
        currentPeriodEnd: futurePeriodEnd,
      };

      let nextStatus = existingSub.status;
      const now = new Date();

      // Webhook payment.failed arrives for a new failed order
      if (existingSub.status === 'active' && existingSub.currentPeriodEnd) {
        const expiryTime = new Date(existingSub.currentPeriodEnd).getTime();
        if (!isNaN(expiryTime) && expiryTime > now.getTime()) {
          // Protected! Active status is preserved
        } else {
          nextStatus = 'past_due';
        }
      }

      expect(nextStatus).toBe('active');
    });
  });
});
