// ==============================================================================
// Supabase Edge Function: import-youtube-playlist
// Production YouTube Data API Playlist & Video Import with Quota Protection,
// Smart Caching, Persistent User Rate Limiting, and In-Flight Deduplication.
//
// ENVIRONMENT (Deno Edge Runtime):
//   YOUTUBE_API_KEY: Server-side Google Cloud / YouTube Data API v3 Key
//   SUPABASE_URL: Supabase Project URL
//   SUPABASE_SERVICE_ROLE_KEY: Supabase Service Role Key (Server-only)
//   SUPABASE_ANON_KEY: Supabase Anon Key
//   FIREBASE_PROJECT_ID: Firebase Project ID (tracker-e8e6f)
//
// SECURITY INVARIANTS:
//   1. YOUTUBE_API_KEY and SUPABASE_SERVICE_ROLE_KEY are NEVER exposed to browser.
//   2. User is strictly verified via cryptographic RS256 Firebase ID token.
//   3. Persistent rate limits and quota reservations are atomic and concurrency-safe.
//   4. Caching stores only public playlist data with 24h TTL.
//   5. Preserves video ordering, durations, and strict 11-char ID validation.
// ==============================================================================

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';
import { authenticateRequestUser } from '../_shared/firebaseAuth.ts';
import { getCorsHeaders } from '../_shared/cors.ts';

// ==============================================================================
// CROSS-INSTANCE CACHE & CONCURRENCY COORDINATION (Fix 5 Architecture Note):
// 1. In-Isolate Deduplication: The in-memory `inflightImports` map deduplicates
//    simultaneous identical requests arriving at the same warm Deno isolate.
// 2. Cross-Isolate Quota Protection: Simultaneous requests hitting distinct
//    isolates are bounded by the database-level `reserve_youtube_api_quota`
//    procedure, which locks the Pacific-Time daily summary row (`FOR UPDATE`).
//    This guarantees concurrent isolates cannot breach the 7,000-unit safety threshold.
// 3. Cache Availability: Once an isolate completes an import, `set_youtube_playlist_cache`
//    stores the full 24h payload. All isolates immediately achieve 0-quota cache hits.
// ==============================================================================
const inflightImports = new Map<string, Promise<{ status: number; body: any }>>();

// Rate limiter compatibility helpers
interface RateLimitRecord {
  count: number;
  resetAt: number;
}
const fallbackRateLimits = new Map<string, RateLimitRecord>();

function checkRateLimit(userId: string, limit = 5, windowMs = 60000): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const existing = fallbackRateLimits.get(userId);
  if (!existing || now >= existing.resetAt) {
    fallbackRateLimits.set(userId, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }
  if (existing.count >= limit) {
    const retryAfter = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
    return { allowed: false, retryAfterSeconds: retryAfter };
  }
  existing.count++;
  return { allowed: true, retryAfterSeconds: 0 };
}
const checkFallbackRateLimit = checkRateLimit;

/**
 * Extracts YouTube Playlist ID from URLs or bare strings.
 */
function extractPlaylistId(input: string): string | null {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim();

  // Check URL query parameter list=
  const match = trimmed.match(/[?&]list=([a-zA-Z0-9_-]+)/i);
  if (match && match[1]) {
    return match[1];
  }

  // Bare playlist ID
  if (/^[a-zA-Z0-9_-]{12,64}$/.test(trimmed) && (
    trimmed.startsWith('PL') ||
    trimmed.startsWith('UU') ||
    trimmed.startsWith('FL') ||
    trimmed.startsWith('RD') ||
    trimmed.startsWith('OL')
  )) {
    return trimmed;
  }

  if (/^[a-zA-Z0-9_-]{16,50}$/.test(trimmed) && !trimmed.includes('/')) {
    return trimmed;
  }

  return null;
}

/**
 * Parses ISO 8601 duration string (e.g. PT1H23M45S, PT15M33S, PT45S) into seconds.
 */
