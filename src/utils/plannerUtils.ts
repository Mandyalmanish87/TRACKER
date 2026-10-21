import { PlannerTask, TaskStatus, TaskPriority } from '../types';
import { formatLocalDateStr } from './focusAnalytics';

/**
 * Checks whether a task is overdue relative to a reference date.
 * Completed tasks are never considered overdue.
 */
export function isTaskOverdue(task: PlannerTask, referenceDate: Date = new Date()): boolean {
  if (task.status === 'done' || !task.dueDate) {
    return false;
  }

  const todayStr = formatLocalDateStr(referenceDate);

  if (task.dueDate < todayStr) {
    return true;
  }

  // If due today and has a due time, check if the specific time has passed
  if (task.dueDate === todayStr && task.dueTime) {
    const [dueHours, dueMinutes] = task.dueTime.split(':').map(Number);
    if (!isNaN(dueHours) && !isNaN(dueMinutes)) {
      const currentHours = referenceDate.getHours();
      const currentMinutes = referenceDate.getMinutes();
      if (currentHours > dueHours || (currentHours === dueHours && currentMinutes > dueMinutes)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Checks whether a task is due today.
 */
export function isTaskDueToday(task: PlannerTask, referenceDate: Date = new Date()): boolean {
  if (!task.dueDate) return false;
  return task.dueDate === formatLocalDateStr(referenceDate);
}

/**
 * Returns tasks due today that are not completed.
 */
export function getDueTodayTasks(tasks: PlannerTask[], referenceDate: Date = new Date()): PlannerTask[] {
  const todayStr = formatLocalDateStr(referenceDate);
  return tasks.filter((t) => t.status !== 'done' && t.dueDate === todayStr);
}

/**
 * Returns overdue tasks (not completed and past due).
 */
export function getOverdueTasks(tasks: PlannerTask[], referenceDate: Date = new Date()): PlannerTask[] {
  return tasks.filter((t) => isTaskOverdue(t, referenceDate));
}

export interface TaskFilterOptions {
  status?: TaskStatus | 'all';
  priority?: TaskPriority | 'all';
  subjectId?: string | 'all';
  syllabusChapterId?: string | 'all';
  dueDateRange?: 'all' | 'today' | 'upcoming' | 'overdue';
  searchQuery?: string;
}

/**
 * Filters a task list according to status, priority, subject, chapter, due date range, and search query.
 */
export function filterTasks(
  tasks: PlannerTask[],
  filters: TaskFilterOptions,
  referenceDate: Date = new Date()
): PlannerTask[] {
  const todayStr = formatLocalDateStr(referenceDate);
  const q = filters.searchQuery?.trim().toLowerCase();

  return tasks.filter((task) => {
    // Status filter
    if (filters.status && filters.status !== 'all' && task.status !== filters.status) {
      return false;
    }

    // Priority filter
    if (filters.priority && filters.priority !== 'all' && task.priority !== filters.priority) {
      return false;
    }

    // Subject filter (matches either subjectId or syllabusSubjectId)
    if (filters.subjectId && filters.subjectId !== 'all') {
      if (task.subjectId !== filters.subjectId && task.syllabusSubjectId !== filters.subjectId) {
        return false;
      }
    }

    // Syllabus chapter filter
    if (filters.syllabusChapterId && filters.syllabusChapterId !== 'all') {
      if (task.syllabusChapterId !== filters.syllabusChapterId) {
        return false;
      }
    }

    // Due date range filter
    if (filters.dueDateRange && filters.dueDateRange !== 'all') {
      if (filters.dueDateRange === 'today') {
        if (task.dueDate !== todayStr) return false;
      } else if (filters.dueDateRange === 'overdue') {
        if (!isTaskOverdue(task, referenceDate)) return false;
      } else if (filters.dueDateRange === 'upcoming') {
        if (!task.dueDate || task.dueDate <= todayStr) return false;
      }
    }

    // Search query (title, description, notes)
    if (q) {
      const matchTitle = task.title.toLowerCase().includes(q);
      const matchDesc = task.description?.toLowerCase().includes(q) ?? false;
      const matchNotes = task.notes?.toLowerCase().includes(q) ?? false;
      if (!matchTitle && !matchDesc && !matchNotes) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Validates task payload for creation or update.
 */
export function validateTask(data: Partial<PlannerTask>): { valid: boolean; error?: string } {
  if (!data.title || !data.title.trim()) {
    return { valid: false, error: 'Task title is required.' };
  }

  if (data.dueDate) {
    // Expected format: YYYY-MM-DD
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data.dueDate)) {
      return { valid: false, error: 'Invalid due date format. Expected YYYY-MM-DD.' };
    }
    const d = new Date(data.dueDate + 'T00:00:00');
    if (isNaN(d.getTime())) {
      return { valid: false, error: 'Invalid due date value.' };
    }
  }

  if (data.dueTime) {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(data.dueTime)) {
      return { valid: false, error: 'Invalid due time format. Expected HH:mm in 24h format.' };
    }
  }

  if (typeof data.estimatedDuration === 'number' && data.estimatedDuration < 0) {
    return { valid: false, error: 'Estimated duration cannot be negative.' };
  }

  return { valid: true };
}
