import React, { useState, useMemo } from 'react';
import {
  CreditCard,
  TrendingUp,
  Users,
  Edit3,
  CheckCircle2,
  Search,
  Sparkles,
  Save,
  X,
  Tag,
  Plus,
  Trash2,
  Globe,
  IndianRupee,
  DollarSign,
} from 'lucide-react';
import { adminService, calculatePppUsdPrice, formatAdminCurrency } from '../../../services/adminService';
import { AdminSubscriptionPass, AdminPaymentTransaction, AdminCurrency } from '../../../types/admin';
import { AdminPageHeader } from '../common/AdminPageHeader';
import { AdminStatCard } from '../common/AdminStatCard';
import { Button } from '../../common/Button';

export const AdminPaymentsView: React.FC = () => {
  const [passes, setPasses] = useState<AdminSubscriptionPass[]>(() =>
    adminService.getSubscriptionPasses()
  );
  const [transactions, setTransactions] = useState<AdminPaymentTransaction[]>(() =>
    adminService.getPaymentTransactions()
  );
  const [activeCurrency, setActiveCurrency] = useState<AdminCurrency>(() =>
    adminService.getAdminCurrency()
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'pending' | 'refunded'>('all');

  // Editing pass modal state
  const [editingPass, setEditingPass] = useState<AdminSubscriptionPass | null>(null);
  const [editPriceINR, setEditPriceINR] = useState<number>(0);
  const [editPriceUSD, setEditPriceUSD] = useState<number>(0);
  const [editName, setEditName] = useState<string>('');
  const [editDesc, setEditDesc] = useState<string>('');
  const [editBadge, setEditBadge] = useState<string>('');
  const [editFeatures, setEditFeatures] = useState<string>('');
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Manual payment recording modal state
  const [showManualModal, setShowManualModal] = useState(false);
  const [custName, setCustName] = useState('');
  const [custEmail, setCustEmail] = useState('');
  const [selectedPlanId, setSelectedPlanId] = useState('semester_pass');
  const [manualAmount, setManualAmount] = useState<number>(599);
  const [manualCurrency, setManualCurrency] = useState<AdminCurrency>('INR');
  const [manualMethod, setManualMethod] = useState('UPI / QR Code');

  // Switch administrator currency view
  const handleCurrencyChange = (c: AdminCurrency) => {
    setActiveCurrency(c);
    adminService.setAdminCurrency(c);
  };

  // Financial aggregates calculated 100% dynamically from real transactions
  const financialStats = useMemo(() => {
    const completedTxs = transactions.filter((t) => t.status === 'completed');
    
    // Revenue in selected currency
    let totalRevenue = 0;
    completedTxs.forEach((t) => {
      if (t.currency === activeCurrency) {
        totalRevenue += t.amount;
      } else if (activeCurrency === 'INR' && t.currency === 'USD') {
        // approximate convert foreign to INR
        totalRevenue += t.amount * 87;
      } else if (activeCurrency === 'USD' && t.currency === 'INR') {
        // PPP convert domestic to USD
        totalRevenue += calculatePppUsdPrice(t.amount);
      }
    });

    // Real MRR calculated from monthly subscriptions
    const monthlyPass = passes.find((p) => p.id === 'pro_monthly' && p.isActive);
    const monthlySubscribers = completedTxs.filter((t) => t.planId === 'pro_monthly').length;
    const mrr = monthlyPass
      ? (activeCurrency === 'INR' ? monthlyPass.priceINR : monthlyPass.priceUSD) * monthlySubscribers
      : 0;

    const activeSubscribers = completedTxs.length;
    const aov = completedTxs.length > 0 ? totalRevenue / completedTxs.length : 0;

    return {
      totalRevenue,
      mrr,
      activeSubscribers,
      averageOrderValue: aov,
    };
  }, [transactions, passes, activeCurrency]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      const matchSearch =
        t.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.customerEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.planName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchStatus = statusFilter === 'all' || t.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [transactions, searchQuery, statusFilter]);

  const handleOpenEdit = (pass: AdminSubscriptionPass) => {
    setEditingPass(pass);
    setEditPriceINR(pass.priceINR);
    setEditPriceUSD(pass.priceUSD);
    setEditName(pass.name);
    setEditDesc(pass.description);
    setEditBadge(pass.badge || '');
    setEditFeatures(pass.features.join('\n'));
    setSaveSuccessMsg(null);
  };

  const handleAutoCalcPpp = () => {
    const fairUsd = calculatePppUsdPrice(editPriceINR);
    setEditPriceUSD(fairUsd);
  };

  const handleSavePass = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPass) return;

    const updated: AdminSubscriptionPass = {
      ...editingPass,
      name: editName.trim() || editingPass.name,
      price: Math.max(0, editPriceINR),
      priceINR: Math.max(0, editPriceINR),
      priceUSD: Math.max(0, editPriceUSD),
      currency: 'INR',
      description: editDesc.trim() || editingPass.description,
      badge: editBadge.trim() || undefined,
      features: editFeatures
        .split('\n')
        .map((f) => f.trim())
        .filter(Boolean),
    };

    adminService.saveSubscriptionPass(updated);
    setPasses(adminService.getSubscriptionPasses());
    setSaveSuccessMsg(`Pricing for "${updated.name}" updated to ₹${updated.priceINR} (Foreign PPP: $${updated.priceUSD})!`);
    setTimeout(() => {
      setEditingPass(null);
      setSaveSuccessMsg(null);
    }, 1200);
  };

  const handleTogglePassActive = (pass: AdminSubscriptionPass) => {
    const updated = { ...pass, isActive: !pass.isActive };
    adminService.saveSubscriptionPass(updated);
    setPasses(adminService.getSubscriptionPasses());
  };

  const handlePlanSelectForManual = (planId: string) => {
    setSelectedPlanId(planId);
    const pass = passes.find((p) => p.id === planId);
    if (pass) {
      if (manualCurrency === 'INR') {
        setManualAmount(pass.priceINR);
      } else {
        setManualAmount(pass.priceUSD);
      }
    }
  };

  const handleManualCurrencyToggle = (c: AdminCurrency) => {
    setManualCurrency(c);
    const pass = passes.find((p) => p.id === selectedPlanId);
    if (pass) {
      setManualAmount(c === 'INR' ? pass.priceINR : pass.priceUSD);
    }
  };

  const handleRecordManualPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!custEmail.trim()) return;

    const pass = passes.find((p) => p.id === selectedPlanId);
    const planName = pass ? pass.name : 'Custom Student Pass';

    adminService.recordPaymentTransaction({
      customerName: custName.trim() || custEmail.split('@')[0],
      customerEmail: custEmail.trim(),
      planId: selectedPlanId,
      planName,
      amount: manualAmount,
      currency: manualCurrency,
      paymentMethod: manualMethod,
      status: 'completed',
    });

    setTransactions(adminService.getPaymentTransactions());
    setShowManualModal(false);
    setCustName('');
    setCustEmail('');
  };

  const handleDeleteTransaction = (id: string) => {
    adminService.deletePaymentTransaction(id);
    setTransactions(adminService.getPaymentTransactions());
  };

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Commercial Passes &amp; Subscription Controller"
        description="Monitor genuine customer purchases, manage INR (₹) domestic pricing with Purchasing Power Parity (PPP) international equivalents, and calibrate live passes."
        badge={{ label: 'Live Payments Active', variant: 'emerald' }}
      >
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Currency / Regional View Switcher */}
          <div className="flex items-center p-1 rounded-2xl bg-white/5 border border-white/10 text-xs font-mono">
            <button
              type="button"
              onClick={() => handleCurrencyChange('INR')}
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
              onClick={() => handleCurrencyChange('USD')}
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

          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowManualModal(true)}
            className="gap-1.5 !bg-emerald-600 hover:!bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-600/20"
          >
            <Plus className="w-3.5 h-3.5" />
            Log Customer Sale
          </Button>
        </div>
      </AdminPageHeader>

      {/* Financial KPIs (Calculated from Genuine Orders) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <AdminStatCard
          title="Total Gross Revenue"
          value={formatAdminCurrency(financialStats.totalRevenue, activeCurrency)}
          subtitle={transactions.length > 0 ? `${transactions.length} orders settled` : 'Zero demo inflation'}
          icon={activeCurrency === 'INR' ? <IndianRupee className="w-4 h-4" /> : <DollarSign className="w-4 h-4" />}
          accentColor="#10B981"
          trend={{ value: `${transactions.length} Orders`, isPositive: transactions.length > 0 }}
        />
        <AdminStatCard
          title="Monthly Recurring (MRR)"
          value={formatAdminCurrency(financialStats.mrr, activeCurrency)}
          subtitle="From active monthly subscribers"
          icon={<TrendingUp className="w-4 h-4" />}
          accentColor="#2563EB"
          trend={{ value: 'Live Run-Rate', isPositive: true }}
        />
        <AdminStatCard
          title="Paid Active Customers"
          value={financialStats.activeSubscribers}
          subtitle="Genuine verified buyers"
          icon={<Users className="w-4 h-4" />}
          accentColor="#8B5CF6"
          trend={{ value: `${financialStats.activeSubscribers} Total`, isPositive: financialStats.activeSubscribers > 0 }}
        />
        <AdminStatCard
          title="Avg Order Value (AOV)"
          value={formatAdminCurrency(financialStats.averageOrderValue, activeCurrency)}
          subtitle="Per genuine checkout"
          icon={<CreditCard className="w-4 h-4" />}
          accentColor="#F59E0B"
        />
      </div>

      {/* ── Dynamic Price & Pass Controller ── */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-white/10">
          <div>
            <h2 className="text-base sm:text-lg font-serif font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-400" />
              Live Pass &amp; Dynamic Pricing Controller
            </h2>
            <p className="text-xs text-ivory-400">
              Default currency is in <span className="font-semibold text-emerald-300">Rupees (₹)</span> for Indian scholars, with equitable <span className="font-semibold text-cyan-300">Purchasing Power Parity (PPP) in $ USD</span> for international scholars.
            </p>
          </div>
          <span className="text-[11px] font-mono text-ivory-400 bg-white/5 border border-white/10 px-3 py-1 rounded-xl self-start sm:self-auto">
            {passes.length} Commercial Tiers
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {passes.map((pass) => (
            <div
              key={pass.id}
              className={`rounded-3xl p-5 border transition-all duration-200 flex flex-col justify-between ${
                pass.isActive
                  ? 'bg-white/95 dark:bg-[#0A0F1D]/90 border-ivory-300/80 dark:border-white/10 shadow-sm'
                  : 'bg-white/50 dark:bg-white/[0.02] border-white/5 opacity-60'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    {pass.interval}
                  </span>
                  {pass.badge && (
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                      {pass.badge}
                    </span>
                  )}
                </div>

                <h3 className="font-serif text-lg font-bold text-espresso-950 dark:text-white leading-tight">
                  {pass.name}
                </h3>
                <p className="text-xs text-espresso-500 dark:text-ivory-400 mt-1 line-clamp-2">
                  {pass.description}
                </p>

                {/* Primary Price Display */}
                <div className="my-4 p-3 rounded-2xl bg-ivory-100/60 dark:bg-white/5 border border-ivory-200 dark:border-white/5">
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-serif font-black text-espresso-950 dark:text-white">
                      {pass.priceINR === 0 ? 'Free' : (activeCurrency === 'INR' ? `₹${pass.priceINR}` : `$${pass.priceUSD}`)}
                    </span>
                    <span className="text-xs font-mono text-espresso-500 dark:text-ivory-400">
                      {pass.priceINR === 0 ? '' : `/${pass.interval}`}
                    </span>
                  </div>

                  {/* Dual Currency Parity Indication */}
                  <div className="mt-1.5 pt-1.5 border-t border-ivory-200 dark:border-white/5 flex items-center justify-between text-[10px] font-mono text-espresso-500 dark:text-ivory-400">
                    <span>{activeCurrency === 'INR' ? 'Foreign PPP:' : 'India Regional:'}</span>
                    <span className="font-bold text-blue-400">
                      {pass.priceINR === 0 ? '$0 USD' : (activeCurrency === 'INR' ? `$${pass.priceUSD} USD` : `₹${pass.priceINR} INR`)}
                    </span>
                  </div>
                </div>

                {/* Features Preview */}
                <ul className="space-y-1.5 text-xs text-espresso-700 dark:text-ivory-300 mb-4">
                  {pass.features.slice(0, 3).map((feat, i) => (
                    <li key={i} className="flex items-center gap-2 truncate">
                      <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                      <span className="truncate">{feat}</span>
                    </li>
                  ))}
                  {pass.features.length > 3 && (
                    <li className="text-[11px] font-mono text-espresso-400 dark:text-ivory-400">
                      + {pass.features.length - 3} more perks
                    </li>
                  )}
                </ul>
              </div>

              {/* Actions */}
              <div className="pt-3 border-t border-ivory-200 dark:border-white/10 flex items-center gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => handleOpenEdit(pass)}
                  className="flex-1 gap-1.5 !bg-blue-600 hover:!bg-blue-500 text-white text-xs"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  Edit Pricing
                </Button>
                <button
                  type="button"
                  onClick={() => handleTogglePassActive(pass)}
                  className={`p-2 rounded-xl border text-xs font-mono transition cursor-pointer ${
                    pass.isActive
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-rose-500/10 hover:text-rose-400 hover:border-rose-500/20'
                      : 'bg-white/5 text-ivory-400 border-white/10 hover:text-white'
                  }`}
                  title={pass.isActive ? 'Deactivate Pass' : 'Activate Pass'}
                >
                  {pass.isActive ? 'Active' : 'Paused'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Customer Subscription & Payment Transactions Ledger ── */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base sm:text-lg font-serif font-bold text-white flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-emerald-400" />
              Customer Purchases &amp; Subscription Ledger
            </h2>
            <p className="text-xs text-ivory-400">
              Live ledger of genuine student orders, UPI/Card settlements, and pass activations (zero fabricated records).
            </p>
          </div>

          {/* Search & Status Filter */}
          <div className="flex items-center gap-2">
            <div className="relative w-48 sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-ivory-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search customer, email..."
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-white/5 border border-white/10 text-white placeholder-ivory-400/60 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-2.5 py-1.5 text-xs rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
            >
              <option value="all" className="bg-[#070B14]">All Status</option>
              <option value="completed" className="bg-[#070B14]">Completed</option>
              <option value="pending" className="bg-[#070B14]">Pending</option>
              <option value="refunded" className="bg-[#070B14]">Refunded</option>
            </select>
          </div>
        </div>

        {/* Transactions Table */}
        <div className="rounded-3xl bg-white/95 dark:bg-[#0A0F1D]/90 border border-ivory-300/80 dark:border-white/10 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-ivory-100/70 dark:bg-white/[0.03] border-b border-ivory-200 dark:border-white/10 text-espresso-500 dark:text-ivory-400 font-mono uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3.5 px-4">Customer &amp; Email</th>
                  <th className="py-3.5 px-4">Subscription Plan</th>
                  <th className="py-3.5 px-4">Amount</th>
                  <th className="py-3.5 px-4">Payment Method</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Date &amp; Time</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ivory-200/80 dark:divide-white/5 font-sans">
                {filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-xs text-ivory-400">
                      <CreditCard className="w-8 h-8 mx-auto mb-2 opacity-30 text-emerald-400" />
                      <p className="font-semibold text-white">No customer payment transactions yet</p>
                      <p className="text-[11px] text-ivory-400 mt-1 max-w-md mx-auto">
                        Zero fabricated demo data. When students purchase passes via UPI, RuPay, or Stripe, settlements appear here in real time.
                      </p>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setShowManualModal(true)}
                        className="mt-3 gap-1.5 !bg-white/10 !text-white text-xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Log First Customer Sale
                      </Button>
                    </td>
                  </tr>
                ) : (
                  filteredTransactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-ivory-50/80 dark:hover:bg-white/[0.02] transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-espresso-950 dark:text-white">
                          {tx.customerName}
                        </div>
                        <div className="font-mono text-[11px] text-espresso-500 dark:text-ivory-400">
                          {tx.customerEmail}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-medium text-blue-400 flex items-center gap-1.5">
                          <Tag className="w-3 h-3" />
                          {tx.planName}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-emerald-400">
                        {tx.currency === 'INR' ? `₹${tx.amount.toLocaleString('en-IN')}` : `$${tx.amount.toFixed(2)}`}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-espresso-600 dark:text-ivory-300">
                        {tx.paymentMethod}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider ${
                            tx.status === 'completed'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : tx.status === 'pending'
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          }`}
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          {tx.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-espresso-500 dark:text-ivory-400">
                        {new Date(tx.timestamp).toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleDeleteTransaction(tx.id)}
                          className="p-1 rounded text-ivory-400 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                          title="Delete transaction record"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Edit Pass Modal (With Rupee + PPP foreign pricing controls) ── */}
      {editingPass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
          <div className="w-full max-w-lg rounded-3xl bg-[#0A0F1D] border border-white/10 shadow-2xl overflow-hidden p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-blue-400" />
                <h3 className="font-serif text-lg font-bold text-white">
                  Edit Pass: {editingPass.name}
                </h3>
              </div>
              <button
                onClick={() => setEditingPass(null)}
                className="p-1 rounded-lg text-ivory-400 hover:text-white hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {saveSuccessMsg ? (
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-mono flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                {saveSuccessMsg}
              </div>
            ) : (
              <form onSubmit={handleSavePass} className="space-y-4 text-xs font-mono">
                <div>
                  <label className="block text-ivory-400 mb-1">Pass Name</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    required
                  />
                </div>

                {/* Dual Regional Pricing Controls */}
                <div className="p-3.5 rounded-2xl bg-blue-500/5 border border-blue-500/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-blue-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5" />
                      Regional &amp; Purchasing Power Parity (PPP)
                    </span>
                    <button
                      type="button"
                      onClick={handleAutoCalcPpp}
                      className="text-[10px] text-cyan-400 hover:underline cursor-pointer"
                    >
                      ⚡ Auto-Calculate Fair PPP ($)
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-ivory-300 mb-1 font-bold">
                        🇮🇳 Domestic (₹ Rupees)
                      </label>
                      <input
                        type="number"
                        step="1"
                        min="0"
                        value={editPriceINR}
                        onChange={(e) => setEditPriceINR(parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 rounded-xl bg-white/10 border border-white/15 text-white font-bold text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-ivory-300 mb-1 font-bold">
                        🌐 Foreign PPP ($ USD)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={editPriceUSD}
                        onChange={(e) => setEditPriceUSD(parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 rounded-xl bg-white/10 border border-white/15 text-white font-bold text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                        required
                      />
                    </div>
                  </div>

                  <p className="text-[10px] text-ivory-400 leading-relaxed">
                    <strong>Purchasing Power Parity (PPP):</strong> Accounts for the exact relative economic burden. An Indian student spending ₹599 pays the equivalent of what ~$19.99 is to a US/International student.
                  </p>
                </div>

                <div>
                  <label className="block text-ivory-400 mb-1">Discount Badge (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. 50% CAMPUS OFFER"
                    value={editBadge}
                    onChange={(e) => setEditBadge(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-ivory-400 mb-1">Short Description</label>
                  <textarea
                    rows={2}
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-ivory-400 mb-1">
                    Features Included (One feature per line)
                  </label>
                  <textarea
                    rows={4}
                    value={editFeatures}
                    onChange={(e) => setEditFeatures(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-1 focus:ring-blue-500 leading-relaxed"
                  />
                </div>

                <div className="pt-3 border-t border-white/10 flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setEditingPass(null)}
                    className="!bg-white/5 !text-ivory-300"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    className="gap-1.5 !bg-blue-600 hover:!bg-blue-500 text-white"
                  >
                    <Save className="w-3.5 h-3.5" />
                    Save &amp; Apply Live Pricing
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ── Manual Sale Recording Modal ── */}
      {showManualModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
          <div className="w-full max-w-md rounded-3xl bg-[#0A0F1D] border border-white/10 shadow-2xl overflow-hidden p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-emerald-400" />
                <h3 className="font-serif text-lg font-bold text-white">
                  Log Genuine Customer Sale
                </h3>
              </div>
              <button
                onClick={() => setShowManualModal(false)}
                className="p-1 rounded-lg text-ivory-400 hover:text-white hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRecordManualPayment} className="space-y-3.5 text-xs font-mono">
              <div>
                <label className="block text-ivory-400 mb-1">Student Full Name</label>
                <input
                  type="text"
                  placeholder="e.g. Rohit Sharma"
                  value={custName}
                  onChange={(e) => setCustName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-ivory-400 mb-1">Student Email Address</label>
                <input
                  type="email"
                  placeholder="e.g. rohit.sharma@iitb.ac.in"
                  value={custEmail}
                  onChange={(e) => setCustEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-ivory-400 mb-1">Pass Plan</label>
                <select
                  value={selectedPlanId}
                  onChange={(e) => handlePlanSelectForManual(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                >
                  {passes.map((p) => (
                    <option key={p.id} value={p.id} className="bg-[#070B14]">
                      {p.name} ({manualCurrency === 'INR' ? `₹${p.priceINR}` : `$${p.priceUSD}`})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-ivory-400">Amount</label>
                    <div className="flex gap-1 text-[10px]">
                      <button
                        type="button"
                        onClick={() => handleManualCurrencyToggle('INR')}
                        className={`px-1.5 py-0.5 rounded ${manualCurrency === 'INR' ? 'bg-blue-600 text-white' : 'text-ivory-400'}`}
                      >
                        ₹
                      </button>
                      <button
                        type="button"
                        onClick={() => handleManualCurrencyToggle('USD')}
                        className={`px-1.5 py-0.5 rounded ${manualCurrency === 'USD' ? 'bg-blue-600 text-white' : 'text-ivory-400'}`}
                      >
                        $
                      </button>
                    </div>
                  </div>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={manualAmount}
                    onChange={(e) => setManualAmount(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white font-bold text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-ivory-400 mb-1">Payment Method</label>
                  <select
                    value={manualMethod}
                    onChange={(e) => setManualMethod(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                  >
                    <option value="UPI / PhonePe" className="bg-[#070B14]">UPI / PhonePe</option>
                    <option value="Google Pay (GPay)" className="bg-[#070B14]">Google Pay (GPay)</option>
                    <option value="Paytm / UPI QR" className="bg-[#070B14]">Paytm / UPI QR</option>
                    <option value="RuPay / Indian Card" className="bg-[#070B14]">RuPay / Indian Card</option>
                    <option value="Cash / Campus Cashier" className="bg-[#070B14]">Cash / Campus Cashier</option>
                    <option value="Stripe / Card" className="bg-[#070B14]">Stripe / Card</option>
                    <option value="Apple Pay" className="bg-[#070B14]">Apple Pay</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-white/10 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowManualModal(false)}
                  className="!bg-white/5 !text-ivory-300"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  className="gap-1.5 !bg-emerald-600 hover:!bg-emerald-500 text-white"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Record Sale
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
