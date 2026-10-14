import React, { useState } from 'react';
import { Card } from '../common/Card';
import { Badge } from '../common/Badge';
import { Button } from '../common/Button';
import { EmptyState } from '../common/EmptyState';
import { useApp } from '../../context/AppContext';
import { Plus, Check, Trash2 } from 'lucide-react';

export const RemindersWidget: React.FC = () => {
  const { state, toggleReminder, addReminder, deleteReminder } = useApp();
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<'academic' | 'fitness' | 'personal'>('academic');
  const [newPriority, setNewPriority] = useState<'high' | 'medium' | 'low'>('high');

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    addReminder({
      title: newTitle.trim(),
      category: newCategory,
      priority: newPriority,
      dueDate: new Date().toISOString().split('T')[0],
    });

    setNewTitle('');
    setIsAdding(false);
  };

  const pending = state.reminders.filter((r) => !r.isCompleted);
  const completed = state.reminders.filter((r) => r.isCompleted);

  return (
    <Card
      eyebrow="Priorities & Tasks"
      title="Daily Action Items"
      subtitle="Connected academic, fitness, and life commitments"
      action={
        <Button
          variant="secondary"
          size="sm"
          icon={<Plus className="w-3.5 h-3.5" />}
          onClick={() => setIsAdding(!isAdding)}
        >
          {isAdding ? 'Cancel' : 'New Task'}
        </Button>
      }
    >
      {/* Inline Quick Add Form */}
      {isAdding && (
        <form
          onSubmit={handleAdd}
          className="p-4 rounded-2xl bg-ivory-100 dark:bg-espresso-800 border border-ivory-300 dark:border-espresso-700 mb-4 space-y-3.5"
        >
          <input
            type="text"
            required
            placeholder="What needs to be accomplished today?"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-ivory-300 dark:border-espresso-700 bg-white dark:bg-espresso-850 text-espresso-900 dark:text-ivory-100 focus:outline-none focus:ring-2 focus:ring-terracotta-500"
          />

          <div className="flex flex-wrap items-center gap-2.5">
            <select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value as any)}
              className="px-3 py-1.5 text-xs font-medium rounded-xl border border-ivory-300 dark:border-espresso-700 bg-white dark:bg-espresso-850 text-espresso-900 dark:text-ivory-100"
            >
              <option value="academic">Academic</option>
              <option value="fitness">Fitness</option>
              <option value="personal">Personal</option>
            </select>

            <select
              value={newPriority}
              onChange={(e) => setNewPriority(e.target.value as any)}
              className="px-3 py-1.5 text-xs font-medium rounded-xl border border-ivory-300 dark:border-espresso-700 bg-white dark:bg-espresso-850 text-espresso-900 dark:text-ivory-100"
            >
              <option value="high">High Priority</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>

            <Button type="submit" variant="terracotta" size="sm" className="ml-auto">
              Save Action
            </Button>
          </div>
        </form>
      )}

      {/* Task List */}
      {state.reminders.length === 0 ? (
        <EmptyState
          title="All commitments clear"
          description="You have no pending tasks. Add an academic assignment or personal reminder above."
          actionLabel="Add Action Item"
          onAction={() => setIsAdding(true)}
        />
      ) : (
        <div className="space-y-2.5">
          {pending.map((item) => (
            <div
              key={item.id}
              className="group flex items-center justify-between p-3.5 sm:p-4 rounded-2xl border border-ivory-200 dark:border-espresso-750 bg-white dark:bg-espresso-850 hover:border-ivory-300 dark:hover:border-espresso-700 transition-colors shadow-subtle"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <button
                  onClick={() => toggleReminder(item.id)}
                  aria-label={`Mark ${item.title} as completed`}
                  className="w-5 h-5 rounded-lg border-2 border-espresso-300 dark:border-espresso-600 flex items-center justify-center hover:border-terracotta-500 transition-colors shrink-0 active:scale-90"
                >
                  {item.isCompleted && <Check className="w-3.5 h-3.5 text-sage-600" />}
                </button>

                <div className="min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-espresso-900 dark:text-ivory-100 truncate">
                    {item.title}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-espresso-500 dark:text-espresso-400 font-medium">
                    <span className="capitalize">{item.category}</span>
                    {item.linkedEntity && (
                      <span className="font-mono text-terracotta-600 dark:text-terracotta-400 font-semibold">
                        • {item.linkedEntity}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 ml-3">
                <Badge
                  variant={
                    item.priority === 'high'
                      ? 'danger'
                      : item.priority === 'medium'
                      ? 'ochre'
                      : 'neutral'
                  }
                  size="sm"
                >
                  {item.priority}
                </Badge>
                <button
                  onClick={() => deleteReminder(item.id)}
                  className="opacity-0 group-hover:opacity-100 text-espresso-400 hover:text-red-500 transition-all p-1.5 rounded-lg hover:bg-ivory-100 dark:hover:bg-espresso-800"
                  title="Delete reminder"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}

          {completed.length > 0 && (
            <div className="pt-3">
              <p className="text-xs font-mono uppercase tracking-wider text-espresso-400 dark:text-espresso-500 mb-2 font-semibold">
                Completed ({completed.length})
              </p>
              <div className="space-y-1.5">
                {completed.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-2.5 rounded-xl opacity-60 hover:opacity-100 transition-opacity"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <button
                        onClick={() => toggleReminder(item.id)}
                        className="w-4 h-4 rounded-md bg-sage-600 text-white flex items-center justify-center shrink-0"
                      >
                        <Check className="w-3 h-3" />
                      </button>
                      <span className="text-xs line-through text-espresso-400 dark:text-espresso-500 truncate">
                        {item.title}
                      </span>
                    </div>
                    <button
                      onClick={() => deleteReminder(item.id)}
                      className="text-espresso-400 hover:text-red-500 text-xs p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
};
