import React from 'react';

type BadgeVariant = 'blue' | 'emerald' | 'amber' | 'rose' | 'neutral';

interface AdminPageHeaderProps {
  title: string;
  description: string;
  badge?: {
    label: string;
    variant?: BadgeVariant;
  };
  children?: React.ReactNode;
}

export const AdminPageHeader: React.FC<AdminPageHeaderProps> = ({
  title,
  description,
  badge,
  children,
}) => {
  const getBadgeStyle = (variant: BadgeVariant = 'blue') => {
    switch (variant) {
      case 'emerald':
        return 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60';
      case 'amber':
        return 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/60';
      case 'rose':
        return 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/60';
      case 'neutral':
        return 'bg-ivory-200 dark:bg-white/10 text-espresso-700 dark:text-ivory-200 border-ivory-300 dark:border-white/10';
      case 'blue':
      default:
        return 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/60';
    }
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-ivory-200 dark:border-white/10">
      <div>
        <div className="flex items-center gap-2.5">
          <h2 className="font-serif text-2xl font-bold tracking-tight text-espresso-950 dark:text-ivory-100">
            {title}
          </h2>
          {badge && (
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider border ${getBadgeStyle(
                badge.variant
              )}`}
            >
              {badge.label}
            </span>
          )}
        </div>
        <p className="text-xs text-espresso-500 dark:text-espresso-400 mt-1 max-w-2xl leading-relaxed">
          {description}
        </p>
      </div>

      {children && <div className="flex items-center gap-2.5 shrink-0">{children}</div>}
    </div>
  );
};

