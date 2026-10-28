import { getSupabaseClient, isSupabaseConfigured } from './authService';
import { ImportPlaylistResponse, YouTubePlaylistPreview } from '../types/eduhub';
import { parseYouTubePlaylistId } from '../components/focus-radio/youtubeUtils';

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
 * Securely requests YouTube playlist details and all video items from the server-side
 * Supabase Edge Function without exposing the YouTube API key in the browser.
 */
export async function fetchYouTubePlaylistPreview(
  playlistUrlOrId: string
): Promise<ImportPlaylistResponse> {
  const playlistId = parseYouTubePlaylistId(playlistUrlOrId);

  if (!playlistId) {
    return {
      success: false,
      errorCode: 'INVALID_URL',
      error: 'Invalid YouTube playlist URL or ID. Please paste a full playlist link (e.g. https://www.youtube.com/playlist?list=PL...).',
    };
  }

  const supabase = getSupabaseClient();

  if (!supabase || !isSupabaseConfigured) {
    return {
      success: false,
      errorCode: 'NO_API_KEY',
      error:
        'Cloud backend is currently in local offline mode. To automatically import YouTube playlists, connect your Supabase project with YOUTUBE_API_KEY configured.',
    };
  }

  try {
    const { data, error } = await supabase.functions.invoke('import-youtube-playlist', {
      body: {
        playlistUrl: playlistUrlOrId,
        playlistId,
      },
    });

    if (error) {
      let friendlyMessage = error.message || 'Failed to import playlist.';
      let code: ImportPlaylistResponse['errorCode'] = 'FETCH_ERROR';

      // Read JSON payload from Edge Function response if available
      if (error && 'context' in error && typeof (error as any).context?.json === 'function') {
        try {
          const bodyJson = await (error as any).context.json();
          if (bodyJson?.error) friendlyMessage = bodyJson.error;
          if (bodyJson?.errorCode) code = bodyJson.errorCode;
        } catch {}
      }

      if (friendlyMessage.includes('YOUTUBE_API_KEY') || friendlyMessage.includes('API key is not configured')) {
        code = 'NO_API_KEY';
        friendlyMessage =
          'YouTube Data API key is not yet configured in Supabase Secrets. Set YOUTUBE_API_KEY in your Supabase dashboard or CLI.';
      } else if (friendlyMessage.includes('quota')) {
        code = 'QUOTA_EXCEEDED';
        friendlyMessage =
          'YouTube Data API daily quota limit reached. Please try again tomorrow or upgrade your Google Cloud quota.';
      } else if (friendlyMessage.includes('private') || friendlyMessage.includes('could not be accessed')) {
        code = 'PRIVATE_PLAYLIST';
        friendlyMessage =
          'Playlist could not be accessed. It may be private or deleted. Only public or unlisted playlists are supported.';
      }

      return {
        success: false,
        errorCode: code,
        error: friendlyMessage,
      };
    }

    if (!data || !data.success || !data.preview) {
      return {
        success: false,
        errorCode: data?.errorCode || 'FETCH_ERROR',
        error: data?.error || 'Unable to load playlist details from YouTube.',
      };
    }

    return {
      success: true,
      preview: data.preview as YouTubePlaylistPreview,
    };
  } catch (err: any) {
    return {
      success: false,
      errorCode: 'FETCH_ERROR',
      error: err.message || 'Network error communicating with the playlist import service.',
    };
  }
}

