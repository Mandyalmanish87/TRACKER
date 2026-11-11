import React, { useState, useEffect, useCallback } from 'react';
import {
  Sliders,
  Moon,
  Sun,
  Laptop,
  Percent,
  Save,
  Video,
  RefreshCw,
  ShieldCheck,
  AlertTriangle,
  Clock,
  Database,
  ExternalLink,
} from 'lucide-react';
import { useAdminApp } from '../useAdminApp';
import { useOptionalTheme } from '../../../theme/ThemeContext';
import { adminService } from '../../../services/adminService';
import { AdminPageHeader } from '../common/AdminPageHeader';
import { Button } from '../../common/Button';
import { YouTubeImportQuotaStatus } from '../../../types/admin';

export const AdminConfigurationView: React.FC = () => {
  const { state, updateSettings } = useAdminApp();
  const themeContext = useOptionalTheme();
  const mode = themeContext?.mode || 'dark';
  const setMode = themeContext?.setMode || (() => {});

  const [attendanceTarget, setAttendanceTarget] = useState<number>(
    state.settings?.attendanceRequirement || 75
  );
  const [feedback, setFeedback] = useState<string | null>(null);

  // YouTube Quota & Cache Protection State
  const [quotaStatus, setQuotaStatus] = useState<YouTubeImportQuotaStatus | null>(null);
  const [isQuotaLoading, setIsQuotaLoading] = useState<boolean>(false);
  const [quotaError, setQuotaError] = useState<string | null>(null);

  const loadQuotaStatus = useCallback(async () => {
    setIsQuotaLoading(true);
    setQuotaError(null);
    try {
      const res = await adminService.getYouTubeQuotaStatus();
      if (res.data) {
        setQuotaStatus(res.data);
      } else if (res.error) {
        setQuotaError(res.error);
      }
    } catch (err: any) {
      setQuotaError(err?.message || 'Failed to query YouTube quota status');
    } finally {
      setIsQuotaLoading(false);
    }
  }, []);

  useEffect(() => {
    loadQuotaStatus();
  }, [loadQuotaStatus]);

  const handleSaveConfig = () => {
    updateSettings({
      ...state.settings,
      attendanceRequirement: attendanceTarget,
    });
    setFeedback('System configuration preferences successfully saved.');
    adminService.logLocalActivity(
      'Update System Configuration',
      'system',
      `Saved institutional minimum attendance threshold: ${attendanceTarget}%`,
      'success'
    );
  };

  const hardLimit = quotaStatus?.config?.quota_hard_safety_threshold || 7000;
  const unitsUsed = quotaStatus?.units_used || 0;
  const usedPct = Math.min(100, Math.round((unitsUsed / hardLimit) * 100));

  let statusColor = 'text-emerald-500';
  let barColor = 'bg-emerald-500';
  if (unitsUsed >= hardLimit) {
    statusColor = 'text-rose-500';
    barColor = 'bg-rose-500';
  } else if (unitsUsed >= 6000) {
    statusColor = 'text-amber-500';
    barColor = 'bg-amber-500';
  } else if (unitsUsed >= 5000) {
    statusColor = 'text-blue-500';
    barColor = 'bg-blue-500';
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Application Configuration &amp; Global Directives"
        description="Central system-level settings, default institutional attendance thresholds, theme directive presets, and module visibility rules."
        badge={{ label: 'System Config', variant: 'blue' }}
      >
        <Button
          variant="primary"
          size="sm"
          onClick={handleSaveConfig}
          className="gap-2 !bg-blue-600 hover:!bg-blue-500 !text-white shadow-lg shadow-blue-600/30"
        >
          <Save className="w-3.5 h-3.5" />
          Save Changes
        </Button>
      </AdminPageHeader>

      {feedback && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between">
          <span>{feedback}</span>
          <button onClick={() => setFeedback(null)} className="text-emerald-400 hover:text-white font-bold ml-4">
            Dismiss
          </button>
        </div>
      )}

      {/* YouTube API Quota, Smart Caching & Abuse Protection Card */}
      <div className="p-6 rounded-3xl bg-white/95 dark:bg-[#0A0F1D]/90 border border-ivory-300/80 dark:border-white/10 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-ivory-200 dark:border-white/10 gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-red-500/10 dark:bg-red-500/20 border border-red-500/30 flex items-center justify-center text-red-500">
              <Video className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-serif text-lg font-bold text-espresso-950 dark:text-ivory-100 flex items-center gap-2">
                YouTube API Quota &amp; Cache Protection
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  Pacific Time (America/Los_Angeles)
                </span>
              </h3>
              <p className="text-xs text-espresso-500 dark:text-espresso-400">
                Server-side quota accounting, 24h shared playlist cache, persistent rate limits, and safety cutoffs
              </p>
            </div>
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={loadQuotaStatus}
            disabled={isQuotaLoading}
            className="gap-2 text-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isQuotaLoading ? 'animate-spin' : ''}`} />
            Refresh Status
          </Button>
        </div>

        {quotaError && (
          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Note: {quotaError}. Showing default system protection directives below.</span>
          </div>
        )}

        {/* Quota Progress Gauge */}
        <div className="p-4 rounded-2xl bg-ivory-100/70 dark:bg-white/5 border border-ivory-200 dark:border-white/5 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-espresso-900 dark:text-white flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-blue-400" />
              Daily Quota Safety Buffer
            </span>
            <span className="font-mono font-bold text-espresso-900 dark:text-white">
              <span className={statusColor}>{unitsUsed.toLocaleString()}</span> / {hardLimit.toLocaleString()} Units (Safety Cutoff)
            </span>
          </div>

          <div className="w-full h-2.5 rounded-full bg-ivory-300 dark:bg-white/10 overflow-hidden">
            <div
              className={`h-full ${barColor} transition-all duration-500 rounded-full`}
              style={{ width: `${Math.max(2, usedPct)}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-espresso-500 dark:text-ivory-400">
            <span>Daily Budget: 10,000 units (Midnight PT reset)</span>
            <span>Safety Threshold: {hardLimit.toLocaleString()} units ({100 - usedPct}% buffer remaining)</span>
          </div>
        </div>

        {/* Operational Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="p-3.5 rounded-2xl bg-ivory-100/60 dark:bg-white/5 border border-ivory-200 dark:border-white/5 text-center">
            <span className="text-[10px] text-espresso-500 dark:text-ivory-400 block font-medium">Cache Hits (0 Quota)</span>
            <span className="text-base font-bold font-mono text-emerald-500">
              {quotaStatus?.cache_hits ?? 0}
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-ivory-100/60 dark:bg-white/5 border border-ivory-200 dark:border-white/5 text-center">
            <span className="text-[10px] text-espresso-500 dark:text-ivory-400 block font-medium">Cache Misses</span>
            <span className="text-base font-bold font-mono text-espresso-900 dark:text-white">
              {quotaStatus?.cache_misses ?? 0}
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-ivory-100/60 dark:bg-white/5 border border-ivory-200 dark:border-white/5 text-center">
            <span className="text-[10px] text-espresso-500 dark:text-ivory-400 block font-medium">Cached Playlists</span>
            <span className="text-base font-bold font-mono text-blue-400">
              {quotaStatus?.active_cached_playlists ?? 0}
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-ivory-100/60 dark:bg-white/5 border border-ivory-200 dark:border-white/5 text-center">
            <span className="text-[10px] text-espresso-500 dark:text-ivory-400 block font-medium">Successful Imports</span>
            <span className="text-base font-bold font-mono text-emerald-400">
              {quotaStatus?.successful_imports ?? 0}
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-ivory-100/60 dark:bg-white/5 border border-ivory-200 dark:border-white/5 text-center">
            <span className="text-[10px] text-espresso-500 dark:text-ivory-400 block font-medium">Rate-Limited Requests</span>
            <span className="text-base font-bold font-mono text-amber-400">
              {quotaStatus?.rate_limited_imports ?? 0}
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-ivory-100/60 dark:bg-white/5 border border-ivory-200 dark:border-white/5 text-center">
            <span className="text-[10px] text-espresso-500 dark:text-ivory-400 block font-medium">Quota Blocked</span>
            <span className="text-base font-bold font-mono text-rose-400">
              {quotaStatus?.quota_blocked_imports ?? 0}
            </span>
          </div>
        </div>

        {/* Protection Policies Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="p-3.5 rounded-2xl bg-ivory-100/40 dark:bg-white/[0.03] border border-ivory-200 dark:border-white/5 space-y-1">
            <span className="font-semibold text-espresso-900 dark:text-white flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-blue-400" />
              Smart 24h Cache
            </span>
            <p className="text-[11px] text-espresso-500 dark:text-ivory-400">
              Valid public playlists are cached for 24 hours. Cache hits consume exactly 0 quota units across all users.
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-ivory-100/40 dark:bg-white/[0.03] border border-ivory-200 dark:border-white/5 space-y-1">
            <span className="font-semibold text-espresso-900 dark:text-white flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              User Import Rate Limits
            </span>
            <p className="text-[11px] text-espresso-500 dark:text-ivory-400">
              Enforced per authenticated student: 5 imports/min, 30 imports/hour, 100 imports/day.
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-ivory-100/40 dark:bg-white/[0.03] border border-ivory-200 dark:border-white/5 space-y-1">
            <span className="font-semibold text-espresso-900 dark:text-white flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              Safety Cutoff &amp; Fallback
            </span>
            <p className="text-[11px] text-espresso-500 dark:text-ivory-400">
              Uncached API imports halt at 7,000 units to preserve a 3,000-unit emergency buffer. Public RSS fallback is engaged.
            </p>
          </div>
        </div>

        {/* Google Cloud Console Link */}
        <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-espresso-500 dark:text-ivory-400 border-t border-ivory-200 dark:border-white/10 gap-2">
          <span>
            Authoritative Quotas: Google Cloud Console &rarr; APIs &amp; Services &rarr; YouTube Data API v3 &rarr; Quotas
          </span>
          <a
            href="https://console.cloud.google.com/apis/api/youtube.googleapis.com/quotas"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:text-blue-400 font-semibold inline-flex items-center gap-1 underline underline-offset-2"
          >
            Open Google Cloud Console
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Institutional Attendance Directives */}
        <div className="p-6 rounded-3xl bg-white/95 dark:bg-[#0A0F1D]/90 border border-ivory-300/80 dark:border-white/10 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-ivory-200 dark:border-white/10">
            <div>
              <h3 className="font-serif text-lg font-bold text-espresso-950 dark:text-ivory-100">
                Institutional Attendance Policy
              </h3>
              <p className="text-xs text-espresso-500 dark:text-espresso-400">
                Default baseline requirement for safe-skip and remedial class calculation
              </p>
            </div>
            <Percent className="w-5 h-5 text-emerald-500" />
          </div>

          <div className="space-y-3">
            <label className="block text-xs font-semibold text-espresso-900 dark:text-white">
              Default Target Attendance Threshold (%)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min="50"
                max="100"
                value={attendanceTarget}
                onChange={(e) => setAttendanceTarget(Math.max(50, Math.min(100, Number(e.target.value))))}
                className="w-28 px-3.5 py-2 text-sm font-mono font-bold rounded-xl bg-ivory-100 dark:bg-white/5 border border-ivory-300 dark:border-white/10 text-espresso-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <span className="text-xs text-espresso-500 dark:text-ivory-400">
                Standard UGC/Institutional guideline is 75% minimum
              </span>
            </div>
            <p className="text-[11px] text-espresso-500 dark:text-ivory-400 leading-relaxed">
              New subjects without a custom target percentage will inherit this institutional baseline. Individual subjects retain their free-text targets.
            </p>
          </div>
        </div>

        {/* Global Theme & Visual Appearance Directive */}
        <div className="p-6 rounded-3xl bg-white/95 dark:bg-[#0A0F1D]/90 border border-ivory-300/80 dark:border-white/10 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-ivory-200 dark:border-white/10">
            <div>
              <h3 className="font-serif text-lg font-bold text-espresso-950 dark:text-ivory-100">
                System Theme Presets
              </h3>
              <p className="text-xs text-espresso-500 dark:text-espresso-400">
                Active presentation theme applied across TRAKIFY and Admin Control Center
              </p>
            </div>
            <Sliders className="w-5 h-5 text-blue-500" />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={() => setMode('light')}
              className={`p-3.5 rounded-2xl border text-center transition cursor-pointer ${
                mode === 'light'
                  ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-600/20'
                  : 'bg-white/5 border-white/10 text-ivory-300 hover:bg-white/10'
              }`}
            >
              <Sun className="w-5 h-5 mx-auto mb-1.5" />
              <span className="text-xs font-semibold block">Light</span>
            </button>

            <button
              onClick={() => setMode('dark')}
              className={`p-3.5 rounded-2xl border text-center transition cursor-pointer ${
                mode === 'dark'
                  ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-600/20'
                  : 'bg-white/5 border-white/10 text-ivory-300 hover:bg-white/10'
              }`}
            >
              <Moon className="w-5 h-5 mx-auto mb-1.5" />
              <span className="text-xs font-semibold block">Dark</span>
            </button>

            <button
              onClick={() => setMode('system')}
              className={`p-3.5 rounded-2xl border text-center transition cursor-pointer ${
                mode === 'system'
                  ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-600/20'
                  : 'bg-white/5 border-white/10 text-ivory-300 hover:bg-white/10'
              }`}
            >
              <Laptop className="w-5 h-5 mx-auto mb-1.5" />
              <span className="text-xs font-semibold block">System</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
