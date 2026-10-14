import React, { useMemo } from 'react';
import { BookOpen, ChevronRight } from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface SyllabusSummaryWidgetProps {
  onNavigateToSyllabus?: () => void;
}

export const SyllabusSummaryWidget: React.FC<SyllabusSummaryWidgetProps> = ({
  onNavigateToSyllabus,
}) => {
  const { state } = useApp();
  const subjects = state.syllabusSubjects || [];

  const stats = useMemo(() => {
    let total = 0;
    let done = 0;
    let inProgress = 0;
    let revisionNeeded = 0;

    subjects.forEach((s) => {
      s.chapters.forEach((c) => {
        c.subtopics.forEach((t) => {
          total++;
          if (t.status === 'done') done++;
          else if (t.status === 'in_progress') inProgress++;
          else if (t.status === 'revision_needed') revisionNeeded++;
        });
      });
    });

    const percentage = total === 0 ? 0 : Math.round((done / total) * 100);
    return { total, done, inProgress, revisionNeeded, percentage };
  }, [subjects]);

  return (
    <div className="p-5 sm:p-6 rounded-2xl border border-ivory-300 dark:border-espresso-750 bg-white dark:bg-espresso-850 shadow-subtle flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-ivory-200 dark:bg-espresso-800 text-espresso-600 dark:text-espresso-300">
              <BookOpen className="w-4 h-4" style={{ color: 'var(--accent)' }} />
            </div>
            <div>
              <p className="text-[11px] font-mono uppercase tracking-wider text-espresso-400 dark:text-espresso-500 font-semibold">
                Curriculum
              </p>
              <h3 className="font-serif text-base font-semibold text-espresso-950 dark:text-ivory-50">
                Syllabus Mastery
              </h3>
            </div>
          </div>

          {onNavigateToSyllabus && (
            <button
              onClick={onNavigateToSyllabus}
              className="text-xs font-semibold text-espresso-600 dark:text-ivory-200 hover:text-espresso-900 flex items-center gap-0.5 group"
            >
              <span>View</span>
              <ChevronRight className="w-3.5 h-3.5 transition group-hover:translate-x-0.5" />
            </button>
          )}
        </div>

        {/* Large completion metric */}
        <div className="flex items-baseline gap-2 mb-3">
          <span className="font-serif text-3xl sm:text-4xl font-bold tabular-nums text-espresso-950 dark:text-ivory-50">
            {stats.percentage}%
          </span>
          <span className="text-xs text-espresso-500 dark:text-espresso-400">
            completed ({stats.done}/{stats.total} topics)
          </span>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-ivory-200 dark:bg-espresso-800 h-2 rounded-full overflow-hidden mb-4">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{ width: `${stats.percentage}%`, backgroundColor: 'var(--accent)' }}
          />
        </div>

        {/* Breakdown chips */}
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="p-2 rounded-xl bg-sage-50 dark:bg-sage-900/20 border border-sage-200 dark:border-sage-800/40">
            <span className="block font-mono font-bold text-sage-700 dark:text-sage-300 tabular-nums">
              {stats.done}
            </span>
            <span className="text-[10px] text-sage-600 dark:text-sage-400 font-medium">Done</span>
          </div>
          <div className="p-2 rounded-xl bg-ochre-50 dark:bg-ochre-900/20 border border-ochre-200 dark:border-ochre-800/40">
            <span className="block font-mono font-bold text-ochre-700 dark:text-ochre-300 tabular-nums">
              {stats.inProgress}
            </span>
            <span className="text-[10px] text-ochre-600 dark:text-ochre-400 font-medium">In Prog</span>
          </div>
          <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800/40">
            <span className="block font-mono font-bold text-rose-700 dark:text-rose-300 tabular-nums">
              {stats.revisionNeeded}
            </span>
            <span className="text-[10px] text-rose-600 dark:text-rose-400 font-medium">Revise</span>
          </div>
        </div>
      </div>
    </div>
  );
};
