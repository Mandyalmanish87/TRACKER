// ==============================================================================
// Shared Helper: Firestore REST API Client (Deno Runtime)
// Reads and updates Firestore documents using Google Cloud REST API v1
// with service-account OAuth2 authentication.
// Fail-safe error propagation: durable webhook state machine with processing lease.
// ==============================================================================

export type WebhookProcessingStatus = 'processing' | 'processed' | 'failed';

export interface WebhookClaimDecision {
  canProcess: boolean;
  alreadyProcessed: boolean;
  status: 'new' | 'retry_after_failure' | 'lease_expired_recovered' | 'already_processed' | 'concurrent_in_flight';
  attemptCount: number;
}

export interface FirestoreSubscriptionRecord {
  userId: string;
  provider?: string;
  customerId?: string;
  subscriptionId?: string;
  orderId?: string;
  paymentId?: string;
  status: string;
  planTier: string;
  billingInterval?: string;
  currentPeriodStart?: string | null;
  currentPeriodEnd?: string | null;
  cancelAtPeriodEnd?: boolean;
  latestEventCreated?: number | null;
  latestEventType?: string | null;
  latestEventPriority?: number | null;
  lastVerifiedPayment?: string | null;
  updateTime?: string;
}

function base64UrlEncode(str: string): string {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Safely parses service account credentials from an environment variable string.
 * Handles clean JSON, wrapped single quotes, double-stringified JSON, and escapes.
 */
export function parseServiceAccountCredential(raw: string | undefined | null): any {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  try {
    const parsed = JSON.parse(trimmed);
    if (typeof parsed === 'string') {
      return JSON.parse(parsed.trim());
    }
    return parsed;
  } catch (err) {
    if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
      const inner = trimmed.slice(1, -1).trim();
      const parsedInner = JSON.parse(inner);
      if (typeof parsedInner === 'string') {
        return JSON.parse(parsedInner.trim());
      }
      return parsedInner;
    }
    throw err;
  }
}

function base64UrlEncodeBytes(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return base64UrlEncode(binary);
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const normalized = pem.replace(/\\n/g, '\n');
  const b64Lines = normalized.replace(/-----[^\n]+-----/g, '').replace(/\s+/g, '');
  const b64 = atob(b64Lines);
  const buf = new Uint8Array(b64.length);
  for (let i = 0; i < b64.length; i++) {
    buf[i] = b64.charCodeAt(i);
  }
  return buf.buffer;
}

export async function getGoogleOAuthToken(serviceAccount: {
  client_email: string;
  private_key: string;
  token_uri?: string;
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: serviceAccount.client_email,
    sub: serviceAccount.client_email,
    aud: serviceAccount.token_uri || 'https://oauth2.googleapis.com/token',
    scope: 'https://www.googleapis.com/auth/datastore',
    iat: now,
    exp: now + 3600,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;

  const binaryKey = pemToArrayBuffer(serviceAccount.private_key);
  const privateKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    privateKey,
    new TextEncoder().encode(unsignedToken)
  );

  const jwt = `${unsignedToken}.${base64UrlEncodeBytes(new Uint8Array(signature))}`;

  const tokenResponse = await fetch(serviceAccount.token_uri || 'https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!tokenResponse.ok) {
    const errorBody = await tokenResponse.text();
    throw new Error(`Google OAuth token request failed (${tokenResponse.status}): ${errorBody}`);
  }

  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}

/**
 * Reads a user subscription record from Firestore: user_subscriptions/{userId}
 * Fails safely: returns null ONLY when status is 404 (document does not exist).
 * Throws an error on any network failure or non-404 status.
 */
export async function getFirestoreSubscription(
  projectId: string,
  userId: string,
  serviceAccount: any
): Promise<FirestoreSubscriptionRecord | null> {
  const accessToken = await getGoogleOAuthToken(serviceAccount);
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/user_subscriptions/${encodeURIComponent(userId)}`;

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (res.status === 404) {
    return null;
  }

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Firestore get subscription failed for ${userId} (${res.status}): ${errText}`);
  }

  const doc = await res.json();
  const fields = doc.fields || {};

  return {
    userId,
    provider: fields.provider?.stringValue || 'razorpay',
    customerId: fields.customer_id?.stringValue,
    subscriptionId: fields.subscription_id?.stringValue,
    orderId: fields.order_id?.stringValue,
    paymentId: fields.payment_id?.stringValue,
    status: fields.status?.stringValue || 'free',
    planTier: fields.plan_tier?.stringValue || 'free',
    billingInterval: fields.billing_interval?.stringValue,
    currentPeriodStart: fields.current_period_start?.stringValue || null,
    currentPeriodEnd: fields.current_period_end?.stringValue || null,
    cancelAtPeriodEnd: fields.cancel_at_period_end?.booleanValue ?? false,
    latestEventCreated: fields.latest_event_created?.integerValue
      ? parseInt(fields.latest_event_created.integerValue, 10)
      : null,
    latestEventType: fields.latest_event_type?.stringValue || null,
    latestEventPriority: fields.latest_event_priority?.integerValue
      ? parseInt(fields.latest_event_priority.integerValue, 10)
      : null,
    lastVerifiedPayment: fields.last_verified_payment?.stringValue || null,
    updateTime: doc.updateTime,
  };
}

