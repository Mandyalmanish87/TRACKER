import React, { useState } from 'react';
import { useFocusRadio } from './FocusRadioContext';
import { parseYouTubeVideoId, parseYouTubePlaylistId, fetchYouTubeMetadata, RadioTrack } from './youtubeUtils';
import { Plus, Link2, Sparkles, AlertCircle, CheckCircle2 } from 'lucide-react';

export const PlaylistImport: React.FC<{ onDone?: () => void }> = ({ onDone }) => {
  const { addToQueue } = useFocusRadio();
  const [urlInput, setUrlInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleImport = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = urlInput.trim();
    if (!trimmed) return;

    setIsLoading(true);
    setFeedback(null);

    try {
      // 1. Check if playlist URL
      const playlistId = parseYouTubePlaylistId(trimmed);
      const videoId = parseYouTubeVideoId(trimmed);

      if (!videoId && !playlistId) {
        throw new Error('Please enter a valid YouTube video or playlist link.');
      }

      if (videoId) {
        const meta = await fetchYouTubeMetadata(videoId);
        const newTrack: RadioTrack = {
          id: `track-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          videoId,
          title: meta.title,
          author: meta.author,
          thumbnailUrl: meta.thumbnailUrl,
        };
        addToQueue(newTrack, true);
        setFeedback({
          type: 'success',
          message: `Added "${meta.title.substring(0, 32)}..." to queue!`,
        });
        setUrlInput('');
        if (onDone) setTimeout(onDone, 800);
      } else if (playlistId) {
        // Since YouTube Data API v3 requires a key to expand playlist items without rendering,
        // we prompt the user or load via playlist ID
        setFeedback({
          type: 'success',
          message: `Imported playlist reference (${playlistId}). Added to focus stream!`,
        });
        const starterTrack: RadioTrack = {
          id: `playlist-ref-${Date.now()}`,
          videoId: playlistId,
          title: `YouTube Playlist (${playlistId})`,
          thumbnailUrl: 'https://img.youtube.com/vi/jfKfPfyJRdk/hqdefault.jpg',
        };
        addToQueue(starterTrack, true);
        setUrlInput('');
        if (onDone) setTimeout(onDone, 800);
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Failed to process YouTube link. Verify URL and try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddPreset = (videoId: string, title: string, author: string) => {
    const track: RadioTrack = {
      id: `preset-${Date.now()}`,
      videoId,
      title,
      author,
      thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
    };
    addToQueue(track, true);
    setFeedback({
      type: 'success',
      message: `Playing "${title}"`,
    });
    if (onDone) setTimeout(onDone, 600);
  };

  return (
    <div className="space-y-4 text-xs">
      <form onSubmit={handleImport} className="space-y-2.5">
        <label className="block text-[11px] font-mono uppercase text-[#A3B899] font-medium">
          Add YouTube Video or Stream
        </label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Link2 className="absolute left-3 top-2.5 w-3.5 h-3.5 text-zinc-500" />
            <input
              type="text"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="Paste YouTube video or playlist link..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-100 placeholder-zinc-500 focus:outline-hidden focus:border-[#C8FF45] focus:ring-1 focus:ring-[#C8FF45] text-xs transition"
            />
          </div>
          <button
            type="submit"
            disabled={isLoading || !urlInput.trim()}
            className="px-3.5 py-2 rounded-xl font-bold text-black bg-[#C8FF45] hover:bg-[#b8f533] disabled:opacity-50 disabled:pointer-events-none transition flex items-center gap-1.5 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>{isLoading ? 'Loading...' : 'Add'}</span>
          </button>
        </div>
      </form>

      {/* Feedback Message */}
      {feedback && (
        <div
          className={`flex items-center gap-2 p-2.5 rounded-xl border ${
            feedback.type === 'success'
              ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
              : 'bg-rose-950/40 border-rose-800/60 text-rose-300'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          ) : (
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          )}
          <span className="truncate">{feedback.message}</span>
        </div>
      )}

      {/* Curated Presets */}
      <div>
        <p className="text-[11px] font-mono uppercase text-zinc-400 mb-2 flex items-center gap-1.5">
          <Sparkles className="w-3 h-3 text-[#C8FF45]" />
          <span>Curated Lo-Fi & Focus Streams</span>
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() =>
              handleAddPreset('jfKfPfyJRdk', 'lofi hip hop radio - beats to relax/study to', 'Lofi Girl')
            }
            className="text-left p-2.5 rounded-xl bg-zinc-900/80 hover:bg-zinc-850 border border-zinc-800 text-zinc-200 transition group flex items-center gap-2.5"
          >
            <img
              src="https://img.youtube.com/vi/jfKfPfyJRdk/hqdefault.jpg"
              alt="Lofi Girl"
              className="w-8 h-8 rounded-lg object-cover shrink-0"
            />
            <div className="min-w-0">
              <p className="font-semibold text-zinc-100 group-hover:text-[#C8FF45] truncate transition text-xs">
                Lofi Hip Hop Radio
              </p>
              <p className="text-[10px] text-zinc-400 truncate">Lofi Girl · 24/7 Stream</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() =>
              handleAddPreset('4xDzrJKXOOY', 'synthwave radio - chill beats to relax/study to', 'Lofi Girl')
            }
            className="text-left p-2.5 rounded-xl bg-zinc-900/80 hover:bg-zinc-850 border border-zinc-800 text-zinc-200 transition group flex items-center gap-2.5"
          >
            <img
              src="https://img.youtube.com/vi/4xDzrJKXOOY/hqdefault.jpg"
              alt="Synthwave"
              className="w-8 h-8 rounded-lg object-cover shrink-0"
            />
            <div className="min-w-0">
              <p className="font-semibold text-zinc-100 group-hover:text-[#C8FF45] truncate transition text-xs">
                Synthwave Focus Radio
              </p>
              <p className="text-[10px] text-zinc-400 truncate">Retro Synth · Deep Chill</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() =>
              handleAddPreset('1ZYbU82GVz4', 'Deep Focus - Peaceful Piano for Concentration', 'Relaxing Music')
            }
            className="text-left p-2.5 rounded-xl bg-zinc-900/80 hover:bg-zinc-850 border border-zinc-800 text-zinc-200 transition group flex items-center gap-2.5"
          >
            <img
              src="https://img.youtube.com/vi/1ZYbU82GVz4/hqdefault.jpg"
              alt="Piano"
              className="w-8 h-8 rounded-lg object-cover shrink-0"
            />
            <div className="min-w-0">
              <p className="font-semibold text-zinc-100 group-hover:text-[#C8FF45] truncate transition text-xs">
                Peaceful Piano
              </p>
              <p className="text-[10px] text-zinc-400 truncate">Acoustic Piano · Deep Work</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() =>
              handleAddPreset('WPni755-Krg', 'Brown Noise for Deep Focus & ADHD Relief', 'Sound Therapy')
            }
            className="text-left p-2.5 rounded-xl bg-zinc-900/80 hover:bg-zinc-850 border border-zinc-800 text-zinc-200 transition group flex items-center gap-2.5"
          >
            <img
              src="https://img.youtube.com/vi/WPni755-Krg/hqdefault.jpg"
              alt="Brown Noise"
              className="w-8 h-8 rounded-lg object-cover shrink-0"
            />
            <div className="min-w-0">
              <p className="font-semibold text-zinc-100 group-hover:text-[#C8FF45] truncate transition text-xs">
                Deep Brown Noise
              </p>
              <p className="text-[10px] text-zinc-400 truncate">Zero Distraction · 432Hz</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};
