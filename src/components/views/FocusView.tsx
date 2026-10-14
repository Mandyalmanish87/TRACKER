import React from 'react';
import { FocusWidget } from '../dashboard/FocusWidget';
import { Card } from '../common/Card';
import { useApp } from '../../context/AppContext';
import { BookOpen } from 'lucide-react';

export const FocusView: React.FC = () => {
  const { state } = useApp();

  return (
    <div className="space-y-6 pb-16">
      <div className="border-b border-ivory-300 dark:border-espresso-800 pb-4">
        <h1 className="font-serif text-3xl font-normal text-espresso-950 dark:text-ivory-50">
          Deep Focus & Academic Study Logs
        </h1>
        <p className="text-xs text-espresso-500 dark:text-espresso-400 mt-1">
          Distraction-free environment with Pomodoro intervals and historical log ledger.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(340px,0.9fr)_minmax(0,1.1fr)] gap-6 lg:gap-8 items-start">
        <div className="min-w-0">
          <FocusWidget />
        </div>

        <div className="min-w-0">
          <Card
            eyebrow="Study Archives"
            title="Complete Session Ledger"
            subtitle={`${state.studySessions.length} total sessions recorded`}
          >
            {state.studySessions.length === 0 ? (
              <p className="text-xs text-espresso-400 italic text-center py-8">
                No study sessions recorded yet. Start a timer to log your first deep focus block.
              </p>
            ) : (
              <div className="divide-y divide-ivory-200 dark:divide-espresso-750">
                {state.studySessions.map((session) => (
                  <div key={session.id} className="py-3 flex items-start justify-between gap-4">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <BookOpen className="w-3.5 h-3.5 text-terracotta-500" />
                        <span className="text-xs font-semibold text-espresso-900 dark:text-ivory-100">
                          {session.subjectName || 'Self-Directed Focus'}
                        </span>
                        {session.isSample && (
                          <span className="text-[9px] uppercase font-mono px-1 rounded bg-ivory-200 dark:bg-espresso-700 text-espresso-500">
                            Demo
                          </span>
                        )}
                      </div>
                      {session.notes && (
                        <p className="text-xs text-espresso-500 dark:text-espresso-400">
                          {session.notes}
                        </p>
                      )}
                      <p className="text-[10px] text-espresso-400 font-mono">
                        {new Date(session.timestamp).toLocaleDateString()} at{' '}
                        {new Date(session.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>

                    <span className="font-mono text-sm font-bold text-terracotta-600 dark:text-terracotta-400 shrink-0">
                      {session.durationMinutes}m
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};