/**
 * Updates status and metadata of an event document in payment_webhook_events/{eventId}.
 */
export async function updateWebhookEventStatus(
  projectId: string,
  eventId: string,
  updates: {
    status: WebhookProcessingStatus;
    leaseExpiresAt?: string;
    attemptCount?: number;
    lastError?: string;
    processedAt?: string;
  },
  existingAccessToken?: string,
  serviceAccount?: any,
  expectedUpdateTime?: string
): Promise<{ success: boolean; preconditionFailed?: boolean }> {
  const accessToken = existingAccessToken || (serviceAccount ? await getGoogleOAuthToken(serviceAccount) : '');
  if (!accessToken) throw new Error('Missing authentication token for event status update');

  const fields: Record<string, any> = {
    status: { stringValue: updates.status },
    updated_at: { stringValue: new Date().toISOString() },
  };

  if (updates.leaseExpiresAt !== undefined) {
    fields.lease_expires_at = { stringValue: updates.leaseExpiresAt };
  }
  if (updates.attemptCount !== undefined) {
    fields.attempt_count = { integerValue: String(updates.attemptCount) };
  }
  if (updates.lastError !== undefined) {
    fields.last_error = { stringValue: updates.lastError };
  }
  if (updates.processedAt !== undefined) {
    fields.processed_at = { stringValue: updates.processedAt };
  }

  const fieldPaths = Object.keys(fields).map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join('&');
  let url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/payment_webhook_events/${encodeURIComponent(eventId)}?${fieldPaths}`;

  if (expectedUpdateTime) {
    url += `&currentDocument.updateTime=${encodeURIComponent(expectedUpdateTime)}`;
  }

  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields }),
  });

  if (res.status === 412) {
    return { success: false, preconditionFailed: true };
  }

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to update webhook event status for ${eventId} (${res.status}): ${errText}`);
  }

  return { success: true };
}

/**
 * Atomically checks, claims, or recovers a webhook event in Firestore:
 * payment_webhook_events/{eventId}.
 *
 * Implements a durable state machine:
 * - 'processing': Active attempt in flight with lease.
 * - 'processed': Successfully processed; subsequent deliveries return HTTP 200 duplicate_ignored.
 * - 'failed': Prior attempt failed during storage; allows Stripe retries to recover and re-process.
 * - Expired lease: If worker abandoned attempt or crashed, recovers lease and allows retry.
 */
export async function claimWebhookEventAtomically(
  projectId: string,
  eventId: string,
  eventType: string,
  serviceAccount: any,
  leaseSeconds = 60
): Promise<WebhookClaimDecision> {
  const accessToken = await getGoogleOAuthToken(serviceAccount);
  const docUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/payment_webhook_events/${encodeURIComponent(eventId)}`;

  const now = Date.now();
  const leaseExpiresIso = new Date(now + leaseSeconds * 1000).toISOString();
  const nowIso = new Date(now).toISOString();

  // 1. Check existing document state
  const getRes = await fetch(docUrl, {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  // If document does NOT exist (404), attempt atomic creation in 'processing' state
  if (getRes.status === 404) {
    const createUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/payment_webhook_events?documentId=${encodeURIComponent(eventId)}`;
    const createFields: Record<string, any> = {
      event_id: { stringValue: eventId },
      event_type: { stringValue: eventType },
      status: { stringValue: 'processing' },
      lease_expires_at: { stringValue: leaseExpiresIso },
      attempt_count: { integerValue: '1' },
      created_at: { stringValue: nowIso },
      updated_at: { stringValue: nowIso },
    };

    const createRes = await fetch(createUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fields: createFields }),
    });

    if (createRes.ok) {
      return {
        canProcess: true,
        alreadyProcessed: false,
        status: 'new',
        attemptCount: 1,
      };
    }

    if (createRes.status === 409) {
      // 409 Conflict: Another concurrent worker created the document at the exact same instant
      // Fall through to inspect existing document state and lease below
    } else {
      const errText = await createRes.text();
      throw new Error(`Firestore atomic event creation failed for ${eventId} (${createRes.status}): ${errText}`);
    }
  } else if (!getRes.ok) {
    const errText = await getRes.text();
    throw new Error(`Firestore event check failed for ${eventId} (${getRes.status}): ${errText}`);
  }

  // 2. Document exists: inspect current state machine status and lease
  const docData = await fetch(docUrl, {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!docData.ok) {
    const errText = await docData.text();
    throw new Error(`Failed to inspect event document for ${eventId} (${docData.status}): ${errText}`);
  }

  const existingDoc = await docData.json();
  const fields = existingDoc.fields || {};
  const currentStatus: WebhookProcessingStatus = (fields.status?.stringValue as WebhookProcessingStatus) || 'processing';
  const leaseExpiresAt = fields.lease_expires_at?.stringValue;
  const attempts = parseInt(fields.attempt_count?.integerValue || '1', 10);

  // State A: Already successfully processed
  if (currentStatus === 'processed') {
    return {
      canProcess: false,
      alreadyProcessed: true,
      status: 'already_processed',
      attemptCount: attempts,
    };
  }

  // State B: Currently marked 'processing'
  if (currentStatus === 'processing') {
    const isLeaseActive = leaseExpiresAt ? new Date(leaseExpiresAt).getTime() > now : false;

    // Concurrent duplicate delivery while previous attempt is actively processing
    if (isLeaseActive) {
      return {
        canProcess: false,
        alreadyProcessed: false,
        status: 'concurrent_in_flight',
        attemptCount: attempts,
      };
    }

    // Lease expired: worker timed out or container crashed. Recover lease and retry with precondition!
    const leaseReclaim = await updateWebhookEventStatus(
      projectId,
      eventId,
      {
        status: 'processing',
        leaseExpiresAt: leaseExpiresIso,
        attemptCount: attempts + 1,
      },
      accessToken,
      undefined,
      existingDoc.updateTime
    );

    if (leaseReclaim?.preconditionFailed) {
      return {
        canProcess: false,
        alreadyProcessed: false,
        status: 'concurrent_in_flight',
        attemptCount: attempts,
      };
    }

    return {
      canProcess: true,
      alreadyProcessed: false,
      status: 'lease_expired_recovered',
      attemptCount: attempts + 1,
    };
  }

  // State C: Prior attempt failed ('failed'). Stripe retry recovery with precondition!
  if (currentStatus === 'failed') {
    const retryReclaim = await updateWebhookEventStatus(
      projectId,
      eventId,
      {
        status: 'processing',
        leaseExpiresAt: leaseExpiresIso,
        attemptCount: attempts + 1,
      },
      accessToken,
      undefined,
      existingDoc.updateTime
    );

    if (retryReclaim?.preconditionFailed) {
      return {
        canProcess: false,
        alreadyProcessed: false,
        status: 'concurrent_in_flight',
        attemptCount: attempts,
      };
    }

    return {
      canProcess: true,
      alreadyProcessed: false,
      status: 'retry_after_failure',
      attemptCount: attempts + 1,
    };
  }

  return {
    canProcess: false,
    alreadyProcessed: false,
    status: 'concurrent_in_flight',
    attemptCount: attempts,
  };
}

