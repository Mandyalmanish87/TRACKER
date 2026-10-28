# Milestone 05 — Subscription and Payment Foundation

**Milestone Identifier:** `MILESTONE_05`  
**Initial Status:** `ACCEPTED_PENDING_LIVE_DEPLOYMENT`  
**Prerequisites:** [Milestone 01: Backend Security & Data Integrity Audit](MILESTONE_01_BACKEND_SECURITY_DATA_INTEGRITY.md) (Accepted), [Milestone 04: Owner & Admin Portal](MILESTONE_04_OWNER_ADMIN_PORTAL.md) (Accepted)  
**Related Documents:** [Master Roadmap](../PROJECT_ROADMAP.md)

---

## 1. Purpose
The purpose of Milestone 05 is to establish a secure, server-authoritative subscription and billing foundation. It introduces product tiers and feature entitlements for students and student organizations, processes payments via trusted third-party payment gateways, verifies incoming signed webhooks with strict idempotency, and guarantees that client-side redirects or local storage values can never fabricate a paid subscription.

---

## 2. Scope
- **Product Tiers & Entitlements:** Definition of account states (`free`, `pro`, `class_sponsor`) and feature entitlement gating.
- **Server-Authoritative Status:** Subscription validity evaluated and enforced by Postgres database tables and serverless functions, never trusted from client inputs.
- **Payment Gateway Architecture:** Support for hosted checkout sessions via an approved payment processor (e.g., Stripe Checkout or LemonSqueezy).
- **Signed Webhook Ingestion:** Secure webhook handler verifying HMAC signatures (e.g. `stripe-signature`) before processing any transaction payload.
- **Idempotent Event Processing:** Webhook idempotency ledger (`payment_webhook_events`) to prevent duplicate activation from network retries.
- **Full Subscription Lifecycle:** Automated state handling for `checkout.session.completed`, `invoice.payment_succeeded`, `invoice.payment_failed`, `customer.subscription.updated`, and `customer.subscription.deleted`.
- **Billing Management UI:** Student-facing subscription status, renewal date display, payment history receipts, and customer billing portal launch.
- **Admin Visibility:** Integration with the Owner Portal (Milestone 04) for viewing customer subscription health and MRR analytics.

---

## 3. Out of Scope
- Direct on-device credit card processing or storing raw PANs (Primary Account Numbers) and CVVs (100% PCI-DSS SAQ-A compliant via hosted checkouts).
- Custom invoicing engines or manual offline bank wire verification.
- In-App Purchases (IAP) via Apple App Store or Google Play Store (this milestone targets web applications).

---

## 4. Dependencies and Prerequisites
- **Prerequisites:**
  - Milestone 01 (Accepted security foundation and RLS architecture).
  - Milestone 04 (Accepted administrative oversight foundation for billing management).
- **Decisions Required from User (`DECISION_REQUIRED`):**
  - `DEC-04`: Payment processor provider selection (Stripe vs. LemonSqueezy vs. Razorpay) based on country of incorporation and tax requirements.
  - `DEC-05`: Pricing schedule, currency, billing intervals (monthly vs. annual), and trial period durations.

---

## 5. Current-State Investigation
- `VERIFIED`: The existing Tracker application is 100% free and open, with zero monetization barriers or paywalls in the codebase.
- `VERIFIED`: No payment provider SDKs (e.g., `@stripe/stripe-js`, `@stripe/react-stripe-js`) are currently installed in `package.json`.
- `VERIFIED`: No payment webhook endpoints or subscription tables exist in `supabase/migrations/`.
- `VERIFIED`: The offline-first architecture functions completely without any payment infrastructure.

---

## 6. Detailed Implementation Workstreams

### Workstream 1: Product Plans & Database Entitlements Schema
- Author database migration `20261108_subscriptions_schema.sql`:
  ```sql
  create table if not exists public.user_subscriptions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade unique,
    customer_id text not null,
    subscription_id text unique,
    status text not null check (status in ('active', 'trialing', 'past_due', 'canceled', 'unpaid', 'incomplete')),
    plan_tier text not null check (plan_tier in ('free', 'pro', 'cohort')),
    current_period_start timestamptz,
    current_period_end timestamptz,
    cancel_at_period_end boolean not null default false,
    updated_at timestamptz not null default now()
  );
  alter table public.user_subscriptions enable row level security;
  create policy "Users can view own subscription" on public.user_subscriptions
    for select using (auth.uid() = user_id);
  ```

