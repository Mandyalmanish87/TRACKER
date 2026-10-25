import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  ArrowUpDown,
  Plus,
  CheckCircle2,
  Circle,
  Clock,
  Calendar as CalendarIcon,
  AlertCircle,
  Tag,
  Kanban,
  List as ListIcon,
  Trash2,
  CheckSquare,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { CalendarEvent, EventCategory, EventPriority, TaskStatus } from '../../types';
import { EVENT_CATEGORIES, getEventCategoryConfig } from '../../utils/eventCategories';
import { EventModal } from './EventModal';
import { InlineSubtaskList } from '../planner/InlineSubtaskList';
import { ConfirmModal } from '../common/ConfirmModal';
import { toLocalDateString } from './EventCalendar';

export const TaskManagementView: React.FC = () => {
  const { state, updateEvent, deleteEvent, toggleEventComplete, toggleEventSubtask } = useApp();

  const [layoutMode, setLayoutMode] = useState<'board' | 'list'>('board');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<EventCategory | 'all'>('all');
  const [filterPriority, setFilterPriority] = useState<EventPriority | 'all'>('all');
  const [sortBy, setSortBy] = useState<'date_asc' | 'date_desc' | 'priority' | 'title'>('date_asc');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [eventToDelete, setEventToDelete] = useState<CalendarEvent | null>(null);

  // Drag and drop in board view
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);

  const todayStr = useMemo(() => toLocalDateString(new Date()), []);

  // Filter and sort events
  const filteredEvents = useMemo(() => {
    let list = [...(state.events || [])];

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          (e.description && e.description.toLowerCase().includes(q)) ||
          (e.location && e.location.toLowerCase().includes(q))
      );
    }

    // Category filter
    if (filterCategory !== 'all') {
      list = list.filter((e) => e.category === filterCategory);
    }

    // Priority filter
    if (filterPriority !== 'all') {
      list = list.filter((e) => e.priority === filterPriority);
    }

    // Sorting
    list.sort((a, b) => {
      if (sortBy === 'date_asc') return (a.date || '').localeCompare(b.date || '');
      if (sortBy === 'date_desc') return (b.date || '').localeCompare(a.date || '');
      if (sortBy === 'priority') {
        const priorityWeight = { high: 3, medium: 2, low: 1 };
        return (priorityWeight[b.priority || 'medium'] || 0) - (priorityWeight[a.priority || 'medium'] || 0);
      }
      if (sortBy === 'title') return a.title.localeCompare(b.title);
      return 0;
    });

    return list;
  }, [state.events, searchQuery, filterCategory, filterPriority, sortBy]);

  // Group events by status
  const todoTasks = useMemo(
    () => filteredEvents.filter((e) => (e.status || 'todo') === 'todo' && !e.isCompleted),
    [filteredEvents]
  );
  const inProgressTasks = useMemo(
    () => filteredEvents.filter((e) => e.status === 'in_progress' && !e.isCompleted),
    [filteredEvents]
  );
  const doneTasks = useMemo(
    () => filteredEvents.filter((e) => e.status === 'done' || e.isCompleted),
    [filteredEvents]
  );

  // Drag and drop status handlers
  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedTaskId(id);
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDropOnStatus = (e: React.DragEvent, targetStatus: TaskStatus) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain') || draggedTaskId;
    if (!taskId) return;

    updateEvent(taskId, {
      status: targetStatus,
      isCompleted: targetStatus === 'done',
      completedAt: targetStatus === 'done' ? new Date().toISOString() : undefined,
    });
    setDraggedTaskId(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleEdit = (event: CalendarEvent) => {
    setEditingEvent(event);
    setIsModalOpen(true);
  };

  const handleCreate = () => {
    setEditingEvent(null);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-4">
      {/* Search, Filter & Layout Controls */}
      <div className="p-4 rounded-2xl bg-white dark:bg-espresso-850 border border-ivory-300 dark:border-espresso-750 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Bar */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-espresso-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tasks, exams, deadlines, or notes..."
              className="w-full pl-9 pr-3.5 py-2 text-xs sm:text-sm rounded-xl border border-ivory-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-800 text-espresso-950 dark:text-ivory-100 focus:outline-none focus:ring-2 focus:ring-terracotta-500"
            />
          </div>

          {/* Board / List switch & Add */}
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-ivory-100 dark:bg-espresso-800 rounded-xl p-1 border border-ivory-200 dark:border-espresso-700">
              <button
                onClick={() => setLayoutMode('board')}
                aria-label="Kanban Board View"
                className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                  layoutMode === 'board'
                    ? 'bg-white dark:bg-espresso-700 text-espresso-950 dark:text-ivory-50 shadow-xs'
                    : 'text-espresso-600 dark:text-espresso-400'
                }`}
              >
                <Kanban className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Board</span>
              </button>
              <button
                onClick={() => setLayoutMode('list')}
                aria-label="List View"
                className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                  layoutMode === 'list'
                    ? 'bg-white dark:bg-espresso-700 text-espresso-950 dark:text-ivory-50 shadow-xs'
                    : 'text-espresso-600 dark:text-espresso-400'
                }`}
              >
                <ListIcon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">List</span>
              </button>
            </div>

            <button
              onClick={handleCreate}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-terracotta-500 hover:bg-terracotta-600 text-white text-xs font-semibold shadow-xs transition"
            >
              <Plus className="w-4 h-4" />
              <span>Add Task</span>
            </button>
          </div>
        </div>

        {/* Filter & Sort Bar */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-ivory-200 dark:border-espresso-800 text-xs">
          <div className="flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5 text-espresso-400" />
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value as any)}
              className="px-2.5 py-1.5 rounded-xl border border-ivory-300 dark:border-espresso-700 bg-white dark:bg-espresso-800 text-espresso-900 dark:text-ivory-100"
            >
              <option value="all">All Categories</option>
              {(Object.keys(EVENT_CATEGORIES) as EventCategory[]).map((cat) => (
                <option key={cat} value={cat}>
                  {EVENT_CATEGORIES[cat].label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-espresso-400" />
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value as any)}
              className="px-2.5 py-1.5 rounded-xl border border-ivory-300 dark:border-espresso-700 bg-white dark:bg-espresso-800 text-espresso-900 dark:text-ivory-100"
            >
              <option value="all">All Priorities</option>
              <option value="high">High Priority</option>
              <option value="medium">Medium Priority</option>
              <option value="low">Low Priority</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 ml-auto">
            <ArrowUpDown className="w-3.5 h-3.5 text-espresso-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-2.5 py-1.5 rounded-xl border border-ivory-300 dark:border-espresso-700 bg-white dark:bg-espresso-800 text-espresso-900 dark:text-ivory-100"
            >
              <option value="date_asc">Due Date (Earliest First)</option>
              <option value="date_desc">Due Date (Latest First)</option>
              <option value="priority">Priority (High to Low)</option>
              <option value="title">Title (A to Z)</option>
            </select>
          </div>
        </div>
      </div>

      {/* RENDER LAYOUT */}
      {layoutMode === 'board' ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
          {/* TO DO COLUMN */}
          <BoardColumn
            title="To Do"
            status="todo"
            count={todoTasks.length}
            tasks={todoTasks}
            todayStr={todayStr}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDrop={handleDropOnStatus}
            onEdit={handleEdit}
            onToggleComplete={toggleEventComplete}
            onToggleSubtask={toggleEventSubtask}
            onDelete={setEventToDelete}
          />

          {/* IN PROGRESS COLUMN */}
          <BoardColumn
            title="In Progress"
            status="in_progress"
            count={inProgressTasks.length}
            tasks={inProgressTasks}
            todayStr={todayStr}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDrop={handleDropOnStatus}
            onEdit={handleEdit}
            onToggleComplete={toggleEventComplete}
            onToggleSubtask={toggleEventSubtask}
            onDelete={setEventToDelete}
          />

          {/* COMPLETED COLUMN */}
          <BoardColumn
            title="Completed"
            status="done"
            count={doneTasks.length}
            tasks={doneTasks}
            todayStr={todayStr}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDrop={handleDropOnStatus}
            onEdit={handleEdit}
            onToggleComplete={toggleEventComplete}
            onToggleSubtask={toggleEventSubtask}
            onDelete={setEventToDelete}
          />
        </div>
      ) : (
        /* LIST VIEW */
        <div className="bg-white dark:bg-espresso-850 rounded-2xl border border-ivory-300 dark:border-espresso-750 shadow-xs divide-y divide-ivory-200 dark:divide-espresso-800 overflow-hidden">
          {filteredEvents.length === 0 ? (
            <div className="p-8 text-center text-espresso-400 dark:text-espresso-500 text-sm">
              No tasks or events found matching your criteria.
            </div>
          ) : (
            filteredEvents.map((evt) => {
              const conf = getEventCategoryConfig(evt.category);
              const isOverdue = evt.date < todayStr && !evt.isCompleted;

              return (
                <div
                  key={evt.id}
                  onClick={() => handleEdit(evt)}
                  className="p-3.5 sm:p-4 flex items-center justify-between gap-3 hover:bg-ivory-50/70 dark:hover:bg-espresso-800/40 cursor-pointer transition"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleEventComplete(evt.id);
                      }}
                      className="hover:scale-110 transition shrink-0"
                    >
                      {evt.isCompleted ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      ) : (
                        <Circle className="w-5 h-5 text-espresso-400 hover:text-terracotta-500" />
                      )}
                    </button>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`font-semibold text-sm text-espresso-950 dark:text-ivory-50 ${
                            evt.isCompleted ? 'line-through opacity-60' : ''
                          }`}
                        >
                          {evt.title}
                        </span>
                        <span
                          className="text-[10px] font-mono px-2 py-0.5 rounded-full font-semibold uppercase shrink-0"
                          style={{ backgroundColor: conf.lightBg, color: conf.color }}
                        >
                          {conf.shortLabel}
                        </span>
                        {isOverdue && (
                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 uppercase flex items-center gap-0.5">
                            <AlertCircle className="w-2.5 h-2.5" />
                            Overdue
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 mt-1 text-xs text-espresso-500 dark:text-espresso-400 font-mono">
                        <span className="flex items-center gap-1">
                          <CalendarIcon className="w-3.5 h-3.5 text-espresso-400" />
                          {evt.date}
                        </span>
                        {evt.startTime && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-espresso-400" />
                            {evt.startTime}
                          </span>
                        )}
                        {evt.priority === 'high' && (
                          <span className="text-rose-600 font-bold uppercase text-[10px]">High</span>
                        )}
                        {evt.subtasks && evt.subtasks.length > 0 && (
                          <span className="flex items-center gap-1 text-[11px] font-mono text-espresso-600 dark:text-ivory-300">
                            <CheckSquare className="w-3 h-3 text-terracotta-500" />
                            <span>
                              {evt.subtasks.filter((s) => s.isCompleted).length}/{evt.subtasks.length} subtasks
                            </span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEventToDelete(evt);
                    }}
                    className="p-1.5 rounded-lg text-espresso-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                    title="Delete event"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Modal for create/edit */}
      <EventModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        initialEvent={editingEvent}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(eventToDelete)}
        title="Delete Event or Task"
        message={`Are you sure you want to delete "${eventToDelete?.title}"? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => {
          if (eventToDelete) {
            deleteEvent(eventToDelete.id);
            setEventToDelete(null);
          }
        }}
        onCancel={() => setEventToDelete(null)}
      />
    </div>
  );
};

// Subcomponent: Board Column
interface BoardColumnProps {
  title: string;
  status: TaskStatus;
  count: number;
  tasks: CalendarEvent[];
  todayStr: string;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, status: TaskStatus) => void;
  onEdit: (event: CalendarEvent) => void;
  onToggleComplete: (id: string) => void;
  onToggleSubtask?: (eventId: string, subtaskId: string) => void;
  onDelete: (event: CalendarEvent) => void;
}

const BoardColumn: React.FC<BoardColumnProps> = ({
  title,
  status,
  count,
  tasks,
  todayStr,
  onDragStart,
  onDragOver,
  onDrop,
  onEdit,
  onToggleComplete,
  onToggleSubtask,
  onDelete,
}) => {
  return (
    <div
      onDragOver={onDragOver}
      onDrop={(e) => onDrop(e, status)}
      className="bg-ivory-100/60 dark:bg-espresso-900/60 rounded-2xl p-3 border border-ivory-300 dark:border-espresso-750 min-h-[400px] flex flex-col"
    >
      {/* Column Header */}
      <div className="flex items-center justify-between pb-3 border-b border-ivory-200 dark:border-espresso-800 mb-3">
        <div className="flex items-center gap-2">
          <span className="font-serif font-semibold text-sm text-espresso-950 dark:text-ivory-100">
            {title}
          </span>
          <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-white dark:bg-espresso-800 text-espresso-700 dark:text-ivory-200 border border-ivory-200 dark:border-espresso-700">
            {count}
          </span>
        </div>
      </div>

      {/* Task Cards Container */}
      <div className="space-y-2.5 flex-1">
        {tasks.length === 0 ? (
          <div className="h-32 border-2 border-dashed border-ivory-300 dark:border-espresso-800 rounded-xl flex items-center justify-center text-xs font-mono text-espresso-400 text-center p-3">
            Drop tasks here
          </div>
        ) : (
          tasks.map((evt) => {
            const conf = getEventCategoryConfig(evt.category);
            const isOverdue = evt.date < todayStr && !evt.isCompleted;

            return (
              <div
                key={evt.id}
                draggable
                onDragStart={(e) => onDragStart(e, evt.id)}
                onClick={() => onEdit(evt)}
                className="p-3 bg-white dark:bg-espresso-850 rounded-xl border border-ivory-300 dark:border-espresso-750 shadow-xs hover:shadow-md transition cursor-pointer group"
                style={{ borderLeftWidth: '3px', borderLeftColor: conf.color }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleComplete(evt.id);
                      }}
                      className="mt-0.5 hover:scale-110 transition shrink-0"
                    >
                      {evt.isCompleted ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <Circle className="w-4 h-4 text-espresso-400" />
                      )}
                    </button>
                    <h4
                      className={`text-xs font-semibold text-espresso-950 dark:text-ivory-100 leading-snug ${
                        evt.isCompleted ? 'line-through opacity-60' : ''
                      }`}
                    >
                      {evt.title}
                    </h4>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(evt);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 text-espresso-400 hover:text-rose-600 transition"
                    title="Delete event"
                    aria-label={`Delete event ${evt.title}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {evt.description && (
                  <p className="text-[11px] text-espresso-500 dark:text-espresso-400 line-clamp-2 mt-1.5 pl-6">
                    {evt.description}
                  </p>
                )}

                {/* Inline Subtasks */}
                {evt.subtasks && evt.subtasks.length > 0 && onToggleSubtask && (
                  <div className="pl-6">
                    <InlineSubtaskList
                      taskId={evt.id}
                      subtasks={evt.subtasks}
                      onToggleSubtask={onToggleSubtask}
                    />
                  </div>
                )}

                <div className="flex items-center justify-between gap-2 mt-3 pt-2 border-t border-ivory-100 dark:border-espresso-800 text-[10px] font-mono pl-6">
                  <span className="flex items-center gap-1 text-espresso-500 dark:text-espresso-400">
                    <CalendarIcon className="w-3 h-3 text-espresso-400" />
                    {evt.date}
                  </span>

                  <div className="flex items-center gap-1.5">
                    {isOverdue && (
                      <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 font-bold uppercase">
                        Overdue
                      </span>
                    )}
                    <span
                      className="px-1.5 py-0.5 rounded font-semibold uppercase"
                      style={{ backgroundColor: conf.lightBg, color: conf.color }}
                    >
                      {conf.shortLabel}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

