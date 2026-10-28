import React, { useState, useEffect } from 'react';
import { Search, UserCheck, Calendar, Clock, RefreshCw } from 'lucide-react';
import { adminService } from '../../services/adminService';
import { UserSupportRecord } from '../../types/admin';
import { Button } from '../common/Button';

export const AdminUsersView: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<UserSupportRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const performSearch = async (query: string) => {
    setIsLoading(true);
    setError(null);
    const { data, error: searchErr } = await adminService.searchUsers(query, 25, 0);
    if (searchErr) {
      setError(searchErr);
    } else {
      setUsers(data);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      performSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  return (
    <div className="space-y-6">
      {/* Search Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-ivory-200 dark:border-espresso-800">
        <div>
          <h2 className="font-serif text-2xl font-bold text-espresso-950 dark:text-ivory-100">
            User Support &amp; Identity Lookup
          </h2>
          <p className="text-xs text-espresso-500 dark:text-espresso-400 mt-0.5">
            Query registered account metadata to assist users with sync or access inquiries.
          </p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-espresso-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by email or user UUID..."
              className="w-full pl-9 pr-3.5 py-2 text-xs bg-white dark:bg-espresso-900 border border-ivory-300 dark:border-espresso-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-terracotta-500 text-espresso-900 dark:text-ivory-100"
            />
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => performSearch(searchQuery)}
            disabled={isLoading}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 rounded-2xl text-xs text-rose-700 dark:text-rose-300">
          <strong>Search Notice:</strong> {error}
        </div>
      )}

      {/* Users Table */}
      <div className="bg-white dark:bg-espresso-900 border border-ivory-300 dark:border-espresso-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-ivory-100/60 dark:bg-espresso-850 border-b border-ivory-300 dark:border-espresso-800 text-espresso-500 dark:text-espresso-400 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Account Email / UUID</th>
                <th className="py-3 px-4">Tier</th>
                <th className="py-3 px-4">Created Date</th>
                <th className="py-3 px-4">Last Sign-In</th>
                <th className="py-3 px-4">Last Cloud Sync</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ivory-200 dark:divide-espresso-800">
              {isLoading && users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-espresso-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-terracotta-500" />
                    Querying account directory...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-espresso-400">
                    <UserCheck className="w-8 h-8 mx-auto mb-2 text-espresso-300 dark:text-espresso-600" />
                    No user accounts found matching &quot;{searchQuery}&quot;.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.user_id} className="hover:bg-ivory-50/60 dark:hover:bg-espresso-850/40 transition-colors">
                    <td className="py-3.5 px-4 font-mono text-espresso-900 dark:text-ivory-100">
                      <div className="font-sans font-medium text-espresso-950 dark:text-ivory-50 text-sm">
                        {u.email}
                      </div>
                      <div className="text-[10px] text-espresso-400 select-all">
                        {u.user_id}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-terracotta-100 dark:bg-terracotta-950/60 text-terracotta-800 dark:text-terracotta-300 border border-terracotta-200 dark:border-terracotta-900/60">
                        {u.subscription_tier || 'Free'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-espresso-600 dark:text-espresso-300 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-espresso-400" />
                        {new Date(u.created_at).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-espresso-600 dark:text-espresso-300 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-espresso-400" />
                        {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString() : 'Never'}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-espresso-600 dark:text-espresso-300 whitespace-nowrap">
                      {u.last_synced_at ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                          {new Date(u.last_synced_at).toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-espresso-400">Offline / No sync</span>
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
  );
};
