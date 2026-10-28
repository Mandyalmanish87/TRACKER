import React from 'react';

export type ButtonVariant = 'primary' | 'terracotta' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-espresso-900 hover:bg-espresso-950 text-ivory-50 dark:bg-ivory-100 dark:hover:bg-white dark:text-espresso-950 border border-transparent shadow-subtle hover:shadow-editorial dark:hover:shadow-editorial-dark',
  terracotta:
    'bg-terracotta-600 hover:bg-terracotta-700 text-white border border-transparent shadow-subtle hover:shadow-editorial dark:hover:shadow-editorial-dark',
  secondary:
    'bg-white dark:bg-espresso-850 hover:bg-ivory-100 dark:hover:bg-espresso-800 text-espresso-800 dark:text-ivory-100 border border-ivory-300 dark:border-espresso-750 shadow-subtle hover:border-ivory-400 dark:hover:border-espresso-700',
  ghost:
    'bg-transparent hover:bg-ivory-200/80 dark:hover:bg-espresso-800/80 text-espresso-700 dark:text-ivory-200 border border-transparent',
  danger:
    'bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:hover:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60 shadow-subtle',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'text-xs px-2.5 py-1.5 rounded-lg gap-1.5 font-medium',
  md: 'text-xs sm:text-sm px-3.5 sm:px-4 py-2 rounded-xl gap-2 font-medium',
  lg: 'text-sm sm:text-base px-5 py-2.5 rounded-xl gap-2.5 font-semibold',
};

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'secondary',
  size = 'md',
  icon,
  className = '',
  disabled,
  ...props
}) => {
  return (
    <button
      className={`inline-flex items-center justify-center transition-all duration-150 active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none cursor-pointer select-none ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      disabled={disabled}
      {...props}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      {children}
    </button>
  );
};
