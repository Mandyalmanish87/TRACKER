import { firebaseService } from './firebaseService';
import { getSupabaseClient } from './authService';
import { ImportPlaylistResponse, YouTubePlaylistPreview } from '../types/eduhub';
import { parseYouTubePlaylistId, parseYouTubeVideoId } from '../components/focus-radio/youtubeUtils';

/**
 * Parses ISO 8601 duration strings into total seconds.
 * e.g. "PT1H23M45S" -> 5025 seconds
 *      "PT15M30S"   -> 930 seconds
 *      "PT45S"      -> 45 seconds
 *      "P1DT2H"     -> 93600 seconds
 */
export function parseIso8601Duration(iso: string): number {
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
 * Validates and normalizes YouTube playlist preview responses.
 * Guarantees that only playlists with at least 1 valid playable video are accepted.
 */
export function validateAndNormalizePreview(rawPreview: any): YouTubePlaylistPreview | null {
  if (!rawPreview || typeof rawPreview !== 'object') return null;

  const rawLectures = Array.isArray(rawPreview.lectures)
    ? rawPreview.lectures
    : Array.isArray(rawPreview.items)
    ? rawPreview.items
    : [];

  const validLectures = rawLectures.filter(
    (l: any) => l && typeof l.videoId === 'string' && /^[a-zA-Z0-9_-]{11}$/.test(l.videoId.trim())
  );

  if (validLectures.length === 0) return null;

  return {
    playlistId: rawPreview.playlistId || '',
    playlistUrl: rawPreview.playlistUrl || '',
    title: rawPreview.title || 'YouTube Playlist',
    description: rawPreview.description || '',
    channelTitle: rawPreview.channelTitle || '',
    thumbnailUrl: rawPreview.thumbnailUrl || (validLectures[0] ? `https://img.youtube.com/vi/${validLectures[0].videoId}/hqdefault.jpg` : ''),
    itemCount: validLectures.length,
    totalDurationSeconds: typeof rawPreview.totalDurationSeconds === 'number' && rawPreview.totalDurationSeconds > 0
      ? rawPreview.totalDurationSeconds
      : validLectures.reduce((acc: number, l: any) => acc + (Number(l.durationSeconds) || 0), 0),
    lectures: validLectures.map((l: any, idx: number) => ({
      videoId: l.videoId.trim(),
      title: l.title || `Track ${idx + 1}`,
      position: typeof l.position === 'number' ? l.position : idx,
      durationSeconds: Number(l.durationSeconds) || 0,
      thumbnailUrl: l.thumbnailUrl || `https://img.youtube.com/vi/${l.videoId.trim()}/hqdefault.jpg`,
    })),
  };
}

/**
 * Cleans raw error messages by stripping internal stack traces, JWTs, or sensitive credentials.
 */
function sanitizeErrorMessage(msg?: string, fallback = 'An error occurred while importing the playlist.'): string {
  if (!msg || typeof msg !== 'string') return fallback;
  const firstLine = msg.split('\n')[0].trim();
  if (firstLine.includes('AIzaSy') || firstLine.includes('Bearer ') || firstLine.includes('eyJ')) {
    return 'Authentication or authorization failure during import.';
  }
  return firstLine || fallback;
}

/**
 * Securely requests YouTube playlist details and video items from the server-side
 * backend functions without exposing the YouTube API key in the browser.
 * Supports dual-backend architecture: Supabase Edge Functions with Firebase fallback.
 */
export async function fetchYouTubePlaylistPreview(
  playlistUrlOrId: string
): Promise<ImportPlaylistResponse> {
  const playlistId = parseYouTubePlaylistId(playlistUrlOrId);

  if (!playlistId) {
    const videoId = parseYouTubeVideoId(playlistUrlOrId);
    if (videoId) {
      return {
        success: false,
        errorCode: 'INVALID_URL',
        error:
          'The link you pasted is for a single YouTube video, not a course playlist. To import a single video, click "Add Lecture" on your course. For a full playlist, paste a link containing "list=" (e.g. https://www.youtube.com/playlist?list=PL...).',
      };
    }

    return {
      success: false,
      errorCode: 'INVALID_URL',
      error: 'Invalid YouTube playlist URL or ID. Please paste a full playlist link (e.g. https://www.youtube.com/playlist?list=PL...).',
    };
  }

  let freshToken: string | null = null;
  try {
    const auth = firebaseService.getAuth();
    if (auth?.currentUser) {
      freshToken = await auth.currentUser.getIdToken(true);
    }
  } catch (err) {
    console.warn('[YouTubePlaylistService] Could not retrieve fresh Firebase ID token:', err);
  }

  // 1. Try Supabase Edge Function first if configured
  const supabase = getSupabaseClient();
  if (supabase?.functions?.invoke) {
    try {
      const invokeResult = await supabase.functions.invoke('import-youtube-playlist', {
        headers: freshToken ? { Authorization: `Bearer ${freshToken}` } : undefined,
        body: { playlistUrl: playlistUrlOrId, playlistId },
      });

      const { data, error, response } = invokeResult as {
        data: any;
        error: any;
        response?: Response;
      };

      // Extract HTTP status and parse JSON response body if present
      const httpResponse = response || error?.context;
      const status = typeof httpResponse?.status === 'number' ? httpResponse.status : (error ? 0 : 200);

      let responseBody: any = null;
      if (data && typeof data === 'object') {
        responseBody = data;
      } else if (httpResponse && typeof httpResponse.json === 'function') {
        try {
          responseBody = await (typeof httpResponse.clone === 'function'
            ? httpResponse.clone().json()
            : httpResponse.json()
          ).catch(() => null);
        } catch {
          responseBody = null;
        }
      }

      // --- CASE A: Successful Response ---
      if (!error && (data?.success || responseBody?.success)) {
        const rawPreview = data?.preview || responseBody?.preview;
        const normalized = validateAndNormalizePreview(rawPreview);
        if (normalized) {
          return { success: true, preview: normalized };
        }
        return {
          success: false,
          errorCode: 'NOT_FOUND',
          error: 'This playlist contains no playable public videos.',
        };
      }

      // --- CASE B: Definitive Application Responses (Do NOT fall back to Firebase) ---
      // 1. 401 Unauthorized: Sign-in required or session expired
      if (status === 401 || responseBody?.errorCode === 'UNAUTHENTICATED') {
        const errorDetail = responseBody?.error || responseBody?.message || error?.message;
        return {
          success: false,
          errorCode: 'UNAUTHENTICATED',
          error: sanitizeErrorMessage(
            errorDetail,
            'Your TRAKIFY session has expired. Please sign in again.'
          ),
        };
      }

      // 2. 403 Forbidden: Access denied
      if (status === 403) {
        return {
          success: false,
          errorCode: responseBody?.errorCode || 'FETCH_ERROR',
          error: sanitizeErrorMessage(
            responseBody?.error,
            'This playlist is private or unavailable. Please check its visibility and try again.'
          ),
        };
      }

      // 3. 429 Too Many Requests: User rate limit, quota safety threshold, or Google API quota exceeded
      if (
        status === 429 ||
        responseBody?.errorCode === 'USER_RATE_LIMIT_EXCEEDED' ||
        responseBody?.errorCode === 'SAFETY_THRESHOLD_REACHED' ||
        responseBody?.errorCode === 'RATE_LIMIT_EXCEEDED' ||
        responseBody?.errorCode === 'QUOTA_EXCEEDED'
      ) {
        if (responseBody?.errorCode === 'SAFETY_THRESHOLD_REACHED') {
          return {
            success: false,
            errorCode: 'QUOTA_EXCEEDED',
            error: sanitizeErrorMessage(
              responseBody?.error,
              'YouTube imports are temporarily unavailable because TRAKIFY has reached its daily YouTube import allowance. Your saved playlists and lectures are safe. Please try again after the quota resets.'
            ),
          };
        }

        if (responseBody?.errorCode === 'USER_RATE_LIMIT_EXCEEDED') {
          return {
            success: false,
            errorCode: 'RATE_LIMIT_EXCEEDED',
            error: sanitizeErrorMessage(
              responseBody?.error,
              'You have reached your playlist import limit. Please try again later.'
            ),
          };
        }

        const isQuota =
          responseBody?.errorCode === 'QUOTA_EXCEEDED' ||
          String(responseBody?.error || '').toLowerCase().includes('quota');

        return {
          success: false,
          errorCode: isQuota ? 'QUOTA_EXCEEDED' : 'RATE_LIMIT_EXCEEDED',
          error: sanitizeErrorMessage(
            responseBody?.error,
            isQuota
              ? 'YouTube imports are temporarily unavailable because TRAKIFY has reached its daily YouTube import allowance. Your saved playlists and lectures are safe. Please try again after the quota resets.'
              : 'You have reached your playlist import limit. Please try again later.'
          ),
        };
      }

      // 4. 400 Bad Request: Invalid URL or parameters or playlist too large
      if (status === 400 || responseBody?.errorCode === 'INVALID_URL' || responseBody?.errorCode === 'PLAYLIST_TOO_LARGE') {
        const isTooLarge = responseBody?.errorCode === 'PLAYLIST_TOO_LARGE';
        return {
          success: false,
          errorCode: 'INVALID_URL',
          error: sanitizeErrorMessage(
            responseBody?.error,
            isTooLarge
              ? 'This playlist exceeds the maximum limit of 500 videos. Only playlists with up to 500 videos are supported.'
              : 'Please enter a valid public YouTube playlist link.'
          ),
        };
      }

      // 5. 404 with structured application error (PRIVATE_PLAYLIST or NOT_FOUND)
      if (
        status === 404 &&
        (responseBody?.errorCode === 'PRIVATE_PLAYLIST' || responseBody?.errorCode === 'NOT_FOUND')
      ) {
        return {
          success: false,
          errorCode: responseBody.errorCode,
          error: sanitizeErrorMessage(
            responseBody.error,
            responseBody.errorCode === 'PRIVATE_PLAYLIST'
              ? 'This playlist is private or unavailable. Please check its visibility and try again.'
              : 'The playlist contains no playable public videos.'
          ),
        };
      }

      // 6. 500 / 502 / 503 Server & Service Errors from the Edge Function
      if ((status === 500 || status === 502 || status === 503) && responseBody?.error) {
        return {
          success: false,
          errorCode: responseBody.errorCode || 'FETCH_ERROR',
          error: sanitizeErrorMessage(
            responseBody.error,
            'A server error occurred while importing the playlist. Please try again later.'
          ),
        };
      }

      // --- CASE C: Genuine Service Unavailable Condition ---
      // (e.g. Edge Function not deployed -> FunctionsRelayError / status 404 without our JSON body,
      //  or status 502/503/504 gateway error, or network fetch failure).
      // Only in this case, fall through to Firebase if configured.
    } catch {
      // Network or invocation exception: fall through to Firebase if configured
    }
  }

  // 2. Fallback to Firebase Cloud Function ONLY for genuine service-unavailable conditions
  if (firebaseService.isConfigured) {
    try {
      const data = await firebaseService.callFunction<
        { playlistUrl: string; playlistId: string },
        { success: boolean; preview?: any; errorCode?: ImportPlaylistResponse['errorCode']; error?: string }
      >('importYoutubePlaylist', { playlistUrl: playlistUrlOrId, playlistId });

      if (data && data.success && data.preview) {
        const normalized = validateAndNormalizePreview(data.preview);
        if (normalized) {
          return { success: true, preview: normalized };
        }
        return {
          success: false,
          errorCode: 'NOT_FOUND',
          error: 'This playlist contains no playable public videos.',
        };
      }

      if (data && !data.success) {
        return {
          success: false,
          errorCode: data.errorCode || 'FETCH_ERROR',
          error: sanitizeErrorMessage(data.error, 'Unable to load playlist details from YouTube.'),
        };
      }
    } catch (err: any) {
      const message = String(err?.message || '');
      const code = String(err?.code || '');

      if (code.includes('unauthenticated') || message.includes('Sign in')) {
        return {
          success: false,
          errorCode: 'UNAUTHENTICATED',
          error: 'Sign in to import a playlist.',
        };
      }
      if (code.includes('resource-exhausted') || message.includes('quota')) {
        return {
          success: false,
          errorCode: 'QUOTA_EXCEEDED',
          error: 'YouTube Data API daily quota limit reached. Please try again tomorrow.',
        };
      }
      if (code.includes('failed-precondition') || message.includes('configured')) {
        return {
          success: false,
          errorCode: 'NO_API_KEY',
          error: 'YouTube Data API key is not configured on the server.',
        };
      }
      if (code.includes('not-found') || message.includes('not-found')) {
        // If function itself is not deployed vs playlist content not found
        if (message.includes('Function') || message.includes('NOT_FOUND') || code === 'functions/not-found') {
          return {
            success: false,
            errorCode: 'FETCH_ERROR',
            error: 'Playlist import service is currently offline or unreachable. Please verify the URL or try again later.',
          };
        }
        return {
          success: false,
          errorCode: 'NOT_FOUND',
          error: 'Playlist could not be accessed. It may be private, deleted, or unavailable.',
        };
      }
      return {
        success: false,
        errorCode: 'FETCH_ERROR',
        error: 'Unable to connect to the playlist import service. Please check your internet connection.',
      };
    }
  }

  // Check if browser is currently offline
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return {
      success: false,
      errorCode: 'FETCH_ERROR',
      error: 'Unable to connect to the playlist import service. Please check your internet connection.',
    };
  }

  return {
    success: false,
    errorCode: 'FETCH_ERROR',
    error: 'Playlist import service is currently offline or unreachable. Please verify the URL or try again later.',
  };
}

