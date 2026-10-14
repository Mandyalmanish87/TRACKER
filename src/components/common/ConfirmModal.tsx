import React, { useEffect, useRef } from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'default';
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * In-app confirmation modal that replaces browser-native confirm().
 * Matches the app's theme and supports keyboard interaction.
 */
export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  onConfirm,
  onCancel,
}) => {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) {
      cancelRef.current?.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const confirmBtnClass =
    variant === 'danger'
      ? 'bg-rose-600 hover:bg-rose-700 text-white'
      : variant === 'warning'
      ? 'bg-ochre-600 hover:bg-ochre-700 text-white'
      : 'text-white';

  const confirmBtnStyle =
    variant === 'default' ? { backgroundColor: 'var(--accent)' } : undefined;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-espresso-950/50 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-white dark:bg-espresso-900 rounded-2xl border border-ivory-300 dark:border-espresso-700 p-6 shadow-xl space-y-4">
        <div className="flex items-start gap-3">
          <div
            className={`p-2 rounded-xl shrink-0 ${
              variant === 'danger'
                ? 'bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400'
                : variant === 'warning'
                ? 'bg-ochre-100 dark:bg-ochre-900/30 text-ochre-600 dark:text-ochre-400'
                : 'bg-ivory-200 dark:bg-espresso-800 text-espresso-600 dark:text-espresso-300'
            }`}
          >
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-serif text-base font-bold text-espresso-950 dark:text-ivory-50">
              {title}
            </h3>
            <p className="text-xs text-espresso-600 dark:text-espresso-300 mt-1 leading-relaxed">
              {message}
            </p>
          </div>
          <button
            onClick={onCancel}
            className="text-espresso-400 hover:text-espresso-600 dark:hover:text-ivory-200 shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            ref={cancelRef}
            onClick={onCancel}
            className="px-4 py-2 text-xs font-semibold rounded-xl border border-ivory-300 dark:border-espresso-700 text-espresso-600 dark:text-espresso-300 hover:bg-ivory-100 dark:hover:bg-espresso-800 transition"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-xs font-semibold rounded-xl shadow-subtle transition ${confirmBtnClass}`}
            style={confirmBtnStyle}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
