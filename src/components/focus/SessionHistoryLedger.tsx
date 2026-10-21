import React, { useState, useMemo } from 'react';
import { StudySession, SessionStatus } from '../../types';
import { useApp } from '../../context/AppContext';
import { ConfirmModal } from '../common/ConfirmModal';
import { BookOpen, CheckCircle2, Clock, Trash2, Search } from 'lucide-react';

interface SessionHistoryLedgerProps {
  sessions: StudySession[];
}

export const SessionHistoryLedger: React.FC<SessionHistoryLedgerProps> = ({ sessions }) => {
  const { deleteStudySession } = useApp();
  const [filterStatus, setFilterStatus] = useState<'all' | 'completed' | 'interrupted'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteSessionId, setDeleteSessionId] = useState<string | null>(null);

  const filteredSessions = useMemo(() => {
    return sessions.filter((s) => {
      const status: SessionStatus = s.status || 'completed';
      if (filterStatus !== 'all' && status !== filterStatus) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesSub = s.subjectName?.toLowerCase().includes(q);
        const matchesNotes = s.notes?.toLowerCase().includes(q);
        return matchesSub || matchesNotes;
      }
      return true;
    });
  }, [sessions, filterStatus, searchQuery]);

  const sessionToDelete = useMemo(() => {
    if (!deleteSessionId) return null;
    return sessions.find((s) => s.id === deleteSessionId) || null;
  }, [deleteSessionId, sessions]);

  const handleConfirmDelete = () => {
    if (deleteSessionId) {
      deleteStudySession(deleteSessionId);
      setDeleteSessionId(null);
    }
  };

  return (
    <div className="w-full bg-white dark:bg-espresso-850 rounded-2xl border border-ivory-300 dark:border-espresso-750 shadow-subtle p-5">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-ivory-200 dark:border-espresso-750">
        <div>
          <h3 className="font-serif text-lg font-bold text-espresso-950 dark:text-ivory-50">
            Study Session Archives
          </h3>
          <p className="text-xs text-espresso-500 dark:text-espresso-400">
            {sessions.length} total sessions logged ({sessions.filter((s) => (s.status || 'completed') === 'completed').length} completed)
          </p>
        </div>

        {/* Filter and Search Bar */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-espresso-400" />
            <input
              type="text"
              placeholder="Search subject or notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-ivory-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-800 text-espresso-900 dark:text-ivory-100 placeholder:text-espresso-400 focus:outline-none focus:ring-1 focus:ring-terracotta-500"
            />
          </div>

          <div className="flex items-center p-0.5 rounded-xl bg-ivory-100 dark:bg-espresso-800 border border-ivory-200 dark:border-espresso-700 text-xs font-medium">
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-2.5 py-1 rounded-lg transition ${
                filterStatus === 'all'
                  ? 'bg-white dark:bg-espresso-700 text-espresso-950 dark:text-ivory-50 shadow-subtle font-semibold'
                  : 'text-espresso-500 hover:text-espresso-800 dark:hover:text-ivory-200'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterStatus('completed')}
              className={`px-2.5 py-1 rounded-lg transition ${
                filterStatus === 'completed'
                  ? 'bg-white dark:bg-espresso-700 text-espresso-950 dark:text-ivory-50 shadow-subtle font-semibold'
                  : 'text-espresso-500 hover:text-espresso-800 dark:hover:text-ivory-200'
              }`}
            >
              Completed
            </button>
            <button
              onClick={() => setFilterStatus('interrupted')}
              className={`px-2.5 py-1 rounded-lg transition ${
                filterStatus === 'interrupted'
                  ? 'bg-white dark:bg-espresso-700 text-espresso-950 dark:text-ivory-50 shadow-subtle font-semibold'
                  : 'text-espresso-500 hover:text-espresso-800 dark:hover:text-ivory-200'
              }`}
            >
              Interrupted
            </button>
          </div>
        </div>
      </div>

      {/* Sessions List */}
      {filteredSessions.length === 0 ? (
        <div className="text-center py-12 text-espresso-400 dark:text-espresso-500 text-xs">
          {sessions.length === 0
            ? 'No focus sessions recorded yet. Start a timer to log your first deep-focus session.'
            : 'No sessions matching the selected filter or search query.'}
        </div>
      ) : (
        <div className="divide-y divide-ivory-200 dark:divide-espresso-750 max-h-[520px] overflow-y-auto">
          {filteredSessions.map((session) => {
            const status: SessionStatus = session.status || 'completed';
            const isCompleted = status === 'completed';
            const sessionDate = new Date(session.timestamp);

            return (
              <div
                key={session.id}
                className="py-3.5 px-1 flex items-start justify-between gap-4 hover:bg-ivory-50/60 dark:hover:bg-espresso-800/40 rounded-xl transition-colors"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <BookOpen className="w-3.5 h-3.5 text-terracotta-500 shrink-0" />
                    <span className="text-xs font-semibold text-espresso-950 dark:text-ivory-50 truncate">
                      {session.subjectName || 'General Focus Session'}
                    </span>

                    {/* Status Badge */}
                    {isCompleted ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-sage-50 text-sage-700 dark:bg-sage-950/40 dark:text-sage-300 border border-sage-200 dark:border-sage-800/40">
                        <CheckCircle2 className="w-3 h-3 text-sage-600 dark:text-sage-400" />
                        Completed
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40">
                        <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                        Stopped Early
                      </span>
                    )}

                    {session.isSample && (
                      <span className="text-[9px] uppercase font-mono px-1.5 py-0.5 rounded bg-ivory-200 dark:bg-espresso-700 text-espresso-600 dark:text-espresso-300">
                        Demo
                      </span>
                    )}
                  </div>

                  {session.notes && (
                    <p className="text-xs text-espresso-600 dark:text-espresso-300 line-clamp-2">
                      {session.notes}
                    </p>
                  )}

                  <p className="text-[11px] font-mono text-espresso-400 dark:text-espresso-500">
                    {sessionDate.toLocaleDateString(undefined, {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}{' '}
                    at{' '}
                    {sessionDate.toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                    {session.plannedDurationMinutes && session.plannedDurationMinutes !== session.durationMinutes && (
                      <span className="ml-2 text-espresso-400">
                        (Planned: {session.plannedDurationMinutes}m)
                      </span>
                    )}
                  </p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-mono text-sm font-bold text-terracotta-600 dark:text-terracotta-400">
                    {session.durationMinutes}m
                  </span>

                  <button
                    onClick={() => setDeleteSessionId(session.id)}
                    title="Delete session record"
                    className="p-1 text-espresso-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors rounded-lg"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(deleteSessionId)}
        title="Delete Focus Session"
        message={`Are you sure you want to delete this ${sessionToDelete?.durationMinutes || 0}m focus session record? This action cannot be undone.`}
        confirmLabel="Delete Session"
        cancelLabel="Keep Session"
        variant="danger"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteSessionId(null)}
      />
    </div>
  );
};
