import React from 'react';
import { Cloud, HardDrive, RefreshCw, AlertTriangle, ArrowRight, X } from 'lucide-react';
import { AppStateData } from '../../types';

interface SyncConflictModalProps {
  isOpen: boolean;
  userEmail: string;
  localData: AppStateData;
  cloudData: AppStateData;
  cloudUpdatedAt?: string;
  onKeepLocal: () => void;
  onLoadCloud: () => void;
  onMergeBoth: () => void;
  onCancel: () => void;
}

export const SyncConflictModal: React.FC<SyncConflictModalProps> = ({
  isOpen,
  userEmail,
  localData,
  cloudData,
  cloudUpdatedAt,
  onKeepLocal,
  onLoadCloud,
  onMergeBoth,
  onCancel,
}) => {
  if (!isOpen) return null;

  const localClassCount = (localData.timetable?.length || 0) + (localData.extraClasses?.length || 0);
  const cloudClassCount = (cloudData.timetable?.length || 0) + (cloudData.extraClasses?.length || 0);

  const localTaskCount = localData.tasks?.length || 0;
  const cloudTaskCount = cloudData.tasks?.length || 0;

  const localLogCount = localData.attendanceLogs?.length || 0;
  const cloudLogCount = cloudData.attendanceLogs?.length || 0;

  const localCourseCount = (localData.eduhubCourses || []).filter((c) => !c.isSample).length;
  const cloudCourseCount = (cloudData.eduhubCourses || []).filter((c) => !c.isSample).length;

  const formattedCloudDate = cloudUpdatedAt
    ? new Date(cloudUpdatedAt).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'Unknown date';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="conflict-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-lg bg-white dark:bg-espresso-900 rounded-2xl shadow-2xl border border-ivory-300 dark:border-espresso-750 p-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-ochre-50 dark:bg-ochre-950/40 text-ochre-600 dark:text-ochre-400 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 id="conflict-dialog-title" className="text-base font-semibold text-espresso-950 dark:text-ivory-50">
                Sync Conflict Detected
              </h3>
              <p className="text-xs text-espresso-500 dark:text-ivory-400">
                Account: {userEmail}
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            aria-label="Close dialog"
            className="p-1 rounded-lg text-espresso-400 hover:text-espresso-700 dark:hover:text-ivory-200 hover:bg-ivory-100 dark:hover:bg-espresso-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-espresso-600 dark:text-ivory-300">
          We found existing data on this browser and in your cloud backup. Choose how you would like to synchronize:
        </p>

        {/* Comparison Cards */}
        <div className="grid grid-cols-2 gap-3 text-xs">
          {/* Local Device */}
          <div className="p-3.5 rounded-xl bg-ivory-100/70 dark:bg-espresso-850 border border-ivory-300 dark:border-espresso-750 space-y-2">
            <div className="flex items-center gap-2 font-semibold text-espresso-950 dark:text-ivory-50">
              <HardDrive className="w-4 h-4 text-terracotta-500" />
              <span>This Device (Local)</span>
            </div>
            <ul className="space-y-1 text-espresso-600 dark:text-ivory-400 font-mono text-[11px]">
              <li>• {localClassCount} Classes</li>
              <li>• {localTaskCount} Tasks</li>
              <li>• {localLogCount} Attendance Logs</li>
              {(localCourseCount > 0 || cloudCourseCount > 0) && (
                <li>• {localCourseCount} EduHub Courses</li>
              )}
              <li className="text-[10px] text-espresso-400 italic">Current Session</li>
            </ul>
          </div>

          {/* Cloud Storage */}
          <div className="p-3.5 rounded-xl bg-ivory-100/70 dark:bg-espresso-850 border border-ivory-300 dark:border-espresso-750 space-y-2">
            <div className="flex items-center gap-2 font-semibold text-espresso-950 dark:text-ivory-50">
              <Cloud className="w-4 h-4 text-dusty-blue-500" />
              <span>Google Cloud Sync</span>
            </div>
            <ul className="space-y-1 text-espresso-600 dark:text-ivory-400 font-mono text-[11px]">
              <li>• {cloudClassCount} Classes</li>
              <li>• {cloudTaskCount} Tasks</li>
              <li>• {cloudLogCount} Attendance Logs</li>
              {(localCourseCount > 0 || cloudCourseCount > 0) && (
                <li>• {cloudCourseCount} EduHub Courses</li>
              )}
              <li className="text-[10px] text-espresso-400">Saved: {formattedCloudDate}</li>
            </ul>
          </div>
        </div>

        {/* 4 Resolution Options */}
        <div className="space-y-2 pt-1">
          {/* Option 1: Merge Both */}
          <button
            onClick={onMergeBoth}
            className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold bg-terracotta-600 hover:bg-terracotta-700 text-white shadow-subtle transition flex items-center justify-between cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4" />
              <div className="text-left">
                <span className="block font-bold">Merge Both Datasets (Recommended)</span>
                <span className="text-[10px] opacity-90 font-normal">Combines classes, tasks, and notes without losing anything</span>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 shrink-0" />
          </button>

          {/* Option 2: Keep Local */}
          <button
            onClick={onKeepLocal}
            className="w-full py-2.5 px-4 rounded-xl text-xs font-medium bg-ivory-100 dark:bg-espresso-800 hover:bg-ivory-200 dark:hover:bg-espresso-750 text-espresso-900 dark:text-ivory-100 border border-ivory-300 dark:border-espresso-700 transition flex items-center justify-between cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-terracotta-500" />
              <div className="text-left">
                <span className="font-semibold block">Keep Local & Overwrite Cloud</span>
                <span className="text-[10px] text-espresso-500 dark:text-ivory-400 font-normal">Uploads this device's data to your Google account</span>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-espresso-400 shrink-0" />
          </button>

          {/* Option 3: Load Cloud */}
          <button
            onClick={onLoadCloud}
            className="w-full py-2.5 px-4 rounded-xl text-xs font-medium bg-ivory-100 dark:bg-espresso-800 hover:bg-ivory-200 dark:hover:bg-espresso-750 text-espresso-900 dark:text-ivory-100 border border-ivory-300 dark:border-espresso-700 transition flex items-center justify-between cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Cloud className="w-4 h-4 text-dusty-blue-500" />
              <div className="text-left">
                <span className="font-semibold block">Load Cloud & Replace Local</span>
                <span className="text-[10px] text-espresso-500 dark:text-ivory-400 font-normal">Restores your saved cloud backup onto this device</span>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-espresso-400 shrink-0" />
          </button>

          {/* Option 4: Cancel */}
          <button
            onClick={onCancel}
            className="w-full py-2 px-4 rounded-xl text-xs font-medium text-espresso-500 hover:text-espresso-800 dark:hover:text-ivory-200 hover:bg-ivory-100 dark:hover:bg-espresso-850 transition cursor-pointer"
          >
            Cancel and stay in offline/local mode
          </button>
        </div>
      </div>
    </div>
  );
};

