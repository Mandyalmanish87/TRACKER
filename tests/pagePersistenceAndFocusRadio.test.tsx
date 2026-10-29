import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import {
  resolveNavTabFromLocation,
  getInitialNavTab,
  ACTIVE_TAB_STORAGE_KEY,
} from '../src/App';
import {
  FocusRadioProvider,
  useFocusRadio,
} from '../src/components/focus-radio/FocusRadioContext';
import {
  playlistItemToRadioTrack,
  RadioTrack,
} from '../src/components/focus-radio/youtubeUtils';
import { PlaylistImport } from '../src/components/focus-radio/PlaylistImport';
import * as youtubePlaylistService from '../src/services/youtubePlaylistService';
import { YouTubePlaylistPreview } from '../src/types/eduhub';

describe('Task 1 — Page Navigation Persistence Across Refresh', () => {
  const originalLocation = window.location;

  beforeEach(() => {
    localStorage.clear();
    // Reset window.location
    delete (window as any).location;
    (window as any).location = {
      pathname: '/',
      hash: '',
      search: '',
      origin: 'https://tracker-one-tawny.vercel.app',
    };
  });

  afterEach(() => {
    (window as any).location = originalLocation;
  });

  it('resolves active tab from URL hash (e.g. #eduhub)', () => {
    window.location.hash = '#eduhub';
    expect(resolveNavTabFromLocation()).toBe('eduhub');
    expect(getInitialNavTab()).toBe('eduhub');
  });

  it('resolves active tab from URL pathname (e.g. /timetable, /admin)', () => {
    window.location.pathname = '/timetable';
    expect(resolveNavTabFromLocation()).toBe('timetable');
    expect(getInitialNavTab()).toBe('timetable');

    window.location.pathname = '/admin';
    expect(resolveNavTabFromLocation()).toBe('admin');
    expect(getInitialNavTab()).toBe('admin');
  });

  it('resolves various supported tabs from hash (syllabus, planner, focus, gym, settings)', () => {
    const tabs = ['syllabus', 'planner', 'tests', 'attendance', 'focus', 'gym', 'nutrition', 'reminders', 'settings'];
    for (const tab of tabs) {
      window.location.hash = `#${tab}`;
      expect(resolveNavTabFromLocation()).toBe(tab);
      expect(getInitialNavTab()).toBe(tab);
    }
  });

  it('falls back to persisted localStorage tab when hash and pathname are empty', () => {
    window.location.pathname = '/';
    window.location.hash = '';

    localStorage.setItem(ACTIVE_TAB_STORAGE_KEY, 'eduhub');
    expect(getInitialNavTab()).toBe('eduhub');

    localStorage.setItem(ACTIVE_TAB_STORAGE_KEY, 'planner');
    expect(getInitialNavTab()).toBe('planner');
  });

  it('ignores Supabase OAuth hash fragments and preserves persisted page', () => {
    localStorage.setItem(ACTIVE_TAB_STORAGE_KEY, 'eduhub');
    // Supabase redirects after Google Sign-In with tokens in the hash
    window.location.hash = '#access_token=eyJh...&refresh_token=...&expires_in=3600';

    // Must NOT treat the token as a tab name
    expect(resolveNavTabFromLocation()).toBeNull();
    // Must fall back to the user's active page before login
    expect(getInitialNavTab()).toBe('eduhub');
  });

  it('defaults to dashboard when neither location nor storage has an active tab', () => {
    window.location.pathname = '/';
    window.location.hash = '';
    localStorage.clear();

    expect(resolveNavTabFromLocation()).toBeNull();
    expect(getInitialNavTab()).toBe('dashboard');
  });
});

