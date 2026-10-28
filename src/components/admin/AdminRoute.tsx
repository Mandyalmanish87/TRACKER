import React, { useState, useEffect } from 'react';
import { ShieldAlert, RefreshCw, ArrowLeft, Lock } from 'lucide-react';
import { adminService } from '../../services/adminService';
import { PlatformAdminRole } from '../../types/admin';
import { AdminLayout } from './AdminLayout';
import { Button } from '../common/Button';

interface AdminRouteProps {
  onExit: () => void;
}

export const AdminRoute: React.FC<AdminRouteProps> = ({ onExit }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [adminRole, setAdminRole] = useState<PlatformAdminRole>('support');
  const [userId, setUserId] = useState<string | undefined>(undefined);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const checkAuthorization = async () => {
    setIsLoading(true);
    setErrorMessage(null);

    const result = await adminService.verifyPlatformAdmin();

    if (result.isAdmin) {
      setIsAuthorized(true);
      setAdminRole(result.role || 'support');
      setUserId(result.userId);
    } else {
      setIsAuthorized(false);
      setUserId(result.userId);
      setErrorMessage(result.error || 'Access denied: platform administrator role required');
    }

    setIsLoading(false);
  };

  useEffect(() => {
    checkAuthorization();
  }, []);

  // 1. Loading State
  if (isLoading) {
    return (
      <div className="min-h-[500px] flex flex-col items-center justify-center p-8 text-center">
        <div className="w-14 h-14 rounded-2xl bg-terracotta-100 dark:bg-terracotta-950/60 flex items-center justify-center mb-4 text-terracotta-600 dark:text-terracotta-400 border border-terracotta-200 dark:border-terracotta-900/60 animate-pulse">
          <Lock className="w-7 h-7" />
        </div>
        <h3 className="font-serif text-xl font-bold text-espresso-900 dark:text-ivory-100 mb-2">
          Verifying Server Authorization...
        </h3>
        <p className="text-xs text-espresso-500 dark:text-espresso-400 max-w-sm mb-6">
          Querying Postgres security procedure <code className="font-mono text-terracotta-600 dark:text-terracotta-400">public.is_platform_admin()</code> to authenticate administrative credentials.
        </p>
        <RefreshCw className="w-5 h-5 text-terracotta-500 animate-spin" />
      </div>
    );
  }

  // 2. 403 Forbidden State (Access Denied)
  if (!isAuthorized) {
    return (
      <div className="min-h-[550px] flex flex-col items-center justify-center p-6 sm:p-12 text-center animate-in fade-in duration-200">
        <div className="w-16 h-16 rounded-3xl bg-rose-100 dark:bg-rose-950/60 flex items-center justify-center mb-6 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/60 shadow-lg shadow-rose-500/10">
          <ShieldAlert className="w-8 h-8" />
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60 mb-3">
          <span>HTTP 403 · Access Denied</span>
        </div>

        <h2 className="font-serif text-2xl sm:text-3xl font-bold text-espresso-950 dark:text-ivory-100 mb-3">
          Platform Administrator Access Required
        </h2>

        <p className="text-xs sm:text-sm text-espresso-600 dark:text-espresso-300 max-w-lg mb-4 leading-relaxed">
          The Tracker Owner &amp; Administrative Portal is strictly restricted to server-verified platform operators. Ordinary student accounts and ClassSpace CR or Owner roles do not grant platform administrative access.
        </p>

        {userId && (
          <div className="mb-6 p-3 rounded-xl bg-ivory-100 dark:bg-espresso-850 border border-ivory-300 dark:border-espresso-750 text-xs font-mono text-espresso-500 dark:text-espresso-400 max-w-md">
            Authenticated Account UUID: <span className="select-all text-espresso-900 dark:text-ivory-200 font-bold">{userId}</span>
          </div>
        )}

        {errorMessage && (
          <div className="mb-6 text-xs text-rose-600 dark:text-rose-400 italic">
            Server response: {errorMessage}
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center gap-3">
          <Button
            variant="primary"
            size="md"
            onClick={onExit}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Return to Student Dashboard
          </Button>
          <Button
            variant="secondary"
            size="md"
            onClick={checkAuthorization}
            className="gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Retry Verification
          </Button>
        </div>
      </div>
    );
  }

  // 3. Authorized State
  return (
    <AdminLayout
      adminRole={adminRole}
      userId={userId}
      onExit={onExit}
    />
  );
};
