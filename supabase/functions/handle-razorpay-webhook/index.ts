// ==============================================================================
// Supabase Edge Function: handle-razorpay-webhook
// Secure Server-Side Razorpay Webhook Handler
//
// ENVIRONMENT (Deno Edge Runtime):
//   RAZORPAY_WEBHOOK_SECRET: Secret key from Razorpay Webhook Settings
//   RAZORPAY_KEY_ID: Razorpay Key ID (optional, for fetching entity details)
//   RAZORPAY_KEY_SECRET: Razorpay Key Secret (optional, for fetching entity details)
//   FIREBASE_PROJECT_ID: Target Firebase Project ID (tracker-e8e6f)
//   FIREBASE_SERVICE_ACCOUNT_JSON: Service Account JSON string for updating Firestore
//
// SECURITY INVARIANTS:
//   1. Runs exclusively server-side in Supabase Edge Runtime.
//   2. Cryptographically verifies raw-body HMAC-SHA256 signature from x-razorpay-signature header.
//   3. Persistent atomic event deduplication prevents race conditions from simultaneous delivery.
//   4. Durable state machine ('processing' -> 'processed' | 'failed') with 60s lease for recovery.
//   5. Monotonic event timestamp defense: never overwrites newer subscription updates with older events.
//   6. Updates existing Firebase `user_subscriptions/{userId}` record directly.
//   7. If checking, recording, or Firestore update fails, responds with 500 error so Razorpay retries.
// ==============================================================================

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import {
  updateFirestoreSubscription,
  getFirestoreSubscription,
  claimWebhookEventAtomically,
  markWebhookEventProcessed,
  markWebhookEventFailed,
  processAuthoritativePayment,
  getPaymentRecord,
  parseServiceAccountCredential,
} from '../_shared/firestoreRest.ts';
import {
  verifyRazorpayWebhookSignature,
  TRAKIFY_PASSES,
  isTrakifyPassId,
  RAZORPAY_PLANS,
  TrakifyPassId,
} from '../_shared/razorpay.ts';

// In-memory processed event cache for instantaneous local deduplication
const inMemoryProcessedEvents = new Set<string>();

/**
 * Priority hierarchy for same-second lifecycle events.
 * Higher number = higher authority during same-second timestamp conflicts.
 */
export const RAZORPAY_EVENT_PRIORITY: Record<string, number> = {
  // Lowest authority: Mandate setup / authorization before payment capture
  'subscription.authenticated': 10,

  // Transient retries / paused state
  'subscription.pending': 20,
  'subscription.paused': 25,

  // Payment failure (invoice charge failed)
  'payment.failed': 30,

  // Successful reactivation
  'subscription.resumed': 40,
  'subscription.activated': 45,

  // Successful payment / charge (high active authority)
  'subscription.charged': 50,
  'payment.captured': 50,
  'order.paid': 50,

  // Suspension / Termination (highest authority for finality)
  'subscription.halted': 60,
  'subscription.completed': 70,
  'subscription.cancelled': 70,
};

export function getEventPriority(eventType: string): number {
  return RAZORPAY_EVENT_PRIORITY[eventType] ?? 20;
}

export function getStatusFallbackPriority(status?: string): number {
  switch (status) {
    case 'authenticated': return 10;
    case 'pending': return 20;
    case 'past_due': return 30;
    case 'active': return 50;
    case 'halted': return 60;
    case 'cancelled':
    case 'completed': return 70;
    default: return 0;
  }
}

serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const signatureHeader = req.headers.get('x-razorpay-signature') || '';
  const eventIdHeader = req.headers.get('x-razorpay-event-id') || '';
  const webhookSecret = Deno.env.get('RAZORPAY_WEBHOOK_SECRET') || '';
  const firebaseProjectId = Deno.env.get('FIREBASE_PROJECT_ID') || 'tracker-e8e6f';
  const serviceAccountRaw =
    Deno.env.get('FIREBASE_SERVICE_ACCOUNT_KEY') ||
    Deno.env.get('FIREBASE_SERVICE_ACCOUNT_JSON') ||
    '';

  if (!webhookSecret) {
    console.error('[handle-razorpay-webhook] Server missing RAZORPAY_WEBHOOK_SECRET');
    return new Response(
      JSON.stringify({ error: 'Server payment configuration is pending deployment (DEC-04)' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 1. Verify Razorpay signature against original raw request body
  const rawBody = await req.text();
  const verification = await verifyRazorpayWebhookSignature(rawBody, signatureHeader, webhookSecret);

  if (!verification.valid) {
    console.warn('[handle-razorpay-webhook] Signature verification rejected:', verification.error);
    return new Response(JSON.stringify({ error: verification.error }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON payload' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const eventType: string = event.event || 'unknown';
  const eventCreated: number = event.created_at || Math.floor(Date.now() / 1000);

  // Deterministic unique Event ID for deduplication
  const payloadEntityId =
    event.payload?.payment?.entity?.id ||
    event.payload?.subscription?.entity?.id ||
    event.payload?.order?.entity?.id ||
    '';

  const eventId: string =
    eventIdHeader ||
    (payloadEntityId ? `${eventType}_${payloadEntityId}` : `evt_${eventCreated}_${Math.random().toString(36).slice(2, 8)}`);

  // Parse and strictly validate service account for persistent Firestore operations
  if (!serviceAccountRaw) {
    console.error('[handle-razorpay-webhook] Server missing FIREBASE_SERVICE_ACCOUNT_KEY');
    return new Response(
      JSON.stringify({ error: 'Server database credential pending configuration (FIREBASE_SERVICE_ACCOUNT_KEY)' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  let serviceAccount: any = null;
  try {
    serviceAccount = parseServiceAccountCredential(serviceAccountRaw);
    if (!serviceAccount || typeof serviceAccount !== 'object' || !serviceAccount.client_email || !serviceAccount.private_key) {
      throw new Error('Service account JSON missing required fields (client_email, private_key)');
    }
  } catch (parseErr: any) {
    console.error('[handle-razorpay-webhook] Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY:', parseErr?.message);
    return new Response(
      JSON.stringify({ error: `Invalid Firebase service account configuration: ${parseErr?.message || 'SyntaxError'}` }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 2. Local in-memory deduplication
  if (inMemoryProcessedEvents.has(eventId)) {
    return new Response(JSON.stringify({ received: true, status: 'duplicate_ignored' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 3. Persistent Atomic Deduplication & Durable State Machine
  if (serviceAccount && firebaseProjectId) {
    try {
      const claim = await claimWebhookEventAtomically(
        firebaseProjectId,
        eventId,
        eventType,
        serviceAccount
      );

      if (claim.status === 'already_processed') {
        inMemoryProcessedEvents.add(eventId);
        return new Response(JSON.stringify({ received: true, status: 'duplicate_ignored' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (claim.status === 'concurrent_in_flight') {
        return new Response(
          JSON.stringify({ error: 'Concurrent event delivery in flight. Backing off for retry.' }),
          { status: 503, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (!claim.canProcess) {
        return new Response(JSON.stringify({ received: true, status: 'duplicate_ignored' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    } catch (claimErr: any) {
      console.error('[handle-razorpay-webhook] Claim exception (failing safely):', claimErr);
      return new Response(
        JSON.stringify({ error: `Event tracking claim failed: ${claimErr.message}` }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  // 4. Extract Entity Details from Razorpay payload
  const paymentEntity = event.payload?.payment?.entity;
  const subscriptionEntity = event.payload?.subscription?.entity;
  const orderEntity = event.payload?.order?.entity;

  // Resolve target student UID
  const targetUserId =
    paymentEntity?.notes?.userId ||
    subscriptionEntity?.notes?.userId ||
    orderEntity?.notes?.userId ||
    null;

  // Resolve target plan ID & duration from order notes
  const rawPlanId =
    paymentEntity?.notes?.planId ||
    paymentEntity?.notes?.plan_id ||
    orderEntity?.notes?.planId ||
    orderEntity?.notes?.plan_id ||
    paymentEntity?.notes?.planTier ||
    subscriptionEntity?.notes?.planTier ||
    orderEntity?.notes?.planTier ||
    'pass_30d';

  const matchedPass = (rawPlanId && TRAKIFY_PASSES[rawPlanId as TrakifyPassId]) || (rawPlanId && RAZORPAY_PLANS[rawPlanId]);
  const durationDays = matchedPass?.durationDays || Number(orderEntity?.notes?.durationDays) || 30;
  const planTier = 'paid';

  if (!targetUserId) {
    // Unassociated event (e.g. manual dashboard payment). Mark processed and acknowledge.
    if (serviceAccount && firebaseProjectId) {
      await markWebhookEventProcessed(firebaseProjectId, eventId, serviceAccount);
    }
    return new Response(
      JSON.stringify({ received: true, status: 'ignored_no_user_association' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 5. Update Firebase Firestore user_subscriptions/{targetUserId}
  if (serviceAccount && firebaseProjectId) {
    try {
      const existingSub = await getFirestoreSubscription(firebaseProjectId, targetUserId, serviceAccount);

      // Monotonic event ordering defense: ignore strictly older events
      if (existingSub?.latestEventCreated && eventCreated < existingSub.latestEventCreated) {
        console.warn(
          `[handle-razorpay-webhook] Stale event ignored for user ${targetUserId}: eventCreated (${eventCreated}) < latestEventCreated (${existingSub.latestEventCreated})`
        );
        await markWebhookEventProcessed(firebaseProjectId, eventId, serviceAccount);
        inMemoryProcessedEvents.add(eventId);
        return new Response(
          JSON.stringify({ received: true, status: 'stale_event_ignored' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Deterministic same-second conflict resolution:
      // When two lifecycle events share the exact same second timestamp, evaluate event priority.
      // A subordinate event (e.g. subscription.authenticated) must NEVER overwrite or downgrade a
      // higher-authority event (e.g. subscription.activated or subscription.charged) that arrived first.
      const incomingPriority = getEventPriority(eventType);
      const existingPriority = existingSub?.latestEventPriority ?? getStatusFallbackPriority(existingSub?.status);

      if (
        existingSub?.latestEventCreated &&
        eventCreated === existingSub.latestEventCreated &&
        incomingPriority < existingPriority
      ) {
        console.warn(
          `[handle-razorpay-webhook] Subordinate same-second event ignored for user ${targetUserId}: incoming "${eventType}" (priority ${incomingPriority}) < existing "${existingSub.latestEventType || existingSub.status}" (priority ${existingPriority}) at timestamp ${eventCreated}`
        );
        await markWebhookEventProcessed(firebaseProjectId, eventId, serviceAccount);
        inMemoryProcessedEvents.add(eventId);
        return new Response(
          JSON.stringify({ received: true, status: 'same_second_subordinate_ignored' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Subscription replacement invariant:
      // If the student already has an active or in-flight replacement subscription (different ID),
      // delayed events for an obsolete/older subscription ID must NEVER overwrite or terminate the new subscription!
      if (
        subscriptionEntity?.id &&
        existingSub?.subscriptionId &&
        subscriptionEntity.id !== existingSub.subscriptionId &&
        (existingSub.status === 'active' || existingSub.status === 'authenticated')
      ) {
        console.warn(
          `[handle-razorpay-webhook] Obsolete subscription event ignored: incoming event for ${subscriptionEntity.id} does not match current active subscription ${existingSub.subscriptionId}`
        );
        await markWebhookEventProcessed(firebaseProjectId, eventId, serviceAccount);
        inMemoryProcessedEvents.add(eventId);
        return new Response(
          JSON.stringify({ received: true, status: 'superseded_subscription_event_ignored' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      let nextStatus = existingSub?.status || 'free';
      let nextTier = planTier || existingSub?.planTier || 'free';
      let currentPeriodEnd = existingSub?.currentPeriodEnd || null;
      let cancelAtPeriodEnd = existingSub?.cancelAtPeriodEnd ?? false;
      const paymentId = paymentEntity?.id || existingSub?.paymentId;
      const orderId = paymentEntity?.order_id || orderEntity?.id || existingSub?.orderId;
      const subscriptionId = subscriptionEntity?.id || existingSub?.subscriptionId;

      const now = new Date();

      switch (eventType) {
        case 'payment.captured':
        case 'order.paid': {
          if (!paymentId) {
            console.warn(`[handle-razorpay-webhook] ${eventType} missing payment entity ID`);
            await markWebhookEventProcessed(firebaseProjectId, eventId, serviceAccount);
            return new Response(JSON.stringify({ received: true, status: 'ignored_missing_payment_id' }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            });
          }

          // Authoritative cross-endpoint atomic payment processing & permanent ledger
          const processResult = await processAuthoritativePayment({
            projectId: firebaseProjectId,
            paymentId,
            orderId: orderId || undefined,
            userId: targetUserId,
            planId: matchedPass?.id || rawPlanId,
            planTier: 'paid',
            amountPaise: paymentEntity?.amount,
            currency: paymentEntity?.currency,
            source: 'webhook',
            serviceAccount,
            durationDays,
          });

          if (processResult.status === 'concurrent_in_flight') {
            return new Response(
              JSON.stringify({ error: 'Concurrent payment processing in flight. Retrying via webhook.' }),
              { status: 503, headers: { 'Content-Type': 'application/json' } }
            );
          }

          await markWebhookEventProcessed(firebaseProjectId, eventId, serviceAccount);
          inMemoryProcessedEvents.add(eventId);

          return new Response(
            JSON.stringify({
              received: true,
              status: processResult.duplicate ? 'duplicate_payment_acknowledged' : 'processed',
              eventId,
              paymentId,
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }

        case 'subscription.authenticated':
          // Mandate authorized: records mandate without activating paid entitlements.
          // Structural invariant: must NEVER downgrade an active, past_due, or terminal subscription!
          if (['active', 'past_due', 'halted', 'cancelled', 'completed'].includes(existingSub?.status || '')) {
            console.warn(
              `[handle-razorpay-webhook] subscription.authenticated ignored: current status is already '${existingSub?.status}'`
            );
            break;
          }
          nextStatus = 'authenticated';
          nextTier = planTier;
          break;

        case 'subscription.activated':
        case 'subscription.charged':
        case 'subscription.resumed':
          nextStatus = 'active';
          nextTier = planTier;
          if (subscriptionEntity?.current_end) {
            currentPeriodEnd = new Date(subscriptionEntity.current_end * 1000).toISOString();
          } else {
            currentPeriodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
          }
          cancelAtPeriodEnd = false;
          break;

        case 'subscription.paused':
        case 'subscription.pending':
          // Terminal cancellations cannot be reverted to pending
          if (!['cancelled', 'completed'].includes(existingSub?.status || '')) {
            nextStatus = 'pending';
          }
          break;

        case 'subscription.halted':
          nextStatus = 'halted';
          break;

        case 'subscription.cancelled':
        case 'subscription.completed':
          nextStatus = 'cancelled';
          cancelAtPeriodEnd = true;
          break;

        case 'payment.failed':
          // Check permanent payment ledger: if payment was already confirmed captured/processed, ignore failure
          if (paymentId) {
            try {
              const paidRecord = await getPaymentRecord(firebaseProjectId, paymentId, serviceAccount);
              if (paidRecord?.status === 'processed') {
                console.warn(`[handle-razorpay-webhook] payment.failed ignored: payment ${paymentId} was already captured/processed in ledger`);
                break;
              }
            } catch {
              // Fall through to subscription checks
            }
          }
          // Ignore failure if this specific payment was already confirmed captured
          if (paymentEntity?.id && (existingSub?.lastVerifiedPayment === paymentEntity.id || existingSub?.paymentId === paymentEntity.id)) {
            console.warn(`[handle-razorpay-webhook] payment.failed ignored: payment ${paymentEntity.id} was already confirmed captured`);
            break;
          }
          // In one-time payments, a failed subsequent purchase attempt must NOT destroy an existing active unexpired pass
          if (existingSub?.status === 'active' && existingSub?.currentPeriodEnd) {
            const expiryTime = new Date(existingSub.currentPeriodEnd).getTime();
            if (!isNaN(expiryTime) && expiryTime > now.getTime()) {
              console.warn(`[handle-razorpay-webhook] payment.failed on new order attempt ignored: student has active pass until ${existingSub.currentPeriodEnd}`);
              break;
            }
          }
          // Legacy recurring subscription fallback: if a recurring mandate charge failed
          if (
            (subscriptionEntity || existingSub?.subscriptionId) &&
            !['cancelled', 'completed'].includes(existingSub?.status || '')
          ) {
            nextStatus = 'past_due';
          }
          break;

        default:
          console.log(`[handle-razorpay-webhook] Unhandled event type: ${eventType}`);
          break;
      }

      await updateFirestoreSubscription(
        firebaseProjectId,
        targetUserId,
        {
          userId: targetUserId,
          provider: 'razorpay',
          planTier: nextTier,
          status: nextStatus,
          orderId: orderId,
          paymentId: paymentId,
          subscriptionId: subscriptionId,
          currentPeriodEnd: currentPeriodEnd,
          cancelAtPeriodEnd: cancelAtPeriodEnd,
          latestEventCreated: eventCreated,
          latestEventType: eventType,
          latestEventPriority: incomingPriority,
          lastVerifiedPayment: paymentId,
        },
        serviceAccount,
        existingSub?.updateTime
      );

      // Durably mark event as processed
      await markWebhookEventProcessed(firebaseProjectId, eventId, serviceAccount);
      inMemoryProcessedEvents.add(eventId);

      return new Response(
        JSON.stringify({ received: true, status: 'processed', eventId }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } catch (updateErr: any) {
      console.error(`[handle-razorpay-webhook] Firestore update failed for ${eventId}:`, updateErr);
      // Mark event state as 'failed' so Razorpay retries can recover
      try {
        await markWebhookEventFailed(firebaseProjectId, eventId, updateErr.message, serviceAccount);
      } catch (markErr) {
        console.error('[handle-razorpay-webhook] Failed to mark event failed:', markErr);
      }
      // Return 500 so Razorpay retries
      return new Response(
        JSON.stringify({ error: `Webhook event processing failed: ${updateErr.message}` }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  return new Response(
    JSON.stringify({ received: true, status: 'ignored_unhandled_event', eventType }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
});
