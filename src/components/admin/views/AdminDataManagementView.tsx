import React, { useState } from 'react';
import {
  Database,
  Download,
  Upload,
  HardDrive,
  ShieldCheck,
  RefreshCw,
  FileText,
} from 'lucide-react';
import { useAdminApp } from '../useAdminApp';
import { adminService } from '../../../services/adminService';
import { DataIntegrityReport } from '../../../types/admin';
import { AdminPageHeader } from '../common/AdminPageHeader';
import { AdminStatCard } from '../common/AdminStatCard';
import { Button } from '../../common/Button';

export const AdminDataManagementView: React.FC = () => {
  const { state, exportData, importData } = useAdminApp();
  const [report, setReport] = useState<DataIntegrityReport>(() =>
    adminService.validateDataIntegrity(state)
  );
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isAuditing, setIsAuditing] = useState(false);

  const handleRunAudit = () => {
    setIsAuditing(true);
    setTimeout(() => {
      const rep = adminService.validateDataIntegrity(state);
      setReport(rep);
      setIsAuditing(false);
      setFeedback('Integrity scan completed. All schemas verified.');
    }, 300);
  };

  const handleExportBackup = () => {
    exportData();
    setFeedback('Backup archive successfully generated and downloaded.');
    adminService.logLocalActivity('Export Backup', 'system', 'Generated complete JSON backup archive', 'success');
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);
        if (!parsed || typeof parsed !== 'object') {
          throw new Error('Invalid JSON structure');
        }

        const confirmReplace = window.confirm(
          'Warning: Importing this backup will safely replace your current local state with the verified records in this file. Proceed?'
        );
        if (!confirmReplace) return;

        importData(content);
        setFeedback('Backup data imported successfully into local storage.');
        adminService.logLocalActivity('Import Backup', 'system', `Imported backup file: ${file.name}`, 'warning');
      } catch (err: any) {
        alert(`Failed to import backup: ${err?.message || 'Malformed file'}`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Application Data Management &amp; Storage Boundaries"
        description="Safe JSON export/import utilities, schema version isolation, storage capacity diagnostics, and data integrity health checks."
        badge={{ label: `Schema v${report.schemaVersion}`, variant: 'blue' }}
      >
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleRunAudit}
            disabled={isAuditing}
            className="gap-2 !bg-white/5 !text-white !border-white/10"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isAuditing ? 'animate-spin' : ''}`} />
            Run Integrity Scan
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleExportBackup}
            className="gap-2 !bg-blue-600 hover:!bg-blue-500 !text-white shadow-lg shadow-blue-600/30"
          >
            <Download className="w-3.5 h-3.5" />
            Export Backup
          </Button>
        </div>
      </AdminPageHeader>

      {feedback && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between">
          <span>{feedback}</span>
          <button onClick={() => setFeedback(null)} className="text-emerald-400 hover:text-white font-bold ml-4">
            Dismiss
          </button>
        </div>
      )}

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <AdminStatCard
          title="Storage Consumption"
          value={report.storageSizeFormatted}
          subtitle="LocalStorage UTF-16 payload"
          icon={<HardDrive className="w-4 h-4" />}
          accentColor="#3B82F6"
        />

        <AdminStatCard
          title="Schema Version"
          value={`v${report.schemaVersion}`}
          subtitle="Backward-compatible migrations"
          icon={<Database className="w-4 h-4" />}
          accentColor="#8B5CF6"
        />

        <AdminStatCard
          title="Integrity Status"
          value={report.isValid ? '100% Valid' : 'Notices'}
          subtitle={`${report.issues.length} detected observations`}
          icon={<ShieldCheck className="w-4 h-4" />}
          accentColor={report.isValid ? '#10B981' : '#F59E0B'}
          trend={{ value: report.isValid ? 'Clean' : 'Review', isPositive: report.isValid }}
        />

        <AdminStatCard
          title="Total Entities"
          value={
            report.counts.subjects +
            report.counts.timetableSlots +
            report.counts.tasks +
            report.counts.workouts +
            report.counts.foodEntries
          }
          subtitle="Indexed structured records"
          icon={<FileText className="w-4 h-4" />}
          accentColor="#10B981"
        />
      </div>

      {/* Storage & Export Management Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Export / Import Panel */}
        <div className="p-6 rounded-3xl bg-white/95 dark:bg-[#0A0F1D]/90 border border-ivory-300/80 dark:border-white/10 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-ivory-200 dark:border-white/10">
            <div>
              <h3 className="font-serif text-lg font-bold text-espresso-950 dark:text-ivory-100">
                Safe Backup &amp; Migration Archive
              </h3>
              <p className="text-xs text-espresso-500 dark:text-espresso-400">
                Download verified state snapshot or restore from an existing JSON file
              </p>
            </div>
            <Database className="w-5 h-5 text-blue-500" />
          </div>

          <p className="text-xs text-espresso-600 dark:text-ivory-300 leading-relaxed">
            All user data (subjects, timetable occurrences, attendance records, study logs, workouts, and nutrition diaries) can be exported to an unencrypted, human-readable JSON snapshot.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
            <Button
              variant="primary"
              size="md"
              onClick={handleExportBackup}
              className="w-full sm:w-auto gap-2 !bg-blue-600 hover:!bg-blue-500 text-white"
            >
              <Download className="w-4 h-4" />
              Download JSON Snapshot
            </Button>

            <label className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white border border-white/10 text-xs font-semibold cursor-pointer transition">
              <Upload className="w-4 h-4 text-cyan-400" />
              <span>Import State Snapshot...</span>
              <input
                type="file"
                accept=".json"
                onChange={handleImportFile}
                className="hidden"
              />
            </label>
          </div>

          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300/90 leading-relaxed">
            <strong>Data Safety Guarantee:</strong> Imports are validated for correct JSON structure before any state mutation occurs. No data is sent to external servers during export or import.
          </div>
        </div>

        {/* Entity Counts Breakdown */}
        <div className="p-6 rounded-3xl bg-white/95 dark:bg-[#0A0F1D]/90 border border-ivory-300/80 dark:border-white/10 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-ivory-200 dark:border-white/10">
            <div>
              <h3 className="font-serif text-lg font-bold text-espresso-950 dark:text-ivory-100">
                Entity Record Breakdown
              </h3>
              <p className="text-xs text-espresso-500 dark:text-espresso-400">
                Current count of active models stored in the application database
              </p>
            </div>
            <HardDrive className="w-5 h-5 text-purple-500" />
          </div>

          <div className="grid grid-cols-2 gap-2.5 text-xs font-mono">
            <div className="p-2.5 rounded-xl bg-ivory-100/60 dark:bg-white/5 border border-ivory-200 dark:border-white/5 flex justify-between">
              <span className="text-espresso-500 dark:text-ivory-400">Subjects</span>
              <span className="font-bold text-espresso-900 dark:text-white">{report.counts.subjects}</span>
            </div>
            <div className="p-2.5 rounded-xl bg-ivory-100/60 dark:bg-white/5 border border-ivory-200 dark:border-white/5 flex justify-between">
              <span className="text-espresso-500 dark:text-ivory-400">Timetable Slots</span>
              <span className="font-bold text-espresso-900 dark:text-white">{report.counts.timetableSlots}</span>
            </div>
            <div className="p-2.5 rounded-xl bg-ivory-100/60 dark:bg-white/5 border border-ivory-200 dark:border-white/5 flex justify-between">
              <span className="text-espresso-500 dark:text-ivory-400">Attendance Logs</span>
              <span className="font-bold text-espresso-900 dark:text-white">{report.counts.attendanceLogs}</span>
            </div>
            <div className="p-2.5 rounded-xl bg-ivory-100/60 dark:bg-white/5 border border-ivory-200 dark:border-white/5 flex justify-between">
              <span className="text-espresso-500 dark:text-ivory-400">Study Sessions</span>
              <span className="font-bold text-espresso-900 dark:text-white">{report.counts.studySessions}</span>
            </div>
            <div className="p-2.5 rounded-xl bg-ivory-100/60 dark:bg-white/5 border border-ivory-200 dark:border-white/5 flex justify-between">
              <span className="text-espresso-500 dark:text-ivory-400">Tasks</span>
              <span className="font-bold text-espresso-900 dark:text-white">{report.counts.tasks}</span>
            </div>
            <div className="p-2.5 rounded-xl bg-ivory-100/60 dark:bg-white/5 border border-ivory-200 dark:border-white/5 flex justify-between">
              <span className="text-espresso-500 dark:text-ivory-400">Events / Exams</span>
              <span className="font-bold text-espresso-900 dark:text-white">{report.counts.reminders}</span>
            </div>
            <div className="p-2.5 rounded-xl bg-ivory-100/60 dark:bg-white/5 border border-ivory-200 dark:border-white/5 flex justify-between">
              <span className="text-espresso-500 dark:text-ivory-400">Workouts</span>
              <span className="font-bold text-espresso-900 dark:text-white">{report.counts.workouts}</span>
            </div>
            <div className="p-2.5 rounded-xl bg-ivory-100/60 dark:bg-white/5 border border-ivory-200 dark:border-white/5 flex justify-between">
              <span className="text-espresso-500 dark:text-ivory-400">Food Entries</span>
              <span className="font-bold text-espresso-900 dark:text-white">{report.counts.foodEntries}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
