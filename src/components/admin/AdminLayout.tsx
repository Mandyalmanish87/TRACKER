import React, { useState } from 'react';
import { LayoutDashboard, Users, Building, ShieldAlert, LogOut, Shield } from 'lucide-react';
import { PlatformAdminRole } from '../../types/admin';
import { AdminOverviewView } from './AdminOverviewView';
import { AdminUsersView } from './AdminUsersView';
import { AdminWorkspacesView } from './AdminWorkspacesView';
import { AdminAuditLogsView } from './AdminAuditLogsView';
import { Button } from '../common/Button';

export type AdminTab = 'overview' | 'users' | 'workspaces' | 'audit';

interface AdminLayoutProps {
  adminRole: PlatformAdminRole;
  userId?: string;
  onExit: () => void;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({ adminRole, userId, onExit }) => {
  const [currentTab, setCurrentTab] = useState<AdminTab>('overview');

  const tabs: { id: AdminTab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'System Overview', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'users', label: 'User Directory', icon: <Users className="w-4 h-4" /> },
    { id: 'workspaces', label: 'Workspaces', icon: <Building className="w-4 h-4" /> },
    { id: 'audit', label: 'Audit Trail', icon: <ShieldAlert className="w-4 h-4" /> },
  ];

  const getRoleBadge = (role: PlatformAdminRole) => {
    switch (role) {
      case 'owner':
        return 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800';
      case 'super_admin':
        return 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 border-indigo-300 dark:border-indigo-800';
      case 'support':
      default:
        return 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800';
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Editorial Administrative Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 bg-espresso-900 text-ivory-100 rounded-2xl shadow-md border border-espresso-800">
        <div className="flex items-center gap-3.5">
          <div className="p-2.5 rounded-xl bg-terracotta-500/20 text-terracotta-400 border border-terracotta-500/30">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-serif text-xl font-bold tracking-tight">
                Tracker Administrative Portal
              </h1>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getRoleBadge(adminRole)}`}>
                {adminRole.replace('_', ' ')}
              </span>
            </div>
            <p className="text-xs text-espresso-300 mt-0.5">
              Server-authoritative operational oversight · Authenticated Admin: <span className="font-mono text-terracotta-300 text-[11px]">{userId || 'Verified'}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={onExit}
            className="gap-2 !bg-espresso-800 !text-ivory-200 !border-espresso-700 hover:!bg-espresso-700"
          >
            <LogOut className="w-3.5 h-3.5" />
            Exit to Student View
          </Button>
        </div>
      </div>

      {/* Admin Tab Navigation */}
      <div className="flex items-center gap-2 border-b border-ivory-300 dark:border-espresso-800 pb-px overflow-x-auto">
        {tabs.map((tab) => {
          const isActive = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setCurrentTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all whitespace-nowrap border-b-2 -mb-px ${
                isActive
                  ? 'border-terracotta-500 text-terracotta-600 dark:text-terracotta-400 bg-white dark:bg-espresso-900 shadow-sm'
                  : 'border-transparent text-espresso-500 dark:text-espresso-400 hover:text-espresso-800 dark:hover:text-ivory-200 hover:bg-ivory-100/50 dark:hover:bg-espresso-850'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Subview Rendering */}
      <div className="pt-2">
        {currentTab === 'overview' && <AdminOverviewView />}
        {currentTab === 'users' && <AdminUsersView />}
        {currentTab === 'workspaces' && <AdminWorkspacesView adminRole={adminRole} />}
        {currentTab === 'audit' && <AdminAuditLogsView />}
      </div>
    </div>
  );
};
