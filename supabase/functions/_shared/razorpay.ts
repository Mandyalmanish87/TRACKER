// ==============================================================================
// Shared Helper: Razorpay Cryptographic Verification & Utility (Deno Runtime)
// Provides constant-time HMAC-SHA256 signature verification for:
//   1. Razorpay Webhooks (x-razorpay-signature on raw body)
//   2. Razorpay One-Time Orders (order_id + "|" + payment_id)
//
// TRAKIFY COMMERCIAL MODEL (5 ONE-TIME PASSES):
//   1. pass_7d:    7-Day Pass      (₹20 · 2,000 paise · 7 days)
//   2. pass_30d:   Monthly Pass    (₹75 · 7,500 paise · 30 days)
//   3. pass_180d:  Semester Pass   (₹425 · 42,500 paise · 180 days)
//   4. pass_365d:  Annual Pass     (₹825 · 82,500 paise · 365 days)
//   5. pass_1460d: Full Degree Pass (₹3,300 · 330,000 paise · 1,460 days)
//
// All 5 passes grant the exact same unified paid feature set.
// Only price and access duration differ. Zero recurring billing / mandates.
// ==============================================================================

export type TrakifyPassId =
  | 'pass_7d'
  | 'pass_30d'
  | 'pass_180d'
  | 'pass_365d'
  | 'pass_1460d';

export interface TrakifyPassConfig {
  id: TrakifyPassId;
  name: string;
  amountPaise: number;
  currency: 'INR';
  durationDays: number;
  interval: 'one_time';
}

export const TRAKIFY_PASSES: Record<TrakifyPassId, TrakifyPassConfig> = {
  pass_7d: {
    id: 'pass_7d',
    name: '7-Day Pass',
    amountPaise: 2000, // ₹20.00 INR
    currency: 'INR',
    durationDays: 7,
    interval: 'one_time',
  },
  pass_30d: {
    id: 'pass_30d',
    name: 'Monthly Pass',
    amountPaise: 7500, // ₹75.00 INR
    currency: 'INR',
    durationDays: 30,
    interval: 'one_time',
  },
  pass_180d: {
    id: 'pass_180d',
    name: 'Semester Pass',
    amountPaise: 42500, // ₹425.00 INR
    currency: 'INR',
    durationDays: 180,
    interval: 'one_time',
  },
  pass_365d: {
    id: 'pass_365d',
    name: 'Annual Pass',
    amountPaise: 82500, // ₹825.00 INR
    currency: 'INR',
    durationDays: 365,
    interval: 'one_time',
  },
  pass_1460d: {
    id: 'pass_1460d',
    name: 'Full Degree Pass',
    amountPaise: 330000, // ₹3,300.00 INR
    currency: 'INR',
    durationDays: 1460,
    interval: 'one_time',
  },
};

export function isTrakifyPassId(id: string): id is TrakifyPassId {
  return Object.prototype.hasOwnProperty.call(TRAKIFY_PASSES, id);
}

// Backward-compatibility alias for Edge Functions and legacy test runners
export const RAZORPAY_PLANS: Record<string, any> = {
  ...TRAKIFY_PASSES,
};

/**
 * Constant-time comparison to prevent timing attacks.
 */
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Computes hexadecimal HMAC-SHA256 digest of payload using secret.
 */
export async function computeHmacSha256Hex(secret: string, payload: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Verifies Razorpay Webhook signature against raw request body.
 * Razorpay generates signature as: HMAC-SHA256(rawBody, webhookSecret)
 */
export async function verifyRazorpayWebhookSignature(
  rawBody: string,
  signatureHeader: string,
  secret: string
): Promise<{ valid: boolean; error?: string }> {
  if (!signatureHeader || !secret) {
    return { valid: false, error: 'Missing x-razorpay-signature header or webhook secret' };
  }

  const expectedSignature = signatureHeader.trim().toLowerCase();

  try {
    const computedSignature = await computeHmacSha256Hex(secret, rawBody);
    if (!constantTimeEqual(computedSignature, expectedSignature)) {
      return { valid: false, error: 'Cryptographic signature mismatch (forged or tampered payload)' };
    }
    return { valid: true };
  } catch (err: any) {
    return { valid: false, error: `Signature verification exception: ${err?.message || 'unknown'}` };
  }
}

/**
 * Verifies Razorpay One-Time Payment signature.
 * Formula: HMAC-SHA256(order_id + "|" + payment_id, keySecret)
 */
export async function verifyRazorpayPaymentSignature(params: {
  orderId: string;
  paymentId: string;
  signature: string;
  secret: string;
}): Promise<{ valid: boolean; error?: string }> {
  const { orderId, paymentId, signature, secret } = params;
  if (!orderId || !paymentId || !signature || !secret) {
    return { valid: false, error: 'Missing required parameters for payment signature verification' };
  }

  try {
    const payload = `${orderId}|${paymentId}`;
    const computed = await computeHmacSha256Hex(secret, payload);
    if (!constantTimeEqual(computed, signature.trim().toLowerCase())) {
      return { valid: false, error: 'Invalid payment signature: order and payment token mismatch' };
    }
    return { valid: true };
  } catch (err: any) {
    return { valid: false, error: `Payment verification exception: ${err?.message || 'unknown'}` };
  }
}

/**
 * Verifies Razorpay Recurring Subscription mandate signature.
 * Formula: HMAC-SHA256(payment_id + "|" + subscription_id, keySecret)
 */
export async function verifyRazorpaySubscriptionSignature(params: {
  paymentId: string;
  subscriptionId: string;
  signature: string;
  secret: string;
}): Promise<{ valid: boolean; error?: string }> {
  const { paymentId, subscriptionId, signature, secret } = params;
  if (!paymentId || !subscriptionId || !signature || !secret) {
    return { valid: false, error: 'Missing required parameters for subscription signature verification' };
  }

  try {
    const payload = `${paymentId}|${subscriptionId}`;
    const computed = await computeHmacSha256Hex(secret, payload);
    if (!constantTimeEqual(computed, signature.trim().toLowerCase())) {
      return { valid: false, error: 'Invalid subscription signature: token mismatch' };
    }
    return { valid: true };
  } catch (err: any) {
    return { valid: false, error: `Subscription verification exception: ${err?.message || 'unknown'}` };
  }
}

/**
 * Encodes Razorpay Basic Auth header.
 */
export function getRazorpayAuthHeader(keyId: string, keySecret: string): string {
  const credentials = `${keyId}:${keySecret}`;
  const encoded = btoa(credentials);
  return `Basic ${encoded}`;
}
