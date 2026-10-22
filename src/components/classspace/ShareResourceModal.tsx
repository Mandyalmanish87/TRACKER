import React, { useState } from 'react';
import { X, Link2, BookOpen, AlertCircle, FileText, Video, Bookmark } from 'lucide-react';
import { ClassResourceCategory } from '../../types/classSpace';

interface ShareResourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (
    title: string,
    url: string,
    category: ClassResourceCategory,
    description?: string
  ) => Promise<{ error?: string }>;
}

const CATEGORIES: { id: ClassResourceCategory; label: string; icon: React.ReactNode; desc: string }[] = [
  { id: 'notes', label: 'Study Notes', icon: <FileText className="w-3.5 h-3.5" />, desc: 'Lecture summaries & handwritten notes' },
  { id: 'slides', label: 'Lecture Slides', icon: <BookOpen className="w-3.5 h-3.5" />, desc: 'PDF decks and professor presentations' },
  { id: 'assignment', label: 'Assignment / Lab', icon: <Bookmark className="w-3.5 h-3.5" />, desc: 'Problem sets & coursework requirements' },
  { id: 'reference', label: 'Reference Link', icon: <Link2 className="w-3.5 h-3.5" />, desc: 'Documentation, articles & textbooks' },
  { id: 'recording', label: 'Class Recording', icon: <Video className="w-3.5 h-3.5" />, desc: 'Meeting or recorded lecture links' },
];

export const ShareResourceModal: React.FC<ShareResourceModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
}) => {
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [category, setCategory] = useState<ClassResourceCategory>('notes');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Please provide a title for the resource.');
      return;
    }
    if (!url.trim()) {
      setError('Please provide a valid link or URL.');
      return;
    }

    // Basic URL format validation
    let finalUrl = url.trim();
    if (!/^https?:\/\//i.test(finalUrl)) {
      finalUrl = 'https://' + finalUrl;
    }

    setIsSubmitting(true);
    setError(null);

    const res = await onSubmit(title.trim(), finalUrl, category, description.trim() || undefined);
    setIsSubmitting(false);

    if (res.error) {
      setError(res.error);
    } else {
      setTitle('');
      setUrl('');
      setCategory('notes');
      setDescription('');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-espresso-850 border border-ivory-300 dark:border-espresso-750 shadow-editorial p-6 space-y-5 animate-in fade-in-50 zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-terracotta-100 dark:bg-terracotta-950/60 text-terracotta-600 dark:text-terracotta-400">
              <Link2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-espresso-950 dark:text-ivory-50">
                Share Study Resource
              </h3>
              <p className="text-xs text-espresso-500 dark:text-ivory-400">
                Attach slides, notes, Google Drive folders, or syllabus materials for your batch
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-espresso-400 hover:text-espresso-700 dark:hover:text-ivory-200 hover:bg-ivory-100 dark:hover:bg-espresso-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Category Selector */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-espresso-700 dark:text-espresso-300 mb-2 font-mono">
              Resource Category
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  type="button"
                  key={cat.id}
                  onClick={() => setCategory(cat.id)}
                  className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex flex-col gap-1 ${
                    category === cat.id
                      ? 'border-terracotta-500 bg-terracotta-50/60 dark:bg-terracotta-950/40 text-terracotta-700 dark:text-terracotta-300 shadow-2xs'
                      : 'border-ivory-200 dark:border-espresso-750 bg-ivory-50/40 dark:bg-espresso-900/40 text-espresso-700 dark:text-ivory-300 hover:border-ivory-300'
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-xs font-semibold">
                    {cat.icon}
                    <span>{cat.label}</span>
                  </div>
                  <span className="text-[10px] text-espresso-400 dark:text-espresso-500 line-clamp-1">
                    {cat.desc}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-espresso-700 dark:text-espresso-300 mb-1.5 font-mono">
              Resource Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Unit 3 - Binary Trees & Graph Algorithms Slides"
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-ivory-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-900 text-espresso-950 dark:text-ivory-50 placeholder-espresso-400 focus:outline-none focus:ring-2 focus:ring-terracotta-400"
              autoFocus
            />
          </div>

          {/* URL */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-espresso-700 dark:text-espresso-300 mb-1.5 font-mono">
              Link / URL *
            </label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="e.g. https://drive.google.com/..."
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-ivory-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-900 text-espresso-950 dark:text-ivory-50 placeholder-espresso-400 focus:outline-none focus:ring-2 focus:ring-terracotta-400"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-espresso-700 dark:text-espresso-300 mb-1.5 font-mono">
              Notes / Description (Optional)
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Covers pages 45-80 from textbook; important for upcoming quiz."
              className="w-full px-3.5 py-2 text-xs rounded-xl border border-ivory-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-900 text-espresso-950 dark:text-ivory-50 placeholder-espresso-400 focus:outline-none focus:ring-2 focus:ring-terracotta-400 resize-none"
            />
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-xs font-semibold border border-ivory-300 dark:border-espresso-700 text-espresso-700 dark:text-ivory-200 hover:bg-ivory-100 dark:hover:bg-espresso-800 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl text-xs font-semibold bg-terracotta-600 hover:bg-terracotta-700 text-white shadow-subtle transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Link2 className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Sharing...' : 'Share with Class'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

