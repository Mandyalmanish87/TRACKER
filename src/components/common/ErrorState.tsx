import React from 'react';
import { Button } from './Button';
import { AlertOctagon, RotateCcw, Home } from 'lucide-react';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  onNavigateHome?: () => void;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Something went wrong',
  message = 'We encountered an unexpected error while loading this content. Your existing records are safely preserved.',
  onRetry,
  onNavigateHome,
  className = '',
}) => {
  return (
    <div
      role="alert"
      className={`text-center py-12 px-6 border border-rose-300/80 dark:border-rose-900/50 rounded-2xl bg-rose-50/50 dark:bg-rose-950/20 max-w-xl mx-auto my-6 ${className}`}
    >
      <div className="w-12 h-12 mx-auto rounded-2xl bg-rose-100 dark:bg-rose-900/40 flex items-center justify-center text-rose-600 dark:text-rose-400 mb-4 shadow-xs">
        <AlertOctagon className="w-6 h-6" />
      </div>
      <h3 className="font-serif text-lg font-semibold text-rose-950 dark:text-rose-200 mb-2">
        {title}
      </h3>
      <p className="text-xs sm:text-sm text-rose-700/80 dark:text-rose-300/80 max-w-md mx-auto mb-6 leading-relaxed">
        {message}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        {onRetry && (
          <Button
            variant="primary"
            size="sm"
            icon={<RotateCcw className="w-4 h-4" />}
            onClick={onRetry}
          >
            Try Again
          </Button>
        )}
        {onNavigateHome && (
          <Button
            variant="secondary"
            size="sm"
            icon={<Home className="w-4 h-4" />}
            onClick={onNavigateHome}
          >
            Return to Dashboard
          </Button>
        )}
      </div>
    </div>
  );
};
