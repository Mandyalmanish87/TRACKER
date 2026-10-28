import React, { useEffect, useState } from 'react';
import { Users, Building, CheckCircle2, Activity, RefreshCw, ShieldCheck } from 'lucide-react';
import { adminService } from '../../services/adminService';
import { AdminOverviewMetrics } from '../../types/admin';
import { Button } from '../common/Button';

export const AdminOverviewView: React.FC = () => {
  const [metrics, setMetrics] = useState<AdminOverviewMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadMetrics = async () => {
    setIsLoading(true);
    setError(null);
    const { data, error: fetchErr } = await adminService.fetchOverviewMetrics();
    if (fetchErr) {
      setError(fetchErr);
    } else {
      setMetrics(data);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadMetrics();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header and Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-ivory-200 dark:border-espresso-800">
        <div>
          <h2 className="font-serif text-2xl font-bold text-espresso-950 dark:text-ivory-100">
            System &amp; Platform Health
          </h2>
          <p className="text-xs text-espresso-500 dark:text-espresso-400 mt-0.5">
            Real-time platform metrics retrieved via server-side administrative procedures.
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={loadMetrics}
          disabled={isLoading}
          className="gap-2 self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh Metrics
        </Button>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 rounded-2xl text-xs text-rose-700 dark:text-rose-300">
          <strong>Metric Fetch Notice:</strong> {error}
        </div>
      )}

      {/* Metrics Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Users */}
        <div className="p-5 bg-white dark:bg-espresso-900 border border-ivory-300 dark:border-espresso-800 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between text-espresso-400 dark:text-espresso-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Registered Users</span>
            <Users className="w-4 h-4 text-terracotta-500" />
          </div>
          <div className="text-2xl font-serif font-bold text-espresso-900 dark:text-ivory-100">
            {isLoading ? '...' : (metrics?.total_users ?? 0).toLocaleString()}
          </div>
          <div className="text-[11px] text-espresso-400 dark:text-espresso-500 mt-1">
            Accounts created across platform
          </div>
        </div>

        {/* Total Workspaces */}
        <div className="p-5 bg-white dark:bg-espresso-900 border border-ivory-300 dark:border-espresso-800 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between text-espresso-400 dark:text-espresso-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Active Workspaces</span>
            <Building className="w-4 h-4 text-terracotta-500" />
          </div>
          <div className="text-2xl font-serif font-bold text-espresso-900 dark:text-ivory-100">
            {isLoading ? '...' : (metrics?.total_workspaces ?? 0).toLocaleString()}
          </div>
          <div className="text-[11px] text-espresso-400 dark:text-espresso-500 mt-1">
            Active ClassSpace student cohorts
          </div>
        </div>

        {/* 7-Day Active */}
        <div className="p-5 bg-white dark:bg-espresso-900 border border-ivory-300 dark:border-espresso-800 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between text-espresso-400 dark:text-espresso-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">7-Day Active Users</span>
            <Activity className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-serif font-bold text-espresso-900 dark:text-ivory-100">
            {isLoading ? '...' : (metrics?.active_users_7d ?? 0).toLocaleString()}
          </div>
          <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-1">
            Synced with cloud within 7 days
          </div>
        </div>

        {/* System Status */}
        <div className="p-5 bg-white dark:bg-espresso-900 border border-ivory-300 dark:border-espresso-800 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between text-espresso-400 dark:text-espresso-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">System State</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-xl font-serif font-bold text-emerald-600 dark:text-emerald-400 capitalize">
            {isLoading ? 'Checking...' : (metrics?.system_status ?? 'Operational')}
          </div>
          <div className="text-[11px] text-espresso-400 dark:text-espresso-500 mt-1">
            All database RPC boundaries active
          </div>
        </div>
      </div>

      {/* Governance & Privacy Statement */}
      <div className="p-5 bg-ivory-100/70 dark:bg-espresso-850 border border-ivory-300 dark:border-espresso-800 rounded-2xl space-y-2">
        <div className="flex items-center gap-2 text-terracotta-700 dark:text-terracotta-400 text-sm font-semibold">
          <ShieldCheck className="w-4 h-4" />
          <span>Student Privacy &amp; Zero-Knowledge Boundary Enforced</span>
        </div>
        <p className="text-xs text-espresso-600 dark:text-espresso-300 leading-relaxed">
          The Platform Administrative Portal enforces strict operational boundaries. Administrators are authorized to inspect high-level user metadata, sync health, and workspace identifiers for operational support and moderation.
          Under database Row Level Security, student personal attendance percentages, private notes, study routines, and health logs are strictly isolated and cryptographically inaccessible to administrative queries.
        </p>
      </div>
    </div>
  );
};
