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
import { InlineSubtaskList } from './InlineSubtaskList';

interface KanbanBoardProps {
  tasks: PlannerTask[];
  onNavigateToSyllabus?: (subjectId?: string) => void;
}

const COLUMN_CONFIG: { id: TaskStatus; label: string; dotColor: string }[] = [
  {
    id: 'todo',
    label: 'To Do',
    dotColor: 'bg-ochre-500',
  },
  {
    id: 'in_progress',
    label: 'In Progress',
    dotColor: 'bg-terracotta-500',
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
    badgeClass: 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900',
  },
  medium: {
    label: 'Medium',
    badgeClass: 'bg-ochre-100 dark:bg-ochre-950/60 text-ochre-800 dark:text-ochre-300 border border-ochre-200 dark:border-ochre-800',
  },
  low: {
    label: 'Low',
    badgeClass: 'bg-ivory-200 dark:bg-espresso-800 text-espresso-700 dark:text-espresso-300 border border-ivory-300 dark:border-espresso-700',
  },
};

export const KanbanBoard: React.FC<KanbanBoardProps> = ({ tasks, onNavigateToSyllabus }) => {
  const { state, setTaskStatus, deleteTask, toggleTaskSubtask } = useApp();

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
            ? 'bg-ivory-100/60 dark:bg-espresso-900/40 border-ivory-200 dark:border-espresso-800 opacity-75'
            : overdue
            ? 'bg-white dark:bg-espresso-850 border-rose-300 dark:border-rose-800 shadow-subtle'
            : 'bg-white dark:bg-espresso-850 border-ivory-300 dark:border-espresso-750 shadow-subtle hover:border-ivory-400 dark:hover:border-espresso-600'
        }`}
      >
        {/* Top Badges & Actions */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {/* Priority Badge */}
            <span className={`text-[10px] font-mono font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${priorityCfg.badgeClass}`}>
              {priorityCfg.label}
            </span>

            {/* Overdue / Due Today Badge */}
            {overdue && (
              <span className="text-[10px] font-mono font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900 flex items-center gap-1">
                <AlertCircle className="w-2.5 h-2.5" /> Overdue
              </span>
            )}
            {!overdue && dueToday && task.status !== 'done' && (
              <span className="text-[10px] font-mono font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-ochre-100 dark:bg-ochre-950/60 text-ochre-800 dark:text-ochre-300 border border-ochre-200 dark:border-ochre-800">
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
              className="p-1.5 rounded-full text-espresso-400 hover:text-espresso-800 dark:text-espresso-500 dark:hover:text-ivory-200 hover:bg-ivory-100 dark:hover:bg-espresso-800 transition"
              title="Edit task"
            >
              <Edit2 className="w-3 h-3" />
            </button>
            <button
              onClick={() => setTaskToDelete(task)}
              className="p-1.5 rounded-full text-espresso-400 hover:text-rose-600 dark:text-espresso-500 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition"
              title="Delete task"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Task Title & Description */}
        <div>
          <h4
            className={`text-sm font-semibold leading-snug ${
              task.status === 'done'
                ? 'line-through text-espresso-400 dark:text-espresso-600'
                : 'text-espresso-950 dark:text-ivory-50'
            }`}
          >
            {task.title}
          </h4>
          {task.description && (
            <p className="text-xs text-espresso-600 dark:text-espresso-400 mt-1 line-clamp-2 leading-relaxed">
              {task.description}
            </p>
          )}
        </div>

        {/* Inline Subtasks Progress & Checklist */}
        <InlineSubtaskList
          taskId={task.id}
          subtasks={task.subtasks}
          onToggleSubtask={toggleTaskSubtask}
        />

        {/* Linked Syllabus Item */}
        {linkInfo && (
          <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-ivory-50 dark:bg-espresso-900/60 border border-ivory-200 dark:border-espresso-750 text-[11px]">
            <div className="flex items-center gap-1.5 min-w-0">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: linkInfo.subjectColor || 'var(--accent)' }}
              />
              <span className="font-semibold text-espresso-900 dark:text-ivory-100 truncate">
                {linkInfo.subjectName}
              </span>
              {linkInfo.topicName ? (
                <>
                  <span className="text-espresso-400 dark:text-espresso-600">›</span>
                  <span className="text-espresso-600 dark:text-espresso-400 truncate" title={linkInfo.topicName}>
                    {linkInfo.topicName}
                  </span>
                </>
              ) : linkInfo.isTopicMissing ? (
                <span className="text-espresso-400 dark:text-espresso-600 italic shrink-0">[Linked Topic Removed]</span>
              ) : null}
            </div>

            {onNavigateToSyllabus && linkInfo.subjectId && (
              <button
                onClick={() => onNavigateToSyllabus(linkInfo.subjectId)}
                className="text-[10px] font-semibold text-terracotta-600 dark:text-terracotta-400 hover:underline shrink-0 flex items-center gap-0.5"
                title="View subject in Syllabus Tracker"
              >
                <span>View</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </button>
            )}
          </div>
        )}

        {/* Metadata: Due Date & Duration */}
        <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono text-espresso-500 dark:text-espresso-400 pt-1 border-t border-ivory-200 dark:border-espresso-800">
          {task.dueDate && (
            <span
              className={`flex items-center gap-1 ${
                overdue
                  ? 'text-rose-600 dark:text-rose-400 font-semibold'
                  : dueToday && task.status !== 'done'
                  ? 'text-ochre-700 dark:text-ochre-400 font-semibold'
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
            <span className="text-[10px] text-espresso-400 dark:text-espresso-500 italic truncate max-w-[140px]" title={task.notes}>
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
                className="flex-1 py-1.5 px-3 rounded-full text-xs font-semibold uppercase tracking-wider bg-terracotta-600 hover:bg-terracotta-700 text-white transition flex items-center justify-center gap-1 shadow-subtle"
              >
                <span>Start</span>
                <ArrowRight className="w-3 h-3" />
              </button>
              <button
                onClick={() => setTaskStatus(task.id, 'done')}
                className="py-1.5 px-3 rounded-full text-xs font-semibold uppercase tracking-wider bg-ivory-200 dark:bg-espresso-800 hover:bg-ivory-300 dark:hover:bg-espresso-750 text-espresso-800 dark:text-ivory-100 transition flex items-center gap-1"
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
                className="py-1.5 px-2.5 rounded-full text-xs font-mono text-espresso-600 hover:text-espresso-900 dark:text-espresso-300 dark:hover:text-ivory-100 bg-ivory-200 dark:bg-espresso-800 hover:bg-ivory-300 dark:hover:bg-espresso-750 transition"
                title="Move back to To Do"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
              <button
                onClick={() => setTaskStatus(task.id, 'done')}
                className="flex-1 py-1.5 px-3 rounded-full text-xs font-semibold uppercase tracking-wider bg-emerald-600 hover:bg-emerald-700 text-white transition flex items-center justify-center gap-1 shadow-subtle"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Mark Completed</span>
              </button>
            </div>
          )}

          {task.status === 'done' && (
            <div className="flex items-center justify-between w-full">
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                <span>Completed</span>
              </span>
              <button
                onClick={() => setTaskStatus(task.id, 'todo')}
                className="text-[11px] font-semibold uppercase tracking-wider text-espresso-500 hover:text-espresso-800 dark:text-espresso-400 dark:hover:text-ivory-100 hover:underline flex items-center gap-1"
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
      <div className="flex sm:hidden items-center p-1 bg-ivory-200/70 dark:bg-espresso-800/70 rounded-full border border-ivory-300 dark:border-espresso-700">
        {COLUMN_CONFIG.map((col) => {
          const colTasks = tasks.filter((t) => t.status === col.id);
          const isActive = activeMobileColumn === col.id;
          return (
            <button
              key={col.id}
              onClick={() => setActiveMobileColumn(col.id)}
              className={`flex-1 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider transition flex items-center justify-center gap-1.5 ${
                isActive
                  ? 'bg-white dark:bg-espresso-850 text-espresso-950 dark:text-ivory-50 shadow-subtle'
                  : 'text-espresso-600 dark:text-espresso-400'
              }`}
            >
              <span>{col.label}</span>
              <span className="text-[10px] font-mono px-1.5 rounded-full bg-ivory-200 dark:bg-espresso-750">
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
              className={`rounded-2xl border border-ivory-300 dark:border-espresso-750 bg-ivory-100/70 dark:bg-espresso-900/60 p-4 space-y-4 ${
                isHiddenOnMobile ? 'hidden sm:block' : 'block'
              }`}
            >
              {/* Column Header */}
              <div className="flex items-center justify-between pb-3 border-b border-ivory-200 dark:border-espresso-800">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${col.dotColor}`} />
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-espresso-900 dark:text-ivory-100">
                    {col.label}
                  </h3>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-ivory-200 dark:bg-espresso-800 text-espresso-700 dark:text-ivory-300">
                    {colTasks.length}
                  </span>
                </div>

                {col.id === 'todo' && (
                  <button
                    onClick={() => {
                      setTaskToEdit(null);
                      setIsTaskModalOpen(true);
                    }}
                    className="p-1 rounded-full text-espresso-400 hover:text-espresso-800 dark:text-espresso-500 dark:hover:text-ivory-100 hover:bg-ivory-200 dark:hover:bg-espresso-800 transition"
                    title="Add new task"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Task Cards Column */}
              <div className="space-y-3 min-h-[140px]">
                {colTasks.length === 0 ? (
                  <div className="py-8 text-center border border-dashed border-ivory-300 dark:border-espresso-750 rounded-xl">
                    <p className="text-xs font-mono text-espresso-400 dark:text-espresso-500">
                      No tasks in {col.label.toLowerCase()}
                    </p>
                    {col.id === 'todo' && (
                      <button
                        onClick={() => {
                          setTaskToEdit(null);
                          setIsTaskModalOpen(true);
                        }}
                        className="mt-2 text-xs font-semibold uppercase tracking-wider text-terracotta-600 dark:text-terracotta-400 hover:underline inline-flex items-center gap-1"
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
