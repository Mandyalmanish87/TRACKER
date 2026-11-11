import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface AdminStatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: {
    value: string;
    isPositive?: boolean;
    isNeutral?: boolean;
  };
  accentColor?: string;
  onClick?: () => void;
}

export const AdminStatCard: React.FC<AdminStatCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  trend,
  accentColor = '#3B82F6',
  onClick,
}) => {
  return (
    <div
      onClick={onClick}
      className={`relative p-5 rounded-2xl bg-white/95 dark:bg-[#0C1220]/90 border border-ivory-300/80 dark:border-white/10 shadow-sm transition-all duration-200 overflow-hidden group ${
        onClick ? 'cursor-pointer hover:border-blue-500/40 hover:shadow-md' : ''
      }`}
    >
      {/* Cirrel subtle radial glow behind icon */}
      <div
        className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl pointer-events-none opacity-15 transition-opacity group-hover:opacity-25"
        style={{ backgroundColor: accentColor }}
      />

      <div className="flex items-center justify-between gap-3 mb-3 relative z-10">
        <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-espresso-500 dark:text-ivory-400">
          {title}
        </span>
        <div
          className="p-2 rounded-xl bg-ivory-100 dark:bg-white/5 border border-ivory-200 dark:border-white/10 text-espresso-700 dark:text-ivory-200 transition-colors"
          style={{ color: accentColor }}
        >
          {icon}
        </div>
      </div>

      <div className="relative z-10 flex items-baseline justify-between gap-2">
        <div className="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-espresso-950 dark:text-ivory-50 tabular-nums">
          {value}
        </div>

        {trend && (
          <div
            className={`inline-flex items-center gap-1 text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full ${
              trend.isNeutral
                ? 'bg-espresso-100 dark:bg-white/10 text-espresso-600 dark:text-ivory-300'
                : trend.isPositive
                ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/60'
                : 'bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/60'
            }`}
          >
            {trend.isNeutral ? (
              <Minus className="w-3 h-3" />
            ) : trend.isPositive ? (
              <TrendingUp className="w-3 h-3" />
            ) : (
              <TrendingDown className="w-3 h-3" />
            )}
            <span>{trend.value}</span>
          </div>
        )}
      </div>

      {subtitle && (
        <p className="text-xs text-espresso-500 dark:text-espresso-400 mt-1.5 relative z-10 line-clamp-1">
          {subtitle}
        </p>
      )}
    </div>
  );
};

