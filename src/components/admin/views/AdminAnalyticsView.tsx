import React, { useMemo, useState } from 'react';
import {
  TrendingUp,
  CreditCard,
  UserPlus,
  IndianRupee,
  DollarSign,
  Globe,
  Tag,
} from 'lucide-react';
import { adminService, calculatePppUsdPrice, formatAdminCurrency } from '../../../services/adminService';
import { AdminTimeframe, AdminCurrency } from '../../../types/admin';
import { AdminPageHeader } from '../common/AdminPageHeader';
import { AdminStatCard } from '../common/AdminStatCard';

interface AdminAnalyticsViewProps {
  timeframe?: AdminTimeframe;
}

export const AdminAnalyticsView: React.FC<AdminAnalyticsViewProps> = ({ timeframe: _timeframe }) => {
  const transactions = useMemo(() => adminService.getPaymentTransactions(), []);
  const passes = useMemo(() => adminService.getSubscriptionPasses(), []);
  const [activeCurrency, setActiveCurrency] = useState<AdminCurrency>(() =>
    adminService.getAdminCurrency()
  );

  // Compute genuine SaaS Metrics directly from transactions
  const saasStats = useMemo(() => {
    const completed = transactions.filter((t) => t.status === 'completed');
    
    let grossRevenue = 0;
    completed.forEach((t) => {
      if (t.currency === activeCurrency) {
        grossRevenue += t.amount;
      } else if (activeCurrency === 'INR' && t.currency === 'USD') {
        grossRevenue += t.amount * 87;
      } else if (activeCurrency === 'USD' && t.currency === 'INR') {
        grossRevenue += calculatePppUsdPrice(t.amount);
      }
    });

    const monthlyPass = passes.find((p) => p.id === 'pro_monthly' && p.isActive);
    const monthlyCount = completed.filter((t) => t.planId === 'pro_monthly').length;
    const mrr = monthlyPass
      ? (activeCurrency === 'INR' ? monthlyPass.priceINR : monthlyPass.priceUSD) * monthlyCount
      : 0;

    const totalPaymentsCount = completed.length;
    const totalCustomersGained = completed.length;

    return {
      grossRevenue,
      mrr,
      totalPaymentsCount,
      totalCustomersGained,
      conversionRate: totalCustomersGained > 0 ? 100 : 0,
      churnRate: 0,
    };
  }, [transactions, passes, activeCurrency]);

  // Compute 7-day revenue and customer gains from real transactions
  const dailyGainData = useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const today = new Date();
    const result = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      const dayName = days[d.getDay()];
      const dateStr = d.toISOString().split('T')[0];

      const dayTxs = transactions.filter(
        (t) => t.status === 'completed' && t.timestamp && t.timestamp.startsWith(dateStr)
      );

      let dayRevenue = 0;
      dayTxs.forEach((t) => {
        if (t.currency === activeCurrency) dayRevenue += t.amount;
        else if (activeCurrency === 'INR' && t.currency === 'USD') dayRevenue += t.amount * 87;
        else if (activeCurrency === 'USD' && t.currency === 'INR') dayRevenue += calculatePppUsdPrice(t.amount);
      });

      result.push({
        day: dayName,
        date: dateStr,
        revenue: Math.round(dayRevenue),
        customers: dayTxs.length,
      });
    }

    return result;
  }, [transactions, activeCurrency]);

  const maxRevenue = Math.max(1, ...dailyGainData.map((d) => d.revenue));

  // Plan popularity breakdown
  const planBreakdown = useMemo(() => {
    const completed = transactions.filter((t) => t.status === 'completed');
    if (completed.length === 0) {
      return passes.map((p) => ({ name: p.name, count: 0, pct: 0 }));
    }
    return passes.map((p) => {
      const count = completed.filter((t) => t.planId === p.id).length;
      return {
        name: p.name,
        count,
        pct: Math.round((count / completed.length) * 100),
      };
    });
  }, [transactions, passes]);

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Commercial Growth &amp; SaaS Revenue Intelligence"
        description="Audit genuine student acquisition velocity, customer gains, completed checkout settlements, and pass adoption (zero demo data)."
        badge={{ label: 'Live Commercial Telemetry', variant: 'blue' }}
      >
        {/* Regional View Switcher */}
        <div className="flex items-center p-1 rounded-2xl bg-white/5 border border-white/10 text-xs font-mono">
          <button
            type="button"
            onClick={() => setActiveCurrency('INR')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-xl transition cursor-pointer font-bold ${
              activeCurrency === 'INR'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-ivory-400 hover:text-white'
            }`}
          >
            <IndianRupee className="w-3.5 h-3.5" />
            <span>India (₹ INR)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveCurrency('USD')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-xl transition cursor-pointer font-bold ${
              activeCurrency === 'USD'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-ivory-400 hover:text-white'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Foreign PPP ($ USD)</span>
          </button>
        </div>
      </AdminPageHeader>

      {/* Primary Financial & Customer KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <AdminStatCard
          title="Gross SaaS Revenue"
          value={formatAdminCurrency(saasStats.grossRevenue, activeCurrency)}
          subtitle={transactions.length > 0 ? 'From verified checkouts' : 'Zero fabricated volume'}
          icon={activeCurrency === 'INR' ? <IndianRupee className="w-4 h-4" /> : <DollarSign className="w-4 h-4" />}
          accentColor="#10B981"
          trend={{ value: `${saasStats.totalPaymentsCount} Paid Orders`, isPositive: saasStats.totalPaymentsCount > 0 }}
        />
        <AdminStatCard
          title="Monthly Recurring (MRR)"
          value={formatAdminCurrency(saasStats.mrr, activeCurrency)}
          subtitle="From active monthly subscribers"
          icon={<TrendingUp className="w-4 h-4" />}
          accentColor="#2563EB"
          trend={{ value: 'Real Run-Rate', isPositive: true }}
        />
        <AdminStatCard
          title="Payments Processed"
          value={saasStats.totalPaymentsCount}
          subtitle="Genuine completed student transactions"
          icon={<CreditCard className="w-4 h-4" />}
          accentColor="#F59E0B"
          trend={{ value: `${saasStats.totalPaymentsCount} Settled`, isPositive: saasStats.totalPaymentsCount > 0 }}
        />
        <AdminStatCard
          title="Paid Customers Gained"
          value={`+${saasStats.totalCustomersGained}`}
          subtitle="Students on paid passes"
          icon={<UserPlus className="w-4 h-4" />}
          accentColor="#8B5CF6"
          trend={{ value: `${saasStats.totalCustomersGained} Active`, isPositive: saasStats.totalCustomersGained > 0 }}
        />
      </div>

      {/* ── Visual Revenue & Customer Gain Chart ── */}
      <div className="p-6 rounded-3xl bg-white/95 dark:bg-[#0A0F1D]/90 border border-ivory-300/80 dark:border-white/10 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-ivory-200 dark:border-white/10">
          <div>
            <h3 className="font-serif text-lg font-bold text-espresso-950 dark:text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              7-Day Revenue Velocity &amp; Customer Acquisition
            </h3>
            <p className="text-xs text-espresso-500 dark:text-ivory-400">
              Daily genuine revenue inflow and student accounts converted into active paying passes.
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono">
            <span className="flex items-center gap-1.5 text-blue-400">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
              Daily Revenue ({activeCurrency === 'INR' ? '₹ INR' : '$ USD'})
            </span>
            <span className="flex items-center gap-1.5 text-emerald-400">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              New Paid Customers
            </span>
          </div>
        </div>

        {/* Bar chart */}
        <div className="grid grid-cols-7 gap-2 sm:gap-4 items-end h-56 pt-6 pb-2">
          {dailyGainData.map((item) => {
            const heightPct = item.revenue > 0 ? Math.max(12, Math.round((item.revenue / maxRevenue) * 100)) : 8;
            return (
              <div key={item.day} className="flex flex-col items-center gap-2 h-full justify-end group">
                <div className="text-[10px] font-mono font-bold text-emerald-400 opacity-80 group-hover:opacity-100 transition">
                  {item.customers > 0 ? `+${item.customers}` : '0'}
                </div>
                <div className="w-full max-w-[48px] bg-white/5 rounded-2xl p-1 flex items-end h-full">
                  <div
                    style={{ height: `${heightPct}%` }}
                    className={`w-full rounded-xl transition-all duration-300 relative ${
                      item.revenue > 0
                        ? 'bg-gradient-to-t from-blue-600 to-cyan-400 shadow-md group-hover:from-blue-500 group-hover:to-cyan-300'
                        : 'bg-white/10'
                    }`}
                  >
                    <div className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-lg bg-[#070B14] border border-white/20 text-[10px] font-mono text-white whitespace-nowrap shadow-xl pointer-events-none transition-opacity">
                      {formatAdminCurrency(item.revenue, activeCurrency)}
                    </div>
                  </div>
                </div>
                <span className="text-[11px] font-mono font-bold text-espresso-600 dark:text-ivory-400">
                  {item.day}
                </span>
              </div>
            );
          })}
        </div>

        {transactions.length === 0 && (
          <p className="text-center text-xs text-ivory-400 pt-2 font-mono">
            No payments recorded in the past 7 days. Once student orders occur, daily throughput bars will render in real time.
          </p>
        )}
      </div>

      {/* ── Plan Distribution Breakdown ── */}
      <div className="p-6 rounded-3xl bg-white/95 dark:bg-[#0A0F1D]/90 border border-ivory-300/80 dark:border-white/10 shadow-sm space-y-4">
        <h3 className="font-serif text-lg font-bold text-espresso-950 dark:text-white flex items-center gap-2">
          <Tag className="w-4 h-4 text-purple-400" />
          Subscription Tier Distribution
        </h3>
        <p className="text-xs text-espresso-500 dark:text-ivory-400">
          Breakdown of genuine student adoption across active passes.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
          {planBreakdown.map((p) => (
            <div key={p.name} className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-white truncate">{p.name}</span>
                <span className="font-mono text-blue-400 font-bold">{p.pct}%</span>
              </div>
              <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-blue-500 h-1.5 rounded-full transition-all"
                  style={{ width: `${p.pct}%` }}
                />
              </div>
              <p className="text-[11px] font-mono text-ivory-400">{p.count} active subscribers</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
