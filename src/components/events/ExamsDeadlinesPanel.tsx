import React, { useState, useMemo } from 'react';
import {
  GraduationCap,
  AlertCircle,
  Clock,
  MapPin,
  Calendar as CalendarIcon,
  Plus,
  CheckCircle2,
  Circle,
  BookOpen,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { CalendarEvent } from '../../types';
import { EventModal } from './EventModal';

// Helper: Days remaining between today and a target YYYY-MM-DD
const getDaysRemaining = (targetDateStr: string): number => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [y, m, d] = targetDateStr.split('-').map(Number);
  const target = new Date(y, (m || 1) - 1, d || 1);
  target.setHours(0, 0, 0, 0);

  const diffMs = target.getTime() - today.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
};

export const ExamsDeadlinesPanel: React.FC = () => {
  const { state, toggleEventComplete } = useApp();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [initialCategory, setInitialCategory] = useState<'exam' | 'deadline'>('exam');

  // Exams list sorted chronologically
  const exams = useMemo(() => {
    return (state.events || [])
      .filter((e) => e.category === 'exam')
      .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  }, [state.events]);

  // Deadlines list sorted chronologically
  const deadlines = useMemo(() => {
    return (state.events || [])
      .filter((e) => e.category === 'deadline')
      .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  }, [state.events]);

  const handleCreate = (cat: 'exam' | 'deadline') => {
    setEditingEvent(null);
    setInitialCategory(cat);
    setIsModalOpen(true);
  };

  const handleEdit = (event: CalendarEvent) => {
    setEditingEvent(event);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-8">
      {/* SECTION 1: ACADEMIC EXAMINATIONS */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-ivory-300 dark:border-espresso-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-violet-100 dark:bg-violet-950/60 text-violet-600 dark:text-violet-400">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-serif text-lg sm:text-xl font-semibold text-espresso-950 dark:text-ivory-50">
                Upcoming Academic Examinations
              </h2>
              <p className="text-xs text-espresso-500 dark:text-espresso-400">
                Mid-semesters, end-semesters, lab practicals, vivas, and assessments
              </p>
            </div>
          </div>

          <button
            onClick={() => handleCreate('exam')}
            className="self-start sm:self-auto flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            <span>Add Exam</span>
          </button>
        </div>

        {exams.length === 0 ? (
          <div className="p-8 text-center bg-white dark:bg-espresso-850 rounded-2xl border border-ivory-300 dark:border-espresso-750 text-xs text-espresso-500">
            No academic exams scheduled. Click &quot;Add Exam&quot; to plan your first assessment.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {exams.map((exam) => {
              const daysLeft = getDaysRemaining(exam.date);
              const subject = state.subjects.find((s) => s.id === exam.subjectId);

              return (
                <div
                  key={exam.id}
                  onClick={() => handleEdit(exam)}
                  className="p-4 rounded-2xl bg-white dark:bg-espresso-850 border border-ivory-300 dark:border-espresso-750 shadow-xs hover:border-violet-500 hover:shadow-md transition cursor-pointer flex flex-col justify-between"
                  style={{ borderLeftWidth: '4px', borderLeftColor: '#8B5CF6' }}
                >
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleEventComplete(exam.id);
                          }}
                          className="mt-0.5 hover:scale-110 transition shrink-0"
                        >
                          {exam.isCompleted ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                          ) : (
                            <Circle className="w-5 h-5 text-espresso-400 hover:text-violet-500" />
                          )}
                        </button>
                        <div>
                          <h3
                            className={`font-serif font-semibold text-sm sm:text-base text-espresso-950 dark:text-ivory-50 ${
                              exam.isCompleted ? 'line-through opacity-60' : ''
                            }`}
                          >
                            {exam.title}
                          </h3>
                          {subject && (
                            <p className="text-xs text-violet-600 dark:text-violet-400 font-medium mt-0.5 flex items-center gap-1">
                              <BookOpen className="w-3 h-3" />
                              {subject.name} ({subject.code})
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Countdown Badge */}
                      <div className="shrink-0 text-right">
                        {exam.isCompleted ? (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                            Completed
                          </span>
                        ) : daysLeft < 0 ? (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-ivory-200 dark:bg-espresso-750 text-espresso-600">
                            Passed
                          </span>
                        ) : daysLeft === 0 ? (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-rose-600 text-white animate-pulse">
                            Today
                          </span>
                        ) : daysLeft === 1 ? (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-amber-500 text-white">
                            Tomorrow
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-violet-100 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300">
                            In {daysLeft} days
                          </span>
                        )}
                      </div>
                    </div>

                    {exam.description && (
                      <p className="text-xs text-espresso-600 dark:text-espresso-300 line-clamp-2 mt-2.5 pl-7.5">
                        {exam.description}
                      </p>
                    )}
                  </div>

                  {/* Metadata Footer */}
                  <div className="mt-4 pt-3 border-t border-ivory-100 dark:border-espresso-800 flex items-center justify-between text-xs font-mono text-espresso-500 dark:text-espresso-400">
                    <span className="flex items-center gap-1.5">
                      <CalendarIcon className="w-3.5 h-3.5 text-espresso-400" />
                      {exam.date}
                    </span>
                    {exam.startTime && (
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-espresso-400" />
                        {exam.startTime} – {exam.endTime || 'end'}
                      </span>
                    )}
                    {exam.location && (
                      <span className="flex items-center gap-1.5 truncate max-w-[140px]">
                        <MapPin className="w-3.5 h-3.5 text-espresso-400 shrink-0" />
                        {exam.location}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SECTION 2: PROJECT & ASSIGNMENT DEADLINES */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-ivory-300 dark:border-espresso-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-serif text-lg sm:text-xl font-semibold text-espresso-950 dark:text-ivory-50">
                Project &amp; Assignment Deadlines
              </h2>
              <p className="text-xs text-espresso-500 dark:text-espresso-400">
                Major milestones, term reports, code submissions, and presentations
              </p>
            </div>
          </div>

          <button
            onClick={() => handleCreate('deadline')}
            className="self-start sm:self-auto flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            <span>Add Deadline</span>
          </button>
        </div>

        {deadlines.length === 0 ? (
          <div className="p-8 text-center bg-white dark:bg-espresso-850 rounded-2xl border border-ivory-300 dark:border-espresso-750 text-xs text-espresso-500">
            No project deadlines scheduled. Click &quot;Add Deadline&quot; to keep assignments on track.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {deadlines.map((deadline) => {
              const daysLeft = getDaysRemaining(deadline.date);
              const isOverdue = daysLeft < 0 && !deadline.isCompleted;

              return (
                <div
                  key={deadline.id}
                  onClick={() => handleEdit(deadline)}
                  className={`p-4 rounded-2xl bg-white dark:bg-espresso-850 border shadow-xs hover:shadow-md transition cursor-pointer flex flex-col justify-between ${
                    isOverdue
                      ? 'border-rose-400 dark:border-rose-900 bg-rose-50/20'
                      : 'border-ivory-300 dark:border-espresso-750 hover:border-rose-500'
                  }`}
                  style={{ borderLeftWidth: '4px', borderLeftColor: '#EF4444' }}
                >
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleEventComplete(deadline.id);
                          }}
                          className="mt-0.5 hover:scale-110 transition shrink-0"
                        >
                          {deadline.isCompleted ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                          ) : (
                            <Circle className="w-5 h-5 text-espresso-400 hover:text-rose-500" />
                          )}
                        </button>
                        <div>
                          <h3
                            className={`font-serif font-semibold text-sm sm:text-base text-espresso-950 dark:text-ivory-50 ${
                              deadline.isCompleted ? 'line-through opacity-60' : ''
                            }`}
                          >
                            {deadline.title}
                          </h3>
                        </div>
                      </div>

                      {/* Overdue / Countdown Badge */}
                      <div className="shrink-0 text-right">
                        {deadline.isCompleted ? (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                            Submitted
                          </span>
                        ) : isOverdue ? (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-rose-600 text-white uppercase flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            {Math.abs(daysLeft)}d overdue
                          </span>
                        ) : daysLeft === 0 ? (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-rose-500 text-white animate-pulse">
                            Due Today
                          </span>
                        ) : daysLeft === 1 ? (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-amber-500 text-white">
                            Due Tomorrow
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300">
                            {daysLeft} days left
                          </span>
                        )}
                      </div>
                    </div>

                    {deadline.description && (
                      <p className="text-xs text-espresso-600 dark:text-espresso-300 line-clamp-2 mt-2.5 pl-7.5">
                        {deadline.description}
                      </p>
                    )}
                  </div>

                  {/* Metadata Footer */}
                  <div className="mt-4 pt-3 border-t border-ivory-100 dark:border-espresso-800 flex items-center justify-between text-xs font-mono text-espresso-500 dark:text-espresso-400">
                    <span className="flex items-center gap-1.5">
                      <CalendarIcon className="w-3.5 h-3.5 text-espresso-400" />
                      Due: {deadline.date}
                    </span>
                    {deadline.priority === 'high' && (
                      <span className="text-rose-600 font-bold uppercase text-[10px]">
                        High Priority
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal */}
      <EventModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        initialEvent={editingEvent}
        initialCategory={initialCategory}
      />
    </div>
  );
};