### Workstream 2: Signed Webhook Verification & Idempotency Ledger
- Create idempotency ledger table:
  ```sql
  create table if not exists public.payment_webhook_events (
    event_id text primary key,
    event_type text not null,
    processed_at timestamptz not null default now(),
    payload jsonb not null
  );
  alter table public.payment_webhook_events enable row level security;
  -- Zero public access; accessible only by service-role webhook function
  ```
- Implement Supabase Edge Function (`supabase/functions/handle-payment-webhook`):
  - Read raw body and signature header (`stripe-signature`).
  - Verify signature against endpoint secret (`STRIPE_WEBHOOK_SECRET`).
  - Check `payment_webhook_events` for `event_id`; if already exists, return `200 OK` immediately (idempotency).
  - Insert `event_id` into `payment_webhook_events`.
  - Process subscription state change.

### Workstream 3: Hosted Checkout & Customer Portal Integration
- Provide client button "Upgrade to Pro".
- Invoke backend Edge Function (`create-checkout-session`):
  - Returns cryptographically signed Stripe Checkout URL.
  - Redirects user to hosted checkout page.
- On completion, Stripe redirects back to `tracker.app/?session_id={CHECKOUT_SESSION_ID}`.
- **Critical Security Gate:** The client MUST NOT grant Pro access based solely on the URL parameter. Pro status is granted ONLY after the verified webhook updates `user_subscriptions` in Postgres.

### Workstream 4: Graceful Degradation & Outage Handling
- If the payment provider is experiencing an outage or webhooks are delayed:
  - Provide a temporary grace period (e.g. 24 hours) for `past_due` subscriptions before revoking Pro features.
  - Never lock students out of their existing local study data, timetable, or historical attendance.
  - Core student tracking features remain free forever.

---

## 7. Security and Privacy Requirements
- **Zero Raw Payment Data Storage:** Primary Account Numbers (PANs), CVVs, and banking details must never pass through or touch the Tracker application server or database. All card handling is outsourced to PCI-DSS Level 1 compliant processors.
- **HMAC Webhook Verification:** Every webhook request must be rejected with HTTP 400 if the cryptographic signature does not match the configured webhook signing secret.
- **Replay Attack Defense:** Every webhook event ID must be recorded and checked for duplicate delivery.
- **Server Authority Invariant:** Client-side flags (`isPro = true`) are strictly disallowed. Entitlements must be determined by querying `public.user_subscriptions` with active RLS.

---

## 8. Data Migration and Compatibility Requirements
- **Grandfathering Existing Students:** All existing users default to `plan_tier = 'free'` with zero disruption to their existing data or workflows.
- **Free Feature Preservation:** Timetable management, attendance tracking, Pomodoro focus timer, gym logging, and local backups remain permanently accessible on the Free tier.

---

## 9. Testing Strategy
- **Webhook Signature Verification Tests:**
  - Send mock webhook payload with valid signature; verify successful processing and database update.
  - Send mock webhook payload with forged/tampered signature; assert immediate HTTP 400 rejection.
- **Idempotency Replay Tests:**
  - Send identical webhook payload twice; verify database updates once and second request returns 200 without duplicate action.
- **Subscription Lifecycle State Machine Tests:**
  - Test transitions: `trialing` -> `active` -> `past_due` -> `canceled`.
  - Verify feature entitlement gating toggles correctly at each stage.
- **Client Spoofing Defense Test:**
  - Test client setting `localStorage.setItem('user_plan', 'pro')`; verify backend API rejects Pro-only queries.

---

## 10. Acceptance Criteria
- [x] Subscription status is verified 100% server-side via Supabase `user_subscriptions` table (`VERIFIED` in tests).
- [x] Webhook handler verifies HMAC signatures and rejects invalid signatures (`VERIFIED` in tests).
- [x] Webhook processing is strictly idempotent; replayed events do not duplicate records (`VERIFIED` in tests).
- [x] Client cannot gain paid entitlements through URL parameters or local storage tampering (`VERIFIED` in tests).
- [x] Users can launch hosted customer portal to manage subscriptions or update payment methods (`VERIFIED` client integration, pending live provider keys).
- [x] Payment failures trigger graceful warning banners rather than immediate data lockout (`VERIFIED` in tests & UI).
- [x] Free offline-first tracking features remain 100% functional without an active subscription (`VERIFIED` in tests).
- [x] Vitest test suite passes with zero errors (406/406 passing, 33 test files).

---

