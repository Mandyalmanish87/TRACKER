import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, AlertOctagon, X, Loader2 } from 'lucide-react';

export interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  confirmText?: string;
  cancelLabel?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'default';
  irreversible?: boolean;
  recordIdentifier?: string;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

/**
 * SaaS Destructive Action Protection Dialog
 * - In-app confirmation modal replacing browser-native confirm().
 * - Clearly highlights irreversible data consequences and affected record.
 * - Prevents double-submission and supports keyboard navigation.
 */
export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmLabel,
  confirmText,
  cancelLabel,
  cancelText,
  variant = 'danger',
  irreversible = false,
  recordIdentifier,
  onConfirm,
  onCancel,
}) => {
  const finalConfirmLabel = confirmText || confirmLabel || 'Confirm';
  const finalCancelLabel = cancelText || cancelLabel || 'Cancel';
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsSubmitting(false);
      cancelRef.current?.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) {
        onCancel();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, onCancel]);

  if (!isOpen) return null;

  const handleConfirmClick = async () => {
    if (isSubmitting) return;
    try {
      setIsSubmitting(true);
      await onConfirm();
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmBtnClass =
    variant === 'danger'
      ? 'bg-rose-600 hover:bg-rose-700 text-white'
      : variant === 'warning'
      ? 'bg-amber-600 hover:bg-amber-700 text-white'
      : 'text-white';

  const confirmBtnStyle =
    variant === 'default' ? { backgroundColor: 'var(--accent)' } : undefined;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-message"
      className="fixed inset-0 z-[9990] flex items-center justify-center p-4 bg-espresso-950/60 dark:bg-black/70 backdrop-blur-sm animate-in fade-in duration-150"
    >
      <div className="w-full max-w-sm sm:max-w-md bg-white dark:bg-[#18151D] rounded-2xl border border-ivory-300 dark:border-white/10 p-6 shadow-2xl space-y-4">
        <div className="flex items-start gap-3.5">
          <div
            className={`p-2.5 rounded-xl shrink-0 ${
              variant === 'danger'
                ? 'bg-rose-100 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400'
                : variant === 'warning'
                ? 'bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400'
                : 'bg-ivory-200 dark:bg-white/10 text-espresso-600 dark:text-ivory-200'
            }`}
          >
            {irreversible ? (
              <AlertOctagon className="w-5 h-5" />
            ) : (
              <AlertTriangle className="w-5 h-5" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3
              id="confirm-dialog-title"
              className="font-serif text-base font-bold text-espresso-950 dark:text-ivory-50 tracking-tight"
            >
              {title}
            </h3>
            {recordIdentifier && (
              <div className="mt-1 px-2.5 py-1 rounded-md bg-ivory-100 dark:bg-white/5 font-mono text-[11px] text-espresso-700 dark:text-ivory-200 truncate">
                {recordIdentifier}
              </div>
            )}
            <p
              id="confirm-dialog-message"
              className="text-xs text-espresso-600 dark:text-espresso-300 mt-2 leading-relaxed"
            >
              {message}
            </p>
            {irreversible && (
              <p className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 mt-2 flex items-center gap-1.5">
                <span>⚠️</span> This action is permanent and cannot be undone.
              </p>
            )}
          </div>
          <button
            type="button"
            aria-label="Close dialog"
            disabled={isSubmitting}
            onClick={onCancel}
            className="text-espresso-400 hover:text-espresso-600 dark:hover:text-ivory-200 shrink-0 p-1 rounded-lg transition disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-ivory-200 dark:border-white/10">
          <button
            ref={cancelRef}
            type="button"
            disabled={isSubmitting}
            onClick={onCancel}
            className="px-4 py-2 text-xs font-semibold rounded-xl border border-ivory-300 dark:border-espresso-700 text-espresso-700 dark:text-ivory-200 hover:bg-ivory-100 dark:hover:bg-white/5 transition cursor-pointer disabled:opacity-50"
          >
            {finalCancelLabel}
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleConfirmClick}
            className={`px-4 py-2 text-xs font-semibold rounded-xl shadow-subtle transition cursor-pointer flex items-center gap-1.5 ${confirmBtnClass} disabled:opacity-50`}
            style={confirmBtnStyle}
          >
            {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>{isSubmitting ? 'Processing...' : finalConfirmLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