/**
 * Marks event as successfully processed in Firestore.
 */
export async function markWebhookEventProcessed(
  projectId: string,
  eventId: string,
  serviceAccount: any
): Promise<void> {
  await updateWebhookEventStatus(projectId, eventId, {
    status: 'processed',
    processedAt: new Date().toISOString(),
  }, undefined, serviceAccount);
}

/**
 * Marks event as failed in Firestore so Stripe retries can recover.
 */
export async function markWebhookEventFailed(
  projectId: string,
  eventId: string,
  errorMessage: string,
  serviceAccount: any
): Promise<void> {
  try {
    const sanitizedError = errorMessage.slice(0, 300);
    await updateWebhookEventStatus(projectId, eventId, {
      status: 'failed',
      lastError: sanitizedError,
    }, undefined, serviceAccount);
  } catch (err) {
    console.error(`[firestoreRest] Error recording webhook failure status for ${eventId}:`, err);
  }
}

/**
 * Updates user_subscriptions/{userId} in Firestore.
 * Throws if the update request fails so caller can notify Stripe of failure (triggering retry).
 */
export async function updateFirestoreSubscription(
  projectId: string,
  userId: string,
  subscriptionData: {
    userId: string;
    provider?: string;
    customerId?: string;
    subscriptionId?: string;
    orderId?: string;
    paymentId?: string;
    status: string;
    planTier: string;
    billingInterval?: string;
    currentPeriodStart?: string | null;
    currentPeriodEnd?: string | null;
    cancelAtPeriodEnd?: boolean;
    latestEventCreated?: number;
    latestEventType?: string | null;
    latestEventPriority?: number | null;
    lastVerifiedPayment?: string | null;
  },
  serviceAccount: any,
  expectedUpdateTime?: string,
  mustNotExist?: boolean
): Promise<void> {
  const accessToken = await getGoogleOAuthToken(serviceAccount);

  const fields: Record<string, any> = {
    user_id: { stringValue: subscriptionData.userId },
    provider: { stringValue: subscriptionData.provider || 'razorpay' },
    status: { stringValue: subscriptionData.status },
    plan_tier: { stringValue: subscriptionData.planTier },
    cancel_at_period_end: { booleanValue: Boolean(subscriptionData.cancelAtPeriodEnd) },
    updated_at: { stringValue: new Date().toISOString() },
  };

  if (subscriptionData.customerId) {
    fields.customer_id = { stringValue: subscriptionData.customerId };
  }
  if (subscriptionData.subscriptionId) {
    fields.subscription_id = { stringValue: subscriptionData.subscriptionId };
  }
  if (subscriptionData.orderId) {
    fields.order_id = { stringValue: subscriptionData.orderId };
  }
  if (subscriptionData.paymentId) {
    fields.payment_id = { stringValue: subscriptionData.paymentId };
  }
  if (subscriptionData.billingInterval) {
    fields.billing_interval = { stringValue: subscriptionData.billingInterval };
  }
  if (subscriptionData.currentPeriodStart) {
    fields.current_period_start = { stringValue: subscriptionData.currentPeriodStart };
  }
  if (subscriptionData.currentPeriodEnd) {
    fields.current_period_end = { stringValue: subscriptionData.currentPeriodEnd };
    fields.period_end_timestamp = { timestampValue: subscriptionData.currentPeriodEnd };
  }
  if (subscriptionData.latestEventCreated) {
    fields.latest_event_created = { integerValue: String(subscriptionData.latestEventCreated) };
  }
  if (subscriptionData.latestEventType) {
    fields.latest_event_type = { stringValue: subscriptionData.latestEventType };
  }
  if (subscriptionData.latestEventPriority !== undefined && subscriptionData.latestEventPriority !== null) {
    fields.latest_event_priority = { integerValue: String(subscriptionData.latestEventPriority) };
  }
  if (subscriptionData.lastVerifiedPayment) {
    fields.last_verified_payment = { stringValue: subscriptionData.lastVerifiedPayment };
  }

  const fieldPaths = Object.keys(fields).map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join('&');
  let url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/user_subscriptions/${encodeURIComponent(userId)}?${fieldPaths}`;

  if (expectedUpdateTime) {
    url += `&currentDocument.updateTime=${encodeURIComponent(expectedUpdateTime)}`;
  } else if (mustNotExist) {
    url += `&currentDocument.exists=false`;
  }

  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Firestore update failed (${res.status}): ${errText}`);
  }
}

