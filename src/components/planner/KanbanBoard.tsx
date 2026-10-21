import React, { useState } from 'react';
import {
  Plus,
  Calendar,
  Clock,
  AlertCircle,
  CheckCircle2,
  Trash2,
  Edit2,
  ExternalLink,
  ArrowRight,
  RotateCcw,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { PlannerTask, TaskStatus, TaskPriority } from '../../types';
import { isTaskOverdue, isTaskDueToday } from '../../utils/plannerUtils';
import { ConfirmModal } from '../common/ConfirmModal';
import { TaskModal } from './TaskModal';
import { TiltCard } from '../common/TiltCard';

interface KanbanBoardProps {
  tasks: PlannerTask[];
  onNavigateToSyllabus?: (subjectId?: string) => void;
}

const COLUMN_CONFIG: { id: TaskStatus; label: string; dotColor: string }[] = [
  {
    id: 'todo',
    label: 'To Do',
    dotColor: 'bg-[#FFE600]',
  },
  {
    id: 'in_progress',
    label: 'In Progress',
    dotColor: 'bg-[#2B38FF]',
  },
  {
    id: 'done',
    label: 'Done',
    dotColor: 'bg-emerald-500',
  },
];

const PRIORITY_BADGES: Record<TaskPriority, { label: string; badgeClass: string }> = {
  high: {
    label: 'High',
    badgeClass: 'bg-[#FF3B81] text-white',
  },
  medium: {
    label: 'Medium',
    badgeClass: 'bg-[#FFE600] text-[#111111]',
  },
  low: {
    label: 'Low',
    badgeClass: 'bg-black/10 dark:bg-white/10 text-black/70 dark:text-white/70',
  },
};

export const KanbanBoard: React.FC<KanbanBoardProps> = ({ tasks, onNavigateToSyllabus }) => {
  const { state, setTaskStatus, deleteTask } = useApp();

  const [activeMobileColumn, setActiveMobileColumn] = useState<TaskStatus>('todo');
  const [taskToEdit, setTaskToEdit] = useState<PlannerTask | null>(null);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<PlannerTask | null>(null);

  // Helper to find linked syllabus topic / subject info safely (handles deleted items gracefully)
  const getSyllabusLinkInfo = (task: PlannerTask) => {
    if (!task.syllabusSubjectId && !task.subjectId) return null;

    const subject = (state.syllabusSubjects || []).find(
      (s) => s.id === task.syllabusSubjectId || s.id === task.subjectId
    );

    let topicName: string | null = null;
    let isTopicMissing = false;

    if (task.syllabusTopicId && subject) {
      let found = false;
      for (const ch of subject.chapters) {
        const top = ch.subtopics.find((t) => t.id === task.syllabusTopicId);
        if (top) {
          topicName = top.name;
          found = true;
          break;
        }
      }
      if (!found) {
        isTopicMissing = true;
      }
    } else if (task.syllabusTopicId && !subject) {
      isTopicMissing = true;
    }

    return {
      subjectName: subject?.name || 'Subject',
      subjectColor: subject?.color,
      topicName,
      isTopicMissing,
      subjectId: subject?.id,
    };
  };

  const renderTaskCard = (task: PlannerTask) => {
    const overdue = isTaskOverdue(task);
    const dueToday = isTaskDueToday(task);
    const linkInfo = getSyllabusLinkInfo(task);
    const priorityCfg = PRIORITY_BADGES[task.priority] || PRIORITY_BADGES.medium;

    return (
      <TiltCard key={task.id} maxTilt={5} scale={1.015}>
        <div
          className={`p-4 rounded-2xl border transition-all duration-150 space-y-3 ${
          task.status === 'done'
            ? 'bg-black/5 dark:bg-white/5 border-black/5 dark:border-white/5 opacity-80'
            : overdue
            ? 'bg-white dark:bg-[#1A1A1E] border-[#FF3B81]/60 shadow-sm'
            : 'bg-white dark:bg-[#1A1A1E] border-black/10 dark:border-white/10 shadow-sm hover:border-black/30 dark:hover:border-white/30'
        }`}
      >
        {/* Top Badges & Actions */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {/* Priority Badge */}
            <span className={`text-[9px] font-mono font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${priorityCfg.badgeClass}`}>
              {priorityCfg.label}
            </span>

            {/* Overdue / Due Today Badge */}
            {overdue && (
              <span className="text-[9px] font-mono font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-[#FF3B81] text-white flex items-center gap-1">
                <AlertCircle className="w-2.5 h-2.5" /> Overdue
              </span>
            )}
            {!overdue && dueToday && task.status !== 'done' && (
              <span className="text-[9px] font-mono font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-[#FFE600] text-[#111111]">
                Due Today
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => {
                setTaskToEdit(task);
                setIsTaskModalOpen(true);
              }}
              className="p-1.5 rounded-full text-black/50 hover:text-black dark:text-white/50 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition"
              title="Edit task"
            >
              <Edit2 className="w-3 h-3" />
            </button>
            <button
              onClick={() => setTaskToDelete(task)}
              className="p-1.5 rounded-full text-black/50 hover:text-[#FF3B81] dark:text-white/50 dark:hover:text-[#FF3B81] hover:bg-black/5 dark:hover:bg-white/5 transition"
              title="Delete task"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Task Title & Description */}
        <div>
          <h4
            className={`font-jb text-sm font-bold leading-snug ${
              task.status === 'done'
                ? 'line-through text-black/40 dark:text-white/40'
                : 'text-[#111111] dark:text-[#F8F6F0]'
            }`}
          >
            {task.title}
          </h4>
          {task.description && (
            <p className="text-xs text-black/60 dark:text-white/60 mt-1 line-clamp-2 leading-relaxed">
              {task.description}
            </p>
          )}
        </div>

        {/* Linked Syllabus Item */}
        {linkInfo && (
          <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 text-[11px]">
            <div className="flex items-center gap-1.5 min-w-0">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: linkInfo.subjectColor || '#2B38FF' }}
              />
              <span className="font-jb font-bold text-[#111111] dark:text-[#F8F6F0] truncate">
                {linkInfo.subjectName}
              </span>
              {linkInfo.topicName ? (
                <>
                  <span className="text-black/40 dark:text-white/40">›</span>
                  <span className="text-black/60 dark:text-white/60 truncate" title={linkInfo.topicName}>
                    {linkInfo.topicName}
                  </span>
                </>
              ) : linkInfo.isTopicMissing ? (
                <span className="text-black/40 dark:text-white/40 italic shrink-0">[Linked Topic Removed]</span>
              ) : null}
            </div>

            {onNavigateToSyllabus && linkInfo.subjectId && (
              <button
                onClick={() => onNavigateToSyllabus(linkInfo.subjectId)}
                className="text-[10px] font-jb font-bold text-[#2B38FF] dark:text-[#FFE600] hover:underline shrink-0 flex items-center gap-0.5"
                title="View subject in Syllabus Tracker"
              >
                <span>View</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </button>
            )}
          </div>
        )}

        {/* Metadata: Due Date & Duration */}
        <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono text-black/50 dark:text-white/50 pt-1 border-t border-black/5 dark:border-white/5">
          {task.dueDate && (
            <span
              className={`flex items-center gap-1 ${
                overdue
                  ? 'text-[#FF3B81] font-bold'
                  : dueToday && task.status !== 'done'
                  ? 'text-[#FFE600] font-bold'
                  : ''
              }`}
            >
              <Calendar className="w-3 h-3" />
              <span>
                {task.dueDate}
                {task.dueTime ? ` at ${task.dueTime}` : ''}
              </span>
            </span>
          )}

          {task.estimatedDuration && (
            <span className="flex items-center gap-1 font-mono">
              <Clock className="w-3 h-3" />
              <span>{task.estimatedDuration}m</span>
            </span>
          )}

          {task.notes && (
            <span className="text-[10px] text-black/40 dark:text-white/40 italic truncate max-w-[140px]" title={task.notes}>
              "{task.notes}"
            </span>
          )}
        </div>

        {/* Quick Transition Action Buttons */}
        <div className="flex items-center justify-between gap-1.5 pt-1">
          {task.status === 'todo' && (
            <div className="flex items-center gap-1.5 w-full">
              <button
                onClick={() => setTaskStatus(task.id, 'in_progress')}
                className="flex-1 py-1.5 px-3 rounded-full text-xs font-jb font-bold uppercase tracking-wider bg-[#2B38FF] hover:bg-[#1F2BD6] text-white transition flex items-center justify-center gap-1 shadow-sm"
              >
                <span>Start</span>
                <ArrowRight className="w-3 h-3" />
              </button>
              <button
                onClick={() => setTaskStatus(task.id, 'done')}
                className="py-1.5 px-3 rounded-full text-xs font-jb font-bold uppercase tracking-wider bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 text-[#111111] dark:text-[#F8F6F0] transition flex items-center gap-1"
                title="Mark as Completed"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Done</span>
              </button>
            </div>
          )}

          {task.status === 'in_progress' && (
            <div className="flex items-center gap-1.5 w-full">
              <button
                onClick={() => setTaskStatus(task.id, 'todo')}
                className="py-1.5 px-2.5 rounded-full text-xs font-mono text-black/60 hover:text-black dark:text-white/60 dark:hover:text-white bg-black/5 dark:bg-white/10 transition"
                title="Move back to To Do"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
              <button
                onClick={() => setTaskStatus(task.id, 'done')}
                className="flex-1 py-1.5 px-3 rounded-full text-xs font-jb font-bold uppercase tracking-wider bg-emerald-600 hover:bg-emerald-700 text-white transition flex items-center justify-center gap-1 shadow-sm"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Mark Completed</span>
              </button>
            </div>
          )}

          {task.status === 'done' && (
            <div className="flex items-center justify-between w-full">
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                <span>Completed</span>
              </span>
              <button
                onClick={() => setTaskStatus(task.id, 'todo')}
                className="text-[11px] font-jb font-bold uppercase tracking-wider text-black/60 hover:text-black dark:text-white/60 dark:hover:text-white hover:underline flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reopen</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </TiltCard>
  );
  };

  return (
    <div className="space-y-4">
      {/* Mobile Column Tabs (shown on small screens only) */}
      <div className="flex sm:hidden items-center p-1 bg-black/5 dark:bg-white/10 rounded-full border border-black/10 dark:border-white/10">
        {COLUMN_CONFIG.map((col) => {
          const colTasks = tasks.filter((t) => t.status === col.id);
          const isActive = activeMobileColumn === col.id;
          return (
            <button
              key={col.id}
              onClick={() => setActiveMobileColumn(col.id)}
              className={`flex-1 py-1.5 rounded-full text-xs font-jb font-bold uppercase tracking-wider transition flex items-center justify-center gap-1.5 ${
                isActive
                  ? 'bg-white dark:bg-[#1A1A1E] text-[#111111] dark:text-[#F8F6F0] shadow-sm'
                  : 'text-black/60 dark:text-white/60'
              }`}
            >
              <span>{col.label}</span>
              <span className="text-[10px] font-mono px-1.5 rounded-full bg-black/10 dark:bg-white/10">
                {colTasks.length}
              </span>
            </button>
          );
        })}
      </div>

      {/* Kanban Board Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 lg:gap-6 items-start">
        {COLUMN_CONFIG.map((col) => {
          const colTasks = tasks.filter((t) => t.status === col.id);
          const isHiddenOnMobile = activeMobileColumn !== col.id;

          return (
            <div
              key={col.id}
              className={`rounded-2xl border border-black/10 dark:border-white/10 bg-[#F8F6F0]/70 dark:bg-[#141416] p-4 space-y-4 ${
                isHiddenOnMobile ? 'hidden sm:block' : 'block'
              }`}
            >
              {/* Column Header */}
              <div className="flex items-center justify-between pb-3 border-b border-black/10 dark:border-white/10">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${col.dotColor}`} />
                  <h3 className="font-jb text-sm font-black uppercase tracking-wider text-[#111111] dark:text-[#F8F6F0]">
                    {col.label}
                  </h3>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-black/10 dark:bg-white/10 text-black/70 dark:text-white/70">
                    {colTasks.length}
                  </span>
                </div>

                {col.id === 'todo' && (
                  <button
                    onClick={() => {
                      setTaskToEdit(null);
                      setIsTaskModalOpen(true);
                    }}
                    className="p-1 rounded-full text-black/50 hover:text-black dark:text-white/50 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition"
                    title="Add new task"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Task Cards Column */}
              <div className="space-y-3 min-h-[140px]">
                {colTasks.length === 0 ? (
                  <div className="py-8 text-center border border-dashed border-black/10 dark:border-white/10 rounded-xl">
                    <p className="text-xs font-mono text-black/40 dark:text-white/40">
                      No tasks in {col.label.toLowerCase()}
                    </p>
                    {col.id === 'todo' && (
                      <button
                        onClick={() => {
                          setTaskToEdit(null);
                          setIsTaskModalOpen(true);
                        }}
                        className="mt-2 text-xs font-jb font-bold uppercase tracking-wider text-[#2B38FF] dark:text-[#FFE600] hover:underline inline-flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" /> Create a task
                      </button>
                    )}
                  </div>
                ) : (
                  colTasks.map((t) => renderTaskCard(t))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Task Creation / Edit Modal */}
      <TaskModal
        isOpen={isTaskModalOpen}
        onClose={() => {
          setIsTaskModalOpen(false);
          setTaskToEdit(null);
        }}
        taskToEdit={taskToEdit}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(taskToDelete)}
        title="Delete Task"
        message={`Are you sure you want to delete "${taskToDelete?.title}"? This cannot be undone.`}
        confirmLabel="Delete Task"
        variant="danger"
        onConfirm={() => {
          if (taskToDelete) {
            deleteTask(taskToDelete.id);
            setTaskToDelete(null);
          }
        }}
        onCancel={() => setTaskToDelete(null)}
      />
    </div>
  );
};