describe('Task 2 — Prevent Focus Radio Autoplay After Full Page Reload', () => {
  let mockPlayerEvents: Record<string, Function> = {};
  let mockPlayerInstance: any = null;

  beforeEach(() => {
    localStorage.clear();
    mockPlayerEvents = {};
    mockPlayerInstance = {
      setVolume: vi.fn(),
      cueVideoById: vi.fn(),
      loadVideoById: vi.fn(),
      seekTo: vi.fn(),
      playVideo: vi.fn(),
      pauseVideo: vi.fn(),
      stopVideo: vi.fn(),
      getDuration: vi.fn(() => 300),
      getCurrentTime: vi.fn(() => 45),
    };

    (window as any).YT = {
      Player: vi.fn().mockImplementation((_elementId: string, config: any) => {
        mockPlayerEvents = config.events || {};
        return mockPlayerInstance;
      }),
    };
  });

  it('restores saved track and position on reload without starting playback', () => {
    // Seed localStorage with saved state from a previous session
    localStorage.setItem(
      'tracker_focus_radio_state_v1',
      JSON.stringify({
        queue: [
          {
            id: 'saved-track-1',
            videoId: 'jfKfPfyJRdk',
            title: 'Lofi Study Session',
            author: 'Lofi Girl',
          },
        ],
        currentIndex: 0,
        volume: 65,
        savedPlaybackPosition: 45,
      })
    );

    let contextValue: any = null;
    const TestConsumer = () => {
      contextValue = useFocusRadio();
      return <div>Focus Radio Consumer</div>;
    };

    render(
      <FocusRadioProvider>
        <TestConsumer />
      </FocusRadioProvider>
    );

    // Initial state before onReady: paused, correct track and saved position
    expect(contextValue.isPlaying).toBe(false);
    expect(contextValue.currentTrack.videoId).toBe('jfKfPfyJRdk');
    expect(contextValue.savedPlaybackPosition).toBe(45);
    expect(contextValue.volume).toBe(65);

    // Simulate YouTube onReady event
    act(() => {
      if (mockPlayerEvents.onReady) {
        mockPlayerEvents.onReady({ target: mockPlayerInstance });
      }
    });

    // Verify cueVideoById was called to position the track at 45s paused, NOT playVideo or seekTo(..., true)
    expect(mockPlayerInstance.cueVideoById).toHaveBeenCalledWith(
      expect.objectContaining({
        videoId: 'jfKfPfyJRdk',
        startSeconds: 45,
      })
    );
    expect(mockPlayerInstance.playVideo).not.toHaveBeenCalled();
    expect(contextValue.isPlaying).toBe(false);
  });

  it('immediately pauses and stays paused if YouTube or browser triggers an unrequested autoplay event on reload', () => {
    let contextValue: any = null;
    const TestConsumer = () => {
      contextValue = useFocusRadio();
      return <div>Focus Radio Consumer</div>;
    };

    render(
      <FocusRadioProvider>
        <TestConsumer />
      </FocusRadioProvider>
    );

    act(() => {
      if (mockPlayerEvents.onReady) {
        mockPlayerEvents.onReady({ target: mockPlayerInstance });
      }
    });

    // Simulate YouTube firing state 1 (playing) without user having clicked Play
    act(() => {
      if (mockPlayerEvents.onStateChange) {
        mockPlayerEvents.onStateChange({ data: 1, target: mockPlayerInstance });
      }
    });

    // Player must be immediately forced to pause
    expect(mockPlayerInstance.pauseVideo).toHaveBeenCalled();
    expect(contextValue.isPlaying).toBe(false);
  });

  it('allows explicit user action to start playback from saved position', () => {
    let contextValue: any = null;
    const TestConsumer = () => {
      contextValue = useFocusRadio();
      return (
        <div>
          <button onClick={contextValue.play}>Play</button>
          <button onClick={contextValue.resumeFromSavedPosition}>Resume</button>
        </div>
      );
    };

    render(
      <FocusRadioProvider>
        <TestConsumer />
      </FocusRadioProvider>
    );

    act(() => {
      if (mockPlayerEvents.onReady) {
        mockPlayerEvents.onReady({ target: mockPlayerInstance });
      }
    });

    // User clicks Play
    act(() => {
      fireEvent.click(screen.getByText('Play'));
    });

    expect(mockPlayerInstance.playVideo).toHaveBeenCalled();

    // Now state change to 1 is legitimate and stays playing
    act(() => {
      if (mockPlayerEvents.onStateChange) {
        mockPlayerEvents.onStateChange({ data: 1 });
      }
    });

    expect(contextValue.isPlaying).toBe(true);
  });
});