// ==============================================================================
// Authoritative Permanent Payment Ledger & Cross-Endpoint Concurrency Engine
// Collection: payment_records/{paymentId}
// Invariants:
//   1. Permanent Idempotency: Every Razorpay payment ID grants entitlement AT MOST ONCE.
//   2. Cross-Endpoint Atomicity: verify-razorpay-payment and handle-razorpay-webhook
//      share this exact atomic state machine, preventing concurrent double-crediting.
//   3. No Lost Extensions: Precondition retries ensure concurrent purchases by the
//      same user append properly without overwriting period end dates.
//   4. Safe Recovery: Failed provisioning attempts remain in 'failed' state and are
//      durable and cleanly retryable.
// ==============================================================================

export interface PaymentRecord {
  paymentId: string;
  orderId?: string;
  userId: string;
  planId?: string;
  planTier: string;
  durationDays?: number;
  amountPaise: number;
  currency: string;
  status: 'processing' | 'processed' | 'failed';
  leaseExpiresAt?: string;
  attemptCount: number;
  createdAt: string;
  updatedAt: string;
  processedAt?: string;
  lastError?: string;
  periodStart?: string;
  periodEnd?: string;
  source?: string;
  updateTime?: string;
}

export async function getPaymentRecord(
  projectId: string,
  paymentId: string,
  serviceAccount: any
): Promise<PaymentRecord | null> {
  const accessToken = await getGoogleOAuthToken(serviceAccount);
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/payment_records/${encodeURIComponent(paymentId)}`;

  const res = await fetch(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (res.status === 404) {
    return null;
  }

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Firestore get payment record failed for ${paymentId} (${res.status}): ${errText}`);
  }

  const doc = await res.json();
  const fields = doc.fields || {};

  return {
    paymentId,
    orderId: fields.order_id?.stringValue,
    userId: fields.user_id?.stringValue || '',
    planId: fields.plan_id?.stringValue,
    planTier: fields.plan_tier?.stringValue || 'paid',
    durationDays: fields.duration_days?.integerValue ? parseInt(fields.duration_days.integerValue, 10) : undefined,
    amountPaise: parseInt(fields.amount_paise?.integerValue || '0', 10),
    currency: fields.currency?.stringValue || 'INR',
    status: (fields.status?.stringValue as 'processing' | 'processed' | 'failed') || 'processing',
    leaseExpiresAt: fields.lease_expires_at?.stringValue,
    attemptCount: parseInt(fields.attempt_count?.integerValue || '1', 10),
    createdAt: fields.created_at?.stringValue || '',
    updatedAt: fields.updated_at?.stringValue || '',
    processedAt: fields.processed_at?.stringValue,
    lastError: fields.last_error?.stringValue,
    periodStart: fields.period_start?.stringValue,
    periodEnd: fields.period_end?.stringValue,
    source: fields.source?.stringValue,
    updateTime: doc.updateTime,
  };
}

