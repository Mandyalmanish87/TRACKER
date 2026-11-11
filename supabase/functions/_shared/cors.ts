// ==============================================================================
// Shared Helper: Strict CORS Configuration for TRACKER
// Restricts allowed origins to recognized development and production domains.
// Rejects wildcard '*' in production to prevent cross-site request hijacking.
// ==============================================================================

const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
  'https://tracker-e8e6f.web.app',
  'https://tracker-e8e6f.firebaseapp.com',
  'https://tracker.app',
];

export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') || req.headers.get('origin') || '';
  const configuredOrigins = Deno.env.get('ALLOWED_ORIGINS')
    ? Deno.env.get('ALLOWED_ORIGINS')!.split(',').map((o) => o.trim())
    : [];

  const allAllowed = [...ALLOWED_ORIGINS, ...configuredOrigins];

  const isAllowed = allAllowed.includes(origin);
  const allowedOrigin = isAllowed ? origin : allAllowed[0];

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}
