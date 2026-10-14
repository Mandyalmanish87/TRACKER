import React, { useState } from 'react';
import {
  X,
  RotateCcw,
  Ban,
} from 'lucide-react';
import { ResolvedCalendarEvent } from '../../types';

interface ClassOccurrenceModalProps {
  event: ResolvedCalendarEvent | null;
  subjectName?: string;
  subjectCode?: string;
  subjectColor?: string;
  isOpen: boolean;
  onClose: () => void;
  onRescheduleOccurrence: (
    slotId: string,
    originalDate: string,
    newDate: string,
    newStartTime?: string,
    newEndTime?: string,
    newRoom?: string,
    newNotes?: string
  ) => void;
  onCancelOccurrence: (slotId: string, originalDate: string) => void;
  onRestoreOccurrence: (slotId: string, originalDate: string) => void;
  onDeleteSlot?: (slotId: string) => void;
}

export const ClassOccurrenceModal: React.FC<ClassOccurrenceModalProps> = ({
  event,
  subjectName,
  subjectCode,
  subjectColor = '#C45532',
  isOpen,
  onClose,
  onRescheduleOccurrence,
  onCancelOccurrence,
  onRestoreOccurrence,
  onDeleteSlot: _onDeleteSlot,
}) => {
  if (!isOpen || !event) return null;

  const [mode, setMode] = useState<'view' | 'reschedule'>('view');
  const [newDate, setNewDate] = useState(event.date);
  const [newStartTime, setNewStartTime] = useState(event.startTime);
  const [newEndTime, setNewEndTime] = useState(event.endTime);
  const [newRoom, setNewRoom] = useState(event.room || '');
  const [newNotes, setNewNotes] = useState(event.notes || '');
  const [errorMessage, setErrorMessage] = useState('');

  const isRescheduled = event.source === 'rescheduled';
  const isCancelled = Boolean(event.isCancelled);
  const isRecurring = Boolean(event.slotId);

  const handleRescheduleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (newStartTime >= newEndTime) {
      setErrorMessage('End time must be after start time.');
      return;
    }

    if (!newDate) {
      setErrorMessage('Please select a valid date.');
      return;
    }

    if (!event.slotId) return;

    // Use original scheduled date if this is already an override, or the event date
    const origDate = event.occurrenceKey.split('::')[1] || event.date;

    onRescheduleOccurrence(
      event.slotId,
      origDate,
      newDate,
      newStartTime,
      newEndTime,
      newRoom.trim() || undefined,
      newNotes.trim() || undefined
    );

    onClose();
  };

  const handleCancelClick = () => {
    if (!event.slotId) return;
    const origDate = event.occurrenceKey.split('::')[1] || event.date;
    onCancelOccurrence(event.slotId, origDate);
    onClose();
  };

  const handleRestoreClick = () => {
    if (!event.slotId) return;
    const origDate = event.occurrenceKey.split('::')[1] || event.date;
    onRestoreOccurrence(event.slotId, origDate);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-espresso-950/40 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white dark:bg-espresso-900 rounded-2xl border border-ivory-300 dark:border-espresso-700 p-6 shadow-xl space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span
              className="w-3.5 h-3.5 rounded-full shrink-0"
              style={{ backgroundColor: subjectColor }}
            />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono uppercase tracking-wider font-bold text-espresso-500">
                  {event.date}
                </span>
                {isRescheduled && (
                  <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-ochre-100 dark:bg-ochre-900/40 text-ochre-700 dark:text-ochre-300">
                    Rescheduled Only
                  </span>
                )}
                {isCancelled && (
                  <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300">
                    Cancelled
                  </span>
                )}
                {event.source === 'extra' && (
                  <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-dusty-blue-100 text-dusty-blue-700">
                    Extra Class
                  </span>
                )}
              </div>
              <h3 className="font-serif text-lg font-bold text-espresso-950 dark:text-ivory-50">
                {subjectName || 'Class Details'}
              </h3>
            </div>
          </div>
          <button onClick={onClose} className="text-espresso-400 hover:text-espresso-700">
            <X className="w-4 h-4" />
          </button>
        </div>

        {mode === 'view' ? (
          <>
            {/* Occurrence Details Card */}
            <div className="p-4 rounded-xl bg-ivory-50 dark:bg-espresso-850 border border-ivory-200 dark:border-espresso-800 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-espresso-500 font-mono">Date:</span>
                <span className="font-mono font-bold text-espresso-900 dark:text-ivory-100">
                  {event.date}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-espresso-500 font-mono">Scheduled Time:</span>
                <span className="font-mono font-bold text-espresso-900 dark:text-ivory-100">
                  {event.startTime} — {event.endTime}
                </span>
              </div>
              {subjectCode && (
                <div className="flex items-center justify-between">
                  <span className="text-espresso-500 font-mono">Course Code:</span>
                  <span className="font-mono font-bold text-espresso-900 dark:text-ivory-100">
                    {subjectCode}
                  </span>
                </div>
              )}
              {event.room && (
                <div className="flex items-center justify-between">
                  <span className="text-espresso-500 font-mono">Location:</span>
                  <span className="font-semibold text-espresso-900 dark:text-ivory-100">
                    {event.room}
                  </span>
                </div>
              )}
              {event.instructor && (
                <div className="flex items-center justify-between">
                  <span className="text-espresso-500 font-mono">Instructor:</span>
                  <span className="font-semibold text-espresso-900 dark:text-ivory-100">
                    {event.instructor}
                  </span>
                </div>
              )}
              {event.notes && (
                <div className="pt-1 border-t border-ivory-200 dark:border-espresso-800">
                  <span className="text-espresso-500 block mb-0.5 font-mono">Notes:</span>
                  <p className="italic text-espresso-800 dark:text-ivory-200">{event.notes}</p>
                </div>
              )}
            </div>

            {/* Explanation banner */}
            {isRecurring && !isCancelled && (
              <p className="text-[11px] text-espresso-500 dark:text-espresso-400 italic">
                💡 Rescheduling or cancelling this occurrence will change ONLY this specific date ({event.date}). All other weekly recurring classes will remain unchanged.
              </p>
            )}

            {/* Action buttons */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-ivory-200 dark:border-espresso-800">
              <div className="flex items-center gap-1.5">
                {isCancelled ? (
                  <button
                    onClick={handleRestoreClick}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-sage-300 dark:border-sage-700 text-sage-700 dark:text-sage-300 text-xs font-semibold hover:bg-sage-50"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Restore Class
                  </button>
                ) : isRecurring ? (
                  <button
                    onClick={handleCancelClick}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-rose-200 dark:border-rose-900 text-rose-600 text-xs font-semibold hover:bg-rose-50"
                  >
                    <Ban className="w-3.5 h-3.5" /> Cancel for {event.date}
                  </button>
                ) : null}
              </div>

              <div className="flex items-center gap-2">
                {isRecurring && !isCancelled && (
                  <button
                    onClick={() => setMode('reschedule')}
                    className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-xl text-white text-xs font-semibold shadow-subtle"
                    style={{ backgroundColor: 'var(--accent)' }}
                  >
                    Reschedule This Date Only
                  </button>
                )}
              </div>
            </div>
          </>
        ) : (
          /* Reschedule Form */
          <form onSubmit={handleRescheduleSubmit} className="space-y-3.5">
            <div className="p-3 rounded-xl bg-ivory-100 dark:bg-espresso-800 text-[11px] text-espresso-700 dark:text-ivory-200 space-y-1">
              <p className="font-semibold text-terracotta-600 dark:text-terracotta-400">
                Single-Occurrence Reschedule
              </p>
              <p>
                Move the class scheduled for <span className="font-bold">{event.date}</span> to a new date and time.
                The recurring schedule for other weeks will remain untouched.
              </p>
            </div>

            {errorMessage && (
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                {errorMessage}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-espresso-700 dark:text-espresso-300 mb-1 uppercase font-mono">
                New Date
              </label>
              <input
                type="date"
                required
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-ivory-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-850 text-xs text-espresso-950 dark:text-ivory-50"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-espresso-700 dark:text-espresso-300 mb-1 uppercase font-mono">
                  Start Time
                </label>
                <input
                  type="time"
                  required
                  value={newStartTime}
                  onChange={(e) => setNewStartTime(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-ivory-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-850 text-xs text-espresso-950 dark:text-ivory-50"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-espresso-700 dark:text-espresso-300 mb-1 uppercase font-mono">
                  End Time
                </label>
                <input
                  type="time"
                  required
                  value={newEndTime}
                  onChange={(e) => setNewEndTime(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-ivory-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-850 text-xs text-espresso-950 dark:text-ivory-50"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-espresso-700 dark:text-espresso-300 mb-1 uppercase font-mono">
                Room / Location (Optional)
              </label>
              <input
                type="text"
                value={newRoom}
                onChange={(e) => setNewRoom(e.target.value)}
                placeholder="e.g. Lab 2B, Auditorium"
                className="w-full px-3 py-2 rounded-xl border border-ivory-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-850 text-xs text-espresso-950 dark:text-ivory-50"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-espresso-700 dark:text-espresso-300 mb-1 uppercase font-mono">
                Notes (Optional)
              </label>
              <input
                type="text"
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                placeholder="e.g. Rescheduled due to holiday"
                className="w-full px-3 py-2 rounded-xl border border-ivory-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-850 text-xs text-espresso-950 dark:text-ivory-50"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setMode('view')}
                className="px-4 py-2 text-xs font-semibold rounded-xl border border-ivory-300 dark:border-espresso-700 text-espresso-600"
              >
                Back
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold rounded-xl text-white shadow-subtle"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                Save Rescheduled Occurrence
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
