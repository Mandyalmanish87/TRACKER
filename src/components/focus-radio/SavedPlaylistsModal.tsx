import React, { useState } from 'react';
import { useFocusRadio } from './FocusRadioContext';
import { SavedPlaylist } from './youtubeUtils';
import { Bookmark, Play, Trash2, Edit2, Check, X } from 'lucide-react';

export const SavedPlaylistsModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
}> = ({ isOpen, onClose }) => {
  const {
    savedPlaylists,
    saveCurrentPlaylist,
    loadSavedPlaylist,
    deleteSavedPlaylist,
    renameSavedPlaylist,
    queue,
  } = useFocusRadio();

  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlaylistName.trim()) return;
    saveCurrentPlaylist(newPlaylistName.trim());
    setNewPlaylistName('');
  };

  const handleStartRename = (playlist: SavedPlaylist) => {
    setEditingId(playlist.id);
    setEditName(playlist.name);
  };

  const handleConfirmRename = (id: string) => {
    if (editName.trim()) {
      renameSavedPlaylist(id, editName.trim());
    }
    setEditingId(null);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-[#0B0D0C] border border-zinc-800 p-5 shadow-2xl text-zinc-200 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <Bookmark className="w-4 h-4 text-[#C8FF45]" />
            <h3 className="font-serif text-lg font-semibold text-white">Saved Playlists</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-zinc-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Save Current Queue */}
        {queue.length > 0 && (
          <form onSubmit={handleSave} className="space-y-1.5 pb-3 border-b border-zinc-800/80">
            <label className="text-[11px] font-mono text-zinc-400 uppercase">
              Save Current Queue ({queue.length} tracks)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                placeholder="Playlist name (e.g. Late Night Coding)"
                className="flex-1 px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-700 text-xs text-white placeholder-zinc-500 focus:outline-hidden focus:border-[#C8FF45]"
              />
              <button
                type="submit"
                disabled={!newPlaylistName.trim()}
                className="px-3 py-1.5 rounded-xl bg-[#C8FF45] text-black font-bold text-xs disabled:opacity-50 transition"
              >
                Save
              </button>
            </div>
          </form>
        )}

        {/* List of Saved Playlists */}
        <div className="space-y-2 max-h-60 overflow-y-auto pr-1 scrollbar-thin">
          {savedPlaylists.length === 0 ? (
            <p className="text-center py-6 text-xs text-zinc-500">
              No saved playlists yet. Save your current queue above!
            </p>
          ) : (
            savedPlaylists.map((pl) => (
              <div
                key={pl.id}
                className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition"
              >
                <div className="min-w-0 flex-1 mr-2">
                  {editingId === pl.id ? (
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="flex-1 px-2 py-1 rounded bg-zinc-800 border border-[#C8FF45] text-xs text-white"
                        autoFocus
                      />
                      <button
                        onClick={() => handleConfirmRename(pl.id)}
                        className="p-1 text-[#C8FF45]"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div>
                      <p className="font-semibold text-xs text-white truncate">{pl.name}</p>
                      <p className="text-[10px] text-zinc-400">
                        {pl.tracks.length} tracks · {new Date(pl.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => {
                      loadSavedPlaylist(pl.id);
                      onClose();
                    }}
                    className="p-1.5 rounded-lg bg-[#C8FF45]/15 text-[#C8FF45] hover:bg-[#C8FF45] hover:text-black transition"
                    title="Load and play this playlist"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                  </button>
                  <button
                    onClick={() => handleStartRename(pl)}
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
                    title="Rename"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => deleteSavedPlaylist(pl.id)}
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-rose-950/40 transition"
                    title="Delete playlist"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
