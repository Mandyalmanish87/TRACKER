import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  CheckCircle,
  Sparkles,
  Shield,
  AlertTriangle,
  RefreshCw,
  Zap,
  Clock,
  Layers,
  RotateCcw,
  KeyRound,
} from 'lucide-react';
import {
  subscriptionService,
  TRAKIFY_PASS_CATALOGUE,
  DEFAULT_FREE_ENTITLEMENTS,
} from '../../services/subscriptionService';
import { UserEntitlements, UserSubscription, TrakifyPassId } from '../../types/subscription';

interface BillingSettingsSectionProps {
  userId?: string;
}

export const BillingSettingsSection: React.FC<BillingSettingsSectionProps> = ({ userId }) => {
  const [entitlements, setEntitlements] = useState<UserEntitlements>(DEFAULT_FREE_ENTITLEMENTS);
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'warning' | 'info'; text: string } | null>(null);

  const [showRecovery, setShowRecovery] = useState(false);
  const [recoveryPaymentId, setRecoveryPaymentId] = useState('');
  const [recoveryOrderId, setRecoveryOrderId] = useState('');
  const [recoveryLoading, setRecoveryLoading] = useState(false);

  const handleRecover = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoveryPaymentId.trim() || !recoveryOrderId.trim()) {
      setMessage({
        type: 'error',
        text: 'Please provide both your Razorpay Payment ID (pay_...) and Order ID (order_...).',
      });
      return;
    }

    setRecoveryLoading(true);
    setMessage(null);
    try {
      const res = await subscriptionService.recoverCapturedPayment({
        paymentId: recoveryPaymentId.trim(),
        orderId: recoveryOrderId.trim(),
      });

      if (res.success && res.verified) {
        setMessage({
          type: 'success',
          text: `Payment recovered successfully! Your pass is now active. Access duration has been added to your account.`,
        });
        setRecoveryPaymentId('');
        setRecoveryOrderId('');
        setShowRecovery(false);
        await fetchSubscriptionDetails();
      } else {
        setMessage({
          type: 'error',
          text: res.error || 'Payment recovery failed. Please verify your payment ID and order ID.',
        });
      }
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err.message || 'Payment recovery failed. Please retry.',
      });
    } finally {
      setRecoveryLoading(false);
    }
  };

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

  const handlePurchase = async (passId: TrakifyPassId) => {
    setActionLoading(passId);
    setMessage(null);
    try {
      // 1. Ensure Razorpay Checkout script is loaded
      await subscriptionService.loadRazorpayCheckoutScript();

      // 2. Request server-authoritative Razorpay order
      const orderRes = await subscriptionService.createRazorpayOrder(passId, 'one_time');
      const passConfig = TRAKIFY_PASS_CATALOGUE.find((p) => p.id === passId);
      const passName = passConfig ? passConfig.name : 'TRAKIFY Pass';

      if (typeof window !== 'undefined' && (window as any).Razorpay) {
        const rzp = new (window as any).Razorpay({
          key: orderRes.keyId,
          amount: orderRes.amount,
          currency: 'INR',
          order_id: orderRes.orderId,
          name: 'TRAKIFY',
          description: `${passName} (${passConfig?.durationLabel || 'One-Time Pass'})`,
          handler: async (response: any) => {
            setActionLoading('verifying');
            const ver = await subscriptionService.verifyRazorpayPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              planId: passId,
              planTier: 'paid',
              billingMode: 'one_time',
            });
            if (ver.success) {
              setMessage({
                type: 'success',
                text: `Payment successful! Your ${passName} is now active. Access duration has been added to your account.`,
              });
              await fetchSubscriptionDetails();
            } else {
              setMessage({ type: 'error', text: ver.error || 'Payment verification failed.' });
            }
            setActionLoading(null);
          },
          modal: {
            ondismiss: () => setActionLoading(null),
          },
          theme: { color: '#c05621' },
        });
        rzp.open();
        return;
      }

      setMessage({
        type: 'info',
        text: 'Razorpay Checkout ready. (In test mode or awaiting live credentials).',
      });
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err.message || 'Payment checkout failed. Please retry.',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const hasActive = entitlements.hasActivePass || entitlements.isActive;

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
              TRAKIFY Membership Passes
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-ivory-200 dark:bg-espresso-750 text-espresso-600 dark:text-ivory-300">
                One-Time Payment
              </span>
            </h2>
            <p className="text-xs text-espresso-400 dark:text-espresso-500 mt-0.5">
              Select an access pass to unlock cloud sync, AI syllabus planning, 3D anatomy, and ClassSpace creation. No recurring deductions.
            </p>
          </div>
        </div>

        <button
          onClick={fetchSubscriptionDetails}
          disabled={loading}
          title="Refresh access status"
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
              : message.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300'
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

      {/* Past Due Warning */}
      {(entitlements.status === 'past_due' || subscription?.status === 'past_due') && (
        <div className="mb-5 p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>
            <strong>Payment Past Due — Grace Period Active:</strong> Your access is currently in a 24-hour grace period. Please select a pass below to retain uninterrupted access.
          </span>
        </div>
      )}

      {/* Current Pass Status Overview Card */}
      <div className="mb-6 p-4 rounded-xl bg-ivory-50 dark:bg-espresso-900/60 border border-ivory-200 dark:border-espresso-750 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono uppercase text-espresso-400 dark:text-espresso-500 font-semibold tracking-wider">
              Access State:
            </span>
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
              hasActive
                ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                : 'bg-ivory-200 dark:bg-espresso-800 text-espresso-700 dark:text-ivory-300 border border-ivory-300 dark:border-espresso-700'
            }`}>
              {hasActive ? (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  Active Paid Pass
                </>
              ) : (
                <>
                  <Shield className="w-3.5 h-3.5" />
                  Free Baseline Access
                </>
              )}
            </span>
            {hasActive && entitlements.daysRemaining !== undefined && (
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900">
                {entitlements.daysRemaining} days remaining
              </span>
            )}
            {subscription?.paymentId && (
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-ivory-200/60 dark:bg-espresso-800/60 text-espresso-500 dark:text-ivory-400">
                Ref: {subscription.paymentId.slice(0, 14)}...
              </span>
            )}
          </div>

          <p className="text-xs text-espresso-500 dark:text-ivory-400 mt-2">
            {hasActive
              ? `Your paid features remain active until ${entitlements.currentPeriodEnd ? new Date(entitlements.currentPeriodEnd).toLocaleDateString() : 'end of period'}. Purchasing any pass appends its duration to your remaining time.`
              : 'You are on baseline free access with permanent offline timetable, attendance calculations, workout logs, and study timers.'}
          </p>
        </div>

        {hasActive && (
          <div className="shrink-0 flex items-center gap-2">
            <span className="px-3 py-1.5 rounded-xl text-xs font-medium bg-ivory-200 dark:bg-espresso-800 text-espresso-700 dark:text-ivory-300 border border-ivory-300 dark:border-espresso-750">
              One-Time Pass · No Auto-Debit
            </span>
          </div>
        )}
      </div>

      {/* One-Time Payment Stacking Notice Banner */}
      <div className="mb-5 p-3 rounded-xl bg-ivory-100/70 dark:bg-espresso-800/40 border border-ivory-200 dark:border-espresso-750 flex items-center justify-between gap-3 text-xs text-espresso-700 dark:text-ivory-300">
        <span className="font-semibold flex items-center gap-1.5">
          <Clock className="w-4 h-4 text-terracotta-600 dark:text-terracotta-400" />
          Pass Stacking Protection:
        </span>
        <span className="text-espresso-500 dark:text-ivory-400 text-right">
          Repurchasing before expiry automatically adds the new pass days onto your existing expiration date.
        </span>
      </div>

      {/* Five Passes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {TRAKIFY_PASS_CATALOGUE.map((pass) => (
          <div
            key={pass.id}
            className={`relative flex flex-col justify-between p-4 rounded-xl border transition ${
              pass.highlighted
                ? 'border-terracotta-400 dark:border-terracotta-500 bg-terracotta-50/30 dark:bg-terracotta-950/20 shadow-xs'
                : 'border-ivory-200 dark:border-espresso-750 bg-ivory-50/50 dark:bg-espresso-900/40'
            }`}
          >
            {pass.badge && (
              <span className="absolute -top-2.5 right-3 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-terracotta-600 text-white shadow-xs">
                {pass.badge}
              </span>
            )}

            <div>
              <h3 className="text-sm font-bold text-espresso-950 dark:text-ivory-50">
                {pass.name}
              </h3>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-2xl font-bold font-mono text-espresso-900 dark:text-ivory-100">
                  {pass.priceInrFormatted}
                </span>
                <span className="text-[11px] text-espresso-400 dark:text-espresso-500 font-mono">
                  one-time
                </span>
              </div>
              <div className="mt-1 flex items-center gap-1 text-[11px] font-medium text-terracotta-700 dark:text-terracotta-400">
                <Clock className="w-3 h-3" />
                <span>{pass.durationLabel}</span>
              </div>
              <p className="text-xs text-espresso-500 dark:text-ivory-400 mt-2.5 leading-relaxed">
                {pass.description}
              </p>
            </div>

            {/* Action Button */}
            <div className="mt-4 pt-3 border-t border-ivory-200 dark:border-espresso-800">
              <button
                onClick={() => handlePurchase(pass.id)}
                disabled={actionLoading !== null}
                className="w-full py-2 px-2.5 rounded-xl text-xs font-semibold text-white bg-terracotta-600 hover:bg-terracotta-700 active:scale-[0.99] transition shadow-subtle flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Zap className="w-3 h-3" />
                <span>
                  {actionLoading === pass.id
                    ? 'Connecting...'
                    : actionLoading === 'verifying'
                    ? 'Verifying...'
                    : hasActive
                    ? `Extend (+${pass.durationDays}d)`
                    : `Get Pass (${pass.priceInrFormatted})`}
                </span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Captured Payment Self-Recovery Section */}
      <div className="mt-4 p-3.5 rounded-xl border border-ivory-300 dark:border-espresso-750 bg-ivory-50/60 dark:bg-espresso-900/30">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <RotateCcw className="w-3.5 h-3.5 text-terracotta-600 dark:text-terracotta-400 shrink-0" />
            <span className="text-xs font-semibold text-espresso-850 dark:text-ivory-100">
              Already paid but pass not showing?
            </span>
            <span className="text-[11px] text-espresso-400 dark:text-espresso-500 hidden sm:inline">
              Recover a captured payment using your Razorpay reference IDs
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowRecovery(!showRecovery)}
            className="text-xs font-medium text-terracotta-600 dark:text-terracotta-400 hover:underline cursor-pointer"
          >
            {showRecovery ? 'Hide' : 'Recover Payment'}
          </button>
        </div>

        {showRecovery && (
          <form onSubmit={handleRecover} className="mt-3 pt-3 border-t border-ivory-200 dark:border-espresso-800 space-y-3">
            <p className="text-xs text-espresso-500 dark:text-ivory-400 leading-relaxed">
              If your payment was deducted but access was not activated due to a connection or server error, enter the Razorpay reference IDs from your payment receipt to verify directly against Razorpay's API and activate your pass immediately. No additional charge will ever occur.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-mono uppercase text-espresso-500 dark:text-ivory-400 mb-1">
                  Razorpay Payment ID
                </label>
                <input
                  type="text"
                  placeholder="pay_..."
                  value={recoveryPaymentId}
                  onChange={(e) => setRecoveryPaymentId(e.target.value)}
                  disabled={recoveryLoading}
                  className="w-full px-3 py-1.5 rounded-lg border border-ivory-300 dark:border-espresso-700 bg-white dark:bg-espresso-800 text-xs font-mono text-espresso-900 dark:text-ivory-100 placeholder:text-espresso-300 dark:placeholder:text-espresso-600 focus:outline-none focus:ring-1 focus:ring-terracotta-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-mono uppercase text-espresso-500 dark:text-ivory-400 mb-1">
                  Razorpay Order ID
                </label>
                <input
                  type="text"
                  placeholder="order_..."
                  value={recoveryOrderId}
                  onChange={(e) => setRecoveryOrderId(e.target.value)}
                  disabled={recoveryLoading}
                  className="w-full px-3 py-1.5 rounded-lg border border-ivory-300 dark:border-espresso-700 bg-white dark:bg-espresso-800 text-xs font-mono text-espresso-900 dark:text-ivory-100 placeholder:text-espresso-300 dark:placeholder:text-espresso-600 focus:outline-none focus:ring-1 focus:ring-terracotta-500"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowRecovery(false)}
                disabled={recoveryLoading}
                className="px-3 py-1.5 rounded-lg text-xs text-espresso-600 dark:text-ivory-300 hover:bg-ivory-200 dark:hover:bg-espresso-800 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={recoveryLoading}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-terracotta-600 hover:bg-terracotta-700 transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shadow-xs"
              >
                {recoveryLoading ? (
                  <>
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    <span>Verifying with Razorpay...</span>
                  </>
                ) : (
                  <>
                    <KeyRound className="w-3 h-3" />
                    <span>Verify & Recover Pass</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Unified Features List */}
      <div className="mt-6 p-4 rounded-xl bg-ivory-50/80 dark:bg-espresso-900/40 border border-ivory-200 dark:border-espresso-750">
        <h4 className="text-xs font-bold uppercase tracking-wider text-espresso-700 dark:text-ivory-200 flex items-center gap-1.5 mb-3">
          <Layers className="w-3.5 h-3.5 text-terracotta-600 dark:text-terracotta-400" />
          Included in All 5 TRAKIFY Passes (Identical Feature Set)
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 text-xs text-espresso-700 dark:text-ivory-300">
          <div className="flex items-center gap-1.5">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>Multi-Device Cloud Sync</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>AI Syllabus & Exam Planner</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>3D Muscle Heatmaps & PRs</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>Full Micronutrient Analytics</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>Create ClassSpace Workspaces</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>Unlimited Radio Playlists</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>Study Streaks & Heatmaps</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>Readiness & Volume Recovery</span>
          </div>
        </div>
      </div>

      {/* Permanent Free Offline Assurance */}
      <div className="mt-5 p-3.5 rounded-xl bg-ivory-100/70 dark:bg-espresso-800/50 border border-ivory-200 dark:border-espresso-750 flex items-start gap-3 text-xs text-espresso-500 dark:text-ivory-400">
        <Shield className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <strong className="text-espresso-800 dark:text-ivory-200 font-semibold">Offline-First Student Guarantee: </strong>
          Attendance tracking, timetable scheduling, syllabus progress, study timers, gym logging, and local browser backups will remain 100% free and functional offline forever. Paid passes power automated multi-device cloud synchronization, ClassSpace workspace hosting, and advanced analytics via one-time Razorpay checkout.
        </p>
      </div>
    </div>
  );
};
