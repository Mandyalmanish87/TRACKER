import React, { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { Button } from '../common/Button';

interface AdminConfirmationModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmMatchText?: string;
  confirmButtonText?: string;
  isDestructive?: boolean;
  requiresReason?: boolean;
  onConfirm: (reason: string) => Promise<void>;
  onClose: () => void;
}

export const AdminConfirmationModal: React.FC<AdminConfirmationModalProps> = ({
  isOpen,
  title,
  description,
  confirmMatchText,
  confirmButtonText = 'Confirm',
  isDestructive = false,
  requiresReason = true,
  onConfirm,
  onClose,
}) => {
  const [matchInput, setMatchInput] = useState('');
  const [reasonInput, setReasonInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const isMatchValid = !confirmMatchText || matchInput.trim() === confirmMatchText.trim();
  const isReasonValid = !requiresReason || reasonInput.trim().length >= 4;
  const canSubmit = isMatchValid && isReasonValid && !isSubmitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setError(null);
    setIsSubmitting(true);
    try {
      await onConfirm(reasonInput.trim());
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Action failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-espresso-950/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-white dark:bg-espresso-900 border border-ivory-300 dark:border-espresso-700 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-ivory-200 dark:border-espresso-800">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl ${isDestructive ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400' : 'bg-terracotta-50 text-terracotta-600 dark:bg-terracotta-950/40 dark:text-terracotta-400'}`}>
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h3 className="font-serif text-lg font-semibold text-espresso-900 dark:text-ivory-100">
              {title}
            </h3>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1 rounded-lg text-espresso-400 hover:text-espresso-600 dark:hover:text-ivory-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <p className="text-sm text-espresso-600 dark:text-espresso-300">
            {description}
          </p>

          {confirmMatchText && (
            <div className="space-y-1.5 pt-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-espresso-500 dark:text-espresso-400">
                Type <span className="font-mono text-terracotta-600 dark:text-terracotta-400 select-all font-bold">{confirmMatchText}</span> to confirm:
              </label>
              <input
                type="text"
                value={matchInput}
                onChange={(e) => setMatchInput(e.target.value)}
                placeholder={confirmMatchText}
                disabled={isSubmitting}
                className="w-full px-3.5 py-2 text-sm bg-ivory-50 dark:bg-espresso-800/80 border border-ivory-300 dark:border-espresso-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-terracotta-500 text-espresso-900 dark:text-ivory-100 font-mono"
              />
            </div>
          )}

          {requiresReason && (
            <div className="space-y-1.5 pt-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-espresso-500 dark:text-espresso-400">
                Administrative Reason (Recorded in Immutable Audit Log):
              </label>
              <textarea
                value={reasonInput}
                onChange={(e) => setReasonInput(e.target.value)}
                placeholder="Specify the operational or moderation justification for this action..."
                disabled={isSubmitting}
                rows={3}
                className="w-full px-3.5 py-2 text-sm bg-ivory-50 dark:bg-espresso-800/80 border border-ivory-300 dark:border-espresso-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-terracotta-500 text-espresso-900 dark:text-ivory-100 resize-none"
              />
            </div>
          )}

          {error && (
            <div className="p-3 text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 rounded-xl">
              {error}
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-ivory-200 dark:border-espresso-800">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={isSubmitting}
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant={isDestructive ? 'primary' : 'primary'}
              size="sm"
              disabled={!canSubmit}
              className={isDestructive ? '!bg-rose-600 hover:!bg-rose-700 !text-white' : ''}
            >
              {isSubmitting ? 'Processing...' : confirmButtonText}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