export async function claimPaymentRecordAtomically(
  projectId: string,
  paymentId: string,
  details: {
    orderId?: string;
    userId: string;
    planTier?: string;
    planId?: string;
    durationDays?: number;
    amountPaise?: number;
    currency?: string;
    source: 'verify_api' | 'webhook';
  },
  serviceAccount: any,
  leaseSeconds = 60
): Promise<{
  canProcess: boolean;
  alreadyProcessed: boolean;
  status: 'new' | 'already_processed' | 'concurrent_in_flight' | 'lease_expired_recovered' | 'retry_after_failure';
  record?: PaymentRecord | null;
}> {
  const accessToken = await getGoogleOAuthToken(serviceAccount);
  const docUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/payment_records/${encodeURIComponent(paymentId)}`;

  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const leaseExpiresIso = new Date(now + leaseSeconds * 1000).toISOString();

  // 1. Check existing record
  const getRes = await fetch(docUrl, {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (getRes.status === 404) {
    // Attempt atomic create in 'processing' state with lease
    const createUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/payment_records?documentId=${encodeURIComponent(paymentId)}`;
    const fields: Record<string, any> = {
      payment_id: { stringValue: paymentId },
      user_id: { stringValue: details.userId },
      plan_tier: { stringValue: details.planTier || 'paid' },
      status: { stringValue: 'processing' },
      lease_expires_at: { stringValue: leaseExpiresIso },
      attempt_count: { integerValue: '1' },
      created_at: { stringValue: nowIso },
      updated_at: { stringValue: nowIso },
      source: { stringValue: details.source },
    };
    if (details.orderId) fields.order_id = { stringValue: details.orderId };
    if (details.planId) fields.plan_id = { stringValue: details.planId };
    if (details.durationDays) fields.duration_days = { integerValue: String(details.durationDays) };
    if (details.amountPaise !== undefined) fields.amount_paise = { integerValue: String(details.amountPaise) };
    if (details.currency) fields.currency = { stringValue: details.currency };

    const createRes = await fetch(createUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fields }),
    });

    if (createRes.ok) {
      const createdDoc = await createRes.json();
      return {
        canProcess: true,
        alreadyProcessed: false,
        status: 'new',
        record: {
          paymentId,
          orderId: details.orderId,
          userId: details.userId,
          planId: details.planId,
          planTier: details.planTier || 'paid',
          durationDays: details.durationDays,
          amountPaise: details.amountPaise || 0,
          currency: details.currency || 'INR',
          status: 'processing',
          leaseExpiresAt: leaseExpiresIso,
          attemptCount: 1,
          createdAt: nowIso,
          updatedAt: nowIso,
          source: details.source,
          updateTime: createdDoc.updateTime,
        },
      };
    }

    if (createRes.status !== 409) {
      const errText = await createRes.text();
      throw new Error(`Firestore atomic payment record creation failed (${createRes.status}): ${errText}`);
    }
    // 409 Conflict: concurrent worker created at identical moment, fall through to inspect
  } else if (!getRes.ok) {
    const errText = await getRes.text();
    throw new Error(`Firestore payment record check failed (${getRes.status}): ${errText}`);
  }

  // 2. Record exists: inspect state machine and lease
  const docData = await fetch(docUrl, {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!docData.ok) {
    const errText = await docData.text();
    throw new Error(`Failed to inspect payment record (${docData.status}): ${errText}`);
  }

  const existingDoc = await docData.json();
  const fields = existingDoc.fields || {};
  const currentStatus = (fields.status?.stringValue as 'processing' | 'processed' | 'failed') || 'processing';
  const leaseExpiresAt = fields.lease_expires_at?.stringValue;
  const attempts = parseInt(fields.attempt_count?.integerValue || '1', 10);

  const record: PaymentRecord = {
    paymentId,
    orderId: fields.order_id?.stringValue,
    userId: fields.user_id?.stringValue || details.userId,
    planId: fields.plan_id?.stringValue || details.planId,
    planTier: fields.plan_tier?.stringValue || details.planTier || 'paid',
    durationDays: fields.duration_days?.integerValue ? parseInt(fields.duration_days.integerValue, 10) : details.durationDays,
    amountPaise: parseInt(fields.amount_paise?.integerValue || '0', 10),
    currency: fields.currency?.stringValue || 'INR',
    status: currentStatus,
    leaseExpiresAt,
    attemptCount: attempts,
    createdAt: fields.created_at?.stringValue || '',
    updatedAt: fields.updated_at?.stringValue || '',
    processedAt: fields.processed_at?.stringValue,
    periodStart: fields.period_start?.stringValue,
    periodEnd: fields.period_end?.stringValue,
    updateTime: existingDoc.updateTime,
  };

  if (currentStatus === 'processed') {
    return {
      canProcess: false,
      alreadyProcessed: true,
      status: 'already_processed',
      record,
    };
  }

  if (currentStatus === 'processing') {
    const isLeaseActive = leaseExpiresAt ? new Date(leaseExpiresAt).getTime() > now : false;
    if (isLeaseActive) {
      return {
        canProcess: false,
        alreadyProcessed: false,
        status: 'concurrent_in_flight',
        record,
      };
    }

    // Lease expired: worker timed out or container crashed. Recover lease with updateTime precondition!
    const patchFields: Record<string, any> = {
      status: { stringValue: 'processing' },
      lease_expires_at: { stringValue: leaseExpiresIso },
      attempt_count: { integerValue: String(attempts + 1) },
      updated_at: { stringValue: nowIso },
    };
    const fieldPaths = Object.keys(patchFields).map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join('&');
    const patchUrl = `${docUrl}?${fieldPaths}&currentDocument.updateTime=${encodeURIComponent(existingDoc.updateTime)}`;

    const patchRes = await fetch(patchUrl, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: patchFields }),
    });

    if (patchRes.status === 412) {
      return { canProcess: false, alreadyProcessed: false, status: 'concurrent_in_flight', record };
    }
    if (!patchRes.ok) {
      const errText = await patchRes.text();
      throw new Error(`Failed to recover payment record lease (${patchRes.status}): ${errText}`);
    }

    const patchedDoc = await patchRes.json().catch(() => ({}));
    return {
      canProcess: true,
      alreadyProcessed: false,
      status: 'lease_expired_recovered',
      record: {
        ...record,
        status: 'processing',
        leaseExpiresAt: leaseExpiresIso,
        attemptCount: attempts + 1,
        updatedAt: nowIso,
        updateTime: patchedDoc.updateTime || existingDoc.updateTime,
      },
    };
  }

  if (currentStatus === 'failed') {
    // Retry prior failed attempt
    const patchFields: Record<string, any> = {
      status: { stringValue: 'processing' },
      lease_expires_at: { stringValue: leaseExpiresIso },
      attempt_count: { integerValue: String(attempts + 1) },
      updated_at: { stringValue: nowIso },
    };
    const fieldPaths = Object.keys(patchFields).map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join('&');
    const patchUrl = `${docUrl}?${fieldPaths}&currentDocument.updateTime=${encodeURIComponent(existingDoc.updateTime)}`;

    const patchRes = await fetch(patchUrl, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: patchFields }),
    });

    if (patchRes.status === 412) {
      return { canProcess: false, alreadyProcessed: false, status: 'concurrent_in_flight', record };
    }
    if (!patchRes.ok) {
      const errText = await patchRes.text();
      throw new Error(`Failed to retry failed payment record (${patchRes.status}): ${errText}`);
    }

    const patchedDoc = await patchRes.json().catch(() => ({}));
    return {
      canProcess: true,
      alreadyProcessed: false,
      status: 'retry_after_failure',
      record: {
        ...record,
        status: 'processing',
        leaseExpiresAt: leaseExpiresIso,
        attemptCount: attempts + 1,
        updatedAt: nowIso,
        updateTime: patchedDoc.updateTime || existingDoc.updateTime,
      },
    };
  }

  return { canProcess: false, alreadyProcessed: false, status: 'concurrent_in_flight', record };
}

