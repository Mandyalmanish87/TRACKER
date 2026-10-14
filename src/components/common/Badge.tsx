import React from 'react';

export type BadgeVariant = 'terracotta' | 'sage' | 'ochre' | 'danger' | 'neutral' | 'espresso';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  terracotta: 'bg-terracotta-50 text-terracotta-700 border-terracotta-200 dark:bg-terracotta-900/40 dark:text-terracotta-300 dark:border-terracotta-800/60',
  sage: 'bg-sage-50 text-sage-700 border-sage-200 dark:bg-sage-700/20 dark:text-sage-200 dark:border-sage-700/50',
  ochre: 'bg-ochre-50 text-ochre-600 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60',
  danger: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800/60',
  neutral: 'bg-ivory-200 text-espresso-700 border-ivory-300 dark:bg-espresso-800 dark:text-espresso-300 dark:border-espresso-700',
  espresso: 'bg-espresso-800 text-ivory-100 border-espresso-900 dark:bg-ivory-200 dark:text-espresso-950 dark:border-ivory-300',
};

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'sm',
  className = '',
}) => {
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs';
  return (
    <span
      className={`inline-flex items-center gap-1 font-medium tracking-wide rounded-full border transition-colors ${sizeClasses} ${variantStyles[variant]} ${className}`}
    >
      {children}
    </span>
  );
};
