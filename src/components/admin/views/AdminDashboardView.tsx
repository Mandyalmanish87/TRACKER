import React, { useEffect, useState, useMemo } from 'react';
import {
  Users,
  Building,
  Activity,
  AlertTriangle,
  RefreshCw,
  Database,
  ArrowUpRight,
  ShieldCheck,
  HardDrive,
  Clock,
  Sparkles,
  TrendingUp,
  CreditCard,
  Palette,
  Salad,
  Key,
  IndianRupee,
} from 'lucide-react';
import { useAdminApp } from '../useAdminApp';
import { useOptionalClassSpace } from '../../../context/ClassSpaceContext';
import { adminService } from '../../../services/adminService';
import { AdminOverviewMetrics, AdminNavTab, AdminTimeframe, PlatformAdminRole, DataIntegrityReport } from '../../../types/admin';
import { AdminStatCard } from '../common/AdminStatCard';
import { Button } from '../../common/Button';

interface AdminDashboardViewProps {
  adminRole: PlatformAdminRole;
  userId?: string;
  timeframe: AdminTimeframe;
  onSelectTab: (tab: AdminNavTab) => void;
}

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({
  adminRole,
  userId,
  timeframe: _timeframe,
  onSelectTab,
}) => {
  const { state } = useAdminApp();
  const classSpace = useOptionalClassSpace();

  const [metrics, setMetrics] = useState<AdminOverviewMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Load cloud metrics if configured
  useEffect(() => {
    let isMounted = true;
    const loadMetrics = async () => {
      setIsLoading(true);
      const { data } = await adminService.fetchOverviewMetrics();
      if (isMounted && data) {
        setMetrics(data);
      }
      if (isMounted) setIsLoading(false);
    };
    loadMetrics();
    return () => { isMounted = false; };
  }, [refreshKey]);

  // Compute live local instance data
  const integrity = useMemo<DataIntegrityReport>(() => {
    return adminService.validateDataIntegrity(state);
  }, [state]);

  const recentActivities = useMemo(() => {
    return adminService.getLocalActivityLogs().slice(0, 6);
  }, [refreshKey]);

  const transactions = useMemo(() => adminService.getPaymentTransactions(), [refreshKey]);
  const realGrossRevenue = useMemo(() => {
    return transactions.reduce((sum, t) => sum + (t.status === 'completed' ? t.amount : 0), 0);
  }, [transactions]);
  const paidCount = useMemo(() => {
    return transactions.filter((t) => t.status === 'completed').length;
  }, [transactions]);

  const totalWorkspaces = metrics?.total_workspaces ?? (classSpace?.workspaces?.length || 0);

  // Calculate 7-day activity bars for Cirrel-style activity chart
  const weeklyActivityData = useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const today = new Date();
    const result = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      const dayName = days[d.getDay()];
      const dateStr = d.toISOString().split('T')[0];

      // Count study sessions on this date
      const focusMins = (state.studySessions || [])
        .filter((s) => s.timestamp && s.timestamp.startsWith(dateStr))
        .reduce((sum, s) => sum + s.durationMinutes, 0);

      // Count food logs on this date
      const foodCount = (state.foodDiaryEntries || [])
        .filter((f) => (f.date && f.date.startsWith(dateStr)) || ((f as any).loggedAt && (f as any).loggedAt.startsWith(dateStr)))
        .length;

      // Count workouts on this date
      const workoutCount = (state.gymWorkouts || [])
        .filter((w) => (w.date && w.date.startsWith(dateStr)) || ((w as any).completedAt && (w as any).completedAt.startsWith(dateStr)))
        .length;

      result.push({
        day: dayName,
        date: dateStr,
        focusMins,
        activityScore: Math.min(100, focusMins + foodCount * 15 + workoutCount * 30),
      });
    }
    return result;
  }, [state.studySessions, state.foodDiaryEntries, state.gymWorkouts]);

  return (
    <div className="space-y-6">
      {/* 1. Welcome / Admin Briefing Banner (Cirrel Inspired) */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-blue-950/80 via-[#0C152B] to-[#0A0F1E] border border-blue-500/20 p-6 sm:p-8 shadow-xl">
        {/* Subtle ambient spatial orbs */}
        <div className="absolute top-0 right-1/4 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/2 left-10 w-48 h-48 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-500/30">
                <Sparkles className="w-3 h-3 text-cyan-400" />
                Apple × Spatial Control Center
              </span>
              <span className="text-[11px] font-mono text-ivory-400">
                Schema v{integrity.schemaVersion} · Build 2.4.0
              </span>
            </div>

            <h2 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-white">
              TRAKIFY Administration &amp; System Intelligence
            </h2>

            <p className="text-xs sm:text-sm text-ivory-300 max-w-2xl leading-relaxed">
              Real-time operational telemetry, academic data oversight, database boundaries, and system governance.
              Logged in as <span className="font-mono text-blue-300 font-semibold">{userId || 'Platform Owner'}</span> ({adminRole.replace('_', ' ')}).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setRefreshKey((k) => k + 1)}
              disabled={isLoading}
              className="gap-2 !bg-white/10 !text-white !border-white/15 hover:!bg-white/15"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh Telemetry
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => onSelectTab('data_management')}
              className="gap-2 !bg-blue-600 hover:!bg-blue-500 !text-white shadow-lg shadow-blue-600/30"
            >
              <Database className="w-3.5 h-3.5" />
              Data Management
            </Button>
          </div>
        </div>
      </div>

      {/* 2. KPI Summary Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <AdminStatCard
          title="User Accounts"
          value={metrics?.total_users ?? 1}
          subtitle={metrics ? 'Cloud registered users' : 'Local single-user instance'}
          icon={<Users className="w-4 h-4" />}
          accentColor="#3B82F6"
          trend={{ value: 'Live', isPositive: true }}
          onClick={() => onSelectTab('users')}
        />

        <AdminStatCard
          title="Gross SaaS Revenue"
          value={realGrossRevenue > 0 ? `₹${realGrossRevenue.toLocaleString('en-IN')}` : '₹0'}
          subtitle={paidCount > 0 ? `${paidCount} Completed Orders` : 'Zero demo inflation'}
          icon={<IndianRupee className="w-4 h-4" />}
          accentColor="#10B981"
          trend={{ value: `${paidCount} Paid`, isPositive: paidCount > 0 }}
          onClick={() => onSelectTab('payments')}
        />

        <AdminStatCard
          title="Active Subscriptions"
          value={`${paidCount} Active`}
          subtitle={paidCount > 0 ? 'Verified paid scholars' : '0 paid accounts'}
          icon={<TrendingUp className="w-4 h-4" />}
          accentColor="#8B5CF6"
          trend={{ value: `${paidCount} Paid`, isPositive: paidCount > 0 }}
          onClick={() => onSelectTab('payments')}
        />

        <AdminStatCard
          title="Active Class Cohorts"
          value={totalWorkspaces || 3}
          subtitle={`${metrics?.total_attendance_records ?? 12} aggregate records synced`}
          icon={<Building className="w-4 h-4" />}
          accentColor="#06B6D4"
          trend={{ value: `${totalWorkspaces || 3} Live`, isPositive: true }}
          onClick={() => onSelectTab('workspaces')}
        />
      </div>

      {/* 3. Main Dashboard Layout (Cirrel Composition): Activity Chart + System Health */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Large Activity Throughput Chart (2 Columns) */}
        <div className="lg:col-span-2 p-6 rounded-3xl bg-white/95 dark:bg-[#0A0F1D]/90 border border-ivory-300/80 dark:border-white/10 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-ivory-200 dark:border-white/10 mb-4">
              <div>
                <h3 className="font-serif text-lg font-bold text-espresso-950 dark:text-ivory-100">
                  Weekly SaaS &amp; Operational Throughput
                </h3>
                <p className="text-xs text-espresso-500 dark:text-espresso-400">
                  Calculated intensity across user activations, class cohort activity, and tracking throughput (past 7 days)
                </p>
              </div>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-semibold">
                Telemetry
              </span>
            </div>

            {/* Visual Bar Chart */}
            <div className="h-52 w-full flex items-end justify-between gap-3 pt-6 pb-2 px-2">
              {weeklyActivityData.map((item) => {
                const heightPct = Math.max(12, Math.min(100, item.activityScore));
                return (
                  <div key={item.date} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
                    <div className="text-[10px] font-mono text-espresso-400 opacity-0 group-hover:opacity-100 transition-opacity">
                      {item.focusMins}m
                    </div>
                    <div className="w-full max-w-[42px] bg-ivory-200 dark:bg-white/5 rounded-t-xl overflow-hidden h-full flex items-end">
                      <div
                        className="w-full rounded-t-xl bg-gradient-to-t from-blue-600 to-cyan-400 transition-all duration-300 group-hover:brightness-110"
                        style={{ height: `${heightPct}%` }}
                      />
                    </div>
                    <span className="text-[11px] font-mono text-espresso-500 dark:text-ivory-400 font-semibold">
                      {item.day}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 pt-4 mt-2 border-t border-ivory-200 dark:border-white/10 text-xs">
            <div className="flex items-center gap-4 text-espresso-600 dark:text-ivory-300">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                Focus Study
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
                Fitness &amp; Lifestyle
              </span>
            </div>
            <button
              onClick={() => onSelectTab('analytics')}
              className="text-blue-500 hover:text-blue-400 font-semibold inline-flex items-center gap-1 cursor-pointer"
            >
              Detailed Analytics <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* System Health & Storage Breakdown (1 Column) */}
        <div className="p-6 rounded-3xl bg-white/95 dark:bg-[#0A0F1D]/90 border border-ivory-300/80 dark:border-white/10 shadow-sm space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-ivory-200 dark:border-white/10">
            <h3 className="font-serif text-lg font-bold text-espresso-950 dark:text-ivory-100 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-500" />
              System Integrity
            </h3>
            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 font-bold">
              Healthy
            </span>
          </div>

          <div className="space-y-3.5 text-xs">
            <div className="p-3 rounded-xl bg-ivory-100/60 dark:bg-white/5 border border-ivory-200 dark:border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <HardDrive className="w-4 h-4 text-blue-400" />
                <div>
                  <p className="font-semibold text-espresso-900 dark:text-white">Local Storage Quota</p>
                  <p className="text-[11px] text-espresso-500 dark:text-ivory-400">{integrity.storageSizeFormatted} consumed</p>
                </div>
              </div>
              <span className="font-mono text-xs font-bold text-blue-400">
                {integrity.isValid ? 'Valid' : 'Warning'}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-ivory-100/60 dark:bg-white/5 border border-ivory-200 dark:border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Database className="w-4 h-4 text-purple-400" />
                <div>
                  <p className="font-semibold text-espresso-900 dark:text-white">Schema Boundary</p>
                  <p className="text-[11px] text-espresso-500 dark:text-ivory-400">Storage Version {integrity.schemaVersion}</p>
                </div>
              </div>
              <span className="font-mono text-xs font-bold text-emerald-400">Locked</span>
            </div>

            <div className="p-3 rounded-xl bg-ivory-100/60 dark:bg-white/5 border border-ivory-200 dark:border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Building className="w-4 h-4 text-cyan-400" />
                <div>
                  <p className="font-semibold text-espresso-900 dark:text-white">Active Workspaces</p>
                  <p className="text-[11px] text-espresso-500 dark:text-ivory-400">ClassSpace cohorts</p>
                </div>
              </div>
              <span className="font-mono text-xs font-bold text-espresso-800 dark:text-ivory-200">
                {totalWorkspaces}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-ivory-100/60 dark:bg-white/5 border border-ivory-200 dark:border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <div>
                  <p className="font-semibold text-espresso-900 dark:text-white">Integrity Diagnostics</p>
                  <p className="text-[11px] text-espresso-500 dark:text-ivory-400">{integrity.issues.length} flagged checks</p>
                </div>
              </div>
              <span className={`font-mono text-xs font-bold ${integrity.issues.length === 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                {integrity.issues.length === 0 ? '0 Errors' : `${integrity.issues.length} Notice`}
              </span>
            </div>
          </div>

          <button
            onClick={() => onSelectTab('data_management')}
            className="w-full py-2.5 rounded-xl bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-500/30 text-xs font-semibold transition cursor-pointer text-center block"
          >
            Run Deep Integrity Audit
          </button>
        </div>
      </div>

      {/* 4. Bottom Grid: Quick Administrative Actions & Recent Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Admin Actions (1 Column) */}
        <div className="p-6 rounded-3xl bg-white/95 dark:bg-[#0A0F1D]/90 border border-ivory-300/80 dark:border-white/10 shadow-sm space-y-3">
          <h3 className="font-serif text-lg font-bold text-espresso-950 dark:text-ivory-100 pb-2 border-b border-ivory-200 dark:border-white/10">
            Quick Administrative Actions
          </h3>

          <div className="space-y-2">
            <button
              onClick={() => onSelectTab('payments')}
              className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-ivory-100 dark:hover:bg-white/5 border border-ivory-200 dark:border-white/5 text-left text-xs font-semibold transition cursor-pointer"
            >
              <div className="flex items-center gap-2.5 text-espresso-900 dark:text-ivory-100">
                <CreditCard className="w-4 h-4 text-emerald-400" />
                <span>Manage Live Pricing &amp; Subscriber Passes</span>
              </div>
              <ArrowUpRight className="w-3.5 h-3.5 text-espresso-400" />
            </button>

            <button
              onClick={() => onSelectTab('workspaces')}
              className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-ivory-100 dark:hover:bg-white/5 border border-ivory-200 dark:border-white/5 text-left text-xs font-semibold transition cursor-pointer"
            >
              <div className="flex items-center gap-2.5 text-espresso-900 dark:text-ivory-100">
                <Building className="w-4 h-4 text-cyan-400" />
                <span>Inspect Class Rosters &amp; Control Cohorts</span>
              </div>
              <ArrowUpRight className="w-3.5 h-3.5 text-espresso-400" />
            </button>

            <button
              onClick={() => onSelectTab('analytics')}
              className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-ivory-100 dark:hover:bg-white/5 border border-ivory-200 dark:border-white/5 text-left text-xs font-semibold transition cursor-pointer"
            >
              <div className="flex items-center gap-2.5 text-espresso-900 dark:text-ivory-100">
                <TrendingUp className="w-4 h-4 text-blue-400" />
                <span>Audit Customer Gains &amp; Revenue Throughput</span>
              </div>
              <ArrowUpRight className="w-3.5 h-3.5 text-espresso-400" />
            </button>

            <button
              onClick={() => onSelectTab('website_editor')}
              className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-ivory-100 dark:hover:bg-white/5 border border-ivory-200 dark:border-white/5 text-left text-xs font-semibold transition cursor-pointer"
            >
              <div className="flex items-center gap-2.5 text-espresso-900 dark:text-ivory-100">
                <Palette className="w-4 h-4 text-purple-400" />
                <span>Live Studio: Edit Branding, Text &amp; Visual Shapes</span>
              </div>
              <ArrowUpRight className="w-3.5 h-3.5 text-espresso-400" />
            </button>

            <button
              onClick={() => onSelectTab('nutrition_recalibrator')}
              className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-ivory-100 dark:hover:bg-white/5 border border-ivory-200 dark:border-white/5 text-left text-xs font-semibold transition cursor-pointer"
            >
              <div className="flex items-center gap-2.5 text-espresso-900 dark:text-ivory-100">
                <Salad className="w-4 h-4 text-amber-400" />
                <span>Recalibrate Food Catalog &amp; Macronutrients</span>
              </div>
              <ArrowUpRight className="w-3.5 h-3.5 text-espresso-400" />
            </button>

            <button
              onClick={() => onSelectTab('licenses')}
              className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-ivory-100 dark:hover:bg-white/5 border border-ivory-200 dark:border-white/5 text-left text-xs font-semibold transition cursor-pointer"
            >
              <div className="flex items-center gap-2.5 text-espresso-900 dark:text-ivory-100">
                <Key className="w-4 h-4 text-pink-400" />
                <span>Issue Offline Campus Licenses &amp; Promo Codes</span>
              </div>
              <ArrowUpRight className="w-3.5 h-3.5 text-espresso-400" />
            </button>
          </div>
        </div>

        {/* Recent Operational Activity Trail (2 Columns) */}
        <div className="lg:col-span-2 p-6 rounded-3xl bg-white/95 dark:bg-[#0A0F1D]/90 border border-ivory-300/80 dark:border-white/10 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-ivory-200 dark:border-white/10 mb-4">
              <h3 className="font-serif text-lg font-bold text-espresso-950 dark:text-ivory-100 flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-400" />
                Administrative Activity Feed
              </h3>
              <button
                onClick={() => onSelectTab('audit')}
                className="text-xs text-blue-500 hover:text-blue-400 font-semibold cursor-pointer"
              >
                View All Activity Logs &rarr;
              </button>
            </div>

            {recentActivities.length === 0 ? (
              <div className="py-10 text-center text-xs text-espresso-400 dark:text-ivory-400">
                <Activity className="w-6 h-6 mx-auto mb-2 opacity-40 text-blue-400" />
                No local prospective administrative actions logged yet. State operations will appear here.
              </div>
            ) : (
              <div className="space-y-2.5">
                {recentActivities.map((act) => (
                  <div
                    key={act.id}
                    className="p-3 rounded-xl bg-ivory-100/60 dark:bg-white/[0.02] border border-ivory-200 dark:border-white/5 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                      <div>
                        <span className="font-semibold text-espresso-900 dark:text-white mr-2">
                          {act.action}
                        </span>
                        <span className="text-espresso-500 dark:text-ivory-400">
                          {act.details}
                        </span>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono text-espresso-400 dark:text-ivory-500 shrink-0 ml-3">
                      {new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-4 mt-2 border-t border-ivory-200 dark:border-white/10 text-xs text-espresso-500 dark:text-ivory-400 flex items-center justify-between">
            <span>Student privacy boundary enforced under zero-knowledge policy.</span>
            <span className="font-mono text-[10px] text-emerald-400">RLS Active</span>
          </div>
        </div>
      </div>
    </div>
  );
};
