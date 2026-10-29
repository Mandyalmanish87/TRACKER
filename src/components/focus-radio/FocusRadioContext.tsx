import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { RadioTrack, SavedPlaylist, CURATED_STARTER_TRACKS } from './youtubeUtils';

interface FocusRadioContextType {
  queue: RadioTrack[];
  currentIndex: number;
  currentTrack: RadioTrack | null;
  isPlaying: boolean;
  isBuffering: boolean;
  volume: number;
  isMuted: boolean;
  shuffle: boolean;
  repeatMode: 'off' | 'all' | 'one';
  savedPlaylists: SavedPlaylist[];
  isMiniPlayerOpen: boolean;
  isMiniPlayerCollapsed: boolean;
  errorMessage: string | null;
  currentTime: number;
  duration: number;
  savedPlaybackPosition: number;

  // Actions
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  next: () => void;
  prev: () => void;
  seekTo: (seconds: number) => void;
  resumeFromSavedPosition: () => void;
  setVolume: (val: number) => void;
  toggleMute: () => void;
  setShuffle: (val: boolean) => void;
  setRepeatMode: (mode: 'off' | 'all' | 'one') => void;
  addToQueue: (track: RadioTrack, playNow?: boolean) => void;
  addTracksToQueue: (tracks: RadioTrack[], playNow?: boolean) => void;
  removeFromQueue: (index: number) => void;
  moveInQueue: (fromIndex: number, toIndex: number) => void;
  playTrackAtIndex: (index: number) => void;
  clearQueue: () => void;
  saveCurrentPlaylist: (name: string) => void;
  savePlaylistDirectly: (name: string, tracks: RadioTrack[]) => void;
  loadSavedPlaylist: (playlistId: string) => void;
  deleteSavedPlaylist: (playlistId: string) => void;
  renameSavedPlaylist: (playlistId: string, newName: string) => void;
  setMiniPlayerOpen: (open: boolean) => void;
  setMiniPlayerCollapsed: (collapsed: boolean) => void;
  clearError: () => void;
}

const STORAGE_KEY = 'tracker_focus_radio_state_v1';
const PLAYLISTS_STORAGE_KEY = 'tracker_focus_radio_playlists_v1';

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

const FocusRadioContext = createContext<FocusRadioContextType | null>(null);

