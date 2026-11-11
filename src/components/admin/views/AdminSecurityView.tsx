import React from 'react';
import {
  Shield,
  Lock,
  KeyRound,
  ShieldCheck,
  CheckCircle2,
  Server,
  FileCheck,
} from 'lucide-react';
import { PlatformAdminRole } from '../../../types/admin';
import { AdminPageHeader } from '../common/AdminPageHeader';
import { AdminStatCard } from '../common/AdminStatCard';

interface AdminSecurityViewProps {
  adminRole: PlatformAdminRole;
}

export const AdminSecurityView: React.FC<AdminSecurityViewProps> = ({ adminRole }) => {
  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Security Architecture &amp; Role-Based Governance"
        description="Platform administration role hierarchy, Postgres SECURITY DEFINER RPC verification, Row Level Security boundaries, and zero-knowledge cryptographic safeguards."
        badge={{ label: 'RLS Enforced', variant: 'emerald' }}
      />

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <AdminStatCard
          title="Active Operator Role"
          value={adminRole.replace('_', ' ').toUpperCase()}
          subtitle="Server-verified platform credentials"
          icon={<Shield className="w-4 h-4" />}
          accentColor="#3B82F6"
        />

        <AdminStatCard
          title="Row Level Security"
          value="Enforced"
          subtitle="PostgreSQL table policies active"
          icon={<Lock className="w-4 h-4" />}
          accentColor="#10B981"
          trend={{ value: 'Active', isPositive: true }}
        />

        <AdminStatCard
          title="Student Data Privacy"
          value="Zero-Knowledge"
          subtitle="Attendance & study logs inaccessible"
          icon={<ShieldCheck className="w-4 h-4" />}
          accentColor="#8B5CF6"
        />

        <AdminStatCard
          title="Service-Role Secret"
          value="Protected"
          subtitle="Never exposed to client bundle"
          icon={<KeyRound className="w-4 h-4" />}
          accentColor="#F59E0B"
        />
      </div>

      {/* Roles & Boundary Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Platform Roles */}
        <div className="p-6 rounded-3xl bg-white/95 dark:bg-[#0A0F1D]/90 border border-ivory-300/80 dark:border-white/10 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-ivory-200 dark:border-white/10">
            <div>
              <h3 className="font-serif text-lg font-bold text-espresso-950 dark:text-ivory-100">
                Platform Administration Roles
              </h3>
              <p className="text-xs text-espresso-500 dark:text-espresso-400">
                PostgreSQL SECURITY DEFINER role assignments
              </p>
            </div>
            <Server className="w-5 h-5 text-blue-500" />
          </div>

          <div className="space-y-3 text-xs">
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-amber-400 font-mono text-[11px] uppercase tracking-wider">
                  Owner
                </span>
                <span className="text-[10px] font-mono text-amber-300">Highest Privilege</span>
              </div>
              <p className="text-ivory-300 leading-relaxed">
                Full authority. Can manage platform administrators, rotate compromised workspace join codes, purge abusive cohorts, and inspect server metrics.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-blue-500/10 border border-blue-500/20 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-blue-400 font-mono text-[11px] uppercase tracking-wider">
                  Super Admin
                </span>
                <span className="text-[10px] font-mono text-blue-300">Operational Operator</span>
              </div>
              <p className="text-ivory-300 leading-relaxed">
                Authorized for join code rotation, user support lookup, and workspace moderation. Cannot alter owner records.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-emerald-400 font-mono text-[11px] uppercase tracking-wider">
                  Support
                </span>
                <span className="text-[10px] font-mono text-emerald-300">Read-Only</span>
              </div>
              <p className="text-ivory-300 leading-relaxed">
                Read-only customer support lookup. Strictly blocked from destructive actions (delete, rotate code, modify permissions).
              </p>
            </div>
          </div>
        </div>

        {/* Security Audit Checklist */}
        <div className="p-6 rounded-3xl bg-white/95 dark:bg-[#0A0F1D]/90 border border-ivory-300/80 dark:border-white/10 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-ivory-200 dark:border-white/10">
            <div>
              <h3 className="font-serif text-lg font-bold text-espresso-950 dark:text-ivory-100">
                Security Checklist &amp; RLS Policies
              </h3>
              <p className="text-xs text-espresso-500 dark:text-espresso-400">
                Empirical verification of application boundary protections
              </p>
            </div>
            <FileCheck className="w-5 h-5 text-emerald-500" />
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex items-start gap-3 p-3 rounded-xl bg-ivory-100/60 dark:bg-white/5 border border-ivory-200 dark:border-white/5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-espresso-900 dark:text-white">Service-Role Secrets Shielded</p>
                <p className="text-espresso-500 dark:text-ivory-400 text-[11px] mt-0.5">
                  Client code only bundles the public anonymous key. Server mutations require server-side SECURITY DEFINER verification.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-xl bg-ivory-100/60 dark:bg-white/5 border border-ivory-200 dark:border-white/5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-espresso-900 dark:text-white">Student Zero-Knowledge Invariant</p>
                <p className="text-espresso-500 dark:text-ivory-400 text-[11px] mt-0.5">
                  Personal attendance records, notes, and study logs are isolated to student user IDs via Postgres row-level security.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-xl bg-ivory-100/60 dark:bg-white/5 border border-ivory-200 dark:border-white/5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-espresso-900 dark:text-white">Dual-Confirmation Destructive Guard</p>
                <p className="text-espresso-500 dark:text-ivory-400 text-[11px] mt-0.5">
                  Destructive operations require typing exact workspace names and logging mandatory administrative justifications.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-xl bg-ivory-100/60 dark:bg-white/5 border border-ivory-200 dark:border-white/5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-espresso-900 dark:text-white">Immutable Audit Trail</p>
                <p className="text-espresso-500 dark:text-ivory-400 text-[11px] mt-0.5">
                  Administrative mutations are committed to append-only Postgres logs, preventing retroactive log alteration.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
