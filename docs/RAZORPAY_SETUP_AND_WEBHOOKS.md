# RAZORPAY SETUP & WEBHOOK INTEGRATION GUIDE
**Document ID:** RZP-SETUP-2026
**Target Platform:** Razorpay Dashboard -> Supabase Edge Functions -> Cloud Firestore
**Status:** Operational Manual

---

## 1. Razorpay Dashboard Configuration

### Step 1: Switch to Test Mode
1. Log in to the [Razorpay Dashboard](https://dashboard.razorpay.com).
2. Ensure the top-right environment toggle is set to **Test Mode**.

### Step 2: Generate API Key Pair
1. Navigate to **Account & Settings** -> **API Keys**.
2. Click **Generate Key**.
3. Note down:
   - **Key ID:** `rzp_test_...`
   - **Key Secret:** (keep strictly secret, never commit)
4. Set the public Key ID in the frontend `.env.local`:
   ```bash
   VITE_RAZORPAY_KEY_ID=rzp_test_YOUR_KEY_ID
   ```
5. Set both keys in Supabase Edge Function secrets:
   ```bash
   supabase secrets set RAZORPAY_KEY_ID=rzp_test_YOUR_KEY_ID
   supabase secrets set RAZORPAY_KEY_SECRET=YOUR_KEY_SECRET
   ```

### Step 3: Architecture Model — One-Time 30-Day Passes Only
> [!IMPORTANT]
> **NO RECURRING PLANS OR MANDATES REQUIRED**
> TRAKIFY uses **One-Time Payments Only**. Students purchase independent 30-day membership passes.
> There are no automatic deductions, mandates, or recurring subscriptions.
> You do **NOT** need to create recurring plans in the Razorpay dashboard, and `RAZORPAY_PLAN_ID_PRO` / `RAZORPAY_PLAN_ID_COHORT` are **NOT** required.

---

## 2. Webhook Endpoint Setup

### Step 1: Add Webhook in Razorpay Dashboard
1. Navigate to **Account & Settings** -> **Webhooks** -> **Add New Webhook**.
2. Enter the **Webhook URL**:
   ```
   https://<your-supabase-project-ref>.supabase.co/functions/v1/handle-razorpay-webhook
   ```
3. Enter a strong, randomly generated **Secret** (e.g. 32-character hex string).
4. Save the secret in Supabase Edge Functions:
   ```bash
   supabase secrets set RAZORPAY_WEBHOOK_SECRET=YOUR_RANDOM_SECRET
   ```

### Step 2: Select Subscribed Events
Enable the following webhook events in the dashboard:

| Category | Event Name | Handler Logic in `handle-razorpay-webhook` |
|---|---|---|
| **Orders** | `order.paid` | Primary payment event: marks status `active`, appends 30 days to existing pass (or starts from now if expired), records payment ID idempotently. |
| **Payments** | `payment.captured` | Authoritative confirmation of payment capture; triggers trusted extension policy. |
| **Payments** | `payment.failed` | Records failed attempt; never downgrades or destroys an existing active unexpired pass. |

---

## 3. Webhook Signature Verification Invariant

Razorpay signs webhook payloads using HMAC-SHA256:
- **Header:** `x-razorpay-signature`
- **Payload:** Raw request body string (UTF-8 encoded)
- **Secret:** `RAZORPAY_WEBHOOK_SECRET`

```ts
// Deno Edge Runtime HMAC Verification
const encoder = new TextEncoder();
const key = await crypto.subtle.importKey(
  'raw',
  encoder.encode(webhookSecret),
  { name: 'HMAC', hash: 'SHA-256' },
  false,
  ['sign']
);
const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody));
const computedHex = Array.from(new Uint8Array(signatureBuffer))
  .map((b) => b.toString(16).padStart(2, '0'))
  .join('');

const isValid = constantTimeEqual(computedHex, receivedSignatureHeader);
```

> [!IMPORTANT]
> The raw body must NOT be parsed and re-stringified before signature verification. The original byte stream from the HTTP request must be passed directly into `verifyRazorpayWebhookSignature`.

---

## 4. Test Mode Testing Instruments

When running in Razorpay Test Mode (`rzp_test_...`):

1. **Test Cards (India / International):**
   - Card Number: `4111 1111 1111 1111`
   - Expiry: Any future date (e.g. `12/28`)
   - CVV: `123`
   - OTP for 3D Secure: `123456` or click **Success** on the Razorpay simulator screen.
2. **UPI Simulation:**
   - VPA: `success@razorpay` (instant capture)
   - VPA: `failure@razorpay` (simulates payment failure)
3. **Net Banking Simulation:**
   - Select any bank (e.g. HDFC, ICICI, SBI) -> choose **Success** or **Failure** on the simulator page.
