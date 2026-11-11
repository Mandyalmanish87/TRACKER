import React, { useMemo } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  GraduationCap,
  Percent,
  ShieldCheck,
} from 'lucide-react';
import { useAdminApp } from '../useAdminApp';
import { AdminPageHeader } from '../common/AdminPageHeader';
import { AdminStatCard } from '../common/AdminStatCard';
import { AdminEmptyState } from '../common/AdminEmptyState';

export const AdminAttendanceView: React.FC = () => {
  const { state } = useAdminApp();
  const subjects = state.subjects || [];
  const defaultThreshold = state.settings?.attendanceRequirement || 75;

  // Compute attendance stats using existing tested math
  const calculations = useMemo(() => {
    let totalConducted = 0;
    let totalAttended = 0;

    const list = subjects.map((sub) => {
      totalConducted += sub.totalConducted;
      totalAttended += sub.attended;

      const target = sub.targetPct || defaultThreshold;
      const pct = sub.totalConducted > 0 ? (sub.attended / sub.totalConducted) * 100 : 100;
      const roundedPct = Math.round(pct);

      let safeSkips = 0;
      let classesNeeded = 0;

      if (sub.totalConducted > 0) {
        if (pct >= target) {
          // Can safely miss classes
          const targetFrac = target / 100;
          safeSkips = Math.max(0, Math.floor((sub.attended - targetFrac * sub.totalConducted) / targetFrac));
        } else {
          // Needs to attend consecutive classes
          const targetFrac = target / 100;
          if (targetFrac < 1) {
            classesNeeded = Math.max(
              0,
              Math.ceil((targetFrac * sub.totalConducted - sub.attended) / (1 - targetFrac))
            );
          }
        }
      }

      return {
        ...sub,
        currentPct: roundedPct,
        target,
        safeSkips,
        classesNeeded,
        isSafe: roundedPct >= target,
      };
    });

    const aggregatePct = totalConducted > 0 ? Math.round((totalAttended / totalConducted) * 100) : 100;
    const safeCount = list.filter((s) => s.isSafe).length;
    const atRiskCount = list.filter((s) => !s.isSafe).length;

    return {
      list,
      aggregatePct,
      totalConducted,
      totalAttended,
      safeCount,
      atRiskCount,
    };
  }, [subjects, defaultThreshold]);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Attendance Health &amp; Mathematical Threshold Audit"
        description="Authoritative audit of academic attendance, safe-skip margins, remedial classes required, and institutional minimum compliance."
        badge={{
          label: `${calculations.aggregatePct}% Overall`,
          variant: calculations.aggregatePct >= defaultThreshold ? 'emerald' : 'rose',
        }}
      />

      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <AdminStatCard
          title="Aggregate Attendance"
          value={`${calculations.aggregatePct}%`}
          subtitle={`Configured Target: ${defaultThreshold}%`}
          icon={<Percent className="w-4 h-4" />}
          accentColor="#10B981"
          trend={{
            value: `${calculations.aggregatePct >= defaultThreshold ? 'Compliant' : 'Deficit'}`,
            isPositive: calculations.aggregatePct >= defaultThreshold,
          }}
        />

        <AdminStatCard
          title="Total Classes Attended"
          value={calculations.totalAttended}
          subtitle={`Out of ${calculations.totalConducted} conducted`}
          icon={<CheckCircle2 className="w-4 h-4" />}
          accentColor="#3B82F6"
        />

        <AdminStatCard
          title="Compliant Subjects"
          value={calculations.safeCount}
          subtitle={`Meeting or exceeding target threshold`}
          icon={<ShieldCheck className="w-4 h-4" />}
          accentColor="#10B981"
          trend={{ value: `${calculations.safeCount}/${subjects.length}`, isPositive: true }}
        />

        <AdminStatCard
          title="At-Risk Subjects"
          value={calculations.atRiskCount}
          subtitle={`Below target percentage`}
          icon={<AlertTriangle className="w-4 h-4" />}
          accentColor="#EF4444"
          trend={{
            value: calculations.atRiskCount === 0 ? 'Zero Risk' : 'Action Req',
            isPositive: calculations.atRiskCount === 0,
          }}
        />
      </div>

      {/* Subjects Ledger Table */}
      {subjects.length === 0 ? (
        <AdminEmptyState
          icon={<GraduationCap className="w-6 h-6" />}
          title="No Academic Subjects Recorded"
          description="Register subjects in TRAKIFY to view real-time attendance calculations and safe-skip margins."
        />
      ) : (
        <div className="rounded-3xl bg-white/95 dark:bg-[#0A0F1D]/90 border border-ivory-300/80 dark:border-white/10 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-ivory-100/70 dark:bg-white/[0.03] border-b border-ivory-200 dark:border-white/10 text-espresso-500 dark:text-ivory-400 font-mono uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3.5 px-4">Subject</th>
                  <th className="py-3.5 px-4">Conducted / Attended</th>
                  <th className="py-3.5 px-4">Current %</th>
                  <th className="py-3.5 px-4">Target Requirement</th>
                  <th className="py-3.5 px-4">Safe Bunks Remaining</th>
                  <th className="py-3.5 px-4">Classes Needed</th>
                  <th className="py-3.5 px-4">Compliance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ivory-200/80 dark:divide-white/5 font-sans">
                {calculations.list.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-ivory-50/80 dark:hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: item.color || '#3B82F6' }}
                        />
                        <span className="font-semibold text-espresso-950 dark:text-white">
                          {item.name}
                        </span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 font-mono">
                      <span className="font-bold text-espresso-900 dark:text-white">{item.attended}</span> / {item.totalConducted}
                    </td>

                    <td className="py-3.5 px-4">
                      <span className={`font-mono font-bold ${item.isSafe ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {item.currentPct}%
                      </span>
                    </td>

                    <td className="py-3.5 px-4 font-mono text-espresso-600 dark:text-ivory-300">
                      {item.target}%
                    </td>

                    <td className="py-3.5 px-4 font-mono font-semibold">
                      {item.safeSkips > 0 ? (
                        <span className="text-emerald-500">+{item.safeSkips} safe classes</span>
                      ) : (
                        <span className="text-espresso-400 dark:text-ivory-500">0</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 font-mono font-semibold">
                      {item.classesNeeded > 0 ? (
                        <span className="text-rose-500">{item.classesNeeded} required</span>
                      ) : (
                        <span className="text-emerald-500">None</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider ${
                          item.isSafe
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}
                      >
                        {item.isSafe ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                        {item.isSafe ? 'Safe' : 'At Risk'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
