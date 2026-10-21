import React, { useState, useRef, useCallback } from 'react';
import {
  Radio,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  ExternalLink,
  AlertCircle,
  Volume2,
  VolumeX,
  PlayCircle,
  X,
  Minimize2,
  Maximize2,
  ListMusic,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  ListPlus,
  FolderPlus,
  Play,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  isValidYouTubeUrl,
  isYouTubePlaylistUrl,
  extractYouTubePlaylistId,
  toYouTubeEmbedUrlWithControls,
  sendYouTubeCommand,
} from '../../utils/youtubeValidator';
import { AudioVisualizer } from '../ui/AudioVisualizer';

// ── Pre-seeded ambient playlist & stations ──────────────────────────────────
const PRESET_STATIONS: { label: string; url: string }[] = [
  { label: '📚 Lo-Fi Hip Hop Radio — Beats to Study/Relax', url: 'https://www.youtube.com/watch?v=jfKfPfyJRdk' },
  { label: '🎶 Deep Work Lo-Fi (Full Playlist)', url: 'https://www.youtube.com/playlist?list=PLofht4PTcKYnaH8w5gkDCAPqNGAW38VCG' },
  { label: '☕ Coffee Shop Ambience', url: 'https://www.youtube.com/watch?v=h__V03XTAOE' },
  { label: '🎻 Classical Study Playlist (Full)', url: 'https://www.youtube.com/playlist?list=PLDCE8FF1214D2A9CA' },
  { label: '🌧️ Rain & Thunder Sounds', url: 'https://www.youtube.com/watch?v=mPZkdNFkNps' },
  { label: '🎹 Deep Focus — Piano', url: 'https://www.youtube.com/watch?v=5qap5aO4i9A' },
  { label: '🌊 Ocean Waves Meditation', url: 'https://www.youtube.com/watch?v=bn9F19Hi1Lk' },
  { label: '🔥 Deep Work Chill Mix', url: 'https://www.youtube.com/watch?v=DWcJFNfaw9c' },
];

