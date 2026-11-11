import React from 'react';
import { SaveStatus } from '../../hooks/useAutosave';
import { Check, Loader2, AlertCircle, Edit3 } from 'lucide-react';

interface SaveStatusIndicatorProps {
  status: SaveStatus;
  lastSavedAt?: Date | null;
  errorMessage?: string | null;
  className?: string;
  onRetry?: () => void;
}

export const SaveStatusIndicator: React.FC<SaveStatusIndicatorProps> = ({
  status,
  lastSavedAt,
  errorMessage,
  className = '',
  onRetry,
}) => {
  if (status === 'idle' && !lastSavedAt) {
    return null;
  }

  const formattedTime = lastSavedAt
    ? lastSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-mono transition-all duration-200 select-none ${
        status === 'saving'
          ? 'bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-300 border border-sky-200/50 dark:border-sky-800/40'
          : status === 'saved'
          ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-300 border border-emerald-200/50 dark:border-emerald-800/40'
          : status === 'unsaved'
          ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-300 border border-amber-200/50 dark:border-amber-800/40'
          : status === 'error'
          ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-300 border border-rose-200/50 dark:border-rose-800/40'
          : 'bg-ivory-100 dark:bg-white/[0.04] text-espresso-500 dark:text-espresso-400'
      } ${className}`}
    >
      {status === 'saving' && (
        <>
          <Loader2 className="w-3 h-3 animate-spin shrink-0" />
          <span>Saving...</span>
        </>
      )}

      {status === 'saved' && (
        <>
          <Check className="w-3 h-3 text-emerald-500 shrink-0" />
          <span>Saved {formattedTime ? `at ${formattedTime}` : ''}</span>
        </>
      )}

      {status === 'unsaved' && (
        <>
          <Edit3 className="w-3 h-3 text-amber-500 shrink-0" />
          <span>Unsaved changes</span>
        </>
      )}

      {status === 'error' && (
        <>
          <AlertCircle className="w-3 h-3 text-rose-500 shrink-0" />
          <span>{errorMessage || 'Save failed'}</span>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="ml-1 underline font-semibold hover:text-rose-700 cursor-pointer"
            >
              Retry
            </button>
          )}
        </>
      )}

      {status === 'idle' && formattedTime && (
        <span className="text-espresso-400 dark:text-espresso-500">
          Saved at {formattedTime}
        </span>
      )}
    </div>
  );
};
