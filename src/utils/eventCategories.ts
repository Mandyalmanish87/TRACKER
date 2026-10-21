import { EventCategory } from '../types';

export interface EventCategoryConfig {
  id: EventCategory;
  label: string;
  shortLabel: string;
  description: string;
  color: string;
  lightBg: string;
  darkBg: string;
  borderColor: string;
  iconName: string;
}

export const EVENT_CATEGORIES: Record<EventCategory, EventCategoryConfig> = {
  exam: {
    id: 'exam',
    label: 'Academic Exam',
    shortLabel: 'Exam',
    description: 'Mid-term, end-term, practicals, viva, and unit assessments',
    color: '#8B5CF6',
    lightBg: 'rgba(139, 92, 246, 0.12)',
    darkBg: 'rgba(139, 92, 246, 0.22)',
    borderColor: '#8B5CF6',
    iconName: 'GraduationCap',
  },
  deadline: {
    id: 'deadline',
    label: 'Project Deadline',
    shortLabel: 'Deadline',
    description: 'Major project milestones, reports, presentations, and submissions',
    color: '#EF4444',
    lightBg: 'rgba(239, 68, 68, 0.12)',
    darkBg: 'rgba(239, 68, 68, 0.22)',
    borderColor: '#EF4444',
    iconName: 'AlertCircle',
  },
  task: {
    id: 'task',
    label: 'Actionable Task',
    shortLabel: 'Task',
    description: 'Individual actionable study or assignment tasks',
    color: '#3B82F6',
    lightBg: 'rgba(59, 130, 246, 0.12)',
    darkBg: 'rgba(59, 130, 246, 0.22)',
    borderColor: '#3B82F6',
    iconName: 'CheckSquare',
  },
  holiday: {
    id: 'holiday',
    label: 'College Holiday',
    shortLabel: 'Holiday',
    description: 'Campus holidays, semester vacations, and study leave',
    color: '#10B981',
    lightBg: 'rgba(16, 185, 129, 0.12)',
    darkBg: 'rgba(16, 185, 129, 0.22)',
    borderColor: '#10B981',
    iconName: 'Sun',
  },
  college_event: {
    id: 'college_event',
    label: 'Campus Event',
    shortLabel: 'Campus',
    description: 'Technical fests, hackathons, guest lectures, and college workshops',
    color: '#F59E0B',
    lightBg: 'rgba(245, 158, 11, 0.12)',
    darkBg: 'rgba(245, 158, 11, 0.22)',
    borderColor: '#F59E0B',
    iconName: 'Sparkles',
  },
  personal_event: {
    id: 'personal_event',
    label: 'Personal Commitment',
    shortLabel: 'Personal',
    description: 'Doctor visits, personal milestones, and non-academic appointments',
    color: '#14B8A6',
    lightBg: 'rgba(20, 184, 166, 0.12)',
    darkBg: 'rgba(20, 184, 166, 0.22)',
    borderColor: '#14B8A6',
    iconName: 'User',
  },
  reminder: {
    id: 'reminder',
    label: 'Quick Reminder',
    shortLabel: 'Reminder',
    description: 'Quick notification flags and daily priority reminders',
    color: '#D97706',
    lightBg: 'rgba(217, 119, 6, 0.12)',
    darkBg: 'rgba(217, 119, 6, 0.22)',
    borderColor: '#D97706',
    iconName: 'Bell',
  },
};

export const getEventCategoryConfig = (category: EventCategory): EventCategoryConfig => {
  return EVENT_CATEGORIES[category] || EVENT_CATEGORIES.task;
};

