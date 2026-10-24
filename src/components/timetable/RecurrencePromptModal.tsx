import React, { useMemo } from 'react';
import { Calendar, Clock, ArrowRight, X } from 'lucide-react';
import { useOptionalApp } from '../../context/AppContext';
import { findScheduleConflicts } from '../../utils/scheduleResolver';
import { ScheduleConflictBanner } from './ScheduleConflictBanner';
import { TimetableSlot, OccurrenceOverride, ExtraClass, Subject } from '../../types';

export interface RescheduleProposal {
  slotId?: string;
  extraClassId?: string;
  occurrenceKey?: string;
  title: string;
  originalDate: string;
  newDate: string;
  originalStartTime: string;
  newStartTime: string;
  originalEndTime: string;
  newEndTime: string;
  newDayOfWeek: number;
}

interface RecurrencePromptModalProps {
  isOpen: boolean;
  proposal: RescheduleProposal | null;
  onConfirmSingle: (proposal: RescheduleProposal) => void;
  onConfirmAll: (proposal: RescheduleProposal) => void;
  onCancel: () => void;
  timetable?: TimetableSlot[];
  overrides?: OccurrenceOverride[];
  extraClasses?: ExtraClass[];
  subjects?: Subject[];
}

export const RecurrencePromptModal: React.FC<RecurrencePromptModalProps> = ({
  isOpen,
  proposal,
  onConfirmSingle,
  onConfirmAll,
  onCancel,
  timetable: propTimetable,
  overrides: propOverrides,
  extraClasses: propExtraClasses,
  subjects: propSubjects,
}) => {
  if (!isOpen || !proposal) return null;

  const app = useOptionalApp();
  const timetable = propTimetable ?? app?.state.timetable ?? [];
  const overrides = propOverrides ?? app?.state.occurrenceOverrides ?? [];
  const extraClasses = propExtraClasses ?? app?.state.extraClasses ?? [];
  const subjects = propSubjects ?? app?.state.subjects ?? [];

  const conflicts = useMemo(() => {
    if (!isOpen || !proposal || !proposal.newDate || !proposal.newStartTime || !proposal.newEndTime) return [];
    return findScheduleConflicts({
      date: proposal.newDate,
      startTime: proposal.newStartTime,
      endTime: proposal.newEndTime,
      timetable,
      overrides,
      extraClasses,
      subjects,
      ignoreEvent: {
        slotId: proposal.slotId,
        extraClassId: proposal.extraClassId,
        occurrenceKey: proposal.occurrenceKey,
      },
    });
  }, [isOpen, proposal, timetable, overrides, extraClasses, subjects]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="recurrence-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-md bg-white dark:bg-espresso-900 rounded-2xl shadow-2xl border border-ivory-300 dark:border-espresso-750 p-6 space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-terracotta-50 dark:bg-terracotta-950/40 text-terracotta-600 dark:text-terracotta-400 flex items-center justify-center">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 id="recurrence-modal-title" className="text-base font-semibold text-espresso-950 dark:text-ivory-50">
                Reschedule Recurring Class
              </h3>
              <p className="text-xs text-espresso-500 dark:text-ivory-400">
                {proposal.title}
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

        {/* Change Comparison */}
        <div className="p-3.5 rounded-xl bg-ivory-100 dark:bg-espresso-850 border border-ivory-200 dark:border-espresso-800 space-y-2 text-xs">
          <div className="flex items-center justify-between text-espresso-600 dark:text-ivory-300">
            <span className="font-medium">Original</span>
            <span className="font-mono">
              {proposal.originalDate} ({proposal.originalStartTime} - {proposal.originalEndTime})
            </span>
          </div>
          <div className="flex items-center justify-center text-terracotta-600 dark:text-terracotta-400">
            <ArrowRight className="w-4 h-4" />
          </div>
          <div className="flex items-center justify-between font-semibold text-espresso-950 dark:text-ivory-50">
            <span>New Schedule</span>
            <span className="font-mono text-terracotta-600 dark:text-terracotta-400">
              {proposal.newDate} ({proposal.newStartTime} - {proposal.newEndTime})
            </span>
          </div>
        </div>

        {conflicts.length > 0 && (
          <ScheduleConflictBanner
            conflicts={conflicts}
            message="The target time slot overlaps with existing class"
          />
        )}

        <p className="text-xs text-espresso-600 dark:text-ivory-300">
          This class is part of a weekly recurring schedule. How would you like to apply this change?
        </p>

        {/* Action Buttons */}
        <div className="space-y-2 pt-1">
          <button
            onClick={() => onConfirmSingle(proposal)}
            className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold bg-terracotta-600 hover:bg-terracotta-700 text-white shadow-subtle transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <Clock className="w-4 h-4" />
            <span>This occurrence only ({proposal.originalDate})</span>
          </button>

          <button
            onClick={() => onConfirmAll(proposal)}
            className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold bg-ivory-200 dark:bg-espresso-800 hover:bg-ivory-300 dark:hover:bg-espresso-750 text-espresso-900 dark:text-ivory-100 transition flex items-center justify-center gap-2 cursor-pointer border border-ivory-300 dark:border-espresso-700"
          >
            <Calendar className="w-4 h-4" />
            <span>All future occurrences (Change master schedule)</span>
          </button>

          <button
            onClick={onCancel}
            className="w-full py-2 px-4 rounded-xl text-xs font-medium text-espresso-500 hover:text-espresso-800 dark:hover:text-ivory-200 hover:bg-ivory-100 dark:hover:bg-espresso-850 transition cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