## 11. Definition of Done
1. Database schema for subscriptions and webhook event ledger implemented with RLS (`20261108_subscriptions_schema.sql`).
2. Webhook verification and idempotency tested with automated test fixtures (`tests/milestone5_subscriptions_and_payments.test.tsx`).
3. Feature entitlement checks integrated with server-authoritative validation (`subscriptionService.ts`).
4. Billing management screen implemented in student settings (`BillingSettingsSection.tsx`).
5. Server Edge Functions created in `supabase/functions/` (`handle-payment-webhook`, `create-checkout-session`, `create-customer-portal-session`).
6. All items in the Execution Checklist completed with test evidence.

---

## 12. Risks and Blockers

| Risk / Blocker | Severity | Mitigation Strategy |
|---|---|---|
| Provider credentials unconfigured (`DEC-04`) | Medium | Test fixtures and mock resilience implemented; graceful UX banner informs student when keys are pending deployment. |
| Webhook delivery failure or network delays | Medium | Implement polling fallback (`check-subscription-status` endpoint) when user returns from checkout. |
| Chargeback or refund dispute handling | Medium | Automatically capture `charge.refunded` and downgrade user status gracefully. |
| Regulatory tax compliance (VAT / GST) | Medium | Use merchant of record (e.g. LemonSqueezy) or Stripe Tax to handle automated tax compliance. |

---

## 13. Required Evidence for Completion
- Test run report for subscription state transitions and webhook signature verification tests (26/26 passing in `tests/milestone5_subscriptions_and_payments.test.tsx`).
- Migration `supabase/migrations/20261108_subscriptions_schema.sql` implementing `user_subscriptions`, `payment_webhook_events`, `get_user_entitlements()`, and hardened `process_subscription_webhook_event()`.
- Server Edge Functions in `supabase/functions/` handling webhook verification and checkout session creation without exposing secrets to the frontend.
- Code audit showing zero references to credit card numbers or secret keys in client source code.

---

## 14. Execution Checklist
- [x] **Finalize Provider Decision:** Stripe selected as reference provider architecture (`DEC-04`).
- [x] **Author Subscription Migration:** Create `20261108_subscriptions_schema.sql` with RLS.
- [x] **Implement Webhook Function:** Built cryptographic HMAC-SHA256 signature verification in `supabase/functions/handle-payment-webhook/index.ts`.
- [x] **Implement Checkout Route:** Built session creation interface in `supabase/functions/create-checkout-session/index.ts` and customer portal launcher in `supabase/functions/create-customer-portal-session/index.ts`.
- [x] **Build Student Billing Settings:** Built `BillingSettingsSection.tsx` with tier cards, past-due alert, and billing portal button in `SettingsView.tsx`.
- [x] **Integrate Admin Subscription Views:** Verified user subscription tier visibility in admin support records.
- [x] **Execute Automated Test Suite:** 26/26 Milestone 5 unit tests passing; 406/406 full suite tests passing.
- [x] **Verify Production Build:** `npm run build` (`tsc && vite build`) passed with zero errors.
- [x] **Update Documentation:** Marked criteria verified and reported status.

---

## 15. Future Antigravity Execution Protocol
When requested to execute this milestone, Antigravity sessions must adhere to:
1. Read `docs/PROJECT_ROADMAP.md` and this document (`docs/milestones/MILESTONE_05_SUBSCRIPTIONS_AND_PAYMENTS.md`).
2. Inspect the current repository and Git working tree (`git status --short`).
3. Inspect actual implementation files rather than relying on prior conversation summaries.
4. Confirm prerequisite milestones and blockers.
5. Execute the milestone as one coherent work unit.
6. Preserve working functionality and existing user data.
7. Add or update meaningful automated tests.
8. Run TypeScript checks, the full test suite, production build, and `git diff --check`.
9. Verify live integrations only when access and configuration permit.
10. Update milestone checkboxes and status only when backed by evidence.
11. Update the master roadmap with completed work, unresolved risks, and evidence.
12. Report exact files changed, actual checks performed, blockers, and final Git status.

---

## 16. Status and Completion Notes
- **Current Status:** `AUDITED_AND_HARDENED (Hosted Verification Explicitly Pending Deployment)`
- **Verification Evidence:**
  - Automated tests: 26/26 in `tests/milestone5_subscriptions_and_payments.test.tsx`, 406/406 across all 33 test files.
  - Production build: Clean compilation with `tsc && vite build`.
  - Zero secrets (`whsec_`, `sk_live_`, `sk_test_`, `service_role`) in client bundle.
  - Edge Functions created for server-side webhook processing and price resolution.
  - Core student offline-first features remain 100% free and functional forever.