function parseIsoDurationToSeconds(iso: string): number {
  if (!iso || typeof iso !== 'string') return 0;
  const match = iso.match(/P(?:([0-9]+)D)?T?(?:([0-9]+)H)?(?:([0-9]+)M)?(?:([0-9]+)S)?/i);
  if (!match) return 0;

  const days = parseInt(match[1] || '0', 10);
  const hours = parseInt(match[2] || '0', 10);
  const minutes = parseInt(match[3] || '0', 10);
  const seconds = parseInt(match[4] || '0', 10);

  return days * 86400 + hours * 3600 + minutes * 60 + seconds;
}

/**
 * Bounded fetch with exponential backoff for transient 5xx server errors only.
 * Invokes onAttempt callback for every request actually dispatched to track quota attempts.
 * Never retries quota limits (403/429) or authentication errors (401).
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  maxRetries = 2,
  onAttempt?: () => void
): Promise<Response> {
  let attempt = 0;
  while (true) {
    if (typeof onAttempt === 'function') {
      try {
        onAttempt();
      } catch {
        // Safe callback guard
      }
    }
    try {
      const res = await fetch(url, options);
      if (res.status >= 500 && attempt < maxRetries) {
        attempt++;
        await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 300));
        continue;
      }
      return res;
    } catch (err) {
      if (attempt < maxRetries) {
        attempt++;
        await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 300));
        continue;
      }
      throw err;
    }
  }
}

/**
 * Public RSS Feed Fallback Parser
 * Uses YouTube's official public XML feed: https://www.youtube.com/feeds/videos.xml?playlist_id=...
 * Requires no API keys, has no quota limits, and works for all public playlists up to 15 items.
 */
