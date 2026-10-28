export interface EduHubLecture {
  id: string;
  title: string;
  youtubeUrl: string;
  videoId: string;
  durationSeconds: number; // total duration in seconds
  lastPositionSeconds: number; // last playback position
  completed: boolean;
  notes?: string;
  thumbnailUrl?: string;
  addedAt: string;
  completedAt?: string;
}

export interface EduHubCourse {
  id: string;
  title: string;
  description?: string;
  color?: string; // Theme accent or color token
  playlistId?: string; // YouTube playlist ID for sync & duplicate detection
  playlistUrl?: string; // Original YouTube playlist URL
  lastSyncedAt?: string; // ISO timestamp of last sync
  lectures: EduHubLecture[];
  createdAt: string;
  updatedAt: string;
  isSample?: boolean;
}

export interface YouTubePlaylistItemPreview {
  videoId: string;
  title: string;
  position: number;
  durationSeconds: number;
  thumbnailUrl?: string;
}

export interface YouTubePlaylistPreview {
  playlistId: string;
  playlistUrl: string;
  title: string;
  description: string;
  channelTitle?: string;
  thumbnailUrl?: string;
  itemCount: number;
  totalDurationSeconds: number;
  lectures: YouTubePlaylistItemPreview[];
}

export interface ImportPlaylistResponse {
  success: boolean;
  preview?: YouTubePlaylistPreview;
  error?: string;
  errorCode?: 'INVALID_URL' | 'PRIVATE_PLAYLIST' | 'NOT_FOUND' | 'QUOTA_EXCEEDED' | 'NO_API_KEY' | 'FETCH_ERROR';
}


