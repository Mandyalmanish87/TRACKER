// ==============================================================================
// Supabase Edge Function: create-customer-portal-session
// Authoritative Server-Side Customer Billing Portal Launcher
//
// ENVIRONMENT (Deno Edge Runtime):
//   STRIPE_SECRET_KEY: Stripe Restricted/Secret API Key
//   SUPABASE_URL: Supabase Project URL
//   SUPABASE_SERVICE_ROLE_KEY: Privileged key to query user_subscriptions
//
// SECURITY INVARIANTS:
//   1. Customer ID is retrieved exclusively from database (never supplied by client).
//   2. User authentication strictly validated via Authorization header JWT.
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
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY') || '';

  if (!stripeSecretKey || !supabaseUrl || !serviceRoleKey) {
    return new Response(
      JSON.stringify({ error: 'Billing provider credentials pending configuration (DEC-04)' }),
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

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const token = authHeader.replace(/^Bearer\s+/i, '');
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized user session' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Fetch customer_id from user_subscriptions table (Server-authoritative lookup)
  const { data: subData, error: subError } = await supabase
    .from('user_subscriptions')
    .select('customer_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (subError || !subData?.customer_id) {
    return new Response(
      JSON.stringify({ error: 'No active billing profile found for this account' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    // optional body
  }

  const returnUrl = body.return_url || 'https://tracker.app';

  try {
    const params = new URLSearchParams();
    params.append('customer', subData.customer_id);
    params.append('return_url', returnUrl);

    const stripeResponse = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeSecretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const portalData = await stripeResponse.json();
    if (!stripeResponse.ok) {
      console.error('[create-customer-portal-session] Stripe API error:', portalData);
      return new Response(
        JSON.stringify({ error: portalData.error?.message || 'Billing portal creation failed' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ portal_url: portalData.url }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('[create-customer-portal-session] Internal exception:', err);
    return new Response(JSON.stringify({ error: err.message || 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

