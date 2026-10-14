import React, { useState, useEffect } from 'react';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { useApp } from '../../context/AppContext';
import { Play, Pause, RotateCcw, Check, BookOpen } from 'lucide-react';

export const FocusWidget: React.FC = () => {
  const { state, logStudySession } = useApp();
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [sessionMinutes, setSessionMinutes] = useState<number>(25);
  const [timeLeft, setTimeLeft] = useState<number>(25 * 60);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [notes, setNotes] = useState<string>('');
  const [loggedToast, setLoggedToast] = useState<boolean>(false);

  // Set default subject if available
  useEffect(() => {
    if (!selectedSubjectId && state.subjects.length > 0) {
      setSelectedSubjectId(state.subjects[0].id);
    }
  }, [state.subjects, selectedSubjectId]);

  // Live timer tick
  useEffect(() => {
    let interval: any = null;
    if (isRunning && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (isRunning && timeLeft === 0) {
      setIsRunning(false);
      handleLogSession(sessionMinutes);
    }
    return () => clearInterval(interval);
  }, [isRunning, timeLeft, sessionMinutes]);

  const handleSelectPreset = (mins: number) => {
    setIsRunning(false);
    setSessionMinutes(mins);
    setTimeLeft(mins * 60);
  };

  const handleToggleTimer = () => {
    setIsRunning(!isRunning);
  };

  const handleReset = () => {
    setIsRunning(false);
    setTimeLeft(sessionMinutes * 60);
  };

  const handleLogSession = (minsToLog: number) => {
    logStudySession(minsToLog, selectedSubjectId || undefined, notes || undefined);
    setNotes('');
    setLoggedToast(true);
    setTimeout(() => setLoggedToast(false), 3000);
  };

  const minutesFormatted = String(Math.floor(timeLeft / 60)).padStart(2, '0');
  const secondsFormatted = String(timeLeft % 60).padStart(2, '0');

  // Compute total study minutes logged today
  const todayStr = new Date().toISOString().split('T')[0];
  const minutesToday = state.studySessions
    .filter((s) => s.timestamp.startsWith(todayStr))
    .reduce((acc, s) => acc + s.durationMinutes, 0);

  return (
    <Card
      eyebrow="Cognitive Energy"
      title="Deep Focus & Study"
      subtitle="Track focused academic blocks tied to your subjects"
      action={
        <Badge variant="sage" size="sm">
          {minutesToday}m Today
        </Badge>
      }
    >
      {/* Timer Display */}
      <div className="flex flex-col items-center justify-center py-6 px-4 rounded-2xl bg-ivory-100 dark:bg-espresso-800 border border-ivory-200 dark:border-espresso-750 text-center mb-6">
        <span className="font-mono tabular-nums text-5xl sm:text-6xl font-bold tracking-tight text-espresso-950 dark:text-ivory-50 mb-4 select-none">
          {minutesFormatted}:{secondsFormatted}
        </span>

        {/* Presets */}
        <div className="flex items-center gap-2 mb-5">
          {[15, 25, 45, 60].map((mins) => (
            <button
              key={mins}
              onClick={() => handleSelectPreset(mins)}
              className={`px-3 py-1.5 text-xs font-mono tabular-nums font-semibold rounded-xl border transition-all ${
                sessionMinutes === mins
                  ? 'bg-espresso-800 text-ivory-50 border-espresso-800 dark:bg-ivory-100 dark:text-espresso-900 shadow-subtle'
                  : 'bg-white dark:bg-espresso-700 text-espresso-600 dark:text-espresso-300 border-ivory-300 dark:border-espresso-600 hover:border-ivory-400'
              }`}
            >
              {mins}m
            </button>
          ))}
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center justify-center gap-2.5">
          <Button
            variant={isRunning ? 'secondary' : 'terracotta'}
            size="md"
            onClick={handleToggleTimer}
            icon={isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          >
            {isRunning ? 'Pause' : 'Start Focus'}
          </Button>

          <Button
            variant="ghost"
            size="md"
            onClick={handleReset}
            title="Reset timer"
            icon={<RotateCcw className="w-4 h-4" />}
          />

          <Button
            variant="secondary"
            size="md"
            onClick={() => handleLogSession(sessionMinutes)}
            title="Quick log full session minutes directly"
            icon={<Check className="w-4 h-4 text-sage-600 dark:text-sage-400" />}
          >
            Log Now
          </Button>
        </div>

        {loggedToast && (
          <p className="text-xs text-sage-600 dark:text-sage-400 font-semibold mt-3 animate-fade-in flex items-center gap-1.5">
            <Check className="w-4 h-4" /> Logged {sessionMinutes}m to your study history!
          </p>
        )}
      </div>

      {/* Association: Subject & Notes */}
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-espresso-700 dark:text-espresso-300 mb-1.5">
            Link to Academic Subject
          </label>
          <select
            value={selectedSubjectId}
            onChange={(e) => setSelectedSubjectId(e.target.value)}
            className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-ivory-300 dark:border-espresso-700 bg-white dark:bg-espresso-800 text-espresso-900 dark:text-ivory-100 focus:outline-none focus:ring-2 focus:ring-terracotta-500 font-medium"
          >
            <option value="">General Self-Directed Study</option>
            {state.subjects.map((sub) => (
              <option key={sub.id} value={sub.id}>
                {sub.code} — {sub.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-espresso-700 dark:text-espresso-300 mb-1.5">
            Focus Intention / Notes (Optional)
          </label>
          <input
            type="text"
            placeholder="e.g. Solved 5 algorithmic graph problems..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-ivory-300 dark:border-espresso-700 bg-white dark:bg-espresso-800 text-espresso-900 dark:text-ivory-100 focus:outline-none focus:ring-2 focus:ring-terracotta-500"
          />
        </div>
      </div>

      {/* Recent Study History */}
      {state.studySessions.length > 0 && (
        <div className="mt-6 pt-5 border-t border-ivory-200 dark:border-espresso-750">
          <p className="text-xs font-mono uppercase tracking-wider text-espresso-400 dark:text-espresso-500 mb-2.5 font-semibold">
            Recent Sessions
          </p>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {state.studySessions.slice(0, 3).map((session) => (
              <div
                key={session.id}
                className="flex items-center justify-between text-xs py-2 px-3 rounded-xl bg-ivory-50 dark:bg-espresso-800/50 border border-ivory-200 dark:border-espresso-750"
              >
                <div className="flex items-center gap-2.5 truncate">
                  <BookOpen className="w-3.5 h-3.5 text-terracotta-500 shrink-0" />
                  <span className="font-medium text-espresso-800 dark:text-ivory-200 truncate">
                    {session.subjectName || 'General Focus'}
                  </span>
                </div>
                <span className="font-mono tabular-nums text-xs font-bold text-terracotta-600 dark:text-terracotta-400 shrink-0">
                  {session.durationMinutes} min
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
};
