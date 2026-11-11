# DEPLOYMENT READINESS CHECKLIST — RAZORPAY PAYMENT INTEGRATION
**Document ID:** DEP-CHK-RZP-2026
**Target Release:** Student Tracker 2026 Production & Test Mode
**Status:** Pre-Flight Certified

---

## 1. Environment Variables & Secret Separation

### A. Client Configuration (Vite Frontend `.env.local` / Hosting Environment)
*Safe for client bundle exposure.*

- [x] `VITE_FIREBASE_API_KEY`: Firebase Web API Key
- [x] `VITE_FIREBASE_AUTH_DOMAIN`: `tracker-e8e6f.firebaseapp.com`
- [x] `VITE_FIREBASE_PROJECT_ID`: `tracker-e8e6f`
- [x] `VITE_FIREBASE_MESSAGING_SENDER_ID`: Project sender ID
- [x] `VITE_FIREBASE_APP_ID`: Web App ID
- [x] `VITE_SUPABASE_URL`: Public Supabase Project URL (e.g. `https://<ref>.supabase.co`)
- [x] `VITE_SUPABASE_ANON_KEY`: Public Supabase anonymous client key
- [x] `VITE_RAZORPAY_KEY_ID`: Public Razorpay Key ID (`rzp_test_...` or `rzp_live_...`)

### B. Server-Side Secrets (Supabase Edge Function Secrets)
*NEVER exposed in frontend builds. Must be configured using `supabase secrets set`.*

- [ ] `RAZORPAY_KEY_ID`: Public key matching merchant account
- [ ] `RAZORPAY_KEY_SECRET`: Secret key for API requests & signature verification
- [ ] `RAZORPAY_WEBHOOK_SECRET`: Secret key for validating `x-razorpay-signature`
- [ ] `RAZORPAY_PLAN_ID_PRO`: Recurring Plan ID for Tracker Pro (`plan_...`)
- [ ] `RAZORPAY_PLAN_ID_COHORT`: Recurring Plan ID for Cohort Sponsor (`plan_...`)
- [ ] `FIREBASE_PROJECT_ID`: `tracker-e8e6f`
- [ ] `FIREBASE_SERVICE_ACCOUNT_JSON`: Full JSON string for Google Service Account with Datastore/Firestore User role

---

## 2. Supabase Edge Functions Deployment

Deploy all 5 payment-specific serverless Edge Functions to Supabase:

```bash
# 1. Login to Supabase CLI
supabase login

# 2. Link your Supabase project
supabase link --project-ref <your-supabase-project-ref>

# 3. Set the required secrets
supabase secrets set RAZORPAY_KEY_ID="rzp_test_..."
supabase secrets set RAZORPAY_KEY_SECRET="..."
supabase secrets set RAZORPAY_WEBHOOK_SECRET="..."
supabase secrets set RAZORPAY_PLAN_ID_PRO="plan_..."
supabase secrets set RAZORPAY_PLAN_ID_COHORT="plan_..."
supabase secrets set FIREBASE_PROJECT_ID="tracker-e8e6f"
supabase secrets set FIREBASE_SERVICE_ACCOUNT_JSON='{"type":"service_account",...}'

# 4. Deploy the 5 Edge Functions
supabase functions deploy create-razorpay-order --no-verify-jwt
supabase functions deploy create-razorpay-subscription --no-verify-jwt
supabase functions deploy verify-razorpay-payment --no-verify-jwt
supabase functions deploy cancel-razorpay-subscription --no-verify-jwt
supabase functions deploy handle-razorpay-webhook --no-verify-jwt
```
*(Note: `--no-verify-jwt` allows Supabase to accept requests carrying Firebase Authorization Bearer tokens, which our Edge Functions verify cryptographically).*

---

## 3. Firestore Rules & Collections Validation

- [x] Verify `firestore.rules` has:
  ```javascript
  match /user_subscriptions/{userId} {
    allow read: if signedIn() && request.auth.uid == userId;
    allow write: if false;
  }
  ```
- [x] Deploy Firestore rules to Firebase:
  ```bash
  firebase deploy --only firestore:rules
  ```
- [x] Verify `payment_webhook_events` is accessible to the Google Service Account for atomic lease claiming.

---

## 4. End-to-End Test Mode Verification Checklist

Run these manual test passes in Razorpay Test Mode:

1. **One-Time Pro Pass Purchase:**
   - [ ] Sign in to Student Tracker as a test student.
   - [ ] Navigate to Settings -> Membership & Subscriptions.
   - [ ] Select "One-Time Pass (30 Days)" preference.
   - [ ] Click "Pay with Razorpay (Tracker Pro)".
   - [ ] Verify Razorpay modal opens with amount `₹399.00` and order description.
   - [ ] Complete payment using test card `4111 1111 1111 1111` or UPI `success@razorpay`.
   - [ ] Verify modal closes, verification succeeds, and UI displays "Tracker Pro" badge with active period end.
   - [ ] Check Firestore: document `user_subscriptions/{userId}` has `status: 'active'`, `plan_tier: 'pro'`, `provider: 'razorpay'`.

2. **Auto-Renewing Mandate Authorization:**
   - [ ] Select "Auto-Renewing Mandate" preference.
   - [ ] Click "Pay with Razorpay (Cohort Sponsor)".
   - [ ] Authorize recurring mandate in test modal.
   - [ ] Verify mandate signature is verified on backend.
   - [ ] Check Firestore: document `user_subscriptions/{userId}` has `status: 'active'`, `plan_tier: 'cohort'`.

3. **Subscription Cancellation:**
   - [ ] Click "Cancel Subscription" in the UI.
   - [ ] Confirm cancellation prompt.
   - [ ] Verify UI displays `cancelAtPeriodEnd: true` ("Subscription will end on renewal date and will not renew").
   - [ ] Verify user retains Pro/Cohort features until `currentPeriodEnd`.

4. **Webhook Simulation:**
   - [ ] In Razorpay Dashboard -> Webhooks -> Test Webhook, trigger `payment.captured`.
   - [ ] Verify Supabase logs report `[handle-razorpay-webhook] status: processed`.
   - [ ] Send the same event again; verify Supabase logs report `status: duplicate_ignored` with HTTP 200.

---

## 5. Live Mode Activation Prerequisites

Before switching from `rzp_test_...` to `rzp_live_...`:

1. **Merchant KYC Completion:** Ensure Razorpay merchant account activation and KYC review are completed.
2. **UPI AutoPay / e-Mandate Activation:** Submit necessary merchant documentation on Razorpay dashboard to activate recurring debit mandates.
3. **Generate Live API Keys:** Replace `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` in Supabase secrets with `rzp_live_...` keys.
4. **Update Frontend Key:** Update `VITE_RAZORPAY_KEY_ID=rzp_live_...` in hosting environment variables (e.g. Vercel, Firebase Hosting, Netlify).
5. **Re-point Live Webhook:** In Razorpay Live Dashboard, register the production webhook endpoint with `RAZORPAY_WEBHOOK_SECRET`.

---

## 6. Rollback Strategy

If an unexpected payment gateway issue occurs during launch:
1. **Local Offline Integrity:** The offline-first core ensures all existing students retain full local access to timetable, attendance, syllabus, and focus timers without disruption.
2. **Grace Period Protection:** Active paid users have a 24-hour grace period during webhook or billing retries.
3. **Safe Fallback:** If cloud payment endpoints are unreachable (e.g. 503 or 402), the UI displays a non-blocking informational banner without crashing the application.
