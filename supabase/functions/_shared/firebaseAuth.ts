// ==============================================================================
// Shared Helper: Strict Firebase ID Token Cryptographic Verifier
// Validates RS256 Firebase JWTs using Google's public JWK signing keys.
// Enforces signature, project ID, issuer, user ID, expiration, iat, and auth_time.
// Rejects Supabase JWTs and OAuth tokeninfo endpoints for payment security.
// ==============================================================================

export interface AuthenticatedFirebaseUser {
  id: string;
  email?: string;
  projectId: string;
}

interface GoogleJwk {
  kty: string;
  use: string;
  alg: string;
  n: string;
  e: string;
  kid: string;
}

let cachedJwks: { keys: GoogleJwk[]; expiresAt: number } | null = null;

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return atob(base64);
}

function base64UrlToUint8Array(str: string): Uint8Array {
  const binaryString = base64UrlDecode(str);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function getGooglePublicJwks(): Promise<GoogleJwk[]> {
  const now = Date.now();
  if (cachedJwks && cachedJwks.expiresAt > now) {
    return cachedJwks.keys;
  }

  const res = await fetch('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com');
  if (!res.ok) {
    throw new Error(`Failed to fetch Google public keys: ${res.status}`);
  }

  const cacheControl = res.headers.get('cache-control') || '';
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
  const maxAge = maxAgeMatch ? parseInt(maxAgeMatch[1], 10) * 1000 : 3600 * 1000;

  const data = await res.json();
  const keys: GoogleJwk[] = data.keys || [];

  cachedJwks = {
    keys,
    expiresAt: now + maxAge,
  };

  return keys;
}

/**
 * Authoritatively verifies a Firebase ID Token using Google's public JWKS.
 * Checks alg=RS256, signature, expiration, iat, auth_time, issuer, audience (projectId), and subject (uid).
 */
export async function verifyFirebaseIdToken(
  token: string,
  expectedProjectId: string
): Promise<{ user: AuthenticatedFirebaseUser | null; error?: string }> {
  if (!token || typeof token !== 'string') {
    return { user: null, error: 'Empty or missing authorization token' };
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    return { user: null, error: 'Malformed JWT: token must contain header, payload, and signature' };
  }

  const [headerB64, payloadB64, signatureB64] = parts;

  // 1. Decode & validate Header
  let header: { alg?: string; kid?: string; typ?: string };
  try {
    header = JSON.parse(base64UrlDecode(headerB64));
  } catch {
    return { user: null, error: 'Failed to parse token header JSON' };
  }

  if (header.alg !== 'RS256') {
    return { user: null, error: `Invalid token algorithm: expected RS256, received ${header.alg}` };
  }

  if (!header.kid) {
    return { user: null, error: 'Token header missing signing key identifier (kid)' };
  }

  // 2. Decode & validate Payload claims
  let payload: {
    aud?: string;
    iss?: string;
    sub?: string;
    exp?: number;
    iat?: number;
    auth_time?: number;
    email?: string;
  };
  try {
    payload = JSON.parse(base64UrlDecode(payloadB64));
  } catch {
    return { user: null, error: 'Failed to parse token payload JSON' };
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  const clockSkewTolerance = 300; // 5-minute tolerance for minor server clock drift

  // Claim 1: Expiration check (exp) - must be in the future
  if (typeof payload.exp !== 'number' || payload.exp <= (nowSeconds - clockSkewTolerance)) {
    return { user: null, error: 'Firebase ID token has expired' };
  }

  // Claim 2: Issued-at check (iat) - must be in the past
  if (typeof payload.iat !== 'number') {
    return { user: null, error: 'Token missing or invalid issued-at time (iat)' };
  }
  if (payload.iat > (nowSeconds + clockSkewTolerance)) {
    return { user: null, error: 'Token issued-at time (iat) is in the future' };
  }

  // Claim 3: Authentication time check (auth_time) - must be in the past
  if (typeof payload.auth_time !== 'number') {
    return { user: null, error: 'Token missing or invalid authentication time (auth_time)' };
  }
  if (payload.auth_time > (nowSeconds + clockSkewTolerance)) {
    return { user: null, error: 'Token authentication time (auth_time) is in the future' };
  }

  // Claim 4: Issuer check (iss) - must match https://securetoken.google.com/<projectId>
  const expectedIssuer = `https://securetoken.google.com/${expectedProjectId}`;
  if (payload.iss !== expectedIssuer) {
    return { user: null, error: `Invalid token issuer: expected ${expectedIssuer}, received ${payload.iss}` };
  }

  // Claim 5: Audience / Project check (aud) - must match target Firebase project ID
  if (payload.aud !== expectedProjectId) {
    return { user: null, error: `Invalid token audience: expected ${expectedProjectId}, received ${payload.aud}` };
  }

  // Claim 6: Subject / User ID check (sub) - must be a non-empty string UID
  if (!payload.sub || typeof payload.sub !== 'string' || payload.sub.trim() === '') {
    return { user: null, error: 'Token subject (sub / user ID) is empty or invalid' };
  }

  // 3. Cryptographically verify signature against Google's public JWK
  try {
    const jwks = await getGooglePublicJwks();
    const matchingKey = jwks.find((k) => k.kid === header.kid);
    if (!matchingKey) {
      return { user: null, error: `No matching Google public signing key found for kid: ${header.kid}` };
    }

    const cryptoKey = await crypto.subtle.importKey(
      'jwk',
      {
        kty: matchingKey.kty,
        n: matchingKey.n,
        e: matchingKey.e,
        alg: 'RS256',
        ext: true,
      },
      {
        name: 'RSASSA-PKCS1-v1_5',
        hash: 'SHA-256',
      },
      false,
      ['verify']
    );

    const signedData = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
    const signatureBytes = base64UrlToUint8Array(signatureB64);

    const isValidSignature = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      cryptoKey,
      signatureBytes,
      signedData
    );

    if (!isValidSignature) {
      return { user: null, error: 'Cryptographic signature verification failed' };
    }

    return {
      user: {
        id: payload.sub,
        email: payload.email,
        projectId: expectedProjectId,
      },
    };
  } catch (err: any) {
    return { user: null, error: `Signature verification exception: ${err.message}` };
  }
}

/**
 * Authenticates request exclusively using Firebase ID Token.
 * Rejects requests without valid tokens.
 */
export async function authenticateRequestUser(
  req: Request,
  options: {
    firebaseProjectId?: string;
    supabaseClient?: any;
  } = {}
): Promise<{ user: AuthenticatedFirebaseUser | null; error?: string }> {
  const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');
  if (!authHeader) {
    return { user: null, error: 'Missing Authorization header' };
  }

  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    return { user: null, error: 'Empty authorization token' };
  }

  const projectId = options.firebaseProjectId || Deno.env.get('FIREBASE_PROJECT_ID') || 'tracker-e8e6f';
  return verifyFirebaseIdToken(token, projectId);
}
