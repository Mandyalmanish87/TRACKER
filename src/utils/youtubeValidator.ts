/**
 * Validates whether a URL is a playable YouTube URL (single video, live stream, or full playlist).
 * Accepts:
 *  - Standard videos: youtube.com/watch?v=..., youtu.be/..., youtube.com/embed/...
 *  - Full Playlists: youtube.com/playlist?list=..., youtube.com/watch?v=...&list=..., youtu.be/...?list=...
 *  - Live streams & Shorts: youtube.com/live/..., youtube.com/shorts/...
 * Rejects:
 *  - Non-YouTube domains, malformed URLs, empty playlist IDs.
 */

const YT_HOSTNAME_RE = /^(www\.|m\.)?youtube\.com$|^youtu\.be$/i;

/**
 * Checks whether a given URL is a YouTube playlist.
 */
export function isYouTubePlaylistUrl(raw: string): boolean {
  if (!raw || typeof raw !== 'string') return false;
  const trimmed = raw.trim();
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) return false;

  try {
    const url = new URL(trimmed);
    if (!YT_HOSTNAME_RE.test(url.hostname)) return false;

    // Direct playlist path or list query parameter
    if (url.pathname.startsWith('/playlist')) {
      const list = url.searchParams.get('list');
      return Boolean(list && list.length >= 4);
    }

    if (url.searchParams.has('list')) {
      const list = url.searchParams.get('list');
      return Boolean(list && list.length >= 4);
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Validates whether a URL is a playable YouTube URL.
 */
export function isValidYouTubeUrl(raw: string): boolean {
  if (!raw || typeof raw !== 'string') return false;
  const trimmed = raw.trim();
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) return false;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return false;
  }

  if (!YT_HOSTNAME_RE.test(url.hostname)) return false;

  // 1. YouTube Playlist URLs (/playlist?list=...)
  if (url.pathname.startsWith('/playlist')) {
    const list = url.searchParams.get('list');
    return Boolean(list && list.length >= 4);
  }

  // 2. youtu.be short links: videoId is the pathname (first segment)
  if (/^youtu\.be$/i.test(url.hostname)) {
    const id = url.pathname.replace(/^\//, '').split('/')[0];
    return id.length === 11;
  }

  // 3. youtube.com/watch (with videoId or list)
  if (url.pathname.startsWith('/watch')) {
    const hasValidV = url.searchParams.has('v') && url.searchParams.get('v')!.length === 11;
    const hasValidList = url.searchParams.has('list') && url.searchParams.get('list')!.length >= 4;
    return hasValidV || hasValidList;
  }

  // 4. youtube.com/embed/
  if (url.pathname.startsWith('/embed/')) {
    const segments = url.pathname.split('/');
    const id = segments[2];
    if (id === 'videoseries') {
      const list = url.searchParams.get('list');
      return Boolean(list && list.length >= 4);
    }
    return typeof id === 'string' && id.length === 11;
  }

  // 5. youtube.com/live/
  if (url.pathname.startsWith('/live/')) {
    const id = url.pathname.split('/')[2];
    return typeof id === 'string' && id.length > 3;
  }

  // 6. youtube.com/shorts/
  if (url.pathname.startsWith('/shorts/')) {
    const id = url.pathname.split('/')[2];
    return typeof id === 'string' && id.length === 11;
  }

  return false;
}

/**
 * Converts any valid YouTube URL (single video or playlist) to its embed form.
 * Returns null if the URL is not valid.
 */
export function toYouTubeEmbedUrl(raw: string): string | null {
  if (!isValidYouTubeUrl(raw)) return null;
  const url = new URL(raw.trim());

  // 1. Direct Playlist URL (/playlist?list=...)
  if (url.pathname.startsWith('/playlist')) {
    const list = url.searchParams.get('list');
    return `https://www.youtube.com/embed/videoseries?list=${list}&autoplay=0&rel=0`;
  }

  // 2. Embed videoseries (/embed/videoseries?list=...)
  if (url.pathname.startsWith('/embed/videoseries')) {
    const list = url.searchParams.get('list');
    return `https://www.youtube.com/embed/videoseries?list=${list}&autoplay=0&rel=0`;
  }

  // 3. youtu.be short link (may include ?list=...)
  if (/^youtu\.be$/i.test(url.hostname)) {
    const id = url.pathname.replace(/^\//, '').split('/')[0];
    const list = url.searchParams.get('list');
    if (list) {
      return `https://www.youtube.com/embed/${id}?list=${list}&autoplay=0&rel=0`;
    }
    return `https://www.youtube.com/embed/${id}?autoplay=0&rel=0`;
  }

  // 4. youtube.com/watch (may include ?list=...)
  if (url.pathname.startsWith('/watch')) {
    const id = url.searchParams.get('v');
    const list = url.searchParams.get('list');
    if (id && list) {
      return `https://www.youtube.com/embed/${id}?list=${list}&autoplay=0&rel=0`;
    }
    if (id) {
      return `https://www.youtube.com/embed/${id}?autoplay=0&rel=0`;
    }
    if (list) {
      return `https://www.youtube.com/embed/videoseries?list=${list}&autoplay=0&rel=0`;
    }
  }

  // 5. youtube.com/embed/
  if (url.pathname.startsWith('/embed/')) {
    const list = url.searchParams.get('list');
    if (list && !url.pathname.includes('videoseries')) {
      const id = url.pathname.split('/')[2];
      return `https://www.youtube.com/embed/${id}?list=${list}&autoplay=0&rel=0`;
    }
    return `${url.origin}${url.pathname}?autoplay=0&rel=0`;
  }

  // 6. youtube.com/live/
  if (url.pathname.startsWith('/live/')) {
    const id = url.pathname.split('/')[2];
    return `https://www.youtube.com/embed/${id}?autoplay=0&rel=0`;
  }

  // 7. youtube.com/shorts/
  if (url.pathname.startsWith('/shorts/')) {
    const id = url.pathname.split('/')[2];
    return `https://www.youtube.com/embed/${id}?autoplay=0&rel=0`;
  }

  return null;
}

/**
 * Extracts a YouTube video ID (11 characters) if present.
 */
export function extractYouTubeVideoId(raw: string): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  try {
    const url = new URL(trimmed);
    if (!YT_HOSTNAME_RE.test(url.hostname)) return null;

    if (url.hostname.toLowerCase() === 'youtu.be') {
      const id = url.pathname.replace(/^\//, '').split('/')[0];
      return id.length === 11 ? id : null;
    }
    if (url.pathname.startsWith('/watch')) {
      const id = url.searchParams.get('v');
      return id && id.length === 11 ? id : null;
    }
    if (url.pathname.startsWith('/embed/')) {
      const id = url.pathname.split('/')[2];
      return id && id.length === 11 && id !== 'videoseries' ? id : null;
    }
    if (url.pathname.startsWith('/live/') || url.pathname.startsWith('/shorts/')) {
      const id = url.pathname.split('/')[2];
      return id && id.length >= 4 ? id : null;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Extracts a YouTube playlist ID (list param) if present.
 */
export function extractYouTubePlaylistId(raw: string): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  try {
    const url = new URL(trimmed);
    if (!YT_HOSTNAME_RE.test(url.hostname)) return null;
    const list = url.searchParams.get('list');
    return list && list.length >= 4 ? list : null;
  } catch {
    return null;
  }
}

/**
 * Converts any valid YouTube URL to its embed form with loop, autoplay, and mute options.
 */
export function toYouTubeEmbedUrlWithControls(
  raw: string,
  options?: {
    loopMode?: 'off' | 'all' | 'one';
    autoplay?: boolean;
    isMuted?: boolean;
  }
): string | null {
  const base = toYouTubeEmbedUrl(raw);
  if (!base) return null;
  const url = new URL(base);

  if (options?.autoplay) {
    url.searchParams.set('autoplay', '1');
  }
  if (options?.isMuted) {
    url.searchParams.set('mute', '1');
  } else {
    url.searchParams.set('mute', '0');
  }

  // Enable YouTube iframe JavaScript API for postMessage control (nextVideo, setShuffle, setLoop)
  url.searchParams.set('enablejsapi', '1');

  const loop = options?.loopMode ?? 'off';
  if (loop === 'one') {
    const videoId = extractYouTubeVideoId(raw);
    if (videoId) {
      url.searchParams.set('loop', '1');
      url.searchParams.set('playlist', videoId);
    } else {
      const playlistId = extractYouTubePlaylistId(raw);
      if (playlistId) {
        url.searchParams.set('loop', '1');
      }
    }
  } else if (loop === 'all') {
    const playlistId = extractYouTubePlaylistId(raw);
    if (playlistId) {
      url.searchParams.set('loop', '1');
    }
  }

  return url.toString();
}

/**
 * Builds an embed URL for a custom user-created playlist of YouTube videos.
 * When multiple video IDs are provided, YouTube plays them sequentially as a playlist.
 */
export function buildCustomPlaylistEmbedUrl(
  videoIds: string[],
  options?: {
    loopMode?: 'off' | 'all' | 'one';
    isMuted?: boolean;
    autoplay?: boolean;
  }
): string | null {
  if (!videoIds || videoIds.length === 0) return null;
  const firstId = videoIds[0];
  const restIds = videoIds.slice(1);
  const autoplay = options?.autoplay ?? true;
  const mute = options?.isMuted ? '1' : '0';
  const loop = options?.loopMode ?? 'all';

  if (videoIds.length === 1) {
    const loopParam = loop !== 'off' ? `&loop=1&playlist=${firstId}` : '';
    return `https://www.youtube.com/embed/${firstId}?autoplay=${autoplay ? '1' : '0'}&mute=${mute}&enablejsapi=1&rel=0${loopParam}`;
  }

  const loopParam = loop !== 'off' ? '&loop=1' : '';
  return `https://www.youtube.com/embed/${firstId}?playlist=${restIds.join(',')}&autoplay=${autoplay ? '1' : '0'}&mute=${mute}&enablejsapi=1&rel=0${loopParam}`;
}

/**
 * Dispatches a player command to a YouTube embed iframe via HTML5 postMessage.
 * Supports: 'nextVideo', 'previousVideo', 'setShuffle', 'setLoop', 'playVideo', 'pauseVideo'.
 */
export function sendYouTubeCommand(
  iframe: HTMLIFrameElement | null,
  func: string,
  args: any[] = []
): void {
  if (!iframe || !iframe.contentWindow) return;
  try {
    iframe.contentWindow.postMessage(
      JSON.stringify({
        event: 'command',
        func,
        args,
      }),
      '*'
    );
  } catch {
    // Ignore cross-origin sandboxing limits if any
  }
}


