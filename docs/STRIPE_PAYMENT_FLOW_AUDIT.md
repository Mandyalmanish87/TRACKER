# Student Tracker — Stripe Payment Flow Audit & Architecture
**Environment**: Firebase Spark (Free) + Supabase (Free Tier) + Stripe (Test Mode)

---

## 1. Existing Payment Architecture Discovered
Before this repair:
- The frontend (`subscriptionService.ts`) attempted to invoke Firebase callable functions (`firebaseService.callFunction('trackerRpc')` and `client.functions.invoke`), which failed on Firebase Spark because Cloud Functions require Google Cloud's paid Blaze plan.
- The subscription access logic attempted to call a server RPC `get_user_entitlements` even in production, which failed when cloud RPCs were unconfigured.
- Edge functions initially relied on Google OAuth `tokeninfo` instead of cryptographic RS256 token verification against Google's public JWK set.
- Stripe webhook duplicate checks relied on volatile in-memory sets, which reset upon serverless container cold-starts.
- If storage failed during a webhook invocation, the handler did not fail safely and would acknowledge delivery to Stripe.

---

## 2. Architecture After Local Changes
- **Identity & Authentication**: Firebase Authentication remains the exclusive identity provider (`authService.ts`).
- **Data Authority**: Google Cloud Firestore remains the primary source of truth for user data and subscriptions (`user_subscriptions/{uid}`).
- **Stateless Serverless Execution**: Supabase Edge Functions (running Deno on Supabase's free tier) execute server-side payment logic (`create-checkout-session`, `create-customer-portal-session`, `handle-payment-webhook`).
- **Free Tier Boundary**: Firebase Blaze is **NOT** required. No Firebase Cloud Functions are used. Supabase database tables store zero student app data.
- **Client Security**: The client browser is strictly read-only regarding subscription status and cannot write or spoof entitlements.

---

## 3. Frontend Request Flow
```text
Browser (Authenticated Firebase Student)
   │
   ├─► 1. user.getIdToken(true) [Fresh Firebase ID Token]
   │
   └─► 2. HTTP POST to Supabase Edge Function:
          URL: ${VITE_SUPABASE_URL}/functions/v1/create-checkout-session
          Headers:
             Authorization: Bearer <FIREBASE_ID_TOKEN>
             apikey: <VITE_SUPABASE_ANON_KEY>
             Content-Type: application/json
          Body:
             { "plan_tier": "pro", "return_url": window.location.origin }
```
- Client never passes amounts, currencies, or user IDs.
- If offline, unauthenticated, or unconfigured, defaults safely to `Student Free` entitlements.

---

## 4. Firebase ID-Token Verification Process
Implemented in [`supabase/functions/_shared/firebaseAuth.ts`](file:///c:/Users/mandy/Downloads/TRACKER/supabase/functions/_shared/firebaseAuth.ts):
1. **Header Inspection**:
   - `alg`: Must be `RS256`.
   - `kid`: Key identifier corresponding to Google's public signing keys.
2. **Payload Claims Assertion**:
   - `exp`: Expiration timestamp must be in the future (`exp > now - 300s`).
   - `iat`: Issued-at timestamp must be a number in the past (`iat <= now + 300s`).
   - `auth_time`: Authentication timestamp must be in the past (`auth_time <= now + 300s`).
   - `iss`: Issuer must equal `https://securetoken.google.com/<FIREBASE_PROJECT_ID>`.
   - `aud`: Audience must equal `<FIREBASE_PROJECT_ID>` (`tracker-e8e6f`).
   - `sub`: Subject must be a non-empty string UID.
3. **Cryptographic Signature Verification**:
   - Fetches Google's public JWKS from `https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com` (cached with HTTP `Cache-Control` header).
   - Verifies the signature over `header.payload` using Web Crypto API (`RSASSA-PKCS1-v1_5`, SHA-256).
   - Resolves `authenticatedUid = payload.sub`. Rejects any invalid or tampered tokens with HTTP 401.

---

## 5. Supabase Edge Function Responsibilities

| Function Name | Entrypoint | Responsibility | Security Invariants |
| :--- | :--- | :--- | :--- |
| `create-checkout-session` | `supabase/functions/create-checkout-session/index.ts` | Creates Stripe Checkout Sessions | Derives UID exclusively from verified Firebase token. Maps plan tiers authoritatively to server price IDs. |
| `create-customer-portal-session` | `supabase/functions/create-customer-portal-session/index.ts` | Generates self-serve Stripe billing portal URLs | Reads `customer_id` from existing Firestore `user_subscriptions/{userId}` document. Rejects cross-user inspection. |
| `handle-payment-webhook` | `supabase/functions/handle-payment-webhook/index.ts` | Processes Stripe webhook events | Verifies HMAC-SHA256 signature against raw body bytes. Enforces atomic idempotency and monotonic event ordering. |

---

## 6. Stripe Checkout Flow
1. User clicks "Upgrade to Tracker Pro" or "Cohort Sponsor" in [`BillingSettingsSection.tsx`](file:///c:/Users/mandy/Downloads/TRACKER/src/components/subscription/BillingSettingsSection.tsx).
2. Client sends fresh Firebase ID token to `POST /functions/v1/create-checkout-session`.
3. Edge Function verifies Firebase token and extracts verified UID.
4. Edge Function maps `plan_tier` (`pro` -> `STRIPE_PRICE_ID_PRO`, `cohort` -> `STRIPE_PRICE_ID_COHORT`).
5. Edge Function calls Stripe API:
   - `client_reference_id`: `<verified_firebase_uid>`
   - `metadata[user_id]`: `<verified_firebase_uid>`
   - `metadata[plan_tier]`: `pro | cohort`
   - `subscription_data[metadata][user_id]`: `<verified_firebase_uid>`
   - `subscription_data[metadata][plan_tier]`: `pro | cohort`
6. Edge Function returns `{ checkout_url, session_id }`.
7. Client redirects student to Stripe hosted checkout in Test Mode.

---

## 7. Billing Portal Flow
1. User clicks "Manage Billing & Invoices" in Billing Settings.
2. Client sends fresh Firebase ID token to `POST /functions/v1/create-customer-portal-session`.
3. Edge Function verifies Firebase token and extracts verified UID.
4. Edge Function queries the user's existing Firestore document: `user_subscriptions/{userId}` to extract `customer_id`.
5. If found, Edge Function calls Stripe Billing Portal API (`POST /v1/billing_portal/sessions`) with `customer: customerId`.
6. Returns `{ portal_url }` and client redirects student.

---

## 8. Webhook Signature Verification
Implemented in `verifyStripeSignature`:
1. Reads the HTTP request body as raw text (`await req.text()`) **before** any JSON parsing.
2. Reads the `Stripe-Signature` header and extracts timestamp `t` and signature `v1`.
3. Asserts timestamp is within the 300-second tolerance window to prevent replay attacks.
4. Computes HMAC-SHA256 signature of `${timestamp}.${rawBody}` using `STRIPE_WEBHOOK_SECRET`.
5. Compares computed hex with `v1` using constant-time comparison to prevent timing attacks.

---

## 9. Durable Idempotency & State Machine Design
- **Local Cache**: In-memory `Set<string>` caches processed event IDs for instant local deduplication.
- **Persistent Durable State Machine**: Tracked in `payment_webhook_events/{eventId}` via Firestore REST API:
  - States:
    - `processing`: Initial atomic claim with an active 60-second processing lease (`lease_expires_at`).
    - `processed`: Successfully finished subscription update. Final state.
    - `failed`: Transitioned when an unexpected error occurs during subscription update.
  - **Atomic Precondition Protocol (Google Cloud Firestore REST API v1)**:
    - **Initial Creation**: `POST /payment_webhook_events?documentId=eventId`. Atomic: Firestore responds with HTTP 409 Conflict if the document already exists, preventing duplicate creation races.
    - **Lease Reclamation & Failure Retry**: When recovering an expired lease or retrying after failure, `updateWebhookEventStatus` appends `currentDocument.updateTime=${readDoc.updateTime}` as an optimistic locking precondition.
    - **Concurrent Collision Handling**: If two concurrent workers race to reclaim an expired lease or retry a failed event, Firestore evaluates the precondition atomically. Exactly one worker receives HTTP 200; the competing worker receives **HTTP 412 (Precondition Failed)**. The losing worker catches 412, backs off cleanly, and yields `{ canProcess: false, status: 'concurrent_in_flight' }` without processing duplicate writes.
    - **Completed Event**: Detects `status === 'processed'` and returns HTTP 200 `duplicate_ignored` without repeating writes.
    - **Concurrent Deliveries**: If another worker holds an active lease, rejects with HTTP 503 (`concurrent_in_flight`) so Stripe backs off cleanly.
- **Never Prematurely Marked Processed**: An event transitions to `processed` **only after** `updateFirestoreSubscription` returns successfully.
- **Data Minimization**: Stores only `{ event_id, event_type, status, lease_expires_at, attempt_count, last_error, processed_at, created_at, updated_at }`. Zero card or personal data stored.

---

## 10. Event Ordering & Subscription Concurrency Safety
- Before updating Firestore, the webhook retrieves the current record: `user_subscriptions/{userId}`.
- **Optimistic Concurrency Control**: When writing updates to `user_subscriptions/{userId}`, `updateFirestoreSubscription` enforces `currentDocument.updateTime=${existingSub.updateTime}` (or `currentDocument.exists=false` if no prior subscription existed).
- **Concurrent Subscription Write Protection**: If two events for the same user race simultaneously, only the first worker can commit. The second worker receives HTTP 412 Precondition Failed, fails safely, and returns HTTP 500 to Stripe. On Stripe's retry, the worker reads the freshly updated document and applies the monotonic check against the newly committed state.
- **Out-of-Order Check**: If `event.created < existingSub.latestEventCreated`, the event is older than the currently recorded state. The update is skipped and acknowledged as `stale_event_ignored`.
- **Anti-Resurrection Check**: If `event.created === existingSub.latestEventCreated` and `existingSub.status === 'canceled'` and the incoming event is not canceled, the event is skipped (`equal_timestamp_resurrection_ignored`) to prevent resurrecting canceled subscriptions.
- **Crash Recovery Window**: If a worker crashes after successfully updating `user_subscriptions/{userId}` but before marking the event document as `processed`, the retry after lease expiration detects `eventCreated === existingSub.latestEventCreated && existingSub.status === status`. It finalizes the event to `processed` and returns HTTP 200 without duplicate mutation.
- **Monotonic Update**: Saves `latest_event_created: event.created` to ensure future updates maintain strict monotonic progress.

---

## 11. Firestore Subscription Update Path and Field Names

### Path
`user_subscriptions/{userId}` (Document ID equals the student's Firebase UID).

### Field Names & Schema

| Field Name | Type | Description |
| :--- | :--- | :--- |
| `user_id` | string | Student's Firebase UID |
| `customer_id` | string | Stripe Customer ID (`cus_...`) |
| `subscription_id` | string | Stripe Subscription ID (`sub_...`) |
| `status` | string | `'active' \| 'trialing' \| 'past_due' \| 'canceled' \| 'unpaid' \| 'free'` |
| `plan_tier` | string | `'free' \| 'pro' \| 'cohort'` |
| `current_period_start`| string (ISO) | Start of active billing cycle |
| `current_period_end` | string (ISO) | End of active billing cycle |
| `cancel_at_period_end`| boolean | Whether cancellation is scheduled at cycle end |
| `latest_event_created`| integer | Monotonic Stripe event timestamp |
| `updated_at` | string (ISO) | Timestamp of last authoritative update |

---

## 12. Required Environment Variable Names Only

### Vite Client (`.env.local`)
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_SUPABASE_URL` (Public project URL)
- `VITE_SUPABASE_ANON_KEY` (Public publishable key)

### Supabase Edge Function Secrets (Set via Dashboard or CLI)
- `STRIPE_SECRET_KEY` (Test mode secret key `sk_test_...`)
- `STRIPE_WEBHOOK_SECRET` (Webhook endpoint secret `whsec_...`)
- `STRIPE_PRICE_ID_PRO` (Tracker Pro price ID `price_...`)
- `STRIPE_PRICE_ID_COHORT` (Cohort Sponsor price ID `price_...`)
- `FIREBASE_PROJECT_ID` (`tracker-e8e6f`)
- `FIREBASE_SERVICE_ACCOUNT_JSON` (Restricted service account JSON string with Datastore User role)
- `ALLOWED_ORIGINS` (Optional comma-separated list of additional allowed origins)

---

## 13. Missing Setup Requirements (Action Items for User)
1. **Configure Supabase Secrets**: Set the environment secrets listed in Section 12 in the Supabase dashboard.
2. **Deploy Functions**:
   ```bash
   npx supabase functions deploy create-checkout-session --no-verify-jwt
   npx supabase functions deploy create-customer-portal-session --no-verify-jwt
   npx supabase functions deploy handle-payment-webhook --no-verify-jwt
   ```
3. **Register Webhook Endpoint in Stripe**:
   - URL: `https://<supabase-project-id>.supabase.co/functions/v1/handle-payment-webhook`
   - Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`

---

## 14. Local Test Commands and Actual Outcomes

| Test Command | Scope | Result |
| :--- | :--- | :--- |
| `npx vitest run tests/milestone5_subscriptions_and_payments.test.tsx` | 70 unit and integration tests covering signature verification, state machine idempotency, precondition-guarded lease recovery, monotonic ordering, claims validation, UI rendering, error handling, concurrent race simulation, and double-fault injection | **70 passed (100%)** |
| `npm run build` | Full TypeScript type check (`tsc`) & production bundle generation (`vite build`) | **Exit code 0** (Built in 6.73s) |

### Specific Failure & Concurrency Scenarios Verified Locally

1. **Event claim succeeds, Firestore update succeeds**: Transitions `processing` -> `processed` and returns HTTP 200.
2. **Event claim succeeds, Firestore update fails**: Transitions to `failed`, logs sanitized error, and returns HTTP 500 to Stripe.
3. **Stripe retries after previous failure**: Inspects `failed` document, atomically transitions back to `processing` via `currentDocument.updateTime` precondition (`retry_after_failure`, attempt + 1), updates Firestore, and finalizes to `processed` (HTTP 200).
4. **Two identical webhook deliveries arrive concurrently**: First worker acquires active lease; second detects `concurrent_in_flight` and returns HTTP 503 backoff without duplicate writes.
5. **A completed event arrives again**: Detects `already_processed` and immediately returns HTTP 200 `duplicate_ignored`.
6. **An abandoned processing lease expires**: Worker that crashed or timed out has expired `lease_expires_at`; next delivery detects `lease_expired_recovered`, atomically claims via precondition, renews lease, and successfully processes.
7. **Two workers race to reclaim an expired lease**: Both workers read the expired lease; Worker 1 commits with `currentDocument.updateTime`; Worker 2's write fails with HTTP 412; Worker 2 yields as `concurrent_in_flight`.
8. **Two events for the same user race**: Worker B (newer) commits first; Worker A (older) fails precondition with HTTP 412, returns 500, retries, discovers newer event timestamp, and yields with `stale_event_ignored`.
9. **Worker crash after subscription update**: Worker updates subscription and crashes before marking event processed; retry after lease expiration detects state already applied and finalizes event to `processed` without duplicate writes.
10. **Double-fault handling**: Primary subscription write fails and failure logging also encounters network failure; webhook safely handles secondary error and returns HTTP 500 to Stripe (never HTTP 200).

---

## 15. Files Changed

1. [`src/services/subscriptionService.ts`](file:///c:/Users/mandy/Downloads/TRACKER/src/services/subscriptionService.ts) — Routes checkout and customer portal to Supabase Edge Functions with fresh Firebase token. Isolates test mocks to test runners (`isTestEnvironment()`). Reads entitlements in production exclusively from Firestore `user_subscriptions/{uid}`.
2. [`supabase/functions/_shared/firebaseAuth.ts`](file:///c:/Users/mandy/Downloads/TRACKER/supabase/functions/_shared/firebaseAuth.ts) — Cryptographic RS256 token verification using Google's public JWKS. Enforces `exp`, `iat`, `auth_time`, `iss`, `aud`, `sub`, and `kid`.
3. [`supabase/functions/_shared/firestoreRest.ts`](file:///c:/Users/mandy/Downloads/TRACKER/supabase/functions/_shared/firestoreRest.ts) — Durable state machine (`claimWebhookEventAtomically`, `markWebhookEventProcessed`, `markWebhookEventFailed`) with 60s processing lease, precondition-guarded atomic claims (`currentDocument.updateTime`), and fail-safe error propagation.
4. [`supabase/functions/_shared/cors.ts`](file:///c:/Users/mandy/Downloads/TRACKER/supabase/functions/_shared/cors.ts) — Restricts CORS to authorized TRACKER domains and rejects wildcard `*` in production.
5. [`supabase/functions/create-checkout-session/index.ts`](file:///c:/Users/mandy/Downloads/TRACKER/supabase/functions/create-checkout-session/index.ts) — Server-authoritative checkout launcher with Firebase token verification, strict CORS, and price validation.
6. [`supabase/functions/create-customer-portal-session/index.ts`](file:///c:/Users/mandy/Downloads/TRACKER/supabase/functions/create-customer-portal-session/index.ts) — Customer portal launcher resolving `customer_id` from existing Firestore `user_subscriptions/{userId}` document.
7. [`supabase/functions/handle-payment-webhook/index.ts`](file:///c:/Users/mandy/Downloads/TRACKER/supabase/functions/handle-payment-webhook/index.ts) — Raw body HMAC-SHA256 verification, state machine lifecycle management, optimistic precondition locking on user subscriptions, monotonic timestamp ordering defense, and crash recovery window handling.
8. [`tests/milestone5_subscriptions_and_payments.test.tsx`](file:///c:/Users/mandy/Downloads/TRACKER/tests/milestone5_subscriptions_and_payments.test.tsx) — Added Sections 9, 10, & 11 to verify claims, state machine transitions, retry recovery, realistic concurrency simulations, precondition 412 handling, and failure injection.
9. [`docs/STRIPE_PAYMENT_FLOW_AUDIT.md`](file:///c:/Users/mandy/Downloads/TRACKER/docs/STRIPE_PAYMENT_FLOW_AUDIT.md) — Comprehensive payment flow and idempotency documentation.

---

## 16. Security Limitations and Items Not Verified in Local Testing
- **Live Stripe API & Card Processing**: Real card charges and live mode keys were **not** tested and must remain in Test Mode.
- **Live Supabase Function Invocations**: Edge Functions were verified locally and via unit tests; live execution requires deploying the functions and setting secrets in Supabase.
- **Service Account Permissions**: The service account JSON must be assigned the standard **Cloud Datastore User** role (or minimal equivalent custom role) to write to Firestore collections.

---

## 17. Final Audit Verdict

### Verdict: **PASS WITH LIMITATIONS**

- **Code-Level Verification**: **PASS**. All atomic claiming invariants, precondition protections (`currentDocument.updateTime`), monotonic timestamp ordering defenses, crash recovery windows, and failure injection resilience are proven by implementation and 70 passing unit/concurrency tests.
- **Production Blockers (Limitations)**:
  1. **Deployment Pending**: Edge Functions have not been deployed to Supabase (`create-checkout-session`, `create-customer-portal-session`, `handle-payment-webhook`).
  2. **Secrets Configuration Pending**: Supabase server environment secrets (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID_PRO`, `STRIPE_PRICE_ID_COHORT`, `FIREBASE_PROJECT_ID`, `FIREBASE_SERVICE_ACCOUNT_JSON`) must be set in the Supabase Dashboard before live traffic can be handled.
  3. **Stripe Webhook Registration Pending**: The webhook URL must be registered in the Stripe Developer Dashboard targeting the deployed Supabase Edge Function address.
  4. **Free Tier Boundary**: The setup runs strictly on Firebase Spark (Free) and Supabase Free with Stripe Test Mode. Supabase Edge Functions must remain active (unpaused) to receive webhooks.