export const FocusRadioPopout: React.FC = () => {
  const {
    state,
    addRadioUrl,
    removeRadioUrl,
    reorderRadioUrl,
    radioQueue,
    radioLoopMode,
    radioIsShuffle,
    activeRadioStation,
    activeRadioIndex,
    activeRadioSource,
    setActiveRadio,
    addToRadioQueue,
    removeFromRadioQueue,
    clearRadioQueue,
    reorderRadioQueue,
    cycleRadioLoopMode,
    toggleRadioShuffle,
    playNextTrack,
    playPrevTrack,
    customPlaylists,
    activeCustomPlaylistId,
    createCustomPlaylist,
    deleteCustomPlaylist,
    addTrackToCustomPlaylist,
    removeTrackFromCustomPlaylist,
    reorderTrackInCustomPlaylist,
    playCustomPlaylist,
    addPlaylistToRadioQueue,
  } = useApp();

  const activeCustomPlaylist = customPlaylists.find((p) => p.id === activeCustomPlaylistId) ?? null;
  const radioUrls = state.radioUrls ?? [];
  const showRadio = state.settings?.showFocusRadio ?? false;

  const [isOpen, setIsOpen] = useState(true);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [iframeError, setIframeError] = useState(false);
  const [activeTab, setActiveTab] = useState<'stations' | 'my_playlists' | 'queue'>('stations');
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);

  // Modal / drawer states
  const [showNewPlaylistModal, setShowNewPlaylistModal] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [newPlaylistDesc, setNewPlaylistDesc] = useState('');
  const [newPlaylistYtUrl, setNewPlaylistYtUrl] = useState('');
  const [quickYtPlaylistUrl, setQuickYtPlaylistUrl] = useState('');
  const [quickYtError, setQuickYtError] = useState('');

  const [showAddTrackModal, setShowAddTrackModal] = useState(false);
  const [newTrackTitle, setNewTrackTitle] = useState('');
  const [newTrackUrl, setNewTrackUrl] = useState('');
  const [trackError, setTrackError] = useState('');

  const [addStationMode, setAddStationMode] = useState<'url' | 'preset' | null>(null);
  const [newStationLabel, setNewStationLabel] = useState('');
  const [newStationUrl, setNewStationUrl] = useState('');
  const [stationUrlError, setStationUrlError] = useState('');

  const iframeRef = useRef<HTMLIFrameElement>(null);

  const activeStation = activeRadioStation;

  // ── Player Command Dispatchers (native YouTube API controls) ────────────
  const handleNext = useCallback(() => {
    // If playing an external YouTube playlist, send native nextVideo command
    if (activeStation && isYouTubePlaylistUrl(activeStation.url)) {
      sendYouTubeCommand(iframeRef.current, 'nextVideo');
    }
    playNextTrack();
  }, [activeStation, playNextTrack]);

  const handlePrev = useCallback(() => {
    // If playing an external YouTube playlist, send native previousVideo command
    if (activeStation && isYouTubePlaylistUrl(activeStation.url)) {
      sendYouTubeCommand(iframeRef.current, 'previousVideo');
    }
    playPrevTrack();
  }, [activeStation, playPrevTrack]);

  const handleShuffleToggle = useCallback(() => {
    const nextShuffleState = !radioIsShuffle;
    toggleRadioShuffle();
    // Dispatch setShuffle command to YouTube iframe
    sendYouTubeCommand(iframeRef.current, 'setShuffle', [nextShuffleState]);
  }, [radioIsShuffle, toggleRadioShuffle]);

  const handleLoopCycle = useCallback(() => {
    cycleRadioLoopMode();
    const nextIsLoop = radioLoopMode === 'off';
    sendYouTubeCommand(iframeRef.current, 'setLoop', [nextIsLoop]);
  }, [radioLoopMode, cycleRadioLoopMode]);

  // ── Playlist Handlers ───────────────────────────────────────────────────
  const handleCreatePlaylist = useCallback(() => {
    if (!newPlaylistName.trim() && !newPlaylistYtUrl.trim()) return;
    const id = createCustomPlaylist(
      newPlaylistName.trim() || 'My YouTube Playlist',
      newPlaylistDesc.trim(),
      newPlaylistYtUrl.trim() || undefined
    );
    setNewPlaylistName('');
    setNewPlaylistDesc('');
    setNewPlaylistYtUrl('');
    setShowNewPlaylistModal(false);
    setSelectedPlaylistId(id);
  }, [newPlaylistName, newPlaylistDesc, newPlaylistYtUrl, createCustomPlaylist]);

  const handleQuickImportYtPlaylist = useCallback(() => {
    const trimmed = quickYtPlaylistUrl.trim();
    if (!trimmed) return;
    if (!isValidYouTubeUrl(trimmed)) {
      setQuickYtError('Please enter a valid YouTube playlist or video link.');
      return;
    }
    const playlistId = extractYouTubePlaylistId(trimmed);
    const name = playlistId
      ? `YouTube Playlist #${customPlaylists.length + 1}`
      : `Focus Track #${customPlaylists.length + 1}`;
    const id = createCustomPlaylist(name, 'Imported from YouTube playlist link', trimmed);
    setQuickYtPlaylistUrl('');
    setQuickYtError('');
    setSelectedPlaylistId(id);
  }, [quickYtPlaylistUrl, customPlaylists.length, createCustomPlaylist]);

  const handleAddTrack = useCallback(() => {
    if (!selectedPlaylistId) return;
    if (!isValidYouTubeUrl(newTrackUrl)) {
      setTrackError('Please enter a valid YouTube video URL.');
      return;
    }
    const success = addTrackToCustomPlaylist(selectedPlaylistId, {
      title: newTrackTitle.trim() || 'Study Track',
      url: newTrackUrl,
    });
    if (!success) {
      setTrackError('Could not parse YouTube video ID from this URL.');
      return;
    }
    setNewTrackTitle('');
    setNewTrackUrl('');
    setTrackError('');
    setShowAddTrackModal(false);
  }, [selectedPlaylistId, newTrackUrl, newTrackTitle, addTrackToCustomPlaylist]);

  // ── Add Station URL ─────────────────────────────────────────────────────
  const handleAddStationUrl = useCallback(() => {
    if (!isValidYouTubeUrl(newStationUrl)) {
      setStationUrlError('Please enter a valid YouTube URL (youtube.com/watch, playlist, or youtu.be).');
      return;
    }
    const label = newStationLabel.trim() || 'My YouTube Station';
    addRadioUrl(label, newStationUrl);
    setNewStationLabel('');
    setNewStationUrl('');
    setStationUrlError('');
    setAddStationMode(null);
  }, [newStationUrl, newStationLabel, addRadioUrl]);

  if (!showRadio) return null;

  const currentEmbedUrl = activeStation
    ? toYouTubeEmbedUrlWithControls(activeStation.url, {
        loopMode: radioLoopMode,
        isMuted,
        autoplay: true,
      })
    : null;

  const activePlaylist = customPlaylists.find((p) => p.id === selectedPlaylistId) ?? null;

  // ── Render Floating Trigger (when closed) ─────────────────────────────────
  if (!isOpen) {
    return (
      <aside aria-label="Focus Radio" className="fixed bottom-6 right-6 z-50">
        <button
          onClick={() => {
            setIsOpen(true);
            setIsMinimized(false);
          }}
          className="group flex items-center gap-2.5 px-4 py-3 rounded-full bg-espresso-950 dark:bg-ivory-100 text-white dark:text-espresso-950 shadow-2xl hover:scale-105 active:scale-95 transition-all duration-200 border border-ivory-300/30 dark:border-espresso-700/50"
          title="Open Focus Radio popout player"
        >
          <div className="relative">
            <Radio className="w-5 h-5 text-terracotta-400 dark:text-terracotta-600 animate-pulse" />
          </div>
          <span className="text-xs font-semibold font-mono tracking-wide">
            {activeStation ? activeStation.label : 'Focus Radio'}
          </span>
          {activeStation && (
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
          )}
        </button>
      </aside>
    );
  }

  return (
    <aside aria-label="Focus Radio" className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      {/* ── Persistent Audio Iframe ── */}
      {activeStation && currentEmbedUrl && (
        <div
          className={
            isMinimized
              ? 'w-px h-px opacity-0 pointer-events-none overflow-hidden absolute -bottom-[9999px]'
              : 'w-full'
          }
        >
          <div className="rounded-xl overflow-hidden border border-ivory-300 dark:border-espresso-700 bg-black relative mb-3">
            {/* Overlay Controls */}
            <div className="absolute top-2 right-2 z-10 flex gap-1.5">
              <button
                onClick={() => setIsMuted(!isMuted)}
                className="p-1.5 rounded-full bg-black/60 text-white hover:bg-black/80 transition"
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={() => setActiveRadio(null)}
                className="p-1.5 rounded-full bg-black/60 text-white hover:bg-black/80 transition"
                title="Stop playback"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {iframeError ? (
              <div className="flex flex-col items-center justify-center h-36 text-ivory-100 gap-2 p-3 text-center">
                <AlertCircle className="w-5 h-5 text-amber-400" />
                <p className="text-xs">Cannot embed this video. Open directly on YouTube.</p>
                <a
                  href={activeStation.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] flex items-center gap-1 text-terracotta-400 hover:underline"
                >
                  <ExternalLink className="w-3 h-3" />
                  Open on YouTube
                </a>
              </div>
            ) : (
              <iframe
                ref={iframeRef}
                key={currentEmbedUrl}
                src={currentEmbedUrl}
                title={activeStation.label}
                allow="autoplay; encrypted-media"
                allowFullScreen
                className="w-full aspect-video"
                onError={() => setIframeError(true)}
              />
            )}

            <div className="p-2 bg-espresso-950 text-ivory-200 text-xs font-mono truncate flex items-center justify-between gap-1.5">
              <div className="flex items-center gap-1.5 truncate">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                <span className="truncate">▶ {activeStation.label}</span>
              </div>
              <span className="text-[10px] text-ivory-400 uppercase tracking-wider shrink-0">
                {activeRadioSource === 'playlist'
                  ? 'Custom Playlist'
                  : activeRadioSource === 'queue'
                  ? 'Queue'
                  : 'Station'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── Minimized Capsule Pill ── */}
      {isMinimized ? (
        <div className="flex items-center gap-2 p-2 px-3.5 rounded-full bg-espresso-950/95 dark:bg-ivory-100/95 text-white dark:text-espresso-950 shadow-2xl backdrop-blur-md border border-ivory-300/30 dark:border-espresso-750 transition-all duration-200 neon-ring">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setIsMinimized(false)}>
            <Radio className="w-4 h-4 text-terracotta-400 dark:text-terracotta-600 animate-pulse" />
            <span className="text-xs font-semibold max-w-[120px] sm:max-w-[160px] truncate">
              {activeStation ? activeStation.label : 'Focus Radio'}
            </span>
            {activeStation && (
              <AudioVisualizer
                isPlaying={!isMuted}
                barsCount={4}
                maxHeight={14}
                color="var(--accent)"
                className="ml-1"
              />
            )}
          </div>

          <div className="flex items-center gap-1 ml-1 border-l border-white/20 dark:border-espresso-900/20 pl-2">
            {activeStation && (
              <>
                <button
                  onClick={handlePrev}
                  className="p-1 hover:text-terracotta-400 transition"
                  title="Previous track"
                >
                  <SkipBack className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={handleNext}
                  className="p-1 hover:text-terracotta-400 transition"
                  title="Next track"
                >
                  <SkipForward className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setIsMuted(!isMuted)}
                  className="p-1 hover:text-terracotta-400 transition"
                  title={isMuted ? 'Unmute' : 'Mute'}
                >
                  {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                </button>
              </>
            )}
            <button
              onClick={() => setIsMinimized(false)}
              className="p-1 hover:text-terracotta-400 transition"
              title="Expand popout player"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 hover:text-red-400 transition"
              title="Close popout"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ) : (
        /* ── Full Expanded Popout Card ── */
        <div className="w-[390px] sm:w-[430px] max-w-[calc(100vw-2rem)] rounded-2xl border border-ivory-300 dark:border-espresso-750 bg-white/95 dark:bg-espresso-900/95 backdrop-blur-xl shadow-2xl p-4 sm:p-5 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-200 cyber-card">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-ivory-200 dark:border-espresso-800 pb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-terracotta-100 dark:bg-terracotta-950 text-terracotta-600 dark:text-terracotta-400 shadow-xs">
                <Radio className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-serif text-base font-bold text-espresso-950 dark:text-ivory-50">
                    Focus Radio Popout
                  </h3>
                  {activeStation && (
                    <AudioVisualizer
                      isPlaying={!isMuted}
                      barsCount={5}
                      maxHeight={16}
                      color="var(--accent)"
                    />
                  )}
                </div>
                <p className="text-[11px] text-espresso-400 dark:text-espresso-500">
                  Ambient focus sound across all tabs & panels
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsMinimized(true)}
                className="p-1.5 rounded-lg text-espresso-400 hover:text-espresso-700 dark:hover:text-ivory-100 hover:bg-ivory-100 dark:hover:bg-espresso-800 transition"
                title="Minimize to floating capsule"
              >
                <Minimize2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg text-espresso-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-ivory-100 dark:hover:bg-espresso-800 transition"
                title="Close popout player"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* ── Audio Controls Bar (Shuffle, Prev, Next, Loop) ── */}
          <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-ivory-100/70 dark:bg-espresso-950/60 border border-ivory-200 dark:border-espresso-800">
            <div className="flex items-center gap-1.5">
              {/* Shuffle Toggle */}
              <button
                onClick={handleShuffleToggle}
                className={`p-1.5 rounded-lg text-xs flex items-center gap-1 transition ${
                  radioIsShuffle
                    ? 'bg-terracotta-500 text-white shadow-xs font-semibold'
                    : 'text-espresso-500 dark:text-espresso-400 hover:bg-ivory-200 dark:hover:bg-espresso-800'
                }`}
                title={radioIsShuffle ? 'Shuffle: ON' : 'Shuffle: OFF'}
              >
                <Shuffle className="w-3.5 h-3.5" />
                <span className="text-[10px]">Shuffle</span>
              </button>

              {/* Loop Mode Cycle Toggle */}
              <button
                onClick={handleLoopCycle}
                className={`p-1.5 rounded-lg text-xs flex items-center gap-1 transition ${
                  radioLoopMode !== 'off'
                    ? 'bg-terracotta-500 text-white shadow-xs font-semibold'
                    : 'text-espresso-500 dark:text-espresso-400 hover:bg-ivory-200 dark:hover:bg-espresso-800'
                }`}
                title={
                  radioLoopMode === 'off'
                    ? 'Loop: OFF (click to loop all)'
                    : radioLoopMode === 'all'
                    ? 'Loop: ALL (click to loop current track)'
                    : 'Loop: CURRENT TRACK (click to turn off)'
                }
              >
                {radioLoopMode === 'one' ? (
                  <Repeat1 className="w-3.5 h-3.5" />
                ) : (
                  <Repeat className="w-3.5 h-3.5" />
                )}
                <span className="text-[10px] font-mono uppercase">
                  {radioLoopMode === 'off' ? 'Loop Off' : radioLoopMode === 'all' ? 'Loop All' : 'Loop 1'}
                </span>
              </button>
            </div>

            {/* Prev / Next Track */}
            <div className="flex items-center gap-1">
              <button
                onClick={handlePrev}
                className="p-1.5 rounded-lg text-espresso-600 dark:text-ivory-200 hover:bg-ivory-200 dark:hover:bg-espresso-800 transition"
                title="Previous track"
              >
                <SkipBack className="w-4 h-4" />
              </button>
              <button
                onClick={handleNext}
                className="p-1.5 rounded-lg text-espresso-600 dark:text-ivory-200 hover:bg-ivory-200 dark:hover:bg-espresso-800 transition"
                title="Next track"
              >
                <SkipForward className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* ── Navigation Tabs ── */}
          <div className="flex items-center justify-between border-b border-ivory-200 dark:border-espresso-800 pb-2">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setActiveTab('stations')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition ${
                  activeTab === 'stations'
                    ? 'bg-terracotta-600 text-white shadow-xs'
                    : 'text-espresso-600 dark:text-espresso-300 hover:bg-ivory-100 dark:hover:bg-espresso-800'
                }`}
              >
                Stations ({radioUrls.length})
              </button>
              <button
                onClick={() => {
                  setActiveTab('my_playlists');
                  setSelectedPlaylistId(null);
                }}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition flex items-center gap-1 ${
                  activeTab === 'my_playlists'
                    ? 'bg-terracotta-600 text-white shadow-xs'
                    : 'text-espresso-600 dark:text-espresso-300 hover:bg-ivory-100 dark:hover:bg-espresso-800'
                }`}
              >
                <ListMusic className="w-3 h-3" />
                My Playlists ({customPlaylists.length})
              </button>
              <button
                onClick={() => setActiveTab('queue')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition ${
                  activeTab === 'queue'
                    ? 'bg-terracotta-600 text-white shadow-xs'
                    : 'text-espresso-600 dark:text-espresso-300 hover:bg-ivory-100 dark:hover:bg-espresso-800'
                }`}
              >
                My Queue ({radioQueue.length})
              </button>
            </div>

            {/* Tab-specific top right buttons */}
            {activeTab === 'my_playlists' && (
              <button
                onClick={() => setShowNewPlaylistModal(true)}
                className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-terracotta-600 hover:bg-terracotta-700 text-white transition flex items-center gap-0.5 shadow-xs"
              >
                <FolderPlus className="w-3 h-3" />
                New Playlist
              </button>
            )}
            {activeTab === 'stations' && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setAddStationMode(addStationMode === 'preset' ? null : 'preset')}
                  className="text-[11px] font-semibold px-2 py-0.5 rounded-md border border-ivory-300 dark:border-espresso-700 text-espresso-600 dark:text-espresso-300 hover:bg-ivory-100 dark:hover:bg-espresso-800 transition"
                >
                  + Preset
                </button>
                <button
                  onClick={() => setAddStationMode(addStationMode === 'url' ? null : 'url')}
                  className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-terracotta-600 hover:bg-terracotta-700 text-white transition flex items-center gap-0.5 shadow-xs"
                >
                  <Plus className="w-3 h-3" />
                  Add URL
                </button>
              </div>
            )}
          </div>

          {/* ── CREATE NEW PLAYLIST DRAWER ── */}
          {showNewPlaylistModal && (
            <div className="p-3.5 rounded-xl bg-ivory-50 dark:bg-espresso-950 border border-ivory-200 dark:border-espresso-800 space-y-2.5">
              <p className="text-[11px] font-semibold text-espresso-700 dark:text-espresso-300 uppercase font-mono tracking-wider">
                Create My Own Playlist
              </p>
              <input
                type="text"
                placeholder="Playlist Name (e.g. Late Night Coding, Ambient Study)"
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-ivory-300 dark:border-espresso-700 bg-white dark:bg-espresso-900 text-xs text-espresso-900 dark:text-ivory-100 placeholder:text-espresso-400 focus:outline-none focus:ring-1 focus:ring-terracotta-400 transition"
              />
              <input
                type="text"
                placeholder="Description (optional)"
                value={newPlaylistDesc}
                onChange={(e) => setNewPlaylistDesc(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-ivory-300 dark:border-espresso-700 bg-white dark:bg-espresso-900 text-xs text-espresso-900 dark:text-ivory-100 placeholder:text-espresso-400 focus:outline-none focus:ring-1 focus:ring-terracotta-400 transition"
              />
              <input
                type="url"
                placeholder="YouTube Playlist Link (optional, https://www.youtube.com/playlist?list=...)"
                value={newPlaylistYtUrl}
                onChange={(e) => setNewPlaylistYtUrl(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-ivory-300 dark:border-espresso-700 bg-white dark:bg-espresso-900 text-xs text-espresso-900 dark:text-ivory-100 placeholder:text-espresso-400 focus:outline-none focus:ring-1 focus:ring-terracotta-400 font-mono transition"
              />
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={handleCreatePlaylist}
                  className="px-3 py-1 rounded-lg bg-terracotta-600 hover:bg-terracotta-700 text-white text-xs font-semibold transition flex items-center gap-1"
                >
                  <FolderPlus className="w-3 h-3" />
                  Create Playlist
                </button>
                <button
                  onClick={() => setShowNewPlaylistModal(false)}
                  className="px-2.5 py-1 rounded-lg border border-ivory-300 dark:border-espresso-700 text-xs text-espresso-600 dark:text-espresso-300 hover:bg-ivory-100 dark:hover:bg-espresso-800 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* ── ADD TRACK TO PLAYLIST DRAWER ── */}
          {showAddTrackModal && selectedPlaylistId && (
            <div className="p-3.5 rounded-xl bg-ivory-50 dark:bg-espresso-950 border border-ivory-200 dark:border-espresso-800 space-y-2.5">
              <p className="text-[11px] font-semibold text-espresso-700 dark:text-espresso-300 uppercase font-mono tracking-wider">
                Add Track to {activePlaylist?.name}
              </p>
              <input
                type="text"
                placeholder="Track Title (e.g. Synthwave Study Session)"
                value={newTrackTitle}
                onChange={(e) => setNewTrackTitle(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-ivory-300 dark:border-espresso-700 bg-white dark:bg-espresso-900 text-xs text-espresso-900 dark:text-ivory-100 placeholder:text-espresso-400 focus:outline-none focus:ring-1 focus:ring-terracotta-400 transition"
              />
              <input
                type="url"
                placeholder="YouTube URL (https://www.youtube.com/watch?v=... or youtu.be/...)"
                value={newTrackUrl}
                onChange={(e) => {
                  setNewTrackUrl(e.target.value);
                  setTrackError('');
                }}
                className="w-full px-3 py-1.5 rounded-lg border border-ivory-300 dark:border-espresso-700 bg-white dark:bg-espresso-900 text-xs text-espresso-900 dark:text-ivory-100 placeholder:text-espresso-400 focus:outline-none focus:ring-1 focus:ring-terracotta-400 transition font-mono"
              />
              {trackError && (
                <p className="text-[11px] text-red-600 dark:text-red-400 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  {trackError}
                </p>
              )}
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={handleAddTrack}
                  className="px-3 py-1 rounded-lg bg-terracotta-600 hover:bg-terracotta-700 text-white text-xs font-semibold transition flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  Add Song
                </button>
                <button
                  onClick={() => setShowAddTrackModal(false)}
                  className="px-2.5 py-1 rounded-lg border border-ivory-300 dark:border-espresso-700 text-xs text-espresso-600 dark:text-espresso-300 hover:bg-ivory-100 dark:hover:bg-espresso-800 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* ── TAB 1: MY PLAYLISTS ("Make My Own Playlist") ── */}
          {activeTab === 'my_playlists' && (
            <div className="space-y-2">
              {/* If viewing inside a specific playlist */}
              {activePlaylist ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between pb-1">
                    <button
                      onClick={() => setSelectedPlaylistId(null)}
                      className="text-xs text-terracotta-600 dark:text-terracotta-400 hover:underline flex items-center gap-1"
                    >
                      ← Back to All Playlists
                    </button>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => playCustomPlaylist(activePlaylist.id, false)}
                        disabled={activePlaylist.items.length === 0 && !activePlaylist.youtubePlaylistUrl && !activePlaylist.youtubePlaylistId}
                        className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-terracotta-600 hover:bg-terracotta-700 text-white disabled:opacity-40 transition flex items-center gap-1 shadow-xs"
                        title="Play sequentially"
                      >
                        <Play className="w-3 h-3 fill-current" />
                        Play
                      </button>
                      <button
                        onClick={() => playCustomPlaylist(activePlaylist.id, true)}
                        disabled={activePlaylist.items.length === 0 && !activePlaylist.youtubePlaylistUrl && !activePlaylist.youtubePlaylistId}
                        className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-espresso-950 dark:bg-ivory-100 text-white dark:text-espresso-950 hover:bg-espresso-800 transition flex items-center gap-1 shadow-xs disabled:opacity-40"
                        title="Play shuffled"
                      >
                        <Shuffle className="w-3 h-3" />
                        Shuffle
                      </button>
                      <button
                        onClick={() => addPlaylistToRadioQueue(activePlaylist.id)}
                        className="text-xs font-semibold px-2 py-1 rounded-lg border border-ivory-300 dark:border-espresso-700 text-espresso-700 dark:text-ivory-200 hover:bg-ivory-100 dark:hover:bg-espresso-800 transition flex items-center gap-0.5 shadow-xs"
                        title="Queue playlist"
                      >
                        <ListPlus className="w-3 h-3" />
                        Queue
                      </button>
                      <button
                        onClick={() => setShowAddTrackModal(true)}
                        className="text-xs font-semibold px-2 py-1 rounded-lg border border-ivory-300 dark:border-espresso-700 text-espresso-700 dark:text-ivory-200 hover:bg-ivory-100 dark:hover:bg-espresso-800 transition flex items-center gap-0.5"
                      >
                        <Plus className="w-3 h-3" />
                        Song
                      </button>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-ivory-50 dark:bg-espresso-950/70 border border-ivory-200 dark:border-espresso-800 space-y-1">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold text-espresso-900 dark:text-ivory-100">
                        {activePlaylist.name}
                      </h3>
                      {(activePlaylist.youtubePlaylistUrl || activePlaylist.youtubePlaylistId) && (
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 font-bold flex items-center gap-1">
                          <ListMusic className="w-2.5 h-2.5" />
                          YouTube Playlist
                        </span>
                      )}
                    </div>
                    {activePlaylist.description && (
                      <p className="text-[11px] text-espresso-500 dark:text-espresso-400">
                        {activePlaylist.description}
                      </p>
                    )}
                    <span className="text-[10px] text-espresso-400 font-mono block">
                      {activePlaylist.items.length} {activePlaylist.items.length === 1 ? 'track' : 'tracks'}
                      {activePlaylist.youtubePlaylistUrl && ' · Full Playlist Linked'}
                    </span>
                  </div>

                  {/* Track list inside playlist */}
                  <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                    {activePlaylist.items.length === 0 ? (
                      <div className="text-center py-6 text-espresso-400 dark:text-espresso-500 space-y-1">
                        <ListMusic className="w-6 h-6 mx-auto opacity-30" />
                        <p className="text-xs font-medium">No tracks yet.</p>
                        <p className="text-[11px] text-espresso-400">
                          Click &quot;+ Song&quot; above to add your favorite YouTube links to this playlist.
                        </p>
                      </div>
                    ) : (
                      activePlaylist.items.map((item, idx) => {
                        const isThisPlaying =
                          activeRadioSource === 'playlist' &&
                          activeStation?.id === item.id;
                        return (
                          <div
                            key={item.id}
                            onClick={() => {
                              setActiveRadio(idx, 'playlist');
                              setIframeError(false);
                            }}
                            className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs cursor-pointer transition ${
                              isThisPlaying
                                ? 'border-terracotta-400 bg-terracotta-50/70 dark:bg-terracotta-950/40 dark:border-terracotta-600 font-semibold text-terracotta-900 dark:text-terracotta-200'
                                : 'border-ivory-200 dark:border-espresso-800 hover:bg-ivory-50 dark:hover:bg-espresso-850 text-espresso-800 dark:text-ivory-200'
                            }`}
                          >
                            <span className="font-mono text-[10px] text-espresso-400 w-4 text-center">
                              #{idx + 1}
                            </span>

                            {/* Reorder Arrows */}
                            <div className="flex flex-col gap-0.5 shrink-0">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  reorderTrackInCustomPlaylist(activePlaylist.id, idx, idx - 1);
                                }}
                                disabled={idx === 0}
                                className="text-espresso-400 hover:text-espresso-700 dark:hover:text-ivory-100 disabled:opacity-20 transition"
                                title="Move up"
                              >
                                <ChevronUp className="w-3 h-3" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  reorderTrackInCustomPlaylist(activePlaylist.id, idx, idx + 1);
                                }}
                                disabled={idx === activePlaylist.items.length - 1}
                                className="text-espresso-400 hover:text-espresso-700 dark:hover:text-ivory-100 disabled:opacity-20 transition"
                                title="Move down"
                              >
                                <ChevronDown className="w-3 h-3" />
                              </button>
                            </div>

                            <span className="flex-1 truncate">
                              {isThisPlaying ? '▶ ' : ''}
                              {item.title}
                            </span>

                            {/* Add to queue shortcut */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                addToRadioQueue({ label: item.title, url: item.url });
                              }}
                              className="p-1 text-espresso-400 hover:text-terracotta-600 dark:hover:text-terracotta-400 transition"
                              title="Add to queue"
                            >
                              <ListPlus className="w-3.5 h-3.5" />
                            </button>

                            <a
                              href={item.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="p-1 text-espresso-400 hover:text-espresso-700 dark:hover:text-ivory-100 transition"
                              title="Open on YouTube"
                            >
                              <ExternalLink className="w-3 h-3" />
                            </a>

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                removeTrackFromCustomPlaylist(activePlaylist.id, item.id);
                              }}
                              className="p-1 text-espresso-400 hover:text-red-600 dark:hover:text-red-400 transition"
                              title="Remove track"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              ) : (
                /* List of all custom playlists */
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {/* Quick Paste YouTube Playlist Box */}
                  <div className="p-2.5 rounded-xl bg-ivory-50 dark:bg-espresso-950/70 border border-ivory-200 dark:border-espresso-800 space-y-1.5">
                    <span className="text-[10px] font-semibold text-espresso-700 dark:text-espresso-300 uppercase font-mono tracking-wider flex items-center gap-1">
                      <ListMusic className="w-3 h-3 text-terracotta-500" />
                      Paste YouTube Playlist Link
                    </span>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="url"
                        placeholder="https://www.youtube.com/playlist?list=..."
                        value={quickYtPlaylistUrl}
                        onChange={(e) => {
                          setQuickYtPlaylistUrl(e.target.value);
                          setQuickYtError('');
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleQuickImportYtPlaylist();
                          }
                        }}
                        className="flex-1 px-2.5 py-1 rounded-lg border border-ivory-300 dark:border-espresso-700 bg-white dark:bg-espresso-900 text-xs text-espresso-900 dark:text-ivory-100 placeholder:text-espresso-400 focus:outline-none focus:ring-1 focus:ring-terracotta-400 font-mono"
                      />
                      <button
                        onClick={handleQuickImportYtPlaylist}
                        disabled={!quickYtPlaylistUrl.trim()}
                        className="px-2.5 py-1 rounded-lg bg-terracotta-600 hover:bg-terracotta-700 text-white text-xs font-semibold disabled:opacity-40 transition flex items-center gap-1 shadow-xs shrink-0"
                      >
                        <Plus className="w-3 h-3" />
                        Add
                      </button>
                    </div>
                    {quickYtError && (
                      <p className="text-[10px] text-red-600 dark:text-red-400 flex items-center gap-1">
                        <AlertCircle className="w-2.5 h-2.5" />
                        {quickYtError}
                      </p>
                    )}
                  </div>

                  {customPlaylists.map((pl) => {
                    const isPlPlaying =
                      activeRadioSource === 'playlist' &&
                      activeCustomPlaylist?.id === pl.id;
                    const isPlayable = pl.items.length > 0 || Boolean(pl.youtubePlaylistUrl || pl.youtubePlaylistId);
                    return (
                      <div
                        key={pl.id}
                        className={`p-3 rounded-xl border transition ${
                          isPlPlaying
                            ? 'border-terracotta-500 bg-terracotta-50/60 dark:bg-terracotta-950/40'
                            : 'border-ivory-200 dark:border-espresso-800 hover:bg-ivory-50 dark:hover:bg-espresso-850'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div
                            className="flex-1 cursor-pointer"
                            onClick={() => setSelectedPlaylistId(pl.id)}
                          >
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {isPlPlaying && (
                                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                              )}
                              <h4 className="text-xs font-bold text-espresso-900 dark:text-ivory-100">
                                {pl.name}
                              </h4>
                              {(pl.youtubePlaylistUrl || pl.youtubePlaylistId) && (
                                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 font-bold">
                                  YouTube Playlist
                                </span>
                              )}
                            </div>
                            {pl.description && (
                              <p className="text-[11px] text-espresso-500 dark:text-espresso-400 truncate">
                                {pl.description}
                              </p>
                            )}
                            <span className="text-[10px] text-espresso-400 font-mono mt-0.5 block">
                              {pl.items.length} {pl.items.length === 1 ? 'track' : 'tracks'}
                              {pl.youtubePlaylistUrl && ' · Full Playlist Linked'}
                            </span>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => playCustomPlaylist(pl.id, false)}
                              disabled={!isPlayable}
                              className="p-1.5 rounded-lg bg-terracotta-600 hover:bg-terracotta-700 text-white disabled:opacity-30 transition"
                              title="Play playlist sequentially"
                            >
                              <Play className="w-3 h-3 fill-current" />
                            </button>
                            <button
                              onClick={() => playCustomPlaylist(pl.id, true)}
                              disabled={!isPlayable}
                              className="p-1.5 rounded-lg bg-espresso-950 dark:bg-ivory-100 text-white dark:text-espresso-950 hover:bg-espresso-800 transition disabled:opacity-30"
                              title="Play playlist shuffled"
                            >
                              <Shuffle className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => addPlaylistToRadioQueue(pl.id)}
                              disabled={!isPlayable}
                              className="p-1.5 rounded-lg border border-ivory-300 dark:border-espresso-700 text-espresso-700 dark:text-ivory-200 hover:bg-ivory-100 dark:hover:bg-espresso-800 transition disabled:opacity-30 shadow-xs"
                              title="Queue playlist"
                            >
                              <ListPlus className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => setSelectedPlaylistId(pl.id)}
                              className="text-xs px-2 py-1 rounded-md border border-ivory-300 dark:border-espresso-700 text-espresso-600 dark:text-espresso-300 hover:bg-ivory-100 dark:hover:bg-espresso-800 transition"
                              title="View & manage playlist songs"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => deleteCustomPlaylist(pl.id)}
                              className="p-1.5 text-espresso-400 hover:text-red-600 dark:hover:text-red-400 transition"
                              title="Delete playlist"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── TAB 2: YOUTUBE STATIONS & PASTED PLAYLIST LINKS ── */}
          {activeTab === 'stations' && (
            <div className="space-y-2">
              {/* Add Station URL Drawer */}
              {addStationMode === 'url' && (
                <div className="p-3.5 rounded-xl bg-ivory-50 dark:bg-espresso-950 border border-ivory-200 dark:border-espresso-800 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-semibold text-espresso-700 dark:text-espresso-300 uppercase font-mono tracking-wider">
                      Add YouTube Link or Full Playlist
                    </p>
                    {isYouTubePlaylistUrl(newStationUrl) && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 font-bold flex items-center gap-1 animate-pulse">
                        <ListMusic className="w-3 h-3" />
                        Playlist Detected
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    placeholder="Name (e.g. My Study Beats)"
                    value={newStationLabel}
                    onChange={(e) => setNewStationLabel(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-ivory-300 dark:border-espresso-700 bg-white dark:bg-espresso-900 text-xs text-espresso-900 dark:text-ivory-100 placeholder:text-espresso-400 focus:outline-none focus:ring-1 focus:ring-terracotta-400 transition"
                  />
                  <input
                    type="url"
                    placeholder="https://www.youtube.com/playlist?list=... or watch?v=..."
                    value={newStationUrl}
                    onChange={(e) => {
                      setNewStationUrl(e.target.value);
                      setStationUrlError('');
                    }}
                    className="w-full px-3 py-1.5 rounded-lg border border-ivory-300 dark:border-espresso-700 bg-white dark:bg-espresso-900 text-xs text-espresso-900 dark:text-ivory-100 placeholder:text-espresso-400 focus:outline-none focus:ring-1 focus:ring-terracotta-400 transition font-mono"
                  />
                  <p className="text-[10px] text-espresso-400 dark:text-espresso-500">
                    Paste any full YouTube playlist URL or video link. You can loop and shuffle the playlist anytime.
                  </p>
                  {stationUrlError && (
                    <p className="text-[11px] text-red-600 dark:text-red-400 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 shrink-0" />
                      {stationUrlError}
                    </p>
                  )}
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={handleAddStationUrl}
                      className="px-3 py-1 rounded-lg bg-terracotta-600 hover:bg-terracotta-700 text-white text-xs font-semibold transition flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" />
                      Save Link
                    </button>
                    <button
                      onClick={() => {
                        setAddStationMode(null);
                        setStationUrlError('');
                        setNewStationUrl('');
                        setNewStationLabel('');
                      }}
                      className="px-2.5 py-1 rounded-lg border border-ivory-300 dark:border-espresso-700 text-xs text-espresso-600 dark:text-espresso-300 hover:bg-ivory-100 dark:hover:bg-espresso-800 transition"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Preset Drawer */}
              {addStationMode === 'preset' && (
                <div className="p-3.5 rounded-xl bg-ivory-50 dark:bg-espresso-950 border border-ivory-200 dark:border-espresso-800 space-y-2 max-h-48 overflow-y-auto">
                  <p className="text-[11px] font-semibold text-espresso-700 dark:text-espresso-300 uppercase font-mono tracking-wider mb-1">
                    Preset Stations
                  </p>
                  {PRESET_STATIONS.map((preset) => {
                    const added = radioUrls.some((r) => r.url === preset.url);
                    return (
                      <div key={preset.url} className="flex items-center justify-between text-xs py-1">
                        <span className="text-espresso-800 dark:text-ivory-200 truncate pr-2">
                          {preset.label}
                        </span>
                        <button
                          onClick={() => {
                            if (!added) addRadioUrl(preset.label, preset.url);
                          }}
                          disabled={added}
                          className={`text-[11px] px-2 py-0.5 rounded-md font-semibold transition shrink-0 ${
                            added
                              ? 'text-espresso-400 dark:text-espresso-600 cursor-default'
                              : 'bg-terracotta-600 hover:bg-terracotta-700 text-white'
                          }`}
                        >
                          {added ? 'Added' : 'Add'}
                        </button>
                      </div>
                    );
                  })}
                  <button
                    onClick={() => setAddStationMode(null)}
                    className="mt-2 text-[11px] text-espresso-500 dark:text-espresso-400 hover:underline block"
                  >
                    Close presets
                  </button>
                </div>
              )}

              {/* Station items */}
              <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                {radioUrls.length === 0 ? (
                  <div className="text-center py-6 text-espresso-400 dark:text-espresso-500 space-y-1">
                    <Radio className="w-6 h-6 mx-auto opacity-30" />
                    <p className="text-xs">No saved YouTube links. Click &quot;+ Preset&quot; or &quot;+ Add Link&quot; above.</p>
                  </div>
                ) : (
                  radioUrls.map((station, idx) => {
                    const isActive = activeRadioSource === 'stations' && activeRadioIndex === idx;
                    return (
                      <div
                        key={station.id}
                        onClick={() => {
                          setActiveRadio(idx, 'stations');
                          setIframeError(false);
                        }}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs cursor-pointer transition ${
                          isActive
                            ? 'border-terracotta-400 bg-terracotta-50/70 dark:bg-terracotta-950/40 dark:border-terracotta-600 font-semibold text-terracotta-900 dark:text-terracotta-200'
                            : 'border-ivory-200 dark:border-espresso-800 hover:bg-ivory-50 dark:hover:bg-espresso-850 text-espresso-800 dark:text-ivory-200'
                        }`}
                      >
                        <div className="flex flex-col gap-0.5 shrink-0">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              reorderRadioUrl(station.id, 'up');
                            }}
                            disabled={idx === 0}
                            className="text-espresso-400 hover:text-espresso-700 dark:hover:text-ivory-100 disabled:opacity-20 transition"
                            title="Move up"
                          >
                            <ChevronUp className="w-3 h-3" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              reorderRadioUrl(station.id, 'down');
                            }}
                            disabled={idx === radioUrls.length - 1}
                            className="text-espresso-400 hover:text-espresso-700 dark:hover:text-ivory-100 disabled:opacity-20 transition"
                            title="Move down"
                          >
                            <ChevronDown className="w-3 h-3" />
                          </button>
                        </div>

                        <span className="flex-1 truncate flex items-center gap-1.5">
                          <span className="truncate">
                            {isActive ? '▶ ' : ''}
                            {station.label}
                          </span>
                          {(station.type === 'playlist' || isYouTubePlaylistUrl(station.url)) && (
                            <span className="px-1.5 py-0.5 text-[9px] font-mono rounded bg-purple-100 dark:bg-purple-950/70 text-purple-700 dark:text-purple-300 shrink-0 font-semibold flex items-center gap-0.5">
                              <ListMusic className="w-2.5 h-2.5" />
                              Playlist
                            </span>
                          )}
                        </span>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            addToRadioQueue({ label: station.label, url: station.url, type: station.type });
                          }}
                          className="p-1 text-espresso-400 hover:text-terracotta-600 dark:hover:text-terracotta-400 transition"
                          title="Add to queue"
                        >
                          <ListPlus className="w-3.5 h-3.5" />
                        </button>

                        <a
                          href={station.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="p-1 text-espresso-400 hover:text-espresso-700 dark:hover:text-ivory-100 transition"
                          title="Open on YouTube"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (activeRadioSource === 'stations') {
                              if (activeRadioIndex === idx) setActiveRadio(null);
                              else if (activeRadioIndex !== null && activeRadioIndex > idx)
                                setActiveRadio(activeRadioIndex - 1, 'stations');
                            }
                            removeRadioUrl(station.id);
                          }}
                          className="p-1 text-espresso-400 hover:text-red-600 dark:hover:text-red-400 transition"
                          title="Remove link"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* ── TAB 3: QUEUE ── */}
          {activeTab === 'queue' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-espresso-500 dark:text-espresso-400 px-1">
                <span>{radioQueue.length} {radioQueue.length === 1 ? 'track' : 'tracks'} in queue</span>
                {radioQueue.length > 0 && (
                  <button
                    onClick={clearRadioQueue}
                    className="text-[11px] text-red-500 hover:text-red-700 dark:hover:text-red-400 transition font-medium"
                  >
                    Clear queue
                  </button>
                )}
              </div>

              <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                {radioQueue.length === 0 ? (
                  <div className="text-center py-6 text-espresso-400 dark:text-espresso-500 space-y-1">
                    <ListMusic className="w-6 h-6 mx-auto opacity-30" />
                    <p className="text-xs font-medium">Your queue is empty.</p>
                    <p className="text-[11px] text-espresso-400">
                      Click the <ListPlus className="w-3 h-3 inline mx-0.5 text-terracotta-500" /> icon on any track or playlist to add it to your queue.
                    </p>
                  </div>
                ) : (
                  radioQueue.map((item, qIdx) => {
                    const isActive = activeRadioSource === 'queue' && activeRadioIndex === qIdx;
                    return (
                      <div
                        key={item.id}
                        onClick={() => {
                          setActiveRadio(qIdx, 'queue');
                          setIframeError(false);
                        }}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs cursor-pointer transition ${
                          isActive
                            ? 'border-terracotta-400 bg-terracotta-50/70 dark:bg-terracotta-950/40 dark:border-terracotta-600 font-semibold text-terracotta-900 dark:text-terracotta-200'
                            : 'border-ivory-200 dark:border-espresso-800 hover:bg-ivory-50 dark:hover:bg-espresso-850 text-espresso-800 dark:text-ivory-200'
                        }`}
                      >
                        <span className="font-mono text-[10px] text-espresso-400 w-4 text-center">
                          {qIdx + 1}
                        </span>

                        <div className="flex flex-col gap-0.5 shrink-0">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              reorderRadioQueue(qIdx, qIdx - 1);
                            }}
                            disabled={qIdx === 0}
                            className="text-espresso-400 hover:text-espresso-700 dark:hover:text-ivory-100 disabled:opacity-20 transition"
                            title="Move up in queue"
                          >
                            <ChevronUp className="w-3 h-3" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              reorderRadioQueue(qIdx, qIdx + 1);
                            }}
                            disabled={qIdx === radioQueue.length - 1}
                            className="text-espresso-400 hover:text-espresso-700 dark:hover:text-ivory-100 disabled:opacity-20 transition"
                            title="Move down in queue"
                          >
                            <ChevronDown className="w-3 h-3" />
                          </button>
                        </div>

                        <span className="flex-1 truncate">
                          {isActive ? '▶ ' : ''}
                          {item.label}
                        </span>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeFromRadioQueue(qIdx);
                          }}
                          className="p-1 text-espresso-400 hover:text-red-600 dark:hover:text-red-400 transition shrink-0"
                          title="Remove from queue"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {!activeStation && (
            <div className="flex items-center gap-2 text-[11px] text-espresso-500 dark:text-espresso-400 p-2.5 rounded-xl bg-ivory-100 dark:bg-espresso-800 border border-ivory-200 dark:border-espresso-750">
              <PlayCircle className="w-3.5 h-3.5 shrink-0 text-terracotta-500" />
              <span>Select any playlist, station, or queued track above to start playback.</span>
            </div>
          )}
        </div>
      )}
    </aside>
  );
};
