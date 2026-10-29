import { YouTubePlaylistItemPreview } from '../../types/eduhub';

export interface RadioTrack {
  id: string; // unique UUID in queue
  videoId: string;
  title: string;
  author?: string;
  thumbnailUrl?: string;
  duration?: number;
}

export interface SavedPlaylist {
  id: string;
  name: string;
  createdAt: string;
  tracks: RadioTrack[];
}

/**
 * Adapts an EduHub YouTube playlist item preview into a Focus Radio track.
 */
export function playlistItemToRadioTrack(
  item: YouTubePlaylistItemPreview,
  author?: string
): RadioTrack {
  return {
    id: `track-${Date.now()}-${item.videoId}-${Math.random().toString(36).substring(2, 6)}`,
    videoId: item.videoId,
    title: item.title || `Track (${item.videoId})`,
    author: author || undefined,
    thumbnailUrl: item.thumbnailUrl || `https://img.youtube.com/vi/${item.videoId}/hqdefault.jpg`,
    duration: item.durationSeconds,
  };
}

/**
 * Extracts a 11-character YouTube video ID from various URL formats:
 * - https://www.youtube.com/watch?v=VIDEO_ID
 * - https://youtu.be/VIDEO_ID
 * - https://www.youtube.com/shorts/VIDEO_ID
 * - https://music.youtube.com/watch?v=VIDEO_ID
 * - https://www.youtube.com/embed/VIDEO_ID
 * - Bare 11-char ID
 */
export function parseYouTubeVideoId(input: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();

  // If user directly pasted an 11-character video ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  // Regex matching various YouTube URL patterns
  const match = trimmed.match(
    /(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/|live\/))([a-zA-Z0-9_-]{11})/
  );

  return match ? match[1] : null;
}

/**
 * Extracts a YouTube playlist ID from URLs containing `list=...` or bare playlist IDs.
 */
export function parseYouTubePlaylistId(input: string): string | null {
  if (!input) return null;
  // Decode HTML entities (e.g. &amp;list= -> &list=, &#x20; -> space) and trim
  const decoded = input
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#x20;/gi, ' ')
    .trim();

  // Match URL parameter list=... (supports ?list=, &list=, or &amp;list=)
  const match = decoded.match(/(?:[?&]|&amp;)list=([a-zA-Z0-9_-]+)/i);
  if (match && match[1]) {
    return match[1];
  }

  // If user pasted a bare playlist ID (e.g. PL..., UU..., FL..., RD..., OLAK5uy_...)
  if (/^[a-zA-Z0-9_-]{12,64}$/.test(decoded) && (
    decoded.startsWith('PL') ||
    decoded.startsWith('UU') ||
    decoded.startsWith('FL') ||
    decoded.startsWith('RD') ||
    decoded.startsWith('OL')
  )) {
    return decoded;
  }

  // Fallback for bare playlist ID without standard prefix if between 16 and 50 characters
  if (/^[a-zA-Z0-9_-]{16,50}$/.test(decoded) && !decoded.includes('/')) {
    return decoded;
  }

  return null;
}

/**
 * Fetches title and thumbnail for a YouTube video using oEmbed,
 * with reliable fallback to default thumbnail and generic title.
 */
export async function fetchYouTubeMetadata(
  videoId: string
): Promise<{ title: string; author?: string; thumbnailUrl: string }> {
  const fallbackThumbnail = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
  const defaultTitle = `YouTube Track (${videoId})`;

  try {
    const embedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    const res = await fetch(embedUrl, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) {
      throw new Error(`oEmbed responded with status ${res.status}`);
    }
    const data = await res.json();
    return {
      title: data.title || defaultTitle,
      author: data.author_name || undefined,
      thumbnailUrl: data.thumbnail_url || fallbackThumbnail,
    };
  } catch {
    // Graceful fallback for offline, network failure, or CORS
    return {
      title: defaultTitle,
      thumbnailUrl: fallbackThumbnail,
    };
  }
}

/**
 * Formats seconds into MM:SS or HH:MM:SS for audio/video playback counters.
 */
export function formatRadioTime(sec: number): string {
  if (isNaN(sec) || sec <= 0) return '0:00';
  const total = Math.floor(sec);
  const m = Math.floor(total / 60);
  const s = total % 60;
  const sStr = String(s).padStart(2, '0');
  if (m >= 60) {
    const h = Math.floor(m / 60);
    const remM = m % 60;
    return `${h}:${String(remM).padStart(2, '0')}:${sStr}`;
  }
  return `${m}:${sStr}`;
}

export const CURATED_STARTER_TRACKS: RadioTrack[] = [
  {
    id: 'starter-lofi-girl',
    videoId: 'jfKfPfyJRdk',
    title: 'lofi hip hop radio - beats to relax/study to',
    author: 'Lofi Girl',
    thumbnailUrl: 'https://img.youtube.com/vi/jfKfPfyJRdk/hqdefault.jpg',
  },
  {
    id: 'starter-synthwave',
    videoId: '4xDzrJKXOOY',
    title: 'synthwave radio - chill beats to relax/study to',
    author: 'Lofi Girl',
    thumbnailUrl: 'https://img.youtube.com/vi/4xDzrJKXOOY/hqdefault.jpg',
  },
  {
    id: 'starter-peaceful-piano',
    videoId: '1ZYbU82GVz4',
    title: 'Deep Focus - Peaceful Piano for Concentration',
    author: 'Relaxing Music',
    thumbnailUrl: 'https://img.youtube.com/vi/1ZYbU82GVz4/hqdefault.jpg',
  },
];

