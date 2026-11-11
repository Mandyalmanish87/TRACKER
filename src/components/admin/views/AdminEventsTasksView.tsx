import React, { useState, useMemo } from 'react';
import {
  ListTodo,
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Search,
  Flag,
  Tag,
} from 'lucide-react';
import { useAdminApp } from '../useAdminApp';
import { isTaskOverdue } from '../../../utils/plannerUtils';
import { AdminPageHeader } from '../common/AdminPageHeader';
import { AdminStatCard } from '../common/AdminStatCard';
import { AdminEmptyState } from '../common/AdminEmptyState';

export const AdminEventsTasksView: React.FC = () => {
  const { state } = useAdminApp();
  const [tabType, setTabType] = useState<'tasks' | 'events'>('tasks');
  const [statusFilter, setStatusFilter] = useState<'all' | 'todo' | 'in_progress' | 'done' | 'overdue'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const tasks = state.tasks || [];
  const reminders = state.reminders || [];

  // Filter tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      const isOverdue = isTaskOverdue(t);
      const matchSearch = t.title.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchSearch) return false;

      if (statusFilter === 'all') return true;
      if (statusFilter === 'overdue') return isOverdue;
      return t.status === statusFilter;
    });
  }, [tasks, statusFilter, searchQuery]);

  // Filter events
  const filteredReminders = useMemo(() => {
    return reminders.filter((r) => {
      return r.title.toLowerCase().includes(searchQuery.toLowerCase());
    });
  }, [reminders, searchQuery]);

  const overdueCount = tasks.filter((t) => isTaskOverdue(t)).length;
  const completedTasksCount = tasks.filter((t) => t.status === 'done').length;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Events, Deadlines &amp; Task Ledger"
        description="Administrative visibility into all planned student tasks, upcoming academic deadlines, examination schedules, and completion state."
        badge={{
          label: `${tasks.length} Tasks · ${reminders.length} Events`,
          variant: overdueCount > 0 ? 'rose' : 'blue',
        }}
      >
        <div className="flex items-center gap-2 p-1 rounded-xl bg-white/5 border border-white/10 text-xs font-mono">
          <button
            onClick={() => setTabType('tasks')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
              tabType === 'tasks' ? 'bg-blue-600 text-white shadow-xs' : 'text-ivory-400 hover:text-white'
            }`}
          >
            Study Tasks ({tasks.length})
          </button>
          <button
            onClick={() => setTabType('events')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
              tabType === 'events' ? 'bg-blue-600 text-white shadow-xs' : 'text-ivory-400 hover:text-white'
            }`}
          >
            Events &amp; Exams ({reminders.length})
          </button>
        </div>
      </AdminPageHeader>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <AdminStatCard
          title="Total Tasks"
          value={tasks.length}
          subtitle={`${completedTasksCount} completed (${tasks.length > 0 ? Math.round((completedTasksCount / tasks.length) * 100) : 0}%)`}
          icon={<ListTodo className="w-4 h-4" />}
          accentColor="#3B82F6"
        />

        <AdminStatCard
          title="Overdue Tasks"
          value={overdueCount}
          subtitle="Past configured deadline"
          icon={<AlertTriangle className="w-4 h-4" />}
          accentColor="#EF4444"
          trend={{ value: overdueCount === 0 ? 'On Track' : 'Alert', isPositive: overdueCount === 0 }}
        />

        <AdminStatCard
          title="Academic Events"
          value={reminders.length}
          subtitle={`${reminders.filter((r) => r.category === 'academic').length} Academic items`}
          icon={<Calendar className="w-4 h-4" />}
          accentColor="#8B5CF6"
        />

        <AdminStatCard
          title="Pending Reminders"
          value={reminders.filter((r) => !r.isCompleted).length}
          subtitle="Active notifications"
          icon={<Clock className="w-4 h-4" />}
          accentColor="#F59E0B"
        />
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-espresso-400 dark:text-ivory-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search ${tabType === 'tasks' ? 'tasks' : 'events'}...`}
            className="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl bg-white/95 dark:bg-[#0A0F1D]/90 border border-ivory-300/80 dark:border-white/10 text-espresso-900 dark:text-ivory-100 placeholder-espresso-400 dark:placeholder-ivory-400 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-sm"
          />
        </div>

        {tabType === 'tasks' && (
          <div className="flex items-center gap-1.5 overflow-x-auto text-xs font-mono">
            {(['all', 'todo', 'in_progress', 'done', 'overdue'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 rounded-lg uppercase tracking-wider text-[10px] font-semibold transition cursor-pointer ${
                  statusFilter === st
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-white/5 text-ivory-400 hover:text-white border border-white/10'
                }`}
              >
                {st.replace('_', ' ')}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Tasks Table */}
      {tabType === 'tasks' ? (
        filteredTasks.length === 0 ? (
          <AdminEmptyState
            icon={<ListTodo className="w-6 h-6" />}
            title="No Tasks Found"
            description={
              searchQuery
                ? `No tasks match query "${searchQuery}".`
                : 'No tasks registered under this status filter.'
            }
          />
        ) : (
          <div className="rounded-3xl bg-white/95 dark:bg-[#0A0F1D]/90 border border-ivory-300/80 dark:border-white/10 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-ivory-100/70 dark:bg-white/[0.03] border-b border-ivory-200 dark:border-white/10 text-espresso-500 dark:text-ivory-400 font-mono uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3.5 px-4">Task Title</th>
                    <th className="py-3.5 px-4">Due Date</th>
                    <th className="py-3.5 px-4">Priority</th>
                    <th className="py-3.5 px-4">Estimated Time</th>
                    <th className="py-3.5 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ivory-200/80 dark:divide-white/5 font-sans">
                  {filteredTasks.map((task) => {
                    const isOverdue = isTaskOverdue(task);
                    return (
                      <tr key={task.id} className="hover:bg-ivory-50/80 dark:hover:bg-white/[0.02] transition-colors">
                        <td className="py-3.5 px-4 font-semibold text-espresso-950 dark:text-white">
                          {task.title}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-espresso-600 dark:text-ivory-300">
                          {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No date'}
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider ${
                              task.priority === 'high'
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                            }`}
                          >
                            <Flag className="w-3 h-3" />
                            {task.priority || 'medium'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-espresso-600 dark:text-ivory-300">
                          {task.estimatedDuration ? `${task.estimatedDuration}m` : '—'}
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider ${
                              isOverdue
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                : task.status === 'done'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : task.status === 'in_progress'
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                : 'bg-ivory-200 dark:bg-white/10 text-espresso-700 dark:text-ivory-300'
                            }`}
                          >
                            {isOverdue && <AlertTriangle className="w-3 h-3" />}
                            {task.status === 'done' && <CheckCircle2 className="w-3 h-3" />}
                            {isOverdue ? 'Overdue' : task.status.replace('_', ' ')}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : (
        /* Events Table */
        filteredReminders.length === 0 ? (
          <AdminEmptyState
            icon={<Calendar className="w-6 h-6" />}
            title="No Events Found"
            description="No academic events, exams, or reminders recorded."
          />
        ) : (
          <div className="rounded-3xl bg-white/95 dark:bg-[#0A0F1D]/90 border border-ivory-300/80 dark:border-white/10 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-ivory-100/70 dark:bg-white/[0.03] border-b border-ivory-200 dark:border-white/10 text-espresso-500 dark:text-ivory-400 font-mono uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3.5 px-4">Event Title</th>
                    <th className="py-3.5 px-4">Date &amp; Time</th>
                    <th className="py-3.5 px-4">Category Type</th>
                    <th className="py-3.5 px-4">Completion Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ivory-200/80 dark:divide-white/5 font-sans">
                  {filteredReminders.map((rem) => (
                    <tr key={rem.id} className="hover:bg-ivory-50/80 dark:hover:bg-white/[0.02] transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-espresso-950 dark:text-white">
                        {rem.title}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-espresso-600 dark:text-ivory-300">
                        {rem.dueDate ? new Date(rem.dueDate).toLocaleDateString() : 'No date'}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/20">
                          <Tag className="w-3 h-3" />
                          {rem.category || 'Event'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono">
                        <span className={rem.isCompleted ? 'text-emerald-500 font-bold' : 'text-amber-500 font-bold'}>
                          {rem.isCompleted ? 'Completed' : 'Pending'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}
    </div>
  );
};
