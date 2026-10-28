import React, { useState, useEffect } from 'react';
import { Search, Building, RefreshCw, KeyRound, Trash2 } from 'lucide-react';
import { adminService } from '../../services/adminService';
import { AdminWorkspaceRecord, PlatformAdminRole } from '../../types/admin';
import { Button } from '../common/Button';
import { AdminConfirmationModal } from './AdminConfirmationModal';

interface AdminWorkspacesViewProps {
  adminRole?: PlatformAdminRole;
}

export const AdminWorkspacesView: React.FC<AdminWorkspacesViewProps> = ({ adminRole }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [workspaces, setWorkspaces] = useState<AdminWorkspaceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Modal States
  const [rotateTarget, setRotateTarget] = useState<AdminWorkspaceRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminWorkspaceRecord | null>(null);

  const performSearch = async (query: string) => {
    setIsLoading(true);
    setError(null);
    const { data, error: searchErr } = await adminService.searchWorkspaces(query, 25, 0);
    if (searchErr) {
      setError(searchErr);
    } else {
      setWorkspaces(data);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      performSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleConfirmRotate = async (reason: string) => {
    if (!rotateTarget) return;
    const { newCode, error: rotErr } = await adminService.rotateWorkspaceJoinCode(
      rotateTarget.id,
      reason
    );
    if (rotErr) {
      throw new Error(rotErr);
    }
    setFeedback(`Join code for "${rotateTarget.name}" successfully rotated to ${newCode}`);
    performSearch(searchQuery);
  };

  const handleConfirmDelete = async (reason: string) => {
    if (!deleteTarget) return;
    const { success, error: delErr } = await adminService.deleteWorkspace(
      deleteTarget.id,
      reason
    );
    if (delErr || !success) {
      throw new Error(delErr || 'Workspace deletion failed');
    }
    setFeedback(`Workspace "${deleteTarget.name}" permanently removed.`);
    performSearch(searchQuery);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-ivory-200 dark:border-espresso-800">
        <div>
          <h2 className="font-serif text-2xl font-bold text-espresso-950 dark:text-ivory-100">
            ClassSpace Workspace Moderation
          </h2>
          <p className="text-xs text-espresso-500 dark:text-espresso-400 mt-0.5">
            Oversee collaborative class cohorts, rotate compromised join codes, or remove abusive workspaces.
          </p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-espresso-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, join code, institution..."
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

      {feedback && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
          <span>{feedback}</span>
          <button onClick={() => setFeedback(null)} className="font-bold underline ml-2">Dismiss</button>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 rounded-2xl text-xs text-rose-700 dark:text-rose-300">
          <strong>Workspace Query Notice:</strong> {error}
        </div>
      )}

      {/* Workspaces Table */}
      <div className="bg-white dark:bg-espresso-900 border border-ivory-300 dark:border-espresso-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-ivory-100/60 dark:bg-espresso-850 border-b border-ivory-300 dark:border-espresso-800 text-espresso-500 dark:text-espresso-400 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Workspace Details</th>
                <th className="py-3 px-4">Institution</th>
                <th className="py-3 px-4">Join Code</th>
                <th className="py-3 px-4">Enrolled Members</th>
                <th className="py-3 px-4">Created Date</th>
                <th className="py-3 px-4 text-right">Administrative Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ivory-200 dark:divide-espresso-800">
              {isLoading && workspaces.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-espresso-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-terracotta-500" />
                    Querying workspaces...
                  </td>
                </tr>
              ) : workspaces.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-espresso-400">
                    <Building className="w-8 h-8 mx-auto mb-2 text-espresso-300 dark:text-espresso-600" />
                    No workspaces found matching &quot;{searchQuery}&quot;.
                  </td>
                </tr>
              ) : (
                workspaces.map((ws) => (
                  <tr key={ws.id} className="hover:bg-ivory-50/60 dark:hover:bg-espresso-850/40 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-espresso-950 dark:text-ivory-50 text-sm">
                        {ws.name}
                      </div>
                      <div className="text-[10px] text-espresso-400 font-mono select-all">
                        {ws.id}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-espresso-600 dark:text-espresso-300">
                      {ws.institution || '—'}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-mono font-bold tracking-wider px-2 py-0.5 rounded bg-ivory-100 dark:bg-espresso-800 text-espresso-900 dark:text-ivory-100 border border-ivory-300 dark:border-espresso-700 select-all">
                        {ws.join_code}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-espresso-600 dark:text-espresso-300">
                      {ws.member_count} members
                    </td>
                    <td className="py-3.5 px-4 text-espresso-600 dark:text-espresso-300 whitespace-nowrap">
                      {new Date(ws.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {adminRole === 'support' ? (
                        <span className="text-[11px] font-medium text-espresso-400 dark:text-espresso-500 italic">
                          Read-Only (Support Role)
                        </span>
                      ) : (
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setRotateTarget(ws)}
                            className="gap-1.5 text-xs py-1 px-2.5"
                            title="Rotate Join Code"
                          >
                            <KeyRound className="w-3.5 h-3.5 text-terracotta-500" />
                            Rotate Code
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setDeleteTarget(ws)}
                            className="gap-1.5 text-xs py-1 px-2.5 text-rose-600 hover:text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-900/60 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                            title="Delete Workspace"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Delete
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Rotate Join Code Modal */}
      {rotateTarget && (
        <AdminConfirmationModal
          isOpen={true}
          title={`Rotate Join Code for "${rotateTarget.name}"`}
          description="Rotating this join code will immediately invalidate the current code and generate a new random alphanumeric code. Existing members will retain their access."
          confirmButtonText="Rotate Join Code"
          requiresReason={true}
          onConfirm={handleConfirmRotate}
          onClose={() => setRotateTarget(null)}
        />
      )}

      {/* Dual-Step Deletion Modal */}
      {deleteTarget && (
        <AdminConfirmationModal
          isOpen={true}
          title={`Delete ClassSpace "${deleteTarget.name}"`}
          description="WARNING: This action is permanent and cannot be undone. All workspace timetable rules, shared notices, and co-admin memberships will be permanently deleted."
          confirmMatchText={deleteTarget.name}
          confirmButtonText="Permanently Delete Workspace"
          isDestructive={true}
          requiresReason={true}
          onConfirm={handleConfirmDelete}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
};
