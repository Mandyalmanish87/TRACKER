// ==============================================================================
// Supabase Edge Function: recover-razorpay-payment
// Secure Server-Side Recovery of Captured Razorpay Payments
//
// ENVIRONMENT (Deno Edge Runtime):
//   RAZORPAY_KEY_ID: Razorpay Key ID (rzp_test_... / rzp_live_...)
//   RAZORPAY_KEY_SECRET: Razorpay Key Secret
//   FIREBASE_PROJECT_ID: Target Firebase Project ID (tracker-e8e6f)
//   FIREBASE_SERVICE_ACCOUNT_KEY: Firebase service account private key JSON
//   SUPABASE_URL: Supabase Project URL
//   SUPABASE_ANON_KEY: Supabase Anon Key
//
// SECURITY INVARIANTS:
//   1. Authenticate student strictly via cryptographic Firebase ID token.
//   2. Accept ONLY existing paymentId and orderId from client (Zero Client Trust).
//   3. Server queries Razorpay REST API using server-side Basic Auth credentials.
//   4. Independently validate:
//      - Payment status is strictly 'captured'
//      - Payment ID and Order ID cross-reference perfectly
//      - Currency is 'INR'
//      - Amount matches server-authoritative pass pricing exactly
//      - Razorpay order notes.userId matches authenticated user.id strictly
//      - Plan ID is one of 5 valid TRAKIFY passes (pass_7d .. pass_1460d)
//   5. Entitlements are processed exclusively through processAuthoritativePayment
//      in firestoreRest.ts, preserving atomic ledger idempotency and pass stacking.
//   6. Zero mock success, zero direct Firestore writes, zero double-crediting.
// ==============================================================================

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';
import { authenticateRequestUser } from '../_shared/firebaseAuth.ts';
import { getCorsHeaders } from '../_shared/cors.ts';
import {
  TRAKIFY_PASSES,
  TrakifyPassId,
  isTrakifyPassId,
  getRazorpayAuthHeader,
} from '../_shared/razorpay.ts';
import {
  processAuthoritativePayment,
  getPaymentRecord,
  getFirestoreSubscription,
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
    Deno.env.get('FIREBASE_SERVICE_ACCOUNT');

  if (!razorpayKeyId || !razorpayKeySecret) {
    return new Response(
      JSON.stringify({
        error: 'Razorpay provider credentials pending configuration in Supabase function secrets (DEC-04 / DEC-05)',
      }),
      { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (!serviceAccountRaw) {
    console.error('[recover-razorpay-payment] Server missing FIREBASE_SERVICE_ACCOUNT_KEY');
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
    console.error('[recover-razorpay-payment] Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY:', parseErr?.message);
    return new Response(
      JSON.stringify({ error: `Invalid Firebase service account configuration: ${parseErr?.message || 'SyntaxError'}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // 1. Authenticate user strictly via cryptographic Firebase ID token
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

  const paymentId = (body?.payment_id || body?.paymentId || '').trim();
  const orderId = (body?.order_id || body?.orderId || '').trim();

  // Validate input parameters format
  if (!paymentId || !/^pay_[a-zA-Z0-9_]{8,60}$/.test(paymentId)) {
    return new Response(
      JSON.stringify({ error: 'Invalid or missing Razorpay payment ID. Format must be pay_...' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (!orderId || !/^order_[a-zA-Z0-9_]{8,60}$/.test(orderId)) {
    return new Response(
      JSON.stringify({ error: 'Invalid or missing Razorpay order ID. Format must be order_...' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // 2. Idempotency Pre-Check: If payment was already recorded in permanent ledger
  try {
    const existingRecord = await getPaymentRecord(firebaseProjectId, paymentId, serviceAccount);
    if (existingRecord?.status === 'processed') {
      const existingSub = await getFirestoreSubscription(firebaseProjectId, user.id, serviceAccount);
      return new Response(
        JSON.stringify({
          success: true,
          verified: true,
          recovered: true,
          duplicate: true,
          planId: existingRecord.planId,
          planTier: 'paid',
          durationDays: existingRecord.durationDays || 30,
          status: 'active',
          currentPeriodEnd: existingRecord.periodEnd || existingSub?.currentPeriodEnd || new Date().toISOString(),
          paymentId,
          orderId,
          message: 'Payment was already recovered and credited to your account.',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (checkErr) {
    console.warn('[recover-razorpay-payment] Existing record check notice:', checkErr);
  }

  // 3. Authenticated Razorpay REST API Lookups
  const authHeader = getRazorpayAuthHeader(razorpayKeyId, razorpayKeySecret);

  let paymentData: any;
  try {
    const rzpRes = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`, {
      headers: { Authorization: authHeader },
      signal: AbortSignal.timeout(10000),
    });

    if (!rzpRes.ok) {
      const errData = await rzpRes.json().catch(() => ({}));
      return new Response(
        JSON.stringify({ error: `Razorpay payment lookup failed: ${errData?.error?.description || rzpRes.statusText}` }),
        { status: rzpRes.status === 404 ? 404 : 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    paymentData = await rzpRes.json();
  } catch (fetchErr: any) {
    console.error('[recover-razorpay-payment] Razorpay payment fetch exception:', fetchErr);
    return new Response(
      JSON.stringify({ error: `Failed to query Razorpay payment API: ${fetchErr.message}` }),
      { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  let orderData: any;
  try {
    const orderRes = await fetch(`https://api.razorpay.com/v1/orders/${encodeURIComponent(orderId)}`, {
      headers: { Authorization: authHeader },
      signal: AbortSignal.timeout(10000),
    });

    if (!orderRes.ok) {
      const errData = await orderRes.json().catch(() => ({}));
      return new Response(
        JSON.stringify({ error: `Razorpay order lookup failed: ${errData?.error?.description || orderRes.statusText}` }),
        { status: orderRes.status === 404 ? 404 : 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    orderData = await orderRes.json();
  } catch (fetchErr: any) {
    console.error('[recover-razorpay-payment] Razorpay order fetch exception:', fetchErr);
    return new Response(
      JSON.stringify({ error: `Failed to query Razorpay order API: ${fetchErr.message}` }),
      { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // 4. Strict Zero-Trust Validations
  // A. Payment Status MUST be 'captured'
  if (paymentData.status !== 'captured') {
    return new Response(
      JSON.stringify({
        error: `Payment status is '${paymentData.status}'. Only successfully captured payments can be recovered.`,
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // B. Payment ID match
  if (paymentData.id !== paymentId) {
    return new Response(
      JSON.stringify({ error: `Payment ID mismatch: expected ${paymentId}, received ${paymentData.id}` }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // C. Order ID cross-reference match
  if (paymentData.order_id !== orderId || orderData.id !== orderId) {
    return new Response(
      JSON.stringify({ error: 'Payment does not belong to the provided order ID' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // D. Currency match
  if (paymentData.currency !== 'INR' || orderData.currency !== 'INR') {
    return new Response(
      JSON.stringify({ error: `Invalid currency: '${paymentData.currency}'. Only INR payments are supported.` }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // E. Ownership match (Strict User ID check)
  const orderUserId = orderData.notes?.userId || paymentData.notes?.userId;
  if (!orderUserId || orderUserId !== user.id) {
    return new Response(
      JSON.stringify({ error: 'Payment user account mismatch: this payment was not created for your account' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // F. Plan ID validation from order notes
  const rawPlanId = orderData.notes?.planId || paymentData.notes?.planId;
  if (!rawPlanId || !isTrakifyPassId(rawPlanId)) {
    return new Response(
      JSON.stringify({
        error: `Invalid or retired plan ID: "${rawPlanId}". Only official TRAKIFY passes can be recovered.`,
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const passConfig = TRAKIFY_PASSES[rawPlanId as TrakifyPassId];

  // G. Amount match against server-authoritative pass pricing
  if (paymentData.amount !== passConfig.amountPaise || orderData.amount !== passConfig.amountPaise) {
    return new Response(
      JSON.stringify({
        error: `Payment amount mismatch: ${passConfig.name} requires ${passConfig.amountPaise} paise, but payment is for ${paymentData.amount} paise`,
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // 5. Authoritative Atomic Ledger & Subscription Update
  try {
    const processResult = await processAuthoritativePayment({
      projectId: firebaseProjectId,
      paymentId,
      orderId,
      userId: user.id,
      planId: passConfig.id,
      planTier: 'paid',
      source: 'recovery_api',
      serviceAccount,
      durationDays: passConfig.durationDays,
      amountPaise: paymentData.amount,
      currency: 'INR',
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
        recovered: true,
        duplicate: Boolean(processResult.duplicate),
        planId: passConfig.id,
        planTier: 'paid',
        durationDays: passConfig.durationDays,
        status: 'active',
        currentPeriodEnd: processResult.currentPeriodEnd,
        paymentId,
        orderId,
        message: 'Payment recovered successfully. Pass has been activated.',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (fsErr: any) {
    console.error('[recover-razorpay-payment] Failed to process authoritative recovery in database:', fsErr);
    return new Response(
      JSON.stringify({ error: `Payment validated but failed to record entitlement in database: ${fsErr.message}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
