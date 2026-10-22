import React, { useState } from 'react';
import { Card } from '../common/Card';
import { useFocusRadio } from './FocusRadioContext';
import { Visualizer } from './Visualizer';
import { PlaylistImport } from './PlaylistImport';
import { SavedPlaylistsModal } from './SavedPlaylistsModal';
import {
  Play,
  Pause,
  SkipForward,
  Radio,
  Plus,
  Bookmark,
  Volume2,
  VolumeX,
} from 'lucide-react';

export const FocusRadioDashboardCard: React.FC = () => {
  const {
    currentTrack,
    isPlaying,
    isBuffering,
    volume,
    isMuted,
    togglePlay,
    next,
    setVolume,
    toggleMute,
    queue,
    loadSavedPlaylist,
    savedPlaylists,
  } = useFocusRadio();

  const [showImport, setShowImport] = useState(false);
  const [showSaved, setShowSaved] = useState(false);

  return (
    <Card
      title="Focus Radio"
      subtitle="Ambient Study Audio"
      className="w-full bg-[#0B0D0C] border-zinc-800 text-zinc-100"
      bodyClassName="p-4 sm:p-5"
      action={
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowSaved(true)}
            className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white transition"
            title="Saved Playlists"
          >
            <Bookmark className="w-3.5 h-3.5 text-[#C8FF45]" />
          </button>
          <button
            onClick={() => setShowImport(!showImport)}
            className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-[#C8FF45] text-xs font-mono font-semibold flex items-center gap-1 transition"
            title="Add Music / Streams"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Track</span>
          </button>
        </div>
      }
    >
      {/* Import Drawer */}
      {showImport && (
        <div className="mb-4 pb-4 border-b border-zinc-800 animate-in fade-in duration-150">
          <PlaylistImport onDone={() => setShowImport(false)} />
        </div>
      )}

      {/* Main Player Display */}
      {queue.length === 0 ? (
        <div className="py-6 text-center text-zinc-500 space-y-2">
          <Radio className="w-8 h-8 mx-auto text-[#C8FF45] opacity-50" />
          <p className="text-xs">No active study stream loaded.</p>
          {savedPlaylists.length > 0 && (
            <button
              onClick={() => loadSavedPlaylist(savedPlaylists[0].id)}
              className="text-xs font-semibold text-[#C8FF45] underline hover:opacity-80 transition"
            >
              Resume "{savedPlaylists[0].name}"
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-3.5">
            {/* Thumbnail */}
            <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800 shrink-0">
              {currentTrack?.thumbnailUrl ? (
                <img
                  src={currentTrack.thumbnailUrl}
                  alt={currentTrack.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-zinc-600">
                  <Radio className="w-6 h-6" />
                </div>
              )}
              {isBuffering && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                  <span className="w-5 h-5 border-2 border-[#C8FF45] border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>

            {/* Track Info & Visualizer */}
            <div className="min-w-0 flex-1">
              <h4 className="text-sm font-semibold text-white truncate">
                {currentTrack?.title || 'Study Stream'}
              </h4>
              <p className="text-xs text-zinc-400 truncate mt-0.5">
                {currentTrack?.author || 'Ambient Audio'}
              </p>
              <div className="mt-2">
                <Visualizer isPlaying={isPlaying} />
              </div>
            </div>
          </div>

          {/* Controls Strip */}
          <div className="flex items-center justify-between pt-2 border-t border-zinc-800/80">
            {/* Volume */}
            <div className="flex items-center gap-2 text-zinc-400 text-xs">
              <button onClick={toggleMute} className="hover:text-white transition">
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

            {/* Play/Pause & Next */}
            <div className="flex items-center gap-2">
              <button
                onClick={togglePlay}
                className="px-4 py-1.5 rounded-xl bg-[#C8FF45] hover:bg-[#b8f533] text-black font-bold text-xs flex items-center gap-1.5 shadow-md active:scale-95 transition cursor-pointer"
              >
                {isPlaying ? (
                  <>
                    <Pause className="w-3.5 h-3.5 fill-current" />
                    <span>Pause</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                    <span>Play</span>
                  </>
                )}
              </button>
              <button
                onClick={next}
                className="p-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white transition cursor-pointer"
                title="Next Track"
              >
                <SkipForward className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Saved Playlists Modal */}
      <SavedPlaylistsModal
        isOpen={showSaved}
        onClose={() => setShowSaved(false)}
      />
    </Card>
  );
};

