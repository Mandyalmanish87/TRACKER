import React, { useState } from 'react';
import { Card } from '../common/Card';
import { useFocusRadio } from './FocusRadioContext';
import { Visualizer } from './Visualizer';
import { PlaylistImport } from './PlaylistImport';
import { SavedPlaylistsModal } from './SavedPlaylistsModal';
import { QueuePanel } from './QueuePanel';
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Radio,
  Plus,
  Bookmark,
  Volume2,
  VolumeX,
  Shuffle,
  Repeat,
  Repeat1,
  ListMusic,
} from 'lucide-react';

function formatRadioTime(sec: number): string {
  if (isNaN(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export const FocusRadioDashboardCard: React.FC = () => {
  const {
    currentTrack,
    isPlaying,
    isBuffering,
    volume,
    isMuted,
    shuffle,
    repeatMode,
    currentTime,
    duration,
    savedPlaybackPosition,
    seekTo,
    resumeFromSavedPosition,
    togglePlay,
    next,
    prev,
    setVolume,
    toggleMute,
    setShuffle,
    setRepeatMode,
    queue,
    loadSavedPlaylist,
    savedPlaylists,
  } = useFocusRadio();

  const [showImport, setShowImport] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [showQueue, setShowQueue] = useState(false);

  const cycleRepeatMode = () => setRepeatMode(repeatMode === 'off' ? 'all' : repeatMode === 'all' ? 'one' : 'off');

  return (
    <Card
      title="Focus Radio"
      subtitle="Ambient Study Audio"
      className="w-full focus-radio-dashboard-card"
      bodyClassName="p-4 sm:p-5"
      action={
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowSaved(true)}
            className="focus-radio-tool-button"
            title="Saved Playlists"
            aria-label={`Saved playlists, ${savedPlaylists.length}`}
          >
            <Bookmark className="w-3.5 h-3.5" />
            <span>Playlists</span>
            {savedPlaylists.length > 0 && <span className="focus-radio-count">{savedPlaylists.length}</span>}
          </button>
          <button
            onClick={() => setShowImport(!showImport)}
            className="focus-radio-tool-button focus-radio-add-button"
            title="Add Music / Streams"
            aria-expanded={showImport}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Track</span>
          </button>
        </div>
      }
    >
      {/* Import Drawer */}
      {showImport && (
        <div className="focus-radio-drawer mb-4 pb-4 border-b border-zinc-800 animate-in fade-in duration-150">
          <PlaylistImport onDone={() => setShowImport(false)} />
        </div>
      )}

      {/* Main Player Display */}
      {queue.length === 0 ? (
        <div className="focus-radio-empty py-6 text-center text-zinc-500 space-y-2">
          <Radio className="w-8 h-8 mx-auto text-[var(--accent)] opacity-70" />
          <p className="text-sm font-semibold">Your focus mix is ready.</p>
          <p className="text-xs">Choose a saved playlist or add a track to start listening.</p>
          {savedPlaylists.length > 0 && (
            <button
              onClick={() => loadSavedPlaylist(savedPlaylists[0].id)}
              className="focus-radio-load-playlist"
            >
              <Play className="w-3.5 h-3.5 fill-current" /> Load “{savedPlaylists[0].name}”
            </button>
          )}
        </div>
      ) : (
        <div className="focus-radio-player space-y-3.5">
          <div className="flex items-center gap-3.5">
            {/* Thumbnail */}
            <div className={`focus-radio-cover relative w-14 h-14 rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800 shrink-0 shadow-xs${isPlaying ? ' is-playing' : ''}`}>
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
                  <span className="w-5 h-5 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>

            {/* Track Info & Visualizer */}
            <div className="min-w-0 flex-1">
              <div className="focus-radio-now-label"><span className={isPlaying ? 'is-live' : ''} />{isBuffering ? 'CONNECTING' : isPlaying ? 'NOW PLAYING' : 'READY WHEN YOU ARE'}</div>
              <h4 className="text-sm font-semibold text-white truncate">
                {currentTrack?.title || 'Study Stream'}
              </h4>
              <p className="text-xs text-zinc-400 font-mono truncate mt-0.5">
                {currentTrack?.author || 'Ambient Audio'}
              </p>
            </div>
          </div>

          <div className="focus-radio-visualizer-shell">
            <Visualizer isPlaying={isPlaying} variant="wave" color="var(--accent)" className="focus-radio-visualizer" />
            <span className="focus-radio-visualizer-caption">{isPlaying ? 'LIVE AUDIO' : 'AUDIO VISUALIZER'}</span>
          </div>

          {/* One-click resume control for browser autoplay restrictions */}
          {savedPlaybackPosition > 5 && !isPlaying && (
            <button
              onClick={resumeFromSavedPosition}
              className="focus-radio-resume w-full py-1.5 px-3 rounded-xl text-xs font-mono flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Resume from {formatRadioTime(savedPlaybackPosition)}</span>
            </button>
          )}

          {/* Spotify-Style Seek / Progress Bar */}
          <div className="focus-radio-progress space-y-1">
            <input
              type="range"
              min={0}
              max={duration > 0 ? duration : 100}
              step={1}
              value={currentTime}
              onChange={(e) => seekTo(Number(e.target.value))}
              className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-[var(--accent)]"
              title="Seek playback position"
              aria-label="Seek playback position"
            />
            <div className="flex justify-between text-[10px] font-mono text-zinc-400">
              <span>{formatRadioTime(currentTime)}</span>
              <span>{formatRadioTime(duration)}</span>
            </div>
          </div>

          {/* Controls Strip */}
          <div className="focus-radio-controls flex items-center justify-between gap-2 pt-2 border-t border-zinc-800/80">
            {/* Volume */}
            <div className="focus-radio-volume flex items-center gap-2 text-zinc-400 text-xs">
              <button onClick={toggleMute} className="focus-radio-icon-button" aria-label={isMuted || volume === 0 ? 'Unmute' : 'Mute'}>
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
                className="w-20 h-1.5 rounded-lg bg-zinc-800 cursor-pointer"
                style={{ accentColor: 'var(--accent)' }}
                aria-label="Volume"
              />
            </div>

            {/* Playback Controls (Prev, Play/Pause, Next) */}
            <div className="focus-radio-transport flex items-center gap-1.5">
              <button
                onClick={prev}
                className="focus-radio-icon-button focus-radio-skip"
                title="Previous Track"
                aria-label="Previous track"
              >
                <SkipBack className="w-4 h-4" />
              </button>

              <button
                onClick={togglePlay}
                className="focus-radio-play-button px-4 py-1.5 rounded-xl font-semibold text-xs flex items-center gap-1.5 shadow-subtle active:scale-95 transition cursor-pointer"
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
                className="focus-radio-icon-button focus-radio-skip"
                title="Next Track"
                aria-label="Next track"
              >
                <SkipForward className="w-4 h-4" />
              </button>
            </div>

            <div className="focus-radio-mode-controls">
              <button type="button" className={`focus-radio-mode-button${shuffle ? ' is-active' : ''}`} onClick={() => setShuffle(!shuffle)} aria-pressed={shuffle} title={shuffle ? 'Turn shuffle off' : 'Turn shuffle on'} aria-label={`Shuffle ${shuffle ? 'on' : 'off'}`}>
                <Shuffle className="w-4 h-4" />
              </button>
              <button type="button" className={`focus-radio-mode-button${repeatMode !== 'off' ? ' is-active' : ''}`} onClick={cycleRepeatMode} aria-pressed={repeatMode !== 'off'} title={`Repeat ${repeatMode}; click to change`} aria-label={`Repeat ${repeatMode}`}>
                {repeatMode === 'one' ? <Repeat1 className="w-4 h-4" /> : <Repeat className="w-4 h-4" />}
              </button>
              <button type="button" className={`focus-radio-mode-button${showQueue ? ' is-active' : ''}`} onClick={() => setShowQueue((open) => !open)} aria-expanded={showQueue} aria-label={`Queue, ${queue.length} tracks`} title="Show play queue">
                <ListMusic className="w-4 h-4" /><span>{queue.length}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {showQueue && queue.length > 0 && <div className="focus-radio-queue animate-in fade-in duration-200"><QueuePanel onOpenSavePlaylist={() => setShowSaved(true)} /></div>}

      {/* Saved Playlists Modal */}
      <SavedPlaylistsModal
        isOpen={showSaved}
        onClose={() => setShowSaved(false)}
      />
    </Card>
  );
};

