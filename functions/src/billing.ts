// ==============================================================================
// DEPRECATED / DECOMMISSIONED: Legacy Stripe Billing Cloud Functions
// TRAKIFY has permanently switched to Razorpay one-time membership passes
// (pass_7d, pass_30d, pass_180d, pass_365d, pass_1460d) via Supabase Edge Functions.
// Stripe recurring billing, checkout sessions, customer portal, and webhooks
// are decommissioned and are NOT exported for deployment.
// ==============================================================================

import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { defineSecret } from 'firebase-functions/params';
import { HttpsError, onCall, onRequest } from 'firebase-functions/v2/https';
import Stripe from 'stripe';

if (!getApps().length) initializeApp();
const db = getFirestore();
const stripeKey = defineSecret('STRIPE_SECRET_KEY');
const stripeWebhookKey = defineSecret('STRIPE_WEBHOOK_SECRET');
const proPrice = defineSecret('STRIPE_PRICE_ID_PRO');
const cohortPrice = defineSecret('STRIPE_PRICE_ID_COHORT');

function stripeClient() {
  const key = stripeKey.value();
  if (!key) throw new HttpsError('failed-precondition', 'Stripe is not configured in Firebase Functions.');
  return new Stripe(key);
}

function safeReturnUrl(value: unknown): string {
  if (typeof value !== 'string' || !value) return 'https://tracker.app';
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) {
      throw new Error('Invalid return URL');
    }
    return url.origin;
  } catch {
    throw new HttpsError('invalid-argument', 'Return URL must be a secure app URL.');
  }
}

export const createCheckoutSession = onCall(
  { secrets: [stripeKey, proPrice, cohortPrice] },
  async (request) => {
    const user = request.auth;
    if (!user) throw new HttpsError('unauthenticated', 'Sign in before starting checkout.');
    const planTier = request.data?.plan_tier;
    const selectedPriceId = planTier === 'pro' ? proPrice.value() : planTier === 'cohort' ? cohortPrice.value() : '';
    if (!selectedPriceId) throw new HttpsError('invalid-argument', 'This subscription plan is unavailable.');
    const returnUrl = safeReturnUrl(request.data?.return_url);
    const stripe = stripeClient();
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: selectedPriceId, quantity: 1 }],
      client_reference_id: user.uid,
      customer_email: user.token.email || undefined,
      metadata: { user_id: user.uid, plan_tier: planTier },
      subscription_data: { metadata: { user_id: user.uid, plan_tier: planTier } },
      success_url: `${returnUrl}?session_id={CHECKOUT_SESSION_ID}&status=success`,
      cancel_url: `${returnUrl}?status=cancelled`,
    });
    return { checkout_url: session.url, session_id: session.id };
  }
);

export const createCustomerPortalSession = onCall(
  { secrets: [stripeKey] },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in to manage billing.');
    const sub = await db.collection('user_subscriptions').doc(request.auth.uid).get();
    const customerId = sub.get('customer_id');
    if (!customerId) throw new HttpsError('not-found', 'No billing profile is linked to this account.');
    const session = await stripeClient().billingPortal.sessions.create({
      customer: customerId,
      return_url: safeReturnUrl(request.data?.return_url),
    });
    return { portal_url: session.url };
  }
);

async function eventSubscription(event: Stripe.Event, stripe: Stripe): Promise<{ userId: string; data: Record<string, any> } | null> {
  const object: any = event.data.object;
  let sub: any = event.type.startsWith('customer.subscription.') ? object : null;
  const subId = typeof object.subscription === 'string'
    ? object.subscription
    : typeof object.subscription?.id === 'string' ? object.subscription.id
    : typeof object.parent?.subscription_details?.subscription === 'string' ? object.parent.subscription_details.subscription
    : null;
  if (!sub && subId) {
    try { sub = await stripe.subscriptions.retrieve(subId); } catch { sub = null; }
  }
  const metadata = sub?.metadata || object.metadata || object.subscription_details?.metadata || object.parent?.subscription_details?.metadata || {};
  const userId = metadata.user_id || object.client_reference_id;
  if (!userId) return null;
  const priceId = sub?.items?.data?.[0]?.price?.id;
  const planTier = metadata.plan_tier || (priceId === cohortPrice.value() ? 'cohort' : priceId === proPrice.value() ? 'pro' : 'free');
  const status = event.type === 'invoice.payment_failed' ? 'past_due' : event.type === 'checkout.session.completed' ? 'active' : sub?.status || 'active';
  return {
    userId,
    data: {
      user_id: userId,
      customer_id: typeof object.customer === 'string' ? object.customer : object.customer?.id || (typeof sub?.customer === 'string' ? sub.customer : sub?.customer?.id),
      subscription_id: typeof sub?.id === 'string' ? sub.id : null,
      status,
      plan_tier: planTier,
      current_period_start: sub?.current_period_start ? new Date(sub.current_period_start * 1000).toISOString() : null,
      current_period_end: sub?.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
      cancel_at_period_end: Boolean(sub?.cancel_at_period_end),
      latest_event_created: event.created,
      updated_at: new Date().toISOString(),
    },
  };
}

export const stripeWebhook = onRequest(
  { secrets: [stripeKey, stripeWebhookKey, proPrice, cohortPrice], timeoutSeconds: 60 },
  async (request, response) => {
    if (request.method !== 'POST') { response.status(405).send('Method Not Allowed'); return; }
    let event: Stripe.Event;
    try {
      event = stripeClient().webhooks.constructEvent(request.rawBody, request.header('stripe-signature') || '', stripeWebhookKey.value());
    } catch (error) {
      response.status(400).json({ error: error instanceof Error ? error.message : 'Invalid Stripe signature.' });
      return;
    }

    const eventRef = db.collection('stripe_webhook_events').doc(event.id);
    try {
      await db.runTransaction(async (tx) => {
        const previous = await tx.get(eventRef);
        if (previous.exists && previous.get('processed') === true) return;
        const result = await eventSubscription(event, stripeClient());
        tx.set(eventRef, { event_type: event.type, received_at: new Date().toISOString(), processed: true });
        if (result) tx.set(db.collection('user_subscriptions').doc(result.userId), result.data, { merge: true });
      });
      response.status(200).json({ received: true });
    } catch (error) {
      response.status(500).json({ error: error instanceof Error ? error.message : 'Webhook processing failed.' });
    }
  }
);
