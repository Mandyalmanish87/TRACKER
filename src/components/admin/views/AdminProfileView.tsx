import React from 'react';
import {
  LogOut,
} from 'lucide-react';
import { PlatformAdminRole } from '../../../types/admin';
import { AdminPageHeader } from '../common/AdminPageHeader';
import { Button } from '../../common/Button';

interface AdminProfileViewProps {
  adminRole: PlatformAdminRole;
  userId?: string;
  onExit: () => void;
}

export const AdminProfileView: React.FC<AdminProfileViewProps> = ({
  adminRole,
  userId,
  onExit,
}) => {
  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Administrative Operator Profile"
        description="Authenticated operator session metadata, cryptographic authorization tier, and privilege entitlements."
        badge={{ label: adminRole.replace('_', ' ').toUpperCase(), variant: 'blue' }}
      >
        <Button
          variant="secondary"
          size="sm"
          onClick={onExit}
          className="gap-2 !bg-white/5 !text-white !border-white/10"
        >
          <LogOut className="w-3.5 h-3.5 text-amber-400" />
          Exit to Student View
        </Button>
      </AdminPageHeader>

      <div className="max-w-2xl rounded-3xl bg-white/95 dark:bg-[#0A0F1D]/90 border border-ivory-300/80 dark:border-white/10 shadow-sm p-6 sm:p-8 space-y-6">
        <div className="flex items-center gap-4 pb-6 border-b border-ivory-200 dark:border-white/10">
          <div className="w-16 h-16 rounded-2xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center font-serif text-2xl font-bold">
            {adminRole.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-serif text-xl font-bold text-espresso-950 dark:text-white">
                Platform Administrator
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/40 font-bold uppercase">
                {adminRole.replace('_', ' ')}
              </span>
            </div>
            <p className="text-xs text-espresso-500 dark:text-ivory-400 mt-1">
              Active Administrative Control Center Session
            </p>
          </div>
        </div>

        <div className="space-y-4 text-xs font-mono">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 p-3 rounded-xl bg-ivory-100/60 dark:bg-white/5 border border-ivory-200 dark:border-white/5">
            <span className="text-espresso-500 dark:text-ivory-400">Authenticated UUID:</span>
            <span className="font-bold text-espresso-900 dark:text-white select-all">
              {userId || 'usr_local_student (Local Mode)'}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 p-3 rounded-xl bg-ivory-100/60 dark:bg-white/5 border border-ivory-200 dark:border-white/5">
            <span className="text-espresso-500 dark:text-ivory-400">Verification Boundary:</span>
            <span className="font-bold text-emerald-400">
              public.is_platform_admin() Verified
            </span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 p-3 rounded-xl bg-ivory-100/60 dark:bg-white/5 border border-ivory-200 dark:border-white/5">
            <span className="text-espresso-500 dark:text-ivory-400">Privilege Scope:</span>
            <span className="font-bold text-blue-400 capitalize">
              {adminRole === 'owner' ? 'Full Authority (All RPCs & Moderations)' : adminRole === 'super_admin' ? 'Operations & Moderation' : 'Read-Only Support'}
            </span>
          </div>
        </div>

        <div className="pt-4 flex justify-end">
          <Button
            variant="primary"
            size="md"
            onClick={onExit}
            className="gap-2 !bg-blue-600 hover:!bg-blue-500 text-white"
          >
            <LogOut className="w-4 h-4" />
            Return to TRAKIFY Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
};