export async function finalizePaymentRecordProcessed(
  projectId: string,
  paymentId: string,
  periodStart: string,
  periodEnd: string,
  serviceAccount: any,
  meta?: { planId?: string; durationDays?: number }
): Promise<void> {
  const accessToken = await getGoogleOAuthToken(serviceAccount);
  const nowIso = new Date().toISOString();
  const fields: Record<string, any> = {
    status: { stringValue: 'processed' },
    processed_at: { stringValue: nowIso },
    period_start: { stringValue: periodStart },
    period_end: { stringValue: periodEnd },
    updated_at: { stringValue: nowIso },
  };
  if (meta?.planId) fields.plan_id = { stringValue: meta.planId };
  if (meta?.durationDays) fields.duration_days = { integerValue: String(meta.durationDays) };

  const fieldPaths = Object.keys(fields).map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join('&');
  const patchUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/payment_records/${encodeURIComponent(paymentId)}?${fieldPaths}`;

  const res = await fetch(patchUrl, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to finalize payment record (${res.status}): ${errText}`);
  }
}

export async function markPaymentRecordFailed(
  projectId: string,
  paymentId: string,
  errorMessage: string,
  serviceAccount: any
): Promise<void> {
  try {
    const accessToken = await getGoogleOAuthToken(serviceAccount);
    const nowIso = new Date().toISOString();
    const fields: Record<string, any> = {
      status: { stringValue: 'failed' },
      last_error: { stringValue: errorMessage.slice(0, 300) },
      updated_at: { stringValue: nowIso },
    };
    const fieldPaths = Object.keys(fields).map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join('&');
    const patchUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/payment_records/${encodeURIComponent(paymentId)}?${fieldPaths}`;

    await fetch(patchUrl, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields }),
    });
  } catch (err) {
    console.error(`[markPaymentRecordFailed] Failed to record payment failure for ${paymentId}:`, err);
  }
}

export interface ProcessPaymentParams {
  projectId: string;
  paymentId: string;
  orderId?: string;
  userId: string;
  planId?: string;
  planTier?: string;
  amountPaise?: number;
  currency?: string;
  source: 'verify_api' | 'webhook';
  serviceAccount: any;
  durationDays?: number;
}

export interface ProcessPaymentResult {
  success: boolean;
  verified: boolean;
  duplicate: boolean;
  status: 'active' | 'duplicate_ignored' | 'concurrent_in_flight';
  planTier: string;
  currentPeriodEnd: string;
  paymentId: string;
  orderId?: string;
  error?: string;
}

/**
 * Atomically updates user_subscriptions/{userId} AND payment_records/{paymentId}
 * in a single Firestore REST commit transaction.
 *
 * Enforces strict preconditions:
 * - user_subscriptions: precondition updateTime (or exists: false if new)
 * - payment_records: precondition updateTime matching the lease claim
 *
 * If either precondition fails (e.g., concurrent purchase or lease lost), the
 * entire transaction is aborted with HTTP 412 Precondition Failed, preventing
 * partial writes or double-extensions.
 */
export async function commitAuthoritativePaymentAtomically(
  projectId: string,
  params: {
    userId: string;
    paymentId: string;
    orderId?: string;
    planId?: string;
    planTier: string;
    durationDays: number;
    finalPeriodStart: string;
    finalPeriodEnd: string;
    source: 'verify_api' | 'webhook';
    subscriptionUpdateTime?: string;
    subscriptionMustNotExist?: boolean;
    paymentRecordUpdateTime?: string;
  },
  serviceAccount: any
): Promise<{ success: boolean; preconditionFailed?: boolean; status?: number; error?: string }> {
  const accessToken = await getGoogleOAuthToken(serviceAccount);
  const nowIso = new Date().toISOString();

  // 1. Subscription write payload
  const subFields: Record<string, any> = {
    user_id: { stringValue: params.userId },
    provider: { stringValue: 'razorpay' },
    status: { stringValue: 'active' },
    plan_tier: { stringValue: params.planTier || 'paid' },
    billing_interval: { stringValue: 'one_time' },
    current_period_start: { stringValue: params.finalPeriodStart },
    current_period_end: { stringValue: params.finalPeriodEnd },
    period_end_timestamp: { timestampValue: params.finalPeriodEnd },
    cancel_at_period_end: { booleanValue: false },
    last_verified_payment: { stringValue: params.paymentId },
    payment_id: { stringValue: params.paymentId },
    latest_event_created: { integerValue: String(Math.floor(Date.now() / 1000)) },
    latest_event_type: { stringValue: params.source === 'webhook' ? 'payment.captured' : 'payment.verified' },
    latest_event_priority: { integerValue: '50' },
    updated_at: { stringValue: nowIso },
  };

  if (params.planId) {
    subFields.plan_id = { stringValue: params.planId };
  }
  if (params.durationDays) {
    subFields.duration_days = { integerValue: String(params.durationDays) };
  }
  if (params.orderId) {
    subFields.order_id = { stringValue: params.orderId };
  }

  const subWrite: Record<string, any> = {
    update: {
      name: `projects/${projectId}/databases/(default)/documents/user_subscriptions/${encodeURIComponent(params.userId)}`,
      fields: subFields,
    },
    updateMask: {
      fieldPaths: Object.keys(subFields),
    },
  };

  if (params.subscriptionUpdateTime) {
    subWrite.currentDocument = { updateTime: params.subscriptionUpdateTime };
  } else if (params.subscriptionMustNotExist) {
    subWrite.currentDocument = { exists: false };
  }

  // 2. Payment record write payload
  const paymentFields: Record<string, any> = {
    status: { stringValue: 'processed' },
    processed_at: { stringValue: nowIso },
    period_start: { stringValue: params.finalPeriodStart },
    period_end: { stringValue: params.finalPeriodEnd },
    updated_at: { stringValue: nowIso },
  };
  if (params.planId) {
    paymentFields.plan_id = { stringValue: params.planId };
  }
  if (params.durationDays) {
    paymentFields.duration_days = { integerValue: String(params.durationDays) };
  }

  const paymentWrite: Record<string, any> = {
    update: {
      name: `projects/${projectId}/databases/(default)/documents/payment_records/${encodeURIComponent(params.paymentId)}`,
      fields: paymentFields,
    },
    updateMask: {
      fieldPaths: Object.keys(paymentFields),
    },
  };

  if (params.paymentRecordUpdateTime) {
    paymentWrite.currentDocument = { updateTime: params.paymentRecordUpdateTime };
  }

  const commitUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:commit`;
  const res = await fetch(commitUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      writes: [subWrite, paymentWrite],
    }),
  });

  if (res.status === 412) {
    return { success: false, preconditionFailed: true, status: 412 };
  }

  if (!res.ok) {
    const errText = await res.text();
    return { success: false, status: res.status, error: errText };
  }

  return { success: true, status: res.status };
}

