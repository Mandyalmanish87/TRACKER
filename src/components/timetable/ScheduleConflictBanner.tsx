import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { ScheduleConflict } from '../../utils/scheduleResolver';

interface ScheduleConflictBannerProps {
  conflicts: ScheduleConflict[];
  message?: string;
  className?: string;
}

export const ScheduleConflictBanner: React.FC<ScheduleConflictBannerProps> = ({
  conflicts,
  message = 'This proposed time overlaps with existing class',
  className = '',
}) => {
  if (conflicts.length === 0) return null;

  return (
    <div
      role="alert"
      aria-live="polite"
      className={`p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-200 text-xs space-y-1.5 ${className}`}
    >
      <div className="flex items-center gap-1.5 font-semibold text-amber-800 dark:text-amber-300">
        <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
        <span>
          Schedule Conflict{conflicts.length > 1 ? 's' : ''} Detected ({conflicts.length})
        </span>
      </div>
      <p className="text-[11px] text-amber-800/90 dark:text-amber-300/90">
        {message}
        {conflicts.length > 1 ? 'es' : ''}:
      </p>
      <ul className="list-disc list-inside space-y-0.5 text-[11px] font-mono pl-1">
        {conflicts.map((c, i) => (
          <li key={c.event.occurrenceKey || `${c.startTime}-${c.endTime}-${i}`}>
            <span className="font-sans font-medium text-amber-950 dark:text-ivory-100">
              {c.subjectName || c.subjectCode || 'Scheduled Class'}
            </span>{' '}
            {c.subjectCode && c.subjectName ? `(${c.subjectCode}) ` : ''}
            <span>
              [{c.startTime} — {c.endTime}]
            </span>
          </li>
        ))}
      </ul>
      <p className="text-[10px] text-amber-700 dark:text-amber-400 italic pt-0.5">
        You can still proceed if this overlap is intentional (e.g. combined or alternate session).
      </p>
    </div>
  );
};

