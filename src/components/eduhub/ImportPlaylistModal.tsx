import React, { useState } from 'react';
import {
  fetchYouTubePlaylistPreview,
} from '../../services/youtubePlaylistService';
import {
  findCourseByPlaylistId,
  importCourseFromPlaylist,
  formatRemainingWorkload,
  formatDigitalTime,
} from '../../services/eduhubStorage';
import { EduHubCourse, YouTubePlaylistPreview } from '../../types/eduhub';
import {
  X,
  Video,
  Loader2,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Clock,
  Tv,
} from 'lucide-react';

interface ImportPlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCourseImported: (course: EduHubCourse) => void;
}

export const ImportPlaylistModal: React.FC<ImportPlaylistModalProps> = ({
  isOpen,
  onClose,
  onCourseImported,
}) => {
  const [playlistUrl, setPlaylistUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<YouTubePlaylistPreview | null>(null);
  const [existingCourse, setExistingCourse] = useState<EduHubCourse | null>(null);
  const [syncOption, setSyncOption] = useState<'sync' | 'duplicate'>('sync');

  if (!isOpen) return null;

  const handleFetchPreview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!playlistUrl.trim()) return;

    setIsLoading(true);
    setError(null);
    setPreview(null);
    setExistingCourse(null);

    const res = await fetchYouTubePlaylistPreview(playlistUrl.trim());

    setIsLoading(false);

    if (!res.success || !res.preview) {
      setError(res.error || 'Failed to load YouTube playlist.');
      return;
    }

    setPreview(res.preview);

    // Check duplicate
    const existing = findCourseByPlaylistId(res.preview.playlistId);
    if (existing) {
      setExistingCourse(existing);
      setSyncOption('sync');
    }
  };

  const handleConfirmImport = () => {
    if (!preview) return;

    const shouldSync = Boolean(existingCourse && syncOption === 'sync');
    const result = importCourseFromPlaylist(preview, {
      syncExisting: shouldSync,
    });

    onCourseImported(result.course);
    handleClose();
  };

  const handleClose = () => {
    setPlaylistUrl('');
    setIsLoading(false);
    setError(null);
    setPreview(null);
    setExistingCourse(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-espresso-950/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="w-full max-w-2xl bg-white dark:bg-espresso-900 border border-ivory-300 dark:border-espresso-750 rounded-2xl shadow-elevated overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-ivory-200 dark:border-espresso-800 bg-ivory-50/50 dark:bg-espresso-850/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400">
              <Video className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-serif font-semibold text-espresso-950 dark:text-ivory-50">
                Import YouTube Course / Playlist
              </h2>
              <p className="text-xs text-espresso-500 dark:text-espresso-400">
                Fetch all lectures, titles, and durations automatically
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg text-espresso-400 hover:text-espresso-700 dark:hover:text-ivory-200 hover:bg-ivory-200 dark:hover:bg-espresso-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* URL Input Form */}
          <form onSubmit={handleFetchPreview} className="space-y-3">
            <div>
              <label className="block text-xs font-mono font-medium uppercase tracking-wider text-espresso-600 dark:text-espresso-300 mb-1.5">
                YouTube Playlist URL or ID
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={playlistUrl}
                  onChange={(e) => {
                    setPlaylistUrl(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="https://www.youtube.com/playlist?list=PL..."
                  disabled={isLoading}
                  className="flex-1 px-3.5 py-2.5 rounded-xl border border-ivory-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-850 text-espresso-950 dark:text-ivory-50 text-sm focus:outline-none focus:ring-2 focus:ring-terracotta-500 transition font-mono placeholder:font-sans placeholder:text-espresso-400"
                />
                <button
                  type="submit"
                  disabled={isLoading || !playlistUrl.trim()}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-white shadow-subtle flex items-center gap-2 transition hover:opacity-95 disabled:opacity-50 cursor-pointer shrink-0"
                  style={{ backgroundColor: 'var(--accent)' }}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Fetching...</span>
                    </>
                  ) : (
                    <span>Inspect Playlist</span>
                  )}
                </button>
              </div>
            </div>

            <p className="text-[11px] text-espresso-400 dark:text-espresso-500">
              Supports public and unlisted YouTube courses and playlists. Private playlists cannot be imported without owner authorization.
            </p>
          </form>

          {/* Error Banner */}
          {error && (
            <div className="p-4 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50/70 dark:bg-red-950/30 flex items-start gap-3 text-xs text-red-700 dark:text-red-300 animate-in fade-in duration-150">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold">Unable to import playlist</p>
                <p className="leading-relaxed">{error}</p>
              </div>
            </div>
          )}

          {/* Preview & Duplicate Handling */}
          {preview && (
            <div className="space-y-5 border-t border-ivory-200 dark:border-espresso-800 pt-5 animate-in fade-in duration-200">
              {/* Duplicate Banner */}
              {existingCourse && (
                <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/70 dark:bg-amber-950/30 space-y-3">
                  <div className="flex items-start gap-2.5">
                    <RefreshCw className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-amber-900 dark:text-amber-200">
                        Course Already in EduHub: "{existingCourse.title}"
                      </p>
                      <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                        This playlist is already part of your courses ({existingCourse.lectures.length} lectures tracked).
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2 pt-1 text-xs">
                    <label className="flex items-center gap-2 p-2.5 rounded-lg border border-amber-300 dark:border-amber-800 bg-white/60 dark:bg-espresso-850/60 cursor-pointer">
                      <input
                        type="radio"
                        name="syncOption"
                        checked={syncOption === 'sync'}
                        onChange={() => setSyncOption('sync')}
                        className="text-terracotta-600"
                      />
                      <span className="font-medium text-espresso-900 dark:text-ivory-100">
                        Synchronize & Update (Preserves completed lectures & notes)
                      </span>
                    </label>

                    <label className="flex items-center gap-2 p-2.5 rounded-lg border border-amber-300 dark:border-amber-800 bg-white/60 dark:bg-espresso-850/60 cursor-pointer">
                      <input
                        type="radio"
                        name="syncOption"
                        checked={syncOption === 'duplicate'}
                        onChange={() => setSyncOption('duplicate')}
                        className="text-terracotta-600"
                      />
                      <span className="font-medium text-espresso-900 dark:text-ivory-100">
                        Create as Separate Copy
                      </span>
                    </label>
                  </div>
                </div>
              )}

              {/* Course Overview Card */}
              <div className="p-4 rounded-xl border border-ivory-300 dark:border-espresso-750 bg-ivory-50/70 dark:bg-espresso-850/70 flex flex-col sm:flex-row gap-4 items-start">
                {preview.thumbnailUrl ? (
                  <img
                    src={preview.thumbnailUrl}
                    alt={preview.title}
                    className="w-full sm:w-36 h-24 object-cover rounded-lg border border-ivory-200 dark:border-espresso-800 shrink-0"
                  />
                ) : (
                  <div className="w-full sm:w-36 h-24 rounded-lg bg-ivory-200 dark:bg-espresso-800 flex items-center justify-center shrink-0">
                    <Tv className="w-6 h-6 text-espresso-400" />
                  </div>
                )}

                <div className="flex-1 min-w-0 space-y-1.5">
                  <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-terracotta-600 dark:text-terracotta-400">
                    {preview.channelTitle || 'YouTube Playlist'}
                  </span>
                  <h3 className="text-base font-serif font-bold text-espresso-950 dark:text-ivory-50 truncate">
                    {preview.title}
                  </h3>
                  {preview.description && (
                    <p className="text-xs text-espresso-500 dark:text-espresso-400 line-clamp-2">
                      {preview.description}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-3 pt-1 text-xs font-mono text-espresso-600 dark:text-ivory-200">
                    <span className="flex items-center gap-1">
                      <Tv className="w-3.5 h-3.5 text-terracotta-500" />
                      {preview.itemCount} {preview.itemCount === 1 ? 'Lecture' : 'Lectures'}
                    </span>
                    <span className="text-ivory-400 dark:text-espresso-700">·</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-sage-500" />
                      {formatRemainingWorkload(preview.totalDurationSeconds)} Total
                    </span>
                  </div>
                </div>
              </div>

              {/* Lecture List Preview */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-mono text-espresso-500 dark:text-espresso-400 px-1">
                  <span>Playlist Contents ({preview.lectures.length})</span>
                  <span>Duration</span>
                </div>

                <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 rounded-xl border border-ivory-200 dark:border-espresso-800 p-2 bg-white dark:bg-espresso-900">
                  {preview.lectures.map((lec, index) => (
                    <div
                      key={lec.videoId + index}
                      className="flex items-center justify-between p-2 rounded-lg hover:bg-ivory-50 dark:hover:bg-espresso-850 text-xs transition"
                    >
                      <div className="flex items-center gap-2 min-w-0 mr-3">
                        <span className="font-mono text-[11px] text-espresso-400 shrink-0 w-5">
                          {index + 1}.
                        </span>
                        <span className="text-espresso-900 dark:text-ivory-100 truncate font-medium">
                          {lec.title}
                        </span>
                      </div>
                      <span className="font-mono text-xs text-espresso-500 dark:text-espresso-400 shrink-0">
                        {lec.durationSeconds > 0 ? formatDigitalTime(lec.durationSeconds) : '--:--'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-ivory-200 dark:border-espresso-800 bg-ivory-50/50 dark:bg-espresso-850/50">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 rounded-xl text-xs font-medium text-espresso-700 dark:text-ivory-300 hover:bg-ivory-200 dark:hover:bg-espresso-800 transition cursor-pointer"
          >
            Cancel
          </button>

          {preview && (
            <button
              type="button"
              onClick={handleConfirmImport}
              className="px-5 py-2.5 rounded-xl text-xs font-semibold text-white shadow-subtle flex items-center gap-2 transition hover:opacity-95 cursor-pointer"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>
                {existingCourse && syncOption === 'sync'
                  ? 'Confirm & Synchronize Course'
                  : `Create Course (${preview.itemCount} Lectures)`}
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