export async function processAuthoritativePayment(
  params: ProcessPaymentParams
): Promise<ProcessPaymentResult> {
  const {
    projectId,
    paymentId,
    orderId,
    userId,
    planId,
    planTier = 'paid',
    amountPaise,
    currency,
    durationDays,
    source,
    serviceAccount,
  } = params;

  // 1. Permanent Payment Idempotency Check & Atomic Claim
  const claim = await claimPaymentRecordAtomically(
    projectId,
    paymentId,
    { orderId, userId, planTier, planId, durationDays, amountPaise, currency, source },
    serviceAccount
  );

  // If already processed: permanent idempotency guarantees zero double-crediting!
  if (claim.alreadyProcessed || claim.status === 'already_processed') {
    const currentSub = await getFirestoreSubscription(projectId, userId, serviceAccount);
    return {
      success: true,
      verified: true,
      duplicate: true,
      status: 'duplicate_ignored',
      planTier: currentSub?.planTier || planTier,
      currentPeriodEnd: claim.record?.periodEnd || currentSub?.currentPeriodEnd || new Date().toISOString(),
      paymentId,
      orderId,
    };
  }

  // If another concurrent attempt is active in flight:
  if (!claim.canProcess || claim.status === 'concurrent_in_flight') {
    if (source === 'verify_api') {
      // For verify_api, wait briefly for in-flight worker to finalize
      await new Promise((r) => setTimeout(r, 1200));
      const recheck = await getPaymentRecord(projectId, paymentId, serviceAccount);
      if (recheck?.status === 'processed') {
        const currentSub = await getFirestoreSubscription(projectId, userId, serviceAccount);
        return {
          success: true,
          verified: true,
          duplicate: true,
          status: 'duplicate_ignored',
          planTier: currentSub?.planTier || planTier,
          currentPeriodEnd: recheck.periodEnd || currentSub?.currentPeriodEnd || new Date().toISOString(),
          paymentId,
          orderId,
        };
      }
    }
    return {
      success: false,
      verified: false,
      duplicate: false,
      status: 'concurrent_in_flight',
      planTier,
      currentPeriodEnd: '',
      paymentId,
      error: 'Concurrent payment processing in flight. Please retry shortly.',
    };
  }

  // 2. CRASH RECOVERY DEFENSE:
  // If the server crashed after updating user_subscriptions/{userId} but before finalizing
  // payment_records/{paymentId}, check whether user_subscriptions already reflects this paymentId!
  const initialSub = await getFirestoreSubscription(projectId, userId, serviceAccount);
  if (
    initialSub &&
    (initialSub.lastVerifiedPayment === paymentId || initialSub.paymentId === paymentId) &&
    initialSub.currentPeriodEnd
  ) {
    // CRASH RECOVERY ACTIVATED: The user's entitlement was already applied before the server crashed.
    // Finalize payment_records/{paymentId} with existing timestamps WITHOUT adding durationMs again!
    try {
      await finalizePaymentRecordProcessed(
        projectId,
        paymentId,
        initialSub.currentPeriodStart || new Date().toISOString(),
        initialSub.currentPeriodEnd,
        serviceAccount,
        { planId, durationDays }
      );
    } catch (e) {
      console.warn(`[processAuthoritativePayment] Crash recovery finalize notice for ${paymentId}:`, e);
    }

    return {
      success: true,
      verified: true,
      duplicate: true,
      status: 'duplicate_ignored',
      planTier: initialSub.planTier || planTier,
      currentPeriodEnd: initialSub.currentPeriodEnd,
      paymentId,
      orderId,
    };
  }

  // 3. We now hold the atomic lease on payment_records/{paymentId}.
  // Provision user_subscriptions/{userId} and payment_records/{paymentId} atomically
  const planDurationDays = durationDays || 30;
  const durationMs = planDurationDays * 24 * 60 * 60 * 1000;

  let finalPeriodStart = '';
  let finalPeriodEnd = '';
  const maxRetries = 3;
  let commitSucceeded = false;
  let activePaymentRecordUpdateTime = claim.record?.updateTime;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const existingSub = attempt === 1 ? initialSub : await getFirestoreSubscription(projectId, userId, serviceAccount);
    const now = new Date();
    let baseTime = now.getTime();
    finalPeriodStart = now.toISOString();

    // Repurchase before expiry: append to existing unexpired period
    // Repurchase after expiry: start from now
    if (existingSub && existingSub.status === 'active' && existingSub.currentPeriodEnd) {
      const existingEnd = new Date(existingSub.currentPeriodEnd).getTime();
      if (!isNaN(existingEnd) && existingEnd > now.getTime()) {
        baseTime = existingEnd;
        finalPeriodStart = existingSub.currentPeriodStart || now.toISOString();
      }
    }

    finalPeriodEnd = new Date(baseTime + durationMs).toISOString();

    // If activePaymentRecordUpdateTime was not set, fetch current payment record
    if (!activePaymentRecordUpdateTime) {
      const rec = await getPaymentRecord(projectId, paymentId, serviceAccount);
      activePaymentRecordUpdateTime = rec?.updateTime;
    }

    const commitResult = await commitAuthoritativePaymentAtomically(
      projectId,
      {
        userId,
        paymentId,
        orderId,
        planId,
        planTier: 'paid',
        durationDays: planDurationDays,
        finalPeriodStart,
        finalPeriodEnd,
        source,
        subscriptionUpdateTime: existingSub?.updateTime,
        subscriptionMustNotExist: !existingSub,
        paymentRecordUpdateTime: activePaymentRecordUpdateTime,
      },
      serviceAccount
    );

    if (commitResult.success) {
      commitSucceeded = true;
      break;
    }

    if (commitResult.preconditionFailed) {
      // 412 Precondition Failed: either payment record was touched, or subscription was updated concurrently.
      const currentRec = await getPaymentRecord(projectId, paymentId, serviceAccount);

      // Scenario A: already finalized as 'processed' (e.g. concurrent webhook/verify completed)
      if (currentRec?.status === 'processed') {
        const sub = await getFirestoreSubscription(projectId, userId, serviceAccount);
        return {
          success: true,
          verified: true,
          duplicate: true,
          status: 'duplicate_ignored',
          planTier: sub?.planTier || planTier,
          currentPeriodEnd: currentRec.periodEnd || sub?.currentPeriodEnd || finalPeriodEnd,
          paymentId,
          orderId,
        };
      }

      // Scenario B: lease expired and another worker took ownership
      if (activePaymentRecordUpdateTime && currentRec?.updateTime !== activePaymentRecordUpdateTime) {
        return {
          success: false,
          verified: false,
          duplicate: false,
          status: 'concurrent_in_flight',
          planTier,
          currentPeriodEnd: '',
          paymentId,
          error: 'Payment lease ownership changed during processing. Please retry shortly.',
        };
      }

      // Scenario C: conflict was on user_subscriptions (another purchase completed concurrently).
      // Retry loop to re-read subscription and stack onto new periodEnd!
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 100 * attempt));
        continue;
      }
    }

    // Non-412 failure or exhausted retries
    await markPaymentRecordFailed(
      projectId,
      paymentId,
      commitResult.error || `Atomic commit failed (${commitResult.status})`,
      serviceAccount
    );
    throw new Error(commitResult.error || `Failed to commit payment ${paymentId} atomically (${commitResult.status})`);
  }

  if (!commitSucceeded) {
    throw new Error(`Failed to commit payment ${paymentId} atomically after ${maxRetries} attempts.`);
  }

  return {
    success: true,
    verified: true,
    duplicate: false,
    status: 'active',
    planTier: 'paid',
    currentPeriodEnd: finalPeriodEnd,
    paymentId,
    orderId,
  };
}
