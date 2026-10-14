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
    'bg-espresso-800 hover:bg-espresso-950 text-ivory-50 dark:bg-ivory-100 dark:hover:bg-white dark:text-espresso-950 border border-transparent shadow-subtle',
  terracotta:
    'bg-terracotta-500 hover:bg-terracotta-600 text-white border border-transparent shadow-subtle',
  secondary:
    'bg-ivory-50 hover:bg-ivory-200 text-espresso-800 dark:bg-espresso-800 dark:hover:bg-espresso-700 dark:text-ivory-100 border border-ivory-300 dark:border-espresso-700 shadow-subtle',
  ghost:
    'bg-transparent hover:bg-ivory-200 dark:hover:bg-espresso-800 text-espresso-700 dark:text-espresso-300 border border-transparent',
  danger:
    'bg-red-50 hover:bg-red-100 text-red-700 dark:bg-red-950/40 dark:hover:bg-red-900/50 dark:text-red-300 border border-red-200 dark:border-red-900/50',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'text-xs px-2.5 py-1.5 rounded-lg gap-1.5',
  md: 'text-sm px-3.5 py-2 rounded-xl gap-2',
  lg: 'text-base px-5 py-2.5 rounded-xl gap-2.5',
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
      className={`inline-flex items-center justify-center font-medium transition-all duration-150 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      disabled={disabled}
      {...props}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      {children}
    </button>
  );
};
