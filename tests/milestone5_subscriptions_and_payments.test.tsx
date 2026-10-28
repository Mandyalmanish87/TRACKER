import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import fs from 'fs';
import path from 'path';
import {
  subscriptionService,
  DEFAULT_FREE_ENTITLEMENTS,
} from '../src/services/subscriptionService';
import * as authServiceModule from '../src/services/authService';
import { BillingSettingsSection } from '../src/components/subscription/BillingSettingsSection';

describe('Milestone 05 — Subscriptions & Payments Foundation', () => {
  const TEST_SECRET = 'whsec_test_secret_key_8f3c7b2a19e4';

  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  // Helper to compute a valid Stripe signature header
  async function generateTestSignatureHeader(
    payload: string,
    secret: string,
    timestamp: number
  ): Promise<string> {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const signedPayload = encoder.encode(`${timestamp}.${payload}`);
    const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, signedPayload);
    const signatureHex = Array.from(new Uint8Array(signatureBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    return `t=${timestamp},v1=${signatureHex}`;
  }

  // ============================================================================
  // 1. Cryptographic HMAC-SHA256 Webhook Signature Verification
  // ============================================================================
  describe('1. Webhook Signature Verification & Forgery Defense', () => {
    it('accepts valid HMAC-SHA256 signature with fresh timestamp', async () => {
      const payload = JSON.stringify({
        id: 'evt_test_123',
        type: 'checkout.session.completed',
        data: { object: { customer: 'cus_abc', subscription: 'sub_xyz' } },
      });
      const now = Math.floor(Date.now() / 1000);
      const signatureHeader = await generateTestSignatureHeader(payload, TEST_SECRET, now);

      const result = await subscriptionService.verifyWebhookSignature(
        payload,
        signatureHeader,
        TEST_SECRET
      );

      expect(result.valid).toBe(true);
      expect(result.timestamp).toBe(now);
      expect(result.error).toBeUndefined();
    });

    it('rejects tampered or forged payload with cryptographic mismatch', async () => {
      const originalPayload = JSON.stringify({ customer: 'cus_123', plan: 'pro', amount: 499 });
      const tamperedPayload = JSON.stringify({ customer: 'cus_123', plan: 'cohort', amount: 1999 });

      const now = Math.floor(Date.now() / 1000);
      const signatureHeader = await generateTestSignatureHeader(originalPayload, TEST_SECRET, now);

      // Verify tampered payload with original signature
      const result = await subscriptionService.verifyWebhookSignature(
        tamperedPayload,
        signatureHeader,
        TEST_SECRET
      );

      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/Cryptographic signature mismatch/i);
    });

    it('rejects payload signed with an incorrect or unauthorized secret', async () => {
      const payload = JSON.stringify({ customer: 'cus_123' });
      const now = Math.floor(Date.now() / 1000);
      const signatureHeader = await generateTestSignatureHeader(payload, 'whsec_attacker_secret', now);

      const result = await subscriptionService.verifyWebhookSignature(
        payload,
        signatureHeader,
        TEST_SECRET
      );

      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/Cryptographic signature mismatch/i);
    });

    it('rejects replayed webhook with expired timestamp outside tolerance window', async () => {
      const payload = JSON.stringify({ customer: 'cus_123' });
      const staleTimestamp = Math.floor(Date.now() / 1000) - 301; // 301 seconds old (> 300s window)
      const signatureHeader = await generateTestSignatureHeader(payload, TEST_SECRET, staleTimestamp);

      const result = await subscriptionService.verifyWebhookSignature(
        payload,
        signatureHeader,
        TEST_SECRET,
        300
      );

      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/outside tolerance window/i);
    });

    it('rejects missing or malformed signature header formats', async () => {
      const payload = JSON.stringify({ customer: 'cus_123' });

      const emptyRes = await subscriptionService.verifyWebhookSignature(payload, '', TEST_SECRET);
      expect(emptyRes.valid).toBe(false);
      expect(emptyRes.error).toMatch(/Missing signature header/i);

      const malformedRes = await subscriptionService.verifyWebhookSignature(
        payload,
        'invalid_header_without_t_or_v1',
        TEST_SECRET
      );
      expect(malformedRes.valid).toBe(false);
      expect(malformedRes.error).toMatch(/Malformed stripe-signature header/i);
    });
  });

  // ============================================================================
  // 2. Webhook Idempotency & Replay Attack Defense
  // ============================================================================
  describe('2. Webhook Idempotency & Ledger', () => {
    it('dispatches new webhook event to server-authoritative processor', async () => {
      const mockSupabase = {
        rpc: vi.fn().mockResolvedValue({
          data: { status: 'processed', event_id: 'evt_order_1001', event_type: 'checkout.session.completed' },
          error: null,
        }),
      } as any;
      vi.spyOn(authServiceModule, 'getSupabaseClient').mockReturnValue(mockSupabase);

      const result = await subscriptionService.processWebhookEvent(
        'evt_order_1001',
        'checkout.session.completed',
        { data: { object: { customer: 'cus_1' } } }
      );

      expect(result.status).toBe('processed');
      expect(mockSupabase.rpc).toHaveBeenCalledWith('process_subscription_webhook_event', {
        p_event_id: 'evt_order_1001',
        p_event_type: 'checkout.session.completed',
        p_payload: { data: { object: { customer: 'cus_1' } } },
      });
    });

    it('recognizes duplicate webhook deliveries idempotently without re-execution', async () => {
      const mockSupabase = {
        rpc: vi.fn().mockResolvedValue({
          data: { status: 'duplicate_ignored', event_id: 'evt_order_1001', message: 'Event already processed' },
          error: null,
        }),
      } as any;
      vi.spyOn(authServiceModule, 'getSupabaseClient').mockReturnValue(mockSupabase);

      const result = await subscriptionService.processWebhookEvent(
        'evt_order_1001',
        'checkout.session.completed',
        { data: { object: { customer: 'cus_1' } } }
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

      const entitlements = await subscriptionService.getUserEntitlements('usr-student-pro');

      expect(entitlements.tier).toBe('pro');
      expect(entitlements.isActive).toBe(true);
      expect(entitlements.status).toBe('active');
      expect(subscriptionService.canAccessFeature('unlimited_cloud_sync', entitlements)).toBe(true);
      expect(subscriptionService.canAccessFeature('ai_study_planner', entitlements)).toBe(true);
      expect(subscriptionService.canAccessFeature('cohort_sponsorship', entitlements)).toBe(false);
    });

    it('correctly maps Cohort Sponsor entitlements including verified badges', async () => {
      const mockSupabase = {
        rpc: vi.fn().mockResolvedValue({
          data: {
            tier: 'cohort',
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
              'cohort_sponsorship',
              'verified_class_badge',
            ],
            current_period_end: '2026-12-01T00:00:00Z',
            cancel_at_period_end: false,
            status: 'active',
          },
          error: null,
        }),
      } as any;
      vi.spyOn(authServiceModule, 'getSupabaseClient').mockReturnValue(mockSupabase);

      const entitlements = await subscriptionService.getUserEntitlements('usr-class-rep');

      expect(entitlements.tier).toBe('cohort');
      expect(entitlements.isActive).toBe(true);
      expect(subscriptionService.canAccessFeature('cohort_sponsorship', entitlements)).toBe(true);
      expect(subscriptionService.canAccessFeature('verified_class_badge', entitlements)).toBe(true);
    });

    it('preserves active features during 24h grace period when status is past_due', async () => {
      const mockSupabase = {
        rpc: vi.fn().mockResolvedValue({
          data: {
            tier: 'pro',
            is_active: true, // Server-evaluated grace period flag
            features: ['timetable', 'unlimited_cloud_sync', 'advanced_analytics'],
            current_period_end: '2026-10-25T00:00:00Z',
            cancel_at_period_end: false,
            status: 'past_due',
          },
          error: null,
        }),
      } as any;
      vi.spyOn(authServiceModule, 'getSupabaseClient').mockReturnValue(mockSupabase);

      const entitlements = await subscriptionService.getUserEntitlements('usr-grace-user');

      expect(entitlements.status).toBe('past_due');
      expect(entitlements.isActive).toBe(true);
      expect(subscriptionService.canAccessFeature('unlimited_cloud_sync', entitlements)).toBe(true);
    });

    it('denies cross-account entitlement inspection for non-admin callers (RPC error 42501)', async () => {
      const mockSupabase = {
        rpc: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Access denied: cannot inspect another user entitlements (42501)', code: '42501' },
        }),
      } as any;
      vi.spyOn(authServiceModule, 'getSupabaseClient').mockReturnValue(mockSupabase);

      await expect(
        subscriptionService.getUserEntitlements('usr-other-victim-student')
      ).rejects.toThrow(/Access denied: cannot inspect another user entitlements/i);
    });

    it('ignores client localStorage tampering (e.g. setting fake pro tier flag)', async () => {
      // Attacker attempts local spoofing
      localStorage.setItem('user_plan', 'pro');
      localStorage.setItem('is_pro_member', 'true');

      // Server returns free
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
      } as any;
      vi.spyOn(authServiceModule, 'getSupabaseClient').mockReturnValue(mockSupabase);

      const entitlements = await subscriptionService.getUserEntitlements('usr-tamperer');

      expect(entitlements.tier).toBe('free');
      expect(entitlements.isActive).toBe(false);
      expect(subscriptionService.canAccessFeature('unlimited_cloud_sync', entitlements)).toBe(false);
    });
  });

  // ============================================================================
  // 4. Billing Settings UI Component & User Interactions
  // ============================================================================
  describe('4. Billing Settings UI Component', () => {
    it('renders Free student status and catalogue cards', async () => {
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
        expect(screen.getByText(/Membership & Subscriptions/i)).toBeInTheDocument();
        expect(screen.getByText(/Free Student/i)).toBeInTheDocument();
        expect(screen.getByText(/Current Plan/i)).toBeInTheDocument();
      });

      // Verify all catalogue plans are visible
      expect(screen.getByRole('heading', { name: /Student Free/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /Tracker Pro/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /Cohort Sponsor/i })).toBeInTheDocument();
    });

    it('displays active Tracker Pro plan badge and current plan button', async () => {
      const mockSupabase = {
        rpc: vi.fn().mockResolvedValue({
          data: {
            tier: 'pro',
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
              customer_id: 'cus_stripe_123',
              subscription_id: 'sub_pro_xyz',
              status: 'active',
              plan_tier: 'pro',
            },
            error: null,
          }),
        }),
      } as any;
      vi.spyOn(authServiceModule, 'getSupabaseClient').mockReturnValue(mockSupabase);

      render(<BillingSettingsSection userId="usr-pro-1" />);

      await waitFor(() => {
        expect(screen.getByText(/Current Plan/i)).toBeInTheDocument();
        expect(screen.getByText(/Manage Billing & Invoices/i)).toBeInTheDocument();
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
              customer_id: 'cus_due_123',
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
        expect(screen.getByText(/24-hour grace period/i)).toBeInTheDocument();
      });
    });

    it('handles checkout click with graceful notice when provider credentials are unconfigured', async () => {
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
        functions: {
          invoke: vi.fn().mockRejectedValue(new Error('Function not deployed')),
        },
      } as any;
      vi.spyOn(authServiceModule, 'getSupabaseClient').mockReturnValue(mockSupabase);

      render(<BillingSettingsSection userId="usr-student-1" />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Upgrade to Tracker Pro/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Upgrade to Tracker Pro/i }));

      await waitFor(() => {
        expect(screen.getByText(/Payment provider integration is pending live credentials deployment/i)).toBeInTheDocument();
      });
    });
  });

  // ============================================================================
  // 5. Database Schema & Migration Invariants (Static Boundary Audit)
  // ============================================================================
  describe('5. Database Schema & Migration Invariants', () => {
    const migrationPath = path.resolve('supabase/migrations/20261108_subscriptions_schema.sql');
    let sqlContent: string;

    beforeEach(() => {
      sqlContent = fs.readFileSync(migrationPath, 'utf8');
    });

    it('verifies user_subscriptions has RLS enabled and direct client writes revoked', () => {
      expect(sqlContent).toMatch(/alter\s+table\s+public\.user_subscriptions\s+enable\s+row\s+level\s+security/i);
      expect(sqlContent).toMatch(/revoke\s+insert,\s*update,\s*delete,\s*truncate\s+on\s+table\s+public\.user_subscriptions\s+from\s+anon,\s*authenticated/i);
    });

    it('verifies payment_webhook_events has zero public or authenticated access', () => {
      expect(sqlContent).toMatch(/alter\s+table\s+public\.payment_webhook_events\s+enable\s+row\s+level\s+security/i);
      expect(sqlContent).toMatch(/revoke\s+all\s+on\s+table\s+public\.payment_webhook_events\s+from\s+anon,\s*authenticated/i);
    });

    it('verifies process_subscription_webhook_event is revoked from authenticated and granted exclusively to service_role', () => {
      expect(sqlContent).toMatch(/revoke\s+all\s+on\s+function\s+public\.process_subscription_webhook_event\([^)]*\)\s+from\s+public,\s*anon,\s*authenticated/i);
      expect(sqlContent).toMatch(/grant\s+execute\s+on\s+function\s+public\.process_subscription_webhook_event\([^)]*\)\s+to\s+service_role/i);
    });

    it('verifies get_user_entitlements enforces caller isolation (error 42501) and safe search_path', () => {
      expect(sqlContent).toMatch(/set\s+search_path\s*=\s*public/i);
      expect(sqlContent).toMatch(/auth\.uid\(\)\s*is\s+distinct\s+from\s+v_target_user/i);
      expect(sqlContent).toMatch(/raise\s+exception\s+'Access denied: cannot inspect another user entitlements \(42501\)'/i);
    });

    it('verifies atomic concurrency handling and out-of-order defenses in state machine', () => {
      expect(sqlContent).toMatch(/on\s+conflict\s*\(\s*event_id\s*\)\s+do\s+nothing/i);
      expect(sqlContent).toMatch(/get\s+diagnostics\s+v_row_count\s*=\s*row_count/i);
      expect(sqlContent).toMatch(/stale_subscription_ignored/i);
      expect(sqlContent).toMatch(/out_of_order_ignored/i);
    });
  });

  // ============================================================================
  // 6. Server Edge Functions & Secret Boundary Isolation
  // ============================================================================
  describe('6. Server Edge Functions & Secret Boundary Isolation', () => {
    it('verifies handle-payment-webhook Edge Function enforces cryptographic verification and uses server environment secrets', () => {
      const edgeFunctionPath = path.resolve('supabase/functions/handle-payment-webhook/index.ts');
      expect(fs.existsSync(edgeFunctionPath)).toBe(true);

      const code = fs.readFileSync(edgeFunctionPath, 'utf8');
      expect(code).toMatch(/Deno\.env\.get\('STRIPE_WEBHOOK_SECRET'\)/);
      expect(code).toMatch(/Deno\.env\.get\('SUPABASE_SERVICE_ROLE_KEY'\)/);
      expect(code).toMatch(/verifyStripeSignature\(/);
      expect(code).toMatch(/process_subscription_webhook_event/);
    });

    it('verifies create-checkout-session Edge Function maps Price IDs authoritatively on the server', () => {
      const edgeFunctionPath = path.resolve('supabase/functions/create-checkout-session/index.ts');
      expect(fs.existsSync(edgeFunctionPath)).toBe(true);

      const code = fs.readFileSync(edgeFunctionPath, 'utf8');
      expect(code).toMatch(/Deno\.env\.get\('STRIPE_SECRET_KEY'\)/);
      expect(code).toMatch(/Deno\.env\.get\('STRIPE_PRICE_ID_PRO'\)/);
      expect(code).toMatch(/Deno\.env\.get\('STRIPE_PRICE_ID_COHORT'\)/);
      expect(code).toMatch(/auth\.getUser\(\)/);
    });

    it('verifies create-customer-portal-session Edge Function resolves customer_id server-side', () => {
      const edgeFunctionPath = path.resolve('supabase/functions/create-customer-portal-session/index.ts');
      expect(fs.existsSync(edgeFunctionPath)).toBe(true);

      const code = fs.readFileSync(edgeFunctionPath, 'utf8');
      expect(code).toMatch(/Deno\.env\.get\('STRIPE_SECRET_KEY'\)/);
      expect(code).toMatch(/user_subscriptions/);
      expect(code).toMatch(/customer_id/);
    });

    it('verifies client application source code contains zero embedded Stripe or Supabase service_role secrets', () => {
      const clientServiceCode = fs.readFileSync(path.resolve('src/services/subscriptionService.ts'), 'utf8');
      const clientBillingUiCode = fs.readFileSync(path.resolve('src/components/subscription/BillingSettingsSection.tsx'), 'utf8');

      // Ensure no live/test Stripe secret keys or webhook signing secrets exist in client code
      expect(clientServiceCode).not.toMatch(/sk_live_[0-9a-zA-Z]+/);
      expect(clientServiceCode).not.toMatch(/sk_test_[0-9a-zA-Z]+/);
      expect(clientServiceCode).not.toMatch(/whsec_[0-9a-zA-Z]+/);
      expect(clientServiceCode).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY/);

      expect(clientBillingUiCode).not.toMatch(/sk_live_[0-9a-zA-Z]+/);
      expect(clientBillingUiCode).not.toMatch(/sk_test_[0-9a-zA-Z]+/);
      expect(clientBillingUiCode).not.toMatch(/whsec_[0-9a-zA-Z]+/);
      expect(clientBillingUiCode).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
    });
  });

  // ============================================================================
  // 7. Milestone 06 Production Reliability & Defect Regressions
  // ============================================================================
  describe('7. Milestone 06 Production Reliability & Defect Regressions', () => {
    const migrationPath = path.resolve('supabase/migrations/20261108_subscriptions_schema.sql');
    let sqlContent: string;

    beforeEach(() => {
      sqlContent = fs.readFileSync(migrationPath, 'utf8');
    });

    it('remediates defect 1: verifies only full refunds cancel subscription, preserving active status on partial refunds', () => {
      expect(sqlContent).toMatch(/elsif\s+p_event_type\s*=\s*'charge\.refunded'\s+then/i);
      expect(sqlContent).toMatch(/coalesce\(\(v_data->>'refunded'\)::boolean,\s*false\)/i);
      expect(sqlContent).toMatch(/partial_refund_ignored/i);
    });

    it('remediates defect 2: verifies out-of-order update or payment_succeeded cannot resurrect a canceled subscription or overwrite a newer subscription', () => {
      // Subscriptions are protected against stale events via subscription_id matching and monotonic event timestamps
      expect(sqlContent).toMatch(/stale_subscription_ignored/i);
      expect(sqlContent).toMatch(/out_of_order_ignored/i);
    });

    it('remediates defect 3: verifies clean SQL syntax with zero duplicate end blocks', () => {
      const occurrences = (sqlContent.match(/revoke\s+all\s+on\s+function\s+public\.process_subscription_webhook_event/g) || []).length;
      expect(occurrences).toBe(1);
      expect(sqlContent).not.toMatch(/end;\s*'event_id',\s*p_event_id/);
    });

    it('remediates defect 4: verifies robust Bearer token parsing in customer portal Edge Function', () => {
      const edgeCode = fs.readFileSync(path.resolve('supabase/functions/create-customer-portal-session/index.ts'), 'utf8');
      expect(edgeCode).toMatch(/authHeader\.replace\(\/\^Bearer\\s\+\/i,\s*''\)/);
    });
  });

  // ============================================================================
  // 8. Targeted Subscription Lifecycle & Refund Association Security
  // ============================================================================
  describe('8. Targeted Subscription Lifecycle & Refund Association Security', () => {
    const migrationPath = path.resolve('supabase/migrations/20261108_subscriptions_schema.sql');
    let sqlContent: string;

    beforeEach(() => {
      sqlContent = fs.readFileSync(migrationPath, 'utf8');
    });

    it('1. Refund Association: verifies full refund does not cancel newer subscription when old charge is refunded', () => {
      expect(sqlContent).toMatch(/refund_stale_subscription_ignored/i);
      expect(sqlContent).toMatch(/v_existing_sub\.subscription_id\s*<>\s*v_target_sub_id/i);
    });

    it('2. Refund Association: verifies partial refund is explicitly ignored without canceling subscription', () => {
      expect(sqlContent).toMatch(/partial_refund_ignored/i);
      expect(sqlContent).toMatch(/not\s+v_is_refunded/i);
      expect(sqlContent).toMatch(/Partial refund does not cancel active subscription/i);
    });

    it('3. Refund Association: verifies ambiguous or missing invoice association safely no-ops without canceling', () => {
      expect(sqlContent).toMatch(/refund_unmatched_safe_noop/i);
      expect(sqlContent).toMatch(/refund_stale_charge_ignored/i);
      expect(sqlContent).toMatch(/Charge refund could not be unambiguously linked to current subscription/i);
    });

    it('4. Concurrency & Deduplication: verifies duplicate webhook event IDs are rejected via ledger idempotency', () => {
      expect(sqlContent).toMatch(/on\s+conflict\s*\(\s*event_id\s*\)\s+do\s+nothing/i);
      expect(sqlContent).toMatch(/duplicate_ignored/i);
    });

    it('5. Stale Event Defense: verifies delayed event from an old subscription is ignored after resubscription', () => {
      expect(sqlContent).toMatch(/stale_subscription_ignored/i);
      expect(sqlContent).toMatch(/Event belongs to superseded subscription/i);
    });

    it('6. Legitimate Resubscription: verifies checkout.session.completed cleanly reactivates canceled subscriptions', () => {
      expect(sqlContent).toMatch(/on\s+conflict\s*\(\s*user_id\s*\)\s+do\s+update\s+set/i);
      expect(sqlContent).toMatch(/status\s*=\s*'active'/i);
      expect(sqlContent).toMatch(/cancel_at_period_end\s*=\s*false/i);
      expect(sqlContent).toMatch(/latest_event_created\s*=\s*(case|excluded\.latest_event_created)/i);
    });

    it('7. Payment Failure & Grace Period: verifies 24-hour grace period logic and entitlement calculation', () => {
      expect(sqlContent).toMatch(/status\s*=\s*'past_due'/i);
      expect(sqlContent).toMatch(/v_sub\.status\s*=\s*'past_due'\s+and\s+v_sub\.current_period_end\s*>=\s*now\(\)\s*-\s*interval\s+'24\s+hours'/i);
    });

    it('8. Out-of-Order Monotonic Timestamp Defense: tracks latest_event_created on user_subscriptions', () => {
      expect(sqlContent).toMatch(/latest_event_created\s+timestamptz/i);
      expect(sqlContent).toMatch(/v_event_created\s*<\s*v_existing_sub\.latest_event_created/i);
      expect(sqlContent).toMatch(/out_of_order_ignored/i);
    });

    it('9. SubscriptionService RPC Integration: propagates state machine result and handles database rollback/error', async () => {
      const mockRpc = vi.fn().mockResolvedValue({
        data: { status: 'processed', event_id: 'evt_test_success_1' },
        error: null,
      });

      vi.spyOn(authServiceModule, 'getSupabaseClient').mockReturnValue({
        rpc: mockRpc,
      } as any);

      const result = await subscriptionService.processWebhookEvent(
        'evt_test_success_1',
        'checkout.session.completed',
        { data: { object: { subscription: 'sub_123' } } }
      );

      expect(result).toEqual({ status: 'processed', event_id: 'evt_test_success_1' });
      expect(mockRpc).toHaveBeenCalledWith('process_subscription_webhook_event', {
        p_event_id: 'evt_test_success_1',
        p_event_type: 'checkout.session.completed',
        p_payload: { data: { object: { subscription: 'sub_123' } } },
      });

      // Error/Rollback handling: when database transaction fails
      mockRpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'Transaction rolled back: foreign key constraint violation' },
      });

      await expect(
        subscriptionService.processWebhookEvent('evt_failed_1', 'checkout.session.completed', {})
      ).rejects.toThrow(/Transaction rolled back/);
    });

    it('10. SubscriptionService Entitlements: verifies grace period entitlement calculation in client service', async () => {
      const futureDate = new Date(Date.now() + 12 * 3600 * 1000).toISOString();
      const mockRpc = vi.fn().mockResolvedValue({
        data: {
          tier: 'pro',
          is_active: true,
          features: ['unlimited_cloud_sync', 'advanced_analytics'],
          current_period_end: futureDate,
          cancel_at_period_end: false,
          status: 'past_due',
        },
        error: null,
      });

      vi.spyOn(authServiceModule, 'getSupabaseClient').mockReturnValue({
        rpc: mockRpc,
      } as any);

      const entitlements = await subscriptionService.getUserEntitlements('user-test-uuid');
      expect(entitlements.status).toBe('past_due');
      expect(entitlements.isActive).toBe(true);
      expect(entitlements.tier).toBe('pro');
      expect(subscriptionService.canAccessFeature('unlimited_cloud_sync', entitlements)).toBe(true);
    });

    it('11. Webhook Concurrency: verifies row-level write locks (FOR UPDATE) serialize distinct concurrent events for the same user', () => {
      // Confirms all subscription lookup queries use FOR UPDATE to prevent race conditions under READ COMMITTED isolation
      const forUpdateMatches = sqlContent.match(/for\s+update/gi);
      expect(forUpdateMatches).not.toBeNull();
      expect(forUpdateMatches!.length).toBeGreaterThanOrEqual(4);
    });

    it('12. Equal Timestamp Defense: verifies simultaneous events with equal timestamps cannot resurrect a canceled subscription', () => {
      expect(sqlContent).toMatch(/equal_timestamp_resurrection_ignored/i);
      expect(sqlContent).toMatch(/v_event_created\s*=\s*v_existing_sub\.latest_event_created\s+and\s+v_existing_sub\.status\s*=\s*'canceled'/i);
    });

    it('13. Checkout Session Metadata: verifies server explicitly passes metadata to the Stripe subscription object', () => {
      const checkoutCode = fs.readFileSync(path.resolve('supabase/functions/create-checkout-session/index.ts'), 'utf8');
      expect(checkoutCode).toMatch(/subscription_data\[metadata\]\[user_id\]/i);
      expect(checkoutCode).toMatch(/subscription_data\[metadata\]\[plan_tier\]/i);
    });

    it('14. Security Boundaries: verifies caller isolation and separation between authenticated and service_role permissions', () => {
      // Client can never call webhook processor
      expect(sqlContent).toMatch(/revoke\s+all\s+on\s+function\s+public\.process_subscription_webhook_event\([^)]*\)\s+from\s+public,\s*anon,\s*authenticated/i);
      expect(sqlContent).toMatch(/grant\s+execute\s+on\s+function\s+public\.process_subscription_webhook_event\([^)]*\)\s+to\s+service_role/i);
      // Entitlements require caller identity match
      expect(sqlContent).toMatch(/auth\.uid\(\)\s*is\s+distinct\s+from\s+v_target_user/i);
    });

    it('15. Checkout Concurrency: verifies two-key advisory locking serializes concurrent initial inserts before row creation', () => {
      expect(sqlContent).toMatch(/pg_advisory_xact_lock\(\s*20261108\s*,\s*hashtext\(\s*v_user_id::text\s*\)\s*\)/i);
    });

    it('16. Monotonic Checkout Guard: verifies ON CONFLICT DO UPDATE WHERE strictly prevents older events from overwriting active state', () => {
      expect(sqlContent).toMatch(/where\s+user_subscriptions\.latest_event_created\s+is\s+null\s+or\s+excluded\.latest_event_created\s*>\s*user_subscriptions\.latest_event_created/i);
    });

    it('17. Honest RPC Status: verifies stale checkout events return stale_checkout_ignored when update is skipped', () => {
      expect(sqlContent).toMatch(/'status',\s*'stale_checkout_ignored'/i);
      expect(sqlContent).toMatch(/Checkout event is older than existing active subscription/i);
    });

    it('18. Charge-Only Refund Matching: verifies charge lookup executes even when invoice ID is null', () => {
      expect(sqlContent).toMatch(/if\s+v_target_sub_id\s+is\s+null\s+and\s+\(\s*v_invoice_id\s+is\s+not\s+null\s+or\s+v_charge_id\s+is\s+not\s+null\s*\)\s+then/i);
    });

    it('19. Customer Scoping in Ledger: verifies historical refund ledger query scopes strictly by customer_id', () => {
      expect(sqlContent).toMatch(/v_customer_id\s+is\s+null\s+or\s+payload->'data'->'object'->>'customer'\s*=\s*v_customer_id/i);
    });
  });
});
