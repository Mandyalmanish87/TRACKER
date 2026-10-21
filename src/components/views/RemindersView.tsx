import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Calendar, Download, ListTodo, GraduationCap, Plus } from 'lucide-react';
import { exportRemindersICS, exportCalendarEventsICS, downloadICS } from '../../utils/icsExporter';
import { EventCalendar } from '../events/EventCalendar';
import { TaskManagementView } from '../events/TaskManagementView';
import { ExamsDeadlinesPanel } from '../events/ExamsDeadlinesPanel';
import { EventModal } from '../events/EventModal';

type ModuleTab = 'calendar' | 'tasks' | 'exams';

export const RemindersView: React.FC = () => {
  const { state } = useApp();
  const [activeTab, setActiveTab] = useState<ModuleTab>('calendar');
  const [isNewEventModalOpen, setIsNewEventModalOpen] = useState(false);

  // Compute pending and completed metrics across events and legacy reminders
  const allItems = state.events && state.events.length > 0 ? state.events : state.reminders;
  const total = allItems.length;
  const completed = allItems.filter((item: any) => item.isCompleted).length;
  const pending = total - completed;

  const handleExportICS = () => {
    // Export events or fallback to reminders
    const ics = state.events && state.events.length > 0
      ? exportCalendarEventsICS(state.events)
      : exportRemindersICS(state.reminders);
    downloadICS(ics, `events-tasks-${new Date().toISOString().split('T')[0]}.ics`);
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Editorial Header */}
      <div className="border-b border-ivory-300 dark:border-espresso-800 pb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <span className="text-xs font-mono font-semibold uppercase tracking-wider text-terracotta-600 dark:text-terracotta-400">
            Academic Schedule, Deadlines &amp; Tasks
          </span>
          <h1 className="font-serif text-3xl sm:text-4xl font-normal text-espresso-950 dark:text-ivory-50 tracking-tight mt-1">
            Events &amp; Tasks
          </h1>
          <p className="text-xs sm:text-sm text-espresso-500 dark:text-espresso-400 mt-1">
            {pending} pending, {completed} completed across exams, deadlines, academic tasks, campus holidays, and reminders.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          {/* Quick Create Action */}
          <button
            onClick={() => setIsNewEventModalOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-terracotta-500 hover:bg-terracotta-600 text-white text-xs font-semibold flex items-center gap-2 shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            <span>Add Event / Task</span>
          </button>

          {/* Export .ics button (Preserves test assertions and user workflow) */}
          <button
            onClick={handleExportICS}
            aria-label="Export .ics"
            className="px-3.5 py-2 rounded-xl border border-ivory-300 dark:border-espresso-700 bg-white dark:bg-espresso-850 hover:bg-ivory-50 dark:hover:bg-espresso-800 text-espresso-800 dark:text-ivory-100 text-xs font-semibold flex items-center gap-2 shadow-subtle transition"
            title="Export to iCalendar (.ics)"
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Export .ics</span>
            <Download className="w-3 h-3 text-espresso-400 dark:text-espresso-500" />
          </button>
        </div>
      </div>

      {/* View Switcher Tabs */}
      <div className="flex items-center gap-2 p-1 bg-ivory-200/70 dark:bg-espresso-800/80 rounded-2xl w-fit border border-ivory-300 dark:border-espresso-700">
        <button
          onClick={() => setActiveTab('calendar')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition ${
            activeTab === 'calendar'
              ? 'bg-white dark:bg-espresso-700 text-espresso-950 dark:text-ivory-50 shadow-xs'
              : 'text-espresso-600 dark:text-espresso-300 hover:text-espresso-950 dark:hover:text-ivory-100'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Calendar Planner</span>
        </button>

        <button
          onClick={() => setActiveTab('tasks')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition ${
            activeTab === 'tasks'
              ? 'bg-white dark:bg-espresso-700 text-espresso-950 dark:text-ivory-50 shadow-xs'
              : 'text-espresso-600 dark:text-espresso-300 hover:text-espresso-950 dark:hover:text-ivory-100'
          }`}
        >
          <ListTodo className="w-4 h-4" />
          <span>Tasks &amp; Action Items</span>
        </button>

        <button
          onClick={() => setActiveTab('exams')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition ${
            activeTab === 'exams'
              ? 'bg-white dark:bg-espresso-700 text-espresso-950 dark:text-ivory-50 shadow-xs'
              : 'text-espresso-600 dark:text-espresso-300 hover:text-espresso-950 dark:hover:text-ivory-100'
          }`}
        >
          <GraduationCap className="w-4 h-4" />
          <span>Exams &amp; Deadlines</span>
        </button>
      </div>

      {/* Active Tab View */}
      {activeTab === 'calendar' && <EventCalendar />}
      {activeTab === 'tasks' && <TaskManagementView />}
      {activeTab === 'exams' && <ExamsDeadlinesPanel />}

      {/* Quick Add Modal */}
      <EventModal
        isOpen={isNewEventModalOpen}
        onClose={() => setIsNewEventModalOpen(false)}
      />
    </div>
  );
};
