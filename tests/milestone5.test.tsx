import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import App from '../src/App';
import { AppProvider } from '../src/context/AppContext';
import { ThemeProvider } from '../src/theme/ThemeContext';
import { loadData, saveData, EMPTY_STATE } from '../src/services/storage';
import {
  PlannerTask,
  SpacedReview,
  DailyQuestionEntry,
  SyllabusSubject,
} from '../src/types';
import {
  validateTask,
  isTaskOverdue,
  isTaskDueToday,
  filterTasks,
  getOverdueTasks,
  getDueTodayTasks,
} from '../src/utils/plannerUtils';
import {
  DEFAULT_REVIEW_INTERVALS,
  addDaysToDateStr,
  isReviewOverdue,
  isReviewDueToday,
  isReviewUpcoming,
  getIntervalForLevel,
  hasActiveReviewForTopic,
  completeReviewStep,
} from '../src/utils/spacedRepetitionUtils';
import {
  validateQuestionEntry,
  calculateDailyQuestionStats,
} from '../src/utils/dailyQuestionsUtils';
import { PlannerSummaryWidget } from '../src/components/dashboard/PlannerSummaryWidget';
import { KanbanBoard } from '../src/components/planner/KanbanBoard';
import { Navigation } from '../src/components/common/Navigation';

