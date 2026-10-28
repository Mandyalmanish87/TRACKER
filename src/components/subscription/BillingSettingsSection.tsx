import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  CheckCircle,
  Sparkles,
  Shield,
  ExternalLink,
  AlertTriangle,
  RefreshCw,
  Crown,
  Zap,
} from 'lucide-react';
import {
  subscriptionService,
  PLANS_CATALOGUE,
  DEFAULT_FREE_ENTITLEMENTS,
} from '../../services/subscriptionService';
import { UserEntitlements, UserSubscription, SubscriptionTier } from '../../types/subscription';

interface BillingSettingsSectionProps {
  userId?: string;
}

export const BillingSettingsSection: React.FC<BillingSettingsSectionProps> = ({ userId }) => {
  const [entitlements, setEntitlements] = useState<UserEntitlements>(DEFAULT_FREE_ENTITLEMENTS);
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'warning' | 'info'; text: string } | null>(null);

  const fetchSubscriptionDetails = async () => {
    setLoading(true);
    try {
      const [entData, subData] = await Promise.all([
        subscriptionService.getUserEntitlements(userId),
        subscriptionService.getUserSubscription(),
      ]);
      setEntitlements(entData);
      setSubscription(subData);
    } catch (err: any) {
      console.warn('[BillingSettingsSection] Failed to load subscription:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscriptionDetails();
  }, [userId]);

  const handleUpgrade = async (tier: 'pro' | 'cohort') => {
    setActionLoading(tier);
    setMessage(null);
    try {
      const res = await subscriptionService.createCheckoutSession(tier);
      if (res.checkoutUrl) {
        window.location.href = res.checkoutUrl;
      }
    } catch (err: any) {
      setMessage({
        type: 'info',
        text: err.message || 'Payment checkout is currently in test mode or awaiting live keys (DEC-04).',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleOpenCustomerPortal = async () => {
    setActionLoading('portal');
    setMessage(null);
    try {
      const res = await subscriptionService.createCustomerPortalSession();
      if (res.portalUrl) {
        window.location.href = res.portalUrl;
      }
    } catch (err: any) {
      setMessage({
        type: 'info',
        text: err.message || 'Billing portal is currently in test mode or awaiting live keys (DEC-04).',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const isCurrentTier = (tierId: SubscriptionTier) => {
    if (tierId === 'free' && (!entitlements.isActive || entitlements.tier === 'free')) return true;
    return entitlements.isActive && entitlements.tier === tierId;
  };

  return (
    <div className="p-5 sm:p-6 rounded-2xl border border-ivory-300 dark:border-espresso-750 bg-white dark:bg-espresso-850 shadow-subtle lg:col-span-2">
      {/* Section Heading */}
      <div className="flex items-start justify-between gap-4 mb-5">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 p-2 rounded-xl bg-terracotta-50 dark:bg-terracotta-950/40 text-terracotta-600 dark:text-terracotta-400">
            <CreditCard className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-espresso-950 dark:text-ivory-50 flex items-center gap-2">
              Membership & Subscriptions
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-ivory-200 dark:bg-espresso-750 text-espresso-600 dark:text-ivory-300">
                Server Verified
              </span>
            </h2>
            <p className="text-xs text-espresso-400 dark:text-espresso-500 mt-0.5">
              Manage product tiers, multi-device sync, and academic collaboration entitlements.
            </p>
          </div>
        </div>

        <button
          onClick={fetchSubscriptionDetails}
          disabled={loading}
          title="Refresh subscription status"
          className="p-2 rounded-lg border border-ivory-200 dark:border-espresso-700 text-espresso-500 hover:text-espresso-900 dark:hover:text-ivory-100 hover:bg-ivory-100 dark:hover:bg-espresso-800 transition cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Message / Notification Banner */}
      {message && (
        <div
          className={`mb-5 p-3.5 rounded-xl text-xs flex items-center gap-2.5 ${
            message.type === 'error'
              ? 'bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300'
              : message.type === 'warning'
              ? 'bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-amber-700 dark:text-amber-300'
              : 'bg-ivory-100 dark:bg-espresso-800 border border-ivory-300 dark:border-espresso-700 text-espresso-700 dark:text-ivory-200'
          }`}
        >
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span className="flex-1">{message.text}</span>
          <button
            onClick={() => setMessage(null)}
            className="text-[11px] underline cursor-pointer ml-auto"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Grace Period Warning if Past Due */}
      {entitlements.status === 'past_due' && (
        <div className="mb-5 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800/60">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                Payment Past Due — Grace Period Active
              </h4>
              <p className="text-xs text-amber-800 dark:text-amber-300 mt-1 leading-relaxed">
                Your last subscription renewal could not be processed. We provide a 24-hour grace period so your study tasks and timetable synchronization remain uninterrupted. Please launch the billing portal to update your card.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Current Plan Overview Card */}
      <div className="mb-6 p-4 rounded-xl bg-ivory-50 dark:bg-espresso-900/60 border border-ivory-200 dark:border-espresso-750 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono uppercase text-espresso-400 dark:text-espresso-500 font-semibold tracking-wider">
              Active Tier
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-terracotta-100 dark:bg-terracotta-900/40 text-terracotta-800 dark:text-terracotta-300 border border-terracotta-200 dark:border-terracotta-800">
              {entitlements.tier === 'cohort' ? (
                <>
                  <Crown className="w-3.5 h-3.5" /> Cohort Sponsor
                </>
              ) : entitlements.tier === 'pro' ? (
                <>
                  <Sparkles className="w-3.5 h-3.5" /> Tracker Pro
                </>
              ) : (
                <>
                  <Shield className="w-3.5 h-3.5" /> Free Student
                </>
              )}
            </span>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-ivory-200 dark:bg-espresso-800 text-espresso-700 dark:text-ivory-300">
              Status: {entitlements.status}
            </span>
          </div>

          <p className="text-xs text-espresso-500 dark:text-ivory-400 mt-2">
            {entitlements.tier === 'free'
              ? 'You are currently on the permanent free tier with full offline timetable, attendance, and focus tools.'
              : entitlements.cancelAtPeriodEnd
              ? `Your subscription will end on ${entitlements.currentPeriodEnd ? new Date(entitlements.currentPeriodEnd).toLocaleDateString() : 'the renewal date'} and will not renew.`
              : `Active until ${entitlements.currentPeriodEnd ? new Date(entitlements.currentPeriodEnd).toLocaleDateString() : 'next billing period'}.`}
          </p>
        </div>

        {subscription?.customerId && (
          <button
            onClick={handleOpenCustomerPortal}
            disabled={actionLoading === 'portal'}
            className="shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border border-ivory-300 dark:border-espresso-700 hover:bg-ivory-100 dark:hover:bg-espresso-800 text-espresso-800 dark:text-ivory-200 transition cursor-pointer"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>{actionLoading === 'portal' ? 'Opening...' : 'Manage Billing & Invoices'}</span>
          </button>
        )}
      </div>

      {/* Product Tiers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {PLANS_CATALOGUE.map((plan) => {
          const isCurrent = isCurrentTier(plan.id);

          return (
            <div
              key={plan.id}
              className={`relative flex flex-col justify-between p-5 rounded-xl border transition ${
                plan.highlighted
                  ? 'border-terracotta-400 dark:border-terracotta-500 bg-terracotta-50/20 dark:bg-terracotta-950/10'
                  : 'border-ivory-200 dark:border-espresso-750 bg-ivory-50/50 dark:bg-espresso-900/40'
              }`}
            >
              {plan.badge && (
                <span className="absolute -top-2.5 right-4 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-terracotta-600 text-white shadow-xs">
                  {plan.badge}
                </span>
              )}

              <div>
                <h3 className="text-sm font-bold text-espresso-950 dark:text-ivory-50 flex items-center gap-1.5">
                  {plan.name}
                </h3>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-2xl font-bold font-mono text-espresso-900 dark:text-ivory-100">
                    {plan.priceFormatted}
                  </span>
                  <span className="text-xs text-espresso-400 dark:text-espresso-500 font-mono">
                    /{plan.interval}
                  </span>
                </div>
                <p className="text-xs text-espresso-500 dark:text-ivory-400 mt-2">
                  {plan.description}
                </p>

                {/* Features List */}
                <ul className="mt-4 space-y-2 border-t border-ivory-200 dark:border-espresso-800 pt-3 text-xs text-espresso-700 dark:text-ivory-200">
                  {plan.features.map((feat, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Action Button */}
              <div className="mt-6 pt-3 border-t border-ivory-200 dark:border-espresso-800">
                {isCurrent ? (
                  <button
                    disabled
                    className="w-full py-2 px-3 rounded-xl text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 cursor-default flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle className="w-3.5 h-3.5" /> Current Plan
                  </button>
                ) : plan.id === 'free' ? (
                  <button
                    disabled
                    className="w-full py-2 px-3 rounded-xl text-xs font-medium text-espresso-400 dark:text-espresso-600 bg-ivory-200/50 dark:bg-espresso-800/50 cursor-default"
                  >
                    Default Free Tier
                  </button>
                ) : (
                  <button
                    onClick={() => handleUpgrade(plan.id as 'pro' | 'cohort')}
                    disabled={actionLoading !== null}
                    className="w-full py-2.5 px-3 rounded-xl text-xs font-semibold text-white bg-terracotta-600 hover:bg-terracotta-700 active:scale-[0.99] transition shadow-subtle flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>
                      {actionLoading === plan.id ? 'Connecting...' : `Upgrade to ${plan.name}`}
                    </span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Permanent Free Offline Assurance */}
      <div className="mt-5 p-3.5 rounded-xl bg-ivory-100/70 dark:bg-espresso-800/50 border border-ivory-200 dark:border-espresso-750 flex items-start gap-3 text-xs text-espresso-500 dark:text-ivory-400">
        <Shield className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <strong className="text-espresso-800 dark:text-ivory-200 font-semibold">Offline-First Student Promise: </strong>
          Attendance tracking, timetable scheduling, syllabus progress, study timers, and local browser backups will remain 100% free and functional offline forever. Paid subscriptions power automated multi-device cloud sync and cohort collaboration infrastructure.
        </p>
      </div>
    </div>
  );
};
