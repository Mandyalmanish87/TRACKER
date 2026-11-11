import React from 'react';
import { Button } from './Button';
import {
  Sparkles,
  Plus,
  Search,
  Calendar,
  CheckSquare,
  Dumbbell,
  BookOpen,
} from 'lucide-react';

export type EmptyStateIllustration =
  | 'search'
  | 'calendar'
  | 'task'
  | 'workout'
  | 'syllabus'
  | 'general';

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  icon?: React.ReactNode;
  illustration?: EmptyStateIllustration;
  className?: string;
}

const ILLUSTRATION_ICONS: Record<EmptyStateIllustration, React.ReactNode> = {
  general: <Sparkles className="w-5 h-5 text-terracotta-500" />,
  search: <Search className="w-5 h-5 text-sky-500" />,
  calendar: <Calendar className="w-5 h-5 text-amber-500" />,
  task: <CheckSquare className="w-5 h-5 text-emerald-500" />,
  workout: <Dumbbell className="w-5 h-5 text-rose-500" />,
  syllabus: <BookOpen className="w-5 h-5 text-purple-500" />,
};

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  icon,
  illustration = 'general',
  className = '',
}) => {
  const renderedIcon = icon || ILLUSTRATION_ICONS[illustration];

  return (
    <div
      role="status"
      className={`text-center py-12 px-6 border-2 border-dashed border-ivory-300 dark:border-espresso-750 rounded-2xl bg-ivory-50/50 dark:bg-espresso-900/30 transition-all ${className}`}
    >
      <div className="w-12 h-12 mx-auto rounded-2xl bg-ivory-200/80 dark:bg-espresso-800 flex items-center justify-center text-espresso-600 dark:text-ivory-200 mb-4 shadow-xs">
        {renderedIcon}
      </div>
      <h4 className="font-serif text-lg font-medium text-espresso-900 dark:text-ivory-100 mb-1.5 tracking-tight">
        {title}
      </h4>
      <p className="text-xs sm:text-[13px] text-espresso-500 dark:text-espresso-400 max-w-md mx-auto mb-6 leading-relaxed">
        {description}
      </p>
      {(actionLabel || secondaryActionLabel) && (
        <div className="flex flex-wrap items-center justify-center gap-3">
          {actionLabel && onAction && (
            <Button
              variant="primary"
              size="sm"
              icon={<Plus className="w-4 h-4" />}
              onClick={onAction}
            >
              {actionLabel}
            </Button>
          )}
          {secondaryActionLabel && onSecondaryAction && (
            <Button
              variant="secondary"
              size="sm"
              onClick={onSecondaryAction}
            >
              {secondaryActionLabel}
            </Button>
          )}
        </div>
      )}
    </div>
  );
};
