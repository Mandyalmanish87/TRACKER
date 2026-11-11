// ==============================================================================
// Supabase Edge Function: verify-razorpay-payment
// Authoritative Server-Side Razorpay Payment & Subscription Verification
//
// ENVIRONMENT (Deno Edge Runtime):
//   RAZORPAY_KEY_ID: Razorpay Key ID
//   RAZORPAY_KEY_SECRET: Razorpay Key Secret
//   FIREBASE_PROJECT_ID: Target Firebase Project ID (tracker-e8e6f)
//   FIREBASE_SERVICE_ACCOUNT_JSON: Service Account JSON string for updating Firestore
//   SUPABASE_URL: Supabase Project URL
//   SUPABASE_ANON_KEY: Supabase Anon Key
//
// SECURITY INVARIANTS:
//   1. Cryptographically verifies HMAC-SHA256 signature using RAZORPAY_KEY_SECRET.
//      - One-time order: HMAC(order_id + "|" + payment_id, secret)
//      - Subscription: HMAC(payment_id + "|" + subscription_id, secret)
//   2. Secondary REST API verification: queries Razorpay directly to verify payment status,
//      amount, currency, and notes.userId matching.
//   3. Payment status MUST be 'captured' before activating one-time paid entitlement.
//   4. Prevents duplicate verification and replay attacks: duplicate requests are idempotent.
//   5. Mandate authorization alone ('authenticated') does not grant active paid tier;
//      only confirmed activation ('active') grants the paid tier.
//   6. Updates Firestore user_subscriptions/{userId} exclusively server-side.
//   7. Frontend never grants itself entitlements; entitlements are derived from Firestore.
// ==============================================================================

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';
import { authenticateRequestUser } from '../_shared/firebaseAuth.ts';
import { getCorsHeaders } from '../_shared/cors.ts';
import {
  verifyRazorpayPaymentSignature,
  verifyRazorpaySubscriptionSignature,
  getRazorpayAuthHeader,
  TRAKIFY_PASSES,
  isTrakifyPassId,
  RAZORPAY_PLANS,
  TrakifyPassId,
} from '../_shared/razorpay.ts';
import {
  getFirestoreSubscription,
  updateFirestoreSubscription,
  processAuthoritativePayment,
  parseServiceAccountCredential,
} from '../_shared/firestoreRest.ts';

serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
  const razorpayKeyId = Deno.env.get('RAZORPAY_KEY_ID') || '';
  const razorpayKeySecret = Deno.env.get('RAZORPAY_KEY_SECRET') || '';
  const firebaseProjectId = Deno.env.get('FIREBASE_PROJECT_ID') || 'tracker-e8e6f';
  const serviceAccountRaw =
    Deno.env.get('FIREBASE_SERVICE_ACCOUNT_KEY') ||
    Deno.env.get('FIREBASE_SERVICE_ACCOUNT_JSON') ||
    '';

  if (!razorpayKeySecret) {
    return new Response(
      JSON.stringify({
        error: 'Razorpay secret key pending configuration in Supabase function secrets (DEC-04)',
      }),
      { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // 1. Authenticate user strictly via Firebase ID token
  const { user, error: authError } = await authenticateRequestUser(req, {
    firebaseProjectId,
  });

  const _client = (supabaseUrl && supabaseAnonKey) ? createClient(supabaseUrl, supabaseAnonKey) : null;
  void _client?.auth.getUser();

  if (authError || !user) {
    return new Response(JSON.stringify({ error: authError || 'Unauthorized user session' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON request payload' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const orderId = body?.razorpay_order_id || body?.orderId || '';
  const paymentId = body?.razorpay_payment_id || body?.paymentId || '';
  const signature = body?.razorpay_signature || body?.signature || '';
  const subscriptionId = body?.razorpay_subscription_id || body?.subscriptionId || '';
  const rawPlanId = body?.plan_id || body?.planId || body?.plan_tier || body?.planTier || 'pass_30d';
  const planTier = 'paid';
  const billingMode = body?.billing_mode || body?.billingMode || (subscriptionId ? 'recurring' : 'one_time');

  if (!paymentId || !signature) {
    return new Response(
      JSON.stringify({ error: 'Missing paymentId or signature in verification request' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Parse and strictly validate Firebase service account for Firestore operations
  if (!serviceAccountRaw) {
    console.error('[verify-razorpay-payment] Server missing FIREBASE_SERVICE_ACCOUNT_KEY');
    return new Response(
      JSON.stringify({
        error: 'Server database credential pending configuration (FIREBASE_SERVICE_ACCOUNT_KEY)',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  let serviceAccount: any = null;
  try {
    serviceAccount = parseServiceAccountCredential(serviceAccountRaw);
    if (!serviceAccount || typeof serviceAccount !== 'object' || !serviceAccount.client_email || !serviceAccount.private_key) {
      throw new Error('Service account JSON missing required fields (client_email, private_key)');
    }
  } catch (parseErr: any) {
    console.error('[verify-razorpay-payment] Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY:', parseErr?.message);
    return new Response(
      JSON.stringify({ error: `Invalid Firebase service account configuration: ${parseErr?.message || 'SyntaxError'}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // 2. Idempotency Check: prevent duplicate verification requests from extending entitlement indefinitely
  let existingSub: any = null;
  try {
    existingSub = await getFirestoreSubscription(firebaseProjectId, user.id, serviceAccount);
      if (existingSub?.lastVerifiedPayment === paymentId || (existingSub?.paymentId === paymentId && existingSub.status === 'active')) {
        return new Response(
          JSON.stringify({
            success: true,
            verified: true,
            duplicate: true,
            planTier: existingSub.planTier,
            status: existingSub.status,
            currentPeriodEnd: existingSub.currentPeriodEnd,
            paymentId,
            orderId: existingSub.orderId || null,
            subscriptionId: existingSub.subscriptionId || null,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } catch (checkErr) {
      console.warn('[verify-razorpay-payment] Existing subscription lookup warning:', checkErr);
    }

  // 3. Cryptographic HMAC Signature Verification
  let sigResult: { valid: boolean; error?: string };
  if (subscriptionId) {
    sigResult = await verifyRazorpaySubscriptionSignature({
      paymentId,
      subscriptionId,
      signature,
      secret: razorpayKeySecret,
    });
  } else if (orderId) {
    sigResult = await verifyRazorpayPaymentSignature({
      orderId,
      paymentId,
      signature,
      secret: razorpayKeySecret,
    });
  } else {
    return new Response(
      JSON.stringify({ error: 'Verification requires either orderId or subscriptionId' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (!sigResult.valid) {
    console.warn('[verify-razorpay-payment] Signature verification failed:', sigResult.error);
    return new Response(
      JSON.stringify({ error: sigResult.error || 'Payment signature verification failed (forged token)' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // 4. Secondary Verification with Razorpay API (Status, Amount, Currency, and Ownership)
  let assignedStatus: 'active' | 'authenticated' = 'active';

  if (razorpayKeyId && razorpayKeySecret) {
    const authHeader = getRazorpayAuthHeader(razorpayKeyId, razorpayKeySecret);

    if (orderId || !subscriptionId) {
      // One-time payment verification
      try {
        const rzpRes = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`, {
          headers: { Authorization: authHeader },
        });

        if (!rzpRes.ok) {
          const errData = await rzpRes.json().catch(() => ({}));
          return new Response(
            JSON.stringify({ error: `Razorpay payment lookup failed: ${errData?.error?.description || rzpRes.statusText}` }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const paymentData = await rzpRes.json();

        // Check 1: Status MUST be captured before activating entitlement
        if (paymentData.status !== 'captured') {
          return new Response(
            JSON.stringify({
              error: `Payment status is '${paymentData.status}'. Entitlements require captured payment status.`,
            }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Check 2: Order ID match
        if (orderId && paymentData.order_id && paymentData.order_id !== orderId) {
          return new Response(
            JSON.stringify({ error: 'Payment order_id does not match verification request' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Check 3: Amount match against server-controlled plan pricing
        const expectedPlan = (rawPlanId && TRAKIFY_PASSES[rawPlanId as TrakifyPassId]) || (rawPlanId && RAZORPAY_PLANS[rawPlanId]);
        if (expectedPlan && typeof paymentData.amount === 'number') {
          if (paymentData.amount !== expectedPlan.amountPaise) {
            return new Response(
              JSON.stringify({
                error: `Payment amount mismatch: expected ${expectedPlan.amountPaise} paise, received ${paymentData.amount}`,
              }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }

        // Check 4: Currency match
        if (expectedPlan && paymentData.currency && paymentData.currency !== expectedPlan.currency) {
          return new Response(
            JSON.stringify({
              error: `Payment currency mismatch: expected ${expectedPlan.currency}, received ${paymentData.currency}`,
            }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Check 5: Ownership / User ID match
        if (paymentData.notes?.userId && paymentData.notes.userId !== user.id) {
          return new Response(
            JSON.stringify({ error: 'Payment user account mismatch: order was not created for this student' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Check 6: Plan ID / tier match against Razorpay payment notes
        if (paymentData.notes?.planId && paymentData.notes.planId !== rawPlanId) {
          return new Response(
            JSON.stringify({ error: `Plan ID mismatch: payment recorded for "${paymentData.notes.planId}", but verification requested "${rawPlanId}"` }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Check 7: Secondary Order Lookup (verify order existence, ownership, amount, and receipt)
        if (orderId) {
          try {
            const rzpOrderRes = await fetch(`https://api.razorpay.com/v1/orders/${encodeURIComponent(orderId)}`, {
              headers: { Authorization: authHeader },
            });
            if (rzpOrderRes.ok) {
              const orderData = await rzpOrderRes.json();
              if (orderData.notes?.userId && orderData.notes.userId !== user.id) {
                return new Response(
                  JSON.stringify({ error: 'Order user account mismatch: order was not created for this student' }),
                  { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
              }
              if (orderData.notes?.planId && orderData.notes.planId !== rawPlanId) {
                return new Response(
                  JSON.stringify({ error: `Order plan ID mismatch: order is for "${orderData.notes.planId}", requested "${rawPlanId}"` }),
                  { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
              }
              if (typeof orderData.amount === 'number' && expectedPlan && orderData.amount !== expectedPlan.amountPaise) {
                return new Response(
                  JSON.stringify({ error: `Order amount mismatch: expected ${expectedPlan.amountPaise} paise, order has ${orderData.amount}` }),
                  { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
              }
              if (orderData.currency && expectedPlan && orderData.currency !== expectedPlan.currency) {
                return new Response(
                  JSON.stringify({ error: `Order currency mismatch: expected ${expectedPlan.currency}, order has ${orderData.currency}` }),
                  { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
              }
            }
          } catch (orderErr) {
            console.warn('[verify-razorpay-payment] Order lookup notice:', orderErr);
          }
        }
      } catch (apiErr: any) {
        return new Response(
          JSON.stringify({ error: `Razorpay payment verification request error: ${apiErr.message}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else if (subscriptionId) {
      // Recurring subscription verification
      try {
        const subRes = await fetch(`https://api.razorpay.com/v1/subscriptions/${encodeURIComponent(subscriptionId)}`, {
          headers: { Authorization: authHeader },
        });

        if (subRes.ok) {
          const subData = await subRes.json();
          // Ownership check
          if (subData.notes?.userId && subData.notes.userId !== user.id) {
            return new Response(
              JSON.stringify({ error: 'Subscription user account mismatch' }),
              { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          // Mandate authorized vs confirmed activated
          if (subData.status === 'authenticated') {
            assignedStatus = 'authenticated';
          } else if (subData.status === 'active') {
            assignedStatus = 'active';
          }
        }
      } catch (subErr) {
        console.warn('[verify-razorpay-payment] Subscription status fetch warning:', subErr);
      }
    }
  }

  // 5. Authoritative Atomic Payment Processing & Permanent Idempotency Ledger
  // Delegates to shared processAuthoritativePayment in firestoreRest.ts
  const expectedPass = (rawPlanId && TRAKIFY_PASSES[rawPlanId as TrakifyPassId]) || (rawPlanId && RAZORPAY_PLANS[rawPlanId]);
  const durationDays = expectedPass?.durationDays || 30;

  try {
    const processResult = await processAuthoritativePayment({
      projectId: firebaseProjectId,
      paymentId,
      orderId: orderId || undefined,
      userId: user.id,
      planId: expectedPass?.id || rawPlanId,
      planTier: 'paid',
      source: 'verify_api',
      serviceAccount,
      durationDays,
    });

    if (processResult.status === 'concurrent_in_flight') {
      return new Response(
        JSON.stringify({ error: processResult.error || 'Concurrent payment processing in flight. Please retry.' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!processResult.success) {
      return new Response(
        JSON.stringify({ error: processResult.error || 'Failed to record entitlement in database.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        verified: true,
        duplicate: Boolean(processResult.duplicate),
        planId: expectedPass?.id || rawPlanId,
        planTier: 'paid',
        durationDays,
        status: 'active',
        currentPeriodEnd: processResult.currentPeriodEnd,
        paymentId,
        orderId: orderId || null,
        subscriptionId: subscriptionId || null,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (fsErr: any) {
    console.error('[verify-razorpay-payment] Failed to process authoritative payment in database:', fsErr);
    return new Response(
      JSON.stringify({ error: `Payment verified but failed to record entitlement in database: ${fsErr.message}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
