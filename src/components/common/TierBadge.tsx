import React from 'react';
import { SubscriptionTier } from '../../types/subscription';
import { Crown, Sparkles, ShieldCheck } from 'lucide-react';

interface TierBadgeProps {
  tier?: SubscriptionTier | 'admin';
  className?: string;
  showIcon?: boolean;
}

export const TierBadge: React.FC<TierBadgeProps> = ({
  tier = 'free',
  className = '',
  showIcon = true,
}) => {
  const configs: Record<
    SubscriptionTier | 'admin',
    { label: string; bg: string; text: string; border: string; icon: React.ReactNode }
  > = {
    free: {
      label: 'Free Access',
      bg: 'bg-ivory-200/80 dark:bg-white/10',
      text: 'text-espresso-700 dark:text-ivory-200',
      border: 'border-ivory-300 dark:border-white/10',
      icon: null,
    },
    paid: {
      label: 'TRAKIFY Pass',
      bg: 'bg-emerald-100 dark:bg-emerald-950/60',
      text: 'text-emerald-800 dark:text-emerald-300',
      border: 'border-emerald-300/80 dark:border-emerald-700/60',
      icon: <Sparkles className="w-3 h-3 text-emerald-500" />,
    },
    pro: {
      label: 'TRAKIFY Pass',
      bg: 'bg-amber-100 dark:bg-amber-950/60',
      text: 'text-amber-800 dark:text-amber-300',
      border: 'border-amber-300/80 dark:border-amber-700/60',
      icon: <Sparkles className="w-3 h-3 text-amber-500" />,
    },
    cohort: {
      label: 'TRAKIFY Pass',
      bg: 'bg-sky-100 dark:bg-sky-950/60',
      text: 'text-sky-800 dark:text-sky-300',
      border: 'border-sky-300/80 dark:border-sky-700/60',
      icon: <Crown className="w-3 h-3 text-sky-500" />,
    },
    admin: {
      label: 'Platform Admin',
      bg: 'bg-purple-100 dark:bg-purple-950/60',
      text: 'text-purple-800 dark:text-purple-300',
      border: 'border-purple-300/80 dark:border-purple-700/60',
      icon: <ShieldCheck className="w-3 h-3 text-purple-500" />,
    },
  };

  const current = configs[tier] || configs.free;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full font-mono text-[10.5px] font-semibold border ${current.bg} ${current.text} ${current.border} ${className}`}
    >
      {showIcon && current.icon}
      <span>{current.label}</span>
    </span>
  );
};
