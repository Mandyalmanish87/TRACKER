import React, { useState, useMemo } from 'react';
import {
  Flame,
  Target,
  CheckCircle2,
  Plus,
  Trash2,
  Edit2,
  Calendar,
  AlertCircle,
  HelpCircle,
  TrendingUp,
  X,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { DailyQuestionEntry } from '../../types';
import {
  calculateDailyQuestionStats,
  validateQuestionEntry,
} from '../../utils/dailyQuestionsUtils';
import { ConfirmModal } from '../common/ConfirmModal';

export const DailyQuestionsPanel: React.FC = () => {
  const {
    state,
    addDailyQuestionEntry,
    updateDailyQuestionEntry,
    deleteDailyQuestionEntry,
    setDailyQuestionTarget,
  } = useApp();

  const entries = state.dailyQuestions || [];
  const target = state.dailyQuestionTarget ?? 25;
  const subjects = state.subjects || [];

  // Compute live stats and streaks
  const stats = useMemo(() => {
    return calculateDailyQuestionStats(entries, target, new Date());
  }, [entries, target]);

  // Modal / Form state for logging or editing
  const [showLogModal, setShowLogModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<DailyQuestionEntry | null>(null);

  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [subjectId, setSubjectId] = useState('');
  const [attempted, setAttempted] = useState<number | ''>(20);
  const [correct, setCorrect] = useState<number | ''>(15);
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Target editing state
  const [showTargetModal, setShowTargetModal] = useState(false);
  const [customTarget, setCustomTarget] = useState(target);

  // Delete entry state
  const [entryToDelete, setEntryToDelete] = useState<DailyQuestionEntry | null>(null);

  const openLogModal = (entryToEdit?: DailyQuestionEntry) => {
    setFormError(null);
    if (entryToEdit) {
      setEditingEntry(entryToEdit);
      setDate(entryToEdit.date);
      setSubjectId(entryToEdit.subjectId || '');
      setAttempted(entryToEdit.attempted);
      setCorrect(entryToEdit.correct);
      setNotes(entryToEdit.notes || '');
    } else {
      setEditingEntry(null);
      setDate(new Date().toISOString().split('T')[0]);
      setSubjectId('');
      setAttempted(20);
      setCorrect(15);
      setNotes('');
    }
    setShowLogModal(true);
  };

  const handleSaveEntry = (e: React.FormEvent) => {
    e.preventDefault();

    const attemptedNum = Number(attempted);
    const correctNum = Number(correct);

    const validation = validateQuestionEntry(attemptedNum, correctNum);
    if (!validation.valid) {
      setFormError(validation.error || 'Please enter valid numbers.');
      return;
    }

    if (!date) {
      setFormError('Please select a valid date.');
      return;
    }

    // Check duplicate warning: if logging a new entry for same date & subject
    if (!editingEntry && subjectId) {
      const duplicate = entries.find((e) => e.date === date && e.subjectId === subjectId);
      if (duplicate) {
        setFormError(
          'An entry for this subject on this date already exists. You can edit the existing entry below or log without subject.'
        );
        return;
      }
    }

    const selectedSubject = subjects.find((s) => s.id === subjectId);
    const subjectName = selectedSubject ? selectedSubject.name : undefined;

    if (editingEntry) {
      updateDailyQuestionEntry(editingEntry.id, {
        date,
        subjectId: subjectId || undefined,
        subjectName,
        attempted: attemptedNum,
        correct: correctNum,
        notes: notes.trim() || undefined,
      });
    } else {
      addDailyQuestionEntry({
        date,
        subjectId: subjectId || undefined,
        subjectName,
        attempted: attemptedNum,
        correct: correctNum,
        notes: notes.trim() || undefined,
      });
    }

    setShowLogModal(false);
    setEditingEntry(null);
    setFormError(null);
  };

  // Group entries chronologically (newest first)
  const sortedEntries = useMemo(() => {
    return [...entries].sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0));
  }, [entries]);

  return (
    <div className="space-y-6">
      {/* Editorial Headline & Daily Metrics Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 sm:gap-4">
        {/* Metric 1: Today's Questions Attempted vs Target */}
        <div className="p-4 sm:p-5 rounded-2xl border border-ivory-300 dark:border-espresso-750 bg-white dark:bg-espresso-850 shadow-subtle">
          <div className="flex items-center justify-between text-espresso-500 dark:text-espresso-400 mb-2">
            <span className="text-xs font-semibold uppercase font-mono tracking-wider">Today's Practice</span>
            <Target className="w-4 h-4 text-terracotta-500" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="font-serif tabular-nums text-2xl sm:text-3xl font-bold text-espresso-950 dark:text-ivory-50">
              {stats.todayAttempted}
            </span>
            <span className="text-xs text-espresso-400 font-mono">/ {stats.todayTarget} target</span>
          </div>
          <div className="mt-2 w-full bg-ivory-200 dark:bg-espresso-800 h-1.5 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                stats.todayMetTarget ? 'bg-sage-500' : 'bg-terracotta-500'
              }`}
              style={{ width: `${stats.todayProgressPct}%` }}
            />
          </div>
        </div>

        {/* Metric 2: Today's Accuracy */}
        <div className="p-4 sm:p-5 rounded-2xl border border-ivory-300 dark:border-espresso-750 bg-white dark:bg-espresso-850 shadow-subtle">
          <div className="flex items-center justify-between text-espresso-500 dark:text-espresso-400 mb-2">
            <span className="text-xs font-semibold uppercase font-mono tracking-wider">Today's Accuracy</span>
            <CheckCircle2 className="w-4 h-4 text-sage-500" />
          </div>
          <p className="font-serif tabular-nums text-2xl sm:text-3xl font-bold text-espresso-950 dark:text-ivory-50">
            {stats.todayAccuracy}%
          </p>
          <p className="text-xs text-espresso-400 dark:text-espresso-500 mt-1 font-medium">
            {stats.todayCorrect} correct of {stats.todayAttempted}
          </p>
        </div>

        {/* Metric 3: Current Daily Streak */}
        <div className="p-4 sm:p-5 rounded-2xl border border-ivory-300 dark:border-espresso-750 bg-white dark:bg-espresso-850 shadow-subtle">
          <div className="flex items-center justify-between text-espresso-500 dark:text-espresso-400 mb-2">
            <span className="text-xs font-semibold uppercase font-mono tracking-wider">Target Streak</span>
            <Flame className="w-4 h-4 text-amber-500" />
          </div>
          <p className="font-serif tabular-nums text-2xl sm:text-3xl font-bold text-espresso-950 dark:text-ivory-50">
            {stats.currentStreak}d
          </p>
          <p className="text-xs text-espresso-400 dark:text-espresso-500 mt-1 font-medium">
            {stats.todayMetTarget ? 'Today completed' : `Needs ${Math.max(0, stats.todayTarget - stats.todayAttempted)} more`}
          </p>
        </div>

        {/* Metric 4: Longest Streak & Target Config */}
        <div className="p-4 sm:p-5 rounded-2xl border border-ivory-300 dark:border-espresso-750 bg-white dark:bg-espresso-850 shadow-subtle">
          <div className="flex items-center justify-between text-espresso-500 dark:text-espresso-400 mb-2">
            <span className="text-xs font-semibold uppercase font-mono tracking-wider">Best Streak</span>
            <TrendingUp className="w-4 h-4 text-ochre-500" />
          </div>
          <p className="font-serif tabular-nums text-2xl sm:text-3xl font-bold text-espresso-950 dark:text-ivory-50">
            {stats.longestStreak}d
          </p>
          <button
            onClick={() => {
              setCustomTarget(target);
              setShowTargetModal(true);
            }}
            className="text-[11px] font-medium text-terracotta-600 dark:text-terracotta-400 hover:underline mt-1 block"
          >
            Adjust target ({target} q/day) ›
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl border border-ivory-300 dark:border-espresso-750 bg-white dark:bg-espresso-850 shadow-subtle">
        <div>
          <h3 className="font-serif text-base font-bold text-espresso-950 dark:text-ivory-50">
            Practice Question History & Logs
          </h3>
          <p className="text-xs text-espresso-500 dark:text-espresso-400 mt-0.5">
            Log coursework problem sets, quiz practice, or textbook exercises with empirical accuracy.
          </p>
        </div>

        <button
          onClick={() => openLogModal()}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white shadow-subtle transition"
          style={{ backgroundColor: 'var(--accent)' }}
        >
          <Plus className="w-3.5 h-3.5" /> Log Questions
        </button>
      </div>

      {/* Questions Ledger */}
      {sortedEntries.length === 0 ? (
        <div className="py-12 text-center border border-dashed border-ivory-300 dark:border-espresso-750 rounded-2xl bg-white/40 dark:bg-espresso-850/40">
          <HelpCircle className="w-8 h-8 text-espresso-400 mx-auto mb-2" />
          <h4 className="font-serif text-sm font-semibold text-espresso-950 dark:text-ivory-100">
            No question practice logged yet
          </h4>
          <p className="text-xs text-espresso-500 dark:text-espresso-400 mt-1 mb-3">
            Track daily practice problems to build an empirical streak toward your targets.
          </p>
          <button
            onClick={() => openLogModal()}
            className="text-xs font-semibold text-terracotta-600 dark:text-terracotta-400 hover:underline inline-flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" /> Log your first practice session
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-ivory-300 dark:border-espresso-750 bg-white dark:bg-espresso-850 shadow-subtle">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-ivory-200 dark:border-espresso-800 bg-ivory-50/60 dark:bg-espresso-900/40 text-espresso-500 dark:text-espresso-400 uppercase font-mono font-semibold text-[10px] tracking-wider">
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Subject</th>
                <th className="py-3 px-4 text-center">Attempted</th>
                <th className="py-3 px-4 text-center">Correct</th>
                <th className="py-3 px-4 text-center">Accuracy</th>
                <th className="py-3 px-4">Notes</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ivory-200 dark:divide-espresso-800">
              {sortedEntries.map((entry) => {
                const acc =
                  entry.attempted > 0 ? Math.round((entry.correct / entry.attempted) * 100) : 0;
                return (
                  <tr
                    key={entry.id}
                    className="hover:bg-ivory-50/50 dark:hover:bg-espresso-800/40 transition"
                  >
                    <td className="py-3 px-4 font-mono font-medium text-espresso-900 dark:text-ivory-100">
                      {entry.date}
                    </td>
                    <td className="py-3 px-4 font-medium text-espresso-700 dark:text-ivory-200">
                      {entry.subjectName || (
                        <span className="text-espresso-400 italic">General Practice</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-bold text-espresso-950 dark:text-ivory-50">
                      {entry.attempted}
                    </td>
                    <td className="py-3 px-4 text-center font-mono text-sage-700 dark:text-sage-400 font-semibold">
                      {entry.correct}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-block font-mono font-bold px-2 py-0.5 rounded-full text-[11px] ${
                          acc >= 80
                            ? 'bg-sage-100 dark:bg-sage-950 text-sage-700 dark:text-sage-300'
                            : acc >= 50
                            ? 'bg-ochre-100 dark:bg-ochre-950 text-ochre-700 dark:text-ochre-300'
                            : 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
                        }`}
                      >
                        {acc}%
                      </span>
                    </td>
                    <td className="py-3 px-4 text-espresso-500 dark:text-espresso-400 text-xs italic max-w-xs truncate">
                      {entry.notes || '—'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openLogModal(entry)}
                          className="p-1 rounded-lg text-espresso-400 hover:text-espresso-700 dark:hover:text-ivory-200 hover:bg-ivory-100 transition"
                          title="Edit entry"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setEntryToDelete(entry)}
                          className="p-1 rounded-lg text-espresso-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition"
                          title="Delete entry"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Log / Edit Modal */}
      {showLogModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-espresso-950/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white dark:bg-espresso-900 rounded-2xl border border-ivory-300 dark:border-espresso-700 shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-ivory-200 dark:border-espresso-800">
              <h3 className="font-serif text-base font-bold text-espresso-950 dark:text-ivory-50">
                {editingEntry ? 'Edit Question Log' : 'Log Daily Questions'}
              </h3>
              <button
                onClick={() => setShowLogModal(false)}
                className="text-espresso-400 hover:text-espresso-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEntry} className="space-y-3.5">
              {formError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Date */}
              <div>
                <label className="block text-xs font-semibold text-espresso-700 dark:text-ivory-200 mb-1 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-espresso-400" /> Date
                </label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-ivory-300 dark:border-espresso-750 bg-ivory-50 dark:bg-espresso-800 text-espresso-950 dark:text-ivory-50 font-mono"
                />
              </div>

              {/* Subject */}
              <div>
                <label className="block text-xs font-semibold text-espresso-700 dark:text-ivory-200 mb-1">
                  Subject (Optional)
                </label>
                <select
                  value={subjectId}
                  onChange={(e) => setSubjectId(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-ivory-300 dark:border-espresso-750 bg-ivory-50 dark:bg-espresso-800 text-espresso-950 dark:text-ivory-50"
                >
                  <option value="">-- General / Coursework --</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                </select>
              </div>

              {/* Counts Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-espresso-700 dark:text-ivory-200 mb-1">
                    Attempted <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    required
                    value={attempted}
                    onChange={(e) =>
                      setAttempted(e.target.value === '' ? '' : parseInt(e.target.value, 10))
                    }
                    className="w-full px-3 py-2 text-xs rounded-xl border border-ivory-300 dark:border-espresso-750 bg-ivory-50 dark:bg-espresso-800 text-espresso-950 dark:text-ivory-50 font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-espresso-700 dark:text-ivory-200 mb-1">
                    Correct Answers <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    required
                    value={correct}
                    onChange={(e) =>
                      setCorrect(e.target.value === '' ? '' : parseInt(e.target.value, 10))
                    }
                    className="w-full px-3 py-2 text-xs rounded-xl border border-ivory-300 dark:border-espresso-750 bg-ivory-50 dark:bg-espresso-800 text-espresso-950 dark:text-ivory-50 font-mono font-bold text-sage-600 dark:text-sage-400"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-espresso-700 dark:text-ivory-200 mb-1">
                  Topic or Notes (Optional)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Chapter 3 exercise 4, dynamic programming"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-ivory-300 dark:border-espresso-750 bg-ivory-50 dark:bg-espresso-800 text-espresso-950 dark:text-ivory-50"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-ivory-200 dark:border-espresso-800">
                <button
                  type="button"
                  onClick={() => setShowLogModal(false)}
                  className="px-3.5 py-1.5 text-xs rounded-xl border border-ivory-300 dark:border-espresso-750 text-espresso-600 dark:text-espresso-300 hover:bg-ivory-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold rounded-xl text-white shadow-subtle"
                  style={{ backgroundColor: 'var(--accent)' }}
                >
                  {editingEntry ? 'Save Changes' : 'Log Questions'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Target Modal */}
      {showTargetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-espresso-950/60 backdrop-blur-sm">
          <div className="w-full max-w-xs bg-white dark:bg-espresso-900 rounded-2xl border border-ivory-300 dark:border-espresso-700 p-5 shadow-xl space-y-4">
            <h4 className="font-serif text-base font-bold text-espresso-950 dark:text-ivory-50">
              Configure Daily Target
            </h4>
            <p className="text-xs text-espresso-500 dark:text-espresso-400">
              Number of practice questions required per day to qualify for a streak.
            </p>
            <div>
              <label className="block text-xs font-semibold text-espresso-700 dark:text-ivory-200 mb-1">
                Target Questions / Day
              </label>
              <input
                type="number"
                min="1"
                step="1"
                value={customTarget}
                onChange={(e) => setCustomTarget(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="w-full px-3 py-2 text-xs rounded-xl border border-ivory-300 dark:border-espresso-750 bg-ivory-50 dark:bg-espresso-800 text-espresso-950 dark:text-ivory-50 font-mono font-bold"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowTargetModal(false)}
                className="px-3.5 py-1.5 text-xs rounded-xl border border-ivory-300 dark:border-espresso-750 text-espresso-600 dark:text-espresso-300 hover:bg-ivory-100"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setDailyQuestionTarget(customTarget);
                  setShowTargetModal(false);
                }}
                className="px-4 py-1.5 text-xs font-semibold rounded-xl text-white shadow-subtle"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                Save Target
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Entry Confirm Modal */}
      <ConfirmModal
        isOpen={Boolean(entryToDelete)}
        title="Delete Question Log"
        message={`Delete this log of ${entryToDelete?.attempted} questions on ${entryToDelete?.date}? Your streaks will update automatically.`}
        confirmLabel="Delete Log"
        variant="danger"
        onConfirm={() => {
          if (entryToDelete) {
            deleteDailyQuestionEntry(entryToDelete.id);
            setEntryToDelete(null);
          }
        }}
        onCancel={() => setEntryToDelete(null)}
      />
    </div>
  );
};
