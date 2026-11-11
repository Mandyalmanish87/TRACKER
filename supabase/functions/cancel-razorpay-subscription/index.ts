// ==============================================================================
// Supabase Edge Function: cancel-razorpay-subscription (DEPRECATED)
// RETIRED: Razorpay recurring subscriptions have been retired.
// One-time membership passes expire automatically without auto-renewals.
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
      error: 'Recurring subscriptions have been retired. TRAKIFY uses one-time passes which expire automatically with no recurring charges.',
      deprecated: true,
    }),
    { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
});
