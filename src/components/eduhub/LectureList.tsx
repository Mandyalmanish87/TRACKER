import React from 'react';
import { EduHubLecture } from '../../types/eduhub';
import { formatDigitalTime } from '../../services/eduhubStorage';
import {
  CheckCircle2,
  Circle,
  Trash2,
  ChevronUp,
  ChevronDown,
  FileText,
  Plus,
  Clock,
} from 'lucide-react';

interface LectureListProps {
  lectures: EduHubLecture[];
  selectedLectureId: string | null;
  onSelectLecture: (lecture: EduHubLecture) => void;
  onToggleComplete: (lectureId: string) => void;
  onRemoveLecture: (lectureId: string) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  onOpenNotes: (lecture: EduHubLecture) => void;
  onOpenAddLecture: () => void;
}

export const LectureList: React.FC<LectureListProps> = ({
  lectures,
  selectedLectureId,
  onSelectLecture,
  onToggleComplete,
  onRemoveLecture,
  onReorder,
  onOpenNotes,
  onOpenAddLecture,
}) => {
  return (
    <div className="space-y-3 flex flex-col h-full">
      {/* Playlist Header */}
      <div className="flex items-center justify-between pb-2 border-b border-ivory-200 dark:border-espresso-800">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-espresso-700 dark:text-ivory-200">
            Course Playlist
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-ivory-200 dark:bg-espresso-800 text-espresso-600 dark:text-espresso-300 font-mono font-semibold">
            {lectures.length}
          </span>
        </div>

        <button
          onClick={onOpenAddLecture}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-terracotta-600 text-white hover:bg-terracotta-500 transition shadow-subtle cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Lecture</span>
        </button>
      </div>

      {/* Playlist Items */}
      <div className="space-y-2 flex-1 overflow-y-auto pr-1">
        {lectures.length === 0 ? (
          <div className="p-8 text-center rounded-2xl border border-dashed border-ivory-300 dark:border-espresso-750 bg-ivory-50/50 dark:bg-espresso-850/50 text-espresso-400 dark:text-espresso-500 space-y-2">
            <p className="text-xs font-medium">This course playlist is currently empty.</p>
            <button
              onClick={onOpenAddLecture}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-terracotta-600 dark:text-terracotta-400 border border-terracotta-300 dark:border-terracotta-800 hover:bg-terracotta-50 dark:hover:bg-terracotta-950/40 transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Your First Lecture</span>
            </button>
          </div>
        ) : (
          lectures.map((lecture, idx) => {
            const isSelected = selectedLectureId === lecture.id;
            const progressPct =
              lecture.durationSeconds > 0
                ? Math.min(100, Math.round((lecture.lastPositionSeconds / lecture.durationSeconds) * 100))
                : 0;

            return (
              <div
                key={lecture.id}
                className={`p-3 rounded-2xl border transition-all duration-150 flex flex-col gap-2 relative group ${
                  isSelected
                    ? 'border-terracotta-500 bg-terracotta-50/40 dark:bg-terracotta-950/30 ring-1 ring-terracotta-400/40'
                    : 'border-ivory-200 dark:border-espresso-750 bg-white dark:bg-espresso-850 hover:border-ivory-300 dark:hover:border-espresso-700'
                }`}
              >
                <div className="flex items-start justify-between gap-2.5">
                  {/* Left: Complete Checkbox */}
                  <button
                    onClick={() => onToggleComplete(lecture.id)}
                    className="p-1 rounded-lg text-espresso-400 hover:text-sage-600 dark:hover:text-sage-400 transition cursor-pointer shrink-0 mt-0.5"
                    title={lecture.completed ? 'Mark as incomplete' : 'Mark as completed'}
                  >
                    {lecture.completed ? (
                      <CheckCircle2 className="w-4 h-4 text-sage-600 dark:text-sage-400 fill-sage-100 dark:fill-sage-950" />
                    ) : (
                      <Circle className="w-4 h-4 text-espresso-300 dark:text-espresso-600 hover:text-espresso-500" />
                    )}
                  </button>

                  {/* Middle: Lecture Details & Selection */}
                  <div
                    onClick={() => onSelectLecture(lecture)}
                    className="flex-1 min-w-0 cursor-pointer"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-[10px] font-bold text-espresso-400 dark:text-espresso-500">
                        #{idx + 1}
                      </span>
                      <h4
                        className={`text-xs font-semibold leading-snug truncate ${
                          lecture.completed
                            ? 'line-through text-espresso-400 dark:text-espresso-500'
                            : 'text-espresso-950 dark:text-ivory-50'
                        }`}
                      >
                        {lecture.title}
                      </h4>
                    </div>

                    <div className="flex items-center gap-2 mt-1 text-[11px] text-espresso-500 dark:text-espresso-400 font-mono">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-espresso-400" />
                        {lecture.durationSeconds > 0
                          ? formatDigitalTime(lecture.durationSeconds)
                          : 'Duration pending'}
                      </span>
                      {lecture.lastPositionSeconds > 0 && !lecture.completed && (
                        <>
                          <span>•</span>
                          <span className="text-terracotta-600 dark:text-terracotta-400">
                            {progressPct}% watched
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Right Actions: Notes, Reorder, Delete */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => onOpenNotes(lecture)}
                      className="p-1.5 rounded-lg border border-ivory-200 dark:border-espresso-750 text-espresso-600 dark:text-ivory-200 hover:bg-terracotta-50 hover:text-terracotta-600 dark:hover:bg-terracotta-950/40 transition cursor-pointer"
                      title="Generate / View Notes & PDF"
                    >
                      <FileText className="w-3.5 h-3.5" />
                    </button>

                    <div className="flex flex-col gap-0.5">
                      <button
                        disabled={idx === 0}
                        onClick={() => onReorder(idx, idx - 1)}
                        className="p-0.5 text-espresso-400 hover:text-espresso-800 dark:hover:text-ivory-200 disabled:opacity-20 cursor-pointer"
                        title="Move up in playlist"
                      >
                        <ChevronUp className="w-3 h-3" />
                      </button>
                      <button
                        disabled={idx === lectures.length - 1}
                        onClick={() => onReorder(idx, idx + 1)}
                        className="p-0.5 text-espresso-400 hover:text-espresso-800 dark:hover:text-ivory-200 disabled:opacity-20 cursor-pointer"
                        title="Move down in playlist"
                      >
                        <ChevronDown className="w-3 h-3" />
                      </button>
                    </div>

                    <button
                      onClick={() => onRemoveLecture(lecture.id)}
                      className="p-1 text-espresso-400 hover:text-rose-600 transition cursor-pointer opacity-70 group-hover:opacity-100"
                      title="Remove lecture from playlist"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Progress bar line */}
                {lecture.durationSeconds > 0 && (
                  <div className="w-full h-1 rounded-full bg-ivory-200 dark:bg-espresso-800 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        lecture.completed ? 'bg-sage-500' : 'bg-terracotta-500'
                      }`}
                      style={{ width: `${lecture.completed ? 100 : progressPct}%` }}
                    />
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
