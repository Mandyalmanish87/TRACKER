// ==============================================================================
// Supabase Edge Function: create-razorpay-subscription (DEPRECATED)
// RETIRED: Razorpay recurring subscriptions and mandates have been retired.
// TRAKIFY operates exclusively on one-time orders via create-razorpay-order.
// Razorpay Plan IDs (RAZORPAY_PLAN_ID_PRO / RAZORPAY_PLAN_ID_COHORT) are obsolete.
// ==============================================================================

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { getCorsHeaders } from '../_shared/cors.ts';

serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  return new Response(
    JSON.stringify({
      error: 'Recurring subscriptions have been retired. TRAKIFY uses one-time orders only via create-razorpay-order.',
      deprecated: true,
    }),
    { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
});
