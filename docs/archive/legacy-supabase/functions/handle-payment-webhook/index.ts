// ==============================================================================
// Supabase Edge Function: handle-payment-webhook
// Secure Server-Side Stripe Webhook Handler
//
// ENVIRONMENT (Deno Edge Runtime):
//   STRIPE_WEBHOOK_SECRET: Secret key from Stripe Webhook Dashboard
//   SUPABASE_URL: Supabase Project URL
//   SUPABASE_SERVICE_ROLE_KEY: Privileged key to invoke process_subscription_webhook_event
//
// SECURITY INVARIANTS:
//   1. Runs exclusively server-side in Supabase Edge Runtime.
//   2. Cryptographically verifies raw-body HMAC-SHA256 signature and timestamp tolerance.
//   3. Never accessible or executable from client browser bundles.
// ==============================================================================

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

async function verifyStripeSignature(
  rawBody: string,
  signatureHeader: string,
  secret: string,
  toleranceSeconds = 300
): Promise<{ valid: boolean; error?: string }> {
  if (!signatureHeader || !secret) {
    return { valid: false, error: 'Missing stripe-signature header or signing secret' };
  }

  const tMatch = signatureHeader.match(/(?:^|,)t=(\d+)/);
  const v1Match = signatureHeader.match(/(?:^|,)v1=([a-fA-F0-9]+)/);

  if (!tMatch || !v1Match) {
    return { valid: false, error: 'Malformed stripe-signature header format' };
  }

  const timestamp = parseInt(tMatch[1], 10);
  const signature = v1Match[1].toLowerCase();

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > toleranceSeconds) {
    return { valid: false, error: `Signature timestamp outside tolerance window (${toleranceSeconds}s)` };
  }

  try {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signedPayload = encoder.encode(`${timestamp}.${rawBody}`);
    const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, signedPayload);
    const computedHex = Array.from(new Uint8Array(signatureBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    if (!constantTimeEqual(computedHex, signature)) {
      return { valid: false, error: 'Cryptographic signature mismatch' };
    }

    return { valid: true };
  } catch (err: any) {
    return { valid: false, error: `Signature verification exception: ${err.message}` };
  }
}

serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const signatureHeader = req.headers.get('stripe-signature') || '';
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') || '';
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

  if (!webhookSecret || !supabaseUrl || !serviceRoleKey) {
    console.error('[handle-payment-webhook] Server missing required environment secrets');
    return new Response(
      JSON.stringify({ error: 'Server payment configuration is pending deployment (DEC-04)' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const rawBody = await req.text();
  const verification = await verifyStripeSignature(rawBody, signatureHeader, webhookSecret);

  if (!verification.valid) {
    console.warn('[handle-payment-webhook] Signature verification rejected:', verification.error);
    return new Response(JSON.stringify({ error: verification.error }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Invalid JSON payload' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Privileged service-role client for state machine execution
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data, error } = await supabase.rpc('process_subscription_webhook_event', {
    p_event_id: event.id,
    p_event_type: event.type,
    p_payload: event,
  });

  if (error) {
    console.error('[handle-payment-webhook] RPC state machine failure:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ received: true, result: data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});

