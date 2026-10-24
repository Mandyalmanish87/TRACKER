import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AppProvider } from '../src/context/AppContext';
import { ThemeProvider } from '../src/theme/ThemeContext';
import { TestsView } from '../src/components/views/TestsView';
import { TestSummaryWidget } from '../src/components/dashboard/TestSummaryWidget';
import { Navigation } from '../src/components/common/Navigation';
import { MainApp } from '../src/App';
import {
  calculateScorePercentage,
  calculateAccuracyPercentage,
  calculateCategoryStats,
  detectRecurringWeaknesses,
} from '../src/utils/testAnalytics';
import { MockTest, ErrorLogEntry } from '../src/types';
import { storageService } from '../src/services/storage';

describe('Milestone 6: Mock-Test Analytics & Systematic Error Log', () => {
  beforeEach(() => {
    localStorage.clear();
    storageService.populateSampleData();
  });

  describe('1. Mathematical Calculations & Analytics Safety', () => {
    it('calculates score percentage safely and guards against maxMarks <= 0', () => {
      expect(calculateScorePercentage(75, 100)).toBe(75);
      expect(calculateScorePercentage(215, 300)).toBe(71.7);
      expect(calculateScorePercentage(0, 100)).toBe(0);
      expect(calculateScorePercentage(50, 0)).toBe(0);
      expect(calculateScorePercentage(50, -10)).toBe(0);
    });

    it('calculates accuracy percentage safely with division-by-zero protection', () => {
      expect(calculateAccuracyPercentage(45, 50)).toBe(90);
      expect(calculateAccuracyPercentage(54, 65)).toBe(83.1);
      expect(calculateAccuracyPercentage(0, 0)).toBe(0);
      expect(calculateAccuracyPercentage(10, 0)).toBe(0);
      expect(calculateAccuracyPercentage(10, -5)).toBe(0);
    });

    it('accurately distinguishes score % and accuracy % in category stats', () => {
      const tests: MockTest[] = [
        {
          id: 't1',
          title: 'Mock 1',
          category: 'Full Length',
          date: '2026-10-01',
          totalScore: 180,
          maxMarks: 300, // 60% score
          questionsAttempted: 50,
          questionsCorrect: 45, // 90% accuracy
          createdAt: '2026-10-01T10:00:00Z',
        },
        {
          id: 't2',
          title: 'Mock 2',
          category: 'Full Length',
          date: '2026-10-05',
          totalScore: 210,
          maxMarks: 300, // 70% score
          questionsAttempted: 60,
          questionsCorrect: 48, // 80% accuracy
          createdAt: '2026-10-05T10:00:00Z',
        },
      ];

      const stats = calculateCategoryStats(tests, 'Full Length');
      expect(stats.isMixedMaxMarks).toBe(false);
      expect(stats.avgScorePercentage).toBe(65); // (60 + 70) / 2
      expect(stats.avgAccuracy).toBe(85); // (90 + 80) / 2
      expect(stats.bestScorePercentage).toBe(70);
      expect(stats.movingAverage).toHaveLength(2);
      expect(stats.movingAverage[1]).toBe(65);
    });

    it('detects mixed maximum marks across tests to prevent flawed summation', () => {
      const tests: MockTest[] = [
        {
          id: 't1',
          title: 'Quiz',
          category: 'Mixed Cat',
          date: '2026-10-01',
          totalScore: 80,
          maxMarks: 100, // 80%
          questionsAttempted: 25,
          questionsCorrect: 20,
          createdAt: '2026-10-01T10:00:00Z',
        },
        {
          id: 't2',
          title: 'Grand Mock',
          category: 'Mixed Cat',
          date: '2026-10-05',
          totalScore: 210,
          maxMarks: 300, // 70%
          questionsAttempted: 70,
          questionsCorrect: 60,
          createdAt: '2026-10-05T10:00:00Z',
        },
      ];

      const stats = calculateCategoryStats(tests, 'Mixed Cat');
      expect(stats.isMixedMaxMarks).toBe(true);
      expect(stats.commonMaxMarks).toBeNull();
      expect(stats.avgScorePercentage).toBe(75); // (80 + 70) / 2
    });
  });

  describe('2. Systematic Weakness Radar & Recurring Detection (>= 3 Threshold)', () => {
    it('flags chapter as recurring weakness if and only if unresolved count >= 3', () => {
      const errors: ErrorLogEntry[] = [
        {
          id: 'e1',
          title: 'Binary Search Edge Case',
          subjectId: 'sub-1',
          syllabusChapterId: 'chap-algo-1',
          errorType: 'conceptual',
          reviewedCount: 0,
          resolved: false,
          createdAt: '2026-10-01T10:00:00Z',
        },
        {
          id: 'e2',
          title: 'Sign flip in recursion',
          subjectId: 'sub-1',
          syllabusChapterId: 'chap-algo-1',
          errorType: 'calculation',
          reviewedCount: 0,
          resolved: false,
          createdAt: '2026-10-02T10:00:00Z',
        },
      ];

      // Exactly 2 errors -> NOT recurring
      let weaknesses = detectRecurringWeaknesses(errors);
      const algoWeakness = weaknesses.find((w) => w.chapterId === 'chap-algo-1');
      expect(algoWeakness).toBeDefined();
      expect(algoWeakness?.errorCount).toBe(2);
      expect(algoWeakness?.isRecurring).toBe(false);

      // Add 3rd error -> MUST trigger isRecurring = true
      errors.push({
        id: 'e3',
        title: 'Cycle condition missed',
        subjectId: 'sub-1',
        syllabusChapterId: 'chap-algo-1',
        errorType: 'formula',
        reviewedCount: 0,
        resolved: false,
        createdAt: '2026-10-03T10:00:00Z',
      });

      weaknesses = detectRecurringWeaknesses(errors);
      const updatedAlgo = weaknesses.find((w) => w.chapterId === 'chap-algo-1');
      expect(updatedAlgo?.errorCount).toBe(3);
      expect(updatedAlgo?.isRecurring).toBe(true);
    });

    it('excludes resolved errors from recurring weakness calculation', () => {
      const errors: ErrorLogEntry[] = [
        {
          id: 'e1',
          title: 'Error 1',
          subjectId: 'sub-1',
          syllabusChapterId: 'chap-algo-1',
          errorType: 'conceptual',
          reviewedCount: 1,
          resolved: true, // RESOLVED
          createdAt: '2026-10-01T10:00:00Z',
        },
        {
          id: 'e2',
          title: 'Error 2',
          subjectId: 'sub-1',
          syllabusChapterId: 'chap-algo-1',
          errorType: 'calculation',
          reviewedCount: 0,
          resolved: false,
          createdAt: '2026-10-02T10:00:00Z',
        },
        {
          id: 'e3',
          title: 'Error 3',
          subjectId: 'sub-1',
          syllabusChapterId: 'chap-algo-1',
          errorType: 'silly',
          reviewedCount: 0,
          resolved: false,
          createdAt: '2026-10-03T10:00:00Z',
        },
      ];

      const weaknesses = detectRecurringWeaknesses(errors);
      const algoWeakness = weaknesses.find((w) => w.chapterId === 'chap-algo-1');
      expect(algoWeakness?.errorCount).toBe(2);
      expect(algoWeakness?.isRecurring).toBe(false);
    });
  });

  describe('3. TestsView UI & Weakness Radar Interactions', () => {
    it('renders Mock-Test Analytics view with KPI cards and sample test progression', () => {
      render(
        <ThemeProvider>
          <AppProvider>
            <TestsView />
          </AppProvider>
        </ThemeProvider>
      );

      // Check header
      expect(screen.getByText(/Mock-Test Analytics & Error Log/i)).toBeInTheDocument();
      expect(screen.getByText(/Mock-Test Analytics \(3\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Weakness Radar/i)).toBeInTheDocument();

      // Check KPI Cards
      expect(screen.getByText(/Tests Taken/i)).toBeInTheDocument();
      expect(screen.getByText(/Average Score %/i)).toBeInTheDocument();
      expect(screen.getByText(/Average Accuracy %/i)).toBeInTheDocument();

      // Check default sample tests (may appear in both trend chart and history list)
      expect(screen.getAllByText(/Mid-Semester Practice Test 1/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/Full Length Mock 1/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/Full Length Mock 2/i).length).toBeGreaterThanOrEqual(1);
    });

    it('switches to Weakness Radar and displays recurring weakness alert banner', () => {
      render(
        <ThemeProvider>
          <AppProvider>
            <TestsView />
          </AppProvider>
        </ThemeProvider>
      );

      // Click Weakness Radar sub-tab
      const radarTab = screen.getByRole('button', { name: /Weakness Radar/i });
      fireEvent.click(radarTab);

      // Banner should be visible because DEFAULT_ERROR_LOGS has 3 errors in chap-algo-1
      expect(screen.getByText(/Recurring Weakness Radar Alert/i)).toBeInTheDocument();
      expect(screen.getAllByText(/3 mistakes/i).length).toBeGreaterThanOrEqual(1);

      // Check error cards
      expect(screen.getByText(/Off-by-one in binary search index bounds/i)).toBeInTheDocument();
      expect(screen.getByText(/Sign error in recurrence relation calculation/i)).toBeInTheDocument();
      expect(screen.getByText(/Forgot graph cycle constraint in topological sort/i)).toBeInTheDocument();
    });

    it('bridges error to study planner with 1-click and prevents duplicate tasks', async () => {
      render(
        <ThemeProvider>
          <AppProvider>
            <TestsView />
          </AppProvider>
        </ThemeProvider>
      );

      // Switch to Weakness Radar
      const radarTab = screen.getByRole('button', { name: /Weakness Radar/i });
      fireEvent.click(radarTab);

      // Find the first "1-Click Revision Task" button
      const convertButtons = screen.getAllByRole('button', { name: /1-Click Revision Task/i });
      expect(convertButtons.length).toBeGreaterThan(0);

      // Click to convert error to planner task
      fireEvent.click(convertButtons[0]);

      // Check toast or button transition
      await waitFor(() => {
        expect(screen.getByText(/Successfully scheduled high-priority revision task/i)).toBeInTheDocument();
      });

      // After conversion, button should show "View Task ➔"
      await waitFor(() => {
        expect(screen.getAllByText(/View Task ➔/i).length).toBeGreaterThanOrEqual(1);
      });
    });

    it('logs a new mock test through the modal form', async () => {
      render(
        <ThemeProvider>
          <AppProvider>
            <TestsView />
          </AppProvider>
        </ThemeProvider>
      );

      // Open Modal
      const logButton = screen.getByRole('button', { name: /Log Mock Test/i });
      fireEvent.click(logButton);

      expect(screen.getByText(/Log Mock Test Performance/i)).toBeInTheDocument();

      // Fill in details
      const titleInput = screen.getByPlaceholderText(/e\.g\. Full Length Mock 3/i);
      const scoreInput = screen.getByPlaceholderText(/e\.g\. 210/i);
      const attemptedInput = screen.getByPlaceholderText(/e\.g\. 70/i);
      const correctInput = screen.getByPlaceholderText(/e\.g\. 62/i);

      fireEvent.change(titleInput, { target: { value: 'Unit Assessment 4' } });
      fireEvent.change(scoreInput, { target: { value: '88' } });
      fireEvent.change(attemptedInput, { target: { value: '45' } });
      fireEvent.change(correctInput, { target: { value: '42' } });

      const saveButton = screen.getByRole('button', { name: /Save Test/i });
      fireEvent.submit(saveButton.closest('form')!);

      await waitFor(() => {
        expect(screen.getAllByText(/Unit Assessment 4/i).length).toBeGreaterThanOrEqual(1);
      });
    });
  });

  describe('4. Navigation & Dashboard Integration', () => {
    it('renders Tests & Errors tab in navigation with recurring weakness count badge', () => {
      render(
        <ThemeProvider>
          <AppProvider>
            <Navigation currentTab="dashboard" onSelectTab={() => {}} />
          </AppProvider>
        </ThemeProvider>
      );

      const testsTab = screen.getByRole('button', { name: /Tests & Errors/i });
      expect(testsTab).toBeInTheDocument();
      // Should display badge for the 1 recurring weakness zone
      expect(testsTab).toHaveTextContent('1');
    });

    it('renders TestSummaryWidget on dashboard with score and recurring weakness alert', () => {
      render(
        <ThemeProvider>
          <AppProvider>
            <TestSummaryWidget />
          </AppProvider>
        </ThemeProvider>
      );

      expect(screen.getByText(/Mock-Test & Weakness Radar/i)).toBeInTheDocument();
      expect(screen.getByText(/1 Recurring Weakness Zone/i)).toBeInTheDocument();
      expect(screen.getByText(/Latest Test/i)).toBeInTheDocument();
    });

    it('navigates seamlessly from Dashboard to TestsView in the full App shell', async () => {
      render(
        <ThemeProvider>
          <AppProvider>
            <MainApp />
          </AppProvider>
        </ThemeProvider>
      );

      // On Today dashboard by default, click the Tests & Errors navigation tab
      const testsTab = screen.getByRole('button', { name: /Tests & Errors/i });
      fireEvent.click(testsTab);

      // Verify TestsView is rendered
      await waitFor(() => {
        expect(screen.getByText(/Mock-Test Analytics & Error Log/i)).toBeInTheDocument();
      });
    });
  });
});

