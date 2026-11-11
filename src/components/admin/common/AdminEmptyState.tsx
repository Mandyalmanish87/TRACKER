import React from 'react';
import { Button } from '../../common/Button';

interface AdminEmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export const AdminEmptyState: React.FC<AdminEmptyStateProps> = ({
  icon,
  title,
  description,
  action,
}) => {
  return (
    <div className="py-16 px-6 text-center flex flex-col items-center justify-center rounded-2xl bg-white/60 dark:bg-[#0A0F1D]/60 border border-dashed border-ivory-300 dark:border-white/10">
      <div className="w-12 h-12 rounded-2xl bg-ivory-100 dark:bg-white/5 border border-ivory-200 dark:border-white/10 flex items-center justify-center text-espresso-400 dark:text-ivory-400 mb-3">
        {icon}
      </div>
      <h3 className="font-serif text-base font-bold text-espresso-900 dark:text-ivory-100 mb-1">
        {title}
      </h3>
      <p className="text-xs text-espresso-500 dark:text-espresso-400 max-w-md mb-4 leading-relaxed">
        {description}
      </p>
      {action && (
        <Button variant="secondary" size="sm" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
};

