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
 * Extracts a YouTube playlist ID from URLs containing `list=...`
 */
export function parseYouTubePlaylistId(input: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();

  // If directly playlist ID (e.g. PL...)
  if (/^[a-zA-Z0-9_-]{12,}$/.test(trimmed) && trimmed.startsWith('PL')) {
    return trimmed;
  }

  const match = trimmed.match(/[?&]list=([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
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
 * Built-in starter focus streams/tracks that are guaranteed to play.
 */
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

