import React, { useState } from 'react';
import {
  Key,
  Tag,
  Copy,
  Check,
  Sparkles,
  Building,
  CheckCircle2,
  X,
} from 'lucide-react';
import { adminService } from '../../../services/adminService';
import { AdminLicenseKey, AdminPromoCoupon } from '../../../types/admin';
import { AdminPageHeader } from '../common/AdminPageHeader';
import { AdminStatCard } from '../common/AdminStatCard';
import { Button } from '../../common/Button';

export const AdminLicensesView: React.FC = () => {
  const [keys, setKeys] = useState<AdminLicenseKey[]>(() => adminService.getLicenseKeys());
  const [coupons, setCoupons] = useState<AdminPromoCoupon[]>(() => adminService.getPromoCoupons());
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);

  // New Key Modal
  const [showNewKeyModal, setShowNewKeyModal] = useState(false);
  const [keyTier, setKeyTier] = useState<'pro' | 'semester' | 'cohort' | 'lifetime'>('semester');
  const [keyInstitution, setKeyInstitution] = useState('');
  const [keySeats, setKeySeats] = useState<number>(30);

  // New Coupon Modal
  const [showNewCouponModal, setShowNewCouponModal] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [couponDiscount, setCouponDiscount] = useState<number>(30);
  const [couponMaxUses, setCouponMaxUses] = useState<number>(100);

  const [feedback, setFeedback] = useState<string | null>(null);

  const handleCopyKey = (key: AdminLicenseKey) => {
    navigator.clipboard.writeText(key.key);
    setCopiedKeyId(key.id);
    setTimeout(() => setCopiedKeyId(null), 2000);
  };

  const handleGenerateKey = (e: React.FormEvent) => {
    e.preventDefault();
    const created = adminService.generateLicenseKey(keyTier, keyInstitution, keySeats);
    setKeys(adminService.getLicenseKeys());
    setShowNewKeyModal(false);
    setKeyInstitution('');
    setFeedback(`Generated license key "${created.key}" for ${created.institution}!`);
    setTimeout(() => setFeedback(null), 3000);
  };

  const handleCreateCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponCode.trim()) return;
    const created = adminService.createPromoCoupon(couponCode, couponDiscount, couponMaxUses);
    setCoupons(adminService.getPromoCoupons());
    setShowNewCouponModal(false);
    setCouponCode('');
    setFeedback(`Promo coupon "${created.code}" created with ${created.discountPercent}% discount!`);
    setTimeout(() => setFeedback(null), 3000);
  };

  const handleRevokeKey = (key: AdminLicenseKey) => {
    adminService.revokeLicenseKey(key.id);
    setKeys(adminService.getLicenseKeys());
    setFeedback(`Revoked license key "${key.key}"`);
    setTimeout(() => setFeedback(null), 3000);
  };

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Commercial Product Tools &amp; License Manager"
        description="Sell TRAKIFY to campus batches, coaching institutes, and individual scholars. Generate offline activation keys and promotional discount vouchers."
        badge={{ label: 'Product Seller Tools Active', variant: 'emerald' }}
      >
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowNewCouponModal(true)}
            className="gap-1.5 !bg-white/5 !text-white text-xs"
          >
            <Tag className="w-3.5 h-3.5 text-amber-400" />
            Create Promo Coupon
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowNewKeyModal(true)}
            className="gap-1.5 !bg-blue-600 hover:!bg-blue-500 text-white text-xs font-semibold"
          >
            <Key className="w-3.5 h-3.5" />
            Issue License Key
          </Button>
        </div>
      </AdminPageHeader>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <AdminStatCard
          title="Issued License Keys"
          value={keys.length}
          subtitle="Batch student passes"
          icon={<Key className="w-4 h-4" />}
          accentColor="#2563EB"
        />
        <AdminStatCard
          title="Active Promo Codes"
          value={coupons.filter((c) => c.active).length}
          subtitle="Discount campaign vouchers"
          icon={<Tag className="w-4 h-4" />}
          accentColor="#F59E0B"
        />
        <AdminStatCard
          title="Campus Seats Deployed"
          value={keys.reduce((sum, k) => sum + k.usedCount, 0)}
          subtitle="Scholars activated via keys"
          icon={<Building className="w-4 h-4" />}
          accentColor="#10B981"
        />
        <AdminStatCard
          title="Store Licensing System"
          value="Ready to Sell"
          subtitle="B2B &amp; B2C Ready"
          icon={<Sparkles className="w-4 h-4" />}
          accentColor="#8B5CF6"
        />
      </div>

      {feedback && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-mono flex items-center justify-between animate-in fade-in">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            {feedback}
          </span>
          <button onClick={() => setFeedback(null)} className="font-bold underline ml-2 cursor-pointer">
            Dismiss
          </button>
        </div>
      )}

      {/* ── Section 1: Offline Campus Batch License Keys ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-white/10">
          <div>
            <h2 className="text-base sm:text-lg font-serif font-bold text-white flex items-center gap-2">
              <Key className="w-4 h-4 text-blue-400" />
              Institutional &amp; Batch License Keys
            </h2>
            <p className="text-xs text-ivory-400">
              Generate commercial redemption codes to sell to university classes, coaching batches, or bulk campus groups.
            </p>
          </div>
        </div>

        <div className="rounded-3xl bg-white/95 dark:bg-[#0A0F1D]/90 border border-ivory-300/80 dark:border-white/10 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-ivory-100/70 dark:bg-white/[0.03] border-b border-ivory-200 dark:border-white/10 text-espresso-500 dark:text-ivory-400 font-mono uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3.5 px-4">License Redemption Key</th>
                  <th className="py-3.5 px-4">Tier Pass</th>
                  <th className="py-3.5 px-4">Target Campus / Organization</th>
                  <th className="py-3.5 px-4">Seat Utilization</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ivory-200/80 dark:divide-white/5 font-sans">
                {keys.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-xs text-ivory-400">
                      <Key className="w-8 h-8 mx-auto mb-2 opacity-30 text-blue-400" />
                      <p className="font-semibold text-white">No license keys issued yet</p>
                      <p className="text-[11px] text-ivory-400 mt-1 max-w-sm mx-auto">
                        Zero fabricated demo data. Click "Issue License Key" to generate your first campus license for institutional or offline sales.
                      </p>
                    </td>
                  </tr>
                ) : (
                  keys.map((k) => (
                    <tr key={k.id} className="hover:bg-ivory-50/80 dark:hover:bg-white/[0.02] transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-espresso-950 dark:text-white select-all">
                            {k.key}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopyKey(k)}
                            className="p-1 rounded text-ivory-400 hover:text-white transition"
                            title="Copy Key to Clipboard"
                          >
                            {copiedKeyId === k.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-mono uppercase font-bold text-blue-400 text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20">
                          {k.tier}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-espresso-700 dark:text-ivory-200">
                        {k.institution || 'Individual Student'}
                      </td>
                      <td className="py-3.5 px-4 font-mono">
                        <span className="font-bold text-espresso-950 dark:text-white">{k.usedCount}</span> /{' '}
                        <span className="text-espresso-500 dark:text-ivory-400">{k.maxUses} seats</span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider ${
                            k.status === 'active'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : k.status === 'expired'
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          }`}
                        >
                          {k.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {k.status === 'active' ? (
                          <button
                            type="button"
                            onClick={() => handleRevokeKey(k)}
                            className="px-2.5 py-1 rounded-lg text-xs font-mono text-rose-400 hover:bg-rose-500/10 border border-rose-500/20 transition cursor-pointer"
                          >
                            Revoke Key
                          </button>
                        ) : (
                          <span className="text-espresso-400 dark:text-ivory-500 text-xs font-mono">—</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Section 2: Promotional Coupons & Discount Codes ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-white/10">
          <div>
            <h2 className="text-base sm:text-lg font-serif font-bold text-white flex items-center gap-2">
              <Tag className="w-4 h-4 text-amber-400" />
              Promotional Discount Vouchers
            </h2>
            <p className="text-xs text-ivory-400">
              Discount promo codes applied at checkout for marketing promotions and student onboarding drives.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {coupons.length === 0 ? (
            <div className="col-span-full py-10 text-center text-xs text-ivory-400 rounded-3xl bg-white/5 border border-white/5">
              <Tag className="w-8 h-8 mx-auto mb-2 opacity-30 text-amber-400" />
              <p className="font-semibold text-white">No active promo discount codes yet</p>
              <p className="text-[11px] text-ivory-400 mt-1 max-w-sm mx-auto">
                Click "Create Promo Coupon" above to launch a marketing discount campaign for your scholars.
              </p>
            </div>
          ) : (
            coupons.map((c) => (
              <div
                key={c.code}
                className="p-5 rounded-3xl bg-white/95 dark:bg-[#0A0F1D]/90 border border-ivory-300/80 dark:border-white/10 shadow-sm space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-base font-black tracking-wider text-white px-3 py-1 rounded-xl bg-white/5 border border-white/10 select-all">
                    {c.code}
                  </span>
                  <span className="text-xs font-mono font-black text-amber-400 px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40">
                    {c.discountPercent}% OFF
                  </span>
                </div>
                <div className="space-y-1 text-xs font-mono text-ivory-400">
                  <div className="flex justify-between">
                    <span>Usage Count:</span>
                    <span className="text-white font-bold">{c.usageCount} / {c.maxUsage}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Campaign Status:</span>
                    <span className="text-emerald-400 font-bold">{c.active ? 'Active' : 'Expired'}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Issue License Key Modal */}
      {showNewKeyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
          <div className="w-full max-w-md rounded-3xl bg-[#0A0F1D] border border-white/10 p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <h3 className="font-serif text-lg font-bold text-white flex items-center gap-2">
                <Key className="w-4 h-4 text-blue-400" />
                Issue Batch Campus License
              </h3>
              <button onClick={() => setShowNewKeyModal(false)} className="text-ivory-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleGenerateKey} className="space-y-4 text-xs font-mono">
              <div>
                <label className="block text-ivory-400 mb-1">Target Institution or Cohort</label>
                <input
                  type="text"
                  value={keyInstitution}
                  onChange={(e) => setKeyInstitution(e.target.value)}
                  placeholder="e.g. Stanford CS229 Fall Batch"
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-ivory-400 mb-1">Pass Tier</label>
                  <select
                    value={keyTier}
                    onChange={(e) => setKeyTier(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                  >
                    <option value="pro" className="bg-[#070B14]">Pro Scholar</option>
                    <option value="semester" className="bg-[#070B14]">Semester Pass</option>
                    <option value="cohort" className="bg-[#070B14]">Campus Cohort</option>
                    <option value="lifetime" className="bg-[#070B14]">Founder Lifetime</option>
                  </select>
                </div>
                <div>
                  <label className="block text-ivory-400 mb-1">Allowed Student Seats</label>
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    value={keySeats}
                    onChange={(e) => setKeySeats(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-bold"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="secondary" size="sm" onClick={() => setShowNewKeyModal(false)}>
                  Cancel
                </Button>
                <Button variant="primary" size="sm" type="submit" className="!bg-blue-600 text-white">
                  Generate License Key
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Promo Coupon Modal */}
      {showNewCouponModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
          <div className="w-full max-w-md rounded-3xl bg-[#0A0F1D] border border-white/10 p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <h3 className="font-serif text-lg font-bold text-white flex items-center gap-2">
                <Tag className="w-4 h-4 text-amber-400" />
                Create Promotional Coupon
              </h3>
              <button onClick={() => setShowNewCouponModal(false)} className="text-ivory-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateCoupon} className="space-y-4 text-xs font-mono">
              <div>
                <label className="block text-ivory-400 mb-1">Coupon Code</label>
                <input
                  type="text"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value)}
                  placeholder="e.g. EXAMLAUNCH50"
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white uppercase focus:outline-none focus:ring-1 focus:ring-blue-500 font-bold"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-ivory-400 mb-1">Discount %</label>
                  <input
                    type="number"
                    min="5"
                    max="100"
                    value={couponDiscount}
                    onChange={(e) => setCouponDiscount(parseInt(e.target.value) || 10)}
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-bold"
                    required
                  />
                </div>
                <div>
                  <label className="block text-ivory-400 mb-1">Maximum Redemptions</label>
                  <input
                    type="number"
                    min="1"
                    max="10000"
                    value={couponMaxUses}
                    onChange={(e) => setCouponMaxUses(parseInt(e.target.value) || 100)}
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-bold"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="secondary" size="sm" onClick={() => setShowNewCouponModal(false)}>
                  Cancel
                </Button>
                <Button variant="primary" size="sm" type="submit" className="!bg-amber-600 text-white">
                  Create Coupon
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

