import { defineSecret } from 'firebase-functions/params';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
export { trackerRpc } from './trackerRpc.js';

const youtubeApiKey = defineSecret('YOUTUBE_API_KEY');

function extractPlaylistId(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const value = input.trim();
  const fromUrl = value.match(/[?&]list=([a-zA-Z0-9_-]+)/i)?.[1];
  if (fromUrl) return fromUrl;
  return /^[a-zA-Z0-9_-]{12,64}$/.test(value) ? value : null;
}

function durationSeconds(iso = ''): number {
  const match = iso.match(/P(?:([0-9]+)D)?T?(?:([0-9]+)H)?(?:([0-9]+)M)?(?:([0-9]+)S)?/i);
  if (!match) return 0;
  return Number(match[1] || 0) * 86400 + Number(match[2] || 0) * 3600 + Number(match[3] || 0) * 60 + Number(match[4] || 0);
}

async function fetchPlaylistViaRss(playlistId: string) {
  try {
    const rssUrl = `https://www.youtube.com/feeds/videos.xml?playlist_id=${encodeURIComponent(playlistId)}`;
    const res = await fetch(rssUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
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

async function youtubeJson(url: URL, key: string) {
  url.searchParams.set('key', key);
  const response = await fetch(url);
  const body: any = await response.json().catch(() => ({}));
  if (!response.ok) {
    const reason = body?.error?.errors?.[0]?.reason || body?.error?.message || response.statusText;
    if (response.status === 403 && reason === 'quotaExceeded') {
      throw new HttpsError('resource-exhausted', 'YouTube Data API quota limit reached. Please try again tomorrow.');
    }
    throw new HttpsError('unavailable', `YouTube request failed: ${reason}`);
  }
  return body;
}

export const importYoutubePlaylist = onCall(
  { secrets: [youtubeApiKey], timeoutSeconds: 120, memory: '512MiB' },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in to import a playlist.');
    const playlistId = extractPlaylistId(request.data?.playlistUrl || request.data?.playlistId);
    if (!playlistId) throw new HttpsError('invalid-argument', 'Provide a valid YouTube playlist link or ID.');
    const key = youtubeApiKey.value();
    if (!key) {
      const rss = await fetchPlaylistViaRss(playlistId);
      if (rss) return { success: true, preview: rss };
      throw new HttpsError('failed-precondition', 'YouTube import is not configured on the Firebase server.');
    }

    try {
      const playlistUrl = new URL('https://www.googleapis.com/youtube/v3/playlists');
      playlistUrl.searchParams.set('part', 'snippet,contentDetails');
      playlistUrl.searchParams.set('id', playlistId);
      const playlistData: any = await youtubeJson(playlistUrl, key);
      const playlist = playlistData.items?.[0];
      if (!playlist) {
        const rss = await fetchPlaylistViaRss(playlistId);
        if (rss) return { success: true, preview: rss };
        throw new HttpsError('not-found', 'Playlist could not be accessed. It may be private, deleted, or unavailable.');
      }

      const videos: Array<{ videoId: string; title: string; position: number; thumbnailUrl?: string }> = [];
      let pageToken = '';
      for (let page = 0; page < 10; page++) {
        const itemsUrl = new URL('https://www.googleapis.com/youtube/v3/playlistItems');
        itemsUrl.searchParams.set('part', 'snippet,contentDetails');
        itemsUrl.searchParams.set('playlistId', playlistId);
        itemsUrl.searchParams.set('maxResults', '50');
        if (pageToken) itemsUrl.searchParams.set('pageToken', pageToken);
        const itemsData: any = await youtubeJson(itemsUrl, key);
        for (const item of itemsData.items || []) {
          const videoId = item.contentDetails?.videoId || item.snippet?.resourceId?.videoId;
          const title = item.snippet?.title;
          if (!videoId || !title || title === 'Private video' || title === 'Deleted video') continue;
          videos.push({
            videoId,
            title,
            position: item.snippet?.position ?? videos.length,
            thumbnailUrl: item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url,
          });
        }
        pageToken = itemsData.nextPageToken || '';
        if (!pageToken) break;
      }
      if (!videos.length) {
        const rss = await fetchPlaylistViaRss(playlistId);
        if (rss) return { success: true, preview: rss };
        throw new HttpsError('not-found', 'The playlist contains no playable public videos.');
      }
      videos.sort((a, b) => a.position - b.position);

      const durationMap = new Map<string, number>();
      for (let index = 0; index < videos.length; index += 50) {
        const videoIds = videos.slice(index, index + 50).map((video) => video.videoId).join(',');
        const durationUrl = new URL('https://www.googleapis.com/youtube/v3/videos');
        durationUrl.searchParams.set('part', 'contentDetails');
        durationUrl.searchParams.set('id', videoIds);
        try {
          const durationData: any = await youtubeJson(durationUrl, key);
          for (const item of durationData.items || []) durationMap.set(item.id, durationSeconds(item.contentDetails?.duration));
        } catch {
          // Playlist metadata remains useful if a duration batch fails.
        }
      }

      let totalDurationSeconds = 0;
      const lectures = videos.map((video, position) => {
        const seconds = durationMap.get(video.videoId) || 0;
        totalDurationSeconds += seconds;
        return { ...video, position, durationSeconds: seconds };
      });
      const snippet = playlist.snippet || {};
      return {
        success: true,
        preview: {
          playlistId,
          playlistUrl: `https://www.youtube.com/playlist?list=${playlistId}`,
          title: snippet.title || 'YouTube Course',
          description: snippet.description || '',
          channelTitle: snippet.channelTitle || '',
          thumbnailUrl: snippet.thumbnails?.maxres?.url || snippet.thumbnails?.high?.url || snippet.thumbnails?.medium?.url || snippet.thumbnails?.default?.url || '',
          itemCount: lectures.length,
          totalDurationSeconds,
          lectures,
        },
      };
    } catch (err: any) {
      const rss = await fetchPlaylistViaRss(playlistId);
      if (rss) return { success: true, preview: rss };
      throw err;
    }
  }
);