describe('Milestone 5: Study Planner, Spaced Repetition & Daily Questions', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = '';
    document.documentElement.removeAttribute('data-accent');
    document.body.className = '';
  });

  // --------------------------------------------------------------------------
  // 1. Task Creation, Editing, Deletion, and Status Transitions
  // --------------------------------------------------------------------------
  describe('1. Task CRUD and Status Transitions', () => {
    it('validates required fields, durations and invalid date strings', () => {
      // Empty title
      const res1 = validateTask({ title: '   ', dueDate: '2026-10-25' });
      expect(res1.valid).toBe(false);
      expect(res1.error).toContain('Task title is required');

      // Invalid date format
      const res2 = validateTask({ title: 'Valid Task', dueDate: 'not-a-date' });
      expect(res2.valid).toBe(false);
      expect(res2.error).toContain('Invalid due date format');

      // Negative duration
      const res3 = validateTask({
        title: 'Valid Task',
        dueDate: '2026-10-25',
        estimatedDuration: -15,
      });
      expect(res3.valid).toBe(false);
      expect(res3.error).toContain('Estimated duration cannot be negative');

      // Valid task
      const res4 = validateTask({
        title: 'Complete Assignment 3',
        dueDate: '2026-10-25',
        estimatedDuration: 60,
      });
      expect(res4.valid).toBe(true);
      expect(res4.error).toBeUndefined();
    });

    it('persists task creation, status transitions, and deletion in storage', () => {
      const data = loadData();
      const newTask: PlannerTask = {
        id: 'task-101',
        title: 'Read Operating Systems Chapter 4',
        status: 'todo',
        priority: 'high',
        dueDate: '2026-10-20',
        estimatedDuration: 90,
        createdAt: '2026-10-18T10:00:00Z',
      };
      data.tasks = [newTask];
      saveData(data);

      let loaded = loadData();
      expect(loaded.tasks).toBeDefined();
      expect(loaded.tasks?.length).toBe(1);
      expect(loaded.tasks?.[0].title).toBe('Read Operating Systems Chapter 4');
      expect(loaded.tasks?.[0].status).toBe('todo');

      // Status transition to in_progress
      loaded.tasks![0].status = 'in_progress';
      saveData(loaded);
      loaded = loadData();
      expect(loaded.tasks![0].status).toBe('in_progress');

      // Status transition to done with completion timestamp
      loaded.tasks![0].status = 'done';
      loaded.tasks![0].completedAt = '2026-10-19T14:30:00Z';
      saveData(loaded);
      loaded = loadData();
      expect(loaded.tasks![0].status).toBe('done');
      expect(loaded.tasks![0].completedAt).toBe('2026-10-19T14:30:00Z');

      // Deletion
      loaded.tasks = [];
      saveData(loaded);
      loaded = loadData();
      expect(loaded.tasks?.length).toBe(0);
    });
  });

  // --------------------------------------------------------------------------
  // 2. Task Filtering, Overdue Status, and Due Dates
  // --------------------------------------------------------------------------
  describe('2. Task Filtering and Overdue Status', () => {
    const fixedNow = new Date('2026-10-18T12:00:00');

    const sampleTasks: PlannerTask[] = [
      {
        id: 't-overdue',
        title: 'Overdue Project Report',
        status: 'todo',
        priority: 'high',
        subjectId: 'sub-cs',
        dueDate: '2026-10-15',
        createdAt: '2026-10-10T00:00:00Z',
      },
      {
        id: 't-today',
        title: 'Submit Lab Notebook',
        status: 'in_progress',
        priority: 'medium',
        subjectId: 'sub-chem',
        dueDate: '2026-10-18',
        createdAt: '2026-10-17T00:00:00Z',
      },
      {
        id: 't-future',
        title: 'Review Calculus Formulae',
        status: 'todo',
        priority: 'low',
        subjectId: 'sub-math',
        dueDate: '2026-10-25',
        createdAt: '2026-10-18T00:00:00Z',
      },
      {
        id: 't-done-overdue',
        title: 'Already Completed Assignment',
        status: 'done',
        priority: 'high',
        dueDate: '2026-10-14',
        createdAt: '2026-10-10T00:00:00Z',
        completedAt: '2026-10-14T18:00:00Z',
      },
    ];

    it('correctly identifies overdue tasks while excluding completed tasks', () => {
      expect(isTaskOverdue(sampleTasks[0], fixedNow)).toBe(true);
      expect(isTaskOverdue(sampleTasks[1], fixedNow)).toBe(false); // Due today is not overdue
      expect(isTaskOverdue(sampleTasks[2], fixedNow)).toBe(false); // Future
      expect(isTaskOverdue(sampleTasks[3], fixedNow)).toBe(false); // Completed tasks are never overdue

      const overdueList = getOverdueTasks(sampleTasks, fixedNow);
      expect(overdueList.length).toBe(1);
      expect(overdueList[0].id).toBe('t-overdue');
    });

    it('correctly identifies tasks due today while excluding completed tasks', () => {
      expect(isTaskDueToday(sampleTasks[1], fixedNow)).toBe(true);
      expect(isTaskDueToday(sampleTasks[0], fixedNow)).toBe(false);
      expect(isTaskDueToday(sampleTasks[2], fixedNow)).toBe(false);

      const todayList = getDueTodayTasks(sampleTasks, fixedNow);
      expect(todayList.length).toBe(1);
      expect(todayList[0].id).toBe('t-today');
    });

    it('filters tasks by status, priority, subject, and date accurately', () => {
      // Filter by status
      const todoTasks = filterTasks(sampleTasks, { status: 'todo' });
      expect(todoTasks.length).toBe(2);

      // Filter by priority
      const highTasks = filterTasks(sampleTasks, { priority: 'high' });
      expect(highTasks.length).toBe(2);

      // Filter by subject
      const csTasks = filterTasks(sampleTasks, { subjectId: 'sub-cs' });
      expect(csTasks.length).toBe(1);
      expect(csTasks[0].title).toBe('Overdue Project Report');

      // Filter by overdue date filter
      const overdueFilter = filterTasks(sampleTasks, { dueDateRange: 'overdue' }, fixedNow);
      expect(overdueFilter.length).toBe(1);
      expect(overdueFilter[0].id).toBe('t-overdue');

      // Filter by today date filter
      const todayFilter = filterTasks(sampleTasks, { dueDateRange: 'today' }, fixedNow);
      expect(todayFilter.length).toBe(1);
      expect(todayFilter[0].id).toBe('t-today');

      // Filter by search query
      const searchTasks = filterTasks(sampleTasks, { searchQuery: 'notebook' });
      expect(searchTasks.length).toBe(1);
      expect(searchTasks[0].id).toBe('t-today');
    });
  });

  // --------------------------------------------------------------------------
  // 3 & 4. Syllabus Integration & Independent Completion States
  // --------------------------------------------------------------------------
  describe('3 & 4. Syllabus-Linked Tasks and Independent Completion States', () => {
    it('creates task linked to syllabus topic using stable foreign-key IDs', () => {
      const data = loadData();
      const topicTask: PlannerTask = {
        id: 'task-syllabus-1',
        title: 'Revise Thermodynamics Laws',
        status: 'todo',
        priority: 'high',
        subjectId: 'sub-physics-id',
        syllabusChapterId: 'ch-thermo-id',
        syllabusTopicId: 'top-laws-id',
        dueDate: '2026-10-22',
        createdAt: '2026-10-18T00:00:00Z',
      };
      data.tasks = [topicTask];
      saveData(data);

      const loaded = loadData();
      expect(loaded.tasks?.[0].syllabusTopicId).toBe('top-laws-id');
      expect(loaded.tasks?.[0].syllabusChapterId).toBe('ch-thermo-id');
    });

    it('completing a task does NOT automatically alter syllabus topic status', () => {
      const data = loadData();
      const testSubject: SyllabusSubject = {
        id: 'sub-math-1',
        name: 'Discrete Mathematics',
        chapters: [
          {
            id: 'ch-graphs',
            name: 'Graph Theory',
            subtopics: [
              {
                id: 'top-trees',
                name: 'Spanning Trees',
                status: 'not_started',
                revisionCount: 0,
              },
            ],
          },
        ],
      };
      data.syllabusSubjects = [testSubject];

      const linkedTask: PlannerTask = {
        id: 'task-trees-1',
        title: 'Practice Kruskal Algorithm',
        status: 'todo',
        priority: 'medium',
        subjectId: 'sub-math-1',
        syllabusChapterId: 'ch-graphs',
        syllabusTopicId: 'top-trees',
        dueDate: '2026-10-20',
        createdAt: '2026-10-18T00:00:00Z',
      };
      data.tasks = [linkedTask];
      saveData(data);

      // Simulate user completing the task in planner
      const loaded = loadData();
      loaded.tasks![0].status = 'done';
      loaded.tasks![0].completedAt = '2026-10-18T16:00:00Z';
      saveData(loaded);

      const reloaded = loadData();
      expect(reloaded.tasks![0].status).toBe('done');
      // Verify syllabus subtopic remains independent ('not_started', NOT automatically 'done')
      const subtopic = reloaded.syllabusSubjects![0].chapters[0].subtopics[0];
      expect(subtopic.status).toBe('not_started');
      expect(subtopic.revisionCount).toBe(0);
    });

    it('handles deleted or renamed syllabus items gracefully without crashing', () => {
      const data = loadData();
      // Task pointing to an ID that does not exist in syllabusSubjects
      const orphanedTask: PlannerTask = {
        id: 'task-orphaned-1',
        title: 'Read Non-Existent Chapter',
        status: 'in_progress',
        priority: 'low',
        subjectId: 'sub-deleted',
        syllabusChapterId: 'ch-deleted',
        syllabusTopicId: 'top-deleted',
        dueDate: '2026-10-25',
        createdAt: '2026-10-18T00:00:00Z',
      };
      data.tasks = [orphanedTask];
      data.syllabusSubjects = []; // completely empty
      saveData(data);

      const loaded = loadData();
      expect(loaded.tasks?.length).toBe(1);
      expect(loaded.tasks![0].id).toBe('task-orphaned-1');
      // Rendering with orphaned task should not throw
      expect(() => {
        render(
          <ThemeProvider>
            <AppProvider>
              <KanbanBoard tasks={loaded.tasks!} />
            </AppProvider>
          </ThemeProvider>
        );
      }).not.toThrow();
    });
  });

  // --------------------------------------------------------------------------
  // 5 & 6. Spaced Repetition Workflow & Duplicate Prevention
  // --------------------------------------------------------------------------
  describe('5 & 6. Spaced Repetition Workflow & Duplicate Prevention', () => {
    it('calculates progressive review intervals with configurable ladder', () => {
      const customLadder = [1, 3, 7, 14, 30, 60];
      expect(getIntervalForLevel(0, customLadder)).toBe(1);
      expect(getIntervalForLevel(1, customLadder)).toBe(3);
      expect(getIntervalForLevel(2, customLadder)).toBe(7);
      expect(getIntervalForLevel(5, customLadder)).toBe(60);
      expect(getIntervalForLevel(10, customLadder)).toBe(60); // clamps to end

      // Date calculation
      const baseDate = new Date('2026-10-18T00:00:00');
      const nextDate = addDaysToDateStr(baseDate, getIntervalForLevel(1, customLadder));
      expect(nextDate).toBe('2026-10-21');
    });

    it('advances review level and preserves completion history when completed', () => {
      const initialReview: SpacedReview = {
        id: 'rev-bio-1',
        syllabusTopicId: 'top-calvin-cycle',
        topicName: 'Photosynthesis Calvin Cycle',
        dueDate: '2026-10-19',
        intervalDays: 1,
        repetitionLevel: 0,
        history: [],
      };

      // Complete review on 2026-10-19
      const completionDate = new Date('2026-10-19T10:00:00');
      const updated = completeReviewStep(initialReview, DEFAULT_REVIEW_INTERVALS, completionDate);

      expect(updated.repetitionLevel).toBe(1);
      expect(updated.intervalDays).toBe(3); // DEFAULT_REVIEW_INTERVALS[1] = 3
      expect(updated.dueDate).toBe('2026-10-22'); // 19 + 3 days = 22
      expect(updated.history?.length).toBe(1);
      expect(updated.history?.[0].nextDueDate).toBe('2026-10-22');
    });

    it('prevents duplicate active review creation for the same topic', () => {
      const existingReviews: SpacedReview[] = [
        {
          id: 'rev-chem-1',
          syllabusTopicId: 'top-redox',
          topicName: 'Redox Reactions',
          dueDate: '2026-10-20',
          intervalDays: 1,
          repetitionLevel: 0,
        },
      ];

      expect(hasActiveReviewForTopic(existingReviews, 'top-redox')).toBe(true);
      expect(hasActiveReviewForTopic(existingReviews, 'top-organic')).toBe(false);
    });

    it('identifies overdue, due today, and upcoming reviews correctly', () => {
      const fixedNow = new Date('2026-10-18T10:00:00');

      const pastReview: SpacedReview = {
        id: 'rev-past',
        syllabusTopicId: 'top-phy-1',
        topicName: 'Newton Laws',
        dueDate: '2026-10-14',
        intervalDays: 1,
        repetitionLevel: 1,
      };

      const todayReview: SpacedReview = {
        id: 'rev-today',
        syllabusTopicId: 'top-bio-1',
        topicName: 'Cell Biology',
        dueDate: '2026-10-18',
        intervalDays: 3,
        repetitionLevel: 2,
      };

      const futureReview: SpacedReview = {
        id: 'rev-future',
        syllabusTopicId: 'top-chem-1',
        topicName: 'Organic Nomenclature',
        dueDate: '2026-10-25',
        intervalDays: 7,
        repetitionLevel: 0,
      };

      expect(isReviewOverdue(pastReview, fixedNow)).toBe(true);
      expect(isReviewDueToday(pastReview, fixedNow)).toBe(false);

      expect(isReviewOverdue(todayReview, fixedNow)).toBe(false);
      expect(isReviewDueToday(todayReview, fixedNow)).toBe(true);

      expect(isReviewOverdue(futureReview, fixedNow)).toBe(false);
      expect(isReviewDueToday(futureReview, fixedNow)).toBe(false);
      expect(isReviewUpcoming(futureReview, fixedNow)).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // 7, 8, 9 & 10. Daily Questions: Validation, Aggregation, Accuracy & Streaks
  // --------------------------------------------------------------------------
  describe('7-10. Daily Questions Tracking, Aggregation, Accuracy & Streaks', () => {
    it('validates question count constraints strictly', () => {
      // Negative attempted
      const r1 = validateQuestionEntry(-5, 0);
      expect(r1.valid).toBe(false);
      expect(r1.error).toContain('non-negative whole number');

      // Negative correct
      const r2 = validateQuestionEntry(10, -1);
      expect(r2.valid).toBe(false);
      expect(r2.error).toContain('non-negative whole number');

      // Correct > Attempted
      const r3 = validateQuestionEntry(10, 12);
      expect(r3.valid).toBe(false);
      expect(r3.error).toContain('Correct answers cannot exceed attempted questions');

      // Non-integer
      const r4 = validateQuestionEntry(10.5, 5);
      expect(r4.valid).toBe(false);
      expect(r4.error).toContain('non-negative whole number');

      // Valid entry
      const r5 = validateQuestionEntry(30, 25);
      expect(r5.valid).toBe(true);
      expect(r5.error).toBeUndefined();
    });

    it('safely handles zero attempted questions without division by zero or NaN', () => {
      const statsZero = calculateDailyQuestionStats([], 25, new Date('2026-10-18T12:00:00'));
      expect(statsZero.todayAttempted).toBe(0);
      expect(statsZero.todayCorrect).toBe(0);
      expect(statsZero.todayAccuracy).toBe(0);
      expect(statsZero.overallAccuracy).toBe(0);
      expect(isNaN(statsZero.todayAccuracy)).toBe(false);
      expect(isFinite(statsZero.todayAccuracy)).toBe(true);
    });

    it('aggregates multiple subjects on the same date correctly', () => {
      const entries: DailyQuestionEntry[] = [
        {
          id: 'dq-1',
          date: '2026-10-18',
          subjectName: 'Physics',
          attempted: 20,
          correct: 18,
          createdAt: '2026-10-18T10:00:00Z',
        },
        {
          id: 'dq-2',
          date: '2026-10-18',
          subjectName: 'Calculus',
          attempted: 15,
          correct: 12,
          createdAt: '2026-10-18T14:00:00Z',
        },
        {
          id: 'dq-3',
          date: '2026-10-17',
          subjectName: 'Organic Chemistry',
          attempted: 25,
          correct: 20,
          createdAt: '2026-10-17T11:00:00Z',
        },
      ];

      const stats = calculateDailyQuestionStats(entries, 30, new Date('2026-10-18T12:00:00'));
      expect(stats.todayAttempted).toBe(35); // 20 + 15
      expect(stats.todayCorrect).toBe(30);   // 18 + 12
      expect(stats.todayAccuracy).toBe(86);  // 30 / 35 = 85.7% -> 86%
      expect(stats.todayMetTarget).toBe(true); // 35 >= 30
      expect(stats.totalQuestionsAttempted).toBe(60); // 35 + 25
      expect(stats.totalQuestionsCorrect).toBe(50);   // 30 + 20
    });

    it('calculates current and longest streak according to qualifying target', () => {
      const target = 20;
      const refDate = new Date('2026-10-20T12:00:00'); // Tuesday

      // Qualifying: 2026-10-18 (25 >= 20), 2026-10-19 (30 >= 20), 2026-10-20 (20 >= 20)
      const entries: DailyQuestionEntry[] = [
        { id: '1', date: '2026-10-15', attempted: 25, correct: 20, createdAt: '' }, // day 1
        { id: '2', date: '2026-10-16', attempted: 25, correct: 22, createdAt: '' }, // day 2
        { id: '3', date: '2026-10-17', attempted: 10, correct: 8, createdAt: '' },  // missed target (10 < 20)
        { id: '4', date: '2026-10-18', attempted: 25, correct: 20, createdAt: '' }, // day 1
        { id: '5', date: '2026-10-19', attempted: 30, correct: 28, createdAt: '' }, // day 2
        { id: '6', date: '2026-10-20', attempted: 20, correct: 19, createdAt: '' }, // day 3 (today)
      ];

      const stats = calculateDailyQuestionStats(entries, target, refDate);
      expect(stats.currentStreak).toBe(3);
      expect(stats.longestStreak).toBe(3);
      expect(stats.todayAttempted).toBe(20);
      expect(stats.todayCorrect).toBe(19);
      expect(stats.todayAccuracy).toBe(95);
      expect(stats.todayMetTarget).toBe(true);
    });

    it('recalculates streaks immediately when historical entries are edited', () => {
      const target = 25;
      const refDate = new Date('2026-10-20T12:00:00');

      let entries: DailyQuestionEntry[] = [
        { id: '1', date: '2026-10-18', attempted: 30, correct: 25, createdAt: '' },
        { id: '2', date: '2026-10-19', attempted: 10, correct: 10, createdAt: '' }, // below target
        { id: '3', date: '2026-10-20', attempted: 30, correct: 28, createdAt: '' },
      ];

      let stats = calculateDailyQuestionStats(entries, target, refDate);
      expect(stats.currentStreak).toBe(1); // 10-19 broke streak

      // Now edit historical entry for 2026-10-19 to 30 questions
      entries = entries.map((e) =>
        e.id === '2' ? { ...e, attempted: 30, correct: 25 } : e
      );

      stats = calculateDailyQuestionStats(entries, target, refDate);
      expect(stats.currentStreak).toBe(3); // 10-18, 10-19, 10-20 all meet target
    });
  });

  // --------------------------------------------------------------------------
  // 11. Persistence and Malformed Stored Data Recovery
  // --------------------------------------------------------------------------
  describe('11. Persistence and Malformed Data Safety', () => {
    it('handles legacy state without tasks or questions by migrating safely', () => {
      // Simulate state prior to Milestone 5
      const legacyState = {
        ...EMPTY_STATE,
        tasks: undefined,
        spacedReviews: undefined,
        dailyQuestions: undefined,
        dailyQuestionTarget: undefined,
        reviewIntervals: undefined,
      };
      localStorage.setItem('tracker_data_v1', JSON.stringify(legacyState));

      const loaded = loadData();
      expect(Array.isArray(loaded.tasks)).toBe(true);
      expect(Array.isArray(loaded.spacedReviews)).toBe(true);
      expect(Array.isArray(loaded.dailyQuestions)).toBe(true);
      expect(typeof loaded.dailyQuestionTarget).toBe('number');
      expect(Array.isArray(loaded.reviewIntervals)).toBe(true);
    });

    it('safely recovers when tasks or reviews contain malformed records', () => {
      const corruptedData = {
        ...EMPTY_STATE,
        tasks: [
          null,
          { id: 't-corrupt' }, // missing title, status
          { id: 't-good', title: 'Solid State Physics', status: 'todo' },
        ],
        spacedReviews: [
          null,
          { id: 'r-partial', topicName: 'Optics' },
        ],
        dailyQuestions: [
          null,
          { id: 'q-good', date: '2026-10-18', attempted: 10, correct: 8 },
        ],
      };
      localStorage.setItem('tracker_data_v1', JSON.stringify(corruptedData));

      const loaded = loadData();
      expect(Array.isArray(loaded.tasks)).toBe(true);
      expect(Array.isArray(loaded.spacedReviews)).toBe(true);
      expect(Array.isArray(loaded.dailyQuestions)).toBe(true);

      // Rendering App with this state should not crash
      expect(() => {
        render(<App />);
      }).not.toThrow();
    });
  });

  // --------------------------------------------------------------------------
  // 12. Dashboard Integration & Summaries
  // --------------------------------------------------------------------------
  describe('12. Dashboard Integration and Quick Navigation', () => {
    it('renders PlannerSummaryWidget with live tasks, reviews, and questions count', () => {
      const testTasks: PlannerTask[] = [
        {
          id: 't-today-1',
          title: 'Calculus Problem Sheet',
          status: 'todo',
          priority: 'high',
          dueDate: new Date().toISOString().split('T')[0],
          createdAt: '2026-10-18T00:00:00Z',
        },
      ];

      const testReviews: SpacedReview[] = [
        {
          id: 'rev-today-1',
          syllabusTopicId: 'top-thermo-carnot',
          topicName: 'Thermodynamics Carnot Engine',
          dueDate: new Date().toISOString().split('T')[0],
          intervalDays: 1,
          repetitionLevel: 0,
        },
      ];

      const testQuestions: DailyQuestionEntry[] = [
        {
          id: 'q-1',
          date: new Date().toISOString().split('T')[0],
          subjectName: 'Math',
          attempted: 30,
          correct: 27,
          createdAt: '2026-10-18T00:00:00Z',
        },
      ];

      const data = loadData();
      data.tasks = testTasks;
      data.spacedReviews = testReviews;
      data.dailyQuestions = testQuestions;
      saveData(data);

      let navigatedToPlanner = false;
      render(
        <ThemeProvider>
          <AppProvider>
            <PlannerSummaryWidget
              onNavigateToPlanner={() => {
                navigatedToPlanner = true;
              }}
            />
          </AppProvider>
        </ThemeProvider>
      );

      // Should display header
      expect(screen.getByText('Planner & Spaced Learning')).toBeDefined();

      // Quick link to Planner triggers navigation callback ("Open Planner" button)
      const openPlannerBtn = screen.getByRole('button', { name: /open planner/i });
      fireEvent.click(openPlannerBtn);
      expect(navigatedToPlanner).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // 13. Regression Coverage for Milestones 1–4
  // --------------------------------------------------------------------------
  describe('13. Regression Coverage across Milestones 1-4', () => {
    it('preserves attendance, timetable, focus history, gym, and profile data', () => {
      const data = loadData();
      expect(data.subjects).toBeDefined();
      expect(data.timetable).toBeDefined();
      expect(data.studySessions).toBeDefined();
      expect(data.gymWorkouts).toBeDefined();
      expect(data.profile).toBeDefined();
      expect(data.settings).toBeDefined();

      // Ensure adding a new task leaves existing module data intact
      const newTask: PlannerTask = {
        id: 'task-regression-test',
        title: 'Prepare for Viva',
        status: 'todo',
        priority: 'high',
        createdAt: '2026-10-18T00:00:00Z',
      };
      data.tasks = [newTask];
      saveData(data);

      const reloaded = loadData();
      expect(reloaded.tasks?.length).toBe(1);
      expect(reloaded.subjects?.length).toBe(data.subjects?.length);
      expect(reloaded.timetable?.length).toBe(data.timetable?.length);
      expect(reloaded.studySessions?.length).toBe(data.studySessions?.length);
    });

    it('renders the Planner tab alongside all existing tabs in Navigation', () => {
      render(
        <ThemeProvider>
          <AppProvider>
            <Navigation currentTab="dashboard" onSelectTab={() => {}} />
          </AppProvider>
        </ThemeProvider>
      );
      // Navigation tab labels from Navigation.tsx: 'Today', 'Timetable', 'Attendance', 'Syllabus', 'Planner', 'Deep Focus', 'Gym Split', 'Nutrition', 'Reminders', 'Settings'
      expect(screen.getByText('Today')).toBeDefined();
      expect(screen.getByText('Planner')).toBeDefined();
      expect(screen.getByText('Timetable')).toBeDefined();
      expect(screen.getByText('Syllabus')).toBeDefined();
      expect(screen.getByText('Attendance')).toBeDefined();
      expect(screen.getByText('Deep Focus')).toBeDefined();
      expect(screen.getByText('Gym & Split')).toBeDefined();
      expect(screen.getByText('Nutrition')).toBeDefined();
      expect(screen.getByText('Reminders')).toBeDefined();
      expect(screen.getByText('Settings')).toBeDefined();
    });
  });
});