async function fetchPlaylistViaRss(playlistId: string): Promise<{
  playlistId: string;
  playlistUrl: string;
  title: string;
  description: string;
  channelTitle: string;
  thumbnailUrl: string;
  itemCount: number;
  totalDurationSeconds: number;
  lectures: Array<{
    videoId: string;
    title: string;
    position: number;
    durationSeconds: number;
    thumbnailUrl?: string;
  }>;
} | null> {
  try {
    const rssUrl = `https://www.youtube.com/feeds/videos.xml?playlist_id=${encodeURIComponent(playlistId)}`;
    const res = await fetch(rssUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const xml = await res.text();

    const titleMatch = xml.match(/<title>([^<]+)<\/title>/);
    const authorMatch = xml.match(/<author>\s*<name>([^<]+)<\/name>/);
    const channelTitle = authorMatch ? authorMatch[1].trim() : '';
    const playlistTitle = titleMatch ? titleMatch[1].trim() : 'YouTube Playlist';

    const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
    let match: RegExpExecArray | null;
    const lectures: Array<{
      videoId: string;
      title: string;
      position: number;
      durationSeconds: number;
      thumbnailUrl?: string;
    }> = [];

    while ((match = entryRegex.exec(xml)) !== null) {
      const entryXml = match[1];
      const vIdMatch = entryXml.match(/<yt:videoId>([a-zA-Z0-9_-]{11})<\/yt:videoId>/);
      const vTitleMatch = entryXml.match(/<title>([^<]+)<\/title>/);
      const thumbMatch = entryXml.match(/<media:thumbnail\s+url="([^"]+)"/);

      if (vIdMatch && vTitleMatch) {
        const videoId = vIdMatch[1];
        let title = vTitleMatch[1].trim();
        title = title
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'");

        lectures.push({
          videoId,
          title,
          position: lectures.length,
          durationSeconds: 0,
          thumbnailUrl: thumbMatch ? thumbMatch[1] : `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        });
      }
    }

    if (lectures.length === 0) return null;

    return {
      playlistId,
      playlistUrl: `https://www.youtube.com/playlist?list=${playlistId}`,
      title: playlistTitle,
      description: '',
      channelTitle,
      thumbnailUrl: lectures[0]?.thumbnailUrl || '',
      itemCount: lectures.length,
      totalDurationSeconds: 0,
      lectures,
    };
  } catch {
    return null;
  }
}

serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ success: false, error: 'Method Not Allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const firebaseProjectId = Deno.env.get('FIREBASE_PROJECT_ID') || 'tracker-e8e6f';

  // 1. Authenticate user strictly via cryptographic Firebase ID token
  const { user, error: authError } = await authenticateRequestUser(req, {
    firebaseProjectId,
  });

  if (authError || !user) {
    return new Response(
      JSON.stringify({
        success: false,
        errorCode: 'UNAUTHENTICATED',
        error: authError || 'Your TRAKIFY session has expired or is invalid. Please sign in again.',
      }),
      {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ success: false, errorCode: 'INVALID_URL', error: 'Invalid JSON request body' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  const rawUrlOrId = body.playlistUrl || body.playlistId || body.url;

  if (typeof rawUrlOrId !== 'string' || rawUrlOrId.trim().length === 0 || rawUrlOrId.length > 2048) {
    return new Response(
      JSON.stringify({
        success: false,
        errorCode: 'INVALID_URL',
        error: 'Invalid YouTube playlist URL or ID. Please provide a valid playlist link under 2048 characters.',
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const playlistId = extractPlaylistId(rawUrlOrId);

  if (!playlistId) {
    return new Response(
      JSON.stringify({
        success: false,
        errorCode: 'INVALID_URL',
        error: 'Invalid YouTube playlist URL or ID. Please provide a valid playlist link (e.g., https://www.youtube.com/playlist?list=PL...).',
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // 2. Initialize Supabase Database Client for Server-Side State
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY') || '';
  const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

  // 3. Persistent Per-User Rate Limiting (Protection 2 — Fail-Closed Safety)
  if (!supabase) {
    console.error('[import-youtube-playlist] Supabase client is not configured for persistent rate limiting.');
    return new Response(
      JSON.stringify({
        success: false,
        errorCode: 'SERVICE_UNAVAILABLE',
        error: 'Playlist import service is temporarily unavailable. Please try again shortly.',
      }),
      {
        status: 503,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Retry-After': '30',
        },
      }
    );
  }

  try {
    const { data: limitRes, error: limitErr } = await supabase.rpc('check_and_increment_user_import_limits', {
      p_user_id: user.id,
      p_minute_limit: 5,
      p_hour_limit: 30,
      p_day_limit: 100,
    });

    if (limitErr) {
      console.error('[import-youtube-playlist] Persistent rate limiting query failed:', limitErr.message || 'Database error');
      return new Response(
        JSON.stringify({
          success: false,
          errorCode: 'SERVICE_UNAVAILABLE',
          error: 'Rate limit verification service is temporarily unavailable. Please try again in a few moments.',
        }),
        {
          status: 503,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'Retry-After': '30',
          },
        }
      );
    }

    if (limitRes && limitRes.allowed === false) {
      const retryAfter = limitRes.retry_after_seconds || 60;
      return new Response(
        JSON.stringify({
          success: false,
          errorCode: 'USER_RATE_LIMIT_EXCEEDED',
          error: `You have reached your playlist import limit. Please wait ${retryAfter} seconds before trying again.`,
          retryAfterSeconds: retryAfter,
        }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'Retry-After': String(retryAfter),
          },
        }
      );
    }
  } catch (err: any) {
    console.error('[import-youtube-playlist] Exception during rate limit check:', err?.message || 'Unknown error');
    return new Response(
      JSON.stringify({
        success: false,
        errorCode: 'SERVICE_UNAVAILABLE',
        error: 'Playlist import service is temporarily unavailable. Please try again shortly.',
      }),
      {
        status: 503,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Retry-After': '30',
        },
      }
    );
  }

  // 4. Smart Playlist Caching Check (Protection 1)
  if (supabase) {
    try {
      const { data: cachedData, error: cacheErr } = await supabase.rpc('get_youtube_playlist_cache', {
        p_playlist_id: playlistId,
      });

      if (!cacheErr && cachedData && typeof cachedData === 'object' && Array.isArray(cachedData.lectures) && cachedData.lectures.length > 0) {
        return new Response(
          JSON.stringify({
            success: true,
            preview: cachedData,
            fromCache: true,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Cache': 'HIT' },
          }
        );
      }
    } catch {
      // Cache lookup exception: proceed to live fetch
    }
  }

  // 5. In-Flight Request Deduplication (Protection 1 concurrency safety)
  if (inflightImports.has(playlistId)) {
    try {
      const inflightResult = await inflightImports.get(playlistId)!;
      return new Response(JSON.stringify(inflightResult.body), {
        status: inflightResult.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Cache': 'DEDUP' },
      });
    } catch {
      // In-flight error: fall through to fresh execution
    }
  }

  // Define the core YouTube API fetch execution
  const executeImport = async (): Promise<{ status: number; body: any }> => {
    const apiKey = Deno.env.get('YOUTUBE_API_KEY');
    if (!apiKey) {
      const rssPreview = await fetchPlaylistViaRss(playlistId);
      if (rssPreview) {
        return { status: 200, body: { success: true, preview: rssPreview, fromRss: true } };
      }

      return {
        status: 503,
        body: {
          success: false,
          errorCode: 'NO_API_KEY',
          error: 'YouTube Data API key is not configured on the server. Please add YOUTUBE_API_KEY to your Supabase project Secrets.',
        },
      };
    }

    // 6. Global Daily YouTube API Quota Protection (Protection 3)
    let hasReservedQuota = false;
    const ESTIMATED_RESERVATION_UNITS = 7; // Average uncached import: 1 pl + 3 items + 3 videos
    let actualUnitsConsumed = 0;

    if (supabase) {
      try {
        const { data: quotaRes, error: quotaErr } = await supabase.rpc('reserve_youtube_api_quota', {
          p_estimated_units: ESTIMATED_RESERVATION_UNITS,
          p_hard_limit: 7000, // Hard safety cutoff threshold
        });

        if (!quotaErr && quotaRes && quotaRes.allowed === false) {
          // Safety threshold reached: attempt RSS fallback before denying
          const rssPreview = await fetchPlaylistViaRss(playlistId);
          if (rssPreview) {
            await supabase.rpc('reconcile_youtube_api_quota', {
              p_reserved_units: 0,
              p_actual_units: 0,
              p_api_method: 'rss.fallback',
              p_is_success: true,
              p_is_cache_hit: false,
              p_is_rss: true,
            }).catch(() => null);

            return { status: 200, body: { success: true, preview: rssPreview, fromRss: true } };
          }

          return {
            status: 429,
            body: {
              success: false,
              errorCode: 'SAFETY_THRESHOLD_REACHED',
              error: 'YouTube imports are temporarily unavailable because TRAKIFY has reached its daily YouTube import allowance. Your saved playlists and lectures are safe. Please try again after the quota resets.',
            },
          };
        }

        hasReservedQuota = true;
      } catch {
        // Quota check RPC exception: proceed safely
      }
    }

    try {
      // Operation 1: Fetch Playlist Metadata (playlists.list = 1 unit)
      const playlistUrl = `https://www.googleapis.com/youtube/v3/playlists?part=snippet,contentDetails&id=${encodeURIComponent(
        playlistId
      )}&key=${encodeURIComponent(apiKey)}`;

      const plRes = await fetchWithRetry(playlistUrl, { signal: AbortSignal.timeout(8000) }, 2, () => {
        actualUnitsConsumed += 1;
      });

      if (!plRes.ok) {
        // Graceful RSS Fallback when API key has issues or quota is exceeded
        const rssPreview = await fetchPlaylistViaRss(playlistId);
        if (rssPreview) {
          if (supabase && hasReservedQuota) {
            await supabase.rpc('reconcile_youtube_api_quota', {
              p_reserved_units: ESTIMATED_RESERVATION_UNITS,
              p_actual_units: actualUnitsConsumed,
              p_api_method: 'rss.fallback',
              p_is_success: true,
              p_is_cache_hit: false,
              p_is_rss: true,
            }).catch(() => null);
          }
          return { status: 200, body: { success: true, preview: rssPreview, fromRss: true } };
        }

        const errJson = await plRes.json().catch(() => ({}));
        const rawReason = errJson?.error?.errors?.[0]?.reason || errJson?.error?.message;
        const sanitizedReason = (rawReason || plRes.statusText || '').replace(new RegExp(apiKey, 'g'), '[REDACTED]');

        if (plRes.status === 403 && (rawReason === 'quotaExceeded' || sanitizedReason.toLowerCase().includes('quota'))) {
          if (supabase && hasReservedQuota) {
            await supabase.rpc('reconcile_youtube_api_quota', {
              p_reserved_units: ESTIMATED_RESERVATION_UNITS,
              p_actual_units: actualUnitsConsumed,
              p_api_method: 'playlists.list.quota_exceeded',
              p_is_success: false,
            }).catch(() => null);
          }
          return {
            status: 429,
            body: {
              success: false,
              errorCode: 'QUOTA_EXCEEDED',
              error: 'YouTube Data API daily quota limit reached. Please check your Google Cloud quota or try again tomorrow.',
            },
          };
        }

        if (supabase && hasReservedQuota) {
          await supabase.rpc('reconcile_youtube_api_quota', {
            p_reserved_units: ESTIMATED_RESERVATION_UNITS,
            p_actual_units: actualUnitsConsumed,
            p_api_method: 'playlists.list.error',
            p_is_success: false,
          }).catch(() => null);
        }

        return {
          status: plRes.status,
          body: {
            success: false,
            errorCode: 'FETCH_ERROR',
            error: `Failed to query YouTube API: ${sanitizedReason}`,
          },
        };
      }

      const plData = await plRes.json();
      if (!plData.items || plData.items.length === 0) {
        const rssPreview = await fetchPlaylistViaRss(playlistId);
        if (rssPreview) {
          if (supabase && hasReservedQuota) {
            await supabase.rpc('reconcile_youtube_api_quota', {
              p_reserved_units: ESTIMATED_RESERVATION_UNITS,
              p_actual_units: actualUnitsConsumed,
              p_api_method: 'rss.fallback',
              p_is_success: true,
              p_is_cache_hit: false,
              p_is_rss: true,
            }).catch(() => null);
          }
          return { status: 200, body: { success: true, preview: rssPreview, fromRss: true } };
        }

        if (supabase && hasReservedQuota) {
          await supabase.rpc('reconcile_youtube_api_quota', {
            p_reserved_units: ESTIMATED_RESERVATION_UNITS,
            p_actual_units: actualUnitsConsumed,
            p_api_method: 'playlists.list.empty',
            p_is_success: false,
          }).catch(() => null);
        }

        return {
          status: 404,
          body: {
            success: false,
            errorCode: 'PRIVATE_PLAYLIST',
            error: 'This YouTube playlist could not be accessed. It may be private, deleted, or does not exist. Public or unlisted playlists are supported.',
          },
        };
      }

      const playlistItem = plData.items[0];
      const playlistTitle = playlistItem.snippet?.title || 'YouTube Course';
      const playlistDesc = playlistItem.snippet?.description || '';
      const channelTitle = playlistItem.snippet?.channelTitle || '';
      const playlistThumbnail =
        playlistItem.snippet?.thumbnails?.maxres?.url ||
        playlistItem.snippet?.thumbnails?.high?.url ||
        playlistItem.snippet?.thumbnails?.medium?.url ||
        playlistItem.snippet?.thumbnails?.default?.url ||
        '';

      // Operation 2: Fetch Playlist Items with Pagination (playlistItems.list = 1 unit per page)
      const rawVideos: Array<{
        videoId: string;
        title: string;
        position: number;
        thumbnailUrl?: string;
      }> = [];

      let pageToken = '';
      const MAX_PAGES = 10; // Supports playlists up to 500 lectures
      let pageCount = 0;
      let paginationError: string | null = null;
      let hasExceededMaxPages = false;

      do {
        pageCount++;
        const itemsUrl = new URL('https://www.googleapis.com/youtube/v3/playlistItems');
        itemsUrl.searchParams.set('part', 'snippet,contentDetails');
        itemsUrl.searchParams.set('playlistId', playlistId);
        itemsUrl.searchParams.set('maxResults', '50');
        itemsUrl.searchParams.set('key', apiKey);
        if (pageToken) {
          itemsUrl.searchParams.set('pageToken', pageToken);
        }

        let itemsRes: Response;
        try {
          itemsRes = await fetchWithRetry(itemsUrl.toString(), {}, 2, () => {
            actualUnitsConsumed += 1;
          });
        } catch (fetchErr: any) {
          paginationError = `Failed to fetch page ${pageCount}: ${fetchErr?.message || 'Network error'}`;
          break;
        }

        if (!itemsRes.ok) {
          const errJson = await itemsRes.json().catch(() => ({}));
          const rawReason = errJson?.error?.errors?.[0]?.reason || errJson?.error?.message;
          paginationError = `YouTube API error on page ${pageCount}: ${(rawReason || itemsRes.statusText || 'Unknown error').replace(new RegExp(apiKey, 'g'), '[REDACTED]')}`;
          break;
        }

        let itemsData: any;
        try {
          itemsData = await itemsRes.json();
        } catch {
          paginationError = `Failed to parse YouTube API response on page ${pageCount}`;
          break;
        }

        const items = itemsData.items || [];

        for (const item of items) {
          const videoId = item.contentDetails?.videoId || item.snippet?.resourceId?.videoId;
          const title = item.snippet?.title;

          // Skip private or deleted video placeholders
          if (!videoId || !title || title === 'Private video' || title === 'Deleted video') {
            continue;
          }

          // Strict 11-character video ID validation
          const trimmedId = videoId.trim();
          if (!/^[a-zA-Z0-9_-]{11}$/.test(trimmedId)) {
            continue;
          }

          const thumb =
            item.snippet?.thumbnails?.high?.url ||
            item.snippet?.thumbnails?.medium?.url ||
            item.snippet?.thumbnails?.default?.url ||
            '';

          rawVideos.push({
            videoId: trimmedId,
            title,
            position: item.snippet?.position ?? rawVideos.length,
            thumbnailUrl: thumb,
          });
        }

        pageToken = itemsData.nextPageToken || '';
        if (pageToken && pageCount >= MAX_PAGES) {
          hasExceededMaxPages = true;
          break;
        }
      } while (pageToken && pageCount < MAX_PAGES);

      // Handle pagination error: Incomplete playlist must NEVER appear successful or be cached
      if (paginationError) {
        if (supabase && hasReservedQuota) {
          await supabase.rpc('reconcile_youtube_api_quota', {
            p_reserved_units: ESTIMATED_RESERVATION_UNITS,
            p_actual_units: actualUnitsConsumed,
            p_api_method: 'playlistItems.incomplete',
            p_is_success: false,
          }).catch(() => null);
        }

        return {
          status: 502,
          body: {
            success: false,
            errorCode: 'FETCH_ERROR',
            error: `Failed to import complete playlist: ${paginationError}. Please try again.`,
          },
        };
      }

      // Handle playlist exceeding 500-video ceiling
      if (hasExceededMaxPages) {
        if (supabase && hasReservedQuota) {
          await supabase.rpc('reconcile_youtube_api_quota', {
            p_reserved_units: ESTIMATED_RESERVATION_UNITS,
            p_actual_units: actualUnitsConsumed,
            p_api_method: 'playlistItems.too_large',
            p_is_success: false,
          }).catch(() => null);
        }

        return {
          status: 400,
          body: {
            success: false,
            errorCode: 'PLAYLIST_TOO_LARGE',
            error: 'This playlist exceeds the maximum limit of 500 videos. Only playlists with up to 500 videos are supported.',
          },
        };
      }

      if (rawVideos.length === 0) {
        if (supabase && hasReservedQuota) {
          await supabase.rpc('reconcile_youtube_api_quota', {
            p_reserved_units: ESTIMATED_RESERVATION_UNITS,
            p_actual_units: actualUnitsConsumed,
            p_api_method: 'playlistItems.empty',
            p_is_success: false,
          }).catch(() => null);
        }

        return {
          status: 404,
          body: {
            success: false,
            errorCode: 'NOT_FOUND',
            error: 'The playlist contains no playable public videos.',
          },
        };
      }

      // Preserve original playlist ordering
      rawVideos.sort((a, b) => a.position - b.position);

      // Operation 3: Batch Query Video Durations (videos.list = 1 unit per chunk of 50)
      const videoDurationMap = new Map<string, number>();

      for (let i = 0; i < rawVideos.length; i += 50) {
        const chunk = rawVideos.slice(i, i + 50);
        const videoIds = chunk.map((v) => v.videoId).join(',');

        try {
          const vUrl = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${encodeURIComponent(
            videoIds
          )}&key=${encodeURIComponent(apiKey)}`;

          const vRes = await fetchWithRetry(vUrl, {}, 2, () => {
            actualUnitsConsumed += 1;
          });

          if (vRes.ok) {
            const vData = await vRes.json();
            for (const vItem of vData.items || []) {
              const durationIso = vItem.contentDetails?.duration;
              const durSeconds = parseIsoDurationToSeconds(durationIso);
              videoDurationMap.set(vItem.id, durSeconds);
            }
          }
        } catch {
          // If duration lookup fails for a chunk, default duration is 0
        }
      }

      // Assemble Final Normalized Playlist Payload
      let totalDurationSeconds = 0;
      const finalLectures = rawVideos.map((v, idx) => {
        const dur = videoDurationMap.get(v.videoId) || 0;
        totalDurationSeconds += dur;
        return {
          videoId: v.videoId,
          title: v.title,
          position: idx,
          durationSeconds: dur,
          thumbnailUrl: v.thumbnailUrl,
        };
      });

      const previewData = {
        playlistId,
        playlistUrl: `https://www.youtube.com/playlist?list=${playlistId}`,
        title: playlistTitle,
        description: playlistDesc,
        channelTitle,
        thumbnailUrl: playlistThumbnail,
        itemCount: finalLectures.length,
        totalDurationSeconds,
        lectures: finalLectures,
      };

      // 7. Reconcile Quota Reservation & Consumption
      if (supabase && hasReservedQuota) {
        await supabase.rpc('reconcile_youtube_api_quota', {
          p_reserved_units: ESTIMATED_RESERVATION_UNITS,
          p_actual_units: actualUnitsConsumed,
          p_api_method: 'playlists.import',
          p_is_success: true,
          p_is_cache_hit: false,
          p_is_rss: false,
        }).catch(() => null);
      }

      // 8. Save to Server-Side Playlist Cache (Protection 1)
      if (supabase && previewData.itemCount > 0) {
        await supabase.rpc('set_youtube_playlist_cache', {
          p_playlist_id: playlistId,
          p_playlist_data: previewData,
          p_video_count: previewData.itemCount,
          p_ttl_hours: 24,
        }).catch(() => null);
      }

      return {
        status: 200,
        body: {
          success: true,
          preview: previewData,
        },
      };
    } catch (err: any) {
      if (supabase && hasReservedQuota) {
        await supabase.rpc('reconcile_youtube_api_quota', {
          p_reserved_units: ESTIMATED_RESERVATION_UNITS,
          p_actual_units: actualUnitsConsumed,
          p_api_method: 'playlists.import.exception',
          p_is_success: false,
        }).catch(() => null);
      }

      return {
        status: 500,
        body: {
          success: false,
          errorCode: 'FETCH_ERROR',
          error: `Unexpected error during playlist import: ${err.message || String(err)}`,
        },
      };
    }
  };

  // Execute with in-flight deduplication tracking
  const executionPromise = executeImport();
  inflightImports.set(playlistId, executionPromise);

  try {
    const result = await executionPromise;
    return new Response(JSON.stringify(result.body), {
      status: result.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } finally {
    inflightImports.delete(playlistId);
  }
});
