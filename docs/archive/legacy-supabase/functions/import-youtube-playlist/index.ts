// ==============================================================================
// Supabase Edge Function: import-youtube-playlist
// Server-side YouTube Data API Playlist & Video Import
//
// ENVIRONMENT (Deno Edge Runtime):
//   YOUTUBE_API_KEY: Server-side Google Cloud / YouTube Data API v3 Key
//   SUPABASE_URL: (Optional) Supabase Project URL
//   SUPABASE_ANON_KEY: (Optional) Supabase Anon Key
//
// SECURITY INVARIANTS:
//   1. YOUTUBE_API_KEY is NEVER exposed to the frontend browser.
//   2. Validates playlist URLs and IDs strictly.
//   3. Handles private, deleted, and unavailable videos gracefully.
//   4. Handles pagination and quota limits with informative error responses.
// ==============================================================================

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ success: false, error: 'Method Not Allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ success: false, error: 'Invalid JSON request body' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const rawUrlOrId = body.playlistUrl || body.playlistId || body.url;
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

  const apiKey = Deno.env.get('YOUTUBE_API_KEY');
  if (!apiKey) {
    return new Response(
      JSON.stringify({
        success: false,
        errorCode: 'NO_API_KEY',
        error: 'YouTube Data API key is not configured on the server. Please add YOUTUBE_API_KEY to your Supabase project Secrets.',
      }),
      { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // 1. Fetch Playlist Metadata
    const playlistUrl = `https://www.googleapis.com/youtube/v3/playlists?part=snippet,contentDetails&id=${encodeURIComponent(
      playlistId
    )}&key=${encodeURIComponent(apiKey)}`;

    const plRes = await fetch(playlistUrl);
    if (!plRes.ok) {
      const errJson = await plRes.json().catch(() => ({}));
      const reason = errJson?.error?.errors?.[0]?.reason || errJson?.error?.message;

      if (plRes.status === 403 && reason === 'quotaExceeded') {
        return new Response(
          JSON.stringify({
            success: false,
            errorCode: 'QUOTA_EXCEEDED',
            error: 'YouTube Data API daily quota limit reached. Please check your Google Cloud quota or try again tomorrow.',
          }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          success: false,
          errorCode: 'FETCH_ERROR',
          error: `Failed to query YouTube API: ${reason || plRes.statusText}`,
        }),
        { status: plRes.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const plData = await plRes.json();
    if (!plData.items || plData.items.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          errorCode: 'PRIVATE_PLAYLIST',
          error: 'This YouTube playlist could not be accessed. It may be private, deleted, or does not exist. Public or unlisted playlists are supported.',
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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

    // 2. Fetch Playlist Items with Pagination
    const rawVideos: Array<{
      videoId: string;
      title: string;
      position: number;
      thumbnailUrl?: string;
    }> = [];

    let pageToken = '';
    const MAX_PAGES = 10; // Supports playlists up to 500 lectures
    let pageCount = 0;

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

      const itemsRes = await fetch(itemsUrl.toString());
      if (!itemsRes.ok) {
        break;
      }

      const itemsData = await itemsRes.json();
      const items = itemsData.items || [];

      for (const item of items) {
        const videoId = item.contentDetails?.videoId || item.snippet?.resourceId?.videoId;
        const title = item.snippet?.title;

        // Skip private or deleted video placeholders
        if (!videoId || !title || title === 'Private video' || title === 'Deleted video') {
          continue;
        }

        const thumb =
          item.snippet?.thumbnails?.high?.url ||
          item.snippet?.thumbnails?.medium?.url ||
          item.snippet?.thumbnails?.default?.url ||
          '';

        rawVideos.push({
          videoId,
          title,
          position: item.snippet?.position ?? rawVideos.length,
          thumbnailUrl: thumb,
        });
      }

      pageToken = itemsData.nextPageToken || '';
    } while (pageToken && pageCount < MAX_PAGES);

    if (rawVideos.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          errorCode: 'NOT_FOUND',
          error: 'The playlist contains no playable public videos.',
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Sort to guarantee preserved original playlist order
    rawVideos.sort((a, b) => a.position - b.position);

    // 3. Batch Query Video Durations (up to 50 IDs per call)
    const videoDurationMap = new Map<string, number>();

    for (let i = 0; i < rawVideos.length; i += 50) {
      const chunk = rawVideos.slice(i, i + 50);
      const videoIds = chunk.map((v) => v.videoId).join(',');

      try {
        const vUrl = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${encodeURIComponent(
          videoIds
        )}&key=${encodeURIComponent(apiKey)}`;

        const vRes = await fetch(vUrl);
        if (vRes.ok) {
          const vData = await vRes.json();
          for (const vItem of vData.items || []) {
            const durationIso = vItem.contentDetails?.duration;
            const durSeconds = parseIsoDurationToSeconds(durationIso);
            videoDurationMap.set(vItem.id, durSeconds);
          }
        }
      } catch {
        // Fallback: If duration lookup fails for a chunk, default duration is 0
      }
    }

    // 4. Assemble Final Lectures & Total Duration
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

    return new Response(
      JSON.stringify({
        success: true,
        preview: {
          playlistId,
          playlistUrl: `https://www.youtube.com/playlist?list=${playlistId}`,
          title: playlistTitle,
          description: playlistDesc,
          channelTitle,
          thumbnailUrl: playlistThumbnail,
          itemCount: finalLectures.length,
          totalDurationSeconds,
          lectures: finalLectures,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        success: false,
        errorCode: 'FETCH_ERROR',
        error: `Unexpected error during playlist import: ${err.message || String(err)}`,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

