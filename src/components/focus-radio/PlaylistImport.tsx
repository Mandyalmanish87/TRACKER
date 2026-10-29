import React, { useState } from 'react';
import { useFocusRadio } from './FocusRadioContext';
import {
  parseYouTubeVideoId,
  parseYouTubePlaylistId,
  fetchYouTubeMetadata,
  playlistItemToRadioTrack,
  RadioTrack,
} from './youtubeUtils';
import { fetchYouTubePlaylistPreview } from '../../services/youtubePlaylistService';
import { YouTubePlaylistPreview } from '../../types/eduhub';
import {
  Plus,
  Link2,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Play,
  Bookmark,
  ListMusic,
  X,
  Loader2,
} from 'lucide-react';

function formatTrackDuration(sec: number): string {
  if (!sec || isNaN(sec) || sec <= 0) return '';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatTotalDuration(sec: number): string {
  if (!sec || isNaN(sec) || sec <= 0) return '';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export const PlaylistImport: React.FC<{ onDone?: () => void }> = ({ onDone }) => {
  const { addToQueue, addTracksToQueue, savePlaylistDirectly } = useFocusRadio();
  const [urlInput, setUrlInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [playlistPreview, setPlaylistPreview] = useState<YouTubePlaylistPreview | null>(null);

  const handleImport = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = urlInput.trim();
    if (!trimmed) return;

    setIsLoading(true);
    setFeedback(null);
    setPlaylistPreview(null);

    try {
      const playlistId = parseYouTubePlaylistId(trimmed);
      const videoId = parseYouTubeVideoId(trimmed);

      // Priority 1: If input contains a YouTube playlist
      if (playlistId) {
        const res = await fetchYouTubePlaylistPreview(trimmed);
        if (!res.success || !res.preview) {
          throw new Error(res.error || 'Failed to load YouTube playlist details.');
        }

        setPlaylistPreview(res.preview);
        setFeedback({
          type: 'success',
          message: `Loaded "${res.preview.title}" (${res.preview.itemCount} tracks)`,
        });
        return;
      }

      // Priority 2: Single YouTube video
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
        return;
      }

      throw new Error('Please enter a valid YouTube video or playlist link.');
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Failed to process YouTube link. Verify URL and try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlayAllPreview = () => {
    if (!playlistPreview) return;
    const tracks: RadioTrack[] = playlistPreview.lectures.map((l) =>
      playlistItemToRadioTrack(l, playlistPreview.channelTitle)
    );
    if (tracks.length === 0) return;

    addTracksToQueue(tracks, true);
    setFeedback({
      type: 'success',
      message: `Playing "${playlistPreview.title}" (${tracks.length} tracks)`,
    });
    setUrlInput('');
    if (onDone) setTimeout(onDone, 800);
  };

  const handleQueueAllPreview = () => {
    if (!playlistPreview) return;
    const tracks: RadioTrack[] = playlistPreview.lectures.map((l) =>
      playlistItemToRadioTrack(l, playlistPreview.channelTitle)
    );
    if (tracks.length === 0) return;

    addTracksToQueue(tracks, false);
    setFeedback({
      type: 'success',
      message: `Added ${tracks.length} tracks to queue!`,
    });
    setUrlInput('');
    if (onDone) setTimeout(onDone, 800);
  };

  const handleSavePlaylistPreview = () => {
    if (!playlistPreview) return;
    const tracks: RadioTrack[] = playlistPreview.lectures.map((l) =>
      playlistItemToRadioTrack(l, playlistPreview.channelTitle)
    );
    if (tracks.length === 0) return;

    savePlaylistDirectly(playlistPreview.title, tracks);
    setFeedback({
      type: 'success',
      message: `Saved "${playlistPreview.title}" (${tracks.length} tracks) to your Playlists!`,
    });
  };

  const handlePlaySingleFromPreview = (track: RadioTrack) => {
    addToQueue(track, true);
    setFeedback({
      type: 'success',
      message: `Playing "${track.title.substring(0, 32)}..."`,
    });
    if (onDone) setTimeout(onDone, 800);
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
      {/* Search & URL Input Form */}
      <form onSubmit={handleImport} className="space-y-2.5">
        <label className="block text-[11px] font-mono uppercase text-[#A3B899] font-medium">
          Add YouTube Video or Playlist
        </label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Link2 className="absolute left-3 top-2.5 w-3.5 h-3.5 text-zinc-500" />
            <input
              type="text"
              value={urlInput}
              onChange={(e) => {
                setUrlInput(e.target.value);
                if (feedback) setFeedback(null);
              }}
              placeholder="Paste YouTube playlist or video link..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-100 placeholder-zinc-500 focus:outline-hidden focus:border-[#C8FF45] focus:ring-1 focus:ring-[#C8FF45] text-xs transition"
            />
          </div>
          <button
            type="submit"
            disabled={isLoading || !urlInput.trim()}
            className="px-3.5 py-2 rounded-xl font-bold text-black bg-[#C8FF45] hover:bg-[#b8f533] disabled:opacity-50 disabled:pointer-events-none transition flex items-center gap-1.5 shrink-0 cursor-pointer"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Importing...</span>
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                <span>Import</span>
              </>
            )}
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

      {/* Playlist Preview Card (Shared from EduHub edge import) */}
      {playlistPreview && (
        <div className="p-3 rounded-2xl bg-zinc-900/90 border border-zinc-750 space-y-3 animate-in fade-in duration-200">
          <div className="flex items-start justify-between gap-2.5">
            <div className="flex items-start gap-2.5 min-w-0">
              {playlistPreview.thumbnailUrl && (
                <img
                  src={playlistPreview.thumbnailUrl}
                  alt={playlistPreview.title}
                  className="w-12 h-12 rounded-xl object-cover shrink-0 border border-zinc-700"
                />
              )}
              <div className="min-w-0">
                <h4 className="font-semibold text-zinc-100 text-xs truncate" title={playlistPreview.title}>
                  {playlistPreview.title}
                </h4>
                <p className="text-[11px] text-zinc-400 truncate">
                  {playlistPreview.channelTitle && <span>{playlistPreview.channelTitle} · </span>}
                  <span>{playlistPreview.itemCount} tracks</span>
                  {playlistPreview.totalDurationSeconds > 0 && (
                    <span> ({formatTotalDuration(playlistPreview.totalDurationSeconds)})</span>
                  )}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setPlaylistPreview(null)}
              className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer"
              title="Close preview"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Action Buttons Toolbar */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={handlePlayAllPreview}
              className="px-2.5 py-1.5 rounded-xl bg-[#C8FF45] hover:bg-[#b8f533] text-black font-semibold text-[11px] flex items-center gap-1.5 transition cursor-pointer"
            >
              <Play className="w-3 h-3 fill-current" />
              <span>Play All</span>
            </button>

            <button
              type="button"
              onClick={handleQueueAllPreview}
              className="px-2.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-750 border border-zinc-700 text-zinc-200 font-medium text-[11px] flex items-center gap-1.5 transition cursor-pointer"
            >
              <ListMusic className="w-3 h-3" />
              <span>Add to Queue</span>
            </button>

            <button
              type="button"
              onClick={handleSavePlaylistPreview}
              className="px-2.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-750 border border-zinc-700 text-zinc-200 font-medium text-[11px] flex items-center gap-1.5 transition cursor-pointer"
            >
              <Bookmark className="w-3 h-3 text-[#C8FF45]" />
              <span>Save Playlist</span>
            </button>
          </div>

          {/* Scrollable Individual Videos List */}
          <div className="space-y-1 max-h-44 overflow-y-auto pr-1 scrollbar-thin">
            {playlistPreview.lectures.map((lecture, idx) => {
              const track = playlistItemToRadioTrack(lecture, playlistPreview.channelTitle);
              return (
                <div
                  key={lecture.videoId + '-' + idx}
                  className="flex items-center justify-between p-1.5 rounded-xl hover:bg-zinc-800/80 transition group"
                >
                  <div className="flex items-center gap-2 min-w-0 mr-2">
                    <span className="font-mono text-[10px] text-zinc-500 w-4 text-right shrink-0">
                      {idx + 1}
                    </span>
                    {track.thumbnailUrl && (
                      <img
                        src={track.thumbnailUrl}
                        alt=""
                        className="w-7 h-7 rounded-lg object-cover shrink-0"
                      />
                    )}
                    <span className="text-[11px] text-zinc-200 truncate group-hover:text-[#C8FF45] transition">
                      {lecture.title}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {lecture.durationSeconds > 0 && (
                      <span className="font-mono text-[10px] text-zinc-400">
                        {formatTrackDuration(lecture.durationSeconds)}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => handlePlaySingleFromPreview(track)}
                      className="p-1 rounded-md text-zinc-400 hover:text-[#C8FF45] hover:bg-zinc-700 transition cursor-pointer"
                      title="Play this track now"
                    >
                      <Play className="w-3 h-3 fill-current" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        addToQueue(track, false);
                        setFeedback({
                          type: 'success',
                          message: `Added "${track.title.substring(0, 24)}..." to queue`,
                        });
                      }}
                      className="p-1 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-700 transition cursor-pointer"
                      title="Add to queue"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
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
