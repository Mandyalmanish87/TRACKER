import React from 'react';
import { useFocusRadio } from './FocusRadioContext';
import { RadioTrack } from './youtubeUtils';
import { Trash2, ArrowUp, ArrowDown, Music2, Disc } from 'lucide-react';

export const QueuePanel: React.FC<{
  onSelectTrack?: (index: number) => void;
  onOpenSavePlaylist?: () => void;
}> = ({ onSelectTrack, onOpenSavePlaylist }) => {
  const {
    queue,
    currentIndex,
    isPlaying,
    playTrackAtIndex,
    removeFromQueue,
    moveInQueue,
    clearQueue,
  } = useFocusRadio();

  return (
    <div className="space-y-3">
      {/* Queue Header & Actions */}
      <div className="flex items-center justify-between text-xs text-zinc-400 pb-2 border-b border-zinc-800">
        <span className="font-mono text-[11px] uppercase tracking-wider text-[#A3B899]">
          Now Playing & Queue ({queue.length})
        </span>
        <div className="flex items-center gap-2">
          {queue.length > 0 && onOpenSavePlaylist && (
            <button
              onClick={onOpenSavePlaylist}
              className="px-2 py-1 rounded-md text-[10px] font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition"
            >
              Save Playlist
            </button>
          )}
          {queue.length > 0 && (
            <button
              onClick={() => {
                if (window.confirm('Clear current focus radio queue?')) {
                  clearQueue();
                }
              }}
              className="text-[10px] text-zinc-500 hover:text-rose-400 transition"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Track List */}
      {queue.length === 0 ? (
        <div className="py-8 text-center text-zinc-500 space-y-2">
          <Music2 className="w-8 h-8 mx-auto opacity-40 text-[#C8FF45]" />
          <p className="text-xs">Your radio queue is empty.</p>
          <p className="text-[10px] text-zinc-600">
            Paste a YouTube link or select a curated focus stream above.
          </p>
        </div>
      ) : (
        <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1 scrollbar-thin">
          {queue.map((track: RadioTrack, idx: number) => {
            const isCurrent = idx === currentIndex;

            return (
              <div
                key={track.id}
                className={`flex items-center justify-between p-2 rounded-xl transition text-xs group ${
                  isCurrent
                    ? 'bg-zinc-800/90 border border-[#C8FF45]/40 text-white shadow-xs'
                    : 'bg-zinc-900/60 hover:bg-zinc-850 border border-transparent text-zinc-300'
                }`}
              >
                {/* Track Thumbnail & Title */}
                <button
                  type="button"
                  onClick={() => {
                    playTrackAtIndex(idx);
                    if (onSelectTrack) onSelectTrack(idx);
                  }}
                  className="flex items-center gap-2.5 min-w-0 flex-1 text-left cursor-pointer"
                >
                  <div className="relative w-8 h-8 rounded-lg overflow-hidden bg-zinc-800 shrink-0">
                    {track.thumbnailUrl ? (
                      <img
                        src={track.thumbnailUrl}
                        alt={track.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Disc className="w-4 h-4 text-zinc-500 m-2" />
                    )}
                    {isCurrent && isPlaying && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <span className="w-2 h-2 rounded-full bg-[#C8FF45] animate-ping" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 pr-2">
                    <p
                      className={`truncate font-medium ${
                        isCurrent ? 'text-[#C8FF45] font-semibold' : 'text-zinc-200'
                      }`}
                    >
                      {track.title}
                    </p>
                    {track.author && (
                      <p className="text-[10px] text-zinc-500 truncate">{track.author}</p>
                    )}
                  </div>
                </button>

                {/* Reorder and Delete controls */}
                <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 shrink-0">
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => moveInQueue(idx, idx - 1)}
                    className="p-1 rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-700/50 disabled:opacity-20 transition"
                    title="Move up in queue"
                  >
                    <ArrowUp className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    disabled={idx === queue.length - 1}
                    onClick={() => moveInQueue(idx, idx + 1)}
                    className="p-1 rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-700/50 disabled:opacity-20 transition"
                    title="Move down in queue"
                  >
                    <ArrowDown className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeFromQueue(idx)}
                    className="p-1 rounded text-zinc-500 hover:text-rose-400 hover:bg-rose-950/40 transition"
                    title="Remove from queue"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
