import React, { useState, useEffect } from 'react';
import { X, Calendar as CalendarIcon, Clock, MapPin, AlignLeft, Tag, Flag, Trash2, CheckCircle2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { CalendarEvent, EventCategory, EventPriority, ExamType, TaskStatus } from '../../types';
import { EVENT_CATEGORIES, getEventCategoryConfig } from '../../utils/eventCategories';

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialEvent?: CalendarEvent | null;
  initialDate?: string;
  initialStartTime?: string;
  initialCategory?: EventCategory;
}

export const EventModal: React.FC<EventModalProps> = ({
  isOpen,
  onClose,
  initialEvent,
  initialDate,
  initialStartTime,
  initialCategory,
}) => {
  const { state, addEvent, updateEvent, deleteEvent } = useApp();

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<EventCategory>('task');
  const [date, setDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isAllDay, setIsAllDay] = useState(false);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [priority, setPriority] = useState<EventPriority>('medium');
  const [status, setStatus] = useState<TaskStatus>('todo');
  const [subjectId, setSubjectId] = useState<string>('');
  const [examType, setExamType] = useState<ExamType>('mid_sem');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    if (initialEvent) {
      setTitle(initialEvent.title || '');
      setCategory(initialEvent.category || 'task');
      setDate(initialEvent.date || new Date().toISOString().split('T')[0]);
      setEndDate(initialEvent.endDate || '');
      setIsAllDay(Boolean(initialEvent.isAllDay));
      setStartTime(initialEvent.startTime || '09:00');
      setEndTime(initialEvent.endTime || '10:00');
      setPriority(initialEvent.priority || 'medium');
      setStatus(initialEvent.status || (initialEvent.isCompleted ? 'done' : 'todo'));
      setSubjectId(initialEvent.subjectId || '');
      setExamType(initialEvent.examType || 'mid_sem');
      setLocation(initialEvent.location || '');
      setDescription(initialEvent.description || '');
      setIsDeleting(false);
    } else {
      const today = initialDate || new Date().toISOString().split('T')[0];
      setTitle('');
      setCategory(initialCategory || 'task');
      setDate(today);
      setEndDate('');
      setIsAllDay(false);
      const st = initialStartTime || '10:00';
      setStartTime(st);
      const hour = parseInt(st.split(':')[0], 10) || 10;
      const nextHour = String(Math.min(hour + 1, 23)).padStart(2, '0');
      setEndTime(`${nextHour}:00`);
      setPriority('medium');
      setStatus('todo');
      setSubjectId('');
      setExamType('mid_sem');
      setLocation('');
      setDescription('');
      setIsDeleting(false);
    }
  }, [isOpen, initialEvent, initialDate, initialStartTime, initialCategory]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const eventPayload: Omit<CalendarEvent, 'id' | 'createdAt'> = {
      title: title.trim(),
      category,
      date,
      endDate: endDate || undefined,
      isAllDay,
      startTime: isAllDay ? undefined : startTime,
      endTime: isAllDay ? undefined : endTime,
      priority,
      status,
      isCompleted: status === 'done',
      subjectId: subjectId || undefined,
      examType: category === 'exam' ? examType : undefined,
      location: location.trim() || undefined,
      description: description.trim() || undefined,
    };

    if (initialEvent) {
      updateEvent(initialEvent.id, eventPayload);
    } else {
      addEvent(eventPayload);
    }

    onClose();
  };

  const handleDelete = () => {
    if (initialEvent) {
      deleteEvent(initialEvent.id);
      onClose();
    }
  };

  const currentCatConfig = getEventCategoryConfig(category);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="event-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-lg max-h-[92vh] overflow-y-auto bg-white dark:bg-espresso-900 border border-ivory-300 dark:border-espresso-750 rounded-2xl shadow-2xl p-6 transition-all text-espresso-950 dark:text-ivory-100">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-ivory-200 dark:border-espresso-800">
          <div className="flex items-center gap-2.5">
            <span
              className="w-3.5 h-3.5 rounded-full ring-2 ring-white dark:ring-espresso-900"
              style={{ backgroundColor: currentCatConfig.color }}
            />
            <h2 id="event-modal-title" className="text-lg font-serif font-semibold">
              {initialEvent ? 'Edit Event or Task' : 'Create Event or Task'}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="p-1.5 rounded-xl hover:bg-ivory-100 dark:hover:bg-espresso-800 text-espresso-500 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-espresso-600 dark:text-espresso-300 mb-1.5">
              Title *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Mid-Term Examination or Project Report"
              className="w-full px-3.5 py-2.5 rounded-xl text-sm border border-ivory-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-850 text-espresso-950 dark:text-ivory-50 focus:outline-none focus:ring-2 focus:ring-terracotta-500"
              autoFocus
            />
          </div>

          {/* Category Selector */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-espresso-600 dark:text-espresso-300 mb-1.5 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5" />
              Category
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {(Object.keys(EVENT_CATEGORIES) as EventCategory[]).map((catKey) => {
                const conf = EVENT_CATEGORIES[catKey];
                const isSelected = category === catKey;
                return (
                  <button
                    key={catKey}
                    type="button"
                    onClick={() => setCategory(catKey)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium border text-left transition-all ${
                      isSelected
                        ? 'border-transparent text-espresso-950 dark:text-ivory-50 shadow-xs'
                        : 'border-ivory-300 dark:border-espresso-750 hover:bg-ivory-100 dark:hover:bg-espresso-800 text-espresso-700 dark:text-espresso-300'
                    }`}
                    style={
                      isSelected
                        ? {
                            backgroundColor: conf.lightBg,
                            borderColor: conf.color,
                            fontWeight: 600,
                          }
                        : undefined
                    }
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: conf.color }}
                    />
                    <span className="truncate">{conf.shortLabel}</span>
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-espresso-500 dark:text-espresso-400 mt-1.5">
              {currentCatConfig.description}
            </p>
          </div>

          {/* Date & All-Day */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-espresso-600 dark:text-espresso-300 mb-1.5 flex items-center gap-1.5">
                <CalendarIcon className="w-3.5 h-3.5" />
                Date *
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-xs sm:text-sm border border-ivory-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-850 text-espresso-950 dark:text-ivory-50 focus:outline-none focus:ring-2 focus:ring-terracotta-500"
              />
            </div>

            <div className="flex flex-col justify-end">
              <label className="flex items-center gap-2 cursor-pointer select-none py-2 text-xs sm:text-sm font-medium text-espresso-800 dark:text-espresso-200">
                <input
                  type="checkbox"
                  checked={isAllDay}
                  onChange={(e) => setIsAllDay(e.target.checked)}
                  className="rounded border-ivory-400 text-terracotta-600 focus:ring-terracotta-500 w-4 h-4"
                />
                <span>All-Day Event / Full Day</span>
              </label>
            </div>
          </div>

          {/* Times (if not all day) */}
          {!isAllDay && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-espresso-600 dark:text-espresso-300 mb-1.5 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  Start Time
                </label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-xs sm:text-sm border border-ivory-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-850 text-espresso-950 dark:text-ivory-50 focus:outline-none focus:ring-2 focus:ring-terracotta-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-espresso-600 dark:text-espresso-300 mb-1.5 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  End Time
                </label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-xs sm:text-sm border border-ivory-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-850 text-espresso-950 dark:text-ivory-50 focus:outline-none focus:ring-2 focus:ring-terracotta-500"
                />
              </div>
            </div>
          )}

          {/* Exam Type (if Exam) */}
          {category === 'exam' && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-espresso-600 dark:text-espresso-300 mb-1.5">
                Exam Format
              </label>
              <select
                value={examType}
                onChange={(e) => setExamType(e.target.value as ExamType)}
                className="w-full px-3 py-2 rounded-xl text-xs sm:text-sm border border-ivory-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-850 text-espresso-950 dark:text-ivory-50 focus:outline-none focus:ring-2 focus:ring-terracotta-500"
              >
                <option value="mid_sem">Mid-Semester Exam</option>
                <option value="end_sem">End-Semester Exam</option>
                <option value="practical">Lab / Practical Exam</option>
                <option value="viva">Viva Voce / Oral Examination</option>
                <option value="quiz">Unit Test / Quiz</option>
                <option value="other">Other Assessment</option>
              </select>
            </div>
          )}

          {/* Subject Link & Priority */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-espresso-600 dark:text-espresso-300 mb-1.5">
                Subject (Optional)
              </label>
              <select
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-xs sm:text-sm border border-ivory-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-850 text-espresso-950 dark:text-ivory-50 focus:outline-none focus:ring-2 focus:ring-terracotta-500"
              >
                <option value="">-- No Subject Linked --</option>
                {state.subjects.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.name} ({sub.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-espresso-600 dark:text-espresso-300 mb-1.5 flex items-center gap-1.5">
                <Flag className="w-3.5 h-3.5" />
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as EventPriority)}
                className="w-full px-3 py-2 rounded-xl text-xs sm:text-sm border border-ivory-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-850 text-espresso-950 dark:text-ivory-50 focus:outline-none focus:ring-2 focus:ring-terracotta-500"
              >
                <option value="high">High Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="low">Low Priority</option>
              </select>
            </div>
          </div>

          {/* Status (for tasks/deadlines/reminders) */}
          {(category === 'task' || category === 'deadline' || category === 'reminder') && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-espresso-600 dark:text-espresso-300 mb-1.5 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Status
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['todo', 'in_progress', 'done'] as TaskStatus[]).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setStatus(st)}
                    className={`py-1.5 px-3 rounded-xl text-xs font-medium border text-center transition-all ${
                      status === st
                        ? 'bg-terracotta-500 text-white border-terracotta-600 shadow-xs'
                        : 'border-ivory-300 dark:border-espresso-750 text-espresso-700 dark:text-espresso-300 hover:bg-ivory-100 dark:hover:bg-espresso-800'
                    }`}
                  >
                    {st === 'todo' ? 'To Do' : st === 'in_progress' ? 'In Progress' : 'Done'}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Location */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-espresso-600 dark:text-espresso-300 mb-1.5 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" />
              Location / Room / Venue
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Hall 402, Lab 3, or Online Zoom"
              className="w-full px-3 py-2 rounded-xl text-xs sm:text-sm border border-ivory-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-850 text-espresso-950 dark:text-ivory-50 focus:outline-none focus:ring-2 focus:ring-terracotta-500"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-espresso-600 dark:text-espresso-300 mb-1.5 flex items-center gap-1.5">
              <AlignLeft className="w-3.5 h-3.5" />
              Notes &amp; Description
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add key notes, syllabus topics, instructions, or resources..."
              className="w-full px-3 py-2 rounded-xl text-xs sm:text-sm border border-ivory-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-850 text-espresso-950 dark:text-ivory-50 focus:outline-none focus:ring-2 focus:ring-terracotta-500 resize-none"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-ivory-200 dark:border-espresso-800 flex items-center justify-between gap-3">
            {initialEvent ? (
              isDeleting ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-rose-600 font-medium">Confirm delete?</span>
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="px-2.5 py-1 rounded-lg text-xs bg-rose-600 hover:bg-rose-700 text-white font-semibold transition"
                  >
                    Yes, Delete
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsDeleting(false)}
                    className="px-2 py-1 text-xs text-espresso-500 hover:text-espresso-800"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsDeleting(true)}
                  className="p-2 rounded-xl text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors flex items-center gap-1.5 text-xs font-medium"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete</span>
                </button>
              )
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs sm:text-sm font-medium border border-ivory-300 dark:border-espresso-700 hover:bg-ivory-100 dark:hover:bg-espresso-800 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-terracotta-500 hover:bg-terracotta-600 text-white shadow-sm transition"
              >
                {initialEvent ? 'Save Changes' : 'Create Event'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
