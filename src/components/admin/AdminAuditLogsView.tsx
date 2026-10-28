import React, { useState, useEffect } from 'react';
import { ShieldCheck, RefreshCw, Clock, Terminal } from 'lucide-react';
import { adminService } from '../../services/adminService';
import { AdminAuditLogEntry } from '../../types/admin';
import { Button } from '../common/Button';

export const AdminAuditLogsView: React.FC = () => {
  const [logs, setLogs] = useState<AdminAuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAuditLogs = async () => {
    setIsLoading(true);
    setError(null);
    const { data, error: fetchErr } = await adminService.fetchAuditLogs(50, 0);
    if (fetchErr) {
      setError(fetchErr);
    } else {
      setLogs(data);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadAuditLogs();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-ivory-200 dark:border-espresso-800">
        <div>
          <h2 className="font-serif text-2xl font-bold text-espresso-950 dark:text-ivory-100">
            Immutable Administrative Audit Trail
          </h2>
          <p className="text-xs text-espresso-500 dark:text-espresso-400 mt-0.5">
            Append-only record of all operational state mutations, join code rotations, and workspace moderations.
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={loadAuditLogs}
          disabled={isLoading}
          className="gap-2 self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh Audit Trail
        </Button>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 rounded-2xl text-xs text-rose-700 dark:text-rose-300">
          <strong>Audit Log Query Notice:</strong> {error}
        </div>
      )}

      {/* Audit Log Table */}
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
              {isLoading && logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-espresso-400 font-sans">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-terracotta-500" />
                    Fetching audit trail records...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-espresso-400 font-sans">
                    <ShieldCheck className="w-8 h-8 mx-auto mb-2 text-espresso-300 dark:text-espresso-600" />
                    No administrative audit records logged yet.
                  </td>
                </tr>
              ) : (
                logs.map((entry) => (
                  <tr key={entry.id} className="hover:bg-ivory-50/60 dark:hover:bg-espresso-850/40 transition-colors">
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
                    <td className="py-3 px-4 text-espresso-700 dark:text-espresso-300 font-sans">
                      <span className="font-semibold text-xs">{entry.target_type}</span>
                      {entry.target_id && (
                        <span className="block text-[10px] text-espresso-400 font-mono select-all">
                          {entry.target_id}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-espresso-600 dark:text-espresso-300 font-sans text-xs max-w-md">
                      <div className="p-2 rounded-lg bg-ivory-50 dark:bg-espresso-800/60 border border-ivory-200 dark:border-espresso-700 font-mono text-[11px] break-words">
                        <Terminal className="w-3 h-3 inline mr-1 text-terracotta-500" />
                        {JSON.stringify(entry.metadata)}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
