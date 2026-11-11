import React, { useState, useMemo } from 'react';
import {
  CheckSquare,
  RotateCcw,
  HelpCircle,
  Plus,
  Search,
  Filter,
  AlertCircle,
  Table2,
  Trash2,
  Check,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { useBulkSelection } from '../../hooks/useBulkSelection';
import { DataTable } from '../common/DataTable';
import { ConfirmModal } from '../common/ConfirmModal';
import { Badge } from '../common/Badge';
import { PlannerTask, TaskStatus, TaskPriority } from '../../types';
import { filterTasks, getDueTodayTasks, getOverdueTasks } from '../../utils/plannerUtils';
import { KanbanBoard } from '../planner/KanbanBoard';
import { SpacedRepetitionPanel } from '../planner/SpacedRepetitionPanel';
import { DailyQuestionsPanel } from '../planner/DailyQuestionsPanel';
import { TaskModal } from '../planner/TaskModal';

interface PlannerViewProps {
  onNavigateToSyllabus?: (subjectId?: string) => void;
  onOpenTaskFocus?: (task: PlannerTask) => void;
}

export type PlannerSubTab = 'kanban' | 'table' | 'spaced_repetition' | 'daily_questions';

export const PlannerView: React.FC<PlannerViewProps> = ({ onNavigateToSyllabus, onOpenTaskFocus }) => {
  const { state, updateTask, deleteTask } = useApp();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<PlannerSubTab>('kanban');
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);

  // Filter state for Kanban Board
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | 'all'>('all');
  const [subjectFilter, setSubjectFilter] = useState<string>('all');
  const [dueFilter, setDueFilter] = useState<'all' | 'today' | 'upcoming' | 'overdue'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Task creation modal
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);

  const allTasks = state.tasks || [];
  const subjects = state.subjects || [];
  const syllabusSubjects = state.syllabusSubjects || [];

  // Overdue tasks
  const overdueTasks = useMemo(() => getOverdueTasks(allTasks), [allTasks]);
  const dueTodayTasks = useMemo(() => getDueTodayTasks(allTasks), [allTasks]);
  const completedTasks = useMemo(() => allTasks.filter((task) => task.status === 'done'), [allTasks]);
  const openTasks = allTasks.length - completedTasks.length;

  // Filtered tasks for Kanban board
  const filteredTasks = useMemo(() => {
    return filterTasks(allTasks, {
      status: statusFilter,
      priority: priorityFilter,
      subjectId: subjectFilter,
      dueDateRange: dueFilter,
      searchQuery,
    });
  }, [allTasks, statusFilter, priorityFilter, subjectFilter, dueFilter, searchQuery]);

  const {
    selectedIds,
    selectedCount,
    toggle,
    clearSelection,
    toggleAll,
  } = useBulkSelection(filteredTasks);

  const handleBulkComplete = () => {
    selectedIds.forEach((id) => updateTask(id, { status: 'done' }));
    toast.success(`Marked ${selectedCount} task${selectedCount > 1 ? 's' : ''} as completed!`);
    clearSelection();
  };

  const handleBulkDelete = () => {
    selectedIds.forEach((id) => deleteTask(id));
    toast.success(`Deleted ${selectedCount} task${selectedCount > 1 ? 's' : ''}`);
    clearSelection();
    setBulkDeleteConfirmOpen(false);
  };

  return (
    <div className="study-workspace space-y-6 sm:space-y-8 pb-20">
      {/* Editorial Header */}
      <div className="study-page-hero border-b border-ivory-300 dark:border-espresso-800 pb-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <span className="text-xs font-mono font-semibold uppercase tracking-wider text-terracotta-600 dark:text-terracotta-400">
              Knowledge Retention
            </span>
            <h1 className="font-serif text-3xl sm:text-4xl font-normal text-espresso-950 dark:text-ivory-50 tracking-tight mt-1">
              Study Planner &amp; Knowledge Retention
            </h1>
            <p className="text-xs sm:text-sm text-espresso-500 dark:text-espresso-400 mt-1">
              Active task management, progressive spaced repetition, and empirical daily question tracking.
            </p>
          </div>

          {activeTab === 'kanban' && (
            <button
              onClick={() => setIsTaskModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-white text-xs font-semibold shadow-subtle transition hover:opacity-95 shrink-0"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              <Plus className="w-4 h-4" /> New Task
            </button>
          )}
        </div>

        {/* Overdue alert ribbon */}
        {overdueTasks.length > 0 && activeTab === 'kanban' && (
          <div className="mt-5 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 flex items-center justify-between text-xs text-rose-700 dark:text-rose-300">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
              <span className="font-mono">
                You have <strong className="font-bold">{overdueTasks.length}</strong> overdue task
                {overdueTasks.length !== 1 ? 's' : ''} requiring attention.
              </span>
            </div>
            <button
              onClick={() => setDueFilter('overdue')}
              className="text-xs uppercase tracking-wider underline font-bold hover:text-rose-900 dark:hover:text-rose-100"
            >
              Filter Overdue ›
            </button>
          </div>
        )}
      </div>

      <div className="planner-command-center">
      <section className="study-quick-stats" aria-label="Planner overview">
        <div className="study-quick-stat"><span>Open tasks</span><strong>{openTasks}</strong><small>Ready to move forward</small></div>
        <div className="study-quick-stat"><span>Due today</span><strong>{dueTodayTasks.length}</strong><small>Your next priorities</small></div>
        <div className="study-quick-stat"><span>Overdue</span><strong className={overdueTasks.length ? 'is-alert' : ''}>{overdueTasks.length}</strong><small>{overdueTasks.length ? 'Needs a quick review' : 'You are all caught up'}</small></div>
        <div className="study-quick-stat"><span>Completed</span><strong>{completedTasks.length}</strong><small>Progress already made</small></div>
      </section>

      {/* Navigation Sub-Tabs */}
      <div className="planner-section-switcher flex flex-wrap items-center gap-2 border-b border-ivory-300 dark:border-espresso-800 pb-4">
        <button
          onClick={() => setActiveTab('kanban')}
          className={`flex items-center gap-2 px-3.5 sm:px-4 py-1.5 rounded-xl text-xs font-medium transition ${
            activeTab === 'kanban'
              ? 'bg-espresso-950 dark:bg-ivory-100 text-ivory-50 dark:text-espresso-950 font-bold shadow-subtle'
              : 'text-espresso-600 dark:text-espresso-300 hover:text-espresso-900 dark:hover:text-ivory-100 hover:bg-ivory-200/60 dark:hover:bg-espresso-800/60'
          }`}
        >
          <CheckSquare className="w-3.5 h-3.5" />
          <span>Task Board</span>
          <span
            className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
              activeTab === 'kanban'
                ? 'bg-white/20 dark:bg-black/20 text-current'
                : 'bg-ivory-200 dark:bg-espresso-800'
            }`}
          >
            {allTasks.filter((t) => t.status !== 'done').length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('table')}
          className={`flex items-center gap-2 px-3.5 sm:px-4 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer ${
            activeTab === 'table'
              ? 'bg-espresso-950 dark:bg-ivory-100 text-ivory-50 dark:text-espresso-950 font-bold shadow-subtle'
              : 'text-espresso-600 dark:text-espresso-300 hover:text-espresso-900 dark:hover:text-ivory-100 hover:bg-ivory-200/60 dark:hover:bg-espresso-800/60'
          }`}
        >
          <Table2 className="w-3.5 h-3.5" />
          <span>Task Ledger</span>
          <span
            className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
              activeTab === 'table'
                ? 'bg-white/20 dark:bg-black/20 text-current'
                : 'bg-ivory-200 dark:bg-espresso-800'
            }`}
          >
            {filteredTasks.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('spaced_repetition')}
          className={`flex items-center gap-2 px-3.5 sm:px-4 py-1.5 rounded-xl text-xs font-medium transition ${
            activeTab === 'spaced_repetition'
              ? 'bg-espresso-950 dark:bg-ivory-100 text-ivory-50 dark:text-espresso-950 font-bold shadow-subtle'
              : 'text-espresso-600 dark:text-espresso-300 hover:text-espresso-900 dark:hover:text-ivory-100 hover:bg-ivory-200/60 dark:hover:bg-espresso-800/60'
          }`}
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Spaced Repetition</span>
          <span
            className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
              activeTab === 'spaced_repetition'
                ? 'bg-white/20 dark:bg-black/20 text-current'
                : 'bg-ivory-200 dark:bg-espresso-800'
            }`}
          >
            {(state.spacedReviews || []).length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('daily_questions')}
          className={`flex items-center gap-2 px-3.5 sm:px-4 py-1.5 rounded-xl text-xs font-medium transition ${
            activeTab === 'daily_questions'
              ? 'bg-espresso-950 dark:bg-ivory-100 text-ivory-50 dark:text-espresso-950 font-bold shadow-subtle'
              : 'text-espresso-600 dark:text-espresso-300 hover:text-espresso-900 dark:hover:text-ivory-100 hover:bg-ivory-200/60 dark:hover:bg-espresso-800/60'
          }`}
        >
          <HelpCircle className="w-3.5 h-3.5" />
          <span>Daily Questions</span>
          <span
            className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
              activeTab === 'daily_questions'
                ? 'bg-white/20 dark:bg-black/20 text-current'
                : 'bg-ivory-200 dark:bg-espresso-800'
            }`}
          >
            {(state.dailyQuestions || []).length}
          </span>
        </button>
      </div>
      </div>

      {/* Main Tab Content */}
      {activeTab === 'kanban' && (
        <div className="space-y-6">
          {/* Filters Bar */}
          <div className="planner-filter-panel p-4 rounded-2xl border border-ivory-300 dark:border-espresso-750 bg-white dark:bg-espresso-850 shadow-subtle flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 text-espresso-400 dark:text-espresso-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tasks, descriptions, or notes..."
                className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-ivory-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-900 text-espresso-900 dark:text-ivory-100 placeholder:text-espresso-400 dark:placeholder:text-espresso-500 focus:outline-none focus:ring-2 focus:ring-terracotta-400"
              />
            </div>

            {/* Dropdown Filters */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 text-xs font-mono font-semibold uppercase tracking-wider text-espresso-600 dark:text-espresso-400">
                <Filter className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Filters:</span>
              </div>

              {/* Status */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as TaskStatus | 'all')}
                className="px-3 py-1.5 text-xs font-mono rounded-xl border border-ivory-300 dark:border-espresso-700 bg-white dark:bg-espresso-800 text-espresso-900 dark:text-ivory-100 focus:outline-none focus:ring-2 focus:ring-terracotta-400"
              >
                <option value="all">All Statuses</option>
                <option value="todo">To Do</option>
                <option value="in_progress">In Progress</option>
                <option value="done">Done</option>
              </select>

              {/* Priority */}
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value as TaskPriority | 'all')}
                className="px-3 py-1.5 text-xs font-mono rounded-xl border border-ivory-300 dark:border-espresso-700 bg-white dark:bg-espresso-800 text-espresso-900 dark:text-ivory-100 focus:outline-none focus:ring-2 focus:ring-terracotta-400"
              >
                <option value="all">All Priorities</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>

              {/* Due Date Filter */}
              <select
                value={dueFilter}
                onChange={(e) =>
                  setDueFilter(e.target.value as 'all' | 'today' | 'upcoming' | 'overdue')
                }
                className="px-3 py-1.5 text-xs font-mono rounded-xl border border-ivory-300 dark:border-espresso-700 bg-white dark:bg-espresso-800 text-espresso-900 dark:text-ivory-100 focus:outline-none focus:ring-2 focus:ring-terracotta-400"
              >
                <option value="all">All Dates</option>
                <option value="today">Due Today</option>
                <option value="upcoming">Upcoming</option>
                <option value="overdue">Overdue</option>
              </select>

              {/* Subject Filter */}
              <select
                value={subjectFilter}
                onChange={(e) => setSubjectFilter(e.target.value)}
                className="px-3 py-1.5 text-xs font-mono rounded-xl border border-ivory-300 dark:border-espresso-700 bg-white dark:bg-espresso-800 text-espresso-900 dark:text-ivory-100 max-w-[130px] truncate focus:outline-none focus:ring-2 focus:ring-terracotta-400"
              >
                <option value="all">All Subjects</option>
                {syllabusSubjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
                {subjects
                  .filter((s) => !syllabusSubjects.some((syl) => syl.id === s.id))
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
              </select>

              {(statusFilter !== 'all' ||
                priorityFilter !== 'all' ||
                dueFilter !== 'all' ||
                subjectFilter !== 'all' ||
                searchQuery) && (
                <button
                  onClick={() => {
                    setStatusFilter('all');
                    setPriorityFilter('all');
                    setDueFilter('all');
                    setSubjectFilter('all');
                    setSearchQuery('');
                  }}
                  className="text-xs font-mono uppercase tracking-wider text-terracotta-600 dark:text-terracotta-400 font-bold hover:underline"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* Kanban Board Component */}
          {allTasks.length === 0 ? (
            <div className="py-16 text-center border border-dashed border-ivory-300 dark:border-espresso-750 rounded-2xl bg-white/40 dark:bg-espresso-850/40">
              <CheckSquare className="w-10 h-10 text-espresso-400 mx-auto mb-3" />
              <h3 className="font-serif text-lg font-semibold text-espresso-950 dark:text-ivory-100">
                No events or tasks yet. Create your first task.
              </h3>
              <p className="text-xs text-espresso-500 dark:text-espresso-400 max-w-sm mx-auto mt-1 mb-4">
                Plan exams, assignment deadlines, academic milestones, and daily to-dos.
              </p>
              <button
                onClick={() => setIsTaskModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-xs font-semibold shadow-subtle cursor-pointer"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                <Plus className="w-4 h-4" /> New Task
              </button>
            </div>
          ) : (
            <KanbanBoard tasks={filteredTasks} onNavigateToSyllabus={onNavigateToSyllabus} onOpenTaskFocus={onOpenTaskFocus} />
          )}
        </div>
      )}

      {/* Structured Task Table View with Multi-Selection & Bulk Actions */}
      {activeTab === 'table' && (
        <div className="space-y-4">
          <DataTable<PlannerTask>
            data={filteredTasks}
            keyField="id"
            selectable={true}
            selectedIds={selectedIds}
            onToggleSelect={toggle}
            onToggleSelectAll={toggleAll}
            bulkActions={[
              {
                id: 'bulk-complete',
                label: 'Mark Done',
                icon: <Check className="w-3.5 h-3.5" />,
                variant: 'primary',
                onClick: handleBulkComplete,
              },
              {
                id: 'bulk-delete',
                label: 'Delete Selected',
                icon: <Trash2 className="w-3.5 h-3.5" />,
                variant: 'danger',
                onClick: () => setBulkDeleteConfirmOpen(true),
              },
            ]}
            columns={[
              {
                key: 'title',
                header: 'Task Title',
                sortable: true,
                render: (task) => (
                  <div className="space-y-0.5">
                    <span className={`font-semibold block ${task.status === 'done' ? 'line-through text-espresso-400 dark:text-espresso-500' : 'text-espresso-950 dark:text-ivory-50'}`}>
                      {task.title}
                    </span>
                    {task.description && (
                      <span className="text-[11px] text-espresso-500 dark:text-espresso-400 line-clamp-1">
                        {task.description}
                      </span>
                    )}
                  </div>
                ),
              },
              {
                key: 'priority',
                header: 'Priority',
                sortable: true,
                render: (task) => (
                  <Badge
                    variant={
                      task.priority === 'high'
                        ? 'danger'
                        : task.priority === 'medium'
                        ? 'ochre'
                        : 'neutral'
                    }
                  >
                    {task.priority.toUpperCase()}
                  </Badge>
                ),
              },
              {
                key: 'status',
                header: 'Status',
                sortable: true,
                render: (task) => (
                  <Badge
                    variant={
                      task.status === 'done'
                        ? 'sage'
                        : task.status === 'in_progress'
                        ? 'ochre'
                        : 'neutral'
                    }
                  >
                    {task.status === 'in_progress' ? 'In Progress' : task.status === 'done' ? 'Done' : 'To Do'}
                  </Badge>
                ),
              },
              {
                key: 'dueDate',
                header: 'Due Date',
                sortable: true,
                render: (task) => (
                  <span className="font-mono text-xs text-espresso-700 dark:text-ivory-200">
                    {task.dueDate || 'No deadline'}
                  </span>
                ),
              },
              {
                key: 'actions',
                header: 'Action',
                align: 'right',
                render: (task) => (
                  <button
                    type="button"
                    onClick={() => {
                      const next = task.status === 'done' ? 'todo' : 'done';
                      updateTask(task.id, { status: next });
                      if (next === 'done') {
                        toast.success(`Completed "${task.title}"`, {
                          action: {
                            label: 'Undo',
                            onClick: () => updateTask(task.id, { status: 'todo' }),
                          },
                        });
                      }
                    }}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-ivory-200 dark:bg-white/10 hover:bg-ivory-300 dark:hover:bg-white/15 text-espresso-800 dark:text-ivory-100 transition cursor-pointer"
                  >
                    {task.status === 'done' ? 'Reopen' : 'Done'}
                  </button>
                ),
              },
            ]}
          />
        </div>
      )}

      {activeTab === 'spaced_repetition' && (
        <SpacedRepetitionPanel onNavigateToSyllabus={onNavigateToSyllabus} />
      )}

      {activeTab === 'daily_questions' && <DailyQuestionsPanel />}

      {/* Bulk Delete Safety Confirmation */}
      <ConfirmModal
        isOpen={bulkDeleteConfirmOpen}
        title={`Delete ${selectedCount} Selected Tasks`}
        message={`Are you sure you want to permanently delete ${selectedCount} study tasks? This operation cannot be undone.`}
        confirmLabel="Delete Tasks"
        variant="danger"
        irreversible={true}
        onConfirm={handleBulkDelete}
        onCancel={() => setBulkDeleteConfirmOpen(false)}
      />

      {/* Task Creation Modal */}
      <TaskModal
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
      />
    </div>
  );
};
