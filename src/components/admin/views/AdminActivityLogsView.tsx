import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  RefreshCw,
  Clock,
  Activity,
  Search,
} from 'lucide-react';
import { adminService } from '../../../services/adminService';
import { AdminAuditLogEntry, LocalActivityLogEntry } from '../../../types/admin';
import { Button } from '../../common/Button';
import { AdminEmptyState } from '../common/AdminEmptyState';

export const AdminActivityLogsView: React.FC = () => {
  const [activeLogType, setActiveLogType] = useState<'cloud' | 'local'>('cloud');
  const [cloudLogs, setCloudLogs] = useState<AdminAuditLogEntry[]>([]);
  const [localLogs, setLocalLogs] = useState<LocalActivityLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const loadLogs = async () => {
    setIsLoading(true);
    setError(null);
    const { data, error: fetchErr } = await adminService.fetchAuditLogs(50, 0);
    if (fetchErr) {
      setError(fetchErr);
    } else {
      setCloudLogs(data);
    }
    setLocalLogs(adminService.getLocalActivityLogs());
    setIsLoading(false);
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const filteredLocalLogs = localLogs.filter(
    (l) =>
      l.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.details.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Required by tests: "Immutable Administrative Audit Trail" heading */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-ivory-200 dark:border-espresso-800">
        <div>
          <h2 className="font-serif text-2xl font-bold text-espresso-950 dark:text-ivory-100">
            Immutable Administrative Audit Trail
          </h2>
          <p className="text-xs text-espresso-500 dark:text-espresso-400 mt-0.5">
            Append-only record of all operational state mutations, join code rotations, and workspace moderations.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Switcher between Cloud and Local Logs */}
          <div className="flex items-center p-1 rounded-xl bg-white/5 border border-white/10 text-xs font-mono">
            <button
              onClick={() => setActiveLogType('cloud')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                activeLogType === 'cloud'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-ivory-400 hover:text-white'
              }`}
            >
              Cloud Audit ({cloudLogs.length})
            </button>
            <button
              onClick={() => setActiveLogType('local')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                activeLogType === 'local'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-ivory-400 hover:text-white'
              }`}
            >
              Local Telemetry ({localLogs.length})
            </button>
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={loadLogs}
            disabled={isLoading}
            className="gap-2 self-start sm:self-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh Audit Trail
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 rounded-2xl text-xs text-rose-700 dark:text-rose-300">
          <strong>Audit Log Query Notice:</strong> {error}
        </div>
      )}

      {/* Cloud Audit Table */}
      {activeLogType === 'cloud' ? (
        <div className="bg-white dark:bg-espresso-900 border border-ivory-300 dark:border-espresso-800 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-ivory-100/60 dark:bg-espresso-850 border-b border-ivory-300 dark:border-espresso-800 text-espresso-500 dark:text-espresso-400 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Actor UUID</th>
                  <th className="py-3 px-4">Target Entity</th>
                  <th className="py-3 px-4">Metadata &amp; Administrative Justification</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ivory-200 dark:divide-espresso-800 font-mono">
                {isLoading && cloudLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-espresso-400 font-sans">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-terracotta-500" />
                      Fetching audit trail records...
                    </td>
                  </tr>
                ) : cloudLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-espresso-400 font-sans">
                      <ShieldCheck className="w-8 h-8 mx-auto mb-2 text-espresso-300 dark:text-espresso-600" />
                      No administrative audit records logged yet.
                    </td>
                  </tr>
                ) : (
                  cloudLogs.map((entry) => (
                    <tr
                      key={entry.id}
                      className="hover:bg-ivory-50/60 dark:hover:bg-espresso-850/40 transition-colors"
                    >
                      <td className="py-3 px-4 text-espresso-600 dark:text-espresso-300 whitespace-nowrap font-sans">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-espresso-400" />
                          {new Date(entry.created_at).toLocaleString()}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-espresso-100 dark:bg-espresso-800 text-espresso-800 dark:text-ivory-200 border border-ivory-300 dark:border-espresso-700">
                          {entry.action}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-[10px] text-espresso-500 select-all">
                        {entry.actor_id}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-espresso-800 dark:text-ivory-200">
                          {entry.target_type}
                        </span>
                        {entry.target_id && (
                          <div className="text-[10px] text-espresso-400 truncate max-w-[120px]">
                            {entry.target_id}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 font-sans text-xs text-espresso-600 dark:text-espresso-300">
                        {entry.metadata ? JSON.stringify(entry.metadata) : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Local Telemetry Table */
        <div className="space-y-4">
          <div className="relative max-w-md">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-espresso-400 dark:text-ivory-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter local events by action or details..."
              className="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl bg-white/95 dark:bg-[#0A0F1D]/90 border border-ivory-300/80 dark:border-white/10 text-espresso-900 dark:text-ivory-100 placeholder-espresso-400 dark:placeholder-ivory-400 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-sm"
            />
          </div>

          {filteredLocalLogs.length === 0 ? (
            <AdminEmptyState
              icon={<Activity className="w-6 h-6" />}
              title="No Local Activity Recorded"
              description="Actions performed in TRAKIFY will be captured in this local telemetry audit trail."
            />
          ) : (
            <div className="rounded-3xl bg-white/95 dark:bg-[#0A0F1D]/90 border border-ivory-300/80 dark:border-white/10 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-ivory-100/70 dark:bg-white/[0.03] border-b border-ivory-200 dark:border-white/10 text-espresso-500 dark:text-ivory-400 font-mono uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-3 px-4">Timestamp</th>
                      <th className="py-3 px-4">Action</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4">Details</th>
                      <th className="py-3 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ivory-200/80 dark:divide-white/5 font-sans">
                    {filteredLocalLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-ivory-50/80 dark:hover:bg-white/[0.02] transition-colors">
                        <td className="py-3 px-4 font-mono text-espresso-500 dark:text-ivory-400 whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 font-bold text-espresso-900 dark:text-white">
                          {log.action}
                        </td>
                        <td className="py-3 px-4">
                          <span className="capitalize font-mono text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                            {log.category}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-espresso-600 dark:text-ivory-300">
                          {log.details}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`font-mono text-[10px] font-bold uppercase tracking-wider ${
                              log.status === 'success'
                                ? 'text-emerald-500'
                                : log.status === 'warning'
                                ? 'text-amber-500'
                                : 'text-blue-500'
                            }`}
                          >
                            {log.status}
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
      )}
    </div>
  );
};
