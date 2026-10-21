import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, AlertCircle } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { PlannerTask, TaskPriority, TaskStatus } from '../../types';
import { validateTask } from '../../utils/plannerUtils';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  taskToEdit?: PlannerTask | null;
  initialTopicId?: string;
  initialChapterId?: string;
  initialSubjectId?: string;
}

export const TaskModal: React.FC<TaskModalProps> = ({
  isOpen,
  onClose,
  taskToEdit,
  initialTopicId,
  initialChapterId,
  initialSubjectId,
}) => {
  const { state, addTask, updateTask } = useApp();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<TaskStatus>('todo');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('');
  const [estimatedDuration, setEstimatedDuration] = useState<number | ''>('');
  const [notes, setNotes] = useState('');

  // Syllabus linking
  const [syllabusSubjectId, setSyllabusSubjectId] = useState('');
  const [syllabusChapterId, setSyllabusChapterId] = useState('');
  const [syllabusTopicId, setSyllabusTopicId] = useState('');

  const [error, setError] = useState<string | null>(null);

  const syllabusSubjects = state.syllabusSubjects || [];

  useEffect(() => {
    if (!isOpen) return;
    setError(null);

    if (taskToEdit) {
      setTitle(taskToEdit.title);
      setDescription(taskToEdit.description || '');
      setStatus(taskToEdit.status);
      setPriority(taskToEdit.priority);
      setDueDate(taskToEdit.dueDate || '');
      setDueTime(taskToEdit.dueTime || '');
      setEstimatedDuration(taskToEdit.estimatedDuration ?? '');
      setNotes(taskToEdit.notes || '');
      setSyllabusSubjectId(taskToEdit.syllabusSubjectId || taskToEdit.subjectId || '');
      setSyllabusChapterId(taskToEdit.syllabusChapterId || '');
      setSyllabusTopicId(taskToEdit.syllabusTopicId || '');
    } else {
      setTitle('');
      setDescription('');
      setStatus('todo');
      setPriority('medium');
      setDueDate(new Date().toISOString().split('T')[0]);
      setDueTime('');
      setEstimatedDuration('');
      setNotes('');
      setSyllabusSubjectId(initialSubjectId || '');
      setSyllabusChapterId(initialChapterId || '');
      setSyllabusTopicId(initialTopicId || '');
    }
  }, [isOpen, taskToEdit, initialTopicId, initialChapterId, initialSubjectId]);

  if (!isOpen) return null;

  // Selected subject's chapters
  const selectedSubject = syllabusSubjects.find((s) => s.id === syllabusSubjectId);
  const availableChapters = selectedSubject ? selectedSubject.chapters : [];

  // Selected chapter's subtopics
  const selectedChapter = availableChapters.find((c) => c.id === syllabusChapterId);
  const availableTopics = selectedChapter ? selectedChapter.subtopics : [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const durationNum =
      estimatedDuration === '' ? undefined : Number(estimatedDuration);

    const taskPayload = {
      title: title.trim(),
      description: description.trim() || undefined,
      status,
      priority,
      dueDate: dueDate || undefined,
      dueTime: dueTime || undefined,
      estimatedDuration: durationNum,
      notes: notes.trim() || undefined,
      syllabusSubjectId: syllabusSubjectId || undefined,
      syllabusChapterId: syllabusChapterId || undefined,
      syllabusTopicId: syllabusTopicId || undefined,
      subjectId: syllabusSubjectId || undefined,
    };

    const validation = validateTask(taskPayload);
    if (!validation.valid) {
      setError(validation.error || 'Please fill in required fields.');
      return;
    }

    if (taskToEdit) {
      updateTask(taskToEdit.id, taskPayload);
    } else {
      addTask(taskPayload);
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-espresso-950/60 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-lg bg-white dark:bg-espresso-900 rounded-2xl border border-ivory-300 dark:border-espresso-700 shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-ivory-200 dark:border-espresso-800 flex items-center justify-between">
          <h2 className="font-serif text-lg font-bold text-espresso-950 dark:text-ivory-50">
            {taskToEdit ? 'Edit Task' : 'New Study Task'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-espresso-400 hover:text-espresso-700 dark:hover:text-ivory-200 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-espresso-700 dark:text-ivory-200 mb-1">
              Task Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Solve 15 practice problems on Thermodynamics"
              className="w-full px-3.5 py-2 text-xs sm:text-sm rounded-xl border border-ivory-300 dark:border-espresso-750 bg-ivory-50/50 dark:bg-espresso-800 text-espresso-950 dark:text-ivory-50 focus:outline-none focus:ring-2 focus:ring-terracotta-500"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-espresso-700 dark:text-ivory-200 mb-1">
              Description (Optional)
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief summary or objective..."
              className="w-full px-3.5 py-2 text-xs sm:text-sm rounded-xl border border-ivory-300 dark:border-espresso-750 bg-ivory-50/50 dark:bg-espresso-800 text-espresso-950 dark:text-ivory-50 focus:outline-none focus:ring-2 focus:ring-terracotta-500"
            />
          </div>

          {/* Priority & Status */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-espresso-700 dark:text-ivory-200 mb-1">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-ivory-300 dark:border-espresso-750 bg-ivory-50/50 dark:bg-espresso-800 text-espresso-950 dark:text-ivory-50 focus:outline-none focus:ring-2 focus:ring-terracotta-500"
              >
                <option value="low">Low Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="high">High Priority</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-espresso-700 dark:text-ivory-200 mb-1">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
                className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-ivory-300 dark:border-espresso-750 bg-ivory-50/50 dark:bg-espresso-800 text-espresso-950 dark:text-ivory-50 focus:outline-none focus:ring-2 focus:ring-terracotta-500"
              >
                <option value="todo">To Do</option>
                <option value="in_progress">In Progress</option>
                <option value="done">Done</option>
              </select>
            </div>
          </div>

          {/* Due Date & Time */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-espresso-700 dark:text-ivory-200 mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-espresso-400" /> Due Date
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-ivory-300 dark:border-espresso-750 bg-ivory-50/50 dark:bg-espresso-800 text-espresso-950 dark:text-ivory-50 focus:outline-none focus:ring-2 focus:ring-terracotta-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-espresso-700 dark:text-ivory-200 mb-1 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-espresso-400" /> Due Time (Optional)
              </label>
              <input
                type="time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-ivory-300 dark:border-espresso-750 bg-ivory-50/50 dark:bg-espresso-800 text-espresso-950 dark:text-ivory-50 focus:outline-none focus:ring-2 focus:ring-terracotta-500"
              />
            </div>
          </div>

          {/* Estimated Duration */}
          <div>
            <label className="block text-xs font-semibold text-espresso-700 dark:text-ivory-200 mb-1">
              Estimated Duration (Minutes)
            </label>
            <input
              type="number"
              min="0"
              step="5"
              value={estimatedDuration}
              onChange={(e) =>
                setEstimatedDuration(e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value, 10)))
              }
              placeholder="e.g. 45"
              className="w-full px-3.5 py-2 text-xs sm:text-sm rounded-xl border border-ivory-300 dark:border-espresso-750 bg-ivory-50/50 dark:bg-espresso-800 text-espresso-950 dark:text-ivory-50 focus:outline-none focus:ring-2 focus:ring-terracotta-500"
            />
          </div>

          {/* Syllabus Topic Association */}
          <div className="pt-2 border-t border-ivory-200 dark:border-espresso-800">
            <p className="text-xs font-bold uppercase tracking-wider font-mono text-espresso-500 dark:text-espresso-400 mb-2">
              Link to Syllabus (Optional)
            </p>

            <div className="space-y-2">
              {/* Subject */}
              <div>
                <label className="block text-[11px] font-medium text-espresso-600 dark:text-espresso-300 mb-0.5">
                  Subject
                </label>
                <select
                  value={syllabusSubjectId}
                  onChange={(e) => {
                    setSyllabusSubjectId(e.target.value);
                    setSyllabusChapterId('');
                    setSyllabusTopicId('');
                  }}
                  className="w-full px-3 py-1.5 text-xs rounded-xl border border-ivory-300 dark:border-espresso-750 bg-ivory-50/50 dark:bg-espresso-800 text-espresso-950 dark:text-ivory-50"
                >
                  <option value="">-- No Subject Linked --</option>
                  {syllabusSubjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Chapter */}
              {availableChapters.length > 0 && (
                <div>
                  <label className="block text-[11px] font-medium text-espresso-600 dark:text-espresso-300 mb-0.5">
                    Chapter
                  </label>
                  <select
                    value={syllabusChapterId}
                    onChange={(e) => {
                      setSyllabusChapterId(e.target.value);
                      setSyllabusTopicId('');
                    }}
                    className="w-full px-3 py-1.5 text-xs rounded-xl border border-ivory-300 dark:border-espresso-750 bg-ivory-50/50 dark:bg-espresso-800 text-espresso-950 dark:text-ivory-50"
                  >
                    <option value="">-- Select Chapter --</option>
                    {availableChapters.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Topic */}
              {availableTopics.length > 0 && (
                <div>
                  <label className="block text-[11px] font-medium text-espresso-600 dark:text-espresso-300 mb-0.5">
                    Topic / Subtopic
                  </label>
                  <select
                    value={syllabusTopicId}
                    onChange={(e) => setSyllabusTopicId(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs rounded-xl border border-ivory-300 dark:border-espresso-750 bg-ivory-50/50 dark:bg-espresso-800 text-espresso-950 dark:text-ivory-50"
                  >
                    <option value="">-- Select Topic --</option>
                    {availableTopics.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-espresso-700 dark:text-ivory-200 mb-1">
              Notes / References (Optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Page 142 problem 4, formula sheet required"
              className="w-full px-3.5 py-2 text-xs sm:text-sm rounded-xl border border-ivory-300 dark:border-espresso-750 bg-ivory-50/50 dark:bg-espresso-800 text-espresso-950 dark:text-ivory-50 focus:outline-none focus:ring-2 focus:ring-terracotta-500"
            />
          </div>

          {/* Action buttons */}
          <div className="pt-3 flex items-center justify-end gap-2 border-t border-ivory-200 dark:border-espresso-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-xl border border-ivory-300 dark:border-espresso-750 text-espresso-600 dark:text-espresso-300 hover:bg-ivory-100 dark:hover:bg-espresso-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-semibold rounded-xl text-white shadow-subtle transition"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              {taskToEdit ? 'Save Changes' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
