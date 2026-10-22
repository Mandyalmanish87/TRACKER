import React, { useState } from 'react';
import { X, Plus, Trash2, BarChart2, CheckSquare, ShieldCheck, AlertCircle } from 'lucide-react';

interface CreatePollModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (
    question: string,
    options: string[],
    allowMultipleAnswers: boolean,
    isAnonymous: boolean
  ) => Promise<{ error?: string }>;
}

export const CreatePollModal: React.FC<CreatePollModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
}) => {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<string[]>(['', '']);
  const [allowMultipleAnswers, setAllowMultipleAnswers] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleAddOption = () => {
    if (options.length >= 8) {
      setError('A poll can have at most 8 options.');
      return;
    }
    setOptions([...options, '']);
    setError(null);
  };

  const handleRemoveOption = (index: number) => {
    if (options.length <= 2) {
      setError('A poll must have at least 2 options.');
      return;
    }
    setOptions(options.filter((_, i) => i !== index));
    setError(null);
  };

  const handleOptionChange = (index: number, value: string) => {
    const updated = [...options];
    updated[index] = value;
    setOptions(updated);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) {
      setError('Please enter a poll question.');
      return;
    }

    const cleanOptions = options.map((o) => o.trim()).filter(Boolean);
    if (cleanOptions.length < 2) {
      setError('Please provide at least 2 non-empty options.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const res = await onSubmit(
      question.trim(),
      cleanOptions,
      allowMultipleAnswers,
      isAnonymous
    );

    setIsSubmitting(false);

    if (res.error) {
      setError(res.error);
    } else {
      // Reset state and close
      setQuestion('');
      setOptions(['', '']);
      setAllowMultipleAnswers(false);
      setIsAnonymous(false);
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
              <BarChart2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-espresso-950 dark:text-ivory-50">
                Create Class Poll
              </h3>
              <p className="text-xs text-espresso-500 dark:text-ivory-400">
                Collect opinions, decide reschedule slots, or vote on class decisions
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
          {/* Question */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-espresso-700 dark:text-espresso-300 mb-1.5 font-mono">
              Poll Question *
            </label>
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="e.g. Which date works best for the extra DSA lecture?"
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-ivory-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-900 text-espresso-950 dark:text-ivory-50 placeholder-espresso-400 focus:outline-none focus:ring-2 focus:ring-terracotta-400"
              autoFocus
            />
          </div>

          {/* Options */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-espresso-700 dark:text-espresso-300 font-mono">
              Options (2 to 8) *
            </label>
            {options.map((opt, index) => (
              <div key={index} className="flex items-center gap-2">
                <span className="w-5 text-xs font-mono font-bold text-espresso-400 text-right">
                  {index + 1}.
                </span>
                <input
                  type="text"
                  value={opt}
                  onChange={(e) => handleOptionChange(index, e.target.value)}
                  placeholder={`Option ${index + 1}`}
                  className="flex-1 px-3 py-2 text-xs rounded-xl border border-ivory-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-900 text-espresso-950 dark:text-ivory-50 placeholder-espresso-400 focus:outline-none focus:ring-2 focus:ring-terracotta-400"
                />
                {options.length > 2 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveOption(index)}
                    className="p-2 text-espresso-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 transition cursor-pointer"
                    title="Remove option"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}

            {options.length < 8 && (
              <button
                type="button"
                onClick={handleAddOption}
                className="mt-1 flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-dashed border-ivory-300 dark:border-espresso-700 hover:border-terracotta-500 text-xs font-semibold text-espresso-700 dark:text-ivory-200 hover:text-terracotta-600 transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Another Option</span>
              </button>
            )}
          </div>

          {/* Configuration Toggles */}
          <div className="pt-3 border-t border-ivory-200 dark:border-espresso-800 space-y-3">
            {/* Multi-Option Toggle */}
            <label className="flex items-start gap-3 p-3 rounded-xl border border-ivory-200 dark:border-espresso-800 hover:bg-ivory-50 dark:hover:bg-espresso-800/40 cursor-pointer transition">
              <input
                type="checkbox"
                checked={allowMultipleAnswers}
                onChange={(e) => setAllowMultipleAnswers(e.target.checked)}
                className="mt-0.5 rounded text-terracotta-600 focus:ring-terracotta-400"
              />
              <div>
                <span className="text-xs font-semibold text-espresso-950 dark:text-ivory-50 flex items-center gap-1.5">
                  <CheckSquare className="w-3.5 h-3.5 text-terracotta-600" />
                  Allow Multiple Answers (Multi-Option)
                </span>
                <p className="text-[11px] text-espresso-500 dark:text-ivory-400 mt-0.5">
                  Students can select more than one option (great for finding available time slots)
                </p>
              </div>
            </label>

            {/* Anonymous Voting Toggle */}
            <label className="flex items-start gap-3 p-3 rounded-xl border border-ivory-200 dark:border-espresso-800 hover:bg-ivory-50 dark:hover:bg-espresso-800/40 cursor-pointer transition">
              <input
                type="checkbox"
                checked={isAnonymous}
                onChange={(e) => setIsAnonymous(e.target.checked)}
                className="mt-0.5 rounded text-terracotta-600 focus:ring-terracotta-400"
              />
              <div>
                <span className="text-xs font-semibold text-espresso-950 dark:text-ivory-50 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-terracotta-600" />
                  Anonymous Voting
                </span>
                <p className="text-[11px] text-espresso-500 dark:text-ivory-400 mt-0.5">
                  Voter identities are hidden; only vote tallies and percentages will be shown
                </p>
              </div>
            </label>
          </div>

          {/* Action buttons */}
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
              <BarChart2 className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Publishing...' : 'Launch Poll'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

