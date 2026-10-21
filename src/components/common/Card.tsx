import React from 'react';

interface CardProps {
  children: React.ReactNode;
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}

export const Card: React.FC<CardProps> = ({
  children,
  eyebrow,
  title,
  subtitle,
  action,
  className = '',
  bodyClassName = '',
}) => {
  const hasHeader = eyebrow || title || subtitle || action;

  return (
    <div
      className={`bg-white dark:bg-espresso-850 border border-ivory-300 dark:border-espresso-750 rounded-2xl shadow-subtle transition-all duration-200 overflow-hidden ${className}`}
    >
      {hasHeader && (
        <div className="px-6 py-4 sm:px-7 sm:py-4.5 border-b border-ivory-200 dark:border-espresso-800 flex items-start justify-between gap-4">
          <div className="min-w-0">
            {eyebrow && (
              <p className="text-[11px] font-mono uppercase tracking-wider text-terracotta-600 dark:text-terracotta-400 font-semibold mb-1">
                {eyebrow}
              </p>
            )}
            {title && (
              <h3 className="font-serif text-lg sm:text-xl font-bold text-espresso-950 dark:text-ivory-50 tracking-tight">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="text-xs text-espresso-500 dark:text-espresso-400 mt-0.5 leading-relaxed">
                {subtitle}
              </p>
            )}
          </div>
          {action && <div className="shrink-0 pt-0.5">{action}</div>}
        </div>
      )}
      <div className={`p-6 sm:p-7 ${bodyClassName}`}>{children}</div>
    </div>
  );
};
