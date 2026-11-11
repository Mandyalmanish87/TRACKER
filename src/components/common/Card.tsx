import React, { createContext, useContext } from 'react';

export interface CardDensityContextValue {
  density: 'comfortable' | 'compact';
  borderless: boolean;
}

export const CardDensityContext = createContext<CardDensityContextValue>({
  density: 'comfortable',
  borderless: false,
});

export const useCardDensity = () => useContext(CardDensityContext);

export interface CardProps {
  id?: string;
  children: React.ReactNode;
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  density?: 'comfortable' | 'compact';
  borderless?: boolean;
}

export const Card: React.FC<CardProps> = ({
  id,
  children,
  eyebrow,
  title,
  subtitle,
  action,
  className = '',
  bodyClassName = '',
  density,
  borderless,
}) => {
  const context = useCardDensity();
  const effectiveDensity = density || context.density;
  const effectiveBorderless = borderless ?? context.borderless;
  const isCompact = effectiveDensity === 'compact';

  const hasHeader = eyebrow || title || subtitle || action;

  return (
    <div
      id={id}
      className={`${effectiveBorderless ? '' : 'tracker-glass-card'} ${
        effectiveBorderless
          ? 'bg-transparent'
          : 'bg-white/95 dark:bg-[#18151D]/90 border border-ivory-300/80 dark:border-white/10 rounded-2xl shadow-subtle [box-shadow:inset_0_1px_0_0_rgba(255,255,255,0.7),0_1px_3px_0_rgba(0,0,0,0.02)] dark:[box-shadow:inset_0_1px_0_0_rgba(255,255,255,0.08),0_8px_24px_-4px_rgba(0,0,0,0.4)]'
      } transition-all duration-200 overflow-hidden flex flex-col h-full ${className}`}
    >
      {hasHeader && (
        <div
          className={`${
            isCompact ? 'px-4 py-2.5 sm:px-4.5 sm:py-3' : 'px-6 py-4 sm:px-7 sm:py-4.5'
          } border-b border-ivory-200/80 dark:border-white/10 flex items-start justify-between gap-3 shrink-0`}
        >
          <div className="min-w-0">
            {eyebrow && (
              <p className="text-[10.5px] font-mono uppercase tracking-wider text-terracotta-600 dark:text-terracotta-400 font-semibold mb-0.5">
                {eyebrow}
              </p>
            )}
            {title && (
              <h3
                className={`font-serif ${
                  isCompact ? 'text-base sm:text-lg' : 'text-lg sm:text-xl'
                } font-bold text-espresso-950 dark:text-ivory-50 tracking-tight leading-snug truncate`}
              >
                {title}
              </h3>
            )}
            {subtitle && (
              <p
                className={`text-xs text-espresso-500 dark:text-espresso-400 ${
                  isCompact ? 'mt-0.5 line-clamp-1' : 'mt-0.5 leading-relaxed'
                }`}
              >
                {subtitle}
              </p>
            )}
          </div>
          {action && <div className="shrink-0 pt-0.5">{action}</div>}
        </div>
      )}
      <div
        className={`${
          isCompact ? 'p-3.5 sm:p-4' : 'p-6 sm:p-7'
        } flex-1 overflow-y-auto ${bodyClassName}`}
      >
        {children}
      </div>
    </div>
  );
};