export const FocusRadioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Saved playlists
  const [savedPlaylists, setSavedPlaylists] = useState<SavedPlaylist[]>(() => {
    try {
      const raw = localStorage.getItem(PLAYLISTS_STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return [
      {
        id: 'curated-starter',
        name: 'Curated Focus Beats',
        createdAt: new Date().toISOString(),
        tracks: CURATED_STARTER_TRACKS,
      },
    ];
  });

  // Load initial settings and queue
  const initialData = (() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return null;
  })();

  const [queue, setQueue] = useState<RadioTrack[]>(
    initialData?.queue && Array.isArray(initialData.queue) && initialData.queue.length > 0
      ? initialData.queue
      : CURATED_STARTER_TRACKS
  );

  const [currentIndex, setCurrentIndex] = useState<number>(
    typeof initialData?.currentIndex === 'number' && initialData.currentIndex < queue.length
      ? initialData.currentIndex
      : 0
  );

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isBuffering, setIsBuffering] = useState<boolean>(false);
  const [volume, setVolumeState] = useState<number>(
    typeof initialData?.volume === 'number' ? initialData.volume : 70
  );
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [shuffle, setShuffle] = useState<boolean>(Boolean(initialData?.shuffle));
  const [repeatMode, setRepeatMode] = useState<'off' | 'all' | 'one'>(
    initialData?.repeatMode || 'all'
  );
  const [isMiniPlayerOpen, setMiniPlayerOpen] = useState<boolean>(
    typeof initialData?.isMiniPlayerOpen === 'boolean' ? initialData.isMiniPlayerOpen : true
  );
  const [isMiniPlayerCollapsed, setMiniPlayerCollapsed] = useState<boolean>(
    typeof initialData?.isMiniPlayerCollapsed === 'boolean'
      ? initialData.isMiniPlayerCollapsed
      : false
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Playback progress & duration (Spotify-style)
  const [savedPlaybackPosition, setSavedPlaybackPosition] = useState<number>(
    typeof initialData?.savedPlaybackPosition === 'number' ? initialData.savedPlaybackPosition : 0
  );
  const [currentTime, setCurrentTime] = useState<number>(
    typeof initialData?.savedPlaybackPosition === 'number' ? initialData.savedPlaybackPosition : 0
  );
  const [duration, setDuration] = useState<number>(0);

  const playerRef = useRef<any>(null);
  const isApiReadyRef = useRef<boolean>(false);
  const consecutiveErrorsRef = useRef<number>(0);
  const skipTimeoutRef = useRef<any>(null);
  // Guard to ensure audio does NOT automatically start on full page reload
  const userInitiatedPlayRef = useRef<boolean>(false);

  const currentTrack: RadioTrack | null = queue[currentIndex] || null;

  // Persist state
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          queue,
          currentIndex,
          volume,
          shuffle,
          repeatMode,
          isMiniPlayerOpen,
          isMiniPlayerCollapsed,
          savedPlaybackPosition: Math.round(savedPlaybackPosition),
        })
      );
    } catch {}
  }, [queue, currentIndex, volume, shuffle, repeatMode, isMiniPlayerOpen, isMiniPlayerCollapsed, savedPlaybackPosition]);

  // Track playback time and duration while playing
  useEffect(() => {
    let interval: any = null;
    if (isPlaying) {
      interval = setInterval(() => {
        if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
          try {
            const cur = playerRef.current.getCurrentTime() || 0;
            const dur = playerRef.current.getDuration() || 0;
            setCurrentTime(cur);
            setSavedPlaybackPosition(cur);
            if (dur > 0) setDuration(dur);
          } catch {}
        }
      }, 500);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying]);

  // Persist playlists
  useEffect(() => {
    try {
      localStorage.setItem(PLAYLISTS_STORAGE_KEY, JSON.stringify(savedPlaylists));
    } catch {}
  }, [savedPlaylists]);

  // Initialize YouTube IFrame API
  useEffect(() => {
    let unmounted = false;

    function initPlayer() {
      if (unmounted || !window.YT || !window.YT.Player) return;
      if (playerRef.current) return;

      const container = document.getElementById('focus-radio-yt-container');
      if (!container) return;

      playerRef.current = new window.YT.Player('focus-radio-yt-container', {
        height: '200',
        width: '200',
        videoId: currentTrack ? currentTrack.videoId : '',
        playerVars: {
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          fs: 0,
          modestbranding: 1,
          playsinline: 1,
          rel: 0,
        },
        events: {
          onReady: (event: any) => {
            isApiReadyRef.current = true;
            event.target.setVolume(volume);
            try {
              const dur = event.target.getDuration();
              if (dur > 0) setDuration(dur);
              if (currentTrack?.videoId) {
                const startSeconds =
                  savedPlaybackPosition > 3 ? Math.floor(savedPlaybackPosition) : 0;
                // Always cue the track paused on initial load, restoring saved position without autoplay
                if (typeof event.target.cueVideoById === 'function') {
                  try {
                    event.target.cueVideoById({
                      videoId: currentTrack.videoId,
                      startSeconds,
                    });
                  } catch {
                    event.target.cueVideoById(currentTrack.videoId, startSeconds);
                  }
                }
              }
              setIsPlaying(false);
            } catch {}
          },
          onStateChange: (event: any) => {
            // 1 = playing, 2 = paused, 3 = buffering, 0 = ended
            if (event?.data === 1) {
              // Guard: If playback was not user-initiated (e.g. browser or YouTube seek autoplaying on reload)
              if (!userInitiatedPlayRef.current) {
                const target = event?.target || playerRef.current;
                if (target && typeof target.pauseVideo === 'function') {
                  try {
                    target.pauseVideo();
                  } catch {}
                }
                setIsPlaying(false);
                return;
              }

              setIsPlaying(true);
              setIsBuffering(false);
              consecutiveErrorsRef.current = 0;
            } else if (event?.data === 2) {
              setIsPlaying(false);
              setIsBuffering(false);
            } else if (event?.data === 3) {
              setIsBuffering(true);
            } else if (event?.data === 0) {
              handleTrackEnded();
            }
          },
          onError: (event: any) => {
            setIsBuffering(false);
            const errCode = event.data;
            let msg = 'Playback error.';
            if (errCode === 101 || errCode === 150) {
              msg = 'Video owner restricted embedding. Skipping...';
            } else if (errCode === 100) {
              msg = 'Video not found or removed. Skipping...';
            }
            setErrorMessage(msg);

            consecutiveErrorsRef.current += 1;
            // Prevent infinite loop if entire queue is restricted
            if (consecutiveErrorsRef.current < (queue.length || 1) + 1) {
              clearTimeout(skipTimeoutRef.current);
              skipTimeoutRef.current = setTimeout(() => {
                next();
              }, 1200);
            } else {
              setIsPlaying(false);
              setErrorMessage('All queue items are unavailable or restricted.');
            }
          },
        },
      });
    }

    if (window.YT && window.YT.Player) {
      initPlayer();
    } else {
      const existingScript = document.getElementById('youtube-iframe-api-script');
      if (!existingScript) {
        const tag = document.createElement('script');
        tag.id = 'youtube-iframe-api-script';
        tag.src = 'https://www.youtube.com/iframe_api';
        document.body.appendChild(tag);
      }

      window.onYouTubeIframeAPIReady = () => {
        initPlayer();
      };
    }

    return () => {
      unmounted = true;
      clearTimeout(skipTimeoutRef.current);
    };
  }, []);

  // Track videoId changes
  useEffect(() => {
    if (!playerRef.current || !playerRef.current.loadVideoById) return;
    if (!currentTrack) {
      playerRef.current.stopVideo();
      setIsPlaying(false);
      return;
    }

    if (isPlaying) {
      playerRef.current.loadVideoById(currentTrack.videoId);
    } else {
      playerRef.current.cueVideoById(currentTrack.videoId);
    }
  }, [currentIndex, currentTrack?.videoId]);

  // Volume & Mute synchronizer
  useEffect(() => {
    if (!playerRef.current) return;
    if (isMuted) {
      if (typeof playerRef.current.mute === 'function') playerRef.current.mute();
    } else {
      if (typeof playerRef.current.unMute === 'function') playerRef.current.unMute();
      if (typeof playerRef.current.setVolume === 'function') playerRef.current.setVolume(volume);
    }
  }, [volume, isMuted]);

  const handleTrackEnded = useCallback(() => {
    if (repeatMode === 'one') {
      if (playerRef.current?.playVideo) {
        playerRef.current.seekTo(0);
        playerRef.current.playVideo();
      }
      return;
    }

    if (shuffle) {
      const nextIdx = Math.floor(Math.random() * queue.length);
      setCurrentIndex(nextIdx);
      return;
    }

    if (currentIndex < queue.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else if (repeatMode === 'all') {
      setCurrentIndex(0);
    } else {
      setIsPlaying(false);
    }
  }, [repeatMode, shuffle, queue.length, currentIndex]);

  const play = useCallback(() => {
    userInitiatedPlayRef.current = true;
    if (playerRef.current?.playVideo) {
      playerRef.current.playVideo();
      setIsPlaying(true);
    }
  }, []);

  const pause = useCallback(() => {
    userInitiatedPlayRef.current = false;
    if (playerRef.current?.pauseVideo) {
      playerRef.current.pauseVideo();
      setIsPlaying(false);
    }
  }, []);

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }, [isPlaying, play, pause]);

  const next = useCallback(() => {
    if (queue.length === 0) return;
    if (shuffle) {
      const nextIdx = Math.floor(Math.random() * queue.length);
      setCurrentIndex(nextIdx);
      return;
    }
    if (currentIndex < queue.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else if (repeatMode === 'all') {
      setCurrentIndex(0);
    }
  }, [queue.length, shuffle, currentIndex, repeatMode]);

  const prev = useCallback(() => {
    if (queue.length === 0) return;
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    } else if (repeatMode === 'all') {
      setCurrentIndex(queue.length - 1);
    }
  }, [queue.length, currentIndex, repeatMode]);

  const seekTo = useCallback((seconds: number) => {
    const clamped = Math.max(0, Math.min(duration || 100000, seconds));
    setCurrentTime(clamped);
    setSavedPlaybackPosition(clamped);
    if (playerRef.current && typeof playerRef.current.seekTo === 'function') {
      try {
        playerRef.current.seekTo(clamped, true);
      } catch {}
    }
  }, [duration]);

  const resumeFromSavedPosition = useCallback(() => {
    userInitiatedPlayRef.current = true;
    if (playerRef.current) {
      try {
        if (savedPlaybackPosition > 0 && typeof playerRef.current.seekTo === 'function') {
          playerRef.current.seekTo(savedPlaybackPosition, true);
        }
        if (typeof playerRef.current.playVideo === 'function') {
          playerRef.current.playVideo();
          setIsPlaying(true);
        }
      } catch {}
    }
  }, [savedPlaybackPosition]);

  const setVolume = useCallback((val: number) => {
    const clamped = Math.max(0, Math.min(100, val));
    setVolumeState(clamped);
    setIsMuted(false);
    if (playerRef.current?.setVolume) {
      playerRef.current.setVolume(clamped);
      if (playerRef.current.unMute) playerRef.current.unMute();
    }
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => !prev);
  }, []);

  const addToQueue = useCallback((track: RadioTrack, playNow: boolean = false) => {
    setQueue((prev) => {
      const updated = [...prev, track];
      if (playNow) {
        setCurrentIndex(updated.length - 1);
        setTimeout(() => play(), 100);
      }
      return updated;
    });
  }, [play]);

  const addTracksToQueue = useCallback((tracks: RadioTrack[], playNow: boolean = false) => {
    if (tracks.length === 0) return;
    setQueue((prev) => {
      const startIndex = prev.length;
      const updated = [...prev, ...tracks];
      if (playNow) {
        setCurrentIndex(startIndex);
        setTimeout(() => play(), 100);
      }
      return updated;
    });
  }, [play]);

  const removeFromQueue = useCallback((index: number) => {
    setQueue((prev) => {
      if (prev.length <= 1) {
        // Can't empty queue completely below 0, return fallback
        return [];
      }
      const updated = prev.filter((_, i) => i !== index);
      return updated;
    });
    setCurrentIndex((prev) => {
      if (index === prev) {
        return Math.max(0, prev - 1);
      } else if (index < prev) {
        return prev - 1;
      }
      return prev;
    });
  }, []);

  const moveInQueue = useCallback((fromIndex: number, toIndex: number) => {
    setQueue((prev) => {
      if (fromIndex === toIndex || fromIndex < 0 || fromIndex >= prev.length || toIndex < 0 || toIndex >= prev.length) {
        return prev;
      }
      const clone = [...prev];
      const [item] = clone.splice(fromIndex, 1);
      clone.splice(toIndex, 0, item);
      return clone;
    });
  }, []);

  const playTrackAtIndex = useCallback((index: number) => {
    if (index >= 0 && index < queue.length) {
      userInitiatedPlayRef.current = true;
      setCurrentIndex(index);
      setIsPlaying(true);
      setTimeout(() => {
        if (playerRef.current?.playVideo) playerRef.current.playVideo();
      }, 100);
    }
  }, [queue.length]);

  const clearQueue = useCallback(() => {
    setQueue([]);
    setCurrentIndex(0);
    setIsPlaying(false);
    if (playerRef.current?.stopVideo) playerRef.current.stopVideo();
  }, []);

  const saveCurrentPlaylist = useCallback((name: string) => {
    if (!name.trim() || queue.length === 0) return;
    const newPlaylist: SavedPlaylist = {
      id: `playlist-${Date.now()}`,
      name: name.trim(),
      createdAt: new Date().toISOString(),
      tracks: [...queue],
    };
    setSavedPlaylists((prev) => [newPlaylist, ...prev]);
  }, [queue]);

  const savePlaylistDirectly = useCallback((name: string, tracks: RadioTrack[]) => {
    if (!name.trim() || tracks.length === 0) return;
    const newPlaylist: SavedPlaylist = {
      id: `playlist-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: name.trim(),
      createdAt: new Date().toISOString(),
      tracks: [...tracks],
    };
    setSavedPlaylists((prev) => [newPlaylist, ...prev]);
  }, []);

  const loadSavedPlaylist = useCallback((playlistId: string) => {
    const found = savedPlaylists.find((p) => p.id === playlistId);
    if (found && found.tracks.length > 0) {
      userInitiatedPlayRef.current = true;
      setQueue([...found.tracks]);
      setCurrentIndex(0);
      setIsPlaying(true);
      setTimeout(() => {
        if (playerRef.current?.playVideo) playerRef.current.playVideo();
      }, 100);
    }
  }, [savedPlaylists]);

  const deleteSavedPlaylist = useCallback((playlistId: string) => {
    setSavedPlaylists((prev) => prev.filter((p) => p.id !== playlistId));
  }, []);

  const renameSavedPlaylist = useCallback((playlistId: string, newName: string) => {
    if (!newName.trim()) return;
    setSavedPlaylists((prev) =>
      prev.map((p) => (p.id === playlistId ? { ...p, name: newName.trim() } : p))
    );
  }, []);

  const clearError = useCallback(() => {
    setErrorMessage(null);
  }, []);

  // Global Keyboard Shortcuts (Space, N, Arrows)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Do not intercept if user is typing in form inputs, textareas, or content-editable
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable ||
          target.getAttribute('role') === 'textbox')
      ) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.key === 'n' || e.key === 'N') {
        next();
      } else if (e.code === 'ArrowUp') {
        e.preventDefault();
        setVolume(Math.min(100, volume + 5));
      } else if (e.code === 'ArrowDown') {
        e.preventDefault();
        setVolume(Math.max(0, volume - 5));
      } else if (e.code === 'ArrowRight' && playerRef.current?.getCurrentTime) {
        const cur = playerRef.current.getCurrentTime();
        playerRef.current.seekTo(cur + 10, true);
      } else if (e.code === 'ArrowLeft' && playerRef.current?.getCurrentTime) {
        const cur = playerRef.current.getCurrentTime();
        playerRef.current.seekTo(Math.max(0, cur - 10), true);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay, next, setVolume, volume]);

  return (
    <FocusRadioContext.Provider
      value={{
        queue,
        currentIndex,
        currentTrack,
        isPlaying,
        isBuffering,
        volume,
        isMuted,
        shuffle,
        repeatMode,
        savedPlaylists,
        isMiniPlayerOpen,
        isMiniPlayerCollapsed,
        errorMessage,
        currentTime,
        duration,
        savedPlaybackPosition,
        play,
        pause,
        togglePlay,
        next,
        prev,
        seekTo,
        resumeFromSavedPosition,
        setVolume,
        toggleMute,
        setShuffle,
        setRepeatMode,
        addToQueue,
        addTracksToQueue,
        removeFromQueue,
        moveInQueue,
        playTrackAtIndex,
        clearQueue,
        saveCurrentPlaylist,
        savePlaylistDirectly,
        loadSavedPlaylist,
        deleteSavedPlaylist,
        renameSavedPlaylist,
        setMiniPlayerOpen,
        setMiniPlayerCollapsed,
        clearError,
      }}
    >
      {children}
      {/* Persistent Hidden YouTube IFrame */}
      <div
        style={{
          position: 'fixed',
          left: -9999,
          top: -9999,
          width: 200,
          height: 200,
          pointerEvents: 'none',
          visibility: 'hidden',
        }}
        aria-hidden="true"
      >
        <div id="focus-radio-yt-container" />
      </div>
    </FocusRadioContext.Provider>
  );
};

const FALLBACK_FOCUS_RADIO_CONTEXT: FocusRadioContextType = {
  queue: CURATED_STARTER_TRACKS,
  currentIndex: 0,
  currentTrack: CURATED_STARTER_TRACKS[0] || null,
  isPlaying: false,
  isBuffering: false,
  volume: 70,
  isMuted: false,
  shuffle: false,
  repeatMode: 'all',
  savedPlaylists: [],
  isMiniPlayerOpen: false,
  isMiniPlayerCollapsed: false,
  errorMessage: null,
  currentTime: 0,
  duration: 0,
  savedPlaybackPosition: 0,
  play: () => {},
  pause: () => {},
  togglePlay: () => {},
  next: () => {},
  prev: () => {},
  seekTo: () => {},
  resumeFromSavedPosition: () => {},
  setVolume: () => {},
  toggleMute: () => {},
  setShuffle: () => {},
  setRepeatMode: () => {},
  addToQueue: () => {},
  addTracksToQueue: () => {},
  removeFromQueue: () => {},
  moveInQueue: () => {},
  playTrackAtIndex: () => {},
  clearQueue: () => {},
  saveCurrentPlaylist: () => {},
  savePlaylistDirectly: () => {},
  loadSavedPlaylist: () => {},
  deleteSavedPlaylist: () => {},
  renameSavedPlaylist: () => {},
  setMiniPlayerOpen: () => {},
  setMiniPlayerCollapsed: () => {},
  clearError: () => {},
};

export const useFocusRadio = () => {
  const ctx = useContext(FocusRadioContext);
  return ctx || FALLBACK_FOCUS_RADIO_CONTEXT;
};
