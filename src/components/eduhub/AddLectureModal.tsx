import React, { useState } from 'react';
import { parseYouTubeVideoId } from '../focus-radio/youtubeUtils';
import { X, Plus, Video, AlertCircle } from 'lucide-react';

interface AddLectureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddLecture: (urlOrId: string, title?: string, durationSeconds?: number) => void;
}

export const AddLectureModal: React.FC<AddLectureModalProps> = ({
  isOpen,
  onClose,
  onAddLecture,
}) => {
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const videoId = parseYouTubeVideoId(url);
    if (!videoId) {
      setError('Please enter a valid YouTube URL (e.g. https://www.youtube.com/watch?v=...) or 11-character video ID.');
      return;
    }

    const durSec = durationMinutes ? Math.max(0, parseFloat(durationMinutes) * 60) : 0;
    onAddLecture(url.trim(), title.trim() || undefined, durSec);
    setUrl('');
    setTitle('');
    setDurationMinutes('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-espresso-950/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white dark:bg-espresso-900 rounded-2xl border border-ivory-300 dark:border-espresso-700 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="p-4 border-b border-ivory-300 dark:border-espresso-800 flex items-center justify-between bg-ivory-50/70 dark:bg-espresso-850">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-terracotta-100 dark:bg-terracotta-900/40 text-terracotta-700 dark:text-terracotta-300">
              <Video className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-serif text-base font-bold text-espresso-950 dark:text-ivory-50">
                Add YouTube Lecture
              </h3>
              <p className="text-[11px] text-espresso-500 dark:text-espresso-400">
                Paste any YouTube video link to add it to this course
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-espresso-400 hover:text-espresso-700 dark:hover:text-ivory-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-espresso-800 dark:text-ivory-100">
              YouTube Video URL or ID *
            </label>
            <input
              type="text"
              required
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                setError(null);
              }}
              placeholder="https://www.youtube.com/watch?v=YoXxevp1WRQ"
              className="w-full px-3 py-2 rounded-xl border border-ivory-300 dark:border-espresso-700 bg-ivory-50/60 dark:bg-espresso-850 text-xs text-espresso-950 dark:text-ivory-50 placeholder:text-espresso-400 focus:outline-none focus:ring-2 focus:ring-terracotta-400"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-espresso-800 dark:text-ivory-100 flex items-center justify-between">
              <span>Lecture Title (optional)</span>
              <span className="text-[10px] text-espresso-400">Auto-generated if empty</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Lecture 01 - Computational Thinking"
              className="w-full px-3 py-2 rounded-xl border border-ivory-300 dark:border-espresso-700 bg-ivory-50/60 dark:bg-espresso-850 text-xs text-espresso-950 dark:text-ivory-50 placeholder:text-espresso-400 focus:outline-none focus:ring-2 focus:ring-terracotta-400"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-espresso-800 dark:text-ivory-100 flex items-center justify-between">
              <span>Estimated Duration in Minutes (optional)</span>
              <span className="text-[10px] text-espresso-400">Auto-detected upon playback</span>
            </label>
            <input
              type="number"
              min="0"
              step="any"
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(e.target.value)}
              placeholder="e.g. 45"
              className="w-full px-3 py-2 rounded-xl border border-ivory-300 dark:border-espresso-700 bg-ivory-50/60 dark:bg-espresso-850 text-xs text-espresso-950 dark:text-ivory-50 placeholder:text-espresso-400 focus:outline-none focus:ring-2 focus:ring-terracotta-400"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-ivory-200 dark:border-espresso-800">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-xl text-xs font-medium border border-ivory-300 dark:border-espresso-700 hover:bg-ivory-100 dark:hover:bg-espresso-800 text-espresso-700 dark:text-ivory-200 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-terracotta-600 hover:bg-terracotta-500 text-white flex items-center gap-1.5 shadow-subtle transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Lecture</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

