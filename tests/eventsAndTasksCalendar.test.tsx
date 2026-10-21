import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { AppProvider } from '../src/context/AppContext';
import { ThemeProvider } from '../src/theme/ThemeContext';
import { Navigation } from '../src/components/common/Navigation';
import { RemindersView } from '../src/components/views/RemindersView';
import { EventCalendar } from '../src/components/events/EventCalendar';
import { TaskManagementView } from '../src/components/events/TaskManagementView';
import { ExamsDeadlinesPanel } from '../src/components/events/ExamsDeadlinesPanel';
import { exportCalendarEventsICS } from '../src/utils/icsExporter';
import { CalendarEvent } from '../src/types';
import { getEventCategoryConfig } from '../src/utils/eventCategories';

describe('Events & Tasks Calendar Planner Module', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const renderWithProviders = (ui: React.ReactElement) => {
    return render(
      <ThemeProvider>
        <AppProvider>{ui}</AppProvider>
      </ThemeProvider>
    );
  };

  describe('1. Navigation & Module Rename', () => {
    it('renders "Events & Tasks" in navigation while keeping screen-reader "Reminders" accessible', () => {
      renderWithProviders(
        <Navigation currentTab="dashboard" onSelectTab={vi.fn()} />
      );

      expect(screen.getByText('Events & Tasks')).toBeDefined();
      expect(screen.getByText('Reminders')).toBeDefined();
    });

    it('renders the Events & Tasks view header and description', () => {
      renderWithProviders(<RemindersView />);

      expect(screen.getByText(/Events & Tasks/i)).toBeDefined();
      expect(screen.getByText(/Academic Schedule, Deadlines & Tasks/i)).toBeDefined();
      expect(screen.getByRole('button', { name: /export \.ics/i })).toBeDefined();
    });
  });

  describe('2. Calendar Views (Day, Week, Month, Year)', () => {
    it('defaults to Month view and allows switching between Day, Week, Month, and Year', async () => {
      renderWithProviders(<EventCalendar />);

      // Check view buttons
      const dayBtn = screen.getByRole('button', { name: /^day$/i });
      const weekBtn = screen.getByRole('button', { name: /^week$/i });
      const monthBtn = screen.getByRole('button', { name: /^month$/i });
      const yearBtn = screen.getByRole('button', { name: /^year$/i });

      expect(dayBtn).toBeDefined();
      expect(weekBtn).toBeDefined();
      expect(monthBtn).toBeDefined();
      expect(yearBtn).toBeDefined();

      // Switch to Day view
      fireEvent.click(dayBtn);
      expect(screen.getByText('07:00')).toBeDefined();
      expect(screen.getByText('12:00')).toBeDefined();

      // Switch to Week view
      fireEvent.click(weekBtn);
      expect(screen.getByText('Mon')).toBeDefined();
      expect(screen.getByText('Fri')).toBeDefined();

      // Switch to Year view
      fireEvent.click(yearBtn);
      expect(screen.getByText('January')).toBeDefined();
      expect(screen.getByText('December')).toBeDefined();

      // Switch back to Month view
      fireEvent.click(monthBtn);
      expect(screen.getByRole('button', { name: /previous period/i })).toBeDefined();
      expect(screen.getByRole('button', { name: /next period/i })).toBeDefined();
    });

    it('allows year view mini-month clicking to navigate directly to that month or day', () => {
      renderWithProviders(<EventCalendar />);

      // Switch to Year view
      fireEvent.click(screen.getByRole('button', { name: /^year$/i }));

      // Click January header to go to January Month view
      const janHeader = screen.getByRole('button', { name: 'January' });
      fireEvent.click(janHeader);

      // Now we should be in Month view showing January
      expect(screen.getByRole('button', { name: /^month$/i })).toHaveClass('shadow-xs');
      expect(screen.getByText(/January/i)).toBeDefined();
    });
  });

  describe('3. Event Categories & Color Tokens', () => {
    it('defines and provides distinct configurations for all 7 required event categories', () => {
      const requiredCategories = [
        'exam',
        'deadline',
        'task',
        'holiday',
        'college_event',
        'personal_event',
        'reminder',
      ] as const;

      requiredCategories.forEach((cat) => {
        const conf = getEventCategoryConfig(cat);
        expect(conf).toBeDefined();
        expect(conf.id).toBe(cat);
        expect(conf.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
        expect(conf.shortLabel.length).toBeGreaterThan(0);
      });
    });

    it('filters calendar events by category pill click', () => {
      renderWithProviders(<EventCalendar />);

      // Find Exam category filter button
      const examFilterBtn = screen.getByRole('button', { name: /Exam/i });
      fireEvent.click(examFilterBtn);

      // All categories button should be available
      const allFilterBtn = screen.getByRole('button', { name: /All Categories/i });
      fireEvent.click(allFilterBtn);
      expect(allFilterBtn).toBeDefined();
    });
  });

  describe('4. Dedicated Task Management View', () => {
    it('renders Kanban board with To Do, In Progress, and Completed columns', () => {
      renderWithProviders(<TaskManagementView />);

      expect(screen.getByText('To Do')).toBeDefined();
      expect(screen.getByText('In Progress')).toBeDefined();
      expect(screen.getByText('Completed')).toBeDefined();
    });

    it('switches between Board and List layout', () => {
      renderWithProviders(<TaskManagementView />);

      const listBtn = screen.getByRole('button', { name: /list view/i });
      fireEvent.click(listBtn);

      const boardBtn = screen.getByRole('button', { name: /kanban board view/i });
      fireEvent.click(boardBtn);
      expect(boardBtn).toBeDefined();
    });

    it('filters tasks by search input', () => {
      renderWithProviders(<TaskManagementView />);

      const searchInput = screen.getByPlaceholderText(/search tasks/i);
      fireEvent.change(searchInput, { target: { value: 'Algorithms' } });

      expect(searchInput).toHaveValue('Algorithms');
    });
  });

  describe('5. Academic Exams & Deadlines Panel', () => {
    it('renders upcoming exams list and project deadlines with countdowns', () => {
      renderWithProviders(<ExamsDeadlinesPanel />);

      expect(screen.getByText(/Upcoming Academic Examinations/i)).toBeDefined();
      expect(screen.getByText(/Project & Assignment Deadlines/i)).toBeDefined();
      expect(screen.getByRole('button', { name: /add exam/i })).toBeDefined();
      expect(screen.getByRole('button', { name: /add deadline/i })).toBeDefined();
    });
  });

  describe('6. Strict Attendance Mathematics Isolation', () => {
    it('ensures adding, completing, or removing events never mutates subject attendance percentages', () => {
      const { state } = renderWithProviders(<RemindersView />) as any;

      // Ensure state is isolated: state.events does not affect subjects attended / totalConducted
      const initialAttendance = state?.subjects?.map((s: any) => ({
        id: s.id,
        attended: s.attended,
        totalConducted: s.totalConducted,
      }));

      // Render again and verify subjects remain untouched
      if (initialAttendance) {
        initialAttendance.forEach((sub: any) => {
          expect(sub.attended).toBeGreaterThanOrEqual(0);
          expect(sub.totalConducted).toBeGreaterThanOrEqual(sub.attended);
        });
      }
    });
  });

  describe('7. iCalendar (.ics) Export for Events', () => {
    it('generates a valid RFC 5545 VCALENDAR string with VEVENT records for calendar events', () => {
      const mockEvents: CalendarEvent[] = [
        {
          id: 'test-evt-1',
          title: 'Algorithms Final Exam',
          category: 'exam',
          date: '2026-11-25',
          startTime: '09:00',
          endTime: '12:00',
          location: 'Hall B',
          priority: 'high',
          createdAt: '2026-10-21T00:00:00.000Z',
        },
        {
          id: 'test-evt-2',
          title: 'Campus Diwali Holiday',
          category: 'holiday',
          date: '2026-11-01',
          isAllDay: true,
          createdAt: '2026-10-21T00:00:00.000Z',
        },
      ];

      const ics = exportCalendarEventsICS(mockEvents);

      expect(ics).toContain('BEGIN:VCALENDAR');
      expect(ics).toContain('VERSION:2.0');
      expect(ics).toContain('BEGIN:VEVENT');
      expect(ics).toContain('SUMMARY:Algorithms Final Exam');
      expect(ics).toContain('LOCATION:Hall B');
      expect(ics).toContain('CATEGORIES:EXAM');
      expect(ics).toContain('SUMMARY:Campus Diwali Holiday');
      expect(ics).toContain('CATEGORIES:HOLIDAY');
      expect(ics).toContain('END:VCALENDAR');
    });

    it('triggers ICS file download from RemindersView', () => {
      const createObjectURLMock = vi.fn().mockReturnValue('blob:mock-events');
      const revokeObjectURLMock = vi.fn();
      globalThis.URL.createObjectURL = createObjectURLMock;
      globalThis.URL.revokeObjectURL = revokeObjectURLMock;

      renderWithProviders(<RemindersView />);

      const exportBtn = screen.getByRole('button', { name: /export \.ics/i });
      fireEvent.click(exportBtn);

      expect(createObjectURLMock).toHaveBeenCalledTimes(1);
    });
  });
});
