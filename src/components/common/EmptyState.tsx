import React from 'react';
import { Button } from './Button';
import { Sparkles, Plus } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  actionLabel,
  onAction,
}) => {
  return (
    <div className="text-center py-12 px-6 border-2 border-dashed border-ivory-300 dark:border-espresso-750 rounded-2xl bg-ivory-50/50 dark:bg-espresso-900/30">
      <div className="w-12 h-12 mx-auto rounded-full bg-ivory-200 dark:bg-espresso-800 flex items-center justify-center text-espresso-600 dark:text-ivory-200 mb-4">
        <Sparkles className="w-5 h-5 text-terracotta-500" />
      </div>
      <h4 className="font-serif text-lg font-medium text-espresso-900 dark:text-ivory-100 mb-1">
        {title}
      </h4>
      <p className="text-xs text-espresso-500 dark:text-espresso-400 max-w-sm mx-auto mb-6 leading-relaxed">
        {description}
      </p>
      {actionLabel && onAction && (
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button variant="primary" size="sm" icon={<Plus className="w-4 h-4" />} onClick={onAction}>
            {actionLabel}
          </Button>
        </div>
      )}
    </div>
  );
};
