import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';

export interface BulkAction {
  id: string;
  label: string;
  icon?: React.ReactNode;
  variant?: 'default' | 'danger' | 'primary';
  onClick: () => void;
}

interface BulkActionToolbarProps {
  selectedCount: number;
  totalCount: number;
  onClearSelection: () => void;
  actions: BulkAction[];
  className?: string;
}

export const BulkActionToolbar: React.FC<BulkActionToolbarProps> = ({
  selectedCount,
  totalCount,
  onClearSelection,
  actions,
  className = '',
}) => {
  return (
    <AnimatePresence>
      {selectedCount > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.98 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          className={`sticky bottom-6 z-40 mx-auto max-w-2xl px-4 py-3 rounded-2xl bg-espresso-900/95 dark:bg-[#201C27]/95 text-white shadow-2xl backdrop-blur-xl border border-espresso-750 dark:border-white/10 flex flex-wrap items-center justify-between gap-3 ${className}`}
        >
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-white/20 text-white">
              {selectedCount}
            </span>
            <span className="text-xs font-medium text-ivory-200">
              selected of {totalCount}
            </span>
            <button
              type="button"
              onClick={onClearSelection}
              className="text-xs text-ivory-400 hover:text-white transition underline cursor-pointer"
            >
              Deselect all
            </button>
          </div>

          <div className="flex items-center gap-2">
            {actions.map((act) => {
              const btnClass =
                act.variant === 'danger'
                  ? 'bg-rose-600 hover:bg-rose-700 text-white'
                  : act.variant === 'primary'
                  ? 'text-white'
                  : 'bg-white/10 hover:bg-white/20 text-white';

              const btnStyle =
                act.variant === 'primary' ? { backgroundColor: 'var(--accent)' } : undefined;

              return (
                <button
                  key={act.id}
                  type="button"
                  onClick={act.onClick}
                  style={btnStyle}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer shadow-xs ${btnClass}`}
                >
                  {act.icon}
                  <span>{act.label}</span>
                </button>
              );
            })}

            <button
              type="button"
              aria-label="Clear selection"
              onClick={onClearSelection}
              className="p-1 rounded-lg text-ivory-400 hover:text-white transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
