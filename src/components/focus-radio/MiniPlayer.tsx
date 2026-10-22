import React, { useState } from 'react';
import { useFocusRadio } from './FocusRadioContext';
import { Visualizer } from './Visualizer';
import { QueuePanel } from './QueuePanel';
import { PlaylistImport } from './PlaylistImport';
import { SavedPlaylistsModal } from './SavedPlaylistsModal';
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Volume2,
  VolumeX,
  Shuffle,
  Repeat,
  Repeat1,
  ChevronUp,
  ChevronDown,
  ListMusic,
  PlusCircle,
  Bookmark,
  Radio,
  X,
} from 'lucide-react';

export const MiniPlayer: React.FC = () => {
  const {
    currentTrack,
    isPlaying,
    isBuffering,
    volume,
    isMuted,
    shuffle,
    repeatMode,
    isMiniPlayerOpen,
    isMiniPlayerCollapsed,
    errorMessage,
    togglePlay,
    next,
    prev,
    setVolume,
    toggleMute,
    setShuffle,
    setRepeatMode,
    setMiniPlayerOpen,
    setMiniPlayerCollapsed,
    clearError,
  } = useFocusRadio();

  const [activeTab, setActiveTab] = useState<'none' | 'queue' | 'add' | 'playlists'>('none');
  const [isSavedPlaylistsOpen, setIsSavedPlaylistsOpen] = useState(false);

  if (!isMiniPlayerOpen) {
    return (
      <button
        onClick={() => setMiniPlayerOpen(true)}
        className="fixed bottom-4 right-4 z-40 px-3.5 py-2.5 rounded-full bg-[#0B0D0C] border border-[#C8FF45]/50 text-[#C8FF45] font-mono text-xs flex items-center gap-2 shadow-2xl hover:scale-105 active:scale-95 transition cursor-pointer"
        title="Open Focus Radio"
      >
        <Radio className="w-4 h-4 text-[#C8FF45] animate-pulse" />
        <span className="font-semibold">Focus Radio</span>
        {isPlaying && <span className="w-2 h-2 rounded-full bg-[#C8FF45] animate-ping" />}
      </button>
    );
  }

  return (
    <>
      <div
        className={`fixed z-40 transition-all duration-300 ${
          isMiniPlayerCollapsed
            ? 'bottom-4 right-4 w-72 sm:w-80'
            : 'bottom-4 right-4 w-[calc(100vw-2rem)] max-w-sm sm:max-w-md'
        } rounded-2xl bg-[#0B0D0C]/95 backdrop-blur-xl border border-zinc-800 shadow-2xl overflow-hidden`}
        style={{
          boxShadow: '0 20px 40px -15px rgba(0,0,0,0.8), 0 0 20px -5px rgba(200,255,69,0.15)',
        }}
      >
        {/* Error notification bar */}
        {errorMessage && (
          <div className="bg-rose-950/90 text-rose-200 px-3 py-1.5 text-[11px] flex items-center justify-between border-b border-rose-800">
            <span className="truncate">{errorMessage}</span>
            <button onClick={clearError} className="p-0.5 text-rose-400 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Top Control Bar: Title & Window Controls */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800/80 bg-zinc-950/60">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-2 h-2 rounded-full bg-[#C8FF45] animate-pulse shrink-0" />
            <span className="font-mono text-[10px] uppercase font-bold tracking-wider text-[#C8FF45] truncate">
              Focus Radio 2.0
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setMiniPlayerCollapsed(!isMiniPlayerCollapsed)}
              className="p-1 rounded text-zinc-400 hover:text-white transition"
              title={isMiniPlayerCollapsed ? 'Expand Radio' : 'Collapse Radio'}
            >
              {isMiniPlayerCollapsed ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
            <button
              onClick={() => setMiniPlayerOpen(false)}
              className="p-1 rounded text-zinc-400 hover:text-white transition cursor-pointer"
              title="Minimize to floating pill"
              aria-label="Minimize to floating pill"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Main Player Row */}
        <div className="p-3">
          <div className="flex items-center gap-3">
            {/* Thumbnail */}
            <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800 shrink-0">
              {currentTrack?.thumbnailUrl ? (
                <img
                  src={currentTrack.thumbnailUrl}
                  alt={currentTrack.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-zinc-600">
                  <Radio className="w-5 h-5" />
                </div>
              )}
              {isBuffering && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                  <span className="w-4 h-4 border-2 border-[#C8FF45] border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>

            {/* Track Info */}
            <div className="min-w-0 flex-1">
              <h4 className="text-xs font-semibold text-white truncate leading-tight">
                {currentTrack?.title || 'No Stream Selected'}
              </h4>
              <p className="text-[11px] text-zinc-400 truncate mt-0.5">
                {currentTrack?.author || 'Select a curated stream or paste a URL'}
              </p>
            </div>

            {/* Quick Play/Pause & Next */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={togglePlay}
                className="w-9 h-9 rounded-full bg-[#C8FF45] hover:bg-[#b8f533] text-black flex items-center justify-center transition shadow-md active:scale-95 cursor-pointer"
                title={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? (
                  <Pause className="w-4 h-4 fill-current" />
                ) : (
                  <Play className="w-4 h-4 fill-current ml-0.5" />
                )}
              </button>
              <button
                onClick={next}
                className="p-2 rounded-lg text-zinc-400 hover:text-white transition cursor-pointer"
                title="Next Track"
              >
                <SkipForward className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Visualizer & Controls (Expanded view) */}
          {!isMiniPlayerCollapsed && (
            <div className="mt-3 pt-3 border-t border-zinc-800/80 space-y-3">
              {/* Simulated Ambient Visualizer */}
              <div className="bg-zinc-950/70 rounded-xl p-2 border border-zinc-900 flex items-center justify-between">
                <Visualizer isPlaying={isPlaying} className="flex-1" />
                <span className="text-[9px] font-mono text-zinc-500 uppercase px-2">
                  Ambient Pulse
                </span>
              </div>

              {/* Playback & Volume Strip */}
              <div className="flex items-center justify-between gap-3 text-xs text-zinc-400">
                {/* Secondary Playback Modes */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={prev}
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-white transition"
                    title="Previous Track"
                  >
                    <SkipBack className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setShuffle(!shuffle)}
                    className={`p-1.5 rounded-lg transition ${
                      shuffle
                        ? 'text-[#C8FF45] bg-[#C8FF45]/15'
                        : 'text-zinc-500 hover:text-zinc-200'
                    }`}
                    title={shuffle ? 'Shuffle On' : 'Shuffle Off'}
                  >
                    <Shuffle className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      if (repeatMode === 'off') setRepeatMode('all');
                      else if (repeatMode === 'all') setRepeatMode('one');
                      else setRepeatMode('off');
                    }}
                    className={`p-1.5 rounded-lg transition ${
                      repeatMode !== 'off'
                        ? 'text-[#C8FF45] bg-[#C8FF45]/15'
                        : 'text-zinc-500 hover:text-zinc-200'
                    }`}
                    title={`Repeat: ${repeatMode}`}
                  >
                    {repeatMode === 'one' ? (
                      <Repeat1 className="w-3.5 h-3.5" />
                    ) : (
                      <Repeat className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>

                {/* Volume Slider */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={toggleMute}
                    className="text-zinc-400 hover:text-white transition"
                    title={isMuted ? 'Unmute' : 'Mute'}
                  >
                    {isMuted || volume === 0 ? (
                      <VolumeX className="w-3.5 h-3.5 text-rose-400" />
                    ) : (
                      <Volume2 className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={isMuted ? 0 : volume}
                    onChange={(e) => setVolume(Number(e.target.value))}
                    className="w-20 accent-[#C8FF45] h-1.5 rounded-lg bg-zinc-800 cursor-pointer"
                  />
                </div>
              </div>

              {/* Navigation Tabs (Queue, Import, Playlists) */}
              <div className="flex items-center justify-between pt-1 border-t border-zinc-800/60">
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setActiveTab(activeTab === 'queue' ? 'none' : 'queue')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-mono transition flex items-center gap-1 ${
                      activeTab === 'queue'
                        ? 'bg-[#C8FF45] text-black font-semibold'
                        : 'bg-zinc-900 text-zinc-300 hover:text-white'
                    }`}
                  >
                    <ListMusic className="w-3 h-3" />
                    <span>Queue</span>
                  </button>

                  <button
                    onClick={() => setActiveTab(activeTab === 'add' ? 'none' : 'add')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-mono transition flex items-center gap-1 ${
                      activeTab === 'add'
                        ? 'bg-[#C8FF45] text-black font-semibold'
                        : 'bg-zinc-900 text-zinc-300 hover:text-white'
                    }`}
                  >
                    <PlusCircle className="w-3 h-3" />
                    <span>Add Track</span>
                  </button>
                </div>

                <button
                  onClick={() => setIsSavedPlaylistsOpen(true)}
                  className="px-2 py-1 rounded-lg text-[11px] font-mono bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 flex items-center gap-1 transition"
                  title="Saved Playlists"
                  aria-label="View Playlists"
                >
                  <Bookmark className="w-3 h-3 text-[#C8FF45]" />
                  <span>Playlists</span>
                </button>
              </div>

              {/* Drawer Content */}
              {activeTab === 'queue' && (
                <div className="pt-2 animate-in fade-in duration-150">
                  <QueuePanel
                    onOpenSavePlaylist={() => {
                      setActiveTab('none');
                      setIsSavedPlaylistsOpen(true);
                    }}
                  />
                </div>
              )}

              {activeTab === 'add' && (
                <div className="pt-2 animate-in fade-in duration-150">
                  <PlaylistImport onDone={() => setActiveTab('queue')} />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Saved Playlists Modal */}
      <SavedPlaylistsModal
        isOpen={isSavedPlaylistsOpen}
        onClose={() => setIsSavedPlaylistsOpen(false)}
      />
    </>
  );
};
