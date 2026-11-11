import React from 'react';
import { Lock, Sparkles, ArrowRight, ShieldCheck } from 'lucide-react';
import { useEntitlements } from '../../hooks/useEntitlements';
import { getFeatureDefinition } from '../../services/featureRegistry';

export interface ProFeatureGateProps {
  featureKey: string;
  children?: React.ReactNode;
  fallback?: React.ReactNode;
  title?: string;
  description?: string;
  compact?: boolean;
  onUpgradeClick?: () => void;
}

export const ProFeatureGate: React.FC<ProFeatureGateProps> = ({
  featureKey,
  children,
  fallback,
  title,
  description,
  compact = false,
  onUpgradeClick,
}) => {
  const { canAccess, loading } = useEntitlements();
  const hasAccess = canAccess(featureKey);

  if (hasAccess) {
    return <>{children ?? null}</>;
  }

  if (loading) {
    return (
      <div className="p-8 text-center text-xs text-espresso-400 dark:text-espresso-500 animate-pulse">
        Verifying feature access...
      </div>
    );
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  const featureDef = getFeatureDefinition(featureKey);
  const displayTitle = title || featureDef?.name || 'TRAKIFY Pro Feature';
  const displayDescription =
    description ||
    featureDef?.description ||
    'This advanced module requires an active TRAKIFY Membership Pass.';

  const handleOpenPasses = () => {
    if (onUpgradeClick) {
      onUpgradeClick();
      return;
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('tracker:navigate-tab', {
          detail: { tab: 'settings' },
        })
      );
    }
  };

  if (compact) {
    return (
      <div className="p-4 rounded-2xl border border-ochre-300 dark:border-ochre-700/60 bg-ochre-50/70 dark:bg-espresso-850 shadow-subtle flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-ochre-100 dark:bg-ochre-900/40 text-ochre-700 dark:text-ochre-300 flex items-center justify-center shrink-0">
            <Lock className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xs font-bold text-espresso-900 dark:text-ivory-100 flex items-center gap-1.5">
              <span>{displayTitle}</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-terracotta-100 dark:bg-terracotta-900/40 text-terracotta-700 dark:text-terracotta-300 uppercase font-semibold">
                Pro Pass
              </span>
            </p>
            <p className="text-[11px] text-espresso-600 dark:text-espresso-400 mt-0.5">
              {displayDescription}
            </p>
          </div>
        </div>
        <button
          onClick={handleOpenPasses}
          className="text-xs px-3.5 py-1.5 rounded-xl text-white font-semibold shadow-subtle transition hover:opacity-95 whitespace-nowrap flex items-center gap-1.5 shrink-0"
          style={{ backgroundColor: 'var(--accent, #C45532)' }}
        >
          <span>View Passes (From ₹20)</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="w-full my-4 p-6 sm:p-8 rounded-3xl border border-ivory-300 dark:border-espresso-750 bg-gradient-to-b from-white to-ivory-50 dark:from-espresso-850 dark:to-espresso-900 shadow-subtle text-center flex flex-col items-center justify-center max-w-2xl mx-auto">
      <div className="w-14 h-14 rounded-2xl bg-terracotta-50 dark:bg-terracotta-950/50 border border-terracotta-200 dark:border-terracotta-800/60 flex items-center justify-center text-terracotta-600 dark:text-terracotta-400 mb-4 shadow-sm">
        <Lock className="w-6 h-6" />
      </div>

      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-ochre-100 dark:bg-ochre-900/40 text-ochre-800 dark:text-ochre-300 text-[10px] font-mono uppercase tracking-wider font-bold mb-2">
        <Sparkles className="w-3 h-3 text-ochre-600 dark:text-ochre-400" />
        <span>Pro Membership Pass Required</span>
      </div>

      <h3 className="font-serif text-xl sm:text-2xl font-bold text-espresso-950 dark:text-ivory-50 tracking-tight">
        {displayTitle}
      </h3>

      <p className="text-xs sm:text-sm text-espresso-600 dark:text-espresso-300 max-w-lg mt-2 leading-relaxed">
        {displayDescription}
      </p>

      {/* Free Forever guarantee badge */}
      <div className="mt-5 p-3 rounded-xl bg-ivory-100 dark:bg-espresso-800/60 border border-ivory-200 dark:border-espresso-700/60 max-w-lg text-left flex items-start gap-2.5">
        <ShieldCheck className="w-4 h-4 text-sage-600 dark:text-sage-400 shrink-0 mt-0.5" />
        <p className="text-[11px] text-espresso-600 dark:text-espresso-300 leading-normal">
          <strong className="text-espresso-900 dark:text-ivory-100">Basic tools are Free Forever:</strong>{' '}
          Timetable, Attendance, Topic Syllabus, Focus Timers, Everyday Workout &amp; Nutrition logs, and Local Backups remain 100% free with no expiration.
        </p>
      </div>

      {/* Action button */}
      <div className="mt-6 flex flex-col sm:flex-row items-center gap-3">
        <button
          onClick={handleOpenPasses}
          className="px-6 py-2.5 rounded-xl text-white text-xs sm:text-sm font-semibold shadow-subtle transition hover:opacity-95 flex items-center gap-2"
          style={{ backgroundColor: 'var(--accent, #C45532)' }}
        >
          <span>View Membership Passes (From ₹20)</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
