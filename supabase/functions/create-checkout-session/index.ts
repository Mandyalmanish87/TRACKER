// ==============================================================================
// Supabase Edge Function: create-checkout-session
// Authoritative Server-Side Checkout Session Creation
//
// ENVIRONMENT (Deno Edge Runtime):
//   STRIPE_SECRET_KEY: Stripe Restricted/Secret API Key (sk_live_... / sk_test_...)
//   STRIPE_PRICE_ID_PRO: Server-controlled Price ID for Pro tier
//   STRIPE_PRICE_ID_COHORT: Server-controlled Price ID for Cohort Sponsor tier
//   SUPABASE_URL: Supabase Project URL
//   SUPABASE_ANON_KEY: Supabase Anon Key for user JWT verification
//
// SECURITY INVARIANTS:
//   1. Client NEVER passes amount, currency, or Price ID (Zero Client Trust).
//   2. User authentication strictly validated via Authorization header JWT.
//   3. User ID embedded server-side into client_reference_id and session metadata.
// ==============================================================================

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
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
  const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY') || '';
  const priceIdPro = Deno.env.get('STRIPE_PRICE_ID_PRO') || '';
  const priceIdCohort = Deno.env.get('STRIPE_PRICE_ID_COHORT') || '';

  if (!stripeSecretKey || !supabaseUrl || !supabaseAnonKey) {
    return new Response(
      JSON.stringify({
        error: 'Stripe provider credentials pending live configuration (DEC-04 / DEC-05)',
      }),
      { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Authenticate user via JWT
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized user session' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const planTier = body.plan_tier;
  const returnUrl = body.return_url || 'https://tracker.app';

  // Server-authoritative Price ID selection
  let selectedPriceId: string;
  if (planTier === 'cohort') {
    selectedPriceId = priceIdCohort;
  } else if (planTier === 'pro') {
    selectedPriceId = priceIdPro;
  } else {
    return new Response(JSON.stringify({ error: 'Invalid plan_tier requested' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (!selectedPriceId) {
    return new Response(
      JSON.stringify({ error: `Price ID not configured for plan tier: ${planTier}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Create hosted checkout session via Stripe REST API
  try {
    const params = new URLSearchParams();
    params.append('mode', 'subscription');
    params.append('payment_method_types[]', 'card');
    params.append('line_items[0][price]', selectedPriceId);
    params.append('line_items[0][quantity]', '1');
    params.append('client_reference_id', user.id);
    params.append('customer_email', user.email || '');
    params.append('metadata[user_id]', user.id);
    params.append('metadata[plan_tier]', planTier);
    params.append('subscription_data[metadata][user_id]', user.id);
    params.append('subscription_data[metadata][plan_tier]', planTier);
    params.append('success_url', `${returnUrl}?session_id={CHECKOUT_SESSION_ID}&status=success`);
    params.append('cancel_url', `${returnUrl}?status=cancelled`);

    const stripeResponse = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeSecretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const sessionData = await stripeResponse.json();
    if (!stripeResponse.ok) {
      console.error('[create-checkout-session] Stripe API error:', sessionData);
      return new Response(
        JSON.stringify({ error: sessionData.error?.message || 'Stripe session creation failed' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        checkout_url: sessionData.url,
        session_id: sessionData.id,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('[create-checkout-session] Internal exception:', err);
    return new Response(JSON.stringify({ error: err.message || 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