describe('Task 3 — Reuse EduHub YouTube Playlist Import in Focus Radio', () => {
  const mockEduHubPreview: YouTubePlaylistPreview = {
    playlistId: 'PL_study_lofi_ambient_2026',
    playlistUrl: 'https://www.youtube.com/playlist?list=PL_study_lofi_ambient_2026',
    title: 'Deep Focus & Ambient Work Beats',
    description: 'Curated instrumental tracks for high concentration.',
    channelTitle: 'Ambient Chill',
    thumbnailUrl: 'https://img.youtube.com/vi/video-01/hqdefault.jpg',
    itemCount: 3,
    totalDurationSeconds: 4500,
    lectures: [
      {
        videoId: 'video-01',
        title: 'Morning Rain & Piano',
        position: 0,
        durationSeconds: 1500,
        thumbnailUrl: 'https://img.youtube.com/vi/video-01/hqdefault.jpg',
      },
      {
        videoId: 'video-02',
        title: 'Library Atmosphere & Soft Chords',
        position: 1,
        durationSeconds: 1800,
        thumbnailUrl: 'https://img.youtube.com/vi/video-02/hqdefault.jpg',
      },
      {
        videoId: 'video-03',
        title: 'Binaural Theta Waves',
        position: 2,
        durationSeconds: 1200,
        thumbnailUrl: 'https://img.youtube.com/vi/video-03/hqdefault.jpg',
      },
    ],
  };

  beforeEach(() => {
    localStorage.clear();
  });

  it('accurately converts EduHub playlist items into Focus Radio tracks', () => {
    const lectureItem = mockEduHubPreview.lectures[0];
    const track = playlistItemToRadioTrack(lectureItem, mockEduHubPreview.channelTitle);

    expect(track.videoId).toBe('video-01');
    expect(track.title).toBe('Morning Rain & Piano');
    expect(track.author).toBe('Ambient Chill');
    expect(track.duration).toBe(1500);
    expect(track.thumbnailUrl).toContain('video-01');
  });

  it('imports YouTube playlist in Focus Radio using shared fetchYouTubePlaylistPreview', async () => {
    const fetchSpy = vi
      .spyOn(youtubePlaylistService, 'fetchYouTubePlaylistPreview')
      .mockResolvedValue({
        success: true,
        preview: mockEduHubPreview,
      });

    render(
      <FocusRadioProvider>
        <PlaylistImport />
      </FocusRadioProvider>
    );

    const input = screen.getByPlaceholderText(/Paste YouTube playlist or video link/i);
    const importBtn = screen.getByRole('button', { name: /Import/i });

    // Enter playlist link
    fireEvent.change(input, {
      target: { value: 'https://www.youtube.com/playlist?list=PL_study_lofi_ambient_2026' },
    });

    await act(async () => {
      fireEvent.click(importBtn);
    });

    // Verifies shared EduHub service was called
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://www.youtube.com/playlist?list=PL_study_lofi_ambient_2026'
    );

    // Verifies preview elements are rendered
    expect(screen.getByText('Deep Focus & Ambient Work Beats')).toBeInTheDocument();
    expect(screen.getAllByText(/3 tracks/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Morning Rain & Piano')).toBeInTheDocument();
    expect(screen.getByText('Library Atmosphere & Soft Chords')).toBeInTheDocument();
    expect(screen.getByText('Binaural Theta Waves')).toBeInTheDocument();

    // Verifies action buttons
    expect(screen.getByRole('button', { name: /Play All/i })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Add to Queue/i }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole('button', { name: /Save Playlist/i })).toBeInTheDocument();

    fetchSpy.mockRestore();
  });

  it('allows playing all tracks from imported playlist directly', async () => {
    vi.spyOn(youtubePlaylistService, 'fetchYouTubePlaylistPreview').mockResolvedValue({
      success: true,
      preview: mockEduHubPreview,
    });

    let currentQueue: RadioTrack[] = [];
    const Consumer = () => {
      const radio = useFocusRadio();
      currentQueue = radio.queue;
      return <div>Queue count: {radio.queue.length}</div>;
    };

    render(
      <FocusRadioProvider>
        <PlaylistImport />
        <Consumer />
      </FocusRadioProvider>
    );

    const input = screen.getByPlaceholderText(/Paste YouTube playlist or video link/i);
    fireEvent.change(input, {
      target: { value: 'https://www.youtube.com/playlist?list=PL_study_lofi_ambient_2026' },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Import/i }));
    });

    // Click "Play All"
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /Play All/i }));
    });

    // Queue now contains the imported tracks
    expect(currentQueue.some((t) => t.videoId === 'video-01')).toBe(true);
    expect(currentQueue.some((t) => t.videoId === 'video-02')).toBe(true);
    expect(currentQueue.some((t) => t.videoId === 'video-03')).toBe(true);
  });

  it('allows saving imported playlist directly to saved playlists and reopening later', async () => {
    vi.spyOn(youtubePlaylistService, 'fetchYouTubePlaylistPreview').mockResolvedValue({
      success: true,
      preview: mockEduHubPreview,
    });

    let savedPlaylistsList: any[] = [];
    const Consumer = () => {
      const radio = useFocusRadio();
      savedPlaylistsList = radio.savedPlaylists;
      return <div>Saved count: {radio.savedPlaylists.length}</div>;
    };

    render(
      <FocusRadioProvider>
        <PlaylistImport />
        <Consumer />
      </FocusRadioProvider>
    );

    const input = screen.getByPlaceholderText(/Paste YouTube playlist or video link/i);
    fireEvent.change(input, {
      target: { value: 'https://www.youtube.com/playlist?list=PL_study_lofi_ambient_2026' },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Import/i }));
    });

    // Click "Save Playlist"
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /Save Playlist/i }));
    });

    // Playlist is saved
    const saved = savedPlaylistsList.find((p) => p.name === mockEduHubPreview.title);
    expect(saved).toBeDefined();
    expect(saved.tracks).toHaveLength(3);
    expect(saved.tracks[0].videoId).toBe('video-01');
  });
});

